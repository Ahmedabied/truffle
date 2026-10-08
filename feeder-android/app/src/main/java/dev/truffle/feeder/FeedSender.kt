package dev.truffle.feeder

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** A server fault worth retrying later. The message is calm text, never a body. */
class FeedHttpException(val code: Int, message: String, val retryable: Boolean) : IOException(message)

/** The status line to show, and a one-time retry delay when the Worker asked for one. */
data class FeedRun(val status: String, val retryAfterSeconds: Long? = null)

class FeedSender(context: Context) {
    private val context = context.applicationContext
    private val health = HealthSteps(context)
    private val settings = FeedSettings(context)

    suspend fun feed(background: Boolean, isRetryRun: Boolean = false): FeedRun = withContext(Dispatchers.IO) { FeedGate.mutex.withLock {
        NativeTracking.reconcileStop(context)
        require(!NativeWalkStore(context).paused) { "Phone counting is paused. Resume in Walk or choose Health Connect there." }
        val direct = NativeWalkStore(context).enabled
        val config = settings.config()
        var envelope = envelopeNow()
        var total = read(envelope, background, direct)
        require(config == settings.config()) { "The pet changed. Read steps again." }
        var reply = post(config.endpoint, feedPayload(config, total, envelope))
        require(config == settings.config()) { "The pet changed during the upload. Read steps again." }
        if (reply is FeedReply.Accepted) {
            reply.activeTz?.let(settings::saveActiveTz)
            // The Truffle lives in another zone. Sum again from its midnight, once.
            if (!direct && needsResend(reply, envelope)) {
                envelope = envelopeNow()
                total = read(envelope, background, direct)
                require(config == settings.config()) { "The pet changed. Read steps again." }
                reply = post(config.endpoint, feedPayload(config, total, envelope))
                require(config == settings.config()) { "The pet changed during the upload. Read steps again." }
                if (reply is FeedReply.Accepted) reply.activeTz?.let(settings::saveActiveTz)
            }
        }
        val time = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.now())
        when (val r = reply) {
            is FeedReply.Accepted ->
                if (r.ignored != null) {
                    FeedRun("$time: Truffle's day is ${r.expectedDay ?: "different"} in ${r.activeTz ?: "its zone"}. These steps were not counted.")
                } else {
                    FeedRun("$time: Sent $total steps for ${envelope.day}. ${r.summary}")
                }
            else -> {
                val decision = decideRejection(r, isRetryRun)
                if (decision.serverRetry) {
                    throw FeedHttpException((r as FeedReply.ServerTrouble).code, decision.status, true)
                }
                FeedRun(decision.status, decision.retryAfterSeconds)
            }
        }
    } }

    private fun envelopeNow(): DayEnvelope {
        val device = ZoneId.systemDefault()
        return dayEnvelope(Instant.now(), activeZone(settings.activeTz, device), device)
    }

    private suspend fun read(envelope: DayEnvelope, background: Boolean, direct: Boolean): Long {
        val total = if (direct) NativeTracking.total(context, envelope) else health.readWindow(envelope.window, background)
        // Do not send a total under a day label that has just ended.
        if (Instant.now().atZone(envelope.window.zone).toLocalDate().toString() != envelope.day) {
            throw IOException("The local day changed. Read steps again.")
        }
        return total
    }

    private fun post(endpoint: String, json: String): FeedReply {
        val connection = URL(endpoint).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            // Never forward a pairing phrase to a redirect target.
            connection.instanceFollowRedirects = false
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            val payload = json.toByteArray(Charsets.UTF_8)
            connection.setFixedLengthStreamingMode(payload.size)
            connection.outputStream.use { it.write(payload) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            return parseFeedReply(code, stream?.let(::readLimited))
        } finally {
            connection.disconnect()
        }
    }

    private fun readLimited(stream: InputStream): String = stream.bufferedReader(Charsets.UTF_8).use { reader ->
        val result = StringBuilder()
        val buffer = CharArray(4096)
        while (true) {
            val size = reader.read(buffer)
            if (size < 0) break
            result.append(buffer, 0, size)
            if (result.length > 65_536) throw IOException("Server response was too large.")
        }
        result.toString()
    }
}
