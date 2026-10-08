package dev.truffle.feeder

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter

class GrantPermissionException(message: String) : Exception(message)
class HealthUnavailableException(message: String) : Exception(message)

data class HealthAccess(
    val sdkStatus: Int,
    val stepsGranted: Boolean = false,
    val backgroundSupported: Boolean = false,
    val backgroundGranted: Boolean = false,
) {
    val canSync: Boolean get() = stepsGranted && backgroundSupported && backgroundGranted
}


class HealthSteps(private val context: Context) {
    companion object {
        const val PROVIDER_PACKAGE = "com.google.android.apps.healthdata"
        val READ_STEPS: String = HealthPermission.getReadPermission(StepsRecord::class)
        const val READ_BACKGROUND = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
    }

    suspend fun access(): HealthAccess {
        val sdk = HealthConnectClient.getSdkStatus(context)
        if (sdk != HealthConnectClient.SDK_AVAILABLE) return HealthAccess(sdk)
        val client = HealthConnectClient.getOrCreate(context)
        val granted = client.permissionController.getGrantedPermissions()
        val supported = client.features.getFeatureStatus(
            HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND,
        ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
        return HealthAccess(sdk, READ_STEPS in granted, supported, READ_BACKGROUND in granted)
    }

    /** Steps from the window's local midnight (in the Truffle's zone) to its end. */
    suspend fun readWindow(window: DayWindow, background: Boolean): Long {
        val access = access()
        when (access.sdkStatus) {
            HealthConnectClient.SDK_UNAVAILABLE -> throw HealthUnavailableException("Health Connect is unavailable on this device.")
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                throw HealthUnavailableException("Install or update Health Connect, then reopen Truffle Feeder.")
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
}
