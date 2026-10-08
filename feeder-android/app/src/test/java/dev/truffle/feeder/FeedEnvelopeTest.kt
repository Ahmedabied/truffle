package dev.truffle.feeder

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class FeedEnvelopeTest {
    private val config = FeedConfig.parse("sand-moon-fig", "https://example.org")
    private val muscat = ZoneId.of("Asia/Muscat")
    private val london = ZoneId.of("Europe/London")

    @Test fun envelopeUsesTheActiveZoneForTheDay() {
        // 21:30 UTC on Oct 7 is Oct 8 in Muscat and still Oct 7 in London.
        val envelope = dayEnvelope(Instant.parse("2026-10-07T21:30:00Z"), muscat, london)
        assertEquals("2026-10-08", envelope.day)
        assertEquals("Asia/Muscat", envelope.dayTz)
        assertEquals("Europe/London", envelope.deviceTz)
        assertEquals(Instant.parse("2026-10-07T20:00:00Z"), envelope.window.start)
        assertEquals(muscat, envelope.window.zone)
    }

    @Test fun payloadCarriesDayDayTzAndDeviceTz() {
        val envelope = dayEnvelope(Instant.parse("2026-10-07T21:30:00Z"), muscat, london)
        val json = JSONObject(feedPayload(config, 4200L, envelope))
        assertEquals(setOf("phrase", "steps_today_total", "day", "day_tz", "device_tz"), json.keys().asSequence().toSet())
        assertEquals("2026-10-08", json.getString("day"))
        assertEquals("Asia/Muscat", json.getString("day_tz"))
        assertEquals("Europe/London", json.getString("device_tz"))
        assertEquals(4200L, json.getLong("steps_today_total"))
        assertFalse(json.has("lat"))
    }

    @Test fun activeZoneFallsBackToTheDeviceZone() {
        assertEquals(london, activeZone(null, london))
        assertEquals(london, activeZone("", london))
        assertEquals(london, activeZone("Not/AZone", london))
        assertEquals(muscat, activeZone("Asia/Muscat", london))
    }

    @Test fun successRecordsTheWorkersActiveZone() {
        val body = """{"energy":900,"energy_max":6000,"stage":"Spore","mood":"content","tier":"low","steps_today":900,"burrowed":false,"expected_day":"2026-10-08","active_tz":"Asia/Muscat"}"""
        val reply = parseFeedReply(200, body) as FeedReply.Accepted
        assertEquals("Asia/Muscat", reply.activeTz)
        assertEquals("2026-10-08", reply.expectedDay)
        assertNull(reply.ignored)
        assertTrue(reply.summary.contains("steps 900"))
    }

    @Test fun invalidActiveZoneFromServerIsNotKept() {
        val body = """{"energy":1,"steps_today":1,"active_tz":"Mars/Base\n","expected_day":"x"}"""
        val reply = parseFeedReply(200, body) as FeedReply.Accepted
        assertNull(reply.activeTz)
    }

    @Test fun resendOnceWhenTheServerZoneDiffers() {
        val sent = dayEnvelope(Instant.parse("2026-10-07T21:30:00Z"), london, london)
        val ignored = FeedReply.Accepted("energy 0", "Asia/Muscat", "2026-10-08", "day 2026-10-07 is already closed")
        assertTrue(needsResend(ignored, sent))
        val counted = FeedReply.Accepted("energy 0", "Asia/Muscat", "2026-10-08", null)
        assertTrue(needsResend(counted, sent))
        val same = dayEnvelope(Instant.parse("2026-10-07T21:30:00Z"), muscat, london)
        assertFalse(needsResend(counted, same))
        assertFalse(needsResend(FeedReply.Accepted("energy 0", null, null, null), sent))
    }
}
