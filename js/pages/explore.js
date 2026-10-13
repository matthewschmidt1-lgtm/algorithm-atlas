// Explore has one job: the map. Other ways into the atlas are signposted from the home page.

import { h } from '../core/dom.js';
import * as C from '../core/catalog.js';
import { createExplorer } from '../ui/explorer.js';
import { pageHead, plural } from '../ui/parts.js';

export default async function render({ query }) {
  const initial = query.d && C.disciplineById[query.d] ? { type: 'discipline', id: query.d } : query.a && C.algoById[query.a] ? { type: 'algorithm', id: query.a } : null;
  const explorer = createExplorer({ initial, tall: true });
  const el = h('div.page.wrap',
    pageHead({ eyebrow: 'Explore', title: 'The Algorithm Universe',
      lede: `A map of ${C.disciplines.length} disciplines and the ${plural(C.algos.length, 'lesson')} written so far. Hills are disciplines, markers are lessons, and dotted routes join fields that share an idea.` }),
    explorer.el);
  return { el, title: 'Explore', destroy() { explorer.destroy(); } };
}
