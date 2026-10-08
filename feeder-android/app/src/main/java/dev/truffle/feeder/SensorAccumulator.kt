package dev.truffle.feeder

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Hardware TYPE_STEP_COUNTER reading, not a full-day step total. */
data class SensorCounterSample(
    val stepsSinceBoot: Long,
    /** SensorEvent.timestamp / 1_000_000, not a wall clock. */
    val elapsedRealtimeMillis: Long,
    /** Wall-clock instant corresponding to the sensor event, including batching delay. */
    val recordedAt: Instant,
    /** Settings.Global.BOOT_COUNT. Uptime alone cannot reliably detect a reboot. */
    val bootCount: Long,
)

/** Hours are bins of observed deltas, not a claim of exact per-step timestamps. */
data class SensorDay(
    val total: Long = 0,
    val hours: List<Long> = List(24) { 0L },
    val incomplete: Boolean = false,
)

/** Persist the whole snapshot atomically after each event. No Android dependencies. */
data class SensorAccumulatorState(
    val zoneId: String = "",
    val baseline: SensorCounterSample? = null,
    val days: Map<String, SensorDay> = emptyMap(),
)

/** Captured after old uploads are fenced and the server's pinned day is confirmed. */
data class SensorFeedBaseline(
    val day: String,
    val zoneId: String,
    val creditedTotal: Long,
    val nativeTotalAtBaseline: Long,
)

/**
 * Pure accounting for an explicitly enabled hardware counter. Never substitutes
 * for a missing sensor with accelerometer inference. A paused or new session's
 * first reading is a baseline only. Same-boot process restarts retain the baseline.
 *
 * https://developer.android.com/reference/android/hardware/Sensor#TYPE_STEP_COUNTER
 * https://developer.android.com/reference/android/hardware/SensorEvent#timestamp
 */
object SensorAccumulator {
    fun counterValue(raw: Float): Long? =
        if (raw.isFinite() && raw >= 0f && raw.toDouble() < Long.MAX_VALUE.toDouble() && raw.toLong().toFloat() == raw) raw.toLong()
        else null

    /** Call on explicit stop/revocation, but not ordinary same-boot process death. */
    fun pause(state: SensorAccumulatorState): SensorAccumulatorState = state.copy(baseline = null)

    fun observe(state: SensorAccumulatorState, sample: SensorCounterSample, zone: ZoneId): SensorAccumulatorState {
        if (sample.stepsSinceBoot < 0 || sample.elapsedRealtimeMillis < 0 || sample.bootCount < 0) return state
        val zoneChanged = state.zoneId != zone.id
        val previous = if (zoneChanged) null else state.baseline
        if (previous != null && (sample.bootCount < previous.bootCount ||
                (sample.bootCount == previous.bootCount && sample.elapsedRealtimeMillis <= previous.elapsedRealtimeMillis))) {
            return state // duplicate or out-of-order callback; do not move the baseline backwards
        }

        val day = sample.recordedAt.atZone(zone).toLocalDate()
        val oldDay = previous?.recordedAt?.atZone(zone)?.toLocalDate()
        val discontinuity = previous == null || sample.bootCount != previous.bootCount ||
            sample.stepsSinceBoot < previous.stepsSinceBoot || sample.recordedAt.isBefore(previous.recordedAt)
        val rawDelta = if (discontinuity) 0L else sample.stepsSinceBoot - previous!!.stepsSinceBoot
        // A cumulative reading cannot split the gap at midnight. Do not label
        // steps from the old day as today's steps, even after a multi-day gap.
        val delta = if (oldDay == day) rawDelta else 0L
        val gap = discontinuity || (oldDay != day && rawDelta > 0)
        val days = if (zoneChanged) mutableMapOf() else state.days.toMutableMap()
        val current = days[day.toString()] ?: SensorDay()
        val hour = sample.recordedAt.atZone(zone).hour
        // Reject corrupt persisted bins and arithmetic overflow without creating
        // a negative total or carrying the bad counter gap into the next event.
        val valid = current.total >= 0 && current.hours.size == 24 && current.hours.all { it >= 0 } &&
            current.total <= Long.MAX_VALUE - delta && current.hours[hour] <= Long.MAX_VALUE - delta
        if (valid) {
            val hours = current.hours.toMutableList()
            hours[hour] += delta
            days[day.toString()] = SensorDay(current.total + delta, hours.toList(), current.incomplete || gap)
        } else {
            days[day.toString()] = current.copy(incomplete = true)
        }
        // Anchor retention to the latest known date so a wall-clock rollback
        // cannot delete previously observed future bins or grow an unbounded map.
        val dated = days.mapNotNull { (key, value) ->
            runCatching { LocalDate.parse(key) }.getOrNull()?.let { it to value }
        }
        val latest = dated.maxOfOrNull { it.first } ?: day
        val earliest = latest.minusDays(29)
        val retained = dated.filter { !it.first.isBefore(earliest) && !it.first.isAfter(latest) }
            .sortedBy { it.first }.associate { it.first.toString() to it.second }
        return SensorAccumulatorState(zone.id, sample, retained)
    }

    /**
     * A feed is an absolute credited total plus new native growth, never the sum
     * of Health Connect and native day totals. A missing/stale baseline means
     * keep counts locally until the server's current day and zone are confirmed.
     */
    fun feedTotal(state: SensorAccumulatorState, baseline: SensorFeedBaseline?, now: Instant, zone: ZoneId): Long? {
        if (baseline == null || state.zoneId != zone.id || baseline.zoneId != zone.id ||
            baseline.day != now.atZone(zone).toLocalDate().toString() ||
            baseline.creditedTotal < 0 || baseline.nativeTotalAtBaseline < 0) return null
        val native = state.days[baseline.day]?.total ?: return null
        if (native < baseline.nativeTotalAtBaseline) return null
        val growth = native - baseline.nativeTotalAtBaseline
        if (baseline.creditedTotal > Long.MAX_VALUE - growth) return null
        return baseline.creditedTotal + growth
    }
}
