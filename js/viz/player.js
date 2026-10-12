// The step-by-step player. It executes an algorithm module's real implementation,
// keeps the recorded frames, and exposes its parts so pages can lay them out differently
// (lesson, laboratory, compare, home previews).

import { h, clear, rich, renderMath, debounce, fmt, nextId, prefersReducedMotion } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { execute, defaultInput } from '../core/tracer.js';
import { createStage } from './stage.js';

const SPEEDS = [1, 2, 4, 8, 15, 30, 60, 120];

export function createPlayer(algo, opts = {}) {
  const compact = !!opts.compact;
  const state = {
    input: { ...defaultInput(algo), ...(opts.input || {}) },
    run: null,
    i: 0,
    playing: false,
    speedIdx: 3,
    userSpeed: false,
  };
  const listeners = { frame: [], run: [], input: [] };
  const emit = (ev, ...a) => listeners[ev].forEach((fn) => fn(...a));

  /* ---- parts ---- */
  const stageEl = h('div.player-stage', { role: 'img', 'aria-label': algo.viz.describe || `${algo.meta.name} visualization` });
  const stage = createStage(stageEl, {
    compact,
    onCell: (idx, view) => {
      const field = typeof view.editable === 'string' ? view.editable : 'toggles';
      const cur = Array.isArray(state.input[field]) ? state.input[field].slice() : [];
      const at = cur.indexOf(idx);
      if (at >= 0) cur.splice(at, 1); else cur.push(idx);
      setInput({ [field]: cur });
    },
  });
  const errorEl = h('div.player-error', { role: 'alert', hidden: true });

  const btn = (name, label, onclick, extra = '') =>
    h(`button.icon-btn${extra}`, { type: 'button', 'aria-label': label, title: label, html: icon(name), onclick });
  const resetBtn = btn('reset', 'Reset to the first step', () => { pause(); seek(0); });
  const backBtn = btn('stepBack', 'Step backward', () => { pause(); step(-1); });
  const playBtn = btn('play', 'Play', () => toggle(), '.is-primary');
  const fwdBtn = btn('stepFwd', 'Step forward', () => { pause(); step(1); });
  const scrubId = nextId('scrub');
  const scrub = h('input.scrub', { id: scrubId, type: 'range', min: 0, max: 0, value: 0, step: 1, 'aria-label': 'Position in the run',
    oninput: (e) => { pause(); seek(Number(e.target.value)); } });
  const stepLabel = h('span.step-label', { 'aria-hidden': 'true' }, 'Step 0 / 0');
  const speedId = nextId('speed');
  const speedOut = h('span.speed-out', '8 steps/s');
  const speed = h('input.speed', { id: speedId, type: 'range', min: 0, max: SPEEDS.length - 1, step: 1, value: state.speedIdx, 'aria-label': 'Execution speed',
    oninput: (e) => { state.speedIdx = Number(e.target.value); state.userSpeed = true; speedOut.textContent = `${SPEEDS[state.speedIdx]} steps/s`; } });
  const transport = h('div.transport', { role: 'group', 'aria-label': 'Playback controls' },
    h('div.transport-buttons', resetBtn, backBtn, playBtn, fwdBtn),
    scrub, stepLabel,
    compact ? null : h('label.speed-wrap', { for: speedId }, h('span.speed-cap', 'Speed'), speed, speedOut));

  const noteEl = h('div.player-note', { 'aria-live': 'polite' });
  const stateEl = h('div.player-state');
  const inputsEl = h('form.inputs', { onsubmit: (e) => e.preventDefault(), 'aria-label': 'Inputs and parameters' });
  const pseudoEl = h('ol.pseudo', { 'aria-label': 'Pseudocode' });
  const pseudoLines = (algo.logic && algo.logic.pseudocode) || [];
  pseudoLines.forEach((line) => {
    const indent = line.match(/^\s*/)[0].length;
    pseudoEl.append(h('li', { style: { paddingLeft: `${indent * 0.55 + 0.6}em` } }, h('code', line.trim())));
  });

  /* ---- run + render ---- */
  function run() {
    pause();
    const res = execute(algo, state.input, { maxFrames: opts.maxFrames });
    state.run = res;
    state.i = 0;
    if (!res.ok || !res.frames.length) {
      errorEl.hidden = false;
      errorEl.textContent = res.ok ? 'This input produced no steps to show.' : res.error;
    } else {
      errorEl.hidden = true;
      if (!state.userSpeed) {
        const want = res.frames.length / 14;
        let idx = SPEEDS.findIndex((s) => s >= want);
        if (idx < 0) idx = SPEEDS.length - 1;
        state.speedIdx = Math.max(1, Math.min(6, idx));
        speed.value = state.speedIdx;
        speedOut.textContent = `${SPEEDS[state.speedIdx]} steps/s`;
      }
    }
    scrub.max = Math.max(0, (res.frames || []).length - 1);
    render();
    emit('run', res);
  }

  function render() {
    const frames = (state.run && state.run.frames) || [];
    const n = frames.length;
    const f = frames[state.i];
    const atEnd = n > 0 && state.i >= n - 1;
    scrub.value = state.i;
    scrub.setAttribute('aria-valuetext', n ? `Step ${state.i + 1} of ${n}` : 'No steps');
    stepLabel.textContent = n ? `Step ${state.i + 1} / ${n}` : 'No steps';
    backBtn.disabled = resetBtn.disabled = state.i === 0;
    fwdBtn.disabled = atEnd || !n;
    playBtn.disabled = !n;
    const playLabel = state.playing ? 'Pause' : atEnd ? 'Replay from the start' : 'Play';
    playBtn.innerHTML = icon(state.playing ? 'pause' : atEnd ? 'reset' : 'play');
    playBtn.setAttribute('aria-label', playLabel);
    playBtn.title = playLabel;
    if (!f) { stage.update([]); clear(noteEl); clear(stateEl); return; }
    stage.update(f.views);
    // Announce steps to screen readers only when stepping by hand; during playback they arrive too fast to be useful.
    noteEl.setAttribute('aria-live', state.playing ? 'off' : 'polite');
    noteEl.innerHTML = `<span class="note-step">${state.i + 1}</span><span class="note-text">${rich(f.note || '')}</span>`;
    renderMath(noteEl);
    if (!compact) {
      const chips = [];
      for (const [k, v] of Object.entries(f.vars || {})) chips.push(`<span class="chip chip-var"><b>${rich(k)}</b>${rich(String(v))}</span>`);
      for (const [k, v] of Object.entries(f.counters || {})) chips.push(`<span class="chip chip-count"><b>${rich(k)}</b>${fmt(v)}</span>`);
      stateEl.innerHTML = chips.join('');
      const active = new Set(Array.isArray(f.line) ? f.line : f.line === null || f.line === undefined ? [] : [f.line]);
      let first = null;
      [...pseudoEl.children].forEach((li, idx) => {
        const on = active.has(idx);
        li.classList.toggle('is-active', on);
        if (on && !first) first = li;
      });
      if (first && pseudoEl.scrollHeight > pseudoEl.clientHeight) {
        const top = first.offsetTop - pseudoEl.clientHeight / 2;
        pseudoEl.scrollTop = Math.max(0, top);
      }
    }
    emit('frame', f, state.i, n);
  }

  function seek(i) {
    const n = ((state.run && state.run.frames) || []).length;
    state.i = Math.max(0, Math.min(n - 1, i));
    render();
  }
  function step(d) { seek(state.i + d); }

  let raf = 0, lastT = 0, acc = 0;
  function loop(t) {
    if (!state.playing) return;
    const dt = Math.min(0.25, (t - lastT) / 1000);
    lastT = t;
    acc += dt * SPEEDS[state.speedIdx];
    const adv = Math.floor(acc);
    if (adv > 0) {
      acc -= adv;
      const n = state.run.frames.length;
      state.i = Math.min(n - 1, state.i + adv);
      if (state.i >= n - 1) { state.playing = false; render(); return; }
      render();
    }
    raf = requestAnimationFrame(loop);
  }
  function play() {
    const n = ((state.run && state.run.frames) || []).length;
    if (!n || state.playing) return;
    if (state.i >= n - 1) state.i = 0;
    state.playing = true;
    lastT = performance.now(); acc = 0;
    render();
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    if (!state.playing) return;
    state.playing = false;
    cancelAnimationFrame(raf);
    render();
  }
  function toggle() { state.playing ? pause() : play(); }

  /* ---- inputs ---- */
  const rerunSoon = debounce(run, 110);
  function setInput(partial, { silent = false } = {}) {
    Object.assign(state.input, partial);
    if (!silent) buildInputs();
    run();
    emit('input', state.input);
  }

  function buildInputs() {
    clear(inputsEl);
    const fields = algo.viz.inputs || [];
    if (algo.viz.presets && algo.viz.presets.length) {
      inputsEl.append(h('div.presets', { role: 'group', 'aria-label': 'Presets' },
        h('span.field-label', 'Presets'),
        h('div.preset-row', algo.viz.presets.map((p) => h('button.btn.btn-sm', { type: 'button', onclick: () => setInput({ ...p.values }) }, p.label)))));
    }
    for (const f of fields) {
      const id = nextId('in');
      const val = state.input[f.id];
      let control, extra = null;
      const set = (v, soon) => { state.input[f.id] = v; soon ? rerunSoon() : run(); emit('input', state.input); };
      if (f.type === 'range') {
        const out = h('output.range-out', { for: id }, fmt(val));
        if (f.scale === 'log') {
          // logarithmic slider: the control moves in log10 space, the value stays in real units
          const sig = (x) => Number(x.toPrecision(2));
          control = h('input', { id, type: 'range', min: Math.log10(f.min), max: Math.log10(f.max), step: 0.01, value: Math.log10(val),
            'aria-valuetext': fmt(val),
            oninput: (e) => { const x = sig(Math.pow(10, Number(e.target.value))); out.textContent = fmt(x); e.target.setAttribute('aria-valuetext', fmt(x)); set(x, true); } });
        } else {
          control = h('input', { id, type: 'range', min: f.min, max: f.max, step: f.step ?? 1, value: val,
            oninput: (e) => { out.textContent = fmt(Number(e.target.value)); set(Number(e.target.value), true); } });
        }
        extra = out;
      } else if (f.type === 'select') {
        control = h('select', { id, onchange: (e) => set(e.target.value) },
          f.options.map((o) => h('option', { value: o.value, selected: o.value === val }, o.label)));
      } else if (f.type === 'seed' || f.type === 'number') {
        control = h('div.seed-row',
          h('input', { id, type: 'number', value: val, min: f.min, max: f.max, step: f.step ?? 1, inputmode: 'numeric',
            onchange: (e) => set(Number(e.target.value)) }),
          f.type === 'seed' ? h('button.btn.btn-sm', { type: 'button', html: `${icon('dice', { size: 15 })}<span>Randomize</span>`,
            onclick: () => setInput({ [f.id]: 1 + Math.floor(Math.random() * 9999) }) }) : null);
      } else if (f.type === 'list') {
        control = h('input', { id, type: 'text', value: (val || []).join(', '), placeholder: f.placeholder || 'e.g. 5, 2, 9, 1', autocomplete: 'off', spellcheck: 'false',
          onchange: (e) => set(e.target.value) });
      } else if (f.type === 'text') {
        const multi = (f.maxLength || 0) > 80;
        control = h(multi ? 'textarea' : 'input', { id, ...(multi ? { rows: 2 } : { type: 'text', value: val }), maxlength: f.maxLength, placeholder: f.placeholder || '', autocomplete: 'off', spellcheck: 'false',
          onchange: (e) => set(e.target.value) });
        if (multi) control.value = val;
      } else if (f.type === 'toggle') {
        const state = h('span.switch-text', val ? (f.onLabel || 'On') : (f.offLabel || 'Off'));
        control = h('label.switch', h('input', { id, type: 'checkbox', checked: !!val, onchange: (e) => { state.textContent = e.target.checked ? (f.onLabel || 'On') : (f.offLabel || 'Off'); set(e.target.checked); } }), h('span.switch-track'), state);
      } else if (f.type === 'cells') {
        const count = (val || []).length;
        control = h('div.cells-row',
          h('span.cells-count', count ? `${count} cell${count === 1 ? '' : 's'} edited` : 'No edits yet'),
          h('button.btn.btn-sm', { type: 'button', disabled: !count, onclick: () => setInput({ [f.id]: [] }) }, 'Clear edits'));
      } else continue;
      inputsEl.append(h('div.field', { class: `field-${f.type}` },
        h('div.field-head', h('label.field-label', { for: id }, f.label), extra),
        control,
        f.help ? h('p.field-help', f.help) : null));
    }
  }

  /* ---- keyboard ---- */
  function onKey(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' && e.target.type !== 'range' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'INPUT') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' && tag !== 'INPUT') { e.preventDefault(); pause(); step(1); }
    else if (e.key === 'ArrowLeft' && tag !== 'INPUT') { e.preventDefault(); pause(); step(-1); }
    else if (e.key === 'Home' && tag !== 'INPUT') { e.preventDefault(); pause(); seek(0); }
  }

  // pause automatically when the stage scrolls out of view
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => { if (!entries[0].isIntersecting) pause(); });
    io.observe(stageEl);
  }

  buildInputs();
  run();
  if (opts.autoplay && !prefersReducedMotion()) play();

  return {
    parts: { stage: stageEl, error: errorEl, transport, note: noteEl, state: stateEl, inputs: inputsEl, pseudo: pseudoEl },
    bindKeys(root) { root.addEventListener('keydown', onKey); },
    on(ev, fn) { listeners[ev].push(fn); return this; },
    get run() { return state.run; },
    get index() { return state.i; },
    get input() { return state.input; },
    get playing() { return state.playing; },
    setInput, play, pause, toggle, step, seek,
    reset() { pause(); seek(0); },
    destroy() { pause(); if (io) io.disconnect(); stage.destroy(); },
  };
}

// Default assembly used by lessons: stage and controls on the left, live pseudocode on the right.
export function assemblePlayer(player, { pseudo = true } = {}) {
  const p = player.parts;
  const root = h('div.player', { tabindex: '-1' },
    h('div.player-main', p.stage, p.error, p.transport, p.note, p.state),
    pseudo && p.pseudo.children.length ? h('aside.player-side', h('div.panel-cap', 'Pseudocode, live'), p.pseudo) : null);
  if (!pseudo || !p.pseudo.children.length) root.classList.add('no-side');
  player.bindKeys(root);
  return root;
}
