// The Algorithm Universe as an interface: the map, a detail panel, a row of discipline
// buttons for people who do not use a pointer, and a list view with the same content.

import { h, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { createUniverse } from '../art/universe.js';
import { levelGlyph, refLink, plural } from './parts.js';
import { roman } from '../art/plates.js';
import { KIND_LABELS } from '../core/schema.js';

function disciplineDetail(d, jump) {
  const lessons = C.inDiscipline(d.id).slice().sort((a, b) => a.order - b.order);
  const own = lessons.filter((a) => a.discipline === d.id);
  const borrowed = lessons.filter((a) => a.discipline !== d.id);
  const plannedHere = C.plannedIn(d.id);
  const idx = C.disciplines.indexOf(d);
  const lessonItem = (a) => h('li', h('a', { href: `#/algorithm/${a.id}` }, a.name), levelGlyph(a.difficulty));
  return h(`div.detail.c-${C.GROUPS[d.group].color}`,
    h('p.detail-no', `Plate ${roman(idx)} · ${C.GROUPS[d.group].label}`),
    h('h3.detail-title', d.name),
    h('p.detail-lede', d.description),
    h('div.detail-block', h('h4', 'Subfields'), h('p.detail-inline', d.subfields.join(' · '))),
    own.length ? h('div.detail-block', h('h4', 'Foundational lessons'), h('ul.detail-lessons', own.slice(0, 8).map(lessonItem)),
      own.length > 8 ? h('p.small.faint', `and ${own.length - 8} more`) : null) : null,
    borrowed.length ? h('div.detail-block', h('h4', 'Also used here'), h('ul.detail-lessons', borrowed.slice(0, 6).map(lessonItem))) : null,
    !lessons.length ? h('div.detail-block', h('h4', 'Lessons'), h('p.small.muted', plannedHere.length ? `No lessons are published here yet. Planned: ${plannedHere.map((r) => r.name).join(', ')}.` : 'No lessons are published here yet.')) : null,
    h('div.detail-block', h('h4', 'Related disciplines'),
      h('ul.detail-related', d.related.map((r) => h('li',
        jump ? h('button.link', { type: 'button', onclick: () => jump({ type: 'discipline', id: r.id }) }, C.disciplineById[r.id].name)
          : h('a.link', { href: `#/discipline/${r.id}` }, C.disciplineById[r.id].name),
        h('span', r.why))))),
    h('div.detail-block', h('h4', 'Where it is used'), h('p.detail-inline', d.applications.join(' · '))),
    h('p.detail-actions', h('a.btn.btn-primary.btn-sm', { href: `#/discipline/${d.id}` }, `Open ${d.short}`, h('span', { html: icon('arrow', { size: 15 }) }))));
}

function lessonDetail(a, jump) {
  const d = C.disciplineById[a.discipline];
  return h(`div.detail.c-${C.colorOf(a.discipline)}`,
    h('p.detail-no', `${KIND_LABELS[a.kind]} · ${d.name}`),
    h('h3.detail-title', a.name),
    h('p.detail-lede', a.summary),
    a.takeaway ? h('blockquote.detail-quote', a.takeaway) : null,
    h('div.detail-block', h('h4', 'At a glance'),
      h('dl.detail-dl',
        h('dt', 'Level'), h('dd', levelGlyph(a.difficulty, true)),
        h('dt', 'Running time'), h('dd.mono', a.time.worst),
        h('dt', 'Family'), h('dd', `${a.subfield}, ${a.family.toLowerCase()}`))),
    (a.alsoIn || []).length ? h('div.detail-block', h('h4', 'Also at home in'),
      h('ul.detail-related', a.alsoIn.map((o) => h('li',
        jump ? h('button.link', { type: 'button', onclick: () => jump({ type: 'discipline', id: o.id }) }, C.disciplineById[o.id].name)
          : h('a.link', { href: `#/discipline/${o.id}` }, C.disciplineById[o.id].name),
        h('span', o.why))))) : null,
    h('p.detail-actions',
      h('a.btn.btn-primary.btn-sm', { href: `#/algorithm/${a.id}` }, 'Open the lesson'),
      h('a.btn.btn-sm', { href: `#/lab/${a.id}` }, 'Try it in the lab')));
}

export function createExplorer({ initial = null, tall = false } = {}) {
  const mapHost = h('div.universe-map');
  const panel = h('aside.universe-panel', { 'aria-live': 'polite', 'aria-label': 'Details for the selected item' });
  const listHost = h('div.universe-list', { hidden: true });
  let universe = null;
  let view = 'map';

  const intro = () => h('div.detail',
    h('p.detail-no', 'How to read this map'),
    h('h3.detail-title', 'Twenty disciplines, one landscape'),
    h('p.detail-lede', 'Each hill is a discipline. The more lessons it holds, the more contour rings it has. Small markers around a hill are its lessons, and dotted routes join disciplines that share an idea.'),
    h('ul.detail-key',
      Object.values(C.GROUPS).map((g) => h('li', h(`span.dot.c-${g.color}`), g.label))),
    h('p.small.muted', 'Select a hill or a marker to read about it. Drag to move, and use the buttons to zoom. Click the map first if you want to zoom by scrolling.'),
    h('p.small.muted', `${plural(C.algos.length, 'lesson')} published across ${C.disciplines.filter((d) => C.inDiscipline(d.id).length).length} of ${C.disciplines.length} disciplines.`));

  function show(sel) {
    clear(panel);
    if (!sel) panel.append(intro());
    else if (sel.type === 'discipline') panel.append(disciplineDetail(C.disciplineById[sel.id], (s) => universe.select(s)));
    else panel.append(lessonDetail(C.algoById[sel.id], (s) => universe.select(s)));
    panel.scrollTop = 0;
    for (const b of chipRow.querySelectorAll('button')) b.setAttribute('aria-pressed', sel && sel.type === 'discipline' && b.dataset.id === sel.id ? 'true' : 'false');
  }

  const chipRow = h('div.universe-chips', { role: 'group', 'aria-label': 'Jump to a discipline' },
    C.disciplines.map((d) => h(`button.uchip.c-${C.GROUPS[d.group].color}`, { type: 'button', dataset: { id: d.id }, 'aria-pressed': 'false',
      onclick: () => { if (view !== 'map') setView('map'); universe.select({ type: 'discipline', id: d.id }); } }, h('span.dot'), d.short)));

  function buildList() {
    clear(listHost);
    for (const [gid, g] of Object.entries(C.GROUPS)) {
      const ds = C.disciplines.filter((d) => d.group === gid);
      listHost.append(h(`section.ulist-group.c-${g.color}`,
        h('h3.ulist-head', h('span.dot'), g.label),
        ds.map((d) => h('details.fold', h('summary', h('span', d.name), h('span.small.faint', plural(C.inDiscipline(d.id).length, 'lesson'))), h('div.fold-body', disciplineDetail(d, null))))));
    }
  }

  const mapBtn = h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setView('map'), html: `${icon('target', { size: 15 })} Map` });
  const listBtn = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setView('list'), html: `${icon('list', { size: 15 })} List` });
  const zoomTools = h('div.universe-zoom', { role: 'group', 'aria-label': 'Map controls' },
    h('button.icon-btn', { type: 'button', 'aria-label': 'Zoom in', title: 'Zoom in', html: icon('zoomIn'), onclick: () => universe.zoomIn() }),
    h('button.icon-btn', { type: 'button', 'aria-label': 'Zoom out', title: 'Zoom out', html: icon('zoomOut'), onclick: () => universe.zoomOut() }),
    h('button.icon-btn', { type: 'button', 'aria-label': 'Show the whole map', title: 'Show the whole map', html: icon('reset'), onclick: () => universe.reset() }));

  function setView(v) {
    view = v;
    mapBtn.setAttribute('aria-pressed', v === 'map' ? 'true' : 'false');
    listBtn.setAttribute('aria-pressed', v === 'list' ? 'true' : 'false');
    body.hidden = v !== 'map'; chipRow.hidden = v !== 'map'; zoomTools.hidden = v !== 'map';
    listHost.hidden = v !== 'list';
    if (v === 'list' && !listHost.children.length) buildList();
  }

  const body = h('div.universe-body', h('div.universe-map-wrap', mapHost, h('p.universe-hint', 'Tap the map to move it. Tap elsewhere to scroll the page.')), panel);
  const el = h(`div.universe${tall ? '.is-tall' : ''}`,
    h('div.universe-bar', h('div.seg', { role: 'group', 'aria-label': 'View' }, mapBtn, listBtn), zoomTools),
    body, chipRow, listHost);

  // The canvas needs a measured width, so mount it once the element is in the document.
  const mount = () => {
    if (universe) return;
    universe = createUniverse(mapHost, { onSelect: show });
    show(null);
    if (initial) universe.select(initial);
  };
  queueMicrotask(() => requestAnimationFrame(mount));

  return { el, destroy() { if (universe) universe.destroy(); } };
}

export { disciplineDetail };
