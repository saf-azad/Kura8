"""Student-session harness for Kura8 user-testing loops (D-045). Audit tooling, not an app dependency.

Drives the built app (vite preview on 127.0.0.1:4173) the way a person would: through visible controls, the canvas,
the keyboard, file pickers and drag-and-drop. Collects console errors, page errors and off-origin requests, saves
screenshots, and reads the autosaved document for assertions.

    from kura import Session
    with Session('maya', viewport=(1440, 900), mac=True) as s:
        s.dial(ratio='square', comp='cover', guide='thirds', hue=210)
        s.start()
        ...
"""
import json, os, sys, time, glob
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('KURA_BASE', 'http://127.0.0.1:4173/')
ORIGIN = BASE.split('/', 3)[0] + '//' + BASE.split('/', 3)[2]
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SAMPLES = Path(os.environ.get('KURA_SAMPLES', ROOT / 'private' / 'usertest' / 'samples'))
OUT = Path(os.environ.get('KURA_RUNS', ROOT / 'private' / 'usertest' / 'runs'))
CHROME = os.environ.get('CHROMIUM') or next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))), None)


class Session:
    def __init__(self, name, viewport=(1440, 900), mac=False, dpr=1):
        self.name, self.viewport, self.mac, self.dpr = name, viewport, mac, dpr
        self.errors, self.offorigin, self.notes, self.toasts = [], [], [], []
        self.dir = OUT / name
        self.dir.mkdir(parents=True, exist_ok=True)
        self.n = 0

    # lifecycle -------------------------------------------------------------------------------------------------
    def __enter__(self):
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(executable_path=CHROME, args=['--disable-gpu'])
        self.ctx = self.browser.new_context(viewport={'width': self.viewport[0], 'height': self.viewport[1]}, device_scale_factor=self.dpr, accept_downloads=True)
        if self.mac:
            self.ctx.add_init_script("Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' })")
        self.ctx.add_init_script("""(() => { const seen = []; window.__toasts = seen;
          const go = () => new MutationObserver(() => { const t = document.querySelector('.toast.on'); if (t && seen[seen.length - 1] !== t.textContent) seen.push(t.textContent); })
            .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
          if (document.body) go(); else document.addEventListener('DOMContentLoaded', go); })()""")
        self.page = self.ctx.new_page()
        # A standing listener keeps file-chooser interception on, so a pick fired at once is never missed.
        self.page.on('filechooser', lambda fc: None)
        p = self.page
        p.on('console', lambda m: self.errors.append(f'{m.type}: {m.text}') if m.type in ('error',) and not m.text.startswith('Failed to load resource') else None)
        p.on('response', lambda r: self.errors.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 and not r.url.endswith('/favicon.ico') else None)
        p.on('pageerror', lambda e: self.errors.append(f'pageerror: {e}'))
        p.on('request', lambda r: self.offorigin.append(r.url) if not (r.url.startswith(ORIGIN) or r.url.startswith('data:') or r.url.startswith('blob:')) else None)
        self.reset()
        return self

    def __exit__(self, *exc):
        try:
            self.toasts = self.page.evaluate('window.__toasts || []')
        except Exception:
            pass
        report = {'name': self.name, 'errors': self.errors, 'offorigin': self.offorigin, 'notes': self.notes, 'toasts': self.toasts}
        (self.dir / 'report.json').write_text(json.dumps(report, indent=2))
        self.browser.close(); self.pw.stop()
        print(json.dumps({k: v for k, v in report.items() if k != 'toasts'} | {'toasts': self.toasts[-15:]}, indent=1))

    def reset(self, lifted=True):
        p = self.page
        p.goto(BASE + 'icons/LICENSE.txt')
        p.evaluate('localStorage.clear(); indexedDB.deleteDatabase("kura8")')
        if lifted:
            p.evaluate('localStorage.setItem("kura8:lifted", "true")')
        p.goto(BASE)
        p.wait_for_timeout(500)

    def reload(self):
        self.page.reload(); self.page.wait_for_timeout(800)

    # observation -----------------------------------------------------------------------------------------------
    def shot(self, label):
        self.n += 1
        path = self.dir / f'{self.n:02d}-{label}.png'
        self.page.screenshot(path=str(path))
        return str(path)

    def note(self, text):
        self.notes.append(text); print('NOTE', text)

    def doc(self):
        self.page.wait_for_timeout(650)
        return json.loads(self.page.evaluate('localStorage.getItem("kura8:doc")') or 'null')

    def nodes(self, kind=None):
        d = self.doc() or {'nodes': []}
        return [n for n in d['nodes'] if kind is None or n['kind'] == kind]

    def toast_log(self):
        return self.page.evaluate('window.__toasts || []')

    def last_toast(self):
        t = self.toast_log(); return t[-1] if t else None

    def size_id(self):
        return self.page.evaluate('JSON.parse(localStorage.getItem("kura8:doc")).sizes[0].id')

    # dial ------------------------------------------------------------------------------------------------------
    def dial(self, **settings):
        """Preset dial settings before the dial opens (ratio, comp, guide, hue, dark, accent)."""
        base = {'ratio': 'portrait', 'comp': 'cover', 'guide': 'golden', 'hue': 210, 'dark': False}
        base.update(settings)
        self.page.evaluate(f'localStorage.setItem("kura8:dial", {json.dumps(json.dumps(base))})')
        self.page.goto(BASE); self.page.wait_for_timeout(500)

    def start(self):
        """Press Start on the dial; the headline opens in edit with its text selected."""
        self.page.get_by_role('button', name='Start').first.click() if self.page.get_by_role('button', name='Start').count() else self.page.keyboard.press('Enter')
        self.page.wait_for_timeout(600)

    # canvas geometry -------------------------------------------------------------------------------------------
    def box(self):
        return self.page.locator('canvas.doc').bounding_box()

    def scale(self):
        d = self.doc(); b = self.box(); return b['width'] / 1000

    def at(self, x, y):
        """Screen point of a unit-space point."""
        b = self.box(); k = b['width'] / 1000
        return b['x'] + x * k, b['y'] + y * k

    def click(self, x, y, **kw):
        self.page.mouse.click(*self.at(x, y), **kw); self.page.wait_for_timeout(120)

    def dblclick(self, x, y):
        self.page.mouse.dblclick(*self.at(x, y)); self.page.wait_for_timeout(200)

    def drag(self, x0, y0, x1, y1, steps=12, mods=()):
        p = self.page
        for m in mods: p.keyboard.down(m)
        p.mouse.move(*self.at(x0, y0)); p.mouse.down()
        for i in range(1, steps + 1):
            t = i / steps; p.mouse.move(*self.at(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)); p.wait_for_timeout(16)
        p.mouse.up()
        for m in mods: p.keyboard.up(m)
        p.wait_for_timeout(150)

    def frame(self, node, size=None):
        f = node['frames']; return f[size] if size else next(iter(f.values()))

    def centre_of(self, node):
        r = self.frame(node)['rect']; return r['x'] + r['w'] / 2, r['y'] + r['h'] / 2

    # chrome ----------------------------------------------------------------------------------------------------
    def button(self, label):
        """A control by its accessible name or tooltip text (titles become data-tip after first hover)."""
        p = self.page
        loc = p.locator(f'[aria-label="{label}"], [title^="{label}"], [data-tip^="{label}"]')
        if loc.count() == 0:
            loc = p.get_by_role('button', name=label)
        return loc.first

    def press(self, label):
        self.button(label).click(); self.page.wait_for_timeout(200)

    def key(self, combo):
        mod = 'Meta' if self.mac else 'Control'
        self.page.keyboard.press(combo.replace('Mod', mod)); self.page.wait_for_timeout(150)

    def type(self, text, delay=8):
        self.page.keyboard.type(text, delay=delay); self.page.wait_for_timeout(150)

    def upload(self, *files, via='Image'):
        """Use the Image tool (or a given button) and pick files in the OS dialog."""
        paths = [str(SAMPLES / f) if not os.path.isabs(f) else f for f in files]
        with self.page.expect_file_chooser() as fc:
            self.press(via)
        fc.value.set_files(paths); self.page.wait_for_timeout(1200)

    def pick_files(self, trigger, *files):
        paths = [str(SAMPLES / f) if not os.path.isabs(f) else f for f in files]
        with self.page.expect_file_chooser() as fc:
            trigger()
        fc.value.set_files(paths); self.page.wait_for_timeout(1200)

    def drop(self, file, x, y):
        """Drag a file from the desktop onto the canvas at unit point (x, y)."""
        path = str(SAMPLES / file) if not os.path.isabs(file) else file
        data = Path(path).read_bytes()
        mime = 'image/png' if path.endswith('.png') else 'image/jpeg' if path.endswith(('.jpg', '.jpeg')) else 'application/octet-stream'
        sx, sy = self.at(x, y)
        self.page.evaluate("""([b64, name, mime, sx, sy]) => {
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const file = new File([bytes], name, { type: mime });
            const dt = new DataTransfer(); dt.items.add(file); const target = document.elementFromPoint(sx, sy);
            for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientX: sx, clientY: sy, dataTransfer: dt }));
        }""", [__import__('base64').b64encode(data).decode(), os.path.basename(path), mime, sx, sy])
        self.page.wait_for_timeout(1500)

    def paste_text(self, text):
        """System clipboard paste of plain text onto the canvas (e.g. copied from a Google Doc)."""
        self.page.evaluate("""(text) => { const dt = new DataTransfer(); dt.setData('text/plain', text);
            document.querySelector('canvas.overlay').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""", text)
        self.page.wait_for_timeout(400)

    def export(self, fmt='PNG', size=None, no_ground=False, name=None):
        """Open the export sheet, choose options, download; returns the saved path."""
        p = self.page
        self.key('Mod+Shift+E'); p.wait_for_timeout(300)
        sheet = p.locator('.sheet')
        sheet.get_by_role('button', name=fmt, exact=True).click()
        if size: sheet.get_by_role('button', name=size, exact=True).click()
        if no_ground: sheet.get_by_role('switch', name='No ground').click()
        p.wait_for_timeout(200)
        with p.expect_download(timeout=60000) as dl:
            sheet.locator('button.download').click()
        d = dl.value
        path = self.dir / (name or d.suggested_filename)
        d.save_as(str(path))
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        return str(path), d.suggested_filename


def image_size(path):
    from PIL import Image
    with Image.open(path) as im:
        return im.size, im.mode
