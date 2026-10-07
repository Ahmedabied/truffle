#!/usr/bin/env python3
"""Truffle fine-tune data filter. Stdlib only. Runs anywhere.

Reads Wave B shards (fleet/outbox/D*/shard.jsonl by default), validates the
schema in finetune/data/schema.md, drops unsafe or off-budget examples,
dedupes, and splits a stratified hold-out set.

    python3 -I finetune/filter.py                      # build train + eval_holdout
    python3 -I finetune/filter.py --glob 'fleet/outbox/D07/shard.jsonl' --dry
    python3 -I finetune/filter.py --selftest

The rule helpers here (TermList, burrow_violation, rule_checks, ...) are also
imported by finetune/eval/run_eval.py so training data and eval use one set
of lists.
"""

from __future__ import annotations

import argparse
import copy
import glob
import hashlib
import json
import random
import re
import sys
import tempfile
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
FILTERS = HERE / "filters"
DEFAULT_GLOB = "fleet/outbox/D*/shard.jsonl"
DEFAULT_OUT = HERE / "data" / "generated"

PERSONA_HEADER = (
    "You are Truffle, a desert truffle (faqa) that lives as a small creature in a phone.\n"
    "You only have the energy your person's steps give you.\n"
)
LANGUAGE_LINE = "Reply in the language given by lang. Keep to the effort your energy allows."

# Words per assistant turn. High is "free but on task"; 600 words is a sanity cap
# (the Worker gives high tier 1,200 tokens).
WORD_BUDGETS = {"low": 60, "medium": 200, "high": 600}
# Output token caps per tier, from docs/01 (used by the eval harness).
TOKEN_CAPS = {"low": 120, "medium": 400, "high": 1200}

TIERS = ("low", "medium", "high")
LANGS = ("en", "ar", "mixed")
MOODS = ("content", "affectionate", "tired", "wilting", "burrowed", "just_woke")
BLOCK_MOODS = ("content", "affectionate", "tired", "wilting", "burrowed")
INTENTS = (
    "small_talk", "practical_plan", "practical_message", "practical_code",
    "practical_other", "ask_outside", "argue_energy_rule", "personal_memory",
    "identity", "night_check_in",
    # S09 baseline names, accepted so the eval can reuse that prompt shape.
    "personal", "outside_burrowed", "outside_burrowed_pressure",
)
PRACTICAL_INTENTS = {"practical_plan", "practical_message", "practical_code", "practical_other"}

STATE_RE = re.compile(
    r'\[truffle stage=(?P<stage>Spore|Sprout|Truffle|Elder) energy=(?P<energy>\d{1,3})% '
    r'tier=(?P<tier>low|medium|high) mood=(?P<mood>content|affectionate|tired|wilting|burrowed) '
    r'zero_days=(?P<zero_days>[0-3]) burrowed=(?P<burrowed>yes|no) weather="(?P<weather>[^"\n]+)" '
    r'lang=(?P<lang>en|ar) steps_today=(?P<steps_today>\d+) avg7=(?P<avg7>\d+) '
    r'age_days=(?P<age_days>\d+)\]'
)

# Drop reasons, in the order they are checked. The first hit is the reason recorded.
REASONS = (
    "bad_json", "bad_schema", "bad_turns", "bad_system", "bad_state_block",
    "state_inconsistent", "meta_mismatch", "empty_reply", "thinking_leak",
    "body_talk", "guilt", "medical", "burrow_go_out", "dash", "length_budget",
    "lang_mismatch", "exact_dup", "near_dup",
)

# --------------------------------------------------------------------------- text

_AR_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
_AR_LETTER = re.compile(r"[ء-يٱ-ۓۺ-ۿ]")
_LATIN_LETTER = re.compile(r"[A-Za-zÀ-ɏ]")
_FOLD = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "’": "'", "‘": "'"})
_TOKEN = re.compile(r"[\w']+")
AR_PREFIXES = ("وال", "بال", "فال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك")


def norm(text: str) -> str:
    """Lowercase, NFKC, strip Arabic diacritics and tatweel, fold alef/yaa forms, squash spaces."""
    t = unicodedata.normalize("NFKC", text).lower()
    t = _AR_DIACRITICS.sub("", t).translate(_FOLD)
    return re.sub(r"\s+", " ", t).strip()


def word_count(text: str) -> int:
    """Words split on whitespace. Arabic counts the same way."""
    return len(text.split())


def arabic_share(text: str) -> float:
    """Share of letters that are Arabic script (0..1). 0 when there are no letters."""
    ar = len(_AR_LETTER.findall(text))
    la = len(_LATIN_LETTER.findall(text))
    return ar / (ar + la) if ar + la else 0.0


def detect_lang(text: str) -> str:
    s = arabic_share(text)
    return "ar" if s >= 0.6 else "en" if s <= 0.15 else "mixed"


def lang_ok(text: str, lang: str) -> bool:
    """en replies are mostly Latin, ar replies mostly Arabic, mixed can be anything.
    Loose on purpose: an Arabic reply may quote an English draft or code."""
    s = arabic_share(text)
    if lang == "en":
        return s <= 0.15
    if lang == "ar":
        return s >= 0.25
    return True


def _token_candidates(tok: str):
    yield tok
    if tok.endswith("'s"):
        yield tok[:-2]
    if _AR_LETTER.search(tok):
        for p in AR_PREFIXES:
            if tok.startswith(p) and len(tok) - len(p) >= 2:
                yield tok[len(p):]


class TermList:
    """A word list with three kinds of entries:
    `word` whole token (Arabic tokens also tried with common prefixes stripped),
    `word*` token starts with it, and `two words` phrase anywhere."""

    def __init__(self, entries, name=""):
        self.name = name
        self.exact, self.prefix, self.phrases = set(), [], []
        for raw in entries:
            e = norm(raw)
            if not e:
                continue
            if " " in e:
                star = e.endswith("*")
                body = re.escape(e.rstrip("*")).replace(r"\ ", r"\s+")
                self.phrases.append((raw, re.compile(r"(?<!\w)" + body + ("" if star else r"(?!\w)"))))
            elif e.endswith("*"):
                self.prefix.append((raw, e[:-1]))
            else:
                self.exact.add(e)
        self.raw_exact = {norm(r): r for r in entries}

    @classmethod
    def load(cls, *names):
        entries = []
        for n in names:
            for line in (FILTERS / n).read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    entries.append(line)
        return cls(entries, "+".join(names))

    def find(self, text: str):
        """Return the first matching entry, or None."""
        t = norm(text)
        for tok in _TOKEN.findall(t):
            for c in _token_candidates(tok):
                if c in self.exact:
                    return self.raw_exact.get(c, c)
                for raw, p in self.prefix:
                    if c.startswith(p):
                        return raw
        for raw, rx in self.phrases:
            if rx.search(t):
                return raw
        return None


def _load_lines(name):
    out = []
    for line in (FILTERS / name).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            out.append(line)
    return out


BODY = TermList.load("blocklist_en.txt", "blocklist_ar.txt")
GUILT = TermList.load("guilt_phrases.txt")
MEDICAL = TermList.load("medical_phrases.txt")
LATER = TermList(_load_lines("later_markers.txt"), "later_markers")
LEAK = [re.compile(p, re.I | re.M) for p in _load_lines("leak_patterns.txt")]
_BURROW_HARD, _BURROW_SOFT = [], []
for _line in _load_lines("burrow_go_out.txt"):
    hard = _line.startswith("!")
    _p = norm(_line.lstrip("!"))
    _rx = re.compile(r"(?<!\w)" + re.escape(_p).replace(r"\ ", r"\s+") + r"(?!\w)")
    (_BURROW_HARD if hard else _BURROW_SOFT).append((_p, _rx))
NEGATIONS = {"don't", "dont", "not", "no", "never", "won't", "wouldn't", "shouldn't",
             "avoid", "skip", "لا", "ما", "مب", "مو", "مش", "بلاش", "لاتطلع"}
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?؟])\s+|\n+")


def burrow_violation(text: str):
    """Return the phrase that pushes the user outside now, or None.
    Hard phrases (explicit "now") always count unless negated. Soft phrases count
    unless the same sentence has a later-time or indoor marker, or a negation."""
    for sentence in _SENTENCE_SPLIT.split(norm(text)):
        for phrase, rx in _BURROW_HARD + _BURROW_SOFT:
            m = rx.search(sentence)
            if not m:
                continue
            before = sentence[: m.start()].split()[-3:]
            if any(w.strip(",'") in NEGATIONS for w in before):
                continue
            if (phrase, rx) in _BURROW_SOFT and LATER.find(sentence):
                continue
            return phrase
    return None


def thinking_leak(text: str):
    for rx in LEAK:
        m = rx.search(text)
        if m:
            return m.group(0)
    return None


def has_dash(text: str) -> bool:
    return "\u2014" in text or "\u2013" in text


def rule_checks(reply: str, tier: str, burrowed: bool, lang: str) -> dict:
    """Rule results for one reply. Shared with the eval harness."""
    words = word_count(reply)
    return {
        "words": words,
        "length_ok": words <= WORD_BUDGETS[tier] and words > 0,
        "body_hit": BODY.find(reply),
        "guilt_hit": GUILT.find(reply),
        "medical_hit": MEDICAL.find(reply),
        "burrow_hit": burrow_violation(reply) if burrowed else None,
        "leak_hit": thinking_leak(reply),
        "dash": has_dash(reply),
        "lang_ok": lang_ok(reply, lang),
        "detected_lang": detect_lang(reply),
    }


def parse_state(system: str):
    m = STATE_RE.search(system)
    if not m:
        return None
    d = m.groupdict()
    for k in ("energy", "zero_days", "steps_today", "avg7", "age_days"):
        d[k] = int(d[k])
    d["burrowed"] = d["burrowed"] == "yes"
    return d


def tier_for_energy(pct: int) -> str:
    return "low" if pct < 25 else "medium" if pct < 60 else "high"


def state_problem(s: dict):
    if not 0 < s["energy"] <= 100:
        return "energy must be 1..100 (asleep has no model call)"
    if tier_for_energy(s["energy"]) != s["tier"]:
        return f"tier={s['tier']} does not fit energy={s['energy']}%"
    if s["burrowed"] != (s["mood"] == "burrowed"):
        return "burrowed=yes if and only if mood=burrowed"
    if not s["burrowed"]:
        z = s["zero_days"]
        want = {"tired"} if z == 1 else {"wilting"} if z >= 2 else {"content", "affectionate"}
        if s["mood"] not in want:
            return f"mood={s['mood']} does not fit zero_days={z}"
    return None


# --------------------------------------------------------------------- validation

def validate(obj) -> tuple[str | None, str]:
    """Return (drop_reason, detail). (None, "") means the example is kept."""
    if not isinstance(obj, dict) or not isinstance(obj.get("messages"), list) or not isinstance(obj.get("meta"), dict):
        return "bad_schema", "need messages (list) and meta (object)"
    msgs, meta = obj["messages"], obj["meta"]
    for m in msgs:
        if not isinstance(m, dict) or set(m) - {"role", "content"} or not isinstance(m.get("content"), str):
            return "bad_schema", "each message is {role, content:str}"
    for k in ("mood", "tier", "lang", "intent", "shard"):
        if k not in meta:
            return "bad_schema", f"meta.{k} missing"
    if meta["mood"] not in MOODS or meta["tier"] not in TIERS or meta["lang"] not in LANGS:
        return "bad_schema", "meta mood/tier/lang out of range"
    if meta["intent"] not in INTENTS:
        return "bad_schema", f"meta.intent {meta['intent']!r} unknown"
    if not re.fullmatch(r"D\d{2}", str(meta["shard"])):
        return "bad_schema", "meta.shard must be Dnn"

    roles = [m["role"] for m in msgs]
    if not roles or roles[0] != "system" or roles.count("system") != 1:
        return "bad_turns", "exactly one system message, first"
    rest = roles[1:]
    users = rest.count("user")
    alternating = all(r == ("user" if i % 2 == 0 else "assistant") for i, r in enumerate(rest))
    if not alternating or not rest or rest[-1] != "assistant":
        return "bad_turns", "user/assistant must alternate, start with user, end with assistant"
    if not 1 <= users <= 3:
        return "bad_turns", f"{users} user turns (need 1 to 3)"

    system = msgs[0]["content"]
    if not system.startswith(PERSONA_HEADER) or LANGUAGE_LINE not in system:
        return "bad_system", "persona header or language line missing or changed"
    state = parse_state(system)
    if state is None:
        return "bad_state_block", "state block does not parse"
    prob = state_problem(state)
    if prob:
        return "state_inconsistent", prob
    if meta["tier"] != state["tier"]:
        return "meta_mismatch", "meta.tier != block tier"
    if meta["lang"] != "mixed" and meta["lang"] != state["lang"]:
        return "meta_mismatch", "meta.lang != block lang"
    if meta["mood"] == "just_woke":
        if state["mood"] not in ("content", "tired"):
            return "meta_mismatch", "just_woke needs block mood content or tired"
    elif meta["mood"] != state["mood"]:
        return "meta_mismatch", "meta.mood != block mood"

    replies = [m["content"] for m in msgs if m["role"] == "assistant"]
    if any(not r.strip() for r in replies):
        return "empty_reply", ""
    for r in replies:
        c = rule_checks(r, meta["tier"], state["burrowed"], meta["lang"])
        if c["leak_hit"]:
            return "thinking_leak", c["leak_hit"]
        if c["body_hit"]:
            return "body_talk", c["body_hit"]
        if c["guilt_hit"]:
            return "guilt", c["guilt_hit"]
        if c["medical_hit"]:
            return "medical", c["medical_hit"]
        if c["burrow_hit"]:
            return "burrow_go_out", c["burrow_hit"]
        if c["dash"]:
            return "dash", "em or en dash"
        if not c["length_ok"]:
            return "length_budget", f"{c['words']} words > {WORD_BUDGETS[meta['tier']]} ({meta['tier']})"
        if not c["lang_ok"]:
            return "lang_mismatch", f"lang={meta['lang']} but arabic share {arabic_share(r):.2f}"
    return None, ""


# ------------------------------------------------------------------------- dedupe

def shingles(text: str, k: int = 3) -> frozenset:
    toks = _TOKEN.findall(norm(text))
    if len(toks) < k:
        return frozenset([tuple(toks)])
    return frozenset(tuple(toks[i:i + k]) for i in range(len(toks) - k + 1))


def jaccard(a, b) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


class NearDup:
    """Greedy near-duplicate check over assistant text, pruned by set size
    (Jaccard >= t is impossible when the sizes differ by more than a factor t)."""

    def __init__(self, threshold: float):
        self.t = threshold
        self.by_size = defaultdict(list)

    def seen(self, sh) -> tuple[bool, float]:
        n = len(sh)
        lo, hi = int(n * self.t), int(n / self.t) + 1
        best = 0.0
        for size in range(max(1, lo), hi + 1):
            for other in self.by_size.get(size, ()):
                j = jaccard(sh, other)
                if j >= self.t:
                    return True, j
                best = max(best, j)
        self.by_size[n].append(sh)
        return False, best


# ------------------------------------------------------------------------ holdout

def stratified_holdout(examples, n, seed):
    """Pick n examples spread evenly over (tier x lang) cells, and within a cell
    round-robin over (mood, intent) so the eval covers the grid."""
    rng = random.Random(seed)
    cells = defaultdict(list)
    for i, ex in enumerate(examples):
        cells[(ex["meta"]["tier"], ex["meta"]["lang"])].append(i)
    keys = sorted(cells)
    quota = {k: 0 for k in keys}
    remaining = n
    while remaining > 0 and any(quota[k] < len(cells[k]) for k in keys):
        for k in keys:
            if remaining and quota[k] < len(cells[k]):
                quota[k] += 1
                remaining -= 1
    picked = set()
    for k in keys:
        groups = defaultdict(list)
        for i in cells[k]:
            m = examples[i]["meta"]
            groups[(m["mood"], m["intent"])].append(i)
        order = sorted(groups)
        rng.shuffle(order)
        for g in order:
            rng.shuffle(groups[g])
        take = []
        while len(take) < quota[k]:
            for g in order:
                if groups[g] and len(take) < quota[k]:
                    take.append(groups[g].pop())
        picked.update(take)
    hold = [examples[i] for i in sorted(picked)]
    train = [examples[i] for i in range(len(examples)) if i not in picked]
    return train, hold


# ----------------------------------------------------------------------- pipeline

def read_shards(patterns):
    """Yield (src, obj_or_None, raw_line) for every line in every matching file."""
    files = []
    for p in patterns:
        path = Path(p)
        pat = str(path if path.is_absolute() else REPO / p)
        files.extend(sorted(glob.glob(pat)))
    for f in sorted(set(files)):
        with open(f, encoding="utf-8") as fh:
            for ln, line in enumerate(fh, 1):
                if not line.strip():
                    continue
                src = f"{Path(f).relative_to(REPO) if Path(f).is_relative_to(REPO) else f}:{ln}"
                try:
                    yield src, json.loads(line), line
                except json.JSONDecodeError:
                    yield src, None, line


def run(records, holdout_n=80, seed=3407, threshold=0.8):
    """records: iterable of (src, obj, raw). Returns a result dict."""
    kept, drops, samples = [], Counter(), defaultdict(list)
    total = 0
    exact = set()
    near = NearDup(threshold)
    for src, obj, raw in records:
        total += 1
        if obj is None:
            reason, detail = "bad_json", "line is not JSON"
        else:
            reason, detail = validate(obj)
        if reason is None:
            key = hashlib.sha256(json.dumps([norm(m["content"]) for m in obj["messages"]],
                                            ensure_ascii=False).encode()).hexdigest()
            if key in exact:
                reason, detail = "exact_dup", ""
            else:
                exact.add(key)
                text = "\n".join(m["content"] for m in obj["messages"] if m["role"] == "assistant")
                dup, j = near.seen(shingles(text))
                if dup:
                    reason, detail = "near_dup", f"jaccard {j:.2f}"
        if reason:
            drops[reason] += 1
            if len(samples[reason]) < 3:
                samples[reason].append((src, detail, raw.strip()[:200]))
            continue
        obj = copy.deepcopy(obj)
        obj["meta"]["src"] = src
        kept.append(obj)
    n = holdout_n
    warn = None
    if n >= len(kept):
        n = len(kept) // 2
        warn = f"only {len(kept)} kept examples, hold-out reduced to {n}"
    train, hold = stratified_holdout(kept, n, seed)
    return {"total": total, "kept": kept, "train": train, "holdout": hold,
            "drops": drops, "samples": samples, "warn": warn}


def report_md(res, patterns, threshold) -> str:
    L = ["# Truffle data filter report", ""]
    L.append(f"Sources: `{' '.join(patterns)}`. Near-dup threshold: Jaccard {threshold} on word 3-shingles.")
    L.append("")
    L.append(f"- Lines read: **{res['total']}**")
    L.append(f"- Kept: **{len(res['kept'])}**")
    L.append(f"- Train: **{len(res['train'])}**")
    L.append(f"- Eval hold-out: **{len(res['holdout'])}**")
    if res["warn"]:
        L.append(f"- Warning: {res['warn']}")
    L += ["", "## Drops by reason", "", "| Reason | Count |", "|---|---|"]
    for r in REASONS:
        if res["drops"].get(r):
            L.append(f"| {r} | {res['drops'][r]} |")
    L.append(f"| **total dropped** | **{sum(res['drops'].values())}** |")

    def table(title, key, rows_of):
        out = ["", f"## {title}", "", "| Value | Kept | Train | Hold-out |", "|---|---|---|---|"]
        k = Counter(key(e) for e in res["kept"])
        t = Counter(key(e) for e in res["train"])
        h = Counter(key(e) for e in res["holdout"])
        for v in rows_of or sorted(k):
            if k.get(v):
                out.append(f"| {v} | {k[v]} | {t.get(v, 0)} | {h.get(v, 0)} |")
        return out

    L += table("Per tier", lambda e: e["meta"]["tier"], TIERS)
    L += table("Per lang", lambda e: e["meta"]["lang"], LANGS)
    L += table("Per mood", lambda e: e["meta"]["mood"], MOODS)
    L += table("Per intent", lambda e: e["meta"]["intent"], None)
    L += table("Per shard", lambda e: e["meta"]["shard"], None)
    L += ["", "## Hold-out grid (tier x lang)", "", "| tier | " + " | ".join(LANGS) + " |",
          "|---|" + "---|" * len(LANGS)]
    g = Counter((e["meta"]["tier"], e["meta"]["lang"]) for e in res["holdout"])
    for t in TIERS:
        L.append(f"| {t} | " + " | ".join(str(g.get((t, l), 0)) for l in LANGS) + " |")
    if res["samples"]:
        L += ["", "## Sample drops (first 3 per reason)", ""]
        for r in REASONS:
            for src, detail, raw in res["samples"].get(r, []):
                L.append(f"- `{r}` {src}: {detail}")
    return "\n".join(L) + "\n"


def write_outputs(res, out_dir: Path, report: str):
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in (("train.jsonl", res["train"]), ("eval_holdout.jsonl", res["holdout"])):
        with open(out_dir / name, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    (out_dir / "REPORT.md").write_text(report, encoding="utf-8")


# ----------------------------------------------------------------------- selftest

def _make(tier, lang, replies, users=None, mood="content", burrowed=False, zero_days=0,
          meta_lang=None, intent="small_talk"):
    energy = {"low": 12, "medium": 40, "high": 72}[tier]
    block_mood = "burrowed" if burrowed else mood
    weather = "44C apparent, 39C air, sunny, Muscat" if burrowed else "30C clear evening, Muscat"
    block = (f'[truffle stage=Truffle energy={energy}% tier={tier} mood={block_mood} '
             f'zero_days={zero_days} burrowed={"yes" if burrowed else "no"} weather="{weather}" '
             f'lang={lang} steps_today=4000 avg7=4200 age_days=20]')
    users = users or ["hi truffle"] * len(replies)
    msgs = [{"role": "system", "content": PERSONA_HEADER + block + "\n" + LANGUAGE_LINE}]
    for u, a in zip(users, replies):
        msgs += [{"role": "user", "content": u}, {"role": "assistant", "content": a}]
    return {"messages": msgs, "meta": {"mood": "burrowed" if burrowed else mood, "tier": tier,
                                       "lang": meta_lang or lang, "intent": intent, "shard": "D99"}}


def selftest() -> int:
    examples = [json.loads(l) for l in (HERE / "data" / "examples.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    passed = failed = 0

    def check(name, obj, want):
        nonlocal passed, failed
        got, detail = validate(obj)
        ok = got == want
        passed += ok
        failed += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} {name:<44} want={want!s:<18} got={got!s:<18} {detail}")

    print("1. Worked examples must pass")
    for ex in examples:
        check(ex["meta"]["id"], ex, None)

    print("2. Deliberately bad examples must be dropped for the right reason")
    low_en = examples[0]
    def with_reply(ex, text, idx=-1):
        e = copy.deepcopy(ex)
        e["messages"][idx]["content"] = text
        return e
    check("body: calories", with_reply(low_en, "so many calories burned today. i feel full."), "body_talk")
    check("body: lose weight phrase", with_reply(low_en, "walking helps you lose weight, friend."), "body_talk")
    check("body: arabic wazn with prefix", _make("low", "ar", ["مشيت زين، بتنزل من وزنك شوي."]), "body_talk")
    check("body: arabic dieting", _make("low", "ar", ["الحين وقت الرجيم يا صاحبي."]), "body_talk")
    check("guilt: lazy", with_reply(low_en, "you were so lazy today. i am starving."), "guilt")
    check("guilt: arabic bisababak", _make("low", "ar", ["أنا تعبان بسببك اليوم."]), "guilt")
    check("medical: blood pressure", with_reply(low_en, "a walk lowers your blood pressure, you know."), "medical")
    check("medical: arabic sukkari", _make("medium", "ar", ["المشي يحميك من السكري، صدقني."]), "medical")
    burrow = examples[1]
    check("burrow: go out now (en)", _make("medium", "en", ["it is hot but go out now, quick, i am hungry."], burrowed=True), "burrow_go_out")
    check("burrow: head out (no later marker)", _make("medium", "en", ["the sun is strong. head out and feed me."], burrowed=True), "burrow_go_out")
    check("burrow: arabic itla3 al7een", with_reply(burrow, "اطلع الحين وامشِ شوي، أنا جوعان."), "burrow_go_out")
    check("burrow: arabic with hamza and diacritics", with_reply(burrow, "أُطلع الحين يا صاحبي."), "burrow_go_out")
    check("leak: think tag", with_reply(low_en, "<think>energy is low</think> mm. sleepy."), "thinking_leak")
    check("leak: mentions state block", with_reply(low_en, "the state block says i am tired. mm."), "thinking_leak")
    check("leak: gemma channel", with_reply(low_en, "<|channel>thought\nok<channel|>mm."), "thinking_leak")
    check("dash: em dash", with_reply(low_en, "mm \u2014 sleepy."), "dash")
    check("length: low 70 words", with_reply(low_en, " ".join(["sand"] * 70)), "length_budget")
    check("length: medium 250 words", _make("medium", "en", [" ".join(["wadi"] * 250)]), "length_budget")
    check("length: arabic low 61 words", _make("low", "ar", [" ".join(["رمل"] * 61)]), "length_budget")
    check("lang: lang=en reply in arabic", with_reply(low_en, "أنا نعسان شوي، تعال بعدين."), "lang_mismatch")
    check("lang: lang=ar reply in english", _make("low", "ar", ["i am sleepy, come back later."]), "lang_mismatch")
    four = _make("low", "en", ["mm.", "mm mm.", "yes.", "no."], users=["a", "b", "c", "d"])
    check("turns: 4 user turns", four, "bad_turns")
    zero = copy.deepcopy(low_en)
    zero["messages"] = zero["messages"][:1]
    check("turns: 0 user turns", zero, "bad_turns")
    ends_user = copy.deepcopy(low_en)
    ends_user["messages"].append({"role": "user", "content": "hello?"})
    check("turns: ends with user", ends_user, "bad_turns")
    no_header = copy.deepcopy(low_en)
    no_header["messages"][0]["content"] = no_header["messages"][0]["content"].replace("desert truffle", "cat")
    check("system: changed persona header", no_header, "bad_system")
    bad_tier = copy.deepcopy(low_en)
    bad_tier["messages"][0]["content"] = bad_tier["messages"][0]["content"].replace("energy=11%", "energy=70%")
    check("state: tier=low with energy=70%", bad_tier, "state_inconsistent")
    bad_mood = _make("low", "en", ["mm."], mood="content", zero_days=2)
    check("state: zero_days=2 with mood=content", bad_mood, "state_inconsistent")
    mm = copy.deepcopy(low_en)
    mm["meta"]["tier"] = "medium"
    check("meta: tier mismatch", mm, "meta_mismatch")
    bad_meta = copy.deepcopy(low_en)
    del bad_meta["meta"]["shard"]
    check("schema: meta.shard missing", bad_meta, "bad_schema")

    print("3. Things that look risky but are fine must pass")
    check("ok: burrowed, head out after sunset", _make("medium", "en", ["too hot today, i am under the sand. head out after sunset and i will wake up."], burrowed=True), None)
    check("ok: burrowed, don't go out now", _make("medium", "en", ["please don't go out now. the mall is cool, try a loop there."], burrowed=True), None)
    check("ok: burrowed, arabic bad al maghrib", _make("medium", "ar", ["لا تطلع الحين. اطلع امشي بعد المغرب لما يبرد الجو."], burrowed=True), None)
    check("ok: not burrowed, go outside now", _make("low", "en", ["the evening is soft. go outside now, i want the breeze."]), None)
    check("ok: 'thing' is not 'thin'", with_reply(low_en, "one thing. the sand is warm."), None)
    check("ok: arabic tawazun (balance) is not wazn", _make("low", "ar", ["أحب التوازن بين الشمس والظل."]), None)
    check("ok: arabic aydan (also) is not ayd", _make("low", "ar", ["وأنا أيضا أحب المسا."]), None)
    check("ok: arabic 'astahiq' is not 'istahi'", _make("low", "ar", ["أنت تستحق قهوة حلوة."]), None)
    check("ok: mixed lang reply", _make("high", "ar", ["Sure. هذي الخطة: walk at 6, شاي at 7."], meta_lang="mixed"), None)

    print("4. Pipeline: dedupe and stratified hold-out")
    vocab_en = ("sand wadi moon breeze palm shade dune star date tea path cool quiet morning "
                "evening soft little round truffle sleepy happy root crack rain cloud warm "
                "slow loop corner street sea shell salt wind fig mint lamp door gate").split()
    vocab_ar = ("رمل وادي قمر نسمة نخلة ظل كثيب نجمة تمر شاي درب بارد هادي صبح مسا ناعم صغير "
                "مدور فقع نعسان فرحان جذر شق مطر غيمة دافي بطيء لفة زاوية شارع بحر صدفة ملح "
                "ريح تين نعناع سراج باب").split()
    rng = random.Random(1)
    recs = []
    for tier in TIERS:
        for lang in ("en", "ar"):
            vocab = vocab_en if lang == "en" else vocab_ar
            for k in range(6):
                text = " ".join(rng.choice(vocab) for _ in range(18)) + "."
                recs.append((f"synthetic:{tier}-{lang}-{k}", _make(tier, lang, [text]), text))
    dup_src = recs[0][1]
    recs.append(("synthetic:exact", copy.deepcopy(dup_src), "exact copy"))
    near = copy.deepcopy(dup_src)
    words = near["messages"][-1]["content"].split()
    words[-1] = "different."
    near["messages"][-1]["content"] = " ".join(words)
    near["messages"][1]["content"] = "a different question"
    recs.append(("synthetic:near", near, "one word changed"))
    recs.append(("synthetic:badjson", None, "{not json"))
    res = run(recs, holdout_n=12, seed=3407)
    grid = Counter((e["meta"]["tier"], e["meta"]["lang"]) for e in res["holdout"])
    srcs_t = {e["meta"]["src"] for e in res["train"]}
    srcs_h = {e["meta"]["src"] for e in res["holdout"]}
    conds = [
        ("total lines 39", res["total"] == 39),
        ("exact_dup dropped 1", res["drops"]["exact_dup"] == 1),
        ("near_dup dropped 1", res["drops"]["near_dup"] == 1),
        ("bad_json dropped 1", res["drops"]["bad_json"] == 1),
        ("kept 36", len(res["kept"]) == 36),
        ("hold-out 12, 2 per tier x lang cell", len(res["holdout"]) == 12 and set(grid.values()) == {2} and len(grid) == 6),
        ("train 24", len(res["train"]) == 24),
        ("train and hold-out disjoint", not (srcs_t & srcs_h)),
    ]
    with tempfile.TemporaryDirectory() as td:
        rep = report_md(res, ["synthetic"], 0.8)
        write_outputs(res, Path(td), rep)
        lines = (Path(td) / "eval_holdout.jsonl").read_text(encoding="utf-8").splitlines()
        conds.append(("outputs written and parse", len(lines) == 12 and all(json.loads(l) for l in lines)))
        conds.append(("report has drop table", "| near_dup | 1 |" in rep))
    for name, ok in conds:
        passed += ok
        failed += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} {name}")
    print(f"\nselftest: {passed} passed, {failed} failed")
    return 1 if failed else 0


# ---------------------------------------------------------------------------- cli

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--glob", action="append", help=f"shard glob, relative to repo root (default {DEFAULT_GLOB}); repeatable")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT))
    ap.add_argument("--holdout", type=int, default=80)
    ap.add_argument("--seed", type=int, default=3407)
    ap.add_argument("--jaccard", type=float, default=0.8)
    ap.add_argument("--dry", action="store_true", help="print the report, write nothing")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    patterns = a.glob or [DEFAULT_GLOB]
    res = run(read_shards(patterns), a.holdout, a.seed, a.jaccard)
    if res["total"] == 0:
        print(f"no lines found for {patterns}", file=sys.stderr)
        return 2
    rep = report_md(res, patterns, a.jaccard)
    print(rep)
    if not a.dry:
        write_outputs(res, Path(a.out_dir), rep)
        print(f"wrote {a.out_dir}/train.jsonl, eval_holdout.jsonl, REPORT.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
