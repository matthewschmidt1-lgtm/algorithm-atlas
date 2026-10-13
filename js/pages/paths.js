// Learning paths: ordered routes through the lessons for different goals and levels.

import { h } from '../core/dom.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { pathProgress, recommendPaths } from '../core/recommend.js';
import { pageHead, plural, LEVEL_NAMES } from '../ui/parts.js';

export function pathCard(p, reason) {
  const pr = pathProgress(p);
  const mods = p.stages.flatMap((s) => s.modules);
  const published = mods.filter((m) => C.algoById[m.algo]).length;
  const plannedN = mods.length - published;
  const color = C.GROUPS[p.group] ? C.GROUPS[p.group].color : 'forest';
  return h(`article.path-row.c-${color}`,
    h('div.path-row-main',
      h('p.path-row-level', LEVEL_NAMES[p.level] || p.level),
      h('h3', h('a', { href: `#/path/${p.id}` }, p.title)),
      h('p', reason ? `${reason} ${p.blurb}` : p.blurb)),
    h('div.path-row-meta',
      h('span', plural(p.stages.length, 'stage')),
      h('span', `${plural(published, 'lesson')}${plannedN ? `, ${plannedN} planned` : ''}`),
      pr.started ? h('span.path-progress', h('span.bar', h('i', { style: { width: `${Math.round((pr.done / Math.max(1, pr.total)) * 100)}%` } })), `${pr.done} of ${pr.total} opened`) : null));
}

export default async function render() {
  const byLevel = ['beginner', 'intermediate', 'advanced'].map((lv) => ({ lv, list: C.paths.filter((p) => p.level === lv) })).filter((g) => g.list.length);
  const started = C.paths.filter((p) => { const pr = pathProgress(p); return pr.started && !pr.complete; });
  const recs = store.state.profile ? recommendPaths(3) : [];
  const el = h('div.page.wrap',
    pageHead({ eyebrow: 'Learning Paths', title: 'Choose a route',
      lede: 'A path puts lessons in an order that makes sense for a goal. Each stage says what it is for and what you can skip if you already know it. Nothing is locked: you can open any lesson at any time.' }),
    !C.paths.length ? h('div.empty', h('h3', 'Learning paths are not available.'), h('p', 'The path content could not be loaded.')) : null,
    started.length ? h('section.path-group', h('h2', 'Continue'), h('div.path-list', started.map((p) => pathCard(p)))) : null,
    recs.length ? h('section.path-group', h('h2', 'Suggested for you'), h('p.muted', 'From the answers you gave. Change them any time in your atlas.'), h('div.path-list', recs.map((r) => pathCard(r.path, r.reason)))) : null,
    byLevel.map((g) => h('section.path-group', h('h2', `${LEVEL_NAMES[g.lv]} paths`), h('div.path-list', g.list.map((p) => pathCard(p))))),
    h('p.note-box', 'Some paths cover fields where only a few lessons exist so far. They list planned lessons by name and mark them as planned, so you can see the shape of the route and what is still to come.'));
  return { el, title: 'Learning Paths' };
}
