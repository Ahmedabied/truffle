package dev.truffle.feeder

import kotlin.math.ceil

/** Fixed cells, seven-bit ASCII only. Android font fallback cannot split a bar. */
object AsciiWalkPlot {
    fun rows(values: List<Long?>, height: Int = 6, barWidth: Int = 1, gap: Int = 0): List<String> {
        require(height > 0 && barWidth > 0 && gap >= 0)
        val maximum = values.filterNotNull().maxOrNull()?.coerceAtLeast(0) ?: 0
        val levels = values.map { value ->
            if (value == null || value <= 0 || maximum == 0L) 0 else ceil(value.toDouble() / maximum * height).toInt().coerceIn(1, height)
        }
        return (height downTo 1).map { row ->
            values.mapIndexed { i, value ->
                (if (levels[i] >= row) "#" else if (row == 1 && value != null) "." else " ").repeat(barWidth)
            }.joinToString(" ".repeat(gap))
        }
    }
}
