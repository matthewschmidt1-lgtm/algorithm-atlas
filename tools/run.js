// Runs one lesson's demonstration on the inputs given and reports what it did.
// Opened by tools/run.py. It answers one question for an author: "what does the page's own
// implementation do on this input?", so that a quiz answer or a prompt is never a guess.

import { execute } from '../js/core/tracer.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');
const inputs = JSON.parse(params.get('inputs') || '[{}]');

// results can hold large tables; keep the report readable
const trim = (v, depth = 0) => {
  if (typeof v === 'number') return Number.isInteger(v) ? v : Number(v.toPrecision(8));
  if (Array.isArray(v)) return v.length > 40 ? [...v.slice(0, 40).map((x) => trim(x, depth + 1)), `… ${v.length - 40} more`] : v.map((x) => trim(x, depth + 1));
  if (v && typeof v === 'object') return depth > 3 ? '{…}' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, depth + 1)]));
  return v;
};

(async () => {
  const out = [];
  try {
    const mod = (await import(`../content/algorithms/${id}.js?v=${Date.now()}`)).default;
    out.push({ presets: (mod.viz.presets || []).map((p) => ({ label: p.label, values: p.values })), inputs: mod.viz.inputs.map((f) => ({ id: f.id, type: f.type, default: f.default, min: f.min, max: f.max, options: f.options && f.options.map((o) => o.value) })) });
    for (const input of inputs) {
      const r = execute(mod, input);
      if (!r.ok) { out.push({ input, error: r.error }); continue; }
      let report = '';
      try { report = typeof mod.viz.report === 'function' ? mod.viz.report(r.result, r.counters, r.input) : ''; } catch (e) { report = `report threw: ${e.message}`; }
      const last = r.frames[r.frames.length - 1];
      out.push({ input, report, counters: r.counters, steps: r.frames.length, lastNote: last ? last.note : '', result: trim(r.result) });
    }
  } catch (e) { out.push({ error: `could not load or run "${id}": ${e.message}` }); }
  document.getElementById('out').textContent = JSON.stringify(out, null, 2);
  try { await fetch('/__report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }); } catch { /* opened by hand */ }
})();
