"""Run against vite preview: python3 scripts/editor_controls_audit.py [base URL]."""
import json
import sys
import tempfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4175'
OUT = Path('private/editor-controls-audit')
OUT.mkdir(parents=True, exist_ok=True)


def saved(page, mode):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', f'ratio:ctrl:{mode}')


def drag(page, start, end):
    box = page.locator('canvas.overlay').bounding_box()
    scale = box['width'] / 1000
    page.mouse.move(box['x'] + start[0] * scale, box['y'] + start[1] * scale)
    page.mouse.down()
    page.mouse.move(box['x'] + end[0] * scale, box['y'] + end[1] * scale, steps=5)
    page.mouse.up()


with sync_playwright() as p, tempfile.TemporaryDirectory(prefix='ratio-controls-') as profile:
    prefs = Path(profile) / 'Default'
    prefs.mkdir()
    (prefs / 'Preferences').write_text(json.dumps({'profile': {'default_content_setting_values': {'automatic_downloads': 1}}}))
    browser = p.chromium.launch_persistent_context(profile, headless=True, viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    for platform, mod in [('MacIntel', 'Meta'), ('Win32', 'Control')]:
        for mode in ['blank', 'guide']:
            page = browser.new_page()
            page.add_init_script(f"Object.defineProperty(navigator, 'platform', {{get: () => '{platform}'}})")
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            page.goto(BASE + f'/?mode={mode}&s=ctrl', wait_until='networkidle')
            page.evaluate('localStorage.clear()')
            page.reload(wait_until='networkidle')
            if mode == 'guide':
                page.get_by_role('button', name='Square', exact=True).click()
                page.get_by_role('button', name='Rule of thirds', exact=True).click()
            expect(page.locator('canvas.overlay')).to_be_visible()
            for shape in ['rectangle', 'ellipse', 'triangle', 'diamond', 'star', 'arrow']:
                page.get_by_role('button', name='Shape library', exact=True).click()
                panel = page.get_by_role('group', name='Shape library', exact=True)
                panel.get_by_role('button', name=f'Add {shape}', exact=True).click()
                assert saved(page, mode)['nodes'][-1]['shape'] == shape
                hex_input = page.get_by_role('textbox', name='Hex colour', exact=True)
                hex_input.fill('336699')
                hex_input.press('Tab')
                assert saved(page, mode)['nodes'][-1]['fill'] == '#336699'
                page.wait_for_timeout(1100)  # Avoid Chromium's rapid-download flood limit.
                downloads = []
                listener = lambda download: downloads.append(download)
                page.on('download', listener)
                page.locator('canvas.overlay').focus()
                page.keyboard.press(f'{mod}+Shift+e')
                page.screenshot(path=str(OUT / 'export-check.png'))
                for _ in range(100):
                    if len(downloads) == 2:
                        break
                    page.wait_for_timeout(50)
                assert len(downloads) == 2, (platform, mode, shape, len(downloads), errors, page.get_by_role('button', name='Export PNG and JSON', exact=True).is_disabled())
                for download in downloads:
                    download.save_as(OUT / f'{platform}-{mode}-{shape}-{download.suggested_filename}')
                page.remove_listener('download', listener)
                png = Image.open(OUT / f'{platform}-{mode}-{shape}-ctrl-{mode}.png').convert('RGB')
                assert png.size == (1080, 1080)
                assert png.getpixel((540, 540)) == (51, 102, 153), (shape, png.getpixel((540, 540)))
                if shape != 'rectangle':
                    assert png.getpixel((379, 433)) == (255, 255, 255), shape
                data = json.loads((OUT / f'{platform}-{mode}-{shape}-ctrl-{mode}.json').read_text())
                assert data == saved(page, mode)
                if shape != 'rectangle':
                    drag(page, (380, 420), (380, 420))
                    expect(page.get_by_role('button', name='Delete selected object', exact=True)).to_be_disabled()
                    drag(page, (500, 500), (500, 500))
                page.keyboard.press('Delete')
                assert saved(page, mode)['nodes'] == []
            page.get_by_role('button', name='Add rectangle', exact=True).click()
            original = saved(page, mode)['nodes'][0]
            page.locator('canvas.overlay').focus()
            page.keyboard.press(f'{mod}+d')
            assert len(saved(page, mode)['nodes']) == 2
            page.keyboard.press('Delete')
            drag(page, (500, 500), (500, 500))
            page.keyboard.press(f'{mod}+Shift+l')
            locked = saved(page, mode)
            assert locked['nodes'][0]['locked'] is True
            drag(page, (500, 500), (570, 560))
            page.keyboard.press('ArrowRight')
            page.keyboard.press('Delete')
            page.keyboard.press(f'{mod}+d')
            assert saved(page, mode) == locked
            expect(page.get_by_role('textbox', name='Hex colour')).to_be_disabled()
            page.reload(wait_until='networkidle')
            assert saved(page, mode) == locked
            drag(page, (500, 500), (500, 500))
            page.keyboard.press(f'{mod}+Shift+l')
            assert saved(page, mode)['nodes'][0]['locked'] is False
            page.keyboard.down('Shift')
            drag(page, (500, 500), (580, 515))
            page.keyboard.up('Shift')
            moved = saved(page, mode)['nodes'][0]['rect']
            assert moved['y'] == original['rect']['y']
            assert moved['x'] != original['rect']['x']
            page.keyboard.down('Shift')
            drag(page, (moved['x'] + moved['w'], moved['y'] + moved['h']), (moved['x'] + moved['w'] + 80, moved['y'] + moved['h'] + 10))
            page.keyboard.up('Shift')
            resized = saved(page, mode)['nodes'][0]['rect']
            assert abs(resized['w'] / resized['h'] - 1.5) < 1e-8
            assert resized['w'] != moved['w']
            page.keyboard.press('ArrowRight')
            page.keyboard.press('Shift+ArrowDown')
            nudged = saved(page, mode)['nodes'][0]['rect']
            assert abs(nudged['x'] - resized['x'] - 1) < 1e-8
            assert abs(nudged['y'] - resized['y'] - 10) < 1e-8
            page.get_by_role('button', name='Add text', exact=True).click()
            editor = page.get_by_role('textbox', name='Edit text')
            editor.fill('Keyboard test')
            editor.press(f'{mod}+d')
            assert len(saved(page, mode)['nodes']) == 2
            editor.press(f'{mod}+Enter')
            expect(editor).to_have_count(0)
            page.keyboard.press(f'{mod}+b')
            assert saved(page, mode)['nodes'][-1]['weight'] == 700
            hex_input = page.get_by_role('textbox', name='Hex colour', exact=True)
            hex_input.fill('#abcdef')
            hex_input.press('Tab')
            assert saved(page, mode)['nodes'][-1]['color'] == '#abcdef'
            hex_input.fill('bad')
            hex_input.press('Tab')
            assert saved(page, mode)['nodes'][-1]['color'] == '#abcdef'
            hex_input.fill('#abcdef')
            hex_input.press('Tab')
            page.get_by_role('button', name='Keyboard shortcuts', exact=True).click()
            help_panel = page.get_by_role('group', name='Keyboard shortcuts', exact=True)
            expect(help_panel).to_contain_text('⌘+D' if mod == 'Meta' else 'Ctrl+D')
            page.screenshot(path=str(OUT / f'{platform}-{mode}-shortcuts.png'))
            page.keyboard.press('Escape')
            page.get_by_role('button', name='Shape library', exact=True).click()
            page.screenshot(path=str(OUT / f'{platform}-{mode}-shapes.png'))
            page.keyboard.press('Escape')
            page.get_by_role('button', name='Add pack image', exact=True).click()
            expect(page.get_by_role('button', name='Export PNG and JSON', exact=True)).to_be_enabled()
            page.locator('canvas.overlay').focus()
            page.keyboard.press(f'{mod}+d')
            page.wait_for_function('(key) => JSON.parse(localStorage.getItem(key)).nodes.length === 4', arg=f'ratio:ctrl:{mode}')
            image_nodes = saved(page, mode)['nodes'][-2:]
            assert image_nodes[0]['src'] == image_nodes[1]['src']
            assert image_nodes[0]['id'] != image_nodes[1]['id']
            page.keyboard.press('Delete')
            assert len(saved(page, mode)['nodes']) == 3
            assert not errors, errors
            page.close()
            print(f'PASS {platform} {mode}: six shapes, coloured exports, duplicate, locks, Shift constraints, editing guards, persistence, shortcut labels', flush=True)
    browser.close()
