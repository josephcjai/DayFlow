package com.dayflow.app.data

import com.dayflow.app.data.model.AuthResponse
import com.dayflow.app.data.model.LoginRequest
import com.dayflow.app.data.model.SlotDto
import com.dayflow.app.data.model.UserDto
import com.dayflow.app.data.model.WeekScheduleResponse
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class SerializationTest {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    @Test
    fun testLoginRequestSerialization() {
        val request = LoginRequest(email = "test@dayflowlive.com", password = "secretPassword")
        val jsonString = json.encodeToString(request)
        val decoded = json.decodeFromString<LoginRequest>(jsonString)

        assertEquals("test@dayflowlive.com", decoded.email)
        assertEquals("secretPassword", decoded.password)
    }

    @Test
    fun testAuthResponseDeserialization() {
        val jsonString = """
            {
                "message": "Login successful",
                "token": "mock-jwt-token-xyz",
                "user": {
                    "id": "u123",
                    "email": "user@example.com",
                    "displayName": "Test Explorer",
                    "hasPassword": true
                }
            }
        """.trimIndent()

        val response = json.decodeFromString<AuthResponse>(jsonString)
        assertEquals("mock-jwt-token-xyz", response.token)
        assertEquals("u123", response.user.id)
        assertEquals("Test Explorer", response.user.displayName)
    }

    @Test
    fun testWeekScheduleResponseDeserialization() {
        val jsonString = """
            {
                "weekStart": "2026-09-28",
                "slots": {
                    "2026-09-28_09:00": {
                        "slotKey": "2026-09-28_09:00",
                        "plannedTask": "Architecture Planning",
                        "actualTask": "Architecture Planning",
                        "category": "Work",
                        "plannedDuration": 30,
                        "actualDuration": 30,
                        "status": "Done"
                    }
                },
                "habits": [],
                "todos": [],
                "notes": "Weekly goals set"
            }
        """.trimIndent()

        val response = json.decodeFromString<WeekScheduleResponse>(jsonString)
        assertEquals("2026-09-28", response.weekStart)
        assertEquals(1, response.slots.size)
        val slot = response.slots["2026-09-28_09:00"]
        assertNotNull(slot)
        assertEquals("Architecture Planning", slot?.plannedTask)
        assertEquals("Done", slot?.status)
    }
    @Test
    fun testSlotDtoWithIsProductiveSerialization() {
        val dto = SlotDto(
            slotKey = "2026-09-28_11:00",
            plannedTask = "Kotlin Coroutines Deep Dive",
            actualTask = "Kotlin Coroutines Deep Dive",
            category = "Learning",
            plannedDuration = 30,
            actualDuration = 30,
            status = "Done",
            isProductive = true
        )
        val jsonString = json.encodeToString(dto)
        val decoded = json.decodeFromString<SlotDto>(jsonString)

        assertEquals(true, decoded.isProductive)
        assertEquals("Learning", decoded.category)
    }
}