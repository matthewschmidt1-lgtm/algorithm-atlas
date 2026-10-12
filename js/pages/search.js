// Full search results, grouped by what kind of thing matched.

import { h, clear } from '../core/dom.js';
import { search, TYPE_LABELS } from '../core/search.js';
import { replaceQuery } from '../core/router.js';
import { createSearchBox } from '../ui/searchbox.js';
import { pageHead, plural } from '../ui/parts.js';

const ORDER = ['algorithm', 'concept', 'path', 'discipline', 'application', 'visualization', 'code', 'planned'];
const GROUP_TITLES = { algorithm: 'Lessons', concept: 'Concepts', path: 'Learning paths', discipline: 'Disciplines', application: 'Applications', visualization: 'Visualizations', code: 'Code examples', planned: 'Planned lessons' };

export default async function render({ query }) {
  const box = createSearchBox({ large: true });
  const out = h('div.results');
  const count = h('p.muted', { 'aria-live': 'polite' });
  let filter = query.type || 'all';
  const filterBar = h('div.result-filters', { role: 'group', 'aria-label': 'Filter results by type' });

  function run(q) {
    clear(out); clear(filterBar);
    if (!q || q.trim().length < 2) { count.textContent = 'Type at least two characters. You can use a name, or describe the problem in your own words.'; return; }
    const all = search(q, { limit: 120 });
    count.textContent = all.length ? `${plural(all.length, 'result')} for "${q}".` : '';
    if (!all.length) {
      out.append(h('div.empty', h('h3', `Nothing matches "${q}" yet.`),
        h('p', 'The atlas only lists lessons that have been written and checked. Try a broader word, or describe what you want to do, for example "shortest route" or "compress files".'),
        h('p', h('a.link', { href: '#/library' }, 'Browse the whole library'))));
      return;
    }
    const types = ORDER.filter((t) => all.some((r) => r.type === t));
    const mk = (id, label, n) => h('button.btn.btn-sm', { type: 'button', class: filter === id ? 'is-on' : '', 'aria-pressed': filter === id ? 'true' : 'false', onclick: () => { filter = id; replaceQuery({ q, type: id === 'all' ? '' : id }); run(q); } }, `${label} (${n})`);
    filterBar.append(mk('all', 'Everything', all.length), ...types.map((t) => mk(t, GROUP_TITLES[t], all.filter((r) => r.type === t).length)));
    if (filter !== 'all' && !types.includes(filter)) filter = 'all';
    for (const t of types) {
      if (filter !== 'all' && filter !== t) continue;
      const items = all.filter((r) => r.type === t).slice(0, filter === 'all' ? 6 : 60);
      out.append(h('section.result-group',
        h('h2', GROUP_TITLES[t]),
        h('ul.result-list', items.map((r) => h('li.result',
          h('span.sb-type', { class: `t-${r.type}` }, TYPE_LABELS[r.type]),
          h('div', h('a.result-title', { href: r.href }, r.title), h('p.result-sub', r.sub), h('p.result-preview', r.reason ? `${r.reason}. ${r.preview}` : r.preview)))))));
    }
  }
  box.input.value = query.q || '';
  run(query.q || '');
  const el = h('div.page.wrap.narrow',
    pageHead({ eyebrow: 'Search', title: query.q ? `Results for "${query.q}"` : 'Search the atlas' }),
    h('div.results-box', box.el), count, filterBar, out);
  return { el, title: query.q ? `Search: ${query.q}` : 'Search' };
}
