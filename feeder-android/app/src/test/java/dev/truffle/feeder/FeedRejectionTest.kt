package dev.truffle.feeder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedRejectionTest {
    private val jump = """{"error":"That is 10 new steps since the last sync, more than 20 a second. Nothing changed. Sync again in 3 s.","retry_after_s":3}"""

    @Test fun badRequestWithRetryAfterSchedulesOneCalmRetry() {
        val reply = parseFeedReply(400, jump)
        assertEquals(FeedReply.RetryLater(3), reply)
        val first = decideRejection(reply, isRetryRun = false)
        assertEquals("Synced too fast, trying again in 3 s.", first.status)
        assertEquals(3L, first.retryAfterSeconds)
        assertFalse(first.status.contains("{"))
    }

    @Test fun aRetryRunDoesNotScheduleAnotherRetry() {
        val again = decideRejection(parseFeedReply(400, jump), isRetryRun = true)
        assertNull(again.retryAfterSeconds)
        assertEquals("Synced too fast. The next sync will try again.", again.status)
    }

    @Test fun retryDelayIsClampedToAnHour() {
        val reply = parseFeedReply(400, """{"error":"x","retry_after_s":86400}""")
        assertEquals(3600L, decideRejection(reply, isRetryRun = false).retryAfterSeconds)
        val tiny = parseFeedReply(400, """{"error":"x","retry_after_s":0}""")
        assertEquals(1L, decideRejection(tiny, isRetryRun = false).retryAfterSeconds)
    }

    @Test fun badRequestWithoutRetryShowsTheWorkersErrorText() {
        val body = """{"error":"steps_today_total is above the daily limit of 50000 steps.","hint":"Nothing changed. Your steps are still on your phone. Fix the request and sync again."}"""
        val decision = decideRejection(parseFeedReply(400, body), isRetryRun = false)
        assertEquals("steps_today_total is above the daily limit of 50000 steps.", decision.status)
        assertNull(decision.retryAfterSeconds)
    }

    @Test fun badRequestTextIsCleanedAndShort() {
        val long = "a".repeat(500)
        val reply = parseFeedReply(400, """{"error":"line\u0000one\n$long"}""") as FeedReply.Rejected
        assertFalse(reply.message.contains("\u0000"))
        assertFalse(reply.message.contains("\n"))
        assertTrue(reply.message.length <= 200)
    }

    @Test fun unreadableRejectionNeverShowsTheRawBody() {
        for (body in listOf("<html>Bad Gateway</html>", "", """{"hint":"only a hint"}""", """{"error":42}""")) {
            val decision = decideRejection(parseFeedReply(400, body), isRetryRun = false)
            assertEquals("The server refused this sync. Nothing changed.", decision.status)
            assertFalse(decision.status.contains("html"))
        }
    }

    @Test fun unknownPhraseAsksForAFreshCopy() {
        val expected = "Phrase not recognised. Copy it again from the web app."
        assertEquals(expected, decideRejection(parseFeedReply(401, """{"error":"That phrase and secret do not match a Truffle."}"""), false).status)
        assertEquals(expected, decideRejection(parseFeedReply(404, """{"error":"no truffle with that phrase"}"""), false).status)
        assertNull(decideRejection(parseFeedReply(401, ""), false).retryAfterSeconds)
    }

    @Test fun rateLimitWithRetryAfterAlsoRetriesOnce() {
        val reply = parseFeedReply(429, """{"error":"rate limit: 60 feeds per hour, retry in 120s","retry_after_s":120}""")
        assertEquals(FeedReply.RetryLater(120), reply)
    }

    @Test fun serverTroubleIsRetryableWithoutShowingTheBody() {
        val reply = parseFeedReply(503, "upstream exploded: secret stack trace")
        assertEquals(FeedReply.ServerTrouble(503), reply)
        val decision = decideRejection(reply, isRetryRun = false)
        assertFalse(decision.status.contains("stack"))
        assertTrue(decision.serverRetry)
    }

    @Test fun noRejectionClearsTheStoredPhrase() {
        val store = MapStore()
        val settings = FeedSettings(store)
        settings.saveInputs("sand-moon-fig", "https://example.org")
        val replies = listOf(
            parseFeedReply(400, jump),
            parseFeedReply(400, """{"error":"day must be a real date, YYYY-MM-DD"}"""),
            parseFeedReply(401, """{"error":"That phrase and secret do not match a Truffle."}"""),
            parseFeedReply(404, "{}"),
            parseFeedReply(429, """{"retry_after_s":5}"""),
            parseFeedReply(500, "boom"),
        )
        for (reply in replies) {
            for (retryRun in listOf(false, true)) {
                settings.setStatus(decideRejection(reply, retryRun).status)
                assertEquals("sand-moon-fig", settings.phrase)
                assertEquals("https://example.org", settings.server)
            }
        }
    }

    @Test fun successStoresTheActiveZoneAndKeepsThePhrase() {
        val settings = FeedSettings(MapStore())
        settings.saveInputs("sand-moon-fig", "https://example.org")
        assertNull(settings.activeTz)
        settings.saveActiveTz("Asia/Muscat")
        assertEquals("Asia/Muscat", settings.activeTz)
        assertEquals("sand-moon-fig", settings.phrase)
    }

    private class MapStore : FeedStore {
        private val values = mutableMapOf<String, Any>()
        override fun getString(key: String): String? = values[key] as? String
        override fun getBoolean(key: String): Boolean = values[key] as? Boolean ?: false
        override fun edit(block: FeedStore.Editor.() -> Unit) {
            val editor = object : FeedStore.Editor {
                override fun putString(key: String, value: String) { values[key] = value }
                override fun putBoolean(key: String, value: Boolean) { values[key] = value }
            }
            editor.block()
        }
    }
}
