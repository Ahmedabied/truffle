package dev.truffle.feeder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppLinkTest {
    private val secret = "AbCdEfGhIjKlMnOp_-12"
    private val creds = TruffleCreds("sand-moon-fig", secret)
    private val web = DEFAULT_WEB_ORIGIN

    @Test fun deepLinkCarriesPhraseAndSecret() {
        assertEquals(creds, AppLink.parseDeepLink("truffle://pair?creds=sand-moon-fig.$secret"))
        assertEquals(creds, AppLink.parseDeepLink("truffle://pair/?creds=Sand-Moon-Fig.$secret"))
    }

    @Test fun deepLinkRejectsAnythingElse() {
        for (link in listOf(
            null,
            "",
            "https://pair?creds=sand-moon-fig.$secret",
            "truffle://feed?creds=sand-moon-fig.$secret",
            "truffle://pair/x?creds=sand-moon-fig.$secret",
            "truffle://pair?creds=sand-moon-fig.$secret&next=https://evil.example",
            "truffle://pair?phrase=sand-moon-fig.$secret",
            "truffle://pair?creds=sand-moon-fig",
            "truffle://pair?creds=sand-moon.$secret",
            "truffle://pair?creds=sand-moon-fig.short",
            "truffle://pair?creds=sand-moon-fig.$secret.extra",
            "truffle://pair?creds=sand-moon-fig%2E$secret",
            "truffle://pair?creds=sand-moon-fig.$secret#frag",
            "truffle://pair?creds=sand-moon-fig." + "a".repeat(65),
        )) {
            assertNull(link, AppLink.parseDeepLink(link))
        }
    }

    @Test fun credsFollowTheWorkerFormats() {
        assertEquals(creds, TruffleCreds.of(" SAND-moon-fig ", secret))
        assertNull(TruffleCreds.of("sand moon fig", secret))
        assertNull(TruffleCreds.of("sand-moon-fig", "has space in it 1234"))
        assertNull(TruffleCreds.of("sand-moon-fig", "a".repeat(15)))
        assertEquals(creds, TruffleCreds.unpack(creds.packed))
    }

    @Test fun credsNeverPrintTheSecret() {
        assertFalse(secret in creds.toString())
    }

    @Test fun worldUrlPutsCredsOnlyInTheFragment() {
        val url = AppLink.worldUrl(web, creds)
        assertEquals("https://truffle-web.ahmed-abied.workers.dev/#creds=sand-moon-fig.$secret", url)
        assertFalse('?' in url)
        assertEquals("https://truffle-web.ahmed-abied.workers.dev/", AppLink.worldUrl(web, null))
    }

    @Test fun onlyTheWebOriginStaysInside() {
        assertTrue(AppLink.isInsideWeb("$web/", web))
        assertTrue(AppLink.isInsideWeb("$web/share?x=1", web))
        assertTrue(AppLink.isInsideWeb("https://truffle-web.ahmed-abied.workers.dev:443/", web))
        assertFalse(AppLink.isInsideWeb("http://truffle-web.ahmed-abied.workers.dev/", web))
        assertFalse(AppLink.isInsideWeb("https://truffle-web.ahmed-abied.workers.dev.evil.example/", web))
        assertFalse(AppLink.isInsideWeb("https://truffle-web.ahmed-abied.workers.dev@evil.example/", web))
        assertFalse(AppLink.isInsideWeb("https://github.com/", web))
        assertFalse(AppLink.isInsideWeb("javascript:alert(1)", web))
        assertFalse(AppLink.isInsideWeb("file:///sdcard/x.html", web))
        assertFalse(AppLink.isInsideWeb("truffle://pair?creds=${creds.packed}", web))
        assertTrue(AppLink.isExternalWeb("https://github.com/x"))
        assertFalse(AppLink.isExternalWeb("intent://x#Intent;end"))
    }

    @Test fun originsAreHttpsWithNoPath() {
        assertEquals("https://example.org", AppLink.parseOrigin(" https://Example.org/ "))
        assertEquals("https://example.org:8443", AppLink.parseOrigin("https://example.org:8443"))
        assertEquals("https://example.org", AppLink.parseOrigin("https://example.org:443"))
        for (bad in listOf(null, "", "http://example.org", "https://example.org/pair", "https://a@example.org",
            "https://example.org?x=1", "https://example.org#x", PLACEHOLDER_SERVER)) {
            assertNull(bad, AppLink.parseOrigin(bad))
        }
        assertEquals(DEFAULT_API_ORIGIN, AppLink.parseOrigin(DEFAULT_API_ORIGIN))
        assertEquals(DEFAULT_WEB_ORIGIN, AppLink.parseOrigin(DEFAULT_WEB_ORIGIN))
    }

    @Test fun pairReplyKeepsOnlyValidCreds() {
        assertEquals(
            PairReply.Paired(creds),
            parsePairReply(200, """{"phrase":"sand-moon-fig","secret":"$secret","stage":"spore"}"""),
        )
        assertEquals(PairReply.Refused(PAIR_TROUBLE), parsePairReply(200, """{"phrase":"sand-moon-fig"}"""))
        assertEquals(PairReply.Refused(PAIR_TROUBLE), parsePairReply(200, "<html>oops</html>"))
        assertEquals(
            PairReply.Refused("Too many new Truffles from here. Try again in 12 min."),
            parsePairReply(429, """{"error":"Too many new Truffles from here.\nTry again in 12 min."}"""),
        )
        assertEquals(PairReply.Refused(PAIR_TROUBLE), parsePairReply(500, """{"error":"stack trace here"}"""))
    }
}
