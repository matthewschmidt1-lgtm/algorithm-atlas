// The content schema for an algorithm record, and the validator the content pipeline runs
// (tools/build.py). Nothing reaches the catalog unless it passes.
//
// The full authoring guide is docs/AUTHORING.md. Shape of a record (default export of
// content/algorithms/<id>.js):
//
//   meta          catalog metadata: identity, taxonomy, difficulty, complexity classes, tags
//   bigIdea       simple (The Simple Explanation) / when / interesting / analogy (+ limits)
//   example       a worked example by hand: setup, steps, result
//   terms         plain-language definitions of every technical word the lesson relies on
//   takeaway      one sentence a beginner could repeat
//   viz           B+C. describe, inputs, presets, tryThis, run(input, t), report(), experiment
//   logic         D. intuition, steps, pseudocode, decisions, invariants, edgeCases, correctness, mistakes
//   code          E. sample {input, expected} + python / javascript / cpp sources
//   complexity    F. summary, cases, space, memory, tradeoffs, assumptions
//   tradeoffs     G. struggles, pitfalls, misunderstandings, constraints, alternatives, comparison
//   applications  H. [{ title, text, status }]
//   connections   I. [{ to, type, why }]
//   quiz          J. [{ type, q, options, answer, explain }]
//   compare       side-by-side facts: idea, requires, sensitivity, memory, difficulty, limits, useWhen
//   advanced      history, derivation, proof, complexityProof, variants, implementation, benchmarking, references, furtherReading
//   tests         [{ name, input, check(result, counters) }]
//
// Lessons are read at three levels that explain the same idea at increasing depth:
//   1  Explain it simply     bigIdea.simple, analogy, example, the visualization, terms
//   2  Help me understand    logic, experiments, code, why it matters, what could go wrong, quiz
//   3  Go deeper             complexity, correctness, derivations, proofs, alternatives, history, references
// Each field is shown in exactly one place. Do not restate one field's content in another.
//
// viz.experiment.theory formulas are compared with measured counts by the pipeline (js/core/verify.js).
// A formula that the measurements contradict fails the lesson. Mark a curve reference: true if it is
// drawn for scale only, and expected: true if it is an average over random inputs.

import { ROLES } from '../viz/theme.js';

export const KINDS = ['algorithm', 'data-structure', 'heuristic', 'model', 'protocol', 'paradigm', 'architecture'];
export const KIND_LABELS = {
  algorithm: 'Algorithm', 'data-structure': 'Data structure', heuristic: 'Heuristic', model: 'Model',
  protocol: 'Protocol', paradigm: 'Paradigm', architecture: 'Architecture',
};
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
export const TIME_CLASSES = ['constant', 'logarithmic', 'linear', 'linearithmic', 'quadratic', 'cubic', 'polynomial', 'pseudo-polynomial', 'exponential', 'iterative'];
// One vocabulary for cost, used everywhere a lesson's cost is shown. `time.class` names how the
// work typically grows with the size of the input. `time.worst` gives the worst case in full.
// Neither says anything about the approach (greedy, dynamic programming and so on), which is
// `paradigms` and is always shown under its own label.
export const TIME_CLASS_LABELS = {
  constant: 'Constant, O(1)', logarithmic: 'Logarithmic, O(log n)', linear: 'Linear, O(n)', linearithmic: 'Just above linear, O(n log n)', quadratic: 'Quadratic, O(n²)',
  cubic: 'Cubic, O(n³)', polynomial: 'Higher polynomial', 'pseudo-polynomial': 'Grows with the size of the numbers', exponential: 'Exponential', iterative: 'Set by the number of steps run',
};
// The same, short enough for a row, and in words a non-specialist can read.
export const TIME_CLASS_SHORT = {
  constant: 'Constant time', logarithmic: 'Logarithmic time', linear: 'Linear time', linearithmic: 'n log n time', quadratic: 'Quadratic time',
  cubic: 'Cubic time', polynomial: 'Polynomial time', 'pseudo-polynomial': 'Time grows with the numbers', exponential: 'Exponential time', iterative: 'Time set by steps run',
};
export const TIME_CLASS_PLAIN = {
  constant: 'The same amount of work however large the input.', logarithmic: 'Doubling the input adds one more step.', linear: 'Twice the input, twice the work.',
  linearithmic: 'Twice the input, a little more than twice the work.', quadratic: 'Twice the input, four times the work.', cubic: 'Twice the input, eight times the work.',
  polynomial: 'The work grows as a higher power of the input.', 'pseudo-polynomial': 'The work grows with how large the numbers are, not only with how many there are.',
  exponential: 'Each extra item can multiply the work.', iterative: 'The work is the number of steps you choose to run, and no fixed number is guaranteed to be enough.',
};
export const SPACE_CLASSES = ['constant', 'logarithmic', 'linear', 'quadratic', 'other'];
export const SPACE_CLASS_LABELS = { constant: 'O(1)', logarithmic: 'O(log n)', linear: 'O(n)', quadratic: 'O(n²)', other: 'Other' };
export const PARADIGMS = [
  'brute-force', 'divide-and-conquer', 'greedy', 'dynamic-programming', 'graph-search', 'incremental',
  'iterative-refinement', 'gradient-based', 'local-search', 'evolutionary', 'randomized-sampling',
  'number-theoretic', 'probabilistic-inference', 'hashing', 'transform', 'quantum',
];
export const PARADIGM_LABELS = {
  'brute-force': 'Brute force', 'divide-and-conquer': 'Divide and conquer', greedy: 'Greedy',
  'dynamic-programming': 'Dynamic programming', 'graph-search': 'Graph search', incremental: 'Incremental',
  'iterative-refinement': 'Iterative refinement', 'gradient-based': 'Gradient-based', 'local-search': 'Local search',
  evolutionary: 'Evolutionary', 'randomized-sampling': 'Randomized sampling', 'number-theoretic': 'Number-theoretic',
  'probabilistic-inference': 'Probabilistic inference', hashing: 'Hashing', transform: 'Transform', quantum: 'Quantum',
};
export const CONNECTION_TYPES = ['prerequisite', 'related', 'variant', 'same-problem', 'advanced', 'application'];
export const CONNECTION_LABELS = {
  prerequisite: 'Prerequisite', related: 'Related idea', variant: 'Variant', 'same-problem': 'Solves a similar problem',
  advanced: 'Go further', application: 'Applied in',
};
export const APPLICATION_STATUS = ['established', 'illustrative'];
export const QUIZ_TYPES = ['choice', 'predict', 'debug', 'challenge'];
export const INPUT_TYPES = ['range', 'select', 'seed', 'number', 'list', 'text', 'toggle', 'cells'];
export const VIEW_KINDS = ['bars', 'graph', 'grid', 'scene', 'table', 'rows', 'board'];
export const LANGUAGES = ['python', 'javascript', 'cpp'];
export const LANGUAGE_LABELS = { python: 'Python', javascript: 'JavaScript', cpp: 'C++' };
const SCENE_LAYERS = ['heat', 'contour', 'line', 'polygon', 'band', 'segments', 'points', 'circle', 'rect', 'bars', 'text'];

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isArr = (v) => Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkRole(role, where, err) {
  if (role !== undefined && role !== null && !ROLES.includes(role)) err(`${where}: unknown role "${role}"`);
}

export function validateView(v, where, err) {
  if (!v || !VIEW_KINDS.includes(v.kind)) return err(`${where}: view.kind must be one of ${VIEW_KINDS.join(', ')}`);
  switch (v.kind) {
    case 'bars':
      if (!isArr(v.values) || v.values.some((x) => !isNum(x))) err(`${where}: bars.values must be numbers`);
      for (const r of Object.values(v.roles || {})) checkRole(r, where, err);
      for (const m of v.markers || []) if (!Number.isInteger(m.index) || !isStr(String(m.label ?? ''))) err(`${where}: bars.markers need { index, label }`);
      break;
    case 'graph': {
      if (!isArr(v.nodes) || !isArr(v.edges)) { err(`${where}: graph needs nodes and edges`); break; }
      const ids = new Set();
      for (const n of v.nodes) {
        if (n.id === undefined || !isNum(n.x) || !isNum(n.y)) err(`${where}: graph node needs id, x, y`);
        else if (n.x < -0.01 || n.x > 1.01 || n.y < -0.01 || n.y > 1.01) err(`${where}: graph node ${n.id} position must be within [0,1]`);
        ids.add(n.id);
        checkRole(n.role, where, err);
      }
      for (const e of v.edges) {
        if (!ids.has(e.u) || !ids.has(e.v)) err(`${where}: graph edge ${e.u}-${e.v} references a missing node`);
        checkRole(e.role, where, err);
      }
      break;
    }
    case 'grid': {
      if (!Number.isInteger(v.rows) || !Number.isInteger(v.cols)) { err(`${where}: grid needs integer rows and cols`); break; }
      const n = v.rows * v.cols;
      if (!v.cells && !v.values) err(`${where}: grid needs cells (roles) or values (0..1)`);
      if (v.cells && v.cells.length !== n) err(`${where}: grid.cells length ${v.cells.length} != rows*cols ${n}`);
      if (v.values && v.values.length !== n) err(`${where}: grid.values length ${v.values.length} != rows*cols ${n}`);
      if (v.cells) for (const r of new Set(v.cells)) checkRole(r, where, err);
      break;
    }
    case 'scene':
      if (!isArr(v.x) || !isArr(v.y) || !(v.x[1] > v.x[0]) || !(v.y[1] > v.y[0])) err(`${where}: scene needs x:[min,max] and y:[min,max]`);
      if (!isArr(v.layers)) { err(`${where}: scene needs layers`); break; }
      for (const L of v.layers) {
        if (!SCENE_LAYERS.includes(L.type)) err(`${where}: unknown scene layer type "${L.type}"`);
        checkRole(L.role, where, err);
        if ((L.type === 'heat' || L.type === 'contour') && (!L.values || L.values.length !== L.nx * L.ny)) err(`${where}: ${L.type} layer needs nx*ny values`);
      }
      break;
    case 'table':
      if (!isArr(v.cells) || v.cells.some((r) => !isArr(r))) err(`${where}: table.cells must be a 2D array`);
      for (const r of Object.values(v.roles || {})) checkRole(r, where, err);
      break;
    case 'rows':
      if (!isArr(v.rows)) { err(`${where}: rows.rows must be an array`); break; }
      for (const row of v.rows) {
        if (!isArr(row.cells)) err(`${where}: each row needs cells`);
        else for (const c of row.cells) if (c && typeof c === 'object') checkRole(c.role, where, err);
      }
      break;
    case 'board':
      if (!isArr(v.columns)) { err(`${where}: board.columns must be an array`); break; }
      for (const col of v.columns) {
        if (!isStr(col.title) || !isArr(col.items)) err(`${where}: board column needs title and items`);
        else for (const it of col.items) checkRole(it.role, where, err);
      }
      break;
    default: break;
  }
  for (const l of v.legend || []) checkRole(l.role, where, err);
}

export function validateFrames(frames, pseudoLen, where, err) {
  if (!frames.length) return err(`${where}: run produced no frames`);
  const sample = frames.length <= 60 ? frames : frames.filter((_, i) => i % Math.ceil(frames.length / 60) === 0).concat([frames[frames.length - 1]]);
  for (const f of sample) {
    if (!isStr(f.note)) err(`${where}: every frame needs a plain-language note`);
    else if (/\u2014/.test(f.note)) err(`${where}: a frame note contains an em dash`);
    if (f.ask !== undefined) {
      const k = f.ask;
      if (!k || !isStr(k.q) || !isArr(k.options) || k.options.length < 2 || !Number.isInteger(k.answer) || k.answer < 0 || k.answer >= k.options.length) err(`${where}: frame.ask needs q, at least two options, and answer as the index of the right one`);
      else if (new Set(k.options.map(String)).size !== k.options.length) err(`${where}: frame.ask lists the same option twice`);
    }
    if (!isArr(f.views) || !f.views.length) err(`${where}: every frame needs at least one view`);
    else f.views.forEach((v, i) => validateView(v, `${where} view[${i}]`, err));
    const lines = isArr(f.line) ? f.line : f.line === null || f.line === undefined ? [] : [f.line];
    for (const l of lines) if (!Number.isInteger(l) || l < 0 || l >= pseudoLen) err(`${where}: frame.line ${l} is outside the pseudocode (0..${pseudoLen - 1})`);
  }
  if (!frames.some((f) => f.line !== null && f.line !== undefined)) err(`${where}: no frame references a pseudocode line`);
}

// ctx: { ids:Set (all rostered algorithm ids), disciplines:Set, concepts:Set, labs:Set }
export function validateAlgorithm(a, ctx, fileId) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const need = (cond, m) => { if (!cond) err(m); };
  if (!a || typeof a !== 'object') return { errors: ['module has no default export object'], warnings };

  const m = a.meta || {};
  need(isStr(m.id) && /^[a-z0-9-]+$/.test(m.id), 'meta.id must be kebab-case');
  if (fileId) need(m.id === fileId, `meta.id "${m.id}" must match the file name "${fileId}"`);
  need(isStr(m.name), 'meta.name required');
  need(isArr(m.aliases), 'meta.aliases must be an array (may be empty)');
  need(KINDS.includes(m.kind), `meta.kind must be one of ${KINDS.join(', ')}`);
  need(ctx.disciplines.has(m.discipline), `meta.discipline "${m.discipline}" is not a known discipline id`);
  for (const d of m.alsoIn || []) {
    need(d && ctx.disciplines.has(d.id), `meta.alsoIn id "${d && d.id}" is not a known discipline`);
    need(d && isStr(d.why), 'meta.alsoIn entries need a why');
    if (d && d.id === m.discipline) err('meta.alsoIn must not repeat the primary discipline');
  }
  need(isStr(m.subfield) && isStr(m.family), 'meta.subfield and meta.family required');
  need(ctx.labs.has(m.lab), `meta.lab "${m.lab}" is not a laboratory category id`);
  need(isStr(m.summary) && m.summary.length <= 190, 'meta.summary required (at most 190 characters)');
  need(DIFFICULTIES.includes(m.difficulty), 'meta.difficulty must be beginner | intermediate | advanced');
  need(isNum(m.order), 'meta.order (learning order number) required');
  need(isArr(m.paradigms) && m.paradigms.length > 0 && m.paradigms.every((p) => PARADIGMS.includes(p)), `meta.paradigms must use: ${PARADIGMS.join(', ')}`);
  need(typeof m.randomized === 'boolean' && typeof m.approximate === 'boolean', 'meta.randomized and meta.approximate must be booleans');
  need(m.time && isStr(m.time.worst) && TIME_CLASSES.includes(m.time.class), `meta.time needs worst and class (${TIME_CLASSES.join(', ')})`);
  need(m.space && isStr(m.space.worst) && SPACE_CLASSES.includes(m.space.class), `meta.space needs worst and class (${SPACE_CLASSES.join(', ')})`);
  const tags = m.tags || {};
  for (const k of ['problems', 'techniques', 'applications']) need(isArr(tags[k]) && tags[k].length > 0, `meta.tags.${k} must be a non-empty array`);
  for (const p of m.prerequisites || []) checkRef(p, ctx, 'meta.prerequisites', err, m.id);
  if (m.variantOf) need(ctx.ids.has(m.variantOf), `meta.variantOf "${m.variantOf}" is not a rostered algorithm id`);

  const b = a.bigIdea || {};
  // what, why and where are no longer shown on the lesson page (the simple explanation, the history and the
  // applications cover them), so they are optional. Lessons written earlier still carry them.
  for (const k of ['simple', 'when', 'interesting']) need(isStr(b[k]), `bigIdea.${k} required`);
  need(b.analogy && isStr(b.analogy.title) && isStr(b.analogy.text), 'bigIdea.analogy needs title and text');
  need(b.analogy && isStr(b.analogy.limits), 'bigIdea.analogy.limits required: say where the analogy stops being accurate');
  if (isStr(b.simple)) {
    const words = b.simple.split(/\s+/).length;
    const sentences = b.simple.split(/[.!?]+(?:\s|$)/).filter((x) => x.trim()).length || 1;
    if (words > 230) err(`bigIdea.simple is ${words} words; keep The Simple Explanation under 230`);
    if (words < 60) err(`bigIdea.simple is only ${words} words; it must stand on its own for a newcomer`);
    if (words / sentences > 19) warn(`bigIdea.simple averages ${(words / sentences).toFixed(1)} words per sentence; aim for short sentences (under 17)`);
    if (/O\(|\$|\\|`/.test(b.simple)) err('bigIdea.simple must not contain notation, code or formulas');
  }

  const ex = a.example || {};
  need(isStr(ex.setup) && isArr(ex.steps) && ex.steps.length >= 3 && ex.steps.every(isStr) && isStr(ex.result), 'example needs setup, at least three steps, and result (a small case worked by hand)');

  need(isArr(a.terms) && a.terms.length >= 3 && a.terms.every((x) => x && isStr(x.term) && isStr(x.meaning)), 'terms needs at least three { term, meaning } definitions in plain language');
  need(isStr(a.takeaway) && a.takeaway.length <= 220 && !/\n/.test(a.takeaway), 'takeaway required: one sentence, at most 220 characters');

  const v = a.viz || {};
  need(isStr(v.describe), 'viz.describe (text alternative for the visualization) required');
  need(typeof v.run === 'function', 'viz.run(input, t) required');
  need(isArr(v.inputs) && v.inputs.length > 0, 'viz.inputs must declare at least one input');
  const inputIds = new Set();
  for (const f of v.inputs || []) {
    need(isStr(f.id) && isStr(f.label) && INPUT_TYPES.includes(f.type), `viz.inputs: each needs id, label, type (${INPUT_TYPES.join(', ')})`);
    need(f.default !== undefined, `viz.inputs.${f.id}: default required`);
    if (f.type === 'range') need(isNum(f.min) && isNum(f.max), `viz.inputs.${f.id}: range needs min and max`);
    if (f.type === 'select') need(isArr(f.options) && f.options.some((o) => o.value === f.default), `viz.inputs.${f.id}: select needs options including the default`);
    inputIds.add(f.id);
  }
  for (const p of v.presets || []) {
    need(isStr(p.label) && p.values && typeof p.values === 'object', 'viz.presets need label and values');
    for (const k of Object.keys(p.values || {})) need(inputIds.has(k), `viz.presets "${p.label}" sets unknown input "${k}"`);
  }
  need(isArr(v.tryThis) && v.tryThis.length >= 2, 'viz.tryThis needs at least two experiments for the learner');
  if (v.experiment) {
    const e = v.experiment;
    need(isStr(e.metric) && isStr(e.metricLabel) && isArr(e.sizes) && typeof e.input === 'function', 'viz.experiment needs metric, metricLabel, sizes, input(n, variant, seed)');
    need(isStr(e.sizeLabel), 'viz.experiment.sizeLabel required');
    for (const th of e.theory || []) need(isStr(th.label) && typeof th.fn === 'function', 'viz.experiment.theory entries need label and fn');
  }

  const l = a.logic || {};
  need(isStr(l.intuition), 'logic.intuition required');
  need(isArr(l.steps) && l.steps.length >= 3, 'logic.steps needs at least three numbered steps');
  need(isArr(l.pseudocode) && l.pseudocode.length >= 3, 'logic.pseudocode must be an array of lines');
  need(isArr(l.decisions) && l.decisions.length > 0, 'logic.decisions required');
  need(isArr(l.edgeCases) && l.edgeCases.length > 0, 'logic.edgeCases required');
  need(isStr(l.correctness), 'logic.correctness required');
  need(isArr(l.mistakes) && l.mistakes.length > 0, 'logic.mistakes required');
  if (!isArr(l.invariants) || !l.invariants.length) warn('logic.invariants is empty (fine only if no loop invariant applies)');

  const c = a.code || {};
  need(c.sample && isStr(c.sample.input) && isStr(c.sample.expected), 'code.sample needs input (description) and expected (exact stdout)');
  for (const lang of LANGUAGES) {
    const s = c[lang];
    need(s && isStr(s.source), `code.${lang}.source required`);
    if (s && s.source && /\t/.test(s.source)) err(`code.${lang}.source contains tab characters; use spaces`);
    const lines = s && s.source ? s.source.split('\n').length : 0;
    for (const n of (s && s.notes) || []) need(Number.isInteger(n.line) && n.line >= 1 && n.line <= lines && isStr(n.text), `code.${lang}.notes: line ${n.line} out of range or missing text`);
  }
  need(c.python && isArr(c.python.notes) && c.python.notes.length >= 2, 'code.python.notes needs at least two line explanations');

  const x = a.complexity || {};
  need(isStr(x.summary), 'complexity.summary required');
  need(isArr(x.cases) && x.cases.length > 0 && x.cases.every((k) => isStr(k.case) && isStr(k.time) && isStr(k.when)), 'complexity.cases need case, time, when');
  need(isStr(x.space), 'complexity.space required');
  need(isArr(x.assumptions) && x.assumptions.length > 0, 'complexity.assumptions required (state what the bounds assume)');
  need(isStr(x.tradeoffs), 'complexity.tradeoffs required');

  const g = a.tradeoffs || {};
  for (const k of ['struggles', 'pitfalls', 'misunderstandings']) need(isArr(g[k]) && g[k].length > 0, `tradeoffs.${k} required`);
  need(isArr(g.alternatives) && g.alternatives.length > 0, 'tradeoffs.alternatives required');
  for (const alt of g.alternatives || []) {
    need(isStr(alt.name) && isStr(alt.when), 'tradeoffs.alternatives need name and when');
    if (alt.id) need(ctx.ids.has(alt.id), `tradeoffs.alternatives id "${alt.id}" is not rostered`);
  }
  if (g.comparison) need(isArr(g.comparison.columns) && isArr(g.comparison.rows) && g.comparison.rows.every((r) => r.length === g.comparison.columns.length), 'tradeoffs.comparison rows must match columns');

  need(isArr(a.applications) && a.applications.length >= 3, 'applications needs at least three entries');
  for (const ap of a.applications || []) need(isStr(ap.title) && isStr(ap.text) && APPLICATION_STATUS.includes(ap.status), 'applications need title, text, status (established | illustrative)');

  need(isArr(a.connections) && a.connections.length >= 4, 'connections needs at least four entries');
  for (const cn of a.connections || []) {
    need(CONNECTION_TYPES.includes(cn.type) && isStr(cn.why), `connections: "${cn.to}" needs type (${CONNECTION_TYPES.join(', ')}) and why`);
    checkRef(cn.to, ctx, 'connections', err, m.id);
  }

  need(isArr(a.quiz) && a.quiz.length >= 4, 'quiz needs at least four items');
  const qt = new Set();
  for (const q of a.quiz || []) {
    need(QUIZ_TYPES.includes(q.type), `quiz.type must be one of ${QUIZ_TYPES.join(', ')}`);
    qt.add(q.type);
    if (q.type === 'challenge') need(isStr(q.title) && isStr(q.prompt), 'quiz challenge needs title and prompt');
    else {
      need(isStr(q.q) && isArr(q.options) && q.options.length >= 3, 'quiz question needs q and at least three options');
      need(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < (q.options || []).length, 'quiz.answer must index into options');
      need(isArr(q.explain) && q.explain.length === (q.options || []).length, 'quiz.explain must give feedback for every option');
      if (q.type === 'debug') need(isStr(q.code), 'quiz debug item needs code');
      if (q.tryInput) for (const k of Object.keys(q.tryInput)) need(inputIds.has(k), `quiz.tryInput sets unknown input "${k}"`);
    }
  }
  if (ex.tryInput) for (const k of Object.keys(ex.tryInput)) need(inputIds.has(k), `example.tryInput sets unknown input "${k}"`);
  for (const t of ['choice', 'predict', 'debug', 'challenge']) need(qt.has(t), `quiz needs at least one "${t}" item`);

  const cp = a.compare || {};
  for (const k of ['idea', 'requires', 'sensitivity', 'memory', 'limits', 'useWhen']) need(isStr(cp[k]), `compare.${k} required`);
  need(['low', 'moderate', 'high'].includes(cp.difficulty), 'compare.difficulty must be low | moderate | high');

  const ad = a.advanced || {};
  need(isStr(ad.history), 'advanced.history required');
  need(isArr(ad.references) && ad.references.length > 0, 'advanced.references required');
  for (const r of ad.references || []) need(isStr(r.authors) && isStr(r.title) && (isNum(r.year) || isStr(r.year)) && isStr(r.venue), 'references need authors, year, title, venue');
  if (!isStr(ad.proof) && !isStr(ad.derivation)) warn('advanced has neither a proof nor a derivation');

  need(isArr(a.tests) && a.tests.length >= 2, 'tests needs at least two checks of viz.run');
  for (const t of a.tests || []) need(isStr(t.name) && t.input && typeof t.check === 'function', 'tests need name, input, check(result, counters)');

  // House style: no em dashes, and none of the stock phrases that make prose sound generated.
  const STOCK = /in today's|rapidly evolving|it's important to note|it is important to note|let's dive|dive into|game-chang|delve|unlock the power|at its core|in the world of|revolutioni[sz]/i;
  const flagged = new Set();
  const walk = (node, path) => {
    if (typeof node === 'string') {
      if (/\u2014/.test(node) || /\s\u2013\s/.test(node)) flagged.add(`${path}: contains an em dash or spaced en dash; rewrite with a comma, colon or full stop`);
      const m = node.match(STOCK);
      if (m) flagged.add(`${path}: stock phrase "${m[0]}"; say it plainly`);
    } else if (isArr(node)) node.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (node && typeof node === 'object') for (const [k, x] of Object.entries(node)) walk(x, `${path}.${k}`);
  };
  for (const k of ['bigIdea', 'example', 'terms', 'takeaway', 'logic', 'complexity', 'tradeoffs', 'applications', 'connections', 'quiz', 'compare', 'advanced']) {
    if (k === 'logic') { const { pseudocode, ...rest } = a.logic || {}; walk(rest, 'logic'); } else walk(a[k], k);
  }
  walk({ summary: m.summary, describe: v.describe, tryThis: v.tryThis }, 'meta/viz');
  errors.push(...[...flagged].slice(0, 6));

  return { errors, warnings };
}

function checkRef(ref, ctx, where, err, selfId) {
  if (!isStr(ref)) return err(`${where}: reference must be a string`);
  if (ref.startsWith('concept:')) { if (!ctx.concepts.has(ref.slice(8))) err(`${where}: unknown concept "${ref}"`); }
  else if (ref.startsWith('discipline:')) { if (!ctx.disciplines.has(ref.slice(11))) err(`${where}: unknown discipline "${ref}"`); }
  else if (!ctx.ids.has(ref)) err(`${where}: "${ref}" is not a rostered algorithm id (use concept:… or discipline:… for other targets)`);
  else if (ref === selfId) err(`${where}: an entry cannot reference itself`);
}

// The lightweight record stored in the generated catalog (everything the library, search,
// universe and connection graph need without loading the full lesson).
export function catalogEntry(a) {
  const langs = LANGUAGES.filter((k) => a.code && a.code[k] && a.code[k].source);
  return {
    ...a.meta,
    hasExperiment: !!(a.viz && a.viz.experiment),
    languages: langs,
    quizCount: (a.quiz || []).length,
    quizAnswerable: (a.quiz || []).filter((q) => q.type !== 'challenge').length,
    apps: (a.applications || []).map((x) => ({ title: x.title, status: x.status })),
    connections: (a.connections || []).map((x) => ({ to: x.to, type: x.type, why: x.why })),
    analogy: a.bigIdea && a.bigIdea.analogy ? a.bigIdea.analogy.title : '',
    takeaway: a.takeaway || '',
    decide: a.compare ? { useWhen: a.compare.useWhen || '', requires: a.compare.requires || '', limits: a.compare.limits || '' } : null,
    describe: a.viz ? a.viz.describe : '',
    views: [],
  };
}
