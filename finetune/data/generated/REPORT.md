# Truffle data filter report

Sources: `fleet/outbox/D[01][0-9]/shard.jsonl`. Near-dup threshold: Jaccard 0.8 on word 3-shingles.

- Lines read: **1800**
- Kept: **1800**
- Train: **1720**
- Eval hold-out: **80**

## Drops by reason

| Reason | Count |
|---|---|
| **total dropped** | **0** |

## Per tier

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| low | 825 | 798 | 27 |
| medium | 600 | 574 | 26 |
| high | 375 | 348 | 27 |

## Per lang

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| en | 600 | 573 | 27 |
| ar | 600 | 573 | 27 |
| mixed | 600 | 574 | 26 |

## Per mood

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| content | 300 | 290 | 10 |
| affectionate | 300 | 282 | 18 |
| tired | 300 | 282 | 18 |
| wilting | 300 | 286 | 14 |
| burrowed | 300 | 283 | 17 |
| just_woke | 300 | 297 | 3 |

## Per intent

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| argue_energy_rule | 126 | 114 | 12 |
| ask_outside | 144 | 136 | 8 |
| identity | 180 | 173 | 7 |
| night_check_in | 180 | 176 | 4 |
| personal_memory | 180 | 168 | 12 |
| practical_code | 108 | 100 | 8 |
| practical_message | 108 | 101 | 7 |
| practical_other | 108 | 102 | 6 |
| practical_plan | 126 | 117 | 9 |
| small_talk | 540 | 533 | 7 |

## Per shard

| Value | Kept | Train | Hold-out |
|---|---|---|---|
| D01 | 100 | 98 | 2 |
| D02 | 100 | 97 | 3 |
| D03 | 100 | 91 | 9 |
| D04 | 100 | 94 | 6 |
| D05 | 100 | 95 | 5 |
| D06 | 100 | 93 | 7 |
| D07 | 100 | 97 | 3 |
| D08 | 100 | 94 | 6 |
| D09 | 100 | 94 | 6 |
| D10 | 100 | 95 | 5 |
| D11 | 100 | 98 | 2 |
| D12 | 100 | 100 | 0 |
| D13 | 100 | 95 | 5 |
| D14 | 100 | 97 | 3 |
| D15 | 100 | 94 | 6 |
| D16 | 100 | 95 | 5 |
| D17 | 100 | 94 | 6 |
| D18 | 100 | 99 | 1 |

## Hold-out grid (tier x lang)

| tier | en | ar | mixed |
|---|---|---|---|
| low | 9 | 9 | 9 |
| medium | 9 | 9 | 8 |
| high | 9 | 9 | 9 |
