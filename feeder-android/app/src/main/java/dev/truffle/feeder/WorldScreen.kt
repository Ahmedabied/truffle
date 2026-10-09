package dev.truffle.feeder

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.graphics.Bitmap
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.JsResult
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * The deployed web world in a locked down WebView. Credentials reach the page
 * once per fresh load through the URL fragment, never a query, cookie or bridge.
 */
class WorldScreen(private val activity: MainActivity, private val prefs: FeedSettings) {
    private val root = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
    val view: View get() = root
    private val padding = (12 * activity.resources.displayMetrics.density).toInt()
    private val pairPanel = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(padding, padding, padding, padding)
    }
    private val pairStatus = TextView(activity).apply { textSize = 15f }
    private val make = Button(activity).apply { text = "make my truffle" }
    private var pageDialog: AlertDialog? = null
    private var web: WebView = newWebView()
    private var loaded = false
    private var loadedOrigin = ""
    private var pairGeneration = 0
    private var foreground = false
    private var foregroundSince: Instant? = null
    private var movementGeneration: String? = null
    private var document: NativeMovementDocument? = null
    private var pendingDocumentUrl: String? = null
    private var pageReady = false
    private var eventCounter = 0L
    private val movement = RecentMovement()
    private val movementListener: (AcceptedMovement) -> Unit = { sendMovement(it) }

    init {
        pairPanel.addView(TextView(activity).apply {
            text = "Open your existing Truffle from Chrome, or make a new one here. Your steps can feed it."
            textSize = 16f
        })
        pairPanel.addView(make)
        pairPanel.addView(pairStatus)
        pairStatus.accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        make.setOnClickListener { activity.confirmPair() }
        root.addView(pairPanel)
        root.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        renderPairing()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun newWebView(): WebView = WebView(activity).apply {
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(false)
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            userAgentString = userAgentString + USER_AGENT_SUFFIX
        }
        // A WebView without WebChromeClient silently returns false from JS
        // confirm(). Ownership imports require a real, deliberate confirmation.
        webChromeClient = object : WebChromeClient() {
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                if (!AppLink.isInsideWeb(url, prefs.webOrigin) || activity.isFinishing || activity.isDestroyed) {
                    result.cancel()
                    return true
                }
                pageDialog?.cancel()
                pageDialog = AlertDialog.Builder(activity)
                    .setTitle("Truffle · ${Uri.parse(prefs.webOrigin).host}")
                    .setMessage(message.take(1_000))
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .create().also { dialog ->
                        dialog.setOnDismissListener { if (pageDialog === dialog) pageDialog = null }
                        dialog.show()
                    }
                return true
            }
        }
        webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                if (view !== web) return
                pageReady = false
                movement.clear()
                if (url == pendingDocumentUrl && document != null) {
                    pendingDocumentUrl = null
                    return
                }
                // Browser reload, history or page navigation is a new document.
                // Re-enter through the existing owner import with a fresh nonce.
                invalidateDocument()
                if (isWorldDocument(url, prefs.webOrigin) && prefs.creds != null) reloadFresh()
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (view !== web || pendingDocumentUrl != null) return
                pageReady = document?.let {
                    it.sameOwner(prefs.webOrigin, prefs.server, prefs.creds) && isWorldDocument(url, it.webOrigin)
                } == true
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (AppLink.isInsideWeb(url, prefs.webOrigin)) return false
                // Anything else leaves the app. Only a tapped web link opens the browser.
                if (request.isForMainFrame && request.hasGesture() && AppLink.isExternalWeb(url)) openOutside(url)
                return true
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                replaceWebView()
                return true
            }
        }
    }

    private fun openOutside(url: String) {
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            // No browser. Stay in the world.
        }
    }

    private fun replaceWebView() {
        invalidateDocument()
        pageDialog?.cancel()
        pageDialog = null
        val index = root.indexOfChild(web)
        root.removeView(web)
        web.destroy()
        web = newWebView()
        root.addView(web, index, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        loaded = false
        ensureLoaded()
    }

    /** First show in this process: hand the credentials over in the fragment. */
    fun ensureLoaded() {
        // Pairing belongs to the native button. Never let an unpaired embedded
        // page silently create a second pet behind the native pairing panel.
        val owner = prefs.creds ?: return
        if (loaded) return
        loaded = true
        loadedOrigin = prefs.webOrigin
        val next = NativeMovementDocument.create(loadedOrigin, prefs.server, owner)
        document = next
        pageReady = false
        eventCounter = 0
        movement.clear()
        pendingDocumentUrl = AppLink.worldUrl(loadedOrigin, owner, next.scope)
        web.loadUrl(pendingDocumentUrl!!)
    }

    /** The tab became visible. A changed web origin in settings loads fresh. */
    fun onShow() {
        renderPairing()
        if (loaded && (loadedOrigin != prefs.webOrigin || document?.sameOwner(prefs.webOrigin, prefs.server, prefs.creds) == false))
            reloadFresh() else ensureLoaded()
    }

    /** New credentials or a new web origin: load fresh with the fragment. */
    fun reloadFresh() {
        invalidateDocument()
        web.stopLoading()
        loaded = false
        renderPairing()
        ensureLoaded()
    }

    fun refresh() {
        // A cancelled import has already stripped the hash. An explicit native
        // reload must offer the authoritative app-owned credentials again.
        reloadFresh()
    }

    /** Back stays inside the page while it has history. */
    fun goBack(): Boolean {
        if (!web.canGoBack()) return false
        invalidateDocument()
        web.goBack()
        return true
    }

    fun renderPairing() {
        pairPanel.isVisible = prefs.creds == null
        web.isVisible = prefs.creds != null
    }

    /** Called after the person confirmed. The secret goes straight to private storage. */
    fun pair() {
        val generation = ++pairGeneration
        val origin = prefs.server
        make.isEnabled = false
        pairStatus.text = "Making your truffle..."
        activity.lifecycleScope.launch {
            try {
                val reply = PairClient.pair(origin)
                // Importing, forgetting or changing origins invalidates an older reply.
                if (generation != pairGeneration || origin != prefs.server) return@launch
                when (reply) {
                    is PairReply.Paired -> {
                        pairStatus.text = ""
                        activity.adopt(reply.creds)
                    }
                    is PairReply.Refused -> pairStatus.text = reply.message
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                if (generation == pairGeneration) pairStatus.text = "Could not reach the server. Check your connection and try again."
            } finally {
                if (generation == pairGeneration) make.isEnabled = true
            }
        }
    }

    fun cancelPendingPair() {
        pairGeneration++
        make.isEnabled = true
        pairStatus.text = ""
    }

    /** Forget: the page's stored credentials go too, then the plain world loads. */
    fun clearData() {
        invalidateDocument()
        cancelPendingPair()
        // Stop the old document before clearing its storage so it cannot write
        // old credentials back while the new pet is loading.
        pageDialog?.cancel()
        pageDialog = null
        web.stopLoading()
        root.removeView(web)
        web.destroy()
        WebStorage.getInstance().deleteAllData()
        CookieManager.getInstance().removeAllCookies(null)
        web = newWebView()
        web.clearCache(true)
        root.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        reloadFresh()
    }

    private fun invalidateDocument() {
        pageReady = false
        pendingDocumentUrl = null
        document = null
        movement.clear()
    }

    private fun sendMovement(accepted: AcceptedMovement) {
        val current = document ?: return
        val store = NativeWalkStore(activity)
        if (!pageReady || !current.allows(web.url, prefs.webOrigin, prefs.server, prefs.creds,
                document?.scope, foreground && root.isVisible && web.isVisible, store.enabled,
                NativeTracking.permitted(activity), store.boundTo(prefs))) {
            movement.clear()
            return
        }
        val since = foregroundSince ?: return
        if (movementGeneration != store.sourceGeneration) {
            movement.clear()
            movementGeneration = store.sourceGeneration
        }
        val pulse = movement.accept(accepted, Instant.now(), since) ?: return
        // This runs on the sensor/main looper. There is no deferred event queue.
        // The page independently checks this nonce after its owner import verifies.
        web.evaluateJavascript(current.eventScript(pulse, "${current.scope}-${++eventCounter}"), null)
    }

    fun onResume() {
        if (!foreground) foregroundSince = Instant.now()
        foreground = true
        NativeMovementEvents.listen(movementListener)
        web.onResume()
    }
    fun onPause() {
        foreground = false
        foregroundSince = null
        movementGeneration = null
        movement.clear()
        NativeMovementEvents.remove(movementListener)
        web.onPause()
    }
    fun destroy() {
        onPause()
        invalidateDocument()
        pageDialog?.cancel(); pageDialog = null; web.destroy()
    }
}
