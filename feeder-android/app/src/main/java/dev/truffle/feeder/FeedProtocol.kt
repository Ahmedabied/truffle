package dev.truffle.feeder

import org.json.JSONObject
import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

const val DEFAULT_SERVER = "https://truffle.<account>.workers.dev"

data class FeedConfig(val phrase: String, val server: String) {
    val endpoint: String get() = "$server/feed"

    companion object {
        fun parse(phrase: String, server: String): FeedConfig {
            val normalizedPhrase = phrase.trim().lowercase(Locale.ROOT)
            require(Regex("[a-z]+-[a-z]+-[a-z]+").matches(normalizedPhrase) && normalizedPhrase.length <= 100) {
                "Enter the three-word pairing phrase from Truffle."
            }
            val normalizedServer = server.trim().trimEnd('/')
            val uri = try {
                URI(normalizedServer)
            } catch (_: Exception) {
                throw IllegalArgumentException("Replace the server placeholder with your HTTPS server URL.")
            }
            require(uri.scheme == "https" && !uri.host.isNullOrBlank() &&
                uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null &&
                uri.rawPath.isNullOrEmpty() && (uri.port == -1 || uri.port in 1..65535)) {
                "Use an HTTPS server origin with no path, password, query, or fragment."
            }
            return FeedConfig(normalizedPhrase, normalizedServer)
        }
    }
}

data class DayWindow(val start: Instant, val end: Instant, val zone: ZoneId)

fun todayWindow(now: Instant, zone: ZoneId): DayWindow =
    DayWindow(now.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant(), now, zone)

fun feedPayload(config: FeedConfig, total: Long, zone: ZoneId): String {
    require(total >= 0) { "Steps cannot be negative." }
    return JSONObject()
        .put("phrase", config.phrase)
        .put("steps_today_total", total)
        .put("device_tz", zone.id)
        .toString()
}

fun stateSummary(response: String): String {
    val root = JSONObject(response)
    val state = root.optJSONObject("state") ?: root.optJSONObject("summary") ?: root
    val parts = mutableListOf<String>()
    for (key in listOf("stage", "mood", "tier")) {
        val value = state.opt(key) as? String
        if (!value.isNullOrBlank()) parts += value.replace(Regex("[\\p{Cntrl}]"), " ").take(40)
    }
    (state.opt("energy") as? Number)?.let { energy ->
        val cap = state.opt("energy_max") as? Number
        parts += "energy ${energy.toLong()}" + (cap?.let { "/${it.toLong()}" } ?: "")
    }
    (state.opt("steps_today") as? Number)?.let { parts += "steps ${it.toLong()}" }
    if (state.optBoolean("dead")) parts += "new spore needed"
    else if (state.optBoolean("burrowed")) parts += "burrowed"
    require(parts.isNotEmpty()) { "Server did not return a state summary." }
    return parts.joinToString(" | ")
}
