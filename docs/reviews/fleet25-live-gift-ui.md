# Production server-gift UI acceptance

**PASS**, October 9, 2026 at **08:47:57 UTC**. This check used an isolated
390 × 800 Chrome profile and the integrator's dedicated non-user QA pet.
The stored step total is a test fixture, not physical walking evidence.
No personal pet or phone was used.

The production UI read actual authenticated server state: **mock false, demo
false, generation 0, one gift, no pending job**. The gift was **Paper bouquet**,
with procedural drawing and authored-note provenance.

- Clicking the bouquet's actual object in the world opened it in the chat area.
  The displayed art and note exactly matched the server response.
- The card explicitly said: “A fresh procedural drawing with an authored note.
  No AI model or food cost.”
- Opening Pocket's collection and pressing **Enter** on its sole gift button
  opened the same card, closed Pocket and returned focus to the gift in chat.
- No page or console errors occurred. No chat, pair, feed, reset or inference
  request was made.

Only authenticated `/state` and `/companion` requests for this QA owner were
allowed to reach the API; two state reads and one companion request occurred
during the recorded check. Boot's `/health` probe was fulfilled locally to keep
the production API allowlist limited to those two endpoints. All paid/model and
other mutation paths were blocked. The browser profile was then disposed.

Evidence: [sanitized acceptance data](fleet25-live-gift-ui/acceptance.json),
[gift in the world](fleet25-live-gift-ui/world-with-server-gift-390.png), and
[server gift opened in chat](fleet25-live-gift-ui/server-gift-open-in-chat-390.png).
Captures were taken with Pocket closed, checked for credential text and visually
reviewed. No owner phrase, secret, private job identifier or credential URL is
included in these artifacts.

This verifies the already-created server gift reaches and works in the deployed
UI. Root owns the separate timed alarm, pre-return state read, daily-limit and
food-accounting evidence. The displayed 3,996 food points are a later settled
snapshot; this UI observation alone does not measure a gift charge or prove the
time at which the alarm executed.
