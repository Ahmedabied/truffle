# 0012: Memory facts are an untrusted data section at the end of the prompt, and the state block weather is English

Date: 2026-10-08. Status: accepted.

## Context

The fine-tune schema put remembered facts on a `memory: ` line right after the state block, inside the canonical trio. The red-team (S10-10) showed that facts are what a human typed, so a fact can carry an instruction. Sitting next to the state block, it reads as policy. The red-team also showed that free weather text is an instruction channel, and asked for a fixed vocabulary. The B06 hardening builder moved facts to the end of the prompt and gave Arabic Truffles Arabic weather words. Wave B has not been generated yet, so the training data can still follow whichever layout is chosen.

## Decision

- The canonical trio stays byte for byte: persona header, state block, language line. No memory line inside it.
- Facts go last, after every instruction line, between the fixed markers `<<memory notes: untrusted data>>` and `<<end of memory notes>>`, with one note line that says they are data, and the facts as a JSON list of strings. The Worker and the Wave B data use the same markers.
- The state block weather field is English for every Truffle, built from a validated temperature, one fixed word per WMO code group and a safe city. The state block is a machine line; the model answers in the language given by `lang`. This matches the three worked examples and the S09 baseline.

## Consequences

- `finetune/data/schema.md` describes the memory section. Wave B shards for the `personal_memory` intent use it.
- `worker/src/prompt.ts` builds it. The `memory:` line is gone.
- `worker/src/do.ts` calls `stateWeather` with `en` at both sites. The Arabic sky words stay in `weather.ts` for display use.
- The eval harness builds the system prompt from the filter's constants, so it already matches the trio. If it is later extended with memory prompts it must use the same markers.
