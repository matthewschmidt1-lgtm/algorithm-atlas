// What a track holds, worked out from content/tracks.js and the lessons themselves.

import * as C from './catalog.js';

// The track's lessons in the order it lists them, split into written and planned.
export function trackLessons(track) {
  const ids = [...new Set(track.groups.flatMap((g) => g.lessons))];
  return { published: ids.map((id) => C.algoById[id]).filter(Boolean), planned: ids.map((id) => C.plannedById[id]).filter(Boolean) };
}

// Published lessons outside the track that its lessons say they assume, with who assumes them.
export function trackFoundations(track) {
  const { published } = trackLessons(track);
  const inside = new Set(published.map((a) => a.id));
  const need = new Map();
  for (const a of published) {
    const assumed = new Set([...(a.prerequisites || []), ...(a.connections || []).filter((c) => c.type === 'prerequisite').map((c) => c.to)]);
    for (const id of assumed) {
      if (!C.algoById[id] || inside.has(id)) continue;
      if (!need.has(id)) need.set(id, []);
      need.get(id).push(a);
    }
  }
  return [...need].map(([id, neededBy]) => ({ lesson: C.algoById[id], neededBy })).sort((x, y) => y.neededBy.length - x.neededBy.length || x.lesson.order - y.lesson.order);
}

// The tracks a lesson belongs to.
export function tracksOf(lessonId) { return C.tracks.filter((t) => t.groups.some((g) => g.lessons.includes(lessonId))); }
