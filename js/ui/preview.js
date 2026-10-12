// A small live demonstration of one lesson, used on the home page and discipline pages.
// The lesson module is fetched only when the preview scrolls near the viewport, and the
// picture is the lesson's real implementation running on the given input.

import { h, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { createPlayer } from '../viz/player.js';

export function createPreview({ id, line, input = {} }, index = 0) {
  const a = C.algoById[id];
  const stageHost = h('div.preview-stage', h('div.preview-wait', { 'aria-hidden': 'true' }));
  const note = h('p.preview-note', { 'aria-live': 'off' });
  const stepLabel = h('span.preview-step');
  const runBtn = h('button.btn.btn-sm', { type: 'button', disabled: true, html: `${icon('play', { size: 14 })}<span>Run demonstration</span>` });
  let player = null, destroyed = false;

  const sync = () => {
    if (!player || !player.run) return;
    const n = player.run.frames.length, i = player.index;
    const atEnd = n > 0 && i >= n - 1;
    runBtn.innerHTML = player.playing ? `${icon('pause', { size: 14 })}<span>Pause</span>` : atEnd ? `${icon('reset', { size: 14 })}<span>Run again</span>` : `${icon('play', { size: 14 })}<span>${i > 0 ? 'Continue' : 'Run demonstration'}</span>`;
    stepLabel.textContent = n ? `Step ${i + 1} of ${n}` : '';
    const f = player.run.frames[i];
    note.textContent = f ? String(f.note).replace(/\*\*|`/g, '') : '';
  };

  async function load() {
    try {
      const lesson = await C.loadLesson(id);
      if (destroyed) return;
      player = createPlayer(lesson, { compact: true, input });
      clear(stageHost).append(player.parts.stage, player.parts.error);
      player.on('frame', sync);
      runBtn.disabled = false;
      runBtn.addEventListener('click', () => { player.toggle(); sync(); });
      sync();
    } catch (e) {
      clear(stageHost).append(h('p.preview-fail', 'This demonstration could not be loaded.'));
    }
  }
  const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '300px' });
  io.observe(stageHost);

  const el = h(`article.preview.c-${C.colorOf(a.discipline)}`,
    h('figure.preview-figure', { role: 'group', 'aria-label': `${a.name}: ${a.describe}` }, stageHost),
    h('div.preview-text',
      h('p.preview-no', `Fig. ${index + 1}`, h('span', C.disciplineById[a.discipline].short)),
      h('h3', h('a', { href: `#/algorithm/${a.id}` }, a.name)),
      h('p.preview-line', line || a.summary),
      note,
      h('div.preview-actions', runBtn, stepLabel, h('a.text-link', { href: `#/algorithm/${a.id}` }, 'Open the lesson', h('span', { html: icon('arrow', { size: 14 }) })))));

  return { el, destroy() { destroyed = true; io.disconnect(); if (player) player.destroy(); } };
}
