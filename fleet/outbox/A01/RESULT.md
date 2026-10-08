# A01 result: shaded Truffle sprites

## Outcome

Delivered three complete styles. Each has 28 assets in both ink directions. That is 84 assets and 168 rendered sprite variants.

**Pick: classic.** It gives the body volume without competing with the face. It uses only ASCII. It is the safest choice for phone font fallbacks.

All writes from this task stayed under `fleet/outbox/A01/`. This task did not change production files. No package was installed. No font or other resource was downloaded. No git mutation command was run.

## Look here first

Paths are relative to the repo root.

- Quick comparison: [`fleet/outbox/A01/preview/style_comparison.png`](preview/style_comparison.png). All styles, both ramps, four stages, a mound and a grave.
- Full contact sheet: [`fleet/outbox/A01/preview/contact_sheet.png`](preview/contact_sheet.png). All 168 variants at native cell size. Zoom in rather than fitting this tall sheet to the window.
- All classic moods: [`fleet/outbox/A01/preview/moods_classic.png`](preview/moods_classic.png).
- Alternatives: [`moods_hatching.png`](preview/moods_hatching.png) and [`moods_blocks.png`](preview/moods_blocks.png).
- Phone-width day proof: [`phone390_classic_dark-ink.png`](preview/phone390_classic_dark-ink.png).
- Phone-width night proof: [`phone390_classic_light-ink.png`](preview/phone390_classic_light-ink.png).

The phone-width proofs are resized Pillow renders. They are not device screenshots.

## Files

- `fleet/outbox/A01/sprites.json`: recommended assets at the top level. Complete alternatives in `styles.hatching` and `styles.blocks`.
- `fleet/outbox/A01/render.py`: deterministic generator, Pillow renderer and assertions.
- `fleet/outbox/A01/verification.json`: checks, font coverage measurements and output hashes.
- `fleet/outbox/A01/preview/*.png`: 187 PNGs in total.

Individual previews use `<style>_<asset>_<ramp>.png`. For example, `classic_truffle_affectionate_light-ink.png`. They have two cells of background padding on every side. The padding is not in the JSON.

The PNG count is 168 individual sprites, three mood sheets, two contact sheets, six world scenes, six phone-width scenes and two font swatches.

## Art decisions

| Style | Treatment | Tradeoff |
|---|---|---|
| classic | ` .:-=+*#%@` ramp | Best balance of volume, skin texture and readable eyes. Recommended. |
| hatching | Dots, slashes, vertical cuts, `x` and `#` | Feels like an engraving. Slashes may compete with rain and Elder cracks. |
| blocks | Sparse marks plus `░▒▓█` | Strongest solid volume. Heavy bands draw attention away from the expression. |

Bodies use an ellipsoid normal map. The light comes from the upper left. Ambient is 0.25. Eight broad Gaussian bumps add warty relief. Sampling accounts for the 0.55 cell aspect. Small contour repairs keep low-density edges visible.

The light and dark maps are separate. They are not the same text with its color changed. Cast shadows fall toward the lower right. The gravestone has a bright left bevel and a shaded right plane.

Face patches are intentionally clear. This is a readability adjustment to the physical shading. The same adjustment works with either ink color.

Affection shifts the upper body and softens the eyes. Sleep lowers and flattens the body. Tired eyes use `u`. Wilting reduces density to 65 percent and sags the body. Shoots curl or droop. Yawn opens the mouth. Elder has cracks and a small flower. The grave also has a flower variant.

## Integration notes

- Keys use lowercase stages: `spore_content`, `sprout_asleep`, `truffle_yawn`, and so on.
- All six moods exist for every stage. Props are `mound`, `mound_peek`, `stone`, and `stone_flower`.
- Exact rectangles are Spore 16 x 5, Sprout 16 x 6, Truffle 18 x 8, Elder 22 x 10, mound 14 x 4, and stone 11 x 6.
- Every row is padded. Keep trailing spaces. Stamp the full opaque rectangle so weather cannot enter the face.
- Use `dark` on a light sand background. Use `light` on night blue. Preview palettes are in `_meta.palettes`.
- `eyes` contains zero-based `[x,y]` cells. `mouth` is `[x,y,width]`. Coordinates already include posture changes.
- Faces are baked into every variant. To replace one, blank each `face_clear` span first. Then stamp the new marks at the supplied coordinates.
- Sprout has a one-cell mouth. Truffle and Elder have four-cell mouths. Do not reuse the old global `MMMM` replacement for every stage.
- Spore deliberately has `eyes: []` and `mouth: null`. `seed` marks its single underground dot. Its moods alter the crust or seed depth. Its yawn opens a crack, not an invented adult mouth.
- Mound and stones also have no face. `mound_peek` supplies eye coordinates but no mouth.
- Center the padded rectangle in the 40-column grid. Put its last row at world row 24. Its `anchor` is on that last row.

## Verification

Generated with local Noto Sans Mono Regular. Font size is 18 px. Cells are exactly 11 x 20 px. Pillow uses 4x supersampling. The resulting cell aspect is 0.55.

The generator passed checks for exact dimensions, padding, allowed glyphs, face coordinates and quiet face cells. It checked one underground Spore dot and six distinct moods per stage and ramp. It also checked JSON round trips, uniform font advances and native PNG dimensions.

All 187 PNGs decoded. The world proofs are exactly 40 x 28 cells. A second run produced identical bytes for all 189 generated files, including JSON and verification output.

Actual rendered ink coverage on classic Truffle shoulders:

| Ramp | Lit shoulder | Shadow shoulder |
|---|---:|---:|
| dark ink | 1.77% | 20.04% |
| light ink | 25.61% | 2.22% |

The other styles passed the same polarity check. The stone bevel passed too. Measurements exclude the face patch and outer contour. Full sample coordinates are in `verification.json`.

I inspected the style comparison, all three mood sheets and the day and night phone-width classic proofs.

## Real phone checks still needed

- Use weight 400. Disable kerning and ligatures. Keep the grid LTR and preserve spaces.
- Confirm the actual font. CSS may skip Noto on a vendor device. Check all glyph advances with the existing font probe.
- Check the small comma eyes in wilting and the Sprout mouth at actual phone width.
- Check the Elder cracks against rain. Keep rain behind the opaque sprite.
- Test block coverage before choosing that style. Local Noto gives `▒` about 23% ink coverage and `▓` about 72%. That large jump creates a hard band.
- Keep the ramp switch tied to the palette. Changing only foreground color reverses the apparent lighting.
- The classic ramp is ordinal, not a linear optical scale. A phone rasterizer may change the relative weight of `=`, `+` and `*`.

## Regenerate

This machine already has Python 3, Pillow 10.2.0 and the local font. Numpy is not needed.

```bash
PYTHONDONTWRITEBYTECODE=1 python3 /home/abied/Desktop/Truffle/fleet/outbox/A01/render.py
```

To use a different installed font, pass `--font /absolute/path/to/font.ttf`. This regenerates the same output paths. No network request is made.

The generator reads prior output before replacing it. Unchanged files are left alone. It refuses output paths outside its own directory.
