package dev.truffle.feeder

import java.time.Instant

/**
 * A step counter's first callback may carry yesterday's last-step timestamp.
 * Its cumulative value is our baseline observed now, not a delta from yesterday.
 * Subsequent callbacks retain their event time so batching cannot cross-label days.
 */
fun counterRecordedAt(eventElapsedMillis: Long, nowElapsedMillis: Long, now: Instant, firstBaseline: Boolean): Instant? {
    if (eventElapsedMillis < 0 || nowElapsedMillis < eventElapsedMillis) return null
    return if (firstBaseline) now else now.minusMillis(nowElapsedMillis - eventElapsedMillis)
}
