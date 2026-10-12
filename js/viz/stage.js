// A stage hosts the stacked views of one frame and keeps renderers alive between frames.

import { bars, graph, grid, scene } from './canvas-renderers.js';
import { table, rows, board } from './dom-renderers.js';
import { roleKey } from './theme.js';
import { esc } from '../core/dom.js';

// Adding a renderer: implement (host, opts) => ({ update(view), destroy() }) and register it here.
export const RENDERERS = { bars, graph, grid, scene, table, rows, board };

export function createStage(host, opts = {}) {
  let slots = [];
  host.classList.add('viz-stage');
  if (opts.compact) host.classList.add('is-compact');

  function makeSlot(kind) {
    const el = document.createElement('div');
    el.className = `viz-view viz-kind-${kind}`; // not viz-${kind}: that name belongs to the renderer's own element
    const title = document.createElement('div');
    title.className = 'viz-view-title';
    const body = document.createElement('div');
    body.className = 'viz-view-body';
    const legend = document.createElement('div');
    legend.className = 'viz-legend';
    el.append(title, body, legend);
    host.append(el);
    const make = RENDERERS[kind];
    const renderer = make ? make(body, opts) : { update() { body.textContent = `Unknown view "${kind}"`; }, destroy() {} };
    return { kind, el, title, legend, renderer, legendKey: '' };
  }

  return {
    update(views) {
      views = views || [];
      if (opts.compact) views = views.slice(0, 1);
      for (let i = 0; i < views.length; i++) {
        const v = views[i];
        if (!slots[i] || slots[i].kind !== v.kind) {
          const fresh = makeSlot(v.kind);
          if (slots[i]) { slots[i].el.replaceWith(fresh.el); slots[i].renderer.destroy(); }
          slots[i] = fresh;
        }
        const s = slots[i];
        const t = opts.compact ? '' : v.title || '';
        if (s.title.textContent !== t) s.title.textContent = t;
        s.title.hidden = !t;
        const lk = opts.compact || !v.legend ? '' : JSON.stringify(v.legend);
        if (lk !== s.legendKey) {
          s.legendKey = lk;
          s.legend.innerHTML = lk ? v.legend.map((l) => `<span class="viz-legend-item"><i class="swatch sw-${l.role === 'dim' ? 'stone' : roleKey(l.role)}"${l.role === 'dim' ? ' style="opacity:.5"' : ''}></i>${esc(l.label)}</span>`).join('') : '';
        }
        s.legend.hidden = !lk;
        s.renderer.update(v);
      }
      while (slots.length > views.length) {
        const s = slots.pop();
        s.renderer.destroy();
        s.el.remove();
      }
    },
    destroy() {
      for (const s of slots) { s.renderer.destroy(); s.el.remove(); }
      slots = [];
    },
  };
}
