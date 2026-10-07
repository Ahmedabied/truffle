#!/usr/bin/env python3
"""Summarize saved observations without another inference call."""
import json
from pathlib import Path
import statistics

RAW = Path(__file__).resolve().parents[1] / "raw"


def load(name):
    return json.loads((RAW / name).read_text())


def valid_facts(response):
    try:
        value = json.loads(response["choices"][0]["message"]["content"])
        return (isinstance(value, dict) and set(value) == {"facts"}
                and isinstance(value["facts"], list) and len(value["facts"]) <= 3
                and all(isinstance(fact, str) for fact in value["facts"]))
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return False


usage_rows = []
for path in sorted(RAW.glob("*.json")):
    if path.name == "summary.json" or any(part in path.name for part in [".schema.", ".metrics.", ".input.", ".events."]):
        continue
    response = load(path.name)
    if not isinstance(response, dict):
        continue
    if ".assembled." in path.name:
        usage = response["usage_events"][-1]
    elif "usage" in response and ("choices" in response or "text" in response):
        usage = response["usage"]
    else:
        continue
    usage_rows.append({"file": path.name, **usage})

sums = {key: sum(row.get(key, 0) for row in usage_rows)
        for key in ["prompt_tokens", "completion_tokens", "total_tokens", "neurons"]}
off_rows = []
for i in range(1, 6):
    response = load(f"thinking-off-{i}.json")
    choice = response["choices"][0]
    message = choice["message"]
    content = message.get("content") or ""
    has_reasoning = bool(message.get("reasoning") or message.get("reasoning_content"))
    tags = any(tag in content for tag in ["<thought>", "<think>", "<|channel>", "<|channel|>"])
    off_rows.append({"run": i, "reasoning_present": has_reasoning,
                     "inline_thought_tags": tags, "content": content,
                     "finish_reason": choice["finish_reason"], "usage": response["usage"]})
latency = []
for i in range(1, 4):
    metrics = load(f"latency-{i}.metrics.json")
    assembled = load(f"latency-{i}.assembled.json")
    latency.append({"run": i,
                    "first_content_seconds": metrics["first_content_delta_seconds"],
                    "first_byte_seconds": metrics["curl"]["time_starttransfer"],
                    "total_seconds": metrics["curl"]["time_total"],
                    "usage": assembled["usage_events"][-1],
                    "finish_reason": assembled["finish_reasons"]})
summary = {
    "all_real_calls": 33,
    "calls_with_saved_usage": len(usage_rows),
    "unmetered_helper_calls": ["snippet-stream", "snippet-extract"],
    "observed_usage_sum": sums,
    "observed_paid_rate_value_usd": sums["neurons"] * 0.011 / 1000,
    "usage_rows": usage_rows,
    "thinking_off_runs": off_rows,
    "extract_valid_runs": sum(valid_facts(load(f"extract-{i}.json")) for i in range(1, 6)),
    "extract_total_runs": 5,
    "latency": latency,
    "mean_first_content_seconds": statistics.mean(row["first_content_seconds"] for row in latency),
    "mean_total_seconds": statistics.mean(row["total_seconds"] for row in latency),
}
print(json.dumps(summary, ensure_ascii=False, indent=2))
