# S02 health_connect_feeder_skeleton
Owner: astra        Wave: A        Due: Thu 2026-10-08 10:00 Oman

## Goal
Minimal Kotlin feeder: Health Connect aggregate steps since local midnight, hourly WorkManager with background-read permission, POST JSON to /feed with pairing phrase.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
feeder-android/ Gradle project (Compose or plain views, smallest possible), manifest with permissions and rationale activity, a README with the Samsung Health > Health Connect checklist and the sideload steps.

## Acceptance
Project compiles with Gradle 8 on the box (`ssh workstation`, SDK at ~/Android/Sdk, platforms 35/36; see findings/02_box_android_toolchain.md). Handles SecurityException (revoked permission) with a re-grant prompt. No analytics, no extra permissions.

## Do not
Do not add location unless behind an explicit toggle. Do not target Play distribution.

## Report
fleet/outbox/S02/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
