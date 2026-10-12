// Shared building blocks used across pages: lesson rows, discipline plates, breadcrumbs,
// section heads, reference links and level glyphs.

import { h, esc } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { KIND_LABELS } from '../core/schema.js';
import { plateArt, roman } from '../art/plates.js';

export const LEVEL_NAMES = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export function levelGlyph(level, withText = false) {
  const el = h('span.with-level', h('span.level', { dataset: { level }, role: 'img', 'aria-label': `${LEVEL_NAMES[level]} level` }, h('i'), h('i'), h('i')));
  if (withText) el.append(LEVEL_NAMES[level]);
  return el;
}

export function crumbs(items) {
  return h('nav', { 'aria-label': 'Breadcrumb' }, h('ol.crumbs', items.map((it) => h('li', it.href ? h('a', { href: it.href }, it.label) : h('span', { 'aria-current': 'page' }, it.label)))));
}

export function sectionHead({ eyebrow, title, lede, id, level = 'h2', single = false }) {
  return h(`div.sec-head${single || !lede ? '.single' : ''}`,
    eyebrow ? h('p.eyebrow', eyebrow) : null,
    h(level, id ? { id } : {}, title),
    lede ? h('p.lede', lede) : null);
}

export function pageHead({ crumbsList, eyebrow, title, lede, extra }) {
  return h('header.page-head', crumbsList ? crumbs(crumbsList) : null, eyebrow ? h('p.eyebrow', eyebrow) : null, h('h1', title), lede ? h('p.lede', lede) : null, extra || null);
}

// One lesson in a list. The whole row is the link target; the favourite button sits above it.
export function lessonRow(a, { showDiscipline = true, note = null } = {}) {
  const seen = store.explored().has(a.id);
  const d = C.disciplineById[a.discipline];
  const fav = h('button.icon-btn.fav', { type: 'button' });
  const sync = () => {
    const on = store.isFavorite(a.id);
    fav.innerHTML = icon(on ? 'heartFill' : 'heart', { size: 17 });
    fav.classList.toggle('is-on', on);
    fav.setAttribute('aria-pressed', on ? 'true' : 'false');
    fav.setAttribute('aria-label', on ? `Remove ${a.name} from favourites` : `Save ${a.name} to favourites`);
  };
  fav.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); store.toggleFavorite(a.id); sync(); });
  sync();
  return h(`article.lesson-row.c-${C.colorOf(a.discipline)}`,
    h('div.lesson-row-main',
      h('h3', h('a', { href: `#/algorithm/${a.id}` }, a.name)),
      a.kind !== 'algorithm' ? h('span.lesson-kind', KIND_LABELS[a.kind]) : null,
      h('p', note || a.summary)),
    h('div.lesson-meta',
      seen ? h('span.seen', { html: `${icon('check', { size: 14 })}Explored` }) : null,
      showDiscipline ? h('span', d.short) : null,
      levelGlyph(a.difficulty, true),
      h('span.mono', a.time.worst.length > 26 ? a.time.class.replace(/^./, (c) => c.toUpperCase()) : a.time.worst),
      fav));
}

export function plannedRow(r) {
  return h('article.lesson-row.is-planned',
    h('div.lesson-row-main', h('h3', { style: { color: 'var(--text-2)', fontWeight: 500 } }, r.name), h('p', 'Planned. This lesson has not been written yet.')),
    h('div.lesson-meta', h('span.planned-tag', 'Planned')));
}

// A discipline as a field-guide plate: a figure, a name, a sentence, and what it holds.
export function plate(d, index, { wide = false } = {}) {
  const lessons = C.inDiscipline(d.id);
  const lv = C.levelCounts(lessons);
  const color = C.GROUPS[d.group].color;
  const n = lessons.length;
  const levels = h('span.levels', { 'aria-label': `${lv.beginner} beginner, ${lv.intermediate} intermediate, ${lv.advanced} advanced` },
    ['beginner', 'intermediate', 'advanced'].filter((k) => lv[k] > 0).map((k) => h('span', { title: `${lv[k]} ${k}` }, h('span.level', { dataset: { level: k }, 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), String(lv[k]))));
  const text = h('div.plate-text-block',
    h('h3', h('a', { href: `#/discipline/${d.id}` }, d.name)),
    h('p', d.blurb));
  const art = h('div.plate-art', { html: plateArt(d.id) });
  return h(`article.plate.c-${color}${wide ? '.is-wide' : ''}`,
    h('div.plate-no', h('span', `Plate ${roman(index)}`), h('span', C.GROUPS[d.group].label)),
    wide ? h('div.plate-body', art, text) : [art, text],
    h('div.plate-foot',
      h('span.plate-count', n ? h('b', String(n)) : null, n ? ` lesson${n === 1 ? '' : 's'}` : 'Lessons planned'),
      n ? levels : null,
      h('span.go', { 'aria-hidden': 'true', html: `Explore ${icon('arrow', { size: 15 })}` })));
}

// A link to anything a lesson can reference. Planned lessons render as plain text with a tag.
export function refLink(ref, { showKind = false } = {}) {
  const r = C.resolveRef(ref);
  if (!r.href) return h('span.ref.is-planned', r.name, ' ', h('span.planned-tag', 'Planned'));
  const kind = showKind && r.kind !== 'algorithm' ? h('span.ref-kind', r.kind === 'concept' ? 'Concept' : 'Discipline') : null;
  return h('a.ref', { href: r.href }, r.name, kind ? [' ', kind] : null);
}

export function fact(value, label) {
  return h('div.fact', h('span.fact-value', String(value)), h('span.fact-label', label));
}

export const plural = (n, word, many) => `${n} ${n === 1 ? word : many || word + 's'}`;
export { esc };
