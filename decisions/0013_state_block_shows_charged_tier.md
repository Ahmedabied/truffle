# 0013: The state block shows the tier that is charged, not the tier energy allows

Date: 2026-10-08. Status: accepted.

## Context

A user at high energy can ask for a low effort reply. The Worker charges the requested lower tier and caps tokens for it, but the state block still said `tier=high`, because the serializer recomputed the tier from energy. The model then saw a block that contradicted its token budget. B02 left this open; S10-13 and S11-09 both flagged it.

## Decision

The block carries the admitted tier decision: the tier the Worker is about to charge and cap. Energy still decides the maximum tier. A request for a higher tier than energy allows is clamped down and the block shows the clamped tier. The 30 original goldens are unchanged because none of them pass a requested tier.

## Consequences

- `engine.stateBlock` accepts the admitted tier. The DO passes the TierDecision it charges.
- Memory window, token cap, thinking flag and cost all follow the same admitted tier.
- Wave B rows already satisfy this: the block tier and the budget always agree.
