package dev.truffle.feeder

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.format.DateTimeFormatter

class FeedHttpException(val code: Int) : IOException("Server returned HTTP $code. Check the pairing phrase and server URL.") {
    val retryable: Boolean get() = code == 408 || code == 429 || code >= 500
}

class FeedSender(context: Context) {
    private val health = HealthSteps(context)
    private val settings = FeedSettings(context)

    suspend fun feed(background: Boolean): String = withContext(Dispatchers.IO) {
        val config = settings.config()
        val steps = health.readToday(background)
        // Do not send yesterday's snapshot after a midnight or time-zone change.
        if (java.time.ZoneId.systemDefault() != steps.window.zone ||
            Instant.now().atZone(steps.window.zone).toLocalDate() != steps.window.end.atZone(steps.window.zone).toLocalDate()) {
            throw IOException("The local day changed. Read steps again.")
        }
        val summary = post(config.endpoint, feedPayload(config, steps.total, steps.window.zone))
        val time = DateTimeFormatter.ofPattern("HH:mm").withZone(steps.window.zone).format(Instant.now())
        "$time: Sent ${steps.total} steps. $summary"
    }

    private fun post(endpoint: String, json: String): String {
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
            if (code !in 200..299) throw FeedHttpException(code)
            val body = connection.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
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
            return stateSummary(body)
        } finally {
            connection.disconnect()
        }
    }
}
