package dev.truffle.feeder

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId

fun nativeWalkPreferences(context: Context) = context.getSharedPreferences("native_walk", Context.MODE_PRIVATE)

/** One serialized counter state; baseline and totals are written in the same preference edit. */
class NativeWalkStore(context: Context) {
    private val prefs = nativeWalkPreferences(context)
    val paused: Boolean get() = prefs.getBoolean("paused", false)
    val directSelected: Boolean get() = enabled || paused
    val enabledAt: Long get() = prefs.getLong("enabled_at", 0)
    val sessionBoot: Long get() = prefs.getLong("session_boot", -1)
    fun sessionBoot(boot: Long) { prefs.edit().putLong("session_boot", boot).apply() }
    val enabled: Boolean get() = prefs.getBoolean("enabled", false)
    val reminders: Boolean get() = prefs.getBoolean("reminders", false)
    val status: String get() = prefs.getString("status", null) ?: "Count walks with this phone, even without Samsung Health."
    val lastActive: Instant? get() = prefs.getLong("active_ms", 0).takeIf { it > 0 }?.let(Instant::ofEpochMilli)
    val lastNudge: Instant? get() = prefs.getLong("nudge_ms", 0).takeIf { it > 0 }?.let(Instant::ofEpochMilli)
    fun active() { prefs.edit().putLong("active_ms", System.currentTimeMillis()).apply() }
    fun reminders(on: Boolean) { prefs.edit().putBoolean("reminders", on).apply() }
    fun nudged(now: Instant) { prefs.edit().putLong("nudge_ms", now.toEpochMilli()).commit() }
    fun status(text: String) { prefs.edit().putString("status", text).apply() }

    fun state(): SensorAccumulatorState = synchronized(lock) {
        runCatching {
            val json = JSONObject(prefs.getString("counter", "{}")!!)
            val b = json.optJSONObject("baseline")?.let {
                SensorCounterSample(it.getLong("steps"), it.getLong("elapsed"), Instant.ofEpochMilli(it.getLong("at")), it.getLong("boot"))
            }
            val days = json.optJSONObject("days") ?: JSONObject()
            val found = days.keys().asSequence().associateWith { key ->
                val day = days.getJSONObject(key)
                val hours = day.getJSONArray("hours")
                require(hours.length() == 24)
                SensorDay(day.getLong("total"), (0..23).map(hours::getLong), day.getBoolean("incomplete"))
            }
            SensorAccumulatorState(json.optString("zone"), b, found)
        }.getOrElse { SensorAccumulatorState() }
    }

    private fun stateJson(state: SensorAccumulatorState): String {
        val days = JSONObject()
        state.days.forEach { (key, day) -> days.put(key, JSONObject().put("total", day.total)
            .put("hours", JSONArray(day.hours)).put("incomplete", day.incomplete)) }
        val json = JSONObject().put("zone", state.zoneId).put("days", days)
        state.baseline?.let { json.put("baseline", JSONObject().put("steps", it.stepsSinceBoot)
            .put("elapsed", it.elapsedRealtimeMillis).put("at", it.recordedAt.toEpochMilli()).put("boot", it.bootCount)) }
        return json.toString()
    }

    fun observe(sample: SensorCounterSample, zone: ZoneId) = synchronized(lock) {
        prefs.edit().putString("counter", stateJson(SensorAccumulator.observe(state(), sample, zone))).apply()
    }

    fun baseline(): SensorFeedBaseline? = synchronized(lock) {
        runCatching {
            val j = JSONObject(prefs.getString("feed_baseline", "")!!)
            SensorFeedBaseline(j.getString("day"), j.getString("zone"), j.getLong("credited"), j.getLong("native"))
        }.getOrNull()
    }

    fun boundTo(settings: FeedSettings): Boolean =
        prefs.getString("owner", null) == "${settings.server}|${settings.phrase.trim().lowercase()}"

    fun confirm(snapshot: OwnerSnapshot, settings: FeedSettings) = synchronized(lock) {
        val old = state()
        // A changed pinned zone cannot reuse counts from a different calendar window.
        val state = if (old.zoneId.isNotEmpty() && old.zoneId != snapshot.zone.id) SensorAccumulatorState() else old
        val local = state.days[snapshot.day]?.total ?: 0
        val baseline = JSONObject().put("day", snapshot.day).put("zone", snapshot.zone.id)
            .put("credited", snapshot.steps).put("native", local)
        prefs.edit().putString("counter", stateJson(state)).putString("feed_baseline", baseline.toString())
            .putString("owner", "${settings.server}|${settings.phrase.trim().lowercase()}").apply()
    }

    fun enable() = synchronized(lock) {
        // Pausing never joins a previous counter sample across an untracked interval.
        prefs.edit().putString("counter", stateJson(SensorAccumulator.pause(state())))
            .putBoolean("enabled", true).putBoolean("paused", false).putLong("enabled_at", System.currentTimeMillis()).apply()
    }

    fun pause() = synchronized(lock) {
        prefs.edit().putBoolean("enabled", false).putBoolean("paused", true)
            .putString("counter", stateJson(SensorAccumulator.pause(state()))).apply()
    }

    fun stop() = synchronized(lock) {
        prefs.edit().putBoolean("enabled", false).putBoolean("paused", false).putString("feed_baseline", "")
            .putString("counter", stateJson(SensorAccumulator.pause(state()))).apply()
    }

    companion object { private val lock = Any() }
}
