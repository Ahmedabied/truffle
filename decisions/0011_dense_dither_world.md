# 0011: The world is a dense dithered raster, not a 40 column sprite sheet

Date: 2026-10-08. Status: accepted.

## Context

The first world was a 40 x 28 character grid with hand-drawn sprites. At phone size each character was a fat block, so the scene read as pixel art made of a handful of pixels. Ahmed pointed at the Nous Research Hermes Agent site, where real pictures are converted into a fine dither of tiny glyphs: tone and depth come from glyph density, hundreds of cells across.

## Decision

- The grid is 100 columns by 68 rows, still one `<pre>` layer per colour, still no canvas and no WebGL. The product spec's "about 40 columns" becomes "about 100 columns".
- Every form is a lit surface. The Truffle is a set of ellipsoids (cap, body, feet, eyes, mouth) shaded per cell from the sun or moon direction, with a cast shadow on the ground. Dunes are a heightfield lit by slope. Clouds are blob fields with a lit top. The sun and moon are discs with a glow.
- Luminance becomes glyph density through an ordered dither (Bayer 4 x 4) over the ramp ` .:+*#%@`. Each layer has one ink colour; dark ink carries shadow, colour inks carry the lit tone, a white ink carries eye whites and spots.
- Moods change geometry (lids, droop, lean, squash), not pictures, so every mood keeps its shading at every hour.
- The HUD leaves the grid and lives in the HTML line under it, including days and steps for a dead Truffle.

## Consequences

- `web/src/scene/raster.ts` (layers, dither, primitives, lighting), `web/src/scene/pet.ts` (the creature), `web/src/scene/world.ts` (scene). `web/src/sprites.ts`, `art.json`, `sky.json` and `shade.ts` are removed; the A01 and A02 asset packs stay in `fleet/outbox` as reference.
- Compose cost is about 2 ms per frame in node for the heaviest scene (rain, clouds, Truffle). Twelve layers of 6,800 cells are rewritten only when they change.
- The font is about 6.7 px on a 400 px wide phone. The phone check (fonts, frame rate) stays on Ahmed's list.
