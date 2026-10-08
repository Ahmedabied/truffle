# 0021 A walking companion and a world to return to

Date: 2026-10-09. Status: accepted within Ahmed's explicit request for direct
walking detection, richer nostalgic ASCII, away gifts, happy outings and gentle
notifications. This extends decisions 0016 through 0020.

## Experience

The world remains genuinely glyph-rendered, with cached layers and a 30 fps
target. Improve near, middle and distant detail, legibility and the pet's face.
Use a coherent nostalgic paper-and-ink interface. Keep reduced motion, Arabic,
small screens and honest demo labels. No sound.

A person can say they are heading out for a walk or an errand. Truffle offers a
brief warm response. It does not predict plans or infer location. Heat days offer
an indoor/rest response. This action does not send a model message or spend
energy automatically. Normal chat continues to use the existing energy rules.

After an absence of at least ten minutes, a living Truffle can leave one small
fictional ASCII keepsake. At most one per local day. Rest and heat days qualify;
no steps target or penalty is attached. Vary authored gifts deterministically,
keep the most recent twelve on this browser, and isolate them by pet and API.
Preparation is resolved on return from elapsed time; no background AI job is
claimed or charged. A labelled demo can preview a gift. No real-world object,
location, outing or unseen activity is invented as a factual observation.

## Direct steps on Android

Offer an opt-in hardware step-counter mode that works without Samsung Health.
It requires Android activity permission and a visible, silent foreground service
notification. No GPS, microphone, raw accelerometer inference or hidden tracking.
Health Connect remains available as an alternative. Unsupported devices receive
a clear explanation. Revocation, service death, reboot and stop must be handled.

One source feeds at a time. Never sum two full-day totals. Direct mode starts from
a confirmed credited total for the pet's pinned day and zone, plus new hardware
counter deltas after that baseline. Mode changes fence or await old uploads.
If a safe baseline is unavailable, retain local counts but do not invent credits.
Persist same-day readings across process restart; rebaseline counter resets and
ambiguous midnight/zone crossings without double-crediting steps. Explain partial
day coverage and Health Connect lag. Never claim an exact full-day count when
tracking began later. All timestamps in uploads use the required day envelope.

## Quiet notifications

Separate tracking's required service notification from optional companion nudges.
Companion reminders are off by default and require notification permission.
At most one nudge per day, only between 09:00 and 19:00 in the pet's zone, with
an easy disable control. Suppress when already well fed, heat-protected, dead,
recently active, missing trustworthy weather, or permissions are revoked.
No guilt, emergency language, countdown, death threat, streak loss or escalation.
Manual outing excitement and return gifts use in-app feedback; do not create a
second notification stream. Permissions may be refused without breaking chat.

## Verification

Add meaningful tests for sensor reset/restart/day edges, source overlap and
notification suppression. Build and test Android only on the workstation via
GitHub. Verify the installed upgrade preserves pet ownership. Exercise the
new world, gift, rest, RTL, reduced-motion and reset flows in a real browser,
then inspect on the Samsung. Keep unverified physical walking claims explicit.
The energy golden cases remain unchanged.
