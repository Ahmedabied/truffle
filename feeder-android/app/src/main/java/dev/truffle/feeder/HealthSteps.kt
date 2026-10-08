package dev.truffle.feeder

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByDurationRequest
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId

class GrantPermissionException(message: String) : Exception(message)
class HealthUnavailableException(message: String) : Exception(message)

data class HealthAccess(
    val sdkStatus: Int,
    val stepsGranted: Boolean = false,
    val backgroundSupported: Boolean = false,
    val backgroundGranted: Boolean = false,
    val distanceGranted: Boolean = false,
) {
    val canSync: Boolean get() = stepsGranted && backgroundSupported && backgroundGranted
}


/** What the Walk screen reads. Steps and distance only. */
data class WalkData(val today: LocalDate, val hourly: List<Long>, val days: List<WalkDay>, val distanceMeters: Double?)

class HealthSteps(private val context: Context) {
    companion object {
        const val PROVIDER_PACKAGE = "com.google.android.apps.healthdata"
        val READ_STEPS: String = HealthPermission.getReadPermission(StepsRecord::class)
        const val READ_BACKGROUND = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
        val READ_DISTANCE: String = HealthPermission.getReadPermission(DistanceRecord::class)
    }

    suspend fun access(): HealthAccess {
        val sdk = HealthConnectClient.getSdkStatus(context)
        if (sdk != HealthConnectClient.SDK_AVAILABLE) return HealthAccess(sdk)
        val client = HealthConnectClient.getOrCreate(context)
        val granted = client.permissionController.getGrantedPermissions()
        val supported = client.features.getFeatureStatus(
            HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND,
        ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
        return HealthAccess(sdk, READ_STEPS in granted, supported, READ_BACKGROUND in granted, READ_DISTANCE in granted)
    }

    /** Steps from the window's local midnight (in the Truffle's zone) to its end. */
    suspend fun readWindow(window: DayWindow, background: Boolean): Long {
        val access = access()
        when (access.sdkStatus) {
            HealthConnectClient.SDK_UNAVAILABLE -> throw HealthUnavailableException("Health Connect is unavailable on this device.")
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                throw HealthUnavailableException("Install or update Health Connect, then reopen Truffle.")
        }
        if (!access.stepsGranted) throw GrantPermissionException("Grant steps permission to feed Truffle.")
        if (background && !access.backgroundSupported) {
            throw HealthUnavailableException("Background reads are unavailable. Use Feed now while the app is open.")
        }
        if (background && !access.backgroundGranted) {
            throw GrantPermissionException("Grant steps permission and background read access for hourly sync.")
        }
        // Health Connect rejects an empty interval at exactly local midnight.
        return if (window.start == window.end) 0L else {
            val result = HealthConnectClient.getOrCreate(context).aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(window.start, window.end),
                ),
            )
            result[StepsRecord.COUNT_TOTAL] ?: 0L
        }
    }

    /**
     * Today by hour and the last 30 days by day, in the device zone, while the
     * app is open. Distance today only when that grant exists. A missing
     * bucket is zero.
     */
    suspend fun readWalk(now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): WalkData {
        val access = access()
        when (access.sdkStatus) {
            HealthConnectClient.SDK_UNAVAILABLE -> throw HealthUnavailableException("Health Connect is unavailable on this device.")
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                throw HealthUnavailableException("Install or update Health Connect, then reopen Truffle.")
        }
        if (!access.stepsGranted) throw GrantPermissionException("Grant steps permission to see your walks.")
        val client = HealthConnectClient.getOrCreate(context)
        val local = now.atZone(zone)
        val today = local.toLocalDate()
        val midnight = today.atStartOfDay(zone).toInstant()
        val hourly = LongArray(local.hour + 1)
        var distance: Double? = null
        if (now.isAfter(midnight)) {
            val groups = client.aggregateGroupByDuration(
                AggregateGroupByDurationRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(midnight, now),
                    timeRangeSlicer = Duration.ofHours(1),
                ),
            )
            for (group in groups) {
                val index = group.startTime.atZone(zone).hour
                if (index in hourly.indices) hourly[index] += group.result[StepsRecord.COUNT_TOTAL] ?: 0L
            }
            if (access.distanceGranted) {
                distance = try {
                    client.aggregate(
                        AggregateRequest(
                            metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(midnight, now),
                        ),
                    )[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: 0.0
                } catch (_: SecurityException) {
                    null // Distance was revoked. Degrade silently, steps still show.
                }
            }
        } else if (access.distanceGranted) {
            distance = 0.0
        }
        val first = today.minusDays(29).atStartOfDay()
        val found = mutableMapOf<LocalDate, Long>()
        for (group in client.aggregateGroupByPeriod(
            AggregateGroupByPeriodRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(first, local.toLocalDateTime()),
                timeRangeSlicer = Period.ofDays(1),
            ),
        )) {
            val date = group.startTime.toLocalDate()
            found[date] = (found[date] ?: 0L) + (group.result[StepsRecord.COUNT_TOTAL] ?: 0L)
        }
        return WalkData(today, hourly.toList(), WalkChart.fillDays(found, today), distance)
    }
}
