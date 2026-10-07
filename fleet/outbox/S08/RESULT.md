# S08 result: ASCII world spike

## Outcome

Built and verified `web/spike/ascii.html`. It is **17,880 bytes**. It opens directly from `file://`. It uses no framework, build step, canvas, WebGL, downloaded font or external resource.

Chrome passed **66 automated checks** on this laptop. Three timing runs averaged **11.98 to 11.99 fps**. None recorded a frame interval over 100 ms. **Phone timing is still to be measured by the main session.** Mobile viewport emulation does not prove Android device performance.

Cost: **$0**. No paid service was used. No package was installed.

## Files

- `web/spike/ascii.html`: the complete standalone demo.
- `fleet/outbox/S08/verify.py`: repeatable Chrome DevTools Protocol test harness. Uses the laptop's Python 3.12 and installed `websocket` module. Playwright was not installed.
- `fleet/outbox/S08/raw/verification.txt`: command output with all passing checks.
- `fleet/outbox/S08/raw/verification.json`: dimensions, browser version, fonts, requests, typing results and timing summaries.
- `fleet/outbox/S08/raw/timing-clear.json`: raw rendered-frame intervals and JS draw timings.
- `fleet/outbox/S08/raw/timing-rain-wind40.json`: the same with rain and maximum wind.
- `fleet/outbox/S08/raw/timing-reduced.json`: the same with reduced motion.
- `fleet/outbox/S08/raw/mobile-dusk-arabic.png`: a 390 x 844 CSS pixel viewport screenshot, at DPR 2.
- `fleet/outbox/S08/raw/mobile-dusk-arabic-full.png`: the full mobile page with Arabic and controls.
- `fleet/outbox/S08/raw/mobile-night-rain.png`: the full mobile page with grass, rain, moon and affectionate Truffle.
- `fleet/outbox/S08/raw/chrome.log`: browser process diagnostics.

Writes were confined to `web/spike/` and `fleet/outbox/S08/`. No production web file or package file was changed. No git mutation command was run.

## Implementation decisions

- One 40-column by 28-row character buffer. Every row includes trailing spaces. There is no trailing newline.
- Layers: sky and light, three clouds, horizon, ground, rain, Truffle, HUD. The sky and ground colours are CSS behind the text. All scene glyphs are composed into the buffer.
- Local hour starts from the laptop or phone clock. The slider overrides it. Night, dawn, day and dusk each have a readable palette. Sun and moon follow separate arcs.
- Wind is 0 to 40 km/h. Zero wind freezes clouds. Sand has dots and sparse tufts. Grass is denser. Rain is drawn behind the pet so its face stays legible.
- Three seven-row Truffle sprites. Sleep flattens the body and closes the eyes. Affection adds a lean, a raised arm, happy eyes and an ASCII `<3`.
- Energy is sample data: 70% content, 0% asleep, 90% affectionate. Stage is Truffle. Steps are 6,120. The page explicitly says this is not judge mode. It does not reproduce the engine or call a model.
- `requestAnimationFrame` uses a 12 Hz deadline. Missed deadlines are skipped. It does not render catch-up bursts. Each rendered frame performs exactly one `world.textContent = ...` assignment.
- FPS uses actual rendered-frame intervals. The slow counter tests strictly `interval > 100`. Hidden-tab time is excluded. The visible meter updates once a second.
- Reduced motion is the logical OR of the system preference and the manual checkbox. It freezes cloud and rain positions. The rain checkbox and all scene state are preserved. Controls still work. Replies appear immediately. An active reply finishes immediately if reduced motion is enabled.
- The spike keeps its 12 fps loop running while motion is frozen so its timing remains comparable. B03 can later skip unchanged frames to save battery.
- The grid is an LTR image with a state description. Controls have real inputs, labels, fieldsets and visible keyboard focus. The accessible reply is announced once on completion, not once per character. The visual typing line is hidden from the accessibility tree to avoid duplicate output.
- Arabic typing uses grapheme clusters through `Intl.Segmenter`. A fallback groups Arabic combining marks. Arabic joining stays with the browser. Typing timers are separate from the 12 fps scene loop.

## Font recommendation for B03

Use this stack for the grid:

```css
font-family: "Noto Sans Mono", "Droid Sans Mono", "Roboto Mono",
             Menlo, Consolas, "DejaVu Sans Mono", monospace;
font-weight: 400;
font-kerning: none;
font-variant-ligatures: none;
font-feature-settings: "liga" 0, "calt" 0;
white-space: pre;
direction: ltr;
unicode-bidi: isolate;
```

Reasons:

1. **Noto Sans Mono** is the first choice when present. It rendered ASCII, box-drawing and block glyphs at equal advances in the measured laptop run.
2. **Droid Sans Mono** is a useful Android fallback candidate. **Roboto Mono** is another candidate when installed. Do not assume every Android vendor ships any one named family. CSS simply skips absent families.
3. **Menlo** is the iOS candidate. Consolas and DejaVu Sans Mono support common desktop environments. Generic `monospace` is the final offline fallback.
4. Normal weight and disabled ligatures avoid contextual substitutions in ASCII art. No synthetic bold is used in the grid.
5. No font download is needed. This avoids font-load layout shifts and works offline.

Do **not** depend on monospace fallback for Arabic. An Arabic run can fall through to another font with different advances. Arabic shaping and joining also make one-code-point-per-cell assumptions unsafe. Keep Arabic out of the grid. Use a separate chat element with `dir="auto"`, a matching `lang`, and this proportional stack:

```css
font-family: "Noto Sans Arabic", "Geeza Pro", Tahoma, system-ui, sans-serif;
```

Do not disable Arabic shaping or apply the grid's spacing correction to chat. The Arabic sample was RTL. The English sample was LTR. Chrome reported the actual fonts as **Noto Sans Mono** for the grid and **Noto Sans Arabic** for the Arabic reply. These were local fonts, not custom downloaded fonts.

### Cell measurement

The hidden DOM probe measures 40 `M` characters at 100 px. The font size is `availableWidth * 100 / measuredWidth`. A second probe measurement supplies a tiny spacing correction for fractional browser font-size rounding. Width changes and `document.fonts.ready` trigger measurement again.

The probe also compares spaces, ASCII, `─│┌┐└┘█░`. All measured 60 px per cell at a 100 px font size on this laptop. At a 390 px viewport, the fitted font was 16.25 px. Cells were 9.75 px wide. The nominal line height was 18.2 px.

Measured 40-character text width exactly matched all seven tested viewport widths: **280, 320, 360, 390, 412, 430 and 844 px**. The final case was landscape. No case had horizontal overflow. The largest spacing correction was 0.00625 px per character.

The page reports a warning if the glyph advances differ. It does not silently claim a broken vendor fallback is aligned. Android and iOS glyph coverage still need an actual device check. The generic fallback is not a guarantee of a particular font file.

## Laptop measurements

Environment: Linux laptop, Google Chrome **155.0.8059.39**, headless mode. Mobile metrics: 390 x 844 CSS pixels, DPR 2. No CPU throttling. Runs used real wall time, not Chrome virtual time.

| Scene | Duration | Frames | Mean fps | Interval p50 | Interval p95 | Maximum interval | Intervals >100 ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Clear, 12 km/h | 20 s | 240 | 11.9905 | 83.3 ms | 83.4 ms | 100.0 ms | 0 |
| Rain, 40 km/h | 15 s | 180 | 11.9872 | 83.3 ms | 83.4 ms | 100.0 ms | 0 |
| Reduced motion, rain retained | 10 s | 120 | 11.9803 | 83.3 ms | 99.9 ms | 100.0 ms | 0 |

The first frame in each run has no interval sample. JS buffer composition plus `textContent` assignment had a p50 of 0.1 ms and p95 of 0.2 ms in all three runs. This is **not total browser paint time**. Timer precision limits these small measurements. A recorded 0 ms does not mean zero work.

Typing measurements:

| Sample | Requested speed | Graphemes | Total reveal time |
|---|---:|---:|---:|
| Arabic | 40 ms | 41 | 1,650.9 ms |
| English | 12 ms | 68 | 830.4 ms |
| English | 40 ms | 68 | 2,734.8 ms |

The MutationObserver check saw **20 grid mutations for 20 rendered frames**. A separate deliberate 240 ms main-thread stall incremented the slow-frame counter. It was excluded from all three timing runs.

### Jitter and limitations

- Frame intervals occasionally moved between about 66.6 and 100 ms around the 83.33 ms target. The reduced-motion run had more 99.9 ms intervals. There were no intervals above 100 ms in the recorded runs.
- Cloud motion is deliberately quantized to whole character cells. At low wind it pauses between one-cell movements. Rain also moves in whole cells. This is the visible stepping of a character grid, not fractional text-layout jitter.
- No grid width shift or Arabic direction error was observed in the checks and screenshots. The screenshots show shaped Arabic and aligned HUD blocks.
- Arabic glyph shapes can change as the next letter joins during typing. Revealing whole grapheme clusters prevents isolated combining marks. It does not freeze normal Arabic joining forms.
- This was a short headless laptop run. It does not measure phone battery cost, thermal throttling, screen-reader behaviour or Safari font fallback.
- Chrome's process log contains background GCM registration errors. These are browser diagnostics. The page's DevTools request list contains only its local HTML file. There were no page JavaScript or console errors.

## Verification commands and output

```text
$ google-chrome --version
Google Chrome 155.0.8059.39

$ python3 /home/abied/Desktop/Truffle/fleet/outbox/S08/verify.py
PASS file:// page starts without a server
PASS HTML stays below 30,000 bytes
...
PASS exactly one pre mutation per rendered frame
PASS a deliberate main-thread stall increments the over-100-ms counter
PASS timing-clear: measured render rate stays near the 12 fps target
PASS timing-rain-wind40: measured render rate stays near the 12 fps target
PASS timing-reduced: measured render rate stays near the 12 fps target
PASS Chrome reports no page JavaScript or console errors
PASS page makes no HTTP, font or other external requests
...
PASS 66 checks. HTML 17880 bytes.

$ wc -c /home/abied/Desktop/Truffle/web/spike/ascii.html
17880 /home/abied/Desktop/Truffle/web/spike/ascii.html
```

The full output is in `raw/verification.txt`. The harness launches installed Chrome with `--headless=new`. Screenshots come from `Page.captureScreenshot`. Its temporary browser profile stays under the allowed outbox and is removed at exit. `TMPDIR` points to the outbox to keep Chrome's Unix socket path short enough.

## Stage sprites for B03

These blocks contain only ASCII. Preserve leading spaces. Pad each row to the listed width when making arrays. Use opaque spaces within the sprite rectangle so rain and terrain do not enter the face. The HTML contains the same three Truffle variants.

Suggested ground anchor: the final sprite row at grid row 24. Center each rectangle horizontally. Spore and Sprout include a small local sand line. The Spore dot on row 3 is under that line. Other dots are sand texture. These are art assets, not new stage rules.

### Spore: 5 rows, 16 columns

```text
 .   .     .   .
________________
       .
  .         .
     .   .
```

### Sprout: 5 rows, 16 columns

```text
       __
      /_/
       |
    .--'--.
___/       \____
```

### Truffle, content: 7 rows, 16 columns

```text
     .----.
   .' .  . '.
  /          \
 |   o    o   |
 |    \__/    |
  \          /
   '--------'
```

### Truffle, asleep: 7 rows, 16 columns

```text
             z
          z
    .------.
  .'        '.
 /   -    -   \
|      .       |
 '------------'
```

### Truffle, affectionate: 7 rows, 16 columns

```text
    .----.  <3
  .' .  . '.
 /          \ /
|   ^    ^   |
|  . \__/ .  |
 \          /
  '--------'
```

### Elder: 9 rows, 21 columns

```text
         _@_
          |
     .----'-----.
   .'  /    \    '.
  /   /      \     \
 |    o  |  o       |
 |  .    \__/    .  |
  \   \        /   /
   '--------------'
```

The Elder is wider, with shell cracks and a flower. Stage thresholds remain the product spec's thresholds. B03 should consume the engine's derived mood priority. This spike's manual mood picker is not mood logic.

## Main-session phone checklist

1. Copy the single HTML file to the Samsung. Open it locally in Chrome. Confirm the `file://` path works without a server. Try airplane mode.
2. Check 40 columns, glyph alignment, HUD blocks, shaped Arabic and `dir="auto"`. Repeat after rotation. Record the actual system font and browser version if remote inspection is available.
3. Run clear weather and maximum wind with rain for at least 60 seconds each. Record FPS and the cumulative >100 ms count. `asciiSpike.resetStats()` and `asciiSpike.stats()` are available to a remote console.
4. Toggle Android reduced motion. Confirm clouds and rain stay still without losing rain state. Confirm the checkbox cannot override the system preference. Check instant replies.
5. Check TalkBack focus, labels and the single completion announcement. Check larger system text and browser zoom. The exact-width grid necessarily uses smaller text on narrow screens.
6. Check an actual iOS browser if available. Menlo and Geeza Pro are recommendations here, not measured iOS results.
