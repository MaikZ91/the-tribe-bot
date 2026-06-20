import pathlib

h = '<!DOCTYPE html>\n<html lang="de">\n<head>\n'
h+= '<meta charset="utf-8"/>\n'
h+= '<meta name="viewport" content="width=device-width,initial-scale=1"/>\n'
h+= '<title>Dr. Benz &amp; Kollegen - Zahnarztpraxis Bielefeld</title>\n'
h+= '<meta name="robots" content="noindex"/>\n'
h+= '<meta name="theme-color" content="#1B3A5C"/>\n'
h+= '</head>\n<body>\n'
h+= '<h1>Dr. Benz &amp; Kollegen</h1>\n'
h+= '<p>Zahnarztpraxis im Wellehaus · Bielefeld</p>\n'
h+= '</body>\n</html>'

pathlib.Path("docs/leads/zahnarzt-benz/index.html").write_text(h, encoding="utf-8")
print("Written OK")

import pathlib, base64

content = base64.b64decode("PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImRlIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiLz4KICA8bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2aWNlLXdpZHRoLGluaXRpYWwtc2NhbGU9MSIvPgogIDx0aXRsZT5UZXN0PC90aXRsZT4KPC9oZWFkPgo8Ym9keT4KPGgxPlRlc3Q8L2gxPgo8L2JvZHk+CjwvaHRtbD4=").decode("utf-8")
pathlib.Path("docs/leads/zahnarzt-benz/index.html").write_text(content, encoding="utf-8")
print("Written OK")