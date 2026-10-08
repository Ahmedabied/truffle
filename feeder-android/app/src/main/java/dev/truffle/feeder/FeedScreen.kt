package dev.truffle.feeder

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.health.connect.client.HealthConnectClient
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.io.IOException

/**
 * The feeder from 0.1, unchanged in behaviour. The phrase comes from the app's
 * credentials and is read-only while the app owns the pet.
 */
class FeedScreen(private val activity: MainActivity, private val settings: FeedSettings, private val health: HealthSteps) {
    private val palette = TrufflePalette.of(activity.resources.configuration)
    private val content = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
    val view: View = ScrollView(activity).apply { setBackgroundColor(palette.background); addView(content) }
    private val padding = (20 * activity.resources.displayMetrics.density).toInt()
    private val phrase: EditText
    private val phraseNote: TextView
    private val server: EditText
    private val web: EditText
    private val status: TextView
    private val availability: TextView
    private val grant: Button
    private val provider: Button
    private val feed: Button
    private val forget: Button
    private var syncing = false

    init {
        content.setPadding(padding, padding, padding, padding)
        NotebookStyle.heading(label("Care & feeding", 28f))
        label("A small offering from your day. Your walking source lives in the Walk tab.")
        val phraseLabel = label("Pairing phrase")
        phrase = EditText(activity).apply {
            id = R.id.pairing_phrase
            hint = "sand-moon-fig"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            setSingleLine(true)
            content.addView(this)
        }
        phraseLabel.labelFor = phrase.id
        phraseNote = label("This phone owns this truffle. The phrase is set by the app.", 14f)
        feed = Button(activity).apply {
            text = "Feed now"
            NotebookStyle.button(this, true)
            setOnClickListener { feedNow() }
            content.addView(this)
        }
        grant = Button(activity).apply {
            text = "Grant steps permission"
            backgroundTintList = ColorStateList.valueOf(Color.rgb(179, 38, 30))
            setTextColor(Color.WHITE)
            isVisible = false
            setOnClickListener { activity.requestHealthPermissions() }
            content.addView(this)
        }
        provider = Button(activity).apply {
            text = "Install or update Health Connect"
            isVisible = false
            setOnClickListener { openProvider() }
            content.addView(this)
        }
        content.addView(Button(activity).apply {
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

        val advanced = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; isVisible = false }
        content.addView(Button(activity).apply {
            text = "Connection & privacy settings"
            NotebookStyle.button(this)
            setOnClickListener { advanced.isVisible = !advanced.isVisible }
        })
        val advancedStart = content.childCount
        label("Connection", 20f)
        val serverLabel = label("Server URL (API origin)")
        server = EditText(activity).apply {
            id = R.id.server_url
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
            content.addView(this)
        }
        serverLabel.labelFor = server.id
        val webLabel = label("Web origin (World screen)")
        web = EditText(activity).apply {
            id = R.id.web_origin
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
            content.addView(this)
        }
        webLabel.labelFor = web.id
        content.addView(Button(activity).apply {
            text = "Save server settings"
            setOnClickListener { activity.confirmOrigins(server.text.toString(), web.text.toString()) }
        })
        label("Location stays off. Truffle can use a city-level estimate from your connection.", 14f)
        content.addView(Button(activity).apply {
            text = "Privacy and permissions"
            setOnClickListener { activity.startActivity(Intent(activity, PermissionsRationaleActivity::class.java)) }
        })
        forget = Button(activity).apply {
            text = "Forget this truffle"
            setOnClickListener { activity.confirmForget() }
            content.addView(this)
        }
        val detailViews = (advancedStart until content.childCount).map(content::getChildAt)
        detailViews.forEach { content.removeView(it); advanced.addView(it) }
        content.addView(advanced)
        syncFields()
        phrase.doAfterTextChanged { saveInputs() }
    }

    private fun label(text: String, size: Float = 16f): TextView = TextView(activity).apply {
        this.text = text
        setTextColor(palette.ink)
        textSize = size
        setPadding(0, padding / 2, 0, padding / 2)
        content.addView(this)
    }

    /** Reload the fields after pairing or forgetting, without echoing them back. */
    fun syncFields() {
        syncing = true
        val owned = settings.creds != null
        phrase.setText(settings.phrase)
        phrase.isEnabled = !owned
        phraseNote.isVisible = owned
        forget.isVisible = owned
        server.setText(settings.server)
        web.setText(settings.webOriginText)
        syncing = false
    }

    private fun saveInputs() {
        if (syncing) return
        if (phrase.text.toString().trim().lowercase() != settings.phrase.trim().lowercase()) NativeTracking.stop(activity)
        settings.saveInputs(phrase.text.toString(), settings.server)
    }

    fun renderStatus() {
        status.text = settings.status
        status.setTextColor(if (settings.needsPermission) Color.rgb(179, 38, 30) else palette.ink)
        if (settings.needsPermission) grant.isVisible = true
    }

    suspend fun refreshAccess() {
        val native = NativeWalkStore(activity)
        if (native.directSelected) {
            grant.isVisible = false
            provider.isVisible = false
            availability.text = if (native.paused) "Phone counting is paused. Resume in Walk, or choose Health Connect."
                else "Phone counter selected. New steps sync about hourly; Android may delay uploads. Feed now sends the latest safe total."
            if (native.enabled && runCatching { settings.config() }.isSuccess) FeedSchedule.enable(activity)
            else FeedSchedule.disable(activity)
            return
        }
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
                !paired -> "Make a truffle on the World screen, or enter a valid phrase and server URL."
                else -> "Hourly sync enabled. Android may delay it. Offline uploads retry."
            }
            if (paired && access.canSync) FeedSchedule.enable(activity) else FeedSchedule.disable(activity)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: SecurityException) {
            permissionLost()
        } catch (_: Exception) {
            availability.text = "Could not check Health Connect. Open its settings, then try again."
        }
    }

    private fun permissionLost() {
        settings.setStatus("Grant steps permission. Health Connect access was revoked.", needsPermission = true)
        grant.isVisible = true
        FeedSchedule.disable(activity)
    }

    private fun feedNow() {
        saveInputs()
        feed.isEnabled = false
        activity.lifecycleScope.launch {
            try {
                settings.setStatus("Reading today's steps...")
                val run = FeedSender(activity).feed(background = false)
                settings.setStatus(run.status)
                run.retryAfterSeconds?.let { FeedSchedule.retryOnce(activity, it) }
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
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: ActivityNotFoundException) {
            openIntent(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=${HealthSteps.PROVIDER_PACKAGE}")))
        }
    }

    fun openIntent(intent: Intent) {
        try {
            activity.startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            settings.setStatus("Open Health Connect from Android Settings, or install it from Google Play.")
        }
    }
}
