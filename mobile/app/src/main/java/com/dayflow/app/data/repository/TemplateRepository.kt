package com.dayflow.app.data.repository

import com.dayflow.app.data.local.DayTemplateDao
import com.dayflow.app.data.local.DayTemplateEntity
import com.dayflow.app.data.local.MutationQueueDao
import com.dayflow.app.data.local.MutationQueueEntity
import com.dayflow.app.data.model.DayTemplateDto
import com.dayflow.app.data.model.TemplateSlotDto
import com.dayflow.app.data.remote.DayFlowApiService
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.domain.model.DayTemplate
import com.dayflow.app.domain.model.DefaultDayTemplates
import com.dayflow.app.domain.model.TemplateSlot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

interface TemplateRepository {
    fun getTemplates(): Flow<List<DayTemplate>>
    suspend fun refreshTemplates(): Result<Unit>
    suspend fun createTemplate(name: String, description: String, slots: Map<String, TemplateSlot>): Result<DayTemplate>
    suspend fun deleteTemplate(id: String): Result<Unit>
    suspend fun seedDefaultTemplates()
}

@Singleton
class TemplateRepositoryImpl @Inject constructor(
    private val dayTemplateDao: DayTemplateDao,
    private val mutationQueueDao: MutationQueueDao,
    private val apiService: DayFlowApiService,
    private val tokenManager: TokenManager,
    private val json: Json
) : TemplateRepository {

    override fun getTemplates(): Flow<List<DayTemplate>> {
        return dayTemplateDao.getAllTemplates().map { list ->
            list.map { it.toDomain() }
        }
    }

    override suspend fun refreshTemplates(): Result<Unit> = withContext(Dispatchers.IO) {
        if (tokenManager.isDemoMode()) {
            seedDefaultTemplates()
            return@withContext Result.success(Unit)
        }

        try {
            val response = apiService.getTemplates()
            if (response.isSuccessful && response.body() != null) {
                val dtoList = response.body()!!.templates
                val entities = dtoList.map { dto ->
                    DayTemplateEntity(
                        id = dto.id,
                        name = dto.name,
                        description = dto.description,
                        slotsJson = json.encodeToString(dto.slots),
                        isDefault = dto.isDefault,
                        isSyncPending = false
                    )
                }
                dayTemplateDao.clearTemplates()
                dayTemplateDao.upsertTemplates(entities)
                Result.success(Unit)
            } else {
                seedDefaultTemplates()
                Result.failure(Exception("Failed to fetch templates ()"))
            }
        } catch (e: Exception) {
            seedDefaultTemplates()
            Result.failure(e)
        }
    }

    override suspend fun createTemplate(
        name: String,
        description: String,
        slots: Map<String, TemplateSlot>
    ): Result<DayTemplate> = withContext(Dispatchers.IO) {
        val tempId = UUID.randomUUID().toString()
        val dtoJsonMap = slots.mapValues { (_, s) ->
            TemplateSlotDto(
                title = s.title,
                plannedTask = s.plannedTask,
                category = s.category,
                planned = s.planned
            )
        }
        val slotsJson = json.encodeToString(dtoJsonMap)

        val entity = DayTemplateEntity(
            id = tempId,
            name = name.trim(),
            description = description.trim(),
            slotsJson = slotsJson,
            isDefault = false,
            isSyncPending = true
        )
        dayTemplateDao.upsertTemplate(entity)

        if (tokenManager.isDemoMode()) {
            val confirmed = entity.copy(isSyncPending = false)
            dayTemplateDao.upsertTemplate(confirmed)
            return@withContext Result.success(confirmed.toDomain())
        }

        val request = DayTemplateDto(
            id = tempId,
            name = name.trim(),
            description = description.trim(),
            slots = dtoJsonMap,
            isDefault = false
        )

        try {
            val response = apiService.createTemplate(request)
            if (response.isSuccessful && response.body() != null) {
                val serverTemplate = response.body()!!
                val confirmed = entity.copy(id = serverTemplate.id, isSyncPending = false)
                dayTemplateDao.deleteTemplate(tempId)
                dayTemplateDao.upsertTemplate(confirmed)
                Result.success(confirmed.toDomain())
            } else {
                enqueueMutation("templates", "POST", json.encodeToString(request))
                Result.success(entity.toDomain())
            }
        } catch (e: Exception) {
            enqueueMutation("templates", "POST", json.encodeToString(request))
            Result.success(entity.toDomain())
        }
    }

    override suspend fun deleteTemplate(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        dayTemplateDao.deleteTemplate(id)

        if (tokenManager.isDemoMode()) {
            return@withContext Result.success(Unit)
        }

        try {
            val response = apiService.deleteTemplate(id)
            if (!response.isSuccessful) {
                enqueueMutation("templates/$id", "DELETE", "")
            }
            Result.success(Unit)
        } catch (e: Exception) {
            enqueueMutation("templates/$id", "DELETE", "")
            Result.success(Unit)
        }
    }

    override suspend fun seedDefaultTemplates() = withContext(Dispatchers.IO) {
        val existing = dayTemplateDao.getAllTemplatesSync()
        if (existing.isEmpty()) {
            val defaults = DefaultDayTemplates.ALL.map { tmpl ->
                val dtoJsonMap = tmpl.slots.mapValues { (_, s) ->
                    TemplateSlotDto(
                        title = s.title,
                        plannedTask = s.plannedTask,
                        category = s.category,
                        planned = s.planned
                    )
                }
                DayTemplateEntity(
                    id = tmpl.id,
                    name = tmpl.name,
                    description = tmpl.description,
                    slotsJson = json.encodeToString(dtoJsonMap),
                    isDefault = tmpl.isDefault,
                    isSyncPending = false
                )
            }
            dayTemplateDao.upsertTemplates(defaults)
        }
    }

    private suspend fun enqueueMutation(endpoint: String, method: String, payloadJson: String) {
        mutationQueueDao.enqueue(
            MutationQueueEntity(
                endpoint = endpoint,
                httpMethod = method,
                payloadJson = payloadJson
            )
        )
    }

    private fun DayTemplateEntity.toDomain(): DayTemplate {
        val parsedSlots = try {
            val dtoMap = json.decodeFromString<Map<String, TemplateSlotDto>>(slotsJson)
            dtoMap.mapValues { (time, dto) ->
                TemplateSlot(
                    time = time,
                    title = dto.title,
                    plannedTask = dto.plannedTask,
                    category = dto.category,
                    planned = dto.planned
                )
            }
        } catch (e: Exception) {
            emptyMap()
        }

        return DayTemplate(
            id = id,
            name = name,
            description = description,
            slots = parsedSlots,
            isDefault = isDefault
        )
    }
}