// Charts for measured behaviour. Every measured point comes from running the lesson's own
// implementation in this browser in count-only mode. Theory curves are formulas and are
// drawn dashed, so the two are never confused.

import { h, clear, fmt, esc } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { execute } from '../core/tracer.js';
import { SERIES } from '../viz/theme.js';

const COLOR_VAR = { forest: '--viz-forest', terracotta: '--viz-terracotta', ochre: '--viz-ochre', moss: '--viz-moss', ink: '--viz-ink', brick: '--viz-brick', sage: '--viz-sage' };
export const seriesColor = (i) => `var(${COLOR_VAR[SERIES[i % SERIES.length]]})`;

function ticks(lo, hi, count = 5) {
  const span = hi - lo; if (!(span > 0)) return [lo];
  const raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = []; for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-6; t += step) out.push(t);
  return out;
}
const short = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M' : Math.abs(v) >= 1e4 ? Math.round(v / 1e3) + 'k' : fmt(Math.round(v * 100) / 100));

// series: [{ label, color, points: [[x, y]], dashed }]
export function lineChart({ series, xLabel, yLabel, log = false, height = 300 }) {
  const W = 720, H = height, m = { l: 62, r: 16, t: 14, b: 46 };
  const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p[1]) && (!log || (p[0] > 0 && p[1] > 0)));
  if (!all.length) return '<p class="muted small">Nothing to plot.</p>';
  const tx = (v) => (log ? Math.log10(v) : v), ty = tx;
  let x0 = Math.min(...all.map((p) => tx(p[0]))), x1 = Math.max(...all.map((p) => tx(p[0])));
  let y0 = log ? Math.min(...all.map((p) => ty(p[1]))) : 0, y1 = Math.max(...all.map((p) => ty(p[1])));
  if (x1 === x0) x1 = x0 + 1; if (y1 === y0) y1 = y0 + 1;
  if (log) { y0 = Math.floor(y0); y1 = Math.ceil(y1 + 0.02); } else y1 *= 1.06;
  const X = (v) => m.l + ((tx(v) - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((ty(v) - y0) / (y1 - y0)) * (H - m.t - m.b);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)} against ${esc(xLabel)}">`;
  const yt = log ? Array.from({ length: y1 - y0 + 1 }, (_, i) => Math.pow(10, y0 + i)) : ticks(0, y1, 5);
  for (const t of yt) { const y = Y(t); s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="var(--line)" /><text x="${m.l - 8}" y="${y + 4}" text-anchor="end">${short(t)}</text>`; }
  const xs = [...new Set(series.filter((q) => !q.dashed).flatMap((q) => q.points.map((p) => p[0])))].sort((a, b) => a - b);
  const xt = xs.length && xs.length <= 9 ? xs : (log ? [] : ticks(Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0])), 6));
  let lastX = -99;
  for (const t of xt) { const x = X(t); if (x - lastX < 34) continue; lastX = x; s += `<line x1="${x}" x2="${x}" y1="${H - m.b}" y2="${H - m.b + 5}" stroke="var(--line-2)"/><text x="${x}" y="${H - m.b + 19}" text-anchor="middle">${short(t)}</text>`; }
  s += `<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}" stroke="var(--line-2)"/><line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}" stroke="var(--line-2)"/>`;
  s += `<text class="axis-label" x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle">${esc(xLabel)}${log ? ' (log scale)' : ''}</text>`;
  s += `<text class="axis-label" transform="translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}${log ? ' (log scale)' : ''}</text>`;
  for (const q of series) {
    const pts = q.points.filter((p) => Number.isFinite(p[1]) && (!log || (p[0] > 0 && p[1] > 0)));
    if (!pts.length) continue;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Math.max(m.t - 40, Y(p[1])).toFixed(1)}`).join('');
    s += `<path d="${d}" fill="none" stroke="${q.color}" stroke-width="${q.dashed ? 1.4 : 2}" ${q.dashed ? 'stroke-dasharray="5 5"' : ''} stroke-linejoin="round" clip-path="inset(0)"/>`;
    if (!q.dashed) for (const p of pts) s += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.4" fill="var(--bg)" stroke="${q.color}" stroke-width="1.8"><title>${esc(q.label)}: ${fmt(p[1])} at ${fmt(p[0])}</title></circle>`;
  }
  return s + '</svg>';
}

export function legend(series) {
  return h('div.chart-legend', series.map((q) => h('span', h(`i${q.dashed ? '.dashed' : ''}`, { style: { '--c': q.color } }), q.label)));
}

// The experiment declared by a lesson (viz.experiment), measured live.
export function createExperimentChart(lesson) {
  const ex = lesson.viz.experiment;
  const variants = ex.variants && ex.variants.length ? ex.variants : [{ id: 'default', label: 'Measured' }];
  const chartEl = h('div.chart');
  const legendEl = h('div');
  const tableEl = h('div');
  let log = false, data = null, running = false;
  const runBtn = h('button.btn.btn-sm', { type: 'button', html: `${icon('reset', { size: 14 })}<span>Measure again</span>`, disabled: true });
  const linBtn = h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => { log = false; paint(); } }, 'Linear');
  const logBtn = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { log = true; paint(); } }, 'Log scale');

  function paint() {
    linBtn.setAttribute('aria-pressed', log ? 'false' : 'true'); logBtn.setAttribute('aria-pressed', log ? 'true' : 'false');
    if (!data) return;
    const series = variants.map((v, i) => ({ label: `${v.label} (measured)`, color: seriesColor(i), points: data[v.id] }));
    (ex.theory || []).forEach((th, k) => {
      const vi = Math.max(0, variants.findIndex((v) => v.id === th.variant));
      const ref = data[variants[vi].id];
      let scale = 1;
      if (th.scaled && ref && ref.length) { const last = ref[ref.length - 1]; const base = th.fn(last[0]); scale = base ? last[1] / base : 1; }
      const lo = ex.sizes[0], hi = ex.sizes[ex.sizes.length - 1];
      const pts = Array.from({ length: 41 }, (_, j) => { const x = log ? lo * Math.pow(hi / lo, j / 40) : lo + (hi - lo) * (j / 40); return [x, th.fn(x) * scale]; });
      series.push({ label: `${th.label} (${th.reference ? 'for reference' : 'formula'})`, color: th.variant ? seriesColor(vi) : `var(${['--text-3', '--text-2'][k % 2]})`, points: pts, dashed: true });
    });
    chartEl.innerHTML = lineChart({ series, xLabel: ex.sizeLabel, yLabel: ex.metricLabel, log });
    clear(legendEl).append(legend(series));
    clear(tableEl).append(h('details.fold', h('summary', 'Show the measured numbers'), h('div.fold-body.data-table-wrap',
      h('table.data-table', h('thead', h('tr', h('th', ex.sizeLabel), variants.map((v) => h('th', v.label)))),
        h('tbody', ex.sizes.map((n, r) => h('tr', h('th', fmt(n)), variants.map((v) => h('td.mono', data[v.id][r] ? fmt(data[v.id][r][1]) : 'n/a')))))))));
  }

  function measure() {
    if (running) return;
    running = true; runBtn.disabled = true;
    chartEl.innerHTML = '<p class="muted small">Measuring. Each point is a real run.</p>';
    data = Object.fromEntries(variants.map((v) => [v.id, []]));
    const jobs = variants.flatMap((v) => ex.sizes.map((n) => ({ v, n })));
    let i = 0;
    const next = () => {
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 30) {
        const { v, n } = jobs[i++];
        const r = execute(lesson, ex.input(n, v.id, 7), { record: false, raw: true });
        if (r.ok && typeof r.counters[ex.metric] === 'number') data[v.id].push([n, r.counters[ex.metric]]);
      }
      if (i < jobs.length) setTimeout(next, 0);
      else { running = false; runBtn.disabled = false; paint(); }
    };
    setTimeout(next, 0);
  }
  runBtn.addEventListener('click', measure);

  const el = h('figure.experiment',
    h('div.chart-tools', h('h3.experiment-title', ex.title || 'Measured behaviour'), h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('div.seg', { role: 'group', 'aria-label': 'Axis scale' }, linBtn, logBtn), runBtn)),
    chartEl, legendEl,
    h('figcaption.fig-cap', h('b', 'Measured here'), ex.note || 'Counts of operations from real runs of this page\'s implementation in your browser. These are not timings.'),
    tableEl);
  const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); measure(); } }, { rootMargin: '200px' });
  io.observe(el);
  return { el, destroy() { io.disconnect(); } };
}
