package dev.truffle.feeder

import org.junit.Assert.*
import org.junit.Test

class AsciiWalkPlotTest {
    @Test fun `all rows retain fixed cells and use ASCII only`() {
        val rows = AsciiWalkPlot.rows(listOf(0, 1, 5, null).map { it?.toLong() })
        assertTrue(rows.all { it.length == 4 && it.all { glyph -> glyph.code < 128 } })
        assertEquals(".## ", rows.last())
        assertEquals("  # ", rows.first())
    }
    @Test fun `weekly bars occupy a comparable width without ambiguous labels`() {
        val rows = AsciiWalkPlot.rows(listOf(1, 2, 3, 4, 5, 6, 7).map(Int::toLong), barWidth = 3, gap = 1)
        assertTrue(rows.all { it.length == 27 })
        assertEquals("### ### ### ### ### ### ###", rows.last())
    }
    @Test fun `empty past hours differ from future hours`() {
        val rows = AsciiWalkPlot.rows(listOf(0L, 0L, null))
        assertEquals(".. ", rows.last())
        assertTrue(rows.dropLast(1).all { it == "   " })
    }
}
