package com.dayflow.app.domain.util

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle
import java.time.temporal.TemporalAdjusters

object DateTimeUtils {

    // Using STRICT resolver and 'uuuu' (year) ensures invalid dates like 2026-02-30 are strictly rejected
    private val DATE_FORMATTER = DateTimeFormatter.ofPattern("uuuu-MM-dd")
        .withResolverStyle(ResolverStyle.STRICT)
    private val TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm")

    val MIN_DATE: LocalDate = LocalDate.of(1800, 1, 1)
    val MAX_DATE: LocalDate = LocalDate.of(2200, 12, 31)

    fun formatSlotKey(date: LocalDate, time: LocalTime): String {
        return "${date.format(DATE_FORMATTER)}_${time.format(TIME_FORMATTER)}"
    }

    fun parseSlotKey(slotKey: String): Pair<LocalDate, LocalTime> {
        val parts = slotKey.split("_")
        require(parts.size == 2) { "Invalid slotKey format: $slotKey. Expected YYYY-MM-DD_HH:MM" }
        val date = LocalDate.parse(parts[0], DATE_FORMATTER)
        val time = LocalTime.parse(parts[1], TIME_FORMATTER)
        return Pair(date, time)
    }

    fun isValidSlotKey(slotKey: String): Boolean {
        return try {
            val (date, time) = parseSlotKey(slotKey)
            val isValidMinute = (time.minute == 0 || time.minute == 30)
            val isInRange = !date.isBefore(MIN_DATE) && !date.isAfter(MAX_DATE)
            isValidMinute && isInRange
        } catch (e: Exception) {
            false
        }
    }

    /**
     * DayFlow Golden Time-Lock Rule:
     * Once a 30-minute slot's scheduled time has arrived/passed,
     * the plannedTask becomes immutable (locked baseline).
     */
    fun isSlotTimePassed(slotKey: String, now: LocalDateTime = LocalDateTime.now()): Boolean {
        val (date, time) = parseSlotKey(slotKey)
        val slotDateTime = LocalDateTime.of(date, time)
        return !now.isBefore(slotDateTime)
    }

    /**
     * DayFlow weeks strictly start on Monday and end on Sunday.
     */
    fun getMondayOfWeek(date: LocalDate): LocalDate {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
    }

    fun getWeekKey(date: LocalDate): String {
        return getMondayOfWeek(date).format(DATE_FORMATTER)
    }

    fun isValidCalendarDate(dateStr: String): Boolean {
        return try {
            val date = LocalDate.parse(dateStr, DATE_FORMATTER)
            !date.isBefore(MIN_DATE) && !date.isAfter(MAX_DATE)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Generates all 48 30-minute slot keys for a full 24-hour day (00:00 to 23:30).
     */
    fun generateDaySlotKeys(date: LocalDate): List<String> {
        val slotKeys = mutableListOf<String>()
        var time = LocalTime.MIDNIGHT
        repeat(48) {
            slotKeys.add(formatSlotKey(date, time))
            time = time.plusMinutes(30)
        }
        return slotKeys
    }

    /**
     * Computes the slot key for the current 30-minute block based on LocalDateTime.now().
     * e.g. 20:15 -> 20:00, 20:45 -> 20:30
     */
    fun getCurrentSlotKey(now: LocalDateTime = LocalDateTime.now()): String {
        val minute = if (now.minute < 30) 0 else 30
        val slotTime = LocalTime.of(now.hour, minute)
        return formatSlotKey(now.toLocalDate(), slotTime)
    }

    fun generateWeekDays(monday: LocalDate): List<LocalDate> {
        return (0L..6L).map { monday.plusDays(it) }
    }

    /**
     * Formats time for slot row labels according to user's timeFormat preference.
     * 12h: "09:00 AM", "01:30 PM" (DayFlow Web parity formatTimeLabel)
     * 24h: "09:00", "13:30"
     */
    fun formatTimeLabel(time: LocalTime, is24Hour: Boolean = false): String {
        return if (is24Hour) {
            String.format("%02d:%02d", time.hour, time.minute)
        } else {
            val period = if (time.hour >= 12) "PM" else "AM"
            val displayHour = when (val h = time.hour % 12) {
                0 -> 12
                else -> h
            }
            String.format("%02d:%02d %s", displayHour, time.minute, period)
        }
    }

}
