// A track: the lessons that matter most to one kind of reader, in a few groups.
// One job: show what is in the track, what is still to be written, and where to start.
// Nothing about a lesson is restated here beyond its own summary and, on the business
// track, the problem it says it solves.

import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { pageHead, lessonRow, plannedRow, plural } from '../ui/parts.js';
import { pathCard } from './paths.js';
import { trackLessons, trackFoundations } from '../core/tracks.js';

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export default async function render({ params }) {
  const t = C.trackById[params.id];
  if (!t) {
    return { title: 'Track not found', el: h('div.page.wrap.narrow', h('header.page-head', h('p.eyebrow', 'Tracks'), h('h1', 'There is no track at this address.'), h('p.lede', 'The atlas has two: AI and machine learning, and decisions in business.')),
      h('p', C.tracks.map((x) => [h('a.btn', { href: `#/track/${x.id}` }, x.title), ' ']))) };
  }
  const { published, planned } = trackLessons(t);
  const seen = store.explored();
  const opened = published.filter((a) => seen.has(a.id)).length;
  const next = published.find((a) => !seen.has(a.id));
  const foundations = trackFoundations(t);
  const paths = (t.paths || []).map((id) => C.pathById[id]).filter(Boolean);
  const other = C.tracks.find((x) => x.id !== t.id);

  const el = h('div.page.wrap.track-page',
    pageHead({ eyebrow: 'Track', title: t.title, lede: t.blurb }),
    h('p.track-reader', t.reader),
    h('div.track-status',
      h('p', h('strong', plural(published.length, 'lesson')), ` written and checked${planned.length ? `, ${planned.length} more planned` : ''}. `, opened ? `You have opened ${opened}.` : ''),
      next ? h('a.btn.btn-primary', { href: `#/algorithm/${next.id}` }, opened ? `Continue with ${next.name}` : `Start with ${next.name}`, h('span', { html: icon('arrow', { size: 15 }) })) : null),
    t.groups.map((g) => h('section.track-group',
      h('h2', g.title), h('p.track-group-blurb', g.blurb),
      h('div.lesson-list', g.lessons.map((id) => {
        const a = C.algoById[id];
        if (!a) return C.plannedById[id] ? plannedRow(C.plannedById[id]) : null;
        const why = g.why && g.why[id];
        return lessonRow(a, { note: why ? `${cap(why)}. ${a.summary}` : null });
      })))),
    paths.length ? h('section.track-group', h('h2', 'Follow it in order'), h('p.track-group-blurb', 'These learning paths walk through the same ground one step at a time, with a reason for each step.'),
      h('div.path-list', paths.map((p) => pathCard(p)))) : null,
    foundations.length ? h('section.track-group', h('h2', 'What these lessons lean on'),
      h('p.track-group-blurb', 'Lessons outside this track that the ones above name as worth reading first. They are in the library with everything else.'),
      h('ul.track-foundations', foundations.map((f) => h('li', h('a.link', { href: `#/algorithm/${f.lesson.id}` }, f.lesson.name), h('span', ` for ${f.neededBy.map((a) => a.name).join(', ')}`))))) : null,
    h('p.track-foot', other ? ['The other track: ', h('a.link', { href: `#/track/${other.id}` }, other.title), '. '] : null,
      'Everything else is still here: ', h('a.link', { href: '#/library' }, `all ${C.algos.length} lessons in the library`), ' and ', h('a.link', { href: '#/explore' }, 'the map of every field'), '.'));
  return { el, title: t.title };
}
