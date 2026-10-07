# S08 ascii_world_spike
Owner: astra        Wave: A        Due: Thu 2026-10-08 10:00 Oman

## Goal
Prove a <pre> ASCII grid at ~40x28 runs smoothly at 12fps on a mid Android browser, with Arabic text in the chat line and reduced-motion support.

## Inputs
Read first: docs/01_product_spec.md, docs/02_architecture.md, docs/04_research_facts.md (relevant section). Repo: ~/Desktop/Truffle.

## Deliverable
web/spike/ascii.html standalone (clouds drifting, sun/moon by hour, sand vs grass toggle, a 7-line Truffle sprite with 3 moods) + RESULT.md with frame timing notes and font recommendations.

## Acceptance
Runs from a file:// open on a phone. No framework. Under 30KB.

## Do not
No WebGL, no canvas text rendering tricks that break screen readers.

## Report
fleet/outbox/S08/RESULT.md: what was done, evidence (commands + output pasted), open questions, cost if any. No secrets anywhere.
