// Site tests, run in headless Chrome by tools/test.py.
//
// Two kinds of test live here. Some import a module and check what it returns. Others open
// the real site in a frame and look at the page, because a defect in the interface is only
// fixed when the page a reader sees is right. Where a test states an expectation, it is
// written from what the reader should see, not copied from the code being tested.

import * as C from '../js/core/catalog.js';
import * as S from '../js/core/search.js';
import { fixtures, score, SETS } from './search-benchmark.js';

const params = new URLSearchParams(location.search);
const want = (params.get('suite') || 'all').split(',');
const on = (name) => want.includes('all') || want.includes(name);

const results = [];
let current = '';
const suite = (name) => { current = name; };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
async function test(name, fn) {
  try { const detail = await fn(); results.push({ suite: current, name, ok: true, detail: typeof detail === 'string' ? detail : '' }); }
  catch (e) { results.push({ suite: current, name, ok: false, detail: e && e.message ? e.message : String(e) }); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, msg) {
  const t0 = performance.now();
  for (;;) {
    let v = null;
    try { v = fn(); } catch { v = null; }
    if (v) return v;
    if (performance.now() - t0 > ms) throw new Error(msg);
    await sleep(40);
  }
}

// Open a page of the real site in a frame and wait for something on it.
// The site's fonts come from another server, and a slow answer there holds the page back.
// That is not what these tests are about, so a page that does not appear is opened once more.
async function open(hash, ready, { width = 1200, height = 900 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const f = document.createElement('iframe');
    // fixed at the top left so that the page inside is really on screen: the site pauses and ignores what is out of view
    f.style.cssText = `width:${width}px;height:${height}px;border:0;display:block;position:fixed;top:0;left:0;background:#fff;z-index:5`;
    f.src = `/index.html?try=${attempt}#${hash}`;
    document.body.append(f);
    try {
      await until(() => f.contentDocument && f.contentDocument.querySelector(ready), 10000, `"${hash}" never showed ${ready}`);
    } catch (e) {
      f.remove();
      if (attempt >= 1) throw e;
      continue;
    }
    await sleep(60);
    return { doc: f.contentDocument, win: f.contentWindow, frame: f, close: () => f.remove(), $: (sel) => f.contentDocument.querySelector(sel), $$: (sel) => [...f.contentDocument.querySelectorAll(sel)] };
  }
}

await C.loadContent();

/* ------------------------------------------------------------------ search */
let bench = null;
if (on('search')) {
  suite('Search');
  const refsOf = (list) => { const out = []; for (const r of list) if (!out.includes(r.ref)) out.push(r.ref); return out; };
  const run = (q) => {
    if (S.searchDetailed) { const d = S.searchDetailed(q, { limit: 30 }); return { top: refsOf(d.results), broader: refsOf(d.broader), note: d.note || '' }; }
    return { top: refsOf(S.search(q, { limit: 30 })), broader: [] };
  };
  const b = score(run);
  bench = { ...b, sets: SETS };
  await test('benchmark ran', () => `${fixtures.length} queries`);

  // Floors, set a little under what the search achieves today. A change that lowers either
  // number, or raises the count of misleading answers, has made search worse.
  const t = b.tuned, hd = b.heldout;
  await test('answers at least 117 of the 121 answerable questions in the tuned sets', () => { assert(t.answered >= 117, `answered ${t.answered} of ${t.answerable}`); return `${t.answered} of ${t.answerable}`; });
  await test('at least 85% of what it shows for those questions is right', () => { assert(t.precision >= 0.85, `precision ${(t.precision * 100).toFixed(0)}%`); return `${(t.precision * 100).toFixed(0)}%`; });
  await test('at most 2 misleading answers in the tuned sets', () => { assert(t.misleading <= 2, `${t.misleading} misleading: ${b.rows.filter((r) => r.set !== 'heldout' && r.verdict === 'wrong').map((r) => r.q).join(' | ')}`); return `${t.misleading}`; });
  await test('held-out questions: answers at least 28 of 35, at least 80% right', () => { assert(hd.answered >= 28 && hd.precision >= 0.8, `answered ${hd.answered} of ${hd.answerable}, precision ${(hd.precision * 100).toFixed(0)}%`); return `${hd.answered} of ${hd.answerable}, ${(hd.precision * 100).toFixed(0)}%`; });
  await test('stays quiet when it has no answer', () => {
    const loud = b.rows.filter((r) => r.none && r.verdict !== 'pass').map((r) => `${r.q} -> ${r.top.join(', ')}`);
    assert(loud.length <= 1, loud.join(' | '));
    return `${b.all.quietWhenUnanswerable} of ${b.all.unanswerable}`;
  });
  await test('never shows a result the benchmark forbids, outside the two known cases', () => {
    const known = ['zip code lookup', 'generic programming'];
    const bad = b.rows.filter((r) => r.forbidden.length && !known.includes(r.q)).map((r) => `${r.q} -> ${r.forbidden.join(', ')}`);
    assert(!bad.length, bad.join(' | '));
  });

  const { intents, synonymGroups } = await import('../content/synonyms.js');
  await test('every intent fires on its own examples and on none of its counter-examples', () => {
    const bad = [];
    for (const it of intents) {
      assert(it.yes && it.yes.length && it.no && it.no.length, `intent "${it.id}" has no examples`);
      for (const q of it.yes) if (!it.test.test(q)) bad.push(`${it.id} should fire on "${q}"`);
      for (const q of it.no) if (it.test.test(q)) bad.push(`${it.id} must not fire on "${q}"`);
      for (const ref of it.refs) assert(C.resolveRef(ref).name && (C.algoById[ref] || C.plannedById[ref] || ref.includes(':')), `intent "${it.id}" points at unknown "${ref}"`);
    }
    assert(!bad.length, bad.join(' | '));
    return `${intents.length} intents`;
  });
  await test('no intent fires on a longer word that merely contains its keyword', () => {
    const traps = { biology: ['generate', 'general', 'generic', 'regenerate'], spelling: ['diffusion', 'different', 'differential'], sort: ['resort', 'assorted', 'consortium'], primes: ['primer', 'primary', 'prim'], compress: ['zipper'], rank: ['frankly'], audio: ['soundness'] };
    const bad = [];
    for (const [id, list] of Object.entries(traps)) { const it = intents.find((x) => x.id === id); assert(it, `no intent "${id}"`); for (const w of list) if (it.test.test(w)) bad.push(`${id} fires on "${w}"`); }
    assert(!bad.length, bad.join(' | '));
  });
  await test('word forms: plurals and endings reduce to the same stem as the plain word', () => {
    const same = [['price', 'prices'], ['page', 'pages'], ['movie', 'movies'], ['city', 'cities'], ['match', 'matches'], ['box', 'boxes'], ['class', 'classes'], ['route', 'routes'], ['vertex', 'vertices'], ['sort', 'sorting'], ['sort', 'sorted'], ['plan', 'planning'], ['compress', 'compressing'], ['prime', 'primes'], ['frequency', 'frequencies']];
    const bad = same.filter(([a, c]) => S.forms(a)[0] !== S.forms(c)[0]).map(([a, c]) => `${a}/${c}: ${S.forms(a)[0]} vs ${S.forms(c)[0]}`);
    // "coding" may come from "code": one of its forms must equal the plain word
    for (const [a, c] of [['code', 'coding'], ['route', 'routing'], ['encode', 'encoded'], ['sample', 'sampling']]) if (!S.forms(c).includes(S.forms(a)[0])) bad.push(`${a}/${c}`);
    // and these must stay apart
    for (const [a, c] of [['gene', 'generate'], ['prim', 'prime'], ['string', 'str'], ['class', 'clas'], ['analysis', 'analysi']]) if (S.forms(a)[0] === S.forms(c)[0] && a !== c && S.forms(a)[0] !== a) bad.push(`${a} collapses to ${S.forms(a)[0]}`);
    assert(S.forms('string')[0] === 'string' && S.forms('class')[0] === 'class' && S.forms('analysis')[0] === 'analysis' && S.forms('gps')[0] === 'gps', 'a word that is not a plural was shortened');
    assert(!bad.length, bad.join(' | '));
  });
  await test('a word the atlas knows is never "corrected" into another', () => {
    for (const q of ['prim', 'gene', 'hash', 'heap', 'sort', 'tree']) { const d = S.searchDetailed(q); assert(!d.corrected.length, `"${q}" was corrected to "${(d.corrected[0] || {}).to}"`); }
    const d = S.searchDetailed('djikstra');
    assert(d.corrected.length === 1 && d.corrected[0].to === 'dijkstra' && /dijkstra/.test(d.note), `"djikstra" was not corrected: ${JSON.stringify(d.corrected)}`);
  });
  await test('loose suggestions are kept apart from results', () => {
    const d = S.searchDetailed('forecast for zanzibar');
    assert(d.results.length === 0, `"forecast for zanzibar" claims ${d.results.length} results`);
    assert(d.broader.length && d.broader.every((r) => r.broader), 'no labelled suggestions for "forecast for zanzibar"');
    assert(/zanzibar/.test(d.note), 'the note does not say which word was not found');
    assert(S.searchDetailed('pizza recipe').broader.length === 0 && S.searchDetailed('random forest').broader.length === 0, 'suggestions offered for a query with nothing distinctive in it');
  });
  await test('typing a name finds it before the name is finished', () => {
    for (const [typed, ref] of [['dij', 'dijkstra'], ['binar', 'binary-search'], ['huff', 'huffman-coding'], ['merge so', 'merge-sort'], ['knaps', 'knapsack']]) {
      const got = S.suggest(typed).map((r) => r.ref);
      assert(got[0] === ref, `typing "${typed}" leads with ${got[0]}, not ${ref}`);
    }
  });
  await test('the search page shows a best match, and labels loose suggestions', async () => {
    const p = await open('/search?q=shortest%20route%20between%20two%20places', '.result');
    try {
      const best = p.$('.result-best .result-title');
      assert(best && /Dijkstra/.test(best.textContent), `best match is "${best ? best.textContent : 'missing'}"`);
      assert(p.$('.result-best a').getAttribute('href') === '#/algorithm/dijkstra', 'the best match does not link to the lesson');
    } finally { p.close(); }
    const q = await open('/search?q=forecast%20for%20zanzibar', '.empty');
    try {
      assert(/No lesson answers/.test(q.$('.empty').textContent), 'the page does not say that nothing answers the query');
      assert(q.$('.result-group.is-broader h2') && /Loosely related/.test(q.$('.result-group.is-broader h2').textContent), 'loose suggestions are not labelled');
      assert(!q.$('.result-best'), 'a loose suggestion is presented as the best match');
    } finally { q.close(); }
  });
  await test('typing a question into the search box on the home page offers the lesson', async () => {
    const p = await open('/', '.hero .sb-input');
    try {
      const input = p.$('.hero .sb-input');
      input.focus();
      input.value = 'why does my GPS reroute';
      input.dispatchEvent(new p.win.Event('input', { bubbles: true }));
      await until(() => p.$('.hero .sb-item'), 3000, 'no suggestions appeared');
      const first = p.$('.hero .sb-item .sb-title').textContent;
      assert(/Dijkstra/.test(first), `the first suggestion is "${first}"`);
      return first;
    } finally { p.close(); }
  });
}

/* ------------------------------------------------------------------ defects */
if (on('defects')) {
  suite('Confirmed defects');
  const { createQuiz } = await import('../js/ui/quiz.js');
  const { CONNECTION_LABELS } = await import('../js/core/schema.js');

  // 1. Linear Search showed values as checked before checking anything.
  await test('Linear Search: nothing is listed as checked at step 1 (lesson page)', async () => {
    const p = await open('/algorithm/linear-search', '.viz-row');
    try {
      assert(/Step 1 \//.test(p.$('.step-label').textContent), 'the player did not open on step 1');
      const row = p.$$('.viz-row').find((r) => r.querySelector('.viz-row-label').textContent.trim() === 'Checked');
      assert(row, 'there is no "Checked" row');
      const n = row.querySelectorAll('.viz-cell').length;
      assert(n === 0, `step 1 lists ${n} values as checked`);
      // stepping forward three times must list exactly three checked values, unless the target was found sooner
      const fwd = p.$('.transport-buttons button[aria-label="Step forward"]');
      fwd.click(); fwd.click(); fwd.click();
      // three steps on: two values have been checked and rejected, and the third is being looked at
      const after = p.$$('.viz-row').find((r) => r.querySelector('.viz-row-label').textContent.trim() === 'Checked').querySelectorAll('.viz-cell').length;
      assert(after === 2, `after three steps the page lists ${after} checked values, not 2`);
    } finally { p.close(); }
  });
  await test('Linear Search: nothing is listed as checked at step 1 (the lab, where it is the default)', async () => {
    const p = await open('/lab', '.viz-row');
    try {
      const row = p.$$('.viz-row').find((r) => r.querySelector('.viz-row-label').textContent.trim() === 'Checked');
      if (!row) return 'the lab no longer opens on Linear Search; nothing to check';
      const n = row.querySelectorAll('.viz-cell').length;
      assert(n === 0, `step 1 lists ${n} values as checked`);
    } finally { p.close(); }
  });

  // 2. A right answer read "Correct. Correct."
  await test('Quiz: no answer in any lesson gets a doubled verdict', async () => {
    const doubled = /^\s*(Correct|Not quite)[.!]\s*(Correct|Right|Yes|Not quite|Not yet|Incorrect|Wrong)\b/i;
    let seen = 0; const bad = [];
    for (const a of C.algos) {
      const L = await C.loadLesson(a.id);
      const el = createQuiz(L);
      for (const item of el.querySelectorAll('.quiz-item:not(.is-challenge)')) {
        const options = [...item.querySelectorAll('.quiz-option')];
        for (const [i, b] of options.entries()) {
          b.click();
          const text = item.querySelector('.quiz-feedback').textContent;
          seen++;
          if (doubled.test(text)) bad.push(`${a.id}: "${text.slice(0, 50)}"`);
          if (text.replace(/^\s*(Correct|Not quite)[.!]\s*/, '').replace(/Try another answer\.\s*$/, '').trim().length < 12) bad.push(`${a.id} option ${i + 1}: the explanation is missing`);
        }
      }
    }
    assert(seen > 500, `only ${seen} answers were exercised`);
    assert(!bad.length, `${bad.length} of ${seen} answers: ${bad.slice(0, 3).join(' | ')}`);
    return `${seen} answers across ${C.algos.length} lessons`;
  });
  await test('Quiz: the first Dijkstra question, answered correctly on the page', async () => {
    const p = await open('/algorithm/dijkstra?level=2', '.quiz-item .quiz-option');
    try {
      const L = await C.loadLesson('dijkstra');
      const item = p.$('.quiz-item');
      item.querySelectorAll('.quiz-option')[L.quiz[0].answer].click();
      const text = item.querySelector('.quiz-feedback').textContent.trim();
      assert(/^Correct\. [A-Z]/.test(text), `feedback reads "${text.slice(0, 60)}"`);
      assert(!/^Correct\.\s*Correct/.test(text), `feedback reads "${text.slice(0, 40)}"`);
      return text.slice(0, 70);
    } finally { p.close(); }
  });

  // 3. A contents link, copied or opened in a new tab, led to "There is no page at this address."
  await test('Contents links: every one is a real address that opens its section', async () => {
    const p = await open('/algorithm/dijkstra?level=3', '.toc-link');
    let links;
    try { links = p.$$('.toc-link').map((a) => ({ href: a.getAttribute('href'), title: a.textContent.trim() })); } finally { p.close(); }
    assert(links.length >= 10, `only ${links.length} contents links`);
    for (const l of links) assert(/^#\/algorithm\/dijkstra\?/.test(l.href), `"${l.title}" links to "${l.href}", which is not a page`);
    // open three of them cold, the way a pasted link would arrive, at a shallower saved level
    for (const l of [links[1], links[5], links[links.length - 3]]) {
      const q = await open(l.href.slice(1), '.lesson');
      try {
        await sleep(1800);
        assert(!/There is no page at this address/.test(q.doc.body.textContent), `"${l.href}" shows the not-found page`);
        const id = new URLSearchParams(l.href.split('?')[1]).get('at');
        const target = q.doc.getElementById(id);
        assert(target, `"${l.href}" has no section "${id}"`);
        assert(target.offsetParent !== null, `"${l.href}" opens with the section "${id}" hidden`);
        const top = target.getBoundingClientRect().top;
        assert(top > -40 && top < 500, `"${l.href}" opens with "${id}" ${Math.round(top)}px from the top of the window`);
      } finally { q.close(); }
    }
    return `${links.length} links`;
  });

  // 4. The connection graph filed neighbours under the wrong kind of relationship.
  const stated = (id) => { const a = C.algoById[id]; return new Map((a.connections || []).map((c) => [c.to, c.type])); };
  await test('Connection graph: every lesson at the centre agrees with what that lesson says', () => {
    const bad = [];
    for (const a of C.algos) {
      const own = stated(a.id);
      const home = new Set([a.discipline, ...(a.alsoIn || []).map((d) => d.id)].map((d) => `discipline:${d}`));
      for (const n of C.neighbours(a.id)) {
        if (home.has(n.ref)) continue; // a lesson's own fields are shown as "belongs to" and "applied in"
        if (own.has(n.ref)) { if (n.role !== own.get(n.ref)) bad.push(`${a.id}: the lesson calls ${n.ref} "${own.get(n.ref)}", the graph says "${n.role}"`); }
        // a neighbour the lesson does not mention may not be given one of the lesson's own claims
        else if (!n.ref.startsWith('discipline:') && ['prerequisite', 'advanced', 'application'].includes(n.role)) bad.push(`${a.id}: the graph files ${n.ref} under "${n.role}", which the lesson never states`);
      }
    }
    assert(!bad.length, `${bad.length} disagreements: ${bad.slice(0, 3).join(' | ')}`);
  });
  await test('Connection graph: Dijkstra at the centre, as drawn on the page', async () => {
    const p = await open('/connections?view=graph&at=dijkstra', '.rel-group');
    try {
      const groups = Object.fromEntries(p.$$('.rel-group').map((g) => [g.querySelector('h4').textContent.trim(), [...g.querySelectorAll('.rel-name')].map((x) => x.textContent.replace(/\s*Planned\s*$/, '').trim())]));
      const own = stated('dijkstra');
      const where = (name) => Object.keys(groups).find((k) => groups[k].includes(name));
      for (const [ref, type] of own) {
        const name = C.resolveRef(ref).name;
        assert(where(name) === CONNECTION_LABELS[type], `the lesson calls ${name} "${CONNECTION_LABELS[type]}", the page files it under "${where(name)}"`);
      }
      assert(where('Breadth-First Search') === 'Prerequisite', `Breadth-First Search is under "${where('Breadth-First Search')}"`);
      assert(where('Heap Sort') !== 'Applied in', 'Heap Sort is still under "Applied in"');
      return Object.entries(groups).map(([k, v]) => `${k}: ${v.length}`).join(', ');
    } finally { p.close(); }
  });

  // 5. Search matched inside words and missed plurals. The benchmark covers this at length;
  //    these are the specific reported cases.
  await test('Search: "generate" does not match "gene"', () => {
    const refs = S.search('generate random numbers').slice(0, 5).map((r) => r.ref);
    for (const wrong of ['needleman-wunsch', 'edit-distance', 'lcs']) assert(!refs.includes(wrong), `"generate random numbers" returns ${wrong}`);
    const dna = S.search('compare two genes').slice(0, 3).map((r) => r.ref);
    assert(dna.includes('needleman-wunsch'), `"compare two genes" no longer finds sequence alignment: ${dna.join(', ')}`);
  });
  await test('Search: a plural finds what its singular finds', () => {
    const top = (q) => (S.search(q)[0] || {}).ref;
    const pairs = [['predict a house price', 'predict house prices'], ['rank a web page', 'ranking web pages'], ['find a duplicate', 'find duplicates'], ['recommend a movie', 'recommend movies'], ['compress a file', 'compressing files'], ['detect a cycle', 'detecting cycles']];
    for (const [one, many] of pairs) { assert(top(one), `"${one}" finds nothing`); assert(top(one) === top(many), `"${one}" leads with ${top(one)} but "${many}" leads with ${top(many)}`); }
  });
}

/* ------------------------------------------------------------------ the "I want to" index */
if (on('index')) {
  suite('"I want to" index');
  const P = await import('../js/core/problems.js');
  const index = P.problemIndex();
  // the source of truth, read straight from the lessons, without going through the module under test
  const declared = new Map();
  for (const a of C.algos) for (const t of a.tags.problems || []) { const k = t.trim().toLowerCase(); if (!declared.has(k)) declared.set(k, new Set()); declared.get(k).add(a.id); }

  await test('it lists every phrase the lessons declare, once, and nothing else', () => {
    assert(index.total === declared.size, `the index has ${index.total} phrases, the lessons declare ${declared.size}`);
    const listed = index.categories.flatMap((c) => c.phrases.map((p) => p.key));
    assert(listed.length === new Set(listed).size, 'a phrase is listed twice');
    assert(listed.length === declared.size, `${listed.length} phrases are in groups, ${declared.size} are declared`);
    for (const p of index.phrases) {
      const want = declared.get(p.key);
      assert(want, `"${p.text}" is not declared by any lesson`);
      assert(p.lessons.length === want.size && p.lessons.every((l) => want.has(l.id)), `"${p.text}" leads to ${p.lessons.map((l) => l.id).join(', ')} but is declared by ${[...want].join(', ')}`);
    }
    return `${index.total} phrases from ${C.algos.length} lessons`;
  });
  await test('every published lesson can be reached from it', () => {
    const reached = new Set(index.phrases.flatMap((p) => p.lessons.map((l) => l.id)));
    const missing = C.algos.filter((a) => !reached.has(a.id)).map((a) => a.id);
    assert(!missing.length, `no phrase leads to: ${missing.join(', ')}`);
  });
  await test('every group has an everyday heading that differs from the technical name', () => {
    for (const c of index.categories) assert(c.want && c.want !== c.name && c.want.length > 12, `group "${c.id}" has no plain heading`);
    return `${index.categories.length} groups`;
  });
  await test('"and N more" leads to a search that lists every lesson for that phrase', () => {
    const many = index.phrases.filter((p) => p.lessons.length > 3);
    assert(many.length, 'no phrase has more than three lessons, so nothing to check');
    for (const p of many) {
      const got = new Set(S.search(p.text, { limit: 60 }).filter((r) => r.type === 'algorithm').map((r) => r.ref));
      const lost = p.lessons.filter((l) => !got.has(l.id)).map((l) => l.id);
      assert(!lost.length, `searching "${p.text}" does not list ${lost.join(', ')}`);
    }
    return `${many.length} phrases`;
  });
  await test('the filter finds lessons from everyday words, with no algorithm named', () => {
    // word typed -> a lesson that must be among the destinations
    const cases = { route: 'dijkstra', order: 'quick-sort', smaller: 'huffman-coding', secret: 'rsa', groups: 'k-means', primes: 'sieve-of-eratosthenes', spam: 'logistic-regression', recommend: 'knn', maze: 'bfs', duplicates: 'hash-table', 'house price': 'linear-regression', 'neural network': 'backpropagation', 'web pages': 'pagerank', dependencies: 'topological-sort', spelling: 'edit-distance', bag: 'knapsack', dna: 'needleman-wunsch', frequencies: 'fft', 'random file': 'reservoir-sampling', robot: 'rrt' };
    const bad = [];
    for (const [typed, id] of Object.entries(cases)) {
      const found = P.filterPhrases(typed);
      if (!found.some((p) => p.lessons.some((l) => l.id === id))) bad.push(`"${typed}" does not lead to ${id} (${found.length} phrases)`);
      const name = C.algoById[id].name.toLowerCase();
      if (typed.split(' ').some((w) => w.length > 3 && name.includes(w))) bad.push(`the test word "${typed}" is part of the name "${name}"`);
    }
    assert(!bad.length, bad.join(' | '));
    assert(P.filterPhrases('qwertyuiop').length === 0, 'nonsense matched something');
    assert(P.filterPhrases('generate').every((p) => !/gene\b/.test(p.text)), '"generate" matched a phrase about genes');
    return `${Object.keys(cases).length} everyday words`;
  });

  await test('the page shows a few phrases per group, and the rest on request', async () => {
    const p = await open('/problems', '.want-row');
    try {
      const groups = p.$$('.want-group');
      assert(groups.length === index.categories.length, `${groups.length} groups on the page, ${index.categories.length} in the index`);
      const shown = p.$$('.want-row').length;
      assert(shown <= index.categories.length * P.PREVIEW, `${shown} phrases are shown at once`);
      assert(shown < index.total / 3, `${shown} of ${index.total} phrases are shown before anyone asks`);
      const toggle = groups[0].querySelector('.want-toggle');
      const before = groups[0].querySelectorAll('.want-row').length;
      toggle.click();
      await sleep(80);
      const g0 = p.$$('.want-group')[0];
      assert(g0.querySelectorAll('.want-row').length === index.categories[0].phrases.length, 'opening a group did not show all of it');
      assert(g0.querySelector('.want-toggle').getAttribute('aria-expanded') === 'true', 'the toggle does not report that the group is open');
      return `${shown} of ${index.total} shown at first; the first group opens from ${before} to ${index.categories[0].phrases.length}`;
    } finally { p.close(); }
  });
  await test('every link on the page, with every group open, goes to a published lesson or a working search', async () => {
    const p = await open(`/problems?open=${index.categories.map((c) => c.id).join(',')}`, '.want-row');
    try {
      const rows = p.$$('.want-row');
      assert(rows.length === index.total, `${rows.length} rows with everything open, ${index.total} phrases`);
      let links = 0;
      for (const row of rows) {
        const as = [...row.querySelectorAll('a')];
        assert(as.length >= 2, `"${row.textContent.slice(0, 40)}" has no destination`);
        for (const a of as) {
          links++;
          const hrefAttr = a.getAttribute('href');
          const lesson = hrefAttr.match(/^#\/algorithm\/([a-z0-9-]+)$/);
          if (lesson) assert(C.algoById[lesson[1]], `${hrefAttr} is not a published lesson`);
          else assert(/^#\/search\?q=/.test(hrefAttr), `${hrefAttr} is neither a lesson nor a search`);
        }
        // the phrase itself must link to a lesson that declares that phrase
        const key = row.querySelector('.want-phrase').textContent.trim().toLowerCase();
        const id = row.querySelector('.want-phrase').getAttribute('href').split('/').pop();
        assert(declared.get(key) && declared.get(key).has(id), `"${key}" links to ${id}, which does not declare it`);
      }
      return `${rows.length} rows, ${links} links`;
    } finally { p.close(); }
  });
  await test('typing in the filter narrows the page, and an unmatched word offers the full search', async () => {
    const p = await open('/problems', '.want-row');
    try {
      const input = p.$('.want-search input');
      const type = async (v) => { input.value = v; input.dispatchEvent(new p.win.Event('input', { bubbles: true })); await sleep(260); };
      await type('route');
      const rows = p.$$('.want-row');
      assert(rows.length > 0 && rows.length < 25, `"route" leaves ${rows.length} rows`);
      assert(rows.some((r) => /Dijkstra/.test(r.textContent)), '"route" does not show Dijkstra');
      assert(/match/.test(p.$('.want-count-line').textContent), 'the count line does not report the matches');
      await type('zanzibar');
      assert(p.$$('.want-row').length === 0 && p.$('.empty a[href^="#/search?q=zanzibar"]'), 'an unmatched word does not offer the full search');
    } finally { p.close(); }
  });
  await test('a newcomer can go from the home page to a running lesson without typing a name', async () => {
    const p = await open('/', '.hero-try a[href="#/problems"]');
    try {
      // the goal list left the home page; the way in is now the line under the search box
      assert(!p.$('.home-want') && !p.$('.levels-demo'), 'a section that was taken off the home page is back');
      p.$('.hero-try a[href="#/problems"]').click();
      await until(() => p.$('.want-row'), 5000, 'the index did not open from the home page');
      const row = p.$$('.want-row').find((r) => /Fastest way between two places/i.test(r.textContent));
      assert(row, 'the phrase "Fastest way between two places" is not among those shown first');
      row.querySelector('.want-phrase').click();
      await until(() => p.$('.lesson h1'), 8000, 'the lesson did not open');
      assert(/Dijkstra/.test(p.$('.lesson h1').textContent), `opened "${p.$('.lesson h1').textContent}"`);
      await until(() => p.$('.player-note .note-text'), 5000, 'the demonstration is not on the page');
      return 'home, then "browse by what you want to do", then "Fastest way between two places", then the Dijkstra lesson: two clicks';
    } finally { p.close(); }
  });
  await test('at phone width the page fits and each phrase is a comfortable target', async () => {
    const p = await open('/problems', '.want-row', { width: 375, height: 812 });
    try {
      const doc = p.doc.documentElement;
      assert(doc.scrollWidth <= 376, `the page is ${doc.scrollWidth}px wide in a 375px window`);
      const cols = new Set(p.$$('.want-group').map((g) => Math.round(g.getBoundingClientRect().left)));
      assert(cols.size === 1, 'the groups are not in a single column');
      const small = p.$$('.want-row').filter((r) => r.getBoundingClientRect().height < 44).length;
      assert(small === 0, `${small} rows are shorter than 44px`);
    } finally { p.close(); }
  });
}

/* ------------------------------------------------------------------ links and relationships */
const SECTIONS = ['simple', 'example', 'see', 'decide', 'words', 'how', 'code', 'matters', 'wrong', 'check', 'technical', 'correctness', 'history', 'connections', 'takeaway'];
const KITCHEN_IDS = (await import('../content/kitchen.js')).kitchen.map((c) => c.id);
const STATIC = ['/', '/kitchen', '/track/ai', '/track/business', '/case/budget', '/explore', '/disciplines', '/library', '/problems', '/lab', '/compare', '/paths', '/connections', '/search', '/profile', '/about', '/verification'];
// Does an internal address lead to something that exists? Written from the content, not from the router.
function resolves(hrefAttr) {
  const raw = hrefAttr.replace(/^#/, '');
  const [path, qs = ''] = raw.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs));
  const seg = path.split('/').filter(Boolean);
  const okRef = (ref) => { const r = C.resolveRef(ref); return r.kind === 'algorithm' || (r.kind === 'concept' && C.conceptById[r.id]) || (r.kind === 'discipline' && C.disciplineById[r.id]); };
  if (STATIC.includes(path || '/')) {
    if (path === '/connections' && q.at && !okRef(q.at)) return `connections at "${q.at}"`;
    if (path === '/connections' && q.thread && !C.threads.some((t) => t.id === q.thread)) return `no thread "${q.thread}"`;
    if (path === '/explore' && q.d && !C.disciplineById[q.d]) return `no discipline "${q.d}"`;
    if (path === '/explore' && q.a && !C.algoById[q.a]) return `no lesson "${q.a}"`;
    if (path === '/library' && q.discipline && !C.disciplineById[q.discipline]) return `no discipline "${q.discipline}"`;
    if (path === '/kitchen' && q.at && !KITCHEN_IDS.includes(q.at)) return `no recipe "${q.at}"`;
    if (path === '/about' && q.at && !['accessibility', 'checks', 'content', 'method', 'privacy', 'how', 'principles', 'schema', 'limits'].includes(q.at)) return null; // sections of About are checked on the page itself
    return null;
  }
  if (seg.length !== 2) return 'no such route';
  const [kind, id] = [seg[0], decodeURIComponent(seg[1])];
  if (kind === 'algorithm') {
    if (!C.algoById[id] && !C.plannedById[id]) return `no lesson "${id}"`;
    if (q.at && !SECTIONS.includes(q.at)) return `no section "${q.at}"`;
    if (q.path && !(C.pathById[q.path] && C.pathById[q.path].stages.some((st) => st.modules.some((m) => m.algo === id)))) return `path "${q.path}" does not contain "${id}"`;
    if (q.level && !['1', '2', '3'].includes(q.level)) return `no level "${q.level}"`;
    return null;
  }
  if (kind === 'lab') return C.algoById[id] ? null : `no demonstration "${id}"`;
  if (kind === 'case') return C.caseById[id] ? null : `no worked case "${id}"`;
  if (kind === 'concept') return C.conceptById[id] ? null : `no concept "${id}"`;
  if (kind === 'discipline') return C.disciplineById[id] ? null : `no discipline "${id}"`;
  if (kind === 'path') return C.pathById[id] ? null : `no path "${id}"`;
  if (kind === 'compare') {
    const g = C.compareGroups.find((x) => x.id === id);
    if (!g) return `no comparison "${id}"`;
    for (const m of (q.ids || '').split(',').filter(Boolean)) if (!g.members.includes(m)) return `"${m}" is not in comparison "${id}"`;
    return null;
  }
  return 'no such route';
}

if (on('links')) {
  suite('Links and relationships');
  await test('every stated connection points at something that exists, and none points at itself', () => {
    const bad = []; let n = 0;
    for (const a of C.algos) {
      for (const c of a.connections || []) {
        n++;
        const r = C.resolveRef(c.to);
        if (c.to === a.id) bad.push(`${a.id} is connected to itself`);
        if (r.kind === 'planned' && !C.plannedById[c.to]) bad.push(`${a.id} -> ${c.to}: no such lesson, published or planned`);
        if (r.kind === 'concept' && !C.conceptById[r.id]) bad.push(`${a.id} -> ${c.to}: no such concept`);
        if (r.kind === 'discipline' && !C.disciplineById[r.id]) bad.push(`${a.id} -> ${c.to}: no such discipline`);
        if (!c.why || c.why.length < 30) bad.push(`${a.id} -> ${c.to}: no reason given`);
      }
      for (const pre of a.prerequisites || []) if (C.resolveRef(pre).kind === 'planned' && !C.plannedById[pre]) bad.push(`${a.id} assumes unknown "${pre}"`);
    }
    assert(!bad.length, `${bad.length}: ${bad.slice(0, 4).join(' | ')}`);
    return `${n} connections`;
  });
  await test('no two lessons contradict each other about which comes first', () => {
    const bad = [];
    const typeOf = (from, to) => ((C.algoById[from].connections || []).find((c) => c.to === to) || {}).type;
    for (const a of C.algos) for (const c of a.connections || []) {
      if (!C.algoById[c.to] || a.id > c.to) continue;
      const back = typeOf(c.to, a.id);
      if (!back) continue;
      // each says the other must come first, or each says the other goes further
      if (c.type === 'prerequisite' && back === 'prerequisite') bad.push(`${a.id} and ${c.to} each call the other a prerequisite`);
      if (c.type === 'advanced' && back === 'advanced') bad.push(`${a.id} and ${c.to} each call the other "go further"`);
    }
    assert(!bad.length, bad.join(' | '));
  });
  await test('a learning path says a lesson is planned only where one of its lessons really is', () => {
    const bad = [];
    for (const path of C.paths) {
      const all = path.stages.flatMap((st) => st.modules);
      const anyPlanned = all.some((m) => !C.algoById[m.algo]);
      for (const k of ['blurb', 'audience']) if (/\bplanned\b/i.test(path[k] || '') && !anyPlanned) bad.push(`${path.id}: its ${k} mentions a planned lesson, but every lesson on the path is published`);
      for (const st of path.stages) if (/\bplanned\b/i.test(st.goal || '') && !st.modules.some((m) => !C.algoById[m.algo])) bad.push(`${path.id} / ${st.id}: the goal mentions a planned lesson, but every lesson in the stage is published`);
    }
    assert(!bad.length, bad.join(' | '));
  });
  await test('no chain of prerequisites leads back to where it started', () => {
    const pre = (id) => (C.algoById[id].connections || []).filter((c) => c.type === 'prerequisite' && C.algoById[c.to]).map((c) => c.to);
    const state = {}; const loops = [];
    const walk = (id, trail) => { if (state[id] === 2) return; if (state[id] === 1) { loops.push([...trail.slice(trail.indexOf(id)), id].join(' -> ')); return; } state[id] = 1; for (const p of pre(id)) walk(p, [...trail, id]); state[id] = 2; };
    for (const a of C.algos) walk(a.id, []);
    assert(!loops.length, loops.slice(0, 3).join(' | '));
  });

  await test('a lesson page carries no verification line, and its record is on the Verification page', async () => {
    const p = await open('/algorithm/merge-sort', '.lesson h1');
    try {
      assert(!p.$('.check-line') && !p.$('.check-host'), 'the lesson still shows the verification line');
      assert(!/Checked\.\s+\d+ tests? of the demonstration/.test(p.$('.lesson-head').textContent), 'the lesson header still carries the "Checked" sentence');
    } finally { p.close(); }
    const q = await open('/verification?lesson=merge-sort', '.check-panel');
    try {
      assert(/Merge Sort/.test(q.$('#example').textContent), 'the Verification page does not show the record of the lesson asked for');
      assert(q.$$('.vledger a[href^="#/verification?lesson="]').length === C.algos.length, 'the table does not link to every lesson\'s record');
    } finally { q.close(); }
  });
  await test('the skip link moves to the content and does not leave the page', async () => {
    const p = await open('/library', '.lib-results');
    try {
      const title = p.$('#main h1').textContent;
      p.$('.skip-link').click();
      await sleep(250);
      assert(p.$('#main h1') && p.$('#main h1').textContent === title, `after the skip link the page shows "${p.$('#main h1') ? p.$('#main h1').textContent : 'nothing'}"`);
      assert(p.win.location.hash === '#/library', `the address became ${p.win.location.hash}`);
      assert(p.doc.activeElement && p.doc.activeElement.id === 'main', 'focus did not move to the content');
    } finally { p.close(); }
  });
  await test('a link to a thread opens the Connections page at that thread', async () => {
    const t = C.threads[2];
    const p = await open(`/connections?thread=${t.id}`, `#thread-${t.id}`);
    try {
      assert(!p.$('#graph') || p.$('#graph').hidden, 'the graph is showing instead of the threads');
      const at = () => p.$(`#thread-${t.id}`).getBoundingClientRect().top;
      await until(() => at() > -20 && at() < 400, 2500, `the thread is ${Math.round(at())}px from the top`);
      assert(p.$$('.thread-index a').every((a) => /^#\/connections\?thread=/.test(a.getAttribute('href'))), 'a thread link is not a real address');
    } finally { p.close(); }
  });
  await test('every internal link on every page leads somewhere that exists', async () => {
    const routes = [
      ...STATIC.filter((r) => r !== '/search'), '/search?q=shortest%20route', '/connections?view=graph&at=dijkstra',
      ...C.algos.map((a) => `/algorithm/${a.id}?level=3`), ...C.planned.map((r) => `/algorithm/${r.id}`),
      ...C.disciplines.map((d) => `/discipline/${d.id}`), ...C.paths.map((p) => `/path/${p.id}`),
      ...C.concepts.map((c) => `/concept/${c.id}`), ...C.compareGroups.map((g) => `/compare/${g.id}`), '/lab/dijkstra', '/lab/quick-sort',
    ];
    const p = await open('/about', '#main h1');
    const errors = [];
    p.win.addEventListener('error', (e) => errors.push(e.message));
    p.win.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason && e.reason.message ? e.reason.message : e.reason)));
    const bad = []; let links = 0; const pages = new Set();
    try {
      const main = p.$('#main');
      for (const r of routes) {
        const was = main.firstElementChild;
        const before = errors.length;
        p.win.location.hash = r;
        await until(() => main.firstElementChild && main.firstElementChild !== was && !main.hasAttribute('aria-busy'), 12000, `"${r}" never rendered`);
        await sleep(20);
        if (/There is no (page|lesson) at this address/.test(main.textContent)) bad.push(`${r} shows the not-found page`);
        if (errors.length > before) bad.push(`${r} raised: ${errors.slice(before).join('; ').slice(0, 120)}`);
        pages.add(r);
        for (const a of p.doc.querySelectorAll('a[href]')) {
          const hrefAttr = a.getAttribute('href');
          if (!hrefAttr.startsWith('#')) continue;
          links++;
          if (!hrefAttr.startsWith('#/')) {
            // an in-page link is fine only if its target is on the page; the router then treats it as a jump, not a route
            if (!p.doc.getElementById(hrefAttr.slice(1))) bad.push(`"${a.textContent.trim().slice(0, 30)}" links to "${hrefAttr}", which is neither a page nor a place on this page`);
            continue;
          }
          const why = resolves(hrefAttr);
          if (why) bad.push(`${r}: "${a.textContent.trim().slice(0, 30)}" -> ${hrefAttr} (${why})`);
        }
      }
    } finally { p.close(); }
    const unique = [...new Set(bad)];
    assert(!unique.length, `${unique.length} problems: ${unique.slice(0, 5).join(' | ')}`);
    return `${pages.size} pages, ${links} links`;
  });
}

/* ------------------------------------------------------------------ what to read next */
if (on('learning')) {
  suite('Recommendations and next steps');
  const N = await import('../js/core/next.js');
  const R = await import('../js/core/recommend.js');
  const { store } = await import('../js/core/store.js');
  const conn = (from, to) => (C.algoById[from].connections || []).find((c) => c.to === to);
  const pathWhys = new Set(C.paths.flatMap((p) => p.stages.flatMap((st) => st.modules.map((m) => m.why))));

  await test('every suggested next step is a stated connection, labelled as what it is', () => {
    const bad = []; const tally = { advanced: 0, 'builds-on': 0, 'same-problem': 0, variant: 0, application: 0, related: 0, none: 0 }; const without = [];
    for (const a of C.algos) {
      const s = N.nextStep(a.id);
      if (!s) { tally.none++; without.push(a.id); continue; }
      tally[s.kind]++;
      if (!C.algoById[s.ref]) bad.push(`${a.id}: next step "${s.ref}" is not a published lesson`);
      const mine = conn(a.id, s.ref), theirs = conn(s.ref, a.id);
      if (s.kind === 'advanced' && !(mine && mine.type === 'advanced' && mine.why === s.why)) bad.push(`${a.id} -> ${s.ref}: called "go further" but the lesson does not say so`);
      if (s.kind === 'builds-on') {
        const says = (theirs && theirs.type === 'prerequisite') || (C.algoById[s.ref].prerequisites || []).includes(a.id);
        if (!says) bad.push(`${a.id} -> ${s.ref}: said to build on this lesson, but ${s.ref} does not list it as a prerequisite`);
        if (theirs && theirs.why !== s.why) bad.push(`${a.id} -> ${s.ref}: the reason is not the sentence ${s.ref} wrote`);
      }
      if ((s.kind === 'application' || s.kind === 'related') && !(mine && mine.type === s.kind && mine.why === s.why)) bad.push(`${a.id} -> ${s.ref}: called "${s.kind}" without a stated connection`);
      if ((s.kind === 'same-problem' || s.kind === 'variant') && !(mine && mine.type === s.kind && mine.why === s.why)) bad.push(`${a.id} -> ${s.ref}: called "${s.kind}" without a stated connection`);
      const b = N.stepBefore(a.id);
      if (b && !(conn(a.id, b.ref) && conn(a.id, b.ref).type === 'prerequisite')) bad.push(`${a.id}: "${b.ref}" is offered as worth reading first, but the lesson does not call it a prerequisite`);
    }
    assert(!bad.length, bad.slice(0, 4).join(' | '));
    return `go further ${tally.advanced}, builds on this ${tally['builds-on']}, another method ${tally['same-problem'] + tally.variant}, put to use in ${tally.application}, related ${tally.related}, no suggestion ${tally.none}${without.length ? ` (${without.join(', ')})` : ''}`;
  });

  await test('following a path: each lesson offers the next module of that path, with the path\'s own reason', async () => {
    const path = C.paths.find((x) => x.id === 'absolute-beginners') || C.paths[0];
    const modules = path.stages.flatMap((st) => st.modules).filter((m) => C.algoById[m.algo]);
    assert(modules.length >= 3, 'the path has too few published modules to test');
    const p = await open(`/path/${path.id}`, '.module-name');
    try {
      const first = p.$$('a.module-name')[0];
      assert(first.getAttribute('href') === `#/algorithm/${modules[0].algo}?path=${path.id}`, `the first module links to ${first.getAttribute('href')}`);
      first.click();
      await until(() => p.$('.lesson .pager-link.is-next'), 8000, 'the lesson shows no next step');
      const next = p.$('.pager-link.is-next');
      assert(next.getAttribute('href') === `#/algorithm/${modules[1].algo}?path=${path.id}`, `next is ${next.getAttribute('href')}, the path's second module is ${modules[1].algo}`);
      assert(next.querySelector('.pager-dir').textContent === `Next in ${path.title}`, `the label is "${next.querySelector('.pager-dir').textContent}"`);
      assert(next.querySelector('.pager-why').textContent.trim() === modules[1].why, 'the reason is not the one the path gives');
      // changing level must not lose the path
      p.$$('.level-btn')[1].click();
      await sleep(60);
      assert(/path=/.test(p.win.location.hash), `after changing level the address is ${p.win.location.hash}`);
      next.click();
      await until(() => p.$('.lesson h1') && p.$('.lesson h1').textContent === C.algoById[modules[1].algo].name, 8000, 'the second module did not open');
      const back = p.$('.pager-link:not(.is-next)');
      assert(back && back.getAttribute('href') === `#/algorithm/${modules[0].algo}?path=${path.id}`, 'the second module does not offer the first as the step before');
      return `${path.title}: ${modules[0].algo} -> ${modules[1].algo}`;
    } finally { p.close(); }
  });

  await test('on every lesson page, a "go further" or "builds on this" heading has a working lesson under it', async () => {
    const p = await open('/about', '#main h1');
    const bad = []; const state = { deeper: 0, alternativeOnly: 0, neither: [] };
    // the lessons the audit reported: no "go further" entry at all, or only planned ones
    const reported = C.algos.filter((a) => { const adv = (a.connections || []).filter((c) => c.type === 'advanced'); return !adv.length || adv.every((c) => C.resolveRef(c.to).kind === 'planned'); }).map((a) => a.id);
    const repaired = [];
    try {
      const main = p.$('#main');
      for (const a of C.algos) {
        const was = main.firstElementChild;
        p.win.location.hash = `/algorithm/${a.id}`;
        await until(() => main.firstElementChild !== was && p.$('#connections .rel-group'), 12000, `"${a.id}" never rendered`);
        const groups = p.$$('#connections .rel-group').map((g) => ({ type: g.dataset.type, links: [...g.querySelectorAll('a.rel-name')].map((x) => x.getAttribute('href')), plain: g.querySelectorAll('.rel-name:not(a)').length }));
        for (const g of groups) {
          if (g.type === 'planned') { if (g.links.length) bad.push(`${a.id}: a planned lesson is a link`); continue; }
          if (g.plain) bad.push(`${a.id}: "${g.type}" lists something that cannot be opened`);
          for (const l of g.links) { const why = resolves(l); if (why) bad.push(`${a.id}: ${l} (${why})`); }
        }
        const deeperLessons = groups.filter((g) => g.type === 'advanced' || g.type === 'builds-on').flatMap((g) => g.links).filter((l) => /^#\/algorithm\//.test(l));
        const other = groups.filter((g) => g.type === 'same-problem' || g.type === 'variant').flatMap((g) => g.links).filter((l) => /^#\/algorithm\//.test(l));
        if (deeperLessons.length) { state.deeper++; if (reported.includes(a.id)) repaired.push(a.id); } else if (other.length) state.alternativeOnly++; else state.neither.push(a.id);
        // the footer's step on, if there is one, opens a published lesson and says why
        const next = p.$('.pager-link.is-next');
        if (next) { if (resolves(next.getAttribute('href'))) bad.push(`${a.id}: the next step is a broken link`); if (next.querySelector('.pager-why').textContent.trim().length < 30) bad.push(`${a.id}: the next step gives no reason`); }
        if (p.$('.pager-dir') && /^(Previous|Next)$/.test(p.$('.pager-dir').textContent)) bad.push(`${a.id}: still shows the old Previous / Next`);
      }
    } finally { p.close(); }
    assert(!bad.length, `${bad.length}: ${[...new Set(bad)].slice(0, 4).join(' | ')}`);
    // what each of the reported lessons offers now, by the kind of step it leads to
    const now = {};
    for (const id of reported) { const st = N.nextStep(id); const k = !st ? 'nothing' : st.kind === 'advanced' || st.kind === 'builds-on' ? 'a deeper lesson' : st.kind === 'same-problem' || st.kind === 'variant' ? 'another method' : 'a related lesson'; (now[k] = now[k] || []).push(id); }
    assert(!(now.nothing || []).length, `reported lessons that still lead nowhere: ${(now.nothing || []).join(', ')}`);
    return `${state.deeper} lessons list a deeper lesson, ${state.alternativeOnly} list another method only, ${state.neither.length} list neither. The ${reported.length} lessons the audit reported now lead to: ${Object.entries(now).map(([k, v]) => `${k} (${v.length}: ${v.join(', ')})`).join('; ')}`;
  });

  await test('a planned lesson\'s page points to the published lessons that mention it', async () => {
    const planned = C.planned.find((r) => N.pointingTo(r.id).length >= 2);
    const p = await open(`/algorithm/${planned.id}`, '.planned-from-list a');
    try {
      const links = p.$$('.planned-from-list a').map((x) => x.getAttribute('href'));
      assert(links.length === N.pointingTo(planned.id).length, `${links.length} links, ${N.pointingTo(planned.id).length} lessons mention it`);
      for (const l of links) assert(!resolves(l), `${l} is broken`);
      return `${planned.name}: ${links.length} lessons`;
    } finally { p.close(); }
  });

  await test('recommendations give a specific, grounded reason, and never the same one twice', () => {
    const keep = JSON.stringify(store.state);
    const bad = []; let checked = 0;
    try {
      const generic = /Connected to .*which you explored|^A good place to start\.?$|^A sound next step at your level\.?$/;
      const scenarios = [null, ...C.algos.filter((_, i) => i % 4 === 0).map((a) => a.id)];
      for (const opened of scenarios) {
        store.reset();
        if (opened) store.visit(opened);
        const recs = R.recommendLessons(4);
        const reasons = recs.map((r) => r.reason);
        if (new Set(reasons).size !== reasons.length) bad.push(`after ${opened || 'nothing'}: two suggestions share the reason "${reasons.find((x, i) => reasons.indexOf(x) !== i).slice(0, 50)}"`);
        for (const r of recs) {
          checked++;
          if (!r.reason || r.reason.length < 25) bad.push(`after ${opened}: ${r.a.id} has no real reason ("${r.reason}")`);
          if (generic.test(r.reason)) bad.push(`after ${opened}: ${r.a.id} gets the generic "${r.reason}"`);
          if (!/[.!?"]$/.test(r.reason)) bad.push(`${r.a.id}: the reason does not end as a sentence`);
          if (opened && r.reason.includes(C.algoById[opened].name)) {
            const theirs = conn(opened, r.a.id), mine = conn(r.a.id, opened);
            const link = theirs || mine;
            const viaPrereq = (r.a.prerequisites || []).includes(opened);
            if (!link && !viaPrereq) bad.push(`after ${opened}: ${r.a.id} names it, but the two lessons state no connection`);
            if (link && !viaPrereq && !r.reason.includes(link.why.replace(/[.!?]$/, ''))) bad.push(`after ${opened}: ${r.a.id} does not give the stated reason`);
            if (/^Builds on /.test(r.reason) && !(mine && mine.type === 'prerequisite')) bad.push(`after ${opened}: ${r.a.id} is said to build on it, but does not list it as a prerequisite`);
            if (/assumes this/.test(r.reason) && !(theirs && theirs.type === 'prerequisite')) bad.push(`after ${opened}: ${r.a.id} is said to be assumed by it, but ${opened} does not list it as a prerequisite`);
          }
        }
      }
    } finally { store.update((st) => { Object.assign(st, JSON.parse(keep)); }); }
    assert(!bad.length, `${bad.length}: ${bad.slice(0, 4).join(' | ')}`);
    return `${checked} suggestions across ${1 + Math.ceil(C.algos.length / 4)} histories`;
  });
}

/* ------------------------------------------------------------------ the demonstrations */
if (on('player')) {
  suite('Demonstrations');
  const { execute } = await import('../js/core/tracer.js');
  const stepNo = (p) => Number((p.$('.step-label').textContent.match(/Step (\d+)/) || [])[1]);
  const press = (p, key, target) => (target || p.doc.body).dispatchEvent(new p.win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const fwd = (p) => p.$('.transport-buttons button[aria-label="Step forward"]');

  /* ---- Dijkstra: why a distance is final, and what a negative edge does ---- */
  const dj = await C.loadLesson('dijkstra');
  await test('Dijkstra: on a graph with a negative edge the demonstration does exactly what the code on the page does', () => {
    // the page's own program, transcribed line for line from its Python version
    const pageCode = (edges, ids, source) => {
      const graph = Object.fromEntries(ids.map((id) => [id, []]));
      for (const e of edges) graph[e.u].push([e.v, e.w]);
      const dist = Object.fromEntries(ids.map((id) => [id, Infinity]));
      dist[source] = 0;
      const queue = [[0, source]]; const settled = new Set();
      while (queue.length) {
        queue.sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : 1));
        const [d, u] = queue.shift();
        if (settled.has(u)) continue;
        settled.add(u);
        for (const [v, w] of graph[u]) if (d + w < dist[v]) { dist[v] = d + w; queue.push([dist[v], v]); }
      }
      return dist;
    };
    const bellmanFord = (edges, ids, source) => { const d = Object.fromEntries(ids.map((id) => [id, Infinity])); d[source] = 0; let again = false; for (let k = 0; k <= ids.length; k++) { again = false; for (const e of edges) if (d[e.u] + e.w < d[e.v]) { d[e.v] = d[e.u] + e.w; again = true; } } return again ? null : d; };
    let seed = 12345; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    let tried = 0, wrongSeen = 0, luckySeen = 0;
    for (let trial = 0; trial < 3000 && tried < 300; trial++) {
      const n = 4 + Math.floor(rnd() * 3); const ids = names.slice(0, n); const edges = [];
      // one-way edges in a random direction, a few of them negative; graphs with a negative loop are set aside
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < 0.6) { const flip = rnd() < 0.35; edges.push({ u: ids[flip ? j : i], v: ids[flip ? i : j], w: rnd() < 0.3 ? -(1 + Math.floor(rnd() * 4)) : 1 + Math.floor(rnd() * 6) }); }
      if (!edges.some((e) => e.w < 0) || !ids.every((id) => edges.some((e) => e.u === id || e.v === id))) continue;
      if (!bellmanFord(edges, ids, 'A')) { assert(!execute(dj, { edges: edges.map((e) => `${e.u}>${e.v}:${e.w}`).join(', ') }).ok, 'a graph with a negative loop was run as if it had shortest routes'); continue; }
      const text = edges.map((e) => `${e.u}>${e.v}:${e.w}`).join(', ');
      const run = execute(dj, { edges: text });
      assert(run.ok, `"${text}" would not run: ${run.error}`);
      const code = pageCode(edges, ids, 'A'), truth = bellmanFord(edges, ids, 'A');
      for (const id of ids) assert(run.result.dist[id] === code[id], `"${text}": the demonstration reports ${run.result.dist[id]} for ${id}, the page's code gives ${code[id]}`);
      const reallyWrong = ids.filter((id) => code[id] !== truth[id]);
      assert(run.result.wrong.join() === reallyWrong.join(), `"${text}": flagged ${run.result.wrong.join() || 'nothing'} as wrong, but the wrong nodes are ${reallyWrong.join() || 'none'}`);
      const last = run.frames[run.frames.length - 1].note;
      assert(reallyWrong.length ? /The answer is wrong/.test(last) : /happen to be right/.test(last), `"${text}": the last step says "${last.slice(0, 40)}"`);
      tried++; if (reallyWrong.length) wrongSeen++; else luckySeen++;
    }
    assert(tried >= 200 && wrongSeen >= 5 && luckySeen >= 5, `only ${tried} graphs (${wrongSeen} wrong, ${luckySeen} right by luck)`);
    return `${tried} random graphs with negative edges: ${wrongSeen} where the algorithm is wrong, ${luckySeen} where it is right by luck`;
  });
  await test('Dijkstra: the page shows the failure, and explains why an edge travelled both ways cannot be shown', async () => {
    const p = await open('/algorithm/dijkstra', '.player-note .note-text');
    try {
      const btn = p.$$('.preset-row .btn').find((b) => /negative edge/i.test(b.textContent));
      assert(btn, 'there is no preset for a negative edge');
      btn.click(); await sleep(80);
      const marked = p.$$('.preset-row .btn').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
      assert(marked.length === 1 && /negative edge/i.test(marked[0]), `the preset marked as in use is "${marked.join(', ') || 'none'}"`);
      const scrub = p.$('.scrub'); scrub.value = scrub.max; scrub.dispatchEvent(new p.win.Event('input', { bubbles: true }));
      await sleep(60);
      const note = p.$('.player-note').textContent;
      assert(/The answer is wrong/.test(note) && /Bellman-Ford/.test(note), `the last step reads "${note.slice(0, 80)}"`);
      assert(/should be/.test(JSON.stringify(execute(dj, { edges: 'A>B:2, A>C:1, B>C:-3, C>D:2' }).frames.slice(-1)[0].views[0])), 'the wrong node is not labelled with the true distance');
      const field = p.$$('.inputs input[type="text"], .inputs textarea').find((i) => /A>B/.test(i.value));
      field.value = 'A-B:2, B-C:-3, A-C:1'; field.dispatchEvent(new p.win.Event('change', { bubbles: true }));
      await sleep(80);
      const err = p.$('.player-error');
      assert(!err.hidden && /both ways/.test(err.textContent) && /A>B/.test(err.textContent), `the error reads "${err.textContent.slice(0, 80)}"`);
    } finally { p.close(); }
  });

  /* ---- comparing a run with the one before ---- */
  await test('Changing the input shows the counts before and now, and they are the real counts', async () => {
    const L = await C.loadLesson('quick-sort');
    const preset = L.viz.presets.find((x) => /worst/i.test(x.label)) || L.viz.presets[1];
    const before = execute(L, {}), after = execute(L, preset.values);
    const p = await open('/algorithm/quick-sort', '.player-note .note-text');
    try {
      const box = p.$('.run-compare');
      assert(box && box.hidden, 'a comparison is shown before anything has been changed');
      p.$$('.preset-row .btn').find((b) => b.textContent === preset.label).click();
      await sleep(120);
      assert(!box.hidden, 'no comparison appeared after choosing a preset');
      const rows = Object.fromEntries([...box.querySelectorAll('tbody tr')].map((tr) => [tr.children[0].textContent, [...tr.children].slice(1).map((td) => td.textContent.replace(/,/g, ''))]));
      const shared = Object.keys(after.counters).filter((k) => k in before.counters);
      assert(shared.length && shared.every((k) => rows[k]), `the table lists ${Object.keys(rows).join(', ')}, the runs share ${shared.join(', ')}`);
      for (const k of shared) {
        const [was, now, diff] = rows[k];
        assert(Number(was) === before.counters[k] && Number(now) === after.counters[k], `${k}: the page says ${was} then ${now}, the runs gave ${before.counters[k]} then ${after.counters[k]}`);
        const d = after.counters[k] - before.counters[k];
        assert(d === 0 ? diff === 'no change' : diff === `${d > 0 ? '+' : '−'}${Math.abs(d)}`, `${k}: the difference reads "${diff}", it is ${d}`);
      }
      assert(box.textContent.includes(preset.label), 'the comparison does not say which preset is now running');
      assert(!/null|undefined|NaN/.test(box.textContent), `the comparison prints a stray value: "${box.textContent.slice(-40)}"`);
      // a run that fails must not replace the last good one
      const custom = p.$$('.inputs input[type="text"]')[0];
      if (custom) {
        custom.value = 'not, numbers, at all'; custom.dispatchEvent(new p.win.Event('change', { bubbles: true }));
        await sleep(120);
        const kept = Object.fromEntries([...box.querySelectorAll('tbody tr')].map((tr) => [tr.children[0].textContent, tr.children[2].textContent.replace(/,/g, '')]));
        if (!p.$('.player-error').hidden) for (const k of shared) assert(Number(kept[k]) === after.counters[k], `after a failed run the table shows ${kept[k]} for ${k}`);
      }
      return shared.map((k) => `${k} ${before.counters[k]} to ${after.counters[k]}`).join(', ');
    } finally { p.close(); }
  });
  await test('A change that does not alter the counts says so, and never invents a number', async () => {
    const L = await C.loadLesson('dijkstra');
    const p = await open('/algorithm/dijkstra', '.player-note .note-text');
    try {
      const box = p.$('.run-compare');
      p.$$('.preset-row .btn')[0].click(); await sleep(100);
      p.$$('.preset-row .btn')[1].click(); await sleep(100);
      const first = execute(L, L.viz.presets[0].values), second = execute(L, L.viz.presets[1].values);
      for (const tr of box.querySelectorAll('tbody tr')) {
        const k = tr.children[0].textContent;
        assert(k in first.counters && k in second.counters, `the table compares "${k}", which one of the runs does not report`);
        assert(Number(tr.children[1].textContent.replace(/,/g, '')) === first.counters[k] && Number(tr.children[2].textContent.replace(/,/g, '')) === second.counters[k], `${k}: wrong numbers`);
      }
      assert(/Before \(/.test(box.querySelector('thead').textContent), 'the earlier run is not named');
    } finally { p.close(); }
  });

  /* ---- keyboard ---- */
  await test('The arrow keys step the demonstration without a click first', async () => {
    const p = await open('/algorithm/merge-sort', '.player-note .note-text');
    try {
      p.$('.player-stage').scrollIntoView({ block: 'center', behavior: 'instant' });
      await until(() => { const r = p.$('.player-stage').getBoundingClientRect(); return r.top >= 0 && r.bottom <= 900; }, 4000, 'the figure never came into view');
      await sleep(250);
      if (p.doc.activeElement && p.doc.activeElement !== p.doc.body) p.doc.activeElement.blur();
      assert(stepNo(p) === 1, 'the demonstration did not start on step 1');
      press(p, 'ArrowRight'); press(p, 'ArrowRight');
      assert(stepNo(p) === 3, `after two presses of the right arrow, with nothing focused, the step is ${stepNo(p)}`);
      press(p, 'ArrowLeft');
      assert(stepNo(p) === 2, `the left arrow left the step at ${stepNo(p)}`);
      // keys typed into a field belong to the field
      const field = p.$('.searchbox input, .inputs input[type="text"], .inputs input[type="number"]');
      if (field) { press(p, 'ArrowRight', field); assert(stepNo(p) === 2, 'an arrow key typed into a field moved the demonstration'); }
      const option = p.$('.quiz-option'); if (option) { press(p, 'ArrowRight', option); assert(stepNo(p) === 2, 'an arrow key in the quiz moved the demonstration'); }
      // and when the figure is off screen the keys are left alone
      p.win.scrollTo({ top: p.doc.documentElement.scrollHeight, behavior: 'instant' });
      await sleep(400);
      press(p, 'ArrowRight');
      assert(stepNo(p) === 2, 'the right arrow moved a demonstration that was off screen');
      assert(/step back and forward/.test(p.$('.player-keys').textContent), 'there is no hint about the keys');
    } finally { p.close(); }
  });
  await test('The arrow keys work in the lab too, and Space still plays once the figure has focus', async () => {
    const p = await open('/lab/dijkstra', '.player-note .note-text');
    try {
      await sleep(350);
      if (p.doc.activeElement && p.doc.activeElement !== p.doc.body) p.doc.activeElement.blur();
      press(p, 'ArrowRight');
      assert(stepNo(p) === 2, `in the lab the right arrow left the step at ${stepNo(p)}`);
      fwd(p).focus(); press(p, 'ArrowRight', fwd(p));
      assert(stepNo(p) === 3, `with focus inside the figure the right arrow moved to step ${stepNo(p)}, not 3`);
    } finally { p.close(); }
  });

  /* ---- phones ---- */
  await test('On a phone the picture and its note sit together, fit on screen, and the controls do not move', async () => {
    const p = await open('/algorithm/dijkstra', '.player-note .note-text', { width: 375, height: 812 });
    try {
      await sleep(400);
      const rect = (sel) => p.$(sel).getBoundingClientRect();
      const stage = rect('.player-stage'), note = rect('.player-note'), bar = rect('.transport');
      assert(note.top >= stage.bottom - 1 && note.top - stage.bottom < 12, `the note starts ${Math.round(note.top - stage.bottom)}px below the picture`);
      assert(bar.top >= note.bottom - 1, 'the controls are not below the note');
      const room = 812 - rect('.site-head').height - rect('.level-bar').height;
      const span = note.bottom - stage.top;
      assert(span <= room, `at the first step, picture and note together are ${Math.round(span)}px tall, and ${Math.round(room)}px are free under the fixed bars`);
      // Step through the whole run. The note's space is reserved, so its length never moves the
      // controls. The picture may grow when a row wraps, but must never shrink back, and must
      // always leave room on screen for the start of its note.
      const tops = []; let tallest = stage.height;
      while (!fwd(p).disabled) {
        fwd(p).click();
        tops.push(Math.round(fwd(p).getBoundingClientRect().top + p.win.scrollY));
        tallest = Math.max(tallest, rect('.player-stage').height);
        const gap = rect('.player-note').top - rect('.player-stage').bottom;
        assert(gap >= -1 && gap < 12, `at step ${stepNo(p)} the note is ${Math.round(gap)}px from the picture`);
      }
      assert(tops.every((t, i) => i === 0 || t >= tops[i - 1]), `the forward button moved back up during the run: ${[...new Set(tops)].join(', ')}`);
      assert(new Set(tops).size <= 3, `the forward button sat at ${new Set(tops).size} different heights during the run`);
      assert(tallest + 72 <= room, `the picture grows to ${Math.round(tallest)}px, which leaves less than three lines for its note in ${Math.round(room)}px`);
      assert(p.doc.documentElement.scrollWidth <= 376, `the page is ${p.doc.documentElement.scrollWidth}px wide`);
      return `first step: picture and note ${Math.round(span)}px in ${Math.round(room)}px of room. Over ${tops.length} steps the forward button moved down ${new Set(tops).size - 1} time(s) and never up; the picture's tallest was ${Math.round(tallest)}px`;
    } finally { p.close(); }
  });

  /* ---- the prediction experiment ---- */
  await test('Prediction is off unless asked for, and is offered only where a lesson has questions', async () => {
    const p = await open('/algorithm/dijkstra', '.player-note .note-text');
    try {
      assert(!p.$('.player-predict').hidden && !p.$('.player-predict input').checked, 'the experiment is not offered, or is on by default');
      const n = stepNo(p); fwd(p).click(); fwd(p).click(); fwd(p).click(); fwd(p).click();
      assert(stepNo(p) === n + 4 && !p.$('.predict'), 'with the experiment off, stepping was interrupted');
    } finally { p.close(); }
    const q = await open('/algorithm/quick-sort', '.player-note .note-text');
    try { assert(q.$('.player-predict').hidden, 'a lesson with no questions offers the experiment'); } finally { q.close(); }
  });
  await test('With prediction on, a step is held back until answered, then shown with a verdict', async () => {
    const run = execute(dj, {});
    const asks = run.frames.map((f, i) => (f.ask ? i : -1)).filter((i) => i >= 0);
    assert(asks.length >= 3, `the default Dijkstra run has only ${asks.length} questions`);
    for (const i of asks) { const f = run.frames[i]; assert(f.ask.options[f.ask.answer] === f.vars.u, `step ${i + 1}: the stored answer is ${f.ask.options[f.ask.answer]}, the node settled is ${f.vars.u}`); }
    const p = await open('/algorithm/dijkstra', '.player-note .note-text');
    try {
      p.$('.player-predict input').click();
      let guard = 0;
      while (!p.$('.predict') && guard++ < 40) fwd(p).click();
      assert(p.$('.predict'), 'no question appeared');
      assert(stepNo(p) === asks[0], `the question for step ${asks[0] + 1} appeared while showing step ${stepNo(p)}`);
      const held = stepNo(p);
      press(p, 'ArrowRight'); fwd(p).click();
      assert(stepNo(p) === held && p.$('.predict'), 'the step could be passed without answering');
      const right = run.frames[asks[0]].ask;
      p.$$('.predict-options .btn').find((b) => b.textContent === String(right.options[right.answer])).click();
      assert(stepNo(p) === asks[0] + 1, `after answering, the step is ${stepNo(p)}`);
      assert(/As you predicted\./.test(p.$('.player-note').textContent), `a right answer reads "${p.$('.player-note').textContent.slice(0, 50)}"`);
      guard = 0; while (!p.$('.predict') && guard++ < 40) fwd(p).click();
      const next = run.frames[asks[1]].ask;
      const wrongOption = next.options.find((o, k) => k !== next.answer);
      p.$$('.predict-options .btn').find((b) => b.textContent === String(wrongOption)).click();
      const text = p.$('.player-note').textContent;
      assert(new RegExp(`You said ${wrongOption}\\.`).test(text) && text.includes(run.frames[asks[1]].note.replace(/\*\*/g, '').slice(0, 30)), `a wrong answer reads "${text.slice(0, 70)}"`);
      guard = 0; while (!p.$('.predict') && guard++ < 40) fwd(p).click();
      p.$$('.predict-options .btn').find((b) => b.textContent === 'Just show me').click();
      assert(!p.$('.predict') && !/As you predicted|You said/.test(p.$('.player-note').textContent), '"Just show me" did not simply show the step');
    } finally { p.close(); }
  });
  await test('Binary Search: each stored answer is the one the search actually takes', async () => {
    const L = await C.loadLesson('binary-search');
    let n = 0;
    for (const input of [{}, ...L.viz.presets.map((x) => x.values)]) {
      const run = execute(L, input);
      for (const f of run.frames) {
        if (!f.ask) continue; n++;
        const said = f.ask.options[f.ask.answer];
        const truth = /That is the target/.test(f.note) ? 'It is the target' : /smaller than/.test(f.note) ? 'Everything to its left is ruled out' : 'Everything to its right is ruled out';
        assert(said === truth, `"${f.note.slice(0, 50)}" is answered "${said}"`);
        const [, v, target] = f.ask.q.match(/holds (-?\d+), and we are looking for (-?\d+)/).map(Number);
        assert((v === target && f.ask.answer === 0) || (v < target && f.ask.answer === 1) || (v > target && f.ask.answer === 2), `${v} against ${target} is answered with option ${f.ask.answer + 1}`);
      }
    }
    assert(n >= 6, `only ${n} questions were checked`);
    return `${n} questions`;
  });
}

/* ------------------------------------------------------------------ follow-ups */
if (on('followups')) {
  suite('Follow-ups');
  const { execute } = await import('../js/core/tracer.js');
  const N2 = await import('../js/core/next.js');

  await test('Home: a new visitor\'s main button opens a first lesson on the beginners\' path', async () => {
    // start as someone who has never been here: nothing saved in this browser
    localStorage.clear();
    const p = await open('/', '.hero-actions .btn-accent');
    try {
      const doc = p.doc;
      const main = doc.querySelector('.hero-actions .btn-accent');
      const path = C.pathById['absolute-beginners'];
      const firstModule = path.stages.flatMap((st) => st.modules).find((m) => C.algoById[m.algo]).algo;
      assert(main.textContent === 'Start with a first lesson', `the main button reads "${main.textContent}"`);
      assert(main.getAttribute('href') === `#/algorithm/${firstModule}?path=${path.id}`, `it leads to ${main.getAttribute('href')}`);
      assert([...doc.querySelectorAll('.hero-actions .btn')].some((b) => b.textContent === 'Explore the Atlas'), 'the way to the map is gone from the hero');
      assert(doc.querySelector('.hero .hero-suggest-btn'), 'the four questions are not offered beside the search');
      assert(doc.querySelector('nav.primary a[href="#/lab"]'), 'the lab is no longer in the navigation');
      main.click();
      await until(() => doc.querySelector('.lesson .pager-link.is-next'), 10000, 'the first lesson did not open with a next step');
      assert(/^Next in /.test(doc.querySelector('.pager-link.is-next .pager-dir').textContent), 'the first lesson does not lead on along the path');
      assert(doc.querySelector('.lesson').dataset.depth === '1', 'a new visitor\'s first lesson does not open at the simplest level');
      return `${C.algoById[firstModule].name}, then ${doc.querySelector('.pager-link.is-next .pager-name').textContent}`;
    } finally { p.close(); }
  });
  await test('Home: answering the four questions goes straight to the suggestions', async () => {
    const p = await open('/', '.hero .hero-suggest-btn');
    try {
      p.$('.hero .hero-suggest-btn').click();
      await until(() => p.$('dialog.onboard[open]'), 3000, 'the questions did not open');
      p.$('dialog.onboard button[type="submit"]').click();
      await until(() => /#\/profile/.test(p.win.location.hash) && p.$('.lesson-row, .lesson-list a'), 6000, `after answering, the address is ${p.win.location.hash}`);
    } finally { p.win.localStorage.clear(); p.close(); }
  });
  await test('The fonts cannot hold the page back', async () => {
    const html = await (await fetch('/index.html', { cache: 'no-store' })).text();
    const links = html.match(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/g) || [];
    assert(links.length >= 1, 'the font stylesheet is missing');
    const blocking = links.filter((l) => /rel="stylesheet"/.test(l) && !/media="print"/.test(l) && !html.includes(`<noscript>${l}</noscript>`));
    assert(!blocking.length, 'the font stylesheet is loaded in a way that blocks the page');
  });
  await test('An address for a demonstration or comparison that does not exist says so', async () => {
    for (const [hash, expect] of [['/lab/nope', /no demonstration at this address/i], ['/compare/nope', /no comparison at this address/i], [`/lab/${C.planned[0].id}`, /not written yet/i]]) {
      const p = await open(hash, '#main h1');
      try { assert(expect.test(p.$('#main h1').textContent), `${hash} shows "${p.$('#main h1').textContent}"`); assert(!p.$('.player-stage'), `${hash} runs a demonstration`); } finally { p.close(); }
    }
  });
  await test('Related concepts: a reason is given only where lessons involve both, and it names them', async () => {
    const uses = (id) => new Set(C.algos.filter((a) => ((C.conceptById[id].see || []).includes(a.id)) || (a.prerequisites || []).includes(`concept:${id}`) || (a.connections || []).some((c) => c.to === `concept:${id}`)).map((a) => a.name));
    let withReason = 0, without = 0; const bad = [];
    for (const c of C.concepts) for (const r of c.related || []) {
      if (!C.conceptById[r]) continue;
      const why = C.sharedGround(c.id, r);
      const a = uses(c.id), b = uses(r); const both = [...a].filter((x) => b.has(x));
      if (!both.length) { without++; if (why) bad.push(`${c.id} and ${r}: a reason is given but no lesson involves both`); continue; }
      withReason++;
      if (!why.startsWith('Both come up in ')) bad.push(`${c.id} and ${r}: "${why}"`);
      for (const name of both.slice(0, 3)) if (!why.includes(name)) bad.push(`${c.id} and ${r}: the reason leaves out ${name}`);
      if (/usually learned together/.test(why)) bad.push(`${c.id} and ${r}: still the generic reason`);
    }
    assert(!bad.length, bad.slice(0, 3).join(' | '));
    const p = await open('/concept/greedy', '.concept-related-list li');
    try { assert(p.$$('.concept-related-list li').length === (C.conceptById.greedy.related || []).filter((r) => C.conceptById[r]).length, 'the page does not list every related concept'); } finally { p.close(); }
    return `${withReason} pairs with a reason from the lessons, ${without} listed without one`;
  });
  await test('Next steps: a lesson that puts this one to use comes before a sideways alternative', () => {
    const tally = {};
    for (const a of C.algos) { const st = N2.nextStep(a.id); const k = st ? st.kind : 'none'; tally[k] = (tally[k] || 0) + 1; }
    const hs = N2.nextStep('heap-sort');
    assert(hs && hs.kind === 'application' && hs.label === 'Where this is put to use', `Heap Sort leads to ${hs && hs.ref} as "${hs && hs.label}"`);
    assert(!tally.none, `${tally.none} lessons have no next step`);
    return Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ');
  });
  await test('Step notes: a step that calls something final says why', async () => {
    const FINAL = /final (position|place|distance)|not move again|never moves again|for good/i;
    const REASON = /because|since|, so | so it| so no|nothing|every |already|at least as|only one|single value/i;
    const bad = []; let seen = 0;
    for (const a of C.algos) {
      const L = await C.loadLesson(a.id);
      const run = execute(L, {});
      const told = new Set();
      for (const f of run.frames) {
        const note = String(f.note || '').replace(/\*\*/g, '');
        if (!FINAL.test(note)) continue;
        const shape = note.replace(/-?\d+(\.\d+)?/g, '#').slice(0, 50);
        if (told.has(shape)) continue; told.add(shape); seen++;
        if (!REASON.test(note)) bad.push(`${a.id}: "${note.slice(0, 90)}"`);
      }
    }
    assert(!bad.length, `${bad.length}: ${bad.slice(0, 3).join(' | ')}`);
    return `${seen} kinds of step across ${C.algos.length} lessons`;
  });
  await test('Comparison page: the arrow keys step every panel', async () => {
    const p = await open(`/compare/${C.compareGroups[0].id}`, '.cmp-transport');
    try {
      p.$('.cmp-transport').scrollIntoView({ block: 'center', behavior: 'instant' });
      await sleep(300);
      if (p.doc.activeElement && p.doc.activeElement !== p.doc.body) p.doc.activeElement.blur();
      const label = () => p.$('.cmp-transport .step-label, .cmp-transport span:last-child').textContent;
      const before = label();
      p.doc.body.dispatchEvent(new p.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      p.doc.body.dispatchEvent(new p.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      assert(/Shared step 3 /.test(label()), `after two presses the label reads "${label()}" (it was "${before}")`);
      p.doc.body.dispatchEvent(new p.win.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
      assert(/Shared step 2 /.test(label()), `after the left arrow the label reads "${label()}"`);
    } finally { p.close(); }
  });
  await test('A link can open a lesson with the prediction experiment switched on', async () => {
    const p = await open('/algorithm/binary-search?predict=1', '.player-note');
    try { await sleep(150); assert(p.$('.player-predict input').checked, 'the experiment is not on'); } finally { p.close(); }
    const q = await open('/algorithm/quick-sort?predict=1', '.player-note .note-text');
    try { assert(q.$('.player-predict').hidden, 'a lesson without questions shows the experiment'); } finally { q.close(); }
  });
}

/* ------------------------------------------------------------------ the two tracks */
if (on('tracks')) {
  suite('Tracks');
  const T = await import('../js/core/tracks.js');
  await test('every track names real lessons, once each, and real learning paths', () => {
    assert(C.tracks.length === 2, `${C.tracks.length} tracks`);
    for (const t of C.tracks) {
      const ids = t.groups.flatMap((g) => g.lessons);
      assert(ids.length === new Set(ids).size, `${t.id}: a lesson is listed twice`);
      for (const id of ids) assert(C.algoById[id] || C.plannedById[id], `${t.id}: "${id}" is neither a published nor a planned lesson`);
      for (const g of t.groups) assert(g.lessons.some((id) => C.algoById[id]), `${t.id}: the group "${g.title}" has no published lesson`);
      for (const pid of t.paths || []) assert(C.pathById[pid], `${t.id}: no learning path "${pid}"`);
    }
    return C.tracks.map((t) => { const x = T.trackLessons(t); return `${t.title}: ${x.published.length} written, ${x.planned.length} planned`; }).join('; ');
  });
  await test('business guide: every lesson has a role, a question and a bridge that names its limits', async () => {
    const t = C.trackById.business; const bad = []; const roles = { direct: 0, method: 0 };
    for (const g of t.groups) {
      assert(/\?$/.test(g.title), `the group "${g.title}" is not put as a decision`);
      for (const it of g.items) {
        const a = C.algoById[it.id]; if (!a) continue;
        if (!(it.role in roles)) { bad.push(`${it.id}: role "${it.role}"`); continue; }
        roles[it.role]++;
        if (!it.question || !/\?$/.test(it.question) || it.question.length > 110) bad.push(`${it.id}: the question is missing, too long, or not a question`);
        if (!it.bridge || it.bridge.length < 150 || it.bridge.length > 430) bad.push(`${it.id}: the bridge is ${it.bridge ? it.bridge.length : 0} characters`);
        if (/—/.test(`${it.question}${it.bridge}`)) bad.push(`${it.id}: em dash`);
        if (it.question.toLowerCase().includes(a.name.toLowerCase().split(' ')[0]) && a.name.split(' ')[0].length > 4) bad.push(`${it.id}: the question names the method`);
        // a lesson that teaches on a simplified example must say what that example is
        if (it.role === 'method' && !/The lesson /.test(it.bridge)) bad.push(`${it.id}: a "method" lesson whose bridge does not say what the lesson's own example is`);
        // and every bridge must carry a limit: a sentence about what the method assumes, cannot do, or needs
        if (!/\b(assum|cannot|only|not |never|no |depends|needs|must|slow|check|margin|nothing|without)\b/i.test(it.bridge)) bad.push(`${it.id}: the bridge states no limit`);
      }
    }
    assert(!bad.length, bad.join(' | '));
    assert(roles.direct >= 4 && roles.method >= 10 && roles.direct + roles.method === 22, `roles: ${JSON.stringify(roles)}`);
    return `${roles.direct} direct applications, ${roles.method} methods on simplified examples`;
  });
  await test('business guide page: the question leads each card, the lesson is named, and technical detail is one click away', async () => {
    const t = C.trackById.business;
    const { published } = T.trackLessons(t);
    const p = await open('/track/business', '.biz-card');
    try {
      assert(p.$('.page-head .eyebrow').textContent.trim() === 'Guide' && !/\btrack\b/i.test(p.$('#main').textContent), 'the page still uses the word "track"');
      const cards = p.$$('.biz-card');
      assert(cards.length === published.length && published.length === 22, `${cards.length} cards for ${published.length} lessons`);
      for (const card of cards) {
        const id = card.id.replace('lesson-', ''); const a = C.algoById[id];
        const it = t.groups.flatMap((g) => g.items).find((x) => x.id === id);
        const kids = [...card.children].map((c) => c.className.split(' ')[0] || c.tagName);
        assert(kids[0] === 'biz-role' && kids[1] === 'H3' && kids[2] === 'biz-bridge', `${id}: the card's order is ${kids.join(', ')}`);
        assert(card.querySelector('h3').textContent === it.question && card.querySelector('h3 a').getAttribute('href') === `#/algorithm/${id}`, `${id}: the heading is not the question, linked to the lesson`);
        assert(card.querySelector('.biz-role').textContent === T.ROLES[it.role].label, `${id}: wrong role label`);
        assert(card.querySelector('.biz-meta').textContent.includes(a.name) && card.querySelector('.biz-meta').textContent.includes(C.disciplineById[a.discipline].short), `${id}: the lesson name or discipline is missing`);
        const tech = card.querySelector('details.biz-tech');
        assert(tech && !tech.open, `${id}: technical details are not tucked away`);
        // nothing outside the fold may state a cost formula
        const visible = [...card.children].filter((c) => c !== tech).map((c) => c.textContent).join(' ');
        assert(!/O\(|log n|n²/.test(visible), `${id}: a cost formula is shown before the reader asks for it`);
        const rows = Object.fromEntries([...tech.querySelectorAll('.biz-dl > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]));
        for (const k of ['What the lesson shows', 'Approach', 'How the work grows', 'Time, worst case', 'Memory, worst case', 'It needs']) assert(rows[k], `${id}: technical details lack "${k}"`);
        assert(rows['Time, worst case'] === a.time.worst && rows.Approach !== rows['How the work grows'], `${id}: cost and approach are not kept apart`);
      }
      assert(p.$$('.biz-legend > div').length === 3, 'the three kinds of lesson are not explained');
      // technical foundations: shown under the group that needs them, and really assumed by a lesson in it
      const groups = p.$$('.track-group').slice(0, t.groups.length);
      for (const [k, g] of t.groups.entries()) {
        const shown = [...groups[k].querySelectorAll('.track-found li a')].map((x) => x.getAttribute('href').split('/').pop());
        const real = T.foundationsFor(t, g.lessons).map((f) => f.lesson.id);
        assert(shown.join() === real.join(), `"${g.title}": foundations shown ${shown.join()} but the lessons assume ${real.join()}`);
        for (const id of shown) assert(!published.some((a) => a.id === id), `${id} is listed as a foundation and as a lesson`);
      }
      assert(p.$$('.track-paths li').length === t.paths.length && p.$$('.track-paths .track-path-progress').every((x) => /\d+ of \d+ lessons opened/.test(x.textContent)), 'learning paths are not listed with their progress');
      const start = p.$('.track-status .btn');
      assert(start && C.algoById[start.getAttribute('href').split('/').pop()], 'no working place to start');
      assert(p.$('.biz-case') && p.$('.biz-case').getAttribute('href') === '#/case/budget', 'the worked case is not offered');
      const crypto = t.groups.find((g) => g.lessons.includes('rsa')), scale = t.groups.find((g) => g.lessons.includes('consistent-hashing'));
      assert(crypto !== scale, 'cryptography and distributed systems share a group');
      return `${cards.length} cards, ${t.groups.length} groups`;
    } finally { p.close(); }
  });
  await test('the other guide lists its lessons in the usual way', async () => {
    const t = C.trackById.ai;
    const { published, planned } = T.trackLessons(t);
    const p = await open('/track/ai', '.track-group .lesson-row');
    try {
      const live = p.$$('.track-group .lesson-row:not(.is-planned) h3 a').map((a) => a.getAttribute('href').split('/').pop());
      assert(live.length === published.length && published.every((a) => live.includes(a.id)), `the page lists ${live.length} lessons, the guide has ${published.length}`);
      assert(p.$$('.track-group .lesson-row.is-planned').length === planned.length, 'planned lessons are not all shown as planned');
      assert(p.$('.page-head .eyebrow').textContent.trim() === 'Guide', 'the page does not call itself a guide');
    } finally { p.close(); }
    const q = await open('/track/nope', '#main h1');
    try { assert(/no guide at this address/i.test(q.$('#main h1').textContent), 'an unknown guide does not say so'); } finally { q.close(); }
  });
  await test('a lesson that teaches on a simple example says what it stands for in a business', async () => {
    const p = await open('/algorithm/monte-carlo', '.lesson h1');
    try {
      const box = p.$('.biz-bridge-box');
      const it = C.trackById.business.groups.flatMap((g) => g.items).find((x) => x.id === 'monte-carlo');
      assert(box && box.querySelector('h3').textContent === it.question && box.textContent.includes(it.bridge), 'the Monte Carlo lesson has no business bridge beside its demonstration');
      assert(p.$('#see').contains(box) && box.offsetParent !== null, 'the bridge is not beside the demonstration at level 1');
      assert(/π|pi/i.test(p.$('#see').textContent) || /π|pi/i.test(p.$('.lesson-head').textContent), 'the simple example was removed');
    } finally { p.close(); }
    const q = await open('/algorithm/ab-testing', '.lesson h1');
    try { assert(!q.$('.biz-bridge-box'), 'a lesson that already models a business problem carries a bridge it does not need'); } finally { q.close(); }
    const r = await open('/algorithm/quick-sort', '.lesson h1');
    try { assert(!r.$('.biz-bridge-box'), 'a lesson outside the business guide carries a business bridge'); } finally { r.close(); }
  });
  await test('worked budget case: the answer on the page is the best possible, checked by trying every combination', async () => {
    const c = C.caseById.budget;
    // every one of the 256 ways to fund the eight proposals
    let best = { benefit: -1, set: [] }, ties = 0;
    for (let mask = 0; mask < (1 << c.items.length); mask++) {
      let cost = 0, benefit = 0; const set = [];
      c.items.forEach((x, i) => { if (mask & (1 << i)) { cost += x.cost; benefit += x.benefit; set.push(i); } });
      if (cost > c.budget) continue;
      if (benefit > best.benefit) { best = { benefit, set }; ties = 1; } else if (benefit === best.benefit) ties++;
    }
    assert(ties === 1, `${ties} plans tie for the best, so the page could not name one`);
    const byHand = (rank) => { const order = c.items.map((_, i) => i).sort((a, b) => rank(c.items[b]) - rank(c.items[a]) || a - b); let spent = 0, benefit = 0; for (const i of order) if (spent + c.items[i].cost <= c.budget) { spent += c.items[i].cost; benefit += c.items[i].benefit; } return benefit; };
    const p = await open('/case/budget', '.case-route.is-best');
    try {
      const money = (el) => Number(el.textContent.replace(/[$,]/g, ''));
      const totals = p.$$('.case-route-total').map(money);
      assert(totals[2] === best.benefit * 1000, `the page says the best is $${totals[2]}, trying every combination gives $${best.benefit * 1000}`);
      assert(totals[0] === byHand((x) => x.benefit) * 1000 && totals[1] === byHand((x) => x.benefit / x.cost) * 1000, `the two shortcuts read $${totals[0]} and $${totals[1]}`);
      assert(totals[0] < totals[2] && totals[1] < totals[2], 'a shortcut matches the best plan, so the case teaches nothing');
      const funded = p.$$('.case-table tbody tr').map((tr, i) => (tr.children[4].textContent === 'Yes' ? i : -1)).filter((i) => i >= 0);
      assert(funded.join() === best.set.join(), `the page funds ${funded.join()}, the best plan is ${best.set.join()}`);
      for (const name of best.set.map((i) => c.items[i].name)) assert(p.$('.case-route.is-best').textContent.includes(name), `the best plan does not name ${name}`);
      assert(p.$('.player-stage') && /Step 1 \//.test(p.$('.step-label').textContent), 'the lesson\'s method is not running on the page');
      assert(/invented/.test(p.$('.case-note').textContent), 'the page does not say the figures are invented');
      // "Benefit per $1 spent" is explained, with its formula, a worked example and how to read it
      const sec = p.$('#per-dollar');
      assert(sec && sec.querySelector('.case-formula'), 'benefit per $1 spent is never explained');
      const frac = [...sec.querySelectorAll('.case-frac span')].map((x) => x.textContent);
      assert(frac.join('/') === 'Estimated benefit/Project cost', `the formula reads ${frac.join(' over ')}`);
      const first = c.items[0], want = (first.benefit * 1000) / (first.cost * c.unit);
      assert(sec.textContent.includes(first.name) && sec.textContent.includes(`$${want.toFixed(2)}`), 'the worked example does not use the first proposal\'s real figures');
      p.$$('.case-table tbody tr').forEach((tr, i) => { const x = c.items[i]; assert(tr.children[3].textContent === `$${((x.benefit * 1000) / (x.cost * c.unit)).toFixed(2)}`, `row ${i + 1}: benefit per $1 reads ${tr.children[3].textContent}`); });
      assert(/Above \$1\.00/.test(sec.textContent) && /Below \$1\.00/.test(sec.textContent) && /does not settle it/.test(sec.textContent), 'the page does not say how to read the figure, or why it is not enough on its own');
      const above = c.items.filter((x) => x.benefit * 1000 > x.cost * c.unit).length;
      assert(sec.textContent.includes(`${above} of the ${c.items.length} do`), 'the count of proposals above $1.00 is wrong');
      assert([...p.$$('.case-sec')].indexOf(sec) === 1, 'the explanation does not come straight after the table');
      assert(p.$$('.case-assume li').length === c.assumptions.length && p.$$('.case-assume a').every((a) => C.algoById[a.getAttribute('href').split('/').pop()]), 'the limits of the model are not all stated, or point at a missing lesson');
      return `best $${best.benefit * 1000} against $${totals[0]} and $${totals[1]} for the shortcuts, out of ${1 << c.items.length} combinations`;
    } finally { p.close(); }
  });
  await test('cost is named the same way everywhere, and never confused with approach', async () => {
    const { TIME_CLASS_SHORT, TIME_CLASS_LABELS, TIME_CLASS_PLAIN, TIME_CLASSES, PARADIGM_LABELS } = await import('../js/core/schema.js');
    for (const k of TIME_CLASSES) assert(TIME_CLASS_SHORT[k] && TIME_CLASS_LABELS[k] && TIME_CLASS_PLAIN[k], `no standard wording for "${k}"`);
    const approach = new Set(Object.values(PARADIGM_LABELS).map((x) => x.toLowerCase()));
    for (const v of Object.values(TIME_CLASS_SHORT)) { assert(/time/i.test(v), `"${v}" does not say it is about time`); assert(!approach.has(v.toLowerCase()) && !/^iterative$/i.test(v), `"${v}" reads as an approach`); }
    const p = await open('/library', '.lesson-row');
    try {
      const labels = new Set(p.$$('.lesson-row .lesson-cost').map((x) => x.textContent));
      assert(labels.size >= 5, 'the library rows show no cost labels');
      for (const l of labels) assert(Object.values(TIME_CLASS_SHORT).includes(l), `a row shows the cost as "${l}"`);
      assert(p.$$('.lesson-row .lesson-cost').every((x) => /Worst case: /.test(x.title)), 'a cost label does not carry the worst case');
    } finally { p.close(); }
  });
  await test('the Paths page lists each path once, even for a reader who has started some', async () => {
    localStorage.clear();
    const { store } = await import('../js/core/store.js');
    const p0 = await open('/algorithm/linear-search', '.lesson h1'); p0.close();   // open a lesson, so a path counts as started
    const p = await open('/paths', '.path-row');
    try {
      const titles = p.$$('.path-row h3 a').map((a) => a.getAttribute('href'));
      assert(titles.length === C.paths.length && new Set(titles).size === titles.length, `${titles.length} rows for ${C.paths.length} paths`);
      assert(!p.$$('.path-group h2').some((x) => /^Continue$/.test(x.textContent)), 'the Continue section is still there');
      assert(p.$$('.path-row').some((r) => /[1-9]\d* of \d+ opened/.test(r.textContent)), 'a started path no longer shows its progress in the list');
    } finally { p.close(); localStorage.clear(); }
  });
  await test('progress is described with one word, "opened", wherever it is shown', async () => {
    localStorage.clear();
    const { store } = await import('../js/core/store.js');
    const bad = [];
    for (const hash of ['/algorithm/linear-search', '/', '/track/business', '/track/ai', '/paths', '/path/absolute-beginners', '/profile', '/library']) {
      const p = await open(hash, '#main h1');
      try {
        await sleep(120);
        const text = `${p.$('#main').textContent} ${p.$('.site-head').textContent}`;
        // words for the reader's progress; "visited" is also what a search does to a node, so it is only counted beside "lesson"
        const m = text.match(/\bexplored\b|\blessons? (visited|completed|read)\b|\b(visited|completed) (lessons?|\d+ of)/i);
        if (m) bad.push(`${hash}: "${m[0]}"`);
      } finally { p.close(); }
    }
    localStorage.clear();
    assert(!bad.length, bad.join(' | '));
  });
  await test('the home page and the navigation lead with the two guides, and nothing is removed', async () => {
    const p = await open('/', '.track-card');
    try {
      const cards = p.$$('.track-card').map((a) => a.getAttribute('href'));
      assert(cards.join() === '#/track/ai,#/track/business', `the home page offers ${cards.join()}`);
      const sections = [...p.$('.home').children];
      assert(sections.indexOf(p.$('.home-kitchen')) === 1 && sections.indexOf(p.$('.home-tracks')) === 2, 'the kitchen recipes and then the two guides no longer follow the hero');
      assert(p.$('#universe'), 'the map is gone from the home page');
      assert(!p.$('.ledger') && !/tests passed against independent answers/.test(p.$('.home').textContent), 'the verification numbers are back on the home page');
      assert(p.$('.site-foot a[href="#/verification"]'), 'the Verification page can no longer be reached from the footer');
      const nav = p.$$('nav.primary a').map((a) => a.textContent.trim());
      assert(nav.join(' | ') === 'Kitchen | Business | AI and ML | Library | Lab | Paths', `the navigation reads ${nav.join(' | ')}`);
      assert(p.$$('nav.primary a').map((a) => a.getAttribute('href')).join() === '#/kitchen,#/track/business,#/track/ai,#/library,#/lab,#/paths', 'a navigation link goes to the wrong page');
      // About and the map left the header; the footer still reaches both
      assert(p.$('.site-foot a[href="#/about"]') && p.$('.site-foot a[href="#/explore"]'), 'About or the map can no longer be reached');
      assert(p.$('.site-foot a[href="#/connections"]'), 'Connections can no longer be reached from the footer');
      const made = p.$('.site-foot .foot-made a');
      assert(made && made.textContent === 'Made by Matty' && made.getAttribute('href') === 'https://matthew-schmidt-production.up.railway.app/', 'the footer credit is missing or links somewhere else');
      assert(!/explained and run in front of you|There are no accounts/.test(p.$('.site-foot').textContent), 'the old footer lines are back');
      assert(p.doc.documentElement.scrollWidth <= 1201, 'the navigation overflows the page');
    } finally { p.close(); }
    // on a wide screen and on a narrow one, the links must stop short of the search button
    for (const width of [1900, 1440, 1024]) {
      const w = await open('/', 'nav.primary a', { width, height: 700 });
      try {
        const last = w.$$('nav.primary a').pop().getBoundingClientRect(), tools = w.$('.head-tools').getBoundingClientRect();
        const sameRow = Math.abs(last.top - tools.top) < 30;
        assert(!sameRow || last.right + 8 <= tools.left, `at ${width}px wide the links end at ${Math.round(last.right)}px and the search button starts at ${Math.round(tools.left)}px`);
        assert(w.doc.documentElement.scrollWidth <= width + 1, `at ${width}px wide the page scrolls sideways`);
      } finally { w.close(); }
    }
    assert(S.search('quick sort')[0].ref === 'quick-sort' && C.algos.length >= 57, 'a lesson outside the tracks can no longer be found');
  });
  await test('the three "Should you use it?" statements are in plain words on every lesson', async () => {
    // terms a newcomer should not meet in a block written for someone deciding, without explanation
    const JARGON = /NP-hard|\bO\(|pseudo-polynomial|admissible|\bheuristic|stationary point|\bconvex\b|differentiable|\bstiff\b|\bmodes?\b|discrete logarithm|coprime|φ|quadratic|radix|entropy coder|asymptot|amortized|non-stiff|local optimum|global optimum|likelihood|posterior|\bprior\b|hyperparameter|regulari[sz]ation|eigen|covariance|stochastic|Markov|softmax|logits?\b|gradient\b/i;
    const bad = [];
    for (const a of C.algos) {
      const L = await C.loadLesson(a.id);
      for (const k of ['useWhen', 'requires', 'limits']) {
        const t = L.compare[k];
        const m = t.match(JARGON);
        if (m) bad.push(`${a.id}.${k}: "${m[0]}"`);
        if (t.length > 330) bad.push(`${a.id}.${k}: ${t.length} characters`);
      }
    }
    assert(!bad.length, `${bad.length}: ${bad.slice(0, 12).join(' | ')}`);
    return `${C.algos.length * 3} statements`;
  });
  await test('every lesson says when to use it, what it needs and where it falls short, in its own words', async () => {
    for (const a of C.algos) { const L = await C.loadLesson(a.id); assert(L.compare && L.compare.useWhen && L.compare.requires && L.compare.limits, `${a.id} is missing one of the three statements`); }
    const L = await C.loadLesson('k-means');
    const p = await open('/algorithm/k-means?level=1', '#decide');
    try {
      const rows = Object.fromEntries(p.$$('#decide .decide-dl > div').map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]));
      const plain = (t) => t.replace(/\*\*|`/g, '');
      assert(rows['Use it when'] === plain(L.compare.useWhen) && rows['It needs'] === plain(L.compare.requires) && rows['It falls short when'] === plain(L.compare.limits), 'the block does not show the lesson\'s own statements');
      assert(p.$('#decide').offsetParent !== null, 'the block is hidden at level 1');
    } finally { p.close(); }
  });
}

/* ------------------------------------------------------------------ practice */
// A lesson should ask before it tells: the learner commits to an answer, then sees the outcome.
if (on('practice')) {
  suite('Asking before telling');
  const { execute, resolveInput } = await import('../js/core/tracer.js');
  const { runJavaScript, normalizeOutput } = await import('../js/run/sandbox.js');
  const lessons = [];
  for (const a of C.algos) lessons.push(await C.loadLesson(a.id));
  const sameInput = (L, x, y) => JSON.stringify(resolveInput(L, x)) === JSON.stringify(resolveInput(L, y));

  await test('Things to try: every prompt puts a question, and its outcome stays closed until asked for', async () => {
    let n = 0;
    for (const L of lessons) for (const t of L.viz.tryThis) {
      assert(t && typeof t.ask === 'string' && t.ask.includes('?'), `${L.meta.id}: a prompt asks nothing: "${String(t.ask || t).slice(0, 60)}"`);
      assert(typeof t.reveal === 'string' && t.reveal.length > 20, `${L.meta.id}: a prompt has no outcome to reveal`);
      n++;
    }
    const L = await C.loadLesson('binary-search');
    const p = await open('/algorithm/binary-search?level=2', '.try-this');
    try {
      const items = p.$$('.try-this .try-list > li');
      assert(items.length === L.viz.tryThis.length, `the page shows ${items.length} prompts, the lesson has ${L.viz.tryThis.length}`);
      for (const li of items) {
        const d = li.querySelector('details.try-reveal');
        assert(d && !d.open, 'an outcome is open before the reader asked for it');
        assert(!d.querySelector('p').checkVisibility(), 'the outcome can be read while its fold is closed');
      }
      const first = items[0].querySelector('details.try-reveal');
      first.querySelector('summary').click();
      await until(() => first.open && first.querySelector('p').checkVisibility(), 1500, 'opening the fold did not show the outcome');
    } finally { p.close(); }
    return `${n} prompts`;
  });

  await test('Predict questions: the case is one the page shows nowhere else, and the stated answer is what the run gives', () => {
    let n = 0;
    for (const L of lessons) for (const q of L.quiz.filter((x) => x.type === 'predict')) {
      const id = L.meta.id, what = `${id}: "${q.q.slice(0, 50)}"`;
      assert(q.tryInput && typeof q.check === 'function', `${what} cannot be run or has no proof of its answer`);
      assert(!sameInput(L, q.tryInput, {}), `${what} asks about the input the page opens with`);
      for (const pr of L.viz.presets || []) assert(!sameInput(L, q.tryInput, pr.values), `${what} asks about the preset "${pr.label}"`);
      if (L.example.tryInput) assert(!sameInput(L, q.tryInput, L.example.tryInput), `${what} asks about the worked example`);
      for (const t of L.viz.tryThis) if (t.input) assert(!sameInput(L, q.tryInput, t.input), `${what} asks about a case from "Things to try"`);
      const r = execute(L, q.tryInput);
      assert(r.ok, `${what} does not run: ${r.error}`);
      const verdict = q.check(r.result, r.counters, r);
      assert(verdict === true, `${what}: the run does not give the stated answer (${verdict})`);
      n++;
    }
    return `${n} questions`;
  });

  await test('Break it: every change is to text found once in the program, and really changes what it prints', async () => {
    let n = 0;
    for (const L of lessons) {
      const c = L.code, id = L.meta.id;
      assert(Array.isArray(c.breakIt) && c.breakIt.length >= 2, `${id} offers fewer than two changes`);
      for (const b of c.breakIt) {
        for (const lang of ['python', 'javascript']) assert(c[lang].source.split(b.find[lang]).length === 2, `${id}: "${b.find[lang]}" is not found exactly once in the ${lang}`);
        assert(b.change.includes('?'), `${id}: a change asks nothing: "${b.change.slice(0, 50)}"`);
        if (b.hangs) continue;
        const r = await runJavaScript(c.javascript.source.replace(b.find.javascript, b.replace.javascript), { timeout: 3000 });
        assert(!r.ok || normalizeOutput(r.out) !== normalizeOutput(c.javascript.expected ?? c.sample.expected), `${id}: "${b.change.slice(0, 50)}" leaves the output as it was`);
        n++;
      }
    }
    return `${n} changes run`;
  });

  await test('Break it, as a reader would: edit Binary Search on the page, run it, and the named mistake shows', async () => {
    const L = await C.loadLesson('binary-search');
    const b = L.code.breakIt[0];
    const p = await open('/algorithm/binary-search?level=2', '.break-it');
    try {
      const items = p.$$('.break-it .try-list > li');
      assert(items.length === L.code.breakIt.length, 'the page does not list the lesson\'s changes');
      for (const li of items) assert(!li.querySelector('details').open, 'an outcome is open before the reader asked for it');
      const panel = p.$('#code .code-panel');
      panel.querySelector('.tabs button[data-lang="javascript"]').click();
      const buttons = [...panel.querySelectorAll('.code-run-buttons button')];
      buttons.find((x) => /Edit the code/.test(x.textContent)).click();
      const ed = panel.querySelector('textarea.code-editor');
      assert(ed.value.includes(b.find.javascript), 'the text to change is not in the editor');
      ed.value = ed.value.replace(b.find.javascript, b.replace.javascript);
      buttons.find((x) => /Run/.test(x.textContent)).click();
      const out = await until(() => panel.querySelector('.code-output pre.code-out'), 6000, 'the edited program never printed anything');
      assert(/2 not found/.test(out.textContent), `the broken search did not lose the first value: ${out.textContent}`);
      assert(items[0].querySelector('details p').textContent.includes('2 not found'), 'the outcome on the page does not say what the program printed');
    } finally { p.close(); }
  });

  await test('A challenge can be checked: what a correct answer gives sits behind a closed fold', async () => {
    for (const L of lessons) for (const q of L.quiz.filter((x) => x.type === 'challenge')) assert(typeof q.expect === 'string' && q.expect.length > 15, `${L.meta.id}: the challenge "${q.title}" gives nothing to check against`);
    const p = await open('/algorithm/binary-search?level=2', '.quiz-item.is-challenge');
    try {
      const folds = [...p.$$('.quiz-item.is-challenge details')];
      const fold = folds.find((d) => d.querySelector('summary').textContent === 'Check your answer');
      assert(fold && !fold.open, 'the answer is missing, or open before the reader asked for it');
    } finally { p.close(); }
  });

  await test('"Should you use it?" also says what to reach for when it does not fit', async () => {
    for (const L of lessons) assert((L.tradeoffs.alternatives || []).length >= 1, `${L.meta.id} names no alternative`);
    const p = await open('/algorithm/binary-search?level=1', '#decide');
    try {
      const row = p.$$('#decide .decide-dl > div').find((d) => d.querySelector('dt').textContent === 'If it does not fit');
      assert(row, 'the row is missing');
      const links = [...row.querySelectorAll('a')].map((a) => a.getAttribute('href'));
      assert(links.includes('#/algorithm/linear-search'), `it does not point to Linear Search: ${links.join()}`);
      for (const h of links) assert(C.algoById[h.replace('#/algorithm/', '')], `${h} is not a published lesson`);
      assert(!/planned/i.test(row.textContent), 'the row advertises a lesson that does not exist');
    } finally { p.close(); }
  });

  await test('Budget case: the method is told in proposals, cost and benefit, not bags and items', async () => {
    const c = C.caseById.budget;
    const p = await open('/case/budget', '.case-page .player-note');
    try {
      const fig = p.$('.case-page .player');
      // every step of the run, not only the first: the notes change as it goes
      const run = execute(await C.loadLesson('knapsack'), { weights: c.items.map((x) => x.cost), values: c.items.map((x) => x.benefit), capacity: c.budget, wording: 'budget' });
      const told = fig.textContent + ' ' + run.frames.map((f) => `${f.note} ${Object.keys(f.vars || {}).join(' ')} ${JSON.stringify(f.views.map((v) => [v.title, v.corner, v.rowLabels, v.legend, (v.rows || []).map((r) => r.label)]))}`).join(' ');
      assert(/proposal/.test(told) && /budget/.test(told), 'the demonstration does not speak of proposals and a budget');
      const stray = told.match(/\b(bag|items?|weighs?|weight|capacity)\b/i);
      assert(!stray, `the demonstration still says "${stray && stray[0]}"`);
      const rows = p.$$('.case-table tbody tr');
      rows.forEach((tr, i) => assert(tr.children[0].textContent.startsWith(String(i + 1)), `proposal ${i + 1} is not numbered, so the demonstration's "proposal ${i + 1}" cannot be matched to it`));
    } finally { p.close(); }
    const several = c.assumptions.find((a) => /one limit/.test(a.text));
    assert(several && /integer program/.test(several.then.say) && !/are what the Simplex Method is for/.test(several.then.say), 'the case still sends all-or-nothing proposals with several limits to plain Simplex');
    const K = await C.loadLesson('knapsack');
    const r = execute(K, {});
    assert(/bag/.test(r.frames[0].note) && !/proposal/.test(r.frames[0].note), 'the Knapsack lesson no longer opens with its own picture, the bag');
  });

  await test('Gradient Descent: momentum is compared fairly, on the same valley at the same rate, and it is faster', async () => {
    const L = await C.loadLesson('gradient-descent');
    const plain = L.viz.presets.find((x) => /Zig-zag/.test(x.label)), mom = L.viz.presets.find((x) => /with momentum/.test(x.label));
    assert(plain && mom, 'one of the two presets is gone');
    assert(plain.values.landscape === mom.values.landscape && plain.values.rate === mom.values.rate && mom.values.momentum > 0 && plain.values.momentum === 0, 'the two presets differ in more than momentum');
    const a = execute(L, plain.values), b = execute(L, mom.values);
    assert(a.result.status === 'converged' && b.result.status === 'converged', 'one of the two runs does not converge');
    assert(b.result.steps < a.result.steps, `momentum takes ${b.result.steps} steps against ${a.result.steps} without it`);
    return `${a.result.steps} steps without, ${b.result.steps} with`;
  });

  await test('A lesson that shows a mechanism with hand-set numbers also shows those numbers being learned', async () => {
    const need = ['attention', 'ddpm', 'graph-neural-network', 'convolution'];
    let n = 0;
    for (const L of lessons) for (const x of L.code.more || []) {
      const r = await runJavaScript(x.javascript.source, { timeout: 5000 });
      assert(r.ok && normalizeOutput(r.out) === normalizeOutput(x.javascript.expected ?? x.sample.expected), `${L.meta.id}: "${x.title}" does not print what the page says it prints`);
      n++;
    }
    for (const id of need) assert(((await C.loadLesson(id)).code.more || []).length >= 1, `${id} has no second program`);
    const p = await open('/algorithm/attention?level=2', '.code-more');
    try {
      assert(p.$('.code-more h3') && p.$('.code-more .code-panel pre.code-pre').textContent.length > 200, 'the second program is not shown');
    } finally { p.close(); }
    return `${n} further programs`;
  });
}

/* ------------------------------------------------------------------ kitchen */
// The gentlest way in. Every figure on the page must follow from the rule it illustrates.
if (on('kitchen')) {
  suite('Algorithms for the kitchen');
  const K = await import('../content/kitchen.js');
  const P = await import('../js/pages/kitchen.js');
  const card = (id) => K.kitchen.find((c) => c.id === id);

  await test('the home page opens with the three recipes, right after the introduction, and each opens its own recipe', async () => {
    const p = await open('/', '.home-kitchen');
    try {
      assert([...p.$('.home').children].indexOf(p.$('.home-kitchen')) === 1, 'the recipes are not the first thing after the introduction');
      const links = p.$$('.kitchen-teaser').map((a) => a.getAttribute('href'));
      assert(links.join() === K.kitchen.map((c) => `#/kitchen?at=${c.id}`).join(), `the recipes link to ${links.join()}`);
      assert(p.$('.site-foot a[href="#/kitchen"]'), 'the footer does not link to the kitchen page');
    } finally { p.close(); }
  });

  await test('the home section is drawn and moves a little, but the cards always end up in view, and no text has an em dash', async () => {
    const all = JSON.stringify(K);
    assert(!/\u2014|\s\u2013\s/.test(all), 'the kitchen text contains an em dash');
    const p = await open('/', '.home-kitchen');
    try {
      const sec = p.$('.home-kitchen');
      assert(p.$$('.kitchen-teaser-art svg').length === K.kitchen.length && p.$('.home-kitchen-pot svg'), 'the drawings are missing');
      sec.scrollIntoView();
      await until(() => sec.classList.contains('has-risen') || !sec.classList.contains('will-rise'), 3000, 'the cards never rose into place');
      await until(() => p.$$('.kitchen-teaser').every((c) => p.win.getComputedStyle(c).opacity === '1'), 3000, 'a card is still invisible after rising');
      assert(p.win.getComputedStyle(p.$('.ka-steam')).animationName === 'ka-steam', 'the steam does not move');
      const bg = p.win.getComputedStyle(sec).backgroundColor;
      assert(bg !== p.win.getComputedStyle(p.doc.body).backgroundColor, 'the section has the same colour as the page');
    } finally { p.close(); }
  });

  await test('home: "Algorithms at work" reads straight down, has its own colour, and its figures always end up in view', async () => {
    const p = await open('/', '.home-demos');
    try {
      const sec = p.$('.home-demos');
      const order = [...p.$('.home-demos-text').children].map((e) => e.tagName).join(',');
      assert(order === 'P,H2,P', `the heading reads ${order}`);
      const t = p.$('.home-demos-text h2').getBoundingClientRect(), l = p.$('.home-demos-text .lede').getBoundingClientRect();
      assert(l.top > t.bottom - 1 && Math.abs(l.left - t.left) < 2, 'the introduction is not directly under the title');
      assert(p.win.getComputedStyle(sec).backgroundColor !== p.win.getComputedStyle(p.doc.body).backgroundColor, 'the section has the same colour as the page');
      assert(p.win.getComputedStyle(p.$('.ka-bar')).animationName === 'ka-sort', 'the bars do not move');
      sec.scrollIntoView();
      await until(() => p.$$('.home-demos .preview').every((c) => p.win.getComputedStyle(c).opacity === '1'), 3000, 'a figure is still invisible after rising');
    } finally { p.close(); }
  });

  await test('each recipe has its own soft colour and its own picture', async () => {
    const p = await open('/kitchen', '.kitchen-scene svg');
    try {
      const cards = p.$$('.kitchen-card');
      const colours = cards.map((c) => p.win.getComputedStyle(c).backgroundColor);
      assert(new Set(colours).size === cards.length, `the recipes share colours: ${colours.join(' | ')}`);
      assert(!colours.includes(p.win.getComputedStyle(p.doc.body).backgroundColor), 'a recipe has the same colour as the page');
      for (const c of cards) {
        const svg = c.querySelector('.kitchen-scene svg');
        assert(svg && svg.getAttribute('aria-label'), `${c.id} has no picture, or its picture is not described`);
      }
    } finally { p.close(); }
  });

  await test('each recipe leads to a published lesson, and the page uses no formulas or symbols', async () => {
    for (const c of K.kitchen) {
      assert(C.algoById[c.lesson], `${c.id} leads to "${c.lesson}", which is not a published lesson`);
      if (c.alsoLesson) assert(C.algoById[c.alsoLesson], `${c.id} also names "${c.alsoLesson}", which is not published`);
      assert(c.steps.length >= 3 && c.steps.length <= 5, `${c.id} has ${c.steps.length} steps; a recipe should be short`);
    }
    const p = await open('/kitchen', '.kitchen-card');
    try {
      assert(p.$$('.kitchen-card').length === K.kitchen.length, 'the page does not show every recipe');
      const text = p.$('.kitchen-page').textContent;
      const sym = text.match(/[=×÷√∑≤≥]|log₂|O\(|\bn\b|formula[^s]/);
      assert(!sym || sym[0] === 'formula ', `the page uses "${sym && sym[0]}"`);
      for (const c of K.kitchen) assert(p.$(`#${c.id} .kitchen-next a[href="#/algorithm/${c.lesson}"]`), `${c.id} does not link to its lesson`);
    } finally { p.close(); }
  });

  await test('every real time, temperature and ratio names where it comes from, in the text', async () => {
    for (const c of K.kitchen) if (c.checked) {
      assert((c.sources || []).length, `${c.id} gives real numbers without a source`);
      for (const id of c.sources) assert(K.kitchenSources[id] && /^https:\/\//.test(K.kitchenSources[id].url), `${c.id} cites "${id}", which is not in the list`);
    }
    for (const id of ['dinner', 'dressing', 'pizza']) assert(card(id).checked, `${id} is not checked against a real kitchen`);
    const dinner = card('dinner');
    const chicken = dinner.dishes.find((d) => /chicken/i.test(d.name)), oven = chicken.tasks.find((t) => /oven/.test(t.name)).minutes;
    assert(oven >= 75 && oven <= 90 && /3-pound chicken roasting at 350°F/.test(dinner.setup), 'the chicken no longer matches the USDA chart (1¼ to 1½ hours at 350°F for 3 to 4 pounds)');
    const p = await open('/kitchen', '.kitchen-checked');
    try {
      assert(!p.$('.kitchen-sources'), 'the list of sources is back at the end of the page');
      assert(p.$$('.kitchen-checked').length === K.kitchen.filter((c) => c.checked).length, 'a recipe does not say where its numbers come from');
    } finally { p.close(); }
  });

  await test('spice rack: the jars are in order, and turning the middle jar finds any spice in at most five looks', () => {
    const jars = card('spices').jars;
    assert(jars.length === 16 && jars.every((j, i) => i === 0 || jars[i - 1].localeCompare(j) < 0), 'the jars are not sixteen, in alphabetical order');
    let worst = 0;
    for (const target of jars) {
      let lo = 0, hi = jars.length - 1, looks = 0;
      for (;;) { const m = P.middle(lo, hi); looks++; if (jars[m] === target) break; if (target.localeCompare(jars[m]) > 0) lo = m + 1; else hi = m - 1; }
      worst = Math.max(worst, looks);
    }
    assert(worst === 5, `the worst case is ${worst} looks, and the page says five`);
    // the page also says a million entries never need more than 20 looks
    let n = 1e6, a = 0; while (n >= 1) { n = Math.floor(n / 2); a++; }
    assert(a === 20, `a million entries can need ${a} looks`);
    assert(/no more than 5 looks/.test(card('spices').point) && /no more than 20 looks/.test([].concat(card('spices').limits).join(' ')), 'the numbers in the text have changed; check them here');
  });

  await test('spice rack, as a reader would: "Let the algorithm choose" rules out half each time and finds the spice', async () => {
    const p = await open('/kitchen', '.rack');
    try {
      const target = p.$('.rack-ask strong').textContent;
      const help = [...p.$$('.rack-buttons button')].find((b) => /Let the algorithm choose/.test(b.textContent));
      let left = 16, looks = 0;
      while (!p.$('.jar.is-found')) {
        help.click(); looks++;
        const open = p.$$('.jar').filter((b) => !b.disabled).length;
        if (!p.$('.jar.is-found')) { assert(open <= Math.floor(left / 2), `after look ${looks}, ${open} jars are still open out of ${left}`); left = open; }
        assert(looks <= 5, 'the algorithm took more than five looks');
      }
      assert(p.$('.jar.is-found').textContent === target, `it found ${p.$('.jar.is-found').textContent}, not ${target}`);
      // even the longest names fit inside a jar
      for (const j of p.$$('.jar')) { const l = j.querySelector('.jar-label'); if (l.textContent) assert(l.getBoundingClientRect().bottom <= j.getBoundingClientRect().bottom, `"${l.textContent}" runs out of its jar`); }
      assert(new RegExp(`Found the ${target} in ${looks} look`).test(p.$('.rack-say').textContent), 'the page does not report the number of looks');
      // sixteen rounds in a row: every spice comes up once, and none twice in a row
      const seen = [target];
      for (let round = 1; round < 16; round++) {
        [...p.$$('.rack-buttons button')].find((b) => /Find another spice/.test(b.textContent)).click();
        const next = p.$('.rack-ask strong').textContent;
        assert(next !== seen[seen.length - 1], `${next} came up twice in a row`);
        seen.push(next);
        const again = [...p.$$('.rack-buttons button')].find((b) => /Let the algorithm choose/.test(b.textContent));
        let n = 0; while (!p.$('.jar.is-found') && n++ < 6) again.click();
      }
      assert(new Set(seen).size === 16, `sixteen rounds showed only ${new Set(seen).size} different spices: ${seen.join(', ')}`);
    } finally { p.close(); }
  });

  await test('pizza oven: every time and temperature in the text follows from the ten-minute steps', async () => {
    const c = card('pizza');
    const [summer, winter] = P.ovenSeries(c.oven);
    assert(summer.readyAfter === 100 && winter.readyAfter === 170, `the ovens are ready after ${summer.readyAfter} and ${winter.readyAfter} minutes`);
    // a real wood oven's dome runs at about 900°F; the summer oven should not run far past that in three hours
    assert(Math.max(...summer.temps) < 1000, `the summer oven reaches ${Math.round(Math.max(...summer.temps))}°F, hotter than real ovens run`);
    assert(Math.round(winter.ceiling) === 840 && winter.temps.every((t) => t < 840), `the winter oven's limit is ${winter.ceiling}`);
    const back = (m) => { const t = c.oven.readyAt[0] * 60 + c.oven.readyAt[1] - m; return `${Math.floor(t / 60) - 12}:${String(t % 60).padStart(2, '0')}`; };
    for (const bit of ['after 100 minutes', `by ${back(100)}`, 'takes 170 minutes', `by ${back(170)}`, 'never pass 840°F']) assert(c.point.includes(bit), `the text does not say "${bit}"`);
    assert(/about a seventh on a summer/.test(c.steps.join(' ')) && c.oven.seasons[0].share === 1 / 7 && /about a sixth in snow/.test(c.steps.join(' ')) && c.oven.seasons[1].share === 1 / 6, 'the shares in the steps do not match the numbers used');
    assert(c.steps.join(' ').includes(`${c.oven.fire} degrees`) && c.steps.join(' ').includes(`${c.oven.target}°F`), 'the fire or the target in the steps does not match the numbers used');
    assert(!/°C/.test(JSON.stringify(c)), 'the pizza recipe still uses Celsius');
    const p = await open('/kitchen', '.oven-chart');
    try {
      const step = [...p.$$('.oven-try button')].find((b) => /ten-minute step/.test(b.textContent));
      for (let i = 0; i < 10; i++) step.click();
      assert(/After 100 minutes/.test(p.$('.oven-status').textContent) && /summer oven reached 800°F after 100 minutes/.test(p.$('.oven-status').textContent), `after ten steps the page says: ${p.$('.oven-status').textContent}`);
      assert(!/winter oven reached/.test(p.$('.oven-status').textContent), 'the winter oven is ready too early');
      [...p.$$('.oven-try button')].find((b) => /Run to/.test(b.textContent)).click();
      assert(/winter oven reached 800°F after 170 minutes/.test(p.$('.oven-status').textContent), 'running to the end does not report the winter oven');
      assert(p.$$('.oven-line').every((l) => l.getAttribute('points').split(' ').length === 19) && p.$$('.oven-ghost').length === 2, 'the lines do not show every ten minutes for three hours');
    } finally { p.close(); }
  });

  await test('spice rack on a phone: the longest spice names still fit inside their jars', async () => {
    const p = await open('/kitchen', '.rack', { width: 390, height: 800 });
    try {
      const help = [...p.$$('.rack-buttons button')].find((b) => /Let the algorithm choose/.test(b.textContent));
      let n = 0; while (!p.$('.jar.is-found') && n++ < 6) help.click();
      // show every name, as the longest ones are what might not fit
      const jars = p.$$('.jar'), names = card('spices').jars;
      jars.forEach((j, i) => { j.querySelector('.jar-label').textContent = names[i]; });
      for (const j of jars) { const l = j.querySelector('.jar-label'); assert(l.getBoundingClientRect().bottom <= j.getBoundingClientRect().bottom && l.getBoundingClientRect().top >= j.getBoundingClientRect().top, `"${l.textContent}" runs out of its jar on a phone`); }
    } finally { p.close(); }
  });

  await test('dinner: every time on the page follows from the dishes', async () => {
    const c = card('dinner');
    const plan = P.dinnerPlan(c);
    const clock = (m) => { const t = c.serveAt[0] * 60 + c.serveAt[1] - plan.longest + m; return `${Math.floor(t / 60) - 12}:${String(t % 60).padStart(2, '0')}`; };
    const chicken = plan.rows.find((r) => /chicken/i.test(r.name)), potatoes = plan.rows.find((r) => /potato/i.test(r.name)), beans = plan.rows.find((r) => /bean/i.test(r.name));
    assert(plan.longest === 90 && chicken.spare === 0, 'the chicken is no longer the longest chain at 90 minutes');
    const text = c.steps.join(' ');
    for (const [what, t] of [['the chicken goes in', clock(0)], ['the potatoes can start up to', clock(potatoes.spare)], ['the beans can wait until', clock(beans.spare)]]) assert(text.includes(t), `the steps do not say ${what} ${t}`);
    assert(text.includes(`${potatoes.total} minutes`) && text.includes(`${chicken.total} minutes`), 'the chain lengths in the steps do not match the dishes');
    const p = await open('/kitchen', '.dinner');
    try {
      const rows = p.$$('.dinner-row .dinner-name span').map((x) => x.textContent);
      assert(rows.join(' | ') === `No spare time | ${potatoes.spare} minutes to spare | ${beans.spare} minutes to spare`, `the timeline says ${rows.join(' | ')}`);
      assert(p.$$('.dinner-axis span').map((x) => x.textContent).join(' ') === '5:30 6:00 6:30 7:00', 'the clock under the timeline is wrong');
    } finally { p.close(); }
  });
}

/* ------------------------------------------------------------------ report */
const payload = { results, bench };
document.getElementById('out').textContent = results.map((r) => `${r.ok ? 'ok  ' : 'FAIL'}  ${r.suite}: ${r.name}${r.ok ? '' : '\n      ' + r.detail}`).join('\n');
try { await fetch('/__report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch { /* opened by hand */ }
document.title = 'done';
