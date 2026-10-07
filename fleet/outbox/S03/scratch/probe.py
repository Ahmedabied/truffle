#!/usr/bin/env python3
"""Real binding probes. All HTTP calls go through curl on localhost:8793."""
import json
from pathlib import Path
import subprocess
import sys
import time

RAW = Path(__file__).resolve().parents[1] / "raw"
BASE = "http://127.0.0.1:8793"


def probe(name, path, streaming=False):
    stem = RAW / name
    if stem.with_suffix(".input.json").exists():
        raise RuntimeError(f"Refusing to overwrite existing evidence for {name}")
    separator = "&" if "?" in path else "?"
    manifest = subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--max-time", "30", BASE + path + separator + "input=true"],
        check=True, capture_output=True,
    ).stdout
    stem.with_suffix(".input.json").write_bytes(manifest)
    command = [
        "curl", "--silent", "--show-error", "--no-buffer", "--max-time", "180",
        "-D", str(stem.with_suffix(".headers.txt")),
        "-w", '%{stderr}{"http_code":%{http_code},"time_starttransfer":%{time_starttransfer},"time_total":%{time_total}}\n',
        BASE + path,
    ]
    started = time.perf_counter()
    proc = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
    body = bytearray()
    event_lines = []
    timings = []
    first_event = None
    first_content = None
    first_reasoning = None
    chunks = []
    usages = []
    while True:
        line = proc.stdout.readline()
        if not line:
            break
        now = time.perf_counter() - started
        body.extend(line)
        if not streaming:
            continue
        if line.strip():
            event_lines.append(line)
            continue
        event = b"".join(event_lines).decode("utf-8")
        event_lines.clear()
        payload = "\n".join(x[5:].lstrip(" ") for x in event.splitlines() if x.startswith("data:"))
        timings.append({"seconds": now, "data": payload})
        if first_event is None:
            first_event = now
        if not payload or payload == "[DONE]":
            continue
        try:
            chunk = json.loads(payload)
        except json.JSONDecodeError:
            continue
        chunks.append(chunk)
        if chunk.get("usage"):
            usages.append(chunk["usage"])
        for choice in chunk.get("choices", []):
            delta = choice.get("delta") or {}
            if delta.get("content") and first_content is None:
                first_content = now
            if (delta.get("reasoning") or delta.get("reasoning_content")) and first_reasoning is None:
                first_reasoning = now
    stderr = proc.stderr.read().decode("utf-8")
    proc.wait()
    elapsed = time.perf_counter() - started
    stem.with_suffix(".sse" if streaming else ".json").write_bytes(body)
    curl_metrics = None
    for line in stderr.splitlines():
        try:
            curl_metrics = json.loads(line)
        except json.JSONDecodeError:
            pass
    metrics = {
        "name": name, "path": path, "command": command,
        "curl_exit_code": proc.returncode,
        "curl": curl_metrics,
        "client_total_seconds": elapsed,
        "first_sse_event_seconds": first_event,
        "first_content_delta_seconds": first_content,
        "first_reasoning_delta_seconds": first_reasoning,
    }
    if streaming:
        stem.with_suffix(".events.json").write_text(json.dumps(timings, ensure_ascii=False, indent=2) + "\n")
        content = "".join(c.get("delta", {}).get("content") or "" for e in chunks for c in e.get("choices", []))
        reasoning = "".join(c.get("delta", {}).get("reasoning") or c.get("delta", {}).get("reasoning_content") or "" for e in chunks for c in e.get("choices", []))
        summary = {"content": content, "reasoning": reasoning, "usage_events": usages,
                   "finish_reasons": [c["finish_reason"] for e in chunks for c in e.get("choices", []) if c.get("finish_reason")]}
        stem.with_suffix(".assembled.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    else:
        try:
            summary = json.loads(body)
        except json.JSONDecodeError:
            summary = {"error": "Response was not JSON"}
    metrics["curl_stderr"] = stderr
    stem.with_suffix(".metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps({"name": name, "metrics": metrics, "result": summary}, ensure_ascii=False), flush=True)
    if proc.returncode:
        raise RuntimeError(f"curl failed for {name}")


group = sys.argv[1]
if group == "stream":
    probe("stream-off", "/stream", True)
    probe("stream-on", "/stream?variant=on&max_tokens=400", True)
elif group == "thinking":
    for variant in ["default", "on", "off-clear", "on-clear", "top-level-off", "reasoning-none"]:
        probe("thinking-" + variant, "/thinking?variant=" + variant)
    for i in range(1, 6):
        probe(f"thinking-off-{i}", "/thinking?variant=off")
elif group == "extract":
    for i in range(1, 6):
        probe(f"extract-{i}", "/extract")
    probe("extract-direct", "/extract?format=direct")
elif group == "arabic":
    probe("arabic-off", "/arabic")
    probe("arabic-default", "/arabic?variant=default")
elif group == "latency":
    for i in range(1, 4):
        probe(f"latency-{i}", "/latency", True)
elif group == "high":
    probe("thinking-on-high", "/thinking?variant=on&max_tokens=1200")
    probe("stream-on-high", "/stream?variant=on&max_tokens=1200", True)
elif group == "extra":
    probe("thinking-on-high-stream", "/thinking?variant=on&max_tokens=1200&stream=true", True)
    probe("extract-stress-wrapped", "/extract?stress=true")
    probe("extract-stress-direct", "/extract?stress=true&format=direct")
else:
    raise ValueError(group)
