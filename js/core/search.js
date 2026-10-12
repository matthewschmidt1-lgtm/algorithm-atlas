// In-browser search over everything the atlas publishes. Every result carries a type so
// the interface can say whether it is a lesson, a concept, a discipline, a learning path,
// a visualization, a code example or an application.
//
// The index is built once from the catalog. At a few hundred documents this is instant;
// if the catalog grows past what a browser should hold, replace build() with a call to a
// server-side index and keep the same search() signature.

import * as C from './catalog.js';
import { synonymGroups, intents, stopwords } from '../../content/synonyms.js';
import { LANGUAGE_LABELS, KIND_LABELS } from './schema.js';

export const TYPE_LABELS = {
  algorithm: 'Lesson', concept: 'Concept', discipline: 'Discipline', path: 'Learning path',
  visualization: 'Visualization', code: 'Code example', application: 'Application', planned: 'Planned lesson',
};

const synonymOf = new Map();
for (const group of synonymGroups) for (const w of group) {
  if (!synonymOf.has(w)) synonymOf.set(w, new Set());
  for (const o of group) if (o !== w) synonymOf.get(w).add(o);
}

const stem = (w) => {
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};
const words = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').split(/[^a-z0-9*]+/).filter(Boolean);
const tokens = (text) => words(text).map(stem);

function editWithin1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

let docs = null;

function field(text, weight) { return { tokens: new Set(tokens(text)), weight, text: String(text || '').toLowerCase() }; }

function build() {
  docs = [];
  const add = (d) => docs.push(d);
  for (const a of C.algos) {
    const disc = C.disciplineById[a.discipline];
    const base = [
      field(a.name, 10), field((a.aliases || []).join(' '), 8), field((a.tags.problems || []).join(' '), 7),
      field((a.tags.techniques || []).join(' '), 4), field((a.tags.applications || []).join(' '), 3),
      field(a.summary, 3), field(`${a.subfield} ${a.family}`, 3), field(disc.name, 2),
      field((a.paradigms || []).join(' ').replace(/-/g, ' '), 2), field(`${a.time.worst} ${a.time.average || ''}`, 1), field(a.analogy, 1),
    ];
    add({ type: 'algorithm', ref: a.id, title: a.name, sub: `${KIND_LABELS[a.kind]} in ${disc.name}`, preview: a.summary, href: `#/algorithm/${a.id}`, fields: base, base: 1, difficulty: a.difficulty });
    add({ type: 'visualization', ref: a.id, title: `${a.name}, step by step`, sub: 'Interactive visualization in the laboratory', preview: a.describe, href: `#/lab/${a.id}`,
      fields: [field(a.name, 8), field((a.aliases || []).join(' '), 5), field('visualization visualize animation animated watch see demo demonstration interactive simulate step', 4), field(a.describe, 1)], base: 0.42, intent: /visual|animat|watch|see |demo|interactive|step by step|show me/ });
    add({ type: 'code', ref: a.id, title: `${a.name} in ${a.languages.map((l) => LANGUAGE_LABELS[l]).join(', ')}`, sub: 'Runnable code example', preview: `A complete, checked program for ${a.name}.`, href: `#/algorithm/${a.id}?at=code`,
      fields: [field(a.name, 8), field((a.aliases || []).join(' '), 5), field('code implementation implement program source python javascript js c++ cpp example write function', 4)], base: 0.4, intent: /code|implement|python|javascript|\bjs\b|c\+\+|cpp|program|source|write/ });
    for (const app of a.apps || []) {
      add({ type: 'application', ref: a.id, title: app.title, sub: `${app.status === 'established' ? 'Established use' : 'Illustrative use'} of ${a.name}`, preview: `See how ${a.name} is used here.`, href: `#/algorithm/${a.id}?at=matters`,
        fields: [field(app.title, 7), field(a.name, 2)], base: 0.7 });
    }
  }
  for (const r of C.planned) {
    add({ type: 'planned', ref: r.id, title: r.name, sub: `Planned for ${C.disciplineById[r.discipline].name}`, preview: 'This lesson has not been written yet.', href: `#/discipline/${r.discipline}`, fields: [field(r.name, 8)], base: 0.5 });
  }
  for (const c of C.concepts) {
    add({ type: 'concept', ref: `concept:${c.id}`, title: c.name, sub: 'Concept', preview: c.simple, href: `#/concept/${c.id}`,
      fields: [field(c.name, 10), field((c.aliases || []).join(' '), 8), field(c.simple, 2), field(c.precise, 1)], base: 0.9 });
  }
  for (const d of C.disciplines) {
    add({ type: 'discipline', ref: `discipline:${d.id}`, title: d.name, sub: 'Discipline', preview: d.blurb, href: `#/discipline/${d.id}`,
      fields: [field(d.name, 10), field(d.short, 8), field(d.subfields.join(' '), 5), field(d.applications.join(' '), 3), field(d.blurb, 2)], base: 0.95 });
  }
  for (const p of C.paths) {
    add({ type: 'path', ref: `path:${p.id}`, title: p.title, sub: 'Learning path', preview: p.blurb, href: `#/path/${p.id}`,
      fields: [field(p.title, 10), field(p.blurb, 3), field((p.objectives || []).join(' '), 2), field('course path learn journey curriculum', 1)], base: 0.9 });
  }
}

function scoreDoc(doc, q) {
  let total = 0, matched = 0;
  for (const term of q.terms) {
    let best = 0;
    for (const f of doc.fields) {
      let s = 0;
      if (f.tokens.has(term.t)) s = 1;
      else {
        for (const ft of f.tokens) {
          if (term.t.length >= 3 && ft.startsWith(term.t)) { s = Math.max(s, 0.62); break; }
          if (term.t.length >= 5 && ft.length >= 5 && editWithin1(term.t, ft)) s = Math.max(s, 0.42);
        }
        if (!s) for (const syn of term.syn) if (f.tokens.has(syn)) { s = 0.5; break; }
      }
      if (s * f.weight > best) best = s * f.weight;
    }
    if (best > 0) matched++;
    total += best;
  }
  if (!matched) return 0;
  const need = q.terms.length <= 2 ? q.terms.length : Math.ceil(q.terms.length * 0.6);
  if (matched < need) return 0;
  let score = (total / q.terms.length) * (matched / q.terms.length);
  if (q.phrase.length >= 3) {
    if (doc.fields[0].text === q.phrase) score += 14;
    else if (doc.fields[0].text.startsWith(q.phrase)) score += 6;
    else if (doc.fields[0].text.includes(q.phrase)) score += 3;
    else if (doc.fields[1] && doc.fields[1].text.includes(q.phrase)) score += 3;
  }
  let base = doc.base;
  if (doc.intent && doc.intent.test(q.raw)) base = 1.25;
  return score * base;
}

export function search(raw, { limit = 30, types = null } = {}) {
  if (!docs) build();
  const text = String(raw || '').trim();
  if (text.length < 2) return [];
  const all = words(text);
  let kept = all.filter((w) => !stopwords.has(w));
  if (!kept.length) kept = all;
  const q = {
    raw: text.toLowerCase(),
    phrase: text.toLowerCase(),
    terms: kept.map((w) => ({ t: stem(w), syn: [...(synonymOf.get(w) || synonymOf.get(stem(w)) || [])].map(stem) })),
  };
  const boosted = new Map();
  for (const it of intents) if (it.test.test(text)) it.refs.forEach((ref, i) => { if (!boosted.has(ref)) boosted.set(ref, { reason: it.reason, rank: i }); });

  const out = [];
  for (const d of docs) {
    if (types && !types.includes(d.type)) continue;
    let s = scoreDoc(d, q);
    let reason = null;
    const b = boosted.get(d.ref);
    if (b && (d.type === 'algorithm' || d.type === 'concept' || d.type === 'path')) { s += 9 - b.rank * 0.6; reason = b.reason; }
    if (s > 0.35) out.push({ ...d, score: s, reason, fields: undefined });
  }
  out.sort((x, y) => y.score - x.score || x.title.localeCompare(y.title));
  // Drop the long tail of weak, partial matches once something clearly relevant has been found.
  const floor = out.length ? Math.max(0.35, out[0].score * 0.24) : 0;
  return out.filter((r) => r.score >= floor).slice(0, limit);
}

// Short mixed list for autocomplete: the best few, with at most two of any derived type.
export function suggest(raw, limit = 8) {
  const res = search(raw, { limit: 40 });
  const out = [];
  const perType = {};
  const perRef = {};
  for (const r of res) {
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
