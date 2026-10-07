# Session 01 - kickoff and design (2026-10-07, Fable 5.1 after Opus 5.5)

## What happened

- Read the HF26 hub and the Week 1 page. Theme "Touch Grass", deadline Oct 11 23:59 PDT.
- Brainstormed with Ahmed. He rejected on-device star/plant identification (phone limits, iOS, misidentification safety). He pushed the idea to an AI pet that eats steps and grows smarter, affectionate above the user's average, dies when starved. He named it Truffle. He chose Gemma 4 31B for accuracy, fine-tuned, served on a serverless GPU, with all app infrastructure on Cloudflare for versatility (country detection, weather switching).
- Checked rules: cloud hosting of open weights is allowed; Gemma not required but gives a $200 category; Tinker does not support Gemma (dropped).
- Read 14 competitor entries and a past DEV winners post. Field is crowded with offline trail-buddy clones; Sobuj Ghonta is the bar.
- Hardened the technical plan with primary sources: Unsloth 31B QLoRA in 22GB; RedHat FP8 checkpoint; vLLM Gemma 4 recipe with thinking toggle; Modal pricing, free credit and snapshots; Workers AI has Gemma 4 26B (fallback brain); Health Connect API and the Tasker plugin; Open-Meteo; Cloudflare request.cf and DO alarms; DEV agent sessions upload flow; Gemma licence terms for derivatives.
- Found two risks: ChatGPT plan may lapse ~Oct 9 (astra fleet front-loaded), laptop has 9.4GB free disk (no local weights, APK on the box).
- Wrote the playbook, specs, golden cases (30, validated), fleet protocol, write-up plan, timeline, decisions, this log. Created the public repo and pushed.

## Decisions recorded

0001 - 0010 in `decisions/`.

## For next session

See `HANDOFF.md`.
