import { makeRng } from '../../js/lib/rng.js';

// The robot drives VELOCITY metres per step, give or take PROC_SD. In the hallway with a beacon it
// starts about HUMP metres from the beacon on one side or the other. In the plain case it starts
// near 0, give or take START_SD.
const VELOCITY = 0.5, PROC_SD = 0.3, HUMP = 4, HUMP_SD = 0.7, START_SD = 2;
const NEAR = 3;   // "no particle near the truth" means none within this many metres
const QUIET = { record: false, count() {}, frame() {} };

// Numbers for the notes, with a real minus sign and no "-0.00".
const num = (v, d = 2) => { const s = Math.abs(v).toFixed(d); return v < 0 && Number(s) !== 0 ? `−${s}` : s; };
const pct = (v) => `${Math.round(v * 100)}%`;
const times = (ratio) => (ratio < 10 ? `${ratio.toFixed(1)} times smaller` : ratio < 1000 ? `${Math.round(ratio)} times smaller` : ratio < 1e6 ? 'thousands of times smaller' : 'millions of times smaller, which is as good as zero');

// What the sensor would read, without noise, if the robot were at x.
const expected = (x, sensor) => (sensor === 'distance' ? Math.abs(x) : x);

// Score every particle by how well it explains the reading z, then scale the scores to sum to 1.
// A score is exp(−error² / (2 r²)). Each score is divided by the best one before the scaling, which
// changes nothing in the result but stops every score rounding to zero when the whole cloud is far off.
function weigh(xs, z, r, sensor) {
  const n = xs.length, d2 = new Array(n), w = new Array(n);
  let best = Infinity, total = 0;
  for (let i = 0; i < n; i++) { const e = (z - expected(xs[i], sensor)) / r; d2[i] = e * e; if (d2[i] < best) best = d2[i]; }
  for (let i = 0; i < n; i++) { w[i] = Math.exp(-0.5 * (d2[i] - best)); total += w[i]; }
  for (let i = 0; i < n; i++) w[i] /= total;
  return w;
}

// Systematic resampling. Lay the weights end to end from 0 to 1 and put n evenly spaced marks on
// them, the first at u0 / n. Each mark picks the particle it lands on. Returns the picked indexes.
function systematicResample(weights, u0) {
  const n = weights.length, picks = new Array(n);
  let i = 0, reach = weights[0];
  for (let j = 0; j < n; j++) {
    const mark = (u0 + j) / n;
    while (mark > reach && i < n - 1) { i++; reach += weights[i]; }
    picks[j] = i;
  }
  return picks;
}

function weightedStats(xs, w) {
  let mean = 0, sq = 0, var_ = 0;
  for (let i = 0; i < xs.length; i++) { mean += w[i] * xs[i]; sq += w[i] * w[i]; }
  for (let i = 0; i < xs.length; i++) var_ += w[i] * (xs[i] - mean) ** 2;
  return { mean, sd: Math.sqrt(var_), neff: 1 / sq };
}

// The exact answer for the plain case (position sensor, one bell-shaped start), by the Kalman
// filter formulas. Drawn beside the particle estimate so the two can be compared.
function kalmanTrack(zs, r) {
  let x = 0, P = START_SD * START_SD;
  const out = [x];
  for (let k = 1; k < zs.length; k++) {
    x += VELOCITY; P += PROC_SD * PROC_SD;
    const K = P / (P + r * r);
    x += K * (zs[k] - x); P *= 1 - K;
    out.push(x);
  }
  return out;
}

function run(input, t) {
  const linear = input.scenario === 'linear';
  const sensor = linear ? 'position' : 'distance';
  const N = Math.floor(Number(input.particles));
  const r = Number(input.measNoise);
  const T = Math.floor(Number(input.steps));
  if (!(N >= 2)) throw new Error('Use at least two particles. A single guess has nothing to be compared with.');
  if (!(r > 0)) throw new Error('The sensor error must be greater than zero.');
  if (!(T >= 1)) throw new Error('Track at least one step.');
  const picture = t.record !== false;           // count-only runs keep nothing for drawing

  // The world: where the robot really is, and what its sensor reads. It has its own random stream,
  // so changing the number of particles leaves the robot's path and the readings exactly as they were.
  const world = makeRng(input.seed);
  const side = linear ? 0 : (world.next() < 0.5 ? -1 : 1);
  const truth = [linear ? world.normal(0, START_SD) : side * HUMP + world.normal(0, HUMP_SD)];
  const zs = [null];
  for (let k = 1; k <= T; k++) {
    truth.push(truth[k - 1] + VELOCITY + world.normal(0, PROC_SD));
    zs.push(expected(truth[k], sensor) + world.normal(0, r));
  }
  const exact = linear ? kalmanTrack(zs, r) : null;

  // The filter: N guesses spread over everything the start allows.
  const rng = makeRng(Number(input.seed) * 7919 + 101);
  let xs = new Array(N);
  for (let i = 0; i < N; i++) xs[i] = linear ? rng.normal(0, START_SD) : (i % 2 ? HUMP : -HUMP) + rng.normal(0, HUMP_SD);
  const uniform = new Array(N).fill(1 / N);
  const first = weightedStats(xs, uniform);
  const estimates = [first.mean], spreads = [first.sd], neffs = [N], weightSums = [], rightShare = [], survivors = [], counts = [N], detail = [];
  let starvedAt = 0, decidedAt = 0, nearest = Infinity;

  const span = truth.concat(linear ? [-3 * START_SD, 3 * START_SD] : [-HUMP - 3 * HUMP_SD, HUMP + 3 * HUMP_SD]);
  const lo = Math.floor(Math.min(...span) - 1.5), hi = Math.ceil(Math.max(...span) + 1.5);
  const base = N <= 40 ? 3.6 : N <= 150 ? 2.7 : 2.1;
  const rows = [];                               // rows[k]: the cloud after step k, kept for the picture
  if (picture) rows.push(xs.map((x) => [x, 0]));

  const mainLegend = [
    { label: 'particles (a larger dot carries more weight)', role: 'forest' },
    { label: 'clouds of earlier steps', role: 'sage' },
    { label: 'true position (hidden from the filter)', role: 'ink' },
    { label: linear ? 'sensor readings' : 'sensor readings: both places a distance could mean', role: 'ochre' },
    { label: 'estimate: weighted average of the particles', role: 'terracotta' },
    ...(linear ? [{ label: 'exact answer from the Kalman filter formulas', role: 'brick' }] : []),
  ];
  // k: current step. phase: 'start' | 'move' | 'weigh' | 'resample' | 'end'.
  // dots: the current cloud as { x, y, r }. stems: [position, weight] pairs for the lower chart.
  const views = (k, phase, dots, stems, top) => {   // top: the tallest weight the lower chart must show
    const estTo = phase === 'move' ? k - 1 : k;            // newest step that has an estimate and a reading
    const layers = [];
    if (!linear) {
      layers.push({ type: 'line', points: [[0, -0.7], [0, T + 0.7]], role: 'sage', width: 1.4 });
      layers.push({ type: 'text', at: [0, T + 0.3], text: 'beacon', role: 'muted', dx: 6, size: 10.5 });
    }
    for (let j = 0; j < k; j++) layers.push({ type: 'points', points: rows[j], role: 'sage', r: 1.7, alpha: 0.75 });
    layers.push({ type: 'points', points: dots, role: 'forest' });
    const marks = [];
    for (let j = 1; j <= estTo; j++) { marks.push([zs[j], j]); if (!linear && zs[j] > 0) marks.push([-zs[j], j]); }
    if (marks.length) layers.push({ type: 'points', points: marks, role: 'ochre', r: 4.5, hollow: true });
    if (k >= 1) layers.push({ type: 'line', points: truth.slice(0, k + 1).map((v, j) => [v, j]), role: 'ink', width: 1.5, dash: true });
    layers.push({ type: 'points', points: [[truth[k], k]], role: 'ink', r: 3.6 });
    if (exact && estTo >= 1) layers.push({ type: 'line', points: exact.slice(0, estTo + 1).map((v, j) => [v, j]), role: 'brick', width: 1.4, dash: [3, 3] });
    if (estTo >= 1) layers.push({ type: 'line', points: estimates.slice(0, estTo + 1).map((v, j) => [v, j]), role: 'terracotta', width: 2.2 });
    layers.push({ type: 'points', points: [[estimates[estTo], estTo]], role: 'terracotta', r: 4 });

    const lower = [{ type: 'segments', segments: stems.map(([x, w]) => [x, 0, x, 100 * w]), role: 'forest', width: N > 150 ? 1.2 : 2 }];
    top *= 100;
    if (estTo >= 1 && estTo === k) {
      lower.push({ type: 'segments', segments: (linear || zs[k] <= 0 ? [zs[k]] : [zs[k], -zs[k]]).map((x) => [x, 0, x, top]), role: 'ochre', width: 1.4, dash: true });
    }
    lower.push({ type: 'segments', segments: [[truth[k], 0, truth[k], top]], role: 'ink', width: 1.3, dash: [2, 4] });
    lower.push({ type: 'segments', segments: [[estimates[estTo], 0, estimates[estTo], top]], role: 'terracotta', width: 1.6 });
    return [
      { kind: 'scene', title: 'The hallway, one row of particles for each time step', x: [lo, hi], y: [-0.7, T + 0.7], aspect: 0.5,
        axes: { xLabel: 'position along the hallway (metres)', yLabel: 'time step' }, layers, legend: mainLegend },
      { kind: 'scene', title: phase === 'resample' || phase === 'end' ? 'Share of the weight at each position after resampling (copies out of all particles)' : 'Share of the weight each particle carries', x: [lo, hi], y: [0, top], aspect: 0.22,
        axes: { xLabel: 'position (metres)', yLabel: 'weight (%)' }, layers: lower,
        legend: [{ label: 'one line per particle, as tall as its weight', role: 'forest' }, { label: 'sensor reading', role: 'ochre' }, { label: 'true position', role: 'ink' }, { label: 'estimate', role: 'terracotta' }] },
    ];
  };
  const plainDots = (list, k) => list.map((x) => ({ x, y: k, r: base }));
  const flat = (list) => list.map((x) => [x, 1 / N]);

  t.count('particles moved', 0);
  t.count('weights computed', 0);
  t.count('particles copied', 0);
  {
    const start = xs.slice();
    t.frame(() => ({ line: [0, 1, 2, 3],
      note: linear
        ? `A robot is somewhere in a hallway. Its sensor reports its position, typically wrong by about ${r} m. The filter starts with one rough idea, "near 0, give or take ${START_SD} m", and turns it into ${N} guesses called **particles**, scattered around 0. Every particle starts with the same weight, 1/${N}. The robot is really at ${num(truth[0])} (the ink dot). The filter never sees that.`
        : `A robot is in a hallway with a beacon at position 0. Its sensor reports how far away the beacon is, typically wrong by about ${r} m, but not on which side it is. The robot knows it starts about ${HUMP} m from the beacon, so there are two places it could be. The filter makes ${N} guesses called **particles**: half near −${HUMP} and half near +${HUMP}. Every particle starts with the same weight, 1/${N}. A Kalman filter could not hold this belief: it stores a single bell curve, and one bell curve stretched over both places would have its centre at the beacon, where the robot certainly is not. The robot is really at ${num(truth[0])} (the ink dot). The filter never sees that.`,
      views: views(0, 'start', plainDots(start, 0), flat(start), 2 / N), vars: { particles: N, estimate: num(first.mean), 'true position': num(truth[0]) } }));
  }

  for (let k = 1; k <= T; k++) {
    // Move: the known drive, plus a different random nudge for every particle.
    const before = xs[0];
    const moved = new Array(N);
    for (let i = 0; i < N; i++) moved[i] = xs[i] + VELOCITY + rng.normal(0, PROC_SD);

    // Weigh: how well does each particle explain the reading?
    const z = zs[k];
    const w = weigh(moved, z, r, sensor);
    let sum = 0, right = 0, bi = 0, wi = 0;
    for (let i = 0; i < N; i++) { sum += w[i]; if (moved[i] > 0) right += w[i]; if (w[i] > w[bi]) bi = i; if (w[i] < w[wi]) wi = i; }
    const s = weightedStats(moved, w);
    estimates.push(s.mean); spreads.push(s.sd); neffs.push(s.neff); weightSums.push(sum); rightShare.push(right);

    // Resample: copy particles in proportion to their weights.
    const picks = systematicResample(w, rng.next());
    const copies = new Array(N).fill(0);
    for (const i of picks) copies[i]++;
    const next = picks.map((i) => moved[i]);
    const alive = copies.filter((c) => c > 0).length;
    survivors.push(alive); counts.push(next.length);
    let near = Infinity, nRight = 0, wasRight = 0;
    for (const x of next) { near = Math.min(near, Math.abs(x - truth[k])); if (x > 0) nRight++; }
    for (const x of xs) if (x > 0) wasRight++;
    nearest = near;
    const starvedNow = near > NEAR && !starvedAt;
    if (starvedNow) starvedAt = k;
    const emptied = !linear && wasRight > 0 && wasRight < N && (nRight === 0 || nRight === N) ? (nRight === 0 ? 'right' : 'left') : null;
    if (emptied && !decidedAt) decidedAt = k;
    if (picture) detail.push({ moved, weights: w, picks, resampled: next });

    const top = Math.max(1.6 / N, 1.15 * w[bi], 1.15 * Math.max(...copies) / N);
    t.count('particles moved', N);
    t.frame(() => ({ line: [4, 5, 6],
      note: `Step ${k}, move. The robot drives ${VELOCITY} m to the right, so every particle is moved ${VELOCITY} m to the right as well. Wheels slip a little and nobody knows by how much, so each particle also gets its own random nudge of about ${PROC_SD} m. Particle 1, for example, went from ${num(before)} to ${num(moved[0])}: ${VELOCITY} for the drive and ${num(moved[0] - before - VELOCITY)} for its nudge. The nudges keep the particles spread out, which is what lets some of them stay close to the true position.`,
      views: views(k, 'move', plainDots(moved, k), flat(moved), top), vars: { step: k, particles: N, 'true position': num(truth[k]) } }));

    t.count('weights computed', N);
    t.frame(() => {
      const ratio = w[bi] / Math.max(w[wi], 1e-300);
      const both = !linear && right > 0.05 && right < 0.95;
      return { line: [7, 8, 9, 10],
        note: `Step ${k}, weigh. The sensor reads ${num(z)}${linear ? '' : `, so the robot should be about ${num(Math.abs(z))} m from the beacon, on one side or the other`}. Each particle is scored by how well it would explain that reading. The particle at ${num(moved[bi])} would expect a reading of ${num(expected(moved[bi], sensor))}. That is ${num(Math.abs(z - expected(moved[bi], sensor)))} away from the real one, the closest of all, so it gets the largest weight, ${num(w[bi], 3)}. The particle at ${num(moved[wi])} would expect ${num(expected(moved[wi], sensor))}, which is ${num(Math.abs(z - expected(moved[wi], sensor)))} away, so its weight is ${times(ratio)}. The scores are divided by their total, so the weights add up to 1. ${linear ? '' : `Particles right of the beacon now hold ${pct(right)} of the weight and those on the left ${pct(1 - right)}. `}The estimate is the weighted average of all the positions: **${num(s.mean)}**. ${both ? 'That number lies between the two groups, where there are hardly any particles. An average is a poor summary while the belief has two humps. ' : ''}${exact ? `The exact answer for this case, from the Kalman filter formulas, is ${num(exact[k])}. ` : ''}Counted by the weight they carry, about ${s.neff.toFixed(1)} of the ${N} particles are doing useful work.`,
        views: views(k, 'weigh', moved.map((x, i) => ({ x, y: k, r: 1.2 + (N <= 40 ? 6 : 5) * Math.sqrt(w[i] / w[bi]) })), moved.map((x, i) => [x, w[i]]), top),
        vars: { step: k, reading: num(z), estimate: num(s.mean), 'true position': num(truth[k]), 'effective particles': s.neff.toFixed(1) } };
    });

    t.count('particles copied', N);
    t.frame(() => {
      const kept = [];
      copies.forEach((c, i) => { if (c > 0) kept.push({ x: moved[i], c }); });
      const sides = linear ? '' : ` ${nRight} of the new particles are right of the beacon and ${N - nRight} are left of it.`;
      let verdict = '';
      if (starvedNow) verdict = ` No particle is now within ${NEAR} m of where the robot really is (${num(truth[k])}). Resampling can only copy particles that exist, and the nudges are about ${PROC_SD} m, so the cloud has no way back. This is **particle starvation**: too few particles to keep the true possibility alive.`;
      else if (emptied) verdict = near <= NEAR
        ? ` No particle is left on the ${emptied} side. The survivors are the ones near the true position (${num(truth[k])}), so nothing was lost: the readings have settled which side the robot is on.`
        : ` No particle is left on the ${emptied} side.`;
      return { line: [11, 12, 13, 14, 15, 16],
        note: `Step ${k}, resample. ${N} new particles are drawn from the old ones. A particle with weight w is copied about w × ${N} times, so heavy particles are copied several times and light ones not at all. Here ${alive} of the ${N} particles were copied at least once. The heaviest, at ${num(moved[bi])}, was copied ${copies[bi]} ${copies[bi] === 1 ? 'time' : 'times'}, and ${N - alive} got no copy and are gone. Every new particle has weight 1/${N} again, because the number of copies now carries what the weights carried.${sides}${verdict}`,
        views: views(k, 'resample', kept.map(({ x, c }) => ({ x, y: k, r: Math.min(8, base * Math.sqrt(c)) })), kept.map(({ x, c }) => [x, c / N]), top),
        vars: { step: k, 'copied at least once': alive, 'got no copy': N - alive, 'true position': num(truth[k]) } };
    });

    xs = next;
    if (picture) rows.push(xs.map((x) => [x, k]));
  }

  // Compare with the truth.
  const error = estimates[T] - truth[T];
  let se = 0, sx = 0;
  for (let k = 1; k <= T; k++) { se += (estimates[k] - truth[k]) ** 2; if (exact) sx += (exact[k] - truth[k]) ** 2; }
  const rmsError = Math.sqrt(se / T), rmsExact = exact ? Math.sqrt(sx / T) : null;
  const lost = nearest > NEAR;                                  // no particle near the truth at the end
  const consistent = Math.abs(error) <= 3 * spreads[T];
  {
    const last = xs.slice();
    const tally = new Map();
    for (const x of last) tally.set(x, (tally.get(x) || 0) + 1);
    const kept = [...tally].map(([x, c]) => ({ x, c }));
    const top = Math.max(1.6 / N, 1.15 * Math.max(...kept.map((p) => p.c)) / N);
    t.frame(() => {
      const verdict = lost
        ? `No particle is within ${NEAR} m of the robot. ${starvedAt ? `The cloud lost it at step ${starvedAt} and never found it again. ` : ''}The cloud's own spread is only ${num(spreads[T])} m, so the filter is confident and wrong. More particles make this much less likely, because a larger cloud keeps a few particles alive in places that look unlikely for a while.`
        : consistent
          ? `The cloud's own spread is ${num(spreads[T])} m, and the truth lies within 3 spreads of the estimate, so the filter's confidence is justified.`
          : `The cloud's own spread is ${num(spreads[T])} m, so the truth is ${(Math.abs(error) / Math.max(spreads[T], 1e-9)).toFixed(1)} spreads from the estimate. The cloud is narrower than its real error: with this few particles it has become too sure of itself.`;
      return { line: 17,
        note: `After ${T} ${T === 1 ? 'step' : 'steps'} the estimate is **${num(estimates[T])}** and the robot is really at ${num(truth[T])}: the estimate is off by ${num(Math.abs(error))} m. ${verdict}${exact ? ` The exact Kalman answer is ${num(exact[T])}. The particle estimate differs from it by ${num(Math.abs(estimates[T] - exact[T]))}, which is the price of using ${N} random guesses in place of a formula.` : ''}`,
        views: views(T, 'end', kept.map(({ x, c }) => ({ x, y: T, r: Math.min(8, base * Math.sqrt(c)) })), kept.map(({ x, c }) => [x, c / N]), top),
        vars: { estimate: num(estimates[T]), 'true position': num(truth[T]), error: num(Math.abs(error)), spread: num(spreads[T]) } };
    });
  }

  return { scenario: linear ? 'linear' : 'two-sides', particles: N, steps: T, measNoise: r, truth, readings: zs, estimates, spreads, neffs, weightSums, rightShare,
    survivors, counts, detail, exact, error, rmsError, rmsExact, starvedAt, decidedAt, lost, consistent, final: xs.slice() };
}

// ---- Independent references for the tests ----

// The Kalman filter again, written in its other form (precisions add), sharing no code with kalmanTrack.
function kalmanByPrecision(readings, r) {
  let mean = 0, precision = 1 / (START_SD * START_SD);
  const out = [mean];
  for (let k = 1; k < readings.length; k++) {
    const priorVar = 1 / precision + PROC_SD * PROC_SD, priorMean = mean + VELOCITY;
    precision = 1 / priorVar + 1 / (r * r);
    mean = (priorMean / priorVar + readings[k] / (r * r)) / precision;
    out.push(mean);
  }
  return out;
}

// The exact belief for the hallway with a beacon, on a fine grid of positions: shift and blur for
// the move, multiply by the likelihood for the reading. No particles and no randomness.
function gridFilterMeans(readings, r) {
  const dx = 0.02, lo = -24, n = 2401, shift = Math.round(VELOCITY / dx);
  const bell = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / s;
  let p = new Float64Array(n);
  for (let i = 0; i < n; i++) { const x = lo + i * dx; p[i] = bell(x, -HUMP, HUMP_SD) + bell(x, HUMP, HUMP_SD); }
  const half = Math.round(5 * PROC_SD / dx), kernel = [];
  for (let j = -half; j <= half; j++) kernel.push(bell(j * dx, 0, PROC_SD));
  const means = [];
  for (let k = 1; k < readings.length; k++) {
    const q = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = -half; j <= half; j++) { const from = i - shift - j; if (from >= 0 && from < n) s += p[from] * kernel[j + half]; }
      q[i] = s;
    }
    let total = 0, mean = 0;
    for (let i = 0; i < n; i++) { const x = lo + i * dx; q[i] *= Math.exp(-0.5 * ((readings[k] - Math.abs(x)) / r) ** 2); total += q[i]; }
    for (let i = 0; i < n; i++) { q[i] /= total; mean += q[i] * (lo + i * dx); }
    means.push(mean);
    p = q;
  }
  return means;
}

export default {
  meta: {
    id: 'particle-filter',
    name: 'Particle Filter',
    aliases: ['sequential Monte Carlo', 'SMC', 'bootstrap filter', 'sequential importance resampling', 'SIR filter', 'Monte Carlo localization', 'condensation algorithm'],
    kind: 'algorithm',
    discipline: 'robotics',
    alsoIn: [
      { id: 'statistics', why: 'Under the name sequential Monte Carlo it is a general way to compute the beliefs of state-space models that have no formula, one observation at a time.' },
      { id: 'ai', why: 'It carries out probabilistic reasoning over time: a belief about a hidden state is kept as samples and revised by Bayes\' rule as evidence arrives.' },
    ],
    subfield: 'State estimation',
    family: 'Bayesian filters',
    lab: 'robotics',
    year: 1993,
    authors: 'Neil Gordon, David Salmond and Adrian Smith',
    summary: 'Tracks a hidden, changing quantity with a cloud of weighted guesses: move each guess, weigh it against the measurement, resample. Copes with beliefs that have several humps.',
    difficulty: 'advanced',
    order: 745,
    paradigms: ['probabilistic-inference', 'randomized-sampling'],
    randomized: true,
    approximate: true,
    time: { best: 'O(N) per step for N particles', average: 'O(N) per step', worst: 'O(N) per step', class: 'linear' },
    space: { worst: 'O(N)', class: 'linear' },
    tags: {
      problems: ['work out where a robot is when it could be in several places', 'keep several guesses alive until the evidence decides', 'track something when one reading fits more than one position', 'locate yourself on a map from imperfect sensors', 'follow a moving thing whose motion is not a simple straight rule', 'estimate something hidden when the doubt is not bell-shaped'],
      techniques: ['weighted samples', 'importance weighting', 'resampling', 'predict and update', 'effective sample size'],
      applications: ['robotics', 'navigation', 'signal processing', 'statistics', 'image processing'],
    },
    prerequisites: ['kalman-filter', 'bayesian-updating', 'monte-carlo', 'concept:bayes-theorem', 'concept:sampling', 'concept:state-space'],
  },

  bigIdea: {
    simple: "A particle filter keeps track of something it cannot see directly by making many guesses at once. Picture a robot in a long hallway that has lost its place. It could be in several spots, so the filter scatters a few hundred guesses along the hallway. Each guess is called a particle, and each one says, \"maybe the robot is here\". Then three things happen, again and again. First, when the robot drives forward, every guess is moved forward too, with a small random nudge because wheels slip. Second, the robot's sensor takes a reading and each guess is scored. A guess that would have produced that reading scores high. A guess that would not scores low. Third, the filter makes a fresh set of guesses by copying the high scorers and dropping the low ones. After a few rounds the guesses crowd around the place where the robot really is. Because the guesses can sit in several places at once, the filter can stay undecided between two spots until the readings settle the matter.",
    when: 'Use it when the belief can have several humps, when the motion or the sensor is not a straight-line rule, or when the noise is not bell-shaped, and when the hidden state has only a few variables. It needs two things from you: a way to simulate one step of motion with its randomness, and a way to say how probable a reading is from a given state. If the motion and the sensor are linear and the noise is Gaussian, use the [Kalman filter](#/algorithm/kalman-filter) instead: it gives the exact answer for a fraction of the work. If the hidden quantity does not change over time, plain [Bayesian updating](#/algorithm/bayesian-updating) is enough.',
    interesting: 'The filter never writes down a formula for its belief. It only needs to push guesses through the motion rule and to score them against a reading, so the same short loop works for a robot in a hallway, an outline in a video and a hidden rate in an economic model. The cost of that freedom is that the answer is random: two runs with different seeds give slightly different estimates, and the exact answer is reached only in the limit of infinitely many particles.',
    analogy: {
      title: 'A search party with one radio',
      text: "A hiker is lost on a moor, and the search party has only so many people. They spread out over every place she might be. Then a report comes over the radio: her phone was heard about two kilometres from the mast. That does not say where she is, but it says where she is not. Searchers standing about two kilometres from the mast are in promising places. Searchers anywhere else are wasting their time, so they walk over and join the promising ones. As the hiker moves, the searchers drift the way she is likely to drift. With each new report the party thins out in the wrong places and thickens in the right ones.",
      limits: "Real searchers can look around, think and change the plan. A particle does nothing but hold a position. Real searchers who find nothing widen the search, while the basic filter can only copy the particles it already has: if none of them is near the truth, no amount of copying will put one there.",
    },
  },

  example: {
    setup: "A robot is in a hallway with a beacon at position 0. Positions are in metres: negative numbers are left of the beacon and positive numbers are right of it. The sensor reports the distance to the beacon, typically wrong by about 1 m, and it cannot tell left from right. The filter holds four guesses, called particles, at −5, −4, 4 and 6. Each carries a quarter of the belief: that share is its weight. For this sensor, a particle whose expected reading misses the real reading by 1 m scores 0.61, and one that misses by 2 m scores 0.14. To keep the arithmetic short, the small random nudges of the full method are left out here.",
    steps: [
      "Move. The robot drives 0.5 m to the right, so every particle moves 0.5 m to the right: they are now at −4.5, −3.5, 4.5 and 6.5.",
      "Score. The sensor reads 5.5. The particle at −4.5 is 4.5 m from the beacon, so it would expect a reading of 4.5. That misses by 1, so it scores 0.61. The particle at −3.5 expects 3.5, misses by 2, and scores 0.14. The particles at 4.5 and 6.5 each miss by 1 and score 0.61.",
      "Turn the scores into weights. The scores add up to 0.61 + 0.14 + 0.61 + 0.61 = 1.97. Dividing each score by 1.97 gives weights of 0.31, 0.07, 0.31 and 0.31, which add up to 1. The two particles on the right hold 0.62 of the weight and the two on the left 0.38.",
      "Estimate. The weighted average is 0.31 × (−4.5) + 0.07 × (−3.5) + 0.31 × 4.5 + 0.31 × 6.5 = 1.77. No particle is anywhere near 1.77. The average falls between the two groups because the filter has not yet decided on a side.",
      "Resample. Lay the weights end to end on a ruler from 0 to 1. The first particle covers 0 to 0.31, the second 0.31 to 0.38, the third 0.38 to 0.69 and the fourth 0.69 to 1. Put four marks a quarter apart, starting at a random point in the first quarter, say 0.20. The marks at 0.20, 0.45, 0.70 and 0.95 land on the first, third, fourth and fourth particles. The new particles are −4.5, 4.5, 6.5 and 6.5, each with weight one quarter again.",
      "Second round. Move: −4, 5, 7 and 7. The sensor reads 6. The particle at −4 misses by 2 and scores 0.14. The other three miss by 1 and score 0.61. The total is 1.97 again, so the particle on the left is down to 0.14 / 1.97 = 0.07 of the weight.",
    ],
    result: "After one reading the left side held 0.38 of the weight. After two it holds 0.07. Driving to the right makes the distance to the beacon grow if the robot is on the right and shrink if it is on the left, so every reading separates the two sides a little more. Notice also what happened to the particle at −3.5. Nobody corrected it or moved it to a better place. It was simply not copied.",
  },

  terms: [
    { term: "Particle", meaning: "One guess at the hidden thing, here one possible position of the robot." },
    { term: "Belief", meaning: "Everything the filter currently thinks about where the robot might be. A particle filter stores its belief as the whole set of particles." },
    { term: "Measurement", meaning: "A reading from a sensor. It equals what the sensor should read at the true position plus an error that differs every time." },
    { term: "Weight", meaning: "The share of belief one particle carries. All the weights add up to 1." },
    { term: "Estimate", meaning: "The filter's single best guess, here the average of the particle positions with each counted according to its weight." },
    { term: "Resampling", meaning: "Making a fresh set of particles by copying the old ones, with heavy particles copied more often and light ones dropped." },
    { term: "Noise", meaning: "The random part of a motion or a reading: the part that cannot be predicted." },
    { term: "Effective number of particles", meaning: "A count of how many particles carry real weight. If one particle has nearly all the weight, the effective number is close to 1." },
    { term: "Particle starvation", meaning: "Having no particles left near the true position, so that copying has nothing good to copy. It is also called particle deprivation." },
    { term: "Likelihood", meaning: "How probable a given reading would be if the robot were at a given position. It is the score a particle gets." },
  ],

  takeaway: "Scatter many guesses, move them as the thing moves, and after every reading keep copies of the guesses that fit it: the survivors show where the thing is.",

  viz: {
    describe: 'The main chart shows a hallway running left to right, with time steps stacked from bottom to top. Each time step has a row of forest green dots, one for each particle, at the positions the particles hold. Rows of earlier steps are pale sage. A dashed ink line with an ink dot is the true position, which the filter never sees. Hollow ochre rings are the sensor readings. With the distance sensor each reading is drawn twice, once on each side of a vertical line that marks the beacon, because a distance does not say which side. A terracotta line is the estimate. In the weighing step the dots grow or shrink with their weights. A second chart below draws one vertical line for each particle at its position, as tall as its weight, with dashed lines at the reading and at the true position and a solid terracotta line at the estimate. In the plain case a dashed brick line shows the exact answer from the Kalman filter formulas.',
    inputs: [
      { id: 'scenario', type: 'select', label: 'What the robot has to work with', default: 'two-sides',
        options: [
          { value: 'two-sides', label: 'Distance to a beacon, and two possible starting sides' },
          { value: 'linear', label: 'Position sensor, one starting guess (the Kalman filter\'s home ground)' },
        ] },
      { id: 'particles', type: 'range', label: 'Number of particles (N)', min: 4, max: 400, step: 1, default: 150,
        help: 'Changing this leaves the robot\'s path and the readings exactly as they were. Only the filter changes.' },
      { id: 'measNoise', type: 'range', label: 'Sensor error (typical size, in metres)', min: 0.2, max: 3, step: 0.1, default: 1,
        help: 'Standard deviation of the error in each reading. The filter is told this value.' },
      { id: 'steps', type: 'range', label: 'Time steps', min: 3, max: 24, step: 1, default: 12 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 47 },
    ],
    presets: [
      { label: 'Two sides, 150 particles', values: { scenario: 'two-sides', particles: 150, measNoise: 1, steps: 12, seed: 47 } },
      { label: 'Starved: the same readings, 12 particles', values: { scenario: 'two-sides', particles: 12, measNoise: 1, steps: 12, seed: 47 } },
      { label: 'An easier run', values: { scenario: 'two-sides', particles: 150, measNoise: 1, steps: 12, seed: 42 } },
      { label: 'Starts on the left and passes the beacon', values: { scenario: 'two-sides', particles: 150, measNoise: 1, steps: 16, seed: 45 } },
      { label: 'Plain case, beside the exact answer', values: { scenario: 'linear', particles: 300, measNoise: 1, steps: 12, seed: 4 } },
      { label: 'Plain case with 6 particles', values: { scenario: 'linear', particles: 6, measNoise: 1, steps: 12, seed: 4 } },
    ],
    tryThis: [
      { ask: 'Load "Two sides, 150 particles" and step through it. The robot is right of the beacon, but the first five readings happen to favour the left. By step 5 the particles on the right hold only 4% of the weight. Can the filter still come back to the right side, and if it can, how many more readings will it need?',
        reveal: 'It can, and it needs one. 4% of 150 particles is still about six particles, so the cloud keeps a few guesses on the right. At step 6 the reading fits them far better than the ones on the left. They take 69% of the weight and are copied many times: only 35 of the 150 particles get any copy at that step. By step 7 the left side is empty, and the run ends 0.50 m from the robot.' },
      { ask: 'Now load "Starved: the same readings, 12 particles". The robot and the readings are exactly the same. At step 3 the right side is down to 3% of the weight. One particle out of 12 stands for 8% of the cloud. How many of the 12 new particles will be copied from the right side at step 3?',
        reveal: 'None. 3% is less than half of one particle\'s share, and this time no copy goes to the right. From then on no particle is near the robot, and nudges of about 0.3 m cannot carry one back. The run ends 10.21 m away with a cloud only 0.17 m wide. A starved cloud is tight and confident, and it is wrong.' },
      { ask: 'Keep the seed at 47 and move the particle slider up from 12. With 20 particles the cloud still starves, and with 24 it survives. Does that make every number above 24 safe? Decide, then try 35, 46 and 64.',
        reveal: 'No. With 30, 40 and 50 particles the cloud survives, but with 35, 46 and 64 it starves again: at step 5 with 35, and at step 3 with the other two. Each particle count draws different random nudges and resampling marks, so each run has its own luck. More particles make starvation less likely, because a smaller share of the weight can still earn a copy. There is no sharp safe number.' },
      { ask: 'Load "Plain case, beside the exact answer". Here a Kalman filter gives the exact answer, drawn as the dashed brick line. With 300 particles, how far will the terracotta estimate stray from that line at its worst: about 0.1 m, about 0.5 m or more than 1 m? Then load "Plain case with 6 particles" and decide again.',
        reveal: 'With 300 particles the estimate is never more than 0.1 m from the exact line, and it ends 0.02 m from it. With 6 particles it is 1.42 m away at step 3 and ends 0.57 m away. The last step also reports a cloud only 0.28 m wide while the estimate is 1.13 m from the robot, which is 4.1 spreads. Too few particles make the filter less accurate and too sure of itself at the same time.' },
      { ask: 'With the default run, set the sensor error to 0.2. Sharper readings tell the filter more. Will more of the 150 particles be copied at each resampling, or fewer?',
        reveal: 'Fewer. A sharp sensor rules out almost every guess: at step 2 only 10 of the 150 particles are copied, and the count of effective particles drops to 5.5. With a sensor error of 1, step 2 copies 100. The run survives and ends 0.15 m from the robot, but for a moment the whole belief rested on a handful of guesses. A precise sensor needs more particles, not fewer.' },
    ],
    run,
    report: (r, c) => {
      const lines = [`Tracked ${r.steps} ${r.steps === 1 ? 'step' : 'steps'} with ${r.particles} particles. Final estimate ${num(r.estimates[r.steps])}; true position ${num(r.truth[r.steps])} (off by ${num(Math.abs(r.error))} m).`];
      if (r.exact) lines.push(`Exact Kalman answer at the end: ${num(r.exact[r.steps])}. Typical error over the run: particles ${num(r.rmsError)} m, exact answer ${num(r.rmsExact)} m.`);
      lines.push(`Fewest effective particles at any step: ${Math.min(...r.neffs).toFixed(1)} of ${r.particles}.`);
      if (r.lost) lines.push(`Particle starvation: no particle is within ${NEAR} m of the robot at the end${r.starvedAt ? ` (lost at step ${r.starvedAt})` : ''}.`);
      else if (r.decidedAt) lines.push(`One side of the beacon first ran out of particles at step ${r.decidedAt}.`);
      lines.push(`${c['weights computed'] || 0} weights computed.`);
      return lines.join('\n');
    },
    experiment: {
      title: 'Work as the number of particles grows',
      note: 'Each point is a real run of 12 steps in the hallway with a beacon. Every step scores every particle once, so the work is 12 × N and grows in a straight line. Accuracy is another matter: the random error of the estimate falls only like 1/√N, which the tests of this lesson measure against exact answers.',
      metric: 'weights computed',
      metricLabel: 'Weights computed',
      sizeLabel: 'Number of particles (N)',
      sizes: [25, 50, 100, 200, 400, 800, 1600, 3200],
      variants: [{ id: 'two-sides', label: '12 steps' }],
      input: (n, variant, seed) => ({ scenario: 'two-sides', particles: n, measNoise: 1, steps: 12, seed }),
      theory: [{ label: '12 N', fn: (n) => 12 * n }],
    },
  },

  logic: {
    intuition: 'A belief about where something is can be stored as a formula, or as a crowd of examples drawn from it. A Kalman filter stores a formula: one bell curve, described by a centre and a width. A particle filter stores the crowd. Where the belief is strong there are many particles, and where it is weak there are few. Two things have to happen to a belief over time. When the object moves, the belief must move and spread, which is done by moving every particle with a little randomness. When a reading arrives, the belief must be multiplied by how well each position explains the reading, which is Bayes\' rule. That is done by giving each particle a weight and then copying particles in proportion to their weights, so that the crowd is again densest where the belief is strongest.',
    steps: [
      'Draw N particles from the starting belief and give each the weight 1/N.',
      'Move. Push every particle through the motion model: apply the known motion and add a separate random nudge drawn from the motion noise.',
      'Weigh. For each particle, compute the likelihood of the new reading: how probable that reading would be if the state were exactly where the particle is. That number is the particle\'s weight.',
      'Normalise. Divide every weight by the sum of all the weights, so that they add up to 1.',
      'Estimate. Report the weighted average of the particles, or another summary of the weighted cloud.',
      'Resample. Draw N new particles from the old ones, each old particle being copied in proportion to its weight, and set every weight back to 1/N.',
      'Repeat from step 2 for the next reading.',
    ],
    pseudocode: [
      'particle_filter(readings, N):',
      '  for i from 1 to N:',
      '    x[i] ← draw from the start',
      '    w[i] ← 1/N',
      '  for each reading z:',
      '    # move every particle',
      '    x[i] ← move(x[i]) + nudge',
      '    # weigh every particle',
      '    w[i] ← likelihood(z, x[i])',
      '    w[i] ← w[i] / sum of all w',
      '    estimate ← sum w[i]·x[i]',
      '    # resample',
      '    u ← random(0, 1/N)',
      '    for j from 0 to N − 1:',
      '      copy the particle whose',
      '        weight covers u + j/N',
      '    x ← the copies; w[i] ← 1/N',
      '  return the estimates',
    ],
    decisions: [
      { title: 'How many particles?', text: 'Enough that every place the truth could plausibly be keeps some particles through a run of unlucky readings. The random error of the estimate falls like 1/√N, so four times the particles halves it. The need grows quickly with the number of state variables, and with the sharpness of the sensor, because a sharp sensor leaves only a thin slice of the cloud with any weight.' },
      { title: 'How should the copies be drawn?', text: 'This page uses systematic resampling: one random number places N evenly spaced marks along the weights laid end to end. A particle with weight w then receives either the whole number just below N × w copies or the one just above it, never anything else. Drawing each copy independently (multinomial resampling) is also correct but adds more random error, since a heavy particle can by chance receive far too few or too many copies.' },
      { title: 'Resample at every step?', text: 'Resampling throws information away: it replaces exact weights by whole numbers of copies. Many implementations therefore resample only when the effective number of particles, 1 / (sum of squared weights), falls below a threshold such as N/2, and otherwise carry the weights forward by multiplying them at the next step. This page resamples every step, as the original bootstrap filter did, because it is the simplest form.' },
      { title: 'Where should the moved particles go?', text: 'Here they are moved by the motion model alone, without looking at the new reading. That is simple and always valid. When the sensor is much more precise than the motion, most particles then land where the reading rules them out. More refined filters use the reading to steer the move and correct for that in the weights.' },
      { title: 'What should be reported?', text: 'The weighted average is the usual estimate and is the best single number in the least-squares sense. When the cloud has two humps the average lies between them, where the object almost certainly is not. In that situation report the cloud itself, or the centre of its heaviest cluster.' },
    ],
    invariants: [
      'After normalising, every weight is zero or more and the weights sum to 1.',
      'There are exactly N particles before and after every resampling.',
      'Every particle after resampling is an exact copy of a particle from before it. Resampling never creates a new position.',
      'With systematic resampling, a particle of weight w is copied either ⌊N·w⌋ or ⌈N·w⌉ times, and N·w times on average.',
    ],
    edgeCases: [
      'Every particle is far from the reading: all the likelihoods can round to zero, and dividing by their sum fails. Implementations compute with logarithms of the weights, or divide by the largest score first as this page does. The weights that come out still sum to 1, but they describe a cloud that has lost the truth.',
      'One particle takes nearly all the weight: the effective number of particles is close to 1 and resampling produces N copies of a single guess.',
      'No random nudge in the move: copies of the same particle never separate, so after a few resamplings the cloud is a handful of distinct points, however large N is.',
      'A missing reading: skip the weighing and the resampling for that step and only move the particles. The cloud spreads until readings return.',
      'A belief with two humps: the weighted average falls between them. The cloud is right and the summary is misleading.',
      'The truth lies outside the starting cloud: no particle is ever near it, and the filter converges on the best wrong answer.',
    ],
    correctness: 'Suppose the particles, each with weight 1/N, are a fair sample of the belief after the previous reading. Moving each one by the motion model with fresh noise gives a fair sample of the belief before the new reading, because that is exactly how the true state would have moved. Bayes\' rule says the belief after the reading is the belief before it multiplied by the likelihood of the reading and rescaled. Weighting a sample by a function and rescaling the weights is importance sampling: the weighted particles now represent the belief after the reading, in the sense that weighted averages over them converge to the true averages as N grows. Resampling picks each particle with an expected number of copies of N times its weight, so the unweighted copies represent the same belief again, and the argument repeats at the next step. The guarantee is statistical and holds in the limit of many particles. For any fixed N the estimate has random error, of order 1/√N when the cloud is healthy, and nothing prevents an unlucky run from losing the truth altogether.',
    mistakes: [
      'Giving every particle the same nudge. The cloud then moves as a block and never spreads, so it cannot cover the uncertainty in the motion.',
      'Resampling uniformly, without using the weights. The readings then have no effect at all.',
      'Forgetting to set the weights back to 1/N after resampling, which counts the same evidence twice: once in the copies and once in the weights.',
      'Computing the estimate after resampling. It is still valid, but it is noisier than the weighted average taken just before.',
      'Using too few particles and trusting the result because the cloud is tight. A starved cloud is always tight.',
      'Reporting the average of a cloud that has two humps as if the object were there.',
    ],
  },

  code: {
    sample: {
      input: 'The hallway with a beacon. The robot starts about 4 m from the beacon on an unknown side and drives 0.5 m to the right each step. Eight distance readings are tracked with 200 particles, using a small random number generator that behaves identically in every language (seed 2024). Each line shows the estimate, the share of the weight that lies right of the beacon, and how many different particles the resampling kept.',
      expected: 'step  reading  estimate  weight on right  kept\n   1      4.2      0.64             0.54   173\n   2      5.4      3.59             0.84   127\n   3      5.1      4.76             0.93   161\n   4      6.6      6.12             1.00   158\n   5      6.3      6.55             1.00   182\n   6      7.2      7.07             1.00   185\n   7      7.4      7.50             1.00   192\n   8      8.3      8.08             1.00   183',
    },
    breakIt: [
      { change: 'In the resampling loop, copy particle `j` and not particle `i`: every mark then takes the particle with its own number, so each particle gets exactly one copy whatever its weight. Look at the last column first. What will it show?',
        find: { python: 'chosen.append(xs[i])', javascript: 'chosen.push(xs[i]);' },
        replace: { python: 'chosen.append(xs[j])', javascript: 'chosen.push(xs[j]);' },
        reveal: 'It shows 200 on every line. Every particle survives every step, so the resampling selects nothing and the readings never change the cloud. The estimate column hides this well: it prints 3.76 at step 2 where the correct program prints 3.59, and 8.11 at the end where the correct one prints 8.08. Each line still weighs the cloud against its own reading, and here one reading is enough to pick out the right-hand group. But the weights are thrown away straight afterwards. The group that started left of the beacon is still there at step 8, and nothing the filter has seen is remembered from one step to the next.' },
      { change: 'Take the random nudge out of the move: change its size from 0.3 to 0.0, so that every particle moves exactly 0.5 m. What happens to the number of different particles from step to step?',
        find: { python: 'rng.normal(0.0, 0.3)', javascript: 'rng.normal(0.0, 0.3)' },
        replace: { python: 'rng.normal(0.0, 0.0)', javascript: 'rng.normal(0.0, 0.0)' },
        reveal: 'It only goes down: 168, 118, 98, 86, 79, 76, 73, 71. The correct program keeps between 127 and 192 different particles at every step. Resampling makes exact copies, and the nudge is the only thing that ever separates them again. Without it every step can lose positions and none can gain any. The estimates still look fine, 8.05 at the end against 8.08, because eight steps are too few to do damage. A longer run would shrink the cloud to a handful of points, and those could not follow the robot when its wheels slip.' },
      { change: 'Change the first reading from 4.2 to 60, a distance no particle is anywhere near. What will the weights be?',
        find: { python: 'readings = [4.2,', javascript: 'const readings = [4.2,' },
        replace: { python: 'readings = [60.0,', javascript: 'const readings = [60.0,' },
        reveal: 'They are all zero. A particle scores exp(−0.5 × miss²), and with a miss of more than 50 m that is too small for the computer to tell from 0. So the total is 0 as well. Python prints the header and then stops at the division with "ZeroDivisionError: float division by zero". JavaScript divides 0 by 0, gets NaN, and carries on. Its first line shows NaN for the estimate and for the weight on the right, and 1 in the last column: no mark can be compared with NaN, so the loop copies the first particle 200 times. That particle is on the left, and the rest of the run follows the wrong side, ending at −3.03 with 0.00 of the weight on the right. Real filters work with logarithms of the scores, or divide every score by the largest one before adding them up.' },
    ],
    python: {
      source: `import math


class Lcg:
    """A small random number generator (Park-Miller). It gives the same
    numbers in every language, so all three programs print the same."""

    def __init__(self, seed):
        self.state = seed

    def uniform(self):
        self.state = self.state * 48271 % 2147483647
        return self.state / 2147483647

    def normal(self, mean, sd):
        u = self.uniform()
        v = self.uniform()
        radius = sd * math.sqrt(-2.0 * math.log(u))
        offset = radius * math.cos(2.0 * math.pi * v)
        return mean + offset


def particle_filter(readings, n, rng):
    # Start about 4 m from the beacon: half the particles on each side.
    xs = [(4.0 if i % 2 else -4.0) + rng.normal(0.0, 0.7) for i in range(n)]
    for step, z in enumerate(readings, start=1):
        # Move: the robot drives 0.5 m. Each particle gets its own nudge.
        xs = [x + 0.5 + rng.normal(0.0, 0.3) for x in xs]
        # Weigh: the sensor reads the distance to the beacon, error about 1 m.
        ws = []
        total = 0.0
        for x in xs:
            miss = z - abs(x)
            ws.append(math.exp(-0.5 * miss * miss))
            total += ws[-1]
        ws = [w / total for w in ws]
        estimate = 0.0
        right = 0.0
        for w, x in zip(ws, xs):
            share = w * x
            estimate += share
            if x > 0:
                right += w
        # Resample: n evenly spaced marks along the weights laid end to end.
        first = rng.uniform()
        chosen = []
        i = 0
        reach = ws[0]
        for j in range(n):
            mark = (first + j) / n
            while mark > reach and i < n - 1:
                i += 1
                reach += ws[i]
            chosen.append(xs[i])
        xs = chosen
        print(f"{step:4d}  {z:7.1f}  {estimate:8.2f}  {right:15.2f}  {len(set(xs)):4d}")


readings = [4.2, 5.4, 5.1, 6.6, 6.3, 7.2, 7.4, 8.3]
print("step  reading  estimate  weight on right  kept")
particle_filter(readings, 200, Lcg(2024))`,
      notes: [
        { line: 18, text: 'Two uniform random numbers are turned into one bell-shaped random number (the Box-Muller method). The steps are written on separate lines so that every language rounds them the same way.' },
        { line: 28, text: 'The move. Every particle gets the same 0.5 m drive and its own random nudge. Without the nudge, copies of one particle would stay on top of each other for ever.' },
        { line: 34, text: 'The score of one particle: large when the distance it would expect, abs(x), is close to the reading z. The sensor error is 1 m here, so no division by it is needed.' },
        { line: 36, text: 'Dividing by the total turns the scores into weights that sum to 1.' },
        { line: 41, text: 'The estimate is the weighted average of the positions, taken before resampling while the exact weights are still available.' },
        { line: 50, text: 'Systematic resampling: the marks are 1/n apart, and one random number shifts them all.' },
        { line: 51, text: 'Walk along the weights until the running total reaches the mark. Particle i is the one the mark lands on, so it is copied.' },
        { line: 56, text: 'The last column counts the different positions left after resampling. That is the number of particles that were copied at least once.' },
      ],
    },
    javascript: {
      source: `// A small random number generator (Park-Miller). It gives the same
// numbers in every language, so all three programs print the same.
class Lcg {
  constructor(seed) { this.state = seed; }
  uniform() {
    this.state = (this.state * 48271) % 2147483647;
    return this.state / 2147483647;
  }
  normal(mean, sd) {
    const u = this.uniform();
    const v = this.uniform();
    const radius = sd * Math.sqrt(-2.0 * Math.log(u));
    const offset = radius * Math.cos(2.0 * Math.PI * v);
    return mean + offset;
  }
}

function particleFilter(readings, n, rng) {
  // Start about 4 m from the beacon: half the particles on each side.
  let xs = [];
  for (let i = 0; i < n; i++) xs.push((i % 2 ? 4.0 : -4.0) + rng.normal(0.0, 0.7));
  readings.forEach((z, index) => {
    // Move: the robot drives 0.5 m. Each particle gets its own nudge.
    xs = xs.map((x) => x + 0.5 + rng.normal(0.0, 0.3));
    // Weigh: the sensor reads the distance to the beacon, error about 1 m.
    let ws = [];
    let total = 0.0;
    for (const x of xs) {
      const miss = z - Math.abs(x);
      ws.push(Math.exp(-0.5 * miss * miss));
      total += ws[ws.length - 1];
    }
    ws = ws.map((w) => w / total);
    let estimate = 0.0;
    let right = 0.0;
    for (let i = 0; i < n; i++) {
      const share = ws[i] * xs[i];
      estimate += share;
      if (xs[i] > 0) right += ws[i];
    }
    // Resample: n evenly spaced marks along the weights laid end to end.
    const first = rng.uniform();
    const chosen = [];
    let i = 0;
    let reach = ws[0];
    for (let j = 0; j < n; j++) {
      const mark = (first + j) / n;
      while (mark > reach && i < n - 1) {
        i += 1;
        reach += ws[i];
      }
      chosen.push(xs[i]);
    }
    xs = chosen;
    console.log(String(index + 1).padStart(4, " ") + "  " + z.toFixed(1).padStart(7, " ") + "  " +
      estimate.toFixed(2).padStart(8, " ") + "  " + right.toFixed(2).padStart(15, " ") + "  " +
      String(new Set(xs).size).padStart(4, " "));
  });
}

const readings = [4.2, 5.4, 5.1, 6.6, 6.3, 7.2, 7.4, 8.3];
console.log("step  reading  estimate  weight on right  kept");
particleFilter(readings, 200, new Lcg(2024));`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <set>
#include <vector>

// A small random number generator (Park-Miller). It gives the same
// numbers in every language, so all three programs print the same.
struct Lcg {
    long long state;
    double uniform() {
        state = state * 48271 % 2147483647;
        return static_cast<double>(state) / 2147483647.0;
    }
    double normal(double mean, double sd) {
        const double PI = 3.141592653589793;
        double u = uniform();
        double v = uniform();
        double radius = sd * std::sqrt(-2.0 * std::log(u));
        double offset = radius * std::cos(2.0 * PI * v);
        return mean + offset;
    }
};

void particle_filter(const std::vector<double>& readings, int n, Lcg rng) {
    // Start about 4 m from the beacon: half the particles on each side.
    std::vector<double> xs(n);
    for (int i = 0; i < n; ++i) xs[i] = (i % 2 ? 4.0 : -4.0) + rng.normal(0.0, 0.7);
    int step = 0;
    for (double z : readings) {
        step += 1;
        // Move: the robot drives 0.5 m. Each particle gets its own nudge.
        for (double& x : xs) x = x + 0.5 + rng.normal(0.0, 0.3);
        // Weigh: the sensor reads the distance to the beacon, error about 1 m.
        std::vector<double> ws(n);
        double total = 0.0;
        for (int i = 0; i < n; ++i) {
            double miss = z - std::fabs(xs[i]);
            ws[i] = std::exp(-0.5 * miss * miss);
            total += ws[i];
        }
        for (double& w : ws) w = w / total;
        double estimate = 0.0;
        double right = 0.0;
        for (int i = 0; i < n; ++i) {
            double share = ws[i] * xs[i];
            estimate += share;
            if (xs[i] > 0) right += ws[i];
        }
        // Resample: n evenly spaced marks along the weights laid end to end.
        double first = rng.uniform();
        std::vector<double> chosen(n);
        int i = 0;
        double reach = ws[0];
        for (int j = 0; j < n; ++j) {
            double mark = (first + j) / n;
            while (mark > reach && i < n - 1) {
                i += 1;
                reach += ws[i];
            }
            chosen[j] = xs[i];
        }
        xs = chosen;
        int kept = static_cast<int>(std::set<double>(xs.begin(), xs.end()).size());
        std::printf("%4d  %7.1f  %8.2f  %15.2f  %4d\\n", step, z, estimate, right, kept);
    }
}

int main() {
    const std::vector<double> readings = {4.2, 5.4, 5.1, 6.6, 6.3, 7.2, 7.4, 8.3};
    std::printf("step  reading  estimate  weight on right  kept\\n");
    particle_filter(readings, 200, Lcg{2024});
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One step moves N particles, scores N particles and makes N copies, so it costs time proportional to N, whatever the shape of the belief. Memory is one position and one weight per particle. The real question is how large N must be. The random error of the estimate falls like 1/√N, and the number of particles needed for a given accuracy rises steeply with the number of state variables.',
    cases: [
      { case: 'One step with systematic resampling (this page)', time: 'O(N)', when: 'N moves, N likelihoods, and one pass along the weights that produces all N copies.' },
      { case: 'One step, each copy drawn independently', time: 'O(N log N)', when: 'Multinomial resampling by binary search in the running totals of the weights.' },
      { case: 'T steps', time: 'O(N · T)', when: 'Each reading is processed once and then discarded.' },
      { case: 'Random error of the estimate', time: 'about 1/√N', when: 'The cloud is healthy: many particles carry weight. The tests of this lesson measure it: 16 times the particles gives about a quarter of the gap to the exact answer.' },
      { case: 'A state with d variables', time: 'N can need to grow exponentially in d', when: 'A cloud must cover a volume, and volume grows as a power of the dimension. Plain particle filters are used for a handful of variables, not for thousands.' },
    ],
    space: 'O(N) positions and weights. For a state with d variables, O(N · d).',
    memory: 'Nothing from earlier steps is kept: the cloud summarises the whole past. Moving and weighing treat each particle independently and can be done in parallel. Resampling needs the running total of all the weights, which is the part that takes care on parallel hardware.',
    tradeoffs: 'A Kalman filter spends a few arithmetic operations per step and is exact, but only for linear models with Gaussian noise. A grid over all positions is exact up to the grid spacing and handles any shape of belief, but its size multiplies with every added state variable. A particle filter sits between them: it handles any shape, puts its effort only where the belief is, and pays with random error and with the risk of starvation.',
    assumptions: [
      'The motion model can be simulated, including its noise, and the likelihood of a reading can be computed for any state.',
      'The state depends only on the previous state, and each reading only on the current state.',
      'O(N) per step assumes each move and each likelihood takes constant time. With a map and a laser scan, one likelihood can be expensive, and that cost multiplies N.',
      'The 1/√N rate is a statement about typical random error with a healthy cloud. It is not a bound, and it says nothing once the cloud has lost the truth.',
      'The experiment on this page counts likelihood evaluations over 12 steps.',
    ],
  },

  tradeoffs: {
    struggles: [
      'States with many variables, where no affordable cloud can cover the space.',
      'Very precise sensors combined with uncertain motion: almost every particle is ruled out at each step.',
      'Long stretches in which the readings say little, followed by one that says a lot: by then the cloud may have drifted off the truth.',
      'Problems where a Kalman filter applies. The particle filter is then slower and less accurate than the exact formula.',
    ],
    pitfalls: [
      'Too little motion noise, which lets the cloud collapse onto a few points. A little extra noise is often added on purpose.',
      'Likelihoods that underflow to zero when the sensor is precise. Work with logarithms.',
      'Treating the tightness of the cloud as a measure of accuracy. A starved cloud is tight and wrong.',
      'Comparing two settings on different random seeds and mistaking the difference in luck for a difference in quality.',
    ],
    misunderstandings: [
      '"Each particle is corrected toward the measurement." No particle is ever corrected. Particles are moved only by the motion model. The reading decides only which of them are copied and which are dropped.',
      '"A heavy particle is close to the truth." A weight says how well a particle explains the latest reading and nothing else. In the hallway with a beacon, a particle on the wrong side can fit a reading exactly as well as one on the right side.',
      '"Resampling makes the estimate better." At the step where it happens it makes the estimate slightly worse, because exact weights are replaced by whole numbers of copies. It is done for the sake of later steps, so that the particles are spent where the belief is and not where it has died out.',
      '"Given enough readings the filter always finds the truth." It can only keep or drop the guesses it has. Once no particle is near the truth, the readings cannot bring one back, and the filter settles on the best of the wrong guesses.',
      '"The average of the particles is where the object is." When the cloud has two humps the average lies between them, in a place the filter itself considers very unlikely.',
    ],
    constraints: [
      'Real-time systems have a fixed budget per step, which caps N. Much practical work goes into getting more from each particle instead of adding particles.',
      'Deployed filters often guard against starvation, for example by adding a few fresh random particles at every step or by restarting when all the likelihoods are tiny.',
    ],
    alternatives: [
      { id: 'kalman-filter', name: 'Kalman Filter', when: 'The motion and the sensor are linear and the noise is Gaussian. It is exact, and it needs two numbers where the particle filter needs hundreds.' },
      { name: 'Extended and unscented Kalman filters', when: 'The model is mildly nonlinear and the belief has a single hump. They approximate the belief by one bell curve at a small fixed cost.' },
      { name: 'Grid (histogram) filter', when: 'The state has one or two variables and a fixed grid over them is affordable. It is deterministic and has no starvation, and it is the reference the tests of this lesson use.' },
      { id: 'bayesian-updating', name: 'Bayesian Updating', when: 'The unknown does not change over time, so there is nothing to move between readings.' },
      { id: 'metropolis-hastings', name: 'Metropolis-Hastings', when: 'All the data is already in hand and the aim is to sample from one fixed belief, not to follow a changing one as readings arrive.' },
    ],
    comparison: {
      columns: ['', 'Particle filter', 'Kalman filter', 'Grid filter'],
      rows: [
        ['Belief stored as', 'N weighted guesses', 'A centre and a width', 'A weight for every cell of a grid'],
        ['Shapes of belief', 'Any', 'One bell curve', 'Any'],
        ['Models allowed', 'Any that can be simulated', 'Linear, Gaussian noise', 'Any'],
        ['Answer', 'Approximate and random', 'Exact for its models', 'Exact up to the grid spacing'],
        ['Cost per step', 'Proportional to N', 'A few operations', 'Proportional to the number of cells'],
        ['Typical failure', 'Starvation', 'Wrong when the model does not fit', 'Too many cells in more than a few dimensions'],
      ],
    },
  },

  applications: [
    { title: 'Robot localization', status: 'established', text: 'A mobile robot with a map and a range sensor often cannot tell at first which of several similar corridors it is in. Monte Carlo localization, introduced by Dellaert, Fox, Burgard and Thrun in 1999, keeps a cloud of possible poses, moves them with the wheel odometry and weighs them by how well the map explains each scan.' },
    { title: 'Tracking outlines in video', status: 'established', text: 'Isard and Blake\'s Condensation algorithm follows the outline of a moving object through cluttered video. Clutter produces several plausible outlines at once, which is the multi-humped situation a single bell curve cannot hold.' },
    { title: 'Tracking from bearings only', status: 'established', text: 'A sensor that reports only the direction to a target, and not its distance, gives a strongly nonlinear measurement. This was the tracking example in the 1993 paper by Gordon, Salmond and Smith that introduced the bootstrap filter.' },
    { title: 'Mapping while localizing', status: 'established', text: 'FastSLAM, by Montemerlo, Thrun, Koller and Wegbreit, uses particles for the robot\'s path and attaches to each particle its own small map of landmarks, so that a robot can build a map and locate itself in it at once.' },
    { title: 'Hidden quantities in economic time series', status: 'established', text: 'Statisticians use particle filters to fit state-space models that are not linear, such as models in which the volatility of a price series is itself a hidden quantity that changes over time. The filter supplies the likelihood that fitting such a model requires.' },
    { title: 'Finding a phone indoors', status: 'illustrative', text: 'Signal strengths from wireless access points fit several places in a building about equally well. A cloud of guesses that moves with the walker\'s steps and is weighed against each new signal reading can keep those places alive until the walk rules all but one out.' },
  ],

  connections: [
    { to: 'kalman-filter', type: 'prerequisite', why: 'The Kalman filter and the particle filter run the same cycle of predicting and then correcting a belief about a hidden state. The Kalman filter stores the belief as one bell curve, and the particle filter replaces that curve with samples so the belief can take any shape.' },
    { to: 'bayesian-updating', type: 'prerequisite', why: 'Weighing the particles is Bayesian updating carried out on samples: each guess is reweighted by how well it explains the evidence. The particle filter adds a move between updates because the unknown changes.' },
    { to: 'monte-carlo', type: 'prerequisite', why: 'Monte Carlo estimation replaces an average over all possibilities by an average over random samples. A particle filter does that at every time step, for a belief that keeps changing.' },
    { to: 'metropolis-hastings', type: 'related', why: 'Metropolis-Hastings and the particle filter both stand in for a distribution that has no usable formula with samples from it. Metropolis-Hastings walks one sample around a fixed distribution, while the particle filter carries a whole population through a changing one.' },
    { to: 'reservoir-sampling', type: 'related', why: 'Reservoir sampling and the resampling step of a particle filter both pick a fair random selection in one pass using a running total. Reservoir sampling gives every item the same chance, and resampling gives each particle a chance in proportion to its weight.' },
    { to: 'genetic-algorithm', type: 'related', why: 'A genetic algorithm and a particle filter both keep a population, copy the members that score well and perturb the copies. In the particle filter the score is a likelihood and the copying follows Bayes\' rule, so the population means something exact: it is a sample of a belief.' },
    { to: 'rrt', type: 'related', why: 'A motion planner such as RRT assumes the robot knows where it is. A particle filter is one way a robot obtains that knowledge from sensors that fit several places at once.' },
    { to: 'viterbi', type: 'related', why: 'The Viterbi algorithm and the particle filter both reason about a hidden state that changes step by step and is seen only through noisy observations. Viterbi finds the single most probable path through a small set of states, and the particle filter tracks the current belief over a continuous one.' },
    { to: 'concept:bayes-theorem', type: 'prerequisite', why: 'The weight of a particle is the likelihood term of Bayes\' theorem, and normalising the weights is its division by the total.' },
    { to: 'concept:sampling', type: 'prerequisite', why: 'The filter represents a belief by samples drawn from it, and resampling is drawing a new sample from a weighted one.' },
    { to: 'concept:state-space', type: 'prerequisite', why: 'The method assumes a hidden state that evolves by a rule with noise and is observed through noisy measurements.' },
    { to: 'concept:markov-chain', type: 'related', why: 'The hidden state is a Markov chain: where it goes next depends only on where it is now. That is why the cloud of current particles is all the filter needs to remember.' },
    { to: 'discipline:statistics', type: 'application', why: 'Sequential Monte Carlo is a standard tool for fitting state-space models of time series that are not linear or not Gaussian.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Tracking an object through cluttered video needs a belief with several humps, one for each plausible match, which particles provide.' },
    { to: 'discipline:ai', type: 'application', why: 'Reasoning under uncertainty over time means keeping a belief about a hidden state up to date, and particles are the general-purpose way to hold such a belief.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'In the move step every particle gets its own random nudge on top of the known motion. What would go wrong without the nudges?',
      options: ['Nothing: the nudges only make the picture look more natural', 'Copies of the same particle would stay identical for ever, so after a few resamplings the cloud would shrink to a handful of points', 'The weights would no longer add up to 1', 'The particles would move too slowly to keep up with the robot'],
      answer: 1,
      explain: [
        'The nudges do real work. They stand for the uncertainty in the motion, and they are the only thing that makes two copies of a particle differ.',
        'Resampling makes exact copies. Only the random nudges separate them again. Without nudges each resampling can only reduce the number of distinct positions, and the cloud can no longer cover the true position.',
        'The weights are divided by their total in every case, so they always add up to 1.',
        'The known motion is applied to every particle in full. The nudges are about the part of the motion that is not known.',
      ],
    },
    {
      type: 'predict',
      q: 'With 12 particles the default run starves at step 3 and ends on the wrong side of the beacon. Now take "An easier run" (seed 42), where the readings favour the side the robot is on from the first step, and track it with the same 12 particles. What happens?',
      options: ['It starves again, because 12 particles are too few for a belief with two humps', 'It ends several metres off, because 12 particles give a rough average', 'It settles on the correct side and ends well under 1 m from the robot', 'It never settles on a side, and the estimate stays near the beacon'],
      answer: 2,
      explain: [
        'The particle count alone does not starve a cloud. Starvation needs the true side to fall below about one particle\'s share of the weight, and in this run the true side never holds less than 60%.',
        'Fewer particles do make the estimate rougher, but not by metres while the cloud is healthy. This run ends 0.25 m from the robot, against 0.09 m with 150 particles.',
        'The right side, where the robot is, holds 60% of the weight after the first reading, 89% after the second and nearly all of it after the third. The left side is empty at step 3 and the run ends 0.25 m from the robot. The same 12 particles failed on the default run only because its early readings pushed the true side down to 3% of the weight.',
        'Driving to the right makes the distance grow on one side of the beacon and shrink on the other, so every reading separates the two sides a little more. Here the left side is empty by step 3.',
      ],
      tryInput: { scenario: 'two-sides', particles: 12, measNoise: 1, steps: 12, seed: 42 },
      check: (r, c) => (!r.lost && r.starvedAt === 0 && r.decidedAt === 3 && r.consistent && r.truth[12] > 0 && r.final.every((x) => x > 0) && num(Math.abs(r.error)) === '0.25'
        && r.rightShare.slice(0, 3).map(pct).join(' ') === '60% 89% 100%' && Math.min(...r.rightShare) > 0.6 && c['weights computed'] === 144) || `lost ${r.lost}, decided at ${r.decidedAt}, error ${num(Math.abs(r.error))}, right shares ${r.rightShare.slice(0, 3).map(pct).join(' ')}`,
    },
    {
      type: 'debug',
      q: 'This filter runs without errors, but its cloud never tightens around the robot, whatever the sensor reads. What is wrong?',
      code: `for z in readings:
    xs = [x + 0.5 + rng.normal(0.0, 0.3) for x in xs]
    ws = [likelihood(z, x) for x in xs]
    total = sum(ws)
    ws = [w / total for w in ws]
    xs = [random.choice(xs) for _ in xs]`,
      options: ['The weights should not be divided by their total', 'The last line picks particles with equal chance and ignores the weights; it should pick each in proportion to its weight', 'The move should come after the weighing', 'The nudge of 0.3 is too large'],
      answer: 1,
      explain: [
        'Dividing by the total is right. It makes the weights add up to 1 and does not change their proportions.',
        '`random.choice` gives every particle the same chance, so the weights are computed and then thrown away. The readings never influence the cloud. `random.choices(xs, weights=ws, k=len(xs))`, or systematic resampling, uses them.',
        'The order is right: move the guesses to the present, then compare them with the present reading.',
        'The size of the nudge affects how wide the cloud is, but no value of it would make the cloud respond to the readings.',
      ],
    },
    {
      type: 'choice',
      q: 'A robot is in one of two corridors that look the same to its sensor. Why does a particle filter suit this better than a Kalman filter?',
      options: ['It is faster', 'It can hold a belief with two separate humps, while a Kalman filter holds a single bell curve and would centre it between the corridors', 'It does not need a model of the sensor', 'It always gives the exact answer'],
      answer: 1,
      explain: [
        'It is much slower. A Kalman filter updates a couple of numbers where the particle filter updates hundreds of guesses.',
        'A single bell curve covering both corridors has its peak in the wall between them. A cloud of particles can simply sit in both places until the readings rule one out.',
        'It needs one: the weights are computed from how probable each reading is at each guessed position.',
        'Its answer is approximate and changes from run to run. The Kalman filter is the exact one, for the cases it covers.',
      ],
    },
    {
      type: 'choice',
      q: 'After the weighing step, one particle out of 200 has weight 0.97. What does systematic resampling do, and what is the risk?',
      options: ['It keeps all 200 particles as they are', 'It makes about 194 copies of that one particle, so nearly the whole cloud becomes a single guess', 'It deletes that particle as an outlier', 'It gives every particle one copy, because resampling is fair'],
      answer: 1,
      explain: [
        'Resampling copies in proportion to weight, so particles with almost no weight get no copies.',
        '0.97 × 200 = 194, so that particle is copied about 194 times. The cloud now rests on one guess, and only the random nudges of the next move can spread it out again. This is what a low effective number of particles warns about.',
        'A heavy particle is the one that explains the reading best. It is copied, not removed.',
        'Fair here means in proportion to weight. Equal copies would ignore the reading.',
      ],
    },
    {
      type: 'challenge',
      title: 'Resample only when it is needed, and bring a lost cloud back',
      prompt: 'Start from the program in this lesson. First, change it so that it carries its weights from step to step, multiplying each weight by the new likelihood, and resamples only when the effective number of particles, 1 / (sum of squared weights), drops below N/2. On the program\'s own eight readings, with 200 particles and seed 2024, at which steps does it resample? Run both versions with seeds 1 to 200 and compare how much the final estimate varies from seed to seed. Then attack starvation. Go back to resampling at every step and track the twelve readings of the default run on this page, where the robot is right of the beacon and ends at 7.62: 2.26, 4.25, 1.89, 3.73, 2.74, 4.90, 6.06, 8.03, 5.41, 7.43, 6.92, 8.63. With 12 particles and seeds 1 to 200, count the runs whose final estimate is left of the beacon. Now replace 5 of the particles after every resampling with fresh ones drawn evenly from −12 m to 12 m, and count again. What do the fresh particles cost when the cloud was healthy?',
      expect: 'Resampling on demand: with seed 2024 the filter resamples once, at step 3, and its eight estimates are 0.64, 3.68, 4.81, 6.08, 6.53, 7.06, 7.57 and 8.14. Over seeds 1 to 200 it resamples exactly once in every run. The final estimate averages 8.10 in both versions, with a standard deviation of 0.034 when resampling at every step and 0.040 on demand. So on these readings, resampling on demand skips seven of the eight resamplings and changes the answer very little. Starvation: with 12 particles, 135 of the 200 runs end left of the beacon. With 5 fresh particles after each resampling, 34 do. The fresh particles rescue most of the lost clouds, but not for free. Among the runs that end on the right, the final estimate has a standard deviation of 1.83 with fresh particles and 1.37 without. On the program\'s own readings with 200 particles it rises from 0.034 to 0.071. A fresh particle that lands near the mirror position on the wrong side fits a distance reading just as well as a good one, and it takes weight it does not deserve. Exact counts depend on the order in which you draw random numbers. These come from drawing the resampling number only when resampling, and from replacing the first 5 particles.',
      hints: ['When you skip resampling, do not reset the weights. When you do resample, reset them all to 1/N.', 'A fresh particle that lands near the robot gets a large weight at the next reading and is copied many times. That is how a lost cloud recovers.'],
    },
  ],

  compare: {
    idea: 'Keep many weighted guesses of a hidden state: move them, weigh them against each reading, and copy the heavy ones.',
    requires: 'A way to imitate how the thing moves, including its randomness, and a way to say how well any guessed position fits a reading. The answer is approximate and changes a little from run to run.',
    sensitivity: 'Sensitive to the number of particles, to how sharp the sensor is compared with the spacing of the particles, and to the amount of random motion assumed.',
    memory: 'O(N): one position and one weight per particle.',
    difficulty: 'moderate',
    difficultyNote: 'The loop is short. Choosing the number of particles and noticing when the cloud has lost the truth take experience.',
    limits: 'It needs many guesses, and far more when several things are tracked at once. If no guess is near the truth, it cannot find its way back on its own.',
    useWhen: 'You are tracking something whose possible positions come in several separate groups, or whose motion or sensor follows no simple straight-line rule.',
  },

  advanced: {
    history: 'Weighting random samples of a hidden state one observation at a time had been tried well before the 1990s, and it kept failing in the same way: after a few steps one sample carried nearly all the weight. In 1993 Neil Gordon, David Salmond and Adrian Smith published the bootstrap filter, which added a resampling step after every weighting so that the samples are redistributed to where the weight is. Their paper showed it tracking a target from bearings alone, a problem on which the extended Kalman filter does poorly. Closely related methods appeared independently in other fields within a few years: Genshiro Kitagawa\'s Monte Carlo filter in statistics, and Michael Isard and Andrew Blake\'s Condensation algorithm in computer vision. The name particle filter came into use during that period. In 1999 Frank Dellaert, Dieter Fox, Wolfram Burgard and Sebastian Thrun applied the method to mobile robots under the name Monte Carlo localization, and it has been a standard tool of robotics since.',
    derivation: 'Let $x_k$ be the hidden state and $z_k$ the reading at step $k$. The exact filter alternates two operations on the belief:\n\n$$p(x_k \\mid z_{1:k-1}) = \\int p(x_k \\mid x_{k-1})\\, p(x_{k-1} \\mid z_{1:k-1})\\, dx_{k-1}, \\qquad p(x_k \\mid z_{1:k}) \\propto p(z_k \\mid x_k)\\, p(x_k \\mid z_{1:k-1}).$$\n\nSuppose $x_{k-1}^{(i)}$, $i = 1, \\dots, N$, are samples of $p(x_{k-1} \\mid z_{1:k-1})$ with equal weights. Drawing $x_k^{(i)} \\sim p(x_k \\mid x_{k-1}^{(i)})$ gives samples of the first expression. Importance sampling with weights\n\n$$w^{(i)} = \\frac{p(z_k \\mid x_k^{(i)})}{\\sum_j p(z_k \\mid x_k^{(j)})}$$\n\nthen gives a weighted sample of the second, so that $\\sum_i w^{(i)} f(x_k^{(i)})$ estimates $\\mathbb{E}[f(x_k) \\mid z_{1:k}]$ for any function $f$. On this page the motion is $x_k = x_{k-1} + v + \\text{noise}$ and the likelihood is $p(z \\mid x) \\propto \\exp\\!\\left(-(z - h(x))^2 / 2r^2\\right)$ with $h(x) = |x|$ for the distance sensor and $h(x) = x$ for the position sensor.\n\nThe effective number of particles is estimated by\n\n$$N_{\\text{eff}} = \\frac{1}{\\sum_i \\left(w^{(i)}\\right)^2},$$\n\nwhich equals $N$ when all weights are equal and 1 when one particle has all the weight.',
    proof: 'Systematic resampling is unbiased, and its copy counts are as even as they can be. Lay the weights end to end on $[0, 1)$, so that particle $i$ owns an interval of length $w_i$. The marks are $(u + j)/N$ for $j = 0, \\dots, N-1$, with $u$ uniform on $[0, 1)$. Scale everything by $N$: the interval has length $N w_i$ and the marks are the points $u + j$, one in every unit interval, all shifted by the same uniform $u$. An interval of length $L$ on the line contains either $\\lfloor L \\rfloor$ or $\\lceil L \\rceil$ of these points, and the probability of the larger count is the fractional part of $L$. Hence the number of copies $c_i$ of particle $i$ satisfies\n\n$$c_i \\in \\{\\lfloor N w_i \\rfloor, \\lceil N w_i \\rceil\\}, \\qquad \\mathbb{E}[c_i] = N w_i.$$\n\nThe second property is what correctness needs: for any function $f$, $\\mathbb{E}\\!\\left[\\tfrac{1}{N}\\sum_i c_i f(x^{(i)})\\right] = \\sum_i w_i f(x^{(i)})$, so the unweighted copies represent the same belief as the weighted particles. The first property is why a group of particles holding less than $1/N$ of the weight in total can vanish in one step, and why a group holding more than that can never vanish while its particles sit next to each other on the ruler.',
    complexityProof: 'Moving and weighing are single passes over $N$ particles. In systematic resampling the marks increase with $j$, so the index of the current particle only ever moves forward: the inner loop advances it at most $N - 1$ times in total over all $N$ marks. The whole resampling is therefore $O(N)$, and so is the step. Multinomial resampling draws $N$ independent uniform numbers and locates each in the running totals by binary search, which costs $O(N \\log N)$.',
    variants: [
      { name: 'Resampling on demand', text: 'Carry the weights forward and resample only when the effective number of particles falls below a threshold. Less random error in quiet stretches.' },
      { name: 'Auxiliary particle filter', text: 'Looks at the next reading before deciding which particles to copy, so that fewer copies are wasted on particles the reading is about to rule out.' },
      { name: 'Rao-Blackwellized particle filter', text: 'Uses particles for the part of the state that needs them and an exact formula, often a Kalman filter, for the rest. FastSLAM is an example.' },
      { name: 'Regularized particle filter', text: 'Draws the new particles from a smoothed version of the weighted cloud instead of making exact copies, which fights the collapse onto a few points.' },
      { name: 'Adaptive number of particles', text: 'Uses many particles while the belief is spread out and few once it has concentrated.' },
      { name: 'Resample-move', text: 'Follows each resampling with a few Markov chain Monte Carlo moves that spread the copies out without changing the belief they represent.' },
    ],
    implementation: 'Keep the logarithms of the weights and subtract the largest before exponentiating, so that precise sensors do not underflow. Compute the estimate before resampling. Use systematic or stratified resampling in preference to independent draws. Monitor the effective number of particles and the largest likelihood: a sudden fall in both is the signature of a cloud that has lost the truth. Use one random stream for the simulated world and another for the filter when testing, so that two filters can be compared on identical data, as this page does.',
    benchmarking: 'Judge a particle filter over many seeds, never one run. Where an exact answer exists, compare with it: the Kalman filter for linear Gaussian models, a fine grid for low-dimensional ones. The tests of this lesson do both. Report the rate of outright failures separately from the typical error, because an average hides them.',
    references: [
      { authors: 'N. J. Gordon, D. J. Salmond and A. F. M. Smith', year: 1993, title: 'Novel approach to nonlinear/non-Gaussian Bayesian state estimation', venue: 'IEE Proceedings F (Radar and Signal Processing) 140(2), 107-113' },
      { authors: 'G. Kitagawa', year: 1996, title: 'Monte Carlo filter and smoother for non-Gaussian nonlinear state space models', venue: 'Journal of Computational and Graphical Statistics 5(1), 1-25' },
      { authors: 'M. Isard and A. Blake', year: 1998, title: 'CONDENSATION: conditional density propagation for visual tracking', venue: 'International Journal of Computer Vision 29(1), 5-28' },
      { authors: 'F. Dellaert, D. Fox, W. Burgard and S. Thrun', year: 1999, title: 'Monte Carlo localization for mobile robots', venue: 'Proceedings of the IEEE International Conference on Robotics and Automation (ICRA)' },
      { authors: 'M. S. Arulampalam, S. Maskell, N. Gordon and T. Clapp', year: 2002, title: 'A tutorial on particle filters for online nonlinear/non-Gaussian Bayesian tracking', venue: 'IEEE Transactions on Signal Processing 50(2), 174-188' },
      { authors: 'S. Thrun, W. Burgard and D. Fox', year: 2005, title: 'Probabilistic Robotics', venue: 'MIT Press' },
    ],
    furtherReading: [
      'A. Doucet, N. de Freitas and N. Gordon (editors), *Sequential Monte Carlo Methods in Practice* (Springer, 2001).',
      'C. Snyder, T. Bengtsson, P. Bickel and J. Anderson, "Obstacles to high-dimensional particle filtering", *Monthly Weather Review* 136 (2008), on why the number of particles must grow so fast with dimension.',
    ],
  },

  tests: [
    { name: 'weights sum to 1 after normalising at every step, and resampling keeps the particle count', input: { scenario: 'two-sides', particles: 150, measNoise: 1, steps: 12, seed: 47 },
      check: (r, c) => {
        if (r.detail.length !== 12 || r.estimates.length !== 13) return `expected 12 steps, got ${r.detail.length}`;
        for (let k = 0; k < 12; k++) {
          const d = r.detail[k];
          let sum = 0;
          for (const w of d.weights) { if (!(w >= 0)) return `step ${k + 1}: a weight is negative or not a number`; sum += w; }
          if (Math.abs(sum - 1) > 1e-12 || Math.abs(r.weightSums[k] - 1) > 1e-12) return `step ${k + 1}: weights sum to ${sum}`;
          if (d.moved.length !== 150 || d.picks.length !== 150 || d.resampled.length !== 150 || r.counts[k + 1] !== 150) return `step ${k + 1}: particle count changed`;
          let mean = 0;
          for (let i = 0; i < 150; i++) mean += d.weights[i] * d.moved[i];
          if (Math.abs(mean - r.estimates[k + 1]) > 1e-12) return `step ${k + 1}: the estimate is not the weighted average`;
        }
        return (c['particles moved'] === 1800 && c['weights computed'] === 1800 && c['particles copied'] === 1800) || `counters ${JSON.stringify(c)}`;
      } },
    { name: 'resampling copies particle i either ⌊N·w⌋ or ⌈N·w⌉ times, and every new particle is an exact copy of an old one', input: { scenario: 'two-sides', particles: 60, measNoise: 0.5, steps: 10, seed: 9 },
      check: (r) => {
        for (let k = 0; k < r.detail.length; k++) {
          const d = r.detail[k], copies = new Array(60).fill(0);
          for (let j = 0; j < 60; j++) {
            const i = d.picks[j];
            if (!Number.isInteger(i) || i < 0 || i >= 60) return `step ${k + 1}: pick ${i} is not a particle`;
            if (d.resampled[j] !== d.moved[i]) return `step ${k + 1}: new particle ${j} is not a copy`;
            if (j > 0 && i < d.picks[j - 1]) return `step ${k + 1}: picks go backwards`;
            copies[i]++;
          }
          for (let i = 0; i < 60; i++) {
            const want = 60 * d.weights[i];
            if (copies[i] < Math.floor(want - 1e-9) || copies[i] > Math.ceil(want + 1e-9)) return `step ${k + 1}: weight ${d.weights[i]} got ${copies[i]} copies`;
          }
          if (r.survivors[k] !== copies.filter((x) => x > 0).length) return `step ${k + 1}: survivor count is wrong`;
        }
        return true;
      } },
    { name: 'the worked example: weights 0.31, 0.07, 0.31, 0.31, estimate 1.77, marks pick particles 1, 3, 4, 4, and the left side falls from 0.38 to 0.07', input: { scenario: 'two-sides', particles: 4, steps: 3, seed: 1 },
      check: () => {
        const xs = [-4.5, -3.5, 4.5, 6.5];
        const w = weigh(xs, 5.5, 1, 'distance');
        const score = (miss) => Math.exp(-0.5 * miss * miss);
        if (score(1).toFixed(2) !== '0.61' || score(2).toFixed(2) !== '0.14' || (3 * score(1) + score(2)).toFixed(2) !== '1.95') return 'scores are not 0.61 and 0.14';
        if (w.map((v) => v.toFixed(2)).join(' ') !== '0.31 0.07 0.31 0.31') return `weights ${w.map((v) => v.toFixed(2)).join(' ')}`;
        const mean = w.reduce((s, v, i) => s + v * xs[i], 0);
        if (mean.toFixed(2) !== '1.77' || (w[0] + w[1]).toFixed(2) !== '0.38' || (w[2] + w[3]).toFixed(2) !== '0.62') return `estimate ${mean}, left share ${w[0] + w[1]}`;
        const picks = systematicResample(w, 0.8);          // first mark at 0.8 / 4 = 0.20
        if (picks.join(',') !== '0,2,3,3') return `picks ${picks.join(',')}`;
        const next = picks.map((i) => xs[i] + 0.5);
        if (next.join(',') !== '-4,5,7,7') return `second round starts at ${next.join(',')}`;
        const w2 = weigh(next, 6, 1, 'distance');
        return w2[0].toFixed(2) === '0.07' || `left share after two readings ${w2[0]}`;
      } },
    { name: 'plain case with 20,000 particles: the estimate stays within 0.08 m of the exact Kalman filter answer at every step', input: { scenario: 'linear', particles: 300, measNoise: 1, steps: 12, seed: 4 },
      check: (r) => {
        const ref = kalmanByPrecision(r.readings, 1);
        for (let k = 0; k <= 12; k++) if (Math.abs(r.exact[k] - ref[k]) > 1e-9) return `the Kalman line drawn on the page is wrong at step ${k}`;
        let worst = 0;
        for (const seed of [4, 5, 6]) {
          const big = run({ scenario: 'linear', particles: 20000, measNoise: 1, steps: 12, seed }, QUIET);
          const exact = kalmanByPrecision(big.readings, 1);
          for (let k = 1; k <= 12; k++) worst = Math.max(worst, Math.abs(big.estimates[k] - exact[k]));
        }
        return worst < 0.08 || `largest gap to the Kalman answer was ${worst.toFixed(4)} m`;
      } },
    { name: 'the gap to the Kalman answer shrinks like 1/√N: 16 times the particles gives about a quarter of the gap', input: { scenario: 'linear', particles: 300, measNoise: 1, steps: 12, seed: 4 },
      check: () => {
        const rms = (n) => {
          let sq = 0, count = 0;
          for (let seed = 201; seed <= 230; seed++) {
            const R = run({ scenario: 'linear', particles: n, measNoise: 1, steps: 12, seed }, QUIET);
            const exact = kalmanByPrecision(R.readings, 1);
            for (let k = 1; k <= 12; k++) { sq += (R.estimates[k] - exact[k]) ** 2; count++; }
          }
          return Math.sqrt(sq / count);
        };
        const ratio = rms(1000) / rms(16000);
        return (ratio > 2.8 && ratio < 6) || `the gap shrank by a factor of ${ratio.toFixed(2)}, expected about 4`;
      } },
    { name: 'hallway with a beacon: 16,000 particles agree with an exact grid computation of the two-humped belief (RMS gap under 0.06 m)', input: { scenario: 'two-sides', particles: 150, measNoise: 1, steps: 12, seed: 47 },
      check: (r) => {
        const here = gridFilterMeans(r.readings, 1);
        // The default run with 150 particles follows the exact belief from one side of the beacon to the other.
        if (!(here[4] < -1 && here[7] > 5 && r.estimates[5] < -1 && r.estimates[8] > 5)) return `exact means ${here.map((v) => v.toFixed(2)).join(' ')}`;
        let sq = 0, count = 0, worst = 0;
        for (const seed of [47, 201, 202, 203, 204, 205, 206, 207]) {
          const R = run({ scenario: 'two-sides', particles: 16000, measNoise: 1, steps: 12, seed }, QUIET);
          const exact = gridFilterMeans(R.readings, 1);
          for (let k = 1; k <= 12; k++) { const gap = Math.abs(R.estimates[k] - exact[k - 1]); sq += gap * gap; count++; worst = Math.max(worst, gap); }
        }
        const rms = Math.sqrt(sq / count);
        return (rms < 0.06 && worst < 0.3) || `RMS gap ${rms.toFixed(4)} m, largest ${worst.toFixed(4)} m`;
      } },
    { name: 'default run: the true side falls to 4% of the weight at step 5, recovers, and the wrong side is empty at step 7', input: { scenario: 'two-sides', particles: 150, measNoise: 1, steps: 12, seed: 47 },
      check: (r) => {
        const ok = r.truth[12] > 7 && pct(r.rightShare[4]) === '4%' && r.rightShare[5] > 0.6 && r.decidedAt === 7 && !r.lost && r.starvedAt === 0 && r.consistent
          && num(Math.abs(r.error)) === '0.50' && r.final.every((x) => x > 0);
        return ok || `right shares ${r.rightShare.map((v) => v.toFixed(2)).join(' ')}, decided at ${r.decidedAt}, error ${r.error}`;
      } },
    { name: 'presets: with 12 particles the same readings starve the cloud at step 3 and it ends 10.21 m off; 20 particles starve, 24 recover', input: { scenario: 'two-sides', particles: 12, measNoise: 1, steps: 12, seed: 47 },
      check: (r) => {
        if (!(r.lost && r.starvedAt === 3 && !r.consistent && num(Math.abs(r.error)) === '10.21' && num(r.spreads[12]) === '0.17' && r.error < 0)) return `lost ${r.lost} at ${r.starvedAt}, error ${r.error}, spread ${r.spreads[12]}`;
        if (!(pct(r.rightShare[2]) === '3%' && r.rightShare[2] < 1 / 12 && r.final.every((x) => x < 0))) return `right share at step 3 was ${r.rightShare[2]}`;
        const at = (n) => run({ scenario: 'two-sides', particles: n, measNoise: 1, steps: 12, seed: 47 }, QUIET);
        const a = at(20), b = at(24), big = at(150);
        if (!(a.lost && a.starvedAt === 3 && !b.lost && !big.lost)) return `20 particles lost: ${a.lost}; 24 particles lost: ${b.lost}`;
        return true;
      } },
    { name: 'changing the number of particles leaves the robot path and the readings untouched', input: { scenario: 'two-sides', particles: 12, measNoise: 1, steps: 12, seed: 47 },
      check: (r) => {
        const other = run({ scenario: 'two-sides', particles: 150, measNoise: 1, steps: 12, seed: 47 }, QUIET);
        const again = run({ scenario: 'two-sides', particles: 12, measNoise: 1, steps: 12, seed: 47 }, QUIET);
        if (!r.truth.every((v, k) => v === other.truth[k]) || !r.readings.every((v, k) => v === other.readings[k])) return 'the world changed with the particle count';
        if (!r.estimates.every((v, k) => v === again.estimates[k])) return 'two runs with the same seed disagree';
        return r.estimates[12] !== other.estimates[12] || 'the particle count had no effect on the estimate';
      } },
    { name: 'plain case presets: 300 particles end 0.02 m from the exact answer; 6 particles end 0.57 m from it and too sure of themselves', input: { scenario: 'linear', particles: 300, measNoise: 1, steps: 12, seed: 4 },
      check: (r) => {
        const few = run({ scenario: 'linear', particles: 6, measNoise: 1, steps: 12, seed: 4 }, QUIET);
        const gaps = r.estimates.map((v, k) => Math.abs(v - r.exact[k]));
        const fewGaps = few.estimates.map((v, k) => Math.abs(v - few.exact[k]));
        const ok = Math.max(...gaps) < 0.1 && num(gaps[12]) === '0.02' && r.consistent && num(fewGaps[12]) === '0.57' && Math.max(...fewGaps) > 1 && !few.consistent && !few.lost;
        return ok || `gaps with 300: ${gaps.map((v) => v.toFixed(2)).join(' ')}; with 6: ${fewGaps.map((v) => v.toFixed(2)).join(' ')}`;
      } },
    { name: 'tryThis: with a sensor error of 0.2, only 10 of 150 particles are copied at step 2 and about 5 are effective', input: { scenario: 'two-sides', particles: 150, measNoise: 0.2, steps: 12, seed: 47 },
      check: (r) => (r.survivors[1] === 10 && r.neffs[2] > 5 && r.neffs[2] < 6 && !r.lost) || `survivors ${r.survivors[1]}, effective ${r.neffs[2]}` },
    { name: 'a cloud that is far from the reading still gets weights that sum to 1, and a left-hand start is tracked through the beacon', input: { scenario: 'two-sides', particles: 150, measNoise: 1, steps: 16, seed: 45 },
      check: (r) => {
        const w = weigh([100, 101, 130], 0, 0.2, 'position');
        if (!(w.every((v) => Number.isFinite(v)) && Math.abs(w[0] + w[1] + w[2] - 1) < 1e-12 && w[0] > w[1] && w[1] >= w[2])) return `far-off weights ${w.join(' ')}`;
        return (r.truth[0] < 0 && r.truth[16] > 0 && !r.lost && r.consistent && Math.abs(r.error) < 1) || `error ${r.error}, lost ${r.lost}`;
      } },
    { name: 'things to try: at step 6 of the default run the right side takes 69% of the weight and only 35 particles are copied', input: { scenario: 'two-sides', particles: 150, measNoise: 1, steps: 12, seed: 47 },
      check: (r) => (pct(r.rightShare[4]) === '4%' && pct(r.rightShare[5]) === '69%' && r.survivors[5] === 35 && r.survivors[1] === 100 && r.decidedAt === 7 && num(Math.abs(r.error)) === '0.50')
        || `right share at step 6 ${pct(r.rightShare[5])}, copied ${r.survivors[5]}, decided at ${r.decidedAt}` },
    { name: 'things to try: with seed 47 the cloud survives with 24, 30, 40 and 50 particles and starves with 20, 35, 46 and 64', input: { scenario: 'two-sides', particles: 35, measNoise: 1, steps: 12, seed: 47 },
      check: (r) => {
        const at = (n) => run({ scenario: 'two-sides', particles: n, measNoise: 1, steps: 12, seed: 47 }, QUIET);
        const got = [20, 24, 30, 35, 40, 46, 50, 64].map((n) => { const q = at(n); return `${n}:${q.lost ? q.starvedAt : 'ok'}`; }).join(' ');
        return (got === '20:3 24:ok 30:ok 35:5 40:ok 46:3 50:ok 64:3' && r.lost && r.starvedAt === 5) || got;
      } },
    { name: 'things to try: the plain case with 6 particles is 1.42 m from the exact line at step 3 and ends 4.1 spreads from the robot', input: { scenario: 'linear', particles: 6, measNoise: 1, steps: 12, seed: 4 },
      check: (r) => {
        const gaps = r.estimates.map((v, k) => Math.abs(v - r.exact[k]));
        const worst = gaps.indexOf(Math.max(...gaps));
        return (worst === 3 && num(gaps[3]) === '1.42' && num(gaps[12]) === '0.57' && num(r.spreads[12]) === '0.28' && num(Math.abs(r.error)) === '1.13' && (Math.abs(r.error) / r.spreads[12]).toFixed(1) === '4.1')
          || `worst gap ${num(gaps[worst])} at step ${worst}, spread ${num(r.spreads[12])}, error ${num(Math.abs(r.error))}`;
      } },
    { name: 'things to try: a sensor error of 0.2 leaves 5.5 effective particles at step 2 and the run ends 0.15 m off', input: { scenario: 'two-sides', particles: 150, measNoise: 0.2, steps: 12, seed: 47 },
      check: (r) => (r.survivors[1] === 10 && r.neffs[2].toFixed(1) === '5.5' && !r.lost && num(Math.abs(r.error)) === '0.15') || `copied ${r.survivors[1]}, effective ${r.neffs[2]}, error ${num(Math.abs(r.error))}` },
  ],
};
