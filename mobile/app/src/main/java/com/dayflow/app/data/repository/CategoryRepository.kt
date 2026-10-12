package com.dayflow.app.data.repository

import com.dayflow.app.data.local.CategoryDao
import com.dayflow.app.data.local.CategoryEntity
import com.dayflow.app.data.local.MutationQueueDao
import com.dayflow.app.data.local.MutationQueueEntity
import com.dayflow.app.data.model.CategoryDto
import com.dayflow.app.data.remote.DayFlowApiService
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.CategoryItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

interface CategoryRepository {
    fun getCategories(): Flow<List<CategoryItem>>
    suspend fun refreshCategories(): Result<Unit>
    suspend fun createCategory(name: String, color: String, icon: String, isProductive: Boolean): Result<CategoryItem>
    suspend fun deleteCategory(id: String): Result<Unit>
    suspend fun seedDefaultCategories()
}

@Singleton
class CategoryRepositoryImpl @Inject constructor(
    private val categoryDao: CategoryDao,
    private val mutationQueueDao: MutationQueueDao,
    private val apiService: DayFlowApiService,
    private val tokenManager: TokenManager,
    private val json: Json
) : CategoryRepository {

    override fun getCategories(): Flow<List<CategoryItem>> {
        return categoryDao.getActiveCategories().map { list ->
            list.map { it.toDomain() }
        }
    }

    override suspend fun refreshCategories(): Result<Unit> = withContext(Dispatchers.IO) {
        if (tokenManager.isDemoMode()) {
            seedDefaultCategories()
            return@withContext Result.success(Unit)
        }

        try {
            val response = apiService.getCategories()
            if (response.isSuccessful && response.body() != null) {
                val dtoList = response.body()!!.categories
                val entities = dtoList.map { dto ->
                    CategoryEntity(
                        id = dto.id,
                        name = dto.name,
                        color = dto.color,
                        icon = dto.icon,
                        isProductive = dto.isProductive,
                        isSystem = dto.isSystem,
                        isArchived = dto.isArchived,
                        sortOrder = dto.sortOrder,
                        isSyncPending = false
                    )
                }
                categoryDao.clearCategories()
                categoryDao.upsertCategories(entities)
                Result.success(Unit)
            } else {
                seedDefaultCategories()
                Result.failure(Exception("Failed to fetch categories (${response.code()})"))
            }
        } catch (e: Exception) {
            seedDefaultCategories()
            Result.failure(e)
        }
    }

    override suspend fun createCategory(
        name: String,
        color: String,
        icon: String,
        isProductive: Boolean
    ): Result<CategoryItem> = withContext(Dispatchers.IO) {
        val existing = categoryDao.getActiveCategoriesSync()
        val newOrder = existing.size
        val tempId = UUID.randomUUID().toString()

        val entity = CategoryEntity(
            id = tempId,
            name = name.trim(),
            color = color,
            icon = icon,
            isProductive = isProductive,
            isSystem = false,
            isArchived = false,
            sortOrder = newOrder,
            isSyncPending = true
        )
        categoryDao.upsertCategory(entity)

        if (tokenManager.isDemoMode()) {
            val confirmed = entity.copy(isSyncPending = false)
            categoryDao.upsertCategory(confirmed)
            return@withContext Result.success(confirmed.toDomain())
        }

        val request = CategoryDto(
            id = tempId,
            name = name.trim(),
            color = color,
            icon = icon,
            isProductive = isProductive,
            isSystem = false,
            isArchived = false,
            sortOrder = newOrder
        )

        try {
            val response = apiService.createCategory(request)
            if (response.isSuccessful && response.body() != null) {
                val serverCategory = response.body()!!
                val confirmed = entity.copy(id = serverCategory.id, isSyncPending = false)
                categoryDao.deleteCategory(tempId)
                categoryDao.upsertCategory(confirmed)
                Result.success(confirmed.toDomain())
            } else {
                enqueueMutation("categories", "POST", json.encodeToString(request))
                Result.success(entity.toDomain())
            }
        } catch (e: Exception) {
            enqueueMutation("categories", "POST", json.encodeToString(request))
            Result.success(entity.toDomain())
        }
    }

    override suspend fun deleteCategory(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        categoryDao.archiveCategory(id, isSyncPending = true)

        if (tokenManager.isDemoMode()) {
            categoryDao.deleteCategory(id)
            return@withContext Result.success(Unit)
        }

        try {
            val response = apiService.deleteCategory(id)
            if (response.isSuccessful) {
                categoryDao.deleteCategory(id)
            } else {
                enqueueMutation("categories/$id", "DELETE", "")
            }
            Result.success(Unit)
        } catch (e: Exception) {
            enqueueMutation("categories/$id", "DELETE", "")
            Result.success(Unit)
        }
    }

    override suspend fun seedDefaultCategories() = withContext(Dispatchers.IO) {
        val existing = categoryDao.getActiveCategoriesSync()
        if (existing.isEmpty()) {
            val defaults = Category.entries.mapIndexed { index, cat ->
                CategoryEntity(
                    id = if (cat == Category.GENERAL) "cat_general" else "cat_${cat.name.lowercase()}",
                    name = cat.displayName,
                    color = cat.hexColor,
                    icon = cat.icon,
                    isProductive = cat.defaultProductive,
                    isSystem = cat.isSystem,
                    isArchived = false,
                    sortOrder = index,
                    isSyncPending = false
                )
            }
            categoryDao.upsertCategories(defaults)
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

    private fun CategoryEntity.toDomain() = CategoryItem(
        id = id,
        name = name,
        hexColor = color,
        icon = icon,
        isProductive = isProductive,
        isSystem = isSystem,
        sortOrder = sortOrder
    )
}
