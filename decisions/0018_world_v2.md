# 0018 World v2: 30 fps and a richer scene

Date: 2026-10-08, 23:30 Oman. Status: accepted.

## Decision

The ASCII world keeps decision 0011 (dense dither, procedural, lit ellipsoids) and moves from 12 fps to a 30 fps target on a mid Android phone, with more life in the scene. The renderer may switch the output surface from stacked `<pre>` layers to one `<canvas>` drawn from a glyph atlas if the measured paint cost demands it. The grid stays 100 x 68 cells, Arabic never enters the grid, reduced motion still freezes the clock.

Acceptance is measured, not felt: `?fps=1` on Chrome with a mobile viewport and 4x CPU throttling must read 30 fps or better, and a real reading from Ahmed's Samsung goes into STATE.md.

Detail added, in priority order: Truffle breathing, blinking and mood poses; wind in grass and sand; rain streaks with ground splashes; stars that twinkle and a visible moon phase; heat shimmer and a dug mound on burrowed days; fireflies after dark; birds at dawn and dusk; celebration effects for moments (decision 0017); the gravestone scene and the spore rebirth.

## Why

Ahmed's phone read 12 fps and the scene reads as a still with a drifting cloud. The world is the first thing a judge sees. Speed and life in the scene are the cheapest jaw-drop available tonight, and the renderer is already procedural, so detail is code, not pixel art.
