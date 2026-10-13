// The relationship map: one item at the centre, the things it is connected to around it,
// grouped by the kind of connection. Used on lesson pages (where the outer items are links)
// and on the Connections page (where choosing one re-centres the map on it).
// The same information is always printed as a list beneath the drawing.

import { h, esc } from '../core/dom.js';
import * as C from '../core/catalog.js';
import { CONNECTION_LABELS } from '../core/schema.js';

// The first seven are what a lesson says about its neighbours. The last four are how a
// neighbour's statement reads from this side (see neighbours() in core/catalog.js).
const TYPE_ORDER = ['prerequisite', 'leads-here', 'belongs', 'member', 'same-problem', 'variant', 'related', 'advanced', 'builds-on', 'application', 'applied-here'];
const TYPE_LABEL = { ...CONNECTION_LABELS, belongs: 'Belongs to', 'builds-on': 'Builds on this', 'leads-here': 'Leads to this', 'applied-here': 'Applied here', member: 'Lessons in this field' };
const TYPE_COLOR = { prerequisite: 'ink', 'leads-here': 'ink', belongs: 'forest', member: 'forest', 'same-problem': 'ochre', variant: 'moss', related: 'sage', advanced: 'terracotta', 'builds-on': 'terracotta', application: 'brick', 'applied-here': 'brick' };

function wrap(text, max = 16) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

// items: [{ ref, type, why }]
export function createRelMap(centerRef, items, { onSelect = null, map = true } = {}) {
  const center = C.resolveRef(centerRef);
  const sorted = items.slice().sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  const n = sorted.length;
  const W = 760, H = Math.max(420, Math.min(620, 300 + n * 16)), cx = W / 2, cy = H / 2;
  const rx = W / 2 - 172, ry = H / 2 - 52;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="relmap-svg" role="img" aria-label="${esc(center.name)} and the ${n} things it is connected to. The list below gives the same information.">`;
  const nodes = sorted.map((it, i) => {
    const a = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
    return { ...it, r: C.resolveRef(it.ref), x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), a };
  });
  for (const nd of nodes) {
    const col = `var(--viz-${TYPE_COLOR[nd.type] || 'sage'})`;
    const mx = cx + (nd.x - cx) * 0.5 - (nd.y - cy) * 0.06, my = cy + (nd.y - cy) * 0.5 + (nd.x - cx) * 0.06;
    svg += `<path d="M${cx} ${cy}Q${mx.toFixed(1)} ${my.toFixed(1)} ${nd.x.toFixed(1)} ${nd.y.toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.3" ${nd.r.kind === 'planned' ? 'stroke-dasharray="3 4"' : ''} opacity=".8"/>`;
  }
  svg += `<circle cx="${cx}" cy="${cy}" r="58" fill="var(--bg)" stroke="var(--text)" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="64" fill="none" stroke="var(--line-2)"/>`;
  const cl = wrap(center.name, 14);
  cl.forEach((line, i) => { svg += `<text x="${cx}" y="${cy + (i - (cl.length - 1) / 2) * 17 + 5}" text-anchor="middle" class="relmap-center">${esc(line)}</text>`; });
  nodes.forEach((nd, i) => {
    const col = `var(--viz-${TYPE_COLOR[nd.type] || 'sage'})`;
    const right = Math.cos(nd.a) >= 0;
    const lines = wrap(nd.r.name, 20);
    const shape = nd.r.kind === 'concept' ? `<rect x="${nd.x - 5}" y="${nd.y - 5}" width="10" height="10" fill="var(--bg)" stroke="${col}" stroke-width="1.6"/>`
      : nd.r.kind === 'discipline' ? `<circle cx="${nd.x}" cy="${nd.y}" r="7" fill="var(--bg)" stroke="${col}" stroke-width="1.6"/><circle cx="${nd.x}" cy="${nd.y}" r="2.4" fill="${col}"/>`
      : `<circle cx="${nd.x}" cy="${nd.y}" r="6" fill="${nd.r.kind === 'planned' ? 'var(--bg)' : col}" stroke="${col}" stroke-width="1.6"/>`;
    const tx = nd.x + (right ? 13 : -13);
    const label = lines.map((line, k) => `<text x="${tx}" y="${nd.y + 4 + (k - (lines.length - 1) / 2) * 14}" text-anchor="${right ? 'start' : 'end'}" class="relmap-label${nd.r.kind === 'planned' ? ' is-planned' : ''}">${esc(line)}</text>`).join('');
    const inner = shape + label;
    if (onSelect && nd.r.kind !== 'planned') svg += `<g class="relmap-node" tabindex="0" role="button" data-i="${i}" aria-label="${esc(nd.r.name)}: ${esc(TYPE_LABEL[nd.type] || nd.type)}">${inner}</g>`;
    else if (nd.r.href) svg += `<a href="${nd.r.href}" class="relmap-node" aria-label="${esc(nd.r.name)}: ${esc(TYPE_LABEL[nd.type] || nd.type)}">${inner}</a>`;
    else svg += `<g class="relmap-node is-static">${inner}</g>`;
  });
  svg += '</svg>';
  const figure = h('div.relmap', { html: svg });
  if (onSelect) {
    figure.addEventListener('click', (e) => { const g = e.target.closest('[data-i]'); if (g) onSelect(nodes[Number(g.dataset.i)].ref); });
    figure.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const g = e.target.closest('[data-i]'); if (g) { e.preventDefault(); onSelect(nodes[Number(g.dataset.i)].ref); } });
  }
  const used = TYPE_ORDER.filter((t) => sorted.some((s) => s.type === t));
  const key = h('div.relmap-key', used.map((t) => h('span', h('i', { style: { background: `var(--viz-${TYPE_COLOR[t]})` } }), TYPE_LABEL[t])),
    h('span.relmap-key-shapes', '● lesson', ' ', '■ concept', ' ', '◎ discipline', ' ', '○ planned'));

  // A heading such as "Go further" is a promise that there is something to go to. Lessons
  // that are planned but not written are therefore listed under their own heading, last.
  const isPlanned = (s) => C.resolveRef(s.ref).kind === 'planned';
  const ready = sorted.filter((s) => !isPlanned(s));
  const waiting = sorted.filter(isPlanned);
  const groups = TYPE_ORDER.filter((t) => ready.some((s) => s.type === t)).map((t) => h('div.rel-group', { dataset: { type: t } },
    h('h4', h('i.dot', { style: { background: `var(--viz-${TYPE_COLOR[t]})` } }), TYPE_LABEL[t]),
    h('ul', ready.filter((s) => s.type === t).map((s) => {
      const r = C.resolveRef(s.ref);
      const title = onSelect
        ? h('button.link.rel-name', { type: 'button', onclick: () => onSelect(s.ref) }, r.name)
        : h('a.link.rel-name', { href: r.href }, r.name);
      return h('li', title, r.kind === 'concept' || r.kind === 'discipline' ? h('span.ref-kind', r.kind) : null, s.why ? h('p', s.why) : null);
    }))));
  if (waiting.length) groups.push(h('div.rel-group.is-planned', { dataset: { type: 'planned' } },
    h('h4', h('i.dot.is-hollow'), 'Planned, not yet written'),
    h('ul', waiting.map((s) => h('li', h('span.rel-name.is-planned', C.resolveRef(s.ref).name), h('span.ref-kind', (TYPE_LABEL[s.type] || s.type).toLowerCase()), h('p', s.why))))));
  // map: false gives the reasons alone, for pages where the drawing would compete with the lesson.
  return h('div.relmap-wrap', map ? figure : null, map ? key : null, h('div.rel-list', groups));
}
