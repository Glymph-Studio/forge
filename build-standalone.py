#!/usr/bin/env python3
"""Bundle forge into one double-clickable file: forge-standalone.html

Everything (styles and scripts) gets inlined, so this one file works with a
plain double click, no server and no internet needed. Run it again any time
you change the source files:

    python3 build-standalone.py
"""
import pathlib
import re

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")

css = (root / "style.css").read_text(encoding="utf-8")
html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    "<style>\n" + css + "\n</style>",
)

def inline_script(m):
    src = m.group(1)
    body = (root / src).read_text(encoding="utf-8")
    if "</script" in body.lower():
        raise SystemExit("unsafe content in " + src)
    return "<script>\n/* ~~~ " + src + " ~~~ */\n" + body + "\n</script>"

html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_script, html)

out = root / "forge-standalone.html"
out.write_text(html, encoding="utf-8")
print("wrote", out.name, "(", round(len(html) / 1024), "KB )")
