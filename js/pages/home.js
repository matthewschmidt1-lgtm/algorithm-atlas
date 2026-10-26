// Home has one job: say what the atlas is and point to the ways in.
// It does not reproduce the other pages. The map here is a signpost to Explore, the
// demonstrations are a taste of the lab, and each feature gets one line and a link.

import { h, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { createSearchBox } from '../ui/searchbox.js';
import { createUniverse } from '../art/universe.js';
import { createPreview } from '../ui/preview.js';
import { sectionHead, plural } from '../ui/parts.js';
import { mountHeroNetwork } from '../art/hero-network.js';
import { openOnboarding } from '../ui/onboarding.js';
import { recommendLessons } from '../core/recommend.js';
import { trackLessons } from '../core/tracks.js';
import { kitchen, kitchenIntro } from '../../content/kitchen.js';
import { recipeArt, potArt, sortingArt } from '../art/kitchen-art.js';

const HOME_DEMOS = ['gradient-descent', 'dijkstra', 'monte-carlo', 'ddpm'];

export default async function render() {
  const cleanups = [];

  /* ---- hero ---- */
  // The main button leads to a first success: the gentlest lesson of the beginners' path,
  // which keeps offering the next one. A returning reader is taken to where they left off.
  const beginners = C.pathById['absolute-beginners'] || C.paths.find((p) => p.level === 'beginner');
  const modules = beginners ? beginners.stages.flatMap((s) => s.modules).filter((m) => C.algoById[m.algo]) : [];
  const seen = store.explored();
  const resume = modules.find((m) => !seen.has(m.algo));
  const first = !modules.length ? null
    : seen.size && resume ? { href: `#/algorithm/${resume.algo}?path=${beginners.id}`, label: `Continue with ${C.algoById[resume.algo].name}` }
      : seen.size ? { href: '#/profile', label: 'Pick up where you left off' }
        : { href: `#/algorithm/${modules[0].algo}?path=${beginners.id}`, label: 'Start with a first lesson' };
  const netHost = h('div.hero-net', { 'aria-hidden': 'true' });
  const search = createSearchBox({ large: true });
  const hero = h('section.hero',
    netHost,
    h('div.wrap.hero-inner',
      h('div.hero-text',
        h('p.eyebrow', 'Algorithms for AI and for business'),
        h('h1', 'How machines ', h('em', 'learn'), '. How algorithms make better decisions.'),
        h('p.lede', 'Algorithm Atlas explains the methods behind artificial intelligence and behind everyday business decisions: forecasts, budgets, schedules and routes. Every lesson starts in plain words, runs the real method in front of you, and goes as deep as you like.'),
        h('div.hero-actions',
          first ? h('a.btn.btn-accent.btn-lg', { href: first.href }, first.label) : null,
          h('a.btn.btn-lg', { href: '#/explore' }, 'Explore the Atlas')),
        h('div.hero-search', search.el,
          h('p.hero-try', 'Try ',
            ['shortest route', 'compress files', 'make a neural network learn'].map((q, i) => [i ? ', ' : '', h('a', { href: `#/search?q=${encodeURIComponent(q)}` }, q)]), '. Or ', h('a', { href: '#/problems' }, 'browse by what you want to do'), '.'),
          h('p.hero-try.hero-suggest', 'Not sure where to begin? ',
            h('button.hero-suggest-btn', { type: 'button', onclick: () => openOnboarding({ onDone: (answered) => { if (answered) navigate('#/profile'); } }) }, 'Answer four questions and get a suggestion'), '.')))));
  queueMicrotask(() => requestAnimationFrame(() => cleanups.push(mountHeroNetwork(netHost))));

  /* ---- algorithms for the kitchen ---- */
  // The gentlest way in, for a reader who is wary of numbers: three things they already do.
  const kitchenSec = h('section.section.home-kitchen', { 'aria-labelledby': 'home-kitchen-h' }, h('div.wrap',
    // one column that reads straight down: label, title, introduction, then the recipes.
    // The pot sits beside the text as decoration and is not part of the reading order.
    h('div.home-kitchen-head',
      h('div.home-kitchen-text',
        h('p.eyebrow', kitchenIntro.eyebrow),
        h('h2', { id: 'home-kitchen-h' }, kitchenIntro.title),
        kitchenIntro.homeLede.map((t) => h('p.lede', t))),
      h('div.home-kitchen-pot', { html: potArt() })),
    h('div.kitchen-teasers', kitchen.map((c, n) => h('a.kitchen-teaser', { href: `#/kitchen?at=${c.id}`, style: { '--i': n } },
      recipeArt[c.id] ? h('span.kitchen-teaser-art', { html: recipeArt[c.id]({ size: 52 }) }) : null,
      h('span.kitchen-teaser-n', `Recipe ${n + 1}`),
      h('span.kitchen-teaser-title', c.title),
      h('span.kitchen-teaser-q', c.question),
      h('span.kitchen-teaser-gist', c.gist)))),
    h('p.sec-more', h('a.text-link', { href: '#/kitchen' }, 'Start with the first recipe', h('span', { html: icon('arrow', { size: 15 }) })))));
  // the cards rise into place the first time the section scrolls into view
  if ('IntersectionObserver' in window) {
    kitchenSec.classList.add('will-rise');
    const seen = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { kitchenSec.classList.add('has-risen'); seen.disconnect(); } }, { threshold: 0.15 });
    seen.observe(kitchenSec);
    cleanups.push(() => seen.disconnect());
  }

  /* ---- the two tracks ---- */
  const trackCard = (t) => {
    const { published, planned } = trackLessons(t);
    return h('a.track-card', { href: `#/track/${t.id}` },
      h('span.track-card-title', t.title, h('span', { html: icon('arrow', { size: 18 }) })),
      h('span.track-card-blurb', t.blurb),
      h('span.track-card-groups', t.groups.map((g) => g.title).join(' · ')),
      h('span.track-card-count', `${plural(published.length, 'lesson')}${planned.length ? `, ${planned.length} more planned` : ''}`));
  };
  const tracksSec = C.tracks.length ? h('section.section.home-tracks', { 'aria-labelledby': 'home-tracks-h' }, h('div.wrap',
    sectionHead({ eyebrow: 'Two guides', title: 'Where the atlas goes deepest', id: 'home-tracks-h', single: true }),
    h('div.track-cards', C.tracks.map(trackCard)))) : null;

  /* ---- the map, as a signpost ---- */
  const mapHost = h('div.universe-map.home-map');
  queueMicrotask(() => requestAnimationFrame(() => {
    const u = createUniverse(mapHost, { height: Math.round(Math.max(340, Math.min(520, mapHost.clientWidth * 0.5))), onSelect: (sel) => { if (sel) navigate(`#/explore?${sel.type === 'discipline' ? 'd' : 'a'}=${sel.id}`); } });
    cleanups.push(() => u.destroy());
  }));
  const universe = h('section.section', { id: 'universe' }, h('div.wrap',
    sectionHead({ eyebrow: 'The map', title: 'The Algorithm Universe', lede: `The two tracks sit inside a wider map: ${C.disciplines.length} disciplines drawn as one landscape. Each hill is a field, each marker a lesson, and each dotted route an idea two fields share.` }),
    h('figure.home-map-figure', mapHost,
      h('figcaption.fig-cap', h('b', 'Choose a hill'), 'to open it on the full map, with its subfields, lessons and neighbours.')),
    h('p.sec-more', h('a.text-link', { href: '#/explore' }, 'Open the full map', h('span', { html: icon('arrow', { size: 15 }) })),
      h('a.text-link', { href: '#/disciplines' }, 'Or see all disciplines as a list', h('span', { html: icon('arrow', { size: 15 }) })))));

  /* ---- a taste of the demonstrations ---- */
  const demos = HOME_DEMOS.map((id) => C.featured.find((f) => f.id === id)).filter(Boolean);
  const previews = demos.map((f, i) => createPreview(f, i));
  previews.forEach((p) => cleanups.push(() => p.destroy()));
  // Read straight down, as the kitchen section is: label, title, introduction, then the figures.
  // The sorting bars beside the text are decoration, not part of the reading order.
  const featured = previews.length ? h('section.section.home-demos', { 'aria-labelledby': 'home-demos-h' }, h('div.wrap',
    h('div.home-demos-head',
      h('div.home-demos-text',
        h('p.eyebrow', 'Run them here'),
        h('h2', { id: 'home-demos-h' }, 'Algorithms at work'),
        h('p.lede', 'None of these is a recording. Each figure runs the lesson\'s own code in your browser, one step at a time, when you press the button.')),
      h('div.home-demos-art', { html: sortingArt() })),
    h('div.preview-grid.home-demos-grid', previews.map((p, i) => { p.el.style.setProperty('--i', i); return p.el; })),
    h('p.sec-more', h('a.text-link', { href: '#/lab' }, `Run any of the ${plural(C.algos.length, 'demonstration')} in the lab`, h('span', { html: icon('arrow', { size: 15 }) }))))) : null;
  // the figures rise into place the first time the section is seen, as the kitchen recipes do
  if (featured && 'IntersectionObserver' in window) {
    featured.classList.add('will-rise');
    const seen = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { featured.classList.add('has-risen'); seen.disconnect(); } }, { threshold: 0.1 });
    seen.observe(featured);
    cleanups.push(() => seen.disconnect());
  }

  /* ---- ways in ---- */
  const way = (href, title, text) => h('a.way', { href }, h('span.way-title', title, h('span', { html: icon('arrow', { size: 16 }) })), h('span.way-text', text));
  const you = h('div.home-you');
  const paintYou = () => {
    clear(you);
    if (!store.state.profile) {
      // the invitation to answer four questions now sits in the hero, beside the search
      you.hidden = true;
    } else {
      you.hidden = false;
      const rec = recommendLessons(1)[0];
      you.append(rec ? h('p', h('strong', 'Suggested next for you: '), h('a.link', { href: `#/algorithm/${rec.a.id}` }, rec.a.name), `. ${rec.reason}`) : h('p', 'You have opened every published lesson.'),
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

  const el = h('div.home', hero, kitchenSec, tracksSec, featured, universe, ways);
  return { el, title: '', destroy() { cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); } };
}
