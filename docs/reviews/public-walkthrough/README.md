# Public demo walkthrough, October 9

The anonymous public app was checked with a fresh desktop Chrome context at a
412×915 viewport. This is a browser check, separate from physical Samsung proof.
No personal pet or health records were used. Demo steps were explicitly simulated.

- [High-effort live reply and gift](chat-and-gift.json), world checkpoint 5cf5465:
  4,000 simulated steps, 200 energy spent once, live Workers AI fallback with the
  visible half-awake label, about 53 seconds until text and 56 seconds until the
  displayed reply completed. The trained adapter did not supply this reply.
- [Requested-low live reply](ui-followup.json), final web f388eef:
  20 energy spent once, live Workers AI fallback, about 27 seconds until text and
  45 seconds until displayed completion. The latter includes the typewriter.
  The reply incorrectly connected sleepiness to received steps; the recorded
  response remains unchanged as evidence.
- [Successful final UI continuation](ui-final.json), web f388eef: real hosted
  demo, guided walk, free errand/return, actual canvas gift tap, protected midnight
  preserving energy while closing today's step log, indoor pause on a newly
  enabled heat day, Arabic layout without overflow. Zero page errors.

The first two scripts retained `success: false` because of test-harness
assumptions, not because their recorded reply/gift checks failed. The first
expected simulated midnight to change `local_day`; the API reports the actual
calendar day and increments `age_days`. The second expected forced heat to remain
on after that simulated midnight; judge mode deliberately turns it off for the
new day. The final run checks age/energy and explicitly enables heat again before
checking indoor copy. It makes no further model call.

After these observations, prompt guidance was clarified: steps replenish energy;
a requested concise reply does not imply hunger; useful answers need no appended
walking request; heat shelter needs no compensating activity. English/Arabic
canned resting greetings now have no step quota. All 428 Worker tests passed.
The subsequent [live zero-energy API check](zero-energy-api.json) returned a
new gentle greeting, brain `none`, and zero energy spent. No subsequent paid
qualitative model run was made, so prompt adherence is not
claimed verified from these earlier replies. The energy economy is unchanged.

[Final gift capture](gift-followup.png) shows the actual canvas object opened in
chat. The original [capture](gift.png) is retained. Captures contain demo state,
not native pairing keys or private health data.
