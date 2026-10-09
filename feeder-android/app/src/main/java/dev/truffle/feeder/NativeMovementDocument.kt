package dev.truffle.feeder

import org.json.JSONObject
import java.net.URI
import java.util.UUID

/** In-memory document binding. Only scope and movement fields may enter page events. */
class NativeMovementDocument(
    val webOrigin: String,
    private val apiOrigin: String,
    private val owner: TruffleCreds,
    val scope: String,
) {
    init { require(validNativeScope(scope)) }

    fun allows(url: String?, currentWebOrigin: String, currentApiOrigin: String, currentOwner: TruffleCreds?,
        currentScope: String?, foreground: Boolean, enabled: Boolean, permission: Boolean, bound: Boolean): Boolean =
        foreground && enabled && permission && bound && currentOwner == owner && currentWebOrigin == webOrigin &&
            currentApiOrigin == apiOrigin && currentScope == scope && isWorldDocument(url, webOrigin)

    fun sameOwner(web: String, api: String, creds: TruffleCreds?): Boolean =
        webOrigin == web && apiOrigin == api && owner == creds

    fun eventJson(event: AcceptedMovement, eventId: String): String = JSONObject()
        .put("version", 1).put("scope", scope).put("eventId", eventId).put("delta", event.delta)
        .put("observedAt", event.observedAt.toEpochMilli()).put("intervalMs", event.intervalMs).toString()

    fun eventScript(event: AcceptedMovement, eventId: String): String {
        // Quote the complete JSON string, then parse it. No credential or user
        // text is concatenated into executable JavaScript.
        val payload = JSONObject.quote(eventJson(event, eventId)).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
        val origin = JSONObject.quote(webOrigin)
        return "if(location.origin===$origin && location.pathname==='/' && !location.search && document.visibilityState==='visible'){" +
            "window.dispatchEvent(new CustomEvent('truffle:native-movement',{detail:JSON.parse($payload)}));}"
    }

    companion object {
        fun create(web: String, api: String, owner: TruffleCreds) = NativeMovementDocument(web, api, owner, UUID.randomUUID().toString())
    }
}

fun validNativeScope(scope: String): Boolean = Regex("[A-Za-z0-9_-]{16,128}").matches(scope)

fun isWorldDocument(url: String?, webOrigin: String): Boolean {
    if (!AppLink.isInsideWeb(url, webOrigin)) return false
    val uri = runCatching { URI(url) }.getOrNull() ?: return false
    return uri.rawPath in listOf("", "/") && uri.rawQuery == null
}
