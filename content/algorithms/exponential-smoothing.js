import { makeRng } from '../../js/lib/rng.js';

const M = 12;                         // months in one season
const HISTORY = 48, HORIZON = 12;
const SEASON = [-10, -14, -6, -2, 2, 4, 0, -4, -2, 4, 10, 18];   // units above or below the level, January to December; sums to 0
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUIET = { record: false, count() {}, frame() {} };

const METHODS = {
  simple: { label: 'Simple: a level only', parts: 1, head: 0, start: 1, loop: [2, 3, 4, 5], end: 6 },
  holt: { label: 'Holt: a level and a trend', parts: 2, head: 7, start: 8, loop: [9, 10, 11, 12, 13], end: 14 },
  winters: { label: 'Holt-Winters: level, trend and season', parts: 3, head: 15, start: 16, loop: [17, 18, 19, 20, 21, 22, 23], end: 24 },
};
const PATTERNS = {
  steady: { label: 'Steady', growth: 0, seasonal: false, about: 'steady at 100 units a month' },
  shift: { label: 'Steady, then a jump', growth: 0, seasonal: false, about: 'steady at 100 units a month for the first half of the history and at 130 from then on' },
  trend: { label: 'Growing by 2 a month', growth: 2, seasonal: false, about: 'growth of 2 units every month, from 102 in month 1' },
  season: { label: 'Growing, with a yearly season', growth: 2, seasonal: true, about: 'growth of 2 units every month with a yearly season on top: a peak every December and a dip every February' },
};

// One decimal, with a true minus sign so that negative values read clearly inside a sentence.
// A value such as 112.25, which is exact to two decimals, keeps both, so the worked example reads as it does by hand.
const f1 = (v) => {
  const a = Math.abs(v), exact2 = Math.abs(a * 100 - Math.round(a * 100)) < 1e-7 && Math.abs(a * 10 - Math.round(a * 10)) > 1e-7;
  const s = exact2 ? a.toFixed(2) : a.toFixed(1);
  return v < 0 && Number(s) !== 0 ? `−${s}` : s;
};
const f2 = (v) => { const s = Math.abs(v).toFixed(2); return v < 0 && s !== '0.00' ? `−${s}` : s; };
const tidy = (v) => String(Math.round(v * 100) / 100);
// Pieces of a sum written out in words: "+ 1.7" or "− 0.3", and a negative factor in brackets.
const add = (v) => (v < 0 ? `− ${f1(-v)}` : `+ ${f1(v)}`);
const sub = (v) => (v < 0 ? `+ ${f1(-v)}` : `− ${f1(v)}`);
const par = (v) => (f1(v).startsWith('−') ? `(${f1(v)})` : f1(v));

// Demand in month t (counting from 1) before any randomness is added.
function underlying(pattern, t, months) {
  if (pattern === 'shift') return t > months / 2 ? 130 : 100;
  if (pattern === 'trend') return 100 + 2 * t;
  if (pattern === 'season') return 100 + 2 * t + SEASON[(t - 1) % M];
  return 100;
}
// The history, followed by the HORIZON months that come after it.
function makeSeries(pattern, months, noise, seed) {
  const rng = makeRng(seed);
  const out = [];
  for (let t = 1; t <= months + HORIZON; t++) out.push(Math.max(0, Math.round(underlying(pattern, t, months) + rng.normal(0, noise))));
  return out;
}

// Starting values, and the first month the method forecasts.
function start(method, y) {
  if (method === 'simple') return { level: y[0], trend: 0, season: null, first: 2 };
  if (method === 'holt') return { level: y[1], trend: y[1] - y[0], season: null, first: 3 };
  const mean = (from) => { let sum = 0; for (let i = from; i < from + M; i++) sum += y[i]; return sum / M; };
  const year1 = mean(0), year2 = mean(M);
  const trend = (year2 - year1) / M;
  const level = year1 - (trend * (M + 1)) / 2;        // the straight line through both yearly averages, read off just before month 1
  const season = [];
  for (let i = 0; i < M; i++) season.push(((y[i] - level - trend * (i + 1)) + (y[M + i] - level - trend * (M + i + 1))) / 2);
  return { level, trend, season, first: 1, year1, year2 };
}

// One month of the recurrence: forecast it, then correct each part with the figure that arrived.
function step(method, state, alpha, beta, gamma, t, actual) {
  const i = (t - 1) % M;
  const before = { level: state.level, trend: state.trend, seasonal: method === 'winters' ? state.season[i] : 0 };
  const forecast = before.level + before.trend + before.seasonal;
  const level = alpha * (actual - before.seasonal) + (1 - alpha) * (before.level + before.trend);
  const trend = method === 'simple' ? 0 : beta * (level - before.level) + (1 - beta) * before.trend;
  let seasonal = 0;
  if (method === 'winters') { seasonal = gamma * (actual - level) + (1 - gamma) * before.seasonal; state.season[i] = seasonal; }
  state.level = level;
  state.trend = trend;
  return { t, actual, forecast, error: actual - forecast, before, level, trend, seasonal, next: ahead(method, state, t, 1) };
}

// Forecast for h months after month n.
function ahead(method, state, n, h) {
  return state.level + h * state.trend + (method === 'winters' ? state.season[(n + h - 1) % M] : 0);
}

function run(input, t) {
  const method = input.method;
  const spec = METHODS[method];
  if (!spec) throw new Error('Unknown method.');
  const alpha = Number(input.alpha), beta = Number(input.beta), gamma = Number(input.gamma);
  for (const [name, w] of [['level', alpha], ['trend', beta], ['season', gamma]]) if (!(w > 0 && w <= 1)) throw new Error(`The ${name} weight must be more than 0 and at most 1.`);
  const custom = Array.isArray(input.custom) && input.custom.length > 0;
  let y, future = null, pattern = null, noise = 0;
  if (custom) {
    y = input.custom.slice();
  } else {
    pattern = PATTERNS[input.pattern];
    if (!pattern) throw new Error('Unknown demand pattern.');
    noise = Number(input.noise);
    if (!(noise >= 0)) throw new Error('The size of the random ups and downs cannot be negative.');
    const months = Math.floor(Number(input.months) || HISTORY);
    if (months < 2 * M) throw new Error(`Use at least ${2 * M} months of history.`);
    const all = makeSeries(input.pattern, months, noise, input.seed);
    y = all.slice(0, months);
    future = all.slice(months);
  }
  const n = y.length;
  if (method === 'simple' && n < 2) throw new Error('Give at least two figures: one to start from and one to forecast.');
  if (method === 'holt' && n < 3) throw new Error('A trend needs at least three figures: two to start from and one to forecast.');
  if (method === 'winters' && n < 2 * M) throw new Error(`A yearly season needs two full years of history to start from, which is ${2 * M} monthly figures. There are only ${n}.`);
  const horizon = custom ? Math.min(HORIZON, Math.max(3, n)) : HORIZON;
  const picture = t.record !== false;
  const seasonalMethod = method === 'winters';

  // The whole computation. The frames below narrate it one month at a time.
  const init = start(method, y);
  const state = { level: init.level, trend: init.trend, season: init.season ? init.season.slice() : null };
  const steps = [];
  for (let m = init.first; m <= n; m++) {
    const s = step(method, state, alpha, beta, gamma, m, y[m - 1]);
    if (picture && seasonalMethod) s.season = state.season.slice();
    steps.push(s);
  }
  const forecast = [];
  for (let h = 1; h <= horizon; h++) forecast.push(ahead(method, state, n, h));
  const scoreFrom = n > 2 * M ? 2 * M + 1 : init.first;
  const scored = steps.filter((s) => s.t >= scoreFrom);
  const mae = scored.length ? scored.reduce((sum, s) => sum + Math.abs(s.error), 0) / scored.length : 0;
  let futureMae = null, futureBias = null;
  if (future) {
    futureMae = forecast.reduce((sum, f, h) => sum + Math.abs(future[h] - f), 0) / horizon;
    futureBias = forecast.reduce((sum, f, h) => sum + (future[h] - f), 0) / horizon;
  }

  // Plotting ranges, fixed for the whole run so the picture does not rescale between steps.
  const span = (values, pad, floor) => {
    let lo = Math.min(...values), hi = Math.max(...values);
    const room = Math.max((hi - lo) * pad, floor);
    lo -= room; hi += room;
    return [lo, hi];
  };
  const xMax = n + horizon + 1;
  const yRange = picture ? span([...y, ...(future || []), ...steps.map((s) => s.forecast), ...forecast], 0.1, 2) : [0, 1];
  const trendRange = picture && method === 'holt' ? span([init.trend, ...steps.map((s) => s.trend), pattern ? pattern.growth : 0], 0.12, 0.5) : [0, 1];
  const seasonRange = picture && seasonalMethod ? span([...init.season, ...steps.flatMap((s) => s.season), ...(pattern && pattern.seasonal ? SEASON : [0])], 0.1, 1) : [0, 1];

  // upTo: index of the latest step shown (−1 before any). stage: 'run', 'forecast' or 'truth'.
  const views = (upTo, stage) => {
    const cur = upTo >= 0 ? steps[upTo] : null;
    const reached = cur ? cur.t : init.first - 1;                 // months already forecast and corrected
    const visible = Math.max(reached, seasonalMethod ? 2 * M : init.first - 1);   // months the method has used in any way
    const done = [], waiting = [];
    for (let m = 1; m <= visible; m++) (m <= reached || !seasonalMethod ? done : waiting).push([m, y[m - 1]]);
    const layers = [];
    if (visible > 1) layers.push({ type: 'line', points: y.slice(0, visible).map((v, i) => [i + 1, v]), role: 'ink', width: 1.1, alpha: 0.4 });
    if (waiting.length) layers.push({ type: 'points', points: waiting, role: 'ink', r: 3, hollow: true });
    const made = steps.slice(0, upTo + 1).map((s) => [s.t, s.forecast]);
    if (made.length > 1) layers.push({ type: 'line', points: made, role: 'terracotta', width: 2.2 });
    if (cur && stage === 'run') layers.push({ type: 'segments', segments: [[cur.t, cur.forecast, cur.t, cur.actual]], role: 'compare', width: 3 });
    layers.push({ type: 'points', points: done, role: 'ink', r: 3 });
    if (cur && stage === 'run') {
      layers.push({ type: 'points', points: [[cur.t, cur.forecast]], role: 'terracotta', r: 4 });
      layers.push({ type: 'points', points: [[cur.t, cur.actual]], role: 'current', r: 4.5, ring: true });
      layers.push({ type: 'points', points: [[cur.t + 1, cur.next]], role: 'terracotta', r: 4, hollow: true });
    }
    if (stage !== 'run') {
      const top = yRange[1];
      layers.push({ type: 'segments', segments: [[n + 0.5, yRange[0], n + 0.5, top]], role: 'muted', width: 1.2, dash: true });
      layers.push({ type: 'text', at: [n + 0.5, top], text: 'history ends', role: 'muted', align: 'right', dx: -6, dy: 15 });
      const line = forecast.map((f, h) => [n + h + 1, f]);
      if (stage === 'truth') layers.push({ type: 'segments', segments: line.map(([x, f], h) => [x, f, x, future[h]]), role: 'compare', width: 2 });
      layers.push({ type: 'line', points: line, role: 'terracotta', width: 2.2, dash: true });
      layers.push({ type: 'points', points: line, role: 'terracotta', r: 3.4 });
      if (stage === 'truth') layers.push({ type: 'points', points: future.map((v, h) => [n + h + 1, v]), role: 'ink', r: 3.4, hollow: true });
    }
    const legend = [{ label: 'actual demand', role: 'ink' }, { label: 'forecast, made before the month was seen', role: 'terracotta' }, { label: 'the miss', role: 'compare' }];
    if (stage === 'run' && cur) legend.push({ label: 'month just seen', role: 'current' });
    const main = { kind: 'scene', title: 'Monthly demand and the forecasts', x: [0.5, xMax], y: yRange, aspect: 0.46, axes: { xLabel: 'month', yLabel: 'units sold' }, layers, legend };

    let second;
    if (method === 'simple') {
      // Share of the current level that comes from each past month: the weights that give the method its name.
      const last = Math.max(reached, 1);
      const xs = [], heights = [], roles = {};
      for (let m = 1; m <= last; m++) {
        xs.push(m);
        heights.push(m === 1 ? (1 - alpha) ** (last - 1) : alpha * (1 - alpha) ** (last - m));
        if (m === last) roles[m - 1] = 'current';
      }
      second = { kind: 'scene', title: 'How much of the level comes from each past month', x: [0.5, xMax], y: [0, Math.max(...heights) * 1.15], aspect: 0.2,
        axes: { xLabel: 'month' }, layers: [{ type: 'bars', xs, heights, barWidth: 0.7, role: 'forest', roles }],
        legend: [{ label: 'share of the level', role: 'forest' }, { label: 'newest month', role: 'current' }] };
    } else if (method === 'holt') {
      const trail = [[init.first - 1, init.trend], ...steps.slice(0, upTo + 1).map((s) => [s.t, s.trend])];
      const tl = [];
      if (pattern) tl.push({ type: 'line', points: [[0.5, pattern.growth], [xMax, pattern.growth]], role: 'ink', width: 1.2, dash: true });
      if (trail.length > 1) tl.push({ type: 'line', points: trail, role: 'forest', width: 2 });
      tl.push({ type: 'points', points: [trail[trail.length - 1]], role: 'forest', r: 3.6 });
      second = { kind: 'scene', title: 'Trend: estimated change in demand per month', x: [0.5, xMax], y: trendRange, aspect: 0.2, axes: { xLabel: 'month' }, layers: tl,
        legend: pattern ? [{ label: 'estimated trend', role: 'forest' }, { label: 'true growth per month, never shown to the method', role: 'ink' }] : [{ label: 'estimated trend', role: 'forest' }] };
    } else {
      const values = cur ? cur.season : init.season;
      const roles = {};
      if (cur && stage === 'run') roles[(cur.t - 1) % M] = 'current';
      const sl = [{ type: 'line', points: [[0.5, 0], [M + 0.5, 0]], role: 'muted', width: 1 },
        { type: 'bars', xs: values.map((_, i) => i + 1), heights: values.slice(), barWidth: 0.62, role: 'forest', roles }];
      if (pattern && pattern.seasonal) sl.push({ type: 'points', points: SEASON.map((v, i) => [i + 1, v]), role: 'ink', r: 3.2, hollow: true });
      second = { kind: 'scene', title: 'Seasonal value of each calendar month: units above or below the level', x: [0.5, M + 0.5], y: seasonRange, aspect: 0.22,
        axes: { xLabel: 'month of the year (1 is January, 12 is December)' }, layers: sl,
        legend: [{ label: 'seasonal value learned so far', role: 'forest' }, { label: 'updated this month', role: 'current' },
          ...(pattern && pattern.seasonal ? [{ label: 'true seasonal pattern, never shown to the method', role: 'ink' }] : [])] };
    }
    return [main, second];
  };

  const stateVars = (level, trend, extra) => ({ ...extra, level: f1(level), ...(method === 'simple' ? {} : { trend: f2(trend) }) });
  const wA = tidy(alpha), wA1 = tidy(1 - alpha), wB = tidy(beta), wB1 = tidy(1 - beta), wG = tidy(gamma), wG1 = tidy(1 - gamma);

  t.frame(() => ({ line: spec.head,
    note: custom
      ? `These are the ${n} figures you typed, taken as demand in months 1 to ${n}. Only the first appears so far, because the method meets them one month at a time. Its job is to forecast each month before seeing it, and then the months after the last one.`
      : `A shop records how many units of one product it sells each month. The true pattern behind the figures is ${pattern.about}. On top of that come random ups and downs ${noise > 0 ? `of about ${noise} units, which nobody can predict` : 'of size 0 in this run, so the pattern shows through exactly'}. The method is told none of this. It sees the monthly figures one at a time, forecasts each month before seeing it, and at the end forecasts the ${horizon} months after month ${n}.`,
    views: views(-1, 'run'), vars: { method: method === 'simple' ? 'simple' : method === 'holt' ? 'Holt' : 'Holt-Winters', 'months of history': n } }));

  if (method === 'simple') {
    t.frame(() => ({ line: spec.start,
      note: `Start. Only month 1 is known, when **${y[0]}** units were sold. So the level, the method's running estimate of where demand stands, starts at **${f1(init.level)}**. With no trend and no season in this method, the level is also the forecast for month 2.`,
      views: views(-1, 'run'), vars: stateVars(init.level, 0, {}) }));
  } else if (method === 'holt') {
    t.frame(() => ({ line: spec.start,
      note: `Start from the first two months, when ${y[0]} and ${y[1]} units were sold. The level starts at the later figure, **${f1(init.level)}**. The trend, the estimated change per month, starts at the difference between them: ${y[1]} − ${y[0]} = **${f1(init.trend)}**. The forecast for month 3 is level plus trend: ${f1(init.level + init.trend)}.`,
      views: views(-1, 'run'), vars: stateVars(init.level, init.trend, {}) }));
  } else {
    t.frame(() => ({ line: spec.start,
      note: `A seasonal method needs somewhere to start, and it takes its starting values from the first two years (the hollow dots). Year 1 averaged ${f1(init.year1)} a month and year 2 averaged ${f1(init.year2)}, so demand rose by about (${f1(init.year2)} − ${f1(init.year1)}) / 12 = **${f2(init.trend)}** a month. That is the starting trend. A straight line with that slope through the two yearly averages stands at **${f1(init.level)}** just before month 1. That is the starting level.`,
      views: views(-1, 'run'), vars: stateVars(init.level, init.trend, {}) }));
    const hi = init.season.indexOf(Math.max(...init.season)), lo = init.season.indexOf(Math.min(...init.season));
    t.frame(() => ({ line: spec.start,
      note: `Starting seasonal values: for each calendar month, how far demand sat above or below that straight line, averaged over the two years. ${MONTHS[hi]} comes out highest at ${f1(init.season[hi])} and ${MONTHS[lo]} lowest at ${f1(init.season[lo])}. Averaging two years is rough, because each figure still carries its random part. Now the method goes back to month 1 and works forward, correcting all three parts as it goes.`,
      views: views(-1, 'run'), vars: stateVars(init.level, init.trend, { [`${MONTHS[hi]} season`]: f1(init.season[hi]) }) }));
  }

  steps.forEach((s, idx) => {
    t.count('updates', spec.parts);
    t.frame(() => {
      const b = s.before;
      const miss = Math.abs(s.error) < 0.05 ? 'which is what was forecast' : `so the forecast was ${f1(Math.abs(s.error))} too ${s.error > 0 ? 'low' : 'high'}`;
      let note;
      if (method === 'simple') {
        note = `Month ${s.t}. The forecast, made a month earlier, was the level: **${f1(s.forecast)}**. Actual demand was **${s.actual}**, ${miss}. One month can be a fluke, so the level does not jump to ${s.actual}. It takes ${wA} of the new figure and keeps ${wA1} of the old level: ${wA} × ${s.actual} + ${wA1} × ${f1(b.level)} = **${f1(s.level)}**. That is the forecast for month ${s.t + 1}.`;
      } else if (method === 'holt') {
        const move = s.level - b.level;
        note = `Month ${s.t}. Forecast = level + trend = ${f1(b.level)} ${add(b.trend)} = **${f1(s.forecast)}**. Actual demand was **${s.actual}**, ${miss}. New level: ${wA} × ${s.actual} + ${wA1} × ${f1(s.forecast)} = **${f1(s.level)}**, part of the way from the forecast to the actual. The level has ${move >= 0 ? 'risen' : 'fallen'} by ${f1(Math.abs(move))} since last month. New trend: ${wB} × ${par(move)} + ${wB1} × ${par(b.trend)} = **${f2(s.trend)}**. Blending the latest move with the old trend stops one odd month from swinging it. Forecast for month ${s.t + 1}: ${f1(s.next)}.`;
      } else {
        const name = MONTHS[(s.t - 1) % M];
        const move = s.level - b.level, reading = s.actual - s.level;
        note = `Month ${s.t}, ${name}. Forecast = level + trend + the ${name} seasonal value = ${f1(b.level)} ${add(b.trend)} ${add(b.seasonal)} = **${f1(s.forecast)}**. Actual demand was **${s.actual}**, ${miss}. Take the season out of the actual, ${s.actual} ${sub(b.seasonal)} = ${f1(s.actual - b.seasonal)}, and update the level with it: ${wA} × ${f1(s.actual - b.seasonal)} + ${wA1} × ${f1(b.level + b.trend)} = **${f1(s.level)}**. New trend: ${wB} × ${par(move)} + ${wB1} × ${par(b.trend)} = **${f2(s.trend)}**. What the actual shows beyond the new level, ${s.actual} − ${f1(s.level)} = ${f1(reading)}, is this ${name}'s seasonal reading. New ${name} value: ${wG} × ${par(reading)} + ${wG1} × ${par(b.seasonal)} = **${f1(s.seasonal)}**. It waits a year to be used.`;
      }
      return { line: spec.loop, note, views: views(idx, 'run'),
        vars: stateVars(s.level, s.trend, { month: s.t, forecast: f1(s.forecast), actual: s.actual, miss: f1(s.error), ...(seasonalMethod ? { season: f1(s.seasonal) } : {}) }) };
    });
  });

  const scoreNote = scored.length ? ` Over months ${scoreFrom} to ${n}, its forecasts made one month ahead missed by ${f1(mae)} units on average.` : '';
  const peak = forecast.indexOf(Math.max(...forecast));
  const shapes = ['A flat line: the same number every month', 'A straight line that carries on the latest trend', 'A trend line with the seasonal pattern added to it'];
  t.frame(() => ({ line: spec.end,
    note: (method === 'simple'
      ? `History ends at month ${n}. Simple smoothing keeps only a level and has no sense of direction, so its forecast is the same for every month ahead: **${f1(forecast[0])}**.`
      : method === 'holt'
        ? `History ends at month ${n} with the level at ${f1(state.level)} and the trend at ${f2(state.trend)} a month. The forecast for h months ahead is level + h × trend, a straight line: **${f1(forecast[0])}** next month and ${f1(forecast[horizon - 1])} in ${horizon} months.`
        : `History ends at month ${n} with the level at ${f1(state.level)} and the trend at ${f2(state.trend)} a month. The forecast for h months ahead is level + h × trend + the seasonal value of that calendar month: **${f1(forecast[0])}** next month (${MONTHS[n % M]}), with a high of ${f1(forecast[peak])} in month ${n + peak + 1} (${MONTHS[(n + peak) % M]}).`)
      + scoreNote + (custom ? ' These are your own figures, so there is no record of what happened next to compare the forecast with.' : ''),
    views: views(steps.length - 1, 'forecast'), vars: stateVars(state.level, state.trend, { 'next month': f1(forecast[0]) }) }));

  const floor = 0.8 * noise;           // the average size of a normal random error is about 0.8 of its standard deviation
  if (future) {
    const lacksTrend = method === 'simple' && pattern.growth > 0;
    const lacksSeason = !seasonalMethod && pattern.seasonal;
    const lean = Math.abs(futureBias) > 2 && Math.abs(futureBias) > 0.5 * futureMae ? `, and ran too ${futureBias > 0 ? 'low' : 'high'} by ${f1(Math.abs(futureBias))} overall` : '';
    let why;
    if (lacksTrend && lacksSeason) why = 'Demand kept growing by 2 a month and kept its yearly swing. Simple smoothing models neither, so its flat line falls further behind every month and takes no account of the December peak.';
    else if (lacksTrend) why = 'Demand kept growing by 2 a month, and a flat forecast falls 2 further behind with every month that passes. This method has no way to represent a trend. Holt\'s method adds one.';
    else if (lacksSeason) why = futureBias < -2
      ? 'This method has no part for the calendar. It took the climb toward the December peak for a lasting rise in the level and the trend, and carried that on in a straight line, so it starts the new year too high and misses the dip. Holt-Winters adds a seasonal part.'
      : 'The straight line knows nothing about the calendar, so it misses the December peak and the dip that follows. Holt-Winters adds a seasonal part.';
    else if (futureMae < 0.05) why = 'There was no randomness in this run and nothing in the pattern that the method could not follow, so the forecast is exact.';
    else if (input.pattern === 'shift' && futureBias > 2 && futureMae > 1.6 * floor + 1) why = `The level is still catching up with the jump, so the forecast sits below where demand now stands. A larger weight would have closed the gap sooner.`;
    else if (futureMae <= 1.6 * floor + 1) why = noise > 0
      ? `${input.pattern === 'shift' ? 'The level caught up with the jump well before the history ended' : 'The method has a part for everything in this pattern'}, so what is left is mostly the randomness, and that is close to the best any method could do here.`
      : 'There was no randomness in this run. The small miss is the last trace of the method settling onto the pattern.';
    else why = 'That is more than the randomness alone accounts for. Every estimate made from noisy figures carries an error of its own, and a trend that is slightly wrong is multiplied by the number of months ahead.';
    t.frame(() => ({ line: null,
      note: `Now the next ${horizon} months are revealed (the hollow dots). The forecast missed by **${f1(futureMae)}** units a month on average${lean}. ${why}${noise > 0 ? ` For scale, the random ups and downs alone come to about ${f1(floor)} units a month, and no method can forecast those.` : ''}`,
      views: views(steps.length - 1, 'truth'), vars: { 'average miss': f1(futureMae), 'randomness alone': f1(floor) } }));
  }

  return { method, n, horizon, series: y, future, custom, alpha, beta, gamma, start: init,
    steps: steps.map((s) => ({ t: s.t, actual: s.actual, forecast: s.forecast, error: s.error, level: s.level, trend: s.trend, seasonal: s.seasonal })),
    level: state.level, trend: state.trend, season: state.season ? state.season.slice() : null,
    forecast, mae, scoreFrom, futureMae, futureBias, noiseFloor: floor };
}

const DEFAULTS = { pattern: 'shift', method: 'simple', alpha: 0.3, beta: 0.1, gamma: 0.3, noise: 6, seed: 1, custom: [] };
const quiet = (input) => run({ ...DEFAULTS, ...input }, QUIET);

// The same recurrences in error-correction form, with the starting values worked out a different way.
// Written separately from step() and start() so that the tests have something independent to compare with.
function errorCorrectionForm(method, y, alpha, beta, gamma, horizon) {
  const n = y.length, season = new Array(M).fill(0);
  let level, trend = 0, from;
  if (method === 'simple') { level = y[0]; from = 1; }
  else if (method === 'holt') { level = y[1]; trend = y[1] - y[0]; from = 2; }
  else {
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < M; i++) { sum1 += y[i]; sum2 += y[M + i]; }
    trend = (sum2 - sum1) / (M * M);
    level = sum1 / M - trend * 6.5;
    for (let i = 0; i < M; i++) season[i] = (y[i] + y[M + i]) / 2 - level - trend * (i + 1 + M / 2);
    from = 0;
  }
  const forecasts = [];
  for (let k = from; k < n; k++) {
    const i = k % M;
    const miss = y[k] - (level + trend + season[i]);
    forecasts.push(level + trend + season[i]);
    level = level + trend + alpha * miss;
    if (method !== 'simple') trend += alpha * beta * miss;
    if (method === 'winters') season[i] += gamma * (1 - alpha) * miss;
  }
  const out = [];
  for (let h = 1; h <= horizon; h++) out.push(level + h * trend + season[(n + h - 1) % M]);
  return { level, trend, season, forecasts, ahead: out };
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

export default {
  meta: {
    id: 'exponential-smoothing',
    name: 'Exponential Smoothing',
    aliases: ['Holt-Winters', 'Holt\'s method', 'simple exponential smoothing', 'double exponential smoothing', 'triple exponential smoothing', 'exponentially weighted moving average', 'EWMA', 'exponential moving average', 'EMA', 'demand forecasting'],
    kind: 'algorithm',
    discipline: 'statistics',
    alsoIn: [
      { id: 'optimization', why: 'Inventory and production planning take a demand forecast as their input, and exponential smoothing was developed to supply one for thousands of stocked items at a time.' },
      { id: 'finance', why: 'Risk models estimate how volatile a price is with an exponentially weighted average of its squared changes, so that recent market moves count most.' },
      { id: 'deep-learning', why: 'Optimizers such as momentum and Adam smooth the stream of gradients with the same recurrence, to steady the direction of each training step.' },
    ],
    subfield: 'Time series forecasting',
    family: 'Exponential smoothing methods',
    lab: 'probability-statistics',
    summary: 'Forecasts the next value of a series from a running estimate in which recent figures count most. Extra terms follow a trend and a repeating season.',
    difficulty: 'beginner',
    order: 716,
    paradigms: ['incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n)', average: 'O(n)', worst: 'O(n)', class: 'linear' },
    space: { worst: 'O(1), or O(m) with a season of length m', class: 'constant' },
    tags: {
      problems: ['forecast next month\'s sales', 'how much stock should I order', 'predict demand with a busy season', 'forecast from past data', 'see the direction under bumpy monthly figures', 'find a trend'],
      techniques: ['weighted average', 'level, trend and season', 'smoothing weight', 'one-step-ahead forecast', 'recurrence'],
      applications: ['logistics', 'finance', 'statistics', 'networking', 'signal processing', 'machine learning'],
    },
    prerequisites: ['concept:recurrence'],
  },

  bigIdea: {
    simple: "Exponential smoothing is a way to guess next month's number from the months before. Picture a bakery deciding how many loaves to bake. Last month it sold 120. In the months before that it sold about 100. Which number should it trust? The newest one is the freshest news, but it might be a fluke. The older ones are steadier, but things may have changed since. Exponential smoothing takes a middle path. It keeps one running estimate. Each month it compares the estimate with what really happened, and moves the estimate part of the way toward the real figure. A small move ignores flukes but is slow to notice a real change. A big move reacts fast but gets pushed around by every odd month. Recent months end up counting most, and older months fade bit by bit. Two add-ons make it more useful. One keeps track of whether sales are climbing or falling. The other remembers which months of the year are always busy, like December in a toy shop.",
    when: 'Use it for a series of regular figures, daily, weekly or monthly, when you need forecasts for the next few periods, quickly, perhaps for thousands of items, and the recent past is the best guide you have. Choose the version from what the history shows: a level alone when demand hovers, a trend when it climbs or falls steadily, a season when the same months are busy every year. It uses no outside information such as prices, promotions or the weather. When those drive demand, a model that takes them as inputs, such as [linear regression](#/algorithm/linear-regression), is the better tool.',
    interesting: 'The name describes how the past fades. With a smoothing weight of 0.3, the newest month supplies 30% of the estimate, the month before it 21%, the one before that 14.7%, each 0.7 times the last. No month is ever dropped completely, yet none is stored: a single number, updated in place, carries the whole history. Turn the weight up to 1 and the method becomes "next month will be the same as this month". Turn it down toward 0 and it stops listening to new figures at all.',
    analogy: {
      title: 'Your opinion of a restaurant',
      text: 'You have eaten at a restaurant many times and have a settled opinion of it. Tonight the meal is unusually bad. You do not decide the place is terrible, and you do not ignore the meal either. Your opinion drops a little. If the next few meals are bad too, it keeps dropping until it matches what the kitchen now turns out. Meals from two years ago still colour your view, but faintly. Exponential smoothing treats monthly demand the same way: a standing estimate, nudged by each new figure, with old figures fading.',
      limits: 'An opinion is nudged by feel. The method moves by an exact fraction that you choose, and the choice matters: for a given history some fractions forecast much better than others, and the way to find them is to try values and measure the misses. A diner may also know why a meal was bad, perhaps the chef was away. The method knows no reasons. It sees only numbers, so it cannot tell a one-off from the start of a change until later figures settle the matter.',
    },
  },

  example: {
    setup: 'A café wants to forecast how many cakes it will sell next month. In the last four months it sold 100, 110, 104 and 120. It uses simple smoothing with a weight of one half: each month the estimate moves halfway from where it was toward what was actually sold.',
    steps: [
      'Start. The only figure is month 1, so the estimate is 100. That is the forecast for month 2.',
      'Month 2: 110 were sold. The forecast of 100 was 10 too low. Move halfway: the estimate becomes 105.',
      'Month 3: 104 were sold. The forecast of 105 was 1 too high. Move halfway: the estimate becomes 104.5.',
      'Month 4: 120 were sold. The forecast of 104.5 was 15.5 too low. Move halfway: the estimate becomes 112.25.',
      'The forecast for month 5 is the estimate as it now stands, 112.25.',
    ],
    result: 'The forecast is 112.25. A plain average of the four months would give 108.5, and repeating the last month would give 120. The smoothed forecast lies between them, nearer the recent months. Unpack it and the last month supplies half, the month before a quarter, and the two earliest an eighth each: 60 + 26 + 13.75 + 12.5 = 112.25.',
    tryInput: { custom: [100, 110, 104, 120], method: 'simple', alpha: 0.5 },
  },

  terms: [
    { term: 'Time series', meaning: 'A list of figures recorded at regular intervals, in order, such as sales for each month.' },
    { term: 'Forecast', meaning: 'A calculated guess at a figure that has not happened yet.' },
    { term: 'Level', meaning: 'The method\'s running estimate of where the series stands right now, with the random bumps evened out.' },
    { term: 'Smoothing weight', meaning: 'A number between 0 and 1 that says how far the estimate moves toward each new figure. It is usually written α, the Greek letter alpha.' },
    { term: 'Miss', meaning: 'The actual figure minus the forecast. Statisticians call it the forecast error.' },
    { term: 'Trend', meaning: 'The steady change from one period to the next, such as sales rising by 2 units every month.' },
    { term: 'Season', meaning: 'A pattern that repeats over a fixed stretch of time, such as a peak every December.' },
    { term: 'Seasonal value', meaning: 'How far above or below the level a particular month usually sits. A toy shop\'s December value is large and positive.' },
    { term: 'Horizon', meaning: 'How far ahead a forecast reaches. Next month is a horizon of 1.' },
  ],

  takeaway: 'Keep a running estimate, move it part of the way toward each new figure, and add a trend and a seasonal pattern when the history shows them.',

  viz: {
    describe: 'Two charts. The main chart plots units sold against the month. Actual demand is shown as ink dots joined by a faint line, and the forecast made one month before each figure as a terracotta line. In the current month a thick ochre bar joins the forecast to the actual, showing the miss, and a hollow terracotta dot marks the forecast for the month after. At the end a dashed vertical line marks where history ends, the forecast for the months ahead is drawn as a dashed terracotta line, and the figures that actually followed appear as hollow ink dots. The second chart depends on the method. For simple smoothing it is a bar for each past month showing its share of the current level. For Holt\'s method it is the estimated trend month by month, with a dashed line at the true growth. For Holt-Winters it is twelve bars, one seasonal value per calendar month, with hollow dots at the true seasonal pattern.',
    inputs: [
      { id: 'pattern', type: 'select', label: 'Demand pattern', options: Object.entries(PATTERNS).map(([value, p]) => ({ value, label: p.label })), default: 'shift' },
      { id: 'method', type: 'select', label: 'Method', options: Object.entries(METHODS).map(([value, m]) => ({ value, label: m.label })), default: 'simple' },
      { id: 'alpha', type: 'range', label: 'Level weight α', min: 0.05, max: 1, step: 0.05, default: 0.3,
        help: 'How far the level moves toward each new figure.' },
      { id: 'beta', type: 'range', label: 'Trend weight β', min: 0.05, max: 1, step: 0.05, default: 0.1,
        help: 'Used by Holt and Holt-Winters.' },
      { id: 'gamma', type: 'range', label: 'Season weight γ', min: 0.05, max: 1, step: 0.05, default: 0.3,
        help: 'Used by Holt-Winters only.' },
      { id: 'noise', type: 'range', label: 'Random ups and downs', min: 0, max: 20, step: 1, default: 6,
        help: 'Typical size, in units, of the unpredictable part of each month. 0 shows the pattern exactly.' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 1 },
      { id: 'custom', type: 'list', label: 'Your own monthly figures (optional)', default: [], maxLength: 72, min: 0, max: 100000 },
    ],
    presets: [
      { label: 'Four months by hand', values: { custom: [100, 110, 104, 120], method: 'simple', alpha: 0.5 } },
      { label: 'A jump in demand, slow weight', values: { pattern: 'shift', method: 'simple', alpha: 0.1, noise: 6, seed: 1, custom: [] } },
      { label: 'A jump in demand, fast weight', values: { pattern: 'shift', method: 'simple', alpha: 0.8, noise: 6, seed: 1, custom: [] } },
      { label: 'Growth, simple smoothing', values: { pattern: 'trend', method: 'simple', alpha: 0.3, noise: 6, seed: 1, custom: [] } },
      { label: 'Growth, with a trend', values: { pattern: 'trend', method: 'holt', alpha: 0.3, beta: 0.1, noise: 6, seed: 1, custom: [] } },
      { label: 'Season, trend only', values: { pattern: 'season', method: 'holt', alpha: 0.3, beta: 0.1, noise: 6, seed: 1, custom: [] } },
      { label: 'Season, Holt-Winters', values: { pattern: 'season', method: 'winters', alpha: 0.3, beta: 0.1, gamma: 0.3, noise: 6, seed: 1, custom: [] } },
    ],
    tryThis: [
      'Load "A jump in demand, slow weight". Demand jumps from about 100 to about 130 at month 25. With α = 0.1 the forecast creeps upward and is still about 8 units short a year later. Now load "A jump in demand, fast weight". With α = 0.8 it has caught up within three months, but from then on it zigzags after every random bump.',
      'Set the pattern to Steady and compare α = 0.1 with α = 0.8, reading the average miss in the output panel. On steady demand the slow weight does better, 4.5 against 5.2, because there is nothing to react to and reacting only copies noise. After the jump it was the other way round. No weight is best for every series.',
      'Load "Growth, simple smoothing" and step to the end. Every forecast is too low, and the flat forecast for the year ahead misses by about 19 units a month. Load "Growth, with a trend": the figures are the same, and the miss falls to about 5, which is roughly what the randomness alone accounts for.',
      'Load "Season, trend only". The forecast is a month late for every December peak, and at the end it mistakes the year-end climb for lasting growth and forecasts too high for the whole year ahead. Then load "Season, Holt-Winters" and watch the twelve bars in the lower chart settle toward the hollow dots, the true seasonal pattern that the method was never shown. The miss for the year ahead falls from about 14 units a month to about 5.',
      'Keep "Season, Holt-Winters" and set the random ups and downs to 0. The forecast is now exact for all twelve months. Switch the method to Holt, then to Simple, to see what each one cannot represent.',
    ],
    run,
    report: (r, c) => {
      const name = r.method === 'simple' ? 'Simple smoothing (level only)' : r.method === 'holt' ? 'Holt\'s method (level and trend)' : 'Holt-Winters, additive (level, trend and season)';
      const weights = r.method === 'simple' ? `α = ${tidy(r.alpha)}` : r.method === 'holt' ? `α = ${tidy(r.alpha)}, β = ${tidy(r.beta)}` : `α = ${tidy(r.alpha)}, β = ${tidy(r.beta)}, γ = ${tidy(r.gamma)}`;
      const lines = [`${name}, ${weights}, on ${r.n} months of history.`,
        `Forecast for the next ${r.horizon} months: ${r.forecast.map((f) => f.toFixed(1)).join(', ')}.`,
        `Forecasts made one month ahead missed by ${r.mae.toFixed(1)} units on average over months ${r.scoreFrom} to ${r.n}.`];
      if (r.futureMae !== null) lines.push(`Against what happened next, the forecast missed by ${r.futureMae.toFixed(1)} units a month on average. Randomness alone accounts for about ${r.noiseFloor.toFixed(1)}.`);
      lines.push(`${c.updates || 0} smoothing updates.`);
      return lines.join('\n');
    },
    experiment: {
      title: 'Work as the history grows',
      note: 'Each point is a real run on a seasonal series of that length. One update means one part of the estimate corrected once. Simple smoothing corrects the level each month from month 2. Holt\'s method corrects the level and the trend each month from month 3. Holt-Winters corrects the level, the trend and one seasonal value every month. All three grow in a straight line: a history ten times as long costs ten times as much, and none of them ever looks back at old figures.',
      metric: 'updates',
      metricLabel: 'Smoothing updates',
      sizeLabel: 'Months of history (n)',
      sizes: [24, 48, 96, 192, 384, 768],
      variants: [{ id: 'simple', label: 'Simple' }, { id: 'holt', label: 'Holt (with trend)' }, { id: 'winters', label: 'Holt-Winters (with trend and season)' }],
      input: (n, variant, seed) => ({ pattern: 'season', method: variant, months: n, noise: 6, seed, custom: [] }),
      theory: [
        { label: 'n − 1', fn: (n) => n - 1, variant: 'simple' },
        { label: '2(n − 2)', fn: (n) => 2 * (n - 2), variant: 'holt' },
        { label: '3n', fn: (n) => 3 * n, variant: 'winters' },
      ],
    },
  },

  logic: {
    intuition: 'A forecast starts from an estimate of where the series stands now. The average of all history is steady but stale. The latest figure is fresh but noisy. Simple smoothing blends the two with one dial, α. Each month the new figure gets weight α, and everything the estimate already held is scaled down by 1 − α. Repeat that and the weight on a figure from k months ago is α(1 − α)^k: a geometric fade, which is the "exponential" in the name. Holt\'s method runs a second estimate alongside, the change per month, and smooths it in the same way from the moves of the level. Holt-Winters adds one more estimate for each position in the season, each corrected only when its month comes round. Every part makes the same move: compare with what happened, and correct by a fraction.',
    steps: [
      'Look at the history and choose the parts to model: a level alone, a level and a trend, or a level, a trend and a season of known length $m$.',
      'Choose the smoothing weights $\\alpha$, $\\beta$ and $\\gamma$, each between 0 and 1, and set starting values for every part.',
      'Forecast the next period from the current parts: $\\hat y_t = \\ell_{t-1} + b_{t-1} + s_{t-m}$, leaving out any part the method does not have.',
      'Observe the actual figure $y_t$.',
      'Update the level: $\\ell_t = \\alpha\\,(y_t - s_{t-m}) + (1-\\alpha)(\\ell_{t-1} + b_{t-1})$.',
      'Update the trend from the move of the level: $b_t = \\beta\\,(\\ell_t - \\ell_{t-1}) + (1-\\beta)\\,b_{t-1}$.',
      'Update this period\'s seasonal value: $s_t = \\gamma\\,(y_t - \\ell_t) + (1-\\gamma)\\,s_{t-m}$.',
      'Repeat from step 3 until the history is used up. Then forecast $h$ periods ahead with $\\hat y_{n+h} = \\ell_n + h\\,b_n + s_{n+h-m}$.',
    ],
    pseudocode: [
      'simple_smoothing(y, α):',
      '  level ← y[1]',
      '  for t = 2 .. n:',
      '    forecast ← level',
      '    miss ← y[t] − forecast',
      '    level ← α × y[t] + (1 − α) × level',
      '  return level as the forecast for every month ahead',
      'holt(y, α, β):',
      '  level ← y[2],  trend ← y[2] − y[1]',
      '  for t = 3 .. n:',
      '    forecast ← level + trend',
      '    new_level ← α × y[t] + (1 − α) × forecast',
      '    trend ← β × (new_level − level) + (1 − β) × trend',
      '    level ← new_level',
      '  return level + h × trend as the forecast h months ahead',
      'holt_winters(y, α, β, γ, m):',
      '  level, trend, season[1..m] ← starting values from the first two seasons',
      '  for t = 1 .. n:',
      '    s ← season[t mod m]',
      '    forecast ← level + trend + s',
      '    new_level ← α × (y[t] − s) + (1 − α) × (level + trend)',
      '    trend ← β × (new_level − level) + (1 − β) × trend',
      '    season[t mod m] ← γ × (y[t] − new_level) + (1 − γ) × s',
      '    level ← new_level',
      '  return level + h × trend + season[(n + h) mod m] as the forecast h months ahead',
    ],
    decisions: [
      { title: 'How large should the weights be?', text: 'A weight is a trade between steadiness and speed. The usual way to choose is to try values and keep the ones whose one-step-ahead forecasts would have missed least over the history, measured by the sum of squared misses. Then check the choice on figures that were held back, because weights tuned to the past always look better there than they will perform.' },
      { title: 'Which parts to include?', text: 'Plot the history first. Leave out a trend the figures do not show: an estimated trend that is really noise gets multiplied by the horizon. Include a season only with at least two full seasons of history, since one year cannot separate a seasonal peak from a one-off.' },
      { title: 'Should the season add or multiply?', text: 'This page uses the additive form, in which December is worth a fixed number of units above the level. If the seasonal swings grow as the level grows, the multiplicative form, in which December is a fixed percentage above the level, fits better.' },
      { title: 'How to start?', text: 'Every part needs a starting value. This page starts the simple level at the first figure, Holt\'s level and trend from the first two figures, and Holt-Winters from a straight line through the averages of the first two years, with each month\'s average distance from that line as its seasonal value. With a long history the start is soon forgotten. With a short one it matters, and software usually fits the starting values together with the weights.' },
      { title: 'How far ahead?', text: 'A straight trend line carried on for ever is rarely believable. For longer horizons a damped trend, which flattens out gradually, usually forecasts better.' },
    ],
    invariants: [
      'After month t, the simple level is a weighted average of the figures so far, with weight α(1 − α)^k on the figure from k months ago and (1 − α)^(t−1) on the first. The weights are positive and sum to 1.',
      'Each forecast is made from figures of earlier months only. The figure for month t is used after the forecast for month t has been recorded.',
      'In one step of Holt-Winters only the seasonal value of the current calendar month changes. The other eleven wait for their turn.',
    ],
    edgeCases: [
      'α = 1: the level is always the latest figure, so the forecast is "the same as last month".',
      'α close to 0: the level barely moves from its starting value, however much the figures change.',
      'A constant series: every version forecasts it exactly, whatever the weights.',
      'A single freak month: the simple level absorbs a share α of it, and that share then fades by a factor 1 − α each month. With a season, the freak value also sits in that month\'s seasonal value and returns a year later.',
      'A steady trend fed to simple smoothing: the forecast settles at a fixed distance behind, equal to the growth per month divided by α.',
      'Fewer than two full seasons of history: there is nothing to start the seasonal values from, and the page says so instead of guessing.',
      'Demand that is zero in most periods, as for a slow-moving spare part: smoothing the raw series works badly, and Croston\'s method, which smooths the sizes of the orders and the gaps between them separately, is the usual choice.',
    ],
    correctness: 'No forecast can be proved right. What can be proved is what the recurrence computes, and for which series it is the best available. Unrolling the simple recurrence shows the level is a weighted average of past figures with positive weights that sum to 1, so it always lies between the smallest and largest figure seen, and it reproduces a constant series exactly. Holt\'s method reproduces any straight line exactly, and Holt-Winters reproduces any straight line plus a fixed repeating pattern: in both cases every miss is zero, so no part is ever corrected away from the truth. For noisy series, John Muth showed in 1960 that simple smoothing gives the forecast with the smallest mean squared error when the level takes random steps and is observed with noise, with α set by how large the steps are compared with the noise. Outside such models the method is a rule of thumb, and its quality has to be measured on held-back figures and not assumed.',
    mistakes: [
      'Measuring the miss after the level has been updated with the same figure. The forecasts then look far better than they are.',
      'Swapping the weights, so that α multiplies the old level and 1 − α the new figure. A "fast" weight of 0.9 then behaves like a slow one.',
      'Using simple smoothing on a series with a trend and wondering why every forecast is too low.',
      'Reading the seasonal value for the wrong month, such as last month\'s in place of the same month a year ago.',
      'Choosing the weights that fit the history best and quoting that fit as the expected accuracy.',
      'Feeding the method a history with missing months, which shifts every later figure into the wrong season.',
    ],
  },

  code: {
    sample: {
      input: 'Twelve quarters of sales with growth and a yearly pattern of four quarters. The three methods each forecast the quarters that follow.',
      expected: 'simple, every quarter ahead: 135.71\nwith a trend, next 4 quarters: 158.93, 164.19, 169.45, 174.71\nwith a trend and a season, next 4 quarters: 113.52, 136.55, 150.01, 172.98',
    },
    python: {
      source: `def simple(y, alpha):
    """A level only. Returns the forecast, which is the same for every period ahead."""
    level = y[0]
    for actual in y[1:]:
        level = alpha * actual + (1 - alpha) * level
    return level


def holt(y, alpha, beta, ahead):
    """A level and a trend. Returns forecasts for 1 to ahead periods ahead."""
    level, trend = y[1], y[1] - y[0]
    for actual in y[2:]:
        forecast = level + trend
        new_level = alpha * actual + (1 - alpha) * forecast
        trend = beta * (new_level - level) + (1 - beta) * trend
        level = new_level
    return [level + h * trend for h in range(1, ahead + 1)]


def holt_winters(y, alpha, beta, gamma, m, ahead):
    """A level, a trend and an additive season of length m."""
    year1, year2 = sum(y[:m]) / m, sum(y[m:2 * m]) / m
    trend = (year2 - year1) / m
    level = year1 - trend * (m + 1) / 2
    season = []
    for i in range(m):
        first = y[i] - level - trend * (i + 1)
        second = y[m + i] - level - trend * (m + i + 1)
        season.append((first + second) / 2)
    for t, actual in enumerate(y):
        i = t % m
        new_level = alpha * (actual - season[i]) + (1 - alpha) * (level + trend)
        trend = beta * (new_level - level) + (1 - beta) * trend
        season[i] = gamma * (actual - new_level) + (1 - gamma) * season[i]
        level = new_level
    n = len(y)
    return [level + h * trend + season[(n + h - 1) % m] for h in range(1, ahead + 1)]


def show(values):
    return ", ".join(f"{v:.2f}" for v in values)


sales = [80, 98, 115, 137, 88, 117, 125, 152, 102, 123, 140, 160]
print("simple, every quarter ahead: " + show([simple(sales, 0.3)]))
print("with a trend, next 4 quarters: " + show(holt(sales, 0.3, 0.2, 4)))
print("with a trend and a season, next 4 quarters: " + show(holt_winters(sales, 0.3, 0.2, 0.4, 4, 4)))`,
      notes: [
        { line: 5, text: 'The whole of simple smoothing. The new figure gets weight alpha, and everything the level already held is scaled by 1 − alpha.' },
        { line: 13, text: 'The forecast is made before the actual figure is used. Measuring misses against this value, and not against the updated level, is what keeps the accuracy figures honest.' },
        { line: 15, text: 'The trend is smoothed in the same way as the level, from how far the level has just moved.' },
        { line: 24, text: 'The starting level is read off a straight line through the two yearly averages, at the point just before the first period.' },
        { line: 32, text: 'The season is taken out of the actual figure before the level is updated, so a busy quarter is not mistaken for a rise in the level.' },
        { line: 34, text: 'Only this quarter\'s seasonal value changes. It will next be used, and corrected, a year from now.' },
      ],
    },
    javascript: {
      source: `// A level only. Returns the forecast, which is the same for every period ahead.
function simple(y, alpha) {
  let level = y[0];
  for (const actual of y.slice(1)) level = alpha * actual + (1 - alpha) * level;
  return level;
}

// A level and a trend. Returns forecasts for 1 to ahead periods ahead.
function holt(y, alpha, beta, ahead) {
  let level = y[1], trend = y[1] - y[0];
  for (const actual of y.slice(2)) {
    const forecast = level + trend;
    const newLevel = alpha * actual + (1 - alpha) * forecast;
    trend = beta * (newLevel - level) + (1 - beta) * trend;
    level = newLevel;
  }
  return Array.from({ length: ahead }, (_, k) => level + (k + 1) * trend);
}

// A level, a trend and an additive season of length m.
function holtWinters(y, alpha, beta, gamma, m, ahead) {
  const sum = (list) => list.reduce((a, b) => a + b, 0);
  const year1 = sum(y.slice(0, m)) / m, year2 = sum(y.slice(m, 2 * m)) / m;
  let trend = (year2 - year1) / m;
  let level = year1 - trend * (m + 1) / 2;
  const season = [];
  for (let i = 0; i < m; i++) {
    const first = y[i] - level - trend * (i + 1);
    const second = y[m + i] - level - trend * (m + i + 1);
    season.push((first + second) / 2);
  }
  y.forEach((actual, t) => {
    const i = t % m;
    const newLevel = alpha * (actual - season[i]) + (1 - alpha) * (level + trend);
    trend = beta * (newLevel - level) + (1 - beta) * trend;
    season[i] = gamma * (actual - newLevel) + (1 - gamma) * season[i];
    level = newLevel;
  });
  const n = y.length;
  return Array.from({ length: ahead }, (_, k) => level + (k + 1) * trend + season[(n + k) % m]);
}

const show = (values) => values.map((v) => v.toFixed(2)).join(", ");

const sales = [80, 98, 115, 137, 88, 117, 125, 152, 102, 123, 140, 160];
console.log("simple, every quarter ahead: " + show([simple(sales, 0.3)]));
console.log("with a trend, next 4 quarters: " + show(holt(sales, 0.3, 0.2, 4)));
console.log("with a trend and a season, next 4 quarters: " + show(holtWinters(sales, 0.3, 0.2, 0.4, 4, 4)));`,
    },
    cpp: {
      source: `#include <cstdio>
#include <numeric>
#include <string>
#include <vector>

using Series = std::vector<double>;

// A level only. Returns the forecast, which is the same for every period ahead.
double simple(const Series& y, double alpha) {
    double level = y[0];
    for (std::size_t t = 1; t < y.size(); ++t) level = alpha * y[t] + (1 - alpha) * level;
    return level;
}

// A level and a trend. Returns forecasts for 1 to ahead periods ahead.
Series holt(const Series& y, double alpha, double beta, int ahead) {
    double level = y[1], trend = y[1] - y[0];
    for (std::size_t t = 2; t < y.size(); ++t) {
        double forecast = level + trend;
        double new_level = alpha * y[t] + (1 - alpha) * forecast;
        trend = beta * (new_level - level) + (1 - beta) * trend;
        level = new_level;
    }
    Series out;
    for (int h = 1; h <= ahead; ++h) out.push_back(level + h * trend);
    return out;
}

// A level, a trend and an additive season of length m.
Series holt_winters(const Series& y, double alpha, double beta, double gamma, int m, int ahead) {
    double year1 = std::accumulate(y.begin(), y.begin() + m, 0.0) / m;
    double year2 = std::accumulate(y.begin() + m, y.begin() + 2 * m, 0.0) / m;
    double trend = (year2 - year1) / m;
    double level = year1 - trend * (m + 1) / 2;
    Series season;
    for (int i = 0; i < m; ++i) {
        double first = y[i] - level - trend * (i + 1);
        double second = y[m + i] - level - trend * (m + i + 1);
        season.push_back((first + second) / 2);
    }
    int n = static_cast<int>(y.size());
    for (int t = 0; t < n; ++t) {
        int i = t % m;
        double new_level = alpha * (y[t] - season[i]) + (1 - alpha) * (level + trend);
        trend = beta * (new_level - level) + (1 - beta) * trend;
        season[i] = gamma * (y[t] - new_level) + (1 - gamma) * season[i];
        level = new_level;
    }
    Series out;
    for (int h = 1; h <= ahead; ++h) out.push_back(level + h * trend + season[(n + h - 1) % m]);
    return out;
}

void show(const std::string& label, const Series& values) {
    std::printf("%s", label.c_str());
    for (std::size_t i = 0; i < values.size(); ++i) std::printf("%s%.2f", i ? ", " : "", values[i]);
    std::printf("\\n");
}

int main() {
    const Series sales = {80, 98, 115, 137, 88, 117, 125, 152, 102, 123, 140, 160};
    show("simple, every quarter ahead: ", {simple(sales, 0.3)});
    show("with a trend, next 4 quarters: ", holt(sales, 0.3, 0.2, 4));
    show("with a trend and a season, next 4 quarters: ", holt_winters(sales, 0.3, 0.2, 0.4, 4, 4));
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One pass over the history with a fixed amount of arithmetic per figure, and a handful of numbers of memory. A new figure is absorbed in constant time without revisiting old ones, which is why the method can run for thousands of products every night. Choosing the weights costs more than using them.',
    cases: [
      { case: 'Simple smoothing over n figures', time: 'O(n)', when: 'One update per figure: n − 1 in all, since the first figure is the starting level.' },
      { case: 'Holt\'s method over n figures', time: 'O(n)', when: 'Two updates per figure, level and trend, from the third figure on.' },
      { case: 'Holt-Winters over n figures', time: 'O(n)', when: 'Three updates per figure: level, trend and one seasonal value.' },
      { case: 'One new figure arrives', time: 'O(1)', when: 'Always. Only the current parts are needed, not the history.' },
      { case: 'Choosing weights by trying g values of each', time: 'O(g³ n) for Holt-Winters', when: 'Every combination of the three weights is run over the whole history. A numerical optimizer needs far fewer runs.' },
    ],
    space: 'O(1) for simple smoothing and Holt\'s method: a level, and a trend. O(m) for Holt-Winters with a season of length m. The page keeps the history only to draw it.',
    memory: 'The current parts summarize everything the method has learned, so the raw history can be discarded once the weights are fixed.',
    tradeoffs: 'Larger weights adapt faster to real changes and copy more of the noise. More parts fit richer patterns and need more history and more weights to choose. The method is fast and explainable because it ignores everything except the past of the series itself.',
    assumptions: [
      'Figures arrive at regular intervals with none missing.',
      'The season length m is known and fixed.',
      'The weights are given. Fitting them is a separate cost.',
      'Counts on this page are of smoothing updates: one part of the estimate corrected once.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Sudden breaks: a new competitor or a price change shows up in the forecast only after it has shown up in several months of figures.',
      'Demand driven by known outside causes such as promotions, which the method cannot be told about.',
      'Long horizons, where a trend carried on in a straight line drifts away from anything plausible.',
      'Series with more than one season at once, such as hourly data with a daily and a weekly rhythm.',
      'Short histories, where the starting values decide the forecast.',
    ],
    pitfalls: [
      'Weights tuned on the history flatter themselves. Judge accuracy on figures the tuning never saw.',
      'A freak month contaminates the level for a while and its seasonal value for a year.',
      'The seasonal values can drift so that they no longer average to zero, with the level drifting the other way to compensate. Careful implementations renormalize them.',
      'With the additive form, a forecast for a small or falling series can go below zero.',
    ],
    misunderstandings: [
      "\"The smoothed line is the true demand with the noise removed.\" It is an estimate, and it always runs a little behind real changes. A smaller weight gives a smoother line that runs further behind.",
      "\"A larger weight is more accurate because it uses the newest information.\" It also copies more of the newest noise. Which matters more depends on the series, and can only be found by measuring.",
      "\"Exponential smoothing assumes demand grows exponentially.\" The name refers to the weights on past figures, which shrink by a constant factor for each month of age. It says nothing about how demand grows.",
      "\"Holt-Winters works out the season by itself.\" It learns the shape of the season. Its length, 12 for monthly figures with a yearly pattern, has to be supplied.",
      "\"A forecast for twelve months ahead is as trustworthy as one for next month.\" The uncertainty grows with every month ahead. The flat or straight line is the centre of a range that keeps widening.",
    ],
    constraints: [
      'A seasonal forecast needs at least two full seasons of history, and more is better.',
      'The plain recurrences give a single number. A range around the forecast needs a statistical model on top, such as the state space form.',
    ],
    alternatives: [
      { name: 'Moving average', when: 'You want the plainest possible rule. It gives the last k figures equal weight and everything older none, which reacts in jumps where smoothing fades.' },
      { id: 'linear-regression', name: 'Linear Regression', when: 'Demand depends on things you can measure or plan, such as price or advertising, or the trend is steady enough for one straight line through all the history.' },
      { name: 'ARIMA models', when: 'The series has correlations from month to month that a level, trend and season do not capture, and there is enough history to estimate them.' },
      { id: 'kalman-filter', name: 'Kalman Filter', when: 'You want the weights to follow from a model of the noise, a measure of uncertainty at every step, or irregular and missing observations handled properly.' },
      { name: 'Naive and seasonal naive forecasts', when: 'As a yardstick. "Same as last month" and "same as this month last year" cost nothing, and a method that cannot beat them is not worth running.' },
    ],
    comparison: {
      columns: ['', 'Simple', 'Holt', 'Holt-Winters'],
      rows: [
        ['Keeps track of', 'A level', 'A level and a trend', 'A level, a trend and one value per season position'],
        ['Forecast for the months ahead', 'A flat line', 'A straight line', 'A straight line plus the repeating pattern'],
        ['Weights to choose', 'α', 'α and β', 'α, β, γ and the season length'],
        ['History needed to start', 'One figure', 'Two figures', 'Two full seasons'],
        ['Reproduces exactly', 'A constant', 'Any straight line', 'Any straight line plus a fixed season'],
      ],
    },
  },

  applications: [
    { title: 'Stock and demand planning', status: 'established', text: 'This is what the method was made for. Robert Brown\'s 1959 book presented it as a way to forecast demand for each of the thousands of items in an inventory, cheaply enough to redo every period. Forecasting and inventory software still offers it as a standard method.' },
    { title: 'Watching a process for drift', status: 'established', text: 'Quality control uses the exponentially weighted moving average chart, introduced by S. W. Roberts in 1959. A smoothed average of measurements is plotted against control limits, and because it accumulates small deviations it reveals a slow drift sooner than a chart of single readings.' },
    { title: 'Timers on the internet', status: 'established', text: 'TCP, one of the core protocols of the internet, keeps an exponentially weighted average of how long acknowledgements take to come back and uses it to decide how long to wait before sending data again.' },
    { title: 'Training neural networks', status: 'established', text: 'Optimizers such as momentum and Adam keep exponentially weighted averages of recent gradients. The smoothing steadies the direction of each step when individual gradients are noisy.' },
    { title: 'Staffing a call centre', status: 'illustrative', text: 'Calls per day rise through the year and peak on Mondays. A seasonal forecast with a season of seven days gives the number of agents to schedule for each day of next week.' },
  ],

  connections: [
    { to: 'linear-regression', type: 'same-problem', why: 'Both forecast from past figures. Linear regression fits one straight line to all of the history with every point counting equally, while exponential smoothing lets its level and trend drift and counts recent figures most.' },
    { to: 'kalman-filter', type: 'advanced', why: 'Simple exponential smoothing is what the Kalman filter settles into for a level that drifts by random steps and is measured with noise. The Kalman filter also works out what the smoothing weight should be and how uncertain the estimate is.' },
    { to: 'ab-testing', type: 'related', why: 'When a change cannot be tried on randomly split groups as in an A/B test, an exponential smoothing forecast of what would have happened without the change is the usual stand-in for a control group, and a weaker one.' },
    { to: 'gradient-descent', type: 'related', why: 'One exponential smoothing update is one gradient descent step on the squared miss of the latest forecast. The smoothing weight plays the part of the learning rate.' },
    { to: 'adam', type: 'related', why: 'The Adam optimizer keeps exponentially smoothed averages of the gradient and of its square. It is the recurrence of exponential smoothing applied to gradients in place of demand.' },
    { to: 'fft', type: 'related', why: 'Holt-Winters has to be told how long the season is. The fast Fourier transform can find it, by showing which repeating period accounts for most of the variation in the series.' },
    { to: 'concept:recurrence', type: 'prerequisite', why: 'Exponential smoothing is a recurrence: each new level is computed from the previous level and one new figure, and unrolling it gives the fading weights.' },
    { to: 'concept:learning-rate', type: 'related', why: 'The smoothing weight of exponential smoothing behaves like a learning rate. Too large and the estimate chases noise, too small and it reacts late.' },
    { to: 'concept:overfitting', type: 'related', why: 'Smoothing weights tuned to make past forecasts look good can fit the accidents of that history, which is overfitting, so they must be checked on figures held back from the tuning.' },
    { to: 'discipline:optimization', type: 'application', why: 'Inventory rules that decide when and how much to reorder take a demand forecast as input, and exponential smoothing was developed to provide it.' },
    { to: 'discipline:finance', type: 'application', why: 'In finance, volatility is commonly estimated with the recurrence of exponential smoothing applied to squared price changes, so that recent market moves count most.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'In simple exponential smoothing, what does setting the weight α to 1 do?',
      options: ['The forecast becomes the average of all past figures', 'The forecast becomes the most recent figure', 'The forecast never changes from its starting value', 'The forecast adds a trend'],
      answer: 1,
      explain: [
        'An average of everything would need the weights on all months to be equal. With α = 1 all the weight is on the newest month.',
        'The level takes all of the new figure and keeps none of the old level, so the forecast is always "the same as last month".',
        'That is what happens as α approaches 0, when new figures are ignored.',
        'No value of α adds a trend. Simple smoothing has a level and nothing else.',
      ],
    },
    {
      type: 'predict',
      q: 'Demand grows by exactly 2 units every month, with no randomness at all. Simple smoothing with α = 0.3 forecasts each month from the ones before. Once it has settled, how do its forecasts compare with the actual figures?',
      options: ['They match exactly, because the pattern is perfectly regular', 'They are too low by 2 every month', 'They are too low by about 6.7 every month', 'They alternate between too high and too low'],
      answer: 2,
      explain: [
        'Regular is not enough. The method must be able to represent the pattern, and simple smoothing has no trend.',
        'It would be 2 too low if the level kept up with the latest figure. But the level itself runs behind, since it is an average of older, smaller figures.',
        'The miss settles at the growth per month divided by α: 2 / 0.3 is about 6.7. Each month the level closes 30% of the gap and demand opens it by another 2.',
        'Nothing in the method overshoots a steady climb. The forecast stays below it.',
      ],
      tryInput: { pattern: 'trend', method: 'simple', alpha: 0.3, noise: 0, seed: 1, custom: [] },
    },
    {
      type: 'debug',
      q: 'This code is used to choose α by trying values and keeping the one with the smallest average miss. It always chooses α = 1 and reports a miss of zero. What is wrong?',
      code: `level = y[0]
total_miss = 0
for t in range(1, len(y)):
    level = alpha * y[t] + (1 - alpha) * level
    total_miss += abs(y[t] - level)
average_miss = total_miss / (len(y) - 1)`,
      options: ['The loop should start at 0', 'The miss is measured after the level has already been updated with the same figure', 'The weights α and 1 − α are the wrong way round', 'abs should be a square'],
      answer: 1,
      explain: [
        'Starting at 1 is right, because the first figure is the starting level.',
        'The forecast for month t is the level before month t is seen. Measure the miss first, then update. As written, the code compares each figure with an estimate that has already been pulled toward it, and at α = 1 the two are identical.',
        'The weights are in the right places: α on the new figure, 1 − α on the old level.',
        'Squaring is a common choice too, but it would not cure this. The comparison itself is against the wrong value.',
      ],
    },
    {
      type: 'choice',
      q: 'An ice cream shop\'s sales rise a little every year and peak every July. It has four years of monthly figures and wants a forecast for each of the next twelve months. Which version fits?',
      options: ['Simple smoothing, because it is the most reliable', 'Holt\'s method, because sales are rising', 'Holt-Winters with a season of 12', 'None: seasonal sales cannot be forecast'],
      answer: 2,
      explain: [
        'Simple smoothing forecasts one flat number for all twelve months. It would be far too low in July and too high in January.',
        'Holt\'s method follows the rise but draws a straight line through the year, so it misses the July peak.',
        'The history shows a level, a trend and a pattern that repeats every 12 months, and four years is enough to start the seasonal values.',
        'A pattern that repeats is the easiest kind to forecast, provided the method has a part that represents it.',
      ],
    },
    {
      type: 'challenge',
      title: 'Choose the weights honestly',
      prompt: 'Generate or collect five years of monthly figures with a trend and a season. Using only the first four years, run Holt-Winters for every combination of α, β and γ from 0.1 to 0.9 in steps of 0.1 and keep the combination with the smallest sum of squared one-step-ahead misses. Then forecast the fifth year with those weights and measure the average miss. Compare it with two yardsticks on the same fifth year: "same as last month" and "same as the same month a year ago". Finally compare the miss on the fifth year with the fitted miss on the first four. Which is larger, and why?',
      hints: ['The fitted miss is almost always smaller: the weights were chosen to make it small, and the fifth year had no say.', 'The seasonal yardstick is hard to beat when the trend is weak. Report the ratio of your miss to its miss.'],
    },
  ],

  compare: {
    idea: 'Keep a running estimate and move it part of the way toward each new figure. Optional extra estimates follow a trend and a repeating season.',
    requires: 'A history of regular figures, such as monthly sales, with none missing. For a seasonal forecast, at least two full years of them and the length of the season. A choice of how strongly to react to each new figure.',
    sensitivity: 'Sensitive to the smoothing weights: too high and it chases noise, too low and it reacts late. Sensitive to freak values and to sudden changes.',
    memory: 'O(1), or O(m) with a season of length m.',
    difficulty: 'low',
    difficultyNote: 'Each update is one line. Choosing the weights and judging the forecasts honestly takes more care.',
    limits: 'It looks only at past figures, so it cannot foresee anything new, such as a price change, a promotion or a competitor. It notices a sudden change only after the change has shown up in the figures. Its forecasts get less reliable the further ahead they reach.',
    useWhen: 'You need next month\'s number for many products, the recent past is the best guide you have, and you want something quick that you can explain.',
  },

  advanced: {
    history: 'Exponential smoothing came out of operations research in the 1950s. Robert G. Brown developed it in work for the United States Navy and set it out, as a way to forecast the demand for stocked items, in his 1959 book *Statistical Forecasting for Inventory Control*. Charles C. Holt reached the same idea independently and extended it to trends and seasons in a 1957 memorandum for the Office of Naval Research, which circulated widely but was not printed in a journal until 2004. Peter Winters tested Holt\'s seasonal method on sales data and published the results in 1960, which is why the seasonal version carries both names. In the same year John Muth showed that simple smoothing gives the best forecast, in the sense of mean squared error, for a series whose level takes random steps and is observed with noise. For decades the methods were treated as useful rules without a statistical model behind them. State space formulations, set out by Rob Hyndman and colleagues in the 2000s, changed that by giving each variant a model, a likelihood and a range around its forecasts. In the forecasting competitions organized by Spyros Makridakis from 1982 onward, exponential smoothing methods repeatedly did about as well as far more elaborate ones.',
    derivation: 'Unroll the simple recurrence $\\ell_t = \\alpha y_t + (1-\\alpha)\\ell_{t-1}$ with $\\ell_1 = y_1$:\n\n$$\\ell_t = \\alpha \\sum_{k=0}^{t-2} (1-\\alpha)^k\\, y_{t-k} + (1-\\alpha)^{t-1}\\, y_1.$$\n\nThe weights are a geometric sequence, and with the weight on $y_1$ they sum to 1. The weight halves every $\\ln 2 / (-\\ln(1-\\alpha))$ periods, about 1.9 periods for $\\alpha = 0.3$.\n\nWriting $e_t = y_t - \\hat y_t$ for the one-step miss, every version has an error-correction form. For Holt-Winters as defined on this page:\n\n$$\\ell_t = \\ell_{t-1} + b_{t-1} + \\alpha e_t, \\qquad b_t = b_{t-1} + \\alpha\\beta\\, e_t, \\qquad s_t = s_{t-m} + \\gamma(1-\\alpha)\\, e_t.$$\n\nSo each part is corrected by a fixed fraction of the same miss, and when the miss is zero nothing changes. The tests of this lesson check the page\'s recurrences against this form.\n\nLag behind a trend. Feed simple smoothing the line $y_t = a + bt$. Try $\\ell_t = y_t - c$ in the recurrence: $y_t - c = \\alpha y_t + (1-\\alpha)(y_t - b - c)$ gives $c = b(1-\\alpha)/\\alpha$. The forecast for the next period is $\\ell_t$ and the actual is $y_t + b$, so the miss settles at\n\n$$e = b + \\frac{b(1-\\alpha)}{\\alpha} = \\frac{b}{\\alpha}.$$',
    proof: 'Holt\'s method reproduces a straight line. Let $y_t = a + bt$. The starting values are $\\ell_2 = y_2$ and $b_2 = y_2 - y_1 = b$. Suppose $\\ell_{t-1} = y_{t-1}$ and $b_{t-1} = b$. Then the forecast is $\\hat y_t = y_{t-1} + b = y_t$, so $\\ell_t = \\alpha y_t + (1-\\alpha) y_t = y_t$ and $b_t = \\beta(y_t - y_{t-1}) + (1-\\beta) b = b$. By induction every forecast is exact, and the forecast $h$ periods ahead is $y_n + hb = y_{n+h}$, for any weights.\n\nThe same argument works for Holt-Winters on $y_t = a + bt + c_{t \\bmod m}$ where the $c$ values sum to zero. The two yearly averages are $a + b(m+1)/2$ and $a + b(3m+1)/2$, so the starting trend is $b$, the starting level is $a$, and the starting seasonal values are the $c$ values. Every later miss is zero, so by the error-correction form nothing is ever changed.',
    variants: [
      { name: 'Brown\'s double smoothing', text: 'Follows a trend with a single weight by smoothing the series and then smoothing the result. It is a special case of Holt\'s method.' },
      { name: 'Damped trend', text: 'Multiplies the trend by a factor a little below 1 for each period ahead, so the forecast line flattens out. Proposed by Everette Gardner and Ed McKenzie in 1985, and often more accurate at longer horizons.' },
      { name: 'Multiplicative season', text: 'Each seasonal value is a ratio that multiplies the level. It suits series whose seasonal swings grow with the level.' },
      { name: 'Another form of the seasonal update', text: 'Some texts update the seasonal value with $\\gamma\\,(y_t - \\ell_{t-1} - b_{t-1})$ in place of $\\gamma\\,(y_t - \\ell_t)$. The two describe the same family of forecasts with the seasonal weight scaled differently, so a value of γ from one form does not carry over to the other.' },
      { name: 'State space (ETS) models', text: 'Write each variant as a statistical model with an error, trend and seasonal component. That gives ranges around forecasts and a principled way to choose among variants.' },
      { name: 'Croston\'s method', text: 'For demand that is zero in most periods. It smooths the sizes of the orders and the intervals between them separately.' },
    ],
    implementation: 'Fit the weights by minimizing the sum of squared one-step-ahead misses over the history, and hold back the most recent periods to check the result. Give the starting values the same care on short series, or fit them along with the weights. Renormalize the seasonal values from time to time so that they average to zero. Store only the current parts between runs. When a period is missing, carry the forecast forward as the estimate of that period, so the seasonal positions stay aligned.',
    benchmarking: 'Judge a forecasting method on figures it has not seen, and always beside the naive and seasonal naive forecasts. Rolling the starting point forward and repeating the test gives many forecasts to average over. Scaled measures, such as the mean absolute scaled error of Hyndman and Koehler, let accuracy be compared across series of different sizes. The last step of this page\'s demonstration does a small version of this: twelve months held back, then revealed.',
    references: [
      { authors: 'C. C. Holt', year: 1957, title: 'Forecasting seasonals and trends by exponentially weighted moving averages', venue: 'Office of Naval Research Memorandum 52, Carnegie Institute of Technology. Reprinted in International Journal of Forecasting 20(1), 5-10 (2004)' },
      { authors: 'P. R. Winters', year: 1960, title: 'Forecasting sales by exponentially weighted moving averages', venue: 'Management Science 6(3), 324-342' },
      { authors: 'R. G. Brown', year: 1959, title: 'Statistical Forecasting for Inventory Control', venue: 'McGraw-Hill' },
      { authors: 'J. F. Muth', year: 1960, title: 'Optimal properties of exponentially weighted forecasts', venue: 'Journal of the American Statistical Association 55(290), 299-306' },
      { authors: 'E. S. Gardner Jr.', year: 1985, title: 'Exponential smoothing: the state of the art', venue: 'Journal of Forecasting 4(1), 1-28' },
      { authors: 'R. J. Hyndman and G. Athanasopoulos', year: 2021, title: 'Forecasting: Principles and Practice (3rd edition)', venue: 'OTexts' },
    ],
    furtherReading: [
      'R. J. Hyndman, A. B. Koehler, J. K. Ord and R. D. Snyder, *Forecasting with Exponential Smoothing: The State Space Approach* (Springer, 2008).',
      'E. S. Gardner Jr., "Exponential smoothing: the state of the art, Part II", *International Journal of Forecasting* 22(4), 637-666 (2006).',
    ],
  },

  tests: [
    { name: 'worked example: 100, 110, 104, 120 with a weight of one half gives 105, 104.5 and 112.25', input: { custom: [100, 110, 104, 120], method: 'simple', alpha: 0.5 },
      check: (r, c) => {
        const levels = r.steps.map((s) => s.level), forecasts = r.steps.map((s) => s.forecast), misses = r.steps.map((s) => s.error);
        if (String(levels) !== '105,104.5,112.25' || String(forecasts) !== '100,105,104.5' || String(misses) !== '10,-1,15.5') return `levels ${levels}, forecasts ${forecasts}, misses ${misses}`;
        if (!r.forecast.every((f) => f === 112.25)) return `forecast ${r.forecast}`;
        if (0.5 * 120 + 0.25 * 104 + 0.125 * 110 + 0.125 * 100 !== 112.25 || (100 + 110 + 104 + 120) / 4 !== 108.5) return 'the sums quoted in the worked example are wrong';
        return (c.updates === 3 && r.futureMae === null) || `updates ${c.updates}`;
      } },
    { name: 'the simple level equals the explicit weighted sum of past figures, with weights that sum to 1', input: { pattern: 'shift', method: 'simple', alpha: 0.3, noise: 6, seed: 1, custom: [] },
      check: (r) => {
        const y = r.series, a = r.alpha;
        for (const s of r.steps) {
          let sum = (1 - a) ** (s.t - 1) * y[0], weights = (1 - a) ** (s.t - 1);
          for (let k = 0; k <= s.t - 2; k++) { sum += a * (1 - a) ** k * y[s.t - 1 - k]; weights += a * (1 - a) ** k; }
          if (!near(weights, 1, 1e-12)) return `weights sum to ${weights} at month ${s.t}`;
          if (!near(sum, s.level)) return `month ${s.t}: weighted sum ${sum}, level ${s.level}`;
          if (s.level < Math.min(...y.slice(0, s.t)) - 1e-9 || s.level > Math.max(...y.slice(0, s.t)) + 1e-9) return `month ${s.t}: level outside the range of the figures`;
        }
        return r.steps.length === 47 || `steps ${r.steps.length}`;
      } },
    { name: 'α = 1 reproduces the last observation: every forecast is the figure of the month before', input: { pattern: 'season', method: 'simple', alpha: 1, noise: 6, seed: 3, custom: [] },
      check: (r) => {
        for (const s of r.steps) if (s.level !== s.actual || s.forecast !== r.series[s.t - 2]) return `month ${s.t}: forecast ${s.forecast}, level ${s.level}`;
        return r.forecast.every((f) => f === r.series[r.n - 1]) || `forecast ${r.forecast[0]}, last figure ${r.series[r.n - 1]}`;
      } },
    { name: 'a constant series is forecast exactly by all three methods, whatever the weights', input: { pattern: 'steady', method: 'winters', alpha: 0.35, beta: 0.25, gamma: 0.45, noise: 0, seed: 1, custom: [] },
      check: () => {
        for (const method of ['simple', 'holt', 'winters']) for (const [alpha, beta, gamma] of [[0.35, 0.25, 0.45], [0.05, 1, 0.05], [1, 0.5, 1]]) {
          const r = quiet({ pattern: 'steady', method, alpha, beta, gamma, noise: 0 });
          if (!r.series.every((v) => v === 100)) return 'the steady series without randomness is not constant';
          if (!r.steps.every((s) => near(s.forecast, 100)) || !r.forecast.every((f) => near(f, 100)) || !near(r.futureMae, 0)) return `${method} with weights ${alpha}, ${beta}, ${gamma} does not forecast 100`;
          const typed = quiet({ custom: new Array(30).fill(7), method, alpha, beta, gamma });
          if (!typed.forecast.every((f) => near(f, 7))) return `${method} does not forecast a typed constant series`;
        }
        return true;
      } },
    { name: 'Holt reproduces a straight line exactly, whatever the weights', input: { pattern: 'trend', method: 'holt', alpha: 0.3, beta: 0.1, noise: 0, seed: 1, custom: [] },
      check: (r) => {
        for (const [alpha, beta] of [[0.3, 0.1], [0.9, 0.9], [0.05, 0.6]]) {
          const q = quiet({ pattern: 'trend', method: 'holt', alpha, beta, noise: 0 });
          if (!q.steps.every((s) => near(s.error, 0, 1e-8) && near(s.trend, 2, 1e-8))) return `weights ${alpha}, ${beta}: a miss or a trend other than 2`;
          if (!q.forecast.every((f, h) => near(f, 100 + 2 * (q.n + h + 1), 1e-8))) return `weights ${alpha}, ${beta}: forecast ${q.forecast}`;
        }
        return near(r.futureMae, 0, 1e-8) || `miss for the year ahead ${r.futureMae}`;
      } },
    { name: 'Holt-Winters reproduces a straight line plus a fixed season exactly, and recovers the seasonal values', input: { pattern: 'season', method: 'winters', alpha: 0.3, beta: 0.1, gamma: 0.3, noise: 0, seed: 1, custom: [] },
      check: (r) => {
        if (SEASON.reduce((a, b) => a + b, 0) !== 0) return 'the true seasonal pattern does not sum to zero';
        if (!near(r.start.trend, 2) || !near(r.start.level, 100) || !r.start.season.every((v, i) => near(v, SEASON[i]))) return `starting values: trend ${r.start.trend}, level ${r.start.level}`;
        if (!r.steps.every((s) => near(s.error, 0, 1e-8))) return 'a one-month-ahead forecast missed';
        if (!r.season.every((v, i) => near(v, SEASON[i], 1e-8))) return `seasonal values ${r.season}`;
        return (near(r.futureMae, 0, 1e-8) && r.forecast.every((f, h) => near(f, r.future[h], 1e-8))) || `forecast ${r.forecast}`;
      } },
    { name: 'all three methods agree with the error-correction form of the recurrence, computed independently', input: { pattern: 'season', method: 'winters', alpha: 0.3, beta: 0.1, gamma: 0.3, noise: 6, seed: 1, custom: [] },
      check: (r) => {
        for (const method of ['simple', 'holt', 'winters']) for (const [alpha, beta, gamma] of [[0.3, 0.1, 0.3], [0.7, 0.4, 0.9], [0.15, 0.05, 0.6]]) {
          const q = method === 'winters' && alpha === 0.3 ? r : quiet({ pattern: 'season', method, alpha, beta, gamma, seed: 4 });
          const ref = errorCorrectionForm(method, q.series, alpha, beta, gamma, q.horizon);
          if (ref.forecasts.length !== q.steps.length) return `${method}: ${q.steps.length} steps against ${ref.forecasts.length}`;
          const bad = q.steps.findIndex((s, i) => !near(s.forecast, ref.forecasts[i], 1e-8));
          if (bad >= 0) return `${method}: forecast for month ${q.steps[bad].t} is ${q.steps[bad].forecast}, reference ${ref.forecasts[bad]}`;
          if (!near(q.level, ref.level, 1e-8) || !near(q.trend, ref.trend, 1e-8)) return `${method}: level ${q.level} and trend ${q.trend}, reference ${ref.level} and ${ref.trend}`;
          if (q.season && !q.season.every((v, i) => near(v, ref.season[i], 1e-8))) return `${method}: seasonal values differ`;
          if (!q.forecast.every((f, h) => near(f, ref.ahead[h], 1e-8))) return `${method}: forecasts ahead differ`;
        }
        return true;
      } },
    { name: 'quiz: on growth of 2 a month with no randomness, simple smoothing with α = 0.3 settles 2 / 0.3 behind', input: { pattern: 'trend', method: 'simple', alpha: 0.3, noise: 0, seed: 1, custom: [] },
      check: (r) => {
        const last = r.steps[r.steps.length - 1];
        if (!r.steps.every((s) => s.error > 0)) return 'a forecast was not below the actual figure';
        return (near(last.error, 2 / 0.3, 1e-4) && last.error.toFixed(1) === '6.7') || `the miss settles at ${last.error}`;
      } },
    { name: 'presets: on growing demand the trend term cuts the miss for the year ahead from about 19 to about 5', input: { pattern: 'trend', method: 'simple', alpha: 0.3, noise: 6, seed: 1, custom: [] },
      check: (r) => {
        const withTrend = quiet({ pattern: 'trend', method: 'holt', alpha: 0.3, beta: 0.1 });
        if (String(withTrend.series) !== String(r.series)) return 'the two methods were given different figures';
        if (r.futureMae.toFixed(0) !== '19' || withTrend.futureMae.toFixed(0) !== '5') return `misses ${r.futureMae} and ${withTrend.futureMae}`;
        return (r.futureBias > 10 && r.forecast.every((f) => f === r.forecast[0]) && withTrend.futureMae < 1.6 * withTrend.noiseFloor + 1) || `bias ${r.futureBias}`;
      } },
    { name: 'presets: on seasonal demand Holt-Winters cuts the miss for the year ahead from about 14 to about 5', input: { pattern: 'season', method: 'winters', alpha: 0.3, beta: 0.1, gamma: 0.3, noise: 6, seed: 1, custom: [] },
      check: (r) => {
        const trendOnly = quiet({ pattern: 'season', method: 'holt' }), levelOnly = quiet({ pattern: 'season', method: 'simple' });
        if (trendOnly.futureMae.toFixed(0) !== '14' || r.futureMae.toFixed(0) !== '5') return `misses ${trendOnly.futureMae} and ${r.futureMae}`;
        if (!(levelOnly.futureMae > 2 * r.futureMae && trendOnly.mae > r.mae)) return `level only ${levelOnly.futureMae}, one-month misses ${trendOnly.mae} and ${r.mae}`;
        const peak = r.forecast.indexOf(Math.max(...r.forecast));
        return ((r.n + peak) % 12 === 11 && r.season.indexOf(Math.max(...r.season)) === 11) || 'the forecast for the year ahead does not peak in December';
      } },
    { name: 'presets: after a jump the fast weight wins, and on steady demand the slow weight wins', input: { pattern: 'shift', method: 'simple', alpha: 0.1, noise: 6, seed: 1, custom: [] },
      check: (r) => {
        const fast = quiet({ pattern: 'shift', alpha: 0.8 });
        const levelAfter = (run, month) => run.steps.find((s) => s.t === month).level;
        if (!(r.mae > 1.5 * fast.mae)) return `after the jump: slow ${r.mae}, fast ${fast.mae}`;
        if (!(levelAfter(r, 36) > 120 && levelAfter(r, 36) < 124)) return `slow weight a year after the jump: ${levelAfter(r, 36)}`;
        if (Math.abs(levelAfter(fast, 27) - 130) > 4) return `fast weight three months after the jump: ${levelAfter(fast, 27)}`;
        const steadySlow = quiet({ pattern: 'steady', alpha: 0.1 }), steadyFast = quiet({ pattern: 'steady', alpha: 0.8 });
        return (steadySlow.mae.toFixed(1) === '4.5' && steadyFast.mae.toFixed(1) === '5.2' && steadySlow.scoreFrom === 25) || `steady demand: slow ${steadySlow.mae}, fast ${steadyFast.mae}`;
      } },
    { name: 'the shape of the forecast: flat, a straight line, and a straight line plus the seasonal values', input: { pattern: 'season', method: 'holt', alpha: 0.3, beta: 0.1, noise: 6, seed: 2, custom: [] },
      check: (r, c) => {
        if (c.updates !== 2 * (r.n - 2) || r.steps.length !== r.n - 2) return `Holt made ${c.updates} updates on ${r.n} months`;
        if (!r.forecast.every((f, h) => near(f, r.level + (h + 1) * r.trend))) return 'Holt forecast is not level + h × trend';
        const flat = quiet({ pattern: 'season', method: 'simple', seed: 2 }), full = quiet({ pattern: 'season', method: 'winters', seed: 2 });
        if (flat.steps.length !== flat.n - 1 || !flat.forecast.every((f) => f === flat.level)) return 'the simple forecast is not flat at the level';
        return (full.steps.length === full.n && full.forecast.every((f, h) => near(f, full.level + (h + 1) * full.trend + full.season[(full.n + h) % 12]))) || 'the Holt-Winters forecast is not level + h × trend + season';
      } },
    { name: 'histories too short for the method are refused with a reason', input: { pattern: 'steady', method: 'simple', alpha: 0.3, noise: 6, seed: 1, custom: [] },
      check: () => {
        const refuses = (input, pattern) => { try { quiet(input); return false; } catch (e) { return pattern.test(e.message); } };
        if (!refuses({ custom: new Array(23).fill(5), method: 'winters' }, /two full years/)) return 'Holt-Winters accepted 23 months';
        if (!refuses({ custom: [5, 6], method: 'holt' }, /at least three/)) return 'Holt accepted two figures';
        if (!refuses({ custom: [5], method: 'simple' }, /at least two/)) return 'simple smoothing accepted one figure';
        return quiet({ custom: new Array(24).fill(5), method: 'winters' }).forecast.length === 12 || 'Holt-Winters rejected exactly two years';
      } },
    { name: 'the same seed gives the same figures, and the figures do not depend on the method', input: { pattern: 'season', method: 'simple', alpha: 0.3, noise: 6, seed: 9, custom: [] },
      check: (r) => {
        const again = quiet({ pattern: 'season', method: 'winters', seed: 9 });
        if (String(again.series) !== String(r.series) || String(again.future) !== String(r.future)) return 'the method changed the figures';
        return (r.n === 48 && r.future.length === 12 && String(quiet({ pattern: 'season', seed: 10 }).series) !== String(r.series)) || 'a different seed gave the same figures';
      } },
  ],
};

