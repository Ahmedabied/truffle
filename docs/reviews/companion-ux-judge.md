# Independent companion UI/UX review — initial layout

Date: 2026-10-09. This records the **initial layout before the user's full-bleed world + chat direction**. The running Vite source changed during testing; ratings are for that initial experience, not a claim about the later revision.

Method: cold first impression at `http://localhost:5191/demo?mock=1`, before reading pitch documents or implementation. Isolated headless `/usr/bin/google-chrome` using `web/node_modules/playwright`; no shared browser profile, production actions, model calls, ADB, or real-phone validation. Viewports: 412×915 mobile, 320×740 English and Arabic, 1280×900 desktop. Source inspected only after the interaction pass, limited to the relevant implementation.

## Candid first impression

- **Visual UI: 6.5/10.** Warm paper, serif heading, green controls, and ample whitespace are coherent. The page still feels like a nicely presented simulator, with intro, world caption, detailed status, several tools, chat, keepsakes, judge controls, settings, and footer all competing.
- **Companion UX: 6/10.** Departure and return language is gentle. The return prompt is optional, and focus moves helpfully to chat. But the actual conversational relationship is below the mobile fold, and a fresh visit starts with a sleeping companion and no visible conversation. Losing an outing on reload is especially contrary to the intended real-world routine.
- **ASCII art: 5.5/10 at default night, 6.5/10 at noon.** The landscape is atmospheric and recognizably authored. On mobile, glyphs are so small they become stippling; the pet is a tiny, hard-to-read mass. The night palette makes trees, ground, and pet hard to distinguish. The default scene does not yet carry enough clear character to support a strong nostalgic attachment.
- **Desktop layout: 7/10.** Simultaneous world and chat is much easier to understand. The same content hierarchy works less well when stacked on a phone.

Evidence: [initial 412px screen](companion-initial-mobile.png), [keepsake card](companion-initial-keepsake.png).

## Verified behaviors

- Guided 4,000 steps updates energy to 67%. Completed mock chat reduces it to 63%; input clears. No JS page errors or console errors observed during the tested flows.
- Heading out → Taking a walk / Just an errand opens the departure dialog. “I'm back” closes it, focuses chat, and shows “Welcome back. What did you notice? Share it if you like.”
- Take a moment works; Escape dismisses its native dialog. Reduce motion and text-size settings operate.
- Heat mode updates the chat invitation. Keepsake preview creates a localized card with local persistence; another same-day preview is disabled.
- Share successfully downloads a 1080×1350 PNG with demo provenance. Headless Chrome cannot validate an Android native share sheet.
- English and Arabic have no document horizontal overflow at 320px or 412px. Arabic reading order and controls are generally coherent. Weather remains English in the mock HUD; numbers and date are mixed-script but readable.
- No automated contrast certification, physical touch testing, real-device FPS measurement, notification delivery, live API chat, or actual 10-minute absence was claimed or performed.

## Remaining issues, ordered by impact

1. **Outing disappears on reload.** Start a walk, reload while the modal is open: the initial page returns with no outing or return acknowledgement. A mobile browser being closed or restored is ordinary usage. Persist minimal outing intent per API/pet/demo identity and resolve a gentle return on reopening. Root has been informed and intends to fix it.
2. **Chat and locale changes restore implementation diagnostics.** Completed chat prints `Energy 67% so high effort. Thinking on. Cost 200.` even though the current energy display is 63%. Language switching similarly replaces the gentle helper with tier/effort mechanics. Keep these in judge controls; normal chat should speak in the companion's language. The heat helper also says “it cannot die today,” which undermines the otherwise calm tone.
3. **Mobile hierarchy distances the companion from conversation.** At 412×915, the whole first screen contains introduction, world and tools; chat starts below it. The user's latest direction directly addresses this: world edge-to-edge, compact chat immediately below, secondary features in a drawer/panel.
4. **The pet needs a readable silhouette, especially asleep.** Detailed scenery cannot compensate for a central character that appears as a tiny glyph ball. Make pose, face orientation, and quiet resting state recognizable at actual 320–412px size. Preserve a stable pose for sleep; small breathing is sufficient.
5. **Kept-gift keyboard focus is lost.** Focus `.gift-choice`, press Enter: active element becomes `BODY`, because `refreshKeepsakes()` replaces every gift button. The same replacement also occurs on polling. Preserve nodes or restore focus to the selected gift after rendering. Confirmed in browser.
6. **Unread gift state is transient.** The gift persists after reload, but the “I made a little something for you” notification and emphasis disappear. Keep unread state alongside the local collection if the subtle notification is intended to survive reopening. This is an in-app state observation, not a finding about native notification scheduling.
7. **Share download has no in-page completion feedback.** The download works; the button simply returns to Share. A small “Saved a picture of your world” status would make fallback download behavior clearer without a toast pileup.
8. **Settings expose API configuration next to ordinary preferences.** Pairing phrase, API address and browser forget action appear beside text size and motion. Move connection controls into an advanced subsection in the new panel; let everyday settings remain simple.

## Source-level boundaries and limitations

The keepsake namespace includes normalized API origin, demo/real and pairing phrase; collections are separated by those identities. Gift content uses textContent and authored definitions. No exploitable injection or cross-account display was found in the inspected path. This was a narrow review, not a security audit. “Forget this Truffle on this browser” deletes credentials but does not remove the corresponding keepsake shelf; clarify that behavior or remove associated local state if “forget” is meant comprehensively.

The shelf stores a last-seen timestamp and deterministic authored gifts. It does not run AI in the background. This is accurately disclosed as fictional/local in the initial interface, although the disclosure is wordy for the primary flow.

## Advice for the revised direction

Keep a tiny header, full-width world, quiet energy strip, and chat immediately adjacent. A single secondary menu should contain keepsakes, demo controls and preferences. Put departure choices beside the chat as optional context, with an obvious but gentle return state. Preserve keyboard equivalents for clickable gifts in the world: a canvas-only hotspot must not become the sole way to find a present. Put the object into the scene and let selecting it reveal the gift in chat; show a persistent small unread marker, not a forceful interruption.

For a cold final review, rerun this exact journey after the refactor and rate it afresh. The current initial scores should not be reused as a verdict on work still underway.
