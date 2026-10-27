// A guide: the lessons that matter most to one kind of reader, in a few groups.
// One job: show what is in the guide and where to start.
//
// The business guide leads every lesson with the decision it serves, says honestly whether
// the lesson models that decision or teaches a general method on a simple example, and keeps
// the technical detail one click away. The other guide lists lessons in the usual way.
// (The address and the files say "track". The page says "guide".)

import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { PARADIGM_LABELS, TIME_CLASS_LABELS, TIME_CLASS_PLAIN } from '../core/schema.js';
import { pageHead, lessonRow, plannedRow, plural, levelGlyph } from '../ui/parts.js';
import { guideRoad, journeyResume } from '../core/journey.js';
import { createTrailMap } from '../ui/journey.js';
import { pathProgress } from '../core/recommend.js';
import { trackLessons, foundationsFor, ROLES } from '../core/tracks.js';

// A lesson on the business guide: the question first, then what the method does for it.
function businessCard(item, seen, onRoad = '') {
  const a = C.algoById[item.id];
  const d = C.disciplineById[a.discipline];
  const role = ROLES[item.role] || ROLES.method;
  return h(`article.biz-card.is-${item.role}`, { id: `lesson-${a.id}` },
    h('p.biz-role', role.label),
    h('h3', h('a', { href: `#/algorithm/${a.id}${onRoad}` }, item.question)),
    h('p.biz-bridge', item.bridge),
    h('p.biz-meta',
      h('span', 'Lesson: ', h('a.link', { href: `#/algorithm/${a.id}${onRoad}` }, a.name)),
      h('span', d.short), levelGlyph(a.difficulty, true),
      seen ? h('span.seen', { html: `${icon('check', { size: 14 })}Opened` }) : null),
    h('details.fold.biz-tech', h('summary', 'Technical details'), h('div.fold-body', h('dl.biz-dl',
      h('div', h('dt', 'What the lesson shows'), h('dd', a.summary)),
      h('div', h('dt', 'Approach'), h('dd', a.paradigms.map((p) => PARADIGM_LABELS[p]).join(', '))),
      h('div', h('dt', 'How the work grows'), h('dd', `${TIME_CLASS_LABELS[a.time.class]}. ${TIME_CLASS_PLAIN[a.time.class]}`)),
      h('div', h('dt', 'Time, worst case'), h('dd.mono', a.time.worst)),
      h('div', h('dt', 'Memory, worst case'), h('dd.mono', a.space.worst)),
      a.decide && a.decide.requires ? h('div', h('dt', 'It needs'), h('dd', a.decide.requires)) : null))));
}

export default async function render({ params }) {
  const t = C.trackById[params.id];
  if (!t) {
    return { title: 'Guide not found', el: h('div.page.wrap.narrow', h('header.page-head', h('p.eyebrow', 'Guides'), h('h1', 'There is no guide at this address.'), h('p.lede', 'The atlas has two: AI and machine learning, and decisions in business.')),
      h('p', C.tracks.map((x) => [h('a.btn', { href: `#/track/${x.id}` }, x.title), ' ']))) };
  }
  const business = t.groups.some((g) => g.items.some((x) => x.question));
  // the business guide is also a road: a trail map at the top, and every card leads onto it
  const road = business ? guideRoad(t.id) : null;
  const trip = road ? journeyResume(road) : null;
  const { published, planned } = trackLessons(t);
  const seen = store.explored();
  const opened = published.filter((a) => seen.has(a.id)).length;
  const next = published.find((a) => !seen.has(a.id));
  const paths = (t.paths || []).map((id) => C.pathById[id]).filter(Boolean);
  const other = C.tracks.find((x) => x.id !== t.id);
  const cases = (t.cases || []).map((id) => C.caseById[id]).filter(Boolean);
  const count = (role) => t.groups.reduce((n, g) => n + g.items.filter((x) => x.role === role && C.algoById[x.id]).length, 0);

  const groupEl = (g) => {
    const found = foundationsFor(t, g.lessons);
    return h('section.track-group',
      h('h2', g.title), h('p.track-group-blurb', g.blurb),
      business
        ? h('div.biz-cards', g.items.map((it) => (C.algoById[it.id] ? businessCard(it, seen.has(it.id), road ? `?path=${road.id}` : '') : C.plannedById[it.id] ? plannedRow(C.plannedById[it.id]) : null)))
        : h('div.lesson-list', g.items.map((it) => (C.algoById[it.id] ? lessonRow(C.algoById[it.id]) : C.plannedById[it.id] ? plannedRow(C.plannedById[it.id]) : null))),
      found.length ? h('div.track-found',
        h('p.biz-role', business ? ROLES.foundation.label + (found.length === 1 ? '' : 's') : 'What these lean on'),
        h('ul', found.map((f) => h('li', h('a.link', { href: `#/algorithm/${f.lesson.id}` }, f.lesson.name), h('span', ` for ${f.neededBy.map((a) => a.name).join(', ')}`), seen.has(f.lesson.id) ? h('span.seen', { html: `${icon('check', { size: 13 })}Opened` }) : null)))) : null);
  };

  const el = h('div.page.wrap.track-page',
    pageHead({ eyebrow: 'Guide', title: t.title, lede: t.blurb }),
    h('p.track-reader', t.reader),
    h('div.track-status',
      h('p', h('strong', plural(published.length, 'lesson')), ` written and checked${planned.length ? `, ${planned.length} more planned` : ''}. `, `You have opened ${opened} of ${published.length}.`),
      trip && trip.resume ? h('a.btn.btn-primary.btn-lg', { href: trip.resume.href }, trip.started ? `Continue the journey: ${trip.resume.name}` : `Start the journey: ${trip.resume.name}`, h('span', { html: icon('arrow', { size: 15 }) }))
        : next ? h('a.btn.btn-primary', { href: `#/algorithm/${next.id}` }, opened ? `Continue with ${next.name}` : `Start with ${next.name}`, h('span', { html: icon('arrow', { size: 15 }) })) : null),
    road ? h('section.track-road', { 'aria-labelledby': 'track-road-h' }, h('h2', { id: 'track-road-h' }, 'The road'), h('p.track-group-blurb', 'Every decision in this guide, in order, with the worked case where it belongs. Follow it stop by stop, or choose any stop.'), createTrailMap(road)) : null,
    business ? h('dl.biz-legend', { 'aria-label': 'How to read the labels on this page' },
      h('div', h('dt', `${ROLES.direct.label} (${count('direct')})`), h('dd', ROLES.direct.about)),
      h('div', h('dt', `${ROLES.method.label} (${count('method')})`), h('dd', ROLES.method.about)),
      h('div', h('dt', ROLES.foundation.label), h('dd', `${ROLES.foundation.about} Listed under the group that needs it.`))) : null,
    cases.length ? h('section.biz-cases', { 'aria-label': 'Worked business cases' }, cases.map((c) => h('a.biz-case', { href: `#/case/${c.id}` },
      h('span.biz-role', 'Worked business case'), h('span.biz-case-title', c.title, h('span', { html: icon('arrow', { size: 18 }) })), h('span.biz-case-sum', c.summary),
      h('span.biz-case-with', `Runs the ${C.algoById[c.lesson].name} lesson's method on realistic figures.`)))) : null,
    t.groups.map(groupEl),
    paths.length ? h('section.track-group', h('h2', 'Follow it in order'), h('p.track-group-blurb', 'Learning paths that cover the same ground one step at a time, with a reason for each step.'),
      h('ul.track-paths', paths.map((p) => { const pr = pathProgress(p); return h('li',
        h('a.link', { href: `#/path/${p.id}` }, p.title),
        h('span.track-path-level', p.level.charAt(0).toUpperCase() + p.level.slice(1)),
        h('span.track-path-progress', pr.total ? `${pr.done} of ${pr.total} lessons opened` : '')); }))) : null,
    h('p.track-foot', other ? ['The other guide: ', h('a.link', { href: `#/track/${other.id}` }, other.title), '. '] : null,
      'Everything else is still here: ', h('a.link', { href: '#/library' }, `all ${C.algos.length} lessons in the library`), ' and ', h('a.link', { href: '#/explore' }, 'the map of every field'), '.'));
  return { el, title: t.title };
}
