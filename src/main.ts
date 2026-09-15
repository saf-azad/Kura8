import { isMac, primaryModifier, isEditingTarget } from './app/tools/shortcuts';
import './style.css';
import { createDocument, type RatioDoc, type DocNode, type TextNode, type ShapeKind } from './core/document';
import { canvasSize, ratioById } from './core/ratios';
import { guideById } from './core/guides';
import { studySession } from './app/study';
import { pack } from './app/study/pack';
import { loadDocument, saveDocument } from './app/store';
import { showWheel } from './app/wheel';
import { Canvas2DRenderer, measureText, FONT } from './app/canvas/renderer';
import { drawOverlay } from './app/canvas/overlay';
import { installInteraction } from './app/canvas/interaction';
import { toolbar, button, icons } from './app/tools';
import { exportDocument } from './app/export';
import type { SnapHit } from './core/snap';
const { id, mode } = studySession();
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<header class="topbar"><div class="wordmark" aria-label="Ratio">ratio<span aria-hidden="true"></span></div><div class="document-meta"></div></header><main></main>';
const host = app.querySelector('main')!, meta = app.querySelector<HTMLDivElement>('.document-meta')!;
const existing = loadDocument(id, mode);
if (existing) openEditor(existing);
else if (mode === 'blank') openEditor(createDocument(id, 'square', null, new Date().toISOString()));
else showWheel(host, (ratio, guide) => openEditor(createDocument(id, ratio, guide, new Date().toISOString())));
function openEditor(doc: RatioDoc): void {
  const size = canvasSize(doc.ratio), ratio = ratioById(doc.ratio), anchors = doc.guide ? guideById(doc.guide).generate(size) : [];
  meta.textContent = `${ratio.w}:${ratio.h}`;
  host.className = 'editor';
  host.innerHTML = '<div class="work-area"><div class="canvas-stack"><canvas aria-label="Document"></canvas><canvas class="overlay" tabindex="0" aria-label="Canvas: select and drag objects; double-click text to edit"></canvas></div></div><div class="bottom-bar"><div class="tools"></div><div class="pack" role="toolbar" aria-label="Content pack"></div></div><input type="file" class="file-picker" accept="image/png,image/jpeg,image/webp,image/gif">';
  const work = host.querySelector<HTMLDivElement>('.work-area')!, stack = host.querySelector<HTMLDivElement>('.canvas-stack')!;
  const canvas = stack.querySelector('canvas')!, overlay = stack.querySelector<HTMLCanvasElement>('.overlay')!;
  const renderer = new Canvas2DRenderer(canvas), images = new Map<string, ImageBitmap>();
  const measure = document.createElement('canvas').getContext('2d')!;
  let selectedId: string | undefined, scale = 1, hits: SnapHit[] = [], editor: HTMLTextAreaElement | undefined;
  let loading = 0, exporting = false;
  const mac = isMac(navigator.platform);
  const selected = () => doc.nodes.find(n => n.id === selectedId);
  const persist = () => { const saved = saveDocument(doc, mode); canvas.setAttribute('data-autosave', saved ? 'saved' : 'unavailable'); };
  const refresh = () => {
    for (const n of doc.nodes) if (n.type === 'text') n.rect.h = measureText(measure, n);
    renderer.render(doc, { scale: scale * (window.devicePixelRatio || 1), images });
    drawOverlay(overlay, size, scale, anchors, hits, selected()); tools.refresh();
    tools.exportButton.disabled = loading > 0 || exporting;
    persist();
  };
  const select = (nodeId?: string) => { selectedId = nodeId; hits = []; refresh(); };
  const add = (node: DocNode) => { doc.nodes.push(node); select(node.id); };
  const addText = (text: string, fontSize = 56, weight: 400 | 700 = 400, edit = false) => {
    const n: TextNode = { id: crypto.randomUUID(), type: 'text', rect: { x: (size.w - 600) / 2, y: 0, w: 600, h: 20 }, text, fontSize, weight, align: 'left', color: '#111111' };
    n.rect.h = measureText(measure, n); n.rect.y = (size.h - n.rect.h) / 2; add(n); if (edit) editText(n);
  };
  const decode = async (src: string) => createImageBitmap(await (await fetch(src)).blob());
  const addImage = async (src: string) => {
    loading++; refresh();
    try { const bitmap = await decode(src), nodeId = crypto.randomUUID(); images.set(nodeId, bitmap); const h = 500 * bitmap.height / bitmap.width;
      add({ id: nodeId, type: 'image', src, naturalSize: { w: bitmap.width, h: bitmap.height }, rect: { x: (size.w - 500) / 2, y: (size.h - h) / 2, w: 500, h } });
    } finally { loading--; refresh(); }
  };
  const remove = () => { const index = doc.nodes.findIndex(n => n.id === selectedId); if (index < 0 || doc.nodes[index].locked) return; const n = doc.nodes[index]; images.get(n.id)?.close(); images.delete(n.id); doc.nodes.splice(index, 1); select(); };
  const addShape = (shape: ShapeKind) => add({ id: crypto.randomUUID(), type: 'rect', shape, rect: { x: (size.w - 300) / 2, y: (size.h - 200) / 2, w: 300, h: 200 }, fill: '#111111' });
  const toggleLock = () => { const n = selected(); if (n) { n.locked = !n.locked; refresh(); } };
  const duplicate = async () => {
    const n = selected(); if (!n || n.locked) return;
    const copy = structuredClone(n); copy.id = crypto.randomUUID(); copy.rect.x += 20; copy.rect.y += 20;
    if (copy.type === 'image') { loading++; refresh(); try { images.set(copy.id, await decode(copy.src)); add(copy); } finally { loading--; refresh(); } }
    else add(copy);
  };
  const file = host.querySelector<HTMLInputElement>('.file-picker')!;
  const tools = toolbar(host.querySelector<HTMLElement>('.tools')!, {
    selected, mac, addShape, toggleLock, duplicate: () => { void duplicate(); }, update: refresh, addText: () => addText('Text', 56, 400, true),
    addRect: () => add({ id: crypto.randomUUID(), type: 'rect', rect: { x: (size.w - 300) / 2, y: (size.h - 200) / 2, w: 300, h: 200 }, fill: '#111111' }),
    addImage: () => file.click(), delete: remove,
    export: () => { exporting = true; refresh(); void exportDocument(doc, mode, images).finally(() => { exporting = false; refresh(); }); },
  });
  const content = host.querySelector<HTMLDivElement>('.pack')!;
  const label = document.createElement('span'); label.className = 'pack-label'; label.textContent = pack.instruction;
  content.append(label, button('Add pack headline', icons.text, () => addText(pack.headline, 72, 700)), button('Add pack paragraph', icons.paragraph, () => addText(pack.body, 28)));
  const imageButton = button('Add pack image', '', () => { void addImage(pack.image); });
  const thumbnail = document.createElement('img'); thumbnail.src = pack.image; thumbnail.alt = ''; imageButton.replaceChildren(thumbnail); content.append(imageButton);
  file.onchange = async () => {
    const image = file.files?.[0]; file.value = ''; if (!image) return;
    try {
      const bitmap = await createImageBitmap(image), raster = document.createElement('canvas');
      const fit = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)); raster.width = Math.round(bitmap.width * fit); raster.height = Math.round(bitmap.height * fit);
      raster.getContext('2d')!.drawImage(bitmap, 0, 0, raster.width, raster.height); bitmap.close();
      await addImage(raster.toDataURL(image.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .9));
    } catch { file.setCustomValidity('Choose a readable PNG, JPEG, WebP or GIF image.'); file.reportValidity(); }
  };
  function editText(node: DocNode): void {
    if (node.type !== 'text' || node.locked || editor) return;
    select(node.id); editor = document.createElement('textarea'); const input = editor;
    input.className = 'text-editor'; input.setAttribute('aria-label', 'Edit text'); input.value = node.text;
    const position = () => {
      input.style.cssText = `left:${node.rect.x * scale}px;top:${node.rect.y * scale}px;width:${node.rect.w * scale}px;height:${Math.max(node.rect.h * scale, node.fontSize * scale * 1.2 + 4)}px;font:${node.weight} ${node.fontSize * scale}px ${FONT};line-height:1.2;text-align:${node.align};color:${node.color}`;
    };
    position(); stack.append(input); input.focus(); input.select();
    input.oninput = () => { node.text = input.value; refresh(); position(); };
    input.onblur = () => { input.remove(); editor = undefined; refresh(); };
    input.onkeydown = e => { if (e.key === 'Escape' || e.key === 'Enter' && primaryModifier(e, mac)) { e.preventDefault(); input.blur(); overlay.focus(); } };
  }
  installInteraction({ canvas: overlay, doc, size, anchors, snapping: mode === 'guide', scale: () => scale, selected, select, change: nextHits => { hits = nextHits; refresh(); }, edit: editText });
  document.onkeydown = e => {
    if (isEditingTarget(e.target) || e.isComposing || e.altKey) return;
    const n = selected(), mod = primaryModifier(e, mac), key = e.key.toLowerCase();
    if (mod) {
      if (key === 'd' && !e.shiftKey) { e.preventDefault(); if (!e.repeat) void duplicate(); }
      if (key === 'l' && e.shiftKey) { e.preventDefault(); if (!e.repeat) toggleLock(); }
      if (key === 'b' && !e.shiftKey && n?.type === 'text' && !n.locked) { e.preventDefault(); if (!e.repeat) { n.weight = n.weight === 700 ? 400 : 700; refresh(); } }
      if (key === 'e' && e.shiftKey) { e.preventDefault(); if (!e.repeat) tools.exportButton.click(); }
      return;
    }
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
    if (e.key === 'Escape') select();
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { if (n) editText(n); }
    if (n && !n.locked && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); const amount = e.shiftKey ? 10 : 1;
      n.rect.x += e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0;
      n.rect.y += e.key === 'ArrowUp' ? -amount : e.key === 'ArrowDown' ? amount : 0;
      hits = []; refresh();
    }
  };
  const fit = () => {
    editor?.blur(); const style = getComputedStyle(work);
    const w = work.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), h = work.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    scale = Math.max(.01, Math.min(w / size.w, h / size.h)); stack.style.width = `${size.w * scale}px`; stack.style.height = `${size.h * scale}px`; refresh();
  };
  new ResizeObserver(fit).observe(work); fit();
  for (const node of doc.nodes) if (node.type === 'image') {
    loading++; void decode(node.src).then(bitmap => images.set(node.id, bitmap)).finally(() => { loading--; refresh(); });
  }
  refresh();
}
