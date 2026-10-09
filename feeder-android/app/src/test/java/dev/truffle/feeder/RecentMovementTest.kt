package dev.truffle.feeder

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class RecentMovementTest {
    private val zone = ZoneId.of("Asia/Muscat")
    private val now = Instant.parse("2026-10-09T08:00:00Z")
    private fun sample(steps: Long = 100, elapsed: Long = 100_000, at: Instant = now, boot: Long = 7) =
        SensorCounterSample(steps, elapsed, at, boot)
    private fun start() = SensorAccumulator.observe(SensorAccumulatorState(), sample(), zone)
    private fun moved(delta: Long = 3, seconds: Long = 3): AcceptedMovement {
        val before = start()
        return requireNotNull(acceptedMovement(before,
            SensorAccumulator.observe(before, sample(100 + delta, 100_000 + seconds * 1_000, now.plusSeconds(seconds)), zone)))
    }

    @Test fun acceptedPositiveTransitionSuppliesOnlyTheAcceptedGrowth() {
        assertEquals(AcceptedMovement(3, now.plusSeconds(3), 3_000), moved())
        val before = start()
        val corrupt = before.copy(days = mapOf("2026-10-09" to SensorDay(Long.MAX_VALUE)))
        assertNull(acceptedMovement(corrupt, SensorAccumulator.observe(corrupt, sample(103, 103_000, now.plusSeconds(3)), zone)))
    }

    @Test fun zeroBaselineDuplicateResetRebootRollbackAndZoneChangeNeverSignal() {
        val before = start()
        assertNull(acceptedMovement(SensorAccumulatorState(), before))
        for (next in listOf(sample(), sample(103, 99_000), sample(100, 103_000, now.plusSeconds(3)),
            sample(2, 103_000, now.plusSeconds(3)), sample(103, 103_000, now.plusSeconds(3), 8),
            sample(103, 103_000, now.minusSeconds(1)))) {
            assertNull(acceptedMovement(before, SensorAccumulator.observe(before, next, zone)))
        }
        assertNull(acceptedMovement(before, SensorAccumulator.observe(before, sample(103, 103_000, now.plusSeconds(3)), ZoneId.of("UTC"))))
    }

    @Test fun midnightGapDoesNotBecomeImmediateMovement() {
        val at = Instant.parse("2026-10-09T19:59:59Z")
        val before = SensorAccumulator.observe(SensorAccumulatorState(), sample(at = at), zone)
        assertNull(acceptedMovement(before, SensorAccumulator.observe(before, sample(103, 103_000, at.plusSeconds(3)), zone)))
    }

    @Test fun stationarySamplesKeepThePreviousPositiveTimestamp() {
        val last = now.minusSeconds(7_200)
        assertEquals(last, movementTimestamp(last, null))
        assertEquals(now.plusSeconds(3), movementTimestamp(last, moved()))
        assertEquals(now.plusSeconds(5), movementTimestamp(now.plusSeconds(5), moved()))
    }

    @Test fun boundedFreshSamplesCoalesceAndAreNeverReplayed() {
        val buffer = RecentMovement()
        assertNull(buffer.accept(AcceptedMovement(1, now, 1_000), now))
        assertNull(buffer.accept(AcceptedMovement(1, now.plusSeconds(1), 1_000), now.plusSeconds(1)))
        assertEquals(AcceptedMovement(3, now.plusSeconds(2), 3_000),
            buffer.accept(AcceptedMovement(1, now.plusSeconds(2), 1_000), now.plusSeconds(2)))
        assertNull(buffer.accept(AcceptedMovement(1, now.plusSeconds(2), 1_000), now.plusSeconds(2)))
        buffer.clear()
        assertNull(buffer.accept(AcceptedMovement(1, now.plusSeconds(3), 1_000), now.plusSeconds(3)))
    }

    @Test fun oldLongFutureAndNonpositiveSamplesDoNotPulse() {
        for (event in listOf(AcceptedMovement(5, now.minusSeconds(16), 1_000),
            AcceptedMovement(5, now, 30_001), AcceptedMovement(5, now.plusMillis(1), 1_000),
            AcceptedMovement(0, now, 1_000), AcceptedMovement(-1, now, 1_000), AcceptedMovement(3, now, 0),
            AcceptedMovement(1_001, now, 1_000))) {
            assertNull(RecentMovement().accept(event, now))
        }
        assertNotNull(RecentMovement().accept(AcceptedMovement(3, now.minusSeconds(15), 30_000), now))
    }

    @Test fun expiredPartialWindowCannotJoinLaterSteps() {
        val buffer = RecentMovement()
        assertNull(buffer.accept(AcceptedMovement(2, now, 1_000), now))
        assertNull(buffer.accept(AcceptedMovement(1, now.plusSeconds(31), 1_000), now.plusSeconds(31)))
    }

    @Test fun resumingDoesNotReplayMovementFromTheBackground() {
        val event = AcceptedMovement(3, now, 3_000)
        assertNull(RecentMovement().accept(event, now, foregroundSince = now.minusSeconds(1)))
        assertNotNull(RecentMovement().accept(event, now, foregroundSince = now.minusSeconds(3)))
    }
}
