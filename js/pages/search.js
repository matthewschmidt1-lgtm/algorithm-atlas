// Full search results. The page has one job: answer the query, and be plain about how
// good the answer is. A clear winner is shown first as the best match. When nothing answers
// the query, anything loosely related is shown under its own heading, never as a result.

import { h, clear } from '../core/dom.js';
import { searchDetailed, TYPE_LABELS } from '../core/search.js';
import { replaceQuery } from '../core/router.js';
import { createSearchBox } from '../ui/searchbox.js';
import { pageHead, plural } from '../ui/parts.js';

const ORDER = ['algorithm', 'comparison', 'concept', 'path', 'discipline', 'application', 'visualization', 'code', 'planned'];
const GROUP_TITLES = { algorithm: 'Lessons', comparison: 'Comparisons', concept: 'Concepts', path: 'Learning paths', discipline: 'Disciplines', application: 'Applications', visualization: 'Visualizations', code: 'Code examples', planned: 'Planned lessons' };

const row = (r) => h('li.result',
  h('span.sb-type', { class: `t-${r.type}` }, TYPE_LABELS[r.type]),
  h('div', h('a.result-title', { href: r.href }, r.title), h('p.result-sub', r.sub), h('p.result-preview', r.reason ? `${r.reason}. ${r.preview}` : r.preview)));

export default async function render({ query }) {
  const box = createSearchBox({ large: true });
  const out = h('div.results');
  const count = h('p.muted', { 'aria-live': 'polite' });
  let filter = query.type || 'all';
  const filterBar = h('div.result-filters', { role: 'group', 'aria-label': 'Filter results by type' });
  const elsewhere = () => h('p.result-elsewhere', 'You can also ', h('a.link', { href: '#/problems' }, 'browse by what you want to do'), ' or ', h('a.link', { href: '#/library' }, 'look through the whole library'), '.');

  function run(q) {
    clear(out); clear(filterBar);
    if (!q || q.trim().length < 2) { count.textContent = 'Type at least two characters. You can use a name, or describe the problem in your own words.'; return; }
    const found = searchDetailed(q, { limit: 120 });
    const all = found.results;
    count.textContent = [all.length ? `${plural(all.length, 'result')} for "${q}".` : '', found.note].filter(Boolean).join(' ');
    if (!all.length) {
      out.append(h('div.empty', h('h2', `No lesson answers "${q}" directly.`),
        h('p', 'The atlas only lists lessons that have been written and checked. Try a different word, or describe what you want to do, for example "shortest route" or "compress files".')));
      if (found.broader.length) {
        out.append(h('section.result-group.is-broader',
          h('h2', 'Loosely related'),
          h('p.muted', 'These share a word with your search. They may not be what you are looking for.'),
          h('ul.result-list', found.broader.map(row))));
      }
      out.append(elsewhere());
      return;
    }
    const types = ORDER.filter((t) => all.some((r) => r.type === t));
    const mk = (id, label, n) => h('button.btn.btn-sm', { type: 'button', class: filter === id ? 'is-on' : '', 'aria-pressed': filter === id ? 'true' : 'false', onclick: () => { filter = id; replaceQuery({ q, type: id === 'all' ? '' : id }); run(q); } }, `${label} (${n})`);
    filterBar.append(mk('all', 'Everything', all.length), ...types.map((t) => mk(t, GROUP_TITLES[t], all.filter((r) => r.type === t).length)));
    if (filter !== 'all' && !types.includes(filter)) filter = 'all';
    const best = filter === 'all' ? found.best : null;
    if (best) out.append(h('section.result-best', { 'aria-label': 'Best match' }, h('p.panel-cap', 'Best match'), h('ul.result-list', row(best))));
    for (const t of types) {
      if (filter !== 'all' && filter !== t) continue;
      const items = all.filter((r) => r.type === t && r !== best).slice(0, filter === 'all' ? 6 : 60);
      if (!items.length) continue;
      out.append(h('section.result-group',
        h('h2', best && t === best.type ? `Other ${GROUP_TITLES[t].toLowerCase()}` : GROUP_TITLES[t]),
        h('ul.result-list', items.map(row))));
    }
    out.append(elsewhere());
  }
  box.input.value = query.q || '';
  run(query.q || '');
  const el = h('div.page.wrap.narrow',
    pageHead({ eyebrow: 'Search', title: query.q ? `Results for "${query.q}"` : 'Search the atlas' }),
    h('div.results-box', box.el), count, filterBar, out);
  return { el, title: query.q ? `Search: ${query.q}` : 'Search' };
}
