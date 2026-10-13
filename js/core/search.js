// In-browser search over everything the atlas publishes. Every result carries a type so
// the interface can say whether it is a lesson, a concept, a discipline, a learning path,
// a visualization, a code example, an application or a comparison.
//
// How a query is matched, in order:
//   1. It is split into words. Filler words are dropped. Each word is reduced to a stem so
//      that "prices" finds "price" and "sorting" finds "sort".
//   2. Words are matched whole. "gene" does not match "generate". Only the last word of the
//      query may match the start of a longer word, so results appear while someone types.
//   3. A word the atlas has never seen is compared with lesson names. If it is one slip away
//      from a name ("djikstra") it is corrected, and the page says so. A word that is in the
//      vocabulary is never "corrected" into a different one.
//   4. A document must match every word of a short query and most words of a long one.
//   5. If nothing matches, lessons that match the most distinctive word are offered
//      separately, as broader suggestions, and are never presented as the answer.
//
// tools/search-benchmark.js measures this against a fixed set of questions. Change the
// matching only with that benchmark open: it reports wrong results as well as missing ones.
//
// The index is built once from the catalog. At a few hundred documents this is instant;
// if the catalog grows past what a browser should hold, replace build() with a call to a
// server-side index and keep the same search() signature.

import * as C from './catalog.js';
import { synonymGroups, intents, stopwords, facets, irregular } from '../../content/synonyms.js';
import { LANGUAGE_LABELS, KIND_LABELS } from './schema.js';

export const TYPE_LABELS = {
  algorithm: 'Lesson', concept: 'Concept', discipline: 'Discipline', path: 'Learning path', comparison: 'Comparison',
  visualization: 'Visualization', code: 'Code example', application: 'Application', planned: 'Planned lesson',
};

/* ---------------------------------------------------------------- words */

const hasVowel = (s) => /[aeiouy]/.test(s);
const undouble = (s) => (/([bdgmnprt])\1$/.test(s) ? s.slice(0, -1) : s);

// The forms of a word used for matching. The first is its stem; a second is given when the
// stem alone is ambiguous ("coding" could come from "cod" or "code").
export function forms(word) {
  let s = irregular[word] || word;
  if (s.length <= 3 || /\d/.test(s)) return [s];
  if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y';
  else if (s.length > 4 && s.endsWith('ie')) s = s.slice(0, -2) + 'y';
  else if (/(ss|us|is)$/.test(s)) { /* class, radius, analysis: not plurals */ }
  else if (/(ch|sh|x|z|ss)es$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith('s')) s = s.slice(0, -1);
  let alt = null;
  if (s.length > 5 && s.endsWith('ing') && hasVowel(s.slice(0, -3))) { s = undouble(s.slice(0, -3)); alt = s + 'e'; }
  else if (s.length > 5 && s.endsWith('ed') && hasVowel(s.slice(0, -2))) { s = undouble(s.slice(0, -2)); alt = s + 'e'; }
  return alt ? [s, alt] : [s];
}
const stem = (w) => forms(w)[0];
export const words = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').split(/[^a-z0-9*]+/).filter(Boolean);
const isStop = (w) => stopwords.has(w);
// The meaningful stems of a phrase, in order: used to compare a query with a name word for word.
const sequence = (text) => words(text).filter((w) => !isStop(w)).map(stem).join(' ');

const synonymOf = new Map();
for (const group of synonymGroups) {
  const stems = [...new Set(group.map(stem))];
  for (const w of stems) {
    if (!synonymOf.has(w)) synonymOf.set(w, new Set());
    for (const o of stems) if (o !== w) synonymOf.get(w).add(o);
  }
}

export const synonymsOf = (stemmed) => [...(synonymOf.get(stemmed) || [])];

// Endings that turn one word into a close relative of itself: detect, detection.
const DERIVED = /^(ion|ions|ation|ations|ition|itions|ment|ments|ness|ity|ize|ise|ized|ised|ization|isation|able|ive)$/;
function derives(a, b) {
  // true when b is a followed by one of the endings above, allowing for a dropped final "e" or "y"
  if (a.length < 5 || b.length <= a.length) return false;
  for (const base of [a, /[ey]$/.test(a) ? a.slice(0, -1) : null]) {
    if (base && base.length >= 4 && b.startsWith(base) && DERIVED.test(b.slice(base.length))) return true;
  }
  return false;
}

// Damerau-Levenshtein distance, stopping early once it exceeds `max`.
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}

/* ---------------------------------------------------------------- index */

let docs = null;
let vocab = null;      // every stem that appears anywhere in the index
let nameVocab = null;  // stems that appear in names and aliases: the only targets for spelling correction
let rarity = null;     // stem -> number of documents that contain it anywhere

function field(text, weight, { names = false } = {}) {
  const list = Array.isArray(text) ? text : [text];
  const tokens = new Set();
  const seqs = [];
  for (const item of list) {
    const ws = words(item);
    for (const w of ws) for (const f of forms(w)) tokens.add(f);
    if (names) {
      seqs.push(sequence(item));
      // "Topological Sort (Kahn's Algorithm)" is also known by the part outside the brackets
      if (/\(.+\)/.test(item)) seqs.push(sequence(String(item).replace(/\(.*?\)/g, ' ')));
      // "Monte Carlo" is also findable as "montecarlo", "Quick Sort" as "quicksort"
      if (weight >= 8 && ws.length >= 2 && ws.length <= 3) tokens.add(ws.join(''));
    }
  }
  return { tokens, weight, seqs, names };
}

function build() {
  docs = [];
  const add = (d) => docs.push(d);
  for (const a of C.algos) {
    const disc = C.disciplineById[a.discipline];
    const base = [
      field(a.name, 10, { names: true }), field(a.aliases || [], 8, { names: true }), field(a.tags.problems || [], 7, { names: true }),
      field(a.tags.techniques || [], 4), field(a.tags.applications || [], 3),
      field(a.summary, 3), field(`${a.subfield} ${a.family}`, 3), field(disc.name, 2),
      field((a.paradigms || []).join(' ').replace(/-/g, ' '), 2), field(a.analogy, 1),
    ];
    add({ type: 'algorithm', ref: a.id, title: a.name, sub: `${KIND_LABELS[a.kind]} in ${disc.name}`, preview: a.summary, href: `#/algorithm/${a.id}`, fields: base, base: 1, difficulty: a.difficulty });
    add({ type: 'visualization', ref: a.id, title: `${a.name}, step by step`, sub: 'Interactive visualization in the laboratory', preview: a.describe, href: `#/lab/${a.id}`,
      fields: [field(a.name, 8, { names: true }), field(a.aliases || [], 5, { names: true }), field('visualization visualize animation animated watch see demo demonstration interactive simulate step', 4)], base: 0.42, intent: /\bvisuali|\banimat|\bwatch\b|\bdemo|\binteractive\b|\bstep by step\b|\bshow me\b/, needsName: true });
    add({ type: 'code', ref: a.id, title: `${a.name} in ${a.languages.map((l) => LANGUAGE_LABELS[l]).join(', ')}`, sub: 'Runnable code example', preview: `A complete, checked program for ${a.name}.`, href: `#/algorithm/${a.id}?at=code`,
      fields: [field(a.name, 8, { names: true }), field(a.aliases || [], 5, { names: true }), field('code implementation implement program source python javascript js c++ cpp example write function', 4)], base: 0.4, intent: /\bcode\b|\bimplement|\bpython\b|\bjavascript\b|\bjs\b|c\+\+|\bcpp\b|\bprogram\b|\bsource\b/, needsName: true });
    for (const app of a.apps || []) {
      add({ type: 'application', ref: a.id, title: app.title, sub: `${app.status === 'established' ? 'Established use' : 'Illustrative use'} of ${a.name}`, preview: `See how ${a.name} is used here.`, href: `#/algorithm/${a.id}?at=matters`,
        fields: [field(app.title, 7), field(a.name, 2, { names: true })], base: 0.7 });
    }
  }
  for (const r of C.planned) {
    add({ type: 'planned', ref: r.id, title: r.name, sub: `Planned for ${C.disciplineById[r.discipline].name}`, preview: 'This lesson has not been written yet.', href: `#/algorithm/${r.id}`,
      fields: [field(r.name, 8, { names: true }), field(r.aliases || [], 8, { names: true })], base: 0.6 });
  }
  for (const c of C.concepts) {
    add({ type: 'concept', ref: `concept:${c.id}`, title: c.name, sub: 'Concept', preview: c.simple, href: `#/concept/${c.id}`,
      fields: [field(c.name, 10, { names: true }), field(c.aliases || [], 8, { names: true }), field(c.simple, 2), field(c.precise, 1)], base: 0.9 });
  }
  for (const d of C.disciplines) {
    add({ type: 'discipline', ref: `discipline:${d.id}`, title: d.name, sub: 'Discipline', preview: d.blurb, href: `#/discipline/${d.id}`,
      fields: [field(d.name, 10, { names: true }), field(d.short, 8, { names: true }), field(d.subfields.join(' '), 5), field(d.applications.join(' '), 3), field(d.blurb, 2)], base: 0.85 });
  }
  for (const p of C.paths) {
    add({ type: 'path', ref: `path:${p.id}`, title: p.title, sub: 'Learning path', preview: p.blurb, href: `#/path/${p.id}`,
      fields: [field(p.title, 10, { names: true }), field(p.blurb, 3), field((p.objectives || []).join(' '), 1), field('course path learn journey curriculum', 1)], base: 0.8 });
  }
  for (const g of C.compareGroups) {
    add({ type: 'comparison', ref: `compare:${g.id}`, title: g.title, sub: `${g.members.length} methods run side by side`, preview: g.problem || '', href: `#/compare/${g.id}`,
      fields: [field(g.title, 8, { names: true }), field(g.problem || '', 3), field('compare comparison side by side against difference between', 3)], base: 0.6, intent: /\bcompar|\bside by side\b|\bdifference between\b|\bwhich is (faster|better)\b/ });
  }

  vocab = new Set();
  nameVocab = new Set();
  rarity = new Map();
  for (const d of docs) {
    for (const f of d.fields) for (const t of f.tokens) { vocab.add(t); if (f.names && f.weight >= 8) nameVocab.add(t); }
    if (d.type !== 'visualization' && d.type !== 'code' && d.type !== 'application') {
      const seen = new Set();
      for (const f of d.fields) for (const t of f.tokens) seen.add(t);
      for (const t of seen) rarity.set(t, (rarity.get(t) || 0) + 1);
    }
  }
}

/* ---------------------------------------------------------------- query */

// A word found in more documents than this says too little to justify a suggestion on its own.
const RARE = 8;

// Find the closest name for a word the index has never seen. Bounded on purpose: the
// first letter must agree, short words may only gain, lose or swap a letter, and a tie
// between different names means no correction.
function correct(word) {
  if (word.length < 4) return null;
  const max = word.length >= 8 ? 2 : 1;
  let best = null, bestD = max + 1, tie = false;
  for (const cand of nameVocab) {
    if (cand[0] !== word[0] || cand.length < 4) continue;
    const d = distance(word, cand, max);
    if (d > max) continue;
    if (word.length < 5 && cand.length === word.length && !(word.split('').sort().join('') === cand.split('').sort().join(''))) continue;
    if (d < bestD) { best = cand; bestD = d; tie = false; }
    else if (d === bestD && cand !== best) tie = true;
  }
  return best && !tie ? best : null;
}

function parse(raw) {
  const text = String(raw || '').trim();
  const all = words(text);
  let kept = all.filter((w) => !isStop(w));
  if (!kept.length) kept = all.filter((w) => w.length > 1);
  const typing = !/\s$/.test(String(raw || ''));
  const terms = kept.map((w, i) => {
    const fs = forms(w);
    const syn = [...(synonymOf.get(fs[0]) || [])];
    const known = fs.some((f) => vocab.has(f)) || syn.some((s) => vocab.has(s));
    const last = i === kept.length - 1;
    const term = { word: w, forms: fs, syn, known, prefix: false, loose: false, corrected: null };
    // While someone is typing, the last word may be the start of a longer one. A word that is
    // already a whole name ("prim", "sort") is taken at its word. A word the index knows from
    // running text may only complete a name; a word it has never seen may complete anything.
    if (last && typing && w.length >= 2 && !fs.some((f) => nameVocab.has(f))) { term.prefix = true; term.loose = !known; }
    if (!known) {
      let reachable = false;
      if (term.prefix) for (const t of vocab) if (t.length > w.length && t.startsWith(w)) { reachable = true; break; }
      if (!reachable) for (const t of vocab) if (derives(fs[0], t) || derives(t, fs[0])) { reachable = true; break; }
      if (reachable) term.known = true;
      else { const c = correct(fs[0]); if (c) { term.corrected = c; term.forms = [c]; term.known = true; term.prefix = false; } }
    }
    return term;
  });
  return { text, lower: text.toLowerCase(), terms, seq: terms.map((t) => t.forms[0]).join(' ') };
}

function termScore(term, f) {
  for (const x of term.forms) if (f.tokens.has(x)) return term.corrected ? 0.85 : 1;
  let s = 0;
  for (const t of f.tokens) {
    if (f.weight >= 3 && (derives(term.forms[0], t) || derives(t, term.forms[0]))) { s = Math.max(s, 0.8); break; }
    if (term.prefix && (term.loose || (f.names && f.weight >= 8)) && t.length > term.word.length && t.startsWith(term.word)) s = Math.max(s, 0.62);
  }
  if (!s) for (const syn of term.syn) if (f.tokens.has(syn)) return 0.5;
  return s;
}

function scoreDoc(doc, q, terms) {
  let total = 0, matched = 0, nameMatched = 0;
  for (const term of terms) {
    let best = 0, inName = false;
    for (const f of doc.fields) {
      const s = termScore(term, f) * f.weight;
      if (s > best) best = s;
      if (s > 0 && f.names && f.weight >= 5) inName = true;
    }
    if (best > 0) matched++;
    if (inName) nameMatched++;
    total += best;
  }
  if (!matched) return 0;
  const need = terms.length <= 2 ? terms.length : Math.ceil(terms.length * 0.6);
  if (matched < need) return 0;
  // a "code example" or "visualization" entry is only relevant when the query names its lesson
  if (doc.needsName && !nameMatched) return 0;
  let score = (total / terms.length) * (matched / terms.length);
  // word-for-word agreement with a name, an alias or a stated problem
  if (q.seq.length >= 2) {
    let bonus = 0;
    for (const f of doc.fields) {
      if (!f.names) continue;
      for (const s of f.seqs) {
        if (!s) continue;
        const whole = f.weight >= 10 ? 14 : f.weight >= 8 ? 12 : 8;
        if (s === q.seq) bonus = Math.max(bonus, whole);
        else if (s.startsWith(q.seq + ' ') || (q.terms[q.terms.length - 1].prefix && s.startsWith(q.seq))) bonus = Math.max(bonus, f.weight >= 8 ? 6 : 3);
        else if (` ${s} `.includes(` ${q.seq} `)) bonus = Math.max(bonus, 3);
      }
    }
    score += bonus;
  }
  let base = doc.base;
  if (doc.intent && doc.intent.test(q.lower)) base = 1.25;
  return score * base;
}

function named(q) {
  // does the query, word for word, name a lesson? Then it is not a question and intents stay out of it
  for (const d of docs) {
    if (d.type !== 'algorithm' && d.type !== 'planned') continue;
    for (const f of d.fields) if (f.names && f.weight >= 8 && f.seqs.includes(q.seq)) return d;
  }
  return null;
}

function strip(d, extra) { return { ...d, ...extra, fields: undefined, intent: undefined }; }

function core(raw, { types = null, useIntents = true } = {}) {
  const q = parse(raw);
  let terms = q.terms;
  let facet = null;
  // "dijkstra proof": if dropping a part-of-lesson word leaves exactly a lesson's name, open that part
  if (terms.length >= 2) {
    for (let i = 0; i < terms.length; i++) {
      const fc = facets.find((x) => x.words.includes(terms[i].word));
      if (!fc) continue;
      const rest = terms.filter((_, k) => k !== i);
      const restQ = { ...q, terms: rest, seq: rest.map((t) => t.forms[0]).join(' ') };
      if (named(restQ)) { terms = rest; q.terms = rest; q.seq = restQ.seq; facet = fc; break; }
    }
  }
  const unknown = terms.filter((t) => !t.known).map((t) => t.word);
  const corrected = terms.filter((t) => t.corrected).map((t) => ({ from: t.word, to: t.corrected }));
  const isNamed = !!named(q);

  const boosted = new Map();
  if (useIntents && !isNamed && !facet) {
    let fired = 0;
    for (const it of intents) {
      if (!it.test.test(q.text)) continue;
      it.refs.forEach((ref, i) => { if (!boosted.has(ref)) boosted.set(ref, { reason: it.reason, rank: i + fired * 1.5 }); });
      fired++;
    }
  }

  const out = [];
  if (terms.length) {
    for (const d of docs) {
      if (types && !types.includes(d.type)) continue;
      let s = scoreDoc(d, q, terms);
      let reason = null;
      const b = boosted.get(d.ref);
      if (b && (d.type === 'algorithm' || d.type === 'concept' || d.type === 'path' || d.type === 'planned')) { s += 12 - b.rank * 0.6; reason = b.reason; }
      if (s > 0.35) {
        const extra = { score: s, reason };
        if (facet && d.type === 'algorithm') { extra.href = `#/algorithm/${d.ref}?at=${facet.at}`; extra.reason = `Opens at ${facet.label}`; }
        out.push(strip(d, extra));
      }
    }
  }
  out.sort((x, y) => y.score - x.score || x.title.localeCompare(y.title));
  // Drop the long tail of weak, partial matches once something clearly relevant has been found.
  const floor = out.length ? Math.max(0.35, out[0].score * 0.3) : 0;
  const results = out.filter((r) => r.score >= floor);

  // Nothing matched the whole question because the atlas has never seen one of its words.
  // Offer the lessons that match every word it does know, provided one of those words is
  // distinctive: found in a lesson's name, aliases or stated problems, and in few places
  // overall. These are returned separately and are never presented as the answer.
  let broader = [];
  const knownTerms = terms.filter((t) => t.known);
  if (!results.length && unknown.length && knownTerms.length) {
    const pool = [];
    for (const d of docs) {
      if (d.type !== 'algorithm' && d.type !== 'planned') continue;
      if (types && !types.includes(d.type)) continue;
      const hit = [];
      for (const term of knownTerms) {
        if (Math.max(...term.forms.map((x) => rarity.get(x) || 0)) > RARE) continue;
        if (d.fields.some((f) => f.weight >= 7 && term.forms.some((x) => f.tokens.has(x)))) hit.push(term.corrected || term.word);
      }
      if (!hit.length) continue;
      const s = scoreDoc(d, { ...q, seq: '' }, knownTerms);
      if (s > 0.35) pool.push(strip(d, { score: s, reason: `Mentions "${hit.join('", "')}"`, broader: true }));
    }
    pool.sort((x, y) => y.score - x.score || x.title.localeCompare(y.title));
    broader = pool.slice(0, 4);
  }
  // the first lesson an intent names is the one chosen as the place to start
  const lead = [...boosted].find(([, v]) => v.rank === 0);
  return { q, results, broader, unknown, corrected, facet, named: isNamed, lead: lead ? lead[0] : null };
}

// The full answer to a query: what matched, what is only loosely related, and what to tell
// the reader about how the query was read.
export function searchDetailed(raw, { limit = 30, types = null } = {}) {
  if (!docs) build();
  const text = String(raw || '').trim();
  const empty = { results: [], broader: [], note: '', corrected: [], best: null };
  if (text.length < 2) return empty;

  // "quick sort vs merge sort": resolve each side to a lesson, and lead with their comparison if one exists
  const sides = text.split(/\s+(?:vs\.?|versus)\s+/i);
  if (sides.length === 2 && sides.every((s) => s.trim().length >= 2)) {
    const picks = sides.map((s) => core(s, { types: ['algorithm'], useIntents: false }).results[0]).filter(Boolean);
    if (picks.length === 2 && picks[0].ref !== picks[1].ref) {
      const group = C.compareGroups.find((g) => picks.every((p) => g.members.includes(p.ref)));
      const out = [];
      if (group && (!types || types.includes('comparison'))) {
        out.push({ type: 'comparison', ref: `compare:${group.id}`, title: `${picks[0].title} and ${picks[1].title}, side by side`, sub: `Comparison: ${group.title}`,
          preview: group.problem || '', href: `#/compare/${group.id}?ids=${picks[0].ref},${picks[1].ref}`, score: 30, reason: 'Runs both on the same input' });
      }
      out.push(...picks.map((p, i) => ({ ...p, score: 20 - i })));
      return { ...empty, results: out.slice(0, limit), best: out[0], note: group ? '' : 'These two lessons are not in a shared comparison, so they are listed separately.' };
    }
  }

  const r = core(text, { types });
  const results = r.results.slice(0, limit);
  const notes = [];
  for (const c of r.corrected) notes.push(`Showing results for "${c.to}" instead of "${c.from}".`);
  if (!results.length && r.unknown.length && r.broader.length) notes.push(`Nothing in the atlas mentions "${r.unknown.join('", "')}".`);
  // A result is called the best match only when it clearly leads.
  let best = null;
  const lead = results.filter((x) => x.type !== 'visualization' && x.type !== 'code' && x.type !== 'application');
  if (lead.length && lead[0] === results[0] && (lead.length === 1 || lead[0].score >= lead[1].score * 1.35 || r.named || lead[0].ref === r.lead)) best = lead[0];
  return { results, broader: r.broader, note: notes.join(' '), corrected: r.corrected, best };
}

export function search(raw, opts = {}) { return searchDetailed(raw, opts).results; }

// Short mixed list for autocomplete: the best few, with at most two of any derived type.
// When nothing matches, the broader suggestions are returned, each flagged `broader`.
export function suggest(raw, limit = 8) {
  const d = searchDetailed(raw, { limit: 40 });
  if (!d.results.length) return d.broader.slice(0, 3);
  const out = [];
  const perType = {};
  const perRef = {};
  for (const r of d.results) {
    perType[r.type] = (perType[r.type] || 0);
    const cap = r.type === 'algorithm' ? 5 : 2;
    if (perType[r.type] >= cap) continue;
    if ((r.type === 'visualization' || r.type === 'code') && !r.reason && (perRef[r.ref] || 0) >= 1 && out.length > 3) continue;
    perType[r.type]++;
    perRef[r.ref] = (perRef[r.ref] || 0) + 1;
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// Relevance ordering for the library: lesson ids ranked for a query.
export function rankLessons(raw) {
  return search(raw, { limit: 200, types: ['algorithm'] }).map((r) => r.ref);
}
