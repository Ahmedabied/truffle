package dev.truffle.feeder

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class SensorAccumulatorTest {
    private val zone = ZoneId.of("Asia/Muscat")
    private val morning = Instant.parse("2026-10-09T05:00:00Z")
    private fun sample(count: Long, seconds: Long = 0, boot: Long = 7, time: Instant = morning.plusSeconds(seconds)) =
        SensorCounterSample(count, 100_000 + seconds * 1000, time, boot)
    private fun start(count: Long = 8000) = SensorAccumulator.observe(SensorAccumulatorState(), sample(count), zone)
    private fun total(state: SensorAccumulatorState, day: String = "2026-10-09") = state.days[day]?.total ?: 0L

    @Test fun firstSampleNeverImportsStepsBeforeOptIn() {
        val state = start()
        assertEquals(0L, total(state))
        assertTrue(state.days.getValue("2026-10-09").incomplete)
        assertEquals(12L, total(SensorAccumulator.observe(state, sample(8012, 10), zone)))
    }

    @Test fun duplicateAndOutOfOrderSamplesCannotBeCountedTwice() {
        val first = SensorAccumulator.observe(start(), sample(8012, 10), zone)
        val duplicate = SensorAccumulator.observe(first, sample(8012, 10), zone)
        val old = SensorAccumulator.observe(duplicate, sample(8003, 3), zone)
        assertEquals(first, old)
        assertEquals(20L, total(SensorAccumulator.observe(old, sample(8020, 20), zone)))
    }

    @Test fun persistedStateResumesSameBootWithoutRecountingOrLosingExistingSteps() {
        val saved = SensorAccumulator.observe(start(), sample(8012, 10), zone)
        val restored = saved.copy(days = saved.days.toMap(), baseline = saved.baseline!!.copy())
        assertEquals(20L, total(SensorAccumulator.observe(restored, sample(8020, 20), zone)))
    }

    @Test fun stoppingAndReEnablingNeverCountsStepsWhileDisabled() {
        val before = SensorAccumulator.observe(start(), sample(8012, 10), zone)
        val resumed = SensorAccumulator.observe(SensorAccumulator.pause(before), sample(9000, 100), zone)
        assertEquals(12L, total(resumed))
        assertEquals(17L, total(SensorAccumulator.observe(resumed, sample(9005, 105), zone)))
    }

    @Test fun rebootIsDetectedEvenWhenNewUptimeAndCounterExceedOldValues() {
        val before = SensorAccumulator.observe(start(), sample(8012, 10), zone)
        val rebooted = SensorAccumulator.observe(before, sample(10000, 1000, boot = 8), zone)
        assertEquals(12L, total(rebooted))
        assertEquals(17L, total(SensorAccumulator.observe(rebooted, sample(10005, 1005, boot = 8), zone)))
        assertEquals(rebooted, SensorAccumulator.observe(rebooted, sample(8020, 20, boot = 7), zone))
    }

    @Test fun counterResetPreservesEarnedTotalsAndStartsAFreshBaseline() {
        val before = SensorAccumulator.observe(start(), sample(8012, 10), zone)
        val reset = SensorAccumulator.observe(before, sample(2, 20), zone)
        assertEquals(12L, total(reset))
        assertEquals(17L, total(SensorAccumulator.observe(reset, sample(7, 25), zone)))
    }

    @Test fun aMidnightGapIsNotRelabelledAsTodaysSteps() {
        val beforeMidnight = sample(100, time = Instant.parse("2026-10-09T19:59:55Z"))
        val before = SensorAccumulator.observe(SensorAccumulatorState(), beforeMidnight, zone)
        val across = SensorAccumulator.observe(before, sample(110, 20, time = Instant.parse("2026-10-09T20:00:15Z")), zone)
        assertEquals(0L, total(across, "2026-10-10"))
        assertTrue(across.days.getValue("2026-10-10").incomplete)
        val after = SensorAccumulator.observe(across, sample(115, 25, time = Instant.parse("2026-10-09T20:00:20Z")), zone)
        assertEquals(5L, total(after, "2026-10-10"))
        assertEquals(0L, total(after))
    }

    @Test fun aZoneChangeDoesNotRelabelTheOldLedger() {
        val before = SensorAccumulator.observe(start(), sample(8012, 10), zone)
        val moved = SensorAccumulator.observe(before, sample(8020, 20), ZoneId.of("Pacific/Honolulu"))
        assertEquals("Pacific/Honolulu", moved.zoneId)
        assertEquals(setOf("2026-10-08"), moved.days.keys)
        assertEquals(0L, total(moved, "2026-10-08"))
    }

    @Test fun wallClockRollbackDoesNotAssignAnAmbiguousIntervalToAnOldHour() {
        val before = SensorAccumulator.observe(start(), sample(8012, 10), zone)
        val rollback = SensorAccumulator.observe(before, sample(8020, 20, time = morning.minusSeconds(3600)), zone)
        assertEquals(12L, total(rollback))
        assertEquals(17L, total(SensorAccumulator.observe(rollback, sample(8025, 25, time = morning.minusSeconds(3595)), zone)))
    }

    @Test fun hourlyBinsAddUpAndRepeatedDaylightSavingHourIsCombined() {
        val london = ZoneId.of("Europe/London")
        var state = SensorAccumulator.observe(SensorAccumulatorState(), sample(100, time = Instant.parse("2026-10-25T00:10:00Z")), london)
        state = SensorAccumulator.observe(state, sample(110, 10, time = Instant.parse("2026-10-25T00:20:00Z")), london)
        state = SensorAccumulator.observe(state, sample(115, 20, time = Instant.parse("2026-10-25T01:10:00Z")), london)
        val day = state.days.getValue("2026-10-25")
        assertEquals(15L, day.total)
        assertEquals(15L, day.hours[1])
        assertEquals(day.total, day.hours.sum())
        assertEquals(24, day.hours.size)
    }

    @Test fun historyRetainsOnlyThirtyCalendarDays() {
        var state = SensorAccumulatorState()
        for (day in 0L..39L) {
            val at = morning.plusSeconds(day * 86400)
            state = SensorAccumulator.observe(state, sample(day * 10, day * 86400, time = at), zone)
        }
        assertEquals(30, state.days.size)
        assertFalse(state.days.containsKey("2026-10-09"))
        assertTrue(state.days.containsKey("2026-11-17"))
    }

    @Test fun invalidSensorCountsDoNotPoisonTheBaseline() {
        val state = start()
        assertEquals(state, SensorAccumulator.observe(state, sample(-1, 10), zone))
        assertNull(SensorAccumulator.counterValue(Float.NaN))
        assertNull(SensorAccumulator.counterValue(Float.POSITIVE_INFINITY))
        assertNull(SensorAccumulator.counterValue(-1f))
        assertNull(SensorAccumulator.counterValue(1.5f))
        assertEquals(123L, SensorAccumulator.counterValue(123f))
    }

    @Test fun feedingAddsOnlyNativeGrowthAfterTheConfirmedServerBaseline() {
        val state = SensorAccumulator.observe(start(), sample(8100, 100), zone)
        val baseline = SensorFeedBaseline("2026-10-09", zone.id, creditedTotal = 3000, nativeTotalAtBaseline = 100)
        assertEquals(3000L, SensorAccumulator.feedTotal(state, baseline, morning, zone))
        val later = SensorAccumulator.observe(state, sample(8125, 125), zone)
        assertEquals(3025L, SensorAccumulator.feedTotal(later, baseline, morning.plusSeconds(125), zone))
        assertEquals(3025L, SensorAccumulator.feedTotal(later, baseline, morning.plusSeconds(125), zone))
        assertNull(SensorAccumulator.feedTotal(later, null, morning, zone))
        assertNull(SensorAccumulator.feedTotal(later, baseline, morning.plusSeconds(86400), zone))
        assertNull(SensorAccumulator.feedTotal(later, baseline, morning, ZoneId.of("UTC")))
        assertNull(SensorAccumulator.feedTotal(later, baseline.copy(nativeTotalAtBaseline = 200), morning, zone))
        assertNull(SensorAccumulator.feedTotal(later, baseline.copy(creditedTotal = Long.MAX_VALUE), morning, zone))
    }
}
