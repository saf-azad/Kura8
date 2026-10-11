"""Phase 1 browser audit (M15).

Run `npm run build`, start `npm run preview -- --port 4173`, then `python3 scripts/browser_audit.py [base-url]`.
Needs Python Playwright and Pillow (audit tools, not app dependencies). Uses a fresh Chromium profile; pass
CHROMIUM=/path/to/chrome to choose the browser. Screenshots and downloads go to ignored private/browser-audit/.
Every refinement card 5a-5z and every prototype tool is a named step; the run fails on any app console error or
any request that leaves the origin.
"""
import io, json, os, sys, time, traceback, xml.dom.minidom
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://127.0.0.1:4173/')
ORIGIN = BASE.split('/', 3)[0] + '//' + BASE.split('/', 3)[2]
OUT = Path(__file__).resolve().parent.parent / 'private' / 'browser-audit'
OUT.mkdir(parents=True, exist_ok=True)
RATIOS = ['square', 'portrait', 'landscape', 'story', 'a4', 'banner']
COMPS = ['cover', 'split', 'stack', 'poster', 'frame', 'band']
GUIDES = ['thirds', 'golden', 'divisions']
HEIGHT = {'square': 1000, 'portrait': 1250, 'landscape': 562.5, 'story': 1000 * 16 / 9, 'a4': 1000 * 2 ** .5, 'banner': 1000 / 3}
EXPORT = {'square': (1080, 1080), 'portrait': (1080, 1350), 'landscape': (1920, 1080), 'story': (1080, 1920), 'a4': (1240, 1754), 'banner': (1500, 500)}
results, errors, offorigin = [], [], []


def step(name):
    def wrap(fn):
        def run(*a):
            t0 = time.time()
            try:
                fn(*a); results.append((name, 'pass', time.time() - t0, ''))
                print(f'  pass  {name}')
            except Exception as e:  # noqa: BLE001 - report every failing step
                results.append((name, 'FAIL', time.time() - t0, f'{e}'))
                print(f'  FAIL  {name}: {e}'); traceback.print_exc(limit=2)
                try: a[0].page.screenshot(path=str(OUT / f'fail-{name[:40].replace(" ", "_").replace("/", "-")}.png'))
                except Exception: pass
        run.__name__ = fn.__name__
        return run
    return wrap


def check(cond, message):
    if not cond: raise AssertionError(message)


class App:
    def __init__(self, browser):
        self.ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
        self.page = self.ctx.new_page()
        # Failed loads are reported from responses (with their URLs) rather than console text; the static page used to
        # reset storage asks for /favicon.ico, which the app itself never requests.
        self.page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' and not m.text.startswith('Failed to load resource') else None)
        self.page.on('response', lambda r: errors.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 and not r.url.endswith('/favicon.ico') else None)
        self.page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        self.page.on('request', lambda r: offorigin.append(r.url) if not (r.url.startswith(ORIGIN) or r.url.startswith('data:') or r.url.startswith('blob:')) else None)

    def fresh(self, dial=None):
        p = self.page
        self.reset()
        p.evaluate('localStorage.setItem("kura8:lifted", "true")')
        if dial: p.evaluate(f'localStorage.setItem("kura8:dial", {json.dumps(json.dumps(dial))})')
        p.goto(BASE); p.wait_for_timeout(400)

    def reset(self):
        # Clear storage from a static same-origin file: leaving the app would save its document again on pagehide.
        p = self.page; p.goto(BASE + 'icons/LICENSE.txt'); p.evaluate('localStorage.clear(); indexedDB.deleteDatabase("kura8")'); p.wait_for_timeout(100)

    def start(self, dial=None):
        self.fresh(dial); self.page.keyboard.press('Enter'); self.page.wait_for_timeout(500)
        self.page.keyboard.press('Escape'); self.page.wait_for_timeout(100)
        self.page.keyboard.press('Escape'); self.page.wait_for_timeout(100)

    def doc(self):
        self.page.wait_for_timeout(650)
        return json.loads(self.page.evaluate('localStorage.getItem("kura8:doc")') or 'null')

    def box(self):
        return self.page.locator('canvas.doc').bounding_box()

    def to_px(self, x, y):
        b = self.box(); k = b['width'] / 1000
        return b['x'] + x * k, b['y'] + y * k

    def scale(self):
        return self.box()['width'] / 1000

    def frame(self, node, size='main'):
        return node['frames'][size]['rect']

    def click_unit(self, x, y, **kw):
        self.page.mouse.click(*self.to_px(x, y), **kw)

    def node_centre(self, node, size='main'):
        r = self.frame(node, size); return r['x'] + r['w'] / 2, r['y'] + min(r['h'], 40) / 2

    def select(self, node, size='main', shift=False):
        x, y = self.node_centre(node, size)
        if shift: self.page.keyboard.down('Shift')
        self.click_unit(x, y)
        if shift: self.page.keyboard.up('Shift')
        self.page.wait_for_timeout(80)

    def drag_unit(self, a, b, steps=12, alt=False, shift=False):
        p = self.page
        p.mouse.move(*self.to_px(*a))
        if alt: p.keyboard.down('Alt')
        if shift: p.keyboard.down('Shift')
        p.mouse.down()
        for i in range(1, steps + 1):
            t = i / steps; p.mouse.move(*self.to_px(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        p.mouse.up()
        if alt: p.keyboard.up('Alt')
        if shift: p.keyboard.up('Shift')
        p.wait_for_timeout(80)

    def button(self, label):
        return self.page.locator(f'button[aria-label="{label}"]').first

    def tip(self, text):
        return self.page.locator(f'[data-tip^="{text}"], [title^="{text}"]').first

    def export(self, fmt, scale=None, no_ground=False):
        p = self.page
        if p.locator('.sheet:not([hidden])').count() == 0: p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
        p.locator('.sheet .seg[aria-label="Format"] button', has_text=fmt.upper()).click()
        if scale: p.locator('.sheet .seg[aria-label="Size"] button', has_text=scale).click()
        if no_ground:
            sw = p.locator('.sheet button[aria-label="No ground"]')
            if sw.get_attribute('aria-checked') != 'true': sw.click()
        p.wait_for_timeout(150)
        with p.expect_download(timeout=60000) as d: p.locator('.sheet .download').click()
        path = OUT / d.value.suggested_filename; d.value.save_as(path)
        p.wait_for_timeout(200)
        return path

    def close_panels(self):
        for _ in range(3): self.page.keyboard.press('Escape'); self.page.wait_for_timeout(60)


def image_file(path, w, h, colour=(200, 60, 40)):
    img = Image.new('RGB', (w, h), (240, 240, 235))
    for x in range(w // 4, 3 * w // 4):
        for y in range(h // 4, 3 * h // 4, max(1, h // 400)): img.putpixel((x, y), colour)
    img.save(path); return path


def drop_file(app, path, x, y, mime='image/png'):
    data = list(Path(path).read_bytes())
    px, py = app.to_px(x, y)
    app.page.evaluate('''([data, name, mime, x, y]) => {
      const file = new File([new Uint8Array(data)], name, { type: mime }), dt = new DataTransfer(); dt.items.add(file);
      const target = document.elementFromPoint(x, y) || document.body;
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
    }''', [data, Path(path).name, mime, px, py])
    app.page.wait_for_timeout(1500)


# ---------------------------------------------------------------------------------------------------------- dial
@step('load: dial on first open, no errors, nothing off-origin')
def s_load(app):
    app.fresh(); p = app.page
    check(p.locator('.dial').count() == 1, 'dial missing'); check(p.locator('.hub canvas').count() == 1, 'hub preview missing')
    check(p.locator('.card').count() == 4, 'readout cards missing')
    p.screenshot(path=str(OUT / 'dial.png'))


@step('5a ratio ring names destinations and hovering previews the hub')
def s_5a(app):
    app.fresh(); p = app.page
    for label in ['Post 1:1', 'Portrait 4:5', 'Slide 16:9', 'Story 9:16', 'Print A4', 'Banner 3:1']:
        check(p.locator(f'[data-ring="ratio"][data-tip="{label}"]').count() == 1, f'missing {label}')
    before = p.locator('.hub canvas').bounding_box()
    g = p.locator('[data-ring="ratio"][data-tip="Banner 3:1"] > g').bounding_box(); p.mouse.move(g['x'] + g['width'] / 2, g['y'] + g['height'] / 2); p.wait_for_timeout(700)
    after = p.locator('.hub canvas').bounding_box()
    check(after['width'] / after['height'] > 2.5, f'hub did not preview banner: {after}')
    check(abs(before['width'] / before['height'] - .8) < .05, 'hub was not portrait first')


@step('dial: arrows focus and turn rings, Enter starts, readout follows')
def s_dial_keys(app):
    app.fresh(); p = app.page
    p.keyboard.press('ArrowRight'); p.wait_for_timeout(100)
    check('Slide 16:9' in p.locator('.card').nth(0).inner_text(), 'ratio did not turn to landscape')
    p.keyboard.press('ArrowDown'); p.keyboard.press('ArrowRight'); p.wait_for_timeout(100)
    check('Split' in p.locator('.card').nth(1).inner_text(), 'layout did not turn')
    p.keyboard.press('ArrowDown'); p.keyboard.press('ArrowLeft'); p.wait_for_timeout(100)
    check('Thirds' in p.locator('.card').nth(2).inner_text(), 'guide did not turn')
    p.keyboard.press('ArrowDown'); p.keyboard.press('ArrowRight'); p.wait_for_timeout(100)
    check('Hue 240' in p.locator('.card').nth(3).inner_text(), 'colour did not turn')
    p.locator('.ground-toggle button[aria-label="Dark ground"]').click(); p.evaluate('document.activeElement.blur()')
    p.keyboard.press('Enter'); p.wait_for_timeout(500)
    d = app.doc()
    check(d['sizes'][0] == {'id': 'main', 'ratio': 'landscape', 'guide': 'thirds', 'comp': 'split'}, f'wrong size {d["sizes"]}')
    check(d['palette']['hue'] == 240 and d['palette']['dark'] is True, f'wrong palette {d["palette"]}')


@step('dial: drag and scroll turn a ring')
def s_dial_drag(app):
    app.fresh(); p = app.page
    seg = p.locator('[data-ring="comp"][data-index="0"] > g').bounding_box()
    cx, cy = seg['x'] + seg['width'] / 2, seg['y'] + seg['height'] / 2
    wheel = p.locator('.wheel > svg').bounding_box(); ox, oy = wheel['x'] + wheel['width'] / 2, wheel['y'] + wheel['height'] / 2
    import math
    r, a0 = math.hypot(cx - ox, cy - oy), math.atan2(cy - oy, cx - ox)
    p.mouse.move(cx, cy); p.mouse.down()
    for i in range(1, 16): a = a0 - math.radians(62) * i / 15; p.mouse.move(ox + r * math.cos(a), oy + r * math.sin(a))
    p.mouse.up(); p.wait_for_timeout(700)
    check('Split' in p.locator('.card').nth(1).inner_text(), f'drag did not turn: {p.locator(".card").nth(1).inner_text()}')
    g = p.locator('[data-ring="guide"][data-index="0"] > g').bounding_box(); p.mouse.move(g['x'] + g['width'] / 2, g['y'] + g['height'] / 2); p.mouse.wheel(0, 120); p.wait_for_timeout(300)
    check('Quarters' in p.locator('.card').nth(2).inner_text() or 'Thirds' in p.locator('.card').nth(2).inner_text(), 'scroll did not turn')


@step('dial to editor for all 6 ratios × 6 layouts × 3 guides, every block inside the canvas')
def s_matrix(app):
    p = app.page; bad = []
    for ratio in RATIOS:
        for comp in COMPS:
            for guide in GUIDES:
                app.fresh({'ratio': ratio, 'comp': comp, 'guide': guide, 'hue': 30, 'dark': False})
                p.locator('.hub').click(); p.wait_for_timeout(250)
                d = app.doc()
                if not d or d['sizes'][0]['ratio'] != ratio or d['sizes'][0]['comp'] != comp or d['sizes'][0]['guide'] != guide: bad.append(f'{ratio}/{comp}/{guide}: wrong doc'); continue
                for n in d['nodes']:
                    r = n['frames']['main']['rect']
                    if r['x'] < -.5 or r['y'] < -.5 or r['x'] + r['w'] > 1000.5 or r['y'] + r['h'] > HEIGHT[ratio] + .5: bad.append(f'{ratio}/{comp}/{guide}: {n["kind"]} {r}')
                kinds = sorted(n.get('slot') for n in d['nodes'])
                if kinds != sorted((['image'] if comp != 'poster' else []) + ['accent', 'headline', 'body']): bad.append(f'{ratio}/{comp}/{guide}: slots {kinds}')
    check(not bad, '; '.join(bad[:6]))


@step('5b dial reopens on the last setting and a hub tap goes straight to the canvas')
def s_5b(app):
    app.fresh({'ratio': 'story', 'comp': 'band', 'guide': 'divisions', 'hue': None, 'dark': True}); p = app.page
    check('Story 9:16' in p.locator('.card').nth(0).inner_text() and 'Band' in p.locator('.card').nth(1).inner_text(), 'dial did not reopen on stored settings')
    p.locator('.hub').click(); p.wait_for_timeout(400)
    check(p.locator('.dial').count() == 0 or not p.locator('.dial').is_visible(), 'hub tap did not open the canvas')
    p.keyboard.press('Escape')
    app.page.locator('button.wordmark').click(); p.wait_for_timeout(300)
    p.goto(BASE); p.wait_for_timeout(300)
    check(json.loads(p.evaluate('localStorage.getItem("kura8:dial")'))['ratio'] == 'story', 'dial settings not saved')


@step('5c unsuited layouts dim with the reason on hover')
def s_5c(app):
    app.fresh({'ratio': 'story', 'comp': 'cover', 'guide': 'golden', 'hue': 210, 'dark': False}); p = app.page
    split = p.locator('[data-ring="comp"][data-index="1"]')
    check(split.get_attribute('aria-disabled') == 'true', 'split not dimmed at 9:16')
    check('narrow' in split.get_attribute('data-tip'), f'no reason: {split.get_attribute("data-tip")}')
    check(p.locator('[data-ring="comp"][data-index="0"]').get_attribute('aria-disabled') == 'false', 'cover dimmed at 9:16')
    split.locator('path').hover(); p.wait_for_timeout(250)
    check('narrow' in p.locator('.tip').inner_text(), 'tooltip does not show the reason')


@step('5d first open lifts blocks once')
def s_5d(app):
    p = app.page; app.reset(); p.goto(BASE); p.wait_for_timeout(300)
    check(p.evaluate('localStorage.getItem("kura8:lifted")') is None, 'lift flag set before first open')
    p.keyboard.press('Enter'); p.wait_for_timeout(1500)
    check(p.evaluate('localStorage.getItem("kura8:lifted")') == 'true', 'lift did not run on first open')
    check(p.locator('.tour, .onboarding').count() == 0, 'unexpected tour')


# -------------------------------------------------------------------------------------------------------- editor
SQUARE = {'ratio': 'square', 'comp': 'cover', 'guide': 'thirds', 'hue': 210, 'dark': False}


def find(d, **kw):
    return [n for n in d['nodes'] if all(n.get(k) == v for k, v in kw.items())]


@step('tools: T text, R rectangle, O ellipse, I picks pictures, S shapes, C colour, G guides, ? shortcuts')
def s_tool_keys(app):
    app.start(SQUARE); p = app.page; n0 = len(app.doc()['nodes'])
    p.keyboard.press('t'); p.wait_for_timeout(200); p.keyboard.type('Added'); p.keyboard.press('Control+Enter')
    p.keyboard.press('Escape'); p.keyboard.press('r'); p.keyboard.press('Escape'); p.keyboard.press('o'); p.keyboard.press('Escape')
    # D-061: I opens the file picker; an empty frame comes from the Shapes panel.
    with p.expect_file_chooser(timeout=3000) as fc: p.keyboard.press('i')
    fc.value.set_files([]); p.keyboard.press('Escape')
    p.keyboard.press('s'); p.wait_for_timeout(250); p.locator('.shapes-panel button', has_text='+ Image frame').click(); p.keyboard.press('Escape')
    d = app.doc()
    check(len(d['nodes']) == n0 + 4, f'expected 4 new nodes, got {len(d["nodes"]) - n0}')
    check(find(d, text='Added'), 'typed text missing'); check(find(d, shape='rect') and find(d, shape='circle'), 'shapes missing')
    check(len([n for n in d['nodes'] if n['kind'] == 'image' and n['asset'] is None]) == 2, 'image frame missing')
    for key, panel in [('s', '.shapes-panel'), ('c', '.colour-panel')]:
        p.keyboard.press(key); p.wait_for_timeout(250); check(p.locator(f'{panel}:not([hidden])').count() == 1, f'{key} did not open {panel}'); p.keyboard.press('Escape')
    p.keyboard.press('?'); p.wait_for_timeout(250); check(p.locator('.modal:not([hidden])').count() == 1, 'shortcuts did not open'); p.keyboard.press('Escape')
    g = p.locator('button[aria-label="Guides"]'); before = g.get_attribute('aria-pressed'); p.keyboard.press('g'); p.wait_for_timeout(100)
    check(g.get_attribute('aria-pressed') != before, 'G did not toggle guides')


@step('editing: select, shift-select, marquee, select all, move, resize, rotate')
def s_select_move(app):
    app.start(SQUARE); p = app.page; d = app.doc()
    acc, head = find(d, slot='accent')[0], find(d, slot='headline')[0]
    app.select(acc); check(p.locator('.info').inner_text().startswith('Rectangle'), 'click did not select')
    app.select(head, shift=True); check('2 selected' in p.locator('.info').inner_text(), 'shift-click did not add')
    app.click_unit(990, 990); p.wait_for_timeout(80)
    app.drag_unit((5, 995), (400, 690)); check('2 selected' in p.locator('.info').inner_text(), f'marquee: {p.locator(".info").inner_text()}')
    p.keyboard.press('Control+a'); check(f'{len(d["nodes"])} selected' in p.locator('.info').inner_text(), 'select all')
    p.keyboard.press('Escape'); r = app.frame(acc)
    app.drag_unit((r['x'] + r['w'] / 2, r['y'] + r['h'] / 2), (r['x'] + r['w'] / 2 + 137, r['y'] + r['h'] / 2 + 91), alt=True)
    moved = app.frame(find(app.doc(), slot='accent')[0]); check(abs(moved['x'] - r['x'] - 137) < 1.5 and abs(moved['y'] - r['y'] - 91) < 1.5, f'move off: {moved}')
    # resize from the south-east corner
    app.drag_unit((moved['x'] + moved['w'], moved['y'] + moved['h']), (moved['x'] + moved['w'] + 61, moved['y'] + moved['h'] + 43), alt=True)
    sized = app.frame(find(app.doc(), slot='accent')[0]); check(abs(sized['w'] - moved['w'] - 61) < 1.5 and abs(sized['h'] - moved['h'] - 43) < 1.5, f'resize off: {sized}')
    # rotate with the knob above the top edge (44 px above)
    k = app.scale(); cx, top = sized['x'] + sized['w'] / 2, sized['y'] - 44 / k
    app.drag_unit((cx, top), (cx + 300, sized['y'] + sized['h'] / 2 - 300 * 0.0), steps=16, alt=True)
    rot = find(app.doc(), slot='accent')[0]['frames']['main']['rot']; check(abs(rot - 90) < 3, f'rotation {rot}')


@step('5j holding Alt drags without snapping; releasing it snaps again')
def s_5j(app):
    app.start(SQUARE); acc = find(app.doc(), slot='accent')[0]; r = app.frame(acc)
    start = (r['x'] + 10, r['y'] + 10)
    target_x = 1000 / 3 - r['x'] + 4  # left edge lands 4 units right of the 1/3 line
    app.drag_unit(start, (start[0] + target_x, start[1] + 157), alt=True)
    a = app.frame(find(app.doc(), slot='accent')[0]); check(abs(a['x'] - 1000 / 3 - 4) < 1, f'Alt drag snapped: {a["x"]}')
    app.page.keyboard.press('Control+z'); app.page.wait_for_timeout(100)
    app.drag_unit(start, (start[0] + target_x, start[1] + 157))
    b = app.frame(find(app.doc(), slot='accent')[0]); check(abs(b['x'] - 1000 / 3) < .01, f'no snap to the guide: {b["x"]}')


@step('5k guide outranks canvas centre and objects within reach')
def s_5k(app):
    app.start(SQUARE); acc = find(app.doc(), slot='accent')[0]; r = app.frame(acc)
    # put the left edge 3 units from the 2/3 line, with the centre 3 units from the canvas centre the other way
    dx = 2000 / 3 + 3 - r['x']
    app.drag_unit((r['x'] + 10, r['y'] + 10), (r['x'] + 10 + dx, r['y'] + 10 + 211))
    a = app.frame(find(app.doc(), slot='accent')[0]); check(abs(a['x'] - 2000 / 3) < .01, f'guide did not win: {a["x"]}')


@step('5l arrows move 1, Shift+arrow one grid cell with the grid on, 10 without; never while typing')
def s_5l(app):
    app.start(SQUARE); p = app.page; acc = find(app.doc(), slot='accent')[0]; app.select(acc); x0 = app.frame(acc)['x']
    p.keyboard.press('ArrowRight'); p.keyboard.press('Shift+ArrowRight')
    check(abs(app.frame(find(app.doc(), slot='accent')[0])['x'] - x0 - 11) < .01, 'nudge 1 + 10')
    p.locator('button[aria-label="Snap grid"]').click(); p.locator('.grid-panel .switch').click(); p.locator('.grid-panel .presets button', has_text='40').click(); p.keyboard.press('Escape')
    app.select(find(app.doc(), slot='accent')[0]); p.keyboard.press('Shift+ArrowLeft')
    check(abs(app.frame(find(app.doc(), slot='accent')[0])['x'] - x0 - 11 + 40) < .01, 'grid cell nudge')
    p.keyboard.press('c'); p.locator('.colour-panel input.field').click(); p.keyboard.press('ArrowLeft'); p.keyboard.press('ArrowLeft')
    check(abs(app.frame(find(app.doc(), slot='accent')[0])['x'] - x0 - 11 + 40) < .01, 'arrow moved object while typing')


@step('5m rotated objects snap on their own corners')
def s_5m(app):
    app.start(SQUARE); p = app.page; acc = find(app.doc(), slot='accent')[0]; app.select(acc); r = app.frame(acc)
    k = app.scale(); cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    app.drag_unit((cx, r['y'] - 44 / k), (cx + 200, cy - 200 * 1.73), alt=True)  # about 30°
    a = find(app.doc(), slot='accent')[0]; f = a['frames']['main']; check(15 < f['rot'] < 45, f'rot {f["rot"]}')
    import math
    t = math.radians(f['rot']); xs = [f['rect']['x'] + f['rect']['w'] / 2 + sx * f['rect']['w'] / 2 * math.cos(t) - sy * f['rect']['h'] / 2 * math.sin(t) for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    left = min(xs); target = 1000 / 3
    app.drag_unit((cx, cy), (cx + target - left + 3, cy + 5))
    f2 = find(app.doc(), slot='accent')[0]['frames']['main']; t2 = math.radians(f2['rot'])
    xs2 = [f2['rect']['x'] + f2['rect']['w'] / 2 + sx * f2['rect']['w'] / 2 * math.cos(t2) - sy * f2['rect']['h'] / 2 * math.sin(t2) for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    check(any(abs(x - target) < .01 for x in xs2), f'no corner on the guide: {xs2}')


@step('clipboard, duplicate, z-order, lock, hide, delete, undo and redo')
def s_edit_ops(app):
    app.start(SQUARE); p = app.page; d = app.doc(); n0 = len(d['nodes']); acc = find(d, slot='accent')[0]
    app.select(acc); p.keyboard.press('Control+c'); p.keyboard.press('Control+v'); p.keyboard.press('Control+d')
    check(len(app.doc()['nodes']) == n0 + 2, 'copy/paste/duplicate')
    p.keyboard.press('Control+x'); check(len(app.doc()['nodes']) == n0 + 1, 'cut')
    r = app.frame(acc); app.click_unit(r['x'] + 5, r['y'] + 5); p.keyboard.press('Control+Shift+BracketRight'); check(app.doc()['nodes'][-1]['id'] == acc['id'], 'bring to front')
    p.keyboard.press('Control+Shift+BracketLeft'); check(app.doc()['nodes'][0]['id'] == acc['id'], 'send to back')
    p.keyboard.press('Control+BracketRight'); check(app.doc()['nodes'][1]['id'] == acc['id'], 'forward')
    p.keyboard.press('Control+BracketLeft'); check(app.doc()['nodes'][0]['id'] == acc['id'], 'backward')
    p.keyboard.press('Control+Shift+L'); check(find(app.doc(), id=acc['id'])[0].get('locked') is True, 'lock')
    p.keyboard.press('Delete'); check(find(app.doc(), id=acc['id']), 'locked object deleted')
    x0 = app.frame(find(app.doc(), id=acc['id'])[0])['x']; p.keyboard.press('ArrowRight')
    check(app.frame(find(app.doc(), id=acc['id'])[0])['x'] == x0, 'locked object moved')
    p.keyboard.press('Control+Shift+L'); p.keyboard.press('Delete'); check(not find(app.doc(), id=acc['id']), 'delete')
    p.keyboard.press('Control+z'); check(find(app.doc(), id=acc['id']), 'undo'); p.keyboard.press('Control+Shift+z'); check(not find(app.doc(), id=acc['id']), 'redo')
    p.keyboard.press('Control+y'); p.keyboard.press('Control+z'); check(find(app.doc(), id=acc['id']), 'undo again')


@step('layers panel lists top first, reorders, hides per size and locks')
def s_layers(app):
    app.start(SQUARE); p = app.page; d = app.doc()
    p.locator('button[aria-label="Layers"]').click(); p.wait_for_timeout(200)
    rows = p.locator('.layer'); check(rows.count() == len(d['nodes']), 'layer count')
    check('Body text' in rows.nth(0).inner_text(), f'top layer {rows.nth(0).inner_text()}')
    rows.nth(0).locator('button[aria-label="Hide"]').click()
    body = find(app.doc(), slot='body')[0]; check(body['frames']['main'].get('hidden') is True, 'hide')
    p.locator('.layer').nth(1).locator('button[aria-label="Lock"]').click(); check(find(app.doc(), slot='headline')[0].get('locked') is True, 'lock from layers')
    p.locator('.layer').nth(1).locator('button[aria-label="Send backward"]').click()
    check([n.get('slot') for n in app.doc()['nodes']][-1] == 'body', 'order after send backward')


@step('5e a swatch fills the selection; with nothing selected it arms paint; Esc disarms; ground tap deselects')
def s_5e(app):
    app.start(SQUARE); p = app.page; acc = find(app.doc(), slot='accent')[0]
    app.select(acc); p.keyboard.press('c'); p.wait_for_timeout(200)
    p.locator('.colour-panel .roles button', has_text='Ink').click()
    check(find(app.doc(), slot='accent')[0]['fill'] == {'role': 'ink'}, 'swatch did not fill the selection')
    app.click_unit(990, 990); p.wait_for_timeout(100)
    check(app.doc()['ground'] is None, 'ground filled while not armed')
    check(p.locator('.info').inner_text().strip() == '' or p.locator('.info').evaluate('e => getComputedStyle(e).opacity') == '0', 'tap on ground did not deselect')
    p.locator('.colour-panel .shades button').nth(1).click(); p.wait_for_timeout(100)
    check('data:image/svg' in (p.locator('canvas.overlay').evaluate('e => { e.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 10 })); return e.style.cursor; }') or ''), 'armed swatch has no cursor ring')
    app.click_unit(990, 990); d = app.doc(); check(d['ground'] is not None and 'row' in d['ground'], f'armed tap did not fill ground: {d["ground"]}')
    app.select(find(d, slot='headline')[0]); check(find(app.doc(), slot='headline')[0]['fill'] == d['ground'], 'armed tap did not paint the object')
    p.keyboard.press('Escape'); p.wait_for_timeout(80); ground = app.doc()['ground']
    app.click_unit(985, 985); check(app.doc()['ground'] == ground, 'Esc did not disarm')


@step('5f the wordmark returns to the dial with the canvas in the hub; Go re-lays the same content')
def s_5f(app):
    app.start(SQUARE); p = app.page; head = find(app.doc(), slot='headline')[0]
    app.select(head); p.keyboard.press('Enter'); p.keyboard.press('Control+a'); p.keyboard.type('Kept title'); p.keyboard.press('Control+Enter')
    p.locator('button.wordmark').click(); p.wait_for_timeout(400)
    check(p.locator('.dial').is_visible(), 'wordmark did not open the dial')
    check(p.locator('.dial .dial-actions button', has_text='Go').count() == 1, 'Go missing')
    p.keyboard.press('ArrowDown'); p.keyboard.press('ArrowRight'); p.wait_for_timeout(200)  # cover → split
    p.locator('.dial .dial-actions button', has_text='Go').click(); p.wait_for_timeout(700)
    d = app.doc(); check(d['sizes'][0]['comp'] == 'split', 'Go did not re-lay'); h = find(d, slot='headline')[0]
    check(h['text'] == 'Kept title', 'content lost'); check(abs(app.frame(h)['x'] - (1000 / 3 + 45)) < 1, f'headline not in the split slot: {app.frame(h)}')
    p.keyboard.press('Control+z'); check(app.doc()['sizes'][0]['comp'] == 'cover', 'Go not undoable')
    p.locator('button.wordmark').click(); p.wait_for_timeout(300); p.locator('.dial .dial-actions button', has_text='Back to canvas').click(); p.wait_for_timeout(300)
    check(p.locator('canvas.overlay').is_visible(), 'back to canvas')


@step('5g a pasted hex becomes a custom hue for this file')
def s_5g(app):
    app.start(SQUARE); p = app.page; acc = find(app.doc(), slot='accent')[0]; app.select(acc); p.keyboard.press('c')
    # Panels open on the next animation frame; typing before then lands in an inert field.
    p.locator('.colour-panel:not([hidden])').wait_for()
    hexf = p.locator('.colour-panel input.field'); hexf.fill('#9CABC2'); p.wait_for_timeout(100)
    p.locator('.colour-panel button', has_text='+ Add as hue').click(); d = app.doc()
    check(d['palette']['custom'] == ['#9cabc2'], f'custom {d["palette"]["custom"]}')
    check(find(d, slot='accent')[0]['fill'] == {'row': 'c0', 'step': 2}, f'fill {find(d, slot="accent")[0]["fill"]}')
    check(p.locator('.colour-panel .hues button[aria-label^="Custom hue"]').count() == 1, 'custom hue dot missing')


@step('5h text below 4.5:1 shows the ratio and offers the nearest passing shade')
def s_5h(app):
    app.start(SQUARE); p = app.page; head = find(app.doc(), slot='headline')[0]; app.select(head); p.keyboard.press('c')
    p.locator('.colour-panel:not([hidden])').wait_for()
    p.locator('.colour-panel .roles button', has_text='Ground').click(); p.wait_for_timeout(150)
    box = p.locator('.colour-panel .contrast'); check(box.is_visible() and 'fails' in box.inner_text(), 'no contrast warning')
    box.locator('button', has_text='use').click(); f = find(app.doc(), slot='headline')[0]['fill']
    check('row' in f, f'fix fill {f}'); p.wait_for_timeout(150); check(not p.locator('.colour-panel .contrast').is_visible(), 'still failing after use')


@step('5i roles mirror in dark mode; holding the ground toggle previews the other ground')
def s_5i(app):
    app.start(SQUARE); p = app.page; p.keyboard.press('c'); p.wait_for_timeout(150)
    def corner_pixel():
        b = app.box(); shot = Image.open(io.BytesIO(p.screenshot(clip={'x': b['x'] + b['width'] - 12, 'y': b['y'] + b['height'] - 12, 'width': 4, 'height': 4}))); return shot.getpixel((1, 1))[:3]
    light = corner_pixel(); dark_btn = p.locator('.colour-panel .grounds button[title="Dark ground"], .colour-panel .grounds button[data-tip="Dark ground"]')
    bb = dark_btn.bounding_box(); p.mouse.move(bb['x'] + 5, bb['y'] + 5); p.mouse.down(); p.wait_for_timeout(600)
    held = corner_pixel(); p.mouse.up(); p.wait_for_timeout(200)
    check(sum(held) < sum(light) - 300, f'hold did not preview dark: {light} → {held}')
    check(app.doc()['palette']['dark'] is False, 'hold switched the ground'); check(sum(corner_pixel()) > 600, 'preview did not return')
    dark_btn.click(); p.wait_for_timeout(200); check(app.doc()['palette']['dark'] is True, 'tap did not switch to dark')
    check(sum(corner_pixel()) < 150, 'dark ground not drawn')


@step('5q autofit steps the size down the type scale; a manual size change turns it off')
def s_5q(app):
    app.start(SQUARE); p = app.page; head = find(app.doc(), slot='headline')[0]; app.select(head)
    p.locator('.toolbar button[data-tip="Autofit"], .toolbar button[title="Autofit"]').click()
    check(find(app.doc(), slot='headline')[0].get('fit') is True, 'fit not on')
    size0 = int(p.locator('.toolbar input[aria-label="Font size"]').input_value())
    p.evaluate('document.activeElement.blur()'); p.keyboard.press('Enter'); p.keyboard.press('Control+a'); p.keyboard.type('Annual neighbourhood street festival and night market'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(200)
    size1 = int(p.locator('.toolbar input[aria-label="Font size"]').input_value())
    check(size1 < size0, f'autofit did not step down: {size0} → {size1}')
    p.keyboard.press('Escape'); app.select(find(app.doc(), slot='headline')[0]); p.locator('.toolbar button[aria-label="Larger"]').click()
    check(find(app.doc(), slot='headline')[0].get('fit') is None, 'manual size change kept autofit on')


@step('5r right-to-left text aligns start to the right and keeps its script font')
def s_5r(app):
    app.start(SQUARE); p = app.page; head = find(app.doc(), slot='headline')[0]; app.select(head)
    p.keyboard.press('Enter'); p.keyboard.press('Control+a'); p.keyboard.type('مساحة بين'); p.keyboard.press('Control+Enter'); p.wait_for_timeout(200)
    check(find(app.doc(), slot='headline')[0]['align'] == 'start', 'align is not start')
    svg = app.export('svg').read_text()
    check('direction="rtl"' in svg and 'text-anchor="start"' in svg, 'SVG has no rtl start text')
    check('Noto Sans Arabic' in svg, 'no Arabic fallback stack')
    app.close_panels()


@step('5n a big photo is downscaled to twice the export size and the original kept')
def s_5n(app):
    app.start(SQUARE); p = app.page; d = app.doc(); frame = find(d, slot='image')[0]
    big = image_file(OUT / 'big.png', 6000, 4000)
    drop_file(app, big, 500, 300)
    p.wait_for_function('id => (JSON.parse(localStorage.getItem("kura8:doc")).nodes.find(n => n.id === id) || {}).asset', arg=frame['id'], timeout=20000)
    asset = find(app.doc(), id=frame['id'])[0]['asset']; check(asset, 'drop did not fill the frame')
    info = p.evaluate('''key => new Promise(res => { const r = indexedDB.open("kura8"); r.onsuccess = () => { const g = r.result.transaction("assets").objectStore("assets").get(key); g.onsuccess = () => res({ natural: g.result.natural, work: g.result.work, original: g.result.original.size, working: g.result.working.size }); }; })''', asset)
    check(info['natural'] == {'w': 6000, 'h': 4000}, f'natural {info["natural"]}'); check(info['work'] == {'w': 2160, 'h': 1440}, f'working {info["work"]}')


@step('5p dropping on an image block fills it; elsewhere adds a new image, uncropped, in the nearest cell')
def s_5p(app):
    app.start(SQUARE); d = app.doc(); frame = find(d, slot='image')[0]; small = image_file(OUT / 'small.png', 800, 600, (30, 90, 200))
    drop_file(app, small, 400, 300); d2 = app.doc()
    check(find(d2, id=frame['id'])[0]['asset'], 'frame not filled'); check(len(d2['nodes']) == len(d['nodes']), 'drop on frame added a node')
    drop_file(app, small, 950, 950); d3 = app.doc(); new = [n for n in d3['nodes'] if n['id'] not in {m['id'] for m in d2['nodes']}]
    check(len(new) == 1 and new[0]['kind'] == 'image', 'no new image'); r = app.frame(new[0])
    # D-047: the picture keeps its 4:3 proportions, contained and centred in the bottom-right cell.
    check(abs(r['x'] - 2000 / 3) < .01 and abs(r['w'] - 1000 / 3) < .01 and abs(r['h'] - 250) < .01 and abs(r['y'] - (2000 / 3 + (1000 / 3 - 250) / 2)) < .01, f'not contained in the nearest cell: {r}')


@step('5o remove background adds a Before/After toggle and never replaces the original')
def s_5o(app):
    app.start(SQUARE); p = app.page; frame = find(app.doc(), slot='image')[0]
    photo = Image.new('RGB', (320, 240), (235, 235, 230))
    for x in range(110, 210):
        for y in range(60, 200): photo.putpixel((x, y), (180, 40, 30))
    photo.save(OUT / 'subject.png'); drop_file(app, OUT / 'subject.png', 400, 300)
    app.select(find(app.doc(), id=frame['id'])[0])
    p.locator('.toolbar button[aria-label="Remove background"]').click()
    p.wait_for_function('() => { const d = JSON.parse(localStorage.getItem("kura8:doc")); return d.nodes.some(n => n.kind === "image" && n.cutout); }', timeout=180000)
    n = find(app.doc(), id=frame['id'])[0]; check(n['cutout'] is True, 'cutout not shown')
    toggle = p.locator('.image-bar .cut'); check(toggle.is_visible(), 'no Before/After toggle')
    toggle.locator('button', has_text='Before').click(); check(find(app.doc(), id=frame['id'])[0]['cutout'] is False, 'Before did not show the original')
    toggle.locator('button', has_text='After').click(); check(find(app.doc(), id=frame['id'])[0]['cutout'] is True, 'After')
    rec = p.evaluate('''key => new Promise(res => { const r = indexedDB.open("kura8"); r.onsuccess = () => { const g = r.result.transaction("assets").objectStore("assets").get(key); g.onsuccess = () => res({ original: g.result.original.size, cutout: g.result.cutout && g.result.cutout.size }); }; })''', n['asset'])
    check(rec['original'] > 0 and rec['cutout'] > 0, f'original or cutout missing {rec}')


@step('5s icon search matches synonyms and falls back to the nearest category')
def s_5s(app):
    app.start(SQUARE); p = app.page; p.keyboard.press('s'); p.wait_for_timeout(400)
    search = p.locator('.shapes-panel input'); check(p.locator('.shapes-panel .shape-grid').nth(0).locator('button').count() == 9, 'basic shapes')
    check(p.locator('.shapes-panel .shape-grid button').count() >= 41 + 40, 'library or icon picks missing')
    for q in ['coffee', 'café', 'mug']:
        search.fill(q); p.wait_for_timeout(400)
        check(p.locator('.shapes-panel button[aria-label="Coffee"]').count() == 1, f'{q} did not find coffee')
    search.fill('zzqqxx'); p.wait_for_timeout(400)
    check('Nearest' in p.locator('.shapes-panel h3').last.inner_text(), 'no nearest-category fallback')
    check(p.locator('.shapes-panel .shape-grid').last.locator('button').count() > 0, 'fallback empty')


@step('5t icons are single ink: one fill tap recolours them')
def s_5t(app):
    app.start(SQUARE); p = app.page; p.keyboard.press('s'); p.wait_for_timeout(300)
    p.locator('.shapes-panel input').fill('coffee'); p.wait_for_timeout(400); p.locator('.shapes-panel button[aria-label="Coffee"]').click(); p.wait_for_timeout(300)
    icon = [n for n in app.doc()['nodes'] if n['kind'] == 'shape' and n.get('icon')]
    check(len(icon) == 1 and icon[0]['icon']['licence'] == 'MIT' and icon[0]['icon']['d'].startswith('M'), 'icon node')
    p.keyboard.press('c'); p.locator('.colour-panel .roles button', has_text='Accent').click()
    check(find(app.doc(), id=icon[0]['id'])[0]['fill'] == {'role': 'accent'}, 'icon not recoloured')


@step('5u each icon licence travels into the SVG export metadata')
def s_5u(app):
    app.start(SQUARE); p = app.page; p.keyboard.press('s'); p.wait_for_timeout(300)
    p.locator('.shapes-panel input').fill('rocket'); p.wait_for_timeout(400); p.locator('.shapes-panel button[aria-label="Rocket"]').click(); p.keyboard.press('Escape')
    svg = app.export('svg').read_text(); dom = xml.dom.minidom.parseString(svg)
    icons = dom.getElementsByTagName('icon'); check(icons.length == 1 and icons[0].getAttribute('licence') == 'MIT' and icons[0].getAttribute('name') == 'rocket', 'licence metadata')
    check(dom.documentElement.getAttribute('width') == '1080', 'svg size'); check('@font-face' in svg, 'font not embedded')
    app.close_panels()


@step('shape library: all 41 shapes add as objects')
def s_shapes(app):
    app.start(SQUARE); p = app.page; n0 = len(app.doc()['nodes'])
    p.keyboard.press('s'); p.wait_for_timeout(300)
    for i in range(41):
        p.locator('.shapes-panel .shape-grid').locator('button').nth(i).click()
        if p.locator('.shapes-panel:not([hidden])').count() == 0: p.keyboard.press('s'); p.wait_for_timeout(150)
    d = app.doc(); check(len(d['nodes']) == n0 + 41, f'added {len(d["nodes"]) - n0}')
    check(len({n['shape'] for n in d['nodes'] if n['kind'] == 'shape'}) >= 41, 'distinct shapes')


@step('5v change ratio keeps guide anchors and flags what does not fit instead of cropping')
def s_5v(app):
    app.start({**SQUARE, 'comp': 'split'}); p = app.page; d = app.doc()
    p.locator('.corner .sizes button').first.click(); p.wait_for_timeout(200)
    p.locator('.ratio-panel [aria-label="Change to Story 9:16"]').click(); p.wait_for_timeout(300); d2 = app.doc()
    check(d2['sizes'][0]['ratio'] == 'story', 'ratio not changed')
    img = find(d2, slot='image')[0]; r = app.frame(img)
    check(abs(r['w'] - 1000 / 3) < .5 and abs(r['h'] - 1000 * 16 / 9) < .5, f'image did not keep its anchors: {r}')
    acc = find(d2, slot='accent')[0]; a = app.frame(acc); h = 1000 * 16 / 9
    check(abs(a['y'] - 2 * h / 3) < .5 and abs(a['y'] + a['h'] - h) < .5, f'accent lost the intersection: {a}')
    p.keyboard.press('Escape'); app.select(find(d2, slot='accent')[0], 'main')
    for _ in range(20): p.keyboard.press('Shift+ArrowRight')
    p.keyboard.press('Escape'); p.locator('.corner .sizes button').first.click(); p.locator('.ratio-panel [aria-label="Change to Portrait 4:5"]').click(); p.wait_for_timeout(400)
    check('flagged' in p.locator('.toast').inner_text(), f'no flag toast: {p.locator(".toast").inner_text()}')
    a2 = app.frame(find(app.doc(), slot='accent')[0]); check(a2['x'] + a2['w'] > 1000, f'off-canvas block was cropped or moved in: {a2}')


@step('5w linked sizes: text and colour carry across, positions stay local')
def s_5w(app):
    app.start(SQUARE); p = app.page
    p.locator('.corner button[aria-label="Add a linked size"]').click(); p.locator('.ratio-panel [aria-label="Add Story 9:16"]').click(); p.wait_for_timeout(300)
    d = app.doc(); check(len(d['sizes']) == 2 and d['sizes'][1]['ratio'] == 'story', 'size not added'); s2 = d['sizes'][1]['id']
    head = find(d, slot='headline')[0]; app.select(head, s2); p.keyboard.press('Enter'); p.keyboard.press('Control+a'); p.keyboard.type('Linked'); p.keyboard.press('Control+Enter')
    acc = find(app.doc(), slot='accent')[0]; app.select(acc, s2); p.keyboard.press('ArrowRight')
    d2 = app.doc(); check(find(d2, slot='headline')[0]['text'] == 'Linked', 'text not shared')
    a = find(d2, slot='accent')[0]; check(a['frames'][s2]['rect']['x'] == acc['frames'][s2]['rect']['x'] + 1 and a['frames']['main']['rect']['x'] == acc['frames']['main']['rect']['x'], 'position not local')
    p.keyboard.press('Escape'); p.locator('.corner .sizes button').first.click(); p.wait_for_timeout(150)
    check(p.locator('.corner .sizes button[aria-pressed="true"]').inner_text().strip().endswith('1:1'), 'did not switch size')
    p.locator('.corner .sizes button[aria-pressed="true"]').click(); p.locator('.ratio-panel button', has_text='Remove size').click(); p.wait_for_timeout(200)
    check(len(app.doc()['sizes']) == 1, 'size not removed')
@step('5x export size follows the ratio: print sizes default to 300 dpi, PDF page is A4')
def s_5x(app):
    app.start({**SQUARE, 'ratio': 'a4'}); p = app.page; p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    check(p.locator('.sheet .seg[aria-label="Size"] button[aria-pressed="true"]').inner_text() == '300 dpi', 'A4 does not default to 300 dpi')
    check(p.locator('.sheet .seg[aria-label="Size"] button', has_text='3×').is_disabled(), '3× over the pixel limit is enabled')
    png = app.export('png'); check(Image.open(png).size == (2480, 3508), f'A4 PNG {Image.open(png).size}')
    pdf = app.export('pdf').read_bytes(); check(pdf.startswith(b'%PDF-1.4') and b'/MediaBox [0 0 595.28 841.89]' in pdf and pdf.rstrip().endswith(b'%%EOF'), 'PDF header or page size')
    check(b'/Width 2480 /Height 3508' in pdf, 'PDF image size')
    jpg = app.export('jpg'); check(Image.open(jpg).format == 'JPEG' and Image.open(jpg).size == (2480, 3508), 'JPG')
    app.close_panels()


@step('exports open at exact sizes for every ratio')
def s_sizes(app):
    bad = []
    for ratio in RATIOS:
        app.start({**SQUARE, 'ratio': ratio}); size = Image.open(app.export('png', '1×')).size
        if size != EXPORT[ratio]: bad.append(f'{ratio} {size}')
        app.close_panels()
    app.start({**SQUARE, 'ratio': 'landscape'}); size = Image.open(app.export('png', '2×')).size; app.close_panels()
    check(size == (3840, 2160), f'landscape 2× {size}'); check(not bad, '; '.join(bad))


@step('5y hidden objects stay out of exports and the sheet says how many')
def s_5y(app):
    app.start(SQUARE); p = app.page; d = app.doc(); acc = find(d, slot='accent')[0]
    p.locator('button[aria-label="Layers"]').click(); p.locator('.layer', has_text='Rectangle').locator('button[aria-label="Hide"]').click(); p.keyboard.press('Escape')
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    notes = p.locator('.sheet .notes').inner_text(); check('1 hidden object not included' in notes, f'notes: {notes}')
    check('1 empty image frame not included' in notes, f'empty frame note: {notes}')
    png = Image.open(app.export('png')).convert('RGB'); r = app.frame(acc); k = 1080 / 1000
    px = png.getpixel((int((r['x'] + r['w'] / 2) * k), int((r['y'] + r['h'] / 2) * k)))
    ground = png.getpixel((1075, 1075)); check(px == ground, f'hidden accent exported: {px} vs ground {ground}')
    app.close_panels()


@step('5z PNG offers No ground, also over a painted ground (D-050), with real transparency')
def s_5z(app):
    app.start(SQUARE); p = app.page; p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300)
    p.locator('.sheet .seg[aria-label="Format"] button', has_text='PNG').click()
    check(p.locator('.sheet button[aria-label="No ground"]').is_visible(), 'No ground not offered')
    img = Image.open(app.export('png', '1×', no_ground=True)); check(img.mode == 'RGBA' and img.getpixel((1075, 1075))[3] == 0, f'not transparent: {img.mode} {img.getpixel((1075, 1075))}')
    check(img.getpixel((180, 139))[3] == 255, 'content lost')
    p.locator('.sheet .seg[aria-label="Format"] button', has_text='JPG').click(); p.wait_for_timeout(200); check(not p.locator('.sheet button[aria-label="No ground"]').is_visible(), 'No ground offered for JPG')
    app.close_panels(); p.keyboard.press('c'); p.locator('.colour-panel .shades button').nth(2).click(); app.click_unit(990, 990); p.keyboard.press('Escape'); p.keyboard.press('Escape')
    p.keyboard.press('Control+Shift+E'); p.wait_for_timeout(300); p.locator('.sheet .seg[aria-label="Format"] button', has_text='PNG').click(); p.wait_for_timeout(200)
    check(p.locator('.sheet button[aria-label="No ground"]').is_visible(), 'No ground not offered after filling the ground')
    app.close_panels(); img = Image.open(app.export('png', '1×', no_ground=True)); check(img.getpixel((1075, 1075))[3] == 0, 'painted ground not left out')


@step('sketch: pen hold-to-clean makes a rectangle, plain strokes stay ink, scribble deletes, eraser, lasso')
def s_sketch(app):
    app.start({**SQUARE, 'comp': 'band'}); p = app.page; n0 = len(app.doc()['nodes'])
    def stroke(points, hold=0, steps=12, wobble=0):
        p.mouse.move(*app.to_px(*points[0])); p.mouse.down()
        for (ax, ay), (bx, by) in zip(points, points[1:]):
            for i in range(1, steps + 1):
                w = (wobble if i % 2 else -wobble)
                p.mouse.move(*app.to_px(ax + (bx - ax) * i / steps + w * (ay == by and 0 or 1), ay + (by - ay) * i / steps + w * (ax == bx and 0 or 1)))
        if hold: p.wait_for_timeout(hold)
        p.mouse.up(); p.wait_for_timeout(500)
    p.keyboard.press('p'); p.wait_for_timeout(150)
    stroke([(60, 30), (400, 30), (400, 220), (60, 220), (60, 34)], hold=700)
    ink = [n for n in app.doc()['nodes'] if n['kind'] == 'ink']; check(len(ink) == 1 and ink[0].get('form') == 'rect', f'hold-to-clean: {[n.get("form") for n in ink]}')
    stroke([(60, 600), (150, 640), (300, 610)], steps=8)
    ink = [n for n in app.doc()['nodes'] if n['kind'] == 'ink']; check(len(ink) == 2 and not ink[1].get('form'), 'freehand stroke not kept as plain ink')
    p.keyboard.press('e'); p.wait_for_timeout(100); stroke([(150, 580), (150, 680)], steps=10)
    check(len([n for n in app.doc()['nodes'] if n['kind'] == 'ink']) == 1, 'eraser did not remove the stroke')
    p.keyboard.press('l'); p.wait_for_timeout(100); stroke([(40, 12), (430, 12), (430, 240), (40, 240), (40, 20)], steps=8)
    check('Rectangle' in p.locator('.info').inner_text(), f'lasso selection: {p.locator(".info").inner_text()}')
    p.keyboard.press('p'); p.wait_for_timeout(100)
    stroke([(70 + (i % 2) * 320, 40 + i * 17) for i in range(11)], steps=6)
    check(not [n for n in app.doc()['nodes'] if n['kind'] == 'ink'], 'scribble did not delete the rectangle')
    check(len(app.doc()['nodes']) == n0, 'scribble deleted too much')
    p.keyboard.press('Escape')


@step('sketch: circles, lines, a wave becomes a text line, a crossed rectangle becomes an image frame')
def s_sketch_forms(app):
    import math
    app.start({**SQUARE, 'comp': 'band'}); p = app.page; base = {n['id'] for n in app.doc()['nodes']}
    def stroke(points, hold=700):
        p.mouse.move(*app.to_px(*points[0])); p.mouse.down()
        for q in points[1:]: p.mouse.move(*app.to_px(*q))
        if hold: p.wait_for_timeout(hold)
        p.mouse.up(); p.wait_for_timeout(600)
    def new_nodes(): return [n for n in app.doc()['nodes'] if n['id'] not in base]
    p.keyboard.press('p'); p.wait_for_timeout(100)
    stroke([(200 + 120 * math.cos(t / 40 * 2 * math.pi), 130 + 80 * math.sin(t / 40 * 2 * math.pi)) for t in range(42)])
    check(new_nodes()[-1].get('form') == 'ellipse', f'ellipse: {new_nodes()[-1].get("form")}')
    stroke([(60 + i * 12, 300 + (i % 2) * 1.5) for i in range(30)])
    check(new_nodes()[-1].get('form') == 'line', f'line: {new_nodes()[-1].get("form")}')
    wave = [(60 + i * 8, 560 + 14 * math.sin(i / 3)) for i in range(60)]
    stroke(wave)
    texts = [n for n in new_nodes() if n['kind'] == 'text']; check(len(texts) == 1, f'wave did not become a text line: {[n["kind"] for n in new_nodes()]}')
    rect = [(80, 640), (380, 640), (380, 860), (80, 860), (80, 644)]
    pts = []
    for (ax, ay), (bx, by) in zip(rect, rect[1:]): pts += [(ax + (bx - ax) * i / 12, ay + (by - ay) * i / 12) for i in range(12)]
    stroke(pts)
    r = [n for n in new_nodes() if n.get('form') == 'rect']; check(len(r) == 1, 'rectangle not recognised'); rr = app.frame(r[0])
    stroke([(rr['x'] + 2 + (rr['w'] - 4) * i / 20, rr['y'] + 2 + (rr['h'] - 4) * i / 20) for i in range(21)])
    stroke([(rr['x'] + rr['w'] - 2 - (rr['w'] - 4) * i / 20, rr['y'] + 2 + (rr['h'] - 4) * i / 20) for i in range(21)])
    frames = [n for n in new_nodes() if n['kind'] == 'image']; check(len(frames) == 1 and frames[0]['asset'] is None, f'crossed rectangle: {[n.get("form") or n["kind"] for n in new_nodes()]}')
    check(not [n for n in new_nodes() if n.get('form') == 'rect'], 'rectangle not replaced')
    p.keyboard.press('Escape')


@step('text: corner handles scale the font, side handles rewrap')
def s_text_resize(app):
    app.start(SQUARE); p = app.page; head = find(app.doc(), slot='headline')[0]; app.select(head)
    f = head['frames']['main']; r = f['rect']
    app.drag_unit((r['x'] + r['w'], r['y'] + r['h'] / 2), (r['x'] + r['w'] - 300, r['y'] + r['h'] / 2), alt=True)
    h2 = find(app.doc(), slot='headline')[0]['frames']['main']; check(abs(h2['rect']['w'] - (r['w'] - 300)) < 1.5 and h2['fontSize'] == f['fontSize'], f'e handle: {h2}')
    r2 = h2['rect']; app.drag_unit((r2['x'] + r2['w'], r2['y'] + r2['h']), (r2['x'] + r2['w'] * 1.5, r2['y'] + r2['h'] * 1.5), alt=True)
    h3 = find(app.doc(), slot='headline')[0]['frames']['main']; check(h3['fontSize'] > f['fontSize'] * 1.3, f'corner did not scale the font: {h3}')


@step('text controls: bold, align start/centre/end, smaller and larger')
def s_text_controls(app):
    app.start(SQUARE); p = app.page; head = find(app.doc(), slot='headline')[0]; app.select(head)
    p.keyboard.press('Control+b'); check(find(app.doc(), slot='headline')[0]['weight'] == 400, 'bold off')
    p.keyboard.press('Control+b'); check(find(app.doc(), slot='headline')[0]['weight'] == 700, 'bold on')
    align = p.locator('.toolbar button[aria-label="Text align"]')
    seen = []
    for _ in range(3): align.click(); seen.append(find(app.doc(), slot='headline')[0]['align'])
    check(seen == ['center', 'end', 'start'], f'align cycle {seen}')
    size = head['frames']['main']['fontSize']; p.locator('.toolbar button[aria-label="Smaller"]').click()
    check(find(app.doc(), slot='headline')[0]['frames']['main']['fontSize'] < size, 'smaller')
    p.locator('.toolbar button[aria-label="Larger"]').click(); p.locator('.toolbar button[aria-label="Larger"]').click()
    check(find(app.doc(), slot='headline')[0]['frames']['main']['fontSize'] > size, 'larger')


@step('help bar is off by default and explains the hovered control when on')
def s_help(app):
    app.start(SQUARE); p = app.page
    check(not p.locator('.help-box').is_visible() or p.locator('.help-box').evaluate('e => getComputedStyle(e).opacity') == '0', 'help bar on by default')
    p.locator('.help > button').click(); p.locator('.toolbar button[aria-label="Text"]').hover(); p.wait_for_timeout(250)
    check('Adds a text box' in p.locator('.help-box').inner_text(), f'help: {p.locator(".help-box").inner_text()}')
    p.locator('.help > button').click()


@step('reload restores the document and its images')
def s_reload(app):
    app.start(SQUARE); p = app.page; frame = find(app.doc(), slot='image')[0]
    drop_file(app, image_file(OUT / 'reload.png', 900, 700, (20, 160, 60)), 400, 300); before = app.doc()
    p.reload(); p.wait_for_timeout(1500)
    check(app.doc() == before, 'document changed on reload'); check(p.locator('canvas.overlay').is_visible(), 'editor not restored')
    b = app.box(); x, y = app.to_px(500, 330)
    shot = Image.open(io.BytesIO(p.screenshot(clip={'x': x - 2, 'y': y - 2, 'width': 4, 'height': 4}))).getpixel((1, 1))
    check(shot[1] > 120 and shot[0] < 90, f'image not drawn after reload: {shot}')
    check(find(app.doc(), id=frame['id'])[0]['asset'], 'asset lost')


@step('version 1 documents migrate with their images')
def s_migrate(app):
    p = app.page; app.reset()
    png = 'data:image/png;base64,' + __import__('base64').b64encode((OUT / 'small.png').read_bytes()).decode()
    v1 = {'version': 1, 'id': 'ab12', 'ratio': 'square', 'guide': 'thirds', 'createdAt': '2026-09-14T00:00:00.000Z', 'nodes': [
        {'id': 'r', 'type': 'rect', 'rect': {'x': 10, 'y': 10, 'w': 200, 'h': 100}, 'fill': '#AA0000', 'shape': 'star'},
        {'id': 'i', 'type': 'image', 'rect': {'x': 400, 'y': 400, 'w': 300, 'h': 225}, 'src': png, 'naturalSize': {'w': 800, 'h': 600}}]}
    p.evaluate(f'localStorage.setItem("kura8:doc", {json.dumps(json.dumps(v1))}); localStorage.setItem("kura8:lifted", "true")'); p.goto(BASE); p.wait_for_timeout(1500)
    d = app.doc(); check(d['version'] == 2 and d['nodes'][0]['shape'] == 'star5' and d['nodes'][1]['asset'] == 'v1-i', f'migration {d["nodes"]}')
    has = p.evaluate('() => new Promise(res => { const r = indexedDB.open("kura8"); r.onsuccess = () => { const g = r.result.transaction("assets").objectStore("assets").get("v1-i"); g.onsuccess = () => res(!!g.result); }; })')
    check(has, 'v1 image not stored')


def main():
    steps = [s_load, s_5a, s_dial_keys, s_dial_drag, s_5b, s_5c, s_5d, s_tool_keys, s_select_move, s_5j, s_5k, s_5l, s_5m, s_edit_ops, s_layers, s_5e, s_5f,
             s_5g, s_5h, s_5i, s_5q, s_5r, s_5n, s_5p, s_5s, s_5t, s_5u, s_shapes, s_5v, s_5w, s_5x, s_sizes, s_5y, s_5z, s_sketch, s_sketch_forms, s_text_resize, s_text_controls, s_help, s_reload, s_migrate, s_matrix, s_5o]
    only = os.environ.get('ONLY')
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM') or next((str(x) for x in Path('/opt/pw-browsers').glob('chromium-*/chrome-linux/chrome')), None)
        browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
        app = App(browser)
        for s in steps:
            if only and only not in s.__name__: continue
            s(app)
        browser.close()
    failed = [r for r in results if r[1] != 'pass']
    print(f'\n{len(results) - len(failed)}/{len(results)} steps passed')
    if errors: print('console errors:', *errors[:20], sep='\n  ')
    if offorigin: print('off-origin requests:', *sorted(set(offorigin))[:20], sep='\n  ')
    (OUT / 'report.json').write_text(json.dumps({'results': results, 'errors': errors, 'offorigin': sorted(set(offorigin))}, indent=1))
    sys.exit(1 if failed or errors or offorigin else 0)


if __name__ == '__main__':
    main()
