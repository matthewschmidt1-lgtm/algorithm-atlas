// Runs in headless Chrome under tools/build.py. For every algorithm module it:
//   1. validates the record against the schema (js/core/schema.js)
//   2. executes viz.run on the default input, every preset and every declared test
//   3. validates the recorded frames (views, notes, pseudocode line references)
//   4. exercises the experiment at its smallest and largest size in count-only mode
//   5. runs the JavaScript code sample in the sandbox and compares it with code.sample.expected
// and reports back, including the Python and C++ sources for build.py to verify natively.

import { roster, CONCEPT_IDS } from '../content/roster.js';
import { disciplines } from '../content/disciplines.js';
import { labCategories } from '../content/lab-categories.js';
import { validateAlgorithm, validateFrames, catalogEntry } from '../js/core/schema.js';
import { execute } from '../js/core/tracer.js';
import { runJavaScript, normalizeOutput } from '../js/run/sandbox.js';
import { compareToFormula } from '../js/core/verify.js';

const params = new URLSearchParams(location.search);
const ids = (params.get('ids') || '').split(',').filter(Boolean);
const ctx = {
  ids: new Set(roster.map((r) => r.id)),
  disciplines: new Set(disciplines.map((d) => d.id)),
  concepts: new Set(CONCEPT_IDS),
  labs: new Set(labCategories.map((c) => c.id)),
};

async function checkOne(id) {
  const out = { id, errors: [], warnings: [], entry: null, code: null };
  let mod;
  try {
    mod = (await import(`../content/algorithms/${id}.js?v=${Date.now()}`)).default;
  } catch (e) {
    out.errors.push(`module failed to load: ${e.message}`);
    return out;
  }
  const { errors, warnings } = validateAlgorithm(mod, ctx, id);
  out.errors.push(...errors);
  out.warnings.push(...warnings);
  if (!ctx.ids.has(id)) out.errors.push(`"${id}" is not in content/roster.js`);
  if (!mod || !mod.viz || typeof mod.viz.run !== 'function' || !mod.logic || !Array.isArray(mod.logic.pseudocode)) return out;

  const pseudoLen = mod.logic.pseudocode.length;
  const runAndCheck = (label, input) => {
    const r = execute(mod, input);
    if (!r.ok) { out.errors.push(`${label}: run threw "${r.error}"`); return null; }
    const errs = [];
    validateFrames(r.frames, pseudoLen, label, (m) => errs.push(m));
    out.errors.push(...[...new Set(errs)].slice(0, 8));
    if (r.truncated) out.warnings.push(`${label}: trace was truncated at ${r.frames.length} frames`);
    return r;
  };

  const base = runAndCheck('default input', {});
  if (base) {
    out.frames = base.frames.length;
    if (base.frames.length < 4) out.warnings.push('default input yields fewer than 4 frames');
    if (base.frames.length > 1500) out.warnings.push(`default input yields ${base.frames.length} frames; consider a smaller default`);
    const kinds = new Set();
    for (const f of base.frames) for (const v of f.views) kinds.add(v.kind);
    out.views = [...kinds];
    if (typeof mod.viz.report === 'function') {
      try { const s = mod.viz.report(base.result, base.counters, base.input); if (typeof s !== 'string' || !s) out.errors.push('viz.report must return a non-empty string'); }
      catch (e) { out.errors.push(`viz.report threw: ${e.message}`); }
    } else out.warnings.push('no viz.report(result, counters): the output panel will fall back to raw JSON');
  }
  // The record of what was verified, shown to readers on the lesson and on the verification page.
  const checks = { tests: [], runs: 0, frames: 0, cost: [], costNote: '' };
  const tally = (r) => { if (r) { checks.runs++; checks.frames += r.frames.length; } };
  tally(base);
  for (const p of mod.viz.presets || []) tally(runAndCheck(`preset "${p.label}"`, p.values));
  for (const q of mod.quiz || []) {
    if (!q.tryInput) continue;
    const r = runAndCheck('quiz tryInput', q.tryInput);
    tally(r);
    // a predict question carries proof that its stated answer is what the run gives
    if (r && typeof q.check === 'function') {
      let verdict;
      try { verdict = q.check(r.result, r.counters, r); } catch (e) { verdict = `check threw: ${e.message}`; }
      if (verdict !== true) out.errors.push(`quiz predict "${String(q.q).slice(0, 60)}": the run does not give the stated answer${typeof verdict === 'string' ? ` (${verdict})` : ''}`);
      else checks.tests.push(`the predict question: ${String(q.q).slice(0, 70)}`);
    }
  }
  for (const tt of mod.viz.tryThis || []) if (tt && tt.input) tally(runAndCheck('try-this input', tt.input));
  if (mod.example && mod.example.tryInput) tally(runAndCheck('worked example', mod.example.tryInput));
  for (const t of mod.tests || []) {
    const r = execute(mod, t.input);
    if (!r.ok) { out.errors.push(`test "${t.name}": run threw "${r.error}"`); continue; }
    let verdict;
    try { verdict = t.check(r.result, r.counters, r); } catch (e) { verdict = `check threw: ${e.message}`; }
    if (verdict !== true) out.errors.push(`test "${t.name}" failed${typeof verdict === 'string' ? `: ${verdict}` : ''}`);
    else checks.tests.push(t.name);
  }
  const ex = mod.viz.experiment;
  if (ex) {
    // Run the real implementation at every declared size, then compare the counts with each stated formula.
    const variants = ex.variants && ex.variants.length ? ex.variants : [{ id: 'default', label: 'Measured' }];
    const measured = {};
    for (const variant of variants) {
      measured[variant.id] = [];
      for (const n of ex.sizes) {
        const t0 = performance.now();
        const r = execute(mod, ex.input(n, variant.id, 7), { record: false, raw: true });
        const ms = performance.now() - t0;
        if (!r.ok) out.errors.push(`experiment n=${n} ${variant.id}: run threw "${r.error}"`);
        else if (typeof r.counters[ex.metric] !== 'number') out.errors.push(`experiment n=${n} ${variant.id}: counter "${ex.metric}" was never counted`);
        else measured[variant.id].push([n, r.counters[ex.metric]]);
        if (ms > 1500) out.warnings.push(`experiment n=${n} ${variant.id} took ${Math.round(ms)} ms; reduce the largest size`);
      }
    }
    for (const th of ex.theory || []) {
      if (th.reference) continue;
      const variant = variants.find((v) => v.id === th.variant) || variants[0];
      const cmp = compareToFormula(measured[variant.id] || [], th.fn, { scaled: !!th.scaled, expected: !!th.expected });
      const round = (x) => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 1000) / 1000);
      checks.cost.push({ formula: th.label, series: variant.label, metric: ex.metricLabel, sizeLabel: ex.sizeLabel, relation: cmp.relation, detail: cmp.detail,
        rows: cmp.rows.map((r) => [r.n, round(r.m), th.scaled ? null : round(r.f)]) });
      if (cmp.relation === 'differs') out.errors.push(`experiment: measured "${ex.metric}" for "${variant.label}" ${cmp.detail}, so it does not support the stated formula "${th.label}". Fix the formula or the implementation, or mark the formula reference: true if it is drawn only for scale.`);
    }
    if (!checks.cost.length) checks.costNote = 'This lesson measures its behaviour but states no formula for the pipeline to compare it with.';
  } else {
    checks.costNote = 'This lesson has no size experiment, so its cost is argued in the text and was not measured.';
  }

  // code samples
  const c = mod.code || {};
  if (c.javascript && c.javascript.source && c.sample) {
    const expected = normalizeOutput(c.javascript.expected ?? c.sample.expected);
    const r = await runJavaScript(c.javascript.source, { timeout: 5000 });
    if (!r.ok) out.errors.push(`code.javascript failed to run: ${r.error}`);
    else if (normalizeOutput(r.out) !== expected) out.errors.push(`code.javascript output mismatch.\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(normalizeOutput(r.out))}`);
  }
  // Break-it lines: make each change to the JavaScript and confirm the program really behaves
  // differently. A change that leaves the output as it was teaches nothing.
  const usable = (b, lang) => b && b.find && typeof b.find[lang] === 'string' && b.replace && typeof b.replace[lang] === 'string' && c[lang] && c[lang].source && c[lang].source.split(b.find[lang]).length === 2;
  out.broken = [];
  for (const [i, b] of (c.breakIt || []).entries()) {
    if (!usable(b, 'javascript') || !c.sample) continue;
    const r = await runJavaScript(c.javascript.source.replace(b.find.javascript, b.replace.javascript), { timeout: 3000 });
    const got = r.ok ? normalizeOutput(r.out) : null;
    out.broken.push({ i, lang: 'javascript', ok: r.ok, out: r.ok ? got : `${r.timedOut ? 'did not finish within the time limit' : r.error}` });
    if (r.ok && got === normalizeOutput(c.javascript.expected ?? c.sample.expected)) out.errors.push(`code.breakIt[${i}] changes nothing in JavaScript: the program prints the same output. Choose sample inputs that expose the mistake.`);
    if (!r.ok && r.timedOut && !b.hangs) out.errors.push(`code.breakIt[${i}] makes the JavaScript program run for ever. Say so with hangs: true, or choose a change that finishes.`);
  }
  const more = [];
  for (const [i, x] of (c.more || []).entries()) {
    if (!x || !x.sample) continue;
    if (x.javascript && x.javascript.source) {
      const want = normalizeOutput(x.javascript.expected ?? x.sample.expected);
      const r = await runJavaScript(x.javascript.source, { timeout: 5000 });
      if (!r.ok) out.errors.push(`code.more[${i}].javascript failed to run: ${r.error}`);
      else if (normalizeOutput(r.out) !== want) out.errors.push(`code.more[${i}].javascript output mismatch.\n      expected: ${JSON.stringify(want)}\n      actual:   ${JSON.stringify(normalizeOutput(r.out))}`);
    }
    more.push({
      python: x.python && x.python.source ? { source: x.python.source, expected: x.python.expected ?? x.sample.expected } : null,
      cpp: x.cpp && x.cpp.source ? { source: x.cpp.source, expected: x.cpp.expected ?? x.sample.expected } : null,
    });
  }
  out.code = {
    python: c.python && c.python.source ? { source: c.python.source, expected: c.python.expected ?? (c.sample && c.sample.expected) } : null,
    cpp: c.cpp && c.cpp.source ? { source: c.cpp.source, expected: c.cpp.expected ?? (c.sample && c.sample.expected) } : null,
    more,
    // for build.py: the same break-it changes, made to the Python
    breakIt: (c.breakIt || []).map((b, i) => (usable(b, 'python') ? { i, source: c.python.source.replace(b.find.python, b.replace.python), hangs: !!b.hangs } : null)).filter(Boolean),
  };
  checks.languages = ['python', 'cpp'].filter((k) => out.code[k]).concat(c.javascript && c.javascript.source ? ['javascript'] : []);
  checks.morePrograms = more.length * 3;
  checks.brokenOnPurpose = (c.breakIt || []).length;
  checks.outputLines = c.sample && c.sample.expected ? c.sample.expected.split('\n').length : 0;
  out.checks = checks;
  if (!out.errors.length) {
    out.entry = catalogEntry(mod);
    out.entry.checks = checks;
    out.entry.views = out.views || [];
    out.entry.frames = out.frames || 0;
  }
  return out;
}

// The files around the lessons: glossary, paths, threads, compare groups, featured list.
// Every reference in them must resolve, and their prose must follow the house style.
async function checkSiteContent() {
  const out = { id: '(glossary, paths, threads, groups)', errors: [], warnings: [], entry: null, code: null, frames: 0, views: [] };
  const err = (m) => out.errors.push(m);
  const load = async (file) => { try { return await import(`../content/${file}?v=${Date.now()}`); } catch (e) { err(`content/${file} failed to load: ${e.message}`); return {}; } };
  const okRef = (ref) => (ref.startsWith('concept:') ? ctx.concepts.has(ref.slice(8)) : ref.startsWith('discipline:') ? ctx.disciplines.has(ref.slice(11)) : ctx.ids.has(ref));
  const dash = (text, where) => { if (typeof text === 'string' && /\u2014|\s\u2013\s/.test(text)) err(`${where}: contains an em dash`); };
  const walk = (node, where) => { if (typeof node === 'string') dash(node, where); else if (Array.isArray(node)) node.forEach((x) => walk(x, where)); else if (node && typeof node === 'object') Object.values(node).forEach((x) => walk(x, where)); };

  const { concepts = [] } = await load('concepts.js');
  const cids = concepts.map((c) => c.id);
  for (const id of CONCEPT_IDS) if (!cids.includes(id)) err(`concepts.js: no entry for "${id}"`);
  for (const c of concepts) {
    if (!ctx.concepts.has(c.id)) err(`concepts.js: "${c.id}" is not in CONCEPT_IDS`);
    for (const k of ['name', 'simple', 'precise']) if (!c[k]) err(`concepts.js: ${c.id} is missing ${k}`);
    for (const s of c.see || []) if (!ctx.ids.has(s)) err(`concepts.js: ${c.id} sees unknown lesson "${s}"`);
    for (const r of c.related || []) if (!ctx.concepts.has(r)) err(`concepts.js: ${c.id} relates to unknown concept "${r}"`);
    walk(c, `concepts.js ${c.id}`);
  }
  const { paths = [] } = await load('paths.js');
  const pids = new Set(paths.map((p) => p.id));
  for (const p of paths) {
    if (!p.stages || !p.stages.length) err(`paths.js: ${p.id} has no stages`);
    for (const s of p.stages || []) {
      for (const m of s.modules || []) if (!ctx.ids.has(m.algo)) err(`paths.js: ${p.id} / ${s.id} lists unknown lesson "${m.algo}"`);
      for (const c of s.concepts || []) if (!ctx.concepts.has(c)) err(`paths.js: ${p.id} / ${s.id} lists unknown concept "${c}"`);
    }
    for (const n of p.next || []) if (!pids.has(n.path)) err(`paths.js: ${p.id} points to unknown path "${n.path}"`);
    for (const q of p.prerequisites || []) if (q.path && !pids.has(q.path)) err(`paths.js: ${p.id} prerequisite names unknown path "${q.path}"`);
    walk(p, `paths.js ${p.id}`);
  }
  const { threads = [] } = await load('connections.js');
  for (const t of threads) { for (const s of t.stops) if (!okRef(s.ref)) err(`connections.js: ${t.id} has unknown stop "${s.ref}"`); walk(t, `connections.js ${t.id}`); }
  const { compareGroups = [] } = await load('compare-groups.js');
  for (const g of compareGroups) for (const m of g.members) if (!ctx.ids.has(m)) err(`compare-groups.js: ${g.id} lists unknown lesson "${m}"`);
  const { featured = [] } = await load('featured.js');
  for (const f of featured) if (!ctx.ids.has(f.id)) err(`featured.js: unknown lesson "${f.id}"`);
  for (const d of disciplines) { for (const r of d.related) if (!ctx.disciplines.has(r.id)) err(`disciplines.js: ${d.id} relates to unknown "${r.id}"`); walk(d, `disciplines.js ${d.id}`); }
  return out;
}

(async () => {
  const results = [];
  for (const id of ids) {
    try { results.push(await checkOne(id)); }
    catch (e) { results.push({ id, errors: [`validator crashed: ${e.message}`], warnings: [] }); }
  }
  if (params.get('full') === '1') results.push(await checkSiteContent());
  const missing = roster.filter((r) => r.status === 'published' && !ids.includes(r.id)).map((r) => r.id);
  const payload = { results, missing, conceptIds: CONCEPT_IDS };
  document.getElementById('out').textContent = JSON.stringify(payload.results.map((r) => ({ id: r.id, errors: r.errors, warnings: r.warnings })), null, 2);
  try { await fetch('/__report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch { /* opened by hand */ }
  document.title = 'done';
})();
