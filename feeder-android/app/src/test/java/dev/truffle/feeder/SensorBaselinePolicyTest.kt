package dev.truffle.feeder

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class SensorBaselinePolicyTest {
    private val zone = ZoneId.of("Asia/Muscat")
    private val now = Instant.parse("2026-10-10T05:00:00Z")
    private val previous = SensorFeedBaseline("2026-10-09", zone.id, 3_000, 500)

    private fun walkedToday(): SensorAccumulatorState {
        var state = SensorAccumulator.observe(SensorAccumulatorState(),
            SensorCounterSample(8_000, 1_000, now.minusSeconds(1_000), 7), zone)
        state = SensorAccumulator.observe(state,
            SensorCounterSample(9_000, 1_001_000, now, 7), zone)
        return state
    }

    private fun confirm(state: SensorAccumulatorState, credited: Long = 0, carry: Boolean = true,
        old: SensorFeedBaseline? = previous, day: String = "2026-10-10", zoneId: String = zone.id) =
        confirmedSensorBaseline(state, old, day, zoneId, credited, carry)

    @Test fun continuingSessionKeepsTodaysStepsBeforeFirstUpload() {
        val state = walkedToday()
        val baseline = confirm(state)
        assertEquals(1_000L, SensorAccumulator.feedTotal(state, baseline, now, zone))
        assertEquals(1_000L, SensorAccumulator.feedTotal(state, baseline, now, zone))
        val later = SensorAccumulator.observe(state,
            SensorCounterSample(9_010, 1_011_000, now.plusSeconds(10), 7), zone)
        assertEquals(1_010L, SensorAccumulator.feedTotal(later, baseline, now.plusSeconds(10), zone))
    }

    @Test fun overlappingServerStepsAreNeverAddedToNativeDayTotal() {
        val state = walkedToday()
        assertEquals(1_000L, SensorAccumulator.feedTotal(state, confirm(state, credited = 700), now, zone))
        assertEquals(1_500L, SensorAccumulator.feedTotal(state, confirm(state, credited = 1_500), now, zone))
    }

    @Test fun newSourceOrOwnerCannotCarryEarlierLocalDiarySteps() {
        val state = walkedToday()
        assertEquals(200L, SensorAccumulator.feedTotal(state, confirm(state, credited = 200, carry = false), now, zone))
        val later = SensorAccumulator.observe(state,
            SensorCounterSample(9_010, 1_011_000, now.plusSeconds(10), 7), zone)
        assertEquals(210L, SensorAccumulator.feedTotal(later, confirm(state, credited = 200, carry = false), now.plusSeconds(10), zone))
    }

    @Test fun firstOfflineConfirmationDoesNotImportUnconfirmedLocalSteps() {
        val state = walkedToday()
        assertEquals(200L, SensorAccumulator.feedTotal(state, confirm(state, credited = 200, old = null), now, zone))
    }

    @Test fun sameDayReconfirmationCannotCarryAnEarlierSourceTotal() {
        val state = walkedToday()
        val baseline = confirm(state, credited = 200, old = previous.copy(day = "2026-10-10"))
        assertEquals(200L, SensorAccumulator.feedTotal(state, baseline, now, zone))
    }

    @Test fun rollbackOrMalformedPreviousDayCannotEstablishContinuity() {
        val state = walkedToday()
        for (day in listOf("2026-10-11", "invalid")) {
            val baseline = confirm(state, credited = 200, old = previous.copy(day = day))
            assertEquals(200L, SensorAccumulator.feedTotal(state, baseline, now, zone))
        }
    }

    @Test fun aDifferentPinnedZoneCannotCarryTheOldLedger() {
        val state = walkedToday()
        assertEquals(200L, confirm(state, credited = 200, old = previous.copy(zoneId = "UTC")).creditedTotal)
        val changed = confirm(state, credited = 200, zoneId = "UTC")
        assertEquals(200L, changed.creditedTotal)
        assertEquals(0L, changed.nativeTotalAtBaseline)
    }

    @Test fun skippedUploadDaysCarryOnlyTheCurrentDay() {
        val state = walkedToday()
        val baseline = confirm(state, old = previous.copy(day = "2026-10-07"))
        assertEquals(1_000L, SensorAccumulator.feedTotal(state, baseline, now, zone))
    }
}
