// Explore: the Algorithm Universe at full size, with other ways in beneath it.

import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { createExplorer } from '../ui/explorer.js';
import { pageHead, plural } from '../ui/parts.js';

export default async function render({ query }) {
  const initial = query.d && C.disciplineById[query.d] ? { type: 'discipline', id: query.d } : query.a && C.algoById[query.a] ? { type: 'algorithm', id: query.a } : null;
  const explorer = createExplorer({ initial, tall: true });
  const way = (href, title, text) => h('a.way', { href }, h('span.way-title', title, h('span', { html: icon('arrow', { size: 16 }) })), h('span.way-text', text));
  const el = h('div.page.wrap',
    pageHead({ eyebrow: 'Explore', title: 'The Algorithm Universe',
      lede: `A map of ${C.disciplines.length} disciplines and the ${plural(C.algos.length, 'lesson')} written so far. Hills are disciplines, markers are lessons, and dotted routes join fields that share an idea.` }),
    explorer.el,
    h('section.ways', { 'aria-label': 'Other ways to explore' },
      way('#/disciplines', 'By discipline', 'Twenty plates, one for each field, with what each one studies.'),
      way('#/library', 'By lesson', 'The whole library, with filters for level, technique and running time.'),
      way('#/connections', 'By idea', 'Follow one idea across fields that seem unrelated.'),
      way('#/paths', 'By goal', 'Ordered routes for beginners, students and specialists.')));
  return { el, title: 'Explore', destroy() { explorer.destroy(); } };
}
