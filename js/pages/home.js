// Home: the way in. Hero, the Algorithm Universe, the disciplines, live demonstrations,
// the three reading levels, threads, paths, and (optionally) personal recommendations.

import { h, clear, richBlock } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { createSearchBox } from '../ui/searchbox.js';
import { createExplorer } from '../ui/explorer.js';
import { createPreview } from '../ui/preview.js';
import { plate, sectionHead, lessonRow, refLink, plural, fact } from '../ui/parts.js';
import { mountHeroNetwork } from '../art/hero-network.js';
import { openOnboarding } from '../ui/onboarding.js';
import { recommendLessons, recommendPaths, pathProgress } from '../core/recommend.js';

export default async function render() {
  const cleanups = [];

  /* ---- hero ---- */
  const netHost = h('div.hero-net', { 'aria-hidden': 'true' });
  const search = createSearchBox({ large: true });
  const hero = h('section.hero',
    netHost,
    h('div.wrap.hero-inner',
      h('div.hero-text',
        h('p.eyebrow', 'The science of solving problems'),
        h('h1', 'Every Algorithm Has a ', h('em', 'Universe'), ' Behind It.'),
        h('p.lede', 'Explore the algorithms that power intelligence, mathematics, science, technology, and the world around us. Understand how they work. Experiment with their logic. Discover how everything connects.'),
        h('div.hero-actions',
          h('a.btn.btn-accent.btn-lg', { href: '#/explore' }, 'Explore the Atlas'),
          h('a.btn.btn-lg', { href: '#/lab' }, 'Enter the Interactive Lab')),
        h('div.hero-search', search.el,
          h('p.hero-try', 'Try ',
            ['shortest route', 'compress files', 'make a neural network learn'].map((q, i) => [i ? ', ' : '', h('a', { href: `#/search?q=${encodeURIComponent(q)}` }, q)]), '.')))));
  queueMicrotask(() => requestAnimationFrame(() => cleanups.push(mountHeroNetwork(netHost))));

  /* ---- ledger ---- */
  const withLessons = C.disciplines.filter((d) => C.inDiscipline(d.id).length).length;
  const ledger = h('section.ledger', { 'aria-label': 'What the atlas holds today' }, h('div.wrap.ledger-row',
    fact(C.algos.length, 'lessons published, each checked in three languages'),
    fact(C.disciplines.length, `disciplines mapped, ${withLessons} with lessons so far`),
    fact(C.concepts.length, 'concepts defined in plain words'),
    fact(3, 'reading levels for every lesson, from simple to rigorous')));

  /* ---- universe ---- */
  const explorer = createExplorer();
  cleanups.push(() => explorer.destroy());
  const universe = h('section.section', { id: 'universe' }, h('div.wrap',
    sectionHead({ eyebrow: 'The map', title: 'The Algorithm Universe', lede: 'Twenty disciplines drawn as one landscape. Select a hill to see its subfields, its foundational lessons, the fields it borders and where its ideas are used.' }),
    explorer.el));

  /* ---- disciplines ---- */
  const counts = C.disciplines.map((d) => C.inDiscipline(d.id).length);
  const sorted = counts.slice().sort((a, b) => b - a);
  const wideCut = sorted[3] || 0;
  let wides = 0;
  const plates = h('div.plate-grid', C.disciplines.map((d, i) => {
    const wide = counts[i] >= wideCut && counts[i] > 0 && wides < 4 && (wides++, true);
    return plate(d, i, { wide });
  }));
  const discover = h('section.section', h('div.wrap',
    sectionHead({ eyebrow: 'Twenty plates', title: 'Explore the Infinite', lede: 'Each discipline has its own plate: a figure drawn from one of its ideas, what it studies, and how much of it is written. Counts are of lessons that exist today.' }),
    plates,
    h('p.sec-more', h('a.text-link', { href: '#/disciplines' }, 'All disciplines, grouped', h('span', { html: icon('arrow', { size: 15 }) })))));

  /* ---- featured demonstrations ---- */
  const previews = C.featured.map((f, i) => createPreview(f, i));
  previews.forEach((p) => cleanups.push(() => p.destroy()));
  const featured = previews.length ? h('section.section.tinted', h('div.wrap',
    sectionHead({ eyebrow: 'Run them here', title: 'Algorithms at work', lede: 'Nothing on this page is a recording. Each figure runs the lesson\'s own implementation in your browser when you press the button, one step at a time.' }),
    h('div.preview-grid', previews.map((p) => p.el)),
    h('p.sec-more', h('a.text-link', { href: '#/library' }, `Browse all ${plural(C.algos.length, 'lesson')}`, h('span', { html: icon('arrow', { size: 15 }) }))))) : null;

  /* ---- three levels ---- */
  const levelsBody = h('div.levels-demo-body');
  const sampleId = C.algoById.dijkstra ? 'dijkstra' : (C.algos[0] || {}).id;
  const levelTabs = [
    { n: 1, name: 'Explain it simply', about: 'Everyday language and a small example. No background needed.' },
    { n: 2, name: 'Help me understand', about: 'Step-by-step logic, pseudocode, code you can run, and the terms you need.' },
    { n: 3, name: 'Go deeper', about: 'Proofs, complexity analysis, derivations, history and references.' },
  ];
  let levelBtns = [];
  const showLevel = async (n) => {
    levelBtns.forEach((b, i) => b.setAttribute('aria-selected', i + 1 === n ? 'true' : 'false'));
    try {
      const lesson = await C.loadLesson(sampleId);
      const text = n === 1 ? lesson.bigIdea.simple : n === 2 ? lesson.logic.intuition : lesson.logic.correctness;
      clear(levelsBody).append(
        h('p.levels-demo-cap', `${lesson.meta.name}, level ${n} of 3: ${levelTabs[n - 1].about}`),
        h('div.prose.levels-demo-text', { html: richBlock(text) }),
        h('p', h('a.text-link', { href: `#/algorithm/${sampleId}` }, `Read the ${lesson.meta.name} lesson`, h('span', { html: icon('arrow', { size: 15 }) }))));
    } catch { clear(levelsBody).append(h('p.muted', 'The sample lesson could not be loaded.')); }
  };
  levelBtns = levelTabs.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => showLevel(t.n) }, t.name));
  const levels = sampleId ? h('section.section', h('div.wrap.levels-demo',
    h('div',
      h('p.eyebrow', 'One idea, three depths'),
      h('h2', 'Start simple. Go as deep as you like.'),
      h('p.lede', 'Every lesson begins in plain language that needs no background. The same lesson then unfolds into the working details, and finally into the mathematics. The simple version is never a different, easier story. It is the same idea with fewer symbols.')),
    h('div.levels-demo-card', h('div.tabs', { role: 'tablist', 'aria-label': 'Reading level' }, levelBtns), levelsBody))) : null;
  if (sampleId) showLevel(1);

  /* ---- threads ---- */
  const threadCards = C.threads.slice(0, 4).map((t) => h(`article.thread-card.c-${t.color}`,
    h('h3', h('a', { href: `#/connections?thread=${t.id}` }, t.title)),
    h('p', t.principle),
    h('ol.thread-stops', t.stops.slice(0, 5).map((s) => h('li', refLink(s.ref))))));
  const threads = C.threads.length ? h('section.section', h('div.wrap',
    sectionHead({ eyebrow: 'Connections', title: 'Everything Is Connected', lede: 'The same few ideas keep turning up in fields that seem to have nothing in common. A thread follows one idea from place to place and says what is shared.' }),
    h('div.thread-grid', threadCards),
    h('p.sec-more', h('a.text-link', { href: '#/connections' }, 'Follow every thread', h('span', { html: icon('arrow', { size: 15 }) }))))) : null;

  /* ---- for you ---- */
  const you = h('section.section.tinted', { id: 'for-you' });
  const renderYou = () => {
    clear(you);
    const p = store.state.profile;
    const recent = store.state.recents.map((r) => C.algoById[r.id]).filter(Boolean).slice(0, 3);
    const wrap = h('div.wrap');
    if (!p) {
      wrap.append(h('div.invite',
        h('div', h('p.eyebrow', 'Make it yours'), h('h2', 'Tell the atlas what you are curious about.'),
          h('p.lede', 'Answer four short questions and the atlas will suggest where to begin. There is no account to create, and you can explore everything without answering.')),
        h('div.invite-actions',
          h('button.btn.btn-primary.btn-lg', { type: 'button', onclick: () => openOnboarding({ onDone: renderYou }) }, 'Answer four questions'),
          h('a.btn.btn-lg', { href: '#/paths' }, 'Or choose a learning path'))));
    } else {
      const recs = recommendLessons(4);
      const paths = recommendPaths(2);
      wrap.append(sectionHead({ eyebrow: 'For you', title: 'Suggested next', lede: 'Based on the answers you gave and the lessons you have opened. Each suggestion says why it is here.' }));
      wrap.append(h('div.you-grid',
        h('div', h('h3.you-h', 'Lessons'), recs.length ? h('div.lesson-list', recs.map((r) => lessonRow(r.a, { note: `${r.reason}. ${r.a.summary}` }))) : h('p.muted', 'You have opened every published lesson.')),
        h('div',
          h('h3.you-h', 'Paths'),
          h('ul.you-paths', paths.map(({ path, reason }) => { const pr = pathProgress(path); return h('li', h('a', { href: `#/path/${path.id}` }, path.title), h('span', pr.started ? `${pr.done} of ${pr.total} lessons explored` : reason)); })),
          recent.length ? [h('h3.you-h', 'Recently opened'), h('ul.you-paths', recent.map((a) => h('li', h('a', { href: `#/algorithm/${a.id}` }, a.name), h('span', C.disciplineById[a.discipline].short))))] : null,
          h('p', { style: { marginTop: '20px' } }, h('a.text-link', { href: '#/profile' }, 'Open your atlas', h('span', { html: icon('arrow', { size: 15 }) }))))));
    }
    you.append(wrap);
  };
  renderYou();

  /* ---- paths teaser ---- */
  const pathPick = ['absolute-beginners', 'data-structures-algorithms', 'machine-learning-first-principles', 'optimization-operations-research'].map((id) => C.pathById[id]).filter(Boolean);
  const pathsSec = pathPick.length ? h('section.section', h('div.wrap',
    sectionHead({ eyebrow: 'Learning paths', title: 'A route through the territory', lede: 'Paths put lessons in a sensible order for a goal. Each stage says what it is for, and you can skip the stages you already know.' }),
    h('div.path-teasers', pathPick.map((p) => h(`a.path-teaser.c-${C.GROUPS[p.group] ? C.GROUPS[p.group].color : 'forest'}`, { href: `#/path/${p.id}` },
      h('span.path-teaser-level', p.level), h('span.path-teaser-title', p.title), h('span.path-teaser-blurb', p.blurb),
      h('span.path-teaser-meta', plural(p.stages.length, 'stage'), ' · ', plural(p.stages.flatMap((s) => s.modules).filter((m) => C.algoById[m.algo]).length, 'lesson'))))),
    h('p.sec-more', h('a.text-link', { href: '#/paths' }, `All ${C.paths.length} learning paths`, h('span', { html: icon('arrow', { size: 15 }) }))))) : null;

  const el = h('div.home', hero, ledger, universe, discover, featured, levels, threads, pathsSec, you);
  return { el, title: '', destroy() { cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); } };
}
