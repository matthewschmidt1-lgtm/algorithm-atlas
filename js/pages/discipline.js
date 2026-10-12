// One discipline: what it studies, its lessons arranged by subfield and family, what is
// planned, and how it relates to its neighbours.

import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { pageHead, lessonRow, plannedRow, plural } from '../ui/parts.js';
import { plateArt, roman } from '../art/plates.js';
import NotFound from './notfound.js';

export default async function render({ params }) {
  const d = C.disciplineById[params.id];
  if (!d) return NotFound();
  const color = C.GROUPS[d.group].color;
  const own = C.primaryIn(d.id);
  const borrowed = C.inDiscipline(d.id).filter((a) => a.discipline !== d.id).sort((a, b) => a.order - b.order);
  const tree = C.taxonomy(own)[0];
  const plannedHere = C.plannedIn(d.id);
  const paths = C.paths.filter((p) => p.group === d.group || p.stages.some((s) => s.modules.some((m) => own.some((a) => a.id === m.algo)))).slice(0, 4);

  const families = tree ? tree.subfields.map((sf) => h('section.family',
    h('h3.family-sub', sf.name),
    sf.families.map((f) => h('div.family-block',
      h('p.family-name', f.family),
      h('div.lesson-list', f.items.map((a) => lessonRow(a, { showDiscipline: false }))))))) : null;

  const el = h(`div.page.wrap.c-${color}`,
    h('div.disc-head',
      pageHead({ crumbsList: [{ label: 'Disciplines', href: '#/disciplines' }, { label: d.name }], eyebrow: `Plate ${roman(C.disciplines.indexOf(d))} · ${C.GROUPS[d.group].label}`, title: d.name, lede: d.description,
        extra: h('p', h('a.text-link', { href: `#/explore?d=${d.id}` }, 'See it on the map', h('span', { html: icon('arrow', { size: 15 }) }))) }),
      h('figure.disc-figure', { html: plateArt(d.id) })),
    h('div.disc-body',
      h('div.disc-main',
        h('h2', own.length ? `${plural(own.length, 'lesson')} in this discipline` : 'Lessons'),
        own.length ? families : h('div.empty', h('h3', 'Nothing is published here yet.'), h('p', 'Lessons are added only once they have been written and checked. The ones planned for this discipline are listed below.')),
        borrowed.length ? [h('h2.disc-h2', 'Also used here'), h('p.muted', 'Lessons that belong to another discipline and are foundational or widely applied in this one.'),
          h('div.lesson-list', borrowed.map((a) => lessonRow(a, { note: (a.alsoIn.find((o) => o.id === d.id) || {}).why })))] : null,
        plannedHere.length ? [h('h2.disc-h2', 'Planned'), h('p.muted', 'Not yet written. They appear here so that links to them say so plainly.'), h('div.lesson-list', plannedHere.map(plannedRow))] : null),
      h('aside.disc-side',
        h('div.side-block', h('h3', 'Subfields'), h('ul.side-list', d.subfields.map((s) => h('li', s)))),
        h('div.side-block', h('h3', 'Where it is used'), h('ul.side-list', d.applications.map((s) => h('li', s)))),
        h('div.side-block', h('h3', 'Related disciplines'), h('ul.side-related', d.related.map((r) => h('li', h('a.link', { href: `#/discipline/${r.id}` }, C.disciplineById[r.id].name), h('span', r.why))))),
        paths.length ? h('div.side-block', h('h3', 'Learning paths'), h('ul.side-related', paths.map((p) => h('li', h('a.link', { href: `#/path/${p.id}` }, p.title), h('span', p.blurb))))) : null)));
  return { el, title: d.name };
}
