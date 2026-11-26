#!/usr/bin/env python3
"""Build the interview prep site.

- data.js        : content/*.md + demo/ bundled for local use (open index.html, no server needed)
- dist/prep.html : one self-contained page for publishing as a private claude.ai Artifact.
                   Interviewer names and background are redacted from this version.
"""
import csv, json, pathlib, re

root = pathlib.Path(__file__).resolve().parent

# Lines that describe the interviewer are dropped; remaining name mentions become a role.
DROP_LINE = re.compile(r"Coco Ding|HKICPA|CISA|PMI-ACP|PwC|LinkedIn 截圖")
NAME = re.compile(r"Coco")


def redact(text: str) -> str:
    out = [l for l in text.split("\n") if not DROP_LINE.search(l)]
    return NAME.sub("面試官", "\n".join(out))


def bundle(public: bool) -> dict:
    docs = {}
    for p in sorted((root / "content").glob("*.md")):
        t = p.read_text(encoding="utf-8")
        docs[p.stem] = redact(t) if public else t
    results = json.loads((root / "demo/results.json").read_text())
    with open(root / "demo/exception_report.csv", newline="") as f:
        exceptions = list(csv.DictReader(f))
    sug = root / "content/suggested.json"
    suggested = json.loads(sug.read_text(encoding="utf-8")) if sug.exists() else {}
    return {"docs": docs, "suggested": suggested, "demo": {"results": results, "exceptions": exceptions}}


def js_data(obj) -> str:
    return "window.SITE = " + json.dumps(obj, ensure_ascii=False).replace("<", "\\u003c") + ";\n"


local = bundle(public=False)
(root / "data.js").write_text(js_data(local), encoding="utf-8")
print(f"data.js: {len(local['docs'])} docs ({', '.join(local['docs'])})")

pub = bundle(public=True)
leftover = [k for k, v in pub["docs"].items() if DROP_LINE.search(v) or NAME.search(v)]
assert not leftover, f"redaction missed: {leftover}"

read = lambda p: (root / p).read_text(encoding="utf-8")
css = read("style.css")
body = re.search(r"<body>(.*?)<script", read("index.html"), re.S).group(1)
page = f"""<title>CFO Transformation Prep</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="robots" content="noindex, nofollow">
<style>
{css}
</style>
{body}
<script>{read("vendor/marked.min.js")}</script>
<script>{js_data(pub)}</script>
<script>{read("questions_extra.js")}</script>
<script>{read("app.js")}</script>
"""
(root / "dist").mkdir(exist_ok=True)
(root / "dist/prep.html").write_text(page, encoding="utf-8")
print(f"dist/prep.html: {len(page):,} bytes (redacted)")
