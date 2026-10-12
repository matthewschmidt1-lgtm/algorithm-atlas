// The hero drawing: a quiet field sketch of the atlas as a network. Larger marks are
// disciplines, small ones are lessons, and each line joins a lesson to a discipline it
// belongs to or is used in, so the sketch is a true picture of the catalog. Small marks
// travel along the lines to suggest ideas moving between fields. Nodes lean gently away
// from the cursor and show their names when it comes close.
//
// The loop runs only while the hero is on screen and the tab is visible, and not at all
// when reduced motion is requested (a single still frame is drawn instead).

import { palette, alpha } from '../viz/theme.js';
import * as C from '../core/catalog.js';
import { prefersReducedMotion } from '../core/dom.js';

const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };

export function mountHeroNetwork(host) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  let w = 0, h = 0, dpr = 1, raf = 0, running = false, visible = true;
  const mouse = { x: -999, y: -999, on: false };

  // Disciplines keep their relative positions from the universe map; lessons orbit them.
  const nodes = [];
  const byId = {};
  for (const d of C.disciplines) {
    const n = { id: 'd:' + d.id, label: d.short, big: true, ux: d.pos[0] / 1000, uy: d.pos[1] / 660, ph: hash(d.id) * 6.28, color: C.GROUPS[d.group].color };
    nodes.push(n); byId[n.id] = n;
  }
  const edges = [];
  for (const a of C.algos) {
    const home = byId['d:' + a.discipline];
    const th = hash(a.id) * 6.28, rr = 0.045 + hash(a.id + 'r') * 0.05;
    const n = { id: a.id, label: a.name, big: false, ux: home.ux + rr * Math.cos(th), uy: home.uy + rr * 1.5 * Math.sin(th), ph: hash(a.id + 'p') * 6.28, color: home.color };
    nodes.push(n); byId[n.id] = n;
    edges.push({ a: n, b: home, strong: true });
    for (const o of a.alsoIn || []) if (byId['d:' + o.id]) edges.push({ a: n, b: byId['d:' + o.id], strong: false });
  }
  const seen = new Set();
  for (const d of C.disciplines) for (const r of d.related) {
    const key = [d.id, r.id].sort().join('|');
    if (seen.has(key)) continue; seen.add(key);
    edges.push({ a: byId['d:' + d.id], b: byId['d:' + r.id], strong: false, trunk: true });
  }
  const travellers = Array.from({ length: 16 }, (_, i) => ({ e: edges[Math.floor(hash('t' + i) * edges.length)], t: hash('s' + i), v: 0.05 + hash('v' + i) * 0.06 }));

  function layout() {
    // Keep the drawing to the right of the text on wide screens, and below it on narrow ones.
    const wide = w > 900;
    const x0 = wide ? w * 0.44 : w * 0.02, x1 = w * (wide ? 1.02 : 0.98);
    const y0 = wide ? h * 0.06 : Math.max(h * 0.5, h - 210), y1 = h * 0.98;
    for (const n of nodes) { n.bx = x0 + n.ux * (x1 - x0); n.by = y0 + n.uy * (y1 - y0); n.x = n.x ?? n.bx; n.y = n.y ?? n.by; }
  }

  function resize() {
    w = host.clientWidth; h = host.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    for (const n of nodes) { n.x = undefined; n.y = undefined; }
    layout();
    frame(performance.now(), true);
  }

  let last = 0;
  function frame(t, once = false) {
    raf = 0;
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    const pal = palette();
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const still = once && prefersReducedMotion();
    const time = still ? 0 : t / 1000;
    for (const n of nodes) {
      const amp = n.big ? 5 : 8;
      let tx = n.bx + Math.sin(time * 0.23 + n.ph) * amp, ty = n.by + Math.cos(time * 0.19 + n.ph * 1.7) * amp;
      n.near = 0;
      if (mouse.on) {
        const dx = tx - mouse.x, dy = ty - mouse.y, d = Math.hypot(dx, dy);
        if (d < 150) { const f = (1 - d / 150); n.near = f; tx += (dx / (d || 1)) * f * 16; ty += (dy / (d || 1)) * f * 16; }
      }
      n.x += (tx - n.x) * (once ? 1 : 0.08); n.y += (ty - n.y) * (once ? 1 : 0.08);
    }
    for (const e of edges) {
      const near = Math.max(e.a.near, e.b.near);
      g.strokeStyle = alpha(e.trunk ? pal.text3 : pal.sage, (e.trunk ? 0.2 : e.strong ? 0.5 : 0.26) + near * 0.4);
      g.lineWidth = e.trunk ? 0.8 : 1;
      if (e.trunk) g.setLineDash([2, 5]); else g.setLineDash([]);
      g.beginPath(); g.moveTo(e.a.x, e.a.y); g.lineTo(e.b.x, e.b.y); g.stroke();
    }
    g.setLineDash([]);
    if (!still) {
      for (const p of travellers) {
        p.t += p.v * dt * 4;
        if (p.t >= 1) { p.t = 0; p.e = edges[Math.floor(Math.random() * edges.length)]; }
        const x = p.e.a.x + (p.e.b.x - p.e.a.x) * p.t, y = p.e.a.y + (p.e.b.y - p.e.a.y) * p.t;
        g.fillStyle = alpha(pal.terracotta, 0.85 * Math.sin(Math.PI * p.t));
        g.beginPath(); g.arc(x, y, 2, 0, 6.3); g.fill();
      }
    }
    g.textAlign = 'left';
    for (const n of nodes) {
      const col = pal[n.color] || pal.forest;
      if (n.big) {
        g.strokeStyle = alpha(col, 0.35); g.lineWidth = 1;
        g.beginPath(); g.arc(n.x, n.y, 11 + n.near * 3, 0, 6.3); g.stroke();
        g.fillStyle = pal.bg; g.strokeStyle = col; g.lineWidth = 1.4;
        g.beginPath(); g.arc(n.x, n.y, 5.5, 0, 6.3); g.fill(); g.stroke();
        g.fillStyle = col; g.beginPath(); g.arc(n.x, n.y, 2, 0, 6.3); g.fill();
        if (w > 700 || n.near > 0.2) {
          g.font = `italic 12.5px ${pal.serif}`;
          g.fillStyle = alpha(pal.text2, 0.62 + n.near * 0.38);
          g.fillText(n.label, n.x + 16, n.y + 4);
        }
      } else {
        g.fillStyle = n.near > 0.25 ? pal.terracotta : pal.bg;
        g.strokeStyle = n.near > 0.25 ? pal.terracotta : alpha(pal.text3, 0.75); g.lineWidth = 1.1;
        g.beginPath(); g.arc(n.x, n.y, 2.6 + n.near * 1.6, 0, 6.3); g.fill(); g.stroke();
        if (n.near > 0.4) {
          g.font = `500 11.5px ${pal.sans}`;
          const tw = g.measureText(n.label).width;
          g.fillStyle = alpha(pal.bg, 0.9); g.fillRect(n.x + 8, n.y - 9, tw + 8, 17);
          g.fillStyle = pal.text; g.fillText(n.label, n.x + 12, n.y + 3.5);
        }
      }
    }
    if (running && !once) raf = requestAnimationFrame(frame);
  }

  const sync = () => {
    const want = visible && !document.hidden && !prefersReducedMotion();
    if (want && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); raf = 0; frame(performance.now(), true); }
    else if (!want) frame(performance.now(), true);
  };

  const onMove = (e) => { const r = host.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = mouse.y >= 0 && mouse.y <= h; if (!running) frame(performance.now(), true); };
  const onLeave = () => { mouse.on = false; if (!running) frame(performance.now(), true); };
  const section = host.parentElement || host;
  section.addEventListener('pointermove', onMove);
  section.addEventListener('pointerleave', onLeave);
  const ro = new ResizeObserver(resize); ro.observe(host);
  const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; sync(); }); io.observe(host);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('atlas:settings', sync);
  resize(); sync();

  return () => {
    running = false; cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    section.removeEventListener('pointermove', onMove); section.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', sync); document.removeEventListener('atlas:settings', sync);
    canvas.remove();
  };
}
