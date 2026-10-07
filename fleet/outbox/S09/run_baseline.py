#!/usr/bin/env python3
"""Frozen single-turn S09 baseline. Uses only the localhost scratch Worker."""

import argparse
import hashlib
import json
import re
import time
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUDGETS = {"low": 120, "medium": 400, "high": 1200}
MODEL = "@cf/google/gemma-4-26b-a4b-it"
HEADER = (
    "You are Truffle, a desert truffle (faqa) that lives as a small creature in a phone.\n"
    "You only have the energy your person's steps give you.\n"
)
LANGUAGE = "Reply in the language given by lang. Keep to the effort your energy allows."
BLOCK = re.compile(
    r'^\[truffle stage=(Spore|Sprout|Truffle|Elder) energy=(\d+)% '
    r'tier=(low|medium|high) mood=(content|affectionate|tired|wilting|burrowed) '
    r'zero_days=([0-3]) burrowed=(yes|no) weather="([^"\n]+)" '
    r'lang=(en|ar) steps_today=(\d+) avg7=(\d+) age_days=(\d+)\]$'
)


def validate_prompts():
    path = ROOT / "prompts.jsonl"
    prompts = [json.loads(line) for line in path.read_text().splitlines()]
    assert len(prompts) == 20
    assert Counter(p["lang"] for p in prompts) == {"en": 10, "ar": 10}
    assert Counter(p["tier"] for p in prompts) == {"low": 6, "medium": 7, "high": 7}
    assert {p["mood"] for p in prompts} == {
        "content", "affectionate", "tired", "wilting", "burrowed"
    }
    assert {p["id"] for p in prompts} == {
        f"S09-{lang}-{i:02d}" for lang in ("en", "ar") for i in range(1, 11)
    }
    for p in prompts:
        match = BLOCK.fullmatch(p["state_block"])
        assert match, p["id"]
        stage, pct, tier, mood, zero, burrow, weather, lang, steps, avg, age = match.groups()
        pct, zero, steps, avg, age = map(int, (pct, zero, steps, avg, age))
        assert (tier, mood, lang) == (p["tier"], p["mood"], p["lang"])
        assert 0 < pct <= 100
        expected_tier = "low" if pct < 25 else "medium" if pct < 60 else "high"
        assert tier == expected_tier
        maximum = {"Spore": 6000, "Sprout": 12000, "Truffle": 20000, "Elder": 30000}[stage]
        assert maximum * pct / 100 >= {"low": 20, "medium": 60, "high": 200}[tier]
        priority_mood = (
            "burrowed" if burrow == "yes" else "wilting" if zero >= 2
            else "tired" if zero == 1 else None
        )
        assert mood == priority_mood if priority_mood else mood in {"content", "affectionate"}
        assert "Muscat" in weather
        if burrow == "yes":
            assert "44C apparent" in weather
        if mood == "affectionate":
            assert age >= 3  # A compatible hidden affection >= 3 is possible.
        if zero and burrow == "no":
            # Energy was zero at midnight. Today's feed can account for the refill.
            assert maximum * pct / 100 <= steps
        assert not any(c in p["user"] for c in ("–", "—"))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    print(f"Validated {len(prompts)} prompts: en=10 ar=10 low=6 medium=7 high=7", flush=True)
    print(f"prompts.jsonl sha256={digest}", flush=True)
    return prompts, digest


def extract_reply(raw):
    """Keep the original response. Select only final content for the scored reply."""
    reasoning = []
    if isinstance(raw, dict) and raw.get("choices"):
        message = raw["choices"][0].get("message", {})
        for key in ("reasoning", "reasoning_content"):
            if message.get(key):
                reasoning.append({"source": f"message.{key}", "text": message[key]})
        text = message.get("content") or ""
    elif isinstance(raw, dict):
        text = raw.get("response") or ""
    else:
        text = raw if isinstance(raw, str) else ""
    if isinstance(text, list):
        text = "\n".join(part.get("text", "") for part in text if isinstance(part, dict))
    for pattern in (
        r"<think>(.*?)</think>",
        r"<\|channel>thought\s*(.*?)<channel\|>",
    ):
        def remove(match):
            reasoning.append({"source": "inline_thought_block", "text": match.group(1)})
            return ""
        text = re.sub(pattern, remove, text, flags=re.DOTALL)
    # An unclosed thought block at the cap is not a final answer.
    match = re.search(r"<think>|<\|channel>thought", text)
    if match:
        reasoning.append({"source": "unclosed_thought_block", "text": text[match.start():]})
        text = text[:match.start()]
    return text.strip(), reasoning


def run_one(prompt, digest):
    target = ROOT / "transcripts" / f"{prompt['id']}.json"
    if target.exists():
        saved = json.loads(target.read_text())
        assert saved["prompt_sha256"] == digest
        assert saved["prompt"] == prompt
        print(f"SKIP {prompt['id']}: existing transcript is frozen", flush=True)
        return
    request = urllib.request.Request(
        "http://127.0.0.1:8794/run",
        data=json.dumps(prompt, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started_at = datetime.now(timezone.utc).isoformat()
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=300) as response:
        payload = json.load(response)
    end_to_end_ms = round((time.perf_counter() - started) * 1000)
    assert payload["model"] == MODEL
    assert payload["system"] == HEADER + prompt["state_block"] + "\n" + LANGUAGE
    assert payload["input_options"]["max_tokens"] == BUDGETS[prompt["tier"]]
    assert payload["input_options"]["chat_template_kwargs"] == {"enable_thinking": False}
    raw = payload["raw_response"]
    reply, reasoning = extract_reply(raw)
    payload.update({
        "prompt": prompt,
        "prompt_sha256": digest,
        "started_at_utc": started_at,
        "end_to_end_latency_ms": end_to_end_ms,
        "reply_text": reply,
        "reasoning_excluded": reasoning,
        "reasoning_present": bool(reasoning),
        "token_counts": raw.get("usage") if isinstance(raw, dict) else None,
        "finish_reason": (
            raw["choices"][0].get("finish_reason")
            if isinstance(raw, dict) and raw.get("choices") else None
        ),
    })
    # Never replace an existing transcript or retry a successful response.
    with target.open("x", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(
        f"{prompt['id']} tier={prompt['tier']} ai_ms={payload['latency_ms']} "
        f"e2e_ms={end_to_end_ms} finish={payload['finish_reason']} "
        f"reasoning={bool(reasoning)} usage={json.dumps(payload['token_counts'])}",
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--id", help="Run a single stable id. Existing transcripts are skipped.")
    args = parser.parse_args()
    prompts, digest = validate_prompts()
    if args.validate_only:
        return
    if args.id:
        prompts = [p for p in prompts if p["id"] == args.id]
        assert len(prompts) == 1, "Unknown id"
    for prompt in prompts:
        run_one(prompt, digest)


if __name__ == "__main__":
    main()
