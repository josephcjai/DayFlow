package com.dayflow.app.domain

import com.dayflow.app.domain.model.DefaultNoteSheets
import com.dayflow.app.domain.model.NoteSheet
import com.dayflow.app.domain.model.NotesSaveStatus
import com.dayflow.app.presentation.todos.parseInlineMarkdown
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class Phase14NotesAndMarkdownTest {

    @Test
    fun defaultNoteSheets_containsExpectedBuiltinSheets() {
        val sheets = DefaultNoteSheets.ALL
        assertEquals(5, sheets.size)
        assertTrue(sheets.any { it.id == "journal" && it.title == "Weekly Journal" })
        assertTrue(sheets.any { it.id == "daily_journal" && it.title == "Daily Journal" })
        assertTrue(sheets.any { it.id == "tech" && it.title == "Tech & Architecture" })
        assertTrue(sheets.any { it.id == "backlog" && it.title == "Sprint Backlog" })
        assertTrue(sheets.any { it.id == "scratchpad" && it.title == "Quick Scratchpad" })
        assertTrue(sheets.all { it.isDefault })
    }

    @Test
    fun dailyJournal_resolvesDailyContentPerDate() {
        val today = LocalDate.of(2026, 10, 13)
        val tomorrow = LocalDate.of(2026, 10, 14)

        val dailySheet = NoteSheet(
            id = "daily_journal",
            title = "Daily Journal",
            icon = "📅",
            content = "Fallback",
            dailyContent = mapOf(
                "2026-10-13" to "Tuesday Notes",
                "2026-10-14" to "Wednesday Notes"
            ),
            isDefault = true
        )

        assertEquals("Tuesday Notes", dailySheet.dailyContent["2026-10-13"])
        assertEquals("Wednesday Notes", dailySheet.dailyContent["2026-10-14"])
        assertNull(dailySheet.dailyContent["2026-10-15"])
    }

    @Test
    fun customNoteSheet_canBeAddedAndIdentified() {
        val baseSheets = DefaultNoteSheets.ALL
        val customSheet = NoteSheet(
            id = "custom_123",
            title = "1-on-1 Sync Notes",
            icon = "💡",
            content = "# 1-on-1 Sync\nAction items here",
            isDefault = false
        )

        val updatedSheets = baseSheets + customSheet
        assertEquals(6, updatedSheets.size)
        assertFalse(updatedSheets.last().isDefault)
        assertEquals("💡", updatedSheets.last().icon)
    }

    @Test
    fun deleteCustomSheet_removesTargetSheetOnly() {
        val baseSheets = DefaultNoteSheets.ALL
        val customSheet1 = NoteSheet(id = "custom_1", title = "Sheet 1", icon = "📝", isDefault = false)
        val customSheet2 = NoteSheet(id = "custom_2", title = "Sheet 2", icon = "🚀", isDefault = false)

        val list = baseSheets + listOf(customSheet1, customSheet2)
        assertEquals(7, list.size)

        val afterDelete = list.filter { it.id != "custom_1" }
        assertEquals(6, afterDelete.size)
        assertFalse(afterDelete.any { it.id == "custom_1" })
        assertTrue(afterDelete.any { it.id == "custom_2" })
    }

    @Test
    fun parseInlineMarkdown_handlesBoldItalicAndCode() {
        val boldText = parseInlineMarkdown("This is **bold** text")
        assertEquals("This is bold text", boldText.text)

        val codeText = parseInlineMarkdown("Here is `val x = 10` in Kotlin")
        assertEquals("Here is  val x = 10  in Kotlin", codeText.text)

        val italicText = parseInlineMarkdown("This is *italic* note")
        assertEquals("This is italic note", italicText.text)
    }

    @Test
    fun notesSaveStatus_hasCorrectColorsAndLabels() {
        assertEquals("Saved ✓", NotesSaveStatus.SAVED.label)
        assertEquals("#10B981", NotesSaveStatus.SAVED.hexColor)

        assertEquals("Unsaved", NotesSaveStatus.UNSAVED.label)
        assertEquals("#F59E0B", NotesSaveStatus.UNSAVED.hexColor)

        assertEquals("Saving...", NotesSaveStatus.SAVING.label)
        assertEquals("#38BDF8", NotesSaveStatus.SAVING.hexColor)
    }
}
