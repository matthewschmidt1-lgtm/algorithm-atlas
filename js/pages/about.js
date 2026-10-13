// About: what the atlas is, how lessons are checked, what is and is not here yet.

import { h } from '../core/dom.js';
import * as C from '../core/catalog.js';
import { pageHead, plural } from '../ui/parts.js';

export default async function render({ query }) {
  const withLessons = C.disciplines.filter((d) => C.inDiscipline(d.id).length).length;
  const sec = (id, title, ...body) => h('section.about-sec', { id }, h('h2', title), body);
  const el = h('div.page.wrap.narrow',
    pageHead({ eyebrow: 'About', title: 'A field guide to algorithms',
      lede: 'Algorithm Atlas is an interactive guide to the methods that computers, and people, use to solve problems. It is built on one belief: simplicity should be the entry point, and depth should be the invitation.' }),
    sec('idea', 'The idea',
      h('div.prose',
        h('p', 'Most writing about algorithms assumes you already speak the language. This atlas does not. Every lesson opens with an explanation in everyday words and a small example worked by hand. From there the same lesson unfolds into the working details, and then into the mathematics.'),
        h('p', 'The three levels are called Explain it simply, Help me understand, and Go deeper. They are three views of one algorithm, not three different stories. The simple version leaves things out. It does not say anything false.'),
        h('p', 'The design follows the same rule. The science provides the complexity, so the page stays calm.'))),
    sec('today', 'What is here today',
      h('div.prose',
        h('p', `The atlas currently holds ${plural(C.algos.length, 'lesson')} across ${withLessons} of its ${C.disciplines.length} disciplines, ${plural(C.concepts.length, 'concept')} defined in plain words, and ${plural(C.paths.length, 'learning path')}. These numbers are counted from the content itself each time the site is built.`),
        h('p', `A further ${plural(C.planned.length, 'lesson')} are named as planned. They are listed so that existing lessons can point to them honestly, and they are always marked as planned. Nothing appears as a lesson until it has been written and has passed the checks below.`))),
    sec('accuracy', 'How lessons are checked',
      h('div.prose',
        h('p', 'Accuracy is the first requirement. Before a lesson is published, a program checks three things: that the demonstration is a real implementation that gives correct answers, that the code runs in all three languages and prints the same output, and that the cost the lesson states matches what the implementation actually does.'),
        h('p', `On the last run, ${C.buildInfo.lessons} lessons passed ${C.buildInfo.tests} tests, ${C.buildInfo.programs} programs were run, and ${C.buildInfo.formulas} cost formulas were measured against the code.`),
        h('p', h('a', { href: '#/verification' }, 'See exactly what is checked, and the record for every lesson'), '.'))),
    sec('limits', 'What the atlas does not do',
      h('div.prose',
        h('ul',
          h('li', 'It has no accounts. Progress, favourites and collections are stored in your browser only, and are lost if you clear its data.'),
          h('li', 'It does not send your code anywhere. JavaScript samples run in an isolated worker on your device. Python samples run on your device too, using Pyodide, which is downloaded from a public CDN the first time you run one. C++ samples cannot run in a browser and are checked when the site is built.'),
          h('li', 'Its cryptography lessons use toy-sized numbers so that every value is visible. They are for learning and must never be used to protect anything.'),
          h('li', 'Its quantum lesson is a classical simulation of a small quantum computer.'),
          h('li', 'Operation counts are exact for the implementations on this site. They are not benchmarks of other implementations, and they are not timings.')))),
    sec('accessibility', 'Accessibility',
      h('div.prose',
        h('p', 'Every page can be used from the keyboard. Visualizations have play, pause, step and reset buttons, respond to the space bar and arrow keys, and describe each step in words as it happens. Each has a written description of what it shows. The map of disciplines has a list view with the same content, and the relationship maps are followed by lists.'),
        h('p', 'The display settings in the header let you enlarge the text, raise the contrast, switch to a dark theme and reduce motion. The site also follows your system setting for reduced motion. Nothing essential depends on animation or on colour alone.'))),
    sec('built', 'How it is built',
      h('div.prose',
        h('p', 'The site is static: plain HTML, CSS and JavaScript modules, with no build step and no server code. Lessons are loaded on demand. Adding a lesson means adding one file. Adding a discipline means adding one record. Search, the library, the map, the laboratory and the connection graph pick both up without further work.'),
        h('p', 'Mathematics is typeset with KaTeX, and the Python playground uses Pyodide. Both are fetched only when a page needs them. Type is set in Source Serif 4, Inter and JetBrains Mono.'))));
  return { el, title: 'About', afterMount() { if (query.at) { const t = document.getElementById(query.at); if (t) t.scrollIntoView({ block: 'start' }); } } };
}
