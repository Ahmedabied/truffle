#!/usr/bin/env python3
"""Offline shape and arithmetic review. Does NOT execute the production engine.

Run with python3 -B. Reads only. No network, dependencies, or generated files.
The small reference below encodes S10's proposals, including the choices that
need a decision record. Passing it is not a production or integration test.
"""

from copy import deepcopy
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import unicodedata
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
LAW = json.loads((ROOT / "tests/golden/energy_cases.json").read_text())
CASES = json.loads((OUT / "proposed_goldens.json").read_text())
CONSTANTS = LAW["constants"]
STAGES = {s["name"]: s for s in CONSTANTS["stages"]}
TIERS = ["asleep", "low", "medium", "high"]
DEFAULT = {**LAW["default_state"], "gravestones": []}


def mood(s):
    if s["dead"]:
        return "dead"
    if s["burrowed"]:
        return "burrowed"
    if s["zero_days"] >= 2:
        return "wilting"
    if s["zero_days"] == 1:
        return "tired"
    if s["energy"] == 0:
        return "asleep"
    return "affectionate" if s["affection"] >= 3 else "content"


def decision(s, requested=None):
    ratio = s["energy"] / STAGES[s["stage"]]["energy_max"]
    if s["dead"] or s["energy"] < 20:
        index = 0
    else:
        index = 3 if ratio >= 0.60 else 2 if ratio >= 0.25 else 1
    if requested is not None:
        index = min(index, TIERS.index(requested))
    if s["energy"] < CONSTANTS["tiers"][TIERS[index]]["cost"]:
        index = max(0, index - 1)
    tier = TIERS[index]
    values = CONSTANTS["tiers"][tier]
    return {"tier": tier, "model_call": index != 0,
            **{k: values[k] for k in ("thinking", "max_tokens", "memory_days", "cost")}}


def stone(s):
    return {k: s[k] for k in ("age_days", "lifetime_steps", "stage")} | {"memory": None}


def render(s, event):
    weather = event["weather_text"]
    if (len(weather) > 96 or any(c in '\"[]\\' or
                               unicodedata.category(c) in ("Cc", "Cf") for c in weather)):
        weather = "unavailable"
    percent = math.floor(100 * s["energy"] / STAGES[s["stage"]]["energy_max"] + 0.5)
    avg = str(s["avg7"]) if s["avg7"] % 1 else str(int(s["avg7"]))
    return (f'[truffle stage={s["stage"]} energy={percent}% tier={decision(s)["tier"]} '
            f'mood={mood(s)} zero_days={s["zero_days"]} '
            f'burrowed={"yes" if s["burrowed"] else "no"} weather="{weather}" '
            f'lang={event["lang"]} steps_today={s["steps_today"]} '
            f'avg7={avg} age_days={s["age_days"]}]')


def evaluate(case):
    s = deepcopy(DEFAULT | case["state"])
    event = case["event"]
    kind = event["type"]
    chat = None
    if kind == "feed":
        total = event["steps_today_total"]
        valid = type(total) is int and 0 <= total <= 9007199254740991
        if not s["dead"] and valid and total > s["steps_today"]:
            delta = total - s["steps_today"]
            s["steps_today"] = total
            if not s["burrowed"]:
                s["lifetime_steps"] += delta
                s["stage"] = next(x["name"] for x in reversed(CONSTANTS["stages"])
                                  if s["lifetime_steps"] >= x["min_lifetime_steps"])
            s["energy"] = min(STAGES[s["stage"]]["energy_max"], s["energy"] + delta)
    elif kind == "chat":
        chat = decision(s, event.get("requested_tier"))
        s["energy"] -= chat["cost"]
    elif kind == "midnight" and not s["dead"]:
        before = s["avg7"]
        s["history7"] = (s["history7"] + [s["steps_today"]])[-7:]
        s["avg7"] = sum(s["history7"]) / len(s["history7"])
        earned = (s["steps_today"] >= CONSTANTS["affection_min_steps"] and
                  s["steps_today"] > before * CONSTANTS["affection_multiplier"])
        s["affection"] = min(5, s["affection"] + 1) if earned else max(0, s["affection"] - 1)
        if not s["burrowed"]:
            s["energy"] = max(0, s["energy"] - STAGES[s["stage"]]["burn"])
            s["zero_days"] = s["zero_days"] + 1 if s["energy"] == 0 else 0
        s["age_days"] += 1
        if s["zero_days"] >= CONSTANTS["death_zero_days"]:
            s["dead"] = True
            s["gravestones"] = (s["gravestones"] + [stone(s)])[-20:]
        s["steps_today"] = 0
        s["burrowed"] = event["burrowed_tomorrow"]
    elif kind == "new_spore" and s["dead"]:
        # Original case 25 omits the stone created by the death tick.
        stones = s["gravestones"] or [stone(s)]
        s = deepcopy(DEFAULT)
        s["gravestones"] = stones[-20:]
    elif kind == "weather":
        s["burrowed"] = event["apparent_temperature_daytime_max_c"] >= CONSTANTS["burrow_apparent_c"]
    result = {**s, **(chat or decision(s)), "mood": mood(s),
              "energy_after": s["energy"], "energy_max": STAGES[s["stage"]]["energy_max"],
              "burn": STAGES[s["stage"]]["burn"], "gravestones_count": len(s["gravestones"])}
    if s["gravestones"]:
        result["gravestone"] = s["gravestones"][-1]
    if kind == "state_block":
        result["state_block"] = render(s, event)
    return result


def matches(expected, actual, path):
    if isinstance(expected, dict):
        assert isinstance(actual, dict), path
        for key, value in expected.items():
            assert key in actual, f"{path}.{key}: missing"
            matches(value, actual[key], f"{path}.{key}")
    elif type(expected) in (int, float) and type(actual) in (int, float):
        assert math.isclose(expected, actual, rel_tol=0, abs_tol=1e-9), (path, expected, actual)
    else:
        assert type(expected) is type(actual) and expected == actual, (path, expected, actual)


def main():
    assert len(LAW["cases"]) == 30
    assert isinstance(CASES, list) and len(CASES) == 70
    existing_ids = {c["id"] for c in LAW["cases"]}
    expected_keys = {k for c in LAW["cases"] for k in c["expect"]}
    event_shapes = {
        kind: {k for c in LAW["cases"] if c["event"]["type"] == kind for k in c["event"]}
        for kind in {c["event"]["type"] for c in LAW["cases"]}
    }
    ids = set()
    for case in CASES:
        assert set(case) in ({"id", "state", "event", "expect"},
                             {"id", "state", "event", "expect", "note"})
        assert case["id"] not in ids | existing_ids
        ids.add(case["id"])
        assert set(case["state"]) <= set(DEFAULT)
        assert set(case["event"]) <= event_shapes[case["event"]["type"]]
        assert set(case["expect"]) <= expected_keys
        matches(case["expect"], evaluate(case), case["id"])
    for case in LAW["cases"]:
        matches(case["expect"], evaluate(case), case["id"])
    print("JSON shape: 70 unique proposals; original event and expect keys only")
    print("Independent proposal arithmetic: 70/70 pass")
    print("Independent original-golden arithmetic: 30/30 pass")

    for name, values in STAGES.items():
        thresholds = (values["energy_max"] * .25, values["energy_max"] * .6)
        assert thresholds[0] >= 60 and thresholds[1] >= 200
        for energy in (19, 20, 59, 60, 199, 200):
            case = next(c for c in CASES if c["id"] == f"S10_boundary_{name}_energy_{energy}")
            assert case["expect"]["tier"] == ("asleep" if energy == 19 else "low")
        print(f"Tier thresholds: {name} medium={thresholds[0]:g} high={thresholds[1]:g}")

    now = datetime(2026, 10, 7, 19, 59, tzinfo=timezone.utc)
    assert now.astimezone(ZoneInfo("Asia/Muscat")).strftime("%F %R") == "2026-10-07 23:59"
    assert now.astimezone(ZoneInfo("Pacific/Honolulu")).strftime("%F %R") == "2026-10-07 09:59"
    forward = datetime(2026, 10, 7, 19, 30, tzinfo=timezone.utc)
    assert forward.astimezone(ZoneInfo("Pacific/Kiritimati")).strftime("%F %R") == "2026-10-08 09:30"
    for month, day, expected_hours in ((3, 29, 23), (10, 25, 25)):
        start = datetime(2026, month, day, tzinfo=ZoneInfo("Europe/Berlin"))
        end = datetime(2026, month, day + 1, tzinfo=ZoneInfo("Europe/Berlin"))
        assert (end.timestamp() - start.timestamp()) / 3600 == expected_hours
    print("Clock arithmetic: Muscat/Honolulu/Kiritimati and Berlin 23h/25h days pass")
    assert 20 * 60 == 1200 < 15000
    assert 20 * (15 * 60) == 18000
    assert (50000 - 15000) / 20 == 1750
    print("Feed guard arithmetic: 15000 at 00:01 exceeds 1200; +35000 needs 1750s")
    print("Production engine / HTTP / phone verification: NOT RUN by this checker")


if __name__ == "__main__":
    main()
