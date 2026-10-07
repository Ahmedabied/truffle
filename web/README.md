# web

The ASCII world, chat and judge mode. Vanilla TypeScript and Vite. No framework, no canvas. See docs/01 (ASCII world, judge mode) and docs/02.

## Run

```
npm run dev          # http://localhost:5173, talks to http://localhost:8787
npm run typecheck
npm run build        # dist/, about 39 KB of JS
```

`VITE_API_BASE` sets the Worker URL at build time. The default in production is `https://truffle.ahmed-abied.workers.dev`. You can also change it at runtime in Settings. It is stored in localStorage.

## Routes

- `/` is your own Truffle. It pairs on first visit and stores the phrase and secret in localStorage.
- `/demo` (or `?demo=1`) is judge mode: a fresh demo Truffle, a steps slider, next midnight, heat toggle and reset.

## Offline demo

If the Worker cannot be reached at startup, or with `?mock=1`, the page runs a small simulation in the browser and shows "offline demo". It imports the real engine from `../worker/src/engine.ts`, so tiers, moods, feeding and midnight follow the same rules. Only the replies are canned.

Debug parameters for the offline demo: `scene=content|affectionate|asleep|tired|wilting|burrowed|dead|spore|sprout|elder|fresh`, `hour=0..23`, `rain=1`, `wind=0..40`, `cold=1` (slow half-awake brain).

## Files

- `src/api.ts`: typed client, SSE parser for `/chat`, timeouts, backend selection.
- `src/mock.ts`: the offline demo backend.
- `src/scene/`: grid fitting, sky palette, world composition and the 12 fps loop.
- `src/sprites.ts`: Truffle per stage and mood, gravestone, burrow mound.
- `src/chat.ts`: input line, tier-speed typing, yawn, explanation line.
- `src/copy.ts`: UI copy in English and Arabic.
- `src/main.ts`: boot, pairing, polling, settings, judge mode.

## Deploy

`wrangler.jsonc` serves `dist/` as Workers static assets with single-page fallback, so `/demo` works. Build, then `npx wrangler deploy` from this folder. Add the site's origin to the Worker's `ALLOWED_ORIGINS`.
