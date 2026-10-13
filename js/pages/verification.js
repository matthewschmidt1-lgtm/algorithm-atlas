// How every lesson is checked. One job: make the checks concrete enough to be trusted,
// and say plainly where they stop. Every number on this page is read from the record the
// content pipeline wrote on its last run (tools/build.py); none is typed in by hand.

import { h, fmt } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { RELATION_SHORT, RELATION_TEXT } from '../core/verify.js';
import { pageHead, plural } from '../ui/parts.js';
import { checkPanel, costSummary } from '../ui/checks.js';

export default async function render({ query }) {
  const info = C.buildInfo;
  const lessons = C.algos.slice().sort((a, b) => a.name.localeCompare(b.name));
  const example = C.algoById[query.lesson] || C.algoById.dijkstra || lessons[0];
  const order = ['exact', 'close', 'average', 'growth', 'upper', 'lower'];
  const check = (n, title, plain, how, stat) => h('section.vcheck',
    h('p.vcheck-n', String(n)),
    h('div', h('h2', title), h('p.vcheck-plain', plain), h('p', how), h('p.vcheck-stat', stat)));

  const ledger = h('div.data-table-wrap', h('table.data-table.vledger',
    h('thead', h('tr', h('th', 'Lesson'), h('th', 'Tests passed'), h('th', 'Code run in'), h('th', 'Stated cost'))),
    h('tbody', lessons.map((a) => {
      const cost = costSummary(a.checks);
      return h('tr',
        h('th', { scope: 'row' }, h('a.link', { href: `#/verification?lesson=${a.id}` }, a.name)),
        h('td', String(a.checks.tests.length)),
        h('td', `${a.checks.languages.length} languages`),
        h('td', cost ? `${cost.text}${cost.count > 1 ? `, ${cost.count} formulas` : ''}` : h('span.faint', 'Argued, not measured')));
    }))));

  const el = h('div.page.wrap.narrow-wide',
    pageHead({ crumbsList: [{ label: 'About', href: '#/about' }, { label: 'How lessons are checked' }], eyebrow: 'Verification', title: 'How every lesson is checked',
      lede: 'A lesson about an algorithm makes claims you cannot easily test by reading: that the code works, that the picture shows what really happens, that the cost is what it says. So before any lesson is published, a program tests those three things. This page shows what it tests and what it found.' }),
    h('p.note-box', `Last full run: ${info.date}. ${plural(info.lessons, 'lesson')} checked, all passing. A lesson that fails any check is not published.`),

    check(1, 'The demonstration is the real algorithm',
      'When you press play on a lesson, you are watching the algorithm itself run. It is not an animation someone drew.',
      'Each lesson contains a working implementation that records every step it takes. The pipeline runs that implementation and compares its results with an independent answer: a second, simpler method, a brute-force search, or a mathematical fact that must hold. It then runs every preset and worked example on the page, and checks that every recorded step has a valid picture, a written explanation and a matching line of pseudocode.',
      `${fmt(info.tests)} tests passed across ${plural(info.lessons, 'lesson')}. ${fmt(info.runs)} demonstration runs, ${fmt(info.frames)} recorded steps checked.`),
    check(2, 'The code runs and agrees with itself',
      'Every program printed on the site has been run. A program that only looks right is not accepted.',
      'Each lesson gives the same program in Python, JavaScript and C++. The pipeline runs all three: Python with the Python interpreter, C++ by compiling it and running the result, JavaScript inside a browser. All three must print exactly the expected output, character for character. Three independent implementations agreeing is strong evidence that the code is right.',
      `${info.programs} programs run. Tools used: ${info.python}, ${info.cxx.replace(/ \(.*\)$/, '')} in C++17 mode, ${info.browser}.`),
    check(3, 'The stated cost matches the implementation',
      'When a lesson says an algorithm takes a certain amount of work, that statement has been measured against the code, not copied from a textbook.',
      'Most lessons state a formula for the work done, such as the number of comparisons needed to sort n items. The pipeline runs the lesson\'s implementation at a range of sizes, counts the operations, and compares the counts with the formula. It records how they relate: an exact match, the same rate of growth, or a limit that is never crossed. If the counts contradict the formula, the lesson fails.',
      `${info.formulas} formulas measured in ${info.lessonsWithCostCheck} lessons: ${order.filter((k) => info.relations[k]).map((k) => `${info.relations[k]} ${RELATION_SHORT[k].toLowerCase()}`).join(', ')}. The other ${info.lessons - info.lessonsWithCostCheck} lessons have no size experiment, and say so.`),

    h('section.about-sec', h('h2', 'What the words mean'),
      h('dl.terms', order.filter((k) => info.relations[k]).map((k) => h('div', h('dt', RELATION_SHORT[k]), h('dd', `The measured count ${RELATION_TEXT[k]}.`)))),
      h('p.small.muted', { style: { marginTop: '12px' } }, 'All of these are counts of operations, which are exact and come out the same on every run. None is a timing. Timings depend on the machine and are shown only in the comparison tool, labelled as such.')),

    h('section.about-sec', h('h2', 'What these checks do not cover'),
      h('div.prose',
        h('p', 'A program can test code and count operations. It cannot tell whether a sentence is true. The explanations, the history, the applications and the references are written and reviewed by hand, and a mistake in them is possible.'),
        h('p', 'Three safeguards apply to the writing. Authors are instructed to leave out any fact they are not certain of. Every application is marked as either an established use or an illustrative example. And the pipeline rejects lessons that are missing a plain-language explanation, a worked example or a statement of their limits. None of this is proof. If you find an error, it is a defect and should be corrected.'))),

    h('section.about-sec', { id: 'example' }, h('h2', `One lesson's record: ${example.name}`),
      h('p.muted', 'Every lesson carries its own record, reachable from the line under its title. This is the full record for one of them.'),
      h('div.check-host', checkPanel(example, { heading: false })),
      h('p', { style: { marginTop: '16px' } }, h('a.text-link', { href: `#/algorithm/${example.id}` }, `Open the ${example.name} lesson`, h('span', { html: icon('arrow', { size: 15 }) })))),

    h('section.about-sec', h('h2', 'The record for every lesson'),
      h('p.muted', 'Choose a lesson to see its full record above.'),
      ledger));

  return { el, title: 'How lessons are checked', keepScroll: !!query.lesson,
    afterMount() { if (query.lesson) { const t = document.getElementById('example'); if (t) t.scrollIntoView({ block: 'start' }); } } };
}
