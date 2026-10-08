package dev.truffle.feeder

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToLong

/** One calendar day of steps in the device zone. */
data class WalkDay(val date: LocalDate, val steps: Long)

/** One line of the Walk screen. Accent lines are drawn in the accent colour. */
data class WalkLine(val text: String, val accent: Boolean = false)

data class WalkStats(val avg7: Long, val best: WalkDay?, val streak: Int)

/**
 * Pure text builders for the Walk screen. Fixed numbers in, fixed lines out.
 * Steps and distance only, on purpose.
 */
object WalkChart {
    /** The low floor for a streak day. Same number as the engine's streak moment. */
    const val STREAK_FLOOR = 3_000L
    const val CHART_HEIGHT = 5
    private const val EIGHTHS = " ▁▂▃▄▅▆▇"
    private const val FULL = '█'
    private const val ZERO = '·'
    private const val LABEL_WIDTH = 16
    private val DAY_LABEL = DateTimeFormatter.ofPattern("MMM d", Locale.US)

    fun steps(n: Long): String = String.format(Locale.US, "%,d", n)

    /**
     * Vertical bars, one character per value, `height` rows, top row first.
     * Each row holds eight levels with the eighth blocks. A null value is an
     * empty slot (an hour that has not happened yet). Zero shows a dot on the
     * bottom row. Any value above zero shows at least the lowest block.
     */
    fun bars(values: List<Long?>, height: Int = CHART_HEIGHT): List<String> {
        require(height > 0) { "height must be positive" }
        val max = values.maxOfOrNull { it ?: 0L } ?: 0L
        val units = values.map { v ->
            when {
                v == null || v <= 0L || max <= 0L -> 0L
                else -> (v.toDouble() * height * 8 / max).roundToLong().coerceAtLeast(1L)
            }
        }
        return (height - 1 downTo 0).map { row ->
            buildString {
                values.forEachIndexed { i, v ->
                    val rest = units[i] - row * 8L
                    append(
                        when {
                            rest >= 8L -> FULL
                            rest > 0L -> EIGHTHS[rest.toInt()]
                            row == 0 && v != null && v <= 0L -> ZERO
                            else -> ' '
                        },
                    )
                }
            }.trimEnd()
        }
    }

    /** Hour marks under a 24 column chart. */
    fun hourAxis(): String = "0     6     12    18  23"

    /** Day marks under an n column chart. The last column is today. */
    fun dayAxis(days: Int): String {
        val left = "${days - 1}d ago"
        val right = "today"
        return left + " ".repeat((days - left.length - right.length).coerceAtLeast(1)) + right
    }

    /** `days` dates ending today, oldest first. A date with no data is zero. */
    fun fillDays(found: Map<LocalDate, Long>, today: LocalDate, days: Int = 30): List<WalkDay> =
        (days - 1 downTo 0).map { back ->
            val date = today.minusDays(back.toLong())
            WalkDay(date, (found[date] ?: 0L).coerceAtLeast(0L))
        }

    /**
     * 7 day average over the seven completed days before today. Best day over
     * every given day, the latest one on a tie, none when all are zero. Streak
     * counts days at or above the floor, ending today when today already made
     * it, else ending yesterday. A broken streak is simply zero.
     */
    fun stats(days: List<WalkDay>, today: LocalDate): WalkStats {
        val byDate = days.associate { it.date to it.steps }
        val week = (1..7).map { byDate[today.minusDays(it.toLong())] ?: 0L }
        val avg7 = (week.sum().toDouble() / 7).roundToLong()
        val best = days.filter { it.steps > 0 }
            .maxWithOrNull(compareBy<WalkDay> { it.steps }.thenBy { it.date })
        var day = if ((byDate[today] ?: 0L) >= STREAK_FLOOR) today else today.minusDays(1)
        var streak = 0
        while ((byDate[day] ?: 0L) >= STREAK_FLOOR) {
            streak++
            day = day.minusDays(1)
        }
        return WalkStats(avg7, best, streak)
    }

    fun distance(meters: Double): String = String.format(Locale.US, "%.1f km", meters / 1000.0)

    private fun stat(label: String, value: String): WalkLine = WalkLine(label.padEnd(LABEL_WIDTH) + value)

    /**
     * The whole Walk screen as lines. `hourly` holds today's hours so far,
     * index 0 is the hour after midnight. `days` is oldest first and ends today.
     * `distanceMeters` is null when distance is not granted or not read.
     */
    fun report(hourly: List<Long>, days: List<WalkDay>, today: LocalDate, distanceMeters: Double?): List<WalkLine> {
        val slots: List<Long?> = (0 until 24).map { hourly.getOrNull(it) }
        val todaySteps = days.lastOrNull { it.date == today }?.steps ?: hourly.sum()
        val s = stats(days, today)
        val lines = mutableListOf<WalkLine>()
        lines += WalkLine("today by hour")
        bars(slots).forEach { lines += WalkLine(it, accent = true) }
        lines += WalkLine(hourAxis())
        lines += WalkLine("")
        lines += WalkLine("last ${days.size} days")
        bars(days.map { it.steps }).forEach { lines += WalkLine(it, accent = true) }
        lines += WalkLine(dayAxis(days.size))
        lines += WalkLine("")
        lines += stat("today", "${steps(todaySteps)} steps")
        lines += stat("7 day average", "${steps(s.avg7)} steps")
        lines += stat(
            "best day",
            s.best?.let { "${steps(it.steps)} steps, ${DAY_LABEL.format(it.date)}" } ?: "none yet",
        )
        lines += stat(
            "streak",
            when (s.streak) {
                0 -> "starts with a ${steps(STREAK_FLOOR)} step day"
                1 -> "1 day at ${steps(STREAK_FLOOR)}+"
                else -> "${s.streak} days at ${steps(STREAK_FLOOR)}+"
            },
        )
        if (distanceMeters != null) lines += stat("distance today", distance(distanceMeters))
        return lines
    }
}
