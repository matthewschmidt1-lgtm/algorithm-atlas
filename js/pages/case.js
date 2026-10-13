// A worked business case. One job: take a real decision, run a lesson's own method on it,
// and say plainly what the answer means and what the model leaves out.
// Every number on the page comes from the lesson's implementation or from the case's figures.

import { h, fmt } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { pageHead } from '../ui/parts.js';
import { createPlayer, assemblePlayer } from '../viz/player.js';

const money = (units, unit) => `£${fmt(units * unit)}`;
const thousands = (k) => `£${fmt(k * 1000)}`;
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// The shortcut a person might take by hand: go down a ranked list, funding whatever still fits.
export function shortcut(c, rank) {
  const order = c.items.map((_, i) => i).sort((a, b) => rank(c.items[b]) - rank(c.items[a]) || a - b);
  let spent = 0; const picked = [];
  for (const i of order) if (spent + c.items[i].cost <= c.budget) { picked.push(i); spent += c.items[i].cost; }
  return { picked: picked.sort((a, b) => a - b), spent, benefit: picked.reduce((s, i) => s + c.items[i].benefit, 0) };
}

export default async function render({ params }) {
  const c = C.caseById[params.id];
  if (!c || !C.algoById[c.lesson]) {
    return { title: 'Case not found', el: h('div.page.wrap.narrow', h('header.page-head', h('p.eyebrow', 'Worked case'), h('h1', 'There is no worked case at this address.')), h('p', h('a.btn.btn-primary', { href: '#/track/business' }, 'Decisions in business'))) };
  }
  const L = await C.loadLesson(c.lesson);
  const meta = C.algoById[c.lesson];
  const input = { weights: c.items.map((x) => x.cost), values: c.items.map((x) => x.benefit), capacity: c.budget };
  const player = createPlayer(L, { input });
  const playerEl = assemblePlayer(player, { pseudo: false, pageKeys: true });
  const res = player.run;
  const ok = res && res.ok;
  // the lesson numbers its items from 1; the case's list counts from 0
  const chosen = ok ? res.result.chosen.map((n) => n - 1) : [];
  const spent = chosen.reduce((s, i) => s + c.items[i].cost, 0);
  const byBenefit = shortcut(c, (x) => x.benefit);
  const byRatio = shortcut(c, (x) => x.benefit / x.cost);
  const names = (idx) => list(idx.map((i) => c.items[i].name));

  const table = h('div.data-table-wrap', h('table.data-table.case-table',
    h('thead', h('tr', h('th', 'Proposal'), h('th', 'Cost'), h('th', 'Benefit over the year'), h('th', 'Benefit per £1 spent'), h('th', 'Funded'))),
    h('tbody', c.items.map((x, i) => h('tr', { class: chosen.includes(i) ? 'is-chosen' : '' },
      h('th', { scope: 'row' }, x.name), h('td.mono', money(x.cost, c.unit)), h('td.mono', thousands(x.benefit)),
      h('td.mono', `£${((x.benefit * 1000) / (x.cost * c.unit)).toFixed(2)}`), h('td', chosen.includes(i) ? 'Yes' : ''))))));

  const route = (label, r) => h('div.case-route', h('p.panel-cap', label), h('p.case-route-total', thousands(r.benefit)),
    h('p', `Funds ${names(r.picked)}.`), h('p.small.muted', `Spends ${money(r.spent, c.unit)} of ${money(c.budget, c.unit)}.`));

  const el = h('div.page.wrap.case-page',
    pageHead({ crumbsList: [{ label: 'Decisions in business', href: '#/track/business' }, { label: 'Worked case' }], eyebrow: 'Worked business case', title: c.title, lede: c.scenario }),
    h('p.case-note', 'The figures are invented for this example. The method and the arithmetic are real.'),
    h('section.case-sec', h('h2', 'The proposals'), table),
    h('section.case-sec', h('h2', 'Two shortcuts, and the best that can be done'),
      h('p.case-lead', 'Most people would rank the proposals and work down the list. Here are the two obvious rankings, beside the answer found by checking every budget from nothing up to the full amount.'),
      h('div.case-routes',
        route('Biggest benefit first', byBenefit),
        route('Best benefit per £1 first', byRatio),
        ok ? h('div.case-route.is-best', h('p.panel-cap', 'The best possible'), h('p.case-route-total', thousands(res.result.best)),
          h('p', `Funds ${names(chosen)}.`), h('p.small.muted', `Spends ${money(spent, c.unit)} of ${money(c.budget, c.unit)}.`)) : null),
      ok ? h('p.case-lead', `The best plan brings in ${thousands(res.result.best - Math.max(byBenefit.benefit, byRatio.benefit))} more than the better of the two shortcuts. The difference is not large here. The point is that neither shortcut can be trusted to find it, and nothing about either ranking warns you.`) : null),
    h('section.case-sec', h('h2', 'Watch the method work it out'),
      h('p.case-lead', `This is the ${meta.name} lesson's own method, running on the eight proposals. It builds a table: for each proposal in turn, and for each possible budget, the best benefit that can be had. Costs are counted in units of ${money(1, c.unit)}.`),
      playerEl,
      h('p', { style: { marginTop: '14px' } }, h('a.text-link', { href: `#/algorithm/${meta.id}` }, `Read the ${meta.name} lesson`, h('span', { html: icon('arrow', { size: 15 }) })))),
    h('section.case-sec', h('h2', 'What this model leaves out'),
      h('p.case-lead', 'The answer is exactly right for the problem as stated. Whether the problem as stated is your problem is a separate question.'),
      h('ul.case-assume', c.assumptions.map((a) => h('li', h('p', a.text), a.then && C.algoById[a.then.lesson] ? h('p.small', a.then.say, ' ', h('a.link', { href: `#/algorithm/${a.then.lesson}` }, C.algoById[a.then.lesson].name)) : null)))),
    h('p.track-foot', h('a.link', { href: '#/track/business' }, 'Back to Decisions in business')));
  return { el, title: c.title, destroy() { player.destroy(); } };
}
