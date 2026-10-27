// The lesson page. One template renders every lesson from its record.
// Its one job: teach this algorithm, at the depth the reader has chosen.
//
//   1  Explain it simply     the simple explanation, a worked example, the visualization, words to know
//   2  Help me understand    how it works, code, why it matters, what could go wrong, a check
//   3  Go deeper             cost and correctness, history and sources
//
// Three rules shape the template:
//   - Each level shows only what that level is for. Deeper material is not on the page until asked for.
//   - Within a level, detail that is not essential sits in a closed fold.
//   - Nothing is explained twice. Where another page does a job better (the lab, the comparison
//     tool, the connection graph), the lesson links to it instead of repeating it.

import { h, clear, rich, richBlock, renderMath, prose, prefersReducedMotion, holdInView } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { replaceQuery, href } from '../core/router.js';
import { KIND_LABELS, PARADIGM_LABELS, LANGUAGE_LABELS } from '../core/schema.js';
import { createPlayer, assemblePlayer } from '../viz/player.js';
import { crumbs, levelGlyph, refLink } from '../ui/parts.js';
import { createCodePanel } from '../ui/code.js';
import { createExperimentChart } from '../ui/chart.js';
import { createQuiz } from '../ui/quiz.js';
import { createRelMap } from '../ui/relmap.js';
import { around, nextStep, stepBefore, pointingTo } from '../core/next.js';
import { createRunCompare } from '../ui/runcompare.js';
import { businessView } from '../core/tracks.js';
import { lessonArt } from '../art/lesson-art.js';

const LEVELS = [
  { n: 1, name: 'Explain it simply', about: 'Plain language and a small example.' },
  { n: 2, name: 'Help me understand', about: 'Steps, code, uses and pitfalls.' },
  { n: 3, name: 'Go deeper', about: 'Cost, proofs and sources.' },
];

const list = (items, cls = 'prose-list') => { const el = h(`ul.${cls}`, (items || []).map((t) => h('li', { html: rich(t) }))); renderMath(el); return el; };
const para = (text) => prose(text);
const sub = (title, ...body) => h('div.subsec', h('h3', title), body);
const fold = (title, ...body) => { const el = h('details.fold', h('summary', title), h('div.fold-body', body)); renderMath(el); return el; };

export default async function render({ params, query }) {
  const meta = C.algoById[params.id];
  if (!meta) {
    const p = C.plannedById[params.id];
    // A planned lesson is not a dead end: the published lessons that mention it say why it matters.
    const from = p ? pointingTo(p.id) : [];
    return { title: p ? p.name : 'Lesson not found', el: h('div.page.wrap.narrow', h('header.page-head',
      h('p.eyebrow', p ? 'Planned lesson' : 'Not found'),
      h('h1', p ? p.name : 'There is no lesson at this address.'),
      h('p.lede', p ? `This lesson is planned for ${C.disciplineById[p.discipline].name} but has not been written yet. Nothing is published in the atlas until it has been checked.` : 'It may have been renamed.')),
      from.length ? h('section.planned-from',
        h('h2', 'Until it is written'),
        h('p.muted', `${from.length === 1 ? 'One published lesson mentions' : `${from.length} published lessons mention`} ${p.name}. ${from.length === 1 ? 'It is' : 'They are'} the nearest thing to read now.`),
        h('ul.planned-from-list', from.map((x) => h('li', h('a.link.rel-name', { href: `#/algorithm/${x.ref}` }, C.algoById[x.ref].name), h('p', x.why))))) : null,
      h('p', { style: { marginTop: '28px' } }, h('a.btn.btn-primary', { href: p ? `#/discipline/${p.discipline}` : '#/library' }, p ? `See what is published in ${C.disciplineById[p.discipline].name}` : 'Browse the library'), ' ', p ? h('a.btn', { href: '#/library' }, 'Browse the library') : null)) };
  }
  const L = await C.loadLesson(params.id);
  const m = L.meta;
  const d = C.disciplineById[m.discipline];
  store.visit(m.id);
  const cleanups = [];

  /* ---------- the player ---------- */
  const player = createPlayer(L);
  cleanups.push(() => player.destroy());
  const playerEl = assemblePlayer(player, { pageKeys: true });
  const runCompare = createRunCompare(player, L);
  cleanups.push(() => runCompare.destroy());
  const toPlayer = (input) => { player.setInput(input); playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); playerEl.focus({ preventScroll: true }); };
  const report = h('pre.run-report.lv2', { 'aria-live': 'polite' });
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
  const group = C.compareGroups.find((g) => g.members.includes(m.id));

  const head = h(`header.lesson-head.c-${C.colorOf(m.discipline)}`,
    crumbs([{ label: 'Library', href: '#/library' }, { label: d.name, href: `#/discipline/${d.id}` }, { label: m.subfield, href: `#/library?discipline=${d.id}` }, { label: m.name }]),
    h('p.eyebrow', `${KIND_LABELS[m.kind]} · ${d.name}`),
    h('h1', m.name),
    h('p.lede', m.summary),
    h('dl.lesson-facts.lv2',
      h('div', h('dt', 'Level'), h('dd', levelGlyph(m.difficulty, true))),
      h('div', h('dt', 'Time, worst case'), h('dd.mono', m.time.worst)),
      h('div', h('dt', 'Memory, worst case'), h('dd.mono', m.space.worst)),
      h('div', h('dt', 'Approach'), h('dd', m.paradigms.map((p) => PARADIGM_LABELS[p]).join(', '))),
      m.year && m.authors ? h('div', h('dt', 'First described'), h('dd', `${m.authors}, ${m.year}`)) : null));

  /* ---------- level control ---------- */
  let depth = Math.max(1, Math.min(3, Number(query.level) || store.state.depth || 1));
  const levelBtns = LEVELS.map((lv) => h('button.level-btn', { type: 'button', 'aria-pressed': 'false', onclick: () => setDepth(lv.n, true) },
    h('span.level-n', `Level ${lv.n}`), h('span.level-name', lv.name), h('span.level-about', lv.about)));
  const levelBar = h('div.level-bar', { role: 'group', 'aria-label': 'How deep should this lesson go?' }, levelBtns);

  /* ---------- sections ---------- */
  const sec = (id, lv, title, kicker, ...body) => h(`section.lsec.lv${lv}`, { id, 'aria-labelledby': `${id}-h`, dataset: { level: lv, title } },
    h('p.lsec-kicker', kicker), h('h2', { id: `${id}-h` }, title), body);

  /* level 1 */
  const B = L.bigIdea;
  // the beginners' lessons have a small picture of their idea beside the explanation
  const art = lessonArt[m.id];
  const simpleText = h('div.simple-text', { html: richBlock(B.simple) });
  const simple = sec('simple', 1, 'The Simple Explanation', 'Level 1',
    art ? h('div.simple-with-art', simpleText, h(`div.lesson-art.c-${C.colorOf(m.discipline)}`, { html: art() })) : simpleText,
    h('aside.analogy',
      h('p.panel-cap', 'A picture to hold on to'),
      h('h3', B.analogy.title),
      h('p', { html: rich(B.analogy.text) }),
      // one paragraph or several: the label runs into the first, and a blank line starts the next
      String(B.analogy.limits).split(/\n\s*\n/).map((para, i) => h('p.analogy-limits', i === 0 ? h('strong', 'Where the picture stops. ') : null, h('span', { html: rich(para) })))));

  const E = L.example;
  const example = sec('example', 1, 'A worked example', 'By hand',
    h('p.example-setup', { html: rich(E.setup) }),
    h('ol.example-steps', E.steps.map((s) => h('li', { html: rich(s) }))),
    h('p.example-result', h('strong', 'Result. '), h('span', { html: rich(E.result) })),
    E.tryInput ? h('p', h('button.btn.btn-sm', { type: 'button', onclick: () => toPlayer(E.tryInput), html: `${icon('play', { size: 13 })}<span>Watch this exact example run</span>` })) : null);

  // Where the lesson teaches a method on a simple example, say what that example stands for
  // in a business, in the words the business guide uses. The example itself is left alone.
  const biz = businessView(m.id);
  const bridge = biz && biz.role === 'method' ? h('aside.biz-bridge-box', { 'aria-label': 'What this means in a business' },
    h('p.panel-cap', 'In a business'),
    h('h3', biz.question),
    h('p', biz.bridge),
    h('p.small', biz.cases.map((c) => [h('a.link', { href: `#/case/${c.id}` }, `Worked case: ${c.title}`), ' · ']), h('a.link', { href: `#/track/business` }, 'More decisions like this'))) : null;

  // A prompt puts a question, and keeps the outcome closed until the reader asks for it.
  const tryList = h('ol.try-list', L.viz.tryThis.map((t) => h('li',
    h('p.try-ask', { html: rich(t.ask) }),
    t.input ? h('p.try-set', h('button.btn.btn-sm', { type: 'button', onclick: () => toPlayer(t.input), html: `${icon('play', { size: 13 })}<span>Set this up</span>` })) : null,
    h('details.try-reveal', h('summary', 'See what happens'), h('p', { html: rich(t.reveal) })))));
  renderMath(tryList);

  const inputsFold = h('details.fold.inputs-fold', h('summary', 'Change the input'), h('div.fold-body', player.parts.inputs, runCompare.el));
  const see = sec('see', 1, 'See it work', 'Step by step',
    h('p.muted', 'The real algorithm, running here one step at a time. Press play, or step through it yourself.'),
    playerEl,
    h('p.fig-cap', h('b', 'What you are looking at'), L.viz.describe),
    bridge,
    inputsFold,
    report,
    h('div.lv2.try-this', h('h3', 'Things to try'),
      h('p.muted.try-lead', 'Each of these asks a question. Settle on your answer before you run it or open the outcome.'),
      tryList,
      h('p.small.muted', 'For a larger workspace with the event log and source beside the picture, ', h('a.link', { href: `#/lab/${m.id}` }, 'open this in the lab'), '.')));

  // For someone deciding whether the method fits their problem. The three statements are the
  // lesson's own (they also fill the comparison table), so nothing is said twice.
  const K = L.compare || {};
  const elsewhere = ((L.tradeoffs || {}).alternatives || []).slice(0, 2);
  const decide = K.useWhen || K.requires || K.limits ? sec('decide', 1, 'Should you use it?', 'If you are deciding',
    h('dl.decide-dl',
      K.useWhen ? h('div', h('dt', 'Use it when'), h('dd', { html: rich(K.useWhen) })) : null,
      K.requires ? h('div', h('dt', 'It needs'), h('dd', { html: rich(K.requires) })) : null,
      K.limits ? h('div', h('dt', 'It falls short when'), h('dd', { html: rich(K.limits) })) : null,
      // Saying where a method fails is half an answer. The other half is what to reach for instead.
      elsewhere.length ? h('div', h('dt', 'If it does not fit'), h('dd', h('ul.alts.decide-alts', elsewhere.map((a) => h('li',
        a.id && C.algoById[a.id] ? h('a.ref', { href: `#/algorithm/${a.id}` }, C.algoById[a.id].name) : h('span.ref.is-plain', a.name),
        h('span', { html: rich(a.when) })))))) : null)) : null;
  if (decide) renderMath(decide);

  const words = sec('words', 1, 'Words to know', 'Plain definitions',
    h('dl.terms', L.terms.map((t) => h('div', h('dt', t.term), h('dd', { html: rich(t.meaning) })))));

  /* level 2 */
  const G = L.logic;
  const how = sec('how', 2, 'How It Works', 'Level 2',
    h('div.prose.precise', { html: richBlock(G.intuition) }),
    sub('Step by step', h('ol.steps', G.steps.map((s) => h('li', { html: rich(s) }))),
      h('p.small.muted', 'The same steps are written as pseudocode beside the visualization above, where the line being carried out lights up as it runs.')),
    fold('Decisions that matter', h('dl.decisions', G.decisions.map((x) => h('div', h('dt', x.title), h('dd', { html: rich(x.text) }))))));
  renderMath(how);

  const codePanel = createCodePanel(L);
  const breakIt = L.code.breakIt || [];
  const code = sec('code', 2, 'In code', 'Read it, run it',
    h('p.muted', `A complete program in ${Object.keys(L.code).filter((k) => LANGUAGE_LABELS[k]).map((k) => LANGUAGE_LABELS[k]).join(', ').replace(/, ([^,]*)$/, ' and $1')}. Each version prints the same output.`),
    codePanel.el,
    breakIt.length ? h('div.break-it',
      h('h3', 'Break it on purpose'),
      h('p.muted', 'A program is understood when you can say what a change will do to it. Press "Edit the code", make one of these changes, decide what you expect, then run it.'),
      h('ol.try-list', breakIt.map((b) => h('li',
        h('p.try-ask', { html: rich(b.change) }),
        h('details.try-reveal', h('summary', 'See what happens'), h('p', { html: rich(b.reveal) })))))) : null,
    (L.code.more || []).map((x) => { const panel = createCodePanel({ code: x }); return h('div.code-more', h('h3', x.title), h('p.muted', { html: rich(x.lead) }), panel.el); }));

  const matters = sec('matters', 2, 'Why it matters', 'In the world',
    h('div.prose.precise', { html: richBlock(B.interesting) }),
    sub('When to use it', para(B.when)),
    sub('Where it is used',
      h('ul.apps', L.applications.map((a) => h('li',
        h('div.app-head', h('h4', a.title), h(`span.app-status.is-${a.status}`, a.status === 'established' ? 'Established use' : 'Illustrative example')),
        h('p', { html: rich(a.text) })))),
      h('p.small.faint', '"Established" marks uses that are well documented. "Illustrative" marks examples of how the idea could apply.')));
  renderMath(matters);

  const T = L.tradeoffs;
  const wrong = sec('wrong', 2, 'What could go wrong', 'Limits and misunderstandings',
    sub('Common misunderstandings', list(T.misunderstandings, 'myths')),
    h('div.two-col',
      sub('Where it struggles', list(T.struggles)),
      sub('Mistakes people make', list(G.mistakes))),
    fold('Edge cases and practical pitfalls', list([...(G.edgeCases || []), ...(T.pitfalls || []), ...(T.constraints || [])])));

  const check = sec('check', 2, 'Check your understanding', 'Knowledge check', createQuiz(L, { onTry: toPlayer }));

  /* level 3 */
  const X = L.complexity;
  const A = L.advanced;
  let chart = null;
  if (L.viz.experiment) { chart = createExperimentChart(L); cleanups.push(() => chart.destroy()); }
  const textFold = (title, text) => (text ? fold(title, para(text)) : null);
  const technical = sec('technical', 3, 'The Technical Explanation', 'Level 3',
    sub('What it costs', para(X.summary),
      h('div.data-table-wrap', h('table.data-table',
        h('thead', h('tr', h('th', 'Case'), h('th', 'Time'), h('th', 'When'))),
        h('tbody', X.cases.map((c) => h('tr', h('th', c.case), h('td.mono', c.time), h('td', { html: rich(c.when) })))))),
      h('dl.cost-dl',
        h('div', h('dt', 'Memory'), h('dd', { html: rich(X.space) })),
        h('div', h('dt', 'Trade-offs'), h('dd', { html: rich(X.tradeoffs) }))),
      fold('What these bounds assume', list(X.assumptions), X.memory ? h('p.muted', { html: rich(X.memory) }) : null)),
    chart ? chart.el : null,
    h('div.subsec', { id: 'correctness' }, h('h3', 'Why it is correct'), para(G.correctness), (G.invariants || []).length ? fold('Invariants', list(G.invariants)) : null,
      textFold('Derivation', A.derivation), textFold('Proof of correctness', A.proof), textFold('Proof of the complexity bound', A.complexityProof)),
    sub('Compared with the alternatives',
      T.comparison ? h('div.data-table-wrap', h('table.data-table.compare-mini',
        h('thead', h('tr', T.comparison.columns.map((c) => h('th', c)))),
        h('tbody', T.comparison.rows.map((r) => h('tr', r.map((cell, i) => h(i === 0 ? 'th' : 'td', { html: rich(String(cell)) }))))))) : null,
      h('ul.alts', T.alternatives.map((a) => h('li', a.id ? refLink(a.id) : h('span.ref.is-plain', a.name), h('span', { html: rich(a.when) })))),
      group ? h('p', h('a.text-link', { href: `#/compare/${group.id}?ids=${m.id}` }, `Run it side by side with others in "${group.title}"`, h('span', { html: icon('arrow', { size: 15 }) }))) : null));
  renderMath(technical);

  const history = sec('history', 3, 'History and sources', 'Context',
    para(A.history),
    (A.variants || []).length ? fold('Variants', h('dl.decisions', A.variants.map((v) => h('div', h('dt', v.name), h('dd', { html: rich(v.text) }))))) : null,
    A.implementation ? fold('Implementation notes', para(A.implementation)) : null,
    A.benchmarking ? fold('Measuring it fairly', para(A.benchmarking)) : null,
    sub('References', h('ol.refs', A.references.map((r) => h('li', h('span.ref-authors', `${r.authors} (${r.year}). `), h('span.ref-title', r.title), '. ', h('span.ref-venue', r.venue), '.'))),
      (A.furtherReading || []).length ? fold('Further reading', list(A.furtherReading)) : null));

  /* always */
  const links = [
    ...L.connections.map((c) => ({ ref: c.to, type: c.type, why: c.why })),
    ...(m.alsoIn || []).filter((o) => !L.connections.some((c) => c.to === `discipline:${o.id}`)).map((o) => ({ ref: `discipline:${o.id}`, type: 'application', why: o.why })),
    // published lessons that name this one as something they assume: the other half of "go further"
    ...around(m.id).deeper.filter((x) => x.kind === 'builds-on').map((x) => ({ ref: x.ref, type: 'builds-on', why: x.why })),
  ];
  const connections = h('section.lsec.lv1', { id: 'connections', 'aria-labelledby': 'connections-h', dataset: { level: 1, title: 'Connections' } },
    h('p.lsec-kicker', 'Where this leads'), h('h2', { id: 'connections-h' }, 'Connections'),
    createRelMap(m.id, links, { map: false }),
    h('p', { style: { marginTop: '20px' } }, h('a.text-link', { href: `#/connections?view=graph&at=${m.id}` }, 'See these on the connection graph', h('span', { html: icon('arrow', { size: 15 }) }))));

  const takeaway = h('section.lsec.lv1.takeaway', { id: 'takeaway', 'aria-labelledby': 'takeaway-h', dataset: { level: 1, title: 'The Takeaway' } },
    h('p.lsec-kicker', 'In one sentence'), h('h2', { id: 'takeaway-h' }, 'The Takeaway'),
    h('blockquote', L.takeaway));

  const invite = (to, text) => h(`div.invite-level.inv${to}`,
    h('p', text),
    h('button.btn.btn-primary', { type: 'button', onclick: () => setDepth(to, true, true) }, LEVELS[to - 1].name, h('span', { html: icon('arrow', { size: 15 }) })));
  const invite2 = invite(2, 'That is the whole idea. If you want to see exactly how it works, with the steps, the code and the places it fails, keep going.');
  const invite3 = invite(3, 'You now know how it works. The next level shows what it costs, why it is correct, and where it came from.');

  /* ---------- what next ---------- */
  const collectBox = h('div.collect-box', { hidden: true });
  const paintCollect = () => {
    const names = Object.keys(store.state.collections);
    const input = h('input', { type: 'text', placeholder: 'New collection name', maxlength: 40, 'aria-label': 'New collection name' });
    clear(collectBox).append(
      names.length ? h('div.collect-list', names.map((n) => { const has = store.state.collections[n].includes(m.id); return h('button.btn.btn-sm', { type: 'button', class: has ? 'is-on' : '', onclick: () => { has ? store.removeFromCollection(n, m.id) : store.addToCollection(n, m.id); paintCollect(); } }, has ? `In "${n}"` : `Add to "${n}"`); })) : h('p.small.muted', 'You have no collections yet. Name one to start it.'),
      h('form.collect-new', { onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { store.addToCollection(v, m.id); paintCollect(); } } }, input, h('button.btn.btn-sm.btn-primary', { type: 'submit' }, 'Create and add')),
      h('p.small.faint', store.persistent ? 'Collections are kept in this browser. See them in your atlas.' : 'This browser is blocking storage, so collections last until you close the tab.'));
  };
  const collectBtn = h('button.btn.btn-sm', { type: 'button', html: `${icon('folder', { size: 15 })}<span>Add to a collection</span>`, onclick: () => { collectBox.hidden = !collectBox.hidden; if (!collectBox.hidden) paintCollect(); } });

  // One step back and one step on, each a stated connection with its reason (core/next.js).
  // A reader who came from a learning path is kept on that path. Where the lesson states no
  // connection to another published lesson, nothing is suggested.
  const viaPath = query.path && C.pathById[query.path] && C.pathById[query.path].stages.some((s) => s.modules.some((x) => x.algo === m.id)) ? C.pathById[query.path] : null;
  const back = stepBefore(m.id, { pathId: viaPath && viaPath.id });
  const onward = nextStep(m.id, { pathId: viaPath && viaPath.id });
  const stepCard = (s, cls) => h(`a.pager-link${cls}`, { href: `#/algorithm/${s.ref}${s.path ? `?path=${s.path}` : ''}`, dataset: { kind: s.kind } },
    h('span.pager-dir', s.label), h('span.pager-name', C.algoById[s.ref].name), h('span.pager-why', { html: rich(s.why) }));
  const inPaths = C.paths.filter((p) => p.stages.some((s) => s.modules.some((x) => x.algo === m.id)));
  const after = h('footer.lesson-after',
    h('div.lesson-actions', favBtn, collectBtn,
      h('a.btn.btn-sm', { href: `#/lab/${m.id}`, html: `${icon('flask', { size: 15 })}<span>Experiment in the lab</span>` }),
      group ? h('a.btn.btn-sm', { href: `#/compare/${group.id}?ids=${m.id}`, html: `${icon('columns', { size: 15 })}<span>Compare with similar algorithms</span>` }) : null),
    collectBox,
    back || onward ? h('nav.pager', { 'aria-label': 'Where to go from here' },
      back ? stepCard(back, '') : h('span'),
      onward ? stepCard(onward, '.is-next') : h('span')) : null,
    viaPath ? h('p.in-paths', 'You are following ', h('a.link', { href: `#/path/${viaPath.id}` }, viaPath.title), '. ', h('a.link', { href: `#/path/${viaPath.id}` }, 'Back to the path'), '.')
      : inPaths.length ? h('p.in-paths', 'This lesson is part of: ', inPaths.map((p, i) => [i ? ', ' : '', h('a.link', { href: `#/path/${p.id}` }, p.title)]), '.') : null);

  /* ---------- table of contents ---------- */
  const body = h('article.lesson-article', simple, example, see, decide, words, invite2, how, code, matters, wrong, check, invite3, technical, history, connections, takeaway, after);
  const sections = [...body.querySelectorAll('.lsec')];
  const toc = h('nav.lesson-toc', { 'aria-label': 'In this lesson' });
  // Each link is a real address (so it can be copied, bookmarked or opened in a new tab).
  // Clicking it scrolls in place and puts that address in the address bar.
  const sectionHref = (s) => href(`/algorithm/${m.id}`, { level: Math.max(depth, Number(s.dataset.level)), at: s.id, path: query.path });
  const tocLinks = sections.map((s) => h(`a.toc-link.lv${s.dataset.level}`, { href: `#/algorithm/${m.id}?at=${s.id}`, onclick: (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    history.replaceState(null, '', sectionHref(s));
    s.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    s.querySelector('h2').focus({ preventScroll: true });
  } }, s.dataset.title));
  sections.forEach((s) => s.querySelector('h2').setAttribute('tabindex', '-1'));
  const closing = ['connections', 'takeaway'];
  const tocGroup = (lv, label) => h(`div.toc-group.lv${lv}`, h('p.toc-cap', label), tocLinks.filter((a, i) => Number(sections[i].dataset.level) === lv && !closing.includes(sections[i].id)));
  toc.append(h('p.panel-cap', 'In this lesson'), tocGroup(1, 'Simply'), tocGroup(2, 'In detail'), tocGroup(3, 'In depth'),
    h('div.toc-group', h('p.toc-cap', 'And then'), tocLinks.filter((a, i) => closing.includes(sections[i].id))));

  const root = h('div.lesson.page.wrap', { dataset: { depth } }, head, levelBar, h('div.lesson-grid', toc, body));

  function setDepth(n, save, scroll) {
    depth = n;
    root.dataset.depth = n;
    levelBtns.forEach((b, i) => b.setAttribute('aria-pressed', i + 1 === n ? 'true' : 'false'));
    if (save) { store.setDepth(n); replaceQuery({ level: n, path: query.path }); }
    if (scroll) { const first = body.querySelector(`.lsec.lv${n}`); if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'start' }); first.querySelector('h2').focus({ preventScroll: true }); } }
  }
  setDepth(depth, false);

  const spy = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) tocLinks.forEach((a, i) => a.classList.toggle('is-current', sections[i] === en.target));
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach((s) => spy.observe(s));
  cleanups.push(() => spy.disconnect());

  return {
    el: root, title: m.name,
    afterMount() {
      // ?predict=1 opens the lesson with the prediction experiment switched on, for trying it with learners
      const box = player.parts.predict.querySelector('input');
      if (query.predict === '1' && !player.parts.predict.hidden && !box.checked) box.click();
      const target = query.at && body.querySelector(`#${CSS.escape(query.at)}`);
      if (target) {
        // a link to a deeper section opens the lesson at that depth, whatever level was saved
        const lv = Number((target.closest('.lsec') || target).dataset.level) || 1;
        if (lv > depth) setDepth(lv, false);
        holdInView(target);
      }
    },
    destroy() { cleanups.forEach((fn) => fn()); },
  };
}
