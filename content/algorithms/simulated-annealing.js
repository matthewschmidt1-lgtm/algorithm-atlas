import { landscapeById, landscapeOptions, landscapeLayers, fromUnit } from '../../js/lib/landscapes.js';
import { makeRng } from '../../js/lib/rng.js';

const f3 = (v) => (Math.abs(v) >= 1000 ? v.toExponential(2) : v.toFixed(Math.abs(v) < 0.01 && v !== 0 ? 5 : 3));
const pct = (p) => (p >= 0.995 ? '100%' : p >= 0.01 ? `${Math.round(p * 100)}%` : p >= 0.0001 ? `${(p * 100).toFixed(2)}%` : 'less than 0.01%');

// The Metropolis acceptance rule: a better move is always taken, a worse move by `delta`
// is taken with probability exp(-delta / T).
const acceptChance = (delta, T) => (delta <= 0 ? 1 : Math.exp(-delta / T));

function run(input, t) {
  const L = landscapeById[input.landscape];
  if (!L) throw new Error('Unknown landscape.');
  const T0 = input.temp, cooling = input.cooling, steps = Math.round(input.steps), size = input.stepSize;
  if (!(T0 > 0)) throw new Error('The starting temperature must be greater than zero.');
  if (!(cooling > 0 && cooling <= 1)) throw new Error('The cooling rate must be between 0 and 1.');
  const rng = makeRng(input.seed);
  let [x, y] = fromUnit(L, input.startX, input.startY);
  let value = L.f(x, y);
  t.count('function evaluations');
  const start = { x, y, value };
  let best = { x, y, value, step: 0 };
  let T = T0;
  const path = [[x, y]];
  const values = [value], bests = [value], temps = [T0];
  let accepted = 0, uphillAccepted = 0, uphillProposed = 0, rejected = 0, outside = 0;
  const base = landscapeLayers(L);
  // One shared axis range for the small chart, so the picture does not rescale between frames.
  const yRange = [0, Math.max(value, T0, 1e-9) * 1.08];

  const views = (move) => {
    const layers = base.slice();
    layers.push({ type: 'line', points: path.slice(), role: 'terracotta', width: 1.1, alpha: 0.5 });
    layers.push({ type: 'points', points: path.slice(0, -1), role: 'terracotta', r: 2, alpha: 0.7 });
    if (move) {
      const [fx, fy] = move.from;
      layers.push({ type: 'polygon', points: [[fx - size, fy - size], [fx + size, fy - size], [fx + size, fy + size], [fx - size, fy + size]], role: 'muted', width: 1, dash: [3, 4], alpha: 0.7 });
      layers.push({ type: 'segments', segments: [[fx, fy, move.to[0], move.to[1]]], role: move.ok ? 'done' : 'rejected', width: 2.2, arrow: true });
      if (!move.ok) layers.push({ type: 'points', points: [move.to], role: 'rejected', r: 4, hollow: true });
    }
    layers.push({ type: 'points', points: [[best.x, best.y]], role: 'ink', r: 4 });
    layers.push({ type: 'points', points: [[x, y]], role: 'terracotta', r: 5.5, ring: true });
    return [
      { kind: 'scene', title: 'Random walk over the surface', x: L.x, y: L.y, aspect: 0.6, axes: { xLabel: 'x', yLabel: 'y' }, layers,
        legend: [{ label: 'contours of equal value', role: 'sage' }, { label: 'known minimum', role: 'forest' }, { label: 'current point and its trail', role: 'terracotta' }, { label: 'best so far', role: 'ink' },
          { label: 'accepted move', role: 'done' }, { label: 'refused move', role: 'rejected' }, { label: 'where a proposal can land', role: 'muted' }] },
      { kind: 'scene', title: 'Value and temperature at each step', x: [0, Math.max(10, steps)], y: yRange, aspect: 0.2, axes: { xLabel: 'step' },
        layers: [
          { type: 'line', points: temps.map((v, i) => [i, v]), role: 'ochre', width: 1.6, dash: [5, 4] },
          { type: 'line', points: values.map((v, i) => [i, v]), role: 'terracotta', width: 1.6 },
          { type: 'line', points: bests.map((v, i) => [i, v]), role: 'ink', width: 2 },
        ],
        legend: [{ label: 'value at the current point', role: 'terracotta' }, { label: 'best value so far', role: 'ink' }, { label: 'temperature (same units as the value)', role: 'ochre' }] },
    ];
  };

  t.frame(() => ({ line: 1, note: `Start at (${f3(x)}, ${f3(y)}), where the value is ${f3(value)}. The goal is the lowest point on the map. The temperature starts at ${f3(T0)} and is multiplied by ${cooling} after every step.`,
    views: views(null), vars: { step: 0, T: f3(T), value: f3(value), best: f3(best.value) } }));

  for (let k = 1; k <= steps; k++) {
    const from = [x, y];
    const px = x + size * (2 * rng.next() - 1);
    const py = y + size * (2 * rng.next() - 1);
    const inside = px >= L.x[0] && px <= L.x[1] && py >= L.y[0] && py <= L.y[1];
    const Tk = T;
    let outcome, delta = null, p = null, u = null, pv = null, newBest = false;
    if (!inside) {
      outcome = 'outside';
      rejected++; outside++;
    } else {
      pv = L.f(px, py);
      t.count('function evaluations');
      delta = pv - value;
      if (delta <= 0) outcome = 'better';
      else {
        uphillProposed++;
        p = acceptChance(delta, Tk);
        u = rng.next();
        outcome = u < p ? 'uphill' : 'refused';
      }
      if (outcome === 'refused') rejected++;
      else {
        x = px; y = py; value = pv;
        accepted++;
        if (outcome === 'uphill') { uphillAccepted++; t.count('uphill moves accepted'); }
        if (value < best.value) { best = { x, y, value, step: k }; newBest = true; }
      }
    }
    const ok = outcome === 'better' || outcome === 'uphill';
    if (ok) path.push([x, y]);
    T = Tk * cooling;
    values.push(value); bests.push(best.value); temps.push(T);
    if (value * 1.08 > yRange[1]) yRange[1] = value * 1.08;

    t.frame(() => {
      const at = `(${f3(px)}, ${f3(py)})`;
      let note;
      if (outcome === 'outside') note = `Step ${k}: the proposal ${at} lies outside the map, so it is refused without being evaluated. The point stays where it is.`;
      else if (outcome === 'better') note = `Step ${k}: the proposal ${at} has value ${f3(pv)}, ${delta === 0 ? 'the same as' : `lower than the current ${f3(pv - delta)} by ${f3(-delta)}`}. A move that is not worse is always accepted.${newBest ? ' It is the **lowest value seen so far**.' : ''}`;
      else if (outcome === 'uphill') note = `Step ${k}: the proposal ${at} has value ${f3(pv)}, **worse by ${f3(delta)}**. At temperature ${f3(Tk)} the chance of accepting a move this much worse is ${pct(p)}. The random draw ${u.toFixed(3)} is below ${p.toFixed(3)}, so the uphill move is **accepted**.`;
      else note = `Step ${k}: the proposal ${at} has value ${f3(pv)}, worse by ${f3(delta)}. At temperature ${f3(Tk)} the chance of accepting a move this much worse is ${pct(p)}. The random draw ${u.toFixed(3)} is not below ${p < 0.0005 ? p.toExponential(1) : p.toFixed(3)}, so the move is **refused**.`;
      return {
        line: outcome === 'outside' ? [3, 8] : outcome === 'refused' ? [3, 4, 5, 8] : newBest ? [3, 4, 5, 6, 7, 8] : [3, 4, 5, 6, 8],
        note, views: views({ from, to: [px, py], ok }),
        vars: { step: k, T: f3(Tk), value: f3(value), best: f3(best.value), ...(p === null ? {} : { 'accept chance': pct(p) }) },
      };
    });
  }

  t.frame(() => ({ line: 9, note: `Finished ${steps} steps. The best point seen was (${f3(best.x)}, ${f3(best.y)}) with value **${f3(best.value)}**, found at step ${best.step}. ${uphillAccepted} of ${uphillProposed} uphill proposals were accepted. The lowest value anywhere on this map is ${f3(L.fmin)}. A different seed gives a different walk and often a different answer.`,
    views: views(null), vars: { steps, T: f3(T), value: f3(value), best: f3(best.value) } }));

  return {
    bestValue: best.value, x: best.x, y: best.y, bestStep: best.step,
    finalValue: value, finalX: x, finalY: y, startValue: start.value,
    accepted, rejected, uphillAccepted, uphillProposed, outside, steps,
    finalTemperature: T, values, bests, temps,
  };
}

// Median and counts over a range of seeds, used by one test to pin the figures quoted in viz.tryThis.
function seedScan(overrides, from, to) {
  const quiet = { count() {}, frame() {} };
  const bests = [];
  let centre = 0, under5 = 0;
  for (let seed = from; seed <= to; seed++) {
    const r = run({ ...DEFAULTS, ...overrides, seed }, quiet);
    bests.push(r.bestValue);
    if (Math.abs(r.x) < 0.5 && Math.abs(r.y) < 0.5) centre++;
    if (r.bestValue < 5) under5++;
  }
  bests.sort((a, b) => a - b);
  return { centre, under5, lowest: bests[0], median: (bests[(bests.length >> 1) - 1] + bests[bests.length >> 1]) / 2 };
}

const DEFAULTS = { landscape: 'rastrigin', seed: 46, temp: 40, cooling: 0.985, steps: 300, stepSize: 0.6, startX: -0.85, startY: 0.7 };

export default {
  meta: {
    id: 'simulated-annealing',
    name: 'Simulated Annealing',
    aliases: ['SA', 'annealing', 'Metropolis annealing', 'stochastic local search'],
    kind: 'heuristic',
    discipline: 'optimization',
    alsoIn: [
      { id: 'physics', why: 'The acceptance rule and the idea of slow cooling come from statistical mechanics, where they describe matter settling into low-energy states.' },
      { id: 'ai', why: 'It is one of the standard local search methods for planning, scheduling and constraint problems whose solutions are discrete arrangements.' },
    ],
    subfield: 'Global optimization',
    family: 'Stochastic local search',
    lab: 'optimization',
    compareGroup: 'landscape-minimization',
    year: 1983,
    authors: 'Scott Kirkpatrick, C. Daniel Gelatt and Mario P. Vecchi',
    summary: 'Searches for a low point by a random walk that always accepts improvements and accepts worse moves with a probability that falls as a temperature is lowered.',
    difficulty: 'intermediate',
    order: 510,
    paradigms: ['local-search', 'randomized-sampling'],
    randomized: true,
    approximate: true,
    time: { best: 'One function evaluation per step', average: 'As many steps as the budget allows', worst: 'No finite bound for reaching the global minimum', class: 'iterative' },
    space: { worst: 'O(d)', class: 'linear' },
    tags: {
      problems: ['find the lowest point', 'escape a local minimum', 'minimize a function without a gradient', 'find a good arrangement', 'travelling salesman', 'global optimization'],
      techniques: ['random proposals', 'acceptance probability', 'cooling schedule', 'local search'],
      applications: ['engineering design', 'logistics', 'scientific computing', 'bioinformatics'],
    },
    prerequisites: ['gradient-descent', 'concept:local-search', 'concept:probability', 'concept:randomization'],
  },

  bigIdea: {
    simple: "Simulated annealing is a way to search for the best answer when there are far too many possibilities to check them all. Picture a hiker in thick fog who wants the lowest point in a range of hills. A hiker who only ever walks downhill stops in the first dip they reach. A much deeper valley may lie just over the next ridge, and they will never see it. Simulated annealing lets the hiker walk uphill now and then. At each step the hiker picks a random spot nearby. If it is lower, they go there. If it is higher, they might still go, by chance. Early on they say yes to uphill steps often, so they roam widely and climb out of shallow dips. As time passes they grow stricter and say yes less and less. By the end they only walk downhill and settle into the low place they have found. The name comes from annealing: heating a metal and cooling it slowly, so that its atoms settle into an orderly pattern.",
    what: 'Simulated annealing looks for a low point of a function by a random walk. At each step it proposes a random nearby point. A point that is no worse is always accepted. A worse point is accepted with a probability that shrinks with how much worse it is, and with a control number called the temperature that is lowered gradually during the run.',
    why: 'Plain local search stops at the first dip it finds. In 1983 Scott Kirkpatrick, Daniel Gelatt and Mario Vecchi, working at IBM, proposed borrowing a simulation method from statistical physics, published by Nicholas Metropolis and colleagues in 1953, and using it on hard design problems such as placing and wiring the components of a computer. The method only needs to compare two candidate solutions, so it works where no gradient exists.',
    when: 'Use it when the search space has many local minima, when the objective is a black box with no usable gradient, or when solutions are discrete arrangements such as orderings and layouts. If the function is smooth and has a single valley, [gradient descent](#/algorithm/gradient-descent) is far more efficient. If you can afford to keep many candidates at once, a [genetic algorithm](#/algorithm/genetic-algorithm) is an alternative.',
    interesting: 'The acceptance rule was not invented for optimization. It comes from simulating matter at a fixed temperature, where it makes a random walk visit each state as often as physics says it should. Lowering the temperature shifts those visits toward states of low energy. Simulated annealing treats the function value as the energy and lowers the temperature on purpose.',
    where: 'Chip placement tools, the refinement of molecular structures against measured data, and research on scheduling and timetabling have all used it. It is also a standard baseline for combinatorial problems such as the travelling salesman problem.',
    analogy: {
      title: 'A marble on a shaken tray',
      text: 'Picture a tray moulded with many dents of different depths, and a marble that you want in the deepest dent without looking. If you hold the tray still, the marble rolls into the nearest dent and stays there. So you shake the tray. Hard shaking throws the marble out of any dent, shallow or deep. Then you shake more and more gently. There comes a stage where the shaking can still knock the marble out of a shallow dent but not out of a deep one, so the marble tends to collect in a deep one. When the shaking stops it rests there. The strength of the shaking is the temperature.',
      limits: "A real marble rolls smoothly and carries momentum. The algorithm has neither: it proposes a jump, then accepts or refuses it by a rule of chance. The tray also suggests that patience always wins the deepest dent, and that is not true. With any cooling schedule fast enough to be practical, the search often ends in a good dent that is not the best one. And many real uses have no surface at all. The position is an arrangement, such as the order in which to visit cities, and a nearby point is the same arrangement with one small change.",
    },
  },

  example: {
    setup: "A walker wants the lowest of five stones in a row. Their heights are A = 6, B = 3, C = 5, D = 1 and E = 4. The walker starts on B. Both neighbours of B are higher, so a walker who only steps down stays on B for ever and never finds D. This walker follows the annealing rule instead. A step down is always taken. A step up is taken with a chance that depends on how big the rise is and on a number called the temperature. The temperature starts at 4 and halves after every step.",
    steps: [
      "Temperature 4. The random proposal is C, height 5. That is a rise of 2. At temperature 4, a rise of 2 is accepted about 61 times in 100. The walker draws a random number from 1 to 100 and gets 35. That is within 61, so it steps up to C.",
      "Temperature 2. The proposal is D, height 1. That is lower than 5, so the walker moves to D without drawing. D is the best stone seen so far.",
      "Temperature 1. The proposal is E, height 4, a rise of 3. At temperature 1, a rise of 3 is accepted only about 5 times in 100. The draw is 48, so the walker stays on D.",
      "Temperature 0.5. The proposal is C, height 5, a rise of 4. At temperature 0.5 that is accepted about 3 times in 10,000. The draw is 72. The walker stays on D.",
    ],
    result: "The walker ends on D, height 1, the lowest stone. It got there only because it accepted a step up early, while the temperature was high. Later the same kind of step was almost always refused, and that is what kept it on D. With different draws it could have stayed on B. The method works by chance, not by certainty.",
  },

  terms: [
    { term: "Objective function", meaning: "The rule that gives every candidate answer a score. Here a lower score is better, and the score is called the value." },
    { term: "Local minimum", meaning: "A point that is lower than everything close to it, like the bottom of one dip. Lower points may exist farther away." },
    { term: "Global minimum", meaning: "The lowest point anywhere. It is the answer the search is really after." },
    { term: "Proposal", meaning: "A randomly chosen point near the current one, offered as the next place to move to." },
    { term: "Uphill move", meaning: "A move to a point with a worse value than the current one." },
    { term: "Temperature", meaning: "A number that sets how willing the search is to accept uphill moves. High means very willing. Near zero means almost never." },
    { term: "Acceptance probability", meaning: "The chance, between 0 and 1, that a proposed uphill move is taken." },
    { term: "Cooling schedule", meaning: "The plan for lowering the temperature during the run, for example multiplying it by 0.985 after every step." },
  ],

  takeaway: "Accept every improvement, accept some setbacks while the search is young, and grow stricter as it goes on.",

  viz: {
    describe: 'A contour map of a function of two variables, with hollow green circles on its known minima. A terracotta ring marks the current point and small terracotta dots trace where it has been. A dark dot marks the best point seen so far. At each step an arrow shows the proposed move, green if it was accepted and brick red if it was refused, and a dashed square outlines the region in which a proposal can land. A second, smaller chart plots the value at the current point, the best value so far, and the falling temperature at every step.',
    inputs: [
      { id: 'landscape', type: 'select', label: 'Surface', options: landscapeOptions, default: DEFAULTS.landscape },
      { id: 'seed', type: 'seed', label: 'Random seed', default: DEFAULTS.seed },
      { id: 'temp', type: 'range', scale: 'log', label: 'Starting temperature (T₀)', min: 0.01, max: 100, default: DEFAULTS.temp,
        help: 'Measured in the same units as the function value. An uphill move equal to the temperature is accepted about 37% of the time. Logarithmic slider.' },
      { id: 'cooling', type: 'range', label: 'Cooling rate (α)', min: 0.8, max: 0.999, step: 0.001, default: DEFAULTS.cooling,
        help: 'The temperature is multiplied by this after every step. Closer to 1 means slower cooling.' },
      { id: 'steps', type: 'range', label: 'Steps', min: 20, max: 600, step: 10, default: DEFAULTS.steps },
      { id: 'stepSize', type: 'range', label: 'Step size', min: 0.05, max: 2, step: 0.05, default: DEFAULTS.stepSize,
        help: 'A proposal moves at most this far along each axis.' },
      { id: 'startX', type: 'range', label: 'Start position, horizontal', min: -1, max: 1, step: 0.05, default: DEFAULTS.startX },
      { id: 'startY', type: 'range', label: 'Start position, vertical', min: -1, max: 1, step: 0.05, default: DEFAULTS.startY },
    ],
    presets: [
      { label: 'Escape the ripples', values: { ...DEFAULTS } },
      { label: 'A lucky seed: the central dip', values: { ...DEFAULTS, seed: 16 } },
      { label: 'Cooled too fast: frozen early', values: { ...DEFAULTS, cooling: 0.9 } },
      { label: 'Almost no heat: downhill only', values: { ...DEFAULTS, temp: 0.01 } },
      { label: 'Too hot to settle', values: { ...DEFAULTS, temp: 100, cooling: 0.999 } },
      { label: 'Four minima', values: { ...DEFAULTS, landscape: 'himmelblau', seed: 3 } },
      { label: 'Round bowl: the wrong tool', values: { ...DEFAULTS, landscape: 'bowl', temp: 5 } },
    ],
    tryThis: [
      { ask: 'Run the default and watch the lower chart. While the dashed temperature line is high the value jumps up and down, and as it falls the value settles. The run starts at value 44.4, on the slope of a dip whose floor is about 18. The lowest point on the map is 0, at the centre. Where will the run end: in the dip it started in, at the centre, or somewhere between? Then load "Almost no heat: downhill only", which uses the same seed, and decide again before you play it.',
        reveal: 'Somewhere between. The default run ends at (-0.017, 0.991) with value 1.059, in a dip next to the centre: far below where it began, but not the lowest point on the map. On the way it accepted 39 of the 238 uphill moves it was offered. With almost no heat it accepts none of 282. The point drops to the floor of the nearest dip, at (-3.015, 2.975) with value 18.104, and never leaves, which is what [gradient descent](#/algorithm/gradient-descent) does on this surface.' },
      { ask: 'Load "Cooled too fast: frozen early". It multiplies the temperature by 0.9 after every step where the default multiplies by 0.985, and it uses the same seed. The temperature starts at 40. After how many steps will it be below 1? And will the best value be better or worse than the 1.059 of the default run?',
        reveal: 'After 36 steps, where the default takes 245. By then the walk has not travelled far, and from there on almost every uphill move is refused. It ends at (-2.003, 2.975) with a best value of 12.987, one dip over from where it started, having accepted only 7 of 286 uphill moves. Same seed, same start, same number of steps: the whole difference is how long the heat lasted.' },
      { ask: 'Keep the default settings and press Randomize several times, noting the best value each time. The default seed ended at 1.059, next to the centre. Out of the seeds 1 to 80, how many would you expect to end in the central dip itself: most, about half, or only a few?',
        reveal: 'Only 6 of the 80. 35 end with a best value under 5, and the median best value is about 5.1, so the default seed was a better run than most. The heat still earns its place: with almost no heat, none of the 80 gets under 5. Load "A lucky seed: the central dip" to see one of the six, which ends at 0.170. One run tells you little about a method that works by chance.' },
      { ask: 'Load "Almost no heat: downhill only", which stays in the starting dip at value 18.104. Now raise only the step size, from 0.6 to 1.5. The search still refuses every real rise. Can it get out of the starting dip?',
        reveal: 'Yes. With the same seed it ends at (-1.108, 0.947) with value 4.883, and it accepted 0 of 219 uphill moves on the way. The dips are 1 apart, so a proposal that can reach 1.5 lands in a neighbouring dip, and when that dip is lower the move counts as downhill. Seeds 1, 2 and 3 end at 1.661, 0.137 and 1.506. The step size and the temperature both decide how far a search can travel.' },
      { ask: 'Load "Too hot to settle". It starts at temperature 100 and cools so slowly that after 300 steps the temperature is still 74. Where will the walk be standing at the end? And will the best value it saw on the way be good or bad?',
        reveal: 'It ends at value 26.166, no better than a spot picked at random, because it accepted 133 of the 151 uphill moves it was offered and never calmed down. Its best value is still low, 1.928, seen in passing at step 236. This map is small enough for a blind random walk to stumble on low ground. With more than a few variables that stops working, and the search has to be steered. It also shows why the best point is kept separately from the current one.' },
      { ask: 'Load "Round bowl: the wrong tool". The bowl has one dip and nothing to escape from. From this same start, gradient descent with a learning rate of 0.1 stops after 40 steps within 0.0005 of the minimum. How close will 300 steps of annealing get?',
        reveal: 'Its best value is 0.00181, at (0.00964, -0.041), and the walk itself ends at 0.061, still wandering. That took 297 function evaluations and is less exact than what gradient descent reaches in 40 steps. When there is one dip and the slope is available, following the slope wins. Annealing is for surfaces where the slope leads into a trap, or where there is no slope to follow.' },
    ],
    run,
    report: (r, c) => `Best value ${f3(r.bestValue)} at (${f3(r.x)}, ${f3(r.y)}), first reached at step ${r.bestStep} of ${r.steps}.\nThe walk ended at value ${f3(r.finalValue)}. Accepted ${r.accepted} moves (${r.uphillAccepted} of them uphill), refused ${r.rejected}.\n${c['function evaluations'] || 0} function evaluations.`,
    experiment: {
      title: 'Uphill moves accepted as the temperature rises',
      note: 'Each point is a real run of 2,000 steps on the rippled surface with the temperature held fixed (cooling rate 1) and step size 0.6, starting from the default position. The count is the number of proposals that were worse than the current point and were accepted anyway. Cold runs accept almost none and stay in one dip. Hot runs accept most and roam the whole map.',
      metric: 'uphill moves accepted',
      metricLabel: 'Uphill moves accepted in 2,000 steps',
      sizeLabel: 'Temperature (held constant)',
      sizes: [0.1, 0.3, 1, 3, 10, 30, 100],
      variants: [{ id: 'rastrigin', label: 'Many local minima (Rastrigin)' }],
      input: (temp, variant, seed) => ({ ...DEFAULTS, landscape: variant, seed, temp, cooling: 1, steps: 2000 }),
    },
  },

  logic: {
    intuition: 'A search that only accepts improvements is trapped by the first dip it enters. To leave a dip it must be allowed to get worse for a while. Simulated annealing allows this in a controlled way. Small setbacks are accepted more readily than large ones, and all setbacks are accepted more readily early in the run than late. The early part explores widely. The late part behaves like a plain downhill search and polishes whatever region the walk has ended up in.',
    steps: [
      'Choose a starting point, a starting temperature T₀ and a cooling rate α slightly below 1. Remember the starting point as the best so far.',
      'Propose a random point near the current one. On this page each coordinate moves by a random amount up to the step size.',
      'Compute Δ, the value at the proposal minus the value at the current point.',
      'If Δ is zero or negative, the proposal is no worse: move there. Otherwise move there with probability exp(−Δ / T), and stay put the rest of the time.',
      'If the current point is now better than the best so far, record it as the best.',
      'Lower the temperature by multiplying it by α. Repeat from step 2 until the step budget is spent, then return the best point seen.',
    ],
    pseudocode: [
      'simulated_annealing(f, x₀, T₀, α, steps):',
      '  x ← x₀;  best ← x₀;  T ← T₀',
      '  repeat steps times:',
      '    x′ ← x + random step',
      '    Δ ← f(x′) − f(x)',
      '    if Δ ≤ 0 or random() < exp(−Δ / T):',
      '      x ← x′',
      '      if f(x) < f(best): best ← x',
      '    T ← α · T',
      '  return best',
    ],
    decisions: [
      { title: 'How hot to start?', text: 'The temperature is measured in the units of the function. A rise of Δ = T is accepted with probability exp(−1), about 37%. So T₀ should be comparable to the height of the barriers the search must cross. On the rippled surface used here the passes between neighbouring dips stand about 20 above the dip floors and the peaks about 40, which is why the default is 40. One common rule of thumb is to pick T₀ so that most uphill proposals are accepted at the start.' },
      { title: 'How fast to cool?', text: 'This page uses geometric cooling: T is multiplied by α after every step. With α = 0.985 the temperature halves about every 46 steps. Cooling too fast freezes the walk in whatever dip it happens to be in. Cooling too slowly spends the whole budget wandering. The schedule that comes with a proof of convergence is logarithmic and far too slow to use.' },
      { title: 'How big a step?', text: 'A proposal should be a small change, so that good regions lead to better ones nearby, but not so small that crossing a ridge takes many unlikely uphill moves in a row. For discrete problems the equivalent choice is the move set, for example swapping two items or reversing a stretch of a tour.' },
      { title: 'What to return?', text: 'The walk may leave a good point after finding it, so the implementation here remembers the best point ever evaluated and returns that, not the final position.' },
    ],
    invariants: [
      '`best` is the lowest-valued point among all points the walk has occupied so far, so its value never rises.',
      'After k steps the temperature is exactly T₀ · αᵏ.',
      'A proposal that is no worse than the current point is never refused.',
    ],
    edgeCases: [
      'Temperature near zero: uphill moves are almost never accepted, and the method reduces to random descent, which stops in the nearest dip.',
      'Temperature very high: almost every proposal is accepted, and the method is a random walk that ignores the function.',
      'Cooling rate exactly 1: the temperature never changes. The walk then samples points with a preference for low values but never settles. This is the Metropolis algorithm that annealing is built on.',
      'A flat plateau: every proposal has Δ = 0 and is accepted, so the walk drifts at random until it finds an edge.',
      'A proposal outside the allowed region: this page refuses it without evaluating the function, as if the region were surrounded by an infinitely high wall.',
      'A function whose values are thousands of times larger or smaller than the temperature: the acceptance rule becomes all or nothing. Temperature must be chosen to match the scale of the function.',
    ],
    correctness: 'There is no guarantee that a practical run finds the global minimum, and the result changes with the random seed. What can be proved concerns idealized versions. With the temperature held fixed and symmetric proposals, the walk settles toward the Boltzmann distribution, in which a point with value f has probability proportional to exp(−f / T). As T approaches zero that distribution concentrates on the global minima. For finite search spaces, Hajek showed in 1988 that annealing converges in probability to the set of global minima when the temperature after k steps is c / log(1 + k) and the constant c is at least the depth of the deepest local minimum that is not global. That schedule is impractically slow: reaching a temperature T takes on the order of exp(c / T) steps. Geometric cooling, used here and in most applications, carries no such guarantee.',
    mistakes: [
      'Getting the sign in the exponent wrong. exp(Δ / T) is greater than 1 for every uphill move, so every proposal is accepted and the search becomes a random walk.',
      'Comparing the proposal with the best point so far instead of with the current point. The walk then cannot build a path through worse territory.',
      'Returning the final position without tracking the best point seen.',
      'Choosing the starting temperature without looking at the scale of the function, so that the run is frozen or boiling from the first step.',
      'Judging the method, or a parameter setting, from a single seed.',
    ],
  },

  code: {
    sample: {
      input: 'Minimize f(x) = (x² − 1)² + 0.3x from x = 1, which sits in the shallower of two dips. Run 200 steps with heat (T₀ = 1, α = 0.97), then 200 steps with almost none, using a small fixed random number generator so that every language prints the same numbers.',
      expected: 'with heat\nstep  40: T=0.2957 x=-0.6641 f=0.1131 best=-0.1740\nstep  80: T=0.0874 x=-1.1228 f=-0.2689 best=-0.3054\nstep 120: T=0.0259 x=-1.0743 f=-0.2985 best=-0.3054\nstep 160: T=0.0076 x=-1.0651 f=-0.3014 best=-0.3054\nstep 200: T=0.0023 x=-1.1008 f=-0.2854 best=-0.3054\nbest x=-1.0315 f=-0.3054\nwithout heat\nstep  40: T=0.0000 x=0.9701 f=0.2945 best=0.2945\nstep  80: T=0.0000 x=0.9569 f=0.2942 best=0.2942\nstep 120: T=0.0000 x=0.9569 f=0.2942 best=0.2942\nstep 160: T=0.0000 x=0.9569 f=0.2942 best=0.2942\nstep 200: T=0.0000 x=0.9574 f=0.2942 best=0.2942\nbest x=0.9574 f=0.2942',
    },
    breakIt: [
      { change: 'In the acceptance test, remove the minus sign in front of `delta`, so that the chance is exp(delta / temp). How will the walk with heat behave once the temperature is low?',
        find: { python: 'math.exp(-delta / temp)', javascript: 'Math.exp(-delta / temp)' },
        replace: { python: 'math.exp(delta / temp)', javascript: 'Math.exp(delta / temp)' },
        reveal: 'It never settles. For an uphill move `delta` is positive, so exp(delta / temp) is above 1, the random draw is always below it, and every proposal is accepted. The walk with heat prints "step 120: T=0.0259 x=1.7450 f=4.7063" and "step 160: T=0.0076 x=1.6529 f=3.4956": far up the side of the curve with the temperature close to zero. JavaScript runs to the end, and its walk "without heat" strays even farther, to "x=-3.5628 f=135.6666" at step 160. Python stops before step 200 of the first run with "OverflowError: math range error", because at a low temperature delta / temp is too large for exp to return. Either way the search has become a random walk. The "best" column still shows −0.3031, a respectable number, which is how this mistake hides.' },
      { change: 'Compute `delta` against the best point seen so far instead of the current point: change `f(x)` to `f(best)` in that line. The run with heat used to reach the deeper dip near x = −1.03. Will it still get there?',
        find: { python: 'delta = f(candidate) - f(x)', javascript: 'const delta = f(candidate) - f(x);' },
        replace: { python: 'delta = f(candidate) - f(best)', javascript: 'const delta = f(candidate) - f(best);' },
        reveal: 'No. The run with heat now ends "best x=0.9578 f=0.2942", in the shallow dip it started in, where the correct program ended at x=-1.0315 f=-0.3054. The walk does climb: at step 27 it stands at x = 0.088, on top of the ridge, where f is about 1.01. From there the far side is all downhill, and the correct rule would take those steps at once. This version compares them with the best value seen, 0.29, so a step down to 0.9 is treated as a rise of 0.6 and mostly refused. A path to a deeper dip has to pass through points worse than the best one, and this rule punishes every one of them.' },
      { change: 'Make `anneal` return `x`, the place where the walk stopped, instead of `best`. Which of the two final "best" lines changes, and does it get better or worse?',
        find: { python: 'return best', javascript: 'return best;' },
        replace: { python: 'return x', javascript: 'return x;' },
        reveal: 'The first one, and it gets worse: "best x=-1.1008 f=-0.2854" where the correct program printed "best x=-1.0315 f=-0.3054". The walk passed its lowest point before step 80 and then moved on, because while any heat is left a small step up is still sometimes accepted. The last column of the step lines reads −0.3054 from step 80 to the end: the program knew a better point and handed back a different one. The line after "without heat" is the same as before, since a walk that only goes down ends on its best point. That is why this slip survives a test that uses no heat.' },
    ],
    python: {
      source: `import math


def f(x):
    d = x * x - 1
    return d * d + 0.3 * x


state = 2024


def rand():
    """Park-Miller generator: the same numbers in every language."""
    global state
    state = state * 48271 % 2147483647
    return state / 2147483647


def anneal(x, temp, cooling, steps, size):
    best = x
    for step in range(1, steps + 1):
        candidate = x + size * (2 * rand() - 1)
        delta = f(candidate) - f(x)
        if delta <= 0 or rand() < math.exp(-delta / temp):
            x = candidate
            if f(x) < f(best):
                best = x
        temp *= cooling
        if step % 40 == 0:
            print(f"step {step:3d}: T={temp:.4f} x={x:.4f} f={f(x):.4f} best={f(best):.4f}")
    return best


print("with heat")
best = anneal(1.0, 1.0, 0.97, 200, 0.4)
print(f"best x={best:.4f} f={f(best):.4f}")
print("without heat")
best = anneal(1.0, 1e-9, 0.97, 200, 0.4)
print(f"best x={best:.4f} f={f(best):.4f}")`,
      notes: [
        { line: 4, text: 'A curve with two dips. The one near x = 0.96 has value about 0.29. The one near x = −1.03 is deeper, about −0.31. A ridge of height about 1 separates them.' },
        { line: 14, text: 'A tiny random number generator written out in full, so that Python, JavaScript and C++ draw exactly the same sequence. Real code would use the standard library.' },
        { line: 21, text: 'The proposal: a random point within `size` of the current one.' },
        { line: 23, text: 'The acceptance rule. A proposal that is no worse is taken at once. A worse one is taken when a random draw falls below exp(−delta / temp).' },
        { line: 27, text: 'Geometric cooling: the temperature shrinks by the same factor after every step.' },
        { line: 37, text: 'A temperature of one billionth makes the acceptance probability for any real rise effectively zero. The search then never leaves the dip it started in.' },
      ],
    },
    javascript: {
      source: `function f(x) {
  const d = x * x - 1;
  return d * d + 0.3 * x;
}

let state = 2024;

// Park-Miller generator: the same numbers in every language.
function rand() {
  state = (state * 48271) % 2147483647;
  return state / 2147483647;
}

function anneal(x, temp, cooling, steps, size) {
  let best = x;
  for (let step = 1; step <= steps; step++) {
    const candidate = x + size * (2 * rand() - 1);
    const delta = f(candidate) - f(x);
    if (delta <= 0 || rand() < Math.exp(-delta / temp)) {
      x = candidate;
      if (f(x) < f(best)) best = x;
    }
    temp *= cooling;
    if (step % 40 === 0) {
      console.log("step " + String(step).padStart(3, " ") + ": T=" + temp.toFixed(4) + " x=" + x.toFixed(4)
        + " f=" + f(x).toFixed(4) + " best=" + f(best).toFixed(4));
    }
  }
  return best;
}

console.log("with heat");
let best = anneal(1.0, 1.0, 0.97, 200, 0.4);
console.log("best x=" + best.toFixed(4) + " f=" + f(best).toFixed(4));
console.log("without heat");
best = anneal(1.0, 1e-9, 0.97, 200, 0.4);
console.log("best x=" + best.toFixed(4) + " f=" + f(best).toFixed(4));`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>

double f(double x) {
    double d = x * x - 1;
    return d * d + 0.3 * x;
}

long long state = 2024;

// Park-Miller generator: the same numbers in every language.
double rnd() {
    state = state * 48271 % 2147483647;
    return static_cast<double>(state) / 2147483647;
}

double anneal(double x, double temp, double cooling, int steps, double size) {
    double best = x;
    for (int step = 1; step <= steps; ++step) {
        double candidate = x + size * (2 * rnd() - 1);
        double delta = f(candidate) - f(x);
        if (delta <= 0 || rnd() < std::exp(-delta / temp)) {
            x = candidate;
            if (f(x) < f(best)) best = x;
        }
        temp *= cooling;
        if (step % 40 == 0) {
            std::printf("step %3d: T=%.4f x=%.4f f=%.4f best=%.4f\\n", step, temp, x, f(x), f(best));
        }
    }
    return best;
}

int main() {
    std::printf("with heat\\n");
    double best = anneal(1.0, 1.0, 0.97, 200, 0.4);
    std::printf("best x=%.4f f=%.4f\\n", best, f(best));
    std::printf("without heat\\n");
    best = anneal(1.0, 1e-9, 0.97, 200, 0.4);
    std::printf("best x=%.4f f=%.4f\\n", best, f(best));
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'A step costs one evaluation of the function plus a few arithmetic operations. The number of steps is not determined by the problem: it is a budget you choose, and the quality of the answer tends to improve with it. No fixed budget guarantees the global minimum.',
    cases: [
      { case: 'One step', time: 'One function evaluation', when: 'Always. A proposal that falls outside the allowed region costs nothing on this page, because it is refused before evaluation.' },
      { case: 'One run', time: 'As many steps as the budget', when: 'With geometric cooling from T₀ down to a final temperature T_end, the run needs log(T₀ / T_end) / log(1 / α) steps.' },
      { case: 'Guaranteed convergence', time: 'About exp(c / T) steps to reach temperature T', when: 'Only with logarithmic cooling, T = c / log(1 + k), on a finite search space. Far too slow in practice.' },
    ],
    space: 'O(d) for d variables: the current point, the proposal and the best point so far. Nothing else is kept.',
    memory: 'Memory use does not grow with the number of steps. The chart on this page stores the history of values only in order to draw it.',
    tradeoffs: 'Annealing uses very little information per step, a single comparison of two values, so it needs many steps. In exchange it asks almost nothing of the problem: no gradient, no smoothness, not even numbers as inputs. Where a gradient exists and the surface is well behaved, gradient methods reach a nearby minimum in far fewer evaluations.',
    assumptions: [
      'The cost of one step is dominated by evaluating the function. For combinatorial problems an efficient implementation computes the change Δ directly from the part of the solution that the move touched.',
      'The convergence statement assumes a finite search space and the logarithmic schedule. It does not apply to the geometric schedule used on this page.',
      'The chart counts accepted uphill moves at a fixed temperature in single runs of 2,000 steps. It illustrates the acceptance rule and is not a benchmark.',
    ],
  },

  tradeoffs: {
    excels: [
      'Landscapes with many local minima, where downhill-only methods stop early.',
      'Discrete and combinatorial problems, such as layouts, orderings and schedules, where there is no gradient at all.',
      'Black-box objectives: anything that can score a candidate can be annealed.',
      'Situations where a good answer is enough and the best possible answer is not required.',
    ],
    struggles: [
      'Smooth problems with a single valley, where it wastes evaluations that a gradient method would not need.',
      'Problems where each evaluation is expensive, since thousands or millions of evaluations are typical.',
      'High precision: the random proposals polish the final answer slowly.',
      'Landscapes where good regions are isolated needles with no gradual approach. No local search does well there.',
    ],
    pitfalls: [
      'A temperature scale that does not match the function, which makes the run either frozen or random from start to finish.',
      'Cooling so fast that the walk is quenched in the first dip it meets.',
      'Reporting the result of one lucky seed. Results vary from run to run, sometimes widely.',
      'Recomputing the whole objective for every proposal in a combinatorial problem when only a small part of it changed.',
    ],
    misunderstandings: [
      "\"It always finds the best answer in the end.\" Only an idealized version with impractically slow cooling has that guarantee. A real run returns a good answer that depends on the seed and the settings.",
      "\"Accepting a worse move is a mistake the method makes.\" It is the whole point. Without uphill moves the search can never leave the first dip it enters.",
      "\"The temperature is a real temperature.\" It is only a number that sets how tolerant the acceptance rule is. The name is borrowed from the physics the rule came from.",
      "\"Hotter is better because it explores more.\" A search that stays hot never settles. Exploring only helps if the temperature later falls far enough to keep what was found.",
    ],
    constraints: [
      'The starting temperature, cooling rate, step size and budget all have to be tuned to the problem, usually by trial runs.',
      'A single walk is inherently sequential. Parallel hardware is usually used to run several independent walks, or walks at different temperatures that exchange states.',
    ],
    alternatives: [
      { id: 'gradient-descent', name: 'Gradient Descent', when: 'The function is smooth, a gradient is available, and reaching a nearby minimum is good enough.' },
      { id: 'genetic-algorithm', name: 'Genetic Algorithm', when: 'You can afford a whole population of candidates, and combining parts of good candidates is meaningful.' },
      { id: 'metropolis-hastings', name: 'Metropolis-Hastings', when: 'You want samples from a distribution, not a single lowest point. It is the same walk with the temperature held fixed.' },
      { name: 'Local search with random restarts', when: 'Dips are cheap to descend into. Run a downhill search from many random starting points and keep the best result.' },
      { name: 'Tabu search', when: 'The problem is combinatorial and you prefer a deterministic rule, a memory of recent moves, to escape local minima.' },
    ],
    comparison: {
      columns: ['', 'Simulated annealing', 'Gradient descent', 'Genetic algorithm'],
      rows: [
        ['Information used', 'Function values only', 'Gradients', 'Function values only'],
        ['Candidates kept', 'One', 'One', 'A population'],
        ['Leaves a local minimum', 'Yes, by accepted uphill moves', 'No', 'Sometimes, through mutation and a spread-out population'],
        ['Deterministic', 'No', 'Yes', 'No'],
        ['Evaluations needed', 'Many', 'Few on smooth problems', 'Many'],
        ['Guarantee', 'None with practical cooling', 'A stationary point', 'None'],
      ],
    },
  },

  applications: [
    { title: 'Placing components on chips', status: 'established', text: 'The 1983 paper that introduced the method applied it to the placement and wiring of electronic components. Simulated annealing became a standard approach to placement and is used, for example, in the academic FPGA tool VPR.' },
    { title: 'Refining molecular structures', status: 'established', text: 'In X-ray crystallography and NMR spectroscopy, an atomic model has to be adjusted until it agrees with the measured data. Brünger, Kuriyan and Karplus introduced refinement by simulated annealing in 1987, and it became a routine step in structure determination.' },
    { title: 'The travelling salesman problem', status: 'established', text: 'Both founding papers, by Kirkpatrick and colleagues and independently by Černý, used the search for a short tour through many cities as a test case. A typical move reverses a stretch of the tour, and the tour length plays the role of energy.' },
    { title: 'Timetables and schedules', status: 'illustrative', text: 'A timetable can be scored by counting clashes and broken preferences. A move swaps two lessons or shifts one to another slot, and annealing lowers the score while occasionally accepting a worse timetable to get out of a dead end.' },
    { title: 'Tuning a simulation', status: 'illustrative', text: 'When the only way to judge a set of design parameters is to run a simulation and read off a number, there is no gradient to follow. Annealing can still search, at the price of many simulation runs.' },
  ],

  connections: [
    { to: 'gradient-descent', type: 'same-problem', why: 'Both move a single point across a landscape looking for low ground. Gradient descent follows the slope and never goes up, so it stops in the nearest dip. Annealing ignores the slope and sometimes goes up, so it can leave.' },
    { to: 'genetic-algorithm', type: 'same-problem', why: 'Both are randomized searches that need only function values and give no guarantee. Annealing perturbs one candidate. A genetic algorithm keeps many and recombines them.' },
    { to: 'metropolis-hastings', type: 'prerequisite', why: 'The accept-or-refuse rule is the Metropolis rule. Held at a fixed temperature it samples a distribution. Annealing lowers the temperature so that the distribution being sampled closes in on the minima.' },
    { to: 'monte-carlo', type: 'related', why: 'Both get answers from random draws. Monte Carlo estimation averages many independent draws. Annealing chains them into a walk in which each draw depends on the last.' },
    { to: 'stochastic-gradient-descent', type: 'related', why: 'Both let randomness disturb a search that would otherwise head straight downhill. In stochastic gradient descent the noise comes from sampling the data and there is no accept-or-refuse step.' },
    { to: 'concept:local-search', type: 'prerequisite', why: 'Annealing is local search with one change: a move to a worse neighbour is sometimes allowed.' },
    { to: 'concept:exploration-exploitation', type: 'prerequisite', why: 'The temperature is a dial between exploring new regions and exploiting the region already found, turned steadily from the first toward the second.' },
    { to: 'concept:markov-chain', type: 'related', why: 'The next point depends only on the current point and a random draw, so the walk is a Markov chain. Its long-run behaviour at a fixed temperature is what the theory describes.' },
    { to: 'concept:randomization', type: 'prerequisite', why: 'Random proposals and random acceptance are what free the search from the fixed path a deterministic rule would follow.' },
    { to: 'discipline:physics', type: 'related', why: 'The acceptance rule was devised to simulate collections of atoms at a fixed temperature, and slow cooling toward an ordered, low-energy state is what annealing a material means.' },
    { to: 'discipline:ai', type: 'application', why: 'Planning, scheduling and constraint problems are searches over arrangements. Annealing is one of the standard local search methods for them.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'The current point has value 5. The proposal has value 7. The temperature is 2. What does the algorithm do?',
      options: ['Refuses the move, because 7 is worse than 5', 'Accepts the move with probability exp(−1), about 37%', 'Accepts the move, because the temperature is above zero', 'Accepts the move with probability 5/7'],
      answer: 1,
      explain: [
        'A downhill-only search would refuse it. Annealing gives a worse move a chance.',
        'Correct. The rise is Δ = 2, so the chance is exp(−2 / 2) = exp(−1), about 0.37.',
        'A positive temperature gives uphill moves a chance, not a certainty.',
        'The chance depends on the size of the rise divided by the temperature, not on the ratio of the two values.',
      ],
    },
    {
      type: 'predict',
      q: 'On the rippled surface, a starting temperature of 0.01 leaves the search stuck at value 18.104, in the dip nearest the start. The "Four minima" surface has four dips, and the floor of every one of them is at value 0. Run it with a starting temperature of 0.01 from the same start, where the value is 112.566. What does the search end with?',
      options: ['A value far above 0, as on the ripples: without heat it cannot leave the first dip it meets', 'A value close to 0: it slides into the nearest dip, and here every dip is as low as any other', 'A value close to 0, but only after visiting several of the four dips', 'The starting value, 112.566: without heat no move is accepted'],
      answer: 1,
      explain: [
        'It does stay in the first dip it meets, the one near (−2.805, 3.131). But the floor of that dip is a lowest point of the whole surface, so staying there costs nothing. The best value is 0.00291.',
        'It accepts 10 moves, none of them uphill, and ends at (-2.807, 3.123) with value 0.00291. Heat is for leaving a dip that is not the lowest. When every dip is as good as any other, there is nothing to leave.',
        'Crossing from one dip to another means climbing, and at this temperature it accepts 0 of the 290 uphill moves it is offered. It stays in the dip nearest the start.',
        'A move that is not worse is always accepted, whatever the temperature. Ten downhill moves take the value from 112.566 to 0.00291.',
      ],
      tryInput: { ...DEFAULTS, landscape: 'himmelblau', temp: 0.01 },
      check: (r) => (r.uphillAccepted === 0 && r.uphillProposed === 290 && r.accepted === 10 && Math.abs(r.bestValue - 0.00291) < 5e-6 && Math.abs(r.startValue - 112.566) < 5e-4 && Math.hypot(r.x + 2.805118, r.y - 3.131312) < 0.02)
        || `best ${r.bestValue} at (${r.x}, ${r.y}), accepted ${r.accepted}, uphill ${r.uphillAccepted} of ${r.uphillProposed}`,
    },
    {
      type: 'debug',
      q: 'This version wanders at random for the whole run and never settles, even at very low temperature. What is wrong?',
      code: `candidate = x + size * (2 * rand() - 1)
delta = f(candidate) - f(x)
if delta <= 0 or rand() < math.exp(delta / temp):
    x = candidate
temp *= cooling`,
      options: ['The temperature should be divided by the cooling rate', 'The exponent has the wrong sign, so every uphill move is accepted', 'delta should be f(x) − f(candidate)', 'It should draw the random number before computing delta'],
      answer: 1,
      explain: [
        'Multiplying by a rate below 1 is correct. Dividing would heat the search up.',
        'Correct. For an uphill move delta is positive, so exp(delta / temp) is above 1 and the random draw is always below it. The exponent must be −delta / temp.',
        'delta is defined correctly: positive means the candidate is worse.',
        'The order of those two lines does not change which moves are accepted.',
      ],
    },
    {
      type: 'choice',
      q: 'What does the theory promise about a run with geometric cooling, such as multiplying the temperature by 0.985 every step?',
      options: ['It reaches the global minimum if the run is long enough', 'It reaches the global minimum with probability at least exp(−1)', 'Nothing about the global minimum. The known guarantee needs a much slower, logarithmic schedule', 'It reaches a local minimum in a number of steps proportional to the starting temperature'],
      answer: 2,
      explain: [
        'A longer geometric run only gets colder. Once frozen in a dip it does not leave.',
        'There is no such bound.',
        'Correct. Convergence has been proved for temperatures that fall like c / log(1 + k), which is far too slow to use. Practical schedules trade the guarantee for speed.',
        'No such step count is guaranteed.',
      ],
    },
    {
      type: 'challenge',
      title: 'Anneal a travelling salesman tour',
      prompt: 'Place 30 cities in a square with the generator from the code sample: start `state` at 2024 and call `rand()` twice for each city, x first and then y. A solution is an order in which to visit them all and return to the start, and its value is the total length of the tour. Start from the tour that visits the cities in the order they were generated. Use this move: pick two positions in the tour and reverse the stretch between them, ends included. First run a downhill-only search that accepts a move only if the tour gets shorter, until 2,000 proposals in a row fail. Then anneal with the same move and the same number of proposals. Compare the two tour lengths over ten seeds each, and report the spread as well as the best.',
      expect: 'Two figures are exact, so check them first. The tour in generated order, which begins at (0.0455, 0.1057) and (0.1377, 0.6212), has length 15.7468. Reversing positions 5 to 12 of it, counting from 0, gives 15.8550. The rest depends on your random draws, so expect the same range and not the same digits. Over ten seeds my downhill-only search gave tours from 4.607 to 5.165, mean 4.832, after about 4,200 proposals each. Annealing with the same number of proposals, cooled geometrically from temperature 0.1 to 0.01, gave 4.631 to 4.961, mean 4.727: a little shorter on average and less spread out. Cooled from 0.1 all the way to 0.001 it was no better than downhill-only, mean 4.882, because much of the run is then too cold to accept any rise. A typical uphill move here lengthens the tour by about 0.2, which is the scale to set the temperature against. With ten times the proposals, annealing averaged 4.649 and found 4.607 three times in ten. That was the shortest tour in any of my runs.',
      hints: ['Reversing a stretch changes only two edges of the tour, so Δ can be computed from four distances without re-measuring the whole tour.', 'Pick the starting temperature by trying a few hundred random moves and looking at the typical size of a positive Δ.'],
    },
  ],

  compare: {
    idea: 'A random walk that always accepts improvements and accepts worse moves with a probability that falls as the temperature is lowered.',
    requires: 'A way to score a candidate and a way to propose a nearby one. Nothing else. In practice it does not promise the best answer.',
    sensitivity: 'High. Results depend on the starting temperature, the cooling rate, the step size and the random seed.',
    memory: 'O(d): the current point, the proposal and the best point so far.',
    difficulty: 'low',
    difficultyNote: 'About ten lines of code. The work is in choosing the temperature schedule and the move.',
    limits: 'It needs many scores. Results differ from run to run. It is slow to polish an answer to fine precision.',
    useWhen: 'There are many mediocre resting points or no slope to follow, a candidate is cheap to score, and a good answer is enough.',
  },

  advanced: {
    history: 'In 1953 Nicholas Metropolis, Arianna Rosenbluth, Marshall Rosenbluth, Augusta Teller and Edward Teller published a method for simulating a collection of interacting particles at a fixed temperature on an early computer: move one particle at random, accept the move if the energy falls, and otherwise accept it with probability exp(−ΔE / kT). Thirty years later Scott Kirkpatrick, Daniel Gelatt and Mario Vecchi at IBM pointed out that the same procedure, run with a slowly falling temperature, is a general method for combinatorial optimization, and demonstrated it on the physical design of computers and on the travelling salesman problem. V. Černý reached the same idea independently and published it in 1985. Stuart and Donald Geman proved in 1984 that a logarithmic cooling schedule suffices for convergence, and Bruce Hajek gave the exact condition in 1988.',
    derivation: 'Hold the temperature $T$ fixed and suppose proposals are symmetric: proposing $y$ from $x$ is exactly as likely as proposing $x$ from $y$, with probability $q$. The rule accepts a proposal with probability $\\min\\left(1, e^{-(f(y)-f(x))/T}\\right)$. Consider the Boltzmann distribution\n\n$$\\pi_T(x) = \\frac{e^{-f(x)/T}}{Z_T}, \\qquad Z_T = \\sum_x e^{-f(x)/T}.$$\n\nTake any pair with $f(y) \\ge f(x)$. The probability flow from $x$ to $y$ is\n\n$$\\pi_T(x)\\, q\\, e^{-(f(y)-f(x))/T} = \\frac{q\\, e^{-f(y)/T}}{Z_T},$$\n\nand the flow from $y$ to $x$ is $\\pi_T(y)\\, q \\cdot 1$, which is the same quantity. Because the flows balance for every pair, $\\pi_T$ is a stationary distribution of the walk.\n\nFor a global minimum $x^\\star$ and any other point $x$,\n\n$$\\frac{\\pi_T(x)}{\\pi_T(x^\\star)} = e^{-(f(x)-f(x^\\star))/T} \\to 0 \\quad \\text{as } T \\to 0,$$\n\nso at low temperature almost all of the probability sits on the global minima. Annealing tries to follow $\\pi_T$ down as $T$ falls. The obstacle is time: escaping a dip of depth $d$ takes on the order of $e^{d/T}$ steps, so the walk falls out of equilibrium once the temperature drops faster than it can keep up with.',
    complexityProof: 'Hajek\'s theorem makes the obstacle precise for a finite search space. Call the depth of a local minimum the smallest rise needed to walk from it to a point of lower value, and let $d^\\star$ be the largest depth among local minima that are not global. With the schedule $T_k = c / \\log(1 + k)$, the probability that the walk is at a global minimum tends to 1 if and only if $c \\ge d^\\star$. Solving $T_k = T$ for $k$ gives $k = e^{c/T} - 1$: the number of steps grows exponentially as the target temperature falls. A geometric schedule $T_k = T_0\\alpha^k$ reaches the same temperature in $\\log(T_0/T)/\\log(1/\\alpha)$ steps, which is why it is used and why it comes with no guarantee.',
    variants: [
      { name: 'Other cooling schedules', text: 'Linear cooling, cooling in stages with many steps at each temperature, and adaptive schedules that slow down where the acceptance rate changes fastest.' },
      { name: 'Reheating and restarts', text: 'Raise the temperature again when the walk appears frozen, or restart from the best point found.' },
      { name: 'Threshold accepting', text: 'Replaces the random acceptance test with a fixed rule: accept any move that is worse by less than a threshold, and lower the threshold over time.' },
      { name: 'Parallel tempering', text: 'Runs several walks at different fixed temperatures and occasionally swaps their states, so that hot walks explore and cold walks refine. Also called replica exchange.' },
      { name: 'Quantum annealing', text: 'A different physical process with a similar aim, in which quantum fluctuations instead of thermal ones let a system pass between states. It is a separate subject from the algorithm on this page.' },
    ],
    implementation: 'Compute Δ incrementally wherever the problem allows it, since the function evaluation dominates the cost. Keep the best solution separately from the current one. Before a long run, sample a few hundred random moves to see the typical size of an uphill Δ, and set the starting temperature from that. Watch the acceptance rate during the run: it should start high and fall toward zero. If it is near zero from the start the run is frozen, and if it is still high at the end the run never cooled.',
    benchmarking: 'Always report results over many seeds, with the spread, and at a stated budget of function evaluations. Compare against random-restart local search given the same budget, which is a baseline annealing does not always beat.',
    references: [
      { authors: 'S. Kirkpatrick, C. D. Gelatt and M. P. Vecchi', year: 1983, title: 'Optimization by simulated annealing', venue: 'Science 220(4598), 671-680' },
      { authors: 'N. Metropolis, A. W. Rosenbluth, M. N. Rosenbluth, A. H. Teller and E. Teller', year: 1953, title: 'Equation of state calculations by fast computing machines', venue: 'The Journal of Chemical Physics 21(6), 1087-1092' },
      { authors: 'V. Černý', year: 1985, title: 'Thermodynamical approach to the traveling salesman problem: an efficient simulation algorithm', venue: 'Journal of Optimization Theory and Applications 45(1), 41-51' },
      { authors: 'B. Hajek', year: 1988, title: 'Cooling schedules for optimal annealing', venue: 'Mathematics of Operations Research 13(2), 311-329' },
      { authors: 'S. Geman and D. Geman', year: 1984, title: 'Stochastic relaxation, Gibbs distributions, and the Bayesian restoration of images', venue: 'IEEE Transactions on Pattern Analysis and Machine Intelligence 6(6), 721-741' },
    ],
    furtherReading: [
      'S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, the sections on local search, which present simulated annealing next to hill climbing.',
      'W. H. Press, S. A. Teukolsky, W. T. Vetterling and B. P. Flannery, *Numerical Recipes*, the section on simulated annealing methods.',
    ],
  },

  tests: [
    { name: 'default run leaves the starting dip and ends in a dip next to the centre', input: {},
      check: (r) => (r.bestValue > 0.99 && r.bestValue < 1.1 && Math.abs(r.x) < 0.5 && Math.abs(r.y - 1) < 0.5 && r.startValue > 40 && r.uphillAccepted > 0) || `best ${r.bestValue} at (${r.x}, ${r.y})` },
    { name: 'the lucky seed reaches the central dip', input: { ...DEFAULTS, seed: 16 },
      check: (r) => (r.bestValue < 0.2 && Math.abs(r.x) < 0.5 && Math.abs(r.y) < 0.5) || `best ${r.bestValue} at (${r.x}, ${r.y})` },
    { name: 'with almost no heat it stays in the dip nearest the start', input: { ...DEFAULTS, temp: 0.01 },
      check: (r) => (Math.abs(r.x + 3) < 0.5 && Math.abs(r.y - 3) < 0.5 && r.bestValue > 17.9 && r.bestValue < 21) || `best ${r.bestValue} at (${r.x}, ${r.y})` },
    { name: 'cooling too fast gives a worse result than the default on the same seed', input: { ...DEFAULTS, cooling: 0.9 },
      check: (r) => (r.bestValue > 10 && r.temps[36] < 1 && r.temps[35] >= 1) || `best ${r.bestValue}, T after 36 steps ${r.temps[36]}` },
    { name: 'Things to try: the default run, as quoted', input: { ...DEFAULTS },
      check: (r) => (r.bestValue.toFixed(3) === '1.059' && r.x.toFixed(3) === '-0.017' && r.y.toFixed(3) === '0.991' && r.startValue.toFixed(1) === '44.4' && r.uphillAccepted === 39 && r.uphillProposed === 238
        && r.temps[245] < 1 && r.temps[244] >= 1) || `best ${r.bestValue} at (${r.x}, ${r.y}), uphill ${r.uphillAccepted} of ${r.uphillProposed}` },
    { name: 'Things to try: almost no heat, cooled too fast, too hot and the lucky seed, as quoted', input: { ...DEFAULTS, temp: 0.01 },
      check: (r) => {
        const q = { count() {}, frame() {} };
        const fast = run({ ...DEFAULTS, cooling: 0.9 }, q), hot = run({ ...DEFAULTS, temp: 100, cooling: 0.999 }, q), lucky = run({ ...DEFAULTS, seed: 16 }, q);
        return (r.bestValue.toFixed(3) === '18.104' && r.x.toFixed(3) === '-3.015' && r.y.toFixed(3) === '2.975' && r.uphillAccepted === 0 && r.uphillProposed === 282
          && fast.bestValue.toFixed(3) === '12.987' && fast.x.toFixed(3) === '-2.003' && fast.y.toFixed(3) === '2.975' && fast.uphillAccepted === 7 && fast.uphillProposed === 286
          && hot.finalValue.toFixed(3) === '26.166' && hot.bestValue.toFixed(3) === '1.928' && hot.bestStep === 236 && hot.uphillAccepted === 133 && hot.uphillProposed === 151 && Math.round(hot.finalTemperature) === 74
          && lucky.bestValue.toFixed(3) === '0.170') || `cold ${r.bestValue}, fast ${fast.bestValue}, hot ${hot.finalValue} / ${hot.bestValue}, lucky ${lucky.bestValue}`;
      } },
    { name: 'Things to try: with almost no heat a step size of 1.5 still leaves the starting dip', input: { ...DEFAULTS, temp: 0.01, stepSize: 1.5 },
      check: (r) => {
        const q = { count() {}, frame() {} };
        const others = [1, 2, 3].map((seed) => run({ ...DEFAULTS, temp: 0.01, stepSize: 1.5, seed }, q).bestValue.toFixed(3)).join(',');
        return (r.bestValue.toFixed(3) === '4.883' && r.x.toFixed(3) === '-1.108' && r.y.toFixed(3) === '0.947' && r.uphillAccepted === 0 && r.uphillProposed === 219 && others === '1.661,0.137,1.506')
          || `best ${r.bestValue} at (${r.x}, ${r.y}), uphill ${r.uphillAccepted} of ${r.uphillProposed}, seeds 1 to 3: ${others}`;
      } },
    { name: 'Things to try: the round bowl, as quoted', input: { ...DEFAULTS, landscape: 'bowl', temp: 5 },
      check: (r, c) => (r.bestValue.toFixed(5) === '0.00181' && r.finalValue.toFixed(3) === '0.061' && c['function evaluations'] === 297 && Math.abs(r.x - 0.00964) < 5e-6 && r.y.toFixed(3) === '-0.041')
        || `best ${r.bestValue} at (${r.x}, ${r.y}), ended at ${r.finalValue}, ${c['function evaluations']} evaluations` },
    { name: 'quiz prediction: on the four minima a search with almost no heat still ends near value 0', input: { ...DEFAULTS, landscape: 'himmelblau', temp: 0.01 },
      check: (r) => (r.bestValue < 0.01 && r.bestValue.toFixed(5) === '0.00291' && r.x.toFixed(3) === '-2.807' && r.y.toFixed(3) === '3.123' && r.accepted === 10 && r.uphillAccepted === 0 && r.uphillProposed === 290)
        || `best ${r.bestValue} at (${r.x}, ${r.y})` },
    { name: 'bookkeeping: best never rises, temperature is geometric, evaluations are counted', input: { ...DEFAULTS, seed: 5, steps: 200 },
      check: (r, c) => {
        for (let i = 1; i < r.bests.length; i++) if (r.bests[i] > r.bests[i - 1]) return `best rose at step ${i}`;
        if (Math.min(...r.values) !== r.bestValue) return 'best is not the lowest value visited';
        for (let k = 0; k < r.temps.length; k++) if (Math.abs(r.temps[k] - 40 * 0.985 ** k) > 1e-9 * 40) return `temperature at step ${k} is off`;
        if (r.accepted + r.rejected !== r.steps) return 'accepted + refused does not equal the number of steps';
        return c['function evaluations'] === 1 + r.steps - r.outside || `counted ${c['function evaluations']} evaluations`;
      } },
    { name: 'gets close to the minimum of the bowl', input: { ...DEFAULTS, landscape: 'bowl', temp: 5 },
      check: (r) => r.bestValue < 0.05 || `best ${r.bestValue}` },
    { name: 'the acceptance chances quoted in the worked example', input: {},
      check: () => (Math.round(100 * acceptChance(2, 4)) === 61 && Math.round(100 * acceptChance(3, 1)) === 5 && Math.round(10000 * acceptChance(4, 0.5)) === 3
        && acceptChance(-4, 2) === 1 && Math.round(100 * acceptChance(2, 2)) === 37) || 'the example quotes the wrong chances' },
    { name: 'the seed statistics quoted in Try this', input: {},
      check: () => {
        const hot = seedScan({}, 1, 80), cold = seedScan({ temp: 0.01 }, 1, 80);
        return (hot.centre === 6 && hot.under5 === 35 && Math.abs(hot.median - 5.1) < 0.05 && cold.under5 === 0)
          || `centre ${hot.centre}, under 5: ${hot.under5}, median ${hot.median.toFixed(3)}, cold under 5: ${cold.under5}`;
      } },
  ],
};
