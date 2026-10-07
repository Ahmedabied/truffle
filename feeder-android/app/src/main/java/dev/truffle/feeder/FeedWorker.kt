package dev.truffle.feeder

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import java.io.IOException
import java.util.concurrent.TimeUnit

class FeedWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val settings = FeedSettings(applicationContext)
        return try {
            settings.setStatus(FeedSender(applicationContext).feed(background = true))
            Result.success()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (missing: GrantPermissionException) {
            settings.setStatus(missing.message.orEmpty(), needsPermission = true)
            Result.failure()
        } catch (_: SecurityException) {
            settings.setStatus("Grant steps permission. Health Connect access was revoked.", needsPermission = true)
            Result.failure()
        } catch (unavailable: HealthUnavailableException) {
            settings.setStatus(unavailable.message.orEmpty())
            Result.failure()
        } catch (http: FeedHttpException) {
            settings.setStatus(http.message.orEmpty())
            if (http.retryable) Result.retry() else Result.failure()
        } catch (_: IOException) {
            settings.setStatus("Upload failed. Check your connection. Hourly sync will retry.")
            Result.retry()
        } catch (invalid: IllegalArgumentException) {
            settings.setStatus(invalid.message ?: "Check the pairing phrase and server URL.")
            Result.failure()
        } catch (_: Exception) {
            settings.setStatus("Sync failed. Open Truffle Feeder and try Feed now.")
            Result.failure()
        }
    }
}

object FeedSchedule {
    private const val NAME = "truffle-hourly-feed"

    fun enable(context: Context) {
        // A CONNECTED constraint requires ACCESS_NETWORK_STATE on target 34+.
        // S02 forbids that extra permission. HTTP failures retry with fresh steps.
        // Do not add a network constraint without revisiting the permission policy.
        val request = PeriodicWorkRequestBuilder<FeedWorker>(1, TimeUnit.HOURS)
            .setInitialDelay(1, TimeUnit.HOURS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun disable(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(NAME)
    }
}
