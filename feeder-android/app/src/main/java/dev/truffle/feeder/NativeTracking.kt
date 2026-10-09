package dev.truffle.feeder

import android.Manifest
import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.provider.Settings
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import java.time.ZoneId

/** Serializes source transitions with the complete read/upload transaction. */
object FeedGate { val mutex = Mutex() }

object NativeTracking {
    fun available(context: Context): Boolean =
        (context.getSystemService(Context.SENSOR_SERVICE) as SensorManager).getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    fun permitted(context: Context): Boolean = Build.VERSION.SDK_INT < 29 ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

    suspend fun start(context: Context): String = FeedGate.mutex.withLock {
        require(available(context)) { "This phone has no hardware step counter. Health Connect is still available." }
        require(permitted(context)) { "Allow physical activity to count with this phone." }
        val settings = FeedSettings(context)
        require(settings.creds != null) { "Open your existing Truffle from the web first, so the app can confirm its credited steps." }
        val store = NativeWalkStore(context)
        val oldBaseline = store.baseline()
        val resume = canResumeNativeFeed(store.state(), oldBaseline, store.boundTo(settings), store.directSelected,
            Instant.now(), activeZone(settings.activeTz, ZoneId.systemDefault()))
        // Fence Health Connect immediately, even if the baseline request fails.
        if (!store.enabled) store.enable()
        val message = try {
            if (resume) "Phone counting resumed. Your saved steps and credited starting total are preserved."
            else {
                val snapshot = OwnerStateClient.read(settings)
                settings.saveActiveTz(snapshot.zone.id)
                store.confirm(snapshot, settings)
                "Direct walking is on. Only new phone steps are added to your Truffle's confirmed total."
            }
        } catch (_: java.io.IOException) {
            "Counting on this phone. Connect and tap Feed now to confirm a safe starting total; earlier local steps stay in your diary."
        } catch (error: Exception) {
            store.stop()
            throw error
        }
        try {
            ContextCompat.startForegroundService(context, Intent(context, StepCounterService::class.java))
            FeedSchedule.enable(context)
            store.status(message)
            message
        } catch (error: Exception) {
            store.stop()
            throw error
        }
    }

    suspend fun useHealthConnect(context: Context) = FeedGate.mutex.withLock { stop(context) }

    /** A task-manager stop or reboot requires a visible, explicit resume. */
    fun reconcileStop(context: Context) {
        val store = NativeWalkStore(context)
        if (!store.enabled) return
        val boot = runCatching { Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1).toLong() }.getOrDefault(-1)
        val userStopped = if (Build.VERSION.SDK_INT >= 30) runCatching {
            (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager)
                .getHistoricalProcessExitReasons(context.packageName, 0, 5)
                .any { it.timestamp > store.enabledAt && it.reason == ApplicationExitInfo.REASON_USER_REQUESTED }
        }.getOrDefault(false) else false
        if (userStopped || !permitted(context) || (store.sessionBoot >= 0 && boot != store.sessionBoot)) {
            store.pause()
            FeedSchedule.cancelMovement(context)
            store.status("Phone counting is paused after Android stopped it or permission changed. Tap Resume when you want to count again.")
            context.stopService(Intent(context, StepCounterService::class.java))
        }
    }

    fun stop(context: Context) {
        NativeWalkStore(context).stop()
        FeedSchedule.cancelMovement(context)
        context.stopService(Intent(context, StepCounterService::class.java))
    }

    /** Called with FeedGate held. An offline/new-day gap never invents credits. */
    suspend fun total(context: Context, envelope: DayEnvelope): Long {
        val store = NativeWalkStore(context)
        val settings = FeedSettings(context)
        require(store.enabled) { "Direct walking stopped. Read the selected source again." }
        require(permitted(context)) { "Physical activity permission was removed. Resume walking from Walk." }
        val now = Instant.now()
        val zone = ZoneId.of(envelope.dayTz)
        val baseline = store.baseline()
        val existing = if (baseline != null && store.boundTo(settings)) SensorAccumulator.feedTotal(store.state(), baseline, now, zone) else null
        if (existing != null) return existing
        val snapshot = OwnerStateClient.read(settings)
        settings.saveActiveTz(snapshot.zone.id)
        // Never attach an old-zone window to a new-zone total. The caller must reread.
        require(snapshot.zone.id == envelope.dayTz && snapshot.day == envelope.day) { "Truffle's day changed. Tap Feed now again." }
        return store.confirm(snapshot, settings).creditedTotal
    }
}
