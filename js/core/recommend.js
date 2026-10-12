// Recommendations from the visitor's own answers and history. Deliberately simple and
// explainable: every suggestion carries the reason it was made.

import * as C from './catalog.js';
import { store } from './store.js';

export const LEVELS = [
  { id: 'beginner', label: 'New to this', help: 'I have not studied algorithms before.' },
  { id: 'intermediate', label: 'Some experience', help: 'I can program and know a few classic algorithms.' },
  { id: 'advanced', label: 'Experienced', help: 'I am comfortable with analysis and want depth.' },
];
export const GOALS = [
  { id: 'curious', label: 'I am curious how things work' },
  { id: 'study', label: 'Support a course I am taking' },
  { id: 'interviews', label: 'Prepare for technical interviews' },
  { id: 'build', label: 'Build something that needs these ideas' },
  { id: 'research', label: 'Go deep, toward research' },
];
const GOAL_PATHS = {
  curious: ['absolute-beginners'],
  study: ['cs-foundations', 'data-structures-algorithms'],
  interviews: ['data-structures-algorithms', 'cs-foundations'],
  build: [],
  research: ['research-algorithm-design', 'mathematics-for-algorithms'],
};

const fit = { beginner: { beginner: 3, intermediate: 0.4, advanced: -2 }, intermediate: { beginner: 0.8, intermediate: 3, advanced: 1 }, advanced: { beginner: 0.3, intermediate: 1.6, advanced: 3 } };

export function recommendLessons(limit = 6) {
  const p = store.state.profile;
  const explored = store.explored();
  const level = (p && p.level) || 'beginner';
  const interests = new Set((p && p.interests) || []);
  const recent = store.state.recents.slice(0, 6).map((r) => r.id).filter((id) => C.algoById[id]);
  const out = [];
  for (const a of C.algos) {
    if (explored.has(a.id)) continue;
    let score = fit[level][a.difficulty];
    let reason = level === 'beginner' && a.difficulty === 'beginner' ? 'A good place to start' : '';
    if (interests.has(a.discipline)) { score += 3; reason = `Matches your interest in ${C.disciplineById[a.discipline].name}`; }
    else {
      const also = (a.alsoIn || []).find((d) => interests.has(d.id));
      if (also) { score += 1.6; reason = `Used in ${C.disciplineById[also.id].name}, which you chose`; }
    }
    const pre = (a.prerequisites || []).filter((x) => C.algoById[x]);
    const missing = pre.filter((x) => !explored.has(x));
    if (pre.length && !missing.length) { score += 1.6; if (!reason || level !== 'beginner') reason = `You have covered what it builds on: ${pre.map((x) => C.algoById[x].name).join(', ')}`; }
    score -= missing.length * 0.8;
    for (const r of recent) {
      const from = C.algoById[r];
      const link = (from.connections || []).find((c) => c.to === a.id) || (a.connections || []).find((c) => c.to === r);
      if (link) { score += 2.2; reason = `Connected to ${from.name}, which you explored`; break; }
    }
    score -= a.order / 4000;
    out.push({ a, score, reason: reason || 'A sound next step at your level' });
  }
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, limit);
}

export function recommendPaths(limit = 3) {
  const p = store.state.profile;
  const level = (p && p.level) || 'beginner';
  const interests = new Set((p && p.interests) || []);
  const groups = new Set([...interests].map((id) => C.groupOf(id)));
  const goalPaths = new Set(((p && p.goals) || []).flatMap((g) => GOAL_PATHS[g] || []));
  const out = C.paths.map((path) => {
    let score = path.level === level ? 2.5 : (level === 'beginner' && path.level === 'advanced') || (level === 'advanced' && path.level === 'beginner') ? -1.5 : 0.8;
    let reason = path.level === level ? 'Pitched at your level' : '';
    if (groups.has(path.group)) { score += 2; reason = 'Close to the fields you chose'; }
    if (goalPaths.has(path.id)) { score += 2.5; reason = 'Fits the goal you gave'; }
    const published = path.stages.flatMap((s) => s.modules).filter((m) => C.algoById[m.algo]).length;
    const total = path.stages.flatMap((s) => s.modules).length || 1;
    score += (published / total) * 1.5;
    return { path, score, reason: reason || 'A broad foundation' };
  });
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, limit);
}

// Progress through a path: a module counts once its lesson has been explored.
export function pathProgress(path) {
  const explored = store.explored();
  const skipped = new Set(store.state.pathSkips[path.id] || []);
  let total = 0, done = 0, next = null;
  for (const s of path.stages) {
    if (skipped.has(s.id)) continue;
    for (const m of s.modules) {
      if (!C.algoById[m.algo]) continue;
      total++;
      if (explored.has(m.algo)) done++; else if (!next) next = { stage: s, module: m };
    }
  }
  return { total, done, next, started: done > 0, complete: total > 0 && done >= total };
}
