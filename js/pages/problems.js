// "I want to": the atlas entered from the problem end. The page has one job, which is to
// get someone from a plain statement of what they want to the lesson that does it, without
// their needing to know what the method is called.
//
// The phrases come from the lessons (see core/problems.js). Only a few are shown in each
// group until the reader asks for more or types into the filter.

import { h, clear, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { href, replaceQuery } from '../core/router.js';
import { problemIndex, filterPhrases, PREVIEW } from '../core/problems.js';
import { pageHead, plural, levelGlyph } from '../ui/parts.js';

const MAX_NAMED = 3;

function phraseRow(p) {
  const named = p.lessons.slice(0, MAX_NAMED);
  const rest = p.lessons.length - named.length;
  const first = p.lessons[0];
  return h('li.want-row',
    h('a.want-phrase', { href: `#/algorithm/${first.id}` }, p.label),
    h('span.want-leads',
      p.lessons.length === 1
        ? [h('span.want-arrow', { 'aria-hidden': 'true', html: icon('arrow', { size: 13 }) }), h('span.sr-only', 'opens '), h('a.want-lesson', { href: `#/algorithm/${first.id}` }, first.name), levelGlyph(first.difficulty)]
        : [h('span.want-count', `${p.lessons.length} ways: `),
          named.map((a, i) => [i ? ', ' : '', h('a.want-lesson', { href: `#/algorithm/${a.id}` }, a.name)]),
          rest > 0 ? [' ', h('a.want-more', { href: href('/search', { q: p.text }) }, `and ${rest} more`)] : null]));
}

export default async function render({ query }) {
  const index = problemIndex();
  const out = h('div.want-out');
  const count = h('p.want-count-line', { 'aria-live': 'polite' });
  const opened = new Set((query.open || '').split(',').filter(Boolean));
  let q = query.q || '';

  const input = h('input', { type: 'search', value: q, placeholder: 'Filter, for example: route, order, predict, secret', 'aria-label': 'Filter the list by a word', autocomplete: 'off', spellcheck: 'false',
    oninput: debounce((e) => { q = e.target.value; paint(); }, 120) });

  function paint() {
    replaceQuery({ q: q.trim(), open: [...opened].join(',') });
    clear(out);
    const filtering = q.trim().length >= 2;
    if (filtering) {
      const found = new Set(filterPhrases(q).map((p) => p.key));
      const groups = index.categories.map((c) => ({ c, list: c.phrases.filter((p) => found.has(p.key)) })).filter((g) => g.list.length);
      const n = groups.reduce((s, g) => s + g.list.length, 0);
      count.textContent = n ? `${plural(n, 'match', 'matches')} for "${q.trim()}" among ${index.total} things the lessons can do.` : '';
      if (!n) {
        out.append(h('div.empty', h('h2', `Nothing here mentions "${q.trim()}".`),
          h('p', 'This list holds only the problems the published lessons state for themselves. The full search also looks through concepts, applications and planned lessons.'),
          h('p', h('a.btn.btn-primary', { href: href('/search', { q: q.trim() }) }, `Search the whole atlas for "${q.trim()}"`))));
        return;
      }
      for (const g of groups) out.append(h('section.want-group', h('h2', g.c.want), h('p.want-field', g.c.name), h('ul.want-list', g.list.map(phraseRow))));
      return;
    }
    count.textContent = `${index.total} things the lessons can do, in ${plural(index.categories.length, 'group')}. Each group shows a few. Open a group to see the rest.`;
    for (const c of index.categories) {
      const all = opened.has(c.id);
      const shown = all ? c.phrases : c.phrases.slice(0, c.preview);
      const more = c.phrases.length - c.preview;
      const listId = `want-${c.id}`;
      out.append(h('section.want-group', { id: `group-${c.id}` },
        h('h2', c.want), h('p.want-field', c.name),
        h('ul.want-list', { id: listId }, shown.map(phraseRow)),
        more > 0 ? h('button.btn.btn-sm.btn-ghost.want-toggle', { type: 'button', 'aria-expanded': all ? 'true' : 'false', 'aria-controls': listId,
          onclick: () => { all ? opened.delete(c.id) : opened.add(c.id); paint(); const sec = document.getElementById(`group-${c.id}`); const btn = sec && sec.querySelector('.want-toggle'); if (btn) btn.focus(); } },
          all ? `Show fewer` : `Show all ${c.phrases.length}`) : null));
    }
  }
  paint();

  const el = h('div.page.wrap.want-page',
    pageHead({ eyebrow: 'I want to…', title: 'What do you want to do?',
      lede: 'Start from the problem, not the name. Each line is something a lesson can do, in the words people use for it. Choose one to open the lesson that does it.' }),
    h('div.want-tools', h('label.lib-search.want-search', h('span', { html: icon('search', { size: 18 }) }), input), count),
    out,
    h('p.want-foot', 'Looking for a method by name? ', h('a.link', { href: '#/library' }, 'Use the library'), '. Want an overview of the fields? ', h('a.link', { href: '#/explore' }, 'Open the map'), '.'));
  return { el, title: 'I want to…' };
}

export { PREVIEW };
