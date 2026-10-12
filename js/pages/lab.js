// The Interactive Lab: a workbench for running any published algorithm with your own
// inputs. The bench is assembled from the same player the lessons use, laid out so that
// the picture, the controls, the pseudocode, the source, the event log and the output
// are all visible at once. A lesson joins a bench by its meta.lab category; nothing here
// is written per algorithm.

import { h, clear, rich, fmt } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { navigate } from '../core/router.js';
import { createPlayer } from '../viz/player.js';
import { createCodePanel } from '../ui/code.js';
import { createExperimentChart } from '../ui/chart.js';
import { levelGlyph, plural } from '../ui/parts.js';

export default async function render({ params }) {
  const byCat = (id) => C.algos.filter((a) => a.lab === id).sort((a, b) => a.order - b.order);
  const firstCat = C.labCategories.find((c) => byCat(c.id).length);
  const meta = (params.id && C.algoById[params.id]) || (firstCat ? byCat(firstCat.id)[0] : null);
  if (!meta) {
    return { title: 'Interactive Lab', el: h('div.page.wrap.narrow', h('header.page-head', h('p.eyebrow', 'Interactive Lab'), h('h1', 'The laboratory is empty.'), h('p.lede', 'No lessons with demonstrations are published yet.'))) };
  }
  const L = await C.loadLesson(meta.id);
  const cat = C.labById[meta.lab];
  const inCat = byCat(meta.lab);
  const cleanups = [];

  const player = createPlayer(L);
  cleanups.push(() => player.destroy());
  const P = player.parts;

  /* ---- benches (categories) ---- */
  const benches = h('nav.lab-benches', { 'aria-label': 'Laboratory benches' },
    h('p.panel-cap', 'Benches'),
    h('ul', C.labCategories.map((c, i) => {
      const list = byCat(c.id);
      const label = [h('span.bench-no', String(i + 1).padStart(2, '0')), h('span.bench-name', c.name), h('span.bench-count', list.length ? String(list.length) : 'planned')];
      return h('li', list.length
        ? h('a.bench', { href: `#/lab/${list[0].id}`, 'aria-current': c.id === meta.lab ? 'true' : null }, label)
        : h('span.bench.is-empty', { title: 'No demonstrations published on this bench yet' }, label));
    })));

  /* ---- algorithm selector ---- */
  const select = h('select.lab-select', { 'aria-label': 'Algorithm', onchange: (e) => navigate(`#/lab/${e.target.value}`) },
    C.labCategories.filter((c) => byCat(c.id).length).map((c) => h('optgroup', { label: c.name }, byCat(c.id).map((a) => h('option', { value: a.id, selected: a.id === meta.id }, a.name)))));
  const siblings = h('div.lab-siblings', { role: 'group', 'aria-label': `Other algorithms on the ${cat.name} bench` },
    inCat.map((a) => h('a.lab-sib', { href: `#/lab/${a.id}`, 'aria-current': a.id === meta.id ? 'true' : null }, a.name)));

  /* ---- right panel tabs ---- */
  const panelBody = h('div.lab-panel-body');
  let codePanel = null, chart = null;
  const panels = {
    pseudo: () => [h('p.small.muted', 'The highlighted line is the one being carried out at the current step.'), P.pseudo],
    source: () => { if (!codePanel) codePanel = createCodePanel(L, { compact: true }); return [codePanel.el]; },
    perf: () => {
      if (!L.viz.experiment) return [h('p.muted', 'This lesson does not define a size experiment. Its cost is described under Complexity.')];
      if (!chart) { chart = createExperimentChart(L); cleanups.push(() => chart.destroy()); }
      return [chart.el];
    },
    cost: () => [
      h('p', { html: rich(L.complexity.summary) }),
      h('div.data-table-wrap', h('table.data-table', h('thead', h('tr', h('th', 'Case'), h('th', 'Time'), h('th', 'When'))),
        h('tbody', L.complexity.cases.map((c) => h('tr', h('th', c.case), h('td.mono', c.time), h('td', { html: rich(c.when) })))))),
      h('p.small', h('strong', 'Memory. '), h('span', { html: rich(L.complexity.space) })),
      h('p.panel-cap', { style: { marginTop: '12px' } }, 'These bounds assume'),
      h('ul.prose-list', L.complexity.assumptions.map((t) => h('li', { html: rich(t) }))),
    ],
  };
  const tabDefs = [['pseudo', 'Pseudocode'], ['source', 'Source'], ['perf', 'Performance'], ['cost', 'Complexity']];
  const tabBtns = tabDefs.map(([id, label]) => h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => showTab(id) }, label));
  function showTab(id) {
    tabBtns.forEach((b, i) => b.setAttribute('aria-selected', tabDefs[i][0] === id ? 'true' : 'false'));
    clear(panelBody).append(...panels[id]());
  }

  /* ---- event log and output ---- */
  const log = h('ol.lab-log', { 'aria-label': 'Event log' });
  const output = h('pre.lab-output', { 'aria-live': 'polite' });
  const counters = h('div.lab-counters');
  let logItems = [];
  function buildLog(res) {
    clear(log); logItems = [];
    if (!res || !res.ok) { output.textContent = res ? res.error : ''; return; }
    const frames = res.frames;
    frames.forEach((f, i) => {
      const li = h('li', h('button', { type: 'button', onclick: () => { player.pause(); player.seek(i); } }, h('span.log-no', String(i + 1)), h('span.log-text', String(f.note).replace(/\*\*|`/g, ''))));
      logItems.push(li); log.append(li);
    });
    let text = '';
    try { text = typeof L.viz.report === 'function' ? L.viz.report(res.result, res.counters, res.input) : JSON.stringify(res.result, null, 1).slice(0, 1200); } catch { text = ''; }
    if (res.truncated) text += `\n\nThe trace stops at ${frames.length} steps. Counts are for the full run.`;
    output.textContent = text;
    clear(counters).append(...Object.entries(res.counters).map(([k, v]) => h('span.chip.chip-count', h('b', k), fmt(v))));
  }
  let lastActive = -1;
  function markLog(i) {
    if (lastActive >= 0 && logItems[lastActive]) logItems[lastActive].classList.remove('is-current');
    logItems.forEach((li, k) => { if ((k > i) !== li.classList.contains('is-future')) li.classList.toggle('is-future', k > i); });
    const cur = logItems[i];
    if (cur) { cur.classList.add('is-current'); const top = cur.offsetTop - log.clientHeight / 2; log.scrollTop = Math.max(0, top); }
    lastActive = i;
  }
  player.on('run', (res) => { buildLog(res); markLog(0); });
  player.on('frame', (f, i) => markLog(i));
  buildLog(player.run); markLog(player.index);

  const bench = h('div.lab-bench', { tabindex: '-1' },
    h('div.lab-col.lab-left',
      h('div.lab-card', h('p.panel-cap', 'Algorithm'), select, siblings,
        h('p.lab-summary', meta.summary),
        h('p.lab-meta', levelGlyph(meta.difficulty, true), h('span.mono', meta.time.worst)),
        h('p', h('a.text-link', { href: `#/algorithm/${meta.id}` }, 'Read the full lesson', h('span', { html: icon('arrow', { size: 14 }) })))),
      h('div.lab-card', h('p.panel-cap', 'Inputs and parameters'), P.inputs)),
    h('div.lab-col.lab-centre',
      h('div.lab-card.lab-stage', h('p.panel-cap', 'Visualization'), P.stage, P.error, P.transport, P.note, P.state,
        h('p.small.faint.lab-describe', L.viz.describe)),
      h('div.lab-row',
        h('div.lab-card', h('p.panel-cap', 'Event log'), h('p.small.faint', 'Every step of this run. Choose one to jump to it.'), log),
        h('div.lab-card', h('p.panel-cap', 'Output'), output, counters))),
    h('div.lab-col.lab-right',
      h('div.lab-card', h('div.tabs', { role: 'tablist', 'aria-label': 'Views of the algorithm' }, tabBtns), panelBody)));
  player.bindKeys(bench);
  showTab('pseudo');

  const el = h('div.lab.page',
    h('div.wrap',
      h('header.lab-head',
        h('div', h('p.eyebrow', 'Interactive Lab'), h('h1', 'The laboratory'),
          h('p.lede', 'Run any published algorithm on inputs of your choosing. Change a parameter and the algorithm runs again, for real, from the beginning.')),
        h('div.lab-head-side',
          h('p', h('strong', `Bench ${String(C.labCategories.indexOf(cat) + 1).padStart(2, '0')}. ${cat.name}. `), cat.blurb),
          h('p.small.muted', `${plural(C.algos.length, 'demonstration')} across ${C.labCategories.filter((c) => byCat(c.id).length).length} of ${C.labCategories.length} benches.`),
          h('p', h('a.text-link', { href: '#/compare' }, 'Compare algorithms side by side', h('span', { html: icon('columns', { size: 15 }) }))))),
      h('div.lab-layout', benches, bench)));
  return { el, title: `${meta.name} in the lab`, destroy() { cleanups.forEach((fn) => fn()); } };
}
