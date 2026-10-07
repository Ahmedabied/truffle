# 0004 - All app infrastructure on Cloudflare; the model is not on Cloudflare
Date: 2026-10-07. Decided by: Ahmed.
Workers + Durable Objects + Pages for everything the user touches, for speed and future features (country detection via request.cf, weather switching, language). The GPU brain runs elsewhere (Modal). Workers AI Gemma 4 26B is the always-warm fallback.
