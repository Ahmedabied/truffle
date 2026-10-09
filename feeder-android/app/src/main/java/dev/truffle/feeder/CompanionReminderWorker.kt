package dev.truffle.feeder

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import java.util.concurrent.TimeUnit

class CompanionReminderWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = gate.withLock {
        NativeTracking.reconcileStop(applicationContext)
        val store = NativeWalkStore(applicationContext)
        val settings = FeedSettings(applicationContext)
        if (!store.reminders || settings.creds == null || store.paused || !notificationsAllowed(applicationContext)) return@withLock Result.success()
        try {
            val owner = settings.creds
            val server = settings.server
            val generation = store.sourceGeneration
            val direct = store.enabled
            if (!sourceAllowed(store, direct)) return@withLock Result.success()
            val snapshot = OwnerStateClient.read(settings)
            val observedAt = Instant.now()
            // HC supplies no immediate hardware event. A fresh last-hour read
            // conservatively suppresses a note when any selected-source steps exist.
            val healthMoved = !direct && HealthSteps(applicationContext).readWindow(
                DayWindow(observedAt.minusSeconds(3_600), observedAt, snapshot.zone), background = true) > 0
            val manager = applicationContext.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Quiet companion notes", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Optional, at most one daytime note. Never a sound or vibration."
                setSound(null, null); enableVibration(false); setShowBadge(false)
            })
            val open = PendingIntent.getActivity(applicationContext, 2, Intent(applicationContext, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val notification = Notification.Builder(applicationContext, CHANNEL)
                .setSmallIcon(R.drawable.ic_truffle).setContentTitle("A little fresh air?")
                .setContentText("If a gentle wander fits your day, Truffle can keep you company. Rest is welcome too.")
                .setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PRIVATE).build()
            // Source changes serialize with the final recheck and claim. Network
            // reads above do not hold up a manual feed or a source switch.
            FeedGate.mutex.withLock post@ {
                if (owner != settings.creds || server != settings.server || generation != store.sourceGeneration ||
                    direct != store.enabled || !sourceAllowed(store, direct)) return@post
                val now = Instant.now()
                val lastActive = listOfNotNull(store.lastActive, store.lastMovementAt,
                    observedAt.takeIf { healthMoved }).maxOrNull()
                val decision = ReminderPolicy.evaluate(ReminderContext(
                    now, snapshot.zone, optedIn = store.reminders,
                    notificationsAllowed = notificationsAllowed(applicationContext),
                    activityPermission = true, trackingEnabled = true,
                    alive = !snapshot.dead, wellFed = snapshot.wellFed,
                    heatProtected = snapshot.burrowed,
                    weather = snapshot.weatherAt?.let { ReminderWeather(it, snapshot.weatherSafe) },
                    lastActiveAt = lastActive,
                    lastNudge = store.lastNudge?.let { ReminderStamp(it.atZone(snapshot.zone).toLocalDate().toString(), it) },
                ))
                if (decision != ReminderDecision.ALLOW) return@post
                // Claim before posting. A crash may skip a note but cannot duplicate it.
                if (store.nudged(now)) manager.notify(32, notification)
            }
            Result.success()
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { Result.success() } // No retry/escalation of a missed nudge.
    }

    private suspend fun sourceAllowed(store: NativeWalkStore, direct: Boolean): Boolean {
        if (direct && !store.boundTo(FeedSettings(applicationContext))) return false
        val health = if (!direct && !store.paused) HealthSteps(applicationContext).access() else null
        return reminderSourceAllowed(direct, store.paused, NativeTracking.permitted(applicationContext),
            health?.stepsGranted == true, health?.backgroundSupported == true, health?.backgroundGranted == true)
    }

    companion object {
        private val gate = Mutex()
        private const val NAME = "truffle-quiet-notes"
        private const val CHANNEL = "truffle-quiet-notes"
        fun notificationsAllowed(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled() &&
            (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
        fun schedule(context: Context, enabled: Boolean) {
            val work = WorkManager.getInstance(context)
            if (!enabled) { work.cancelUniqueWork(NAME); return }
            val request = PeriodicWorkRequestBuilder<CompanionReminderWorker>(1, TimeUnit.HOURS)
                .setInitialDelay(1, TimeUnit.HOURS).build()
            work.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}
