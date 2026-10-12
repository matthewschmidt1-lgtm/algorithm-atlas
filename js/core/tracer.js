// The execution tracer. Every visualization on the site is produced by running a
// real implementation that reports to a Tracer; nothing is pre-scripted.
//
//   t.count('comparisons')          increments a named operation counter
//   t.frame(() => ({ ... }))        records a snapshot (skipped entirely in count-only mode)
//
// A frame is { line, note, views, vars }. See docs/AUTHORING.md.

const MAX_OPS = 4e7; // hard budget so a runaway input cannot freeze the tab

export class Tracer {
  constructor({ record = true, maxFrames = 5000 } = {}) {
    this.record = record;
    this.maxFrames = maxFrames;
    this.frames = [];
    this.counters = {};
    this.truncated = false;
    this.ops = 0;
  }

  count(name, by = 1) {
    this.counters[name] = (this.counters[name] || 0) + by;
    this.ops += by;
    if (this.ops > MAX_OPS) throw new Error('This run exceeded the operation budget. Try a smaller input.');
  }

  frame(make) {
    if (!this.record) return;
    if (this.frames.length >= this.maxFrames) { this.truncated = true; return; }
    const f = make();
    f.counters = { ...this.counters };
    this.frames.push(f);
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function parseList(text) {
  if (Array.isArray(text)) return text;
  const parts = String(text || '').split(/[\s,;]+/).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) throw new Error(`"${p}" is not a number.`);
    out.push(n);
  }
  return out;
}

export function defaultInput(algo) {
  const out = {};
  for (const f of algo.viz.inputs || []) out[f.id] = structuredCloneSafe(f.default);
  return out;
}

function structuredCloneSafe(v) {
  return Array.isArray(v) ? v.slice() : v;
}

// Merge a partial input with the declared defaults and coerce every field to its declared type.
export function resolveInput(algo, partial = {}) {
  const out = {};
  for (const f of algo.viz.inputs || []) {
    let v = partial[f.id] !== undefined ? partial[f.id] : f.default;
    switch (f.type) {
      case 'range':
      case 'number':
      case 'seed': {
        v = Number(v);
        if (!Number.isFinite(v)) v = Number(f.default) || 0;
        if (f.min !== undefined) v = Math.max(f.min, v);
        if (f.max !== undefined) v = Math.min(f.max, v);
        if (f.type === 'seed' || f.integer || (f.type === 'range' && f.scale !== 'log' && Number.isInteger(f.step ?? 1))) v = Math.round(v);
        break;
      }
      case 'list': {
        v = parseList(v);
        if (f.maxLength && v.length > f.maxLength) throw new Error(`${f.label}: at most ${f.maxLength} values.`);
        if (f.integer && v.some((x) => !Number.isInteger(x))) throw new Error(`${f.label}: whole numbers only.`);
        if (f.min !== undefined && v.some((x) => x < f.min)) throw new Error(`${f.label}: values must be at least ${f.min}.`);
        if (f.max !== undefined && v.some((x) => x > f.max)) throw new Error(`${f.label}: values must be at most ${f.max}.`);
        break;
      }
      case 'select': {
        const ok = (f.options || []).some((o) => o.value === v);
        if (!ok) v = f.default;
        break;
      }
      case 'toggle': v = Boolean(v); break;
      case 'cells': v = Array.isArray(v) ? v.slice() : []; break;
      case 'text': {
        v = String(v ?? '');
        if (f.maxLength && v.length > f.maxLength) v = v.slice(0, f.maxLength);
        break;
      }
      default: break;
    }
    out[f.id] = v;
  }
  // pass through anything undeclared (used by compare groups and tests)
  for (const k of Object.keys(partial)) if (!(k in out)) out[k] = partial[k];
  return out;
}

// Run an algorithm module's instrumented implementation.
// record:false runs in count-only mode (no frames), used for performance measurement.
// raw:true skips range clamping so experiments can use sizes larger than the interactive controls allow.
export function execute(algo, input = {}, { record = true, maxFrames, raw = false } = {}) {
  const t = new Tracer({ record, maxFrames });
  try {
    const resolved = raw ? { ...defaultInput(algo), ...input } : resolveInput(algo, input);
    const result = algo.viz.run(resolved, t);
    return { ok: true, frames: t.frames, result, counters: t.counters, truncated: t.truncated, input: resolved };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e), frames: t.frames, counters: t.counters, truncated: t.truncated };
  }
}

export { clamp };
