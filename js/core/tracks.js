// What a guide holds, worked out from content/tracks.js and the lessons themselves.
// (The files and addresses say "track". The pages call it a guide.)

import * as C from './catalog.js';

export const ROLES = {
  direct: { label: 'Direct business application', about: 'The lesson itself models a recognisable business problem.' },
  method: { label: 'Business-relevant method', about: 'The lesson teaches a general method that businesses use, on a simplified example.' },
  foundation: { label: 'Technical foundation', about: 'A supporting lesson, needed to understand or build one of the others.' },
};

// The guide's lessons in the order it lists them, split into written and planned.
export function trackLessons(track) {
  const ids = [...new Set(track.groups.flatMap((g) => g.lessons))];
  return { published: ids.map((id) => C.algoById[id]).filter(Boolean), planned: ids.map((id) => C.plannedById[id]).filter(Boolean) };
}

// Published lessons outside the guide that the given lessons say they assume, with who assumes
// them. Pass a group's lessons to get that group's technical foundations.
export function foundationsFor(track, lessonIds) {
  const inside = new Set(trackLessons(track).published.map((a) => a.id));
  const need = new Map();
  for (const id of lessonIds) {
    const a = C.algoById[id];
    if (!a) continue;
    const assumed = new Set([...(a.prerequisites || []), ...(a.connections || []).filter((c) => c.type === 'prerequisite').map((c) => c.to)]);
    for (const pre of assumed) {
      if (!C.algoById[pre] || inside.has(pre)) continue;
      if (!need.has(pre)) need.set(pre, []);
      need.get(pre).push(a);
    }
  }
  return [...need].map(([id, neededBy]) => ({ lesson: C.algoById[id], neededBy })).sort((x, y) => y.neededBy.length - x.neededBy.length || x.lesson.order - y.lesson.order);
}
export function trackFoundations(track) { return foundationsFor(track, track.groups.flatMap((g) => g.lessons)); }

// The guides a lesson belongs to.
export function tracksOf(lessonId) { return C.tracks.filter((t) => t.groups.some((g) => g.lessons.includes(lessonId))); }

// What the business guide says about a lesson: its role, the decision it serves, and the bridge
// from the lesson's own example to that decision. Null for a lesson that is not in that guide.
export function businessView(lessonId) {
  const t = C.trackById.business;
  if (!t) return null;
  for (const g of t.groups) { const it = g.items.find((x) => x.id === lessonId); if (it && it.question) return { ...it, group: g, cases: (t.cases || []).map((id) => C.caseById[id]).filter((c) => c && c.lesson === lessonId) }; }
  return null;
}
