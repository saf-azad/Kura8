"""Production-browser audit. Requires Python Playwright and Pillow.
Run against `npm run preview`: python3 scripts/browser_audit.py [base URL]
Evidence and downloads are written to ignored private/browser-audit/.
"""
import json
import sys
import tempfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
OUT = Path('private/browser-audit')
OUT.mkdir(parents=True, exist_ok=True)
RATIOS = [('square', 'Square', 1080, 1080), ('portrait', 'Portrait', 1080, 1350),
          ('landscape', 'Landscape', 1920, 1080), ('story', 'Story', 1080, 1920),
          ('banner', 'Banner', 1500, 500)]


def saved(page, session, mode='guide'):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', f'ratio:{session}:{mode}')


def drag(page, start, end, release=True):
    box = page.locator('canvas.overlay').bounding_box()
    scale = box['width'] / 1000
    page.mouse.move(box['x'] + start[0] * scale, box['y'] + start[1] * scale)
    page.mouse.down()
    page.mouse.move(box['x'] + end[0] * scale, box['y'] + end[1] * scale, steps=8)
    if release:
        page.mouse.up()


def export(page, session, mode, width, height, empty=False):
    downloads = []
    on_download = lambda download: downloads.append(download)
    page.on('download', on_download)
    page.get_by_role('button', name='Export PNG and JSON', exact=True).click()
    for _ in range(600):
        if len(downloads) == 2:
            break
        page.wait_for_timeout(50)
    page.remove_listener('download', on_download)
    assert sorted(d.suggested_filename for d in downloads) == [f'{session}-{mode}.json', f'{session}-{mode}.png'], [d.suggested_filename for d in downloads]
    for d in downloads:
        assert d.failure() is None
        d.save_as(OUT / d.suggested_filename)
    png = Image.open(OUT / f'{session}-{mode}.png').convert('RGB')
    assert png.size == (width, height), png.size
    if empty:
        assert png.getextrema() == ((255, 255),) * 3, 'Overlay leaked into export'
    else:
        assert png.getextrema() != ((255, 255),) * 3, 'Content missing from export'
    doc = json.loads((OUT / f'{session}-{mode}.json').read_text())
    assert doc == saved(page, session, mode)
    # Reload the downloaded JSON through the app's actual document validator.
    page.evaluate('([key, doc]) => localStorage.setItem(key, JSON.stringify(doc))', [f'ratio:{session}:{mode}', doc])
    page.reload(wait_until='networkidle')
    expect(page.locator('canvas.overlay')).to_be_visible()
    assert saved(page, session, mode) == doc
    return doc


with sync_playwright() as p:
    # Fresh test profile with Chrome's multiple-download permission explicitly allowed.
    profile = tempfile.TemporaryDirectory(prefix='ratio-browser-audit-')
    preferences = Path(profile.name) / 'Default'
    preferences.mkdir()
    (preferences / 'Preferences').write_text(json.dumps({'profile': {'default_content_setting_values': {'automatic_downloads': 1}}}))
    context = p.chromium.launch_persistent_context(profile.name, headless=True, viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda err: (errors.append(str(err)), print('PAGE ERROR:', err, flush=True)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    page.goto(BASE, wait_until='networkidle')
    print('Rendered controls:', page.locator('[role=button]').evaluate_all('els => els.map(e => e.getAttribute("aria-label"))'), flush=True)
    guides = ['Rule of thirds', 'Golden ratio', 'Simple divisions']
    for i, (ratio, name, width, height) in enumerate(RATIOS):
        for j, guide in enumerate(guides):
            session = f'a{i}{j}x'
            page.goto(f'{BASE}/?s={session}&mode=guide', wait_until='networkidle')
            page.get_by_role('button', name=name, exact=True).click()
            if i == j == 0:
                print('Guide controls:', page.locator('[role=button]').evaluate_all('els => els.map(e => e.getAttribute("aria-label"))'), flush=True)
            page.get_by_role('button', name=guide, exact=True).click()
            expect(page.locator('canvas.overlay')).to_be_visible()
            doc = saved(page, session)
            assert doc['ratio'] == ratio and doc['guide'] == ['thirds', 'golden', 'divisions'][j]
            export(page, session, 'guide', width, height, empty=True)
            print(f'PASS {ratio}/{doc["guide"]}: wheels, paired export {width}x{height}, JSON reload', flush=True)

    # Centre keeps square and still requires a guide.
    page.goto(f'{BASE}/?s=cent', wait_until='networkidle')
    page.get_by_role('button', name='Use square ratio').click()
    expect(page.locator('svg[aria-label="Choose guide"]')).to_be_visible()
    page.get_by_role('button', name=guides[0], exact=True).click()
    assert saved(page, 'cent')['ratio'] == 'square'

    # Same raw move/resize in both conditions: only guide mode snaps.
    pack_docs = []
    for mode, session in [('guide', 'guid'), ('blank', 'blnk')]:
        page.goto(f'{BASE}/?s={session}&mode={mode}', wait_until='networkidle')
        if mode == 'guide':
            page.get_by_role('button', name='Square', exact=True).click()
            page.get_by_role('button', name=guides[0], exact=True).click()
        else:
            assert page.locator('.wheel').count() == 0
            assert saved(page, session, mode)['guide'] is None
        page.get_by_role('button', name='Add rectangle', exact=True).click()
        drag(page, (500, 500), (488, 500), release=False)
        rect = saved(page, session, mode)['nodes'][0]['rect']
        assert abs(rect['x'] - (1000/3 if mode == 'guide' else 338)) < 0.01, rect
        page.screenshot(path=str(OUT / f'{mode}-move.png'))
        page.mouse.up()
        drag(page, (rect['x'] + rect['w'], rect['y'] + rect['h']/2), (rect['x'] + 330, rect['y'] + rect['h']/2), release=False)
        rect = saved(page, session, mode)['nodes'][0]['rect']
        assert abs(rect['w'] - (1000/3 if mode == 'guide' else 330)) < 0.01, rect
        page.screenshot(path=str(OUT / f'{mode}-resize.png'))
        page.mouse.up()
        page.get_by_role('button', name='Delete selected object').click()
        assert not saved(page, session, mode)['nodes']
        for label in ['Add pack headline', 'Add pack paragraph', 'Add pack image']:
            page.get_by_role('button', name=label, exact=True).click()
        expect(page.get_by_role('button', name='Export PNG and JSON')).to_be_enabled()
        nodes = saved(page, session, mode)['nodes']
        assert len(nodes) == 3
        pack_docs.append([{k: v for k, v in n.items() if k != 'id'} for n in nodes])
        export(page, session, mode, 1080, 1080)
        # Image corner resize preserves its aspect, then deletion exposes text.
        r = nodes[-1]['rect']
        box = page.locator('canvas.overlay').bounding_box()
        page.mouse.click(box['x'] + (r['x'] + r['w']/2) * box['width']/1000, box['y'] + (r['y'] + r['h']/2) * box['width']/1000)
        drag(page, (r['x'] + r['w'], r['y'] + r['h']), (r['x'] + r['w'] + 80, r['y'] + r['h'] + 20))
        resized = saved(page, session, mode)['nodes'][-1]['rect']
        assert resized['w'] != r['w']
        assert abs(resized['w']/resized['h'] - r['w']/r['h']) < 1e-8
        page.get_by_role('button', name='Delete selected object').click()
        page.get_by_role('button', name='Add text', exact=True).click()
        page.get_by_role('textbox', name='Edit text').fill('A browser-tested text node with enough words to wrap onto multiple lines.')
        page.get_by_role('textbox', name='Edit text').press('Escape')
        node = saved(page, session, mode)['nodes'][-1]
        r = node['rect']
        drag(page, (r['x'] + r['w'], r['y'] + r['h']/2), (r['x'] + 300, r['y'] + r['h']/2))
        resized = saved(page, session, mode)['nodes'][-1]['rect']
        assert resized['w'] < r['w'] and resized['h'] > r['h']
        drag(page, (resized['x'] + 25, resized['y'] + 25), (resized['x'] + 70, resized['y'] + 70))
        assert saved(page, session, mode)['nodes'][-1]['rect'] != resized
        page.get_by_role('button', name='Delete selected object').click()
        # Exercise actual file-input selection with a deterministic raster fixture.
        fixture = OUT / 'upload.png'
        Image.new('RGB', (2000, 1000), (80, 80, 80)).save(fixture)
        with page.expect_file_chooser() as chooser:
            page.get_by_role('button', name='Add image', exact=True).click()
        chooser.value.set_files(fixture)
        page.wait_for_function('(key) => JSON.parse(localStorage.getItem(key)).nodes.at(-1)?.type === "image"', arg=f'ratio:{session}:{mode}')
        imported = saved(page, session, mode)['nodes'][-1]
        assert imported['naturalSize'] == {'w': 1600, 'h': 800}
        assert imported['rect'] == {'x': 250, 'y': 375, 'w': 500, 'h': 250}
        export(page, session, mode, 1080, 1080)
        print(f'PASS {mode}: move/size snapping behaviour, pack, text/image editing, upload, recovery', flush=True)
    assert pack_docs[0] == pack_docs[1], 'Content pack differs between conditions'
    assert not errors, errors
    print('PASS: identical content pack; no browser console errors', flush=True)
    context.close()
    profile.cleanup()
