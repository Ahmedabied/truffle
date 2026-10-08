package dev.truffle.feeder

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class ReminderPolicyTest {
    private val zone = ZoneId.of("Asia/Muscat")
    private val now = Instant.parse("2026-10-09T10:00:00Z") // 14:00 local
    private fun eligible() = ReminderContext(
        now = now, zone = zone, optedIn = true, notificationsAllowed = true,
        activityPermission = true, trackingEnabled = true, alive = true,
        wellFed = false, heatProtected = false,
        weather = ReminderWeather(now.minusSeconds(600), safeForWalk = true),
        lastActiveAt = now.minusSeconds(7200),
    )

    @Test fun defaultContextNeverNotifies() {
        assertEquals(ReminderDecision.OPTED_OUT, ReminderPolicy.evaluate(ReminderContext(now, zone)))
    }

    @Test fun oneQuietNudgeMayBeOfferedWhenAllEvidenceIsPresent() {
        assertEquals(ReminderDecision.ALLOW, ReminderPolicy.evaluate(eligible()))
    }

    @Test fun permissionsAndTrackingAreSeparateHardGates() {
        val c = eligible()
        assertEquals(ReminderDecision.OPTED_OUT, ReminderPolicy.evaluate(c.copy(optedIn = false)))
        assertEquals(ReminderDecision.NOTIFICATIONS_OFF, ReminderPolicy.evaluate(c.copy(notificationsAllowed = false)))
        assertEquals(ReminderDecision.TRACKING_OFF, ReminderPolicy.evaluate(c.copy(activityPermission = false)))
        assertEquals(ReminderDecision.TRACKING_OFF, ReminderPolicy.evaluate(c.copy(trackingEnabled = false)))
    }

    @Test fun heatFedDeadAndUnknownConditionsSuppressWithoutAGuiltMessage() {
        val c = eligible()
        assertEquals(ReminderDecision.NO_LIVING_PET, ReminderPolicy.evaluate(c.copy(alive = false)))
        assertEquals(ReminderDecision.ALREADY_FED, ReminderPolicy.evaluate(c.copy(wellFed = true)))
        assertEquals(ReminderDecision.HEAT_PROTECTED, ReminderPolicy.evaluate(c.copy(heatProtected = true)))
        for (weather in listOf(null, ReminderWeather(now, false), ReminderWeather(now.minusSeconds(3601), true), ReminderWeather(now.plusSeconds(1), true))) {
            assertEquals(ReminderDecision.WEATHER_UNSAFE_OR_UNKNOWN, ReminderPolicy.evaluate(c.copy(weather = weather)))
        }
    }

    @Test fun quietHoursUsePetZoneAndIncludeNineButExcludeNineteen() {
        for ((at, expected) in listOf(
            "2026-10-09T04:59:59Z" to ReminderDecision.QUIET_HOURS,
            "2026-10-09T05:00:00Z" to ReminderDecision.ALLOW,
            "2026-10-09T14:59:59Z" to ReminderDecision.ALLOW,
            "2026-10-09T15:00:00Z" to ReminderDecision.QUIET_HOURS,
        )) {
            val instant = Instant.parse(at)
            val context = eligible().copy(now = instant, weather = ReminderWeather(instant, true), lastActiveAt = instant.minusSeconds(7200))
            assertEquals(at, expected, ReminderPolicy.evaluate(context))
        }
    }

    @Test fun recentUnknownOrFutureActivitySuppresses() {
        for (last in listOf(null, now.minusSeconds(3599), now, now.plusSeconds(1))) {
            assertEquals(ReminderDecision.RECENTLY_ACTIVE, ReminderPolicy.evaluate(eligible().copy(lastActiveAt = last)))
        }
        assertEquals(ReminderDecision.ALLOW, ReminderPolicy.evaluate(eligible().copy(lastActiveAt = now.minusSeconds(3600))))
    }

    @Test fun sameDayAndRollingDayLimitPreventRepeatedOrTravelNudges() {
        val c = eligible()
        val today = ReminderStamp("2026-10-09", now.minusSeconds(7200))
        assertEquals(ReminderDecision.ALREADY_SENT, ReminderPolicy.evaluate(c.copy(lastNudge = today)))
        assertEquals(ReminderDecision.ALREADY_SENT, ReminderPolicy.evaluate(c.copy(lastNudge = today.copy(day = "2026-10-08"))))
        assertEquals(ReminderDecision.ALREADY_SENT, ReminderPolicy.evaluate(c.copy(lastNudge = today.copy(at = now.plusSeconds(86400)))))
        assertEquals(ReminderDecision.ALLOW, ReminderPolicy.evaluate(c.copy(lastNudge = ReminderStamp("2026-10-08", now.minusSeconds(86400)))))
    }
}
