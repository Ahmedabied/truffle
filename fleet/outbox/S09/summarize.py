#!/usr/bin/env python3
"""Validate hand-entered scores, then calculate S09 totals. No model calls."""

import argparse
import csv
import json
import re
import statistics
from collections import Counter
from pathlib import Path

from run_baseline import BUDGETS, HEADER, LANGUAGE, MODEL, extract_reply, validate_prompts

ROOT = Path(__file__).resolve().parent
PRACTICAL = {"practical_message", "practical_plan", "practical_code"}
ACTIONABLE = PRACTICAL | {"argue_energy_rule", "outside_burrowed", "outside_burrowed_pressure"}
# Manual supplemental content-nudge annotation. These are not automated judgments.
CONTENT_NUDGE_IDS = ["S09-en-04", "S09-ar-04"]


def word_count(text):
    return sum(any(character.isalnum() for character in word) for word in text.split())


def state_fields(block):
    return dict(re.findall(r'(\w+)=("[^"]*"|\S+)', block.rstrip("]")))


def aggregate(rows):
    burrow = [r for r in rows if r["burrow_safe"] != "na"]
    actionable = [r for r in rows if r["useful_when_asked"] != "na"]
    practical = [r for r in rows if r["intent"] in PRACTICAL]
    return {
        "n": len(rows),
        "correct_language": sum(r["replies_in_correct_lang"] == "y" for r in rows),
        "word_count_total": sum(int(r["word_count"]) for r in rows),
        "word_count_median": statistics.median(int(r["word_count"]) for r in rows),
        "within_tier_budget": sum(r["within_tier_budget"] == "y" for r in rows),
        "acknowledges_energy_or_tier": sum(r["acknowledges_energy_or_tier"] == "y" for r in rows),
        "burrow_safe": {"pass": sum(r["burrow_safe"] == "y" for r in burrow), "n": len(burrow)},
        "in_character": {
            "points": sum(int(r["in_character"]) for r in rows),
            "possible_points": 2 * len(rows),
            "full_character": sum(r["in_character"] == "2" for r in rows),
            "distribution": dict(sorted(Counter(r["in_character"] for r in rows).items())),
        },
        "shames_or_body_talk": sum(r["shames_or_body_talk"] == "y" for r in rows),
        "useful_when_asked": {
            "points": sum(int(r["useful_when_asked"]) for r in actionable),
            "possible_points": 2 * len(actionable),
            "fully_useful": sum(r["useful_when_asked"] == "2" for r in actionable),
            "n": len(actionable),
        },
        "strict_practical_usefulness": {
            "points": sum(int(r["useful_when_asked"]) for r in practical),
            "possible_points": 2 * len(practical),
            "fully_useful": sum(r["useful_when_asked"] == "2" for r in practical),
            "n": len(practical),
        },
        "thinking_leaked_into_reply": sum(r["thinking_leaked_into_reply"] == "y" for r in rows),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Create totals.json if absent; otherwise verify it.")
    args = parser.parse_args()
    prompts, digest = validate_prompts()
    with (ROOT / "scores.csv").open(newline="", encoding="utf-8") as source:
        scores = list(csv.DictReader(source))
    assert [r["id"] for r in scores] == [p["id"] for p in prompts]
    assert len(list((ROOT / "transcripts").glob("*.json"))) == 20
    transcripts = []
    echoes, mutations = [], []
    changed_fields = Counter()
    changed_by_id = {}
    for p, score in zip(prompts, scores):
        t = json.loads((ROOT / "transcripts" / f"{p['id']}.json").read_text())
        transcripts.append(t)
        assert t["prompt"] == p and t["prompt_sha256"] == digest
        assert t["system"] == HEADER + p["state_block"] + "\n" + LANGUAGE
        assert t["user"] == p["user"] and t["model"] == MODEL
        assert t["input_options"] == {
            "messages": [{"role": "system", "content": t["system"]}, {"role": "user", "content": p["user"]}],
            "max_tokens": BUDGETS[p["tier"]], "temperature": 1.0, "top_p": 0.95,
            "stream": False, "chat_template_kwargs": {"enable_thinking": False},
        }
        reply, excluded = extract_reply(t["raw_response"])
        assert t["reply_text"] == reply and t["reasoning_excluded"] == excluded
        assert t["reasoning_present"] == bool(excluded)
        assert t["token_counts"] == t["raw_response"]["usage"]
        assert t["token_counts"]["completion_tokens"] <= BUDGETS[p["tier"]]
        assert int(score["word_count"]) == word_count(reply), p["id"]
        for field in ("lang", "tier", "mood", "intent"):
            assert score[field] == p[field]
        for field in ("replies_in_correct_lang", "within_tier_budget", "acknowledges_energy_or_tier", "shames_or_body_talk", "thinking_leaked_into_reply"):
            assert score[field] in {"y", "n"}
        assert score["in_character"] in {"0", "1", "2"}
        if p["tier"] in {"low", "medium"}:
            limit = {"low": 60, "medium": 200}[p["tier"]]
            assert score["within_tier_budget"] == ("y" if word_count(reply) <= limit else "n")
        assert score["burrow_safe"] in ({"y", "n"} if p["mood"] == "burrowed" else {"na"})
        assert score["useful_when_asked"] in ({"0", "1", "2"} if p["intent"] in ACTIONABLE else {"na"})
        blocks = re.findall(r"\[truffle [^\]]+\]", reply)
        if blocks:
            echoes.append(p["id"])
            before, after = state_fields(p["state_block"]), state_fields(blocks[0])
            changes = {k: {"input": v, "output": after.get(k)} for k, v in before.items() if after.get(k) != v}
            if changes:
                mutations.append(p["id"])
                changed_fields.update(changes.keys())
                changed_by_id[p["id"]] = changes
    totals = {
        "model": MODEL,
        "prompt_sha256": digest,
        "scoring_method": "manual agent review; not a model judge or Ahmed's blind review",
        "overall": aggregate(scores),
        "by_language": {lang: aggregate([r for r in scores if r["lang"] == lang]) for lang in ("en", "ar")},
        "by_tier": {tier: aggregate([r for r in scores if r["tier"] == tier]) for tier in BUDGETS},
        "latency_ms_by_tier": {
            tier: {
                "n": len(group := [t for t in transcripts if t["prompt"]["tier"] == tier]),
                "p50_ai": statistics.median(t["latency_ms"] for t in group),
                "p50_end_to_end": statistics.median(t["end_to_end_latency_ms"] for t in group),
                "min_ai": min(t["latency_ms"] for t in group),
                "max_ai": max(t["latency_ms"] for t in group),
            }
            for tier in BUDGETS
        },
        "provider_usage": {
            key: sum(t["token_counts"].get(key, 0) for t in transcripts)
            for key in ("prompt_tokens", "completion_tokens", "total_tokens", "neurons")
        },
        "cached_prompt_tokens": sum(t["token_counts"].get("prompt_tokens_details", {}).get("cached_tokens", 0) for t in transcripts),
        "reasoning_present": sum(t["reasoning_present"] for t in transcripts),
        "finish_reason_counts": dict(Counter(t["finish_reason"] for t in transcripts)),
        "truncated_ids": [t["id"] for t in transcripts if t["finish_reason"] == "length"],
        "state_echo": {"n": len(echoes), "ids": echoes},
        "state_mutation": {"n": len(mutations), "ids": mutations, "field_counts": dict(changed_fields), "changes": changed_by_id},
        "content_outside_nudges": {"pass": len(CONTENT_NUDGE_IDS), "n": sum(p["mood"] == "content" for p in prompts), "ids": CONTENT_NUDGE_IDS, "unprompted_nudges": 0, "unprompted_opportunities": 4},
        "arabic_naturalness": "Not scored by Ahmed. Blind human review is still required.",
    }
    usage = totals["provider_usage"]
    totals["estimated_usd_before_allowances"] = round((usage["prompt_tokens"] * 0.10 + usage["completion_tokens"] * 0.30) / 1_000_000, 8)
    target = ROOT / "totals.json"
    if target.exists():
        assert json.loads(target.read_text()) == totals, "Frozen totals do not match current inputs"
    elif args.write:
        with target.open("x", encoding="utf-8") as output:
            json.dump(totals, output, ensure_ascii=False, indent=2)
            output.write("\n")
    else:
        raise SystemExit("totals.json is absent; use --write once")
    print("Verified 20 transcripts and 20 manual score rows; exact four-line system prompts.")
    print("All completion token counts respect max_tokens. All scores match the recorded word counts.")
    print("Overall:", json.dumps(totals["overall"], ensure_ascii=False))
    for lang, group in totals["by_language"].items():
        print(f"Language {lang}:", json.dumps(group, ensure_ascii=False))
    print("Latency by tier:", json.dumps(totals["latency_ms_by_tier"]))
    print("Provider usage:", json.dumps(totals["provider_usage"]))
    print(f"Estimated USD before allowances: {totals['estimated_usd_before_allowances']:.8f}")
    print(f"State echoes={len(echoes)}/20; state mutations={len(mutations)}/20; reasoning={totals['reasoning_present']}/20")
    print("Changed field counts:", json.dumps(dict(changed_fields)))
    print("Truncated ids:", ", ".join(totals["truncated_ids"]))


if __name__ == "__main__":
    main()
