package dev.truffle.feeder

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.ZoneId

/**
 * `POST /pair` on the API origin. The body carries only the device zone, so the
 * new Truffle's day starts at the right midnight. The reply's secret is handed
 * straight to private storage by the caller and is never logged or shown.
 */
object PairClient {
    suspend fun pair(apiOrigin: String): PairReply = withContext(Dispatchers.IO) {
        val origin = AppLink.parseOrigin(apiOrigin)
            ?: return@withContext PairReply.Refused("Set an HTTPS server origin under Feed first.")
        val body = JSONObject().put("tz", ZoneId.systemDefault().id).toString().toByteArray(Charsets.UTF_8)
        val connection = URL("$origin/pair").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            // Never follow a redirect with a fresh secret on the way back.
            connection.instanceFollowRedirects = false
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setFixedLengthStreamingMode(body.size)
            connection.outputStream.use { it.write(body) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { reader ->
                val all = StringBuilder()
                val buffer = CharArray(4096)
                while (true) {
                    val size = reader.read(buffer)
                    if (size < 0) break
                    all.append(buffer, 0, size)
                    if (all.length > 65_536) throw IOException("Server response was too large.")
                }
                all.toString()
            }
            parsePairReply(code, text)
        } finally {
            connection.disconnect()
        }
    }
}
