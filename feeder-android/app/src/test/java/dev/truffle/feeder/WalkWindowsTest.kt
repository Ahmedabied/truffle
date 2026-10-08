package dev.truffle.feeder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class WalkWindowsTest {
    @Test fun completedDaysUseTheDeviceZoneAndEndBeforeToday() {
        val today = LocalDate.of(2026, 10, 8)
        val days = WalkWindows.completedDays(today, ZoneId.of("Asia/Muscat"))
        assertEquals(29, days.size)
        assertEquals(today.minusDays(29), days.first().first)
        assertEquals(today.minusDays(1), days.last().first)
        assertEquals(Instant.parse("2026-10-07T20:00:00Z"), days.last().second.end)
        assertTrue(days.zipWithNext().all { (a, b) -> a.second.end == b.second.start })
    }

    @Test fun daylightSavingDaysAreNotForcedIntoTwentyFourHours() {
        val zone = ZoneId.of("Europe/London")
        val spring = WalkWindows.completedDays(LocalDate.of(2026, 3, 30), zone).last().second
        val autumn = WalkWindows.completedDays(LocalDate.of(2026, 10, 26), zone).last().second
        assertEquals(23L, Duration.between(spring.start, spring.end).toHours())
        assertEquals(25L, Duration.between(autumn.start, autumn.end).toHours())
    }

    @Test fun travelChangesTheInstantWindowForTheSameDayLabel() {
        val today = LocalDate.of(2026, 10, 8)
        val muscat = WalkWindows.completedDays(today, ZoneId.of("Asia/Muscat")).last().second
        val honolulu = WalkWindows.completedDays(today, ZoneId.of("Pacific/Honolulu")).last().second
        assertEquals(14L, Duration.between(muscat.start, honolulu.start).toHours())
    }
}
