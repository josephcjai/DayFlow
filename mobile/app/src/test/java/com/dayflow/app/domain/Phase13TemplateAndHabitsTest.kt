package com.dayflow.app.domain

import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.TemplateSlot
import com.dayflow.app.presentation.habits.QuickHabitTemplate
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class Phase13TemplateAndHabitsTest {

    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }

    @Test
    fun testQuickHabitTemplateSerializationAndCustomFlag() {
        val customPreset = QuickHabitTemplate(
            id = UUID.randomUUID().toString(),
            name = "Guitar Practice",
            category = Category.LEARNING,
            points = 15,
            defaultNotes = "Fingerpicking & Scales",
            icon = "🎸",
            isCustom = true
        )

        val serialized = json.encodeToString(listOf(customPreset))
        assertTrue(serialized.contains("Guitar Practice"))
        assertTrue(serialized.contains("🎸"))

        val deserialized = json.decodeFromString<List<QuickHabitTemplate>>(serialized)
        assertEquals(1, deserialized.size)
        assertEquals("Guitar Practice", deserialized[0].name)
        assertEquals(Category.LEARNING, deserialized[0].category)
        assertEquals(15, deserialized[0].points)
        assertEquals("🎸", deserialized[0].icon)
        assertTrue(deserialized[0].isCustom)
    }

    @Test
    fun testDefaultHabitPresetsIntegrity() {
        val defaults = listOf(
            QuickHabitTemplate("p1", "Deep Focus Block", Category.WORK, 15, "Deep Work / Study Complete", icon = "🎯"),
            QuickHabitTemplate("p2", "Hydration & Health", Category.HEALTH, 5, "Drank Water (500ml+)", icon = "💧"),
            QuickHabitTemplate("p3", "Exercise & Workout", Category.HEALTH, 15, "30-Min Workout / Walk", icon = "🏃"),
            QuickHabitTemplate("p4", "Daily Learning & Reading", Category.LEARNING, 10, "Read / Skill Practice", icon = "📚"),
            QuickHabitTemplate("p5", "Healthy Meal", Category.HEALTH, 5, "Nutritious Meal Logged", icon = "🍽️"),
            QuickHabitTemplate("p6", "Mindful Break & Stretch", Category.HEALTH, 5, "Stretching / Rest Period", icon = "🧘")
        )

        assertEquals(6, defaults.size)
        defaults.forEach {
            assertFalse("Default presets must have isCustom = false", it.isCustom)
            assertTrue("Default preset icon must not be blank", it.icon.isNotBlank())
            assertTrue("Default preset points impact must be positive", it.points > 0)
        }
    }

    @Test
    fun testCaptureDayScheduleIntoTemplateSlotsMap() {
        // Given 3 simulated scheduled slots
        val sampleSlots = mapOf(
            "09:00" to "Daily Team Sync",
            "10:00" to "Design System Polish",
            "14:00" to "API Integration"
        )

        val templateSlots = sampleSlots.mapValues { (time, title) ->
            TemplateSlot(
                time = time,
                title = title,
                plannedTask = title,
                category = "Work",
                planned = 30
            )
        }

        assertEquals(3, templateSlots.size)
        assertEquals("Daily Team Sync", templateSlots["09:00"]?.title)
        assertEquals("Design System Polish", templateSlots["10:00"]?.plannedTask)
        assertEquals("Work", templateSlots["14:00"]?.category)
        assertEquals(30, templateSlots["14:00"]?.planned)
    }
}
