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
    for _ in range(10):   # reading the file can take a while on a busy machine
        f3 = node(app, id=frame['id'])
        if f3['asset'] != f2['asset']: break
        p.wait_for_timeout(500)
    note(f3['asset'] != f2['asset'], 'dropping onto a filled image did not replace it')
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



# ------------------------------------------------------------------------------------------------ round 3
def rio_rotation(app):
    """Rio sets type and shapes at angles."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'poster', 'guide': 'golden', 'hue': 15, 'dark': False})
    head = find(app.doc(), slot='headline')[0]; app.select(head); r = app.frame(head); k = app.scale(); cx = r['x'] + r['w'] / 2
    app.drag_unit((cx, r['y'] - 44 / k), (cx + 400, r['y'] - 44 / k + 400), alt=True)
    h = node(app, id=head['id']); rot = h['frames']['main']['rot']; note(abs(rot) > 20, f'headline did not rotate: {rot}')
    p.keyboard.press('Enter'); p.wait_for_timeout(150)
    tf = p.locator('textarea.text-editor').evaluate('e => e.style.transform')
    note(f'{rot:.4f}'[:6] in tf.replace(' ', ''), f'editor not rotated with the text: {tf} vs {rot}')
    p.keyboard.press('Control+End'); p.keyboard.type(' at an angle'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    note(node(app, id=head['id'])['text'].endswith(' at an angle'), 'typing into rotated text')
    # rotated shape: a side handle resizes along the shape's own axis and keeps the rotation
    p.keyboard.press('Escape'); p.keyboard.press('r'); p.wait_for_timeout(150); sq = app.doc()['nodes'][-1]; r = app.frame(sq); cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    app.drag_unit((cx, r['y'] - 44 / k), (cx + 300, cy), steps=16, shift=True)
    f = node(app, id=sq['id'])['frames']['main']; note(abs(f['rot'] - 90) < 1e-6, f'Shift rotate to 90: {f["rot"]}')
    w0, h0 = f['rect']['w'], f['rect']['h']
    ex, ey = cx, cy + w0 / 2   # at 90° the local east handle sits below the centre on screen
    app.drag_unit((ex, ey), (ex, ey + 60), alt=True)
    f2 = node(app, id=sq['id'])['frames']['main']; note(abs(f2['rect']['w'] - w0 - 60) < 2 and abs(f2['rect']['h'] - h0) < .5 and abs(f2['rot'] - 90) < 1e-6, f'rotated side resize: {f["rect"]} -> {f2["rect"]} rot {f2["rot"]}')
    p.keyboard.press('Escape'); path = app.export('png'); im = Image.open(path).convert('RGB'); fr = f2['rect']; s = 1080 / 1000
    px = im.getpixel((int((fr['x'] + fr['w'] / 2) * s), int((fr['y'] + fr['h'] / 2) * s)))
    note(max(px) - min(px) > 40, f'rotated square missing in export: {px}')
    app.close_panels()
    path = app.export('svg'); t = path.read_text(); note('rotate(' in t, 'svg has no rotation')
    app.close_panels(); valid(app)


def vic_migrated(app):
    """Vic opens a Phase 0 document and keeps working."""
    p = app.page; app.reset()
    v1 = {'version': 1, 'id': 'zz99', 'ratio': 'landscape', 'guide': 'golden', 'createdAt': '2026-09-01T10:00:00.000Z', 'nodes': [
        {'id': 't1', 'type': 'text', 'rect': {'x': 100, 'y': 80, 'w': 500, 'h': 60}, 'text': 'Old title', 'fontSize': 48, 'weight': 700, 'align': 'right', 'color': '#123456'},
        {'id': 'r1', 'type': 'rect', 'rect': {'x': 650, 'y': 300, 'w': 200, 'h': 120}, 'fill': '#FF8800', 'shape': 'ellipse', 'locked': True}]}
    p.evaluate(f'localStorage.setItem("kura8:doc", {json.dumps(json.dumps(v1))}); localStorage.setItem("kura8:lifted", "true")'); p.goto(BASE); p.wait_for_timeout(1200)
    note(p.locator('canvas.overlay').is_visible(), 'v1 document did not open in the editor')
    p.keyboard.press('g'); p.keyboard.press('g'); p.evaluate('dispatchEvent(new Event("pagehide"))')  # a v1 doc without images is written back on the next save
    d = app.doc(); t = find(d, id='t1')[0]; note(t['align'] == 'end' and t['fill'] == {'hex': '#123456'}, f'text migration {t}')
    note(find(d, id='r1')[0]['shape'] == 'circle' and find(d, id='r1')[0].get('locked'), 'shape migration')
    app.select(t); p.keyboard.press('Enter'); p.wait_for_timeout(150); p.keyboard.press('Control+End'); p.keyboard.type('!'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    note(node(app, id='t1')['text'] == 'Old title!', 'editing migrated text')
    p.keyboard.press('Escape'); p.keyboard.press('c'); p.wait_for_timeout(200)
    note(p.locator('.colour-panel .hues button').count() >= 13, 'colour panel on a neutral migrated palette')
    p.keyboard.press('Escape')
    p.locator('button.wordmark').click(); p.wait_for_timeout(400); note(p.locator('.dial').is_visible(), 'dial from a migrated doc')
    p.locator('.dial .dial-actions button', has_text='Back to canvas').click(); p.wait_for_timeout(300)
    path = app.export('png'); note(png_size(path)[0] == (1920, 1080), 'migrated export size'); app.close_panels(); valid(app)


def ari_arrows(app):
    """Ari annotates with ink lines and arrows."""
    p = app.page
    app.start({'ratio': 'landscape', 'comp': 'frame', 'guide': 'divisions', 'hue': 200, 'dark': False})
    p.keyboard.press('p'); p.wait_for_timeout(100); n0 = len(app.doc()['nodes'])

    def stroke(pts, hold=True):
        p.mouse.move(*app.to_px(*pts[0])); p.mouse.down()
        for a, b in zip(pts, pts[1:]):
            for t in range(1, 13): p.mouse.move(*app.to_px(a[0] + (b[0] - a[0]) * t / 12, a[1] + (b[1] - a[1]) * t / 12))
        if hold: p.wait_for_timeout(700)
        p.mouse.up(); p.wait_for_timeout(500)
    stroke([(150, 450), (420, 452)])
    line = app.doc()['nodes'][-1]; note(line['kind'] == 'ink' and line.get('form') == 'line', f'held stroke not a line: {line.get("form")}')
    stroke([(395, 430), (422, 452), (395, 474)])
    d = app.doc(); arrow = node(app, id=line['id'])
    note(arrow and arrow.get('form') == 'arrow' and len(d['nodes']) == n0 + 1, f'arrowhead not merged: form {arrow and arrow.get("form")}, added {len(d["nodes"]) - n0}')
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    app.select(node(app, id=line['id'])); p.keyboard.press('c'); p.wait_for_timeout(200)
    p.locator('.colour-panel .roles button', has_text='Accent').click(); p.wait_for_timeout(100)
    note(node(app, id=line['id'])['fill'] == {'role': 'accent'}, 'recolouring ink'); p.keyboard.press('Escape')
    path = app.export('svg'); t = path.read_text(); note(t.count('<path') >= 1 and 'stroke' in t, 'ink not in svg'); app.close_panels()
    p.locator('button[aria-label="Add a linked size"]').click(); p.wait_for_timeout(200); p.locator('.ratio-panel g[aria-label="Add Post 1:1"]').click(); p.wait_for_timeout(300)
    d = app.doc(); valid(app, d); f = node(app, id=line['id'])['frames'][d['sizes'][1]['id']]['rect']
    note(f['x'] >= 0 and f['x'] + f['w'] <= 1000 and f['y'] >= 0 and f['y'] + f['h'] <= 1000, f'arrow off canvas in the square size: {f}')


def gus_grid(app):
    """Gus lays things out on a grid."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'split', 'guide': 'thirds', 'hue': 90, 'dark': False})
    p.locator('button[aria-label="Snap grid"]').click(); p.wait_for_timeout(150)
    p.locator('.grid-panel .presets button', has_text='20').click(); p.keyboard.press('Escape'); p.wait_for_timeout(100)
    p.keyboard.press('r'); p.wait_for_timeout(150); r = app.doc()['nodes'][-1]; f = app.frame(r)
    c = (f['x'] + f['w'] / 2, f['y'] + f['h'] / 2)
    app.drag_unit(c, (c[0] - 117, c[1] + 83))
    g = app.frame(node(app, id=r['id'])); lines = [1000 / 3, 2000 / 3, 500, 0, 1000]
    on = lambda v: abs(v / 20 - round(v / 20)) < 1e-6 or any(abs(v - l) < 1e-6 for l in lines)
    note(on(g['x']) or on(g['x'] + g['w']) or on(g['x'] + g['w'] / 2), f'x not on the grid: {g}')
    p.reload(); p.wait_for_timeout(700)
    p.locator('button[aria-label="Snap grid"]').click(); p.wait_for_timeout(150)
    note(p.locator('.grid-panel .switch').get_attribute('aria-checked') == 'true' and p.locator('.grid-panel .presets button[aria-pressed="true"]').inner_text() == '20', 'grid setting not kept over reload')
    app.select(node(app, id=r['id'])); p.locator('button[aria-label="Snap grid"]').click(); p.wait_for_timeout(150)
    p.locator('.grid-panel input[type=range]').focus(); p.keyboard.press('ArrowRight'); p.wait_for_timeout(100)
    note('25 units' in p.locator('.grid-panel').inner_text(), f'range arrow: {p.locator(".grid-panel").inner_text()}')
    note(app.frame(node(app, id=r['id'])) == g, 'arrow on the grid slider moved the selection')
    p.keyboard.press('Escape')


def hana_help(app):
    """Hana turns on the help bar to learn the tools."""
    p = app.page
    app.start({'ratio': 'portrait', 'comp': 'cover', 'guide': 'thirds', 'hue': 0, 'dark': False})
    note(p.locator('.help-box').get_attribute('hidden') is not None, 'help bar on by default')
    p.locator('.help button').click(); p.wait_for_timeout(150); note(p.locator('.help-box').get_attribute('hidden') is None, 'help bar did not open')
    p.locator('.toolbar button[aria-label="Duplicate"]').hover(); p.wait_for_timeout(200)
    note('Copies the selection' in p.locator('.help-box').inner_text(), f'help text for Duplicate: {p.locator(".help-box").inner_text()!r}')
    p.locator('button[aria-label="Layers"]').hover(); p.wait_for_timeout(200)
    note('Lists every object' in p.locator('.help-box').inner_text(), 'help text for Layers')
    p.mouse.move(700, 500); p.keyboard.press('p'); p.wait_for_timeout(250)
    note('Hold still' in p.locator('.help-box').inner_text(), f'sketch hint: {p.locator(".help-box").inner_text()!r}')
    p.keyboard.press('Escape'); p.wait_for_timeout(150)
    note('Hold still' not in p.locator('.help-box').inner_text(), 'sketch hint stayed after leaving the tool')
    p.locator('.help button').click(); p.wait_for_timeout(100); note(p.locator('.help-box').get_attribute('hidden') is not None, 'help bar did not close')


def zed_stress(app):
    """Zed fills the canvas with hundreds of objects."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 45, 'dark': False})
    p.keyboard.press('r'); p.wait_for_timeout(100)
    for _ in range(7): p.keyboard.press('Control+a'); p.keyboard.press('Control+d'); p.wait_for_timeout(50)
    d = app.doc(); n = len(d['nodes']); note(n > 250, f'only {n} nodes')
    size = len(json.dumps(d)); note(size < 1_500_000, f'saved doc is {size} bytes')
    p.keyboard.press('Escape'); acc = find(d, slot='accent')[0]; r = app.frame(acc)
    t0 = time.time(); app.drag_unit((r['x'] + 5, r['y'] + 5), (r['x'] + 205, r['y'] + 105), steps=30); dt = time.time() - t0
    note(dt < 6, f'30-step drag among {n} objects took {dt:.1f}s')
    t0 = time.time(); p.keyboard.press('Control+a'); p.keyboard.press('ArrowRight'); p.keyboard.press('Control+z'); p.wait_for_timeout(100); dt = time.time() - t0
    note(dt < 3, f'select all + nudge + undo took {dt:.1f}s')
    p.keyboard.press('Escape'); valid(app)


def lou_layers(app):
    """Lou manages the stack from the layers panel with the keyboard."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'stack', 'guide': 'golden', 'hue': 240, 'dark': False})
    p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200)
    rows = p.locator('.layer'); n = rows.count()
    rows.nth(1).focus(); p.keyboard.press('Enter'); p.wait_for_timeout(120)
    note('on' in (p.locator('.layer').nth(1).get_attribute('class') or ''), 'Enter on a layer row did not select it')
    p.locator('.layer').nth(1).locator('button[aria-label="Lock"]').click(); p.wait_for_timeout(100)
    d = app.doc(); note(len([x for x in d['nodes'] if x.get('locked')]) == 1, 'lock from layers')
    p.keyboard.press('Delete'); p.wait_for_timeout(100); note(len(app.doc()['nodes']) == len(d['nodes']), 'Delete removed a locked layer')
    p.locator('.layer').nth(n - 1).locator('button[aria-label="Bring forward"]').click(); p.wait_for_timeout(100)
    note(p.locator('.layer').count() == n, 'layer count changed')
    p.keyboard.press('Escape'); p.wait_for_timeout(100); note(p.locator('.layers-panel:not([hidden])').count() == 0, 'Escape did not close layers')


def nia_reratio(app):
    """Nia re-ratios a design and fixes what got flagged."""
    p = app.page
    app.start({'ratio': 'landscape', 'comp': 'band', 'guide': 'thirds', 'hue': 330, 'dark': False})
    p.keyboard.press('r'); p.wait_for_timeout(100); r = app.doc()['nodes'][-1]
    app.drag_unit(app.node_centre(r), (900, 480), alt=True)
    p.keyboard.press('Escape')
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(200)
    p.locator('.ratio-panel g[aria-label="Change to Banner 3:1"]').click(); p.wait_for_timeout(300); p.keyboard.press('Escape')
    t = p.locator('.toast').inner_text(); note('flagged' in t, f'no flag count after re-ratio: {t!r}')
    f = app.frame(node(app, id=r['id'])); note(f['y'] + f['h'] > 1000 / 3 + .5 or f['x'] + f['w'] > 1000.5, f'rect should be off canvas: {f}')
    dpr = p.evaluate('devicePixelRatio')

    def outline_px(fr):
        k = app.scale()
        return p.evaluate('''([x, y]) => { const g = document.querySelector('canvas.overlay').getContext('2d'), d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2], d[3]]; }''',
                          [int((fr['x'] * k + 64) * dpr), int(((fr['y'] + fr['h'] / 2) * k + 64) * dpr)])
    p.wait_for_timeout(150); before = outline_px(f)
    note(before[3] > 0, f'no flag outline drawn on the flagged rect: {before}')
    app.drag_unit((f['x'] + 10, f['y'] + 10), (100, 60), alt=True); p.wait_for_timeout(150)
    f2 = app.frame(node(app, id=r['id'])); note(f2['y'] + f2['h'] <= 1000 / 3 + 1, f'moved rect still off: {f2}')
    p.keyboard.press('Escape'); p.wait_for_timeout(200)
    after = outline_px(f2)
    note(after[3] == 0, f'flag outline still drawn after the object was moved back onto the canvas: {after}')


# ------------------------------------------------------------------------------------------------ round 4
def tess_two_tabs(app):
    """Tess has Kura8 open in two tabs."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 120, 'dark': False})
    b = app.ctx.new_page(); b.goto(BASE); b.wait_for_timeout(800)
    p.bring_to_front(); p.keyboard.press('r'); p.wait_for_timeout(900)
    a_rect = app.doc()['nodes'][-1]['id']
    b.bring_to_front(); b.wait_for_timeout(300); b.keyboard.press('o'); b.wait_for_timeout(900)
    d = app.doc(); ids = [n['id'] for n in d['nodes']]
    note(a_rect in ids, 'an edit in one tab silently erased the rectangle added in the other tab')
    note(any(n.get('shape') == 'circle' for n in d['nodes']), 'second tab edit missing')
    b.close()


def cdp_touch(app, pts, hold_ms=0):
    s = app.ctx.new_cdp_session(app.page)
    px = [app.to_px(*q) for q in pts]
    s.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': px[0][0], 'y': px[0][1]}]})
    for x, y in px[1:]: s.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y}]}); app.page.wait_for_timeout(16)
    if hold_ms: app.page.wait_for_timeout(hold_ms)
    s.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); app.page.wait_for_timeout(250)
    s.detach()


def theo_touch(app):
    """Theo uses a touchscreen laptop."""
    p = app.page
    ctx = app.ctx.browser.new_context(viewport={'width': 1280, 'height': 800}, has_touch=True, accept_downloads=True)
    old = app.ctx; app.ctx = ctx; app.page = ctx.new_page(); p = app.page
    p.on('pageerror', lambda e: ba.errors.append(f'pageerror: {e}'))
    try:
        app.start({'ratio': 'square', 'comp': 'split', 'guide': 'thirds', 'hue': 60, 'dark': False})
        acc = find(app.doc(), slot='accent')[0]; r = app.frame(acc); c = (r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
        p.touchscreen.tap(*app.to_px(*c)); p.wait_for_timeout(150)
        note(p.locator('.info').inner_text().startswith('Rectangle'), f'tap did not select: {p.locator(".info").inner_text()!r}')
        cdp_touch(app, [(c[0] + i * 12, c[1] + i * 7) for i in range(12)])
        r2 = app.frame(node(app, id=acc['id'])); note(abs(r2['x'] - r['x']) > 50, f'touch drag did not move: {r} -> {r2}')
        head = find(app.doc(), slot='headline')[0]; hc = app.node_centre(head)
        p.touchscreen.tap(*app.to_px(*hc)); p.wait_for_timeout(60); p.touchscreen.tap(*app.to_px(*hc)); p.wait_for_timeout(300)
        note(p.locator('textarea.text-editor').count() == 1, 'double tap on text did not open the editor')
        p.keyboard.press('Escape'); p.keyboard.press('Escape'); p.keyboard.press('p'); p.wait_for_timeout(100); n0 = len(app.doc()['nodes'])
        cdp_touch(app, [(100 + i * 10, 800 + 20 * math.sin(i / 2)) for i in range(30)])
        note(len(app.doc()['nodes']) == n0 + 1, 'touch pen stroke not added')
        p.keyboard.press('Escape')
    finally:
        ctx.close(); app.ctx = old; app.page = old.pages[0]


def eve_parity(app):
    """Eve checks the SVG matches the PNG for a busy design."""
    p = app.page
    app.start({'ratio': 'portrait', 'comp': 'frame', 'guide': 'golden', 'hue': 200, 'dark': False})
    frame = find(app.doc(), slot='image')[0]; drop_file(app, image_file(OUT / 'eve.png', 1200, 900, (210, 90, 30)), *app.node_centre(frame))
    p.keyboard.press('Escape'); p.keyboard.press('t'); p.wait_for_timeout(150); p.keyboard.type('שלום עולם'); p.keyboard.press('Control+Enter'); p.keyboard.press('Escape')
    p.keyboard.press('t'); p.wait_for_timeout(150); p.keyboard.type('Centred line\nsecond line'); p.keyboard.press('Control+Enter')
    p.locator('.toolbar button[aria-label="Align"]').click(); p.keyboard.press('Escape')
    p.keyboard.press('o'); p.wait_for_timeout(100); ell = app.doc()['nodes'][-1]; r = app.frame(ell); k = app.scale(); cx = r['x'] + r['w'] / 2
    app.drag_unit((cx, r['y'] - 44 / k), (cx + 200, r['y'] + 60), alt=True); p.keyboard.press('Escape')
    head = find(app.doc(), slot='headline')[0]; app.select(head); r = app.frame(head); cx = r['x'] + r['w'] / 2
    app.drag_unit((cx, r['y'] - 44 / k), (cx + 40, r['y'] - 44 / k + 3), alt=True); p.keyboard.press('Escape')
    png = app.export('png'); app.close_panels(); svgp = app.export('svg'); app.close_panels()
    svg_text = svgp.read_text()
    data = p.evaluate('''async (svg) => {
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode(); await new Promise(r => setTimeout(r, 300));
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 1080, 1350);
      return c.toDataURL('image/png');
    }''', svg_text)
    import base64
    a = Image.open(png).convert('RGB'); b = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB')
    from PIL import ImageChops
    diff = ImageChops.difference(a, b).convert('L'); diff.save(OUT / 'eve-diff.png')
    W, H = a.size; cells = []
    for gy in range(0, H, 90):
        for gx in range(0, W, 90):
            region = diff.crop((gx, gy, gx + 90, gy + 90)); hist = region.histogram(); n = sum(hist)
            mean = sum(i * v for i, v in enumerate(hist)) / n
            if mean > 12: cells.append((gx, gy, round(mean, 1)))
    note(not cells, f'SVG and PNG differ in {len(cells)} regions, worst {sorted(cells, key=lambda c: -c[2])[:5]}')


def mo_reduced_motion(app):
    """Mo has reduced motion turned on."""
    p = app.page; p.emulate_media(reduced_motion='reduce')
    app.reset(); p.goto(BASE); p.wait_for_timeout(300)
    p.keyboard.press('Enter'); p.wait_for_timeout(150)
    note(p.evaluate('localStorage.getItem("kura8:lifted")') == 'true', 'lift flag not set under reduced motion')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    p.locator('button.wordmark').click(); p.wait_for_timeout(200)
    p.keyboard.press('ArrowDown'); p.keyboard.press('ArrowRight'); p.locator('.dial .dial-actions button', has_text='Go').click(); p.wait_for_timeout(120)
    d = json.loads(p.evaluate('localStorage.getItem("kura8:doc")') or 'null'); p.wait_for_timeout(700); d2 = app.doc()
    note(d2['sizes'][0]['comp'] == 'split', 'Go did not apply')
    p.keyboard.press('p'); p.wait_for_timeout(100)
    rect = [(600, 100), (850, 100), (850, 300), (600, 300), (600, 102)]
    p.mouse.move(*app.to_px(*rect[0])); p.mouse.down()
    for a, b in zip(rect, rect[1:]):
        for t in range(1, 11): p.mouse.move(*app.to_px(a[0] + (b[0] - a[0]) * t / 10, a[1] + (b[1] - a[1]) * t / 10))
    p.wait_for_timeout(700); p.mouse.up(); p.wait_for_timeout(400)
    note(app.doc()['nodes'][-1].get('form') == 'rect', 'hold-to-clean under reduced motion')
    p.emulate_media(reduced_motion='no-preference')


def bea_cutout(app):
    """Bea removes the background from one copy of a photo."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 0, 'dark': False})
    img = OUT / 'bea.png'
    im = Image.new('RGB', (480, 480), (235, 235, 230))
    for x in range(160, 320):
        for y in range(120, 400): im.putpixel((x, y), (40, 60, 160))
    im.save(img)
    frame = find(app.doc(), slot='image')[0]; drop_file(app, img, *app.node_centre(frame))
    app.select(node(app, id=frame['id'])); p.keyboard.press('Control+d'); p.wait_for_timeout(200)
    copy = app.doc()['nodes'][-1]; note(copy['kind'] == 'image' and copy['asset'] == node(app, id=frame['id'])['asset'], 'duplicate image')
    p.locator('.toolbar button[aria-label="Remove background"]').click()
    for _ in range(240):
        p.wait_for_timeout(1000)
        if node(app, id=copy['id']).get('cutout'): break
    note(node(app, id=copy['id']).get('cutout') is True, 'background removal did not finish on the copy')
    note(not node(app, id=frame['id']).get('cutout'), 'removing the background of one copy also cut out the other copy')
    p.keyboard.press('Control+z'); p.wait_for_timeout(200)
    note(not node(app, id=copy['id']).get('cutout'), 'undo of background removal')


# ------------------------------------------------------------------------------------------------ round 5
def kim_dial(app):
    """Kim plays with the dial before starting."""
    p = app.page
    app.fresh({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 210, 'dark': False})
    for _ in range(7): p.keyboard.press('ArrowRight')
    note('Portrait 4:5' in p.locator('.card').nth(0).inner_text(), f'ratio ring wraps: {p.locator(".card").nth(0).inner_text()}')
    g = p.locator('[data-ring="guide"][data-index="0"] > g').bounding_box()
    p.mouse.move(g['x'] + g['width'] / 2, g['y'] + g['height'] / 2)
    for _ in range(5): p.mouse.wheel(0, 120); p.wait_for_timeout(160)
    note(any(n in p.locator('.card').nth(2).inner_text() for n in ['Thirds', 'Golden', 'Quarters']), 'scrolling the guide ring')
    sv = p.locator('.any-colour .sv').bounding_box(); p.mouse.click(sv['x'] + sv['width'] * .8, sv['y'] + sv['height'] * .2); p.wait_for_timeout(150)
    note('Custom #' in p.locator('.card').nth(3).inner_text(), f'any colour did not set a custom accent: {p.locator(".card").nth(3).inner_text()}')
    p.keyboard.press('Enter'); p.wait_for_timeout(600)
    d = app.doc(); note(d and d['palette'].get('accent'), f'custom accent not in the document: {d and d["palette"]}')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    p.locator('button.wordmark').click(); p.wait_for_timeout(300)
    note('Custom #' in p.locator('.card').nth(3).inner_text(), 'dial lost the custom accent on return')
    for _ in range(3): p.keyboard.press('ArrowDown')
    p.keyboard.press('ArrowRight'); p.wait_for_timeout(150)
    note('Custom' not in p.locator('.card').nth(3).inner_text(), 'turning the colour ring kept the custom accent')
    p.locator('.dial .dial-actions button', has_text='Go').click(); p.wait_for_timeout(500)
    note(not app.doc()['palette'].get('accent'), f'Go kept the old accent after the ring turned: {app.doc()["palette"]}')
    valid(app)


def fay_extremes(app):
    """Fay pushes type to its limits."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'stack', 'guide': 'divisions', 'hue': 100, 'dark': False})
    p.keyboard.press('t'); p.wait_for_timeout(150); p.keyboard.type('A'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    t = app.doc()['nodes'][-1]
    for _ in range(60): toolbar(app, 'Larger').click()
    t2 = node(app, id=t['id']); f = t2['frames']['main']; note(math.isfinite(f['fontSize']) and f['fontSize'] > 300, f'Larger x60: {f}')
    for _ in range(80): toolbar(app, 'Smaller').click()
    f = node(app, id=t['id'])['frames']['main']; note(f['fontSize'] >= 6, f'min size {f}')
    r = app.frame(node(app, id=t['id'])); app.drag_unit((r['x'] + r['w'], r['y'] + r['h'] / 2), (r['x'] + 2, r['y'] + r['h'] / 2), alt=True)
    r2 = app.frame(node(app, id=t['id'])); note(r2['w'] >= 19.9, f'text squeezed below 20 wide: {r2}')
    p.keyboard.press('Escape'); p.keyboard.press('t'); p.wait_for_timeout(150); p.keyboard.type('   '); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    note(not [n for n in app.doc()['nodes'] if n['kind'] == 'text' and not n['text'].strip()], 'whitespace-only text kept')
    p.keyboard.press('Escape'); p.keyboard.press('t'); p.wait_for_timeout(150); p.keyboard.type('trailing'); p.keyboard.press('Enter'); p.keyboard.press('Enter'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    tr = app.doc()['nodes'][-1]; f = tr['frames']['main']; note(f['rect']['h'] > f['fontSize'] * 1.15 * 2.5, f'trailing blank lines not measured: {f}')
    path = app.export('svg'); t = path.read_text()
    import xml.dom.minidom
    try: xml.dom.minidom.parseString(t)
    except Exception as e: note(False, f'svg with blank lines does not parse: {e}')
    app.close_panels(); valid(app)


def lin_locks(app):
    """Lin locks the layout and keeps editing around it."""
    p = app.page
    app.start({'ratio': 'portrait', 'comp': 'split', 'guide': 'thirds', 'hue': 20, 'dark': False})
    head = find(app.doc(), slot='headline')[0]; app.select(head); p.keyboard.press('Control+Shift+L'); p.wait_for_timeout(100)
    before = node(app, id=head['id'])
    p.keyboard.press('Control+a'); p.wait_for_timeout(100)
    acc = find(app.doc(), slot='accent')[0]; r = app.frame(acc)
    app.drag_unit((r['x'] + r['w'] / 2, r['y'] + r['h'] / 2), (r['x'] + r['w'] / 2 + 60, r['y'] + r['h'] / 2 + 40), alt=True)
    note(app.frame(node(app, id=head['id'])) == app.frame(before), 'locked headline moved with a multi-select drag')
    note(app.frame(node(app, id=acc['id']))['x'] != r['x'], 'unlocked accent did not move with the selection')
    p.keyboard.press('Control+a'); p.keyboard.press('ArrowDown'); note(app.frame(node(app, id=head['id'])) == app.frame(before), 'locked headline nudged')
    p.keyboard.press('c'); p.wait_for_timeout(150); p.locator('.colour-panel .roles button', has_text='Accent').click(); p.wait_for_timeout(100)
    note(node(app, id=head['id'])['fill'] == before['fill'], 'locked headline recoloured'); p.keyboard.press('Escape')
    p.keyboard.press('Control+a'); n = len(app.doc()['nodes']); p.keyboard.press('Control+d'); p.wait_for_timeout(100)
    d = app.doc(); note(len(d['nodes']) == n + n - 1, f'duplicate of a selection with one locked: {len(d["nodes"]) - n} copies')
    note(not [x for x in d['nodes'] if x['id'] != head['id'] and x.get('locked')], 'a duplicate came out locked')
    p.keyboard.press('Control+a'); p.keyboard.press('Delete'); p.wait_for_timeout(100)
    d = app.doc(); note([x['id'] for x in d['nodes']] == [head['id']], f'delete all left {[x.get("slot") for x in d["nodes"]]}')
    p.keyboard.press('Control+a'); p.keyboard.press('Control+b'); note(node(app, id=head['id'])['weight'] == before['weight'], 'locked text bolded')
    p.keyboard.press('Control+z'); p.wait_for_timeout(100); note(len(app.doc()['nodes']) > 1, 'undo delete')
    valid(app)


def pia_exports(app):
    """Pia exports every way the sheet allows."""
    p = app.page
    app.start({'ratio': 'story', 'comp': 'cover', 'guide': 'golden', 'hue': 280, 'dark': False})
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    three = p.locator('.sheet .seg[aria-label="Size"] button', has_text='3×')
    note(three.is_disabled(), 'story 3× (3240 × 5760) should be over the pixel limit')
    three.hover(); p.wait_for_timeout(200); note('Larger than' in p.locator('.tip').inner_text(), f'no reason on the disabled size: {p.locator(".tip").inner_text()!r}')
    note('1 empty image frame not included' in p.locator('.sheet .notes').inner_text(), f'notes: {p.locator(".sheet .notes").inner_text()!r}')
    path = app.export('png', scale='2×'); note(png_size(path)[0] == (2160, 3840), f'story 2× {png_size(path)}')
    note(path.name == 'kura8-story@2x.png', f'file name {path.name}')
    path = app.export('png', no_ground=True); im = Image.open(path); note(im.mode == 'RGBA' and im.getpixel((5, 5))[3] == 0, 'No ground not transparent')
    path = app.export('jpg'); im = Image.open(path); note(im.mode == 'RGB' and im.getpixel((5, 5))[0] > 150, f'JPG after No ground was toggled should keep the ground: {im.getpixel((5, 5))}')
    path = app.export('pdf'); data = path.read_bytes(); note(data.startswith(b'%PDF') and b'/MediaBox' in data, 'pdf')
    app.close_panels()
    # filled ground: No ground hidden, PNG opaque even if it was switched on before
    p.keyboard.press('c'); p.wait_for_timeout(150); p.locator('.colour-panel .shades button').nth(1).click(); app.click_unit(990, 1700); p.keyboard.press('Escape'); p.keyboard.press('Escape')
    note(app.doc()['ground'] is not None, 'ground not filled')
    path = app.export('png'); im = Image.open(path).convert('RGBA'); note(im.getpixel((5, 5))[3] == 255, 'filled ground exported transparent')
    note(not p.locator('.sheet button[aria-label="No ground"]').is_visible(), 'No ground offered with a filled ground')
    app.close_panels()
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(150)
    p.locator('.ratio-panel g[aria-label="Change to Print A4"]').click(); p.wait_for_timeout(300); p.keyboard.press('Escape')
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    note(p.locator('.sheet .seg[aria-label="Size"] button[aria-pressed="true"]').inner_text() == '300 dpi', 'A4 does not default to 300 dpi after a ratio change with the sheet closed')
    app.close_panels()


def ola_undo_ui(app):
    """Ola undoes across sizes, palettes and ratios."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 50, 'dark': False})
    p.locator('button[aria-label="Add a linked size"]').click(); p.wait_for_timeout(200); p.locator('.ratio-panel g[aria-label="Add Story 9:16"]').click(); p.wait_for_timeout(300)
    note(p.locator('.corner .sizes button[aria-pressed="true"]').inner_text().strip().endswith('9:16'), 'new size not active')
    p.keyboard.press('Control+z'); p.wait_for_timeout(200)
    note(len(app.doc()['sizes']) == 1 and p.locator('.corner .sizes button').count() == 1, 'undo add size')
    note(app.box()['width'] / app.box()['height'] > .95, 'canvas still story-shaped after undoing the size')
    p.keyboard.press('Control+Shift+z'); p.wait_for_timeout(200); note(len(app.doc()['sizes']) == 2, 'redo add size')
    # custom hue then undo while its row is shown
    app.select(find(app.doc(), slot='accent')[0]); p.keyboard.press('c'); p.wait_for_timeout(150)
    f = p.locator('.colour-panel input.field'); f.click(); f.fill('#12ab34'); p.keyboard.press('Enter'); p.wait_for_timeout(100)
    p.locator('.colour-panel button', has_text='Add as hue').click(); p.wait_for_timeout(150)
    k = len(ba.errors)
    p.keyboard.press('Escape'); p.keyboard.press('Control+z'); p.keyboard.press('Control+z'); p.wait_for_timeout(150)
    app.select(find(app.doc(), slot='accent')[0]); p.keyboard.press('c'); p.wait_for_timeout(200)
    note(p.locator('.colour-panel .shades button').count() == 7, 'shade row missing after undoing a custom hue')
    note(not ba.errors[k:], f'errors {ba.errors[k:]}')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    # change ratio, undo: flags cleared, canvas back
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(150)
    p.locator('.ratio-panel g[aria-label="Change to Banner 3:1"]').click(); p.wait_for_timeout(300); p.keyboard.press('Escape')
    p.keyboard.press('Control+z'); p.wait_for_timeout(200); note(app.doc()['sizes'][0]['ratio'] == 'square', 'undo ratio'); valid(app)


def uma_crop(app):
    """Uma checks how photos crop into frames."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'split', 'guide': 'thirds', 'hue': 0, 'dark': False})
    img = OUT / 'uma.png'; im = Image.new('RGB', (1600, 400), (20, 20, 200))
    for x in range(700, 900):
        for y in range(150, 250): im.putpixel((x, y), (230, 30, 30))
    im.save(img)
    frame = find(app.doc(), slot='image')[0]; drop_file(app, img, *app.node_centre(frame))
    r = app.frame(node(app, id=frame['id']))
    p.keyboard.press('Escape'); path = app.export('png'); ex = Image.open(path).convert('RGB'); s = 1080 / 1000
    c = ex.getpixel((int((r['x'] + r['w'] / 2) * s), int((r['y'] + r['h'] / 2) * s)))
    note(c[0] > 180 and c[2] < 80, f'cover crop not centred on the photo centre: {c}')
    edge = ex.getpixel((int((r['x'] + 3) * s), int((r['y'] + 3) * s)))
    note(edge[2] > 150 and edge[0] < 80, f'frame corner not filled by the photo (contain instead of cover?): {edge}')
    app.close_panels(); app.select(node(app, id=frame['id'])); x0 = app.frame(node(app, id=frame['id']))
    app.drag_unit((x0['x'] + x0['w'] - 1, x0['y'] + x0['h'] - 1), (x0['x'] + x0['w'] - 120, x0['y'] + x0['h'] - 40), alt=True)
    x1 = app.frame(node(app, id=frame['id'])); note(abs(x1['w'] / x1['h'] - x0['w'] / x0['h']) < .01, 'image corner resize changed the frame aspect')
    valid(app)


def xia_dial_keys(app):
    """Xia uses the dial and its buttons from the keyboard."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 300, 'dark': False})
    p.locator('button.wordmark').focus(); p.keyboard.press('Enter'); p.wait_for_timeout(400)
    note(p.locator('.dial').is_visible(), 'Enter on the wordmark did not open the dial')
    note(not p.locator('canvas.overlay').is_visible(), 'editor still visible behind the dial')
    p.locator('.dial .dial-actions button', has_text='Back to canvas').focus(); p.keyboard.press('Enter'); p.wait_for_timeout(300)
    note(p.locator('canvas.overlay').is_visible(), 'Enter on Back to canvas')
    p.keyboard.press('r'); p.wait_for_timeout(100); note(app.doc()['nodes'][-1].get('shape') == 'rect', 'shortcuts dead after returning from the dial by keyboard')
    p.locator('button.wordmark').click(); p.wait_for_timeout(300)
    p.locator('.dial .dial-actions button', has_text='New').focus(); p.keyboard.press('Enter'); p.wait_for_timeout(500)
    note(p.locator('textarea.text-editor').count() == 1, 'New from the keyboard did not open the headline for typing')
    p.keyboard.type('Fresh'); p.keyboard.press('Control+Enter'); note(node(app, text='Fresh'), 'typing after New')


# ------------------------------------------------------------------------------------------------ round 6
def ken_retina(app):
    """Ken works on a 2× display in a large window."""
    old = app.ctx
    ctx = old.browser.new_context(viewport={'width': 1800, 'height': 1100}, device_scale_factor=2, accept_downloads=True)
    app.ctx = ctx; app.page = ctx.new_page(); p = app.page
    p.on('pageerror', lambda e: ba.errors.append(f'pageerror: {e}'))
    try:
        app.start({'ratio': 'landscape', 'comp': 'split', 'guide': 'golden', 'hue': 160, 'dark': False})
        cw = p.evaluate('document.querySelector("canvas.doc").width'); bw = app.box()['width']
        note(abs(cw - bw * 2) < 2, f'document canvas not at device pixels: {cw} for {bw} css px')
        acc = find(app.doc(), slot='accent')[0]; app.select(acc); r = app.frame(acc)
        app.drag_unit((r['x'] + r['w'], r['y'] + r['h']), (r['x'] + r['w'] + 50, r['y'] + r['h'] + 30), alt=True)
        r2 = app.frame(node(app, id=acc['id'])); note(abs(r2['w'] - r['w'] - 50) < 2 and abs(r2['h'] - r['h'] - 30) < 2, f'corner resize at 2×: {r} -> {r2}')
        k = app.scale(); cx = r2['x'] + r2['w'] / 2
        app.drag_unit((cx, r2['y'] - 44 / k), (cx + 200, r2['y'] + r2['h'] / 2), steps=14, shift=True)
        note(abs(node(app, id=acc['id'])['frames']['main']['rot'] - 90) < 1e-6, 'rotate knob at 2×')
        path = app.export('png'); note(png_size(path)[0] == (1920, 1080), 'export size independent of the display')
        app.close_panels()
    finally:
        ctx.close(); app.ctx = old; app.page = old.pages[0]


def rae_linked_text(app):
    """Rae writes long copy that must work in a square and a banner."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'stack', 'guide': 'thirds', 'hue': 10, 'dark': False})
    p.locator('button[aria-label="Add a linked size"]').click(); p.wait_for_timeout(200); p.locator('.ratio-panel g[aria-label="Add Banner 3:1"]').click(); p.wait_for_timeout(300)
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(200)
    body = find(app.doc(), slot='body')[0]; app.select(body); p.keyboard.press('Enter'); p.wait_for_timeout(100)
    text = ' '.join(['Long copy that keeps going'] * 30)
    p.keyboard.type(text); p.keyboard.press('Control+Enter'); p.wait_for_timeout(150)
    d = app.doc(); banner = d['sizes'][1]['id']; b = find(d, slot='body')[0]; fr = b['frames'][banner]['rect']; fs = b['frames'][banner]['fontSize']
    lines = p.evaluate('''([t, s, w]) => { const g = document.createElement('canvas').getContext('2d'); g.font = `400 ${s}px "Space Grotesk"`; let n = 1, line = ''; for (const word of t.split(' ')) { const next = line ? line + ' ' + word : word; if (line && g.measureText(next).width > w) { n++; line = word; } else line = next; } return n; }''', [text, fs, fr['w']])
    note(abs(fr['h'] - lines * fs * 1.15) < fs * 1.2, f'banner frame height not re-measured after a square-size edit: {fr} for {lines} lines at {fs}')
    note(fr['y'] + fr['h'] > 1000 / 3, f'test text should overflow the banner: {fr}')
    p.locator('.corner .sizes button').nth(1).click(); p.wait_for_timeout(250)
    dpr = p.evaluate('devicePixelRatio'); k = app.scale()
    col = p.evaluate('''([x, y0, y1]) => { const g = document.querySelector('canvas.overlay').getContext('2d'); let hit = 0; for (let y = y0; y < y1; y++) if (g.getImageData(x, y, 1, 1).data[3] > 0) hit++; return hit; }''', [int((fr['x'] * k + 64) * dpr), int((fr['y'] * k + 64) * dpr) + 4, int((min(fr['y'] + fr['h'], 1000 / 3) * k + 64) * dpr) - 4])
    note(col > 3, 'body text running off the banner is not flagged when switching to it')


def sid_async(app):
    """Sid clicks again before things finish."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 0, 'dark': False})
    frame = find(app.doc(), slot='image')[0]; drop_file(app, image_file(OUT / 'sid.png', 640, 480, (40, 90, 200)), *app.node_centre(frame))
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    downloads = []
    p.on('download', lambda d: downloads.append(d))
    p.locator('.sheet .download').dblclick(); p.wait_for_timeout(2500)
    note(len(downloads) == 1, f'double-click on Download saved {len(downloads)} files')
    app.close_panels()
    app.select(node(app, id=frame['id']))
    p.locator('.toolbar button[aria-label="Remove background"]').click(); p.wait_for_timeout(300)
    p.keyboard.press('Delete'); p.wait_for_timeout(200)
    k = len(ba.errors)
    p.evaluate('''() => { window.__toasts = []; new MutationObserver(() => window.__toasts.push(document.querySelector('.toast').textContent)).observe(document.querySelector('.toast'), { childList: true, characterData: true, subtree: true }); }''')
    p.wait_for_timeout(45000)   # WASM inference holds the main thread; give it time to finish
    p.wait_for_timeout(1500)
    note(not node(app, id=frame['id']), 'deleted image came back after its removal finished')
    note('Background removed' not in p.evaluate('window.__toasts'), 'toast claims a removal on a deleted image')
    p.keyboard.press('Control+z'); p.wait_for_timeout(200)
    note(node(app, id=frame['id']) is not None, 'one undo did not bring back the deleted image (an empty step was recorded?)')
    note(not ba.errors[k:], f'errors {ba.errors[k:]}')


# ------------------------------------------------------------------------------------------------ round 7
def noor_hidden(app):
    """Noor hides a block in one size and keeps editing elsewhere."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 75, 'dark': False})
    p.locator('button[aria-label="Add a linked size"]').click(); p.wait_for_timeout(200); p.locator('.ratio-panel g[aria-label="Add Slide 16:9"]').click(); p.wait_for_timeout(300)
    body = find(app.doc(), slot='body')[0]; slide = app.doc()['sizes'][1]['id']
    p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200)
    p.locator('.layer', has_text='Body text').locator('button[aria-label="Hide"]').click(); p.keyboard.press('Escape')
    fr = body['frames'][slide]['rect']; app.click_unit(fr['x'] + 5, fr['y'] + 5); p.wait_for_timeout(120)
    note(not p.locator('.info').inner_text().startswith('Body'), 'a hidden block could be selected on the canvas')
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    note('1 hidden object not included' in p.locator('.sheet .notes').inner_text(), f'hidden note: {p.locator(".sheet .notes").inner_text()!r}')
    app.close_panels()
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(200)
    app.select(find(app.doc(), slot='body')[0]); p.keyboard.press('Enter'); p.wait_for_timeout(100); p.keyboard.type('Visible here only'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(100)
    d = app.doc(); b = find(d, slot='body')[0]; note(b['text'] == 'Visible here only' and b['frames'][slide].get('hidden'), 'edit in the square changed hidden state in the slide')
    p.locator('.corner .sizes button').nth(1).click(); p.wait_for_timeout(200)
    p.keyboard.press('Control+a'); p.wait_for_timeout(100); n = len(d['nodes'])
    note(p.locator('.info').inner_text().startswith(f'{n - 1} selected'), f'select all in the slide: {p.locator(".info").inner_text()!r}')
    p.keyboard.press('Delete'); p.wait_for_timeout(100)
    d = app.doc(); note([x.get('slot') for x in d['nodes']] == ['body'], f'delete all in the slide removed the hidden block too: {[x.get("slot") for x in d["nodes"]]}')
    p.keyboard.press('Control+z'); valid(app)


def zara_paste_sizes(app):
    """Zara copies in one size and pastes in another."""
    p = app.page
    app.start({'ratio': 'portrait', 'comp': 'stack', 'guide': 'golden', 'hue': 330, 'dark': False})
    p.locator('button[aria-label="Add a linked size"]').click(); p.wait_for_timeout(200); p.locator('.ratio-panel g[aria-label="Add Banner 3:1"]').click(); p.wait_for_timeout(300)
    banner = app.doc()['sizes'][1]['id']
    acc = find(app.doc(), slot='accent')[0]; fr = acc['frames'][banner]['rect']
    app.click_unit(fr['x'] + fr['w'] / 2, fr['y'] + fr['h'] / 2); p.keyboard.press('Control+c')
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(200); p.keyboard.press('Control+v'); p.wait_for_timeout(150)
    d = app.doc(); copy = d['nodes'][-1]
    note(copy.get('shape') == acc['shape'] and 'slot' not in copy, 'paste in another size')
    for s in d['sizes']:
        r = copy['frames'][s['id']]['rect']; H = 1250 if s['ratio'] == 'portrait' else 1000 / 3
        note(r['x'] >= -1 and r['x'] + r['w'] <= 1001 and r['y'] >= -1 and r['y'] + r['h'] <= H + 1, f'pasted copy off canvas in {s["ratio"]}: {r}')
    valid(app)


def cara_dial_back(app):
    """Cara turns the dial, changes her mind and goes back."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 30, 'dark': False})
    before = app.doc()
    p.locator('button.wordmark').click(); p.wait_for_timeout(300)
    for _ in range(2): p.keyboard.press('ArrowRight')
    p.keyboard.press('ArrowDown'); p.keyboard.press('ArrowRight')
    p.locator('.dial .dial-actions button', has_text='Back to canvas').click(); p.wait_for_timeout(300)
    note(app.doc() == before, 'Back to canvas changed the document')
    note(app.box()['width'] / app.box()['height'] > .95 and app.box()['width'] / app.box()['height'] < 1.05, 'canvas shape changed after Back to canvas')
    p.locator('button.wordmark').click(); p.wait_for_timeout(300)
    note('Post 1:1' in p.locator('.card').nth(0).inner_text() and 'Cover' in p.locator('.card').nth(1).inner_text(), f'dial does not reopen on the canvas settings: {p.locator(".card").nth(0).inner_text()} / {p.locator(".card").nth(1).inner_text()}')
    p.keyboard.press('Enter'); p.wait_for_timeout(500)
    note(app.doc() == before, 'Go with unchanged settings changed the document')
    p.keyboard.press('Control+z'); p.wait_for_timeout(150); note(app.doc() == before or len(app.doc()['nodes']) == len(before['nodes']), 'undo after a no-op Go')


# ------------------------------------------------------------------------------------------------ round 8
def mae_mouse_export(app):
    """Mae uses the mouse for the toolbar and the keyboard for the rest."""
    p = app.page
    app.start({'ratio': 'landscape', 'comp': 'poster', 'guide': 'thirds', 'hue': 190, 'dark': False})
    p.locator('.toolbar button[aria-label="Export"]').click(); p.wait_for_timeout(300)
    with p.expect_download(timeout=30000) as dl: p.keyboard.press('Enter')
    note(dl.value.suggested_filename == 'kura8-landscape.png', f'Enter after clicking Export: {dl.value.suggested_filename}')
    p.keyboard.press('Escape'); p.wait_for_timeout(150); note(p.locator('.sheet:not([hidden])').count() == 0, 'Escape after a mouse-opened export')
    p.keyboard.press('r'); p.wait_for_timeout(100); note(app.doc()['nodes'][-1].get('shape') == 'rect', 'shortcut after closing the export sheet')
    p.locator('.toolbar button[aria-label="Shapes"]').click(); p.wait_for_timeout(200)
    p.locator('.shapes-panel button[aria-label="Circle"]').first.click(); p.wait_for_timeout(150)
    note(app.doc()['nodes'][-1].get('shape') == 'circle', 'circle from the shapes panel')
    p.keyboard.press('Delete'); p.wait_for_timeout(100); note(app.doc()['nodes'][-1].get('shape') != 'circle', 'Delete after adding from the shapes panel')


def dan_picker(app):
    """Dan drags the colour picker to find a colour."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'band', 'guide': 'divisions', 'hue': 0, 'dark': False})
    acc = find(app.doc(), slot='accent')[0]; app.select(acc); fill0 = acc['fill']
    p.keyboard.press('c'); p.wait_for_timeout(200)
    sv = p.locator('.colour-panel .sv').bounding_box()
    p.mouse.move(sv['x'] + 10, sv['y'] + 10); p.mouse.down()
    for i in range(1, 15): p.mouse.move(sv['x'] + 10 + i * (sv['width'] - 30) / 14, sv['y'] + 10 + i * (sv['height'] - 30) / 14)
    p.mouse.up(); p.wait_for_timeout(150)
    f = node(app, id=acc['id'])['fill']; note('hex' in f, f'SV drag did not fill the selection: {f}')
    hb = p.locator('.colour-panel .hue-bar').bounding_box(); p.mouse.click(hb['x'] + hb['width'] * .6, hb['y'] + hb['height'] / 2); p.wait_for_timeout(150)
    f2 = node(app, id=acc['id'])['fill']; note(f2 != f, 'hue bar click did not change the colour')
    p.keyboard.press('Escape'); p.keyboard.press('Control+z'); p.wait_for_timeout(100); p.keyboard.press('Control+z'); p.wait_for_timeout(100)
    note(node(app, id=acc['id'])['fill'] == fill0, f'two undos did not return to the first colour: {node(app, id=acc["id"])["fill"]}')


# ------------------------------------------------------------------------------------------------ round 9 (code-review findings)
def ray_review(app):
    """Ray replays the code reviewer's twelve reports as a person would hit them."""
    p = app.page
    # 1 export sheet open while the size changes from A4 to a square
    app.start({'ratio': 'a4', 'comp': 'stack', 'guide': 'golden', 'hue': 200, 'dark': False}); k = len(ba.errors)
    p.locator('button[aria-label="Add a linked size"]').click(); p.wait_for_timeout(200); p.locator('.ratio-panel g[aria-label="Add Post 1:1"]').click(); p.wait_for_timeout(300)
    p.locator('.corner .sizes button').nth(0).click(); p.wait_for_timeout(150); p.keyboard.press('Escape')
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    p.locator('.corner .sizes button').nth(1).click(); p.wait_for_timeout(300)
    note(not ba.errors[k:], f'switching size under the export sheet: {ba.errors[k:][:2]}')
    note('1080 × 1080' in p.locator('.sheet').inner_text(), f'sheet after the switch: {p.locator(".sheet").inner_text()[:120]!r}')
    with p.expect_download(timeout=30000) as dl: p.locator('.sheet .download').click()
    note(dl.value.suggested_filename == 'kura8-square.png', f'download after the switch: {dl.value.suggested_filename}')
    app.close_panels()
    # 2 Enter on a layers row does not also open text
    app.select(find(app.doc(), slot='headline')[0]); p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200)
    p.locator('.layer', has_text='Headline').focus(); p.keyboard.press('Enter'); p.wait_for_timeout(150)
    note(p.locator('textarea.text-editor').count() == 0, 'Enter on a layers row opened the text editor')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    # 3 a picture dropped while typing: the typing and the picture are separate undo steps
    head = find(app.doc(), slot='headline')[0]; app.select(head); p.keyboard.press('Enter'); p.wait_for_timeout(100); p.keyboard.type('New words')
    drop_file(app, image_file(OUT / 'ray.png', 300, 200, (10, 200, 10)), 950, 950); p.keyboard.press('Control+End'); p.keyboard.type(' more')
    p.keyboard.press('Control+Enter'); p.wait_for_timeout(150); p.keyboard.press('Escape')
    p.keyboard.press('Control+z'); p.wait_for_timeout(100); d = app.doc()
    note(node(app, id=head['id'])['text'] == 'New words', f'first undo: {node(app, id=head["id"])["text"]!r}')
    note(any(n['kind'] == 'image' and n['asset'] for n in d['nodes']), 'first undo also removed the dropped picture')
    p.keyboard.press('Control+z'); p.keyboard.press('Control+z'); p.wait_for_timeout(100)
    note(node(app, id=head['id'])['text'] == head['text'], f'three undos did not restore the headline: {node(app, id=head["id"])["text"]!r}')
    # 9 cut of a locked object
    p.keyboard.press('Escape'); acc = find(app.doc(), slot='accent')[0]; app.select(acc); p.keyboard.press('Control+Shift+L'); p.wait_for_timeout(100)
    n0 = len(app.doc()['nodes']); p.keyboard.press('Control+x'); p.wait_for_timeout(100)
    note(p.locator('.toast').inner_text() != 'Cut', 'Cut toast on a locked object'); p.keyboard.press('Control+v'); p.wait_for_timeout(100)
    note(len(app.doc()['nodes']) == n0, 'a locked object was pasted as an unlocked copy')
    # 11 hide on a locked row is refused
    p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200)
    note(p.locator('.layer', has_text='Rectangle').locator('button[aria-label="Hide"]').is_disabled(), 'Hide offered on a locked layer')
    p.keyboard.press('Escape'); p.keyboard.press('Control+Shift+L')
    # 12 redo of a hide drops the selection
    p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200)
    p.locator('.layer', has_text='Rectangle').locator('button[aria-label="Hide"]').click(); p.keyboard.press('Escape')
    p.keyboard.press('Control+z'); p.wait_for_timeout(100); app.select(node(app, id=acc['id'])); p.keyboard.press('Control+Shift+z'); p.wait_for_timeout(150)
    note(p.locator('.toolbar button[aria-label="Delete"]').is_disabled(), 'a hidden object stayed selected after redo')
    valid(app)


def ruth_review(app):
    """Ruth replays the reviewer's colour, paste, ink and New reports."""
    p = app.page
    # 6 undo of a custom hue does not leave the swatch on a missing row
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 210, 'dark': False})
    p.keyboard.press('c'); p.wait_for_timeout(200); f = p.locator('.colour-panel input.field'); f.click(); f.fill('#ff0000'); p.keyboard.press('Enter'); p.wait_for_timeout(100)
    p.locator('.colour-panel button', has_text='Add as hue').click(); p.wait_for_timeout(150)
    p.keyboard.press('Escape'); p.keyboard.press('Escape'); p.keyboard.press('Control+z'); p.wait_for_timeout(150)
    p.keyboard.press('r'); p.wait_for_timeout(150); fill = app.doc()['nodes'][-1]['fill']
    note(not str(fill.get('row', '')).startswith('c'), f'new rectangle filled from a removed custom row: {fill}')
    # 10 contrast "use" recolours only the text
    head = find(app.doc(), slot='headline')[0]; acc = find(app.doc(), slot='accent')[0]
    app.select(acc); p.keyboard.down('Shift'); app.click_unit(*app.node_centre(head)); p.keyboard.up('Shift'); p.wait_for_timeout(150)
    p.keyboard.press('c'); p.wait_for_timeout(150); p.locator('.colour-panel .roles button', has_text='Ground').click(); p.wait_for_timeout(150)
    acc_fill = node(app, id=acc['id'])['fill']; note(acc_fill == {'role': 'ground'}, f'role did not fill both: {acc_fill}')
    use = p.locator('.colour-panel .contrast button', has_text='use')
    if use.count(): use.click(); p.wait_for_timeout(150)
    note(node(app, id=acc['id'])['fill'] == acc_fill, f'contrast fix recoloured the rectangle too: {node(app, id=acc["id"])["fill"]}')
    note(node(app, id=head['id'])['fill'] != {'role': 'ground'}, 'contrast fix did not apply to the text')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    # 5 paste after New with another ratio lands on the canvas
    app.select(find(app.doc(), slot='body')[0]); p.keyboard.press('Control+c')
    p.locator('button.wordmark').click(); p.wait_for_timeout(300)
    for _ in range(5): p.keyboard.press('ArrowRight')   # square -> banner
    note('Banner' in p.locator('.card').nth(0).inner_text(), f'dial ratio: {p.locator(".card").nth(0).inner_text()}')
    p.locator('.dial .dial-actions button', has_text='New').click(); p.wait_for_timeout(500)
    # 8 New then Mod+Z brings the old design back
    p.keyboard.press('Control+z'); p.wait_for_timeout(300)
    note(app.doc()['sizes'][0]['ratio'] == 'square', f'Mod+Z right after New did not bring the last design back: {app.doc()["sizes"][0]["ratio"]}')
    p.keyboard.press('Control+Shift+z'); p.wait_for_timeout(200); p.keyboard.press('Escape')
    p.keyboard.press('Control+v'); p.wait_for_timeout(150); r = app.frame(app.doc()['nodes'][-1])
    note(r['y'] >= -1 and r['y'] + r['h'] <= 1000 / 3 + 1, f'pasted into a banner off the canvas: {r}')
    # 4 arrowhead on a rotated line keeps the line; 7 on a locked line it is just a new stroke
    p.keyboard.press('Escape'); p.keyboard.press('p'); p.wait_for_timeout(100)

    def stroke(pts):
        p.mouse.move(*app.to_px(*pts[0])); p.mouse.down()
        for a, b in zip(pts, pts[1:]):
            for t in range(1, 13): p.mouse.move(*app.to_px(a[0] + (b[0] - a[0]) * t / 12, a[1] + (b[1] - a[1]) * t / 12))
        p.wait_for_timeout(700); p.mouse.up(); p.wait_for_timeout(500)
    stroke([(400, 160), (600, 160)]); line = app.doc()['nodes'][-1]; note(line.get('form') == 'line', f'line: {line.get("form")}')
    p.keyboard.press('Escape'); app.select(node(app, id=line['id'])); r = app.frame(node(app, id=line['id'])); k = app.scale(); cx = r['x'] + r['w'] / 2
    app.drag_unit((cx, r['y'] - 44 / k), (cx + 300, r['y'] + r['h'] / 2 + 3), steps=14, shift=True)
    f = node(app, id=line['id'])['frames']['main']; note(abs(f['rot'] - 90) < 1e-6, f'line rotation {f["rot"]}')
    c = (f['rect']['x'] + f['rect']['w'] / 2, f['rect']['y'] + f['rect']['h'] / 2)
    p.keyboard.press('Escape'); p.keyboard.press('p'); p.wait_for_timeout(100)
    end = (c[0], c[1] + 100)     # the far end after a 90° turn
    stroke([(end[0] - 25, end[1] - 25), end, (end[0] + 25, end[1] - 25)])
    a = node(app, id=line['id']); fa = a['frames']['main']
    note(a.get('form') == 'arrow', f'arrowhead not merged on the rotated line: {a.get("form")}')
    b = fa['rect']; tall = b['h'] > b['w'] if abs(fa['rot']) < 1 else b['w'] > b['h']
    note(tall, f'arrow on a rotated line turned sideways: {fa}')
    p.keyboard.press('Escape'); app.select(node(app, id=line['id'])); p.keyboard.press('Control+Shift+L'); p.keyboard.press('Escape'); p.keyboard.press('p'); p.wait_for_timeout(100)
    n0 = len(app.doc()['nodes']); stroke([(end[0] - 25, end[1] - 25), end, (end[0] + 25, end[1] - 25)])
    note(len(app.doc()['nodes']) == n0 + 1, 'an arrowhead on a locked line was not kept as its own stroke')
    p.keyboard.press('Escape'); valid(app)


# ------------------------------------------------------------------------------------------------ round 10 (regressions around the fixes)
def gwen_escape(app):
    """Gwen presses Escape halfway through every kind of gesture."""
    p = app.page
    app.start({'ratio': 'portrait', 'comp': 'split', 'guide': 'thirds', 'hue': 140, 'dark': False})
    head = find(app.doc(), slot='headline')[0]; app.select(head); r = app.frame(head); f0 = node(app, id=head['id'])['frames']['main']

    def half(a, b, then='Escape'):
        p.mouse.move(*app.to_px(*a)); p.mouse.down()
        for i in range(1, 7): p.mouse.move(*app.to_px(a[0] + (b[0] - a[0]) * i / 12, a[1] + (b[1] - a[1]) * i / 12))
        p.keyboard.press(then); p.wait_for_timeout(50)
        for i in range(7, 13): p.mouse.move(*app.to_px(a[0] + (b[0] - a[0]) * i / 12, a[1] + (b[1] - a[1]) * i / 12))
        p.mouse.up(); p.wait_for_timeout(150)
    half((r['x'] + r['w'], r['y'] + r['h']), (r['x'] + r['w'] + 80, r['y'] + r['h'] + 80))
    note(node(app, id=head['id'])['frames']['main'] == f0, f'Escape mid text-corner resize: {node(app, id=head["id"])["frames"]["main"]}')
    k = app.scale(); cx = r['x'] + r['w'] / 2
    half((cx, r['y'] - 44 / k), (cx + 200, r['y'] + 100))
    note(node(app, id=head['id'])['frames']['main'] == f0, 'Escape mid rotate')
    note(not p.locator('.toolbar button[aria-label="Delete"]').is_disabled(), 'Escape mid-gesture also deselected')
    p.keyboard.press('Escape'); acc = find(app.doc(), slot='accent')[0]; app.select(acc)
    half((980, 1230), (500, 800))
    p.wait_for_timeout(100); note(p.locator('.info').inner_text().startswith('Rectangle'), f'Escape mid marquee did not restore the selection: {p.locator(".info").inner_text()!r}')
    # eraser
    p.keyboard.press('Escape'); p.keyboard.press('p'); p.wait_for_timeout(100)
    pts = [(100 + i * 10, 1100) for i in range(30)]
    p.mouse.move(*app.to_px(*pts[0])); p.mouse.down()
    for q in pts[1:]: p.mouse.move(*app.to_px(*q))
    p.mouse.up(); p.wait_for_timeout(300); n = len(app.doc()['nodes'])
    p.keyboard.press('e'); p.wait_for_timeout(100)
    half((250, 1000), (250, 1200))
    note(len(app.doc()['nodes']) == n, 'Escape mid eraser did not give the stroke back')
    note(p.locator('.toolbar button[aria-label="Eraser"]').get_attribute('aria-pressed') == 'true', 'Escape mid eraser also left the tool')
    p.keyboard.press('Escape'); valid(app)


def ike_shift_locked(app):
    """Ike shift-clicks a locked object to drop it from a selection."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 260, 'dark': False})
    acc = find(app.doc(), slot='accent')[0]; head = find(app.doc(), slot='headline')[0]
    app.select(acc); p.keyboard.press('Control+Shift+L'); p.keyboard.down('Shift'); app.click_unit(*app.node_centre(head)); p.keyboard.up('Shift'); p.wait_for_timeout(100)
    note(p.locator('.info').inner_text().startswith('2 selected'), f'shift add: {p.locator(".info").inner_text()!r}')
    p.keyboard.down('Shift'); app.click_unit(*app.node_centre(acc)); p.keyboard.up('Shift'); p.wait_for_timeout(120)
    note(p.locator('.info').inner_text().startswith('Headline'), f'shift-click on a locked selected object did not drop it: {p.locator(".info").inner_text()!r}')


def jo_tab_typing(app):
    """Jo is typing in one tab when the other tab saves."""
    p = app.page
    app.start({'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 10, 'dark': False})
    b = app.ctx.new_page(); b.goto(BASE); b.wait_for_timeout(800)
    p.bring_to_front(); head = find(app.doc(), slot='headline')[0]; app.select(head); p.keyboard.press('Enter'); p.wait_for_timeout(100); p.keyboard.type('half typed')
    k = len(ba.errors)
    b.bring_to_front(); b.keyboard.press('r'); b.wait_for_timeout(900)
    p.bring_to_front(); p.wait_for_timeout(300)
    note('another tab' in p.locator('.toast').inner_text(), f'no notice of the other tab: {p.locator(".toast").inner_text()!r}')
    note(p.locator('textarea.text-editor').count() == 0, 'text editor left open over a replaced document')
    p.keyboard.press('o'); p.wait_for_timeout(900)
    d = app.doc(); note(any(n.get('shape') == 'rect' for n in d['nodes']) and any(n.get('shape') == 'circle' for n in d['nodes']), 'edits from both tabs not kept')
    note(not ba.errors[k:], f'errors {ba.errors[k:]}'); b.close(); valid(app)


def lea_touch_frame(app):
    """Lea fills an empty frame with a double tap."""
    old = app.ctx
    ctx = old.browser.new_context(viewport={'width': 1280, 'height': 800}, has_touch=True, accept_downloads=True)
    app.ctx = ctx; app.page = ctx.new_page(); p = app.page
    try:
        app.start({'ratio': 'square', 'comp': 'frame', 'guide': 'thirds', 'hue': 60, 'dark': False})
        frame = find(app.doc(), slot='image')[0]; c = app.to_px(*app.node_centre(frame))
        p.touchscreen.tap(*c); p.wait_for_timeout(80)
        with p.expect_file_chooser(timeout=5000) as fc: p.touchscreen.tap(*c)
        fc.value.set_files(str(image_file(OUT / 'lea.png', 400, 400, (200, 100, 20)))); p.wait_for_timeout(1500)
        note(node(app, id=frame['id'])['asset'], 'double tap on an empty frame did not fill it')
    except Exception as e:  # noqa: BLE001
        note(False, f'double tap on an empty frame: {str(e)[:160]}')
    finally:
        ctx.close(); app.ctx = old; app.page = old.pages[0]


PERSONAS = [maya_social, priya_print, layla_scripts, kai_keyboard, sam_sketch, cleo_colour, pat_power, ren_returning, sol_small, chaos,
            ines_photos, tom_worksheet, ivy_icons, max_sizes, quinn_quota, ula_interrupts, dee_dark,
            rio_rotation, vic_migrated, ari_arrows, gus_grid, hana_help, zed_stress, lou_layers, nia_reratio,
            tess_two_tabs, theo_touch, eve_parity, mo_reduced_motion, bea_cutout,
            kim_dial, fay_extremes, lin_locks, pia_exports, ola_undo_ui, uma_crop, xia_dial_keys,
            ken_retina, rae_linked_text, sid_async,
            noor_hidden, zara_paste_sizes, cara_dial_back, mae_mouse_export, dan_picker,
            ray_review, ruth_review, gwen_escape, ike_shift_locked, jo_tab_typing, lea_touch_frame]


def main():
    only = os.environ.get('ONLY')
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM') or next((str(x) for x in Path('/opt/pw-browsers').glob('chromium-*/chrome-linux/chrome')), None)
        browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
        for fn in PERSONAS:
            if only and not any(o in fn.__name__ for o in only.split(',')): continue
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
