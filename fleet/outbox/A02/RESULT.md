# A02 result: shaded landscape and sky

## Outcome

Delivered 21 paired form assets and 9 weather row motifs. There are 72 PNGs. Every asset has a day preview and a night preview. All rows retain their trailing spaces.

**Start here:** [Full contact sheet](preview/contact_sheet.png), 1056 x 3223 pixels.

**Then check scale:** [Four composed worlds](preview/scene_contact_sheet.png), 944 x 1258 pixels.

All output is under `fleet/outbox/A02/`. No production file changed. No install, download, service call or git mutation was used. Pillow 10.2.0 and NumPy 1.26.4 were already installed.

## Files

- `fleet/outbox/A02/assets.json`: the requested asset keys. Form assets have `dark` and `light` row arrays. Clouds also have `name`.
- `fleet/outbox/A02/render.py`: deterministic asset generator, Pillow renderer and checks.
- `fleet/outbox/A02/verification.json`: dimensions, occupancy counts, font path and PNG SHA-256 hashes.
- `fleet/outbox/A02/preview/contact_sheet.png`: every asset in both inks.
- `fleet/outbox/A02/preview/scene_contact_sheet.png`: sand and grass worlds, day and night.
- `fleet/outbox/A02/preview/{clouds,sun,moon_phases,landscape,textures,weather}.png`: larger category sheets.
- `fleet/outbox/A02/preview/*_dark-ink.png` and `*_light-ink.png`: individual previews. Four are full-world composition checks.

The JSON is 7,195 bytes. The whole deliverable is about 1.2 MiB.

## My picks

| Use | Pick | Why |
|---|---|---|
| Default drifting cloud | `clouds.medium` | Three rows carry a bright crown, rounded lobes and a shaded base. It leaves room for the moon. |
| One hero cloud | `clouds.large` | The best volume study. Its overlapping puffs are clear in both inks. Use at most one at a time. |
| Distant overcast | `clouds.stratus` | A low, broad bank adds depth without filling the sky. Move it slower than the nearby clouds. |
| Rainy weather | `clouds.storm` | The heavy base reads well in dark ink. Reserve its five rows for storm scenes. |
| Desert | `dunes_far` plus `dunes_near` | Two crest heights and unequal slope lighting replace the flat rule. Offset the near piece toward an edge. |
| Grass country | `hills` | Three filled pine shapes and one low bush fit inside the three-row band. |
| Moon showcase | `moon.waxing_gibbous.light` | The curved terminator and two crater pits survive the small grid. Use the actual phase in production. |
| Horizon event | `sun_horizon` | A clear horizontal cut anchors sunrise or sunset to the land. It is softer in dark ink. |
| Ground | Both fields, unchanged | Only 41 of 360 cells are occupied. Truffle remains the strongest shape. |

For the first integration, I would use medium and small clouds, both dune layers, and the sand field. The large cloud in the scene sheet is a deliberate stress test.

## What creates the depth

- The main ramp is ` .:-=+*#%@`.
- `dark` means more ink in shadow. `light` means more ink in lit areas.
- Clouds are unions of ellipsoids. Their normals face an upper-left light. Their undersides receive extra occlusion.
- The storm base receives a stronger shadow. The one-row wisp is hand-tapered. One row cannot show separate top and bottom bands.
- The sun uses limb darkening and two short side rays. The half disk ends on a 13-cell horizon rule.
- Moons use sphere normals and eight light angles at 45-degree intervals. Waxing lights the right side. Waning lights the left.
- A post-sampling tone curve preserves the tiny crescent tips. The unlit hemisphere becomes blank in light ink. The new moon keeps only six faint earthshine dots.
- Full and gibbous moons have two crater marks. These are `.` pits in light ink and `:` dot pairs in dark ink.
- Dunes use smooth, asymmetric height profiles. Left-facing slopes are lit. Right slip faces are shaded. A low second ridge breaks up the far dune's base.
- Ground ripples and stones use a restrained `.:-` relief ramp. Bright and shaded ends swap between inks. Grass blades remain thin geometric marks.

The surface models use 256 samples per cell. Glyphs use local Noto Sans Mono at 18 px, rendered at 3x and reduced to exactly 11 x 20 px cells. Every form uses one ink colour. There is no painted bitmap shading behind the glyphs.

## Integration notes

Coordinates below are zero-based. Preserve every leading and trailing space. Do not trim these rows.

| Layer | Suggested origin | Occupied rows |
|---|---|---|
| Far dunes, 40 x 4 | `(0, 12)` | 12 to 15 |
| Near dune, 20 x 3 | `(0, 15)` | 15 to 17 |
| Hills, 40 x 3 | `(0, 13)` | 13 to 15 |
| Either ground field, 40 x 9 | `(0, 17)` | 17 to 25 |
| Horizon sun, 13 x 3 | `(14, 13)` | 13 to 15 |

The ground background starts at row 16. Row 16 can remain a calm transition. The field still ends at row 25. HUD rows 26 and 27 are untouched by terrain assets.

- Remove the old full-width horizon rule when using the dune or hill bands.
- Draw the horizon sun before terrain. Its local row 2 is the horizon, not another bright disk row.
- Treat asset padding as transparent. Resolve overlaps to one glyph per cell. Do not overprint two coloured glyphs in a shared cell.
- The moon's dark rows also provide its complete body mask. Use that mask to remove stars behind the blank night-side hemisphere.
- Draw weather before the pet. Keep the pet rectangle opaque, including its spaces.
- The texture clear zone is columns 14 to 25, local rows 2 to 7. Do not scroll the field through that zone.
- Each field has row occupancies `[1, 2, 3, 3, 4, 5, 6, 8, 9]`. Total occupancy is 11.39% in either ink.
- The preview palettes are candidates, not a required replacement for the production palettes.

## Weather vocabulary

`precip` intentionally keeps the requested flat string API. Every value is a 40-column row. These neutral thin marks are identical in both ink directions. Both colour treatments have separate PNG previews.

| Key | Glyphs | Occupied cells per active row |
|---|---|---|
| `rain_light` | apostrophe | 2, or 5% |
| `rain_medium` | apostrophe and vertical bar | 5, or 12.5% |
| `rain_heavy` | vertical bar and slash | 9, or 22.5% |
| `snow_light` | `.` | 2, or 5% |
| `snow_medium` | `.` and `*` | 4, or 10% |
| `snow_heavy` | `.`, `*`, `+` | 7, or 17.5% |
| `heat_1` | `~` | 2, or 5% |
| `heat_2` | `~`, `-` | 3, or 7.5% |
| `heat_3` | `~`, `-` | 5, or 12.5% |

These are row vocabularies, not full fields. Start with every third world row for light rain. Use every other row for medium rain. Heavy is a density ceiling. Reseed or rotate columns between rows to avoid vertical fences. Substitute slash for vertical bar in strong wind. Animate snow more slowly than rain. The heat rows can sit just above the horizon. Freeze all drift under reduced motion.

## Regenerate and verify

From any directory:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 /home/abied/Desktop/Truffle/fleet/outbox/A02/render.py
PYTHONDONTWRITEBYTECODE=1 python3 /home/abied/Desktop/Truffle/fleet/outbox/A02/render.py --check
```

The renderer reads only local resources. It writes only beside itself and into `preview/`. An alternate installed font can be supplied with `--font /absolute/path/to/font.ttf`.

Checks passed:

- All 30 asset dimensions and equal-width rows.
- Printable ASCII plus the single allowed horizon glyph `─`.
- Cloud top-to-bottom ink direction in both modes.
- Left-lit dune slopes in both modes.
- Eight distinct moon phases in each mode.
- Mirrored waxing and waning phases, including craters.
- Shared silhouettes, with blank unlit lunar cells kept inside the body mask.
- Sparse fields, increasing perspective density and the clear pet zone.
- Equal local font advances for the density and structural glyphs.
- All 72 PNGs decoded as RGB images. Their dimensions and hashes match the manifest.
- Individual previews have one cell of padding on every side. All four worlds are exactly 440 x 560 pixels.
- Python syntax compiled in memory. No bytecode output was needed.
- A second full render produced byte-identical assets, manifest and PNGs. All 74 generated files matched.

I inspected the contact sheet, all six category sheets and the four composition previews.

## Limits

These are candidate assets, not a production integration. The three-row trees are stylized. The one-row wisp cannot encode vertical shading. Daytime luminaries are intentionally pale negative-ink forms. The night variants show the sphere shading most clearly. Actual phone rasterization and font fallback still need an on-device visual check.
