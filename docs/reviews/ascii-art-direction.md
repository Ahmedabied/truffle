# ASCII art direction and verification

## Critique of the starting scene

The original 100×68 glyph world had a useful lighting model and a coherent day/night clock, but little authored depth. Its broad ground field competed with the creature; the fixed face depth could bury larger stages' eyes inside their bodies. A fresh night visit was especially weak: the small Spore read as a dim ball, and a dark outline disappeared into the ground. Adding more texture alone made the face harder to read.

The first visual review rated the emerging paper interface around 8/10 for identity and 7.5/10 for the initial flow. It identified repeated energy information and equal-weight departure/rest choices. The UI owner subsequently replaced that composition with an edge-to-edge world, conversation immediately below it, and secondary controls in Pocket. This report covers scene work; the UI implementation belongs to that separate review.

## Final direction

A small, warm terminal garden with an unmistakable mushroom companion. The scene uses three readable depths: quiet distant ridges, middle-ground acacia or pines, then engraved stones, tufts, seeds and placed gifts in the foreground. Sand, olive, rust and cream stay restrained; night uses a warm moonlit character contour against navy and charcoal.

The creature receives the clearest local contrast. Its cap and body retain directional glyph shading, but its face has a deliberately quiet plane. Literal ASCII eyes and mouth remain readable at 412 CSS pixels: open eyes, closed lids, a wider happy smile, a tired line, a frown and a yawn. Blinks close over 220 ms; pose and expression parameters ease over 650 ms. The grid necessarily quantizes the final marks to cells.

The user changed the character direction during this pass. Every living growth stage now has a complete mushroom silhouette, including the youngest sleepy Spore. Sleep keeps its feet anchored, with a 1% breathing motion over 5.2 seconds and no hop or side sway. Intelligence tiers add two through eight cap freckles and at most 7.5% size beyond each stage's base size. The simulation's stage and energy rules are unchanged.

## Implementation

- `landscape.ts` adds stable authored ASCII landmarks and atmospheric range geometry. Static art stays cached through animation.
- `raster.ts` and `surface.ts` retain the density ramp, extending the genuine font atlas with printable ASCII strokes. No raster illustration, SVG, or HTML character facade replaces the scene.
- `pet.ts` fixes face depth, separates the quiet face from material texture, supplies the mushroom silhouette at every stage, and models expression and pose transitions.
- `palette.ts` adds distant, nature and foreground inks; the character uses a stronger moonlit outline and ambient material shading at night.
- `grid.ts` fits both available dimensions. Glyph proportions stay intact, with the complete world centered over a continuous sky/ground gradient.
- `world.ts` targets 60 Hz using elapsed seconds. Static fields remain cached and slow clouds keep their own cadence. Reduced motion freezes all moving layers.
- `keepsakes.ts` places up to three authored objects in the real glyph layer. `World.setKeepsakes([{id, art}])` updates them independently of the terrain. `World.hitGift(clientX, clientY)` uses the actual canvas rectangle with minimum 44 CSS-pixel hit areas. Pocket provides the keyboard equivalents and story text.

Heavy rain initially fell below the 60 fps target at 4× CPU throttling. Its fuzzy density bands became narrower authored rain strokes; the surface now visits a compact damaged-cell list rather than rescanning every layer rectangle during submission. The first measurement is retained in [60fps-first-pass.json](ascii-art/60fps-first-pass.json).

## Evidence

Before captures: [day](ascii-art/before/day-scene.png), [night](ascii-art/before/night-scene.png), [desktop](ascii-art/before/day-desktop.png).

Final captures: [day](ascii-art/after/day-scene.png), [fresh night](ascii-art/after/fresh-night-scene.png), [grown sleep](ascii-art/after/night-scene.png), [heat](ascii-art/after/heat-scene.png), [storm](ascii-art/after/storm-scene.png), [desktop](ascii-art/after/day-desktop.png), [mobile composition](ascii-art/after/day-mobile.png).

A demo keepsake was created through Pocket, then opened by clicking its object inside the canvas: [placed book](ascii-art/after/gift-scene.png), [opened story](ascii-art/after/gift-open-mobile.png). This was an isolated local mock with external network requests blocked.

The loaded-browser harness is `web/test/scene.browser.mjs`. It uses the compiled local application, system Chrome, a 412×915 viewport, DPR 2, and 4× CPU throttling. Each scene warms for 1.8 seconds and records eight seconds of actual animation-counter progress and the on-page CPU timings. The desktop screenshot uses 1440×1000. [Raw measurements](ascii-art/after/measurements.json) include browser version, timing, mock status and page errors. These are browser measurements, not a claim about a Samsung handset or physical walking.

Final loaded result, 155.0.8059.39 (eight seconds per scene):

| Scene | Frames | Measured fps |
| --- | ---: | ---: |
| day | 479 | 59.85 |
| night | 481 | 60.05 |
| fresh-night | 481 | 60.05 |
| heat | 479 | 59.85 |
| storm | 480 | 59.97 |

Every on-page sample read 60 fps; all five contexts recorded zero page errors. Minor values above/below 60 come from measurement boundaries and timer timing. The storm sample submitted its glyph work in 2.1–2.4 ms, with 1.6–2.2 ms scene composition. These timings exclude GPU completion.

Verification: TypeScript typecheck, production build and 19 scene tests pass. The tests cover all growth stages and moods; legible face marks; grounded sleep; expression interpolation; tier freckles; literal glyph copy/mask/damage; gift placement, removal and hit geometry; static caching; reduced motion; rebirth; celebration expiry; and the 60 Hz animation clock. The loaded reduced-motion canvas remains pixel-identical across 1.1 seconds.

## Remaining evidence boundaries

The user-authorized target is now 60 fps. Earlier 30 fps evidence describes the earlier renderer and should not be used as current validation. Root should update README/post/checklist performance wording using the final raw measurements, then append actual handset evidence separately when available. No deployment, commit, real-pet mutation, notification permission change or physical walk was performed by this art task.
