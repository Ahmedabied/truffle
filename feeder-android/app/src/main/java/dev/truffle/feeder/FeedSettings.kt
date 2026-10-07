package dev.truffle.feeder

import android.content.Context

class FeedSettings(context: Context) {
    val preferences = context.getSharedPreferences("feeder", Context.MODE_PRIVATE)

    val phrase: String get() = preferences.getString("phrase", "").orEmpty()
    val server: String get() = preferences.getString("server", DEFAULT_SERVER) ?: DEFAULT_SERVER
    val status: String get() = preferences.getString("status", "Pair with Truffle, then tap Feed now.").orEmpty()
    val needsPermission: Boolean get() = preferences.getBoolean("needs_permission", false)

    fun config(): FeedConfig = FeedConfig.parse(phrase, server)

    fun saveInputs(phrase: String, server: String) {
        preferences.edit().putString("phrase", phrase).putString("server", server).apply()
    }

    fun setStatus(message: String, needsPermission: Boolean = false) {
        preferences.edit()
            .putString("status", message)
            .putBoolean("needs_permission", needsPermission)
            .apply()
    }
}
