package dev.truffle.feeder

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
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
        if (prefs.creds == null) return
        if (loaded) return
        loaded = true
        loadedOrigin = prefs.webOrigin
        web.loadUrl(AppLink.worldUrl(loadedOrigin, prefs.creds))
    }

    /** The tab became visible. A changed web origin in settings loads fresh. */
    fun onShow() {
        renderPairing()
        if (loaded && loadedOrigin != prefs.webOrigin) reloadFresh() else ensureLoaded()
    }

    /** New credentials or a new web origin: load fresh with the fragment. */
    fun reloadFresh() {
        loaded = false
        renderPairing()
        ensureLoaded()
    }

    fun refresh() {
        if (!loaded) ensureLoaded() else web.reload()
    }

    /** Back stays inside the page while it has history. */
    fun goBack(): Boolean {
        if (!web.canGoBack()) return false
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

    fun onResume() = web.onResume()
    fun onPause() = web.onPause()
    fun destroy() { pageDialog?.cancel(); pageDialog = null; web.destroy() }
}
