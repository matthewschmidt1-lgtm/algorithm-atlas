// What to read around a lesson, and why. Nothing here is written for this file: every
// suggestion is a connection that a lesson states, or a module of a learning path, and it
// carries the sentence that was written for it. Where no stated connection leads to a
// published lesson, there is no suggestion.

import * as C from './catalog.js';
import { store } from './store.js';

const published = (ref) => !!C.algoById[ref];

// The published lessons around `id`, by what they are to it.
//   before        this lesson says it assumes them
//   deeper        this lesson says they go further, or they say they build on this lesson
//   alternatives  this lesson says they solve the same problem, or are a variant
//   uses          this lesson says it is put to use in them
//   nearby        this lesson says they are related
//   planned       named as going further, but not written yet
export function around(id) {
  const a = C.algoById[id];
  const out = { before: [], deeper: [], alternatives: [], uses: [], nearby: [], planned: [] };
  if (!a) return out;
  const own = a.connections || [];
  const seen = new Set();
  const push = (list, ref, kind, why) => { if (!seen.has(ref)) { seen.add(ref); list.push({ ref, kind, why }); } };
  for (const c of own) {
    if (c.to.includes(':')) continue;
    if (!published(c.to)) { if (c.type === 'advanced') out.planned.push({ ref: c.to, kind: 'advanced', why: c.why }); continue; }
    if (c.type === 'prerequisite') push(out.before, c.to, 'prerequisite', c.why);
    else if (c.type === 'advanced') push(out.deeper, c.to, 'advanced', c.why);
    else if (c.type === 'same-problem' || c.type === 'variant') push(out.alternatives, c.to, c.type, c.why);
  }
  // Lessons that say they assume this one. A lesson states that in its connections, in its
  // list of prerequisites, or both. Its own sentence about this lesson is used when it wrote one.
  for (const b of C.algos) {
    if (b.id === id) continue;
    const link = (b.connections || []).find((c) => c.to === id);
    const assumes = (link && link.type === 'prerequisite') || (b.prerequisites || []).includes(id);
    if (assumes) push(out.deeper, b.id, 'builds-on', link ? link.why : `${b.name} lists this lesson among the things it assumes.`);
  }
  // Lessons this one says it is put to use in, and lessons it calls related. Neither is
  // deeper, and neither is offered as such.
  for (const c of own) {
    if (c.to.includes(':') || !published(c.to)) continue;
    if (c.type === 'application') push(out.uses, c.to, 'application', c.why);
    else if (c.type === 'related') push(out.nearby, c.to, 'related', c.why);
  }
  return out;
}

export const STEP_LABELS = {
  path: 'Next in this path', advanced: 'Go further', 'builds-on': 'Builds on this lesson',
  'same-problem': 'Another way to solve it', variant: 'A variant of this', prerequisite: 'Worth reading first',
  application: 'Where this is put to use', related: 'A related idea',
};

// One step forward from a lesson, or null. In order: the next lesson of the path the reader
// arrived by, then something deeper, then a lesson that puts this one to use (which moves
// the reader on), then another method for the same problem (which moves them sideways),
// then a lesson it calls related. Each is labelled as what it is. Lessons the
// reader has not opened are preferred.
export function nextStep(id, { pathId = null } = {}) {
  const path = pathId && C.pathById[pathId];
  if (path) {
    const modules = path.stages.flatMap((s) => s.modules).filter((m) => published(m.algo));
    const at = modules.findIndex((m) => m.algo === id);
    if (at >= 0 && modules[at + 1]) return { kind: 'path', ref: modules[at + 1].algo, why: modules[at + 1].why, label: `Next in ${path.title}`, path: path.id };
  }
  const explored = store.explored();
  const pick = (list) => list.find((x) => !explored.has(x.ref)) || list[0];
  const r = around(id);
  const step = pick(r.deeper) || pick(r.uses) || pick(r.alternatives) || pick(r.nearby);
  return step ? { ...step, label: STEP_LABELS[step.kind] } : null;
}

// One step back: the lesson before this one in the reader's path, or a lesson this one
// says it assumes. Null when it assumes only concepts, or nothing.
export function stepBefore(id, { pathId = null } = {}) {
  const path = pathId && C.pathById[pathId];
  if (path) {
    const modules = path.stages.flatMap((s) => s.modules).filter((m) => published(m.algo));
    const at = modules.findIndex((m) => m.algo === id);
    if (at > 0) return { kind: 'path', ref: modules[at - 1].algo, why: modules[at - 1].why, label: `Before this in ${path.title}`, path: path.id };
  }
  const first = around(id).before[0];
  return first ? { ...first, label: STEP_LABELS.prerequisite } : null;
}

// Published lessons that name a planned lesson, for the planned lesson's page.
export function pointingTo(plannedId) {
  const out = [];
  for (const a of C.algos) for (const c of a.connections || []) if (c.to === plannedId) out.push({ ref: a.id, type: c.type, why: c.why });
  return out;
}
