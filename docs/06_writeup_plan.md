# 06 - Write-up plan

Writing quality is the heaviest criterion. The post is the product. Budget half of Saturday for it.

## Title candidates (pick Saturday, after the diary exists)

- "I built an AI pet that only gets smarter when I walk"
- "Truffle: a Gemma 4 pet that eats steps and dies if you stay inside"
- "My AI refuses to think unless I go outside. It lives in Oman, so it also hides from the heat."

Rule: concrete, first person, one surprising fact. No colons with abstract nouns.

## Structure (follows the DEV template exactly, tags `devchallenge, hf26challenge`)

1. **Opening (3 - 5 short paragraphs).** Ahmed's own reason: loves nature, Oman heat makes outside hard for half the year, wanted a reward that is not a guilt-trip. Then the one-line idea. Then what desert truffles are and why the pet is one.
2. **What I Built.** The loop in plain words. One ASCII screenshot per stage (spore, sprout, truffle). The energy table. The burrow rule and why it exists. The death rule and the gravestone.
3. **Demo.** Live link (`/demo` judge mode, no pairing needed) with a 20-second instruction: slide steps, press midnight, press heat. A 60 - 90s phone screen recording with Ahmed walking in it. Link to the Android APK release.
4. **Code.** GitHub embed. Point at `tests/golden/energy_cases.json` as "the rules, as tests" and `worker/src/engine.ts`.
5. **How I Built It.** The stack in one diagram (the one in `docs/02`). Then the three hard parts, each as a short story: (a) rules in code, soul in weights; (b) the fine-tune and its before/after table; (c) the brain router with the half-awake fallback. Fleet section: how the agents were used, with the DEV agent-session embed.
6. **Why Does Open Innovation Matter.** Concrete, not slogans: we gate the model's thinking by a number we own; we fine-tuned personality into weights; we could switch brains (31B on Modal, 26B on Workers AI) without changing a line of app code; steps and location never leave infrastructure we run. Say plainly what a closed API would not have allowed.
7. **The diary (the bonus).** Three days of real entries with real numbers: steps, apparent temperature in Muscat, Truffle's exact words (screenshots), how Ahmed felt. This is where the post earns its reactions. Honest about the bad day too.
8. **What went wrong / what is next.** One short honest section. Judges trust posts that admit the half-awake fallback fired on day 1.
9. **My Agent Session.** Embedded DEV agent session (curated slice of the build), uploaded Saturday from `~/.claude/projects/-home-abied-Desktop-Truffle/*.jsonl`. Review redaction first.
10. **Prize Categories.** Best Use of Gemma. Nothing else (spreading does not add wins).

## Diary protocol (Thu, Fri, Sat)

Each evening Ahmed sends: steps today (screenshot of Samsung Health), the weather line, two or three Truffle replies as screenshots, and 3 - 6 sentences of how it felt in his own words (Arabic or English, we keep his phrasing). Fable formats, never rewrites the feeling.

## Voice rules (apply to post, README, UI copy, commit messages)

- No em dashes, no en dashes. Hyphens, commas, full stops, parentheses.
- One idea per sentence. Short paragraphs. Bold the load-bearing words so it scans.
- Kill these shapes: "That mix of A, B and C is what makes X Y", "X rather than Y" (max one per post), verbless headline leads, unsourced superlatives, stacked colon-lists.
- Numbers over adjectives. "4,800 steps, 41C apparent" beats "a hot, active day".
- Say what failed. Say what the fallback did.
- Arabic appears where it belongs (the name, the proverb, Truffle's Arabic lines) with a plain English gloss next to it.

## Assets checklist (Saturday)

- [ ] 3 stage screenshots (phone, portrait, dark)
- [ ] 1 burrowed screenshot (sand, bump)
- [ ] 1 gravestone screenshot (from judge mode)
- [ ] eval table PNG (base vs tuned)
- [ ] energy-over-days chart from Ahmed's real log
- [ ] 60 - 90s screen recording with a real walk
- [ ] cover image: ASCII Truffle on sand, 1000x420
- [ ] DEV agent session uploaded, curated, public
- [ ] APK on GitHub Releases with the Samsung Health checklist in the release notes

## Publish

Saturday Oct 11, ~22:00 Oman (= 11:00 PDT Saturday). Leaves 13 hours of buffer. Sunday morning: reply to comments, fix typos, nothing structural.
