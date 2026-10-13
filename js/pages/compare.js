// Compare algorithms side by side. Only algorithms that solve the same or a closely
// similar problem can be compared, and only within their group. For each comparison the
// page shows the facts each lesson states about itself, results measured by running every
// algorithm on the same input in this browser, and synchronized visualizations.
// There is no overall ranking: which is "better" depends on the input and on what you need.

import { h, clear, rich, fmt } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { replaceQuery, navigate } from '../core/router.js';
import { execute } from '../core/tracer.js';
import { createPlayer } from '../viz/player.js';
import { lineChart, legend, seriesColor } from '../ui/chart.js';
import { pageHead, plural } from '../ui/parts.js';

const DIFFICULTY = { low: 'Low', moderate: 'Moderate', high: 'High' };

export default async function render({ params, query }) {
  const groups = C.compareGroups;
  if (!groups.length) {
    return { title: 'Compare', el: h('div.page.wrap.narrow', h('header.page-head', h('p.eyebrow', 'Compare'), h('h1', 'Nothing to compare yet.'), h('p.lede', 'Comparison needs at least two published lessons that solve the same problem.'))) };
  }
  const group = groups.find((g) => g.id === params.group);
  if (params.group && !group) {
    return { title: 'Comparison not found', el: h('div.page.wrap.narrow', h('header.page-head', h('p.eyebrow', 'Compare'), h('h1', 'There is no comparison at this address.'), h('p.lede', 'The link may be out of date. Comparisons exist only for problems that two or more published lessons solve.')),
      h('p', h('a.btn.btn-primary', { href: '#/compare' }, 'See all comparisons'))) };
  }
  if (!group) {
    const el = h('div.page.wrap',
      pageHead({ eyebrow: 'Compare', title: 'Compare algorithms side by side',
        lede: 'Choose a problem. You will see how the algorithms that solve it differ in idea, guarantees and cost, and you can run them on the same input.' }),
      h('div.cmp-groups', groups.map((g) => h('a.cmp-group', { href: `#/compare/${g.id}` },
        h('span.cmp-group-title', g.title), h('span.cmp-group-problem', g.problem),
        h('span.cmp-group-members', g.members.map((id) => C.algoById[id].name).join(' · '))))),
      h('p.note-box', 'Algorithms are only compared within a group, on a problem they all solve. The atlas does not rank unrelated algorithms against each other, because such rankings mean nothing.'));
    return { el, title: 'Compare' };
  }

  let ids = (query.ids || '').split(',').filter((id) => group.members.includes(id));
  if (ids.length < 2) ids = [...new Set([...ids, ...group.members])].slice(0, Math.min(3, group.members.length));
  const lessons = Object.fromEntries(await Promise.all(group.members.map(async (id) => [id, await C.loadLesson(id)])));
  let variant = group.variants.find((v) => v.id === query.variant) ? query.variant : group.variants[0].id;
  let size = Number(query.n) || group.defaultSize || (group.sizes ? group.sizes[0] : 0);
  let seed = Number(query.seed) || 7;
  const cleanups = [];
  let players = [];

  const inputFor = (id, n) => {
    const v = group.variants.find((x) => x.id === variant) || {};
    const extra = (group.perVariant && group.perVariant[id] && group.perVariant[id][variant]) || {};
    return { ...(v.input || {}), ...(group.make ? group.make(n, variant, seed) : {}), ...extra };
  };
  const previewFor = (id) => {
    const v = group.variants.find((x) => x.id === variant) || {};
    const extra = (group.perVariant && group.perVariant[id] && group.perVariant[id][variant]) || {};
    return { ...(v.input || {}), ...(group.preview ? group.preview(variant, seed) : group.make ? group.make(0, variant, seed) : {}), ...extra };
  };

  const factsHost = h('div'), measuredHost = h('div'), growthHost = h('div'), syncHost = h('div');

  /* ---- facts table ---- */
  function paintFacts() {
    const col = (fn) => ids.map((id) => h('td', fn(lessons[id])));
    const row = (label, fn) => h('tr', h('th', { scope: 'row' }, label), col(fn));
    const t = (text) => h('span', { html: rich(text) });
    clear(factsHost).append(h('div.data-table-wrap', h('table.data-table.cmp-table',
      h('thead', h('tr', h('th', ''), ids.map((id) => h('th', { scope: 'col' }, h('a.link', { href: `#/algorithm/${id}` }, lessons[id].meta.name))))),
      h('tbody',
        row('Core idea', (L) => t(L.compare.idea)),
        row('Correct when', (L) => t(L.compare.requires)),
        row('Time, best case', (L) => h('span.mono', L.meta.time.best || 'n/a')),
        row('Time, average', (L) => h('span.mono', L.meta.time.average || 'n/a')),
        row('Time, worst case', (L) => h('span.mono', L.meta.time.worst)),
        row('Space', (L) => h('span.mono', L.meta.space.worst)),
        row('Sensitivity to the input', (L) => t(L.compare.sensitivity)),
        row('Memory use', (L) => t(L.compare.memory)),
        row('Difficulty to implement', (L) => [h('strong', DIFFICULTY[L.compare.difficulty]), L.compare.difficultyNote ? [h('br'), t(L.compare.difficultyNote)] : null]),
        row('Limitations', (L) => t(L.compare.limits)),
        row('Use it when', (L) => t(L.compare.useWhen))))));
  }

  /* ---- measured on identical input ---- */
  function measureOne(id, n) {
    const input = inputFor(id, n);
    const first = execute(lessons[id], input, { record: false, raw: true });
    if (!first.ok) return { id, error: first.error };
    const times = [];
    for (let k = 0; k < 5; k++) { const t0 = performance.now(); execute(lessons[id], input, { record: false, raw: true }); times.push(performance.now() - t0); }
    times.sort((a, b) => a - b);
    return { id, counters: first.counters, result: first.result, ms: times[2] };
  }
  function paintMeasured() {
    clear(measuredHost).append(h('p.muted', 'Measuring.'));
    setTimeout(() => {
      const rows = ids.map((id) => measureOne(id, size));
      const counterKeys = [...new Set([...(group.counters || []), ...rows.flatMap((r) => Object.keys(r.counters || {}))])].filter((k) => rows.some((r) => r.counters && typeof r.counters[k] === 'number'));
      const fields = group.resultFields || [];
      const cell = (v, f) => (v === undefined || v === null ? h('span.faint', 'n/a') : f && f.percent ? `${(v * 100).toFixed(1)}%` : typeof v === 'number' ? fmt(Math.abs(v) < 1e-3 && v !== 0 ? Number(v.toExponential(2)) : Math.round(v * 1e4) / 1e4) : String(v));
      const v = group.variants.find((x) => x.id === variant);
      clear(measuredHost).append(
        h('div.data-table-wrap', h('table.data-table.cmp-table',
          h('thead', h('tr', h('th', ''), counterKeys.map((k) => h('th', k)), fields.map((f) => h('th', f.label)), h('th', 'Time on this device'))),
          h('tbody', rows.map((r) => h('tr', h('th', { scope: 'row' }, lessons[r.id].meta.name),
            r.error ? h('td', { colspan: counterKeys.length + fields.length + 1 }, `Could not run on this input: ${r.error}`)
              : [counterKeys.map((k) => h('td.mono', cell(r.counters[k]))), fields.map((f) => h('td.mono', cell(r.result ? r.result[f.key] : undefined, f))), h('td.mono', r.ms < 0.05 ? 'under 0.05 ms' : `${r.ms.toFixed(r.ms < 10 ? 2 : 1)} ms`)]))))),
        h('p.fig-cap', h('b', 'Measured here'), `Every row is a real run on the same input${group.sizes ? ` (${group.sizeLabel.toLowerCase()}: ${fmt(size)}; ${v.label.toLowerCase()}; seed ${seed})` : ` (${v.label.toLowerCase()})`}. Operation counts are exact and repeatable. The time is the median of five runs in your browser just now. It includes the cost of counting, changes from run to run and from device to device, and says little about a tuned implementation.`),
        group.note ? h('p.note-box', group.note) : null);
    }, 20);
  }

  /* ---- growth chart ---- */
  function paintGrowth() {
    clear(growthHost);
    if (!group.sizes) return;
    const metric = (group.counters || [])[0];
    const all = [...new Set(group.counters || [])];
    let current = metric;
    const draw = () => {
      const series = ids.map((id, i) => ({ label: lessons[id].meta.name, color: seriesColor(i),
        points: group.sizes.map((n) => { const r = execute(lessons[id], inputFor(id, n), { record: false, raw: true }); return [n, r.ok && typeof r.counters[current] === 'number' ? r.counters[current] : NaN]; }) }));
      const usable = series.filter((s) => s.points.some((p) => Number.isFinite(p[1])));
      chartHost.innerHTML = usable.length ? lineChart({ series: usable, xLabel: group.sizeLabel, yLabel: current.replace(/^./, (c) => c.toUpperCase()), log: logScale }) : '<p class="muted small">None of the selected algorithms reports this counter.</p>';
      clear(legendHost).append(legend(usable));
    };
    let logScale = true;
    const chartHost = h('div.chart'), legendHost = h('div');
    const metricSel = all.length > 1 ? h('label.filter', h('span.filter-label', 'Counter'), h('select', { onchange: (e) => { current = e.target.value; draw(); } }, all.map((k) => h('option', { value: k }, k)))) : null;
    const scaleBtn = h('button.btn.btn-sm', { type: 'button', 'aria-pressed': 'true', onclick: () => { logScale = !logScale; scaleBtn.setAttribute('aria-pressed', logScale ? 'true' : 'false'); scaleBtn.textContent = logScale ? 'Log scale: on' : 'Log scale: off'; draw(); } }, 'Log scale: on');
    growthHost.append(h('figure.experiment',
      h('div.chart-tools', h('h3.experiment-title', 'How the work grows with the input'), h('div', { style: { display: 'flex', gap: '10px', alignItems: 'end' } }, metricSel, scaleBtn)),
      chartHost, legendHost,
      h('figcaption.fig-cap', h('b', 'Measured here'), 'Each point is a real run at that size on the selected kind of input. A log scale makes very different growth rates visible on one chart.')));
    setTimeout(draw, 30);
  }

  /* ---- synchronized visualizations ---- */
  function paintSync() {
    players.forEach((p) => p.destroy()); players = [];
    clear(syncHost);
    const stepLabel = h('span.step-label', { 'aria-live': 'polite' });
    let timer = null;
    const cards = ids.map((id) => {
      const p = createPlayer(lessons[id], { compact: true, input: previewFor(id) });
      players.push(p);
      const mine = h('span.cmp-steps');
      const note = h('p.cmp-note');
      const sync = () => { const n = p.run && p.run.frames ? p.run.frames.length : 0; mine.textContent = n ? `Step ${p.index + 1} of ${n}${p.index >= n - 1 ? ' · finished' : ''}` : 'Could not run'; const f = n ? p.run.frames[p.index] : null; note.textContent = f ? String(f.note).replace(/\*\*|`/g, '') : (p.run && p.run.error) || ''; };
      p.on('frame', sync); sync();
      return h('div.cmp-card', h('div.cmp-card-head', h('h3', h('a', { href: `#/algorithm/${id}` }, lessons[id].meta.name)), mine), p.parts.stage, p.parts.error, note);
    });
    const maxLen = () => Math.max(1, ...players.map((p) => (p.run && p.run.frames ? p.run.frames.length : 1)));
    let at = 0;
    const seekAll = (i) => { at = Math.max(0, Math.min(maxLen() - 1, i)); players.forEach((p) => p.seek(at)); stepLabel.textContent = `Shared step ${at + 1} of ${maxLen()}`; playBtn.innerHTML = icon(timer ? 'pause' : at >= maxLen() - 1 ? 'reset' : 'play'); };
    const stop = () => { clearInterval(timer); timer = null; seekAll(at); };
    const playBtn = h('button.icon-btn.is-primary', { type: 'button', 'aria-label': 'Play or pause all', onclick: () => {
      if (timer) return stop();
      if (at >= maxLen() - 1) at = 0;
      const per = Math.max(30, Math.min(260, 9000 / maxLen()));
      timer = setInterval(() => { if (at >= maxLen() - 1) return stop(); seekAll(at + 1); }, per);
      seekAll(at);
    } });
    cleanups.push(() => clearInterval(timer));
    syncHost.append(
      h('div.transport.cmp-transport', { role: 'group', 'aria-label': 'Shared playback controls' },
        h('div.transport-buttons',
          h('button.icon-btn', { type: 'button', 'aria-label': 'Reset all', html: icon('reset'), onclick: () => { stop(); seekAll(0); } }),
          h('button.icon-btn', { type: 'button', 'aria-label': 'Step all backward', html: icon('stepBack'), onclick: () => { stop(); seekAll(at - 1); } }),
          playBtn,
          h('button.icon-btn', { type: 'button', 'aria-label': 'Step all forward', html: icon('stepFwd'), onclick: () => { stop(); seekAll(at + 1); } })),
        stepLabel),
      h('p.player-keys.cmp-keys', h('kbd', '←'), ' ', h('kbd', '→'), ' step every panel back and forward.'),
      h('div.cmp-cards', { style: { '--n': ids.length } }, cards),
      h('p.fig-cap', h('b', 'Read this carefully'), 'All panels advance one recorded step at a time, on a small version of the same input. A "step" is whatever each lesson chose to show, so the panels are aligned by step number, not by time or by work done. Use the table above for cost.'));
    seekAll(0);
    // The arrow keys step all panels together while they are on screen, as on a lesson.
    if (syncHost.onKey) document.removeEventListener('keydown', syncHost.onKey);
    syncHost.onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [role="radiogroup"], [role="tablist"], [role="listbox"], [role="combobox"], dialog[open], .settings-panel')) return;
      const r = syncHost.getBoundingClientRect();
      if (!syncHost.isConnected || r.bottom < 120 || r.top > window.innerHeight - 120) return;
      e.preventDefault();
      stop(); seekAll(at + (e.key === 'ArrowRight' ? 1 : -1));
    };
    document.addEventListener('keydown', syncHost.onKey);
    cleanups.push(() => document.removeEventListener('keydown', syncHost.onKey));
  }

  /* ---- controls ---- */
  const memberBox = h('div.cmp-members', { role: 'group', 'aria-label': 'Algorithms to compare' },
    group.members.map((id) => h('label.choice', h('input', { type: 'checkbox', checked: ids.includes(id), onchange: (e) => {
      if (e.target.checked) ids = group.members.filter((m) => ids.includes(m) || m === id);
      else if (ids.length > 2) ids = ids.filter((m) => m !== id); else { e.target.checked = true; return; }
      update();
    } }), h('span.choice-body', h('span.choice-label', C.algoById[id].name)))));
  const variantSel = h('select', { onchange: (e) => { variant = e.target.value; update(); } }, group.variants.map((v) => h('option', { value: v.id, selected: v.id === variant }, v.label)));
  const sizeSel = group.sizes ? h('select', { onchange: (e) => { size = Number(e.target.value); update(); } }, group.sizes.map((n) => h('option', { value: n, selected: n === size }, fmt(n)))) : null;
  const seedBtn = h('button.btn.btn-sm', { type: 'button', html: `${icon('dice', { size: 15 })}<span>New random input</span>`, onclick: () => { seed = 1 + Math.floor(Math.random() * 9999); update(); } });

  function update() {
    replaceQuery({ ids: ids.join(','), variant, n: group.sizes ? size : '', seed: seed === 7 ? '' : seed });
    paintFacts(); paintMeasured(); paintGrowth(); paintSync();
  }

  const el = h('div.page.wrap',
    pageHead({ crumbsList: [{ label: 'Interactive Lab', href: '#/lab' }, { label: 'Compare', href: '#/compare' }, { label: group.title }], eyebrow: 'Compare', title: group.title, lede: group.problem }),
    h('div.cmp-controls',
      h('div', h('p.filter-label', 'Algorithms (at least two)'), memberBox),
      h('div.cmp-controls-row',
        h('label.filter', h('span.filter-label', 'Kind of input'), variantSel),
        sizeSel ? h('label.filter', h('span.filter-label', group.sizeLabel), sizeSel) : null,
        seedBtn,
        h('label.filter', h('span.filter-label', 'Other problems'), h('select', { onchange: (e) => navigate(`#/compare/${e.target.value}`) }, groups.map((g) => h('option', { value: g.id, selected: g.id === group.id }, g.title)))))),
    h('section.cmp-sec', h('h2', 'What each one claims'), h('p.muted', 'Taken from each lesson. Follow a name to read the reasoning.'), factsHost),
    h('section.cmp-sec', h('h2', 'Measured on the same input'), measuredHost, growthHost),
    h('section.cmp-sec', h('h2', 'Watch them together'), syncHost));
  update();
  return { el, title: `Compare: ${group.title}`, destroy() { players.forEach((p) => p.destroy()); cleanups.forEach((fn) => fn()); } };
}
