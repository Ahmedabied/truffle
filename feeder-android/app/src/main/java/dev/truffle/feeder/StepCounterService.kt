package dev.truffle.feeder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.provider.Settings
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancel
import kotlinx.coroutines.sync.withLock

/** Opt-in hardware counting only. No location or raw accelerometer sampling. */
class StepCounterService : Service(), SensorEventListener {
    private lateinit var sensors: SensorManager
    private lateinit var store: NativeWalkStore
    private var listening = false
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        sensors = getSystemService(SENSOR_SERVICE) as SensorManager
        store = NativeWalkStore(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP) {
            scope.launch {
                FeedGate.mutex.withLock {
                    store.pause()
                    FeedSchedule.cancelMovement(this@StepCounterService)
                    store.status("Phone counting is paused. Resume in Walk, or choose Health Connect there.")
                    stopSelf()
                }
            }
            return START_NOT_STICKY
        }
        if (!store.enabled || !NativeTracking.permitted(this)) {
            if (store.enabled) store.pause()
            stopSelf()
            return START_NOT_STICKY
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Phone step counting", NotificationManager.IMPORTANCE_LOW).apply {
            description = "A silent notice while you choose to count walks directly."
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        })
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 1, Intent(this, StepCounterService::class.java).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_truffle)
            .setContentTitle("Truffle is counting with this phone")
            .setContentText("Quietly saving new steps. Tap Pause whenever you like.")
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE).setVisibility(Notification.VISIBILITY_PRIVATE)
            .addAction(Notification.Action.Builder(null, "Pause", stop).build()).build()
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
            else startForeground(NOTIFICATION, notification)
        } catch (_: RuntimeException) {
            store.pause()
            store.status("Android could not start counting. Check physical activity permission and resume from Walk.")
            stopSelf()
            return START_NOT_STICKY
        }
        val boot = runCatching { Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, -1).toLong() }.getOrDefault(-1)
        if (boot < 0) { store.pause(); store.status("Android could not identify this counter session. Use Health Connect for now."); stopSelf(); return START_NOT_STICKY }
        store.sessionBoot(boot)
        if (!listening) {
            val counter = sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            try {
                listening = counter != null && sensors.registerListener(this, counter, SensorManager.SENSOR_DELAY_NORMAL)
            } catch (_: SecurityException) { listening = false }
            if (!listening) {
                store.pause()
                store.status("The step counter is unavailable. Check physical activity permission or use Health Connect.")
                stopSelf()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!store.enabled || !NativeTracking.permitted(this)) { if (store.enabled) store.pause(); stopSelf(); return }
        val raw = event.values.firstOrNull()?.let(SensorAccumulator::counterValue) ?: return
        val nowElapsed = SystemClock.elapsedRealtime()
        // SensorEvent timestamp shares elapsedRealtime's timebase. Batching cannot
        // move yesterday's observation into today's diary at callback delivery.
        val eventElapsed = event.timestamp / 1_000_000
        val at = counterRecordedAt(eventElapsed, nowElapsed, Instant.now(), store.state().baseline == null) ?: return
        val boot = runCatching { Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, -1).toLong() }.getOrDefault(-1)
        if (boot < 0) { store.status("Android could not identify this counter session. Pause and use Health Connect."); store.pause(); stopSelf(); return }
        val settings = FeedSettings(this)
        val zone = activeZone(settings.activeTz, ZoneId.systemDefault())
        val accepted = store.observe(SensorCounterSample(raw, eventElapsed, at, boot), zone) ?: return
        if (settings.creds != null && store.boundTo(settings)) {
            NativeMovementEvents.publish(accepted)
            FeedSchedule.afterMovement(this)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    override fun onDestroy() {
        if (listening) sensors.unregisterListener(this)
        scope.cancel()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val CHANNEL = "truffle-phone-walks"
        const val NOTIFICATION = 31
        private const val STOP = "dev.truffle.feeder.PAUSE_WALKING"
    }
}
