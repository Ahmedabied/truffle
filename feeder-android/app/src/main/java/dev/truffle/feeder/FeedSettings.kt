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
 * Stored phrase, server, status and the Truffle's active zone. Nothing here
 * ever clears the phrase: only the person typing in the field changes it.
 */
class FeedSettings(private val store: FeedStore) {
    constructor(context: Context) : this(PreferencesStore(feederPreferences(context)))

    val phrase: String get() = store.getString("phrase").orEmpty()
    val server: String get() = store.getString("server") ?: DEFAULT_SERVER
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
