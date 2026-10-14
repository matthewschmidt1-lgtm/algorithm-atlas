import { makeRng } from '../../js/lib/rng.js';

// The tracked object moves VELOCITY per step, plus a small random push. The filter starts with
// the guess START and a variance of P_START, and the true starting position is drawn to match that.
const VELOCITY = 0.5, START = 0, P_START = 3;
const QUIET = { record: false, count() {}, frame() {} };
const f2 = (v) => v.toFixed(2);
const f3 = (v) => v.toFixed(3);

// Long-run values of the scalar filter: prior variance M solves M² − Q·M − Q·R = 0.
function steadyState(Q, R) {
  const M = (Q + Math.sqrt(Q * Q + 4 * Q * R)) / 2;
  const gain = M / (M + R);
  return { prior: M, gain, variance: gain * R };
}

function run(input, t) {
  const sz = Number(input.measNoise), sw = Number(input.procNoise);
  if (!(sz > 0)) throw new Error('The measurement noise must be greater than zero.');
  if (!(sw >= 0)) throw new Error('The process noise cannot be negative.');
  const R = sz * sz, Q = sw * sw;
  const custom = Array.isArray(input.custom) && input.custom.length ? input.custom.slice() : null;
  const n = custom ? custom.length : Math.floor(Number(input.steps));
  if (!(n >= 1)) throw new Error('Track at least one step.');
  const rng = makeRng(input.seed);
  // The experiment starts the filter knowing almost nothing; the page always uses P_START.
  const P0 = Number(input.startVariance) > 0 ? Number(input.startVariance) : P_START;

  // The world: a true path the filter never sees, and the noisy measurements it does see.
  let truth = null, zs;
  if (custom) zs = custom;
  else {
    truth = [rng.normal(START, Math.sqrt(P_START))];
    zs = [];
    for (let k = 1; k <= n; k++) {
      truth.push(truth[k - 1] + VELOCITY + rng.normal(0, sw));
      zs.push(truth[k] + rng.normal(0, sz));
    }
  }
  const steady = steadyState(Q, R);
  const all = zs.concat(truth || [], [START - 2 * Math.sqrt(P0), START + 2 * Math.sqrt(P0)]);
  const lo = Math.min(...all) - 1, hi = Math.max(...all) + 1;

  const est = [START], vars = [P0], gains = [], preds = [null];
  let x = START, P = P0;
  t.count('updates', 0);
  t.count('steps until the gain settles', 0);

  const legend = [
    ...(truth ? [{ label: 'true position (hidden from the filter)', role: 'ink' }] : []),
    { label: 'measurements', role: 'ochre' },
    { label: 'estimate, with a band of 2 standard deviations either side', role: 'terracotta' },
  ];
  // k: current step. phase: 'start' | 'predict' | 'update' | 'end'.
  const views = (k, phase) => {
    const last = phase === 'predict' ? k - 1 : k;                 // newest step with a finished estimate
    const seen = phase === 'predict' ? k - 1 : k;                 // measurements revealed so far
    const upper = [], lower = [];
    for (let i = 0; i <= last; i++) { const s = 2 * Math.sqrt(vars[i]); upper.push([i, est[i] + s]); lower.push([i, est[i] - s]); }
    const layers = [];
    if (phase === 'predict') { const s = 2 * Math.sqrt(preds[k].P); upper.push([k, preds[k].x + s]); lower.push([k, preds[k].x - s]); }
    if (upper.length > 1) layers.push({ type: 'band', upper, lower, role: 'terracotta' });
    else layers.push({ type: 'segments', segments: [[0, lower[0][1], 0, upper[0][1]]], role: 'terracotta', width: 5, alpha: 0.35 });
    if (truth) layers.push({ type: 'line', points: truth.slice(0, Math.max(2, (phase === 'start' ? 0 : k) + 1)).map((v, i) => [i, v]).slice(0, phase === 'start' ? 1 : undefined), role: 'ink', width: 1.5, dash: true });
    if (truth) layers.push({ type: 'points', points: [[phase === 'start' ? 0 : k, truth[phase === 'start' ? 0 : k]]], role: 'ink', r: 3 });
    layers.push({ type: 'points', points: zs.slice(0, seen).map((z, i) => [i + 1, z]), role: 'ochre', r: 3.2 });
    layers.push({ type: 'line', points: est.slice(0, last + 1).map((v, i) => [i, v]), role: 'terracotta', width: 2.2 });
    if (last === 0) layers.push({ type: 'points', points: [[0, est[0]]], role: 'terracotta', r: 3.5 });
    if (phase === 'predict' || phase === 'update') {
      layers.push({ type: 'segments', segments: [[k - 1, est[k - 1], k, preds[k].x]], role: 'terracotta', width: 1.6, dash: true });
      layers.push({ type: 'points', points: [{ x: k, y: preds[k].x, label: phase === 'predict' ? 'prediction' : '' }], role: 'current', r: 5, hollow: true });
    }
    if (phase === 'update') {
      layers.push({ type: 'points', points: [[k, zs[k - 1]]], role: 'ochre', r: 5.5, ring: true });
      layers.push({ type: 'segments', segments: [[k, preds[k].x, k, est[k]]], role: 'current', width: 2, arrow: true });
      layers.push({ type: 'points', points: [[k, est[k]]], role: 'current', r: 4.5 });
    }
    return [
      { kind: 'scene', title: 'Position over time', x: [0, n], y: [lo, hi], aspect: 0.5, axes: { xLabel: 'time step', yLabel: 'position' }, layers, legend },
      { kind: 'scene', title: 'Kalman gain at each step', x: [0, n], y: [0, 1], aspect: 0.2, axes: { xLabel: 'time step' },
        layers: [
          { type: 'line', points: [[0, steady.gain], [n, steady.gain]], role: 'sage', width: 1.2, dash: true },
          { type: 'line', points: gains.slice(0, last).map((g, i) => [i + 1, g]), role: 'forest', width: 2 },
          ...(last === 1 ? [{ type: 'points', points: [[1, gains[0]]], role: 'forest', r: 3 }] : []),
        ],
        legend: [{ label: 'gain', role: 'forest' }, { label: 'long-run gain', role: 'sage' }] },
    ];
  };

  t.frame(() => ({ line: 0,
    note: `The filter keeps two numbers: an estimate of the position, and a variance that says how unsure it is. It starts with the estimate ${f2(START)} and variance ${f2(P0)}, so the shaded band, 2 standard deviations either side, runs from ${f2(START - 2 * Math.sqrt(P0))} to ${f2(START + 2 * Math.sqrt(P0))}. ${truth ? `The object really starts at ${f2(truth[0])} and moves about ${VELOCITY} per step. The filter never sees the dashed line, only the measurements.` : `The measurements are the ones you typed, so the true position is unknown and is not drawn.`}`,
    views: views(0, 'start'), vars: { estimate: f2(x), variance: f2(P) } }));

  for (let k = 1; k <= n; k++) {
    // Predict: move the estimate by the known velocity and let the uncertainty grow.
    const xPrev = x, PPrev = P;
    const xPred = x + VELOCITY;
    const PPred = P + Q;
    preds.push({ x: xPred, P: PPred });
    t.frame(() => ({ line: [2, 3, 4],
      note: `Step ${k}, predict. The object should have moved by ${VELOCITY}, so the predicted position is ${f2(xPrev)} + ${VELOCITY} = **${f2(xPred)}**. Its motion is not perfectly known, so the variance grows from ${f3(PPrev)} to ${f3(PPrev)} + ${f3(Q)} = ${f3(PPred)}: the band widens at its leading edge.`,
      views: views(k, 'predict'), vars: { step: k, prediction: f2(xPred), variance: f3(PPred) } }));

    // Update: blend the prediction with the measurement, weighting by reliability.
    const z = zs[k - 1];
    const K = PPred / (PPred + R);
    const innovation = z - xPred;
    x = xPred + K * innovation;
    P = (1 - K) * PPred;
    est.push(x); vars.push(P); gains.push(K);
    t.count('updates');
    if (Math.abs(K - steady.gain) > 1e-3) t.count('steps until the gain settles');
    const xNow = x, PNow = P;
    t.frame(() => ({ line: [5, 6, 7, 8, 9],
      note: `Step ${k}, update. The sensor reads ${f2(z)}, which is ${f2(Math.abs(innovation))} ${innovation >= 0 ? 'above' : 'below'} the prediction. The prediction has variance ${f3(PPred)} and the sensor has variance ${f3(R)}, so the gain is ${f3(PPred)} / (${f3(PPred)} + ${f3(R)}) = **${f3(K)}**. The estimate moves that share of the way toward the measurement: ${f2(xPred)} ${innovation >= 0 ? '+' : '−'} ${f3(K)} × ${f2(Math.abs(innovation))} = **${f2(xNow)}**. The variance drops to ${f3(PNow)}, lower than either source alone.`,
      views: views(k, 'update'), vars: { step: k, measurement: f2(z), gain: f3(K), estimate: f2(xNow), variance: f3(PNow) } }));
  }

  let rmsEstimate = null, rmsMeasurement = null;
  if (truth) {
    let se = 0, sm = 0;
    for (let k = 1; k <= n; k++) { se += (est[k] - truth[k]) ** 2; sm += (zs[k - 1] - truth[k]) ** 2; }
    rmsEstimate = Math.sqrt(se / n); rmsMeasurement = Math.sqrt(sm / n);
  }
  t.frame(() => ({ line: 10,
    note: `After ${n} ${n === 1 ? 'step' : 'steps'} the estimate is ${f2(x)} with variance ${f3(P)}. ${truth ? `Over the run, the raw measurements were typically off by ${f2(rmsMeasurement)} and the filter's estimates by ${f2(rmsEstimate)}. ${rmsEstimate < rmsMeasurement ? 'Blending in the prediction made the track more accurate than the sensor alone.' : 'In this short run the filter did no better than the sensor. That can happen by chance over a few steps; over many steps the filter wins.'} ` : ''}The gain ${Math.abs(gains[n - 1] - steady.gain) < 0.005 ? 'has settled at' : 'is heading toward'} its long-run value of ${f3(steady.gain)}.`,
    views: views(n, 'end'), vars: { estimate: f2(x), variance: f3(P), gain: f3(gains[n - 1]) } }));

  return { estimates: est, variances: vars, gains, predictions: preds, measurements: zs, truth, Q, R, velocity: VELOCITY,
    rmsEstimate, rmsMeasurement, steadyGain: steady.gain, steadyVariance: steady.variance };
}

export default {
  meta: {
    id: 'kalman-filter',
    name: 'Kalman Filter',
    aliases: ['linear quadratic estimation', 'LQE', 'Kalman-Bucy filter', 'state estimation', 'sensor fusion filter'],
    kind: 'algorithm',
    discipline: 'robotics',
    alsoIn: [
      { id: 'statistics', why: 'It is recursive Bayesian inference for a linear model with Gaussian noise, and the standard way to estimate state-space models of time series.' },
      { id: 'finance', why: 'Econometric models with hidden components, such as an unobserved trend behind noisy prices, are commonly estimated with it.' },
    ],
    subfield: 'State estimation',
    family: 'Bayesian filters',
    lab: 'robotics',
    year: 1960,
    authors: 'Rudolf E. Kalman',
    summary: 'Tracks a changing quantity from noisy measurements by alternating a prediction from a motion model with a correction weighted by how reliable each source is.',
    difficulty: 'advanced',
    order: 740,
    paradigms: ['probabilistic-inference'],
    randomized: false,
    approximate: false,
    time: { best: 'O(1) per step for a single state variable', average: 'O(n³ + m³) per step for n state variables and m measurements', worst: 'O(n³ + m³) per step', class: 'linear' },
    space: { worst: 'O(n²) for the covariance matrix', class: 'quadratic' },
    tags: {
      problems: ['track a moving object from noisy measurements', 'smooth a jumpy GPS position', 'combine several sensors', 'estimate something you cannot measure directly', 'filter sensor noise'],
      techniques: ['predict and update', 'Kalman gain', 'recursive estimation', 'Gaussian belief', 'sensor fusion'],
      applications: ['robotics', 'navigation', 'signal processing', 'finance', 'statistics'],
    },
    prerequisites: ['bayesian-updating', 'concept:gaussian-distribution', 'concept:bayes-theorem', 'concept:expectation', 'concept:state-space'],
  },

  bigIdea: {
    simple: "A Kalman filter keeps track of something that moves when your measurements of it are shaky. Think of following a friend's car on a phone map. The dot jumps around, because satellite positioning is never exact. But you know something else as well: a car on a road moves smoothly. A second ago it was there, driving that way at that speed, so now it should be about here. The filter blends these two sources. First it predicts where the car should be now. Then it looks at the new measurement and moves its guess part of the way toward it. How far? That depends on which source deserves more trust. If the measurements are poor, it leans on the prediction. If the prediction is doubtful, it leans on the measurement. It also keeps a running score of how unsure it is, and updates that score at every step. The result is a steadier and more accurate track than the raw measurements give.",
    what: 'A Kalman filter estimates the state of a system that changes over time, such as the position of a vehicle, from a stream of noisy measurements. It repeats two steps. The predict step uses a model of the motion to move the estimate forward and enlarges its uncertainty. The update step compares the prediction with a new measurement and shifts the estimate toward the measurement by a fraction called the Kalman gain, which is larger when the prediction is uncertain and smaller when the sensor is noisy.',
    why: 'Sensors are noisy and models of motion are imperfect. Used alone, each drifts or jitters. Rudolf Kalman showed in 1960 how to combine them recursively: each new measurement is folded into the current estimate with a few arithmetic operations, and no history has to be stored. That made accurate estimation possible on the small computers carried by aircraft and spacecraft.',
    when: 'Use it when the system can be described, at least approximately, by linear equations with noise that is roughly Gaussian, and when you can put numbers on how noisy the motion and the sensors are. For strongly nonlinear systems use an extended or unscented Kalman filter. For beliefs that are not bell-shaped, such as "the robot is in one of three corridors", use a particle filter. For a quantity that does not change, plain [Bayesian updating](#/algorithm/bayesian-updating) is the same idea without the predict step.',
    interesting: 'The gain and the variance never look at the measurements. In the linear filter they depend only on the noise levels and the starting variance, so the entire sequence of gains could be computed before the first reading arrives. After a few steps the gain settles to a constant, and from then on the filter is a fixed blend of prediction and measurement.',
    where: 'Navigation systems in aircraft, spacecraft, ships and phones, radar and sonar tracking, robot localization, and the estimation of time-series models in economics all use Kalman filters or their nonlinear extensions.',
    analogy: {
      title: 'A navigator with a compass and a glimpse of the coast',
      text: 'A ship\'s navigator without satellite positioning keeps a running estimate of the ship\'s position from its speed and heading. This is dead reckoning, and its error grows with every hour. Now and then the navigator sights a lighthouse and gets a position fix, which has its own error. A good navigator does not jump to the fix or ignore it, but moves the plotted position toward it by an amount that depends on how much each is trusted. After hours of dead reckoning, a fix counts for a lot. Just after a good fix, the next rough sighting counts for little.',
      limits: "A navigator weighs things by judgement. The filter uses exact formulas that are only as good as the noise levels it is given. Tell it the sensor is better than it really is and it will follow the noise. The formulas also assume that errors are bell-shaped and that the motion follows a linear rule. A navigator can reason that the ship cannot be on land. The basic filter cannot represent a fact like that.",
    },
  },

  example: {
    setup: "A toy train moves along a track about 0.5 metres every second. A sensor reports its position, but the readings are noisy. The filter keeps two numbers: its estimate of the position, and a doubt score, called the variance, that says how unsure it is. The sensor's readings have a variance of 4. Each second of travel adds 1 to the filter's variance, because the train's speed wobbles. The filter starts with the estimate 0 and a variance of 3.",
    steps: [
      "Predict. One second passes, so the estimate moves from 0 to 0 + 0.5 = 0.5. The variance grows from 3 to 3 + 1 = 4.",
      "Weigh the two sources. The sensor reads 2.5. The prediction has variance 4 and the sensor has variance 4, so they deserve equal trust. The gain is 4 / (4 + 4) = 0.5.",
      "Update. The reading is 2.5 − 0.5 = 2 above the prediction. Move half of that: the estimate becomes 0.5 + 0.5 × 2 = 1.5. The variance falls to (1 − 0.5) × 4 = 2.",
      "Predict again. The estimate moves to 1.5 + 0.5 = 2.0 and the variance grows to 2 + 1 = 3.",
      "Update again. The sensor reads 3.4. The gain is 3 / (3 + 4), about 0.43: the prediction is now the more reliable of the two, so the filter moves less than halfway. The reading is 1.4 above the prediction, so the estimate becomes 2.0 + 0.43 × 1.4 = 2.6. The variance falls to (1 − 0.43) × 3, about 1.71.",
    ],
    result: "After two readings the estimate is 2.6 with a variance of about 1.71. That is less than half the sensor's variance of 4, so the estimate is more trustworthy than any single reading. The gain fell from 0.5 to 0.43 because the filter had become more sure of itself.",
    tryInput: { custom: [2.5, 3.4], measNoise: 2, procNoise: 1 },
  },

  terms: [
    { term: "State", meaning: "The quantity being tracked, such as a position. It changes over time and cannot be observed exactly." },
    { term: "Measurement", meaning: "A reading from a sensor. It equals the true value plus an error that differs every time." },
    { term: "Noise", meaning: "The random part of a measurement or of a motion: the part that cannot be predicted." },
    { term: "Estimate", meaning: "The filter's current best guess of the state." },
    { term: "Variance", meaning: "A score for how unsure an estimate is. It is the square of the typical error, so a variance of 4 means errors of about 2." },
    { term: "Prediction", meaning: "Where the state should be now according to the rule for how it moves, before looking at the new measurement." },
    { term: "Kalman gain", meaning: "A number between 0 and 1 that says what share of the gap between prediction and measurement the estimate should move." },
    { term: "Process noise", meaning: "The random pushes that make the true motion differ from the rule the filter assumes." },
    { term: "Gaussian", meaning: "Bell-shaped. A Gaussian belief is fully described by its centre (the estimate) and its spread (the variance)." },
  ],

  takeaway: "Predict where the thing should be, look at where the sensor says it is, and settle in between, closer to whichever you have more reason to trust.",

  viz: {
    describe: 'The main chart plots position against time. A dashed ink line shows the true position, which the filter never sees. Ochre dots are the noisy measurements. A terracotta line is the filter\'s estimate, inside a shaded terracotta band that reaches 2 standard deviations either side of it. At each step a hollow circle marks the prediction, and an arrow shows the estimate moving from the prediction part of the way toward the new measurement. A second, smaller chart plots the Kalman gain at each step as a forest green line, with a dashed line at the value it settles to.',
    inputs: [
      { id: 'measNoise', type: 'range', label: 'Measurement noise (typical sensor error)', min: 0.2, max: 5, step: 0.1, default: 2,
        help: 'Standard deviation of the sensor error. The filter is told this value.' },
      { id: 'procNoise', type: 'range', label: 'Process noise (random push per step)', min: 0, max: 2, step: 0.05, default: 0.5,
        help: 'Standard deviation of the random change in position at each step, on top of the steady motion. The filter is told this value.' },
      { id: 'steps', type: 'range', label: 'Time steps', min: 2, max: 80, step: 1, default: 30 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 5 },
      { id: 'custom', type: 'list', label: 'Your own measurements (optional)', default: [], maxLength: 80,
        help: 'Leave empty to simulate a moving object. If you type measurements, they replace the simulation and no true position is drawn.' },
    ],
    presets: [
      { label: 'Typical tracking', values: { measNoise: 2, procNoise: 0.5, steps: 30, seed: 5, custom: [] } },
      { label: 'Noisy sensor, steady motion', values: { measNoise: 4, procNoise: 0.2, steps: 40, seed: 5, custom: [] } },
      { label: 'Good sensor, erratic motion', values: { measNoise: 0.5, procNoise: 1.5, steps: 40, seed: 5, custom: [] } },
      { label: 'No process noise', values: { measNoise: 2, procNoise: 0, steps: 60, seed: 5, custom: [] } },
      { label: 'Two readings by hand', values: { measNoise: 2, procNoise: 1, custom: [2.5, 3.4] } },
      { label: 'A sudden jump', values: { measNoise: 1, procNoise: 0.3, custom: [0.5, 1, 1.5, 2, 2.5, 3, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14] } },
    ],
    tryThis: [
      { ask: 'Load "Typical tracking" and step through the first five steps. The dashed line in the lower chart marks the long-run gain, 0.221. Will the gain at step 1 be above that line or below it, and by roughly how much?',
        reveal: 'Above it, at 0.448, about twice the long-run value. The filter starts out unsure, with a variance of 3, so it leans hard on the first readings. The gain then falls through 0.338, 0.286, 0.258 and 0.243, and the band narrows from 3.46 either side to 1.88 as the filter gains confidence. From step 12 on the gain is within 0.001 of its long-run value.' },
      { ask: 'Load "Noisy sensor, steady motion" and then "Good sensor, erratic motion". Before each run, decide where the gain will end up: near 0, near 0.5 or near 1? And in which of the two runs will the filter improve more on its own sensor?',
        reveal: 'Near 0 with the noisy sensor: the long-run gain is 0.049, and the estimate is far smoother than the dots. Near 1 with the good sensor: 0.908, and the estimate follows the dots closely. The filter leans toward whichever source is more reliable. The noisy sensor is where it helps most. There the readings are typically off by 3.93 and the estimates by 1.51. With the good sensor the two figures are 0.49 and 0.50, so the filter adds almost nothing to a sensor that is already better than the motion model.' },
      { ask: 'Load "No process noise". The filter now believes its motion model completely. In the other presets the gain levels off at some value above zero. Will it level off here?',
        reveal: 'No. It starts at 0.429 and is still falling at the end of the run, where it is 0.016. Nothing ever adds uncertainty, so every measurement counts for less than the one before, and the long-run gain is 0. The estimate becomes a long-run average of everything the filter has seen.' },
      { ask: 'Load "A sudden jump". Between two steps the readings leap by 6.5 where the model expects 0.5. Decide two things before you run it. How many readings after the jump will pass before the estimate is within 1 of them? And will the shaded band widen at the jump?',
        reveal: 'Six readings, and no. The first reading after the jump is 9.5, and the estimate only gets to 5.10, which leaves it 4.40 behind. The gap then closes slowly: 3.25, 2.40, 1.78, 1.32, 0.98. At the last reading the estimate is still 0.30 behind. The band does not widen at all, because the variance never looks at the data. The gain is the same before and after the jump, so the filter gives a reading it should find almost impossible the same share as any other.' },
    ],
    run,
    report: (r) => {
      const n = r.estimates.length - 1;
      const lines = [`Tracked ${n} ${n === 1 ? 'step' : 'steps'}. Final estimate ${f2(r.estimates[n])}, give or take ${f2(2 * Math.sqrt(r.variances[n]))} (2 standard deviations).`];
      if (r.truth) lines.push(`Typical error of the raw measurements: ${f2(r.rmsMeasurement)}. Typical error of the filter's estimates: ${f2(r.rmsEstimate)}.`);
      lines.push(`Final gain ${f3(r.gains[n - 1])}; long-run gain ${f3(r.steadyGain)}.`);
      return lines.join('\n');
    },
    experiment: {
      title: 'Steps for the gain to settle as the sensor gets noisier',
      note: 'Each point is a real run with process noise 0.5, starting from a filter that knows almost nothing (a very large starting variance). The count is the number of steps at which the gain still differs from its long-run value by more than 0.001. A noisier sensor makes each reading count for less, so the filter needs a longer history before its behaviour stops changing.',
      metric: 'steps until the gain settles',
      metricLabel: 'Steps until the gain settles',
      sizeLabel: 'Measurement noise (standard deviation)',
      sizes: [0.25, 0.5, 1, 2, 4, 8, 16],
      variants: [{ id: 'q05', label: 'Process noise 0.5' }],
      input: (noise, variant, seed) => ({ measNoise: noise, procNoise: 0.5, steps: 600, seed, custom: [], startVariance: 1e6 }),
    },
  },

  logic: {
    intuition: 'Two independent, uncertain opinions about the same number can be combined into one that is better than either. The best combination is a weighted average in which each opinion is weighted by its reliability, the inverse of its variance. The Kalman filter applies that idea at every time step. One opinion is the prediction carried forward from the past. The other is the new measurement. The combined result becomes the starting point for the next prediction.',
    steps: [
      'Start with an estimate x of the state and a variance P that says how uncertain it is.',
      'Predict the state. Apply the motion model: here, add the known velocity v. This is the best guess before seeing new data.',
      'Predict the variance. Uncertainty grows while the system moves unobserved: add the process noise variance Q.',
      'Compute the Kalman gain K = P / (P + R), where R is the variance of the sensor. K is near 1 when the prediction is poor and near 0 when the sensor is poor.',
      'Update the estimate: move it from the prediction toward the measurement z by the fraction K of their difference.',
      'Update the variance: multiply it by (1 − K). It is now smaller than both the prediction variance and the sensor variance.',
      'Repeat from step 2 for the next measurement.',
    ],
    pseudocode: [
      'kalman(x, P, v, Q, R, zs):',
      '  for each reading z in zs:',
      '    # predict',
      '    x ← x + v',
      '    P ← P + Q',
      '    # update',
      '    K ← P / (P + R)',
      '    x ← x + K·(z − x)',
      '    P ← (1 − K)·P',
      '    record x and P',
      '  return the estimates',
    ],
    decisions: [
      { title: 'How large should Q and R be?', text: 'R comes from the sensor: measure a stationary target many times and take the variance. Q is harder, because it stands for everything the motion model leaves out. Too small and the filter becomes overconfident and slow to react. Too large and it follows the measurement noise. In practice Q is tuned until the differences between predictions and measurements look like noise with the variance the filter expects.' },
      { title: 'What goes in the state?', text: 'This page tracks position alone and treats the velocity as known. A real tracker usually puts position and velocity in the state, so that it can estimate the speed from position measurements. The equations keep the same form with matrices in place of numbers.' },
      { title: 'How to start?', text: 'Give the first estimate a large variance if little is known. The first gain is then close to 1 and the filter adopts the first measurement almost entirely. A confident wrong start is far worse than an unsure one.' },
    ],
    invariants: [
      'After every update the variance is smaller than both the prediction variance and the sensor variance.',
      'The estimate after an update lies between the prediction and the measurement.',
      'The sequence of gains and variances depends only on the starting variance, Q and R, never on the measurements.',
      'If the model and noise levels are correct, the estimate is unbiased: its errors average to zero.',
    ],
    edgeCases: [
      'Q = 0: the filter trusts its model completely. The gain decays like 1/k and new measurements are eventually ignored. If the real system does change, the estimate drifts away.',
      'R close to 0: the gain is close to 1 and the estimate simply follows the measurements.',
      'A missing measurement: skip the update and keep the prediction. The variance keeps growing until data returns.',
      'An outlier: one wildly wrong reading drags the estimate, since nothing in the basic filter questions a measurement. Practical systems reject readings that are improbably far from the prediction.',
      'Wrong Q or R: the estimate may still look reasonable, but the reported variance no longer describes the real error.',
      'Nonlinear motion or sensors: the formulas no longer give the true posterior. Linearizing gives the extended Kalman filter, which is an approximation.',
    ],
    correctness: 'Suppose the state before the measurement is believed to be Gaussian with mean x⁻ and variance P⁻, and the measurement is z = x + noise with Gaussian noise of variance R. Bayes\' rule gives a posterior that is again Gaussian. Its precision, the inverse of its variance, is the sum of the two precisions, 1/P⁻ + 1/R, and its mean is the precision-weighted average of x⁻ and z. Rearranged, these are exactly the update equations with K = P⁻/(P⁻ + R). The predict step is exact too, because adding a known shift and independent Gaussian noise to a Gaussian gives a Gaussian with shifted mean and summed variances. So for a linear model with Gaussian noise the filter computes the exact posterior at every step, and its mean is the estimate with the smallest possible mean squared error. If the noise is not Gaussian, the same formulas still give the best estimate among those that are linear in the measurements.',
    mistakes: [
      'Forgetting to add Q in the predict step, so the variance shrinks toward zero and the filter stops listening to its sensors.',
      'Updating the variance with the old gain, or updating it before the estimate with a mismatched gain.',
      'Confusing standard deviations with variances when setting Q and R. The formulas use variances.',
      'Using R for the wrong sensor, or the same R after the sensor\'s quality has changed.',
      'Assuming the filter is working because the output is smooth. Smooth and wrong is the usual failure of a filter with Q set too small.',
    ],
  },

  code: {
    sample: {
      input: 'Track an object that moves about 0.5 per step from eight noisy readings. Start with estimate 0 and variance 3, with process noise variance 1 and sensor variance 4. The first two steps are the worked example.',
      expected: 'step  reading   gain  estimate  variance\n   1      2.5  0.500     1.500     2.000\n   2      3.4  0.429     2.600     1.714\n   3      2.1  0.404     2.696     1.617\n   4      3.9  0.395     3.474     1.582\n   5      4.4  0.392     4.141     1.569\n   6      4.2  0.391     4.469     1.564\n   7      5.6  0.391     5.215     1.563\n   8      5.9  0.390     5.787     1.562',
    },
    breakIt: [
      { change: 'Delete the line in the predict step that adds `Q` to `P`. The gain column settles at 0.390 in the correct program. What will it do now?',
        find: { python: '        P = P + Q\n', javascript: '    P = P + Q;\n' },
        replace: { python: '', javascript: '' },
        reveal: 'It never settles. The gains run 0.429, 0.300, 0.231, 0.188, 0.158, 0.136, 0.120, 0.107, and the variance falls to 0.429 where it should level off near 1.562. Nothing adds uncertainty any more, so the filter grows surer at every step and listens to each reading less than the one before. The last estimate, 5.500, still looks reasonable next to the correct 5.787, and that is the danger: the output is smooth and plausible while the filter is going deaf. If the object changed speed now, this filter would barely react.' },
      { change: 'The sensor has a typical error of 2, so its variance is 4. Pass the typical error where the variance belongs: where the program sets `R`, change 4.0 to 2.0. Will the filter trust its sensor more or less than it should?',
        find: { python: 'Q=1.0, R=4.0, readings=readings', javascript: '0.5, 1.0, 4.0, readings' },
        replace: { python: 'Q=1.0, R=2.0, readings=readings', javascript: '0.5, 1.0, 2.0, readings' },
        reveal: 'More. The gain now starts at 0.667 and settles at 0.500 where the correct value is 0.390, so every noisy reading pulls the estimate further than it should. At step 3 the low reading of 2.1 drags the estimate back from 2.908 to 2.742, where the correct filter still rises from 2.600 to 2.696. The variance column settles at 1.000 where the correct filter reports 1.562. The correct filter is the best that can be done with this sensor, so the true uncertainty cannot be below 1.562. This one is more sure of itself than it has any right to be. The formulas use variances, and a standard deviation in their place goes unnoticed because the program still runs.' },
    ],
    python: {
      source: `def kalman_filter(x, P, v, Q, R, readings):
    """Track one number. x is the estimate and P its variance."""
    history = []
    for z in readings:
        # Predict: move by the known velocity; uncertainty grows.
        x = x + v
        P = P + Q
        # Update: blend prediction and reading by their reliability.
        K = P / (P + R)
        difference = z - x
        correction = K * difference
        x = x + correction
        P = (1 - K) * P
        history.append((z, K, x, P))
    return history


readings = [2.5, 3.4, 2.1, 3.9, 4.4, 4.2, 5.6, 5.9]
history = kalman_filter(x=0.0, P=3.0, v=0.5, Q=1.0, R=4.0, readings=readings)

print("step  reading   gain  estimate  variance")
for step, (z, K, x, P) in enumerate(history, start=1):
    print(f"{step:4d}  {z:7.1f}  {K:5.3f}  {x:8.3f}  {P:8.3f}")`,
      notes: [
        { line: 6, text: 'The motion model. Here the object is assumed to move by a known amount each step.' },
        { line: 7, text: 'Without this line the variance could only shrink, and the filter would end up ignoring its sensor.' },
        { line: 9, text: 'The Kalman gain. P is the variance of the prediction and R the variance of the sensor, so K is the prediction\'s share of the total uncertainty.' },
        { line: 12, text: 'Move the estimate toward the reading by the fraction K of their difference.' },
        { line: 13, text: 'The variance after the update is smaller than before it. Note that no reading appears in the formulas for K and P.' },
      ],
    },
    javascript: {
      source: `// Track one number. x is the estimate and P its variance.
function kalmanFilter(x, P, v, Q, R, readings) {
  const history = [];
  for (const z of readings) {
    // Predict: move by the known velocity; uncertainty grows.
    x = x + v;
    P = P + Q;
    // Update: blend prediction and reading by their reliability.
    const K = P / (P + R);
    const difference = z - x;
    const correction = K * difference;
    x = x + correction;
    P = (1 - K) * P;
    history.push([z, K, x, P]);
  }
  return history;
}

const readings = [2.5, 3.4, 2.1, 3.9, 4.4, 4.2, 5.6, 5.9];
const history = kalmanFilter(0.0, 3.0, 0.5, 1.0, 4.0, readings);

console.log("step  reading   gain  estimate  variance");
history.forEach(([z, K, x, P], i) => {
  console.log(String(i + 1).padStart(4, " ") + "  " + z.toFixed(1).padStart(7, " ") + "  " + K.toFixed(3).padStart(5, " ") +
    "  " + x.toFixed(3).padStart(8, " ") + "  " + P.toFixed(3).padStart(8, " "));
});`,
    },
    cpp: {
      source: `#include <cstdio>
#include <vector>

int main() {
    const std::vector<double> readings = {2.5, 3.4, 2.1, 3.9, 4.4, 4.2, 5.6, 5.9};
    double x = 0.0;   // estimate
    double P = 3.0;   // its variance
    const double v = 0.5, Q = 1.0, R = 4.0;

    std::printf("step  reading   gain  estimate  variance\\n");
    int step = 0;
    for (double z : readings) {
        step += 1;
        // Predict: move by the known velocity; uncertainty grows.
        x = x + v;
        P = P + Q;
        // Update: blend prediction and reading by their reliability.
        double K = P / (P + R);
        double difference = z - x;
        double correction = K * difference;
        x = x + correction;
        P = (1 - K) * P;
        std::printf("%4d  %7.1f  %5.3f  %8.3f  %8.3f\\n", step, z, K, x, P);
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'For a single state variable each step is a handful of arithmetic operations and the filter stores two numbers. In general the state is a vector of n variables with an n by n covariance matrix, and a step costs matrix multiplications and the inversion of an m by m matrix, where m is the number of measurements taken at once. The cost per step does not grow with the length of the history.',
    cases: [
      { case: 'Scalar state (this page)', time: 'O(1) per step', when: 'One estimate and one variance.' },
      { case: 'n state variables, m measurements', time: 'O(n³ + m³) per step', when: 'Propagating the covariance needs products of n by n matrices, and the gain needs the inverse of an m by m matrix. Mixed products of size n by m are also needed.' },
      { case: 'T time steps', time: 'T times the cost of one step', when: 'Each measurement is processed once and then discarded.' },
      { case: 'Steady state', time: 'O(n²) per step', when: 'For a system that does not change over time the gain converges and can be computed in advance, leaving only matrix-vector products at run time.' },
    ],
    space: 'O(n²) for the covariance matrix and O(n) for the estimate. Two numbers in the scalar case.',
    memory: 'The estimate and its covariance summarize the whole past, so no measurements need to be kept. This constant memory is what allowed the filter to run on early flight computers.',
    tradeoffs: 'The filter is exact and cheap when its assumptions hold. Its cubic cost in the state dimension becomes a burden for very large states, such as weather models with millions of variables, where ensemble approximations are used. Nonlinear extensions cost more per step and lose the guarantee of optimality.',
    assumptions: [
      'The motion and measurement models are linear, and their noises are independent, zero-mean and Gaussian with known variances Q and R.',
      'Optimality (minimum mean squared error) holds under those assumptions. With non-Gaussian noise the filter is the best linear estimator only.',
      'The general costs assume dense matrices and ordinary matrix multiplication.',
      'The experiment on this page counts steps of the scalar filter on one setting of the process noise.',
    ],
  },

  tradeoffs: {
    excels: [
      'Tracking with a reasonable linear model and sensors whose noise level is known.',
      'Fusing several sensors with different accuracies into one estimate.',
      'Real-time use on small processors: fixed, small cost per measurement.',
      'Problems that need a measure of uncertainty along with the estimate.',
    ],
    struggles: [
      'Strongly nonlinear dynamics or sensors, where the linear formulas misrepresent the uncertainty.',
      'Beliefs with several separate possibilities, which a single bell curve cannot express.',
      'Outliers and heavy-tailed noise, since every measurement is taken at face value.',
      'Systems whose noise levels are unknown or change over time.',
    ],
    misunderstandings: [
      "\"It is a moving average that smooths the data.\" A moving average knows nothing about how the object moves, so it lags behind anything that is moving. The Kalman filter predicts with a motion model first and then corrects, and its weights come from the uncertainties instead of a fixed window.",
      "\"A noisy measurement makes the filter less sure.\" In the linear filter the variance and the gain never look at the measurements. They follow a fixed sequence set by the noise levels. A wild reading moves the estimate but leaves the reported uncertainty unchanged.",
      "\"The shaded band shows where the true value is.\" It shows where the filter believes the true value is. That belief is right only if the model and the noise levels it was given are right.",
      "\"It only works if the noise is exactly bell-shaped.\" With other noise it is still the best estimator of its linear form. What it cannot handle well is a nonlinear system or a belief with several peaks.",
    ],
    pitfalls: [
      'Numerical loss of symmetry or positivity of the covariance matrix in long runs; square-root and Joseph-form updates exist to prevent it.',
      'Units: mixing metres and millimetres between Q, R and the state.',
      'Feeding the filter measurements whose errors are correlated in time while telling it they are independent.',
    ],
    constraints: [
      'Real systems are rarely linear, so deployed filters are mostly extended or unscented variants, with the linear filter as their core.',
      'Tuning Q and R takes most of the engineering effort and is checked against recorded data.',
    ],
    alternatives: [
      { id: 'particle-filter', name: 'Particle Filter', when: 'The model is nonlinear or the belief has several peaks. It represents the belief by many weighted samples at a much higher cost.' },
      { id: 'bayesian-updating', name: 'Bayesian Updating', when: 'The unknown quantity does not change over time, so no predict step is needed.' },
      { name: 'Extended and unscented Kalman filters', when: 'The model is mildly nonlinear. They approximate it locally and reuse the same predict-update structure.' },
      { name: 'Moving average or exponential smoothing', when: 'No motion model is available and a simple reduction of noise is enough. Exponential smoothing is a Kalman filter with a fixed gain and no motion.' },
    ],
    comparison: {
      columns: ['', 'Kalman filter', 'Moving average', 'Particle filter'],
      rows: [
        ['Uses a motion model', 'Yes, linear', 'No', 'Yes, any'],
        ['Belief shape', 'One bell curve', 'None kept', 'Any, as samples'],
        ['Reports uncertainty', 'Yes', 'No', 'Yes'],
        ['Cost per step', 'Small and fixed', 'Small and fixed', 'Proportional to the number of samples'],
      ],
    },
  },

  applications: [
    { title: 'Apollo navigation', status: 'established', text: 'Stanley Schmidt and colleagues at NASA Ames adapted Kalman\'s filter to the nonlinear problem of spacecraft navigation in the early 1960s. A version of it ran in the Apollo guidance computer, where it corrected the estimate of the spacecraft\'s position and velocity from optical sightings of stars and landmarks.' },
    { title: 'Satellite and inertial navigation', status: 'established', text: 'Receivers for satellite positioning, and the navigation systems of aircraft and ships, use Kalman filters to combine satellite ranges with inertial sensors. The inertial sensors carry the estimate smoothly between fixes, and the fixes stop the inertial drift.' },
    { title: 'Radar and sonar tracking', status: 'established', text: 'Tracking a target from a sequence of noisy range and bearing measurements is the textbook use: the filter predicts where the target will be at the next scan and corrects the track when the return arrives.' },
    { title: 'Robot localization and mapping', status: 'established', text: 'Mobile robots fuse wheel odometry, inertial sensors and observations of landmarks with extended Kalman filters to estimate their own pose, and early simultaneous localization and mapping systems were built on the same filter.' },
    { title: 'Time-series models in economics', status: 'established', text: 'State-space models describe an observed series as a hidden state plus noise, for example an underlying trend behind monthly figures. The Kalman filter computes the estimates of the hidden state and the likelihood used to fit such models.' },
  ],

  connections: [
    { to: 'bayesian-updating', type: 'prerequisite', why: 'The update step is Bayes\' rule for a Gaussian prior and a Gaussian measurement. The Kalman filter adds a predict step between updates because the unknown moves.' },
    { to: 'particle-filter', type: 'same-problem', why: 'Both run the same predict-update cycle on a belief about a hidden state. The Kalman filter stores the belief as a mean and variance; a particle filter stores it as samples, which removes the linear and Gaussian assumptions.' },
    { to: 'gradient-descent', type: 'related', why: 'The update x + K(z − x) is a gradient step on the squared difference between estimate and measurement, with the gain acting as a learning rate that the filter computes for itself.' },
    { to: 'linear-regression', type: 'related', why: 'Both are least-squares estimators. With no process noise and no motion, the filter reproduces least-squares fitting one data point at a time, which is known as recursive least squares.' },
    { to: 'monte-carlo', type: 'related', why: 'When the Kalman formulas do not apply, the same belief is carried by random samples, as in particle and ensemble filters. Monte Carlo replaces the exact Gaussian algebra.' },
    { to: 'rrt', type: 'related', why: 'A robot needs both: a planner such as RRT assumes the robot knows where it is, and a filter such as this one is what supplies that knowledge from noisy sensors.' },
    { to: 'concept:gaussian-distribution', type: 'prerequisite', why: 'The filter is exact because Gaussian beliefs stay Gaussian under linear motion and linear measurement, so a mean and a variance are all that must be stored.' },
    { to: 'concept:bayes-theorem', type: 'prerequisite', why: 'Each update multiplies the predicted belief by the likelihood of the measurement and renormalizes.' },
    { to: 'concept:state-space', type: 'prerequisite', why: 'The method assumes a hidden state that evolves by a known rule and is observed through noisy measurements.' },
    { to: 'concept:linear-algebra', type: 'advanced', why: 'With several state variables the same equations hold with vectors and matrices, and the gain requires a matrix inverse.' },
    { to: 'discipline:statistics', type: 'application', why: 'State-space time-series models are estimated by running this filter over the data.' },
    { to: 'discipline:finance', type: 'application', why: 'Models with unobserved components behind noisy market data are estimated with Kalman filtering.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'The sensor on a tracker fails partially and its readings become ten times noisier. The filter is told the new noise level. What happens to the Kalman gain?',
      options: ['It rises, so the filter can catch up with the noise', 'It falls, so each reading moves the estimate less', 'It stays the same, because the gain does not depend on the sensor', 'It becomes negative'],
      answer: 1,
      explain: [
        'Following noisy readings more closely would make the estimate worse.',
        'Correct. The gain is P / (P + R). A larger sensor variance R makes it smaller, so the filter leans on its prediction.',
        'R appears directly in the formula for the gain.',
        'The gain is a ratio of positive quantities and always lies between 0 and 1.',
      ],
    },
    {
      type: 'predict',
      q: 'The process noise is set to zero and the measurement noise to 1. Ten readings arrive exactly where the motion model expects them: 0.5, 1, 1.5 and so on up to 5. The eleventh reads 15.5, which is 10 above the prediction of 5.5. Where does the estimate land?',
      options: ['At about 15.5: a reading that far off overrides the prediction', 'At about 6.4: the filter moves less than a tenth of the way', 'At about 9.4: the filter moves about 40% of the way', 'At about 10.5: halfway between the prediction and the reading'],
      answer: 1,
      explain: [
        'The gain depends only on the variances, never on how far off a reading is. A surprising reading gets the same share as any other, and that share is never more than 1.',
        'Correct. With no process noise nothing ever adds uncertainty, so after ten readings the filter is very sure of itself and the gain has fallen to 0.088. The estimate moves 0.088 × 10 = 0.88, from 5.5 to 6.38. If the object really has jumped, this filter will take a long time to follow.',
        'That is what a process noise of 0.5 gives. The gain then settles at 0.390 and the estimate lands on 9.40. With the process noise at zero the gain keeps falling instead of settling.',
        'Halfway needs a gain of 0.5, which means the prediction and the sensor are equally uncertain. After ten readings with no process noise, the prediction is far more certain than the sensor.',
      ],
      tryInput: { measNoise: 1, procNoise: 0, custom: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 15.5] },
      check: (r, c) => {
        const withNoise = run({ measNoise: 1, procNoise: 0.5, custom: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 15.5] }, QUIET);
        return (c.updates === 11 && Math.abs(r.estimates[10] - 5) < 1e-12 && f2(r.estimates[11]) === '6.38' && f3(r.gains[10]) === '0.088' && r.steadyGain === 0
          && f2(withNoise.estimates[11]) === '9.40' && f3(withNoise.gains[10]) === '0.390') || `estimate ${f2(r.estimates[11])}, gain ${f3(r.gains[10])}; with process noise ${f2(withNoise.estimates[11])}`;
      },
    },
    {
      type: 'debug',
      q: 'After a few hundred steps this filter barely reacts to its sensor, and its estimate drifts away from an object whose speed varies. What is missing?',
      code: `for z in readings:
    x = x + v
    K = P / (P + R)
    x = x + K * (z - x)
    P = (1 - K) * P`,
      options: ['The gain should be R / (P + R)', 'The predict step never adds the process noise Q to P', 'x should be updated after P', 'v should be multiplied by K'],
      answer: 1,
      explain: [
        'That would give the weight of the prediction, not of the measurement, and the estimate would move the wrong amount.',
        'Correct. Without `P = P + Q`, the variance only ever shrinks. The gain decays toward zero and the filter stops correcting itself.',
        'The order shown is fine, as long as both use the same gain.',
        'The velocity belongs to the motion model and has nothing to do with the gain.',
      ],
    },
    {
      type: 'choice',
      q: 'Before an update the prediction has variance 4 and the sensor has variance 4. What is the variance of the estimate after the update?',
      options: ['8', '4', '2', '0'],
      answer: 2,
      explain: [
        'Variances add when uncertainties accumulate, as in the predict step. Combining two sources of information reduces uncertainty.',
        'The update always leaves less variance than either source had.',
        'Correct. The gain is 4 / (4 + 4) = 0.5 and the new variance is (1 − 0.5) × 4 = 2. Two equally good sources halve the variance.',
        'Two noisy sources cannot produce certainty.',
      ],
    },
    {
      type: 'challenge',
      title: 'Estimate the velocity too',
      prompt: 'Extend the filter so that the state is the pair (position, velocity) and only position is measured. Use the motion model position ← position + velocity, velocity ← velocity, with a 2 by 2 covariance matrix P, and write out the predict and update steps with matrices. Start the filter at position 0 and velocity 0 with P = [[3, 0], [0, 1]], and use Q = [[0.01, 0], [0, 0.01]] and a sensor variance of R = 4. First test it on twelve noise-free readings from an object that starts at 0 and moves at 0.8 per step: 0.8, 1.6, 2.4 and so on up to 9.6. What is the velocity estimate after 1, 4, 8 and 12 readings? Then add sensor noise of standard deviation 2 to the readings and plot how the velocity estimate heads toward 0.8 although velocity is never measured.',
      expect: 'On the noise-free readings the velocity estimate is 0.100 after 1 reading, 0.594 after 4, 0.762 after 8 and 0.794 after 12. The position estimate after 12 readings is 9.532, against a true position of 9.6. The first update uses a position gain of 0.501 and a velocity gain of 0.125. By the twelfth they have fallen to 0.303 and 0.047. With noise of standard deviation 2 the path is much rougher. Four random sets of twelve readings ended with velocity estimates of 0.51, 0.69, 0.59 and 0.85, and the same four carried on to 60 readings ended at 0.94, 0.75, 0.73 and 0.88. The estimate heads toward 0.8 and then wanders around it.',
      hints: ['With F = [[1, 1], [0, 1]] and H = [1, 0], predict with x ← F x and P ← F P Fᵀ + Q, then K = P Hᵀ / (H P Hᵀ + R).', 'The off-diagonal entry of P is what lets a position measurement correct the velocity.'],
    },
  ],

  compare: {
    idea: 'Alternate a model-based prediction with a correction toward each measurement, weighted by the two uncertainties.',
    requires: 'A model in which movement and readings are simple proportions, and known sizes for the noise in each. Under those conditions, and with bell-shaped noise, no estimate is better.',
    sensitivity: 'Sensitive to the assumed noise levels Q and R, and to how well the linear model matches the real system.',
    memory: 'O(n²) for n state variables: the estimate and its covariance. No history is stored.',
    difficulty: 'moderate',
    difficultyNote: 'Five lines in one dimension. The matrix form and the tuning take experience.',
    limits: 'Only for simple proportional models and beliefs with a single best guess. It takes a wildly wrong reading at face value.',
    useWhen: 'You are tracking something that changes from noisy readings, and have a reasonable straight-line model of how it moves.',
  },

  advanced: {
    history: 'Rudolf Kalman published the discrete-time filter in 1960, formulating estimation in terms of a system\'s state instead of the frequency-domain methods of Norbert Wiener that preceded it. Kalman and Richard Bucy published the continuous-time version in 1961. Stanley Schmidt of NASA Ames recognized that the method suited the navigation problem of the Apollo programme and extended it to nonlinear dynamics, and a filter of this kind was built into the software of the Apollo onboard computer. The filter then spread through aerospace and into every field with noisy sequential data. Related recursive estimators had been described shortly before, notably by Peter Swerling.',
    derivation: 'Model, for a scalar state: $x_k = x_{k-1} + v + w_k$ with $w_k \\sim \\mathcal{N}(0, Q)$, and $z_k = x_k + n_k$ with $n_k \\sim \\mathcal{N}(0, R)$.\n\n**Predict.** If $x_{k-1} \\sim \\mathcal{N}(\\hat x, P)$, then $x_k \\sim \\mathcal{N}(\\hat x + v,\\; P + Q)$. Write $\\hat x^- = \\hat x + v$ and $P^- = P + Q$.\n\n**Update.** The posterior density is proportional to prior times likelihood:\n\n$$p(x_k \\mid z_k) \\propto \\exp\\!\\left(-\\frac{(x_k - \\hat x^-)^2}{2P^-}\\right)\\exp\\!\\left(-\\frac{(z_k - x_k)^2}{2R}\\right).$$\n\nCompleting the square in $x_k$ shows this is Gaussian with\n\n$$\\frac{1}{P} = \\frac{1}{P^-} + \\frac{1}{R}, \\qquad \\hat x = P\\left(\\frac{\\hat x^-}{P^-} + \\frac{z_k}{R}\\right).$$\n\nSetting $K = \\dfrac{P^-}{P^- + R}$ turns these into the usual form\n\n$$\\hat x = \\hat x^- + K\\,(z_k - \\hat x^-), \\qquad P = (1 - K)\\,P^-.$$\n\nIn several dimensions, with motion matrix $F$, measurement matrix $H$ and covariances $Q$, $R$: $\\hat x^- = F\\hat x$, $P^- = FPF^\\top + Q$, $K = P^-H^\\top(HP^-H^\\top + R)^{-1}$, $\\hat x = \\hat x^- + K(z - H\\hat x^-)$, $P = (I - KH)P^-$.',
    proof: 'Convergence of the variance in the scalar case. Let $M_k = P_{k-1} + Q$ be the prediction variance. The update gives $P_k = \\dfrac{M_k R}{M_k + R}$, so\n\n$$M_{k+1} = Q + \\frac{M_k R}{M_k + R} = g(M_k).$$\n\nTake $Q > 0$. The map $g$ is increasing and concave for $M > 0$, with $g(0) = Q > 0$ and $g(M) < Q + R$. It therefore has exactly one positive fixed point, the positive root of $M^2 - QM - QR = 0$:\n\n$$M_\\infty = \\frac{Q + \\sqrt{Q^2 + 4QR}}{2},$$\n\nand the iteration converges to it monotonically from any starting value. The gain converges to $K_\\infty = M_\\infty/(M_\\infty + R)$ and the posterior variance to $P_\\infty = K_\\infty R$. None of these quantities involve the measurements.',
    complexityProof: 'In $n$ dimensions the predict step forms $FPF^\\top$, two products of $n \\times n$ matrices, costing $O(n^3)$. The update forms $HP^-H^\\top + R$, an $m \\times m$ matrix, and solves a linear system with it, costing $O(m^3)$, plus products of sizes $n \\times m$ costing $O(n^2 m + n m^2)$. Storage is the $n \\times n$ covariance. Nothing depends on the number of past measurements.',
    variants: [
      { name: 'Extended Kalman filter', text: 'Linearizes a nonlinear motion or measurement model around the current estimate at every step. The standard choice for navigation.' },
      { name: 'Unscented Kalman filter', text: 'Propagates a small set of chosen points through the nonlinear model instead of linearizing it, which is often more accurate.' },
      { name: 'Information filter', text: 'Stores the inverse of the covariance. Updates become additions, which is convenient when many sensors report at once.' },
      { name: 'Kalman smoother (Rauch-Tung-Striebel)', text: 'Runs a backward pass after the filter so that each estimate also uses later measurements. Used when the data can be processed after the fact.' },
      { name: 'Ensemble Kalman filter', text: 'Represents the covariance by a set of sample states. Used in weather forecasting, where the state has millions of variables.' },
      { name: 'Alpha-beta filter', text: 'A filter with fixed, hand-chosen gains for position and velocity. It is what a Kalman filter for a constant-velocity target becomes in steady state.' },
    ],
    implementation: 'Keep the covariance symmetric, for example by using the Joseph form of the update or a square-root formulation. Check the innovations, the differences between measurements and predictions: if the filter is tuned correctly they are zero-mean, uncorrelated in time, and have the variance the filter predicts. Gate out measurements whose innovation is implausibly large.',
    benchmarking: 'Evaluate on simulated data where the truth is known, over many runs: the mean squared error should match the filter\'s own variance, and the normalized squared error should average 1. The tests of this lesson make both checks. On real data, examine the innovation sequence.',
    references: [
      { authors: 'R. E. Kalman', year: 1960, title: 'A new approach to linear filtering and prediction problems', venue: 'Journal of Basic Engineering 82(1), 35-45' },
      { authors: 'R. E. Kalman and R. S. Bucy', year: 1961, title: 'New results in linear filtering and prediction theory', venue: 'Journal of Basic Engineering 83(1), 95-108' },
      { authors: 'L. A. McGee and S. F. Schmidt', year: 1985, title: 'Discovery of the Kalman filter as a practical tool for aerospace and industry', venue: 'NASA Technical Memorandum 86847' },
      { authors: 'S. Thrun, W. Burgard and D. Fox', year: 2005, title: 'Probabilistic Robotics', venue: 'MIT Press' },
    ],
    furtherReading: [
      'G. Welch and G. Bishop, "An introduction to the Kalman filter", Technical Report TR 95-041, University of North Carolina at Chapel Hill.',
      'A. C. Harvey, *Forecasting, Structural Time Series Models and the Kalman Filter* (Cambridge University Press, 1989).',
    ],
  },

  tests: [
    { name: 'the scalar predict and update equations hold at every step, in gain form and in precision form', input: { measNoise: 2, procNoise: 0.5, steps: 40, seed: 5, custom: [] },
      check: (r, c) => {
        if (c.updates !== 40 || r.estimates.length !== 41) return `expected 40 updates, got ${c.updates}`;
        for (let k = 1; k <= 40; k++) {
          const xp = r.estimates[k - 1] + r.velocity, Pp = r.variances[k - 1] + r.Q, z = r.measurements[k - 1];
          if (Math.abs(r.predictions[k].x - xp) > 1e-12 || Math.abs(r.predictions[k].P - Pp) > 1e-12) return `step ${k}: wrong prediction`;
          const K = Pp / (Pp + r.R);
          if (Math.abs(r.gains[k - 1] - K) > 1e-12) return `step ${k}: gain ${r.gains[k - 1]}, expected ${K}`;
          if (Math.abs(r.estimates[k] - (xp + K * (z - xp))) > 1e-12) return `step ${k}: wrong estimate`;
          if (Math.abs(r.variances[k] - (1 - K) * Pp) > 1e-12) return `step ${k}: wrong variance`;
          // Independent form: precisions add, and the mean is the precision-weighted average.
          const precision = 1 / Pp + 1 / r.R;
          if (Math.abs(1 / r.variances[k] - precision) > 1e-9) return `step ${k}: precisions do not add`;
          if (Math.abs(r.estimates[k] - (xp / Pp + z / r.R) / precision) > 1e-9) return `step ${k}: not the precision-weighted mean`;
          if (!(r.variances[k] < Pp && r.variances[k] < r.R)) return `step ${k}: variance did not shrink below both sources`;
          if ((r.estimates[k] - xp) * (r.estimates[k] - z) > 1e-12) return `step ${k}: estimate is not between prediction and measurement`;
        }
        return true;
      } },
    { name: 'the variance and gain converge to the closed-form steady state', input: { measNoise: 2, procNoise: 0.5, steps: 80, seed: 5, custom: [] },
      check: (r) => {
        const M = (0.25 + Math.sqrt(0.25 * 0.25 + 4 * 0.25 * 4)) / 2, K = M / (M + 4), P = K * 4;
        if (Math.abs(r.variances[80] - P) > 1e-9 || Math.abs(r.gains[79] - K) > 1e-9) return `variance ${r.variances[80]} vs ${P}, gain ${r.gains[79]} vs ${K}`;
        if (Math.abs(r.steadyGain - K) > 1e-12 || Math.abs(r.steadyVariance - P) > 1e-12) return 'reported steady state is wrong';
        for (let k = 1; k < 80; k++) if (r.gains[k] > r.gains[k - 1] + 1e-15) return `gain rose at step ${k + 1}`;
        return true;
      } },
    { name: 'averaged over 300 runs, the estimate error is smaller than the raw measurement error', input: { measNoise: 2, procNoise: 0.5, steps: 30, seed: 5, custom: [] },
      check: () => {
        let se = 0, sm = 0, wins = 0;
        for (let s = 1; s <= 300; s++) {
          const r = run({ measNoise: 2, procNoise: 0.5, steps: 60, seed: 4000 + s, custom: [] }, QUIET);
          se += r.rmsEstimate ** 2; sm += r.rmsMeasurement ** 2;
          if (r.rmsEstimate < r.rmsMeasurement) wins++;
        }
        const ratio = se / sm;       // theory: close to steady-state variance / R ≈ 0.22
        return (ratio < 0.4 && ratio > 0.15 && wins >= 290) || `mean squared error ratio ${ratio.toFixed(3)}, filter better in ${wins} of 300 runs`;
      } },
    { name: 'the reported variance is honest: normalized squared error averages 1 over 400 runs', input: { measNoise: 1.5, procNoise: 0.8, steps: 30, seed: 5, custom: [] },
      check: () => {
        let sum = 0, count = 0;
        for (let s = 1; s <= 400; s++) {
          const r = run({ measNoise: 1.5, procNoise: 0.8, steps: 40, seed: 9000 + s, custom: [] }, QUIET);
          for (let k = 0; k <= 40; k++) { sum += (r.estimates[k] - r.truth[k]) ** 2 / r.variances[k]; count++; }
        }
        const nees = sum / count;
        return Math.abs(nees - 1) < 0.1 || `normalized squared error averaged ${nees.toFixed(3)}, expected 1`;
      } },
    { name: 'the worked example: readings 2.5 and 3.4 with Q = 1 and R = 4', input: { custom: [2.5, 3.4], measNoise: 2, procNoise: 1 },
      check: (r) => {
        const ok = r.truth === null && r.predictions[1].x === 0.5 && r.predictions[1].P === 4 && r.gains[0] === 0.5 && r.estimates[1] === 1.5 && r.variances[1] === 2
          && r.predictions[2].x === 2 && r.predictions[2].P === 3 && Math.abs(r.gains[1] - 3 / 7) < 1e-12 && Math.abs(r.estimates[2] - 2.6) < 1e-12 && Math.abs(r.variances[2] - 12 / 7) < 1e-12
          && f2(r.gains[1]) === '0.43' && f2(r.variances[2]) === '1.71';
        return ok || `estimates ${r.estimates}, variances ${r.variances}, gains ${r.gains}`;
      } },
    { name: 'with no process noise the gain falls like 1 / (k + R / P0)', input: { measNoise: 2, procNoise: 0, steps: 60, seed: 5, custom: [] },
      check: (r) => {
        for (let k = 1; k <= 60; k++) if (Math.abs(r.gains[k - 1] - 1 / (k + 4 / 3)) > 1e-12) return `gain at step ${k} is ${r.gains[k - 1]}`;
        return (r.gains[59] < 0.02 && r.steadyGain === 0) || `final gain ${r.gains[59]}`;
      } },
    { name: 'the gains do not depend on the measurements', input: { measNoise: 2, procNoise: 0.5, steps: 30, seed: 5, custom: [] },
      check: (r) => {
        const other = run({ measNoise: 2, procNoise: 0.5, steps: 30, seed: 77, custom: [] }, QUIET);
        const jump = run({ measNoise: 2, procNoise: 0.5, custom: Array.from({ length: 30 }, (_, i) => (i < 15 ? 0 : 50)) }, QUIET);
        return (r.gains.every((g, i) => g === other.gains[i] && g === jump.gains[i]) && r.estimates[30] !== other.estimates[30]) || 'gains changed with the data';
      } },
    { name: 'presets: long-run gains near 0.05 (noisy sensor) and 0.9 (good sensor)', input: { measNoise: 4, procNoise: 0.2, steps: 40, seed: 5, custom: [] },
      check: (r) => {
        const good = run({ measNoise: 0.5, procNoise: 1.5, steps: 40, seed: 5, custom: [] }, QUIET);
        return (Math.abs(r.steadyGain - 0.05) < 0.005 && Math.abs(good.steadyGain - 0.9) < 0.01) || `gains ${r.steadyGain} and ${good.steadyGain}`;
      } },
    { name: 'things to try: typical tracking starts at gain 0.448, twice the long-run 0.221, and settles from step 12', input: { measNoise: 2, procNoise: 0.5, steps: 30, seed: 5, custom: [] },
      check: (r, c) => {
        const first = r.gains.slice(0, 5).map(f3).join(' ');
        return (first === '0.448 0.338 0.286 0.258 0.243' && f3(r.steadyGain) === '0.221' && c['steps until the gain settles'] === 11 && Math.abs(r.gains[11] - r.steadyGain) <= 1e-3
          && f2(2 * Math.sqrt(r.variances[0])) === '3.46' && f2(2 * Math.sqrt(r.variances[30])) === '1.88') || `gains ${first}, settles after ${c['steps until the gain settles']} steps`;
      } },
    { name: 'things to try: long-run gains 0.049 and 0.908, typical errors 3.93 against 1.51 and 0.49 against 0.50', input: { measNoise: 4, procNoise: 0.2, steps: 40, seed: 5, custom: [] },
      check: (r) => {
        const good = run({ measNoise: 0.5, procNoise: 1.5, steps: 40, seed: 5, custom: [] }, QUIET);
        const got = [f3(r.steadyGain), f2(r.rmsMeasurement), f2(r.rmsEstimate), f3(good.steadyGain), f2(good.rmsMeasurement), f2(good.rmsEstimate)].join(' ');
        return got === '0.049 3.93 1.51 0.908 0.49 0.50' || got;
      } },
    { name: 'things to try: with no process noise the gain goes from 0.429 to 0.016 in 60 steps', input: { measNoise: 2, procNoise: 0, steps: 60, seed: 5, custom: [] },
      check: (r) => (f3(r.gains[0]) === '0.429' && f3(r.gains[59]) === '0.016' && r.steadyGain === 0) || `gains ${f3(r.gains[0])} and ${f3(r.gains[59])}` },
    { name: 'things to try: after the sudden jump the estimate trails by 4.40, 3.25, 2.40, 1.78, 1.32, 0.98 and the variance never rises', input: { measNoise: 1, procNoise: 0.3, custom: [0.5, 1, 1.5, 2, 2.5, 3, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14] },
      check: (r) => {
        const gaps = r.measurements.map((z, i) => f2(z - r.estimates[i + 1]));
        const rising = r.variances.findIndex((v, i) => i > 0 && v > r.variances[i - 1]);
        return (gaps.slice(6, 12).join(' ') === '4.40 3.25 2.40 1.78 1.32 0.98' && gaps[15] === '0.30' && f2(r.estimates[7]) === '5.10' && rising === -1) || `gaps ${gaps.slice(6).join(' ')}, variance rose at step ${rising}`;
      } },
  ],
};
