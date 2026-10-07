"""Offline structure and syntax checks for the S06 documentation memo."""

import ast
import re
from pathlib import Path
from urllib.parse import urlparse

path = Path(__file__).with_name("RESULT.md")
text = path.read_text()

assert not any(chr(n) in text for n in (0x2013, 0x2014))
assert re.findall(r"^## (\d+)\.", text, re.M) == [str(n) for n in range(1, 11)]

summary = text.split("## What this means for Truffle\n", 1)[1].split(
    "## Could not confirm", 1
)[0]
summary_lines = re.findall(r"^\d+\..*", summary, re.M)
assert len(summary_lines) == 10
assert all("fetched 2026-10-07" in line for line in summary_lines)

blocks = re.findall(r"```python\n(.*?)```", text, re.S)
for block in blocks:
    ast.parse(block)

urls = set(re.findall(r"https://[^\s`;)]+", text))
for url in urls:
    parsed = urlparse(url)
    assert parsed.netloc in {"modal.com", "docs.modal.com"} or (
        parsed.netloc == "github.com"
        and parsed.path.startswith("/modal-labs/modal-examples/")
    ), url

assert not re.search(
    r"\b(?:hf_[A-Za-z0-9]{20,}|(?:wk|ws|ak|as)-[A-Za-z0-9]{20,})\b", text
)

print("PASS: 10 numbered sections; 10 dated summary lines")
print(f"PASS: {len(blocks)} Python excerpts parse as syntax only")
print(f"PASS: {len(urls)} distinct source URLs stay in allowed domains/repository")
print("PASS: no en/em dash characters; no token-shaped credential matches")
