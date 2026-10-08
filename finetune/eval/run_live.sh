#!/usr/bin/env bash
# Base vs tuned on the live Modal endpoint. Tokens come from files, never from args.
#   ~/.config/truffle/brain_token   bearer for the Modal proxy (both model names)
#   ~/.config/truffle/cf_api_token  Cloudflare API token with Workers AI read (judge), optional
# Usage: finetune/eval/run_live.sh <run-id> [extra run_eval.py args]
set -euo pipefail
RUN="${1:?run id, for example 2026-10-09-r16}"; shift || true
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
URL="${TRUFFLE_BRAIN_URL:-https://ahmedabied--truffle-brain-nosnap-brain-serve.modal.run}"
ACCOUNT="cff71a70d4fd3a3118a5ffdc4db8a47c"
export BRAIN_TOKEN="$(cat "$HOME/.config/truffle/brain_token")"
export TUNED_TOKEN="$BRAIN_TOKEN"
if [ -f "$HOME/.config/truffle/cf_api_token" ]; then
  export JUDGE_TOKEN="$(cat "$HOME/.config/truffle/cf_api_token")"
  JUDGE=(--judge-url "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/ai/v1" --judge-model "@cf/google/gemma-4-26b-a4b-it")
else
  echo "no cf_api_token file: judging with the un-tuned base on Modal (weaker, same-family judge)" >&2
  export JUDGE_TOKEN="$BRAIN_TOKEN"
  JUDGE=(--judge-url "$URL/v1" --judge-model truffle-base)
fi
# The brain serves two sequences at a time; keep the harness at that.
exec python3 -I "$ROOT/finetune/eval/run_eval.py" \
  --prompts "$ROOT/finetune/eval/prompts.jsonl" \
  --holdout "$ROOT/finetune/data/generated/eval_holdout.jsonl" \
  --base-url "$URL/v1" --base-model truffle-base \
  --tuned-url "$URL/v1" --tuned-model truffle \
  "${JUDGE[@]}" --concurrency 2 --run "$RUN" "$@"
