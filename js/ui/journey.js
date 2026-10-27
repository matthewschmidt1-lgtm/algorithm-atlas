// The journey on the page: a bar along the bottom of every stop, a card at the end of a stop
// that names the one next stop, and a trail map of the whole road. They exist so that a
// reader following a path is always carried forward, never handed a new menu to choose from.

import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { journeyAt, journeyResume } from '../core/journey.js';

const arrow = () => h('span', { html: icon('arrow', { size: 15 }) });

// A slim bar fixed to the bottom of the screen: the road as dots, where you are, the next stop.
export function mountJourneyBar(path, id) {
  const { stops, here, next, total } = journeyAt(path, id);
  if (!here) return () => {};
  const dots = h('ol.jb-dots', { 'aria-label': 'Stops on this journey' }, stops.map((s) => h('li',
    h('a', { href: s.href, class: `${s.id === id ? 'is-here' : ''} ${s.seen ? 'is-seen' : ''}`.trim(), title: `Stop ${s.n}: ${s.name}`, 'aria-label': `Stop ${s.n}: ${s.name}${s.id === id ? ', you are here' : s.seen ? ', visited' : ''}`, 'aria-current': s.id === id ? 'step' : null }))));
  const bar = h('nav.journey-bar', { 'aria-label': 'Your journey' },
    h('div.wrap.jb-inner',
      h('a.jb-map', { href: `#/path/${path.id}`, title: `The map of ${path.title}` }, h('span.jb-map-label', 'Map')),
      h('div.jb-where',
        h('p.jb-line', h('span.jb-stop', `Stop ${here.n} of ${total}`), h('span.jb-name', here.name)),
        dots),
      next ? h('a.btn.btn-primary.jb-next', { href: next.href }, h('span.jb-next-label', 'Next stop: '), h('span.jb-next-name', next.name), arrow())
        : h('a.btn.btn-primary.jb-next', { href: `#/path/${path.id}` }, h('span', 'You made it. See your map'), arrow())));
  document.body.append(bar);
  document.body.classList.add('has-journey-bar');
  return () => { bar.remove(); if (!document.querySelector('.journey-bar')) document.body.classList.remove('has-journey-bar'); };
}

// The end of a stop: what you just finished, and one button to the next stop.
export function journeyNextCard(path, id, { deeper = null } = {}) {
  const { here, next, total } = journeyAt(path, id);
  if (!here) return null;
  return h('section.journey-next', { 'aria-labelledby': 'journey-next-h' },
    h('p.panel-cap', h('span', { html: icon('check', { size: 14 }) }), ` Stop ${here.n} of ${total} complete`),
    next ? [
      h('h2', { id: 'journey-next-h' }, `Next stop: ${next.name}`),
      h('p.journey-next-why', next.why),
      h('p.journey-next-go', h('a.btn.btn-primary.btn-lg', { href: next.href }, 'Go to the next stop', arrow()),
        deeper ? h('button.link-btn', { type: 'button', onclick: deeper }, 'or stay and go deeper into this lesson') : null),
    ] : [
      h('h2', { id: 'journey-next-h' }, 'You reached the end of the road'),
      h('p.journey-next-why', `That was the last stop of ${path.title}. Every stop you visited is marked on your map.`),
      h('p.journey-next-go', h('a.btn.btn-primary.btn-lg', { href: `#/path/${path.id}` }, 'See your map', arrow())),
    ]);
}

// The whole road drawn as a winding trail. Stops sit along it in rows that turn back on
// themselves; visited stops are filled, and the next one carries a "next stop" marker.
export function createTrailMap(path, { perRow = (typeof innerWidth === 'number' && innerWidth < 640) ? 1 : 4 } = {}) {
  const { stops, resume } = journeyResume(path);
  if (!stops.length) return null;
  if (perRow === 1) return verticalTrail(path, stops, resume);
  const W = 820, padX = 90, rowH = 150, top = 70;
  const rows = Math.ceil(stops.length / perRow);
  const H = top + (rows - 1) * rowH + 90;
  const gap = perRow > 1 ? (W - 2 * padX) / (perRow - 1) : 0;
  const pos = stops.map((s, i) => {
    const r = Math.floor(i / perRow), c = i % perRow, col = r % 2 ? perRow - 1 - c : c;
    return { x: padX + col * gap, y: top + r * rowH };
  });
  // the road: straight along a row, a wide bend at each end to turn into the next row
  let d = `M${pos[0].x - 46} ${pos[0].y}L${pos[0].x} ${pos[0].y}`;
  for (let i = 1; i < pos.length; i++) {
    const a = pos[i - 1], b = pos[i];
    if (a.y === b.y) d += `L${b.x} ${b.y}`;
    else { const side = a.x > W / 2 ? 1 : -1, bulge = 70 * side; d += `C${a.x + bulge} ${a.y} ${b.x + bulge} ${b.y} ${b.x} ${b.y}`; }
  }
  const last = pos[pos.length - 1], lastRow = Math.floor((pos.length - 1) / perRow), dir = lastRow % 2 ? -1 : 1;
  d += `L${last.x + dir * 50} ${last.y}`;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); for (const k of kids) e.append(k); return e; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'trail-svg', role: 'img', 'aria-label': `A trail of ${stops.length} stops for ${path.title}` });
  svg.append(el('path', { d, class: 'trail-road' }), el('path', { d, class: 'trail-line' }));
  // a flag at the finish
  const fx = last.x + dir * 50, fy = last.y;
  svg.append(el('g', { class: 'trail-flag' }, el('path', { d: `M${fx} ${fy}v-34` }), el('path', { d: `M${fx} ${fy - 34}l${dir * 22} 7-${dir * 22} 7z`, class: 'trail-flag-cloth' })));
  let stageShown = null;
  stops.forEach((s, i) => {
    const { x, y } = pos[i], next = resume && resume.id === s.id;
    const g = el('a', { href: s.href, class: `trail-stop${s.seen ? ' is-seen' : ''}${next ? ' is-next' : ''}`, 'aria-label': `Stop ${s.n}: ${s.name}${s.seen ? ', visited' : next ? ', next stop' : ''}` });
    if (next) g.append(el('circle', { cx: x, cy: y, r: 30, class: 'trail-pulse' }));
    g.append(el('circle', { cx: x, cy: y, r: 21, class: 'trail-dot' }));
    const num = el('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'trail-num' }); num.textContent = s.seen ? '✓' : String(s.n); g.append(num);
    const name = el('text', { x, y: y + 44, 'text-anchor': 'middle', class: 'trail-name' }); name.textContent = s.name; g.append(name);
    if (next) { const tag = el('text', { x, y: y - 36, 'text-anchor': 'middle', class: 'trail-next-tag' }); tag.textContent = s.seen ? 'Here' : resumeLabel(stops, s); g.append(tag); }
    svg.append(g);
    if (s.stage.id !== stageShown) {
      stageShown = s.stage.id;
      if (!next) { const sign = el('text', { x, y: y - 34, 'text-anchor': 'middle', class: 'trail-stage' }); sign.textContent = s.stage.title; svg.append(sign); }
    }
  });
  return h('figure.trail', svg, h('figcaption.trail-key', h('span.k-seen', 'Visited'), h('span.k-next', 'Next stop'), h('span.k-ahead', 'Still ahead'), h('span', 'Choose any stop to go there.')));
}
const resumeLabel = (stops, s) => (stops.some((x) => x.seen) ? 'Next stop' : 'Start here');

// On a narrow screen the road runs straight down, with each stop's name beside it.
function verticalTrail(path, stops, resume) {
  const x = 34, step = 66, top = 34;
  let stageShown = null, y = top;
  const rows = stops.map((s) => { const sign = s.stage.id !== stageShown; stageShown = s.stage.id; if (sign && s !== stops[0]) y += 26; const row = { s, y, sign }; y += step; return row; });
  const H = y - step + 46;
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); return e; };
  const txt = (attrs, t) => { const e = el('text', attrs); e.textContent = t; return e; };
  const svg = el('svg', { viewBox: `0 0 340 ${H}`, class: 'trail-svg is-vertical', role: 'img', 'aria-label': `A trail of ${stops.length} stops for ${path.title}` });
  const d = `M${x} ${top - 20}V${rows[rows.length - 1].y + 24}`;
  svg.append(el('path', { d, class: 'trail-road' }), el('path', { d, class: 'trail-line' }));
  for (const { s, y: cy, sign } of rows) {
    if (sign) svg.append(txt({ x: x + 34, y: cy - 24, class: 'trail-stage' }, s.stage.title));
    const next = resume && resume.id === s.id;
    const g = el('a', { href: s.href, class: `trail-stop${s.seen ? ' is-seen' : ''}${next ? ' is-next' : ''}`, 'aria-label': `Stop ${s.n}: ${s.name}${s.seen ? ', visited' : next ? ', next stop' : ''}` });
    if (next) g.append(el('circle', { cx: x, cy, r: 26, class: 'trail-pulse' }));
    g.append(el('circle', { cx: x, cy, r: 18, class: 'trail-dot' }));
    g.append(txt({ x, y: cy + 5, 'text-anchor': 'middle', class: 'trail-num' }, s.seen ? '✓' : String(s.n)));
    g.append(txt({ x: x + 34, y: cy + 5, class: 'trail-name' }, s.name));
    if (next) g.append(txt({ x: x + 34, y: cy + 23, class: 'trail-next-tag' }, resumeLabel(stops, s)));
    svg.append(g);
  }
  return h('figure.trail', svg, h('figcaption.trail-key', h('span.k-seen', 'Visited'), h('span.k-next', 'Next stop'), h('span.k-ahead', 'Still ahead')));
}
