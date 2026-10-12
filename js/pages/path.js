// One learning path: prerequisites, objectives, stages as a timeline, the project, and
// where to go next. A stage can be skipped by someone who already knows its material.

import { h, clear, rich } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { pathProgress } from '../core/recommend.js';
import { pageHead, levelGlyph, refLink, plural, LEVEL_NAMES } from '../ui/parts.js';
import NotFound from './notfound.js';

export default async function render({ params }) {
  const p = C.pathById[params.id];
  if (!p) return NotFound();
  const color = C.GROUPS[p.group] ? C.GROUPS[p.group].color : 'forest';
  const timeline = h('ol.timeline');
  const status = h('div.path-status', { 'aria-live': 'polite' });

  function paint() {
    const explored = store.explored();
    const skipped = new Set(store.state.pathSkips[p.id] || []);
    const pr = pathProgress(p);
    clear(status).append(
      h('div.path-progress.is-large', h('span.bar', h('i', { style: { width: `${pr.total ? Math.round((pr.done / pr.total) * 100) : 0}%` } })),
        h('span', pr.total ? `${pr.done} of ${pr.total} lessons explored` : 'No published lessons in this path yet')),
      pr.next ? h('a.btn.btn-primary', { href: `#/algorithm/${pr.next.module.algo}` }, pr.started ? 'Continue: ' : 'Start: ', C.algoById[pr.next.module.algo].name, h('span', { html: icon('arrow', { size: 15 }) }))
        : pr.complete ? h('p.path-complete', { html: `${icon('check', { size: 16 })} You have explored every published lesson on this path.` }) : null,
      h('p.small.faint', store.persistent ? 'A lesson counts as explored once you open it. Progress is kept in this browser.' : 'Progress is not being saved: this browser is blocking storage.'));
    clear(timeline);
    p.stages.forEach((s, i) => {
      const isSkipped = skipped.has(s.id);
      const pub = s.modules.filter((m) => C.algoById[m.algo]);
      const done = pub.filter((m) => explored.has(m.algo)).length;
      const quizN = pub.reduce((n, m) => n + (C.algoById[m.algo].quizCount || 0), 0);
      timeline.append(h(`li.stage${isSkipped ? '.is-skipped' : ''}${pub.length && done === pub.length ? '.is-done' : ''}`,
        h('div.stage-marker', { 'aria-hidden': 'true' }, String(i + 1)),
        h('div.stage-body',
          h('p.stage-no', `Stage ${i + 1}${isSkipped ? ' · skipped' : pub.length ? ` · ${done} of ${pub.length} explored` : ''}`),
          h('h3', s.title),
          h('p.stage-goal', s.goal),
          s.skipIf ? h('div.stage-skip', h('span', { html: rich(s.skipIf) }),
            h('button.btn.btn-sm', { type: 'button', 'aria-pressed': isSkipped ? 'true' : 'false', onclick: () => { store.toggleStageSkip(p.id, s.id); paint(); } }, isSkipped ? 'Bring this stage back' : 'Skip this stage')) : null,
          h('ul.stage-modules', s.modules.map((m) => {
            const a = C.algoById[m.algo];
            if (!a) return h('li.is-planned', h('div', h('span.module-name', C.resolveRef(m.algo).name), ' ', h('span.planned-tag', 'Planned')), h('p', m.why));
            const seen = explored.has(a.id);
            return h(`li${seen ? '.is-seen' : ''}`,
              h('div', h('a.module-name', { href: `#/algorithm/${a.id}` }, a.name), levelGlyph(a.difficulty), seen ? h('span.seen', { html: `${icon('check', { size: 14 })}Explored` }) : null),
              h('p', m.why));
          })),
          (s.concepts || []).length ? h('p.stage-concepts', 'Ideas introduced: ', s.concepts.map((c, k) => [k ? ', ' : '', refLink(`concept:${c}`)])) : null,
          s.exercise ? h('div.stage-exercise', h('p.panel-cap', 'Exercise'), h('p', { html: rich(s.exercise) })) : null,
          quizN ? h('p.small.faint', `Knowledge checks in this stage: ${plural(quizN, 'question')} across its lessons.`) : null)));
    });
  }
  paint();
  const unsub = store.subscribe(() => {});

  const el = h(`div.page.wrap.c-${color}`,
    pageHead({ crumbsList: [{ label: 'Learning Paths', href: '#/paths' }, { label: p.title }], eyebrow: `${LEVEL_NAMES[p.level] || p.level} path`, title: p.title, lede: p.blurb }),
    h('div.path-layout',
      h('div.path-main',
        status,
        h('h2', 'The route'),
        timeline,
        p.project ? h('section.path-project', h('p.lsec-kicker', 'Practical project'), h('h2', p.project.title), h('p.lede', p.project.brief),
          h('ol.steps', (p.project.steps || []).map((s) => h('li', { html: rich(s) }))),
          p.project.stretch ? h('p.note-box', h('strong', 'To take it further. '), h('span', { html: rich(p.project.stretch) })) : null) : null,
        (p.next || []).length ? h('section.path-next', h('h2', 'Where to go next'), h('ul.side-related', p.next.filter((n) => C.pathById[n.path]).map((n) => h('li', h('a.link', { href: `#/path/${n.path}` }, C.pathById[n.path].title), h('span', n.why))))) : null),
      h('aside.path-side',
        h('div.side-block', h('h3', 'Who it is for'), h('p', p.audience)),
        h('div.side-block', h('h3', 'Before you start'), (p.prerequisites || []).length ? h('ul.side-related', p.prerequisites.map((x) => h('li', h('span', x.text), x.path && C.pathById[x.path] ? h('a.link', { href: `#/path/${x.path}` }, `Covered in ${C.pathById[x.path].title}`) : null))) : h('p', 'Nothing. Curiosity is enough.')),
        h('div.side-block', h('h3', 'By the end you will be able to'), h('ul.side-list', (p.objectives || []).map((o) => h('li', o)))))));
  return { el, title: p.title, destroy() { unsub(); } };
}
