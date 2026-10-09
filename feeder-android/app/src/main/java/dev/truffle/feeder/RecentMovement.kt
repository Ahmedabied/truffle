package dev.truffle.feeder

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.CopyOnWriteArraySet

/** Accepted diary growth. This is never a feed total or a raw hardware reading. */
data class AcceptedMovement(val delta: Long, val observedAt: Instant, val intervalMs: Long)

fun acceptedMovement(before: SensorAccumulatorState, after: SensorAccumulatorState): AcceptedMovement? {
    val previous = before.baseline ?: return null
    val current = after.baseline ?: return null
    if (before.zoneId != after.zoneId || before.zoneId.isEmpty() || previous.bootCount != current.bootCount ||
        current.elapsedRealtimeMillis <= previous.elapsedRealtimeMillis || current.recordedAt.isBefore(previous.recordedAt)) return null
    val zone = runCatching { ZoneId.of(after.zoneId) }.getOrNull() ?: return null
    val day = current.recordedAt.atZone(zone).toLocalDate().toString()
    if (previous.recordedAt.atZone(zone).toLocalDate().toString() != day) return null
    val oldTotal = before.days[day]?.total ?: return null
    val newTotal = after.days[day]?.total ?: return null
    if (oldTotal < 0 || newTotal <= oldTotal) return null
    return AcceptedMovement(newTotal - oldTotal, current.recordedAt, current.elapsedRealtimeMillis - previous.elapsedRealtimeMillis)
}

/** A zero or discarded sample must not postpone the next optional note. */
fun movementTimestamp(previous: Instant?, accepted: AcceptedMovement?): Instant? =
    listOfNotNull(previous, accepted?.takeIf { it.delta > 0 }?.observedAt).maxOrNull()

/** Ephemeral visual batching. The caller clears this on pause or document change. */
class RecentMovement {
    private var start: Instant? = null
    private var last: Instant? = null
    private var total = 0L

    fun clear() { start = null; last = null; total = 0 }

    fun accept(event: AcceptedMovement, now: Instant, foregroundSince: Instant? = null): AcceptedMovement? {
        if (event.delta <= 0 || event.delta > 1_000 || event.intervalMs !in 1L..30_000L ||
            event.observedAt.isAfter(now) || Duration.between(event.observedAt, now).toMillis() > 15_000 ||
            foregroundSince?.let { event.observedAt.minusMillis(event.intervalMs).isBefore(it) } == true) {
            clear()
            return null
        }
        if (last?.let { !event.observedAt.isAfter(it) } == true) return null
        val eventStart = event.observedAt.minusMillis(event.intervalMs)
        val oldStart = start
        if (oldStart == null || Duration.between(oldStart, event.observedAt).toMillis() > 30_000) {
            start = eventStart
            total = 0
        }
        last = event.observedAt
        total += event.delta
        if (total < 3) return null
        val result = AcceptedMovement(total, event.observedAt, Duration.between(requireNotNull(start), event.observedAt).toMillis())
        start = null
        total = 0
        return result.takeIf { it.delta <= 1_000 }
    }
}

/** Process-local, one-way and non-replaying. Nothing is exposed as a JS bridge. */
object NativeMovementEvents {
    private val listeners = CopyOnWriteArraySet<(AcceptedMovement) -> Unit>()
    fun listen(listener: (AcceptedMovement) -> Unit) { listeners.add(listener) }
    fun remove(listener: (AcceptedMovement) -> Unit) { listeners.remove(listener) }
    fun publish(event: AcceptedMovement) { listeners.forEach { it(event) } }
}
