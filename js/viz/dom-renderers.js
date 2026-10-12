// DOM renderers for text-heavy views: table, rows, board. HTML keeps them readable,
// responsive and available to assistive technology without extra description.

import { esc } from '../core/dom.js';
import { roleKey } from './theme.js';

const cls = (role) => (role && role !== 'default' && role !== 'empty' ? ` role-${roleKey(role)}` : '');
const show = (v) => (v === null || v === undefined ? '' : esc(v));

function domRenderer(className, html) {
  return (host, opts = {}) => {
    const el = document.createElement('div');
    el.className = className + (opts.compact ? ' is-compact' : '');
    host.append(el);
    return {
      update(view) { el.innerHTML = html(view, opts); },
      destroy() { el.remove(); },
    };
  };
}

// { kind:'table', colLabels, rowLabels, cells:[[...]], roles:{'r,c':role}, corner }
export const table = domRenderer('viz-table-wrap', (v) => {
  const roles = v.roles || {};
  let out = '<table class="viz-table"><thead><tr>';
  if (v.rowLabels) out += `<th class="corner">${show(v.corner)}</th>`;
  for (const c of v.colLabels || []) out += `<th scope="col">${show(c)}</th>`;
  out += '</tr></thead><tbody>';
  (v.cells || []).forEach((row, r) => {
    out += '<tr>';
    if (v.rowLabels) out += `<th scope="row">${show(v.rowLabels[r])}</th>`;
    row.forEach((cell, c) => { out += `<td class="${cls(roles[`${r},${c}`]).trim()}">${show(cell)}</td>`; });
    out += '</tr>';
  });
  return out + '</tbody></table>';
});

// { kind:'rows', rows:[{ label, cells:[{ t, role, sub }] }] }
export const rows = domRenderer('viz-rows', (v) =>
  (v.rows || []).map((row) => {
    const cells = (row.cells || []).map((c) => {
      const cell = typeof c === 'object' && c !== null ? c : { t: c };
      return `<span class="viz-cell${cls(cell.role)}"><span class="viz-cell-t">${show(cell.t)}</span>${cell.sub !== undefined ? `<span class="viz-cell-sub">${show(cell.sub)}</span>` : ''}</span>`;
    }).join('');
    return `<div class="viz-row"><span class="viz-row-label">${show(row.label)}</span><span class="viz-row-cells">${cells || '<span class="viz-row-empty">empty</span>'}</span></div>`;
  }).join(''));

// { kind:'board', columns:[{ title, role, items:[{ label, value, role, note }] }] }
export const board = domRenderer('viz-board', (v) =>
  (v.columns || []).map((col) => {
    const items = (col.items || []).map((it) =>
      `<div class="viz-item${cls(it.role)}"><span class="viz-item-label">${show(it.label)}</span><span class="viz-item-value">${show(it.value)}</span>${it.note ? `<span class="viz-item-note">${show(it.note)}</span>` : ''}</div>`).join('');
    return `<div class="viz-col${cls(col.role)}"><div class="viz-col-title">${show(col.title)}</div>${items || '<div class="viz-item is-empty">nothing yet</div>'}</div>`;
  }).join(''));
