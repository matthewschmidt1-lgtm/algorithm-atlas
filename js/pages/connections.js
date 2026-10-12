// Everything Is Connected. Two ways to follow ideas across fields:
//   threads, which are written routes that state a shared principle and walk through it;
//   the graph, where any lesson, concept or discipline can be put at the centre and its
//   connections traversed, leaving a trail of where you have been.

import { h, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { replaceQuery } from '../core/router.js';
import { pageHead, refLink } from '../ui/parts.js';
import { createRelMap } from '../ui/relmap.js';

export default async function render({ query }) {
  /* ---- threads ---- */
  const threadEls = C.threads.map((t) => {
    const el = h(`article.thread.c-${t.color}`, { id: `thread-${t.id}` },
      h('header.thread-head', h('h3', t.title), h('p.thread-principle', h('span.panel-cap', 'The shared principle'), t.principle)),
      h('ol.thread-walk', t.stops.map((s, i) => {
        const r = C.resolveRef(s.ref);
        return h('li', h('span.walk-no', String(i + 1)),
          h('div', h('p.walk-name', refLink(s.ref), ' ', h('span.ref-kind', r.kind === 'algorithm' ? 'Lesson' : r.kind === 'planned' ? '' : r.kind)), h('p.walk-note', s.note),
            r.kind !== 'planned' ? h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => centre(s.ref, true) }, 'Centre the graph here') : null));
      })));
    return el;
  });

  /* ---- graph ---- */
  const mapHost = h('div.graph-host');
  const trailEl = h('ol.trail', { 'aria-label': 'Your trail' });
  let trail = [];
  const options = [
    ...C.algos.slice().sort((a, b) => a.name.localeCompare(b.name)).map((a) => [a.id, a.name, 'Lessons']),
    ...C.disciplines.map((d) => [`discipline:${d.id}`, d.name, 'Disciplines']),
    ...C.concepts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => [`concept:${c.id}`, c.name, 'Concepts']),
  ];
  const picker = h('select', { 'aria-label': 'Choose what to put at the centre', onchange: (e) => centre(e.target.value, false) },
    ['Lessons', 'Disciplines', 'Concepts'].map((g) => h('optgroup', { label: g }, options.filter((o) => o[2] === g).map((o) => h('option', { value: o[0] }, o[1])))));

  function centre(ref, scroll) {
    const at = trail.indexOf(ref);
    trail = at >= 0 ? trail.slice(0, at + 1) : [...trail, ref].slice(-8);
    picker.value = ref;
    replaceQuery({ at: ref });
    const r = C.resolveRef(ref);
    const items = C.neighbours(ref).map((n) => ({ ref: n.ref, type: n.type === 'belongs' && n.direction === 'in' ? 'related' : n.type, why: n.why }));
    clear(mapHost).append(
      h('div.graph-head', h('div', h('p.panel-cap', r.kind === 'algorithm' ? 'Lesson' : r.kind), h('h3', r.name), h('p.muted', r.summary)),
        r.href ? h('a.btn.btn-sm', { href: r.href }, 'Open it', h('span', { html: icon('arrow', { size: 14 }) })) : null),
      items.length ? createRelMap(ref, items, { onSelect: (next) => centre(next, false) }) : h('p.muted', 'Nothing is connected to this yet.'));
    clear(trailEl).append(...trail.map((t, i) => h('li', i === trail.length - 1 ? h('span', { 'aria-current': 'step' }, C.resolveRef(t).name) : h('button.link', { type: 'button', onclick: () => centre(t, false) }, C.resolveRef(t).name))));
    if (scroll) graphSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const graphSec = h('section.section', { id: 'graph' },
    h('div.sec-head.single', h('p.eyebrow', 'The graph'), h('h2', 'Follow any idea'), h('p.lede', 'Put a lesson, a concept or a discipline at the centre. Everything around it is connected to it for a stated reason. Choose a neighbour to move there, and the trail keeps track of your route.')),
    h('div.graph-bar', h('label.filter', h('span.filter-label', 'At the centre'), picker), h('div.trail-wrap', h('span.panel-cap', 'Trail'), trailEl)),
    mapHost);

  const el = h('div.page.wrap',
    pageHead({ eyebrow: 'Connections', title: 'Everything Is Connected',
      lede: 'A handful of ideas explain a surprising share of the subject. Each thread below takes one idea, states the principle behind it, and follows it through fields that rarely share a textbook.' }),
    h('nav.thread-index', { 'aria-label': 'Threads' }, C.threads.map((t) => h('a', { href: `#thread-${t.id}`, onclick: (e) => { e.preventDefault(); document.getElementById(`thread-${t.id}`).scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, t.title))),
    h('div.threads', threadEls),
    graphSec);

  const start = query.at && C.resolveRef(query.at).kind !== 'planned' ? query.at : (C.algoById.dijkstra ? 'dijkstra' : (C.algos[0] || {}).id);
  if (start) centre(start, false);
  return { el, title: 'Connections', afterMount() {
    if (query.thread) { const t = document.getElementById(`thread-${query.thread}`); if (t) t.scrollIntoView({ block: 'start' }); }
    else if (query.at) graphSec.scrollIntoView({ block: 'start' });
  } };
}
