package dev.truffle.feeder

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class NativeMovementDocumentTest {
    private val owner = TruffleCreds("sand-moon-fig", "AbCdEfGhIjKlMnOp_-12")
    private val doc = NativeMovementDocument(DEFAULT_WEB_ORIGIN, DEFAULT_API_ORIGIN, owner, "safe-nonce-1234567890")
    private fun allowed(document: NativeMovementDocument = doc, url: String = "$DEFAULT_WEB_ORIGIN/",
        currentOwner: TruffleCreds? = owner, api: String = DEFAULT_API_ORIGIN, web: String = DEFAULT_WEB_ORIGIN,
        scope: String = doc.scope, foreground: Boolean = true, enabled: Boolean = true, permission: Boolean = true,
        bound: Boolean = true) = document.allows(url, web, api, currentOwner, scope, foreground, enabled, permission, bound)

    @Test fun currentForegroundDocumentOnExactWorldOriginMayReceive() {
        assertTrue(allowed())
        assertTrue(allowed(url = "$DEFAULT_WEB_ORIGIN:443/"))
    }

    @Test fun staleNonceOwnerOrOriginCannotReceive() {
        assertFalse(allowed(scope = "other-document-123456"))
        assertFalse(allowed(currentOwner = null))
        assertFalse(allowed(currentOwner = owner.copy(secret = "another-secret-123456")))
        assertFalse(allowed(api = "https://other.example"))
        assertFalse(allowed(web = "https://other.example"))
        for (url in listOf("$DEFAULT_WEB_ORIGIN/demo", "$DEFAULT_WEB_ORIGIN/demo/", "$DEFAULT_WEB_ORIGIN.evil.example/",
            "http://truffle-web.ahmed-abied.workers.dev/", "$DEFAULT_WEB_ORIGIN:8443/", "$DEFAULT_WEB_ORIGIN/?demo=1")) {
            assertFalse(url, allowed(url = url))
        }
    }

    @Test fun pauseRevocationSourceChangeAndUnboundOwnerStopDelivery() {
        assertFalse(allowed(foreground = false))
        assertFalse(allowed(enabled = false))
        assertFalse(allowed(permission = false))
        assertFalse(allowed(bound = false))
    }

    @Test fun newDocumentsAlwaysHaveDifferentEphemeralScopes() {
        val a = NativeMovementDocument.create(DEFAULT_WEB_ORIGIN, DEFAULT_API_ORIGIN, owner)
        val b = NativeMovementDocument.create(DEFAULT_WEB_ORIGIN, DEFAULT_API_ORIGIN, owner)
        assertNotEquals(a.scope, b.scope)
        assertTrue(AppLink.worldUrl(a.webOrigin, owner, a.scope).endsWith("&native_scope=${a.scope}"))
        assertFalse(AppLink.worldUrl(a.webOrigin, null, a.scope).contains("native_scope"))
    }

    @Test fun eventPayloadContainsOnlyCredentialFreeProtocolFields() {
        val event = AcceptedMovement(3, Instant.ofEpochMilli(1_234), 2_000)
        val json = JSONObject(doc.eventJson(event, "1"))
        assertEquals(setOf("version", "scope", "eventId", "delta", "observedAt", "intervalMs"), json.keys().asSequence().toSet())
        assertEquals(1, json.getInt("version"))
        assertEquals(doc.scope, json.getString("scope"))
        assertEquals(3L, json.getLong("delta"))
        assertEquals("1", json.getString("eventId"))
        val script = doc.eventScript(event, "1")
        assertTrue(script.contains("truffle:native-movement"))
        assertFalse(script.contains(owner.phrase))
        assertFalse(script.contains(owner.secret))
    }
}
