package dev.truffle.feeder

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import java.io.IOException
import java.util.concurrent.TimeUnit

class FeedWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val settings = FeedSettings(applicationContext)
        val retryRun = inputData.getBoolean(FeedSchedule.RETRY_RUN, false)
        return try {
            // A one-time retry may fire while the app is still open, so it may read
            // in the foreground. The hourly run always uses the background grant.
            val run = FeedSender(applicationContext).feed(background = !retryRun, isRetryRun = retryRun)
            settings.setStatus(run.status)
            run.retryAfterSeconds?.let { FeedSchedule.retryOnce(applicationContext, it) }
            Result.success()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (missing: GrantPermissionException) {
            settings.setStatus(missing.message.orEmpty(), needsPermission = true)
            Result.failure()
        } catch (_: SecurityException) {
            if (retryRun) settings.setStatus("Open Truffle Feeder and tap Feed now to finish this sync.")
            else settings.setStatus("Grant steps permission. Health Connect access was revoked.", needsPermission = true)
            Result.failure()
        } catch (unavailable: HealthUnavailableException) {
            settings.setStatus(unavailable.message.orEmpty())
            Result.failure()
        } catch (http: FeedHttpException) {
            settings.setStatus(http.message.orEmpty())
            if (http.retryable && !retryRun) Result.retry() else Result.failure()
        } catch (_: IOException) {
            settings.setStatus("Upload failed. Check your connection. Hourly sync will retry.")
            if (retryRun) Result.failure() else Result.retry()
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
    private const val RETRY_NAME = "truffle-retry-feed"
    const val RETRY_RUN = "retry_run"

    /** One retry after the Worker's retry_after_s. A newer request replaces an older one. */
    fun retryOnce(context: Context, seconds: Long) {
        val request = OneTimeWorkRequestBuilder<FeedWorker>()
            .setInitialDelay(seconds.coerceIn(1L, MAX_RETRY_SECONDS), TimeUnit.SECONDS)
            .setInputData(workDataOf(RETRY_RUN to true))
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(RETRY_NAME, ExistingWorkPolicy.REPLACE, request)
    }

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
        WorkManager.getInstance(context).cancelUniqueWork(RETRY_NAME)
    }
}
