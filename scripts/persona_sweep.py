"""Persona sweep (docs/qa/2026-10-10-persona-sweep.md): scripted people using Kura8 for different jobs.

Run `npm run build`, start `npm run preview -- --port 4173`, then `python3 scripts/persona_sweep.py [base-url]`.
`ONLY=<persona function name part>` runs a subset. Soft checks record findings and keep going; the run exits non-zero
on any finding, app console error or off-origin request. Reuses the browser audit's helpers.
"""
import io, json, math, os, random, sys, time, traceback, xml.dom.minidom
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import browser_audit as ba
from browser_audit import App, BASE, OUT, find, image_file, drop_file
from PIL import Image
from playwright.sync_api import sync_playwright


findings = []
persona = ['']


def note(cond, msg):
    if not cond:
        findings.append((persona[0], msg)); print(f'    FINDING [{persona[0]}] {msg}')
    return cond


def node(app, **kw):
    r = find(app.doc(), **kw); return r[0] if r else None


def valid(app, d=None):
    d = d or app.doc()
    if not d: return note(False, 'no saved document')
    ids = [s['id'] for s in d['sizes']]
    for n in d['nodes']:
        for sid in ids:
            f = n['frames'].get(sid)
            if not f: note(False, f'{n["kind"]} {n["id"]} missing frame for {sid}'); continue
            r = f['rect']
            if not all(isinstance(r[k], (int, float)) and math.isfinite(r[k]) for k in 'xywh'): note(False, f'non-finite rect {r}')
            if r['w'] <= 0 or r['h'] <= 0: note(False, f'{n["kind"]} non-positive size {r}')
        if set(n['frames']) - set(ids): note(False, f'{n["id"]} stray frames {set(n["frames"]) - set(ids)}')
    if len({n['id'] for n in d['nodes']}) != len(d['nodes']): note(False, 'duplicate node ids')
    return True


def errs_since(k):
    return ba.errors[k:]


def type_text(app, text):
    app.page.keyboard.press('Control+a'); app.page.keyboard.type(text); app.page.keyboard.press('Control+Enter'); app.page.wait_for_timeout(100)


def toolbar(app, label):
    return app.page.locator(f'.toolbar button[aria-label="{label}"]').first


def png_size(path):
    with Image.open(path) as im: return im.size, im.mode


# ------------------------------------------------------------------------------------------------ personas
def maya_social(app):
    """Maya runs a café's Instagram: square post, then a linked Story, photo, exports."""
    p = app.page
    app.fresh({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 30, 'dark': False})
    p.keyboard.press('Enter'); p.wait_for_timeout(600)
    note(p.locator('textarea.text-editor').count() == 1, 'Start did not open the headline for typing')
    p.keyboard.type('Summer sale — 40% off'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    d = app.doc(); head = find(d, slot='headline')[0]
    note(head['text'] == 'Summer sale — 40% off', f'headline text {head["text"]!r}')
    body = find(d, slot='body')[0]; x, y = app.node_centre(body); p.mouse.dblclick(*app.to_px(x, y)); p.wait_for_timeout(200)
    note(p.locator('textarea.text-editor').count() == 1, 'double-click on body did not open the editor')
    p.keyboard.press('Control+a'); p.keyboard.type('Open 8–6 daily\nCorner of 5th & Main'); p.keyboard.press('Escape'); p.wait_for_timeout(150)
    note(node(app, slot='body')['text'] == 'Open 8–6 daily\nCorner of 5th & Main', 'body text not kept after Escape')
    photo = image_file(OUT / 'maya.png', 1600, 1200, (30, 140, 60))
    frame = find(app.doc(), slot='image')[0]; fx, fy = app.node_centre(frame)
    drop_file(app, photo, fx, fy)
    d = app.doc(); img = find(d, id=frame['id'])[0]
    note(img['asset'], 'drop on the empty frame did not fill it')
    note(len([n for n in d['nodes'] if n['kind'] == 'image']) == 1, 'drop created a second image instead of filling')
    p.keyboard.press('Control+z'); note(node(app, id=frame['id'])['asset'] is None, 'undo did not empty the frame')
    p.keyboard.press('Control+Shift+z'); note(node(app, id=frame['id'])['asset'], 'redo did not refill the frame')
    # linked story
    p.locator('button[aria-label="Add a linked size"]').click(); p.wait_for_timeout(250)
    p.locator('.ratio-panel g[aria-label="Add Story 9:16"]').click(); p.wait_for_timeout(400)
    d = app.doc(); note(len(d['sizes']) == 2 and d['sizes'][1]['ratio'] == 'story', f'sizes {d["sizes"]}')
    valid(app, d)
    story = d['sizes'][1]['id']
    # edit headline in story: content shared
    h = find(d, slot='headline')[0]; r = h['frames'][story]['rect']
    app.click_unit(r['x'] + 20, r['y'] + 10); p.keyboard.press('Enter'); p.wait_for_timeout(150); type_text(app, 'Summer sale')
    d = app.doc(); note(find(d, slot='headline')[0]['text'] == 'Summer sale', 'text edit in story did not apply to the node')
    main_before = find(d, slot='headline')[0]['frames']['main']['rect']
    h = find(d, slot='headline')[0]; r = h['frames'][story]['rect']
    app.drag_unit((r['x'] + r['w'] / 2, r['y'] + r['h'] / 2), (r['x'] + r['w'] / 2, r['y'] + r['h'] / 2 + 100), alt=True)
    d = app.doc(); h = find(d, slot='headline')[0]
    note(abs(h['frames'][story]['rect']['y'] - r['y'] - 100) < 2, f'move in story off: {h["frames"][story]["rect"]} from {r}')
    note(h['frames']['main']['rect'] == main_before, 'moving in story changed the main size geometry')
    path = app.export('png'); size, mode = png_size(path); note(size == (1080, 1920), f'story png {size}')
    app.close_panels()
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(200)
    path = app.export('jpg'); note(png_size(path)[0] == (1080, 1080), f'main jpg {png_size(path)}')
    app.close_panels()
    # remove story
    p.locator('.corner .sizes button').nth(1).click(); p.wait_for_timeout(150)
    p.locator('.corner .sizes button').nth(1).click(); p.wait_for_timeout(250)
    rm = p.locator('.ratio-panel button', has_text='Remove size')
    note(rm.is_visible(), 'Remove size not offered on the second size')
    if rm.is_visible(): rm.click(); p.wait_for_timeout(300)
    d = app.doc(); note(len(d['sizes']) == 1, f'size not removed: {d["sizes"]}'); valid(app, d)


def priya_print(app):
    """Priya makes an A4 gig poster for print: 300 dpi PDF, grid, rotation, locks, autofit body."""
    p = app.page
    app.start({'ratio': 'a4', 'comp': 'poster', 'guide': 'golden', 'hue': 0, 'dark': True})
    d = app.doc(); valid(app, d)
    note(len(d['nodes']) == 3, f'poster should start with 3 blocks, got {len(d["nodes"])}')
    path = app.export('pdf'); data = path.read_bytes()
    note(data.startswith(b'%PDF-'), 'pdf header')
    note(b'/MediaBox [0 0 595.28 841.89]' in data or b'/MediaBox [0 0 595.2756 841.8898]' in data or b'595.' in data, f'A4 page size: {data[:400]!r}')
    app.close_panels()
    path = app.export('png'); note(png_size(path)[0] == (2480, 3508), f'A4 300dpi png {png_size(path)}')
    app.close_panels()
    # grid + shift nudge
    p.locator('button[aria-label="Snap grid"]').click(); p.wait_for_timeout(150)
    p.locator('.grid-panel .switch').click(); p.locator('.grid-panel .presets button', has_text='40').click(); p.keyboard.press('Escape')
    acc = find(app.doc(), slot='accent')[0]; app.select(acc); x0 = app.frame(acc)['x']
    p.keyboard.press('Shift+ArrowRight'); note(abs(app.frame(node(app, id=acc['id']))['x'] - x0 - 40) < .01, 'shift nudge != grid cell')
    # lock headline, try to drag and delete
    head = find(app.doc(), slot='headline')[0]; app.select(head); p.keyboard.press('Control+Shift+L')
    r = app.frame(head); app.drag_unit((r['x'] + 20, r['y'] + 10), (r['x'] + 220, r['y'] + 210))
    note(app.frame(node(app, id=head['id'])) == r, 'locked headline moved by drag')
    p.keyboard.press('Delete'); note(node(app, id=head['id']) is not None, 'locked headline deleted')
    p.keyboard.press('Enter'); p.wait_for_timeout(150); note(p.locator('textarea.text-editor').count() == 0, 'locked text opened for editing')
    p.keyboard.press('Escape')
    # autofit headline with long text (body is already at body size, where autofit stops)
    body = find(app.doc(), slot='headline')[0]; app.select(body); p.keyboard.press('Control+Shift+L'); p.wait_for_timeout(100)
    p.locator('.toolbar button[title="Autofit"]').click(); p.wait_for_timeout(100)
    b1 = node(app, id=body['id']); note(b1.get('fit') is True, 'autofit did not turn on')
    h0 = app.frame(b1)['h']
    p.keyboard.press('Enter'); p.wait_for_timeout(150); type_text(app, ' '.join(['Doors at eight, music till late.'] * 20))
    b2 = node(app, id=body['id']); note(abs(app.frame(b2)['h'] - h0) < .5, f'autofit box height changed {h0} -> {app.frame(b2)["h"]}')
    sz = p.locator('.toolbar .readout[title="Font size"]').inner_text()
    note(sz.isdigit() and int(sz) < b2['frames']['main'].get('fontSize', 999), f'autofit did not step the size down (shown {sz}, set {b2["frames"]["main"].get("fontSize")})')
    note(b2['text'].startswith('Doors at eight'), 'Enter after clicking Fit did not open the text for editing')
    # rotate accent with Shift: 15° steps
    acc = node(app, id=acc['id']); app.select(acc); r = app.frame(acc); k = app.scale(); cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    app.drag_unit((cx, r['y'] - 44 / k), (cx + 120, r['y'] - 44 / k + 20), shift=True)
    rot = node(app, id=acc['id'])['frames']['main']['rot']; note(abs(rot / 15 - round(rot / 15)) < 1e-6, f'Shift rotate not 15° steps: {rot}')
    note(p.locator('.toolbar .readout[title="Angle"]').inner_text() == f'{round(rot)}°', 'angle readout mismatch')
    # change ratio to landscape, flags, undo
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(200)
    p.locator('.ratio-panel g[aria-label="Change to Slide 16:9"]').click(); p.wait_for_timeout(300)
    d = app.doc(); note(d['sizes'][0]['ratio'] == 'landscape', 'ratio not changed'); valid(app, d)
    p.keyboard.press('Escape'); p.keyboard.press('Control+z'); note(app.doc()['sizes'][0]['ratio'] == 'a4', 'undo of ratio change')


def layla_scripts(app):
    """Layla designs bilingual posters: Arabic, Hebrew, Japanese, emoji, long words."""
    p = app.page
    app.start({'ratio': 'portrait', 'comp': 'stack', 'guide': 'thirds', 'hue': 150, 'dark': False})
    p.keyboard.press('t'); p.wait_for_timeout(200); p.keyboard.type('مرحبا بالعالم، هذا نص طويل يلتف على عدة أسطر'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(150)
    d = app.doc(); ar = [n for n in d['nodes'] if n['kind'] == 'text' and 'مرحبا' in n['text']]
    note(ar, 'Arabic text not stored')
    p.keyboard.press('Escape')
    p.keyboard.press('t'); p.wait_for_timeout(200); p.keyboard.type('日本語のテキストはスペースなしで長く続きますのでちゃんと折り返す必要があります'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(150)
    d = app.doc(); jp = [n for n in d['nodes'] if n['kind'] == 'text' and '日本語' in n['text']][0]
    f = jp['frames']['main']; fs = f['fontSize']
    note(f['rect']['h'] > fs * 1.15 * 1.5, f'Japanese text did not wrap: rect {f["rect"]} size {fs}')
    p.keyboard.press('Escape')
    p.keyboard.press('t'); p.wait_for_timeout(200); p.keyboard.type('Pneumonoultramicroscopicsilicovolcanoconiosis'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(150)
    d = app.doc(); lw = [n for n in d['nodes'] if n['kind'] == 'text' and n['text'].startswith('Pneumono')][0]
    w = p.evaluate('''([t, s]) => { const c = document.createElement('canvas').getContext('2d'); c.font = `700 ${s}px "Space Grotesk"`; return c.measureText(t).width; }''', [lw['text'], lw['frames']['main']['fontSize']])
    note(w <= lw['frames']['main']['rect']['w'] + 1 or lw['frames']['main']['rect']['h'] > lw['frames']['main']['fontSize'] * 1.2 * 1.5, f'long word overflows its box: text {w:.0f} > box {lw["frames"]["main"]["rect"]["w"]:.0f}')
    p.keyboard.press('Escape')
    p.keyboard.press('t'); p.wait_for_timeout(200); p.keyboard.type('שלום 👋🏽 עולם'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(150)
    p.keyboard.press('Escape')
    path = app.export('svg'); text = path.read_text()
    import xml.dom.minidom
    try: xml.dom.minidom.parseString(text)
    except Exception as e: note(False, f'SVG does not parse with mixed scripts: {e}')
    note('direction="rtl"' in text or 'unicode-bidi' in text or 'text-anchor="end"' in text, 'RTL text has no direction in SVG')
    app.close_panels()
    path = app.export('png'); note(png_size(path)[0] == (1080, 1350), 'portrait png')
    app.close_panels(); valid(app)


def kai_keyboard(app):
    """Kai works keyboard-only."""
    p = app.page
    app.fresh({'ratio': 'square', 'comp': 'split', 'guide': 'divisions', 'hue': 270, 'dark': False})
    for _ in range(3): p.keyboard.press('Tab')
    focused = p.evaluate('document.activeElement && (document.activeElement.className || document.activeElement.tagName)')
    note(focused not in ('', 'BODY', None), f'Tab focus lands nowhere visible: {focused}')
    p.evaluate('document.activeElement && document.activeElement.blur()')
    p.keyboard.press('Enter'); p.wait_for_timeout(500); p.keyboard.type('Keyboard only'); p.keyboard.press('Control+Enter')
    note(node(app, text='Keyboard only'), 'headline typing')
    p.keyboard.press('Escape'); n0 = len(app.doc()['nodes'])
    p.keyboard.press('r'); p.wait_for_timeout(100); rect = app.doc()['nodes'][-1]
    note(rect.get('shape') == 'rect', 'R did not add a rectangle')
    x0 = app.frame(rect)['x']
    for _ in range(5): p.keyboard.press('ArrowRight')
    note(abs(app.frame(node(app, id=rect['id']))['x'] - x0 - 5) < .01, 'arrows did not nudge 5')
    p.keyboard.press('Control+z'); note(abs(app.frame(node(app, id=rect['id']))['x'] - x0) < .01, 'quick nudges are not one undo step')
    p.keyboard.press('Control+d'); note(len(app.doc()['nodes']) == n0 + 2, 'Mod+D')
    p.keyboard.press('Control+Shift+BracketLeft'); note(app.doc()['nodes'][0]['shape'] == 'rect', 'send to back')
    p.keyboard.press('Control+a'); p.keyboard.press('Delete')
    note(len(app.doc()['nodes']) == 0, f'select all + delete left {len(app.doc()["nodes"])}')
    p.keyboard.press('Control+z'); note(len(app.doc()['nodes']) == n0 + 2, 'undo after delete all')
    p.keyboard.press('?'); p.wait_for_timeout(150); note(p.locator('.modal:not([hidden])').count() == 1, '? opens shortcuts')
    p.keyboard.press('?'); p.wait_for_timeout(150); note(p.locator('.modal:not([hidden])').count() == 0, '? again closes shortcuts')
    # Escape chain: tool then deselect
    p.keyboard.press('p'); p.wait_for_timeout(100); note(toolbar(app, 'Sketch').get_attribute('aria-pressed') == 'true', 'P pen')
    p.keyboard.press('Escape'); p.wait_for_timeout(100); note(toolbar(app, 'Sketch').get_attribute('aria-pressed') == 'false', 'Esc leaves the tool')
    # Tab into toolbar, press Enter on Text button
    p.locator('.toolbar button[aria-label="Text"]').focus(); p.keyboard.press('Enter'); p.wait_for_timeout(200)
    note(p.locator('textarea.text-editor').count() == 1, 'Enter on the Text button did not add text to edit')
    p.keyboard.type('From toolbar'); p.keyboard.press('Control+Enter')
    note(node(app, text='From toolbar'), 'toolbar text')
    # after finishing text, shortcuts work again
    p.keyboard.press('Escape'); p.keyboard.press('o'); p.wait_for_timeout(100)
    note(app.doc()['nodes'][-1].get('shape') == 'circle', 'O after text editing did nothing (focus lost?)')
    # Export via keyboard; Enter downloads; Escape closes
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    note(p.locator('.sheet:not([hidden])').count() == 1, 'Mod+Shift+E')
    with p.expect_download(timeout=30000) as dl: p.keyboard.press('Enter')
    note(dl.value.suggested_filename.endswith('.png'), 'Enter in export sheet')
    p.keyboard.press('Escape'); p.wait_for_timeout(150); note(p.locator('.sheet:not([hidden])').count() == 0, 'Escape closes export')
    valid(app)


def sam_sketch(app):
    """Sam sketches with a pen."""
    p = app.page
    app.start({'ratio': 'landscape', 'comp': 'band', 'guide': 'thirds', 'hue': 60, 'dark': False})
    n0 = len(app.doc()['nodes'])
    p.keyboard.press('p'); p.wait_for_timeout(100)
    # freehand squiggle, released quickly -> ink
    pts = [(100 + i * 8, 400 + 30 * math.sin(i / 3)) for i in range(40)]
    p.mouse.move(*app.to_px(*pts[0])); p.mouse.down()
    for q in pts[1:]: p.mouse.move(*app.to_px(*q))
    p.mouse.up(); p.wait_for_timeout(300)
    d = app.doc(); note(len(d['nodes']) == n0 + 1 and d['nodes'][-1]['kind'] == 'ink', f'freehand stroke not added ({len(d["nodes"]) - n0})')
    # rectangle, hold at end -> cleaned rect
    rect = [(600, 100), (850, 100), (850, 300), (600, 300), (600, 102)]
    p.mouse.move(*app.to_px(*rect[0])); p.mouse.down()
    for a, b in zip(rect, rect[1:]):
        for t in range(1, 11): p.mouse.move(*app.to_px(a[0] + (b[0] - a[0]) * t / 10, a[1] + (b[1] - a[1]) * t / 10))
    p.wait_for_timeout(700); p.mouse.up(); p.wait_for_timeout(500)
    d = app.doc(); last = d['nodes'][-1]; note(last['kind'] == 'ink' and last.get('form') == 'rect', f'held rectangle not cleaned: {last.get("form")}')
    # scribble over freehand stroke -> deleted
    ink = d['nodes'][-2]; r = app.frame(ink)
    p.mouse.move(*app.to_px(r['x'], r['y'])); p.mouse.down()
    for i in range(24): p.mouse.move(*app.to_px(r['x'] + (r['w'] if i % 2 else 0), r['y'] + r['h'] * i / 24))
    p.mouse.up(); p.wait_for_timeout(400)
    note(not node(app, id=ink['id']), 'scribble did not delete the stroke under it')
    # eraser removes the rect ink
    p.keyboard.press('e'); p.wait_for_timeout(100)
    app.drag_unit((560, 200), (900, 200)); p.wait_for_timeout(200)
    note(not node(app, id=last['id']), 'eraser across the rectangle did not erase it')
    p.keyboard.press('Control+z'); note(node(app, id=last['id']), 'undo eraser')
    # lasso around everything
    p.keyboard.press('l'); p.wait_for_timeout(100)
    loop = [(5, 5), (995, 5), (995, 555), (5, 555), (5, 6)]
    p.mouse.move(*app.to_px(*loop[0])); p.mouse.down()
    for a, b in zip(loop, loop[1:]):
        for t in range(1, 9): p.mouse.move(*app.to_px(a[0] + (b[0] - a[0]) * t / 8, a[1] + (b[1] - a[1]) * t / 8))
    p.mouse.up(); p.wait_for_timeout(200)
    p.wait_for_timeout(120); info = p.locator('.info').inner_text(); note('selected' in info and int(info.split()[0]) == len(app.doc()['nodes']), f'lasso selection: {info}')
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    note(toolbar(app, 'Lasso').get_attribute('aria-pressed') != 'true', 'Esc did not leave lasso')
    # after leaving the tool, the lasso selection should still let you move them? Esc deselect first? check selection kept
    valid(app)


def cleo_colour(app):
    """Cleo explores colour: custom hex, add hue, dark ground, contrast fix, armed paint."""
    p = app.page
    app.start({'ratio': 'portrait', 'comp': 'frame', 'guide': 'golden', 'hue': 210, 'dark': False})
    acc = find(app.doc(), slot='accent')[0]; app.select(acc); p.keyboard.press('c'); p.wait_for_timeout(200)
    field = p.locator('.colour-panel input.field'); field.click(); field.fill('#ff00aa'); p.keyboard.press('Enter'); p.wait_for_timeout(150)
    note(node(app, id=acc['id'])['fill'] == {'hex': '#ff00aa'}, f'hex did not fill: {node(app, id=acc["id"])["fill"]}')
    add = p.locator('.colour-panel button', has_text='Add as hue'); note(add.is_visible(), 'Add as hue hidden for an off-palette hex')
    if add.is_visible(): add.click(); p.wait_for_timeout(150)
    d = app.doc(); note(d['palette']['custom'] == ['#ff00aa'], f'custom hues {d["palette"]["custom"]}')
    note(node(app, id=acc['id'])['fill'].get('row') == 'c0', f'fill after add as hue {node(app, id=acc["id"])["fill"]}')
    # undo add hue: one step should restore both palette & fill? record
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    # dark ground tap
    app.select(acc); p.keyboard.press('c'); p.wait_for_timeout(150)
    p.locator('.colour-panel .pair button[title="Dark ground"]').click(); p.wait_for_timeout(200)
    note(app.doc()['palette']['dark'] is True, 'dark ground tap')
    # low-contrast text
    head = find(app.doc(), slot='headline')[0]; app.select(head); p.wait_for_timeout(150)
    p.locator('.colour-panel .roles button', has_text='Ground').click(); p.wait_for_timeout(200)
    box = p.locator('.colour-panel .contrast'); note(box.is_visible(), 'contrast warning missing for ground-on-ground text')
    use = box.locator('button', has_text='use')
    if use.count(): use.click(); p.wait_for_timeout(150)
    d = app.doc(); f = node(app, id=head['id'])['fill']; note(f != {'role': 'ground'}, f'nearest passing shade not applied: {f}')
    note(not box.is_visible(), 'contrast warning still showing after fix')
    # neutral hue
    p.locator('.colour-panel .hues button[aria-label="No hue"]').click(); p.wait_for_timeout(150)
    note(app.doc()['palette']['hue'] is None, 'no hue')
    # armed paint: deselect and tap ground
    app.click_unit(990, 1240); p.wait_for_timeout(100)
    if p.locator('.colour-panel:not([hidden])').count() == 0: p.keyboard.press('c'); p.wait_for_timeout(150)
    p.locator('.colour-panel .shades button').nth(2).click(); p.wait_for_timeout(100)
    app.click_unit(990, 1240); d = app.doc(); note(d['ground'] is not None, 'armed tap on empty canvas did not fill ground')
    p.keyboard.press('Escape'); p.wait_for_timeout(80)
    note(p.locator('.colour-panel:not([hidden])').count() == 1, 'first Escape should only disarm, panel closed instead')
    p.keyboard.press('Escape'); p.wait_for_timeout(80)
    note(p.locator('.colour-panel:not([hidden])').count() == 0, 'second Escape should close the colour panel')
    # PNG no ground option hidden when ground filled
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    note(not p.locator('.sheet button[aria-label="No ground"]').is_visible(), 'No ground offered while the ground is filled')
    app.close_panels(); valid(app)


def pat_power(app):
    """Pat edits fast: marquee, shift-click, copy/paste offsets, layers, hide per size, Shift-drag axis, text corner scale."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 330, 'dark': False})
    acc = find(app.doc(), slot='accent')[0]
    # Shift-drag axis lock on an already-selected object
    r = app.frame(acc); a = (r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    app.select(acc); app.drag_unit(a, (a[0] + 150, a[1] + 30), shift=True, alt=True)
    r2 = app.frame(node(app, id=acc['id'])); note(abs(r2['y'] - r['y']) < .01 and abs(r2['x'] - r['x'] - 150) < 1.5, f'shift drag not axis-locked: {r} -> {r2}')
    p.wait_for_timeout(100); note(p.locator('.info').inner_text().startswith('Rectangle'), 'shift drag dropped the object from the selection')
    p.keyboard.down('Shift'); app.click_unit(*app.node_centre(node(app, id=acc['id']))); p.keyboard.up('Shift'); p.wait_for_timeout(120)
    note(p.locator('.toolbar button[aria-label="Delete"]').is_disabled(), 'shift click on the selected object did not deselect it')
    app.select(node(app, id=acc['id']))
    p.keyboard.press('Control+c')
    for _ in range(3): p.keyboard.press('Control+v')
    d = app.doc(); copies = [n for n in d['nodes'] if n.get('shape') == acc['shape']]
    xs = sorted(app.frame(n)['x'] for n in copies)
    note(len(copies) == 4 and len(set(round(x) for x in xs)) == 4, f'repeated paste stacked on top: {xs}')
    note(all('slot' not in n for n in copies if n['id'] != acc['id']), 'pasted copies kept the slot tag (relayout would move them)')
    # text corner scales font
    head = find(app.doc(), slot='headline')[0]; app.select(head); hr = app.frame(head); fs0 = head['frames']['main']['fontSize']
    app.drag_unit((hr['x'] + hr['w'], hr['y'] + hr['h']), (hr['x'] + hr['w'] * 1.08, hr['y'] + hr['h'] * 1.08), alt=True)
    h2 = node(app, id=head['id']); note(h2['frames']['main']['fontSize'] > fs0 * 1.05, f'corner did not scale font: {fs0} -> {h2["frames"]["main"]["fontSize"]}')
    # e handle rewraps, font stays
    hr = app.frame(h2); fs1 = h2['frames']['main']['fontSize']; mid = hr['y'] + hr['h'] / 2
    app.drag_unit((hr['x'] + hr['w'], mid), (hr['x'] + hr['w'] * .5, mid), alt=True)
    h3 = node(app, id=head['id']); note(abs(h3['frames']['main']['fontSize'] - fs1) < .01 and app.frame(h3)['w'] < hr['w'] * .7, f'e handle did not rewrap: {app.frame(h3)}')
    # hide in this size via layers, select all must skip hidden
    p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200)
    p.locator('.layer').nth(0).locator('button[aria-label="Hide"]').click(); p.wait_for_timeout(100)
    p.keyboard.press('Escape')
    p.keyboard.press('Control+a'); p.wait_for_timeout(120); info = p.locator('.info').inner_text(); total = len(app.doc()['nodes'])
    note(info.startswith(f'{total - 1} selected'), f'select all with one hidden: {info} of {total}')
    # Delete with hidden excluded
    p.keyboard.press('Escape')
    # marquee from empty corner selects intersecting
    app.click_unit(995, 995); app.drag_unit((999, 999), (600, 600)); p.wait_for_timeout(120); info = p.locator('.info').inner_text()
    note(info != '', f'marquee from corner selected nothing: {info!r}')
    # copy, then undo the paste: selection & count
    p.keyboard.press('Escape'); n = len(app.doc()['nodes']); app.select(acc); p.keyboard.press('Control+x'); p.keyboard.press('Control+v'); p.keyboard.press('Control+v')
    note(len(app.doc()['nodes']) == n + 1, f'cut + 2 pastes: {len(app.doc()["nodes"]) - n}')
    # paste after cut: first paste should be in place? check offsets
    valid(app)


def ren_returning(app):
    """Ren comes back later: reload, dial round trip, New, undo New."""
    p = app.page
    app.start({'ratio': 'story', 'comp': 'stack', 'guide': 'golden', 'hue': 90, 'dark': False})
    head = find(app.doc(), slot='headline')[0]; app.select(head); p.keyboard.press('Enter'); p.wait_for_timeout(150); type_text(app, 'Ren was here')
    p.keyboard.press('Escape'); p.keyboard.press('r'); p.wait_for_timeout(100)
    before = app.doc(); p.reload(); p.wait_for_timeout(800)
    after = app.doc(); note(after == before, 'reload changed the document')
    note(p.locator('canvas.overlay').is_visible(), 'reload did not return to the editor')
    # undo after reload: history is session only -> "Nothing to undo"
    p.keyboard.press('Control+z'); p.wait_for_timeout(100)
    note(app.doc() == before, 'undo after reload changed the document')
    # dial round trip with ratio change
    p.locator('button.wordmark').click(); p.wait_for_timeout(400)
    note(p.locator('.dial').is_visible(), 'wordmark -> dial')
    p.keyboard.press('ArrowLeft'); p.wait_for_timeout(200)   # ratio story -> landscape
    p.locator('.dial .dial-actions button', has_text='Go').click(); p.wait_for_timeout(800)
    d = app.doc(); note(d['sizes'][0]['ratio'] == 'landscape', f'Go ratio {d["sizes"][0]["ratio"]}'); valid(app, d)
    note(node(app, slot='headline')['text'] == 'Ren was here', 'Go lost the headline text')
    rect = [n for n in d['nodes'] if n.get('shape') == 'rect' and 'slot' not in n]
    note(rect, 'Go dropped the extra rectangle')
    for n in d['nodes']:
        r = app.frame(n)
        note(r['y'] + r['h'] <= 562.5 + 1, f'{n["kind"]} {n.get("slot")} off canvas after Go: {r}')
    # New design and undo
    p.locator('button.wordmark').click(); p.wait_for_timeout(400)
    p.locator('.dial .dial-actions button', has_text='New').click(); p.wait_for_timeout(600)
    note(not node(app, text='Ren was here'), 'New kept the old content')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    p.keyboard.press('Control+z'); p.wait_for_timeout(200)
    note(node(app, text='Ren was here'), 'Undo did not bring back the previous design')
    # dial reload on dial screen
    p.locator('button.wordmark').click(); p.wait_for_timeout(300); p.reload(); p.wait_for_timeout(600)
    note(p.locator('canvas.overlay').is_visible() or p.locator('.dial').is_visible(), 'blank screen after reload on dial')


def chaos(app, seed=7, steps=260):
    """A curious person mashing everything."""
    p = app.page; rng = random.Random(seed)
    app.start({'ratio': rng.choice(ba.RATIOS), 'comp': rng.choice(ba.COMPS), 'guide': rng.choice(ba.GUIDES), 'hue': rng.choice([0, 30, None]), 'dark': rng.random() < .5})
    keys = ['t', 'r', 'o', 'i', 'p', 'e', 'l', 'g', 'Escape', 'Delete', 'Enter', 'ArrowLeft', 'Shift+ArrowDown', 'Control+z', 'Control+Shift+z', 'Control+d', 'Control+c', 'Control+v', 'Control+x', 'Control+a',
            'Control+BracketRight', 'Control+Shift+BracketLeft', 'Control+Shift+L', 'Control+b', 'c', 's', '?']
    k0 = len(ba.errors)
    for i in range(steps):
        a = rng.random(); H = app.box()['height'] / app.scale()
        try:
            if p.locator('textarea.text-editor').count() and rng.random() < .5: p.keyboard.type(rng.choice(['hi', ' ', 'ü', '\n', 'longer words here'])); continue
            if a < .4: p.keyboard.press(rng.choice(keys))
            elif a < .6:
                sh = rng.random() < .2
                if sh: p.keyboard.down('Shift')
                app.click_unit(rng.uniform(-30, 1030), rng.uniform(-30, H + 30))
                if sh: p.keyboard.up('Shift')
            elif a < .85:
                x, y = rng.uniform(0, 1000), rng.uniform(0, H)
                app.drag_unit((x, y), (x + rng.uniform(-300, 300), y + rng.uniform(-300, 300)), steps=rng.randint(2, 10), alt=rng.random() < .3, shift=rng.random() < .2)
            elif a < .9: p.mouse.dblclick(*app.to_px(rng.uniform(0, 1000), rng.uniform(0, H)))
            else:
                btns = p.locator('.toolbar button:not([disabled]):visible, .corner button:visible, .corner-stack button:visible')
                c = btns.count()
                if c:
                    try: btns.nth(rng.randrange(c)).click(timeout=800)
                    except Exception: pass
        except Exception as e:  # noqa: BLE001
            note(False, f'step {i} action failed: {str(e)[:120]}')
        if p.locator('.sheet:not([hidden])').count(): p.keyboard.press('Escape')
        if i % 40 == 39:
            valid(app)
    p.keyboard.press('Escape'); valid(app)
    note(not errs_since(k0), f'console errors during chaos: {errs_since(k0)[:3]}')


def sol_small(app):
    """Sol is on a small laptop window."""
    p = app.page; p.set_viewport_size({'width': 900, 'height': 560})
    app.fresh({'ratio': 'banner', 'comp': 'band', 'guide': 'thirds', 'hue': 180, 'dark': False}); p.wait_for_timeout(300)
    hub = p.locator('.hub').bounding_box(); note(hub and hub['y'] >= 0 and hub['y'] + hub['height'] <= 560, f'hub off-screen at 900×560: {hub}')
    start = p.locator('.dial-actions button.solid').bounding_box(); note(start and start['y'] + start['height'] <= 560, f'Start off-screen: {start}')
    p.keyboard.press('Enter'); p.wait_for_timeout(500); p.keyboard.press('Escape'); p.keyboard.press('Escape')
    bar = p.locator('.toolbar').bounding_box(); note(bar['x'] >= 0 and bar['x'] + bar['width'] <= 900, f'toolbar overflows: {bar}')
    word = p.locator('button.wordmark').bounding_box(); corner = p.locator('.corner').bounding_box()
    note(bar['x'] >= word['x'] + word['width'] - 1 and bar['x'] + bar['width'] <= corner['x'] + 1, f'toolbar overlaps wordmark/corner: bar {bar} word {word} corner {corner}')
    cv = app.box(); note(cv['y'] >= bar['y'] + bar['height'], f'canvas under toolbar: {cv} {bar}')
    p.keyboard.press('c'); p.wait_for_timeout(200); pb = p.locator('.colour-panel').bounding_box()
    note(pb['y'] + pb['height'] <= 560 + 1 and pb['x'] >= 0 and pb['x'] + pb['width'] <= 900, f'colour panel off-screen: {pb}')
    p.keyboard.press('Escape'); p.keyboard.press('s'); p.wait_for_timeout(200); pb = p.locator('.shapes-panel').bounding_box()
    note(pb['y'] + pb['height'] <= 560 + 1 and pb['x'] >= 0 and pb['x'] + pb['width'] <= 900, f'shapes panel off-screen: {pb}')
    p.keyboard.press('Escape'); p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    sb = p.locator('.sheet .download').bounding_box(); note(sb and sb['y'] + sb['height'] <= 560, f'export download button off-screen: {sb}')
    p.keyboard.press('Escape')
    p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200); lb = p.locator('.layers-panel').bounding_box()
    note(lb['y'] + lb['height'] <= 560 + 1 and lb['x'] >= 0, f'layers panel off-screen: {lb}')
    p.keyboard.press('Escape')
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(200); rb = p.locator('.ratio-panel').bounding_box()
    note(rb['y'] + rb['height'] <= 560 + 1 and rb['x'] >= 0, f'ratio panel off-screen: {rb}')
    p.keyboard.press('Escape')
    p.set_viewport_size({'width': 1440, 'height': 900})


def pixel(app, x, y):
    px, py = app.to_px(x, y)
    import io
    return Image.open(io.BytesIO(app.page.screenshot(clip={'x': px - 1, 'y': py - 1, 'width': 3, 'height': 3}))).convert('RGB').getpixel((1, 1))


def drop_many(app, paths, x, y):
    data = [[list(Path(pth).read_bytes()), Path(pth).name, mime] for pth, mime in paths]
    px, py = app.to_px(x, y)
    app.page.evaluate('''([files, x, y]) => {
      const dt = new DataTransfer(); for (const [d, n, m] of files) dt.items.add(new File([new Uint8Array(d)], n, { type: m }));
      const t = document.elementFromPoint(x, y) || document.body;
      t.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
      t.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
    }''', [data, px, py])
    app.page.wait_for_timeout(2000)


def ines_photos(app):
    """Ines is a photographer laying out a square grid post."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 20, 'dark': False})
    n0 = len(app.doc()['nodes'])
    a = image_file(OUT / 'ines-a.png', 900, 600, (200, 40, 40)); b = image_file(OUT / 'ines-b.png', 600, 900, (40, 40, 200)); c = image_file(OUT / 'ines-c.png', 800, 800, (40, 160, 40))
    drop_many(app, [(a, 'image/png'), (b, 'image/png'), (c, 'image/png')], 980, 980)
    d = app.doc(); imgs = [n for n in d['nodes'] if n['kind'] == 'image' and n['asset']]
    note(len(d['nodes']) == n0 + 3 and len(imgs) == 3, f'dropping 3 images added {len(d["nodes"]) - n0}')
    note(len({n['asset'] for n in imgs}) == 3, 'distinct images share one asset')
    for n in imgs:
        r = app.frame(n); note(r['x'] >= -1 and r['y'] >= -1 and r['x'] + r['w'] <= 1001 and r['y'] + r['h'] <= 1001, f'dropped image off canvas: {r}')
    k = len(ba.errors)
    txt = OUT / 'notes.txt'; txt.write_text('hello')
    drop_many(app, [(txt, 'text/plain')], 500, 500)
    note(len(app.doc()['nodes']) == n0 + 3, 'a text file was added as an image')
    note('PNG, JPEG' in p.locator('.toast').inner_text(), f'no toast for a non-image drop: {p.locator(".toast").inner_text()!r}')
    # big image into the cover frame
    big = OUT / 'ines-big.jpg'
    Image.new('RGB', (5000, 3500), (30, 120, 200)).save(big, quality=80)
    frame = find(app.doc(), slot='image')[0]; fx, fy = app.node_centre(frame)
    drop_many(app, [(big, 'image/jpeg')], fx, fy)
    f2 = node(app, id=frame['id']); note(f2['asset'], 'big image did not fill the cover frame')
    rec = p.evaluate('''(key) => new Promise(res => { const r = indexedDB.open("kura8"); r.onsuccess = () => { const g = r.result.transaction("assets").objectStore("assets").get(key); g.onsuccess = () => res(g.result && { natural: g.result.natural, work: g.result.work, ow: g.result.original.size, ww: g.result.working.size }); }; })''', f2['asset'])
    note(rec and rec['natural'] == {'w': 5000, 'h': 3500} and max(rec['work'].values()) <= 2160, f'working copy size {rec}')
    # resize image corner keeps aspect
    app.select(f2); r = app.frame(f2); ar = r['w'] / r['h']
    app.drag_unit((r['x'] + r['w'] - 2, r['y'] + r['h'] - 2), (r['x'] + r['w'] - 150, r['y'] + r['h'] - 60), alt=True)
    r2 = app.frame(node(app, id=frame['id'])); note(abs(r2['w'] / r2['h'] - ar) < .01, f'image corner resize changed aspect {ar:.3f} -> {r2["w"] / r2["h"]:.3f}')
    # replace by dropping another image on it
    drop_many(app, [(c, 'image/png')], *app.node_centre(node(app, id=frame['id'])))
    f3 = node(app, id=frame['id']); note(f3['asset'] != f2['asset'], 'dropping onto a filled image did not replace it')
    note(len(app.doc()['nodes']) == n0 + 3, 'replacing added a node')
    # delete, wait for eviction, undo -> still draws
    top = [n for n in app.doc()['nodes'] if n['kind'] == 'image'][-1]; app.select(top); cx, cy = app.node_centre(top)
    p.keyboard.press('Delete'); p.wait_for_timeout(2600); p.keyboard.press('Control+z'); p.wait_for_timeout(900)
    col = pixel(app, *[v for v in (app.frame(top)['x'] + app.frame(top)['w'] / 2, app.frame(top)['y'] + app.frame(top)['h'] / 2)])
    note(max(col) - min(col) > 60, f'image not drawn after undo of delete: {col}')
    # export png pixel at the cover image
    p.keyboard.press('Escape'); path = app.export('png'); im = Image.open(path).convert('RGB')
    r = app.frame(node(app, id=frame['id'])); s = 1080 / 1000
    px = im.getpixel((int((r['x'] + r['w'] / 2) * s), int((r['y'] + r['h'] / 2) * s)))
    note(px[1] > px[0] + 30 and px[1] > px[2] + 30, f'export pixel at the cover image is not the green photo: {px}')
    app.close_panels()
    # clipboard paste of an image
    n1 = len(app.doc()['nodes'])
    p.evaluate('''(data) => { const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(data)], 'clip.png', { type: 'image/png' })); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }''', list(Path(a).read_bytes()))
    p.wait_for_timeout(1500)
    note(len(app.doc()['nodes']) == n1 + 1, 'pasting an image from the system clipboard did nothing')
    # empty frame + double-click opens the picker
    p.keyboard.press('Escape'); p.keyboard.press('i'); p.wait_for_timeout(200); empty = app.doc()['nodes'][-1]
    note(empty['kind'] == 'image' and empty['asset'] is None, 'I did not add an empty frame')
    with p.expect_file_chooser(timeout=5000) as fc: p.mouse.dblclick(*app.to_px(*app.node_centre(empty)))
    fc.value.set_files(str(b)); p.wait_for_timeout(1500)
    note(node(app, id=empty['id'])['asset'], 'picking a file for the empty frame did not fill it')
    # I with a filled image selected adds a new frame, not the picker
    p.keyboard.press('Escape'); valid(app)


def tom_worksheet(app):
    """Tom, a teacher, builds an A4 worksheet with lots of text."""
    p = app.page
    app.start({'ratio': 'a4', 'comp': 'stack', 'guide': 'divisions', 'hue': 120, 'dark': False})
    p.keyboard.press('t'); p.wait_for_timeout(200); p.keyboard.type('Question 1\nWhat is 7 × 8?'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    q = app.doc()['nodes'][-1]; note(q['text'] == 'Question 1\nWhat is 7 × 8?', f'multi-line text {q["text"]!r}')
    fs0 = q['frames']['main']['fontSize']
    for _ in range(3): toolbar(app, 'Larger').click()
    p.wait_for_timeout(100); q2 = node(app, id=q['id']); note(q2['frames']['main']['fontSize'] > fs0, 'Larger did not grow the font')
    note(app.frame(q2)['h'] > app.frame(q)['h'], 'box height did not grow with the font')
    for _ in range(40): toolbar(app, 'Smaller').click()
    q3 = node(app, id=q['id']); note(q3['frames']['main']['fontSize'] >= 6, f'font went below 6: {q3["frames"]["main"]["fontSize"]}')
    toolbar(app, 'Align').click(); toolbar(app, 'Align').click(); note(node(app, id=q['id'])['align'] == 'end', 'align cycle')
    p.locator('.toolbar button[title^="Bold"]').click(); note(node(app, id=q['id'])['weight'] == 400, 'bold toggle on new bold text')
    # Enter now edits (focus returned to canvas)
    p.keyboard.press('Enter'); p.wait_for_timeout(150); note(p.locator('textarea.text-editor').count() == 1, 'Enter after toolbar clicks did not edit text')
    p.keyboard.press('Escape')
    # empty text is removed; undo brings it back once
    n = len(app.doc()['nodes']); p.keyboard.press('t'); p.wait_for_timeout(150); p.keyboard.press('Backspace'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    note(len(app.doc()['nodes']) == n, 'empty new text was kept')
    p.keyboard.press('Control+z'); p.wait_for_timeout(100)
    note(len(app.doc()['nodes']) == n, 'undo after an abandoned empty text box resurrected it')
    # click elsewhere finishes; the click also deselects
    head = find(app.doc(), slot='headline')[0]; app.select(head); p.keyboard.press('Enter'); p.wait_for_timeout(100); p.keyboard.type(' edited')
    app.click_unit(990, 1400); p.wait_for_timeout(150)
    note(p.locator('textarea.text-editor').count() == 0, 'clicking the canvas did not finish editing')
    note(node(app, id=head['id'])['text'].endswith(' edited'), 'edit lost on click away')
    p.keyboard.press('Control+z'); p.wait_for_timeout(100); note(not node(app, id=head['id'])['text'].endswith(' edited'), 'text edit not one undo step')
    p.keyboard.press('Control+Shift+z')
    # edit then wordmark
    app.select(node(app, id=head['id'])); p.keyboard.press('Enter'); p.wait_for_timeout(100); p.keyboard.press('Control+End'); p.keyboard.type('!')
    p.locator('button.wordmark').click(); p.wait_for_timeout(400)
    p.locator('.dial .dial-actions button', has_text='Back to canvas').click(); p.wait_for_timeout(300)
    note(node(app, id=head['id'])['text'].endswith('edited!'), f'edit lost going to the dial: {node(app, id=head["id"])["text"]!r}')
    # resize window while editing: textarea follows the node
    app.select(node(app, id=head['id'])); p.keyboard.press('Enter'); p.wait_for_timeout(100)
    p.set_viewport_size({'width': 1100, 'height': 760}); p.wait_for_timeout(400)
    ta = p.locator('textarea.text-editor').bounding_box(); r = app.frame(node(app, id=head['id'])); x, y = app.to_px(r['x'], r['y'])
    note(ta and abs(ta['x'] - x) < 4 and abs(ta['y'] - y) < 4, f'textarea did not follow the resize: {ta} vs {(x, y)}')
    p.keyboard.press('Escape'); p.set_viewport_size({'width': 1440, 'height': 900}); p.wait_for_timeout(300)
    # many undos then redos return to the same doc
    d0 = app.doc()
    for _ in range(30): p.keyboard.press('Control+z')
    for _ in range(30): p.keyboard.press('Control+Shift+z')
    note(app.doc() == d0, 'undo×30 then redo×30 did not return to the same document')
    valid(app)


def ivy_icons(app):
    """Ivy hunts for icons for a coffee shop banner."""
    p = app.page
    app.start({'ratio': 'banner', 'comp': 'split', 'guide': 'golden', 'hue': 30, 'dark': False})
    p.keyboard.press('s'); p.wait_for_timeout(300)
    search = p.locator('.shapes-panel input'); note(search.count() == 1, 'no icon search')
    search.fill('coffee'); p.wait_for_timeout(800)
    cnt = p.locator('.shapes-panel button').count()
    note(cnt > 2, f'coffee found {cnt} buttons')
    search.fill('cup'); p.wait_for_timeout(800); cup = p.locator('.shapes-panel button').count()
    note(cup > 2, 'synonym cup finds nothing')
    search.fill('zzzzqq'); p.wait_for_timeout(600)
    txt = p.locator('.shapes-panel').inner_text(); note('No' in txt or 'no ' in txt.lower() or 'nothing' in txt.lower(), f'no empty state for nonsense: {txt[:120]!r}')
    search.press('Escape'); p.wait_for_timeout(200); note(search.input_value() == '', 'Escape did not clear the search')
    note(p.locator('.shapes-panel:not([hidden])').count() == 1, 'first Escape closed the panel')
    search.fill('coffee'); p.wait_for_timeout(800)
    n0 = len(app.doc()['nodes'])
    icon_btns = p.locator('.shapes-panel [aria-label*="offee"], .shapes-panel [title*="offee"]')
    note(icon_btns.count() > 0, 'no button labelled coffee')
    if icon_btns.count(): icon_btns.first.click(); p.wait_for_timeout(600)
    d = app.doc(); ic = d['nodes'][-1]; note(len(d['nodes']) == n0 + 1 and ic.get('shape') == 'icon' and ic['icon']['d'], f'icon not added: {ic.get("shape")}')
    note(p.locator('.shapes-panel:not([hidden])').count() == 1, 'panel closed after adding an icon')
    r = app.frame(ic); note(r['y'] >= 0 and r['y'] + r['h'] <= 1000 / 3 + 1, f'icon taller than the banner: {r}')
    search.press('Escape'); search.press('Escape'); p.wait_for_timeout(150)
    note(p.locator('.shapes-panel:not([hidden])').count() == 0, 'second Escape did not close the panel')
    # arrows in search must not move
    p.keyboard.press('s'); p.wait_for_timeout(200); x0 = app.frame(node(app, id=ic['id']))['x']
    search.click(); search.fill('star'); search.press('ArrowLeft'); search.press('ArrowLeft'); p.wait_for_timeout(100)
    note(app.frame(node(app, id=ic['id']))['x'] == x0, 'arrow keys in the search moved the icon')
    search.press('Escape'); search.press('Escape')
    # library shape
    p.keyboard.press('s'); p.wait_for_timeout(200)
    star = p.locator('.shapes-panel button[aria-label^="Star"], .shapes-panel button[title^="Star"]')
    if star.count(): star.first.click(); p.wait_for_timeout(200); note(app.doc()['nodes'][-1].get('shape', '').startswith('star'), 'star not added')
    else: note(False, 'no Star in the shape library')
    p.keyboard.press('Escape')
    path = app.export('svg'); t = path.read_text()
    try: xml.dom.minidom.parseString(t)
    except Exception as e: note(False, f'svg parse {e}')
    note('urn:kura8:licences' in t and 'MIT' in t and 'phosphor' in t.lower(), 'licence metadata missing')
    app.close_panels(); valid(app)


def max_sizes(app):
    """Max adapts one campaign to four formats."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 200, 'dark': False})
    for label in ['Add Story 9:16', 'Add Banner 3:1', 'Add Slide 16:9']:
        p.locator('button[aria-label="Add a linked size"]').click(); p.wait_for_timeout(200)
        p.locator(f'.ratio-panel g[aria-label="{label}"]').click(); p.wait_for_timeout(300)
    d = app.doc(); note([s['ratio'] for s in d['sizes']] == ['square', 'story', 'banner', 'landscape'], f'sizes {[s["ratio"] for s in d["sizes"]]}'); valid(app, d)
    H = {'square': 1000, 'story': 1777.78, 'banner': 333.34, 'landscape': 562.5, 'portrait': 1250}
    for s in d['sizes']:
        for n in d['nodes']:
            if n['frames'][s['id']].get('hidden'): continue
            r = n['frames'][s['id']]['rect']
            note(r['x'] >= -1 and r['y'] >= -1 and r['x'] + r['w'] <= 1001 and r['y'] + r['h'] <= H[s['ratio']] + 1, f'{s["ratio"]}: {n["kind"]} {n.get("slot")} off canvas {r}')
    pills = p.locator('.corner .sizes button'); note(pills.count() == 4, f'{pills.count()} size pills')
    # banner: hide headline
    pills.nth(2).click(); p.wait_for_timeout(200)
    p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200)
    row = p.locator('.layer', has_text='Headline'); row.locator('button[aria-label="Hide"]').click(); p.keyboard.press('Escape')
    d = app.doc(); banner = d['sizes'][2]['id']; h = find(d, slot='headline')[0]
    note(h['frames'][banner].get('hidden') and not h['frames']['main'].get('hidden'), 'hide was not per size')
    # add a text in banner: frames in all sizes inside canvas
    p.keyboard.press('t'); p.wait_for_timeout(150); p.keyboard.type('Banner only?'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    d = app.doc(); t = d['nodes'][-1]
    for s in d['sizes']:
        r = t['frames'][s['id']]['rect']
        note(r['y'] >= 0 and r['y'] + r['h'] <= H[s['ratio']] + 1, f'new text in banner lands off canvas in {s["ratio"]}: {r}')
    # change banner ratio to portrait
    p.keyboard.press('Escape'); pills.nth(2).click(); p.wait_for_timeout(200)
    p.locator('.ratio-panel g[aria-label="Change to Portrait 4:5"]').click(); p.wait_for_timeout(300); p.keyboard.press('Escape')
    d = app.doc(); note(d['sizes'][2]['ratio'] == 'portrait', 'banner not changed to portrait'); valid(app, d)
    # remove story
    pills.nth(1).click(); p.wait_for_timeout(200); pills.nth(1).click(); p.wait_for_timeout(200)
    p.locator('.ratio-panel button', has_text='Remove size').click(); p.wait_for_timeout(300)
    d = app.doc(); note(len(d['sizes']) == 3 and 'story' not in [s['ratio'] for s in d['sizes']], f'remove story: {[s["ratio"] for s in d["sizes"]]}'); valid(app, d)
    p.keyboard.press('Control+z'); p.wait_for_timeout(200); d = app.doc(); note(len(d['sizes']) == 4, 'undo remove size'); valid(app, d)
    # exports per size
    exp = {'square': (1080, 1080), 'story': (1080, 1920), 'portrait': (1080, 1350), 'landscape': (1920, 1080)}
    for i in range(4):
        p.locator('.corner .sizes button').nth(i).click(); p.wait_for_timeout(200)
        ratio = app.doc()['sizes'][i]['ratio']
        if p.locator('.ratio-panel:not([hidden])').count(): p.keyboard.press('Escape')
        path = app.export('png'); note(png_size(path)[0] == exp[ratio], f'{ratio} export {png_size(path)}'); app.close_panels()
    # dial round trip from the landscape size
    p.locator('.corner .sizes button').nth(3).click(); p.wait_for_timeout(200)
    p.locator('button.wordmark').click(); p.wait_for_timeout(400)
    note('Slide 16:9' in p.locator('.card').nth(0).inner_text(), f'dial does not show the active size: {p.locator(".card").nth(0).inner_text()}')
    p.keyboard.press('ArrowDown'); p.keyboard.press('ArrowRight'); p.wait_for_timeout(200)
    p.locator('.dial .dial-actions button', has_text='Go').click(); p.wait_for_timeout(800)
    d = app.doc(); note(len(d['sizes']) == 4 and d['sizes'][3]['comp'] == 'split' and d['sizes'][0]['comp'] == 'cover', f'Go changed the wrong size: {d["sizes"]}'); valid(app, d)
    note(p.locator('.corner .sizes button[aria-pressed="true"]').inner_text().strip().endswith('16:9'), 'active size after Go is not the one re-laid')


def quinn_quota(app):
    """Quinn's browser storage is nearly full."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 0, 'dark': False})
    k = len(ba.errors)
    filled = p.evaluate('''() => { let i = 0; for (let size = 1 << 20; size >= 1; size >>= 1) { const chunk = 'x'.repeat(size); try { for (;; i++) localStorage.setItem('junk' + i, chunk); } catch {} } return i; }''')
    p.keyboard.press('r'); p.wait_for_timeout(900)
    t = p.locator('.toast').inner_text(); note('save' in t.lower(), f'no warning when saving fails: {t!r}')
    p.keyboard.press('o'); p.wait_for_timeout(900)
    p.evaluate('''() => { for (const k of Object.keys(localStorage)) if (k.startsWith('junk')) localStorage.removeItem(k); }''')
    p.keyboard.press('r'); p.wait_for_timeout(900)
    d = app.doc(); note(d and len([n for n in d['nodes'] if n.get('shape') == 'rect' and 'slot' not in n]) == 2, 'save did not recover after space was freed')
    note(not ba.errors[k:], f'errors: {ba.errors[k:]}')
    # reload keeps the recovered doc
    p.reload(); p.wait_for_timeout(700); note(app.doc() == d, 'reload after recovery')


def ula_interrupts(app):
    """Ula changes their mind mid-gesture."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'split', 'guide': 'thirds', 'hue': 260, 'dark': False})
    acc = find(app.doc(), slot='accent')[0]; r0 = app.frame(acc); c = (r0['x'] + r0['w'] / 2, r0['y'] + r0['h'] / 2)
    p.keyboard.down('Alt'); p.mouse.move(*app.to_px(*c)); p.mouse.down()
    for i in range(1, 6): p.mouse.move(*app.to_px(c[0] - 20 * i, c[1] - 20 * i))
    p.keyboard.up('Alt')
    p.keyboard.press('Control+z'); p.wait_for_timeout(100)
    for i in range(6, 10): p.mouse.move(*app.to_px(c[0] - 20 * i, c[1] - 20 * i))
    p.mouse.up(); p.wait_for_timeout(200)
    d = app.doc(); a = find(d, slot='accent')[0]
    k = len(ba.errors); valid(app, d)
    # Delete mid-drag
    a = find(app.doc(), slot='accent')[0]; r = app.frame(a); c = (r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    p.mouse.move(*app.to_px(*c)); p.mouse.down()
    for i in range(1, 5): p.mouse.move(*app.to_px(c[0] + 15 * i, c[1]))
    p.keyboard.press('Delete'); p.wait_for_timeout(100)
    for i in range(5, 9): p.mouse.move(*app.to_px(c[0] + 15 * i, c[1]))
    p.mouse.up(); p.wait_for_timeout(200)
    note(not node(app, id=a['id']), 'Delete mid-drag did not delete (or drag resurrected it)')
    p.keyboard.press('Control+z'); p.wait_for_timeout(100); back = node(app, id=a['id'])
    note(back is not None, 'undo after delete mid-drag')
    # Escape mid-resize
    app.select(back); r = app.frame(back)
    p.mouse.move(*app.to_px(r['x'] + r['w'], r['y'] + r['h'])); p.mouse.down()
    for i in range(1, 5): p.mouse.move(*app.to_px(r['x'] + r['w'] + 10 * i, r['y'] + r['h'] + 10 * i))
    p.keyboard.press('Escape'); p.wait_for_timeout(50)
    for i in range(5, 8): p.mouse.move(*app.to_px(r['x'] + r['w'] + 10 * i, r['y'] + r['h'] + 10 * i))
    p.mouse.up(); p.wait_for_timeout(200)
    after = app.frame(node(app, id=a['id']))
    note(after == r, f'Escape mid-resize did not cancel the resize: {r} -> {after}')
    # Escape mid-move cancels
    r = app.frame(node(app, id=a['id'])); c = (r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    p.mouse.move(*app.to_px(*c)); p.mouse.down()
    for i in range(1, 6): p.mouse.move(*app.to_px(c[0] + 15 * i, c[1] + 9 * i))
    p.keyboard.press('Escape'); p.wait_for_timeout(50); p.mouse.move(*app.to_px(c[0] + 100, c[1] + 70)); p.mouse.up(); p.wait_for_timeout(200)
    after = app.frame(node(app, id=a['id'])); note(after == r, f'Escape mid-move did not cancel the move: {r} -> {after}')
    # undo storms
    for _ in range(25): p.keyboard.press('Control+z')
    for _ in range(25): p.keyboard.press('Control+y')
    valid(app)
    # typing then native undo inside the textarea
    head = find(app.doc(), slot='headline')[0]; app.select(head); p.keyboard.press('Enter'); p.wait_for_timeout(100)
    p.keyboard.type('abc'); p.keyboard.press('Control+z'); p.keyboard.press('Escape'); p.wait_for_timeout(100)
    note(not ba.errors[k:], f'errors {ba.errors[k:]}'); valid(app)


def dee_dark(app):
    """Dee works on a dark ground and previews light."""
    p = app.page
    app.start({'ratio': 'portrait', 'comp': 'poster', 'guide': 'thirds', 'hue': 300, 'dark': True})
    d = app.doc(); note(d['palette']['dark'] is True, 'dial dark not applied')
    g = pixel(app, 990, 600); note(sum(g) < 200, f'dark ground looks light: {g}')
    p.keyboard.press('r'); p.wait_for_timeout(100); rect = app.doc()['nodes'][-1]
    p.keyboard.press('Escape'); p.keyboard.press('c'); p.wait_for_timeout(200)
    light = p.locator('.colour-panel .pair button[title="Light ground"]').bounding_box()
    p.mouse.move(light['x'] + light['width'] / 2, light['y'] + light['height'] / 2); p.mouse.down(); p.wait_for_timeout(700)
    g2 = pixel(app, 990, 600); note(sum(g2) > 500, f'hold did not preview light: {g2}')
    p.mouse.up(); p.wait_for_timeout(200)
    note(app.doc()['palette']['dark'] is True, 'holding light committed it'); g3 = pixel(app, 990, 600); note(sum(g3) < 200, f'preview did not end: {g3}')
    p.locator('.colour-panel .pair button[data-tip="Light ground"], .colour-panel .pair button[title="Light ground"]').first.click(); p.wait_for_timeout(200)
    note(app.doc()['palette']['dark'] is False, 'tap light')
    p.keyboard.press('Control+z'); p.wait_for_timeout(150); note(app.doc()['palette']['dark'] is True, 'undo light')
    p.keyboard.press('Escape'); path = app.export('jpg'); im = Image.open(path).convert('RGB'); px = im.getpixel((1070, 640))
    note(sum(px) < 200, f'jpg ground not dark: {px}')
    app.close_panels(); valid(app)


PERSONAS = [maya_social, priya_print, layla_scripts, kai_keyboard, sam_sketch, cleo_colour, pat_power, ren_returning, sol_small, chaos,
            ines_photos, tom_worksheet, ivy_icons, max_sizes, quinn_quota, ula_interrupts, dee_dark]


def main():
    only = os.environ.get('ONLY')
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM') or next((str(x) for x in Path('/opt/pw-browsers').glob('chromium-*/chrome-linux/chrome')), None)
        browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
        for fn in PERSONAS:
            if only and only not in fn.__name__: continue
            persona[0] = fn.__name__; print(f'== {fn.__name__}: {fn.__doc__}')
            app = App(browser); k = len(ba.errors)
            try: fn(app)
            except Exception as e:  # noqa: BLE001
                note(False, f'persona crashed: {e}'); traceback.print_exc(limit=3)
                try: app.page.screenshot(path=str(OUT / f'persona-{fn.__name__}.png'))
                except Exception: pass
            note(not ba.errors[k:], f'console errors: {ba.errors[k:][:4]}')
            app.ctx.close()
        browser.close()
    print(f'\n{len(findings)} findings')
    for who, msg in findings: print(f'  [{who}] {msg}')
    if ba.offorigin: print('off-origin:', sorted(set(ba.offorigin))[:10])
    (OUT / 'personas.json').write_text(json.dumps(findings, indent=1))
    sys.exit(1 if findings or ba.offorigin else 0)


if __name__ == '__main__':
    main()
