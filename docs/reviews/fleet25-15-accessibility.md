# Fleet 25 / Assignment 15: accessibility, Arabic and reflow

Reviewed the current integrated UI on 2026-10-09 with isolated headless Google Chrome (`/usr/bin/google-chrome`) and the repository's Playwright. All browser traffic was restricted to `http://localhost:5191`; used `/demo?mock=1`, no inference, device connection or publishing. No repository `AGENTS.md` was present. Read the browser skills before browser testing.

## Findings fixed

| Finding | Before | After |
| --- | --- | --- |
| Sample chat implied real inference accounting | `explainChat` ignored `brain: "sample"` and returned “Actual cost” / “التكلفة الفعلية”, including a thinking on/off claim. | A sample-specific English/Arabic branch explicitly says the reply and food cost are simulated, there was no AI model call, and the charge applies only to the sample world. Live and sleepy explanations retain their existing behavior. Verified with actual sample chats in both languages. |
| Pocket trigger clipped at 320px with 200% text | Arabic trigger bounding box started at **x = -4px**, width **89px**. `document.scrollWidth === 320` still passed, so the existing document-width-only smoke check missed the clipping. | The header flex row wraps. Tests inspect individual control bounds in addition to document/dialog widths; English and Arabic pass at 100%, supported maximum 150%, and additional 200% text scaling. |
| Sticky Pocket heading obscured keyboard focus | At 320px / Arabic / 200%, the heading ended at **119.78px**. During forward/reverse tab traversal, the language button occupied **-0.22–43.78px**, Reset **46.19–102.58px**, Heat **-0.20–56.19px**, and Walk **0.31–95.09px**: focused controls were completely covered. | Added text-relative scroll padding to the dialog. The same 65-step forward/reverse traversal recorded **zero fully obscured focused controls**. |

Changed source files: `web/src/copy.ts` and `web/src/style.css` only. No `index.html` or `main.ts` edits by this assignment.

## Additional verified behavior

- Keyboard: initial Tab selects Pocket with a visible solid focus outline; Enter opens it at its close button; Escape restores focus to the opener. The world HUD opens moments using Space and regains focus after Escape.
- Native modal behavior: no underlying app control receives keyboard focus during Pocket traversal. Chrome may temporarily hand focus to browser chrome (`document.activeElement === BODY`), which is allowed by the regression test.
- Keepsakes and Settings summaries respond to Enter/Space. Preview gift opens with an accessible name and selected-state button; decorative ASCII art stays hidden from assistive technology.
- Arabic: the document language, app and Pocket direction switch correctly; the ASCII world, gift art and server field stay LTR. Typed Arabic chat uses RTL and typed English uses LTR.
- Chat: visual streaming text is hidden from the accessibility tree; the completed reply is duplicated into the atomic status region. The accessible completed text matches the visible completed text in both languages.
- Expanded Pocket, connection controls, keepsake preview, world and chat controls fit at 320px in both languages at all three text scales.
- System reduced-motion preference disables the conflicting app checkbox and exposes the explanatory note.
- Arabic pause dialog was inspected at 320px / 150%: RTL layout fit, and its return action returned to the chat input.

Screenshots inspected: [Arabic keepsake at 320px / 150%](fleet25-15-accessibility/arabic-keepsake-320.png), [Arabic world at 320px / 200% after header fix](fleet25-15-accessibility/arabic-world-320-200pct.png).

## Validation

```sh
node web/test/accessibility.browser.mjs
# 11 browser checks PASS

cd web
npm test -- --run test/copy-sample.test.ts test/gift-ui.test.ts
# 2 files / 13 tests PASS
npm run typecheck
# PASS
```

The 200% test enlarges the UI text through the existing CSS scale variable; the actual app control currently caps at 150%. This review verifies browser DOM semantics, keyboard operation and visual reflow, not spoken output with a physical screen reader or a full WCAG conformance audit. No commits made.
