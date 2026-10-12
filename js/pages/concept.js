// A concept from the glossary: the plain explanation first, then the precise one.

import { h, rich, renderMath } from '../core/dom.js';
import * as C from '../core/catalog.js';
import { pageHead, lessonRow, refLink } from '../ui/parts.js';
import NotFound from './notfound.js';

const KIND = { idea: 'Idea', paradigm: 'Paradigm', structure: 'Data structure', mathematics: 'Mathematics' };

export default async function render({ params }) {
  const c = C.conceptById[params.id];
  if (!c) return NotFound();
  const ref = `concept:${c.id}`;
  const direct = (c.see || []).map((id) => C.algoById[id]).filter(Boolean);
  const mentions = C.algos.filter((a) => !direct.includes(a) && ((a.prerequisites || []).includes(ref) || (a.connections || []).some((x) => x.to === ref)));
  const el = h('div.page.wrap.narrow',
    pageHead({ crumbsList: [{ label: 'Library', href: '#/library' }, { label: 'Concepts', href: '#/library?view=concepts' }, { label: c.name }], eyebrow: KIND[c.kind] || 'Concept', title: c.name }),
    h('section.concept-sec', h('p.lsec-kicker', 'The simple explanation'), h('div.simple-text', { html: `<p>${rich(c.simple)}</p>` })),
    h('section.concept-sec', h('p.lsec-kicker', 'More precisely'), h('div.prose', { html: `<p>${rich(c.precise)}</p>` })),
    c.example ? h('section.concept-sec', h('p.lsec-kicker', 'For example'), h('div.prose', { html: `<p>${rich(c.example)}</p>` })) : null,
    c.caution ? h('section.concept-sec', h('ul.myths', h('li', { html: rich(c.caution) }))) : null,
    direct.length || mentions.length ? h('section.concept-sec', h('h2', 'Where you can see it'), h('div.lesson-list', [...direct, ...mentions].map((a) => lessonRow(a)))) : null,
    (c.related || []).length ? h('section.concept-sec', h('h2', 'Related concepts'), h('p.concept-related', c.related.map((r, i) => [i ? ' · ' : '', refLink(`concept:${r}`)]))) : null);
  renderMath(el);
  return { el, title: c.name };
}
