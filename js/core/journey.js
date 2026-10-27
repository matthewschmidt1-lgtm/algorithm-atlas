// A learning path as a journey: an ordered road of stops, each one a page to visit.
// A stop is a lesson, or for some paths a warm-up page first (the kitchen). The journey
// knows where the reader is, which stops they have visited, and the one stop that comes next,
// so every page on the road can offer a single way forward instead of a new set of choices.

import * as C from './catalog.js';
import { store } from './store.js';

const WARMUPS = {
  kitchen: { id: 'kitchen', name: 'Algorithms for the kitchen', why: 'Four everyday kitchen puzzles, with no formulas. A gentle way in.', route: '#/kitchen' },
};

export function journeyStops(path) {
  if (!path) return [];
  const skipped = new Set(store.state.pathSkips[path.id] || []);
  const stops = [];
  const w = WARMUPS[path.warmup];
  if (w) stops.push({ kind: 'page', id: w.id, name: w.name, why: w.why, stage: { id: 'warmup', title: 'Warm-up' }, href: `${w.route}?path=${path.id}` });
  for (const s of path.stages) {
    if (skipped.has(s.id)) continue;
    for (const m of s.modules) {
      const a = C.algoById[m.algo];
      if (a) stops.push({ kind: 'lesson', id: a.id, name: a.name, why: m.why, stage: s, href: `#/algorithm/${a.id}?path=${path.id}` });
    }
  }
  const explored = store.explored();
  stops.forEach((st, i) => { st.n = i + 1; st.seen = st.kind === 'page' ? store.pageSeen(st.id) : explored.has(st.id); });
  return stops;
}

// Where the reader stands on the road, and the one stop after it.
export function journeyAt(path, id) {
  const stops = journeyStops(path);
  const i = stops.findIndex((s) => s.id === id);
  return { stops, here: i >= 0 ? stops[i] : null, next: i >= 0 ? stops[i + 1] || null : null, total: stops.length };
}

// The first stop not yet visited: where "continue" should go.
export function journeyResume(path) {
  const stops = journeyStops(path);
  return { stops, resume: stops.find((s) => !s.seen) || null, started: stops.some((s) => s.seen), done: stops.length > 0 && stops.every((s) => s.seen) };
}

// The path a page was reached through, if it is really on that path's road.
export function journeyFor(query, id) {
  const path = query && query.path ? C.pathById[query.path] : null;
  if (!path) return null;
  return journeyStops(path).some((s) => s.id === id) ? path : null;
}
