// Your atlas: recommendations, progress, favourites, collections and history.
// Everything here comes from this browser's storage. There is no account.

import { h, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { recommendLessons, recommendPaths, LEVELS, GOALS } from '../core/recommend.js';
import { openOnboarding } from '../ui/onboarding.js';
import { pageHead, lessonRow, plural } from '../ui/parts.js';
import { pathCard } from './paths.js';
import { LANGUAGE_LABELS } from '../core/schema.js';

export default async function render() {
  const body = h('div.profile-body');

  function paint() {
    clear(body);
    const s = store.state;
    const p = s.profile;
    const explored = s.recents.map((r) => ({ a: C.algoById[r.id], t: r.t })).filter((x) => x.a);
    const answerable = (a) => a.quizAnswerable ?? Math.max(0, (a.quizCount || 0) - 1);
    const mastered = C.algos.filter((a) => store.mastery(a.id, answerable(a)).mastered);
    const answered = Object.entries(s.quiz).filter(([id]) => C.algoById[id]).reduce((n, [, v]) => n + Object.values(v).filter((x) => x.correct).length, 0);
    const favs = s.favorites.map((id) => C.algoById[id]).filter(Boolean);

    body.append(h('section.profile-sec.profile-summary',
      h('div.profile-stats',
        h('div.fact', h('span.fact-value', `${explored.length}`), h('span.fact-label', `of ${plural(C.algos.length, 'lesson')} opened`)),
        h('div.fact', h('span.fact-value', `${answered}`), h('span.fact-label', 'questions answered correctly')),
        h('div.fact', h('span.fact-value', `${mastered.length}`), h('span.fact-label', 'lessons with every question correct')),
        h('div.fact', h('span.fact-value', `${favs.length}`), h('span.fact-label', 'favourites saved'))),
      h('p.note-box', store.persistent
        ? 'All of this is kept in this browser on this device, and nowhere else. Clearing your browser data will erase it. There is no account and nothing is uploaded.'
        : 'This browser is blocking storage, so nothing on this page will be remembered after you close the tab.')));

    // What to do next comes first. Records and settings are kept below, closed until wanted.
    const recs = recommendLessons(4);
    body.append(h('section.profile-sec', h('h2', 'Recommended next'),
      recs.length ? h('div.lesson-list', recs.map((r) => lessonRow(r.a, { note: r.reason }))) : h('p.muted', 'You have opened every published lesson.')));
    const rp = recommendPaths(2);
    if (rp.length) body.append(h('section.profile-sec', h('h2', 'Paths that fit'), h('div.path-list', rp.map((r) => pathCard(r.path, r.reason)))));

    const names = Object.keys(s.collections);
    const drawer = (title, count, ...content) => h('details.fold', h('summary', h('span', title), count !== null ? h('span.small.faint', String(count)) : null), h('div.fold-body', content));
    body.append(h('section.profile-sec.profile-records',
      h('h2', 'Your records'),
      drawer('Favourites', favs.length, favs.length ? h('div.lesson-list', favs.map((a) => lessonRow(a))) : h('p.muted', 'Nothing saved yet. Use the heart on any lesson to keep it here.')),
      drawer('Collections', names.length, names.length ? names.map((n) => h('div.collection',
        h('div.profile-sec-head', h('h3', n), h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => { if (confirm(`Delete the collection "${n}"? The lessons themselves are not affected.`)) { store.deleteCollection(n); paint(); } }, html: `${icon('trash', { size: 14 })}<span>Delete</span>` })),
        s.collections[n].filter((id) => C.algoById[id]).length
          ? h('ul.collection-items', s.collections[n].filter((id) => C.algoById[id]).map((id) => h('li', h('a.link', { href: `#/algorithm/${id}` }, C.algoById[id].name),
            h('button.icon-btn', { type: 'button', 'aria-label': `Remove ${C.algoById[id].name} from ${n}`, html: icon('x', { size: 15 }), onclick: () => { store.removeFromCollection(n, id); paint(); } }))))
          : h('p.muted.small', 'This collection is empty.')))
        : h('p.muted', 'No collections yet. At the end of any lesson, choose "Add to a collection" to start one.')),
      drawer('Learning history', explored.length, explored.length ? h('ol.history', explored.map(({ a, t }) => {
        const m = store.mastery(a.id, answerable(a));
        return h('li', h('a.link', { href: `#/algorithm/${a.id}` }, a.name), h('span.small.faint', new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })),
          h('span.small', m.mastered ? 'All questions correct' : m.correct ? `${m.correct} of ${m.total} questions correct` : 'Opened'));
      })) : h('p.muted', 'Lessons you open will be listed here.')),
      drawer('Your answers to the four questions', null,
        p ? h('dl.profile-dl',
          h('div', h('dt', 'Experience'), h('dd', (LEVELS.find((l) => l.id === p.level) || {}).label || 'Not given')),
          h('div', h('dt', 'Interests'), h('dd', p.interests.length ? p.interests.map((id) => C.disciplineById[id].short).join(', ') : 'None chosen')),
          h('div', h('dt', 'Goals'), h('dd', p.goals.length ? p.goals.map((id) => (GOALS.find((g) => g.id === id) || {}).label).join('; ') : 'None chosen')),
          h('div', h('dt', 'Languages'), h('dd', p.languages.length ? p.languages.map((l) => LANGUAGE_LABELS[l]).join(', ') : 'No preference')))
          : h('p.muted', 'You have not answered them. Recommendations assume you are starting out.'),
        h('p', h('button.btn.btn-sm', { type: 'button', onclick: () => openOnboarding({ onDone: paint }) }, p ? 'Change my answers' : 'Answer four questions'))),
      drawer('Start over', null,
        h('p.muted', 'This removes your answers, history, favourites, collections and quiz results from this browser. Display settings are kept.'),
        h('p', h('button.btn', { type: 'button', onclick: () => { if (confirm('Erase all progress stored in this browser?')) { store.reset(); paint(); } } }, 'Erase my progress')))));
  }
  paint();

  const el = h('div.page.wrap.narrow-wide',
    pageHead({ eyebrow: 'Your atlas', title: 'Where you have been, and where to go next',
      lede: 'Your progress, your saved lessons and the atlas\'s suggestions for you.' }),
    body);
  return { el, title: 'Your atlas' };
}
