#!/usr/bin/env python3
"""Rule-only style counts for an eval run: emoji, stage directions, markdown,
energy mentions, median words, per side and per tier. Also shows how the judge's
in-character verdict moves with emoji and stage directions, which is the bias
check for a same-family judge.

    python3 finetune/eval/style_counts.py finetune/eval/out/<run>
"""
import json, re, statistics, sys
from pathlib import Path

EMOJI = re.compile(r"[\U0001F300-\U0001FAFF☀-➿⭐⭕]")
STAGE = re.compile(r"(^|\n)\s*[\*\(（].{2,80}?[\*\)）]|\*[^*\n]{2,60}\*")
MD = re.compile(r"\*\*|^#|^- |^\d+\. ", re.M)
ENERGY = re.compile(r"energy|steps|walk|طاقة|خطوات|مشي|امش", re.I)


def load(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def stats(rows):
    n = len(rows)
    if not n:
        return {}
    pct = lambda k: f"{sum(1 for r in rows if k(r['reply'])) / n:.0%}"
    return {
        "n": n,
        "emoji": pct(EMOJI.search),
        "stage_dir": pct(STAGE.search),
        "markdown": pct(MD.search),
        "mentions_energy": pct(ENERGY.search),
        "median_words": statistics.median(len(r["reply"].split()) for r in rows),
    }


def ic(r):
    return (r.get("judge") or {}).get("in_character")


def main(run_dir):
    run_dir = Path(run_dir)
    sides = {"base": load(run_dir / "base.jsonl"), "tuned": load(run_dir / "tuned.jsonl")}
    print("| Side | Tier | n | Emoji | Stage directions | Markdown | Mentions energy or steps | Median words |")
    print("|---|---|---|---|---|---|---|---|")
    for name, rows in sides.items():
        for tier in ("all", "low", "medium", "high"):
            s = stats(rows if tier == "all" else [r for r in rows if r["tier"] == tier])
            print(f"| {name} | {tier} | {s['n']} | {s['emoji']} | {s['stage_dir']} | {s['markdown']} | {s['mentions_energy']} | {s['median_words']:g} |")
    print()
    print("Judge in-character rate split by whether the reply has emoji or a stage direction:")
    for name, rows in sides.items():
        drama = [r for r in rows if EMOJI.search(r["reply"]) or STAGE.search(r["reply"])]
        plain = [r for r in rows if not (EMOJI.search(r["reply"]) or STAGE.search(r["reply"]))]
        f = lambda rs: f"{sum(1 for r in rs if ic(r) == 1) / max(1, len(rs)):.0%} (n={len(rs)})"
        print(f"- {name}: with emoji or stage direction {f(drama)}, plain {f(plain)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "finetune/eval/out/2026-10-08-r16")
