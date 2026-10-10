"""Canva parity audit: one named step per common Canva photo-editing or graphic-design task (docs/canva-parity.md).

Run `npm run build`, start `npm run preview -- --port 4173`, then `python3 scripts/canva_audit.py [base-url]`.
Reuses the Phase 1 audit's browser harness (fresh Chromium context, fails on app console errors and off-origin
requests). `ONLY=<step function name>` runs one step. Evidence goes to ignored private/canva-audit/.
"""
import json, math, os, sys, xml.dom.minidom
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import browser_audit as ba
from browser_audit import App, check, find, step

OUT = ba.OUT = Path(__file__).resolve().parent.parent / 'private' / 'canva-audit'
OUT.mkdir(parents=True, exist_ok=True)
SPLIT = {'ratio': 'square', 'comp': 'split', 'guide': 'thirds', 'hue': 210, 'dark': False}
POSTER = {'ratio': 'square', 'comp': 'poster', 'guide': 'thirds', 'hue': 210, 'dark': False}
RED, BLUE = (190, 80, 50), (50, 90, 180)


def test_photo(name='photo.png', size=(800, 1000)):
    """Left half warm red, right half blue, bottom fifth in 4 px grey stripes (for blur and sharpen)."""
    w, h = size; img = Image.new('RGB', size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            if y > h * .8: px[x, y] = (40, 40, 40) if (x // 4) % 2 else (215, 215, 215)
            else: px[x, y] = RED if x < w // 2 else BLUE
    path = OUT / name; img.save(path); return path


def plain(name, colour, size=(400, 300)):
    path = OUT / name; Image.new('RGB', size, colour).save(path); return path


def drop_files(app, paths, x, y):
    data = [[list(Path(p).read_bytes()), Path(p).name] for p in paths]
    px, py = app.to_px(x, y)
    app.page.evaluate('''([files, x, y]) => {
      const dt = new DataTransfer(); for (const [data, name] of files) dt.items.add(new File([new Uint8Array(data)], name, { type: 'image/png' }));
      const target = document.elementFromPoint(x, y) || document.body;
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
    }''', [data, px, py])
    app.page.wait_for_timeout(1500)


def pixel(app, x, y):
    """Document-canvas pixel at unit coordinates, after the next frames have drawn."""
    app.page.wait_for_timeout(250)
    return tuple(app.page.evaluate('''([x, y]) => { const c = document.querySelector('canvas.doc'), k = c.width / 1000;
      return Array.from(c.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data); }''', [x, y]))


def row(app, x0, x1, y, n=40):
    return [pixel_fast(app, x0 + (x1 - x0) * i / (n - 1), y) for i in range(n)]


def pixel_fast(app, x, y):
    return tuple(app.page.evaluate('''([x, y]) => { const c = document.querySelector('canvas.doc'), k = c.width / 1000;
      return Array.from(c.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data); }''', [x, y]))


def std(values):
    m = sum(values) / len(values); return math.sqrt(sum((v - m) ** 2 for v in values) / len(values))


def near(a, b, tol=12):
    return all(abs(x - y) <= tol for x, y in zip(a[:3], b[:3]))


def photo(app, dial=SPLIT):
    """Start a split layout and drop the test photo into its image slot (left third)."""
    app.start(dial); frame = find(app.doc(), slot='image')[0]
    ba.drop_file(app, test_photo(), 166, 500)
    app.page.wait_for_function('id => (JSON.parse(localStorage.getItem("kura8:doc")).nodes.find(n => n.id === id) || {}).asset', arg=frame['id'], timeout=20000)
    app.click_unit(166, 400); app.page.wait_for_timeout(100)
    return frame['id']


def node(app, id):
    return find(app.doc(), id=id)[0]


def tool(app, label):
    app.page.locator(f'.toolbar button[aria-label="{label}"]').first.click(); app.page.wait_for_timeout(200)


def press(app, label, scope=''):
    app.page.locator(f'{scope} button[aria-label="{label}"]'.strip()).first.click(); app.page.wait_for_timeout(150)


def slide(app, label, value):
    el = app.page.locator(f'input[type=range][aria-label="{label}"]').first
    check(el.count() == 1, f'no {label} slider')
    el.evaluate('(e, v) => { e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }', value)
    app.page.wait_for_timeout(250)


def adjust(app, id):
    return node(app, id).get('adjust') or {}


def image_panel(app):
    if app.page.locator('.image-panel:not([hidden])').count() == 0: tool(app, 'Edit image')
    check(app.page.locator('.image-panel:not([hidden])').count() == 1, 'no Edit image panel')


def effects_panel(app):
    if app.page.locator('.effects-panel:not([hidden])').count() == 0: tool(app, 'Effects')
    check(app.page.locator('.effects-panel:not([hidden])').count() == 1, 'no Effects panel')


# ------------------------------------------------------------------------------------------------- photo editing
@step('P01 upload a photo from the computer into a frame')
def p01_upload(app):
    app.start(SPLIT); p = app.page; frame = find(app.doc(), slot='image')[0]
    app.click_unit(166, 400); p.wait_for_timeout(300)
    with p.expect_file_chooser() as fc: p.keyboard.press('i')
    fc.value.set_files(str(test_photo())); p.wait_for_timeout(1500)
    check(node(app, frame['id'])['asset'], 'picked photo did not fill the frame')


@step('P02 drag a new photo onto a placed photo to replace it')
def p02_replace(app):
    id = photo(app); a0 = node(app, id)['asset']; n0 = len(app.doc()['nodes'])
    ba.drop_file(app, plain('green.png', (40, 160, 70)), 166, 500)
    d = app.doc(); check(find(d, id=id)[0]['asset'] != a0 and len(d['nodes']) == n0, 'drop did not replace the photo')
    check(near(pixel(app, 166, 400), (40, 160, 70)), 'replacement not drawn')


@step('P03 crop a photo by dragging the frame edge in crop mode; the picture stays put')
def p03_crop(app):
    id = photo(app); p = app.page; before = pixel(app, 100, 300)
    app.page.mouse.dblclick(*app.to_px(166, 400)); p.wait_for_timeout(200)
    check(p.locator('.crop-bar:not(.hidden)').count() == 1, 'double-click did not enter crop mode')
    app.drag_unit((1000 / 3, 500), (250, 500))
    press(app, 'Done cropping')
    n = node(app, id); r = n['frames']['main']['rect']
    check(abs(r['w'] - 250) < 2 and abs(r['x']) < .5, f'frame not cropped: {r}')
    check(near(pixel(app, 100, 300), before, 8), 'the picture moved while cropping')
    check(n.get('zoom', 1) >= 1 and 'focus' in n, f'crop not stored as focus and zoom: {n}')


@step('P04 reposition and zoom the photo inside its frame')
def p04_pan_zoom(app):
    id = photo(app); p = app.page
    app.page.mouse.dblclick(*app.to_px(166, 400)); p.wait_for_timeout(200)
    f0 = node(app, id).get('focus', {'x': .5, 'y': .5}); left = pixel(app, 200, 300)
    app.drag_unit((166, 400), (226, 400))
    check(not near(pixel(app, 200, 300), left, 10), 'pan did not move the picture')
    slide(app, 'Zoom', 2)
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    check(p.locator('.crop-bar:not(.hidden)').count() == 0, 'Escape did not leave crop mode')
    n = node(app, id); check(n.get('focus') and n['focus']['x'] < f0['x'] - .02, f'pan not stored: {f0} → {n.get("focus")}')
    check(abs(n.get('zoom', 1) - 2) < .01, f'zoom {n.get("zoom")}')
    p.keyboard.press('Control+z'); check(node(app, id).get('zoom', 1) == 1 and node(app, id).get('focus', f0) == f0, 'one undo did not revert the crop session')


@step('P05 flip a photo horizontally and vertically')
def p05_flip(app):
    id = photo(app); left = pixel(app, 40, 300)
    image_panel(app); press(app, 'Flip horizontal', '.image-panel')
    check(node(app, id).get('flipX') is True, 'flipX not set'); check(not near(pixel(app, 40, 300), left), 'picture did not mirror')
    press(app, 'Flip vertical', '.image-panel'); check(node(app, id).get('flipY') is True, 'flipY not set')


@step('P06 rotate or straighten a photo')
def p06_rotate(app):
    # The photo touches the top edge, so its rotate knob sits below it, clear of the toolbar.
    id = photo(app); r = node(app, id)['frames']['main']['rect']; k = app.scale()
    cx, knob = r['x'] + r['w'] / 2, r['y'] + r['h'] + 44 / k; app.drag_unit((cx, knob), (cx + 160, knob - 10), alt=True)
    check(abs(node(app, id)['frames']['main']['rot']) > 5, 'no rotation')


@step('P07 adjust brightness and contrast')
def p07_brightness(app):
    id = photo(app); before = pixel(app, 40, 300); image_panel(app)
    slide(app, 'Brightness', 50); a = adjust(app, id); check(a.get('brightness') == 50, f'brightness {a}')
    after = pixel(app, 40, 300); check(sum(after[:3]) > sum(before[:3]) + 40, f'not brighter {before} → {after}')
    slide(app, 'Contrast', 60); check(adjust(app, id).get('contrast') == 60, 'contrast not stored')


@step('P08 desaturate to black and white or boost saturation')
def p08_saturation(app):
    id = photo(app); image_panel(app); slide(app, 'Saturation', -100)
    c = pixel(app, 40, 300); check(max(c[:3]) - min(c[:3]) < 8, f'not grey: {c}')
    slide(app, 'Saturation', 60); c2 = pixel(app, 40, 300); check(c2[0] - c2[2] > RED[0] - RED[2], f'not more saturated: {c2}')


@step('P09 warm up or cool down a photo (warmth and tint)')
def p09_warmth(app):
    id = photo(app); before = pixel(app, 250, 300); image_panel(app)
    slide(app, 'Warmth', 70); after = pixel(app, 250, 300)
    check(after[0] > before[0] and after[2] < before[2], f'not warmer {before} → {after}')
    slide(app, 'Tint', 50); check(adjust(app, id).get('tint') == 50, 'tint not stored')


@step('P10 blur a photo')
def p10_blur(app):
    id = photo(app); y = 950; s0 = std([sum(c[:3]) for c in row(app, 20, 300, y)])
    image_panel(app); slide(app, 'Blur', 80); app.page.wait_for_timeout(400)
    s1 = std([sum(c[:3]) for c in row(app, 20, 300, y)]); check(s1 < s0 * .6, f'stripes not blurred: {s0:.0f} → {s1:.0f}')


@step('P11 sharpen a photo')
def p11_sharpen(app):
    id = photo(app); image_panel(app); slide(app, 'Blur', 30); app.page.wait_for_timeout(300)
    s0 = std([sum(c[:3]) for c in row(app, 20, 300, 950)])
    slide(app, 'Sharpen', 100); app.page.wait_for_timeout(400)
    s1 = std([sum(c[:3]) for c in row(app, 20, 300, 950)]); check(adjust(app, id).get('sharpen') == 100 and s1 > s0 * 1.1, f'not sharper: {s0:.0f} → {s1:.0f}')


@step('P12 add a vignette')
def p12_vignette(app):
    id = photo(app); corner, mid = pixel(app, 8, 8), pixel(app, 166, 500); image_panel(app)
    slide(app, 'Vignette', 100); c2, m2 = pixel(app, 8, 8), pixel(app, 166, 500)
    check(sum(c2[:3]) < sum(corner[:3]) - 60, f'corner not darker {corner} → {c2}'); check(near(m2, mid, 20), f'centre changed {mid} → {m2}')


@step('P13 apply a one-tap filter')
def p13_filter(app):
    id = photo(app); image_panel(app)
    check(app.page.locator('.image-panel .filters button').count() >= 6, 'fewer than six filters')
    app.page.locator('.image-panel .filters button[aria-label="Mono"]').click(); app.page.wait_for_timeout(300)
    check(adjust(app, id).get('saturation') == -100, f'Mono did not desaturate: {adjust(app, id)}')
    c = pixel(app, 40, 300); check(max(c[:3]) - min(c[:3]) < 8, f'Mono not grey: {c}')
    app.page.locator('.image-panel .filters button[aria-label="None"]').click(); app.page.wait_for_timeout(200)
    check(not adjust(app, id), 'None did not clear the filter')


@step('P14 duotone a photo in palette colours')
def p14_duotone(app):
    id = photo(app); image_panel(app)
    app.page.locator('.image-panel .duotones button').nth(1).click(); app.page.wait_for_timeout(300)
    n = node(app, id); check(n.get('duotone') and 'dark' in n['duotone'] and 'light' in n['duotone'], f'no duotone: {n.get("duotone")}')
    check(not near(pixel(app, 40, 300), RED, 20), 'duotone not drawn')


@step('P15 make a photo or element see-through (transparency)')
def p15_opacity(app):
    id = photo(app); ground = pixel(app, 500, 990); effects_panel(app)
    slide(app, 'Opacity', 40); n = node(app, id); check(abs(n.get('opacity', 1) - .4) < .01, f'opacity {n.get("opacity")}')
    c = pixel(app, 40, 300); expect = [RED[i] * .4 + ground[i] * .6 for i in range(3)]
    check(all(abs(c[i] - expect[i]) < 14 for i in range(3)), f'not blended: {c} vs {expect}')


@step('P16 remove the background on this computer')
def p16_remove_bg(app):
    app.start(SPLIT); p = app.page; frame = find(app.doc(), slot='image')[0]
    subject = Image.new('RGB', (320, 480), (235, 235, 230))
    for x in range(90, 230):
        for y in range(120, 380): subject.putpixel((x, y), (180, 40, 30))
    subject.save(OUT / 'subject.png'); ba.drop_file(app, OUT / 'subject.png', 166, 500); app.click_unit(166, 400)
    p.locator('.toolbar button[aria-label="Remove background"]').click()
    p.wait_for_function('() => JSON.parse(localStorage.getItem("kura8:doc")).nodes.some(n => n.kind === "image" && n.cutout)', timeout=180000)
    check(node(app, frame['id'])['cutout'] is True, 'no cut-out')


@step('P17 put a photo in a shape frame (circle, heart, rounded corners)')
def p17_mask(app):
    id = photo(app); ground = pixel(app, 3, 3); image_panel(app)
    check(app.page.locator('.image-panel .masks button').count() >= 6, 'fewer than six shape frames')
    app.page.locator('.image-panel .masks button[aria-label="Circle"]').click(); app.page.wait_for_timeout(200)
    check(node(app, id).get('mask') == 'circle', 'mask not stored')
    check(not near(pixel(app, 3, 3), RED, 30), 'corner still shows the photo'); check(near(pixel(app, 100, 500), RED, 20), 'centre lost')
    app.page.locator('.image-panel .masks button[aria-label="Rounded"]').click(); check(node(app, id).get('mask') == 'rounded', 'rounded')


@step('P18 add a border around a photo')
def p18_border(app):
    id = photo(app); effects_panel(app); press(app, 'Border', '.effects-panel')
    n = node(app, id); check(n.get('outline') and n['outline']['width'] > 0, f'no outline: {n.get("outline")}')
    slide(app, 'Border width', 12); check(abs(node(app, id)['outline']['width'] - 12) < .01, 'border width')
    check(not near(pixel(app, 2, 500), RED, 30), 'border not drawn at the edge')


@step('P19 add a drop shadow')
def p19_shadow(app):
    id = photo(app); out = pixel(app, 1000 / 3 + 6, 980); effects_panel(app); press(app, 'Shadow', '.effects-panel')
    n = node(app, id); check(n.get('shadow') and n['shadow']['blur'] >= 0, f'no shadow: {n.get("shadow")}')
    c = pixel(app, 1000 / 3 + 6, 980); check(sum(c[:3]) < sum(out[:3]) - 15, f'no shadow beside the photo {out} → {c}')


@step('P20 set a photo as the page background')
def p20_background(app):
    id = photo(app); image_panel(app); press(app, 'Fill page', '.image-panel')
    d = app.doc(); r = find(d, id=id)[0]['frames']['main']['rect']
    check(abs(r['x']) < .01 and abs(r['y']) < .01 and abs(r['w'] - 1000) < .01 and abs(r['h'] - 1000) < .01, f'not full page: {r}')
    check(d['nodes'][0]['id'] == id, 'photo not sent to the back')


@step('P21 drop several photos at once into a grid of cells (collage)')
def p21_collage(app):
    app.start(POSTER); n0 = {n['id'] for n in app.doc()['nodes']}
    drop_files(app, [plain('a.png', (200, 40, 40)), plain('b.png', (40, 200, 40)), plain('c.png', (40, 40, 200))], 166, 166)
    new = [n for n in app.doc()['nodes'] if n['id'] not in n0]
    check(len(new) == 3 and all(n['kind'] == 'image' for n in new), f'{len(new)} images')
    rects = [n['frames']['main']['rect'] for n in new]
    def overlap(a, b): return max(0, min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x'])) * max(0, min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y']))
    worst = max(overlap(a, b) / min(a['w'] * a['h'], b['w'] * b['h']) for i, a in enumerate(rects) for b in rects[i + 1:])
    check(worst < .05, f'photos stacked instead of filling separate cells: {rects}')


# ---------------------------------------------------------------------------------------------- graphic design
@step('G01 start from a ready layout (Kura8: dial layouts, not templates)')
def g01_layout(app):
    app.start(SPLIT); d = app.doc(); check(sorted(n.get('slot') for n in d['nodes']) == ['accent', 'body', 'headline', 'image'], 'no layout')


@step('G02 resize a design for another format')
def g02_resize(app):
    app.start(SPLIT); p = app.page; p.locator('.corner .sizes button').first.click(); p.wait_for_timeout(200)
    p.locator('.ratio-panel [aria-label="Change to Story 9:16"]').click(); p.wait_for_timeout(300)
    check(app.doc()['sizes'][0]['ratio'] == 'story', 'ratio not changed')


@step('G03 add and edit text')
def g03_text(app):
    app.start(SPLIT); p = app.page; p.keyboard.press('t'); p.wait_for_timeout(200); p.keyboard.type('Grand opening'); p.keyboard.press('Control+Enter')
    check(find(app.doc(), text='Grand opening'), 'text missing')


def headline(app):
    h = find(app.doc(), slot='headline')[0]; r = h['frames']['main']['rect']; app.click_unit(r['x'] + 20, r['y'] + 20); app.page.wait_for_timeout(100); return h['id']


def font_panel(app):
    if app.page.locator('.font-panel:not([hidden])').count() == 0: tool(app, 'Font')
    check(app.page.locator('.font-panel:not([hidden])').count() == 1, 'no Font panel')


@step('G04 change the font')
def g04_font(app):
    app.start(SPLIT); id = headline(app); font_panel(app)
    check(app.page.locator('.font-panel .fonts button').count() >= 6, 'fewer than six fonts')
    w0 = app.page.evaluate('() => document.querySelector("canvas.doc").toDataURL().length')
    app.page.locator('.font-panel .fonts button[aria-label="Playfair Display"]').click(); app.page.wait_for_timeout(600)
    check(node(app, id).get('font') == 'playfair-display', f'font {node(app, id).get("font")}')
    check(app.page.evaluate('() => document.fonts.check(\'700 40px "Playfair Display"\')'), 'font face not loaded from the origin')
    check(app.page.evaluate('() => document.querySelector("canvas.doc").toDataURL().length') != w0, 'canvas not redrawn')


@step('G05 change text size, weight and alignment')
def g05_size(app):
    app.start(SPLIT); p = app.page; id = headline(app); s0 = node(app, id)['frames']['main']['fontSize']
    p.locator('.toolbar button[aria-label="Larger"]').click(); p.locator('.toolbar button[aria-label="Bold"]').click(); p.locator('.toolbar button[aria-label="Align"]').click()
    n = node(app, id); check(n['frames']['main']['fontSize'] > s0 and n['weight'] == 400 and n['align'] == 'center', f'{n}')


@step('G06 italic, underline and uppercase')
def g06_style(app):
    app.start(SPLIT); id = headline(app); font_panel(app)
    for label in ['Italic', 'Underline', 'Uppercase']: press(app, label, '.font-panel')
    n = node(app, id); check(n.get('italic') is True and n.get('underline') is True and n.get('upper') is True, f'{n}')


@step('G07 letter spacing and line spacing')
def g07_spacing(app):
    app.start(SPLIT); p = app.page; id = headline(app)
    p.keyboard.press('Enter'); p.keyboard.press('Control+a'); p.keyboard.type('Two\nlines'); p.keyboard.press('Control+Enter'); app.click_unit(400, 360)
    h0 = node(app, id)['frames']['main']['rect']['h']; font_panel(app)
    slide(app, 'Letter spacing', 200); slide(app, 'Line spacing', 1.8)
    n = node(app, id); check(n.get('spacing') == 200 and abs(n.get('leading', 0) - 1.8) < .01, f'{n}')
    check(n['frames']['main']['rect']['h'] > h0 * 1.3, f'line spacing did not grow the box: {h0} → {n["frames"]["main"]["rect"]["h"]}')


@step('G08 text effects: shadow and outline')
def g08_text_fx(app):
    app.start(SPLIT); id = headline(app); effects_panel(app); press(app, 'Shadow', '.effects-panel'); press(app, 'Border', '.effects-panel')
    n = node(app, id); check(n.get('shadow') and n.get('outline'), f'{n}')


@step('G09 add shapes and lines')
def g09_shapes(app):
    app.start(SPLIT); p = app.page; n0 = len(app.doc()['nodes']); p.keyboard.press('s'); p.wait_for_timeout(300)
    p.locator('.shapes-panel button[aria-label="Star 5"]').click(); p.locator('.shapes-panel button[aria-label="Line"]').first.click()
    check(len(app.doc()['nodes']) == n0 + 2, 'shapes not added')


@step('G10 search and add icons and graphics')
def g10_icons(app):
    app.start(SPLIT); p = app.page; p.keyboard.press('s'); p.wait_for_timeout(300)
    p.locator('.shapes-panel input').fill('coffee'); p.wait_for_timeout(400); p.locator('.shapes-panel button[aria-label="Coffee"]').click()
    check([n for n in app.doc()['nodes'] if n.get('icon')], 'icon not added')


@step('G11 recolour elements with palette (brand) colours')
def g11_colour(app):
    app.start(SPLIT); p = app.page; id = headline(app); p.keyboard.press('c'); p.locator('.colour-panel .roles button', has_text='Accent').click()
    check(node(app, id)['fill'] == {'role': 'accent'}, 'not recoloured')


@step('G12 change the background colour')
def g12_ground(app):
    app.start(SPLIT); p = app.page; app.click_unit(990, 20); p.keyboard.press('c'); p.locator('.colour-panel .shades button').nth(2).click()
    app.click_unit(600, 980); check(app.doc()['ground'] is not None, 'ground not filled')


@step('G13 fill a shape with a gradient')
def g13_gradient(app):
    app.start(SPLIT); p = app.page; acc = find(app.doc(), slot='accent')[0]; app.click_unit(830, 830); p.keyboard.press('c')
    p.locator('.colour-panel button[aria-label="Gradient"]').click(); p.wait_for_timeout(200)
    n = node(app, acc['id']); check(n.get('gradient') and 'to' in n['gradient'], f'no gradient: {n}')
    check(not near(pixel(app, 830, 675), pixel(app, 830, 995), 10), 'shape still flat (top and bottom match)')


@step('G14 pick a colour from the design (eyedropper)')
def g14_eyedropper(app):
    id = photo(app); p = app.page; h = headline(app); p.keyboard.press('c')
    p.locator('.colour-panel button[aria-label="Pick from canvas"]').click(); app.click_unit(40, 760)
    fill = node(app, h)['fill']; check('hex' in fill, f'not a picked hex: {fill}')
    v = tuple(int(fill['hex'][i:i + 2], 16) for i in (1, 3, 5)); check(near(v, RED, 6), f'picked {fill["hex"]}, photo is {RED}')


def arrange_panel(app):
    if app.page.locator('.arrange-panel:not([hidden])').count() == 0: tool(app, 'Position')
    check(app.page.locator('.arrange-panel:not([hidden])').count() == 1, 'no Position panel')


@step('G15 align elements to the page and to each other')
def g15_align(app):
    app.start(SPLIT); p = app.page; acc = find(app.doc(), slot='accent')[0]; app.click_unit(830, 830)
    arrange_panel(app); press(app, 'Align left', '.arrange-panel'); check(abs(node(app, acc['id'])['frames']['main']['rect']['x']) < .01, 'not aligned to the page')
    app.click_unit(150, 830); app.page.keyboard.down('Shift'); headline(app); app.page.keyboard.up('Shift')
    arrange_panel(app); press(app, 'Align right', '.arrange-panel')
    d = app.doc(); rights = [n['frames']['main']['rect']['x'] + n['frames']['main']['rect']['w'] for n in d['nodes'] if n.get('slot') in ('accent', 'headline')]
    check(abs(rights[0] - rights[1]) < .01, f'right edges differ: {rights}')


@step('G16 space elements evenly (distribute)')
def g16_distribute(app):
    app.start(POSTER); p = app.page
    for _ in range(3): p.keyboard.press('o'); p.wait_for_timeout(80)
    ids = [n['id'] for n in app.doc()['nodes'] if n.get('shape') == 'circle']
    p.keyboard.press('Escape'); d = app.doc()
    # The circles start stacked 20 units apart: grab each by a corner only it covers.
    for i, x, grab in zip(ids, [0, 330, 680], [(5, 5), (5, 5), (310, 310)]):
        r = find(d, id=i)[0]['frames']['main']['rect']; c = (r['x'] + grab[0], r['y'] + grab[1])
        app.drag_unit(c, (x + grab[0], c[1]), alt=True); d = app.doc()
    p.keyboard.press('Escape')
    for i in ids:
        r = find(app.doc(), id=i)[0]['frames']['main']['rect']; p.keyboard.down('Shift'); app.click_unit(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); p.keyboard.up('Shift')
    arrange_panel(app); press(app, 'Distribute horizontally', '.arrange-panel')
    xs = sorted(find(app.doc(), id=i)[0]['frames']['main']['rect']['x'] for i in ids); check(abs((xs[1] - xs[0]) - (xs[2] - xs[1])) < .01, f'uneven: {xs}')


@step('G17 group and ungroup elements')
def g17_group(app):
    app.start(SPLIT); p = app.page; app.click_unit(830, 830); p.keyboard.down('Shift'); headline(app); p.keyboard.up('Shift')
    p.keyboard.press('Control+g'); d = app.doc(); groups = {n.get('group') for n in d['nodes'] if n.get('slot') in ('accent', 'headline')}
    check(len(groups) == 1 and None not in groups, f'not grouped: {groups}')
    p.keyboard.press('Escape'); app.click_unit(830, 830); check('2 selected' in p.locator('.info').inner_text(), 'clicking one member did not select the group')
    p.keyboard.press('Control+Shift+g'); check(all(not n.get('group') for n in app.doc()['nodes']), 'not ungrouped')


@step('G18 layers, arrange, lock, duplicate and undo')
def g18_basics(app):
    app.start(SPLIT); p = app.page; n0 = len(app.doc()['nodes']); app.click_unit(830, 830)
    p.keyboard.press('Control+d'); p.keyboard.press('Control+Shift+BracketLeft'); p.keyboard.press('Control+Shift+l')
    d = app.doc(); check(len(d['nodes']) == n0 + 1 and d['nodes'][0].get('locked'), 'duplicate, send to back or lock')
    p.keyboard.press('Control+z'); p.keyboard.press('Control+z'); p.keyboard.press('Control+z'); check(len(app.doc()['nodes']) == n0, 'undo')


@step('G19 copy a style from one element and paste it onto another')
def g19_copy_style(app):
    app.start(SPLIT); p = app.page; id = headline(app); font_panel(app)
    app.page.locator('.font-panel .fonts button[aria-label="Bebas Neue"]').click(); effects_panel(app); press(app, 'Shadow', '.effects-panel')
    p.keyboard.press('Control+Alt+c'); body = find(app.doc(), slot='body')[0]; r = body['frames']['main']['rect']; app.click_unit(r['x'] + 10, r['y'] + 10)
    p.keyboard.press('Control+Alt+v'); b = node(app, body['id'])
    check(b.get('font') == 'bebas-neue' and b.get('shadow'), f'style not pasted: {b}')


@step('G20 download PNG, JPG, PDF and SVG with effects intact')
def g20_download(app):
    id = photo(app); image_panel(app); app.page.locator('.image-panel .masks button[aria-label="Circle"]').click()
    slide(app, 'Saturation', -100); effects_panel(app); press(app, 'Shadow', '.effects-panel'); slide(app, 'Opacity', 80); app.close_panels()
    png = Image.open(app.export('png')); check(png.size == (1080, 1080), f'png {png.size}')
    c = png.convert('RGB').getpixel((int(40 * 1.08), int(300 * 1.08)))
    check(max(c) - min(c) < 10, f'PNG lost the black and white adjustment: {c}')
    check(png.convert('RGB').getpixel((3, 3)) != RED, 'PNG lost the mask')
    svg = app.export('svg').read_text(); dom = xml.dom.minidom.parseString(svg)
    check(dom.getElementsByTagName('clipPath').length >= 1 and dom.getElementsByTagName('feDropShadow').length >= 1 and 'opacity="0.8"' in svg, 'SVG lost mask, shadow or opacity')
    pdf = app.export('pdf').read_bytes(); check(pdf.startswith(b'%PDF-1.4') and b'/MediaBox' in pdf, 'pdf')
    jpg = Image.open(app.export('jpg')); check(jpg.size == (1080, 1080), 'jpg'); app.close_panels()


def main():
    steps = [p01_upload, p02_replace, p03_crop, p04_pan_zoom, p05_flip, p06_rotate, p07_brightness, p08_saturation, p09_warmth, p10_blur, p11_sharpen, p12_vignette,
             p13_filter, p14_duotone, p15_opacity, p16_remove_bg, p17_mask, p18_border, p19_shadow, p20_background, p21_collage,
             g01_layout, g02_resize, g03_text, g04_font, g05_size, g06_style, g07_spacing, g08_text_fx, g09_shapes, g10_icons, g11_colour, g12_ground,
             g13_gradient, g14_eyedropper, g15_align, g16_distribute, g17_group, g18_basics, g19_copy_style, g20_download]
    only = os.environ.get('ONLY')
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM') or next((str(x) for x in Path('/opt/pw-browsers').glob('chromium-*/chrome-linux/chrome')), None)
        browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
        app = App(browser); app.page.set_default_timeout(8000)
        for s in steps:
            if only and only not in s.__name__: continue
            s(app)
        browser.close()
    failed = [r for r in ba.results if r[1] != 'pass']
    print(f'\n{len(ba.results) - len(failed)}/{len(ba.results)} steps passed')
    if ba.errors: print('console errors:', *ba.errors[:20], sep='\n  ')
    if ba.offorigin: print('off-origin requests:', *sorted(set(ba.offorigin))[:20], sep='\n  ')
    (OUT / 'report.json').write_text(json.dumps({'results': ba.results, 'errors': ba.errors, 'offorigin': sorted(set(ba.offorigin))}, indent=1))
    sys.exit(1 if failed or ba.errors or ba.offorigin else 0)


if __name__ == '__main__':
    main()
