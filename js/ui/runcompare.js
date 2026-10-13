// What changed when the input changed. After a reader alters an input or picks a preset,
// this shows the counts of the new run beside the counts of the run that was on screen
// before, with the difference, and names the inputs that were changed.
//
// It compares only what can be compared: counts that both runs report under the same name,
// from two successful runs of the same algorithm. It never estimates a number. While a
// slider is being dragged, the comparison stays against the run that was showing before the
// drag began. A preset, a menu choice or a typed value is always a change of its own.

import { h, clear, fmt } from '../core/dom.js';

const QUIET = 700; // ms without a new run before the next change counts as a separate one

function describe(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'none';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (value === '' || value === undefined || value === null) return 'none';
  return typeof value === 'number' ? fmt(value) : String(value);
}

export function createRunCompare(player, algo) {
  const el = h('div.run-compare', { 'aria-live': 'polite', hidden: true });
  const labelOf = Object.fromEntries((algo.viz.inputs || []).map((f) => [f.id, f]));
  const snapshot = (res) => ({ counters: { ...res.counters }, input: JSON.parse(JSON.stringify(res.input)), preset: player.activePreset ? (player.activePreset || {}).label || null : null, steps: res.frames.length });
  let shown = null, base = null, timer = null;

  function changes(a, b) {
    const out = [];
    for (const f of algo.viz.inputs || []) {
      if (JSON.stringify(a.input[f.id]) === JSON.stringify(b.input[f.id])) continue;
      const opt = (v) => (f.options ? (f.options.find((o) => o.value === v) || {}).label || v : v);
      const name = f.label.replace(/^or\s+/i, '').replace(/^./, (c) => c.toLowerCase());
      out.push(`"${name}" from ${describe(opt(a.input[f.id]))} to ${describe(opt(b.input[f.id]))}`);
    }
    return out;
  }

  function paint() {
    clear(el);
    if (!base || !shown) { el.hidden = true; return; }
    const names = Object.keys(shown.counters).filter((k) => typeof shown.counters[k] === 'number' && typeof base.counters[k] === 'number');
    const what = changes(base, shown);
    if (!names.length || (!what.length && JSON.stringify(base.input) === JSON.stringify(shown.input))) { el.hidden = true; return; }
    el.hidden = false;
    const same = names.every((k) => shown.counters[k] === base.counters[k]);
    const parts = [
      h('p.run-compare-head', h('strong', 'What changed. '), shown.preset ? `Now running "${shown.preset}". ` : '', what.length ? `You changed ${what.slice(0, 3).join('; ')}${what.length > 3 ? `; and ${what.length - 3} more` : ''}.` : ''),
      h('div.data-table-wrap', h('table.data-table.run-compare-table',
        h('thead', h('tr', h('th', 'Count'), h('th', base.preset ? `Before ("${base.preset}")` : 'Before'), h('th', 'Now'), h('th', 'Difference'))),
        h('tbody', names.map((k) => {
          const was = base.counters[k], now = shown.counters[k], d = now - was;
          return h('tr', h('th', k), h('td.mono', fmt(was)), h('td.mono', fmt(now)), h('td.mono', { class: d === 0 ? 'is-same' : '' }, d === 0 ? 'no change' : `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`));
        })))),
      same ? h('p.small.muted', 'Every count is the same. This change did not alter how much work the algorithm did.') : null];
    el.append(...parts.filter(Boolean)); // append() would print a missing part as the word "null"
  }

  player.on('run', (res, meta = {}) => {
    if (!res || !res.ok || !res.frames.length) return; // a run that failed is not compared, and the last good run is kept
    const now = snapshot(res);
    if (!shown) { shown = now; return; }                 // the run the page opened with
    if (JSON.stringify(now.input) === JSON.stringify(shown.input)) return;
    if (!timer || !meta.continuous) base = shown;         // a new change begins: compare with what was on screen
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; }, QUIET);
    shown = now;
    paint();
  });
  if (player.run && player.run.ok) shown = snapshot(player.run);
  return { el, destroy() { clearTimeout(timer); } };
}
