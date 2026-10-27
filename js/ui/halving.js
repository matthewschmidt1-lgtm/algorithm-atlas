// The halving race: how many looks it takes to find one name in a phone book, checking one
// name at a time against opening it in the middle each time. One slider, two counts, and the
// halvings themselves laid out as steps. The halving count is binary search's worst case on
// that many sorted names: the number of times the book can be halved before one name is left.

import { h, clear } from '../core/dom.js';

export const RACE_SIZES = [10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];
const fmt = (n) => n.toLocaleString('en-US');

// every size the search can face, from the whole book down to one name
export function halvings(n) {
  const out = [n];
  while (out[out.length - 1] > 1) out.push(Math.floor(out[out.length - 1] / 2));
  return out;
}

export function createHalvingRace({ start = 2, lessonHref = '#/algorithm/binary-search' } = {}) {
  const slider = h('input.race-slider', { type: 'range', min: 0, max: RACE_SIZES.length - 1, step: 1, value: start, 'aria-label': 'How many names are in the phone book' });
  const sizeOut = h('output.race-size');
  const oneNum = h('span.race-num'), halfNum = h('span.race-num');
  const oneBar = h('span.race-bar-fill'), halfBar = h('span.race-bar-fill');
  const chips = h('ol.race-chips', { 'aria-label': 'Names left after each look' });
  const said = h('p.race-said', { 'aria-live': 'polite' });

  const paint = () => {
    const n = RACE_SIZES[Number(slider.value)], steps = halvings(n), looks = steps.length;
    sizeOut.textContent = `${fmt(n)} names`;
    slider.setAttribute('aria-valuetext', `${fmt(n)} names`);
    oneNum.textContent = `up to ${fmt(n)}`;
    halfNum.textContent = `at most ${looks}`;
    oneBar.style.width = '100%';
    halfBar.style.width = `${Math.max(100 * looks / n, 1.2)}%`;
    clear(chips).append(...steps.map((s, i) => h('li', { style: { '--i': i } }, fmt(s))));
    said.textContent = `With ${fmt(n)} names, checking one at a time can take ${fmt(n)} looks. Opening the book in the middle each time takes at most ${looks}.`;
  };
  slider.addEventListener('input', paint);
  paint();

  return h('section.race', { 'aria-labelledby': 'race-h' },
    h('p.panel-cap', 'Try it'),
    h('h2', { id: 'race-h' }, 'The halving race'),
    h('p.race-lede', 'How many names are in the phone book? Move the slider and compare two ways of finding one name.'),
    h('label.race-control', h('span', 'Names in the book'), slider, sizeOut),
    h('div.race-rows',
      h('div.race-row', h('p.race-label', 'Checking one name at a time'), h('p.race-count', oneNum, ' looks'), h('span.race-bar', oneBar)),
      h('div.race-row.is-half', h('p.race-label', 'Opening the book in the middle each time'), h('p.race-count', halfNum, ' looks'), h('span.race-bar', halfBar))),
    h('p.race-cap', 'Names still to search at each look in the middle:'),
    chips,
    said,
    h('p.race-foot', 'Each look in the middle rules out half of the names that are left. That is why making the book ten times bigger adds only three or four more looks. ',
      h('a.link', { href: lessonHref }, 'See it work in the Binary Search lesson'), '.'));
}
