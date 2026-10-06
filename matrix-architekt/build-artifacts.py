#!/usr/bin/env python3
"""Erzeugt aus site/*.html Artefakt-Fragmente für die Vorschau auf claude.ai.

Die Seiten in site/ sind vollständige HTML-Dokumente (für Hostinger). Der Artefakt-
Viewer liefert sein eigenes Dokument-Gerüst und erlaubt externe Stylesheets nur von
Google Fonts, darum werden hier fonts.css, site.css, config.js und track.js inline
eingebettet und das <html>/<head>/<body>-Gerüst entfernt.

Aufruf: python3 build-artifacts.py <zielordner>
"""
import re, sys, pathlib

root = pathlib.Path(__file__).parent / 'site'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'artifact')
out.mkdir(parents=True, exist_ok=True)

fonts_css = (root / 'fonts' / 'fonts.css').read_text(encoding='utf-8').replace("url('", "url('fonts/")
site_css = (root / 'site.css').read_text(encoding='utf-8')
config_js = (root / 'config.js').read_text(encoding='utf-8')
track_js = (root / 'track.js').read_text(encoding='utf-8')

for page in sorted(root.glob('*.html')):
    html = page.read_text(encoding='utf-8')
    title = re.search(r'<title>(.*?)</title>', html, re.S).group(1).strip()
    head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
    body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
    page_style = re.search(r'<style>(.*?)</style>', head, re.S)
    page_style = page_style.group(1) if page_style else ''
    ext_scripts = re.findall(r'<script src="https://[^"]+"></script>', head)
    body = body.replace('<script src="config.js"></script>', '<script>\n' + config_js + '\n</script>')
    body = body.replace('<script src="track.js"></script>', '<script>\n' + track_js + '\n</script>')
    frag = (f'<title>{title}</title>\n' + '\n'.join(ext_scripts) + '\n<style>\n' + fonts_css + '\n' + site_css + '\n' + page_style + '\n</style>\n' + body.strip() + '\n')
    (out / page.name).write_text(frag, encoding='utf-8')
    print('ok', page.name, len(frag))
