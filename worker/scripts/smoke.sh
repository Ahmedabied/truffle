#!/usr/bin/env bash
# Smoke test every route against a running worker. Usage: scripts/smoke.sh https://truffle.ahmed-abied.workers.dev
# Exits non-zero on the first unexpected status. Run after every deploy.
set -u
U="${1:-http://127.0.0.1:8787}"
fail() { echo "FAIL: $*"; exit 1; }
code() { curl -s -o /tmp/truffle-smoke-body -w "%{http_code}" "$@"; }
j() { python3 -c "import json,sys;print(json.load(open('/tmp/truffle-smoke-body'))$1)"; }

[ "$(code "$U/health")" = 200 ] || fail health
C=$(code -X POST "$U/pair" -H 'content-type: application/json' -d '{}')
if [ "$C" = 429 ]; then echo "pair: 429 from the per-IP spawn limiter (5 per hour). Limiter works; rerun later."; exit 0; fi
[ "$C" = 200 ] || fail "pair $C"
PH=$(j "['phrase']"); SEC=$(j "['secret']"); DAY=$(j "['local_day']"); TZ=$(j "['tz']")
[ "$(code -X POST "$U/feed" -H 'content-type: application/json' -d "{\"phrase\":\"$PH\",\"steps_today_total\":2500,\"day\":\"$DAY\",\"day_tz\":\"$TZ\"}")" = 200 ] || fail feed
[ "$(code "$U/state?phrase=$PH" -H "x-truffle-secret: $SEC")" = 200 ] || fail state
[ "$(code "$U/state?phrase=$PH" -H "x-truffle-secret: wrong")" = 401 ] || fail "state wrong secret"
[ "$(code -X POST "$U/spore" -H 'content-type: application/json' -H "x-truffle-secret: $SEC" -d "{\"phrase\":\"$PH\"}")" = 409 ] || fail "spore while alive should be 409, got $(cat /tmp/truffle-smoke-body)"
CHAT=$(curl -sN -X POST "$U/chat" -H 'content-type: application/json' -H "x-truffle-secret: $SEC" -d "{\"phrase\":\"$PH\",\"message\":\"hi\",\"lang\":\"en\"}")
echo "$CHAT" | grep -q '^event: done' || fail "chat: no done event: $(echo "$CHAT" | head -c 300)"
C=$(code -X POST "$U/demo/spawn" -H 'content-type: application/json' -d '{}')
if [ "$C" = 429 ]; then echo "demo/spawn: 429 from the per-IP limiter. Real routes OK; demo routes skipped this run."; exit 0; fi
[ "$C" = 200 ] || fail "demo-spawn $C"
DPH=$(j "['phrase']"); DSEC=$(j "['secret']")
[ "$(code -X POST "$U/demo/slider" -H 'content-type: application/json' -H "x-truffle-secret: $DSEC" -d "{\"phrase\":\"$DPH\",\"steps\":9000}")" = 200 ] || fail demo-slider
[ "$(code -X POST "$U/demo/heat" -H 'content-type: application/json' -H "x-truffle-secret: $DSEC" -d "{\"phrase\":\"$DPH\",\"on\":true}")" = 200 ] || fail demo-heat
[ "$(code -X POST "$U/demo/midnight" -H 'content-type: application/json' -H "x-truffle-secret: $DSEC" -d "{\"phrase\":\"$DPH\"}")" = 200 ] || fail demo-midnight
[ "$(code -X POST "$U/demo/reset" -H 'content-type: application/json' -H "x-truffle-secret: $DSEC" -d "{\"phrase\":\"$DPH\"}")" = 200 ] || fail demo-reset
C=$(code "$U/state?phrase=sand-moon-fig" -H "x-truffle-secret: notasecret"); [ "$C" = 404 ] || [ "$C" = 401 ] || fail "unknown phrase should be 401 or 404, got $C"
echo "SMOKE OK against $U (real phrase $PH, demo phrase $DPH)"
