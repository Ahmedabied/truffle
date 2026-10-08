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

/**
 * The day label the Worker expects. The Truffle's day follows its active zone,
 * pinned by the Worker at pairing and echoed as `active_tz` in every feed reply.
 * Steps are summed from that zone's local midnight, not the device's.
 */
data class DayEnvelope(val day: String, val dayTz: String, val deviceTz: String, val window: DayWindow)

/** The stored active zone when it is a real IANA zone, else the device zone. */
fun activeZone(stored: String?, device: ZoneId): ZoneId = parseZone(stored) ?: device

fun dayEnvelope(now: Instant, active: ZoneId, device: ZoneId): DayEnvelope {
    val window = todayWindow(now, active)
    return DayEnvelope(now.atZone(active).toLocalDate().toString(), active.id, device.id, window)
}

fun feedPayload(config: FeedConfig, total: Long, envelope: DayEnvelope): String {
    require(total >= 0) { "Steps cannot be negative." }
    return JSONObject()
        .put("phrase", config.phrase)
        .put("steps_today_total", total)
        .put("day", envelope.day)
        .put("day_tz", envelope.dayTz)
        .put("device_tz", envelope.deviceTz)
        .toString()
}

private fun parseZone(value: String?): ZoneId? {
    if (value.isNullOrBlank() || value.length > 64 || !Regex("[A-Za-z0-9_+\\-]+(/[A-Za-z0-9_+\\-]+)*").matches(value)) return null
    return try { ZoneId.of(value) } catch (_: Exception) { null }
}

/** What the Worker said about one feed. Raw bodies never leave this parser. */
sealed class FeedReply {
    data class Accepted(val summary: String, val activeTz: String?, val expectedDay: String?, val ignored: String?) : FeedReply()
    data class RetryLater(val seconds: Long) : FeedReply()
    data class Rejected(val message: String) : FeedReply()
    object PhraseUnknown : FeedReply()
    data class ServerTrouble(val code: Int) : FeedReply()
}

const val PHRASE_UNKNOWN = "Phrase not recognised. Copy it again from the web app."
const val REFUSED = "The server refused this sync. Nothing changed."
const val MAX_RETRY_SECONDS = 3600L

private fun jsonOrNull(body: String?): JSONObject? = try {
    if (body.isNullOrBlank()) null else JSONObject(body)
} catch (_: Exception) {
    null
}

private fun cleanText(value: String): String =
    value.replace(Regex("[\\p{Cntrl}]+"), " ").replace(Regex("\\s+"), " ").trim().take(200)

fun parseFeedReply(code: Int, body: String?): FeedReply {
    val json = jsonOrNull(body)
    val retry = (json?.opt("retry_after_s") as? Number)?.toLong()
    return when {
        code in 200..299 -> {
            val root = json ?: throw IllegalArgumentException("Server did not return a state summary.")
            val day = (root.opt("expected_day") as? String)?.takeIf { Regex("\\d{4}-\\d{2}-\\d{2}").matches(it) }
            val ignored = (root.opt("ignored") as? String)?.let(::cleanText)?.takeIf { it.isNotEmpty() }
            FeedReply.Accepted(stateSummary(root.toString()), parseZone(root.opt("active_tz") as? String)?.id, day, ignored)
        }
        (code == 400 || code == 429) && retry != null -> FeedReply.RetryLater(retry)
        code == 400 -> FeedReply.Rejected((json?.opt("error") as? String)?.let(::cleanText).orEmpty().ifEmpty { REFUSED })
        code == 401 || code == 404 -> FeedReply.PhraseUnknown
        else -> FeedReply.ServerTrouble(code)
    }
}

/**
 * Resend once when the Worker's zone differs from the one the steps were summed
 * in, or when it ignored the day label. The second send uses the Worker's zone.
 */
fun needsResend(reply: FeedReply.Accepted, sent: DayEnvelope): Boolean {
    val zone = reply.activeTz ?: return false
    return zone != sent.dayTz || (reply.ignored != null && reply.expectedDay != null && reply.expectedDay != sent.day)
}

/** What to show and whether to try again after a refused feed. */
data class RejectionDecision(val status: String, val retryAfterSeconds: Long? = null, val serverRetry: Boolean = false)

fun decideRejection(reply: FeedReply, isRetryRun: Boolean): RejectionDecision = when (reply) {
    is FeedReply.RetryLater -> {
        val seconds = reply.seconds.coerceIn(1L, MAX_RETRY_SECONDS)
        if (isRetryRun) RejectionDecision("Synced too fast. The next sync will try again.")
        else RejectionDecision("Synced too fast, trying again in $seconds s.", seconds)
    }
    is FeedReply.Rejected -> RejectionDecision(reply.message)
    FeedReply.PhraseUnknown -> RejectionDecision(PHRASE_UNKNOWN)
    is FeedReply.ServerTrouble -> RejectionDecision(
        "The server had trouble (HTTP ${reply.code}). Steps stay on the phone. Sync will try again.",
        serverRetry = reply.code == 408 || reply.code == 429 || reply.code >= 500,
    )
    is FeedReply.Accepted -> RejectionDecision(reply.summary)
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
