// Algorithms for the kitchen. One job: show a reader who is wary of numbers how simple an
// algorithm can be, using three things they already do when they cook, and hand them on to
// the lesson where a computer does the same thing. No formulas, no code.

import { h, holdInView } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { pageHead } from '../ui/parts.js';
import { kitchen, kitchenIntro, kitchenEnd } from '../../content/kitchen.js';

const arrowLink = (href, text) => h('a.text-link', { href }, text, h('span', { html: icon('arrow', { size: 15 }) }));

// The middle of what is left, as the Binary Search lesson computes it.
export const middle = (lo, hi) => lo + Math.floor((hi - lo) / 2);

/* ---------- the spice rack: binary search by hand ---------- */
function spiceRack(card) {
  const jars = card.jars;
  let target, lo, hi, looks, done;
  const ask = h('p.rack-ask', { 'aria-live': 'polite' });
  const say = h('p.rack-say', { 'aria-live': 'polite' });
  const buttons = jars.map((name, i) => h('button.jar', { type: 'button', onclick: () => look(i) }));
  const helpBtn = h('button.btn.btn-sm', { type: 'button', onclick: () => { if (!done) look(middle(lo, hi)); } }, 'Let the algorithm choose');
  const againBtn = h('button.btn.btn-sm', { type: 'button', onclick: () => reset(), hidden: true }, 'Find another spice');

  const paint = (i, state) => {
    const b = buttons[i];
    b.className = `jar is-${state}`;
    const open = state === 'open' || state === 'found' || (state === 'out' && b.dataset.seen === '1');
    b.innerHTML = `<span class="jar-lid" aria-hidden="true"></span><span class="jar-label">${open ? jars[i] : ''}</span>`;
    b.disabled = state !== 'closed';
    b.setAttribute('aria-label', `Jar ${i + 1} of ${jars.length}: ${open ? jars[i] : state === 'out' ? 'ruled out' : 'label hidden'}`);
  };
  function reset() {
    const others = jars.filter((j) => j !== target);
    target = others[Math.floor(Math.random() * others.length)];
    lo = 0; hi = jars.length - 1; looks = 0; done = false;
    buttons.forEach((b, i) => { b.dataset.seen = ''; paint(i, 'closed'); });
    ask.innerHTML = `Find the <strong>${target}</strong>. Choose a jar to turn it.`;
    say.textContent = '';
    helpBtn.hidden = false; againBtn.hidden = true;
  }
  function look(i) {
    if (done || i < lo || i > hi) return;
    looks++;
    buttons[i].dataset.seen = '1';
    const name = jars[i];
    if (name === target) {
      done = true;
      paint(i, 'found');
      for (let k = lo; k <= hi; k++) if (k !== i) paint(k, 'out');
      say.textContent = `Found the ${target} in ${looks} ${looks === 1 ? 'look' : 'looks'}. Always turning the middle jar of what is left never takes more than 5 looks for these 16 jars. Turning them one by one from the left would have taken ${jars.indexOf(target) + 1}.`;
      helpBtn.hidden = true; againBtn.hidden = false;
      againBtn.focus();
      return;
    }
    const later = target.localeCompare(name) > 0;
    const from = later ? lo : i, to = later ? i : hi;
    for (let k = from; k <= to; k++) paint(k, 'out');
    if (later) lo = i + 1; else hi = i - 1;
    const left = hi - lo + 1;
    say.textContent = `${name}. ${target} comes ${later ? 'after' : 'before'} ${name} in the alphabet, so ${name} and every jar to its ${later ? 'left' : 'right'} can be ignored. ${left === 1 ? 'One jar is left.' : `${left} jars are left.`}`;
  }
  reset();
  return h('div.rack-try',
    h('p.panel-cap', 'Try it'),
    ask,
    h('div.rack', { role: 'group', 'aria-label': 'A spice rack of 16 jars in alphabetical order' }, buttons),
    h('p.rack-ends', { 'aria-hidden': 'true' }, h('span', `${jars[0]} is at this end`), h('span', `${jars[jars.length - 1]} is at this end`)),
    say,
    h('p.rack-buttons', helpBtn, againBtn));
}

/* ---------- dinner: the critical path as a timeline ---------- */
const clock = ([hh, mm], minutes) => {
  const t = hh * 60 + mm + minutes;
  const H = Math.floor(t / 60), M = t % 60;
  return `${H > 12 ? H - 12 : H}:${String(M).padStart(2, '0')}`;
};
export function dinnerPlan(card) {
  const rows = card.dishes.map((d) => ({ ...d, total: d.tasks.reduce((s, t) => s + t.minutes, 0) }));
  const longest = Math.max(...rows.map((r) => r.total));
  return { longest, rows: rows.map((r) => ({ ...r, spare: longest - r.total })) };
}
function dinnerTimeline(card) {
  const { longest, rows } = dinnerPlan(card);
  const start = [card.serveAt[0], card.serveAt[1] - longest];
  const pct = (m) => `${(100 * m) / longest}%`;
  const ticks = [];
  for (let m = 0; m <= longest; m += 30) ticks.push(m);
  return h('figure.dinner',
    h('div.dinner-rows', rows.map((r) => {
      let at = r.spare;
      return h('div.dinner-row',
        h('div.dinner-name', h('strong', r.name), h('span', r.spare ? `${r.spare} minutes to spare` : 'No spare time')),
        h('div.dinner-track',
          r.spare ? h('span.dinner-seg.is-spare', { style: { left: '0%', width: pct(r.spare) }, title: `${r.spare} minutes to spare` }) : null,
          // a short step has room only for its minutes; the full name is in the tooltip and the text above
          r.tasks.map((t) => { const seg = h('span.dinner-seg', { style: { left: pct(at), width: pct(t.minutes) }, title: `${t.name}, ${t.minutes} minutes` }, h('span', t.minutes >= 30 ? `${t.name}, ${t.minutes} min` : `${t.minutes} min`)); at += t.minutes; return seg; })));
    })),
    h('div.dinner-axis', { 'aria-hidden': 'true' }, ticks.map((m) => h('span', { style: { left: pct(m) } }, clock(start, m)))),
    h('figcaption.fig-cap', h('b', 'What you are looking at'),
      `Each dish starting as late as it can and still be ready at ${clock(card.serveAt, 0)}. The shaded part of a row is spare time. The chicken has none, so it sets the start: ${clock(start, 0)}.`));
}

/* ---------- the dressing: a taste log ---------- */
function tasteLog(card) {
  return h('div.data-table-wrap', h('table.data-table.taste-log',
    h('thead', h('tr', h('th', 'Taste'), h('th', 'How it tastes'), h('th', 'What you do'))),
    h('tbody', card.tastes.map((t, i) => h('tr', h('th', String(i + 1)), h('td', t.taste), h('td', t.change))))));
}

export default async function render({ query }) {
  const extras = { spices: spiceRack, dinner: dinnerTimeline, dressing: tasteLog };
  const cards = kitchen.map((card, n) => {
    const L = C.algoById[card.lesson], also = card.alsoLesson && C.algoById[card.alsoLesson];
    return h('section.kitchen-card', { id: card.id, 'aria-labelledby': `${card.id}-h` },
      h('p.kitchen-n', `Recipe ${n + 1}`),
      h('h2', { id: `${card.id}-h` }, card.title),
      h('p.kitchen-q', card.question),
      h('p.kitchen-setup', card.setup),
      h('div.kitchen-recipe',
        h('p.panel-cap', 'The steps'),
        h('ol.kitchen-steps', card.steps.map((s) => h('li', s)))),
      extras[card.id] ? extras[card.id](card) : null,
      h('p.kitchen-point', card.point),
      h('p.kitchen-computer', card.computer),
      h('div.kitchen-limits', h('h3', 'Where the kitchen stops'), [].concat(card.limits).map((t) => h('p', t))),
      L ? h('p.kitchen-next', arrowLink(`#/algorithm/${L.id}`, `See a computer do it: ${L.name}`),
        also ? h('span.small.muted', ' Or the one-jar-at-a-time version: ', h('a.link', { href: `#/algorithm/${also.id}` }, also.name), '.') : null) : null);
  });

  const beginners = C.pathById['absolute-beginners'];
  const el = h('div.page.wrap.kitchen-page',
    pageHead({ eyebrow: kitchenIntro.eyebrow, title: kitchenIntro.title, lede: kitchenIntro.lede }),
    h('nav.kitchen-toc', { 'aria-label': 'The three recipes' }, kitchen.map((c, n) => h('a', { href: `#/kitchen?at=${c.id}` }, h('span', `${n + 1}`), c.title))),
    cards,
    h('section.kitchen-end', h('h2', kitchenEnd.title), h('p', kitchenEnd.text),
      h('p.kitchen-end-links',
        beginners ? h('a.btn.btn-accent', { href: `#/path/${beginners.id}` }, `Next: ${beginners.title}`) : null,
        h('a.btn', { href: '#/' }, 'Back to the start'))));

  // a link to one recipe opens the page at it
  if (query.at && kitchen.some((c) => c.id === query.at)) {
    queueMicrotask(() => requestAnimationFrame(() => { const t = el.querySelector(`#${query.at}`); if (t) holdInView(t); }));
  }
  return { el, title: kitchenIntro.title };
}
