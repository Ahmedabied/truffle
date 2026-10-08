package dev.truffle.feeder

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class OwnerSnapshotTest {
    private val now = Instant.parse("2026-10-09T08:00:00Z")
    private fun body() = JSONObject().put("tz", "Asia/Muscat").put("local_day", "2026-10-09")
        .put("energy_pct", 30).put("demo", false)
        .put("state", JSONObject().put("steps_today", 420).put("dead", false).put("burrowed", false))
    @Test fun `missing weather never permits a nudge`() {
        val snapshot = parseOwnerSnapshot(body().toString(), now)
        assertEquals(420L, snapshot.steps)
        assertNull(snapshot.weatherAt)
        assertFalse(snapshot.weatherSafe)
    }
    @Test fun `weather requires both known temperatures below heat threshold`() {
        val weather = JSONObject().put("fetched_ms", now.toEpochMilli()).put("apparent_c", 30).put("daytime_max_c", 34)
        assertTrue(parseOwnerSnapshot(body().put("weather", weather).toString(), now).weatherSafe)
        weather.put("daytime_max_c", 35)
        assertFalse(parseOwnerSnapshot(body().put("weather", weather).toString(), now).weatherSafe)
        weather.remove("daytime_max_c")
        assertFalse(parseOwnerSnapshot(body().put("weather", weather).toString(), now).weatherSafe)
    }
    @Test(expected = IllegalArgumentException::class) fun `stale day cannot become feed baseline`() {
        parseOwnerSnapshot(body().put("local_day", "2026-10-08").toString(), now)
    }
    @Test(expected = IllegalArgumentException::class) fun `demo cannot feed from direct hardware`() {
        parseOwnerSnapshot(body().put("demo", true).toString(), now)
    }
    @Test(expected = IllegalArgumentException::class) fun `negative credited count rejected`() {
        val b = body(); b.getJSONObject("state").put("steps_today", -1)
        parseOwnerSnapshot(b.toString(), now)
    }
}
