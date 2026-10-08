package dev.truffle.feeder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class WalkChartTest {
    private val today = LocalDate.of(2026, 10, 8)

    private fun days(vararg recent: Pair<Int, Long>, filler: Long = 1_000L): List<WalkDay> {
        val back = recent.toMap()
        return (29 downTo 0).map { b -> WalkDay(today.minusDays(b.toLong()), back[b] ?: filler) }
    }

    @Test fun oneRowUsesEighthBlocks() {
        assertEquals(listOf("·▁▄█"), WalkChart.bars(listOf<Long>(0, 1, 4, 8), height = 1))
    }

    @Test fun tallBarsStackFullBlocks() {
        assertEquals(listOf("   █", "·▂██"), WalkChart.bars(listOf<Long>(0, 2, 8, 16), height = 2))
    }

    @Test fun futureHoursStayBlankAndSmallWalksStillShow() {
        assertEquals(listOf("▁█"), WalkChart.bars(listOf(1L, 1_000L, null, null), height = 1))
    }

    @Test fun anEmptyDayIsADottedFloor() {
        assertEquals(listOf("", "··"), WalkChart.bars(listOf<Long>(0, 0), height = 2))
    }

    @Test fun numbersUseThousandsSeparators() {
        assertEquals("1,234,567", WalkChart.steps(1_234_567))
        assertEquals("0", WalkChart.steps(0))
        assertEquals("4.2 km", WalkChart.distance(4_180.0))
    }

    @Test fun axesFitTheirCharts() {
        assertEquals(24, WalkChart.hourAxis().length)
        val axis = WalkChart.dayAxis(30)
        assertEquals(30, axis.length)
        assertTrue(axis.startsWith("29d ago "))
        assertTrue(axis.endsWith(" today"))
    }

    @Test fun missingDaysAreZeroOldestFirst() {
        val filled = WalkChart.fillDays(mapOf(today to 500L, today.minusDays(3) to 70L), today)
        assertEquals(30, filled.size)
        assertEquals(today.minusDays(29), filled.first().date)
        assertEquals(WalkDay(today, 500), filled.last())
        assertEquals(70L, filled[26].steps)
        assertEquals(0L, filled[25].steps)
    }

    @Test fun statsFromFixedDays() {
        val s = WalkChart.stats(
            days(0 to 3_500L, 1 to 4_000L, 2 to 3_000L, 3 to 2_999L, 6 to 9_880L),
            today,
        )
        // Oct 1 to Oct 7: 1000 + 9880 + 1000 + 1000 + 2999 + 3000 + 4000 = 22879, over 7.
        assertEquals(3_268L, s.avg7)
        assertEquals(WalkDay(LocalDate.of(2026, 10, 2), 9_880), s.best)
        assertEquals(3, s.streak)
    }

    @Test fun streakEndsYesterdayWhileTodayIsStillShort() {
        val s = WalkChart.stats(days(0 to 100L, 1 to 5_000L, 2 to 5_000L, 3 to 0L), today)
        assertEquals(2, s.streak)
    }

    @Test fun aBrokenStreakIsJustZero() {
        assertEquals(0, WalkChart.stats(days(0 to 2_000L, 1 to 2_999L), today).streak)
    }

    @Test fun bestDayIsNoneWhenEmptyAndLatestOnATie() {
        assertNull(WalkChart.stats(days(filler = 0L), today).best)
        val tie = WalkChart.stats(days(5 to 7_000L, 2 to 7_000L), today)
        assertEquals(today.minusDays(2), tie.best?.date)
    }

    @Test fun reportDrawsTodayByHourAndOneLinePerStat() {
        val hourly = listOf<Long>(0, 0, 0, 0, 0, 0, 0, 500, 1_000, 0, 2_000)
        val lines = WalkChart.report(hourly, days(0 to 3_500L, 1 to 4_000L, 2 to 3_000L, 3 to 2_999L, 6 to 9_880L), today, 4_180.0)
        val text = lines.map { it.text }
        assertEquals("today by hour", text[0])
        assertEquals(
            listOf(
                "          █",
                "          █",
                "        ▄ █",
                "       ▂█ █",
                "·······██·█",
            ),
            text.subList(1, 6),
        )
        assertTrue(lines.subList(1, 6).all { it.accent })
        assertEquals(WalkChart.hourAxis(), text[6])
        assertEquals("last 30 days", text[8])
        assertEquals(
            listOf(
                "today           3,500 steps",
                "7 day average   3,268 steps",
                "best day        9,880 steps, Oct 2",
                "streak          3 days at 3,000+",
                "distance today  4.2 km",
            ),
            text.takeLast(5),
        )
    }

    @Test fun noDistanceLineWithoutTheGrant() {
        val lines = WalkChart.report(listOf(0L), days(filler = 0L), today, null).map { it.text }
        assertFalse(lines.any { it.startsWith("distance") })
        assertEquals("best day        none yet", lines[lines.size - 2])
        assertEquals("streak          starts with a 3,000 step day", lines.last())
    }

    @Test fun reportNeverMentionsBodyMetrics() {
        val all = WalkChart.report(listOf(10L), days(), today, 10.0).joinToString("\n") { it.text }.lowercase()
        for (word in listOf("calor", "kcal", "weight", "heart", "sleep", "bmi")) assertFalse(word, word in all)
    }
}
