// The lesson page. One template renders every lesson from its record.
//
// A lesson is read at three levels that explain the same idea:
//   1  Explain it simply     the simple explanation, a worked example, the visualization, words to know
//   2  Help me understand    how it works, experiments, code, why it matters, what could go wrong, a check
//   3  Go deeper             cost, correctness, derivations, alternatives, history and references
// The page always starts at the top with level 1. The level control decides how far it unfolds.

import { h, clear, rich, richBlock, renderMath, prose } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { replaceQuery } from '../core/router.js';
import { KIND_LABELS, PARADIGM_LABELS, LANGUAGE_LABELS } from '../core/schema.js';
import { createPlayer, assemblePlayer } from '../viz/player.js';
import { crumbs, levelGlyph, refLink, lessonRow } from '../ui/parts.js';
import { createCodePanel } from '../ui/code.js';
import { createExperimentChart } from '../ui/chart.js';
import { createQuiz } from '../ui/quiz.js';
import { createRelMap } from '../ui/relmap.js';

const LEVELS = [
  { n: 1, name: 'Explain it simply', about: 'Plain language and a small example.' },
  { n: 2, name: 'Help me understand', about: 'Steps, code, uses and pitfalls.' },
  { n: 3, name: 'Go deeper', about: 'Proofs, cost and research context.' },
];

const list = (items, cls = 'prose-list') => { const el = h(`ul.${cls}`, (items || []).map((t) => h('li', { html: rich(t) }))); renderMath(el); return el; };
const para = (text) => prose(text);
const sub = (title, ...body) => h('div.subsec', h('h3', title), body);

export default async function render({ params, query }) {
  const meta = C.algoById[params.id];
  if (!meta) {
    const p = C.plannedById[params.id];
    return { title: p ? p.name : 'Lesson not found', el: h('div.page.wrap.narrow', h('header.page-head',
      h('p.eyebrow', p ? 'Planned lesson' : 'Not found'),
      h('h1', p ? p.name : 'There is no lesson at this address.'),
      h('p.lede', p ? `This lesson is planned for ${C.disciplineById[p.discipline].name} but has not been written yet. Nothing is published in the atlas until it has been checked.` : 'It may have been renamed.')),
      h('p', h('a.btn.btn-primary', { href: '#/library' }, 'Browse the library'))) };
  }
  const L = await C.loadLesson(params.id);
  const m = L.meta;
  const d = C.disciplineById[m.discipline];
  store.visit(m.id);
  const cleanups = [];

  /* ---------- the player (shared by several sections) ---------- */
  const player = createPlayer(L);
  cleanups.push(() => player.destroy());
  const playerEl = assemblePlayer(player);
  const toPlayer = (input) => { player.setInput(input); playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); playerEl.focus({ preventScroll: true }); };
  const report = h('pre.run-report', { 'aria-live': 'polite' });
  const paintReport = (res) => {
    if (!res || !res.ok) { report.textContent = ''; return; }
    try { report.textContent = typeof L.viz.report === 'function' ? L.viz.report(res.result, res.counters, res.input) : ''; } catch { report.textContent = ''; }
    if (res.truncated) report.textContent += `\nThis run is long. The visualization shows its first ${res.frames.length} steps; the counts above are for the full run.`;
  };
  player.on('run', paintReport);
  paintReport(player.run);

  /* ---------- header ---------- */
  const favBtn = h('button.btn.btn-sm', { type: 'button' });
  const syncFav = () => { const on = store.isFavorite(m.id); favBtn.innerHTML = `${icon(on ? 'heartFill' : 'heart', { size: 15 })}<span>${on ? 'Saved' : 'Save'}</span>`; favBtn.classList.toggle('is-on', on); favBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  favBtn.addEventListener('click', () => { store.toggleFavorite(m.id); syncFav(); });
  syncFav();
  const collectBtn = h('button.btn.btn-sm', { type: 'button', html: `${icon('folder', { size: 15 })}<span>Add to a collection</span>` });
  const collectBox = h('div.collect-box', { hidden: true });
  const paintCollect = () => {
    const names = Object.keys(store.state.collections);
    const input = h('input', { type: 'text', placeholder: 'New collection name', maxlength: 40, 'aria-label': 'New collection name' });
    clear(collectBox).append(
      names.length ? h('div.collect-list', names.map((n) => { const has = store.state.collections[n].includes(m.id); return h('button.btn.btn-sm', { type: 'button', class: has ? 'is-on' : '', onclick: () => { has ? store.removeFromCollection(n, m.id) : store.addToCollection(n, m.id); paintCollect(); } }, has ? `In "${n}"` : `Add to "${n}"`); })) : h('p.small.muted', 'You have no collections yet. Name one to start it.'),
      h('form.collect-new', { onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { store.addToCollection(v, m.id); paintCollect(); } } }, input, h('button.btn.btn-sm.btn-primary', { type: 'submit' }, 'Create and add')),
      h('p.small.faint', store.persistent ? 'Collections are kept in this browser. See them in your atlas.' : 'This browser is blocking storage, so collections last until you close the tab.'));
  };
  collectBtn.addEventListener('click', () => { collectBox.hidden = !collectBox.hidden; if (!collectBox.hidden) paintCollect(); });
  const group = C.compareGroups.find((g) => g.members.includes(m.id));

  const head = h(`header.lesson-head.c-${C.colorOf(m.discipline)}`,
    crumbs([{ label: 'Library', href: '#/library' }, { label: d.name, href: `#/discipline/${d.id}` }, { label: m.subfield, href: `#/library?discipline=${d.id}` }, { label: m.family }, { label: m.name }]),
    h('p.eyebrow', `${KIND_LABELS[m.kind]} · ${d.name}`),
    h('h1', m.name),
    h('p.lede', m.summary),
    h('dl.lesson-facts',
      h('div', h('dt', 'Level'), h('dd', levelGlyph(m.difficulty, true))),
      h('div', h('dt', 'Running time'), h('dd.mono', m.time.worst)),
      h('div', h('dt', 'Memory'), h('dd.mono', m.space.worst)),
      h('div', h('dt', 'Approach'), h('dd', m.paradigms.map((p) => PARADIGM_LABELS[p]).join(', '))),
      m.year && m.authors ? h('div', h('dt', 'First described'), h('dd', `${m.authors}, ${m.year}`)) : null),
    h('div.lesson-actions', favBtn, collectBtn,
      h('a.btn.btn-sm', { href: `#/lab/${m.id}`, html: `${icon('flask', { size: 15 })}<span>Open in the lab</span>` }),
      group ? h('a.btn.btn-sm', { href: `#/compare/${group.id}?ids=${m.id}`, html: `${icon('columns', { size: 15 })}<span>Compare</span>` }) : null),
    collectBox);

  /* ---------- level control ---------- */
  let depth = Math.max(1, Math.min(3, Number(query.level) || store.state.depth || 1));
  const levelBtns = LEVELS.map((lv) => h('button.level-btn', { type: 'button', 'aria-pressed': 'false', onclick: () => setDepth(lv.n, true) },
    h('span.level-n', `Level ${lv.n}`), h('span.level-name', lv.name), h('span.level-about', lv.about)));
  const levelBar = h('div.level-bar', { role: 'group', 'aria-label': 'How deep should this lesson go?' }, levelBtns);

  /* ---------- sections ---------- */
  const sec = (id, lv, title, kicker, ...body) => h(`section.lsec.lv${lv}`, { id, 'aria-labelledby': `${id}-h`, dataset: { level: lv, title } },
    h('p.lsec-kicker', kicker), h('h2', { id: `${id}-h` }, title), body);

  const B = L.bigIdea;
  const simple = sec('simple', 1, 'The Simple Explanation', 'Level 1',
    h('div.simple-text', { html: richBlock(B.simple) }),
    h('aside.analogy',
      h('p.panel-cap', 'A picture to hold on to'),
      h('h3', B.analogy.title),
      h('p', { html: rich(B.analogy.text) }),
      h('p.analogy-limits', h('strong', 'Where the picture stops. '), h('span', { html: rich(B.analogy.limits) }))));

  const E = L.example;
  const example = sec('example', 1, 'A worked example', 'By hand',
    h('p.example-setup', { html: rich(E.setup) }),
    h('ol.example-steps', E.steps.map((s) => h('li', { html: rich(s) }))),
    h('p.example-result', h('strong', 'Result. '), h('span', { html: rich(E.result) })),
    E.tryInput ? h('p', h('button.btn.btn-sm', { type: 'button', onclick: () => toPlayer(E.tryInput), html: `${icon('play', { size: 13 })}<span>Watch this exact example run</span>` })) : null);

  const inputsFold = h('details.fold.inputs-fold', h('summary', 'Change the input'), h('div.fold-body', player.parts.inputs));
  const see = sec('see', 1, 'See it work', 'Step by step',
    h('p.muted', 'This is the real algorithm running in your browser, one step at a time. Press play, or step through it yourself. Space plays and pauses, and the arrow keys step.'),
    playerEl,
    h('p.fig-cap', h('b', 'What you are looking at'), L.viz.describe),
    inputsFold,
    report,
    h('div.lv2.try-this', h('h3', 'Things to try'), h('ol.try-list', L.viz.tryThis.map((t) => h('li', { html: rich(t) })))));

  const words = sec('words', 1, 'Words to know', 'Plain definitions',
    h('dl.terms', L.terms.map((t) => h('div', h('dt', t.term), h('dd', { html: rich(t.meaning) })))));

  const G = L.logic;
  const pseudoStatic = h('ol.pseudo.is-static', G.pseudocode.map((line) => h('li', { style: { paddingLeft: `${line.match(/^\s*/)[0].length * 0.55 + 0.6}em` } }, h('code', line.trim()))));
  const how = sec('how', 2, 'How It Works', 'Level 2',
    h('div.prose.precise', { html: `<p>${rich(B.what)}</p>` }),
    sub('The idea', para(G.intuition)),
    sub('Step by step', h('ol.steps', G.steps.map((s) => h('li', { html: rich(s) })))),
    sub('Pseudocode', h('p.muted.small', 'The same steps written compactly. In the visualization above, the line being carried out is highlighted as it runs.'), pseudoStatic),
    sub('Decisions that matter', h('dl.decisions', G.decisions.map((x) => h('div', h('dt', x.title), h('dd', { html: rich(x.text) }))))));

  const codePanel = createCodePanel(L);
  const code = sec('code', 2, 'In code', 'Read it, run it',
    h('p.muted', `A complete program in ${Object.keys(L.code).filter((k) => LANGUAGE_LABELS[k]).map((k) => LANGUAGE_LABELS[k]).join(', ')}. All versions print the same output, and each was run and checked when this site was built.`),
    codePanel.el);

  const matters = sec('matters', 2, 'Why it matters', 'In the world',
    h('div.matters-grid',
      h('div', h('h3', 'Why it was invented'), para(B.why)),
      h('div', h('h3', 'When to use it'), para(B.when)),
      h('div', h('h3', 'What makes it interesting'), para(B.interesting)),
      h('div', h('h3', 'Where you meet it'), para(B.where))),
    h('h3.apps-h', 'Applications'),
    h('ul.apps', L.applications.map((a) => h('li',
      h('div.app-head', h('h4', a.title), h(`span.app-status.is-${a.status}`, a.status === 'established' ? 'Established use' : 'Illustrative example')),
      h('p', { html: rich(a.text) })))),
    h('p.small.faint', '"Established" marks uses that are well documented. "Illustrative" marks examples that show how the idea could apply.'));

  const T = L.tradeoffs;
  const wrong = sec('wrong', 2, 'What could go wrong', 'Limits and misunderstandings',
    sub('Common misunderstandings', list(T.misunderstandings, 'myths')),
    h('div.two-col',
      sub('Where it struggles', list(T.struggles)),
      sub('Edge cases', list(G.edgeCases))),
    h('div.two-col',
      sub('Mistakes people make', list(G.mistakes)),
      sub('Pitfalls in real use', list([...(T.pitfalls || []), ...(T.constraints || [])]))));

  const check = sec('check', 2, 'Check your understanding', 'Knowledge check', createQuiz(L, { onTry: toPlayer }));

  const X = L.complexity;
  let chart = null;
  if (L.viz.experiment) { chart = createExperimentChart(L); cleanups.push(() => chart.destroy()); }
  const technical = sec('technical', 3, 'The Technical Explanation', 'Level 3',
    sub('What it costs', para(X.summary),
      h('div.data-table-wrap', h('table.data-table',
        h('thead', h('tr', h('th', 'Case'), h('th', 'Time'), h('th', 'When'))),
        h('tbody', X.cases.map((c) => h('tr', h('th', c.case), h('td.mono', c.time), h('td', { html: rich(c.when) })))))),
      h('dl.cost-dl',
        h('div', h('dt', 'Memory'), h('dd', { html: rich(X.space) })),
        X.memory ? h('div', h('dt', 'In practice'), h('dd', { html: rich(X.memory) })) : null,
        h('div', h('dt', 'Trade-offs'), h('dd', { html: rich(X.tradeoffs) })))),
    sub('What these bounds assume', list(X.assumptions)),
    chart ? chart.el : null,
    sub('Why it is correct', para(G.correctness), (G.invariants || []).length ? [h('h4.minor', 'Invariants'), list(G.invariants)] : null));

  const A = L.advanced;
  const fold = (title, text) => (text ? h('details.fold', h('summary', title), h('div.fold-body', para(text))) : null);
  const deeper = sec('deeper', 3, 'Derivations and proofs', 'For the record',
    fold('Derivation', A.derivation), fold('Proof of correctness', A.proof), fold('Proof of the complexity bound', A.complexityProof),
    !A.derivation && !A.proof && !A.complexityProof ? h('p.muted', 'No formal derivation is included for this lesson yet.') : null);
  renderMath(deeper);

  const choose = sec('choose', 3, 'Choosing between alternatives', 'Trade-offs',
    h('div.two-col', sub('Where it excels', list(T.excels)),
      sub('Consider instead', h('ul.alts', T.alternatives.map((a) => h('li', a.id ? refLink(a.id) : h('span.ref.is-plain', a.name), h('span', { html: rich(a.when) })))))),
    T.comparison ? h('div.data-table-wrap', h('table.data-table.compare-mini',
      h('thead', h('tr', T.comparison.columns.map((c) => h('th', c)))),
      h('tbody', T.comparison.rows.map((r) => h('tr', r.map((cell, i) => h(i === 0 ? 'th' : 'td', { html: rich(String(cell)) }))))))) : null,
    group ? h('p', h('a.text-link', { href: `#/compare/${group.id}?ids=${m.id}` }, `Run it side by side with others in "${group.title}"`, h('span', { html: icon('arrow', { size: 15 }) }))) : null);

  const history = sec('history', 3, 'History, variants and sources', 'Context',
    sub('History', para(A.history)),
    (A.variants || []).length ? sub('Variants', h('dl.decisions', A.variants.map((v) => h('div', h('dt', v.name), h('dd', { html: rich(v.text) }))))) : null,
    A.implementation ? sub('Implementation notes', para(A.implementation)) : null,
    A.benchmarking ? sub('Measuring it fairly', para(A.benchmarking)) : null,
    sub('References', h('ol.refs', A.references.map((r) => h('li', h('span.ref-authors', `${r.authors} (${r.year}). `), h('span.ref-title', r.title), '. ', h('span.ref-venue', r.venue), '.'))),
      (A.furtherReading || []).length ? [h('h4.minor', 'Further reading'), list(A.furtherReading)] : null));

  const connections = h('section.lsec.lv1', { id: 'connections', 'aria-labelledby': 'connections-h', dataset: { level: 1, title: 'Connections' } },
    h('p.lsec-kicker', 'Where this leads'), h('h2', { id: 'connections-h' }, 'Connections'),
    h('p.muted', 'Each line is a reason. Squares are concepts, rings are disciplines, and dots are other lessons.'),
    createRelMap(m.id, [
      ...L.connections.map((c) => ({ ref: c.to, type: c.type, why: c.why })),
      ...(m.alsoIn || []).filter((o) => !L.connections.some((c) => c.to === `discipline:${o.id}`)).map((o) => ({ ref: `discipline:${o.id}`, type: 'application', why: o.why })),
    ]));

  const takeaway = h('section.lsec.lv1.takeaway', { id: 'takeaway', 'aria-labelledby': 'takeaway-h', dataset: { level: 1, title: 'The Takeaway' } },
    h('p.lsec-kicker', 'In one sentence'), h('h2', { id: 'takeaway-h' }, 'The Takeaway'),
    h('blockquote', L.takeaway));

  const invite = (to, text) => h(`div.invite-level.inv${to}`,
    h('p', text),
    h('button.btn.btn-primary', { type: 'button', onclick: () => setDepth(to, true, true) }, LEVELS[to - 1].name, h('span', { html: icon('arrow', { size: 15 }) })));
  const invite2 = invite(2, 'That is the whole idea. If you want to see exactly how it works, with the steps, the code and the places it fails, keep going.');
  const invite3 = invite(3, 'You now know how it works. The next level shows why it is correct, what it costs, and where it came from.');

  /* ---------- neighbours and paths ---------- */
  const ordered = C.algos.slice().sort((a, b) => a.order - b.order);
  const at = ordered.findIndex((a) => a.id === m.id);
  const sameDisc = ordered.filter((a) => a.discipline === m.discipline);
  const atD = sameDisc.findIndex((a) => a.id === m.id);
  const prev = sameDisc[atD - 1] || ordered[at - 1], next = sameDisc[atD + 1] || ordered[at + 1];
  const inPaths = C.paths.filter((p) => p.stages.some((s) => s.modules.some((x) => x.algo === m.id)));
  const after = h('footer.lesson-after',
    h('div.pager',
      prev ? h('a.pager-link', { href: `#/algorithm/${prev.id}` }, h('span.pager-dir', 'Previous'), h('span.pager-name', prev.name)) : h('span'),
      next ? h('a.pager-link.is-next', { href: `#/algorithm/${next.id}` }, h('span.pager-dir', 'Next'), h('span.pager-name', next.name)) : h('span')),
    inPaths.length ? h('p.in-paths', 'This lesson is part of: ', inPaths.map((p, i) => [i ? ', ' : '', h('a.link', { href: `#/path/${p.id}` }, p.title)]), '.') : null);

  /* ---------- table of contents ---------- */
  const body = h('article.lesson-article', simple, example, see, words, invite2, how, code, matters, wrong, check, invite3, technical, deeper, choose, history, connections, takeaway, after);
  const sections = [...body.querySelectorAll('.lsec')];
  const toc = h('nav.lesson-toc', { 'aria-label': 'In this lesson' });
  const tocLinks = sections.map((s) => {
    const a = h(`a.toc-link.lv${s.dataset.level}`, { href: `#${s.id}`, onclick: (e) => { e.preventDefault(); s.scrollIntoView({ behavior: 'smooth', block: 'start' }); s.querySelector('h2').focus({ preventScroll: true }); } }, s.dataset.title);
    return a;
  });
  sections.forEach((s) => s.querySelector('h2').setAttribute('tabindex', '-1'));
  const tocGroup = (lv, label) => h(`div.toc-group.lv${lv}`, h('p.toc-cap', label), tocLinks.filter((a, i) => Number(sections[i].dataset.level) === lv && !['connections', 'takeaway'].includes(sections[i].id)));
  toc.append(h('p.panel-cap', 'In this lesson'), tocGroup(1, 'Simply'), tocGroup(2, 'In detail'), tocGroup(3, 'In depth'),
    h('div.toc-group', h('p.toc-cap', 'And then'), tocLinks.filter((a, i) => ['connections', 'takeaway'].includes(sections[i].id))));

  const root = h('div.lesson.page.wrap', { dataset: { depth } }, head, levelBar, h('div.lesson-grid', toc, body));

  function setDepth(n, save, scroll) {
    depth = n;
    root.dataset.depth = n;
    levelBtns.forEach((b, i) => b.setAttribute('aria-pressed', i + 1 === n ? 'true' : 'false'));
    inputsFold.open = n >= 2;
    if (save) { store.setDepth(n); replaceQuery({ level: n }); }
    if (scroll) { const first = body.querySelector(`.lsec.lv${n}`); if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'start' }); first.querySelector('h2').focus({ preventScroll: true }); } }
  }
  setDepth(depth, false);

  // highlight the current section in the table of contents
  const spy = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) tocLinks.forEach((a, i) => a.classList.toggle('is-current', sections[i] === en.target));
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach((s) => spy.observe(s));
  cleanups.push(() => spy.disconnect());

  return {
    el: root, title: m.name,
    afterMount() {
      const target = query.at && body.querySelector(`#${CSS.escape(query.at)}`);
      if (target) {
        const lv = Number(target.dataset.level) || 1;
        if (lv > depth) setDepth(lv, false);
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
      }
    },
    destroy() { cleanups.forEach((fn) => fn()); },
  };
}
