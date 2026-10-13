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
async function open(hash, ready, { width = 1200, height = 900 } = {}) {
  const f = document.createElement('iframe');
  f.style.cssText = `width:${width}px;height:${height}px;border:0;display:block`;
  f.src = `/index.html?motion=off#${hash}`;
  document.body.append(f);
  await until(() => f.contentDocument && f.contentDocument.querySelector(ready), 10000, `"${hash}" never showed ${ready}`);
  await sleep(60);
  return { doc: f.contentDocument, win: f.contentWindow, frame: f, close: () => f.remove(), $: (sel) => f.contentDocument.querySelector(sel), $$: (sel) => [...f.contentDocument.querySelectorAll(sel)] };
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
    const p = await open('/', '.home-want-list a');
    try {
      const sample = p.$$('.home-want-list a');
      assert(sample.length >= 4, `the home page offers ${sample.length} phrases`);
      for (const a of sample) assert(C.algoById[a.getAttribute('href').split('/').pop()], `${a.getAttribute('href')} is not a lesson`);
      p.$('.home-want-more a').click();
      await until(() => p.$('.want-row'), 5000, 'the index did not open from the home page');
      const row = p.$$('.want-row').find((r) => /Fastest way between two places/i.test(r.textContent));
      assert(row, 'the phrase "Fastest way between two places" is not among those shown first');
      row.querySelector('.want-phrase').click();
      await until(() => p.$('.lesson h1'), 8000, 'the lesson did not open');
      assert(/Dijkstra/.test(p.$('.lesson h1').textContent), `opened "${p.$('.lesson h1').textContent}"`);
      await until(() => p.$('.player-note .note-text'), 5000, 'the demonstration is not on the page');
      return 'home, then "Browse all", then "Fastest way between two places", then the Dijkstra lesson: two clicks';
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

/* ------------------------------------------------------------------ report */
const payload = { results, bench };
document.getElementById('out').textContent = results.map((r) => `${r.ok ? 'ok  ' : 'FAIL'}  ${r.suite}: ${r.name}${r.ok ? '' : '\n      ' + r.detail}`).join('\n');
try { await fetch('/__report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch { /* opened by hand */ }
document.title = 'done';
