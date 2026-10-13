// The Algorithm Universe: a zoomable map of the disciplines, drawn like a survey chart.
// Each discipline is a hill whose contour rings grow with the number of lessons it holds.
// Lessons are survey markers around the hill. Dotted routes join related disciplines.
//
// Pointer: drag to pan, pinch or use the buttons to zoom, click to select.
// Keyboard (when the map has focus): arrow keys pan, + and - zoom, 0 resets.
// Everything the map shows is also available as a list (see pages/explore.js).

import { palette, alpha, mix } from '../viz/theme.js';
import * as C from '../core/catalog.js';
import { prefersReducedMotion } from '../core/dom.js';

const WORLD = { w: 1000, h: 660 };
const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };

function buildModel() {
  const hills = C.disciplines.map((d) => {
    const primary = C.primaryIn(d.id);
    const all = C.inDiscipline(d.id);
    const R = 30 + 7.5 * Math.sqrt(all.length);
    const rings = 2 + Math.min(4, Math.ceil(all.length / 3));
    const p1 = hash(d.id) * 6.28, p2 = hash(d.id + 'b') * 6.28;
    const ringPaths = [];
    for (let j = 0; j < rings; j++) {
      const rj = R * (0.3 + 0.7 * ((j + 1) / rings));
      const path = new Path2D();
      for (let k = 0; k <= 64; k++) {
        const th = (k / 64) * Math.PI * 2;
        const r = rj * (1 + 0.07 * Math.sin(3 * th + p1 + j * 0.5) + 0.045 * Math.sin(5 * th + p2));
        const x = d.pos[0] + r * Math.cos(th), y = d.pos[1] + r * Math.sin(th) * 0.9;
        if (k) path.lineTo(x, y); else path.moveTo(x, y);
      }
      path.closePath();
      ringPaths.push(path);
    }
    const markers = primary.map((a, i) => {
      const ring = i < 9 ? 0 : 1;
      const count = ring === 0 ? Math.min(9, primary.length) : primary.length - 9;
      const idx = ring === 0 ? i : i - 9;
      const th = p1 + (idx / count) * Math.PI * 2 + ring * 0.35;
      const rr = R + 17 + ring * 19;
      return { a, x: d.pos[0] + rr * Math.cos(th), y: d.pos[1] + rr * Math.sin(th) * 0.9 };
    });
    return { d, R, ringPaths, markers, count: all.length, color: C.GROUPS[d.group].color };
  });
  const hillById = Object.fromEntries(hills.map((hl) => [hl.d.id, hl]));
  const markerById = {};
  for (const hl of hills) for (const m of hl.markers) markerById[m.a.id] = { ...m, hill: hl };
  const seen = new Set();
  const routes = [];
  for (const d of C.disciplines) for (const r of d.related) {
    const key = [d.id, r.id].sort().join('|');
    if (seen.has(key) || !hillById[r.id]) continue;
    seen.add(key);
    routes.push({ a: d.id, b: r.id });
  }
  return { hills, hillById, markerById, routes };
}

export function createUniverse(host, { onSelect = () => {}, height } = {}) {
  const model = buildModel();
  const canvas = document.createElement('canvas');
  canvas.className = 'universe-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', 'Map of the disciplines. Use arrow keys to pan, plus and minus to zoom, zero to reset. The same content is available in the list view.');
  const tip = document.createElement('div');
  tip.className = 'universe-tip';
  tip.hidden = true;
  host.append(canvas, tip);

  let w = 0, h = 0, dpr = 1;
  const cam = { x: WORLD.w / 2, y: WORLD.h / 2, k: 1 };
  let fitK = 1;
  let selected = null;   // { type: 'discipline' | 'algorithm', id }
  let hover = null;
  let raf = 0, anim = null;

  const toScreen = (x, y) => [(x - cam.x) * cam.k + w / 2, (y - cam.y) * cam.k + h / 2];
  const toWorld = (sx, sy) => [(sx - w / 2) / cam.k + cam.x, (sy - h / 2) / cam.k + cam.y];
  const invalidate = () => { if (!raf) raf = requestAnimationFrame(draw); };

  function resize() {
    const cw = host.clientWidth;
    if (!cw) return;
    const ch = height || Math.round(Math.max(380, Math.min(680, cw * 0.62)));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const first = w === 0;
    w = cw; h = ch;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    const frame = host.closest('.universe-body');
    if (frame) frame.style.setProperty('--map-h', h + 'px');
    fitK = Math.min(w / (WORLD.w + 40), h / (WORLD.h + 30));
    if (first) cam.k = fitK;
    cam.k = Math.max(fitK * 0.9, cam.k);
    invalidate();
  }

  function clampCam() {
    cam.k = Math.max(fitK * 0.9, Math.min(fitK * 7, cam.k));
    cam.x = Math.max(0, Math.min(WORLD.w, cam.x));
    cam.y = Math.max(0, Math.min(WORLD.h, cam.y));
  }

  function draw() {
    raf = 0;
    const pal = palette();
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const colorOf = (name) => pal[name] || pal.forest;
    const sel = selected;
    const selHill = sel ? (sel.type === 'discipline' ? sel.id : (model.markerById[sel.id] || {}).hill.d.id) : null;
    const related = new Set();
    if (sel && sel.type === 'discipline') for (const r of C.disciplineById[sel.id].related) related.add(r.id);
    if (sel && sel.type === 'algorithm') for (const d of C.algoById[sel.id].alsoIn || []) related.add(d.id);

    // graticule
    g.save();
    g.translate(w / 2, h / 2); g.scale(cam.k, cam.k); g.translate(-cam.x, -cam.y);
    g.lineWidth = 1 / cam.k;
    g.strokeStyle = alpha(pal.text3, 0.11);
    g.beginPath();
    for (let x = -200; x <= WORLD.w + 200; x += 100) { g.moveTo(x, -200); g.lineTo(x, WORLD.h + 200); }
    for (let y = -200; y <= WORLD.h + 200; y += 100) { g.moveTo(-200, y); g.lineTo(WORLD.w + 200, y); }
    g.stroke();

    // routes between related disciplines
    for (const r of model.routes) {
      const A = model.hillById[r.a].d.pos, B = model.hillById[r.b].d.pos;
      const hot = sel && sel.type === 'discipline' && (r.a === sel.id || r.b === sel.id);
      g.setLineDash(hot ? [] : [2 / cam.k, 5 / cam.k]);
      g.lineWidth = (hot ? 1.6 : 1) / cam.k;
      g.strokeStyle = hot ? pal.terracotta : alpha(pal.text3, sel ? 0.22 : 0.5);
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      const dx = B[0] - A[0], dy = B[1] - A[1];
      g.beginPath(); g.moveTo(A[0], A[1]);
      g.quadraticCurveTo(mx - dy * 0.08, my + dx * 0.08, B[0], B[1]);
      g.stroke();
    }
    g.setLineDash([]);

    // lines from a selected or hovered lesson to the other disciplines it serves
    const focusAlgo = (hover && hover.type === 'algorithm' ? hover.id : null) || (sel && sel.type === 'algorithm' ? sel.id : null);
    if (focusAlgo && model.markerById[focusAlgo]) {
      const m = model.markerById[focusAlgo];
      g.strokeStyle = pal.terracotta; g.lineWidth = 1.3 / cam.k;
      for (const d of m.a.alsoIn || []) {
        const t = model.hillById[d.id]; if (!t) continue;
        g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(t.d.pos[0], t.d.pos[1]); g.stroke();
      }
    }

    // hills
    for (const hl of model.hills) {
      const isSel = selHill === hl.d.id, isRel = related.has(hl.d.id), isHover = hover && hover.type === 'discipline' && hover.id === hl.d.id;
      const dim = sel && !isSel && !isRel;
      const col = colorOf(hl.color);
      hl.ringPaths.forEach((p, j) => {
        if (j === hl.ringPaths.length - 1) { g.fillStyle = alpha(col, isSel ? 0.13 : isHover ? 0.1 : 0.05); g.fill(p); }
        g.lineWidth = (isSel || isHover ? 1.5 : 1) / cam.k;
        g.strokeStyle = alpha(isSel || isHover ? col : mix(pal.sage, col, 0.35), dim ? 0.3 : 0.4 + 0.5 * (1 - j / hl.ringPaths.length));
        g.stroke(p);
      });
      g.fillStyle = dim ? alpha(col, 0.4) : col;
      g.beginPath(); g.arc(hl.d.pos[0], hl.d.pos[1], 3.2 / Math.sqrt(cam.k / fitK), 0, 6.3); g.fill();
    }

    // lesson markers
    const showLabels = cam.k >= fitK * 1.75;
    for (const hl of model.hills) {
      const dimHill = sel && selHill !== hl.d.id && !related.has(hl.d.id);
      for (const m of hl.markers) {
        const isSel = sel && sel.type === 'algorithm' && sel.id === m.a.id;
        const isHover = hover && hover.type === 'algorithm' && hover.id === m.a.id;
        const r = (isSel || isHover ? 4.6 : 3) / Math.sqrt(cam.k / fitK);
        g.lineWidth = 1.2 / cam.k;
        g.strokeStyle = alpha(pal.text3, dimHill ? 0.25 : 0.5);
        g.beginPath(); g.moveTo(hl.d.pos[0] + (m.x - hl.d.pos[0]) * 0.72, hl.d.pos[1] + (m.y - hl.d.pos[1]) * 0.72); g.lineTo(m.x, m.y); g.stroke();
        g.fillStyle = isSel || isHover ? pal.terracotta : pal.bg;
        g.strokeStyle = isSel || isHover ? pal.terracotta : alpha(colorOf(hl.color), dimHill ? 0.4 : 1);
        g.lineWidth = 1.4 / cam.k;
        g.beginPath(); g.arc(m.x, m.y, r, 0, 6.3); g.fill(); g.stroke();
      }
    }
    g.restore();

    // labels, drawn in screen space so type stays crisp at every zoom
    g.textAlign = 'center';
    // Larger disciplines are labelled first; a label that would collide with one already drawn is
    // left out until the visitor zooms in, selects it or points at it.
    const placed = [];
    const byWeight = model.hills.slice().sort((a, b) => (selHill === b.d.id) - (selHill === a.d.id) || b.count - a.count);
    for (const hl of byWeight) {
      const [sx, sy] = toScreen(hl.d.pos[0], hl.d.pos[1]);
      if (sx < -80 || sx > w + 80 || sy < -40 || sy > h + 40) continue;
      const isSel = selHill === hl.d.id;
      const dim = sel && !isSel && !related.has(hl.d.id);
      const size = Math.max(11.5, Math.min(17, 12.5 * Math.sqrt(cam.k / fitK)));
      g.font = `600 ${size}px ${pal.serif || 'Georgia, serif'}`;
      const label = cam.k < fitK * 1.45 && (w < 820 || hl.d.name.length > 18) ? hl.d.short : hl.d.name;
      const ty = sy + size + 5;
      const tw = g.measureText(label).width;
      const box = [sx - tw / 2 - 5, ty - size, sx + tw / 2 + 5, ty + 5];
      const isHover = hover && hover.type === 'discipline' && hover.id === hl.d.id;
      if (!isSel && !isHover && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      g.fillStyle = alpha(pal.bg, 0.78);
      g.fillRect(sx - tw / 2 - 4, ty - size + 1, tw + 8, size + 4);
      g.fillStyle = dim ? pal.text3 : pal.text;
      g.fillText(label, sx, ty);
      if (cam.k >= fitK * 1.25 && hl.count) {
        g.font = `italic ${Math.max(10.5, size - 3)}px ${pal.serif || 'Georgia, serif'}`;
        g.fillStyle = pal.text3;
        g.fillText(`${hl.count} lesson${hl.count === 1 ? '' : 's'}`, sx, ty + size);
      }
    }
    if (showLabels || (hover && hover.type === 'algorithm') || (sel && sel.type === 'algorithm')) {
      g.font = `500 11px ${pal.sans}`;
      // A lesson's name is left out where it would print over a field's name or over another
      // lesson's. Zooming in makes room for it. The lesson pointed at or selected is always named.
      const wanted = [];
      for (const hl of model.hills) for (const m of hl.markers) {
        const forced = (hover && hover.type === 'algorithm' && hover.id === m.a.id) || (sel && sel.type === 'algorithm' && sel.id === m.a.id);
        if (showLabels || forced) wanted.push({ hl, m, forced });
      }
      wanted.sort((a, b) => Number(b.forced) - Number(a.forced));
      for (const { hl, m, forced } of wanted) {
        const [sx, sy] = toScreen(m.x, m.y);
        if (sx < -60 || sx > w + 60 || sy < -20 || sy > h + 20) continue;
        const right = m.x >= hl.d.pos[0];
        const tx = sx + (right ? 8 : -8);
        const tw = g.measureText(m.a.name).width;
        const x0 = right ? tx - 2 : tx - tw - 2;
        const box = [x0, sy - 8, x0 + tw + 4, sy + 7];
        if (!forced && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
        placed.push(box);
        g.textAlign = right ? 'left' : 'right';
        g.fillStyle = alpha(pal.bg, 0.85);
        g.fillRect(x0, sy - 8, tw + 4, 15);
        g.fillStyle = forced ? pal.terracotta : pal.text2;
        g.fillText(m.a.name, tx, sy + 3.5);
      }
    }
  }

  /* ---- interaction ---- */
  function pick(sx, sy) {
    const [x, y] = toWorld(sx, sy);
    let best = null, bd = Infinity;
    const tol = 11 / cam.k;
    for (const hl of model.hills) for (const m of hl.markers) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < tol && d < bd) { bd = d; best = { type: 'algorithm', id: m.a.id }; }
    }
    if (best) return best;
    for (const hl of model.hills) {
      const d = Math.hypot(hl.d.pos[0] - x, (hl.d.pos[1] - y) / 0.9);
      if (d < hl.R && d < bd) { bd = d; best = { type: 'discipline', id: hl.d.id }; }
    }
    return best;
  }

  function animateTo(tx, ty, tk) {
    if (prefersReducedMotion()) { cam.x = tx; cam.y = ty; cam.k = tk; clampCam(); invalidate(); return; }
    const from = { ...cam }, t0 = performance.now(), dur = 520;
    cancelAnimationFrame(anim);
    const step = (t) => {
      const u = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - u, 3);
      cam.x = from.x + (tx - from.x) * e; cam.y = from.y + (ty - from.y) * e; cam.k = from.k + (tk - from.k) * e;
      clampCam(); draw();
      if (u < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function select(next, { fly = true, silent = false } = {}) {
    selected = next;
    if (next && fly) {
      if (next.type === 'discipline') { const p = model.hillById[next.id].d.pos; animateTo(p[0], p[1], Math.max(cam.k, fitK * 1.9)); }
      else if (model.markerById[next.id]) { const m = model.markerById[next.id]; animateTo(m.x, m.y, Math.max(cam.k, fitK * 2.4)); }
    }
    invalidate();
    if (!silent) onSelect(next);
  }
  const reset = () => { selected = null; animateTo(WORLD.w / 2, WORLD.h / 2, fitK); onSelect(null); };
  const zoomBy = (f, sx = w / 2, sy = h / 2) => {
    const [wx, wy] = toWorld(sx, sy);
    const k = Math.max(fitK * 0.9, Math.min(fitK * 7, cam.k * f));
    animateTo(wx - (sx - w / 2) / k, wy - (sy - h / 2) / k, k);
  };

  const pointers = new Map();
  let drag = null, pinch = null;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) drag = { start: local(e), cam: { ...cam }, moved: false };
    else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: cam.k }; drag = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cam.k = pinch.k * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d); clampCam(); invalidate();
      return;
    }
    if (drag) {
      const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) { cam.x = drag.cam.x - dx / cam.k; cam.y = drag.cam.y - dy / cam.k; clampCam(); canvas.style.cursor = 'grabbing'; invalidate(); }
      return;
    }
    const hit = pick(p[0], p[1]);
    const changed = (hit && hit.id) !== (hover && hover.id);
    hover = hit;
    canvas.style.cursor = hit ? 'pointer' : 'grab';
    if (hit) {
      const name = hit.type === 'discipline' ? C.disciplineById[hit.id].name : C.algoById[hit.id].name;
      const line = hit.type === 'discipline' ? C.disciplineById[hit.id].blurb : C.algoById[hit.id].summary;
      tip.innerHTML = `<b></b><span></span>`;
      tip.firstChild.textContent = name; tip.lastChild.textContent = line;
      tip.hidden = false;
      tip.style.left = Math.min(w - 250, Math.max(8, p[0] + 14)) + 'px';
      tip.style.top = Math.min(h - 90, p[1] + 16) + 'px';
    } else tip.hidden = true;
    if (changed) invalidate();
  });
  const end = (e) => {
    const wasDrag = drag && drag.moved;
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && !wasDrag && p && e.type === 'pointerup') { const hit = pick(p[0], p[1]); if (hit) select(hit); else if (selected) select(null, { fly: false }); }
    drag = null;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; invalidate(); });
  canvas.addEventListener('dblclick', (e) => { const p = local(e); zoomBy(1.7, p[0], p[1]); });
  canvas.addEventListener('wheel', (e) => {
    // Only take over the wheel when the visitor has clicked into the map or is holding a modifier,
    // so the page can still be scrolled past it.
    if (document.activeElement !== canvas && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const p = local(e);
    const [wx, wy] = toWorld(p[0], p[1]);
    cam.k *= Math.exp(-e.deltaY * 0.0016); clampCam();
    cam.x = wx - (p[0] - w / 2) / cam.k; cam.y = wy - (p[1] - h / 2) / cam.k; clampCam();
    invalidate();
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const step = 60 / cam.k;
    if (e.key === 'ArrowLeft') cam.x -= step; else if (e.key === 'ArrowRight') cam.x += step;
    else if (e.key === 'ArrowUp') cam.y -= step; else if (e.key === 'ArrowDown') cam.y += step;
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); return zoomBy(1.4); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); return zoomBy(1 / 1.4); }
    else if (e.key === '0') { e.preventDefault(); return reset(); }
    else return;
    e.preventDefault(); clampCam(); invalidate();
  });
  canvas.style.cursor = 'grab';
  // On touch screens a one-finger drag scrolls the page until the map has been tapped (focused).
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('focus', () => { canvas.style.touchAction = 'none'; host.classList.add('is-engaged'); });
  canvas.addEventListener('blur', () => { canvas.style.touchAction = 'pan-y'; host.classList.remove('is-engaged'); });

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const onTheme = () => invalidate();
  document.addEventListener('atlas:theme', onTheme);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(invalidate);
  resize();

  return {
    select, reset, zoomIn: () => zoomBy(1.5), zoomOut: () => zoomBy(1 / 1.5),
    get selected() { return selected; },
    destroy() { ro.disconnect(); document.removeEventListener('atlas:theme', onTheme); cancelAnimationFrame(raf); cancelAnimationFrame(anim); canvas.remove(); tip.remove(); },
  };
}
