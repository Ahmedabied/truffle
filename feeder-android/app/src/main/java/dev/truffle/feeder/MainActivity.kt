package dev.truffle.feeder

import android.app.AlertDialog
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** One Activity, three screens behind a bottom bar: World, Walk, Feed. */
class MainActivity : ComponentActivity() {
    private enum class Tab(val label: String) { WORLD("World"), WALK("Walk"), FEED("Feed") }

    private lateinit var settings: FeedSettings
    private lateinit var health: HealthSteps
    private lateinit var world: WorldScreen
    private lateinit var walk: WalkScreen
    private lateinit var feed: FeedScreen
    private lateinit var palette: TrufflePalette
    private val tabs = mutableMapOf<Tab, TextView>()
    private var current = Tab.WORLD

    private val preferenceListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == "status" || key == "needs_permission") feed.renderStatus()
    }
    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { granted ->
        settings.setStatus(
            if (HealthSteps.READ_STEPS in granted) "Permission updated. Tap Feed now."
            else "Grant steps permission to feed Truffle.",
            needsPermission = HealthSteps.READ_STEPS !in granted,
        )
        lifecycleScope.launch { feed.refreshAccess() }
        if (current == Tab.WALK) walk.load()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // A debug build is debuggable. Keep the page and its stored secret closed to USB inspection.
        WebView.setWebContentsDebuggingEnabled(false)
        settings = FeedSettings(this)
        health = HealthSteps(this)
        palette = TrufflePalette.of(resources.configuration)
        world = WorldScreen(this, settings)
        walk = WalkScreen(this, health)
        feed = FeedScreen(this, settings, health)

        val frame = FrameLayout(this)
        for (screen in listOf(world.view, walk.view, feed.view)) {
            frame.addView(screen, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(palette.background)
        }
        val tall = (52 * resources.displayMetrics.density).toInt()
        for (tab in Tab.entries) {
            val item = TextView(this).apply {
                text = tab.label
                textSize = 16f
                gravity = Gravity.CENTER
                isClickable = true
                isFocusable = true
                contentDescription = "${tab.label} screen"
                setOnClickListener { show(tab) }
            }
            tabs[tab] = item
            bar.addView(item, LinearLayout.LayoutParams(0, tall, 1f))
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(palette.background)
            addView(frame, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        // Target 35+ is edge-to-edge. Keep every screen clear of bars and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(root)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (current == Tab.WORLD && world.goBack()) return
                if (current != Tab.WORLD) {
                    show(Tab.WORLD)
                    return
                }
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
                isEnabled = true
            }
        })

        val saved = savedInstanceState?.getString(TAB_KEY)?.let { name -> Tab.entries.firstOrNull { it.name == name } }
        show(saved ?: Tab.WORLD)
        if (savedInstanceState == null) handleLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleLink(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(TAB_KEY, current.name)
    }

    override fun onStart() {
        super.onStart()
        feederPreferences(this).registerOnSharedPreferenceChangeListener(preferenceListener)
    }

    override fun onResume() {
        super.onResume()
        world.onResume()
        feed.renderStatus()
        lifecycleScope.launch { feed.refreshAccess() }
        if (current == Tab.WALK) walk.load()
    }

    override fun onPause() {
        world.onPause()
        super.onPause()
    }

    override fun onStop() {
        feederPreferences(this).unregisterOnSharedPreferenceChangeListener(preferenceListener)
        super.onStop()
    }

    override fun onDestroy() {
        world.destroy()
        super.onDestroy()
    }

    private fun show(tab: Tab) {
        current = tab
        world.view.isVisible = tab == Tab.WORLD
        walk.view.isVisible = tab == Tab.WALK
        feed.view.isVisible = tab == Tab.FEED
        for ((t, item) in tabs) {
            val on = t == tab
            item.setTextColor(if (on) palette.accent else palette.ink)
            item.setTypeface(null, if (on) Typeface.BOLD else Typeface.NORMAL)
            item.isSelected = on
        }
        when (tab) {
            Tab.WORLD -> world.onShow()
            Tab.WALK -> walk.load()
            Tab.FEED -> feed.syncFields()
        }
    }

    /** `truffle://pair?creds=<phrase>.<secret>`. The link is dropped after one use. */
    private fun handleLink(intent: Intent?) {
        if (intent?.action != Intent.ACTION_VIEW || intent.data?.scheme != "truffle") return
        if (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) return
        val creds = AppLink.parseDeepLink(intent.dataString)
        // Forget the secret-bearing intent so recents or a restart cannot replay it.
        setIntent(Intent(this, MainActivity::class.java))
        if (creds == null) {
            Toast.makeText(this, "That truffle link is not valid.", Toast.LENGTH_LONG).show()
            return
        }
        val existing = settings.creds
        when {
            existing == creds -> show(Tab.WORLD)
            existing != null -> AlertDialog.Builder(this)
                .setTitle("Replace your truffle?")
                .setMessage("This phone holds ${existing.phrase}. The link brings ${creds.phrase}. Only replace it if you made that truffle yourself.")
                .setPositiveButton("Replace") { _, _ -> adopt(creds) }
                .setNegativeButton("Keep mine", null)
                .show()
            else -> AlertDialog.Builder(this)
                .setTitle("Open this truffle?")
                .setMessage("The link brings ${creds.phrase}. This phone will send your steps to it. Only open it if you made this truffle yourself.")
                .setPositiveButton("Open") { _, _ -> adopt(creds) }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    /** Store the credentials, point the feeder at them and show the world. */
    fun adopt(creds: TruffleCreds) {
        world.cancelPendingPair()
        settings.saveCreds(creds)
        settings.setStatus("Paired with ${creds.phrase}. Tap Feed now.")
        feed.syncFields()
        world.clearData()
        show(Tab.WORLD)
        lifecycleScope.launch { feed.refreshAccess() }
    }

    fun confirmOrigins(apiText: String, webText: String) {
        val api = AppLink.parseOrigin(apiText)
        val webOrigin = AppLink.parseOrigin(webText)
        if (api == null || webOrigin == null) {
            Toast.makeText(this, "Use HTTPS origins with no path, query or fragment.", Toast.LENGTH_LONG).show()
            return
        }
        val apiChanged = api != AppLink.parseOrigin(settings.server)
        val webChanged = webOrigin != settings.webOrigin
        val apply = {
            world.cancelPendingPair()
            if (apiChanged) FeedSchedule.disable(this)
            settings.saveOrigins(api, webOrigin)
            feed.syncFields()
            if (apiChanged || webChanged) world.clearData()
            lifecycleScope.launch { feed.refreshAccess() }
            Toast.makeText(this, "Settings saved.", Toast.LENGTH_SHORT).show()
        }
        when {
            apiChanged && settings.phrase.isNotBlank() -> AlertDialog.Builder(this)
                .setTitle("Change server and forget this pet?")
                .setMessage("The new server is $api. This phone will remove the current pet's key and stop feeding it. You can pair again on the new server.")
                .setPositiveButton("Change server") { _, _ -> apply() }
                .setNegativeButton("Cancel", null)
                .show()
            webChanged && settings.creds != null -> AlertDialog.Builder(this)
                .setTitle("Share this pet's key with this site?")
                .setMessage("$webOrigin will be able to read and control this pet. Continue only if you trust this site.")
                .setPositiveButton("Trust and save") { _, _ -> apply() }
                .setNegativeButton("Cancel", null)
                .show()
            else -> apply()
        }
    }

    fun confirmPair() {
        val typed = settings.phrase.trim()
        if (typed.isEmpty()) {
            world.pair()
            return
        }
        AlertDialog.Builder(this)
            .setTitle("Make a new truffle?")
            .setMessage("Feed now sends steps to $typed. A new truffle takes its place on this phone.")
            .setPositiveButton("Make it") { _, _ -> world.pair() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    fun confirmForget() {
        val creds = settings.creds ?: return
        AlertDialog.Builder(this)
            .setTitle("Forget this truffle?")
            .setMessage("${creds.phrase} stays on the server, but this phone loses its key. Without the key you cannot talk to it again.")
            .setPositiveButton("Forget") { _, _ ->
                settings.forget()
                FeedSchedule.disable(this)
                world.clearData()
                feed.syncFields()
                show(Tab.WORLD)
            }
            .setNegativeButton("Keep", null)
            .show()
    }

    fun requestHealthPermissions() {
        lifecycleScope.launch {
            try {
                val access = health.access()
                if (access.sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
                    feed.refreshAccess()
                    return@launch
                }
                // Distance rides along. A denial changes nothing for steps.
                val permissions = mutableSetOf(HealthSteps.READ_STEPS, HealthSteps.READ_DISTANCE)
                if (access.backgroundSupported) permissions += HealthSteps.READ_BACKGROUND
                permissionLauncher.launch(permissions)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: SecurityException) {
                // A revoked grant must not prevent the re-grant contract from opening.
                permissionLauncher.launch(setOf(HealthSteps.READ_STEPS, HealthSteps.READ_DISTANCE))
            } catch (_: Exception) {
                settings.setStatus("Could not open permissions. Use Health Connect settings.", needsPermission = true)
            }
        }
    }

    private companion object {
        const val TAB_KEY = "tab"
    }
}
