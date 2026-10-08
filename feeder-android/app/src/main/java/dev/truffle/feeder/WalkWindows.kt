package dev.truffle.feeder

import java.time.LocalDate
import java.time.ZoneId

/** Exact device-zone days. A calendar day can last 23 or 25 hours. */
object WalkWindows {
    fun completedDays(today: LocalDate, zone: ZoneId): List<Pair<LocalDate, DayWindow>> =
        (29 downTo 1).map { back ->
            val day = today.minusDays(back.toLong())
            day to DayWindow(day.atStartOfDay(zone).toInstant(), day.plusDays(1).atStartOfDay(zone).toInstant(), zone)
        }
}
