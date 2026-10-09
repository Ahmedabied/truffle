package dev.truffle.feeder

import java.time.Duration
import java.time.Instant
import java.time.ZoneId

/** Paused direct tracking cannot silently fall through to Health Connect. */
fun reminderSourceAllowed(directEnabled: Boolean, paused: Boolean, directPermission: Boolean,
    healthStepsGranted: Boolean, healthBackgroundSupported: Boolean, healthBackgroundGranted: Boolean): Boolean =
    !paused && if (directEnabled) directPermission
    else healthStepsGranted && healthBackgroundSupported && healthBackgroundGranted

fun canResumeNativeFeed(state: SensorAccumulatorState, baseline: SensorFeedBaseline?, ownerMatches: Boolean,
    directSelected: Boolean, now: Instant, zone: ZoneId): Boolean = directSelected && ownerMatches && baseline != null &&
    SensorAccumulator.feedTotal(state, baseline, now, zone) != null

/** Clock rollback suppresses work until the existing request age catches up. */
fun movementFeedDue(previous: Instant?, now: Instant): Boolean =
    previous == null || (!previous.isAfter(now) && Duration.between(previous, now) >= Duration.ofMinutes(5))

fun nativeMovementFeedAllowed(expectedGeneration: String, currentGeneration: String, ownerBound: Boolean,
    enabled: Boolean, permission: Boolean): Boolean = expectedGeneration.isNotEmpty() &&
    expectedGeneration == currentGeneration && ownerBound && enabled && permission
