// Read access to all content. Pages never import content files directly; they ask here.
// The generated catalog holds one light record per published lesson; full lessons are
// fetched on demand with loadLesson().

import { catalog } from '../../content/catalog.generated.js';
import { roster, rosterById } from '../../content/roster.js';
import { disciplines, disciplineById, GROUPS } from '../../content/disciplines.js';
import { labCategories, labById } from '../../content/lab-categories.js';

export { disciplines, disciplineById, GROUPS, labCategories, labById, roster };

export const algos = catalog;
export const algoById = Object.fromEntries(catalog.map((a) => [a.id, a]));

// Anything rostered that has no validated lesson is treated as planned, whatever the roster says.
export const planned = roster.filter((r) => !algoById[r.id]);
export const plannedById = Object.fromEntries(planned.map((r) => [r.id, r]));

export let concepts = [];
export let conceptById = {};
export let paths = [];
export let pathById = {};
export let threads = [];
export let compareGroups = [];
export let featured = [];

// Optional content files. A missing or broken file must not take the site down.
export async function loadContent() {
  const grab = async (file, pick) => {
    try { pick(await import(`../../content/${file}`)); } catch (e) { console.warn(`Atlas: content/${file} is unavailable`, e); }
  };
  await Promise.all([
    grab('concepts.js', (m) => { concepts = m.concepts || []; conceptById = Object.fromEntries(concepts.map((c) => [c.id, c])); }),
    grab('paths.js', (m) => { paths = m.paths || []; pathById = Object.fromEntries(paths.map((p) => [p.id, p])); }),
    grab('connections.js', (m) => { threads = m.threads || []; }),
    grab('compare-groups.js', (m) => { compareGroups = (m.compareGroups || []).map((g) => ({ ...g, members: g.members.filter((id) => algoById[id]) })).filter((g) => g.members.length >= 2); }),
    grab('featured.js', (m) => { featured = (m.featured || []).filter((f) => algoById[f.id]); }),
  ]);
}

export const groupOf = (disciplineId) => (disciplineById[disciplineId] || {}).group || 'foundations';
export const colorOf = (disciplineId) => GROUPS[groupOf(disciplineId)].color;

export function inDiscipline(id) {
  return algos.filter((a) => a.discipline === id || (a.alsoIn || []).some((d) => d.id === id));
}
export function primaryIn(id) { return algos.filter((a) => a.discipline === id); }
export function plannedIn(id) { return planned.filter((r) => r.discipline === id); }

export function levelCounts(list) {
  const c = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const a of list) c[a.difficulty]++;
  return c;
}

const lessonCache = new Map();
export function loadLesson(id) {
  if (!algoById[id]) return Promise.reject(new Error(`No published lesson "${id}".`));
  if (!lessonCache.has(id)) {
    lessonCache.set(id, import(`../../content/algorithms/${id}.js`).then((m) => m.default).catch((e) => { lessonCache.delete(id); throw e; }));
  }
  return lessonCache.get(id);
}

// Resolve a reference string used in lessons ("dijkstra", "concept:greedy", "discipline:robotics").
export function resolveRef(ref) {
  if (ref.startsWith('concept:')) {
    const id = ref.slice(8);
    const c = conceptById[id];
    return { kind: 'concept', id, name: c ? c.name : id.replace(/-/g, ' '), href: `#/concept/${id}`, summary: c ? c.simple : '' };
  }
  if (ref.startsWith('discipline:')) {
    const id = ref.slice(11);
    const d = disciplineById[id];
    return { kind: 'discipline', id, name: d ? d.name : id, href: `#/discipline/${id}`, summary: d ? d.blurb : '' };
  }
  const a = algoById[ref];
  if (a) return { kind: 'algorithm', id: ref, name: a.name, href: `#/algorithm/${ref}`, summary: a.summary, difficulty: a.difficulty };
  const r = rosterById[ref];
  return { kind: 'planned', id: ref, name: r ? r.name : ref, href: null, summary: 'Planned. This lesson has not been written yet.' };
}

// The taxonomy tree: discipline > subfield > family > lessons (variants nested under their base).
export function taxonomy(list = algos) {
  const tree = new Map();
  for (const a of list) {
    if (!tree.has(a.discipline)) tree.set(a.discipline, new Map());
    const sub = tree.get(a.discipline);
    if (!sub.has(a.subfield)) sub.set(a.subfield, new Map());
    const fam = sub.get(a.subfield);
    if (!fam.has(a.family)) fam.set(a.family, []);
    fam.get(a.family).push(a);
  }
  return disciplines.filter((d) => tree.has(d.id)).map((d) => ({
    discipline: d,
    subfields: [...tree.get(d.id)].map(([name, fams]) => ({
      name,
      families: [...fams].map(([family, items]) => ({ family, items: items.slice().sort((x, y) => x.order - y.order) })),
    })),
  }));
}

// All edges of the knowledge graph, each with the reason it exists.
let edgeCache = null;
export function graphEdges() {
  if (edgeCache) return edgeCache;
  const edges = [];
  for (const a of algos) {
    edges.push({ from: a.id, to: `discipline:${a.discipline}`, type: 'belongs', why: `${a.name} belongs to ${disciplineById[a.discipline].name}: ${a.subfield.toLowerCase()}.` });
    for (const d of a.alsoIn || []) edges.push({ from: a.id, to: `discipline:${d.id}`, type: 'application', why: d.why });
    for (const c of a.connections || []) {
      if (c.to.startsWith('discipline:') && (c.to.slice(11) === a.discipline || (a.alsoIn || []).some((d) => d.id === c.to.slice(11)))) continue;
      edges.push({ from: a.id, to: c.to, type: c.type, why: c.why });
    }
  }
  for (const d of disciplines) for (const r of d.related) edges.push({ from: `discipline:${d.id}`, to: `discipline:${r.id}`, type: 'related', why: r.why });
  for (const c of concepts) for (const r of c.related || []) edges.push({ from: `concept:${c.id}`, to: `concept:${r}`, type: 'related', why: `${c.name} and ${(conceptById[r] || {}).name || r} are usually learned together.` });
  edgeCache = edges;
  return edges;
}

export function neighbours(ref) {
  const out = [];
  const seen = new Set();
  for (const e of graphEdges()) {
    let other = null, direction = 'out';
    if (e.from === ref) other = e.to;
    else if (e.to === ref) { other = e.from; direction = 'in'; }
    if (!other || other === ref) continue;
    const key = other + '|' + e.type;
    if (seen.has(other)) continue;
    seen.add(other);
    out.push({ ref: other, type: e.type, why: e.why, direction, key });
  }
  return out;
}
