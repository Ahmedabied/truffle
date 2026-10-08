package dev.truffle.feeder

import android.content.Context
import android.content.SharedPreferences

/** The few keys the feeder keeps. A plain interface so unit tests can use a map. */
interface FeedStore {
    interface Editor {
        fun putString(key: String, value: String)
        fun putBoolean(key: String, value: Boolean)
    }

    fun getString(key: String): String?
    fun getBoolean(key: String): Boolean
    fun edit(block: Editor.() -> Unit)
}

class PreferencesStore(val preferences: SharedPreferences) : FeedStore {
    override fun getString(key: String): String? = preferences.getString(key, null)
    override fun getBoolean(key: String): Boolean = preferences.getBoolean(key, false)
    override fun edit(block: FeedStore.Editor.() -> Unit) {
        val editor = preferences.edit()
        object : FeedStore.Editor {
            override fun putString(key: String, value: String) { editor.putString(key, value) }
            override fun putBoolean(key: String, value: Boolean) { editor.putBoolean(key, value) }
        }.block()
        editor.apply()
    }
}

fun feederPreferences(context: Context): SharedPreferences =
    context.getSharedPreferences("feeder", Context.MODE_PRIVATE)

/**
 * Stored phrase, server, status and the Truffle's active zone, plus the pet's
 * secret and the web origin once the app owns the pet. Feeding never clears the
 * phrase. Only the person typing, or "forget this truffle", changes it.
 */
class FeedSettings(private val store: FeedStore) {
    constructor(context: Context) : this(PreferencesStore(feederPreferences(context)))

    val phrase: String get() = store.getString("phrase").orEmpty()
    /** The API origin. The old placeholder from 0.1 counts as unset. */
    val server: String get() = store.getString("server")?.takeIf { it.isNotBlank() && it != PLACEHOLDER_SERVER } ?: DEFAULT_API_ORIGIN
    val webOrigin: String get() = AppLink.parseOrigin(store.getString("web_origin")) ?: DEFAULT_WEB_ORIGIN
    /** The raw web origin text, for the settings field. */
    val webOriginText: String get() = store.getString("web_origin")?.takeIf { it.isNotBlank() } ?: DEFAULT_WEB_ORIGIN

    /** The pet this app owns, or null. Present only after pairing or a valid deep link. */
    val creds: TruffleCreds? get() = TruffleCreds.of(store.getString("phrase"), store.getString("secret"))
    val status: String get() = store.getString("status") ?: "Pair with Truffle, then tap Feed now."
    val needsPermission: Boolean get() = store.getBoolean("needs_permission")

    /** The zone the Worker last reported as the Truffle's day zone, or null before the first feed. */
    val activeTz: String? get() = store.getString("active_tz")?.takeIf { it.isNotBlank() }

    fun config(): FeedConfig = FeedConfig.parse(phrase, server)

    fun saveInputs(phrase: String, server: String) {
        // A different Truffle may live in a different zone. The next reply tells us.
        val changed = phrase.trim().lowercase() != this.phrase.trim().lowercase()
        store.edit {
            if (changed) putString("active_tz", "")
            putString("phrase", phrase)
            putString("server", server)
        }
    }

    fun saveWebOrigin(text: String) {
        store.edit { putString("web_origin", text) }
    }

    /** The app now owns this pet. The feeder phrase follows it. */
    fun saveCreds(creds: TruffleCreds) {
        val changed = creds.phrase != phrase.trim().lowercase()
        store.edit {
            if (changed) putString("active_tz", "")
            putString("phrase", creds.phrase)
            putString("secret", creds.secret)
        }
    }

    /** Drops the pet from this phone. Server and web origins stay. */
    fun forget() {
        store.edit {
            putString("phrase", "")
            putString("secret", "")
            putString("active_tz", "")
            putString("status", "Forgotten. Make a truffle or open one from the web.")
            putBoolean("needs_permission", false)
        }
    }

    fun saveActiveTz(zone: String) {
        store.edit { putString("active_tz", zone) }
    }

    fun setStatus(message: String, needsPermission: Boolean = false) {
        store.edit {
            putString("status", message)
            putBoolean("needs_permission", needsPermission)
        }
    }
}
