package dev.truffle.feeder

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.io.IOException

class MainActivity : ComponentActivity() {
    private lateinit var settings: FeedSettings
    private lateinit var health: HealthSteps
    private lateinit var phrase: EditText
    private lateinit var server: EditText
    private lateinit var status: TextView
    private lateinit var availability: TextView
    private lateinit var grant: Button
    private lateinit var provider: Button
    private lateinit var feed: Button

    private val preferenceListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == "status" || key == "needs_permission") renderStatus()
    }
    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { granted ->
        settings.setStatus(
            if (HealthSteps.READ_STEPS in granted) "Permission updated. Tap Feed now."
            else "Grant steps permission to feed Truffle.",
            needsPermission = HealthSteps.READ_STEPS !in granted,
        )
        lifecycleScope.launch { refreshAccess() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = FeedSettings(this)
        health = HealthSteps(this)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val padding = (20 * resources.displayMetrics.density).toInt()
        content.setPadding(padding, padding, padding, padding)
        val scroll = ScrollView(this).apply { addView(content) }
        // Target 35 is edge-to-edge. Keep the form clear of bars and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(scroll)

        fun label(text: String, size: Float = 16f): TextView = TextView(this).apply {
            this.text = text
            textSize = size
            setPadding(0, padding / 2, 0, padding / 2)
            content.addView(this)
        }
        label("Truffle Feeder", 28f)
        label("Today's steps feed your Truffle. No raw health records leave this phone.")
        val phraseLabel = label("Pairing phrase")
        phrase = EditText(this).apply {
            id = R.id.pairing_phrase
            hint = "sand-moon-fig"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            setSingleLine(true)
            setText(settings.phrase)
            content.addView(this)
        }
        phraseLabel.labelFor = phrase.id
        val serverLabel = label("Server URL")
        server = EditText(this).apply {
            id = R.id.server_url
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
            setText(settings.server)
            content.addView(this)
        }
        serverLabel.labelFor = server.id
        phrase.doAfterTextChanged { saveInputs() }
        server.doAfterTextChanged { saveInputs() }
        content.addView(Switch(this).apply {
            text = "Share coarse location (TODO)"
            isChecked = false
            isEnabled = false
        })
        label("Location stays off. Truffle can use a city-level estimate from your connection.", 14f)
        feed = Button(this).apply {
            text = "Feed now"
            setOnClickListener { feedNow() }
            content.addView(this)
        }
        grant = Button(this).apply {
            text = "Grant steps permission"
            backgroundTintList = ColorStateList.valueOf(Color.rgb(179, 38, 30))
            setTextColor(Color.WHITE)
            isVisible = false
            setOnClickListener { requestPermissions() }
            content.addView(this)
        }
        provider = Button(this).apply {
            text = "Install or update Health Connect"
            isVisible = false
            setOnClickListener { openProvider() }
            content.addView(this)
        }
        content.addView(Button(this).apply {
            text = "Health Connect settings"
            setOnClickListener {
                val action = if (Build.VERSION.SDK_INT >= 34) "android.health.connect.action.HEALTH_HOME_SETTINGS"
                else "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"
                openIntent(Intent(action))
            }
        })
        status = label(settings.status)
        status.accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        availability = label("Checking Health Connect...", 14f)
        content.addView(Button(this).apply {
            text = "Privacy and permissions"
            setOnClickListener { startActivity(Intent(this@MainActivity, PermissionsRationaleActivity::class.java)) }
        })
    }

    override fun onStart() {
        super.onStart()
        settings.preferences.registerOnSharedPreferenceChangeListener(preferenceListener)
    }

    override fun onResume() {
        super.onResume()
        renderStatus()
        lifecycleScope.launch { refreshAccess() }
    }

    override fun onStop() {
        settings.preferences.unregisterOnSharedPreferenceChangeListener(preferenceListener)
        super.onStop()
    }

    private fun saveInputs() {
        settings.saveInputs(phrase.text.toString(), server.text.toString())
    }

    private fun renderStatus() {
        status.text = settings.status
        status.setTextColor(if (settings.needsPermission) Color.rgb(179, 38, 30) else Color.DKGRAY)
        if (settings.needsPermission) grant.isVisible = true
    }

    private suspend fun refreshAccess() {
        try {
            val access = health.access()
            provider.isVisible = access.sdkStatus == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
            grant.isVisible = access.sdkStatus == HealthConnectClient.SDK_AVAILABLE &&
                (!access.stepsGranted || (access.backgroundSupported && !access.backgroundGranted) || settings.needsPermission)
            val paired = runCatching { settings.config() }.isSuccess
            availability.text = when {
                access.sdkStatus == HealthConnectClient.SDK_UNAVAILABLE -> "Health Connect is unavailable on this device."
                provider.isVisible -> "Install or update Health Connect to read steps."
                !access.stepsGranted -> "Grant steps permission. No steps have been read."
                !access.backgroundSupported -> "Foreground only. Background reads are unavailable on this device."
                !access.backgroundGranted -> "Feed now is ready. Grant background read access for hourly sync."
                !paired -> "Enter a valid phrase and server URL to enable hourly sync."
                else -> "Hourly sync enabled. Android may delay it. Offline uploads retry."
            }
            if (paired && access.canSync) FeedSchedule.enable(this) else FeedSchedule.disable(this)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: SecurityException) {
            permissionLost()
        } catch (_: Exception) {
            availability.text = "Could not check Health Connect. Open its settings, then try again."
        }
    }

    private fun requestPermissions() {
        saveInputs()
        lifecycleScope.launch {
            try {
                val access = health.access()
                if (access.sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
                    refreshAccess()
                    return@launch
                }
                val permissions = mutableSetOf(HealthSteps.READ_STEPS)
                if (access.backgroundSupported) permissions += HealthSteps.READ_BACKGROUND
                permissionLauncher.launch(permissions)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: SecurityException) {
                // A revoked grant must not prevent the re-grant contract from opening.
                permissionLauncher.launch(setOf(HealthSteps.READ_STEPS))
            } catch (_: Exception) {
                settings.setStatus("Could not open permissions. Use Health Connect settings.", needsPermission = true)
            }
        }
    }

    private fun permissionLost() {
        settings.setStatus("Grant steps permission. Health Connect access was revoked.", needsPermission = true)
        grant.isVisible = true
        FeedSchedule.disable(this)
    }

    private fun feedNow() {
        saveInputs()
        feed.isEnabled = false
        lifecycleScope.launch {
            try {
                settings.setStatus("Reading today's steps...")
                settings.setStatus(FeedSender(this@MainActivity).feed(background = false))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (missing: GrantPermissionException) {
                settings.setStatus(missing.message.orEmpty(), needsPermission = true)
            } catch (_: SecurityException) {
                permissionLost()
            } catch (unavailable: HealthUnavailableException) {
                settings.setStatus(unavailable.message.orEmpty())
            } catch (http: FeedHttpException) {
                settings.setStatus(http.message.orEmpty())
            } catch (_: IOException) {
                settings.setStatus("Upload failed. Check your connection and try Feed now again.")
            } catch (invalid: IllegalArgumentException) {
                settings.setStatus(invalid.message ?: "Check the phrase and server URL.")
            } catch (_: Exception) {
                settings.setStatus("Feed failed. Check Health Connect and the server response.")
            } finally {
                feed.isEnabled = true
            }
            refreshAccess()
        }
    }

    private fun openProvider() {
        val url = "market://details?id=${HealthSteps.PROVIDER_PACKAGE}&url=healthconnect%3A%2F%2Fonboarding"
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: ActivityNotFoundException) {
            openIntent(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=${HealthSteps.PROVIDER_PACKAGE}")))
        }
    }

    private fun openIntent(intent: Intent) {
        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            settings.setStatus("Open Health Connect from Android Settings, or install it from Google Play.")
        }
    }
}
