package dev.truffle.feeder

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class CounterObservationTest {
    private val now = Instant.parse("2026-10-08T20:50:00Z")
    @Test fun `first cumulative callback with yesterday timestamp anchors current opt in day`() {
        val at = counterRecordedAt(1_000, 86_401_000, now, true)!!
        val zone = ZoneId.of("Asia/Muscat")
        var state = SensorAccumulator.observe(SensorAccumulatorState(), SensorCounterSample(400, 1_000, at, 3), zone)
        state = SensorAccumulator.observe(state, SensorCounterSample(425, 86_402_000, now.plusSeconds(1), 3), zone)
        assertEquals(25L, state.days["2026-10-09"]?.total)
        assertFalse(state.days.containsKey("2026-10-08"))
    }
    @Test fun `subsequent delayed event retains old day for conservative crossing`() {
        assertEquals(now.minusSeconds(86_400), counterRecordedAt(1_000, 86_401_000, now, false))
    }
    @Test fun `future or negative sensor timestamp is rejected`() {
        assertNull(counterRecordedAt(2_000, 1_000, now, true))
        assertNull(counterRecordedAt(-1, 1_000, now, false))
    }
}
