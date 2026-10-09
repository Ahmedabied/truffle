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
import java.time.Instant
import java.util.concurrent.TimeUnit

class FeedWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val settings = FeedSettings(applicationContext)
        val retryRun = inputData.getBoolean(FeedSchedule.RETRY_RUN, false)
        val movementGeneration = inputData.getString(FeedSchedule.MOVEMENT_GENERATION)
        if (movementGeneration != null) {
            val store = NativeWalkStore(applicationContext)
            if (!nativeMovementFeedAllowed(movementGeneration, store.sourceGeneration, store.boundTo(settings),
                    store.enabled, NativeTracking.permitted(applicationContext))) return Result.success()
        }
        return try {
            // A one-time retry may fire while the app is still open, so it may read
            // in the foreground. The hourly run always uses the background grant.
            val run = FeedSender(applicationContext).feed(background = !retryRun, isRetryRun = retryRun,
                expectedNativeGeneration = movementGeneration)
            settings.setStatus(run.status)
            run.retryAfterSeconds?.let { FeedSchedule.retryOnce(applicationContext, it, movementGeneration) }
            Result.success()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (missing: GrantPermissionException) {
            settings.setStatus(missing.message.orEmpty(), needsPermission = true)
            Result.failure()
        } catch (_: SecurityException) {
            if (retryRun) settings.setStatus("Open Truffle and tap Feed now to finish this sync.")
            else settings.setStatus("Grant steps permission. Health Connect access was revoked.", needsPermission = true)
            Result.failure()
        } catch (unavailable: HealthUnavailableException) {
            settings.setStatus(unavailable.message.orEmpty())
            Result.failure()
        } catch (http: FeedHttpException) {
            settings.setStatus(http.message.orEmpty())
            if (http.retryable && !retryRun && movementGeneration == null) Result.retry() else Result.failure()
        } catch (_: IOException) {
            settings.setStatus("Upload failed. Check your connection. Hourly sync will retry.")
            if (retryRun || movementGeneration != null) Result.failure() else Result.retry()
        } catch (invalid: IllegalArgumentException) {
            if (movementGeneration != null) return Result.success() // A source change fences stale work quietly.
            settings.setStatus(invalid.message ?: "Check the pairing phrase and server URL.")
            Result.failure()
        } catch (_: Exception) {
            settings.setStatus("Sync failed. Open Truffle and try Feed now.")
            Result.failure()
        }
    }
}

object FeedSchedule {
    private const val NAME = "truffle-hourly-feed"
    private const val RETRY_NAME = "truffle-retry-feed"
    private const val MOVEMENT_NAME = "truffle-movement-feed"
    const val RETRY_RUN = "retry_run"
    const val MOVEMENT_GENERATION = "movement_generation"

    /** One retry after the Worker's retry_after_s. A newer request replaces an older one. */
    fun retryOnce(context: Context, seconds: Long, movementGeneration: String? = null) {
        val request = OneTimeWorkRequestBuilder<FeedWorker>()
            .setInitialDelay(seconds.coerceIn(1L, MAX_RETRY_SECONDS), TimeUnit.SECONDS)
            .setInputData(workDataOf(RETRY_RUN to true, MOVEMENT_GENERATION to movementGeneration))
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(RETRY_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    /** Accepted growth coalesces into one best-effort upload within a few minutes. */
    fun afterMovement(context: Context) {
        val store = NativeWalkStore(context)
        val settings = FeedSettings(context)
        if (!store.enabled || !store.boundTo(settings) || !NativeTracking.permitted(context)) return
        val generation = store.sourceGeneration
        if (generation.isEmpty() || !store.claimMovementFeed(Instant.now())) return
        val request = OneTimeWorkRequestBuilder<FeedWorker>()
            .setInitialDelay(2, TimeUnit.MINUTES)
            .setInputData(workDataOf(MOVEMENT_GENERATION to generation)).build()
        WorkManager.getInstance(context).enqueueUniqueWork(MOVEMENT_NAME, ExistingWorkPolicy.KEEP, request)
    }

    fun cancelMovement(context: Context) { WorkManager.getInstance(context).cancelUniqueWork(MOVEMENT_NAME) }

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
        cancelMovement(context)
    }
}
