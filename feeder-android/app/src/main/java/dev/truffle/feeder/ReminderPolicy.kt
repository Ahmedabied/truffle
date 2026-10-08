package dev.truffle.feeder

import java.time.Duration
import java.time.Instant
import java.time.ZoneId

/** A server weather observation, not merely the time a cached screen was opened. */
data class ReminderWeather(val checkedAt: Instant, val safeForWalk: Boolean)

/** Persist this claim before posting, under the same lock used to evaluate it. */
data class ReminderStamp(val day: String, val at: Instant)

data class ReminderContext(
    val now: Instant,
    val zone: ZoneId,
    val optedIn: Boolean = false,
    val notificationsAllowed: Boolean = false,
    val activityPermission: Boolean = false,
    val trackingEnabled: Boolean = false,
    val alive: Boolean = false,
    val wellFed: Boolean = true,
    val heatProtected: Boolean = true,
    val weather: ReminderWeather? = null,
    val lastActiveAt: Instant? = null,
    val lastNudge: ReminderStamp? = null,
)

enum class ReminderDecision {
    ALLOW, OPTED_OUT, NOTIFICATIONS_OFF, TRACKING_OFF, NO_LIVING_PET,
    ALREADY_FED, HEAT_PROTECTED, WEATHER_UNSAFE_OR_UNKNOWN, QUIET_HOURS,
    RECENTLY_ACTIVE, ALREADY_SENT,
}

/**
 * Eligibility only. No scheduling, networking, notification posting, or inference
 * about whether someone intends to go out. The caller serializes evaluate +
 * persist claim + post; missed notifications are never replayed or escalated.
 */
object ReminderPolicy {
    private val MAX_WEATHER_AGE = Duration.ofHours(1)
    private val RECENT_ACTIVITY = Duration.ofHours(1)
    private val MIN_NUDGE_GAP = Duration.ofHours(24)

    fun evaluate(c: ReminderContext): ReminderDecision {
        if (!c.optedIn) return ReminderDecision.OPTED_OUT
        if (!c.notificationsAllowed) return ReminderDecision.NOTIFICATIONS_OFF
        if (!c.activityPermission || !c.trackingEnabled) return ReminderDecision.TRACKING_OFF
        if (!c.alive) return ReminderDecision.NO_LIVING_PET
        if (c.wellFed) return ReminderDecision.ALREADY_FED
        if (c.heatProtected) return ReminderDecision.HEAT_PROTECTED
        val weather = c.weather
        if (weather == null || !weather.safeForWalk || weather.checkedAt.isAfter(c.now) ||
            Duration.between(weather.checkedAt, c.now) > MAX_WEATHER_AGE) return ReminderDecision.WEATHER_UNSAFE_OR_UNKNOWN
        val local = c.now.atZone(c.zone)
        if (local.hour !in 9 until 19) return ReminderDecision.QUIET_HOURS
        val active = c.lastActiveAt
        if (active == null || active.isAfter(c.now) || Duration.between(active, c.now) < RECENT_ACTIVITY) {
            return ReminderDecision.RECENTLY_ACTIVE
        }
        val last = c.lastNudge
        if (last != null && (last.day == local.toLocalDate().toString() || last.at.isAfter(c.now) ||
                Duration.between(last.at, c.now) < MIN_NUDGE_GAP)) return ReminderDecision.ALREADY_SENT
        return ReminderDecision.ALLOW
    }
}
