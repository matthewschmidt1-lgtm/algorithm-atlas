// Disciplines: every plate, grouped by family.

import { h } from '../core/dom.js';
import * as C from '../core/catalog.js';
import { pageHead, plate, plural } from '../ui/parts.js';

export default async function render() {
  const groups = Object.entries(C.GROUPS).map(([gid, g]) => {
    const ds = C.disciplines.filter((d) => d.group === gid);
    const lessons = new Set(ds.flatMap((d) => C.inDiscipline(d.id).map((a) => a.id)));
    return h(`section.disc-group.c-${g.color}`,
      h('div.disc-group-head', h('h2', g.label), h('p.muted', `${plural(ds.length, 'discipline')}, ${plural(lessons.size, 'lesson')}`)),
      h('div.plate-grid', ds.map((d) => plate(d, C.disciplines.indexOf(d)))));
  });
  const el = h('div.page.wrap',
    pageHead({ eyebrow: 'Disciplines', title: 'Twenty fields, one subject',
      lede: 'Algorithms are not a branch of computer science alone. The same methods are at work in mathematics, the sciences, engineering and finance. Each plate below is one field: what it studies, and how much of it has been written so far.' }),
    groups);
  return { el, title: 'Disciplines' };
}
