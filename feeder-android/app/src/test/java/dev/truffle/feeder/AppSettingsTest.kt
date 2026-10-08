package dev.truffle.feeder

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppSettingsTest {
    private val secret = "AbCdEfGhIjKlMnOp_-12"

    @Test fun defaultsPointAtTheDeployedOrigins() {
        val settings = FeedSettings(MapStore())
        assertEquals(DEFAULT_API_ORIGIN, settings.server)
        assertEquals(DEFAULT_WEB_ORIGIN, settings.webOrigin)
        assertNull(settings.creds)
    }

    @Test fun theOldPlaceholderCountsAsUnset() {
        val settings = FeedSettings(MapStore())
        settings.saveInputs("", PLACEHOLDER_SERVER)
        assertEquals(DEFAULT_API_ORIGIN, settings.server)
    }

    @Test fun anInvalidWebOriginFallsBackButStaysEditable() {
        val settings = FeedSettings(MapStore())
        settings.saveWebOrigin("http://evil.example")
        assertEquals(DEFAULT_WEB_ORIGIN, settings.webOrigin)
        assertEquals("http://evil.example", settings.webOriginText)
        settings.saveWebOrigin("https://my-truffle.example/")
        assertEquals("https://my-truffle.example", settings.webOrigin)
    }

    @Test fun pairingFillsTheFeederPhraseAndForgetClearsIt() {
        val settings = FeedSettings(MapStore())
        settings.saveInputs("old-pet-name", DEFAULT_API_ORIGIN)
        settings.saveActiveTz("Asia/Muscat")
        val creds = TruffleCreds("sand-moon-fig", secret)
        settings.saveCreds(creds)
        assertEquals(creds, settings.creds)
        assertEquals("sand-moon-fig", settings.config().phrase)
        assertNull(settings.activeTz)
        settings.forget()
        assertNull(settings.creds)
        assertEquals("", settings.phrase)
        assertEquals(DEFAULT_API_ORIGIN, settings.server)
    }

    @Test fun aTypedPhraseAloneIsNotOwnership() {
        val settings = FeedSettings(MapStore())
        settings.saveInputs("sand-moon-fig", DEFAULT_API_ORIGIN)
        assertNull(settings.creds)
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
