# 0014: Wave B runs before Ahmed's seed lines, with a seed-anchored pass after

Date: 2026-10-08. Status: accepted.

## Context

The plan was 30 seed lines from Ahmed first, then 18 GPT shards. The ChatGPT plan that runs the astra fleet may end around Oct 9 and was at 80 percent of its weekly usage on Oct 7. Ahmed is setting up Modal and asked for the GPT batch to go now. The seed file holds his rules and the ten moments the voice must cover, but not his lines.

## Decision

- Wave B launches now. The seed slot carries Ahmed's rules and his ten moments from the seed file as the map of situations, and the three worked examples as the tone. Shard agents are told the lines are pending and must not invent them.
- When the lines land, a seed-anchored pass runs: three shards (D19 to D21, en, ar, mixed) of 60 rows each where every row grows from one seed line. The filter report lists them separately and the training script repeats them three times, so the voice in his lines outweighs the generic rows.
- If the astra fleet is gone by then, the seed-anchored pass runs on Opus.

## Consequences

- `fleet/packets/D_template.md` gains a launch mode for this decision.
- `finetune/train.py` (or its config) gets a repeat factor for D19 to D21 before the real run.
