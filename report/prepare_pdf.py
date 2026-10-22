"""Render the report as self-contained print HTML (requires Markdown)."""

import base64
import html
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "ML_MINI_PROJECT_REPORT.md"
body = markdown.markdown(
    SOURCE.read_text(encoding="utf-8"),
    extensions=["tables", "fenced_code", "sane_lists"],
)


def image_uri(relative_path):
    path = ROOT / relative_path
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def figure(match):
    alt, src, caption = match.groups()
    screenshot = "desktop" in src or "mobile" in src
    classes = "report-figure screenshot" if screenshot else "report-figure"
    return (
        f'<figure class="{classes}"><img alt="{html.escape(alt)}" '
        f'src="{image_uri(src)}" />'
        f'<figcaption>{caption}</figcaption></figure>'
    )


# Keep each figure and its existing caption together on the printed page.
body = re.sub(
    r'<p><img alt="([^"]*)" src="(assets/[^"]+)"\s*/></p>\s*'
    r'<p><em>(.*?)</em></p>',
    figure,
    body,
    flags=re.S,
)

# Make the two mobile screenshots available inside the PDF as well as in
# the original Markdown links. Full-resolution originals are also attached.
body = body.replace('href="assets/discover-mobile.png"', 'href="#mobile-discovery"')
body = body.replace('href="assets/harry-potter-mobile.png"', 'href="#mobile-search"')
body += '<section class="mobile-appendix"><h2>Application Screenshots — Mobile Views</h2>'
for anchor, name, caption in [
    ("mobile-discovery", "discover-mobile.png", "Mobile discovery interface — complete capture"),
    ("mobile-search", "harry-potter-mobile.png", "Mobile Harry Potter search results — complete capture"),
]:
    body += (
        f'<figure id="{anchor}" class="report-figure screenshot">'
        f'<img alt="{caption}" src="{image_uri("assets/" + name)}" />'
        f'<figcaption>{caption}</figcaption></figure>'
    )
body += "</section>"

css = """
@page { size: A4; }
* { box-sizing: border-box; }
html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
body { margin: 0; font-family: 'Times New Roman', Georgia, serif;
       font-size: 11.5pt; line-height: 1.5; color: #20242c; }
h1 { font-family: Arial, sans-serif; font-size: 20pt; line-height: 1.25;
     color: #282447; margin: 0 0 15pt; letter-spacing: .3pt; }
h2 { font-family: Arial, sans-serif; font-size: 16pt; line-height: 1.3;
     color: #353054; margin: 0 0 15pt; padding-bottom: 7pt;
     border-bottom: 1pt solid #dcd7eb; break-before: page; break-after: avoid; }
h1 + p + h2 { break-before: auto; margin-top: 20pt; }
h3 { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.35;
     margin: 17pt 0 8pt; break-after: avoid; color: #373345; }
p { margin: 7pt 0; orphans: 3; widows: 3; }
li { margin: 4pt 0; orphans: 2; widows: 2; }
ul, ol { padding-left: 20pt; }
a { color: #4b4090; text-decoration: underline; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; font-size: 10pt;
        line-height: 1.35; margin: 12pt 0 15pt; break-inside: avoid; }
thead { display: table-header-group; background: #efedf6; }
th, td { padding: 7pt 8pt; text-align: left; vertical-align: top;
         border: .6pt solid #d9d9e2; }
th { font-family: Arial, sans-serif; font-size: 9.5pt; }
tr { break-inside: avoid; }
pre { border: .7pt solid #dedee7; background: #f5f5f8; padding: 11pt;
      border-radius: 4pt; white-space: pre-wrap; overflow-wrap: anywhere;
      font-size: 8.5pt; line-height: 1.45; break-inside: avoid; margin: 12pt 0; }
code { font-family: Consolas, 'Courier New', monospace; font-size: .87em;
       overflow-wrap: anywhere; }
pre code { font-size: inherit; }
.report-figure { margin: 17pt 0; break-inside: avoid; text-align: center; }
.report-figure img { display: block; width: 100%; height: auto; max-height: 205mm;
                     object-fit: contain; margin: 0 auto; }
.report-figure figcaption { font-size: 9.5pt; color: #55505f; line-height: 1.35;
                           font-style: italic; margin: 8pt auto 0; }
.screenshot { break-before: page; margin: 0; }
h3 + .screenshot { break-before: auto; }
.screenshot img { max-height: 211mm; }
.mobile-appendix h2 { margin-bottom: 16pt; }
.mobile-appendix h2 + .screenshot { break-before: auto; }
.mobile-appendix h2 + .screenshot img { max-height: 212mm; }
"""

document = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<title>Frame — Machine Learning Mini Project Report</title>'
    f'<style>{css}</style></head><body>{body}</body></html>'
)
destination = ROOT / "ML_MINI_PROJECT_REPORT.html"
destination.write_text(document, encoding="utf-8")
print(f"Prepared printable HTML: {destination}")
