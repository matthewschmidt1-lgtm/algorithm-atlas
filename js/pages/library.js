// The Algorithm Library: every published lesson, searchable and filterable, as a flat
// list or as a hierarchy (discipline, subfield, family, lesson). The count shown is the
// real number of lessons that passed validation. Filters and sort live in the URL.

import { h, clear, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { replaceQuery } from '../core/router.js';
import { rankLessons } from '../core/search.js';
import { DIFFICULTIES, PARADIGM_LABELS, TIME_CLASSES, TIME_CLASS_LABELS, SPACE_CLASSES, SPACE_CLASS_LABELS, KIND_LABELS, LANGUAGE_LABELS } from '../core/schema.js';
import { pageHead, lessonRow, plannedRow, plural, LEVEL_NAMES } from '../ui/parts.js';

const SORTS = [['order', 'Learning order'], ['name', 'Name'], ['difficulty', 'Difficulty'], ['relevance', 'Relevance']];

export default async function render({ query }) {
  const f = {
    q: query.q || '', discipline: query.discipline || '', difficulty: query.difficulty || '', paradigm: query.paradigm || '',
    time: query.time || '', space: query.space || '', random: query.random || '', exact: query.exact || '', app: query.app || '',
    kind: query.kind || '', lang: query.lang || '', sort: query.sort || '', view: query.view || 'list',
  };
  const appCounts = {};
  for (const a of C.algos) for (const t of a.tags.applications || []) appCounts[t] = (appCounts[t] || 0) + 1;
  const apps = Object.entries(appCounts).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 16).map(([t]) => t);
  const paradigms = Object.keys(PARADIGM_LABELS).filter((p) => C.algos.some((a) => a.paradigms.includes(p)));
  const kinds = Object.keys(KIND_LABELS).filter((k) => C.algos.some((a) => a.kind === k));

  const out = h('div.lib-results');
  const count = h('p.lib-count', { 'aria-live': 'polite' });
  const activeBar = h('div.lib-active');

  const sel = (key, label, options) => {
    const el = h('select', { 'aria-label': label, onchange: (e) => { f[key] = e.target.value; apply(); } },
      h('option', { value: '' }, `Any ${label.toLowerCase()}`), options.map(([v, t]) => h('option', { value: v, selected: f[key] === v }, t)));
    return h('label.filter', h('span.filter-label', label), el);
  };
  const searchInput = h('input', { type: 'search', placeholder: 'Filter by name, problem, technique or application', value: f.q, 'aria-label': 'Filter the library', autocomplete: 'off',
    oninput: debounce((e) => { f.q = e.target.value; apply(); }, 140) });
  const sortSel = h('select', { 'aria-label': 'Sort by', onchange: (e) => { f.sort = e.target.value; apply(); } }, SORTS.map(([v, t]) => h('option', { value: v }, t)));
  const filters = h('form.lib-filters', { onsubmit: (e) => e.preventDefault(), 'aria-label': 'Filters' },
    sel('discipline', 'Discipline', C.disciplines.filter((d) => C.inDiscipline(d.id).length).map((d) => [d.id, d.name])),
    sel('difficulty', 'Difficulty', DIFFICULTIES.map((d) => [d, LEVEL_NAMES[d]])),
    sel('paradigm', 'Paradigm', paradigms.map((p) => [p, PARADIGM_LABELS[p]])),
    sel('time', 'Time complexity', TIME_CLASSES.filter((t) => C.algos.some((a) => a.time.class === t)).map((t) => [t, TIME_CLASS_LABELS[t]])),
    sel('space', 'Space complexity', SPACE_CLASSES.filter((t) => C.algos.some((a) => a.space.class === t)).map((t) => [t, SPACE_CLASS_LABELS[t]])),
    sel('random', 'Randomness', [['no', 'Deterministic'], ['yes', 'Randomized']]),
    sel('exact', 'Exactness', [['yes', 'Exact'], ['no', 'Approximate']]),
    sel('app', 'Primary application', apps.map((t) => [t, t.replace(/^./, (c) => c.toUpperCase())])),
    sel('kind', 'Kind', kinds.map((k) => [k, KIND_LABELS[k]])),
    sel('lang', 'Programming language', Object.entries(LANGUAGE_LABELS)));

  const viewBtns = [['list', 'List', 'list'], ['tree', 'Hierarchy', 'layers'], ['concepts', 'Concepts', 'book']].map(([id, label, ic]) =>
    h('button', { type: 'button', dataset: { v: id }, 'aria-pressed': 'false', onclick: () => { f.view = id; apply(); }, html: `${icon(ic, { size: 15 })} ${label}` }));

  function matches(a) {
    if (f.discipline && a.discipline !== f.discipline && !(a.alsoIn || []).some((d) => d.id === f.discipline)) return false;
    if (f.difficulty && a.difficulty !== f.difficulty) return false;
    if (f.paradigm && !a.paradigms.includes(f.paradigm)) return false;
    if (f.time && a.time.class !== f.time) return false;
    if (f.space && a.space.class !== f.space) return false;
    if (f.random && (a.randomized ? 'yes' : 'no') !== f.random) return false;
    if (f.exact && (a.approximate ? 'no' : 'yes') !== f.exact) return false;
    if (f.app && !(a.tags.applications || []).includes(f.app)) return false;
    if (f.kind && a.kind !== f.kind) return false;
    if (f.lang && !a.languages.includes(f.lang)) return false;
    return true;
  }

  function apply() {
    const q = f.q.trim();
    const sort = f.sort || (q.length >= 2 ? 'relevance' : 'order');
    sortSel.value = sort;
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === f.view ? 'true' : 'false'));
    replaceQuery({ ...f, view: f.view === 'list' ? '' : f.view });
    clear(out); clear(activeBar);
    filters.hidden = f.view === 'concepts';

    if (f.view === 'concepts') {
      const list = C.concepts.filter((c) => !q || (c.name + ' ' + (c.aliases || []).join(' ') + ' ' + c.simple).toLowerCase().includes(q.toLowerCase()));
      count.textContent = `${plural(list.length, 'concept')} defined in plain words${q ? `, matching "${q}"` : ''}.`;
      if (!list.length) { out.append(h('div.empty', h('h3', C.concepts.length ? 'No concept matches.' : 'The glossary is not available.'), h('p', 'Try a different word.'))); return; }
      out.append(h('dl.concept-index', list.map((c) => h('div', h('dt', h('a', { href: `#/concept/${c.id}` }, c.name)), h('dd', c.simple)))));
      return;
    }

    let list = C.algos.filter(matches);
    let rank = null;
    if (q.length >= 2) { rank = rankLessons(q); const pos = new Map(rank.map((id, i) => [id, i])); list = list.filter((a) => pos.has(a.id)); if (sort === 'relevance') list.sort((x, y) => pos.get(x.id) - pos.get(y.id)); }
    const dOrder = { beginner: 0, intermediate: 1, advanced: 2 };
    if (sort === 'name') list.sort((x, y) => x.name.localeCompare(y.name));
    else if (sort === 'difficulty') list.sort((x, y) => dOrder[x.difficulty] - dOrder[y.difficulty] || x.order - y.order);
    else if (sort === 'order' || (sort === 'relevance' && !rank)) list.sort((x, y) => x.order - y.order);

    const anyFilter = ['discipline', 'difficulty', 'paradigm', 'time', 'space', 'random', 'exact', 'app', 'kind', 'lang'].some((k) => f[k]) || q;
    count.textContent = anyFilter ? `Showing ${list.length} of ${plural(C.algos.length, 'published lesson')}.` : `${plural(C.algos.length, 'published lesson')}. Every one has passed the checks described on the About page.`;
    if (anyFilter) activeBar.append(h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => { for (const k of Object.keys(f)) if (!['view', 'sort'].includes(k)) f[k] = ''; searchInput.value = ''; for (const s of filters.querySelectorAll('select')) s.value = ''; apply(); }, html: `${icon('x', { size: 14 })}<span>Clear all filters</span>` }));

    if (!list.length) {
      out.append(h('div.empty', h('h3', 'No lesson matches these filters.'), h('p', 'Remove a filter or two. If you were looking for a specific algorithm, it may be on the planned list at the bottom of the unfiltered library.')));
      return;
    }
    if (f.view === 'tree') {
      for (const node of C.taxonomy(list)) {
        out.append(h(`section.tree-disc.c-${C.GROUPS[node.discipline.group].color}`,
          h('h2.tree-h', h('a', { href: `#/discipline/${node.discipline.id}` }, node.discipline.name), h('span.small.faint', plural(node.subfields.flatMap((s) => s.families.flatMap((x) => x.items)).length, 'lesson'))),
          node.subfields.map((sf) => h('div.tree-sub', h('h3', sf.name),
            sf.families.map((fam) => h('div.tree-fam', h('p.family-name', fam.family),
              h('ul.tree-items', fam.items.map((a) => h('li', h('a', { href: `#/algorithm/${a.id}` }, a.name), a.variantOf ? h('span.small.faint', ` variant of ${C.resolveRef(a.variantOf).name}`) : null, h('span.small.faint.mono', a.time.worst))))))))));
      }
    } else {
      out.append(h('div.lesson-list', list.map((a) => lessonRow(a))));
    }
    if (!anyFilter && C.planned.length) {
      out.append(h('details.fold.planned-fold', h('summary', `Planned, not yet written (${C.planned.length})`),
        h('div.fold-body', h('p.muted.small', 'These are named so that lessons can refer to them honestly. They are not lessons yet.'), h('div.lesson-list', C.planned.map(plannedRow)))));
    }
  }

  const el = h('div.page.wrap',
    pageHead({ eyebrow: 'Algorithm Library', title: 'The library',
      lede: 'Every lesson in the atlas. Filter by field, level, technique or cost, or switch to the hierarchy to move from disciplines down to individual algorithms.' }),
    h('div.lib-top',
      h('div.lib-search', h('span', { html: icon('search', { size: 18 }) }), searchInput),
      h('label.filter.lib-sort', h('span.filter-label', 'Sort by'), sortSel),
      h('div.seg', { role: 'group', 'aria-label': 'View' }, viewBtns)),
    h('details.lib-filter-fold', { open: window.innerWidth > 760 }, h('summary', h('span', { html: icon('filter', { size: 16 }) }), 'Filters'), filters),
    h('div.lib-status', count, activeBar),
    out);
  apply();
  return { el, title: 'Algorithm Library' };
}
