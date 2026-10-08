package dev.truffle.feeder

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Owner state is read only. The secret travels in a header, never in a URL. */
data class OwnerSnapshot(
    val day: String, val zone: ZoneId, val steps: Long, val dead: Boolean,
    val burrowed: Boolean, val energyPercent: Int,
    val weatherAt: Instant?, val weatherSafe: Boolean,
)

fun parseOwnerSnapshot(body: String, now: Instant): OwnerSnapshot {
    val root = JSONObject(body)
    val state = root.getJSONObject("state")
    val zone = ZoneId.of(root.getString("tz"))
    val day = LocalDate.parse(root.getString("local_day")).toString()
    require(day == now.atZone(zone).toLocalDate().toString()) { "The pet's day changed. Try again." }
    require(!root.optBoolean("demo")) { "Direct walking is available for your real Truffle." }
    val steps = state.getLong("steps_today")
    require(steps in 0L..250_000L) { "The server returned an invalid step total." }
    val weather = root.optJSONObject("weather")
    val stamp = (weather?.opt("fetched_ms") as? Number)?.toLong()?.takeIf { it > 0 }?.let(Instant::ofEpochMilli)
    val apparent = weather?.opt("apparent_c") as? Number
    val maximum = weather?.opt("daytime_max_c") as? Number
    val wind = weather?.opt("wind_kmh") as? Number
    val precipitation = weather?.opt("precipitation_mm") as? Number
    val code = weather?.opt("weather_code") as? Number
    return OwnerSnapshot(day, zone, steps, state.getBoolean("dead"), state.getBoolean("burrowed"),
        root.getInt("energy_pct").coerceIn(0, 100), stamp,
        apparent != null && maximum != null && apparent.toDouble().isFinite() && maximum.toDouble().isFinite() &&
            apparent.toDouble() < 35 && maximum.toDouble() < 35 &&
            wind != null && wind.toDouble().isFinite() && wind.toDouble() in 0.0..<30.0 &&
            precipitation != null && precipitation.toDouble().isFinite() && precipitation.toDouble() in 0.0..<1.0 &&
            code != null && code.toDouble() in setOf(0.0, 1.0, 2.0, 3.0))
}

object OwnerStateClient {
    suspend fun read(settings: FeedSettings): OwnerSnapshot = withContext(Dispatchers.IO) {
        val config = settings.config()
        val creds = settings.creds ?: throw IllegalArgumentException("Open your existing Truffle from the web before starting direct walking.")
        val connection = URL("${config.server}/state?phrase=${config.phrase}").openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("x-truffle-secret", creds.secret)
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-cache")
            if (connection.responseCode != 200) throw IOException("Could not confirm your Truffle's current day. Try again when connected.")
            val body = connection.inputStream.bufferedReader().use { reader ->
                val text = StringBuilder()
                val buffer = CharArray(4096)
                while (true) {
                    val count = reader.read(buffer)
                    if (count < 0) break
                    text.append(buffer, 0, count)
                    if (text.length > 65_536) throw IOException("Server response was too large.")
                }
                text.toString()
            }
            // An ownership/origin change while the read was pending invalidates it.
            if (settings.config() != config || settings.creds != creds) throw IOException("The pet changed. Try again.")
            parseOwnerSnapshot(body, Instant.now())
        } finally { connection.disconnect() }
    }
}
