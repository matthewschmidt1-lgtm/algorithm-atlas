// Search field with autocomplete, used in the hero and in the header's search dialog.
// Follows the ARIA combobox pattern: arrow keys move through suggestions, Enter opens
// the highlighted one, and Enter with nothing highlighted shows the full results page.

import { h, clear, esc, nextId, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { suggest, TYPE_LABELS } from '../core/search.js';
import { href, navigate } from '../core/router.js';

export function createSearchBox({ placeholder = 'Search any algorithm, concept, equation, or application...', large = false, onNavigate = () => {}, label = 'Search the atlas' } = {}) {
  const listId = nextId('sb-list');
  const input = h('input.sb-input', {
    type: 'search', role: 'combobox', placeholder, autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
    'aria-label': label, 'aria-expanded': 'false', 'aria-controls': listId, 'aria-autocomplete': 'list',
  });
  const list = h('ul.sb-list', { id: listId, role: 'listbox', 'aria-label': 'Suggestions', hidden: true });
  const form = h('form.sb-form', { role: 'search', onsubmit: (e) => { e.preventDefault(); choose(); } },
    h('span.sb-icon', { html: icon('search', { size: large ? 20 : 18 }) }), input,
    h('button.sb-go', { type: 'submit', 'aria-label': 'Search', html: icon('arrow', { size: 18 }) }));
  const el = h(`div.searchbox${large ? '.is-large' : ''}`, form, list);
  let items = [], active = -1;

  const open = (yes) => { list.hidden = !yes; input.setAttribute('aria-expanded', yes ? 'true' : 'false'); if (!yes) { active = -1; input.removeAttribute('aria-activedescendant'); } };

  function render() {
    const q = input.value.trim();
    clear(list);
    if (q.length < 2) { items = []; open(false); return; }
    items = suggest(q, 7);
    // nothing answers the query: what follows is loosely related, and is labelled as such
    if (items.length && items[0].broader) list.append(h('li.sb-label', { role: 'presentation' }, 'No lesson answers this directly. Loosely related:'));
    items.forEach((r, i) => {
      list.append(h('li.sb-item', { id: `${listId}-${i}`, role: 'option', 'aria-selected': 'false',
        onmousedown: (e) => { e.preventDefault(); go(r.href); },
        html: `<span class="sb-type t-${r.type}">${esc(TYPE_LABELS[r.type])}</span><span class="sb-main"><span class="sb-title">${esc(r.title)}</span><span class="sb-sub">${esc(r.reason || r.preview || r.sub || '')}</span></span>` }));
    });
    list.append(h('li.sb-item.sb-all', { id: `${listId}-${items.length}`, role: 'option', 'aria-selected': 'false',
      onmousedown: (e) => { e.preventDefault(); go(href('/search', { q })); } },
      items.length && !items[0].broader ? `See all results for "${q}"` : items.length ? `More about "${q}"` : `No lesson answers "${q}" yet. Try describing the problem, such as "shortest route".`));
    active = -1;
    open(true);
  }

  function setActive(i) {
    const options = [...list.querySelectorAll('[role="option"]')];
    const n = options.length;
    if (!n) return;
    active = (i + n) % n;
    options.forEach((li, k) => { li.setAttribute('aria-selected', k === active ? 'true' : 'false'); li.classList.toggle('is-active', k === active); });
    input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    options[active].scrollIntoView({ block: 'nearest' });
  }

  function go(to) { open(false); onNavigate(); navigate(to); }
  function choose() {
    const q = input.value.trim();
    if (!list.hidden && active >= 0 && active < items.length) return go(items[active].href);
    if (q) go(href('/search', { q }));
  }

  input.addEventListener('input', debounce(render, 90));
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) render(); });
  input.addEventListener('blur', () => setTimeout(() => open(false), 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); else setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (!list.hidden) setActive(active - 1); }
    else if (e.key === 'Escape') { if (!list.hidden) { e.stopPropagation(); open(false); } }
  });

  return { el, input, focus: () => input.focus(), clear: () => { input.value = ''; open(false); } };
}
