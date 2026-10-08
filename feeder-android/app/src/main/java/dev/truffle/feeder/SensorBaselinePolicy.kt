package dev.truffle.feeder

import java.time.LocalDate

/**
 * Establish a feed baseline without discarding a continuing session's new day.
 * The caller permits carry only for the same owner while direct mode remains
 * selected. First activation and source/owner changes exclude earlier diary
 * counts. A midnight-crossing delta has already been excluded by the accumulator.
 */
fun confirmedSensorBaseline(
    state: SensorAccumulatorState,
    previous: SensorFeedBaseline?,
    day: String,
    zoneId: String,
    creditedTotal: Long,
    carryNewDay: Boolean,
): SensorFeedBaseline {
    val local: Long = if (state.zoneId == zoneId) state.days[day]?.total?.coerceAtLeast(0) ?: 0 else 0
    val continuingDay = carryNewDay && previous != null && state.zoneId == zoneId &&
        previous.zoneId == zoneId && previous.creditedTotal >= 0 && previous.nativeTotalAtBaseline >= 0 &&
        runCatching { LocalDate.parse(previous.day).isBefore(LocalDate.parse(day)) }.getOrDefault(false)
    // Another feed may already overlap today's phone steps. Carry their maximum,
    // then count only future native growth; adding both totals would double count.
    return SensorFeedBaseline(day, zoneId, if (continuingDay) maxOf(creditedTotal, local) else creditedTotal, local)
}
