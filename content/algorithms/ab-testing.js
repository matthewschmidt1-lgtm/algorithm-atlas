import { makeRng } from '../../js/lib/rng.js';

const Z_LINE = 1.96;                  // two-sided 5% significance level
const Z_POWER = 0.841621;             // the bell curve has 80% of its area below this score
const Z_EXACT = 1.959964;             // the unrounded 1.96
const SHOWN = 6;                      // visitor pairs narrated one at a time
const QUIET = { record: false, count() {}, frame() {} };

const pct = (v) => `${(100 * v).toFixed(1)}%`;
const pts = (v) => (100 * v).toFixed(1);
const f2 = (v) => { const s = v.toFixed(2); return s === '-0.00' ? '0.00' : s; };
const pts2 = (v) => (100 * v).toFixed(2);
const pText = (p) => (p >= 0.01 ? p.toFixed(3) : p >= 0.0001 ? p.toFixed(4) : 'below 0.0001');
// "about 1 time in 80": rounded more coarsely as the number grows, since it is only a rough guide.
const oneIn = (p) => {
  if (p < 0.0001) return 'less than 1 time in 10,000';
  const k = 1 / p, unit = k >= 2000 ? 100 : k >= 200 ? 10 : k >= 50 ? 5 : 1;
  return `about 1 time in ${Math.max(1, Math.round(k / unit) * unit)}`;
};

// Chance that a standard bell curve gives a score at least |z| away from 0, on either side.
// The area between 0 and |z| is added up with Simpson's rule, so there are no magic constants.
function twoSidedP(z) {
  const a = Math.min(Math.abs(z), 10), steps = 200, h = a / steps;
  let area = 0;
  for (let i = 0; i <= steps; i++) {
    const weight = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2;
    area += weight * Math.exp(-0.5 * (i * h) * (i * h));
  }
  area *= h / 3 / Math.sqrt(2 * Math.PI);
  return Math.min(1, Math.max(0, 1 - 2 * area));
}

// The test itself: a two-sided two-proportion z-test with a pooled standard error.
function zTest(buyA, nA, buyB, nB) {
  const pA = buyA / nA, pB = buyB / nB;
  const pooled = (buyA + buyB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  const z = se > 0 ? (pB - pA) / se : 0;
  return { pA, pB, diff: pB - pA, pooled, se, z, p: twoSidedP(z), significant: Math.abs(z) >= Z_LINE };
}

// 95% interval for the true difference, from the unpooled standard error (the Wald interval).
function interval(buyA, nA, buyB, nB) {
  const pA = buyA / nA, pB = buyB / nB;
  const half = Z_LINE * Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
  return [pB - pA - half, pB - pA + half];
}

// Visitors per group needed to notice the difference between two true rates 80% of the time.
function neededPerGroup(rateA, rateB) {
  const d = rateB - rateA;
  return Math.ceil(((Z_EXACT + Z_POWER) ** 2 * (rateA * (1 - rateA) + rateB * (1 - rateB))) / (d * d));
}

// Many complete experiments, counted. Used by the chart of false wins and by the tests.
function manyExperiments(input, repeats, t) {
  let wins = 0;
  t.count('winners declared', 0);
  for (let i = 0; i < repeats; i++) {
    t.count('experiments');
    const r = run({ ...input, repeats: 1, seed: 100003 * Math.floor(Number(input.seed) || 1) + i }, QUIET);
    if (r.significant) { wins++; t.count('winners declared'); }
  }
  const same = Math.abs(Number(input.rateA) - Number(input.rateB)) < 1e-9;
  t.frame(() => ({ line: 0,
    note: `Ran ${repeats} complete experiments, each with its own visitors. **${wins}** of them declared a winner, which is ${pct(wins / repeats)}. ${same ? 'The two versions had the same true rate in every one, so every winner was a false win.' : 'The two versions had different true rates, so a declared winner was usually a correct call.'}`,
    views: [{ kind: 'rows', title: 'Many experiments', rows: [{ label: 'Result', cells: [{ t: repeats, sub: 'experiments' }, { t: wins, sub: 'declared a winner', role: 'alert' }, { t: pct(wins / repeats), sub: 'share' }] }] }] }));
  return { repeats, wins, share: wins / repeats };
}

function run(input, t) {
  const rateA = Number(input.rateA), rateB = Number(input.rateB);
  if (!(rateA > 0 && rateA < 1 && rateB > 0 && rateB < 1)) throw new Error('Each true rate must be more than 0 and less than 1.');
  const n = Math.floor(Number(input.visitors));
  if (!(n >= 10)) throw new Error('Plan for at least 10 visitors per group.');
  const looks = Math.floor(Number(input.looks));
  if (!(looks >= 1)) throw new Error('Plan at least one check.');
  if (looks > n) throw new Error('There cannot be more checks than visitors per group.');
  const peeking = !!input.peek;
  const repeats = Math.floor(Number(input.repeats) || 1);
  if (repeats > 1) return manyExperiments(input, repeats, t);

  const rng = makeRng(input.seed);
  const picture = t.record !== false;
  const same = Math.abs(rateA - rateB) < 1e-9;
  const every = Math.max(1, Math.floor(n / 240));
  let seen = 0, buyA = 0, buyB = 0, tests = 0;
  const checks = [];                    // tallies at every check reached, with the test if one was run
  const trailA = [], trailB = [];       // running rates, kept only for the picture
  const firstA = [], firstB = [];

  const pair = (target, counted) => {
    const a = rng.next() < rateA, b = rng.next() < rateB;
    seen++;
    if (a) buyA++;
    if (b) buyB++;
    if (counted) t.count('visitors', 2);
    if (picture && (seen <= 40 || seen % every === 0 || seen === target)) { trailA.push([seen, buyA / seen]); trailB.push([seen, buyB / seen]); }
    return [a, b];
  };

  const yTop = Math.min(1, Math.max(rateA, rateB) * 2.2);
  const clampZ = (z) => Math.max(-3.8, Math.min(3.8, z));
  // stopSeen: where an early stop happened, so that anything collected afterwards is drawn faded.
  const views = (test, stopSeen, showPairs) => {
    const split = (trail) => (stopSeen ? [trail.filter((p) => p[0] <= stopSeen), trail.filter((p) => p[0] >= stopSeen)] : [trail.slice(), []]);
    const [aNow, aLater] = split(trailA), [bNow, bLater] = split(trailB);
    const rateLayers = same
      ? [{ type: 'line', points: [[0, rateA], [n, rateA]], role: 'ink', width: 1.3, dash: true },
        { type: 'text', at: [n, rateA], text: 'true rate of both', role: 'ink', align: 'right', dx: -6, dy: -7 }]
      : [{ type: 'line', points: [[0, rateA], [n, rateA]], role: 'ink', width: 1.3, dash: true },
        { type: 'line', points: [[0, rateB], [n, rateB]], role: 'ink', width: 1.3, dash: true },
        { type: 'text', at: [n, rateA], text: 'true rate of A', role: 'ink', align: 'right', dx: -6, dy: rateA < rateB ? 15 : -7 },
        { type: 'text', at: [n, rateB], text: 'true rate of B', role: 'ink', align: 'right', dx: -6, dy: rateA < rateB ? -7 : 15 }];
    if (aLater.length > 1) rateLayers.push({ type: 'line', points: aLater, role: 'forest', width: 1.6, alpha: 0.4 }, { type: 'line', points: bLater, role: 'terracotta', width: 1.6, alpha: 0.4 });
    if (stopSeen) rateLayers.push({ type: 'segments', segments: [[stopSeen, 0, stopSeen, yTop]], role: 'alert', width: 1.4, dash: true });
    if (aNow.length > 1) rateLayers.push({ type: 'line', points: aNow, role: 'forest', width: 2.2 }, { type: 'line', points: bNow, role: 'terracotta', width: 2.2 });
    if (aNow.length) rateLayers.push({ type: 'points', points: [aNow[aNow.length - 1]], role: 'forest', r: 4 }, { type: 'points', points: [bNow[bNow.length - 1]], role: 'terracotta', r: 4 });

    const scored = checks.map((c) => ({ ...c, z: c.test ? c.test.z : zTest(c.buyA, c.seen, c.buyB, c.seen).z }));
    const used = scored.filter((c) => c.test), unused = scored.filter((c) => !c.test);
    const zLayers = [
      { type: 'band', upper: [[0, Z_LINE], [n, Z_LINE]], lower: [[0, -Z_LINE], [n, -Z_LINE]], role: 'sage' },
      { type: 'line', points: [[0, 0], [n, 0]], role: 'muted', width: 1 },
      { type: 'segments', segments: [[0, Z_LINE, n, Z_LINE], [0, -Z_LINE, n, -Z_LINE]], role: 'alert', width: 1.2, dash: true },
      { type: 'text', at: [0, Z_LINE], text: '+1.96', role: 'alert', dx: 6, dy: -5 },
      { type: 'text', at: [0, -Z_LINE], text: '−1.96', role: 'alert', dx: 6, dy: 14 },
    ];
    if (scored.length > 1) zLayers.push({ type: 'line', points: scored.map((c) => [c.seen, clampZ(c.z)]), role: 'muted', width: 1.2 });
    if (stopSeen) zLayers.push({ type: 'segments', segments: [[stopSeen, -4, stopSeen, 4]], role: 'alert', width: 1.4, dash: true });
    if (unused.length) zLayers.push({ type: 'points', points: unused.map((c) => [c.seen, clampZ(c.z)]), role: 'muted', r: 3.4, hollow: true });
    if (used.length) zLayers.push({ type: 'points', points: used.map((c) => ({ x: c.seen, y: clampZ(c.z), role: c.test.significant ? 'alert' : 'ink', r: c.test.significant ? 5 : 3.6 })), role: 'ink' });

    const rows = [];
    if (showPairs) {
      const strip = (list) => list.map((bought) => ({ t: bought ? 'bought' : 'left', role: bought ? 'ink' : 'faint' }));
      rows.push({ label: 'Shown A', cells: strip(firstA) }, { label: 'Shown B', cells: strip(firstB) });
    }
    const tallyCells = (bought, role) => (seen ? [{ t: seen, sub: 'visitors' }, { t: bought, sub: 'bought' }, { t: pct(bought / seen), sub: 'rate so far', role }] : [{ t: 0, sub: 'visitors' }]);
    rows.push({ label: 'A (current)', cells: tallyCells(buyA, 'forest') }, { label: 'B (new)', cells: tallyCells(buyB, 'terracotta') });
    rows.push({ label: 'Test', cells: test
      ? [{ t: `${pts2(test.diff)} pts`, sub: 'B minus A' }, { t: `${pts2(test.se)} pts`, sub: 'typical gap from luck' }, { t: f2(test.z), sub: 'score z', role: test.significant ? 'alert' : 'ink' }, { t: pText(test.p), sub: 'p-value' }]
      : [{ t: 'not run yet', role: 'faint' }] });

    return [
      { kind: 'scene', title: 'Share of each group that has bought so far', x: [0, n * 1.03], y: [0, yTop], aspect: 0.42,
        axes: { xLabel: 'visitors per group', yLabel: 'share who bought' }, layers: rateLayers,
        legend: [{ label: 'A, the current version', role: 'forest' }, { label: 'B, the new version', role: 'terracotta' }, { label: 'true rates, never shown to the test', role: 'ink' }] },
      { kind: 'scene', title: peeking ? 'Test score z at each check' : 'Score z at each check (only the last one is used)', x: [0, n * 1.03], y: [-4, 4], aspect: 0.22,
        axes: { xLabel: 'visitors per group' }, layers: zLayers,
        legend: [{ label: 'where 95% of scores land when nothing differs', role: 'sage' }, { label: 'score the test used', role: 'ink' }, { label: 'score past the line', role: 'alert' }, { label: 'score drawn for you, not used by the test', role: 'muted' }] },
      { kind: 'rows', title: 'Tally', rows },
    ];
  };

  t.frame(() => ({ line: 0,
    note: `Two versions of a page are being compared. Visitors arrive two at a time, and a coin flip decides which of the two sees the current page **A** and which sees the new page **B**. Because chance alone decides who sees what, the groups can differ only by luck or because of the page. In this simulation A truly sells to ${pct(rateA)} of its visitors and B to ${pct(rateB)}${same ? ', so there is **no real difference** to find' : ''}. The test is never told these numbers. The plan is ${n} visitors per group${looks > 1 ? `, with ${looks} evenly spaced checks` : ''}. ${looks === 1 ? 'The test will run **once**, at the end.' : peeking ? 'Peeking is **on**: the test runs at every check and stops the first time it sees a win.' : 'The test will run **once**, at the end. The earlier checks only report progress.'}`,
    views: views(null, 0, false), vars: { 'planned per group': n, checks: looks, peeking: peeking ? 'on' : 'off' } }));

  let result = null, stopCheck = 0;
  for (let k = 1; k <= looks && !result; k++) {
    const target = Math.round((n * k) / looks);
    while (seen < target) {
      const [a, b] = pair(target, true);
      if (seen <= SHOWN) {
        if (picture) { firstA.push(a); firstB.push(b); }
        const at = seen, sa = buyA, sb = buyB;
        t.frame(() => ({ line: 2,
          note: `Pair ${at}: the visitor shown A ${a ? '**bought**' : 'left without buying'}, and the visitor shown B ${b ? '**bought**' : 'left without buying'}. Running totals: A ${sa} of ${at}, B ${sb} of ${at}. One visitor more or less swings the rates wildly at this size, which is why nobody should judge yet.`,
          views: views(null, 0, true), vars: { 'visitors per group': at, 'A bought': sa, 'B bought': sb } }));
      }
    }
    const last = k === looks;
    const entry = { k, seen, buyA, buyB, test: null };
    checks.push(entry);
    const gap = buyB / seen - buyA / seen;
    const lead = Math.abs(gap) < 1e-12 ? 'The two are level.' : `B is ${gap > 0 ? 'ahead' : 'behind'} by ${pts(Math.abs(gap))} percentage points.`;
    if (!peeking && !last) {
      t.frame(() => {
        const would = zTest(buyA, seen, buyB, seen);
        return { line: [1, 2, 3],
          note: `Check ${k} of ${looks}: each group has now had ${seen} visitors. A: ${buyA} bought (${pct(buyA / seen)}). B: ${buyB} bought (${pct(buyB / seen)}). ${lead} The plan says to test only at ${n} per group, so nothing is decided now. The lower chart marks where the score would stand, ${f2(would.z)}, for your eyes only.${would.significant ? ' At this moment it is **past the line**. Someone who peeked would stop here and announce a winner.' : ''}`,
          views: views(null, 0, false), vars: { check: k, 'visitors per group': seen } };
      });
      continue;
    }
    t.frame(() => ({ line: [1, 2, 3],
      note: `Check ${k} of ${looks}: each group has now had ${seen} visitors. A: ${buyA} bought (${pct(buyA / seen)}). B: ${buyB} bought (${pct(buyB / seen)}). ${lead} ${peeking && !last ? 'Peeking is on, so the test runs now.' : `This is the planned sample size, so the test runs${peeking ? ' one last time' : ''}.`}`,
      views: views(null, 0, false), vars: { check: k, 'visitors per group': seen } }));

    const test = zTest(buyA, seen, buyB, seen);
    tests++;
    t.count('tests');
    entry.test = test;
    const winner = test.z > 0 ? 'B' : 'A';
    const sums = test.se > 0
      ? `Suppose the two pages were equally good. The best estimate of the rate they would share pools everyone: (${buyA} + ${buyB}) / ${2 * seen} = ${pct(test.pooled)}. For that rate and ${seen} visitors per group, luck alone typically makes a gap of ${pts2(test.se)} points. That is the standard error. The gap seen is ${pts2(test.diff)} points, so the score is z = ${pts2(test.diff)} / ${pts2(test.se)} = **${f2(test.z)}**${(Number(pts2(test.diff)) / Number(pts2(test.se))).toFixed(2) === test.z.toFixed(2) ? '' : ', worked from the unrounded figures'}.`
      : `${buyA + buyB === 0 ? 'Nobody has bought yet' : 'Everybody has bought'}, so the two rates are identical and there is no spread to measure a gap against. The score is taken as z = 0: no evidence of a difference.`;
    const call = test.significant
      ? ` That is beyond ${Z_LINE} in size. Two identical pages give a score this extreme ${oneIn(test.p)} (p = ${pText(test.p)}), which is rarer than the 1 in 20 agreed as the line. The rule says: **declare ${winner} the winner**${last ? '' : ' and stop'}.`
      : ` That is inside the range from −${Z_LINE} to +${Z_LINE}, where 95% of scores land when nothing differs. Luck explains a gap this size comfortably (p = ${pText(test.p)}).${last ? '' : ' Keep collecting.'}`;
    t.frame(() => ({ line: test.significant ? [4, 5, 6, 7, 8, 9] : [4, 5, 6, 7, 8],
      note: `**Test** at ${seen} per group, a two-sided two-proportion z-test. ${sums}${test.se > 0 ? call : last ? '' : ' Keep collecting.'}`,
      views: views(test, 0, false), vars: { check: k, z: f2(test.z), p: pText(test.p) } }));
    if (test.significant || last) { result = test; stopCheck = k; }
  }

  const early = seen < n;
  const significant = result.significant;
  const winner = significant ? (result.z > 0 ? 'B' : 'A') : null;
  const truly = same ? null : rateB > rateA ? 'B' : 'A';
  const verdict = significant ? (same ? 'false win' : winner === truly ? 'correct win' : 'wrong winner') : same ? 'correct: no difference' : 'missed difference';
  const ci = interval(buyA, seen, buyB, seen);
  const need = same ? null : neededPerGroup(rateA, rateB);
  const used = { seen, buyA, buyB };

  let closing;
  if (verdict === 'false win') {
    closing = `The test declared **${winner} the winner** after ${seen} visitors per group${early ? `, well short of the planned ${n}` : ''}. But both pages were set to the same true rate, ${pct(rateA)}. There was nothing to find, so this is a **false win**. ${early ? `The test was run ${tests} time${tests === 1 ? '' : 's'} on the way here. Each run is one more chance for luck to carry the score over the line, and stopping at the first crossing keeps the lucky moment and throws away whatever would have followed.` : 'It was the planned test, at the planned size, that crossed the line. That happens in about 1 experiment in 20, and it is exactly what a 5% significance level allows.'}`;
  } else if (verdict === 'correct: no difference') {
    closing = `**No difference detected** after ${seen} visitors per group (z = ${f2(result.z)}, p = ${pText(result.p)}). Both pages were set to the same true rate, ${pct(rateA)}, so that is the right call. Notice the wording: the test has not shown the pages are equal. It has only failed to find a gap bigger than luck makes at this sample size.`;
  } else if (verdict === 'correct win') {
    const over = Math.abs(result.diff) > 1.5 * Math.abs(rateB - rateA);
    closing = `The test declared **${winner} the winner** after ${seen} visitors per group (z = ${f2(result.z)}, p = ${pText(result.p)}). That is the right call: ${winner} truly sells to ${pct(winner === 'B' ? rateB : rateA)} against ${pct(winner === 'B' ? rateA : rateB)}. The measured gap is ${pts(result.diff)} points and the true gap is ${pts(rateB - rateA)} points. A 95% interval for the true gap, from this data, runs from ${pts(ci[0])} to ${pts(ci[1])} points.${early && over ? ' Stopping early at the first win tends to catch the gap at a lucky high, which is why the measured gap is well above the true one.' : ''}`;
  } else if (verdict === 'wrong winner') {
    closing = `The test declared **${winner} the winner** after ${seen} visitors per group (z = ${f2(result.z)}, p = ${pText(result.p)}). That is wrong, and in the wrong direction: ${truly} is truly the better page, ${pct(Math.max(rateA, rateB))} against ${pct(Math.min(rateA, rateB))}. Luck ran against the better page for long enough to cross the line. This is rare${tests > 1 ? ', and running the test many times made it less rare' : ''}.`;
  } else {
    const trueGap = Math.abs(rateB - rateA);
    closing = `**No difference detected** after ${seen} visitors per group (z = ${f2(result.z)}, p = ${pText(result.p)}). But there is one: ${truly} truly sells to ${pct(Math.max(rateA, rateB))} against ${pct(Math.min(rateA, rateB))}. The test **missed it**. With ${seen} visitors per group, luck alone typically moves the gap by ${pts(result.se)} points. The true gap is ${pts(trueGap)} points${result.se > trueGap / 2 ? ', too small to stand out reliably against that' : ', which usually would stand out, so this miss was bad luck'}. To catch a gap of that size 4 times out of 5 takes about ${need} visitors per group.`;
  }
  const options = ['A correct call', 'A false win: it found a difference that is not there', 'A miss: it overlooked a difference that is there', 'A win for the wrong version'];
  const answer = verdict === 'false win' ? 1 : verdict === 'missed difference' ? 2 : verdict === 'wrong winner' ? 3 : 0;
  t.frame(() => ({ line: significant ? 9 : 10, note: closing, views: views(result, 0, false),
    vars: { verdict: significant ? `${winner} wins` : 'no difference detected', truth: same ? 'no difference' : `${truly} is better` } }));

  // After an early stop, carry the same visitor stream on to the planned size, for comparison only.
  let full = { z: result.z, p: result.p, significant, buyA, buyB };
  if (early && picture) {
    for (let k = stopCheck + 1; k <= looks; k++) {
      const target = Math.round((n * k) / looks);
      while (seen < target) pair(target, false);
      checks.push({ k, seen, buyA, buyB, test: null });
    }
    const end = zTest(buyA, n, buyB, n);
    full = { z: end.z, p: end.p, significant: end.significant, buyA, buyB };
    t.frame(() => ({ line: null,
      note: `For comparison only, here is what the abandoned plan would have shown. The same stream of visitors is carried on to ${n} per group (the faded lines) and tested once: A ${buyA} bought, B ${buyB} bought, z = ${f2(end.z)}, p = ${pText(end.p)}. ${end.significant ? 'The planned test would also have declared a difference.' : 'The planned test would have detected **no difference**.'}${same && !end.significant ? ' The early gap was luck caught at its peak, and more visitors washed it out.' : ''}`,
      views: views(end, used.seen, false), vars: { 'stopped at': used.seen, planned: n, 'z at the planned size': f2(end.z) } }));
  }

  return { rateA, rateB, planned: n, looks, peeking, stoppedAt: used.seen, stopCheck, early, buyA: used.buyA, buyB: used.buyB,
    pA: result.pA, pB: result.pB, diff: result.diff, pooled: result.pooled, se: result.se, z: result.z, p: result.p,
    significant, winner, verdict, tests, interval: ci, needed: need, full,
    checks: checks.map((c) => ({ k: c.k, seen: c.seen, buyA: c.buyA, buyB: c.buyB, tested: !!c.test })) };
}

// Share of many seeded experiments that declare a winner.
function winShare(input, repeats) {
  return manyExperiments(input, repeats, QUIET).share;
}

export default {
  meta: {
    id: 'ab-testing',
    name: 'A/B Testing',
    aliases: ['A/B test', 'split test', 'split testing', 'bucket test', 'controlled experiment', 'online controlled experiment', 'randomized controlled trial', 'two-proportion z-test', 'significance test', 'hypothesis test'],
    kind: 'algorithm',
    discipline: 'statistics',
    alsoIn: [
      { id: 'machine-learning', why: 'A new ranking or recommendation model is judged in the end by showing it to a random share of real users and comparing their behaviour with the old model\'s.' },
    ],
    subfield: 'Hypothesis testing',
    family: 'Randomized experiments',
    lab: 'probability-statistics',
    summary: 'Shows two versions to randomly split visitors, then asks whether the gap in results is bigger than luck alone would make. Stopping at the first win breaks the answer.',
    difficulty: 'beginner',
    order: 712,
    paradigms: ['probabilistic-inference', 'randomized-sampling'],
    randomized: true,
    approximate: true,
    time: { best: 'O(n)', average: 'O(n)', worst: 'O(n)', class: 'linear' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['did my change make a difference', 'which version is better', 'is this difference real or just luck', 'how many visitors do I need before deciding', 'compare two conversion rates', 'can I stop my experiment early'],
      techniques: ['random assignment', 'two-proportion z-test', 'p-value', 'significance level', 'statistical power', 'pooled standard error'],
      applications: ['statistics', 'machine learning', 'search engines', 'data processing'],
    },
    prerequisites: ['monte-carlo', 'concept:probability', 'concept:sampling', 'concept:gaussian-distribution'],
  },

  bigIdea: {
    simple: "An A/B test is a fair race between two versions of something. A shop wants to know whether a green Buy button sells more than its blue one. So each visitor is shown one of the two, chosen by a coin flip. After a while the shop counts. Say 10 in every 100 bought with blue, and 12 in every 100 bought with green. Is green better? Maybe. But two groups of people never behave exactly alike, even when they see the very same page. Some gap always appears by luck. So the test asks one question. If the buttons were really the same, how often would luck alone make a gap this big? If the answer is \"hardly ever\", the shop trusts the gap. If the answer is \"quite often\", it has learned nothing yet and needs more visitors. One rule is easy to break. Decide how many visitors to wait for before you start, and then wait. If you keep checking and stop the moment green is ahead, luck will fool you far more often.",
    when: 'Use it when you can show each version to a random share of the same stream of people at the same time, when the outcome is something you can count for each person, and when you can fix the sample size before you start. It does not suit a change that everybody must see at once, a very small audience, or an outcome that takes months to appear. If you would rather keep a running belief about each version than give a single yes or no, [Bayesian updating](#/algorithm/bayesian-updating) works on the same counts.',
    interesting: 'The same data can give two different answers depending on when you chose to stop. When two versions are identical, a test run once at a planned sample size declares a false winner 1 time in 20. Run at 20 checkpoints and stopped at the first success, it declares one about 1 time in 4. Nothing about the visitors changed. The promise of "5% false wins" was a promise about one look, and every extra look is another chance for luck to cross the line. This lesson measures that by running thousands of experiments in which the two versions are identical.',
    analogy: {
      title: 'A twitchy kitchen scale',
      text: 'You want to know whether two bags of flour weigh the same, but your scale is twitchy: weigh the same bag twice and it reads a little differently each time. One reading of each bag settles nothing. So you first learn how much the scale twitches, and then ask whether the two bags differ by clearly more than a twitch. An A/B test does this with people in place of flour. The twitch is the luck of who happened to visit. The test works out how big that twitch is for the number of visitors you had, and it calls a difference real only when the gap is about twice the twitch or more.',
      limits: 'You can weigh the same bag again, but you cannot show the same visitor both pages as if for the first time. The test has to compare two different groups and rely on chance to make them alike. A scale twitches by the same amount every day, while visitors change with the hour, the weekday and the season. And a scale tells you how much heavier a bag is, whereas the test on its own says only whether a difference probably exists, not whether it is large enough to matter.',
    },
  },

  example: {
    setup: 'A shop shows its current checkout page (A) to 200 visitors and a new one (B) to another 200, with chance deciding who sees which. 30 of the A visitors buy and 50 of the B visitors buy. Is B really better, or would two identical pages often differ by this much?',
    steps: [
      'Work out each rate. A: 30 out of 200 is 15%. B: 50 out of 200 is 25%. The gap is 10 percentage points.',
      'Suppose for a moment that the pages are equally good. Then the best guess at the rate they share uses everybody: 80 buyers out of 400 visitors, which is 20%.',
      'Work out how big a gap luck alone typically makes with that rate and 200 visitors in each group. It comes to 4 percentage points. The sum: 0.2 × 0.8 = 0.16, times 1/200 + 1/200 = 0.01, gives 0.0016, and the square root of 0.0016 is 0.04.',
      'Divide the gap you saw by the gap luck typically makes: 10 / 4 = 2.5. This is the score, called z.',
      'Compare the score with the line agreed before the test, 1.96. Two identical pages produce a score beyond that line only 1 time in 20. The score 2.5 is beyond it, so the shop concludes that B is better.',
    ],
    result: 'B wins. The gap is two and a half times what luck typically makes, and identical pages would produce a score that extreme only about 1 time in 80. Notice what the answer does not say. It does not say B is certainly better, and it does not say the true improvement is 10 points. With only 200 visitors per group, the true improvement could plausibly be anywhere from about 2 points to about 18.',
    tryInput: { rateA: 0.15, rateB: 0.25, visitors: 200, looks: 4, peek: false, seed: 63 },
  },

  terms: [
    { term: 'Conversion rate', meaning: 'The share of visitors who do the thing you hoped for, such as buying. 30 buyers out of 200 visitors is a rate of 15%.' },
    { term: 'Control and variant', meaning: 'The control, called A, is the current version. The variant, called B, is the changed version being tried.' },
    { term: 'Random assignment', meaning: 'Letting chance decide which version each visitor sees, so that the two groups differ only by luck and by the change itself.' },
    { term: 'Percentage point', meaning: 'The plain difference between two percentages. Going from 15% to 25% is a rise of 10 percentage points.' },
    { term: 'Standard error', meaning: 'The typical size of the gap that luck alone would make between two groups of this size.' },
    { term: 'z-score', meaning: 'The gap you saw divided by the standard error. It says how many typical luck-sized gaps wide your gap is.' },
    { term: 'p-value', meaning: 'How often two identical versions would produce a gap at least as large as the one you saw. A small p-value means luck is a poor explanation.' },
    { term: 'Significance level', meaning: 'The line, drawn before the test, for how small the p-value must be. The usual choice of 5% accepts one false win in every 20 tests of identical versions.' },
    { term: 'False win', meaning: 'Declaring a difference when the two versions are really the same. Statisticians call it a false positive.' },
    { term: 'Peeking', meaning: 'Running the test again and again as visitors arrive, and stopping as soon as it shows a win.' },
    { term: 'Power', meaning: 'The chance that the test notices a real difference of a given size. More visitors give more power.' },
  ],

  takeaway: 'A gap between two versions means something only when it is clearly bigger than luck would make it, and only if you chose when to stop before you looked.',

  viz: {
    describe: 'Three views. The first chart plots, against the number of visitors per group, the share of each group that has bought so far: A in forest green, B in terracotta, with dashed ink lines at the true rates that the test never sees. The second, smaller chart plots the test score z at each check. A sage band from −1.96 to +1.96 marks where 95% of scores land when nothing differs. Scores the test used are solid ink dots, a score past the line is a larger brick dot, and scores drawn for the reader but not used by the test are hollow. After an early stop a dashed brick line marks where it happened and the rest of the run is drawn faded. The third view is a tally: visitors, buyers and rate for each group, and the gap, standard error, z and p-value of the latest test.',
    inputs: [
      { id: 'rateA', type: 'range', label: 'True rate of A, the current version', min: 0.02, max: 0.5, step: 0.01, default: 0.1,
        help: 'Used only to simulate visitors. The test never sees it.' },
      { id: 'rateB', type: 'range', label: 'True rate of B, the new version', min: 0.02, max: 0.5, step: 0.01, default: 0.13,
        help: 'Set it equal to A to test two identical versions.' },
      { id: 'visitors', type: 'range', label: 'Planned visitors per group', min: 100, max: 5000, step: 100, default: 2000 },
      { id: 'looks', type: 'range', label: 'Checks along the way', min: 1, max: 40, step: 1, default: 20,
        help: 'Evenly spaced. Without peeking, only the last one is a test.' },
      { id: 'peek', type: 'toggle', label: 'Peek: test at every check and stop at the first win', default: false },
      { id: 'seed', type: 'seed', label: 'Random seed for the visitors', default: 15 },
    ],
    presets: [
      { label: 'A real improvement', values: { rateA: 0.1, rateB: 0.13, visitors: 2000, looks: 20, peek: false, seed: 15 } },
      { label: 'Worked example: 30 and 50 of 200', values: { rateA: 0.15, rateB: 0.25, visitors: 200, looks: 4, peek: false, seed: 63 } },
      { label: 'No difference, test once', values: { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: false, seed: 58 } },
      { label: 'No difference, peeking', values: { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: true, seed: 58 } },
      { label: 'Small improvement, too few visitors', values: { rateA: 0.1, rateB: 0.11, visitors: 1000, looks: 20, peek: false, seed: 15 } },
    ],
    tryThis: [
      'Load "No difference, test once" and step through it. Both versions truly sell to 10% of visitors. Watch the lower chart: at 300 visitors per group the hollow dot climbs above the +1.96 line, then drifts back, and the one real test at the end reports no difference. Now load "No difference, peeking". The visitors are identical, but this time the test stops at that crossing and declares B the winner.',
      'Keep "No difference, peeking" and press Randomize on the seed a dozen times. Most runs reach the end and correctly find nothing. Roughly one in four stops early with a false win. Switch peeking off and repeat: false wins become rare, about 1 in 20.',
      'Load "A real improvement" and switch peeking on. The test stops at 1100 visitors per group and correctly names B. That is what makes peeking tempting: when there is a real effect it often reaches the right answer sooner. The price is paid in the experiments where nothing differs.',
      'Load "Small improvement, too few visitors". B really is one point better, yet the test finds nothing, because luck moves the gap by about 1.4 points at this size. Raise the planned visitors to 5000 and try several seeds. The test starts to catch the improvement, but still only in about a third of runs.',
    ],
    run,
    report: (r, c) => {
      if (r.repeats) return `${r.repeats} experiments run. ${r.wins} declared a winner (${pct(r.share)}).`;
      const said = r.significant ? `${r.winner} is better` : 'no difference detected';
      const truth = r.verdict === 'false win' ? 'a false win: the two versions are identical'
        : r.verdict === 'correct: no difference' ? 'correct: the two versions are identical'
        : r.verdict === 'correct win' ? 'correct'
        : r.verdict === 'wrong winner' ? 'wrong: the other version is truly better'
        : 'a miss: there is a real difference';
      return `A: ${r.buyA} of ${r.stoppedAt} bought (${pct(r.pA)}). B: ${r.buyB} of ${r.stoppedAt} bought (${pct(r.pB)}).\nTwo-sided two-proportion z-test, pooled standard error: z = ${f2(r.z)}, p = ${pText(r.p)}. At the 5% level: ${said}.\nTrue rates, hidden from the test: A ${pct(r.rateA)}, B ${pct(r.rateB)}. The verdict is ${truth}.\n95% interval for the true gap: ${pts(r.interval[0])} to ${pts(r.interval[1])} percentage points.\nTests run: ${c.tests || 0}. Visitors used: ${c.visitors || 0}${r.early ? ` of the ${2 * r.planned} planned` : ''}.`;
    },
    experiment: {
      title: 'False wins as the number of checks grows',
      note: 'Each point is 2000 complete experiments, run in your browser, in which A and B have the same true rate of 10% and each group gets 1000 visitors. Nothing differs, so every declared winner is a false win. Testing once at the end gives about 100 false wins in 2000, the promised 5%, however many times you look without acting. Testing at every check and stopping at the first win gives more false wins with every added check. The dotted curve shows what the count would be if each check were a fresh experiment. The real curve sits below it, because successive checks share most of their visitors, but it keeps climbing.',
      metric: 'winners declared',
      metricLabel: 'Experiments out of 2000 that declared a winner',
      sizeLabel: 'Number of checks during the experiment',
      sizes: [1, 2, 5, 10, 20, 40],
      variants: [{ id: 'peek', label: 'Test at every check, stop at the first win' }, { id: 'fixed', label: 'Test once at the end' }],
      input: (k, variant, seed) => ({ rateA: 0.1, rateB: 0.1, visitors: 1000, looks: k, peek: variant === 'peek', seed, repeats: 2000 }),
      theory: [
        { label: '5% of 2000', fn: () => 100, variant: 'fixed', expected: true },
        { label: 'if every check were a fresh experiment: 2000 × (1 − 0.95^k)', fn: (k) => 2000 * (1 - 0.95 ** k), variant: 'peek', reference: true },
      ],
    },
  },

  logic: {
    intuition: 'Two groups of people never produce exactly the same rate, so the raw gap proves nothing. What the test supplies is a yardstick: the size of gap that luck alone makes between two groups of this size. Under the assumption that the versions are equal, the gap between the two observed rates behaves like a draw from a bell curve centred on zero, and the standard error is the width of that curve. Dividing the gap by the standard error gives z, the gap measured in yardsticks. A bell curve puts 95% of its draws within 1.96 widths of the centre, so a z beyond 1.96 is something equal versions produce only 5% of the time. Peeking breaks this because z is not fixed: it wanders as visitors arrive. One look at a wandering score has a 5% chance of finding it past the line. Many looks, with a stop at the first crossing, have a much larger chance, because the score only has to stray once.',
    steps: [
      'Before starting, fix the significance level (5% here), the one outcome you will count, and the number of visitors per group.',
      'Assign each visitor to A or B by chance, and record whether they convert.',
      'When the planned number is reached, compute the two observed rates: $\\hat p_A = x_A / n_A$ and $\\hat p_B = x_B / n_B$.',
      'Pool the groups to estimate the rate both would share if there were no difference: $\\hat p = (x_A + x_B) / (n_A + n_B)$.',
      'Compute the standard error of the gap under that assumption: $SE = \\sqrt{\\hat p\\,(1 - \\hat p)\\,(1/n_A + 1/n_B)}$.',
      'Compute the score $z = (\\hat p_B - \\hat p_A) / SE$ and, from the bell curve, the two-sided p-value.',
      'If $|z| \\ge 1.96$, which is the same as $p \\le 0.05$, declare a difference. Otherwise report that none was detected. Either way, report the size of the gap with an interval.',
      'The peeking switch on this page repeats steps 3 to 7 at every check and stops at the first crossing. That is the mistake being demonstrated, not a recommended variant.',
    ],
    pseudocode: [
      'ab_test(visitors, n, checks, peeking):',
      '  for k = 1 .. checks:',
      '    collect visitors until each group has k × n / checks',
      '    if peeking or k = checks:',
      '      rate_A ← buyers_A / n_A,  rate_B ← buyers_B / n_B',
      '      pooled ← (buyers_A + buyers_B) / (n_A + n_B)',
      '      SE ← √( pooled × (1 − pooled) × (1/n_A + 1/n_B) )',
      '      z ← (rate_B − rate_A) / SE',
      '      if |z| ≥ 1.96:',
      '        return "difference detected"',
      '  return "no difference detected"',
    ],
    decisions: [
      { title: 'Which test, exactly?', text: 'This page uses the two-sided two-proportion z-test with a pooled standard error. Two-sided means a difference in either direction counts, so the 5% is split between B looking better and B looking worse. Pooled means the standard error is computed from the combined rate, which is the right thing to do when the assumption being tested is that the rates are equal. It gives exactly the same verdict as the chi-squared test on the two-by-two table of counts without a continuity correction, because the square of z is the chi-squared statistic.' },
      { title: 'How many visitors?', text: 'Decide from the smallest difference worth detecting. To notice a true gap $\\delta$ between rates near $p$ in 4 experiments out of 5, at the 5% level, takes about $16\\,p(1-p)/\\delta^2$ visitors per group. Halving the gap you want to detect quadruples the visitors. Telling 10% from 12% takes about 3,800 per group.' },
      { title: 'Which significance level?', text: '5% is a convention, not a law. A lower level means fewer false wins and more missed improvements for the same number of visitors. A team that runs hundreds of tests a year, on changes that mostly do nothing, gets a steady supply of false wins at 5% and may reasonably set a stricter level.' },
      { title: 'When to stop?', text: 'At the sample size chosen in advance, and not before. If stopping early matters, use a test built for it: a sequential test raises the bar at every look so that the overall rate of false wins stays at 5%.' },
      { title: 'What to measure?', text: 'One primary outcome, named before the test starts. Twenty outcomes examined after the fact will usually include one that crossed the line by luck.' },
    ],
    invariants: [
      'At every check, each group\'s tally is the number of its visitors so far who bought, and both groups have had the same number of visitors.',
      'Without peeking, exactly one test is carried out, at the planned sample size, whatever the earlier checks showed.',
      'With peeking, a run that reaches the last check has had every earlier score inside ±1.96.',
    ],
    edgeCases: [
      'Nobody buys, or everybody buys: the pooled rate is 0 or 1, the standard error is 0 and z would be 0 divided by 0. There is no evidence of a difference, and the code reports z = 0.',
      'Small counts: the bell curve is a poor stand-in for the true spread when a group has only a handful of buyers or of non-buyers. A common rule of thumb asks for at least 5 to 10 of each in both groups. Below that, use Fisher\'s exact test.',
      'Unequal group sizes: the formula allows for them. But if a 50/50 split delivers groups whose sizes differ by more than chance allows, the assignment itself is broken and the result should not be trusted.',
      'The same person counted several times: the formula assumes each observation is independent. Count people, not page views, or the standard error comes out too small.',
      'A rate that changes during the test, such as weekday against weekend shoppers: run for whole weeks so both versions see the same mix.',
    ],
    correctness: 'Assume the visitors are independent and the two versions share a true rate $p$. Each group\'s count of buyers is then binomial, and by the central limit theorem the difference between the two observed rates is approximately normal with mean 0 and variance $p(1-p)(1/n_A + 1/n_B)$. The pooled rate converges to $p$, so $z$ is approximately a standard normal variable, and $P(|z| \\ge 1.96) \\approx 0.05$. That is the whole guarantee: when nothing differs, a single test at a sample size fixed in advance declares a difference about 5% of the time. It is a statement about the procedure over many uses. It does not make any single verdict certain, and it says nothing about a procedure that tests repeatedly and chooses when to stop.',
    mistakes: [
      'Testing repeatedly and stopping at the first significant result.',
      'Stopping when the result is the one you hoped for, and carrying on when it is not.',
      'Looking at many outcomes or many customer segments and reporting the one that crossed the line.',
      'Reading a p-value of 0.03 as a 97% chance that B is better.',
      'Reading "not significant" as "no difference".',
      'Comparing this week with last week and calling it a test. Without random assignment the two groups differ in more than the change.',
      'Dividing by the standard error of one group and forgetting that both rates are uncertain.',
    ],
  },

  code: {
    sample: {
      input: 'First the worked example: 30 buyers of 200 against 50 of 200. Then 1000 simulated experiments in which both versions truly convert 10%, judged once at the end and again by peeking at 10 checks. A small generator gives the same visitors in every language (seed 2024).',
      expected: 'A 30/200, B 50/200: z = 2.500, p = 0.0124\n1000 experiments, both versions truly 10%, 1000 visitors per group\ntested once at the end: 42 false wins\npeeked at 10 checks: 182 false wins',
    },
    python: {
      source: `import math


class Lcg:
    """A small random number generator (Park-Miller). Integer arithmetic only,
    so it produces the same numbers in every language."""

    def __init__(self, seed):
        self.state = seed

    def uniform(self):
        self.state = self.state * 48271 % 2147483647
        return self.state / 2147483647


def two_sided_p(z):
    """How often luck alone gives a score at least this far from 0: one minus
    the area under the bell curve between -|z| and +|z|, by Simpson's rule."""
    steps, h = 200, abs(z) / 200
    area = 0.0
    for i in range(steps + 1):
        weight = 1 if i in (0, steps) else 4 if i % 2 else 2
        area += weight * math.exp(-0.5 * (i * h) * (i * h))
    return 1 - 2 * area * h / 3 / math.sqrt(2 * math.pi)


def z_test(buy_a, n_a, buy_b, n_b):
    """Two-sided two-proportion z-test with a pooled standard error."""
    pooled = (buy_a + buy_b) / (n_a + n_b)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    if se == 0:
        return 0.0, 1.0
    z = (buy_b / n_b - buy_a / n_a) / se
    return z, two_sided_p(z)


def ab_test(a, b, checks, peeking):
    """a and b hold a 1 for each visitor who bought and a 0 for each who did not,
    in order of arrival. Returns True if the test declares a difference."""
    n = len(a)
    for k in range(1, checks + 1):
        seen = n * k // checks
        if peeking or k == checks:
            z, p = z_test(sum(a[:seen]), seen, sum(b[:seen]), seen)
            if abs(z) >= 1.96:
                return True
    return False


z, p = z_test(30, 200, 50, 200)
print(f"A 30/200, B 50/200: z = {z:.3f}, p = {p:.4f}")

rng = Lcg(2024)
once = peeked = 0
for _ in range(1000):
    a = [1 if rng.uniform() < 0.10 else 0 for _ in range(1000)]
    b = [1 if rng.uniform() < 0.10 else 0 for _ in range(1000)]
    once += ab_test(a, b, 10, False)
    peeked += ab_test(a, b, 10, True)
print("1000 experiments, both versions truly 10%, 1000 visitors per group")
print(f"tested once at the end: {once} false wins")
print(f"peeked at 10 checks: {peeked} false wins")`,
      notes: [
        { line: 29, text: 'The pooled rate: the best estimate of the rate both versions share, if they are equal. All buyers over all visitors.' },
        { line: 30, text: 'The standard error: the typical gap luck makes between two groups of these sizes. It shrinks as the groups grow.' },
        { line: 33, text: 'The score: the gap seen, measured in standard errors.' },
        { line: 43, text: 'The one line that separates a sound test from a broken one. Without peeking, the test runs only when k reaches the last check.' },
        { line: 46, text: 'Returning at the first crossing is what peeking means. The score may have come back inside the line a few hundred visitors later.' },
        { line: 59, text: 'The same lists are judged by both rules, so any difference in the two counts comes from the stopping rule and not from the visitors.' },
      ],
    },
    javascript: {
      source: `// A small random number generator (Park-Miller). Integer arithmetic only,
// so it produces the same numbers in every language.
class Lcg {
  constructor(seed) { this.state = seed; }
  uniform() {
    this.state = (this.state * 48271) % 2147483647;
    return this.state / 2147483647;
  }
}

// How often luck alone gives a score at least this far from 0: one minus
// the area under the bell curve between -|z| and +|z|, by Simpson's rule.
function twoSidedP(z) {
  const steps = 200, h = Math.abs(z) / 200;
  let area = 0;
  for (let i = 0; i <= steps; i++) {
    const weight = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2;
    area += weight * Math.exp(-0.5 * (i * h) * (i * h));
  }
  return 1 - 2 * area * h / 3 / Math.sqrt(2 * Math.PI);
}

// Two-sided two-proportion z-test with a pooled standard error.
function zTest(buyA, nA, buyB, nB) {
  const pooled = (buyA + buyB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) return [0, 1];
  const z = (buyB / nB - buyA / nA) / se;
  return [z, twoSidedP(z)];
}

const buyers = (list, seen) => list.slice(0, seen).reduce((sum, x) => sum + x, 0);

// a and b hold a 1 for each visitor who bought and a 0 for each who did not,
// in order of arrival. Returns true if the test declares a difference.
function abTest(a, b, checks, peeking) {
  const n = a.length;
  for (let k = 1; k <= checks; k++) {
    const seen = Math.floor(n * k / checks);
    if (peeking || k === checks) {
      const [z] = zTest(buyers(a, seen), seen, buyers(b, seen), seen);
      if (Math.abs(z) >= 1.96) return true;
    }
  }
  return false;
}

const [z, p] = zTest(30, 200, 50, 200);
console.log("A 30/200, B 50/200: z = " + z.toFixed(3) + ", p = " + p.toFixed(4));

const rng = new Lcg(2024);
let once = 0, peeked = 0;
for (let i = 0; i < 1000; i++) {
  const a = Array.from({ length: 1000 }, () => (rng.uniform() < 0.10 ? 1 : 0));
  const b = Array.from({ length: 1000 }, () => (rng.uniform() < 0.10 ? 1 : 0));
  if (abTest(a, b, 10, false)) once += 1;
  if (abTest(a, b, 10, true)) peeked += 1;
}
console.log("1000 experiments, both versions truly 10%, 1000 visitors per group");
console.log("tested once at the end: " + once + " false wins");
console.log("peeked at 10 checks: " + peeked + " false wins");`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <numeric>
#include <vector>

// A small random number generator (Park-Miller). Integer arithmetic only,
// so it produces the same numbers in every language.
struct Lcg {
    long long state;
    double uniform() {
        state = state * 48271 % 2147483647;
        return static_cast<double>(state) / 2147483647.0;
    }
};

// How often luck alone gives a score at least this far from 0: one minus
// the area under the bell curve between -|z| and +|z|, by Simpson's rule.
double two_sided_p(double z) {
    const int steps = 200;
    const double h = std::fabs(z) / 200;
    double area = 0.0;
    for (int i = 0; i <= steps; ++i) {
        int weight = (i == 0 || i == steps) ? 1 : (i % 2 ? 4 : 2);
        area += weight * std::exp(-0.5 * (i * h) * (i * h));
    }
    return 1 - 2 * area * h / 3 / std::sqrt(2 * 3.141592653589793);
}

// Two-sided two-proportion z-test with a pooled standard error.
double z_score(int buy_a, int n_a, int buy_b, int n_b) {
    double pooled = static_cast<double>(buy_a + buy_b) / (n_a + n_b);
    double se = std::sqrt(pooled * (1 - pooled) * (1.0 / n_a + 1.0 / n_b));
    if (se == 0) return 0.0;
    return (static_cast<double>(buy_b) / n_b - static_cast<double>(buy_a) / n_a) / se;
}

// a and b hold a 1 for each visitor who bought and a 0 for each who did not,
// in order of arrival. Returns true if the test declares a difference.
bool ab_test(const std::vector<int>& a, const std::vector<int>& b, int checks, bool peeking) {
    int n = static_cast<int>(a.size());
    for (int k = 1; k <= checks; ++k) {
        int seen = n * k / checks;
        if (peeking || k == checks) {
            int buy_a = std::accumulate(a.begin(), a.begin() + seen, 0);
            int buy_b = std::accumulate(b.begin(), b.begin() + seen, 0);
            if (std::fabs(z_score(buy_a, seen, buy_b, seen)) >= 1.96) return true;
        }
    }
    return false;
}

int main() {
    double z = z_score(30, 200, 50, 200);
    std::printf("A 30/200, B 50/200: z = %.3f, p = %.4f\\n", z, two_sided_p(z));

    Lcg rng{2024};
    int once = 0, peeked = 0;
    for (int i = 0; i < 1000; ++i) {
        std::vector<int> a(1000), b(1000);
        for (int& x : a) x = rng.uniform() < 0.10 ? 1 : 0;
        for (int& x : b) x = rng.uniform() < 0.10 ? 1 : 0;
        if (ab_test(a, b, 10, false)) once += 1;
        if (ab_test(a, b, 10, true)) peeked += 1;
    }
    std::printf("1000 experiments, both versions truly 10%%, 1000 visitors per group\\n");
    std::printf("tested once at the end: %d false wins\\n", once);
    std::printf("peeked at 10 checks: %d false wins\\n", peeked);
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The arithmetic is trivial: one pass to count buyers, then a handful of operations on four numbers. The real cost of an A/B test is visitors and time. The number of visitors needed grows with the inverse square of the difference you want to detect, so small improvements are expensive to confirm.',
    cases: [
      { case: 'Counting n visitors', time: 'O(n)', when: 'Always. Each visitor adds 1 to a group\'s visitor count and perhaps 1 to its buyer count.' },
      { case: 'One test from the four counts', time: 'O(1)', when: 'Always. The test needs only the two visitor counts and the two buyer counts.' },
      { case: 'Visitors needed to detect a gap δ', time: 'About 16 p(1 − p) / δ² per group', when: 'For a 5% significance level and an 80% chance of detecting the gap, with both rates near p. Half the gap needs four times the visitors.' },
    ],
    space: 'O(1): two visitor counts and two buyer counts. The page keeps the running rates only in order to draw them.',
    memory: 'No individual visitor needs to be stored. Counts from different servers or different days can simply be added, which is why the method scales to very large sites.',
    tradeoffs: 'For a fixed number of visitors, a stricter significance level means fewer false wins and more missed improvements. For a fixed significance level, more visitors mean smaller differences become detectable. Looking early saves time only if the test was designed for looking early.',
    assumptions: [
      'Visitors are independent of one another and each is counted once.',
      'Each version\'s true rate stays the same for the length of the test.',
      'The sample size is fixed in advance and the test is run once.',
      'Counts are large enough for the normal approximation to the binomial distribution to be good.',
      'The sample-size formula is the usual approximation with an unpooled variance. Other textbook versions differ from it by a few visitors.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Small audiences, where no affordable sample can detect a realistic improvement.',
      'Very small improvements, which need hundreds of thousands of visitors to confirm.',
      'Outcomes that arrive slowly, such as whether a customer is still subscribed a year later.',
      'Settings where visitors affect one another, such as marketplaces and social feeds, so that the groups are not independent.',
      'Many versions at once, where the chance that some version wins by luck grows with the number tried.',
    ],
    pitfalls: [
      'Stopping at the first significant result. It is the most common way to manufacture a winner.',
      'Reporting the measured gap of a barely significant test as the size of the improvement. Results that just cross the line tend to overstate the true gap.',
      'A broken split: if a 50/50 assignment delivers visibly unequal groups, something in the pipeline is filtering visitors and the comparison is no longer fair.',
      'Ending the test on a Wednesday after starting on a Monday, so weekend visitors are missing from both groups.',
    ],
    misunderstandings: [
      "\"A p-value of 0.03 means there is a 97% chance that B is better.\" The p-value is worked out by assuming there is no difference. It says how often identical versions would produce a gap this large, not how likely it is that the versions differ. The chance that B is better depends also on how plausible an improvement was before the test.",
      "\"Not significant means the two versions perform the same.\" It means this experiment could not tell them apart. A small experiment misses real differences most of the time.",
      "\"Checking the results every day cannot hurt, because the data are what they are.\" Looking is harmless. Deciding when to stop because of what you saw is not. With 20 looks and a stop at the first win, identical versions produce a winner about a quarter of the time.",
      "\"Significant means important.\" With enough visitors, a difference too small to matter will be significant. Read the size of the gap and its interval, not only the verdict.",
      "\"If the test is run correctly, the answer is right.\" Run correctly at the 5% level, it still declares a winner in 1 of every 20 tests of identical versions. That rate is the price agreed in advance.",
    ],
    constraints: [
      'The method needs control over who sees what. If you cannot randomize, you are not running an A/B test.',
      'The 5% line and the 80% power target are conventions. They should be chosen to fit what a false win and a missed improvement each cost.',
    ],
    alternatives: [
      { id: 'bayesian-updating', name: 'Bayesian comparison', when: 'You want a statement such as "B is better with probability 0.9" or you have real prior knowledge about plausible rates. Each version gets a belief that is updated with every visitor.' },
      { name: 'Sequential tests', when: 'You need to look early and be allowed to stop. Group-sequential designs and always-valid p-values raise the bar at each look so that false wins stay at 5% overall.' },
      { name: 'Fisher\'s exact test', when: 'Counts are small, so the bell-curve approximation cannot be trusted.' },
      { name: 'Multi-armed bandits', when: 'What matters is losing few sales while you learn, more than a clean yes or no at the end. Traffic shifts toward the version that is doing better.' },
      { name: 'Welch\'s t-test', when: 'The outcome is an amount for each visitor, such as money spent, and not a yes or a no.' },
    ],
    comparison: {
      columns: ['', 'Test once at a planned size', 'Peek and stop at the first win', 'Sequential test'],
      rows: [
        ['False wins when nothing differs', '5%', 'About 25% with 20 checks', '5% overall, by design'],
        ['May stop early', 'No', 'Yes', 'Yes'],
        ['Bar to clear at each look', '1.96, once', '1.96, every time', 'Higher than 1.96 at early looks'],
        ['Verdict can be trusted', 'Yes, at the stated rate', 'No', 'Yes, at the stated rate'],
      ],
    },
  },

  applications: [
    { title: 'Changes to websites and apps', status: 'established', text: 'Large web companies try changes to pages, search results and recommendations on a random share of visitors before releasing them to everyone. Ron Kohavi and colleagues, who ran such programmes, describe the practice and its pitfalls in the survey and the book listed in the references.' },
    { title: 'Clinical trials', status: 'established', text: 'A randomized controlled trial compares a treatment group with a control group by the same reasoning. Trials that plan to examine results before the end use group-sequential rules, which were developed in medicine precisely because repeated looks inflate false findings.' },
    { title: 'Email and advertising', status: 'illustrative', text: 'Two subject lines are sent to random halves of a mailing list and the open rates compared. The same sample-size arithmetic says whether the list is large enough for the comparison to mean anything.' },
    { title: 'Prices and store layouts', status: 'illustrative', text: 'A chain can try a new layout in a random half of its stores. The unit being randomized is then the store, not the shopper, so the sample is a few dozen and only large effects can be detected.' },
  ],

  connections: [
    { to: 'monte-carlo', type: 'prerequisite', why: 'Each group\'s rate in an A/B test is an average of random yes-or-no outcomes, so its error shrinks like 1/√n, the rule Monte Carlo estimation demonstrates. The standard error of the test is that rule applied to two groups.' },
    { to: 'bayesian-updating', type: 'same-problem', why: 'Both judge two versions from counts of successes. A/B testing asks how surprising the gap would be if nothing differed, while Bayesian updating keeps a belief about each rate and asks how probable it is that one is higher.' },
    { to: 'exponential-smoothing', type: 'related', why: 'When visitors cannot be split at random, the fallback is to compare results after a change with an exponential smoothing forecast of what would have happened without it. An A/B test is stronger because its two groups live through the same days.' },
    { to: 'linear-regression', type: 'related', why: 'An A/B comparison is a regression of the outcome on a 0-or-1 label for the group: the fitted slope is exactly the gap between the two group averages. Linear regression extends the comparison to several factors at once.' },
    { to: 'concept:probability', type: 'prerequisite', why: 'The p-value of an A/B test is a probability worked out under an assumption, and reading it correctly depends on being clear about which assumption.' },
    { to: 'concept:gaussian-distribution', type: 'prerequisite', why: 'An A/B test compares its score with the bell curve of the Gaussian distribution, because the gap between two large-sample averages is approximately normally distributed.' },
    { to: 'concept:sampling', type: 'prerequisite', why: 'The visitors in an A/B test are a sample of all future visitors, and the whole question is one about sampling: how far a sample can stray from what it was drawn from.' },
    { to: 'concept:law-of-large-numbers', type: 'related', why: 'By the law of large numbers each observed rate settles toward its true rate as visitors accumulate, which is why a large enough A/B test can separate two rates that are close together.' },
    { to: 'concept:exploration-exploitation', type: 'related', why: 'An A/B test explores for a fixed period and only then exploits the winner. Bandit methods blend the two, sending more traffic to the leading version while still learning.' },
    { to: 'discipline:machine-learning', type: 'application', why: 'In machine learning, accuracy on stored data does not settle whether a new model is better for users. The final check is an A/B test against the old model on live traffic.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'An A/B test ends with p = 0.03. Which statement is correct?',
      options: ['There is a 97% chance that B is better than A', 'There is a 3% chance that the result is wrong', 'If A and B were identical, a gap at least this large would appear in about 3% of experiments', 'B is 3% better than A'],
      answer: 2,
      explain: [
        'The p-value is computed by assuming no difference, so it cannot be the probability of a difference. That would need a starting belief about how likely an improvement was.',
        'The p-value describes how often identical versions produce such a gap. It is not the chance that this particular verdict is mistaken.',
        'A p-value is the answer to a what-if question: assume nothing differs, and ask how often luck alone would do this.',
        'The p-value measures surprise, not the size of the improvement. The size is the gap between the two rates.',
      ],
    },
    {
      type: 'predict',
      q: 'Versions A and B are identical: both truly convert 10%. Tested once after 1000 visitors per group, the result is "no difference detected". Now the same visitors arrive in the same order, but the test runs at each of 20 evenly spaced checks and stops at the first significant result. What does this run report?',
      options: ['No difference detected, because the visitors are the same', 'A winner, declared early', 'A winner, declared at the last check', 'An error, because identical versions cannot be tested'],
      answer: 1,
      explain: [
        'The visitors are the same, but the rule for stopping is not. The score crosses the line partway through and comes back by the end. The planned test never saw the crossing, and the peeking test stopped at it.',
        'The score wanders as visitors arrive. In this run it strays past 1.96 partway through, the peeking rule stops there, and a false win is announced. Not every run does this: about one in four does when there are 20 checks.',
        'The test at the last check is the planned test, and it found nothing. A peeking run that reaches the last check gives the same answer as the planned one.',
        'Identical versions can be tested, and it is good practice to do so. The right answer is "no difference detected" 19 times out of 20.',
      ],
      tryInput: { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: true, seed: 58 },
    },
    {
      type: 'debug',
      q: 'A team uses this loop for every experiment. About a quarter of their "winning" changes turn out to do nothing after launch. What is wrong?',
      code: `while visitors_per_group < planned:
    collect_more_visitors()
    z = z_score(buyers_a, buyers_b, visitors_per_group)
    if abs(z) >= 1.96:
        announce_winner()
        break`,
      options: ['The line should be 1.645, not 1.96', 'The test is inside the loop, so the experiment stops the first time luck carries the score across the line', 'The loop should use <= so that it collects one more batch', 'abs(z) should be z, so that only B can win'],
      answer: 1,
      explain: [
        'A line of 1.645 is easier to cross, so it would produce even more false wins.',
        'The 5% promise covers one test at the planned size. This loop tests after every batch. Move the test below the loop, or switch to a sequential test built for repeated looks.',
        'One more batch changes the sample size slightly and leaves the repeated testing in place.',
        'A one-sided test changes which direction counts. Peeking inflates false wins for one-sided tests too.',
      ],
    },
    {
      type: 'choice',
      q: 'A is at 10%. You hope B reaches 11%. You run 1000 visitors per group and the test says "no difference detected". What should you conclude?',
      options: ['B is no better than A', 'B is worse than A', 'Very little: this experiment was too small to notice a one-point improvement reliably', 'The test was run incorrectly'],
      answer: 2,
      explain: [
        'Failing to detect a difference is not the same as showing there is none. Here the test would miss a true one-point gain most of the time.',
        'Nothing in "no difference detected" points in either direction.',
        'With 1000 per group, luck alone moves the gap by about 1.4 points, more than the improvement you hoped to see. Detecting one point reliably takes roughly 15,000 visitors per group.',
        'The test did what it was designed to do. The design was too small for the question.',
      ],
    },
    {
      type: 'challenge',
      title: 'Peek safely',
      prompt: 'Simulate 2000 experiments in which A and B both truly convert 10%, with 1000 visitors per group and a check after every 100. First confirm that stopping at the first check with |z| ≥ 1.96 gives far more than 5% false wins. Then repair it the simplest way: keep the 10 checks, but demand a higher bar at every one of them. Find, by trial, the single bar that brings the overall rate of false wins back to about 5%. How much higher than 1.96 is it, and what does that cost when B really is better?',
      hints: ['Dividing 5% equally among 10 checks gives a bar of about 2.81. Try it: it is stricter than necessary, because the checks share most of their visitors.', 'A bar near 2.55 is close. This constant-bar design is the one Pocock proposed.'],
    },
  ],

  compare: {
    idea: 'Split people at random between two versions, then ask whether the gap in results is bigger than luck alone would make.',
    requires: 'A way to show each version to a random share of people at the same time. One yes-or-no outcome you can count for each person. Enough people. A sample size chosen before you start.',
    sensitivity: 'Very sensitive to the stopping rule: testing repeatedly and stopping at the first win raises false wins from 5% to about 25% with 20 checks. Sensitive to small samples, which miss real differences.',
    memory: 'O(1): four counts.',
    difficulty: 'low',
    difficultyNote: 'The arithmetic is a few lines. Not acting on early results is the hard part.',
    limits: 'It says whether a difference probably exists, not whether it is big enough to matter. It misses small differences unless you have a great many people. Used correctly it still calls a winner 1 time in 20 when nothing differs, and far more often if you stop the moment you see a win.',
    useWhen: 'You can try a change on some people and not on others, chosen at random, and you want to know whether it made a difference before giving it to everyone.',
  },

  advanced: {
    history: 'Comparing randomly assigned groups was put on a firm footing by Ronald Fisher, who developed randomized experiments for agricultural field trials at Rothamsted in the 1920s and set out the reasoning in *The Design of Experiments* in 1935. Jerzy Neyman and Egon Pearson supplied the language of error rates in 1933: decide in advance how often a false alarm will be tolerated, then choose the test that misses real effects least often. The test on this page is equivalent to Karl Pearson\'s chi-squared test of 1900 applied to a two-by-two table, since the square of z is the chi-squared statistic. The danger of repeated looks was measured by Peter Armitage, C. K. McPherson and B. C. Rowe in 1969, who tabulated how the rate of false alarms grows with the number of looks. Medicine answered with group-sequential designs in the 1970s, among them those of Stuart Pocock and of Peter O\'Brien and Thomas Fleming. The name "A/B test" comes from marketing and web practice. Ron Kohavi and colleagues described how large websites run such experiments in a survey of 2009, and Ramesh Johari and colleagues restated the peeking problem for that audience in 2017.',
    derivation: 'Let $x_A$ of $n_A$ visitors convert under A and $x_B$ of $n_B$ under B, with $\\hat p_A = x_A/n_A$ and $\\hat p_B = x_B/n_B$. Under the null hypothesis $H_0: p_A = p_B = p$, each count is binomial, so\n\n$$\\operatorname{Var}(\\hat p_B - \\hat p_A) = p(1-p)\\left(\\frac{1}{n_A} + \\frac{1}{n_B}\\right).$$\n\nReplacing $p$ by the pooled estimate $\\hat p = (x_A + x_B)/(n_A + n_B)$ gives the statistic\n\n$$z = \\frac{\\hat p_B - \\hat p_A}{\\sqrt{\\hat p(1-\\hat p)\\left(\\frac{1}{n_A} + \\frac{1}{n_B}\\right)}},$$\n\nwhich is approximately standard normal under $H_0$. The two-sided p-value is $2\\,(1 - \\Phi(|z|))$, where $\\Phi$ is the standard normal distribution function, and $|z| \\ge 1.96$ corresponds to $p \\le 0.05$.\n\nFor the size of the effect, a 95% interval uses the unpooled standard error, because it no longer assumes the rates are equal:\n\n$$(\\hat p_B - \\hat p_A) \\pm 1.96\\sqrt{\\frac{\\hat p_A(1-\\hat p_A)}{n_A} + \\frac{\\hat p_B(1-\\hat p_B)}{n_B}}.$$\n\nFor planning, the number of visitors per group needed to detect true rates $p_A$ and $p_B$ with power $1 - \\beta$ at two-sided level $\\alpha$ is approximately\n\n$$n \\approx \\frac{(z_{\\alpha/2} + z_{\\beta})^2\\,\\bigl(p_A(1-p_A) + p_B(1-p_B)\\bigr)}{(p_B - p_A)^2}.$$\n\nWith $\\alpha = 0.05$ and power 0.8, $(1.96 + 0.84)^2 \\approx 7.85$, which gives the rule of thumb $16\\,p(1-p)/\\delta^2$ when both rates are near $p$.',
    proof: 'Why peeking inflates false wins. Let $z_1, \\dots, z_K$ be the scores at $K$ looks and $c = 1.96$. The peeking rule declares a difference when $\\max_k |z_k| \\ge c$. That event contains the event $|z_K| \\ge c$ of the planned test, and it also contains every path that crosses the line early and returns, which has positive probability. So\n\n$$P\\Bigl(\\max_{k \\le K} |z_k| \\ge c\\Bigr) > P(|z_K| \\ge c) \\approx 0.05,$$\n\nand the left side can only grow as looks are added. It grows without limit. For a score built from a running sum $S_n$ of independent terms with mean 0 and variance 1, $z_n = S_n/\\sqrt{n}$, the law of the iterated logarithm says that $|S_n|$ exceeds $(1 - \\varepsilon)\\sqrt{2n\\log\\log n}$ infinitely often with probability 1. So $|z_n|$ exceeds any fixed line eventually: a tester who may look for ever and stop at the first crossing is certain to find a "significant" result, whatever the truth.',
    variants: [
      { name: 'One-sided test', text: 'Counts only an improvement of B over A, with the line at 1.645 for a 5% level. It is appropriate only if a result in the other direction would be treated exactly like no result.' },
      { name: 'Chi-squared test', text: 'Pearson\'s test on the two-by-two table of counts. Without a continuity correction its statistic is exactly z squared, so it gives the same two-sided verdict.' },
      { name: 'Fisher\'s exact test', text: 'Computes the p-value from the exact distribution of the table, with no bell-curve approximation. The choice for small counts.' },
      { name: 'Group-sequential designs', text: 'Plan a fixed number of looks and set a boundary for each so the overall false-alarm rate is the intended one. Pocock\'s design uses the same raised boundary at every look. The O\'Brien-Fleming design is very strict early and close to 1.96 at the end.' },
      { name: 'Always-valid inference', text: 'Tests and confidence sequences whose guarantee holds at every moment, so the experimenter may look and stop at any time.' },
      { name: 'Variance reduction', text: 'Uses what was known about each visitor before the experiment to remove predictable variation from the outcome, so the same traffic detects smaller effects.' },
    ],
    implementation: 'Assign by hashing a stable identifier, so the same person always sees the same version. Record who was shown what at the moment of showing, not later. Before reading any result, check that the group sizes match the intended split. Fix the outcome, the sample size and the significance level in writing before the first visitor arrives. Run for whole weeks. Report the gap with its interval, not only the verdict.',
    benchmarking: 'The standard check of a testing pipeline is an A/A test: split visitors between two copies of the same version and run the analysis. Over many such tests about 5% should come out significant, and the p-values should be spread evenly between 0 and 1. The tests of this lesson do the same with simulated visitors, and repeat it with peeking switched on to measure the damage.',
    references: [
      { authors: 'R. A. Fisher', year: 1935, title: 'The Design of Experiments', venue: 'Oliver and Boyd, Edinburgh' },
      { authors: 'J. Neyman and E. S. Pearson', year: 1933, title: 'On the problem of the most efficient tests of statistical hypotheses', venue: 'Philosophical Transactions of the Royal Society of London, Series A 231, 289-337' },
      { authors: 'P. Armitage, C. K. McPherson and B. C. Rowe', year: 1969, title: 'Repeated significance tests on accumulating data', venue: 'Journal of the Royal Statistical Society, Series A 132(2), 235-244' },
      { authors: 'S. J. Pocock', year: 1977, title: 'Group sequential methods in the design and analysis of clinical trials', venue: 'Biometrika 64(2), 191-199' },
      { authors: 'R. Kohavi, R. Longbotham, D. Sommerfield and R. M. Henne', year: 2009, title: 'Controlled experiments on the web: survey and practical guide', venue: 'Data Mining and Knowledge Discovery 18(1), 140-181' },
      { authors: 'R. Kohavi, D. Tang and Y. Xu', year: 2020, title: 'Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing', venue: 'Cambridge University Press' },
    ],
    furtherReading: [
      'R. Johari, P. Koomen, L. Pekelis and D. Walsh, "Peeking at A/B tests: why it matters, and what to do about it", *Proceedings of the ACM SIGKDD Conference on Knowledge Discovery and Data Mining* (2017).',
      'J. P. Simmons, L. D. Nelson and U. Simonsohn, "False-positive psychology: undisclosed flexibility in data collection and analysis allows presenting anything as significant", *Psychological Science* 22(11), 1359-1366 (2011).',
    ],
  },

  tests: [
    { name: 'worked example: 30 of 200 against 50 of 200 gives z = 2.5 and p = 0.0124', input: { rateA: 0.15, rateB: 0.25, visitors: 200, looks: 4, peek: false, seed: 63 },
      check: (r, c) => {
        if (r.buyA !== 30 || r.buyB !== 50 || r.stoppedAt !== 200) return `counts were ${r.buyA} and ${r.buyB} of ${r.stoppedAt}`;
        if (Math.abs(r.pooled - 0.2) > 1e-12 || Math.abs(r.se - 0.04) > 1e-12 || Math.abs(r.z - 2.5) > 1e-9) return `pooled ${r.pooled}, standard error ${r.se}, z ${r.z}`;
        if (r.p.toFixed(4) !== '0.0124' || 1 / r.p < 78 || 1 / r.p > 83) return `p-value ${r.p}`;
        if (pts(r.interval[0]) !== '2.2' || pts(r.interval[1]) !== '17.8') return `interval ${r.interval}`;
        return (r.significant && r.winner === 'B' && r.verdict === 'correct win' && c.tests === 1 && c.visitors === 400) || `verdict ${r.verdict}, tests ${c.tests}, visitors ${c.visitors}`;
      } },
    { name: 'z squared equals Pearson\'s chi-squared statistic for the two-by-two table of counts', input: { rateA: 0.1, rateB: 0.13, visitors: 2000, looks: 20, peek: false, seed: 15 },
      check: (r) => {
        const n = r.stoppedAt, bought = r.buyA + r.buyB, left = 2 * n - bought;
        let chi2 = 0;
        for (const [seen, expected] of [[r.buyA, bought / 2], [r.buyB, bought / 2], [n - r.buyA, left / 2], [n - r.buyB, left / 2]]) chi2 += ((seen - expected) ** 2) / expected;
        return Math.abs(chi2 - r.z * r.z) < 1e-9 || `chi-squared ${chi2}, z squared ${r.z * r.z}`;
      } },
    { name: 'p-values agree with known points of the normal distribution and with an independent formula', input: { rateA: 0.1, rateB: 0.1, visitors: 100, looks: 1, peek: false, seed: 1 },
      check: () => {
        const known = [[0, 1], [1, 0.3173105], [1.959964, 0.05], [2.575829, 0.01], [3.290527, 0.001]];
        for (const [z, p] of known) if (Math.abs(twoSidedP(z) - p) > 1e-6 || Math.abs(twoSidedP(-z) - p) > 1e-6) return `p(${z}) = ${twoSidedP(z)}, expected ${p}`;
        // Abramowitz and Stegun, formula 26.2.17: a polynomial approximation to the normal tail, accurate to 7.5e-8.
        const tail = (z) => {
          const k = 1 / (1 + 0.2316419 * z);
          const poly = k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
          return (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
        };
        for (let z = 0; z <= 5; z += 0.05) if (Math.abs(twoSidedP(z) - 2 * tail(z)) > 4e-7) return `at z = ${z.toFixed(2)}: ${twoSidedP(z)} against ${2 * tail(z)}`;
        return true;
      } },
    { name: 'no real difference, one planned test: false wins stay near 5% over 2000 seeded experiments', input: { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: false, seed: 31 },
      check: () => {
        const share = winShare({ rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: false, seed: 31 }, 2000);
        return (share > 0.035 && share < 0.065) || `false wins in ${pct(share)} of experiments`;
      } },
    { name: 'no real difference, peeking at 20 checks: false wins rise to about a quarter, far above 5%', input: { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: true, seed: 31 },
      check: () => {
        const base = { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, seed: 31 };
        const once = winShare({ ...base, peek: false }, 2000), peeked = winShare({ ...base, peek: true }, 2000);
        return (peeked > 0.19 && peeked < 0.31 && peeked > 3 * once) || `peeking ${pct(peeked)}, planned test ${pct(once)}`;
      } },
    { name: 'every added check adds false wins: 1, 5 and 20 checks', input: { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 5, peek: true, seed: 44 },
      check: () => {
        const share = (looks) => winShare({ rateA: 0.1, rateB: 0.1, visitors: 1000, looks, peek: true, seed: 44 }, 1500);
        const s1 = share(1), s5 = share(5), s20 = share(20);
        return (s1 > 0.03 && s1 < 0.07 && s5 > 0.1 && s5 < 0.18 && s20 > s5 + 0.05) || `shares ${pct(s1)}, ${pct(s5)}, ${pct(s20)}`;
      } },
    { name: 'peeking can only add winners: whenever the planned test is significant, the peeking run also declares one', input: { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: true, seed: 3 },
      check: () => {
        let planned = 0;
        for (let s = 1; s <= 400; s++) {
          const base = { rateA: 0.1, rateB: 0.11, visitors: 1000, looks: 20, seed: 2000 + s };
          const once = run({ ...base, peek: false }, QUIET), peeked = run({ ...base, peek: true }, QUIET);
          if (once.significant) planned++;
          if (once.significant && !peeked.significant) return `seed ${2000 + s}: the planned test found a difference and the peeking run did not`;
          if (peeked.stoppedAt > once.stoppedAt) return `seed ${2000 + s}: the peeking run used more visitors than planned`;
        }
        return planned > 20 || `only ${planned} planned tests were significant, too few to check anything`;
      } },
    { name: 'presets and quiz: the same visitors give no difference when tested once, and a false win for B at check 6 when peeking', input: { rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: true, seed: 58 },
      check: (r, c) => {
        const once = run({ rateA: 0.1, rateB: 0.1, visitors: 1000, looks: 20, peek: false, seed: 58 }, QUIET);
        if (r.verdict !== 'false win' || r.winner !== 'B' || r.stopCheck !== 6 || r.stoppedAt !== 300 || !r.early) return `peeking run: ${r.verdict}, stopped at check ${r.stopCheck}`;
        if (c.tests !== 6 || c.visitors !== 600) return `tests ${c.tests}, visitors ${c.visitors}`;
        if (once.significant || once.verdict !== 'correct: no difference' || once.tests !== 1 || once.stoppedAt !== 1000) return `planned test: ${once.verdict}`;
        const at = once.checks[5];
        if (at.seen !== 300 || at.buyA !== r.buyA || at.buyB !== r.buyB) return 'the two runs did not see the same visitors';
        if (!zTest(at.buyA, at.seen, at.buyB, at.seen).significant) return 'the planned run does not cross the line at 300 visitors';
        return (Math.abs(r.full.z - once.z) < 1e-12 && !r.full.significant && r.full.buyA === once.buyA) || `carried on to the planned size: z ${r.full.z}, planned test z ${once.z}`;
      } },
    { name: 'default: a true gap of 3 points is found at 2000 per group, and with peeking the run stops at 1100', input: { rateA: 0.1, rateB: 0.13, visitors: 2000, looks: 20, peek: false, seed: 15 },
      check: (r, c) => {
        if (r.verdict !== 'correct win' || r.winner !== 'B' || r.early || c.tests !== 1 || c.visitors !== 4000) return `planned test: ${r.verdict}, tests ${c.tests}, visitors ${c.visitors}`;
        if (!(r.interval[0] < 0.03 && r.interval[1] > 0.03 && r.interval[0] > 0)) return `interval ${r.interval}`;
        const peeked = run({ rateA: 0.1, rateB: 0.13, visitors: 2000, looks: 20, peek: true, seed: 15 }, QUIET);
        return (peeked.verdict === 'correct win' && peeked.stoppedAt === 1100) || `peeking run: ${peeked.verdict} at ${peeked.stoppedAt}`;
      } },
    { name: 'power: 10% against 13% with 2000 per group is detected in most experiments', input: { rateA: 0.1, rateB: 0.13, visitors: 2000, looks: 1, peek: false, seed: 9 },
      check: () => {
        const share = winShare({ rateA: 0.1, rateB: 0.13, visitors: 2000, looks: 1, peek: false, seed: 9 }, 600);
        return (share > 0.77 && share < 0.92) || `detected in ${pct(share)} of experiments, expected about 85%`;
      } },
    { name: 'sample size: 3839 per group separates 10% from 12% about four times in five', input: { rateA: 0.1, rateB: 0.12, visitors: 3800, looks: 1, peek: false, seed: 5 },
      check: () => {
        const need = neededPerGroup(0.1, 0.12);
        if (need !== 3839 || Math.abs(need / ((16 * 0.11 * 0.89) / 0.0004) - 1) > 0.05) return `formula gave ${need}`;
        const share = winShare({ rateA: 0.1, rateB: 0.12, visitors: need, looks: 1, peek: false, seed: 5 }, 600);
        return (share > 0.74 && share < 0.86) || `detected in ${pct(share)} of experiments, expected about 80%`;
      } },
    { name: 'preset and quiz: a one-point improvement is missed at 1000 per group', input: { rateA: 0.1, rateB: 0.11, visitors: 1000, looks: 20, peek: false, seed: 15 },
      check: (r) => {
        if (r.verdict !== 'missed difference' || r.significant) return `verdict ${r.verdict}`;
        if (pts(r.se) !== '1.4') return `standard error ${r.se}`;
        if (r.needed !== 14749) return `needed ${r.needed}`;
        const share = winShare({ rateA: 0.1, rateB: 0.11, visitors: 5000, looks: 1, peek: false, seed: 8 }, 600);
        return (share > 0.29 && share < 0.45) || `at 5000 per group the improvement was caught in ${pct(share)} of experiments, expected about a third`;
      } },
    { name: 'nobody buys, or everybody buys: the score is 0 and the p-value is 1, not a division by zero', input: { rateA: 0.02, rateB: 0.02, visitors: 100, looks: 40, peek: true, seed: 2 },
      check: (r) => {
        for (const [a, b] of [[0, 0], [50, 50]]) {
          const test = zTest(a, 50, b, 50);
          if (test.z !== 0 || test.p !== 1 || test.significant) return `${a} and ${b} of 50 gave z ${test.z}, p ${test.p}`;
        }
        return Number.isFinite(r.z) || 'a run with very few buyers produced a score that is not a number';
      } },
    { name: 'the number of progress checks does not change the planned test, and the same seed repeats exactly', input: { rateA: 0.1, rateB: 0.13, visitors: 2000, looks: 7, peek: false, seed: 77 },
      check: (r, c) => {
        for (const looks of [1, 20, 40]) {
          const other = run({ rateA: 0.1, rateB: 0.13, visitors: 2000, looks, peek: false, seed: 77 }, QUIET);
          if (other.z !== r.z || other.buyA !== r.buyA || other.buyB !== r.buyB) return `${looks} checks changed the result`;
        }
        return (c.tests === 1 && r.checks.length === 7 && r.checks.filter((x) => x.tested).length === 1) || `tests ${c.tests}`;
      } },
  ],
};

