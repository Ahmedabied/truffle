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
        if (!store.reminders || !store.enabled || !NativeTracking.permitted(applicationContext) || !notificationsAllowed(applicationContext)) return@withLock Result.success()
        try {
            val snapshot = OwnerStateClient.read(FeedSettings(applicationContext))
            val now = Instant.now()
            val lastMove = store.state().baseline?.recordedAt
            val lastActive = listOfNotNull(store.lastActive, lastMove).maxOrNull()
            val decision = ReminderPolicy.evaluate(ReminderContext(
                now, snapshot.zone, optedIn = store.reminders,
                notificationsAllowed = notificationsAllowed(applicationContext),
                activityPermission = NativeTracking.permitted(applicationContext), trackingEnabled = store.enabled,
                alive = !snapshot.dead, wellFed = snapshot.energyPercent >= 50 || snapshot.steps >= 3_000,
                heatProtected = snapshot.burrowed,
                weather = snapshot.weatherAt?.let { ReminderWeather(it, snapshot.weatherSafe) },
                lastActiveAt = lastActive,
                lastNudge = store.lastNudge?.let { ReminderStamp(it.atZone(snapshot.zone).toLocalDate().toString(), it) },
            ))
            if (decision != ReminderDecision.ALLOW) return@withLock Result.success()
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
            // Claim before posting. A crash may skip a note but can never duplicate it.
            store.nudged(now)
            manager.notify(32, notification)
            Result.success()
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { Result.success() } // No retry/escalation of a missed nudge.
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
