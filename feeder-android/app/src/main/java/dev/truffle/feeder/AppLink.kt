package dev.truffle.feeder

import org.json.JSONObject
import java.net.URI
import java.util.Locale

/** The deployed Worker. The app pairs and feeds here unless settings say otherwise. */
const val DEFAULT_API_ORIGIN = "https://truffle.ahmed-abied.workers.dev"

/** The deployed web app. The World screen shows it. */
const val DEFAULT_WEB_ORIGIN = "https://truffle-web.ahmed-abied.workers.dev"

/** Appended to the WebView's default user agent so the page knows it runs inside the app. */
const val USER_AGENT_SUFFIX = " TruffleApp/0.3"

private val PHRASE = Regex("[a-z]+-[a-z]+-[a-z]+")
private val SECRET = Regex("[A-Za-z0-9_-]{16,64}")

/**
 * A pet's credentials. The phrase names it. The secret proves ownership.
 * toString never prints the secret, so a stray log line cannot leak it.
 */
data class TruffleCreds(val phrase: String, val secret: String) {
    /** The form used in `#creds=` and `truffle://pair?creds=`. */
    val packed: String get() = "$phrase.$secret"

    override fun toString(): String = "TruffleCreds($phrase, secret hidden)"

    companion object {
        /** Same formats as the Worker: three lowercase words, and a base64url secret of 16 to 64 characters. */
        fun of(phrase: String?, secret: String?): TruffleCreds? {
            val p = phrase?.trim()?.lowercase(Locale.ROOT) ?: return null
            val s = secret?.trim() ?: return null
            if (p.length > 100 || !PHRASE.matches(p) || !SECRET.matches(s)) return null
            return TruffleCreds(p, s)
        }

        /** Parses `<phrase>.<secret>`. Neither part may contain a dot. */
        fun unpack(packed: String?): TruffleCreds? {
            if (packed == null || packed.length > 200) return null
            val parts = packed.split('.')
            if (parts.size != 2) return null
            return of(parts[0], parts[1])
        }
    }
}

object AppLink {
    /**
     * Reads `truffle://pair?creds=<phrase>.<secret>`. Anything else returns null.
     * Takes the raw string so it can be tested without android.net.Uri.
     */
    fun parseDeepLink(link: String?): TruffleCreds? {
        if (link == null || link.length > 400) return null
        val uri = try { URI(link) } catch (_: Exception) { return null }
        if (!uri.scheme.equals("truffle", ignoreCase = true)) return null
        if (!uri.host.equals("pair", ignoreCase = true)) return null
        if (!uri.rawPath.isNullOrEmpty() && uri.rawPath != "/") return null
        if (uri.rawFragment != null || uri.rawUserInfo != null || uri.port != -1) return null
        val query = uri.rawQuery ?: return null
        val pairs = query.split('&')
        if (pairs.size != 1) return null
        val (key, value) = pairs[0].split('=', limit = 2).takeIf { it.size == 2 } ?: return null
        if (key != "creds") return null
        // Both formats are URL safe, so a valid value has nothing to decode.
        return TruffleCreds.unpack(value)
    }

    /**
     * An HTTPS origin with no path, query, fragment or user info. Trailing
     * slashes are dropped. Returns null when the text is not such an origin.
     */
    fun parseOrigin(text: String?): String? {
        val trimmed = text?.trim()?.trimEnd('/') ?: return null
        if (trimmed.isEmpty() || trimmed.length > 200) return null
        val uri = try { URI(trimmed) } catch (_: Exception) { return null }
        val ok = uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.rawUserInfo == null &&
            uri.rawQuery == null && uri.rawFragment == null && uri.rawPath.isNullOrEmpty() &&
            (uri.port == -1 || uri.port in 1..65535)
        return if (ok) "https://" + uri.host.lowercase(Locale.ROOT) + (if (uri.port == -1 || uri.port == 443) "" else ":${uri.port}") else null
    }

    /**
     * The World URL. Credentials ride only in the fragment, which the browser
     * never sends to a server. The page stores them and strips the fragment.
     */
    fun worldUrl(webOrigin: String, creds: TruffleCreds?): String =
        if (creds == null) "$webOrigin/" else "$webOrigin/#creds=${creds.packed}"

    /** True when the WebView may load this URL itself: HTTPS on exactly the web origin. */
    fun isInsideWeb(url: String?, webOrigin: String): Boolean {
        val uri = try { URI(url ?: return false) } catch (_: Exception) { return false }
        if (uri.scheme != "https" || uri.host == null || uri.rawUserInfo != null) return false
        val origin = "https://" + uri.host.lowercase(Locale.ROOT) + (if (uri.port == -1 || uri.port == 443) "" else ":${uri.port}")
        return origin == webOrigin
    }

    /** True for links worth handing to the browser. Other schemes are dropped. */
    fun isExternalWeb(url: String?): Boolean {
        val uri = try { URI(url ?: return false) } catch (_: Exception) { return false }
        return (uri.scheme == "https" || uri.scheme == "http") && !uri.host.isNullOrBlank()
    }
}

/** What the server said to `POST /pair`. Raw bodies never leave this parser. */
sealed class PairReply {
    data class Paired(val creds: TruffleCreds) : PairReply()
    data class Refused(val message: String) : PairReply()
}

const val PAIR_TROUBLE = "Could not make a truffle right now. Try again in a minute."

fun parsePairReply(code: Int, body: String?): PairReply {
    val json = try { if (body.isNullOrBlank()) null else JSONObject(body) } catch (_: Exception) { null }
    if (code in 200..299) {
        val creds = TruffleCreds.of(json?.opt("phrase") as? String, json?.opt("secret") as? String)
        return if (creds != null) PairReply.Paired(creds) else PairReply.Refused(PAIR_TROUBLE)
    }
    // A 429 carries a short calm line from the Worker. Anything else gets ours.
    val error = (json?.opt("error") as? String)
        ?.replace(Regex("[\\p{Cntrl}]+"), " ")?.replace(Regex("\\s+"), " ")?.trim()?.take(200)
    return PairReply.Refused(if (code == 429 && !error.isNullOrEmpty()) error else PAIR_TROUBLE)
}
