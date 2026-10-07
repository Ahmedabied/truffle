package dev.truffle.feeder

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

class FeedProtocolTest {
    private val config = FeedConfig.parse("sand-moon-fig", "https://example.org")

    @Test fun muscatDayStartsAtLocalMidnight() {
        val window = todayWindow(Instant.parse("2026-10-07T19:12:00Z"), ZoneId.of("Asia/Muscat"))
        assertEquals(Instant.parse("2026-10-06T20:00:00Z"), window.start)
        assertEquals("Asia/Muscat", window.zone.id)
    }

    @Test fun newDayDoesNotIncludeYesterday() {
        val midnight = Instant.parse("2026-10-07T20:00:00Z")
        val window = todayWindow(midnight, ZoneId.of("Asia/Muscat"))
        assertEquals(midnight, window.start)
        assertEquals(window.start, window.end)
    }

    @Test fun daylightSavingSpringDayUsesCalendarMidnight() {
        val window = todayWindow(Instant.parse("2026-03-09T03:59:59Z"), ZoneId.of("America/New_York"))
        assertEquals(Instant.parse("2026-03-08T05:00:00Z"), window.start)
        assertEquals(23 * 3600 - 1L, Duration.between(window.start, window.end).seconds)
    }

    @Test fun daylightSavingFallDayUsesCalendarMidnight() {
        val window = todayWindow(Instant.parse("2026-11-02T04:59:59Z"), ZoneId.of("America/New_York"))
        assertEquals(Instant.parse("2026-11-01T04:00:00Z"), window.start)
        assertEquals(25 * 3600 - 1L, Duration.between(window.start, window.end).seconds)
    }

    @Test fun configNormalizesPhraseAndTrailingSlash() {
        val parsed = FeedConfig.parse(" SAND-moon-fig ", " https://example.org/ ")
        assertEquals(config, parsed)
        assertEquals("https://example.org/feed", parsed.endpoint)
    }

    @Test fun rejectsUnpairedOrUnsafeConfiguration() {
        for (phrase in listOf("", "sand-moon", "sand moon fig", "sand-moon-fig-extra", "sand-\"-fig")) {
            assertThrows(IllegalArgumentException::class.java) { FeedConfig.parse(phrase, config.server) }
        }
        for (url in listOf(DEFAULT_SERVER, "http://example.org", "https://user:pass@example.org", "https://example.org/feed", "https://example.org?q=x", "https://example.org#x", "https://example.org:99999")) {
            assertThrows(IllegalArgumentException::class.java) { FeedConfig.parse(config.phrase, url) }
        }
    }

    @Test fun payloadContainsAbsoluteTotalAndTimezoneOnly() {
        val json = JSONObject(feedPayload(config, 6120L, ZoneId.of("Asia/Muscat")))
        assertEquals(setOf("phrase", "steps_today_total", "device_tz"), json.keys().asSequence().toSet())
        assertEquals(6120L, json.getLong("steps_today_total"))
        assertEquals("sand-moon-fig", json.getString("phrase"))
        assertEquals("Asia/Muscat", json.getString("device_tz"))
        assertFalse(json.has("lat"))
        assertFalse(json.has("lon"))
    }

    @Test fun zeroStepsAreValidAndNegativeStepsAreRejected() {
        assertEquals(0L, JSONObject(feedPayload(config, 0, ZoneId.of("UTC"))).getLong("steps_today_total"))
        assertThrows(IllegalArgumentException::class.java) { feedPayload(config, -1, ZoneId.of("UTC")) }
    }

    @Test fun summaryAcceptsFlatOrWrappedState() {
        val state = """{"stage":"Spore","energy":1200,"energy_max":6000,"steps_today":1200,"mood":"content"}"""
        val expected = "Spore | content | energy 1200/6000 | steps 1200"
        assertEquals(expected, stateSummary(state))
        assertEquals(expected, stateSummary("""{"state":$state}"""))
        assertEquals(expected, stateSummary("""{"summary":$state}"""))
    }

    @Test fun summaryDoesNotEchoPairingOrRawRecords() {
        val summary = stateSummary("""{"energy":0,"phrase":"private-value","raw_records":[123],"burrowed":true}""")
        assertEquals("energy 0 | burrowed", summary)
        assertFalse(summary.contains("private-value"))
        assertTrue(stateSummary("""{"dead":true}""").contains("new spore"))
        assertThrows(IllegalArgumentException::class.java) { stateSummary("""{"ok":true}""") }
    }
}
