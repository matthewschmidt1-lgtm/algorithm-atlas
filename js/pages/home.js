// Home has one job: say what the atlas is and point to the ways in.
// It does not reproduce the other pages. The map here is a signpost to Explore, the
// demonstrations are a taste of the lab, and each feature gets one line and a link.

import { h, clear, richBlock, fmt } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { createSearchBox } from '../ui/searchbox.js';
import { createUniverse } from '../art/universe.js';
import { createPreview } from '../ui/preview.js';
import { sectionHead, plural, fact } from '../ui/parts.js';
import { mountHeroNetwork } from '../art/hero-network.js';
import { openOnboarding } from '../ui/onboarding.js';
import { recommendLessons } from '../core/recommend.js';

const HOME_DEMOS = ['dijkstra', 'quick-sort', 'gradient-descent', 'ddpm'];

export default async function render() {
  const cleanups = [];
  const info = C.buildInfo;

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

  /* ---- what was checked ---- */
  const trust = h('section.ledger', { 'aria-label': 'How the lessons were checked' }, h('div.wrap',
    h('div.ledger-row',
      fact(info.lessons, 'lessons, each one checked before it was published'),
      fact(fmt(info.tests), 'tests passed against independent answers'),
      fact(info.programs, 'programs run in Python, JavaScript and C++'),
      fact(info.formulas, 'cost formulas measured against the real code')),
    h('p.ledger-link', h('a.text-link', { href: '#/verification' }, 'How every lesson is checked', h('span', { html: icon('arrow', { size: 15 }) })))));

  /* ---- the map, as a signpost ---- */
  const mapHost = h('div.universe-map.home-map');
  queueMicrotask(() => requestAnimationFrame(() => {
    const u = createUniverse(mapHost, { height: Math.round(Math.max(340, Math.min(520, mapHost.clientWidth * 0.5))), onSelect: (sel) => { if (sel) navigate(`#/explore?${sel.type === 'discipline' ? 'd' : 'a'}=${sel.id}`); } });
    cleanups.push(() => u.destroy());
  }));
  const universe = h('section.section', { id: 'universe' }, h('div.wrap',
    sectionHead({ eyebrow: 'The map', title: 'The Algorithm Universe', lede: `${C.disciplines.length} disciplines drawn as one landscape. Each hill is a field, each marker a lesson, and each dotted route an idea two fields share.` }),
    h('figure.home-map-figure', mapHost,
      h('figcaption.fig-cap', h('b', 'Choose a hill'), 'to open it on the full map, with its subfields, lessons and neighbours.')),
    h('p.sec-more', h('a.text-link', { href: '#/explore' }, 'Open the full map', h('span', { html: icon('arrow', { size: 15 }) })),
      h('a.text-link', { href: '#/disciplines' }, 'Or see all disciplines as a list', h('span', { html: icon('arrow', { size: 15 }) })))));

  /* ---- three levels ---- */
  const levelsBody = h('div.levels-demo-body');
  const sampleId = C.algoById.dijkstra ? 'dijkstra' : (C.algos[0] || {}).id;
  const levelTabs = [
    { n: 1, name: 'Explain it simply', about: 'everyday language and a small example. No background needed.' },
    { n: 2, name: 'Help me understand', about: 'the steps, the code and the terms you need.' },
    { n: 3, name: 'Go deeper', about: 'cost, proofs, history and sources.' },
  ];
  let levelBtns = [];
  const showLevel = async (n) => {
    levelBtns.forEach((b, i) => b.setAttribute('aria-selected', i + 1 === n ? 'true' : 'false'));
    try {
      const lesson = await C.loadLesson(sampleId);
      const text = n === 1 ? lesson.bigIdea.simple : n === 2 ? lesson.logic.intuition : lesson.logic.correctness;
      clear(levelsBody).append(
        h('p.levels-demo-cap', `${lesson.meta.name} at level ${n}: ${levelTabs[n - 1].about}`),
        h('div.prose.levels-demo-text', { html: richBlock(text) }),
        h('p', h('a.text-link', { href: `#/algorithm/${sampleId}?level=${n}` }, 'Read this lesson', h('span', { html: icon('arrow', { size: 15 }) }))));
    } catch { clear(levelsBody).append(h('p.muted', 'The sample lesson could not be loaded.')); }
  };
  levelBtns = levelTabs.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => showLevel(t.n) }, t.name));
  const levels = sampleId ? h('section.section.tinted', h('div.wrap.levels-demo',
    h('div',
      h('p.eyebrow', 'One idea, three depths'),
      h('h2', 'Start simple. Go as deep as you like.'),
      h('p.lede', 'Every lesson opens in plain language. The same lesson then unfolds into the working details, and finally into the mathematics. Deeper material stays out of the way until you ask for it.')),
    h('div.levels-demo-card', h('div.tabs', { role: 'tablist', 'aria-label': 'Reading level' }, levelBtns), levelsBody))) : null;
  if (sampleId) showLevel(1);

  /* ---- a taste of the demonstrations ---- */
  const demos = HOME_DEMOS.map((id) => C.featured.find((f) => f.id === id)).filter(Boolean);
  const previews = demos.map((f, i) => createPreview(f, i));
  previews.forEach((p) => cleanups.push(() => p.destroy()));
  const featured = previews.length ? h('section.section', h('div.wrap',
    sectionHead({ eyebrow: 'Run them here', title: 'Algorithms at work', lede: 'None of these is a recording. Each figure runs the lesson\'s own code in your browser, one step at a time, when you press the button.' }),
    h('div.preview-grid', previews.map((p) => p.el)),
    h('p.sec-more', h('a.text-link', { href: '#/lab' }, `Run any of the ${plural(C.algos.length, 'demonstration')} in the lab`, h('span', { html: icon('arrow', { size: 15 }) }))))) : null;

  /* ---- ways in ---- */
  const way = (href, title, text) => h('a.way', { href }, h('span.way-title', title, h('span', { html: icon('arrow', { size: 16 }) })), h('span.way-text', text));
  const you = h('div.home-you');
  const paintYou = () => {
    clear(you);
    if (!store.state.profile) {
      you.append(h('p', h('strong', 'Not sure where to start? '), 'Answer four short questions and the atlas will suggest a first lesson. No account is needed.'),
        h('button.btn', { type: 'button', onclick: () => openOnboarding({ onDone: paintYou }) }, 'Suggest a starting point'));
    } else {
      const rec = recommendLessons(1)[0];
      you.append(rec ? h('p', h('strong', 'Suggested next for you: '), h('a.link', { href: `#/algorithm/${rec.a.id}` }, rec.a.name), `. ${rec.reason}.`) : h('p', 'You have opened every published lesson.'),
        h('a.btn', { href: '#/profile' }, 'Open your atlas'));
    }
  };
  paintYou();
  const ways = h('section.section', h('div.wrap',
    sectionHead({ eyebrow: 'Ways in', title: 'Where would you like to begin?', single: true }),
    h('div.ways.is-home',
      way('#/library', 'Find a lesson', `Search and filter all ${plural(C.algos.length, 'lesson')} by field, level or technique.`),
      way('#/paths', 'Follow a path', `${plural(C.paths.length, 'ordered route')}, from first steps to specialist topics.`),
      way('#/connections', 'Follow an idea', 'See one idea turn up in fields that seem unrelated.'),
      way('#/compare', 'Compare methods', 'Run algorithms that solve the same problem on the same input.')),
    you));

  const el = h('div.home', hero, trust, universe, levels, featured, ways);
  return { el, title: '', destroy() { cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); } };
}
