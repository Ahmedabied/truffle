package dev.truffle.feeder

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class CompanionSourcePolicyTest {
    @Test fun healthConnectNeedsSelectedActiveSourceAndBothGrants() {
        assertTrue(reminderSourceAllowed(false, false, false, true, true, true))
        assertFalse(reminderSourceAllowed(false, false, false, false, true, true))
        assertFalse(reminderSourceAllowed(false, false, false, true, false, true))
        assertFalse(reminderSourceAllowed(false, false, false, true, true, false))
        assertFalse(reminderSourceAllowed(false, true, true, true, true, true))
    }

    @Test fun directModeCannotBorrowHealthConnectPermissionOrLoseItsOwn() {
        assertTrue(reminderSourceAllowed(true, false, true, false, false, false))
        assertFalse(reminderSourceAllowed(true, false, false, true, true, true))
        assertFalse(reminderSourceAllowed(true, true, true, true, true, true))
    }

    @Test fun repeatedDirectSelectionPreservesANonzeroUnsentTotal() {
        val now = Instant.parse("2026-10-09T08:00:00Z")
        val zone = ZoneId.of("Asia/Muscat")
        val state = SensorAccumulatorState(zone.id, null, mapOf("2026-10-09" to SensorDay(650)))
        val baseline = SensorFeedBaseline("2026-10-09", zone.id, 2_000, 500)
        repeat(2) {
            assertTrue(canResumeNativeFeed(state, baseline, true, true, now, zone))
            assertEquals(2_150L, SensorAccumulator.feedTotal(state, baseline, now, zone))
        }
        assertFalse(canResumeNativeFeed(state, baseline, false, true, now, zone))
        assertFalse(canResumeNativeFeed(state, baseline, true, false, now, zone))
    }

    @Test fun movementFeedIsThrottledAndRollbackDoesNotCauseNetworkSpam() {
        val now = Instant.parse("2026-10-09T08:00:00Z")
        assertTrue(movementFeedDue(null, now))
        assertFalse(movementFeedDue(now, now.plusSeconds(299)))
        assertTrue(movementFeedDue(now, now.plusSeconds(300)))
        assertFalse(movementFeedDue(now, now.minusSeconds(1)))
    }

    @Test fun scheduledMovementCannotRunAfterOwnerPausePermissionOrSourceTransition() {
        assertTrue(nativeMovementFeedAllowed("session-a", "session-a", true, true, true))
        assertFalse(nativeMovementFeedAllowed("session-a", "session-b", true, true, true))
        assertFalse(nativeMovementFeedAllowed("session-a", "session-a", false, true, true))
        assertFalse(nativeMovementFeedAllowed("session-a", "session-a", true, false, true))
        assertFalse(nativeMovementFeedAllowed("session-a", "session-a", true, true, false))
        assertFalse(nativeMovementFeedAllowed("", "", true, true, true))
    }
}
