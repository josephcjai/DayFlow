package com.dayflow.app.domain

import com.dayflow.app.domain.util.DateTimeUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

class DateTimeUtilsTest {

    @Test
    fun testFormatAndParseSlotKey() {
        val date = LocalDate.of(2026, 9, 28)
        val time = LocalTime.of(9, 30)

        val slotKey = DateTimeUtils.formatSlotKey(date, time)
        assertEquals("2026-09-28_09:30", slotKey)

        val (parsedDate, parsedTime) = DateTimeUtils.parseSlotKey(slotKey)
        assertEquals(date, parsedDate)
        assertEquals(time, parsedTime)
    }

    @Test
    fun testValidAndInvalidSlotKeys() {
        // Valid 30-minute intervals
        assertTrue(DateTimeUtils.isValidSlotKey("2026-09-28_09:00"))
        assertTrue(DateTimeUtils.isValidSlotKey("2026-09-28_09:30"))
        assertTrue(DateTimeUtils.isValidSlotKey("2026-09-28_00:00"))
        assertTrue(DateTimeUtils.isValidSlotKey("2026-09-28_23:30"))

        // Invalid intervals (non-30 min)
        assertFalse(DateTimeUtils.isValidSlotKey("2026-09-28_09:15"))
        assertFalse(DateTimeUtils.isValidSlotKey("2026-09-28_09:45"))
        assertFalse(DateTimeUtils.isValidSlotKey("2026-09-28_09:05"))

        // Invalid date ranges (outside 1800-2200)
        assertFalse(DateTimeUtils.isValidSlotKey("1799-12-31_09:00"))
        assertFalse(DateTimeUtils.isValidSlotKey("2201-01-01_09:00"))

        // Malformed strings
        assertFalse(DateTimeUtils.isValidSlotKey("invalid_key"))
        assertFalse(DateTimeUtils.isValidSlotKey("2026-02-30_09:00"))
    }

    @Test
    fun testIsSlotTimePassed() {
        val slotKey = "2026-09-28_09:00"

        // 1. Before slot time -> false
        val before = LocalDateTime.of(2026, 9, 28, 8, 45)
        assertFalse(DateTimeUtils.isSlotTimePassed(slotKey, before))

        // 2. Exact slot start time -> true (locked baseline)
        val exact = LocalDateTime.of(2026, 9, 28, 9, 0)
        assertTrue(DateTimeUtils.isSlotTimePassed(slotKey, exact))

        // 3. After slot time -> true
        val after = LocalDateTime.of(2026, 9, 28, 9, 31)
        assertTrue(DateTimeUtils.isSlotTimePassed(slotKey, after))
    }

    @Test
    fun testMondayOfWeekCalculation() {
        // Wednesday Sep 30, 2026 -> Monday is Sep 28, 2026
        val wednesday = LocalDate.of(2026, 9, 30)
        assertEquals("2026-09-28", DateTimeUtils.getWeekKey(wednesday))

        // Sunday Oct 4, 2026 -> Monday is Sep 28, 2026
        val sunday = LocalDate.of(2026, 10, 4)
        assertEquals("2026-09-28", DateTimeUtils.getWeekKey(sunday))

        // Monday Sep 28, 2026 -> Monday is Sep 28, 2026
        val monday = LocalDate.of(2026, 9, 28)
        assertEquals("2026-09-28", DateTimeUtils.getWeekKey(monday))
    }

    @Test
    fun testGenerateDaySlotKeysProduces48Slots() {
        val date = LocalDate.of(2026, 9, 28)
        val slots = DateTimeUtils.generateDaySlotKeys(date)

        assertEquals(48, slots.size)
        assertEquals("2026-09-28_00:00", slots.first())
        assertEquals("2026-09-28_23:30", slots.last())
    }
}
