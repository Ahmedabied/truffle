# U01 Renderer speed spike: 30 fps on a phone
Owner: astra (ultra)        Wave: U (night of Oct 8)        Due: 01:00 Oman Oct 9
Goal: find exactly where the ASCII world spends its frame time and deliver a measured, working speed-up on a copy of the renderer that B15 can lift.
Inputs: web/src/scene/* (world.ts 778 lines, pet.ts, raster.ts, palette.ts), web/src/fps.ts, web/src/main.ts (how the world is drawn), web/index.html, web/src/style.css, fleet/outbox/S08/RESULT.md, decisions/0011, 0018.
Deliverable: fleet/outbox/U01/RESULT.md plus fleet/outbox/U01/fast/ containing a drop-in replacement for whichever scene files you changed, with a diff against main, and a tiny harness (node script) that times compose for 300 frames with the same View inputs before and after.
Acceptance: a table of compose ms per frame before and after (node, same inputs); a written analysis of DOM paint cost for stacked `<pre>` versus one `<canvas>` with a glyph atlas at 100 x 68, with the numbers you measured in headless Chrome if you can run it (`npx playwright` or the chrome-devtools tools are allowed); the web tests still pass with your files dropped in (`cd web && npm test`). Do not edit files under web/ in place: copy to your outbox and work there, then show the diff.
Do not: change the look, change the palette, add dependencies, use emoji.
Report: RESULT.md with the numbers, the three biggest costs you found, the exact changes, and what you would do next with one more hour.
