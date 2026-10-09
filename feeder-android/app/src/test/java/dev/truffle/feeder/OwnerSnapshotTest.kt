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
        val weather = JSONObject().put("fetched_ms", now.toEpochMilli()).put("apparent_c", 30).put("daytime_max_c", 34).put("weather_code", 1).put("wind_kmh", 8).put("precipitation_mm", 0)
        assertTrue(parseOwnerSnapshot(body().put("weather", weather).toString(), now).weatherSafe)
        weather.put("daytime_max_c", 35)
        assertFalse(parseOwnerSnapshot(body().put("weather", weather).toString(), now).weatherSafe)
        weather.remove("daytime_max_c")
        assertFalse(parseOwnerSnapshot(body().put("weather", weather).toString(), now).weatherSafe)
    }
    @Test fun `storm rain wind and incomplete observations suppress walking note`() {
        fun weather() = JSONObject().put("fetched_ms", now.toEpochMilli()).put("apparent_c", 27)
            .put("daytime_max_c", 29).put("weather_code", 0).put("wind_kmh", 4).put("precipitation_mm", 0)
        for (code in listOf(45, 61, 95, 96, 99)) {
            assertFalse(parseOwnerSnapshot(body().put("weather", weather().put("weather_code", code)).toString(), now).weatherSafe)
        }
        assertFalse(parseOwnerSnapshot(body().put("weather", weather().put("wind_kmh", 30)).toString(), now).weatherSafe)
        assertFalse(parseOwnerSnapshot(body().put("weather", weather().put("precipitation_mm", 1)).toString(), now).weatherSafe)
        val missing = weather().apply { remove("wind_kmh") }
        assertFalse(parseOwnerSnapshot(body().put("weather", missing).toString(), now).weatherSafe)
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

    @Test fun `v2 is well fed at absolute food threshold even with expanded capacity`() {
        val b = body().put("energy_pct", 4)
        b.getJSONObject("state").put("energy_version", 2).put("energy", 1_500)
        assertTrue(parseOwnerSnapshot(b.toString(), now).wellFed)
        b.getJSONObject("state").put("energy", 1_499)
        assertFalse(parseOwnerSnapshot(b.toString(), now).wellFed)
        b.put("energy_pct", 100)
        assertFalse(parseOwnerSnapshot(b.toString(), now).wellFed)
        b.getJSONObject("state").put("steps_today", 3_000)
        assertTrue(parseOwnerSnapshot(b.toString(), now).wellFed)
    }

    @Test fun `legacy well fed threshold still uses percentage or steps`() {
        val b = body().put("energy_pct", 50)
        assertTrue(parseOwnerSnapshot(b.toString(), now).wellFed)
        b.put("energy_pct", 49)
        assertFalse(parseOwnerSnapshot(b.toString(), now).wellFed)
        b.getJSONObject("state").put("steps_today", 3_000)
        assertTrue(parseOwnerSnapshot(b.toString(), now).wellFed)
    }

    @Test fun `missing or malformed v2 food conservatively suppresses notes`() {
        val b = body()
        b.getJSONObject("state").put("energy_version", 2)
        assertTrue(parseOwnerSnapshot(b.toString(), now).wellFed)
        b.getJSONObject("state").put("energy", -1)
        assertTrue(parseOwnerSnapshot(b.toString(), now).wellFed)
    }
}
