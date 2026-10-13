// The "I want to" index. Every lesson states, in everyday words, the problems it solves
// (meta.tags.problems). Search has always used those phrases. This module turns the same
// list into something that can be browsed.
//
// There is no second list. A phrase appears here because a published lesson declares it,
// and it links to exactly the lessons that declare it. To add, change or remove a phrase,
// edit the lesson.

import * as C from './catalog.js';
import { forms, words, synonymsOf } from './search.js';

const RANK = { beginner: 0, intermediate: 1, advanced: 2 };
// Small words that mark a phrase as a sentence someone might say ("find an item in a list")
// and not a term of art ("minimum spanning tree"). Sentences are listed first.
const GRAMMAR = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'with', 'from', 'by', 'into', 'up', 'out', 'how', 'what', 'which', 'when', 'without', 'between', 'than', 'that', 'this', 'each', 'every', 'it', 'you', 'did', 'will', 'does', 'cannot']);

let cache = null;

export function problemIndex() {
  if (cache) return cache;
  const byText = new Map();
  for (const a of C.algos) {
    for (const text of a.tags.problems || []) {
      const key = text.trim().toLowerCase();
      if (!byText.has(key)) byText.set(key, { key, text: text.trim(), lessons: [] });
      byText.get(key).lessons.push(a);
    }
  }
  const phrases = [...byText.values()];
  for (const p of phrases) {
    // the gentlest lesson first: it is the one a newcomer should open
    p.lessons.sort((x, y) => RANK[x.difficulty] - RANK[y.difficulty] || x.order - y.order);
    const ws = words(p.text);
    p.plain = ws.some((w) => GRAMMAR.has(w)) || ws.length >= 4;
    p.category = p.lessons[0].lab;
    p.label = p.text.charAt(0).toUpperCase() + p.text.slice(1);
    // what the filter looks at: the phrase itself and the names of the lessons it leads to
    p.tokens = new Set();
    for (const w of [...ws, ...p.lessons.flatMap((a) => words(a.name))]) for (const f of forms(w)) p.tokens.add(f);
  }
  const categories = C.labCategories.map((c) => {
    const mine = phrases.filter((p) => p.category === c.id);
    // order within a category: everyday sentences first, then terms; gentler lessons first
    mine.sort((x, y) => Number(y.plain) - Number(x.plain) || RANK[x.lessons[0].difficulty] - RANK[y.lessons[0].difficulty] || x.lessons[0].order - y.lessons[0].order || x.text.localeCompare(y.text));
    // the few shown before "show all": one phrase from each lesson in turn, so the preview spans the category
    const lead = []; const used = new Set();
    for (let round = 0; lead.length < Math.min(PREVIEW, mine.length) && round < 4; round++) {
      const seen = new Set();
      for (const p of mine) {
        if (lead.length >= PREVIEW) break;
        if (used.has(p.key) || seen.has(p.lessons[0].id)) continue;
        seen.add(p.lessons[0].id); used.add(p.key); lead.push(p);
      }
    }
    return { id: c.id, name: c.name, want: c.want || c.name, phrases: [...lead, ...mine.filter((p) => !used.has(p.key))], preview: lead.length };
  }).filter((c) => c.phrases.length);
  cache = { phrases, categories, total: phrases.length };
  return cache;
}

export const PREVIEW = 5;

// A filter over the phrases, by the same word rules as search: whole words, plurals and
// endings reduced, near-synonyms allowed, and the last word may still be being typed.
export function filterPhrases(raw) {
  const { phrases } = problemIndex();
  const typed = words(raw).filter((w) => !GRAMMAR.has(w));
  if (!typed.length) return phrases;
  const terms = typed.map((w, i) => ({ w, forms: forms(w), syn: synonymsOf(forms(w)[0]), last: i === typed.length - 1 }));
  const hit = (p, t) => t.forms.some((f) => p.tokens.has(f)) || t.syn.some((s) => p.tokens.has(s)) || (t.last && t.w.length >= 2 && [...p.tokens].some((x) => x.startsWith(t.w)));
  return phrases.filter((p) => terms.every((t) => hit(p, t)));
}

// A handful of phrases for the home page: the first everyday sentence of each featured
// lesson, so the signpost points at lessons that have a demonstration worth seeing first.
export function samplePhrases(n = 6) {
  const { phrases } = problemIndex();
  const out = []; const cats = new Set();
  // first one phrase from each kind of problem, then fill any places left
  for (const spread of [true, false]) {
    for (const f of C.featured) {
      if (out.length >= n) break;
      const p = phrases.find((x) => x.plain && x.lessons[0].id === f.id && x.lessons.length === 1 && !out.includes(x) && !(spread && cats.has(x.category)));
      if (p && !out.some((o) => o.lessons[0].id === f.id)) { out.push(p); cats.add(p.category); }
    }
  }
  // two columns: an even number sits better
  return out.length % 2 ? out.slice(0, -1) : out;
}
