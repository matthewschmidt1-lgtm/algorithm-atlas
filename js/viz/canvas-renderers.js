// Canvas renderers: bars, graph, grid, scene. Each receives one frame's view data and paints it.
// View data formats are documented in docs/AUTHORING.md and validated by js/core/schema.js.

import { palette, roleColor, mix, alpha } from './theme.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function canvasRenderer({ height, draw, hit }) {
  return (host, opts = {}) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'viz-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);
    let last = null, w = 0, h = 0, raf = 0;
    const paint = () => {
      raf = 0;
      if (!last) return;
      const cw = Math.floor(host.clientWidth);
      if (cw <= 0) return;
      const ch = Math.round(height(last, cw, opts));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cw !== w || ch !== h || canvas.width !== Math.round(cw * dpr)) {
        w = cw; h = ch;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.height = h + 'px';
      }
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      draw(g, last, { w, h, pal: palette(), opts });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const ro = new ResizeObserver(schedule);
    ro.observe(host);
    const onTheme = () => schedule();
    document.addEventListener('atlas:theme', onTheme);
    if (hit) {
      canvas.addEventListener('click', (ev) => {
        if (!last || !opts.onCell || !last.editable) return;
        const r = canvas.getBoundingClientRect();
        const idx = hit(last, ev.clientX - r.left, ev.clientY - r.top, { w, h, opts });
        if (idx !== null) opts.onCell(idx, last);
      });
    }
    return {
      update(view) {
        last = view;
        canvas.style.cursor = hit && view.editable && opts.onCell ? 'pointer' : '';
        paint();
      },
      destroy() { ro.disconnect(); document.removeEventListener('atlas:theme', onTheme); if (raf) cancelAnimationFrame(raf); canvas.remove(); },
    };
  };
}

const font = (pal, px, mono = true, weight = 500) => `${weight} ${px}px ${mono ? pal.mono : pal.sans}`;

function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* ------------------------------------------------------------------ bars */

function drawBars(g, v, { w, h, pal, opts }) {
  const vals = v.values || [];
  const n = vals.length;
  if (!n) return;
  const compact = !!opts.compact;
  const padX = compact ? 8 : 14;
  const hasMarkers = !compact && (v.markers || []).length > 0;
  const markerH = hasMarkers ? 24 : 0;
  const auxH = v.aux ? Math.round(h * 0.3) : 0;
  const bw = (w - padX * 2) / n;
  const showLabels = !compact && v.labels !== false && bw >= 20;
  const labelH = showLabels ? 16 : 0;
  const top = 10 + labelH;
  const baseY = h - markerH - auxH - 6;
  const lo = Math.min(0, ...vals), hi = Math.max(1, ...vals, v.max || 0);
  const scale = (baseY - top) / (hi - lo || 1);
  const zeroY = baseY + lo * scale;
  const gap = bw > 10 ? Math.min(5, bw * 0.2) : bw > 4 ? 1 : 0;
  const roles = v.roles || {};

  if (v.range && v.range[1] >= v.range[0]) {
    const x0 = padX + v.range[0] * bw, x1 = padX + (v.range[1] + 1) * bw;
    g.fillStyle = alpha(pal.text2, 0.08);
    rrect(g, x0, 4, x1 - x0, baseY - 4 + 3, 3);
    g.fill();
  }
  for (let i = 0; i < n; i++) {
    const role = roles[i] || 'default';
    const x = padX + i * bw + gap / 2;
    const bh = Math.max(2, Math.abs(vals[i]) * scale);
    const y = vals[i] >= 0 ? zeroY - bh : zeroY;
    g.fillStyle = role === 'dim' ? alpha(pal.stone, 0.5) : roleColor(role, pal);
    rrect(g, x, y, Math.max(1, bw - gap), bh, Math.min(2, bw / 3));
    g.fill();
    if (showLabels) {
      g.fillStyle = role === 'default' || role === 'dim' ? pal.text2 : pal.text;
      g.font = font(pal, 11);
      g.textAlign = 'center';
      g.fillText(String(vals[i]), x + (bw - gap) / 2, y - 5);
    }
  }
  if (hasMarkers) {
    const at = new Map();
    for (const m of v.markers) {
      if (m.index < 0 || m.index >= n) continue;
      at.set(m.index, at.has(m.index) ? at.get(m.index) + ',' + m.label : m.label);
    }
    g.font = font(pal, 11, true, 600);
    g.textAlign = 'center';
    for (const [i, label] of at) {
      const cx = padX + i * bw + bw / 2;
      g.fillStyle = pal.text2;
      g.beginPath();
      g.moveTo(cx, baseY + 5); g.lineTo(cx - 3.5, baseY + 10); g.lineTo(cx + 3.5, baseY + 10);
      g.fill();
      g.fillStyle = pal.text;
      g.fillText(label, clamp(cx, 16, w - 16), baseY + 22);
    }
  }
  if (v.aux) {
    const ay = h - auxH + 12, ah = auxH - 22;
    g.fillStyle = pal.text3;
    g.font = font(pal, 10, true, 600);
    g.textAlign = 'left';
    g.fillText(String(v.aux.label || 'buffer').toUpperCase(), padX, ay - 2);
    const av = v.aux.values || [];
    const ar = v.aux.roles || {};
    for (let i = 0; i < av.length && i < n; i++) {
      const x = padX + i * bw + gap / 2;
      if (av[i] === null || av[i] === undefined) {
        g.fillStyle = alpha(pal.stone, 0.4);
        g.fillRect(x, ay + ah - 2, Math.max(1, bw - gap), 2);
        continue;
      }
      const bh = Math.max(2, (Math.abs(av[i]) / (hi - lo || 1)) * (ah - 6));
      g.fillStyle = roleColor(ar[i] || 'default', pal);
      rrect(g, x, ay + ah - bh, Math.max(1, bw - gap), bh, Math.min(3, bw / 3));
      g.fill();
    }
  }
}

export const bars = canvasRenderer({
  height: (v, w, opts) => (opts.compact ? clamp(w * 0.5, 130, 190) : clamp(w * 0.42, 220, 380) + (v.aux ? 70 : 0)),
  draw: drawBars,
});

/* ----------------------------------------------------------------- graph */

function drawGraph(g, v, { w, h, pal, opts }) {
  const compact = !!opts.compact;
  const nodes = v.nodes || [];
  const longLabels = nodes.some((n) => String(n.label ?? n.id).length > 2);
  const R = compact ? 10 : clamp(w / 34, 13, 19);
  const padX = R + (compact ? 8 : 22), padT = R + (compact ? 8 : 16), padB = R + (compact ? 14 : 28);
  const px = (x) => padX + x * (w - 2 * padX);
  const py = (y) => padT + y * (h - padT - padB);
  const pos = new Map(nodes.map((n) => [n.id, [px(n.x), py(n.y)]]));
  const labelFont = font(pal, compact ? 10 : 12, true, 600);

  // edges
  for (const e of v.edges || []) {
    const a = pos.get(e.u), b = pos.get(e.v);
    if (!a || !b) continue;
    const role = e.role || 'default';
    const strong = role !== 'default' && role !== 'dim';
    g.strokeStyle = role === 'default' ? alpha(pal.text2, 0.45) : role === 'dim' ? alpha(pal.text2, 0.16) : roleColor(role, pal);
    g.lineWidth = role === 'path' || role === 'tree' || role === 'done' ? 3 : strong ? 2.2 : 1.3;
    if (role === 'rejected') g.setLineDash([4, 4]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const x1 = a[0] + ux * R, y1 = a[1] + uy * R, x2 = b[0] - ux * R, y2 = b[1] - uy * R;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.setLineDash([]);
    if (v.directed || e.directed) {
      const s = compact ? 5 : 7;
      g.fillStyle = g.strokeStyle;
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - ux * s * 1.5 - uy * s * 0.75, y2 - uy * s * 1.5 + ux * s * 0.75);
      g.lineTo(x2 - ux * s * 1.5 + uy * s * 0.75, y2 - uy * s * 1.5 - ux * s * 0.75);
      g.closePath(); g.fill();
    }
    if (e.w !== undefined && e.w !== null && !compact) {
      // A little off the midpoint, so the labels of two edges that cross at their centres do not collide.
      const mx = a[0] + (b[0] - a[0]) * 0.4, my = a[1] + (b[1] - a[1]) * 0.4;
      const t = String(e.w);
      g.font = font(pal, 11);
      const tw = g.measureText(t).width + 8;
      g.fillStyle = pal.bg;
      rrect(g, mx - tw / 2, my - 8, tw, 16, 3); g.fill();
      g.fillStyle = strong ? roleColor(role, pal) : pal.text2;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, mx, my + 0.5);
      g.textBaseline = 'alphabetic';
    }
  }
  // nodes
  for (const n of nodes) {
    const [x, y] = pos.get(n.id);
    const role = n.role || 'default';
    const col = roleColor(role, pal);
    const filled = ['current', 'active', 'path', 'target', 'goal', 'on'].includes(role);
    const label = String(n.label ?? n.id);
    g.font = labelFont;
    const tw = longLabels ? Math.max(R * 2, g.measureText(label).width + 14) : R * 2;
    if (role === 'current' || role === 'active') {
      g.fillStyle = alpha(col, 0.2);
      rrect(g, x - tw / 2 - 5, y - R - 5, tw + 10, R * 2 + 10, R + 5); g.fill();
    }
    g.fillStyle = filled ? col : role === 'default' || role === 'dim' ? pal.surface : mix(pal.surface, col, 0.22);
    g.strokeStyle = role === 'default' ? alpha(pal.text2, 0.6) : role === 'dim' ? alpha(pal.text2, 0.22) : col;
    g.lineWidth = role === 'default' || role === 'dim' ? 1.3 : 2;
    rrect(g, x - tw / 2, y - R, tw, R * 2, R);
    g.fill(); g.stroke();
    g.fillStyle = filled ? pal.onFill : role === 'dim' ? pal.text3 : pal.text;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, x, y + 0.5);
    g.textBaseline = 'alphabetic';
    if (n.sub !== undefined && n.sub !== null && !compact) {
      const t = String(n.sub);
      g.font = font(pal, 11);
      const sw = g.measureText(t).width + 8;
      g.fillStyle = alpha(pal.bg, 0.9);
      rrect(g, x - sw / 2, y + R + 3, sw, 15, 3); g.fill();
      g.fillStyle = role === 'default' ? pal.text2 : col;
      g.fillText(t, x, y + R + 14.5);
    }
  }
}

export const graph = canvasRenderer({
  height: (v, w, opts) => (opts.compact ? clamp(w * 0.55, 150, 210) : clamp(w * (v.aspect || 0.58), 260, 460)),
  draw: drawGraph,
});

/* ------------------------------------------------------------------ grid */

function gridGeom(v, w, opts) {
  const maxH = opts.compact ? 190 : 440;
  const cell = Math.max(2, Math.floor(Math.min(w / v.cols, maxH / v.rows)));
  return { cell, gw: cell * v.cols, gh: cell * v.rows, ox: Math.floor((w - cell * v.cols) / 2) };
}

function drawGrid(g, v, { w, pal, opts }) {
  const { cell, ox } = gridGeom(v, w, opts);
  const gap = cell >= 7 ? 1 : 0;
  const rad = cell >= 12 ? 2 : cell >= 7 ? 1 : 0;
  const n = v.rows * v.cols;
  const emptyCol = mix(pal.surface, pal.surface3, 0.55);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / v.cols), c = i % v.cols;
    const x = ox + c * cell, y = r * cell;
    let fill;
    if (v.values) {
      const t = clamp(v.values[i], 0, 1);
      fill = v.palette === 'heat' ? mix(mix(pal.surface2, pal.ochre, Math.min(1, t * 2)), pal.terracotta, Math.max(0, t * 2 - 1)) : mix(pal.surface2, pal.text, t);
    } else {
      const role = (v.cells && v.cells[i]) || 'empty';
      if (role === 'empty') fill = emptyCol;
      else if (role === 'wall') fill = pal.wall;
      else if (role === 'visited') fill = pal.visited;
      else if (role === 'frontier') fill = pal.ochre;
      else fill = roleColor(role, pal);
    }
    g.fillStyle = fill;
    if (rad) { rrect(g, x + gap / 2, y + gap / 2, cell - gap, cell - gap, rad); g.fill(); } else g.fillRect(x, y, cell - gap, cell - gap);
  }
  if (v.labels && cell >= 20) {
    g.font = font(pal, Math.min(12, Math.floor(cell * 0.42)));
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const t = v.labels[i];
      if (t === undefined || t === null || t === '') continue;
      const role = (v.cells && v.cells[i]) || 'empty';
      if (v.values) g.fillStyle = clamp(v.values[i], 0, 1) > 0.55 ? pal.surface : pal.text;
      else g.fillStyle = ['empty', 'wall', 'visited', 'dim', 'default'].includes(role) ? pal.text2 : pal.onFill;
      g.fillText(String(t), ox + (i % v.cols) * cell + cell / 2, Math.floor(i / v.cols) * cell + cell / 2 + 0.5);
    }
    g.textBaseline = 'alphabetic';
  }
}

export const grid = canvasRenderer({
  height: (v, w, opts) => gridGeom(v, w, opts).gh,
  draw: drawGrid,
  hit: (v, x, y, { w, opts }) => {
    const { cell, ox } = gridGeom(v, w, opts);
    const c = Math.floor((x - ox) / cell), r = Math.floor(y / cell);
    if (c < 0 || c >= v.cols || r < 0 || r >= v.rows) return null;
    return r * v.cols + c;
  },
});

/* ----------------------------------------------------------------- scene */

function niceTicks(lo, hi, target = 5) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-6; t += step) out.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  return out;
}
const fmtTick = (t) => {
  const a = Math.abs(t);
  if (a >= 10000) return (t / 1000).toFixed(0) + 'k';
  if (a !== 0 && a < 0.01) return t.toExponential(0);
  return String(Math.round(t * 1000) / 1000);
};

function contourSegments(L, level) {
  // marching squares over an nx-by-ny sample grid, returns [x1,y1,x2,y2] in sample coordinates
  const { nx, ny, values } = L;
  const segs = [];
  const val = (i, j) => values[j * nx + i];
  const lerp = (a, b) => (level - a) / (b - a || 1e-12);
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = val(i, j), b = val(i + 1, j), c = val(i + 1, j + 1), d = val(i, j + 1);
      const code = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const T = [i + lerp(a, b), j], Rr = [i + 1, j + lerp(b, c)], B = [i + lerp(d, c), j + 1], Lf = [i, j + lerp(a, d)];
      const push = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
      switch (code) {
        case 1: case 14: push(Lf, T); break;
        case 2: case 13: push(T, Rr); break;
        case 3: case 12: push(Lf, Rr); break;
        case 4: case 11: push(Rr, B); break;
        case 6: case 9: push(T, B); break;
        case 7: case 8: push(Lf, B); break;
        case 5: push(Lf, T); push(Rr, B); break;
        case 10: push(T, Rr); push(Lf, B); break;
        default: break;
      }
    }
  }
  return segs;
}

function drawScene(g, v, { w, h, pal, opts }) {
  const compact = !!opts.compact;
  const axes = v.axes !== false && !compact;
  const m = { l: axes ? 46 : 8, r: 10, t: 10, b: axes ? (v.axes && v.axes.xLabel ? 40 : 26) : 8 };
  let [x0, x1] = v.x, [y0, y1] = v.y;
  let pw = w - m.l - m.r, ph = h - m.t - m.b, ox = m.l, oy = m.t;
  if (v.equal) {
    const s = Math.min(pw / (x1 - x0), ph / (y1 - y0));
    const nw = (x1 - x0) * s, nh = (y1 - y0) * s;
    ox += (pw - nw) / 2; oy += (ph - nh) / 2; pw = nw; ph = nh;
  }
  const X = (x) => ox + ((x - x0) / (x1 - x0)) * pw;
  const Y = (y) => oy + ph - ((y - y0) / (y1 - y0)) * ph;
  const col = (L, fb = 'default') => roleColor(L.role || fb, pal);

  if (axes) {
    g.font = font(pal, 10.5);
    g.lineWidth = 1;
    for (const t of niceTicks(x0, x1, w < 520 ? 4 : 7)) {
      g.strokeStyle = alpha(pal.text2, v.grid === false ? 0 : 0.1);
      g.beginPath(); g.moveTo(X(t), oy); g.lineTo(X(t), oy + ph); g.stroke();
      g.fillStyle = pal.text3; g.textAlign = 'center';
      g.fillText(fmtTick(t), X(t), oy + ph + 15);
    }
    for (const t of niceTicks(y0, y1, 5)) {
      g.strokeStyle = alpha(pal.text2, v.grid === false ? 0 : 0.09);
      g.beginPath(); g.moveTo(ox, Y(t)); g.lineTo(ox + pw, Y(t)); g.stroke();
      g.fillStyle = pal.text3; g.textAlign = 'right';
      g.fillText(fmtTick(t), ox - 7, Y(t) + 3.5);
    }
    g.strokeStyle = alpha(pal.text2, 0.3);
    g.strokeRect(ox + 0.5, oy + 0.5, pw - 1, ph - 1);
    if (v.axes && v.axes.xLabel) { g.fillStyle = pal.text2; g.textAlign = 'center'; g.font = font(pal, 11, false); g.fillText(v.axes.xLabel, ox + pw / 2, h - 6); }
    if (v.axes && v.axes.yLabel) {
      g.save(); g.translate(12, oy + ph / 2); g.rotate(-Math.PI / 2);
      g.fillStyle = pal.text2; g.textAlign = 'center'; g.font = font(pal, 11, false); g.fillText(v.axes.yLabel, 0, 0); g.restore();
    }
  }
  g.save();
  g.beginPath(); g.rect(ox, oy, pw, ph); g.clip();

  for (const L of v.layers || []) {
    g.globalAlpha = L.alpha ?? 1;
    g.setLineDash(L.dash ? (Array.isArray(L.dash) ? L.dash : [5, 5]) : []);
    g.lineWidth = L.width ?? 2;
    g.lineJoin = 'round'; g.lineCap = 'round';
    switch (L.type) {
      case 'heat': {
        const [hx0, hx1] = L.x || v.x, [hy0, hy1] = L.y || v.y;
        let lo = Infinity, hi = -Infinity;
        if (L.range) [lo, hi] = L.range; // a fixed scale, so shading means the same thing in every frame
        else for (const z of L.values) { if (z < lo) lo = z; if (z > hi) hi = z; }
        const cw = (X(hx1) - X(hx0)) / L.nx, ch = (Y(hy0) - Y(hy1)) / L.ny;
        for (let j = 0; j < L.ny; j++) for (let i = 0; i < L.nx; i++) {
          const t = clamp((L.values[j * L.nx + i] - lo) / (hi - lo || 1), 0, 1);
          g.fillStyle = mix(pal.surface, col(L, 'sage'), 0.04 + 0.6 * t);
          g.fillRect(X(hx0) + i * cw - 0.5, Y(hy0) - (j + 1) * ch - 0.5, cw + 1, ch + 1);
        }
        break;
      }
      case 'contour': {
        const [hx0, hx1] = L.x || v.x, [hy0, hy1] = L.y || v.y;
        let lo = Infinity, hi = -Infinity;
        for (const z of L.values) { if (z < lo) lo = z; if (z > hi) hi = z; }
        const levels = Array.isArray(L.levels) ? L.levels : Array.from({ length: L.levels || 10 }, (_, k) => {
          const t = (k + 1) / ((L.levels || 10) + 1);
          return lo + (hi - lo) * (L.spacing === 'linear' ? t : t * t); // quadratic spacing shows detail near minima
        });
        const sx = (i) => X(hx0 + (i / (L.nx - 1)) * (hx1 - hx0));
        const sy = (j) => Y(hy0 + (j / (L.ny - 1)) * (hy1 - hy0));
        g.lineWidth = L.width ?? 1;
        levels.forEach((level, k) => {
          g.strokeStyle = alpha(col(L, 'sage'), 0.95 - 0.55 * (k / levels.length));
          g.beginPath();
          for (const s of contourSegments(L, level)) { g.moveTo(sx(s[0]), sy(s[1])); g.lineTo(sx(s[2]), sy(s[3])); }
          g.stroke();
        });
        break;
      }
      case 'line': case 'polygon': {
        const pts = L.points || [];
        if (pts.length < 2) break;
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
        if (L.closed || L.type === 'polygon') g.closePath();
        if (L.fill) { g.fillStyle = alpha(col(L), L.fillAlpha ?? 0.14); g.fill(); }
        if (L.stroke !== false) { g.strokeStyle = col(L, 'terracotta'); g.stroke(); }
        break;
      }
      case 'band': {
        const up = L.upper || [], lowr = L.lower || [];
        if (up.length < 2) break;
        g.beginPath();
        up.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
        for (let i = lowr.length - 1; i >= 0; i--) g.lineTo(X(lowr[i][0]), Y(lowr[i][1]));
        g.closePath();
        g.fillStyle = alpha(col(L, 'terracotta'), L.fillAlpha ?? 0.16); g.fill();
        break;
      }
      case 'segments': {
        g.strokeStyle = col(L, 'muted');
        g.fillStyle = g.strokeStyle;
        g.lineWidth = L.width ?? 1.4;
        g.beginPath();
        for (const s of L.segments || []) { g.moveTo(X(s[0]), Y(s[1])); g.lineTo(X(s[2]), Y(s[3])); }
        g.stroke();
        if (L.arrow) for (const s of L.segments || []) {
          const ax = X(s[2]), ay = Y(s[3]);
          const dx = ax - X(s[0]), dy = ay - Y(s[1]);
          const len = Math.hypot(dx, dy);
          if (len < 3) continue;
          const ux = dx / len, uy = dy / len, a = Math.min(9, len * 0.5);
          g.beginPath(); g.moveTo(ax, ay);
          g.lineTo(ax - ux * a - uy * a * 0.5, ay - uy * a + ux * a * 0.5);
          g.lineTo(ax - ux * a + uy * a * 0.5, ay - uy * a - ux * a * 0.5);
          g.closePath(); g.fill();
        }
        break;
      }
      case 'points': {
        const base = L.r ?? (compact ? 2.5 : 3.5);
        for (const p of L.points || []) {
          const isArr = Array.isArray(p);
          const x = X(isArr ? p[0] : p.x), y = Y(isArr ? p[1] : p.y);
          const r = (!isArr && p.r) || base;
          const c = roleColor((!isArr && p.role) || L.role || 'terracotta', pal);
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
          if (L.hollow) { g.strokeStyle = c; g.lineWidth = 1.6; g.stroke(); } else { g.fillStyle = c; g.fill(); }
          if (L.ring) { g.strokeStyle = alpha(c, 0.35); g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.stroke(); }
          if (!isArr && p.label && !compact) {
            g.fillStyle = pal.text; g.font = font(pal, 11); g.textAlign = 'left';
            g.fillText(p.label, x + r + 4, y - r - 2);
          }
        }
        break;
      }
      case 'circle': {
        const r = L.pixels ? L.r : Math.abs(X(L.r) - X(0));
        g.beginPath(); g.arc(X(L.c[0]), Y(L.c[1]), r, 0, Math.PI * 2);
        if (L.fill) { g.fillStyle = alpha(col(L), L.fillAlpha ?? 0.14); g.fill(); }
        if (L.stroke !== false) { g.strokeStyle = col(L, 'muted'); g.stroke(); }
        break;
      }
      case 'rect': {
        const rx = X(L.x), ry = Y(L.y + L.h), rw = X(L.x + L.w) - rx, rh = Y(L.y) - ry;
        if (L.fill !== false) { g.fillStyle = alpha(col(L, 'wall'), L.fillAlpha ?? 0.9); g.fillRect(rx, ry, rw, rh); }
        if (L.stroke) { g.strokeStyle = col(L, 'muted'); g.strokeRect(rx, ry, rw, rh); }
        break;
      }
      case 'bars': {
        const xs = L.xs || [], hs = L.heights || [];
        const bw = L.barWidth ?? (xs.length > 1 ? Math.abs(xs[1] - xs[0]) * 0.8 : 1);
        for (let i = 0; i < xs.length; i++) {
          const c = roleColor((L.roles && L.roles[i]) || L.role || 'forest', pal);
          const bx = X(xs[i] - bw / 2), bwpx = Math.max(1, X(xs[i] + bw / 2) - bx);
          const y = Y(Math.max(0, hs[i])), y2 = Y(Math.min(0, hs[i]));
          g.fillStyle = c;
          g.fillRect(bx, y, bwpx, Math.max(1, y2 - y));
        }
        break;
      }
      case 'text': {
        g.fillStyle = col(L, 'text');
        g.font = font(pal, L.size || 11.5, L.mono !== false, 600);
        g.textAlign = L.align || 'left';
        g.fillText(String(L.text), X(L.at[0]) + (L.dx || 0), Y(L.at[1]) + (L.dy || 0));
        break;
      }
      default: break;
    }
  }
  g.restore();
  g.globalAlpha = 1;
  g.setLineDash([]);
}

export const scene = canvasRenderer({
  height: (v, w, opts) => (opts.compact ? clamp(w * 0.55, 150, 210) : clamp(w * (v.aspect || 0.56), v.aspect && v.aspect < 0.4 ? 130 : 240, 480)),
  draw: drawScene,
});
