// What the pipeline verified for a lesson, in words a reader can follow. The record comes
// from tools/build.py (stored on the catalog entry as `checks`); nothing here is asserted
// by hand. Used on lesson pages and on the verification page.

import { h, fmt } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { RELATION_TEXT, RELATION_SHORT } from '../core/verify.js';
import { LANGUAGE_LABELS } from '../core/schema.js';
import { plural } from './parts.js';

const langs = (list) => ['python', 'javascript', 'cpp'].filter((l) => list.includes(l)).map((l) => LANGUAGE_LABELS[l]);
const sentenceList = (items) => (items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

// The strongest single statement about cost for a lesson, for one-line summaries.
export function costSummary(checks) {
  if (!checks.cost.length) return null;
  const order = ['exact', 'close', 'average', 'growth', 'upper', 'lower'];
  const best = checks.cost.slice().sort((a, b) => order.indexOf(a.relation) - order.indexOf(b.relation))[0];
  return { text: RELATION_SHORT[best.relation], count: checks.cost.length };
}

// One line under the lesson title. Pressing it opens the full record.
export function checkLine(a, onToggle) {
  const k = a.checks;
  const cost = costSummary(k);
  const btn = h('button.check-line', { type: 'button', 'aria-expanded': 'false', onclick: () => { const open = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); onToggle(open); } },
    h('span.check-mark', { html: icon('check', { size: 14 }) }),
    h('span', h('strong', 'Checked. '),
      `${plural(k.tests.length, 'test')} of the demonstration passed, the code ran in ${plural(k.languages.length, 'language')}, `,
      cost ? `and the stated cost was measured against the code (${cost.text.toLowerCase()}).` : 'and the cost is argued in the text, not measured.'),
    h('span.check-more', 'See how'));
  return btn;
}

function costTable(c) {
  const hasFormula = c.rows.some((r) => r[2] !== null);
  const rows = c.rows.length > 8 ? c.rows.filter((_, i) => i % Math.ceil(c.rows.length / 8) === 0 || i === c.rows.length - 1) : c.rows;
  return h('div.data-table-wrap', h('table.data-table.check-table',
    h('thead', h('tr', h('th', c.sizeLabel), h('th', `${c.metric}, measured`), hasFormula ? h('th', 'Formula gives') : null)),
    h('tbody', rows.map((r) => h('tr', h('th', fmt(r[0])), h('td.mono', fmt(r[1])), hasFormula ? h('td.mono', r[2] === null ? '' : fmt(r[2])) : null)))));
}

// The full record: three checks and one honest boundary.
export function checkPanel(a, { heading = true } = {}) {
  const k = a.checks;
  const info = C.buildInfo;
  const block = (n, title, ...body) => h('section.check-block', h('p.check-n', `Check ${n}`), h('h3', title), body);
  return h('div.check-panel',
    heading ? h('p.check-intro', `This lesson was last run through the pipeline on ${info.date}. Here is exactly what was checked, and what was not.`) : null,
    block(1, 'The demonstration is the real algorithm',
      h('p', `The picture on this page is drawn by running an implementation of ${a.name}, not by playing a recording. That implementation had to pass ${plural(k.tests.length, 'test')}, each comparing its result with an independent answer or a known mathematical fact:`),
      h('ul.check-tests', k.tests.map((t) => h('li', { html: icon('check', { size: 13 }) }, h('span', t)))),
      h('p.small.muted', `It was also run on every preset and worked example, ${plural(k.runs, 'run')} in all. Each of the ${fmt(k.frames)} recorded steps was checked for a valid picture, a written explanation and a matching line of pseudocode.`)),
    block(2, 'The code runs and agrees with itself',
      h('p', `The ${sentenceList(langs(k.languages))} programs on this page were each run. All ${k.languages.length} had to print exactly the same ${plural(k.outputLines, 'line')} of expected output, character for character.`),
      h('p.small.muted', `Run with ${info.python}, ${info.cxx.replace(/ \(.*\)$/, '')} (C++17) and ${info.browser}.`)),
    block(3, 'The stated cost matches the implementation',
      k.cost.length
        ? [h('p', `The lesson states ${plural(k.cost.length, 'formula')} for how much work the algorithm does. The pipeline ran the implementation at each size, counted the operations, and compared the counts with each formula.`),
          k.cost.map((c) => h('div.check-cost',
            h('p', h('span.check-rel', { class: `is-${c.relation}` }, RELATION_SHORT[c.relation]), ' ', h('strong', c.formula), `. For "${c.series}", the measured count ${RELATION_TEXT[c.relation]} (${c.detail}).`),
            costTable(c)))]
        : h('p', k.costNote),
      k.cost.length ? h('p.small.muted', 'These are counts of operations, which are exact and repeatable. They are not timings. You can rerun the measurement yourself in the chart under "The Technical Explanation".') : null),
    h('section.check-block.is-limit',
      h('h3', 'What a machine cannot check'),
      h('p', 'The explanations, the history, the applications and the references were written and reviewed by hand. No program can confirm that prose is true. If you find a mistake in the writing, it is a defect, and it should be corrected.')));
}
