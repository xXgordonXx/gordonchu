#!/usr/bin/env python3
"""Bundle content/*.md and demo/ into data.js so index.html works from file:// (no server needed)."""
import csv, json, pathlib

root = pathlib.Path(__file__).resolve().parent
docs = {p.stem: p.read_text(encoding="utf-8") for p in sorted((root / "content").glob("*.md"))}
results = json.loads((root / "demo/results.json").read_text())
with open(root / "demo/exception_report.csv", newline="") as f:
    exceptions = list(csv.DictReader(f))
out = "window.SITE = " + json.dumps({"docs": docs, "demo": {"results": results, "exceptions": exceptions}}, ensure_ascii=False) + ";\n"
(root / "data.js").write_text(out, encoding="utf-8")
print(f"data.js: {len(docs)} docs ({', '.join(docs)}), {len(out):,} bytes")
