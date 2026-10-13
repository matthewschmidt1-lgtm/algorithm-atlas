import { landscapeById, landscapeOptions, landscapeLayers } from '../../js/lib/landscapes.js';
import { makeRng } from '../../js/lib/rng.js';

const f3 = (v) => (Math.abs(v) >= 1000 ? v.toExponential(2) : v.toFixed(Math.abs(v) < 0.01 && v !== 0 ? 5 : 3));
const at = (p) => `(${f3(p.x)}, ${f3(p.y)})`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const TOURNAMENT = 2;   // members compared in each selection tournament
const BLEND = 0.5;      // how far beyond its parents a child may land, as a fraction of their gap (BLX-0.5)

function run(input, t) {
  const L = landscapeById[input.landscape];
  if (!L) throw new Error('Unknown landscape.');
  const N = Math.round(input.population), G = Math.round(input.generations);
  if (N < 2) throw new Error('The population needs at least two members.');
  const rate = input.mutationRate, sigma = input.mutationSize, elitism = !!input.elitism;
  const rng = makeRng(input.seed);
  const evaluate = (x, y) => { t.count('function evaluations'); return L.f(x, y); };
  const bestOf = (pop) => pop.reduce((b, p) => (p.f < b.f ? p : b), pop[0]);
  const meanOf = (pop) => pop.reduce((s, p) => s + p.f, 0) / pop.length;

  let pop = Array.from({ length: N }, () => {
    const x = rng.float(L.x[0], L.x[1]), y = rng.float(L.y[0], L.y[1]);
    return { x, y, f: evaluate(x, y) };
  });
  let champion = { ...bestOf(pop), generation: 0 };
  const bestHistory = [champion.f], meanHistory = [meanOf(pop)];
  const base = landscapeLayers(L);
  const yRange = [0, Math.max(meanHistory[0], 1e-9) * 1.1];

  const tournament = () => {
    const picks = [];
    for (let k = 0; k < TOURNAMENT; k++) picks.push(rng.int(0, N - 1));
    let w = picks[0];
    for (const i of picks) if (pop[i].f < pop[w].f) w = i;
    return { picks, winner: w };
  };
  const blendRange = (a, b, lo, hi) => {
    const mn = Math.min(a, b), mx = Math.max(a, b), d = mx - mn;
    return [Math.max(lo, mn - BLEND * d), Math.min(hi, mx + BLEND * d)];
  };
  const crossover = (a, b) => {
    const rx = blendRange(a.x, b.x, L.x[0], L.x[1]), ry = blendRange(a.y, b.y, L.y[0], L.y[1]);
    return { x: rng.float(rx[0], rx[1]), y: rng.float(ry[0], ry[1]), rx, ry };
  };
  const mutate = (c) => {
    let { x, y } = c, changed = false;
    if (rng.next() < rate) { x = clamp(x + rng.normal(0, sigma), L.x[0], L.x[1]); changed = true; }
    if (rng.next() < rate) { y = clamp(y + rng.normal(0, sigma), L.y[0], L.y[1]); changed = true; }
    return { x, y, changed };
  };

  const chart = () => ({ kind: 'scene', title: 'Best and average value in each generation', x: [0, Math.max(5, G)], y: yRange, aspect: 0.2, axes: { xLabel: 'generation' },
    layers: [
      { type: 'line', points: meanHistory.map((v, i) => [i, v]), role: 'ochre', width: 1.8 },
      { type: 'points', points: meanHistory.map((v, i) => [i, v]), role: 'ochre', r: 2 },
      { type: 'line', points: bestHistory.map((v, i) => [i, v]), role: 'ink', width: 2 },
      { type: 'points', points: bestHistory.map((v, i) => [i, v]), role: 'ink', r: 2 },
    ],
    legend: [{ label: 'best value in the population', role: 'ink' }, { label: 'average value of the population', role: 'ochre' }] });
  const map = (layers, legend) => ({ kind: 'scene', title: 'The population on the surface', x: L.x, y: L.y, aspect: 0.6, axes: { xLabel: 'x', yLabel: 'y' }, layers: base.concat(layers), legend });
  const LEG = { contour: { label: 'contours of equal value', role: 'sage' }, min: { label: 'known minimum', role: 'forest' }, pop: { label: 'population', role: 'ochre' }, best: { label: 'best member', role: 'ink' } };
  const popLayer = (members, role = 'ochre', extra = {}) => ({ type: 'points', points: members.map((p) => [p.x, p.y]), role, r: 3.6, ...extra });
  const bestLayer = (p) => ({ type: 'points', points: [[p.x, p.y]], role: 'ink', r: 4.6, ring: true });
  const plain = (members) => [map([popLayer(members), bestLayer(bestOf(members))], [LEG.contour, LEG.min, LEG.pop, LEG.best]), chart()];

  t.frame(() => ({ line: 1, note: `Generation 0: ${N} points scattered at random over the map. Each one is a candidate answer, and its value is the height of the surface there. The best of them is at ${at(champion)} with value **${f3(champion.f)}**. The average value is ${f3(meanHistory[0])}.`,
    views: plain(pop), vars: { generation: 0, best: f3(champion.f), average: f3(meanHistory[0]) } }));

  for (let g = 1; g <= G; g++) {
    const next = [];
    const elite = bestOf(pop);
    if (elitism) next.push({ x: elite.x, y: elite.y, f: elite.f });
    const usedAsParent = new Set();
    let mutated = 0;
    while (next.length < N) {
      const ta = tournament(), tb = tournament();
      const a = pop[ta.winner], b = pop[tb.winner];
      usedAsParent.add(ta.winner); usedAsParent.add(tb.winner);
      const c = crossover(a, b);
      const m = mutate(c);
      if (m.changed) mutated++;
      const child = { x: m.x, y: m.y, f: evaluate(m.x, m.y) };
      const first = g === 1 && next.length === (elitism ? 1 : 0);
      if (first) {
        // Walk through the making of the very first child, one operator at a time.
        const others = popLayer(pop, 'ochre', { alpha: 0.55 });
        const legend = [LEG.contour, LEG.pop, { label: 'in the tournament', role: 'active' }, { label: 'chosen as a parent', role: 'done' }];
        const show = (i, role, label) => ({ type: 'points', points: [{ x: pop[i].x, y: pop[i].y, label }], role, r: 5.5, ring: true });
        const describe = (tr) => tr.picks.map((i) => `${at(pop[i])} with value ${f3(pop[i].f)}`).join(' and ');
        t.frame(() => ({ line: 5, note: `Making the first child. **Selection:** two members are picked at random, ${describe(ta)}. The one with the lower value wins this tournament and becomes the first parent.`,
          views: [map([others, ...ta.picks.map((i) => show(i, 'active')), show(ta.winner, 'done', 'parent A')], legend), chart()], vars: { generation: g, 'parent A value': f3(a.f) } }));
        t.frame(() => ({ line: 5, note: `A second tournament, between ${describe(tb)}, picks the second parent${ta.winner === tb.winner ? '. It happens to be the same member, which is allowed' : ''}. Good members win often and so have many children. Poor ones may have none.`,
          views: [map([others, show(ta.winner, 'done', 'parent A'), ...tb.picks.map((i) => show(i, 'active')), show(tb.winner, 'done', ta.winner === tb.winner ? 'parent A and B' : 'parent B')], legend), chart()], vars: { generation: g, 'parent A value': f3(a.f), 'parent B value': f3(b.f) } }));
        const box = { type: 'polygon', points: [[c.rx[0], c.ry[0]], [c.rx[1], c.ry[0]], [c.rx[1], c.ry[1]], [c.rx[0], c.ry[1]]], role: 'muted', width: 1, dash: [3, 4], alpha: 0.8 };
        const legend2 = [LEG.contour, LEG.pop, { label: 'parents', role: 'done' }, { label: 'child', role: 'active' }, { label: 'where the child can land', role: 'muted' }];
        t.frame(() => ({ line: 6, note: `**Crossover:** the child is a random blend of its parents. It is placed at random inside the dashed box, which spans the two parents and extends past them by half the distance between them. This time it lands at (${f3(c.x)}, ${f3(c.y)}).`,
          views: [map([others, box, { type: 'segments', segments: [[a.x, a.y, c.x, c.y], [b.x, b.y, c.x, c.y]], role: 'done', width: 1.4 }, show(ta.winner, 'done', 'parent A'), show(tb.winner, 'done', ta.winner === tb.winner ? 'parent A and B' : 'parent B'),
            { type: 'points', points: [{ x: c.x, y: c.y, label: 'child' }], role: 'active', r: 5 }], legend2), chart()], vars: { generation: g, 'child x': f3(c.x), 'child y': f3(c.y) } }));
        t.frame(() => ({ line: [7, 8], note: m.changed
          ? `**Mutation:** each coordinate has a ${Math.round(rate * 100)}% chance of a small random nudge. This child was nudged to (${f3(m.x)}, ${f3(m.y)}). Its value there is ${f3(child.f)}. It joins the next generation.`
          : `**Mutation:** each coordinate has a ${Math.round(rate * 100)}% chance of a small random nudge. This child was left alone. Its value is ${f3(child.f)}. It joins the next generation.`,
          views: [map([others, show(ta.winner, 'done', 'parent A'), show(tb.winner, 'done', ta.winner === tb.winner ? 'parent A and B' : 'parent B'),
            ...(m.changed ? [{ type: 'segments', segments: [[c.x, c.y, m.x, m.y]], role: 'active', width: 2, arrow: true }, { type: 'points', points: [[c.x, c.y]], role: 'active', r: 3, hollow: true }] : []),
            { type: 'points', points: [{ x: m.x, y: m.y, label: 'child' }], role: 'active', r: 5 }], legend2), chart()], vars: { generation: g, 'child value': f3(child.f) } }));
      }
      next.push(child);
    }
    const old = pop, oldBest = bestOf(old).f;
    const parents = old.filter((_, i) => usedAsParent.has(i)), childless = old.filter((_, i) => !usedAsParent.has(i));
    pop = next;
    const best = bestOf(pop), mean = meanOf(pop);
    if (best.f < champion.f) champion = { ...best, generation: g };
    bestHistory.push(best.f); meanHistory.push(mean);
    if (mean * 1.1 > yRange[1]) yRange[1] = mean * 1.1;

    t.frame(() => ({ line: [4, 5], note: `Generation ${g}, selection: ${N - (elitism ? 1 : 0)} children need two parents each, chosen by tournaments. ${parents.length} of the ${N} members won at least one tournament. The other ${childless.length} leave no children${elitism ? ', although the best member is also copied across unchanged' : ''}.`,
      views: [map([popLayer(childless, 'dim', { alpha: 0.8 }), popLayer(parents, 'done')],
        [LEG.contour, LEG.min, { label: 'chosen as a parent', role: 'done' }, { label: 'left no children', role: 'dim' }]), chart()],
      vars: { generation: g, parents: parents.length, childless: childless.length } }));
    t.frame(() => ({ line: [3, 6, 7, 9], note: `Generation ${g}, the new population: ${N - (elitism ? 1 : 0)} children made by crossover, ${mutated} of them also mutated${elitism ? ', plus the previous best' : ''}. The best value ${best.f < oldBest ? `improved from ${f3(oldBest)} to **${f3(best.f)}**` : best.f > oldBest ? `got worse, from ${f3(oldBest)} to **${f3(best.f)}**, because nothing protected the previous best` : `stays at ${f3(best.f)}`}. The average is ${f3(mean)}.`,
      views: plain(pop), vars: { generation: g, best: f3(best.f), average: f3(mean), 'best ever': f3(champion.f) } }));
  }

  const final = bestOf(pop);
  const spread = Math.sqrt(pop.reduce((s, p) => s + (p.x - final.x) ** 2 + (p.y - final.y) ** 2, 0) / N);
  t.frame(() => ({ line: 10, note: `Finished ${G} generations. The best point found is ${at(champion)} with value **${f3(champion.f)}**, first seen in generation ${champion.generation}. The lowest value anywhere on this map is ${f3(L.fmin)}. ${spread < 0.1 * (L.x[1] - L.x[0]) ? 'The population has drawn together around its best member, so further progress would come mostly from mutation.' : `The population is still widely scattered: its members lie ${f3(spread)} from the best one on average.`}`,
    views: plain(pop), vars: { generations: G, best: f3(champion.f), average: f3(meanHistory[G]) } }));

  return { bestValue: champion.f, x: champion.x, y: champion.y, foundAt: champion.generation, generations: G, population: N,
    finalBest: final.f, finalMean: meanHistory[G], spread, bestHistory, meanHistory, finalPopulation: pop.map((p) => [p.x, p.y]) };
}

const DEFAULTS = { landscape: 'rastrigin', seed: 7, population: 30, generations: 30, mutationRate: 0.2, mutationSize: 0.3, elitism: true };

// Counts over a range of seeds, used by one test to pin the figures quoted in viz.tryThis.
function seedScan(overrides, from, to) {
  const quiet = { count() {}, frame() {} };
  let centre = 0;
  for (let seed = from; seed <= to; seed++) {
    const r = run({ ...DEFAULTS, ...overrides, seed }, quiet);
    if (Math.abs(r.x) < 0.5 && Math.abs(r.y) < 0.5) centre++;
  }
  return centre;
}

export default {
  meta: {
    id: 'genetic-algorithm',
    name: 'Genetic Algorithm',
    aliases: ['GA', 'evolutionary algorithm', 'real-coded genetic algorithm', 'evolutionary optimization'],
    kind: 'heuristic',
    discipline: 'optimization',
    alsoIn: [
      { id: 'biology', why: 'It borrows three ideas from evolution and breeding: selection of the fitter, recombination of two parents, and random mutation.' },
      { id: 'ai', why: 'Evolutionary search is a standard way to optimize designs, schedules, game strategies and neural networks when nothing but a score is available.' },
    ],
    subfield: 'Global optimization',
    family: 'Evolutionary computation',
    lab: 'optimization',
    compareGroup: 'landscape-minimization',
    year: 1975,
    authors: 'John H. Holland',
    summary: 'Improves a population of candidate solutions over generations by selecting the better ones, blending pairs of them, and applying small random changes.',
    difficulty: 'intermediate',
    order: 520,
    paradigms: ['evolutionary', 'randomized-sampling'],
    randomized: true,
    approximate: true,
    time: { best: 'N evaluations per generation', average: 'About N × G evaluations for N members and G generations', worst: 'No bound for reaching the global minimum', class: 'iterative' },
    space: { worst: 'O(N · d)', class: 'linear' },
    tags: {
      problems: ['find a good design', 'optimize without a formula', 'minimize a function without a gradient', 'search a huge space of possibilities', 'global optimization', 'evolve a solution'],
      techniques: ['population', 'tournament selection', 'crossover', 'mutation', 'elitism'],
      applications: ['engineering design', 'machine learning', 'logistics', 'games'],
    },
    prerequisites: ['concept:heuristic', 'concept:randomization', 'concept:probability'],
  },

  bigIdea: {
    simple: "A genetic algorithm searches for a good answer in the way a breeder improves animals or crops: by breeding from the best of each generation, not by designing the result. It starts with a crowd of random guesses at the answer to a problem. It scores every guess to see how good it is. Then it builds a new crowd. Good guesses are picked more often to be parents. Two parents are blended to make a child that takes after both. Now and then a child is changed a little at random, which brings in something new. The new crowd replaces the old one, and the cycle repeats. Over many rounds the crowd drifts toward better answers. Nobody tells it how to improve. It only needs a way to tell a better guess from a worse one. It does not promise the best answer, only a good one.",
    what: 'A genetic algorithm keeps a population of candidate solutions and improves it generation by generation. Each generation it selects parents with a preference for better candidates, combines pairs of parents into children (crossover), and perturbs some children at random (mutation). The version on this page works on points with real-number coordinates and minimizes a function of two variables.',
    why: 'Some problems offer nothing to work with except a score: no formula to solve, no gradient to follow, sometimes not even numbers as inputs. John Holland developed genetic algorithms at the University of Michigan in the 1960s and 1970s as a model of how populations adapt. They became a general-purpose search method because a population, a score and a few random operators are enough to apply them to almost anything.',
    when: 'Use one when the objective is a black box, when the landscape has many local minima, when candidates are structures such as layouts or schedules, or when several objectives must be traded off at once. Do not use one where a gradient is available and the problem is smooth: [gradient descent](#/algorithm/gradient-descent) will be far cheaper. With a single candidate and a tight budget, [simulated annealing](#/algorithm/simulated-annealing) is the simpler choice.',
    interesting: 'No single member of the population knows where to go. Improvement comes from a statistical effect: better candidates leave more children, so whatever they have in common becomes more frequent. The same effect is the method\'s main weakness. Once the population has become nearly uniform, crossover has nothing left to combine and the search stalls, whether or not the best point has been found.',
    where: 'Engineering design, including an antenna that flew on a NASA mission, multi-objective optimization, scheduling, and the automatic design of neural networks. It is common wherever a design can be simulated and scored but not solved for.',
    analogy: {
      title: 'Selective breeding',
      text: 'A plant breeder wants wheat that survives drought. Each season they grow a field of plants, see which ones cope best, and keep seed mostly from those. They cross promising plants with each other, hoping a child inherits the strengths of both. Now and then a seed carries a small accidental change, and once in a while that change helps. The breeder never works out what a drought-proof plant should look like. They only compare plants and decide which ones get to have offspring. After enough seasons the field looks very different from the first one.',
      limits: "The algorithm borrows three ideas from breeding and almost nothing else. Real inheritance works through genes in ways far more intricate than averaging two numbers. A breeder's field holds thousands of plants and takes a year per generation, while the algorithm uses a few dozen candidates and judges each by one fixed score. Natural evolution has no score and no goal at all. So a genetic algorithm is not a simulation of evolution, and nothing about biology guarantees that it will work on a given problem.",
    },
  },

  example: {
    setup: "Find the number that makes this score as small as possible: subtract 7 from the number, then multiply the result by itself. The population has four members: 1, 4, 10 and 12. One round of the algorithm, called a generation, goes like this.",
    steps: [
      "Score every member. For 1 the score is 6 × 6 = 36. For 4 it is 3 × 3 = 9. For 10 it is 3 × 3 = 9. For 12 it is 5 × 5 = 25. The best score so far is 9.",
      "Selection. Pick two members at random: 1 and 10. The score of 10 is lower, so 10 becomes a parent. Pick two more: 4 and 12. This time 4 wins and becomes the other parent.",
      "Crossover. The child is a random blend of its parents 10 and 4. This time the blend lands on 5.5.",
      "Mutation. Now and then a child gets a small random nudge. This one is nudged by 0.5, from 5.5 to 6. Its score is 1 × 1 = 1.",
      "Repeat selection, crossover and mutation until there are four children. The best old member is also copied across unchanged, so that a good answer is never lost. The children replace the old population.",
    ],
    result: "The first child, 6, has score 1. That beats every member of the old population, whose best score was 9. Nobody worked out which way to move. Better numbers were simply more likely to become parents. A child can also turn out worse than both parents, and then it tends to lose its tournaments in the next generation.",
  },

  terms: [
    { term: "Candidate", meaning: "One possible answer to the problem. Here a candidate is a point on the map, given by two numbers." },
    { term: "Population", meaning: "The whole collection of candidates the algorithm is holding at one moment." },
    { term: "Value", meaning: "The score of a candidate. On this page lower is better. Many texts use a fitness, where higher is better, which is the same idea turned upside down." },
    { term: "Generation", meaning: "One round of the algorithm, in which a new population is built from the current one." },
    { term: "Selection", meaning: "Choosing which candidates become parents, with better ones more likely to be chosen." },
    { term: "Tournament", meaning: "A simple way to select: pick a few candidates at random and take the best of them." },
    { term: "Crossover", meaning: "Making a child by combining two parents, so that it resembles both." },
    { term: "Mutation", meaning: "A small random change made to a child, which brings in variety that the parents did not have." },
    { term: "Elitism", meaning: "Copying the best candidate into the next generation unchanged, so the best answer found cannot be lost." },
  ],

  takeaway: "Keep a crowd of guesses, let the better ones have more children, mix and slightly alter those children, and repeat.",

  viz: {
    describe: 'A contour map of a function of two variables with hollow green circles on its known minima. Ochre dots are the members of the current population, and a ringed dark dot is the best of them. In the selection frames, members chosen as parents are dark green and members that leave no children are grey. The first frames follow the making of one child: two tournaments, a dashed box showing where crossover can place the child, and an arrow for the mutation. A second, smaller chart plots the best and the average value of the population in every generation.',
    inputs: [
      { id: 'landscape', type: 'select', label: 'Surface', options: landscapeOptions, default: DEFAULTS.landscape },
      { id: 'seed', type: 'seed', label: 'Random seed', default: DEFAULTS.seed },
      { id: 'population', type: 'range', label: 'Population size', min: 4, max: 80, step: 2, default: DEFAULTS.population },
      { id: 'generations', type: 'range', label: 'Generations', min: 5, max: 100, step: 5, default: DEFAULTS.generations },
      { id: 'mutationRate', type: 'range', label: 'Mutation rate', min: 0, max: 1, step: 0.05, default: DEFAULTS.mutationRate,
        help: 'The chance that each coordinate of a child gets a random nudge.' },
      { id: 'mutationSize', type: 'range', label: 'Mutation size', min: 0.02, max: 2, step: 0.02, default: DEFAULTS.mutationSize,
        help: 'The typical length of a nudge (the standard deviation of a bell-shaped random step).' },
      { id: 'elitism', type: 'toggle', label: 'Elitism (keep the best member)', default: DEFAULTS.elitism },
    ],
    presets: [
      { label: 'Evolve on the ripples', values: { ...DEFAULTS } },
      { label: 'An unlucky seed: stuck one dip away', values: { ...DEFAULTS, seed: 3 } },
      { label: 'Tiny population, many generations', values: { ...DEFAULTS, population: 6, generations: 100 } },
      { label: 'No mutation: the population collapses', values: { ...DEFAULTS, seed: 2, mutationRate: 0 } },
      { label: 'Too much mutation', values: { ...DEFAULTS, mutationRate: 1, mutationSize: 1.5 } },
      { label: 'No elitism: the best can be lost', values: { ...DEFAULTS, elitism: false } },
      { label: 'Four minima', values: { ...DEFAULTS, landscape: 'himmelblau' } },
      { label: 'Curved valley', values: { ...DEFAULTS, landscape: 'rosenbrock' } },
    ],
    tryThis: [
      'Run the default and watch the two lines in the lower chart. The average falls quickly in the first generations as poor members fail to become parents. The best value falls in steps. Notice the counter: this run uses 900 function evaluations, three times the default budget of the simulated annealing lesson.',
      'Load "An unlucky seed: stuck one dip away". The population gathers in a dip next to the centre and stays there. This is premature convergence: selection has removed the variety that crossover would need to get out. Over the seeds 1 to 60, the default settings end in the central dip 48 times and somewhere else, usually one dip away, the other 12 times.',
      'Load "Tiny population, many generations". Six members cannot cover the map, and they become near copies of each other within a few generations. Running for 100 generations does not rescue them. Over the seeds 1 to 60, only 11 runs end in the central dip.',
      'Load "No mutation: the population collapses". Crossover can only blend what is already there. The members draw together until they are all on the same spot, every child lands on that spot too, and the search is over.',
      'Load "Too much mutation". Children are thrown so far from their parents that the average value never improves, and the method has turned into blind random search. On this small map blind search still stumbles on fairly good points. With many variables it would not.',
      'Load "No elitism: the best can be lost" and watch the dark line in the chart. It goes up as well as down, because the best member is not protected from being replaced by worse children.',
    ],
    run,
    report: (r, c) => `Best value ${f3(r.bestValue)} at (${f3(r.x)}, ${f3(r.y)}), first seen in generation ${r.foundAt} of ${r.generations}.\nFinal population: best ${f3(r.finalBest)}, average ${f3(r.finalMean)}, typical distance from the best member ${f3(r.spread)}.\n${c['function evaluations'] || 0} function evaluations.`,
  },

  logic: {
    intuition: 'A single searcher has to decide where to go next. A population does not decide anything. It is filtered. Every generation, candidates are compared, and the better ones are more likely to be copied forward with variations. Regions of the search space that keep producing good candidates fill up with members, and regions that do not are abandoned. Crossover produces new candidates in between and around good ones. Mutation keeps a trickle of novelty coming, so the population does not freeze the moment its members agree.',
    steps: [
      'Create a population of N random candidates and evaluate each one.',
      'Start the next generation. With elitism, copy the best current member into it unchanged.',
      'Select two parents. For each, hold a tournament: pick two members at random and keep the one with the lower value.',
      'Crossover: make a child by blending the two parents. On this page each coordinate of the child is drawn at random from the interval between the parents\' coordinates, widened by half its length on both sides.',
      'Mutation: with a small probability, add a random nudge to each coordinate of the child. Evaluate the child and add it to the next generation.',
      'Repeat steps 3 to 5 until the next generation has N members. It then replaces the current population. Repeat for the chosen number of generations and return the best candidate seen.',
    ],
    pseudocode: [
      'genetic_algorithm(f, N, generations):',
      '  population ← N random points',
      '  repeat generations times:',
      '    next ← [best member of population]     (elitism)',
      '    while next has fewer than N members:',
      '      a ← tournament(population);  b ← tournament(population)',
      '      child ← blend(a, b)                   (crossover)',
      '      child ← mutate(child)',
      '      add child to next',
      '    population ← next',
      '  return the best point seen',
    ],
    decisions: [
      { title: 'How to represent a candidate?', text: 'Here a candidate is simply a pair of real numbers, which is called a real-coded genetic algorithm. Holland\'s original version encoded candidates as strings of bits. For orderings, layouts or programs the representation and its operators must be designed together, and this choice often matters more than any parameter.' },
      { title: 'How hard to select?', text: 'A tournament of two gives the best member about twice its fair share of parent slots. Larger tournaments favour the best more strongly: progress is faster at first, and variety disappears sooner. This page fixes the tournament size at two.' },
      { title: 'Which crossover?', text: 'Blend crossover (BLX-α, with α = 0.5 here) draws each coordinate from the parents\' interval extended by α times its length at both ends. Plain averaging can only place children between their parents, which shrinks the population every generation. The extension lets children land slightly outside.' },
      { title: 'How much mutation?', text: 'Too little, and the population cannot recover variety once it has converged. Too much, and children no longer resemble their parents, so selection has nothing to build on. The useful range lies in between and depends on the problem.' },
      { title: 'Keep the best?', text: 'Elitism guarantees the best value never gets worse. It also strengthens selection a little, which can hasten convergence on a local minimum.' },
    ],
    invariants: [
      'Every generation has exactly N members.',
      'With elitism, the best value in the population never increases from one generation to the next.',
      'Every member stays inside the allowed region: the box used by crossover is cut off at the edge of the region, and a mutated child that lands outside is moved back to the edge.',
    ],
    edgeCases: [
      'All members identical: crossover of two equal parents returns the same point, so only mutation can produce anything new.',
      'Mutation rate 0: the population contracts onto a single spot, and after that nothing can change.',
      'Mutation rate 1 with a large size: children bear little relation to their parents and the method behaves like random search.',
      'Both tournaments pick the same member: the child is that member, possibly mutated. This is allowed.',
      'Ties in a tournament: the first of the tied members wins, which has no effect on the search.',
      'A population of only a few members converges almost at once and depends heavily on the luck of its first generation.',
    ],
    correctness: 'A genetic algorithm comes with no guarantee of finding the global minimum in any practical number of generations, and two runs with different seeds can end in different places. One limited statement is true. With elitism, and a mutation that has some chance of reaching every region, the best value found converges to the global minimum as the number of generations goes to infinity. The same holds for blind random search, so the statement says nothing about speed. More generally, the no-free-lunch theorems of Wolpert and Macready show that, averaged over all possible objective functions, no search method outperforms any other. A genetic algorithm works well only on problems whose structure suits its operators: where good candidates tend to lie near other good candidates, and where combining two good candidates tends to give another.',
    mistakes: [
      'Selecting the wrong way round, for example keeping the larger value in a tournament when the goal is to minimize.',
      'Building the next generation inside the current one, so that children compete as parents in the generation that created them.',
      'Forgetting to keep children inside the allowed region, or to re-evaluate a child after mutating it.',
      'Concluding that a setting is better from a single run. Compare settings over many seeds.',
      'Comparing against another method by generations instead of by function evaluations. One generation costs N evaluations.',
    ],
  },

  code: {
    sample: {
      input: 'Minimize f(x) = (x² − 1)² + 0.3x, the two-dip curve from the simulated annealing lesson, with 8 members for 12 generations. A small fixed random number generator makes every language print the same numbers.',
      expected: 'gen  0: best x=-0.7557 f=-0.0428 mean f=1.7555\ngen  3: best x=-0.9624 f=-0.2833 mean f=0.5125\ngen  6: best x=-1.0489 f=-0.3046 mean f=-0.1811\ngen  9: best x=-1.0370 f=-0.3054 mean f=-0.3045\ngen 12: best x=-1.0370 f=-0.3054 mean f=-0.0095',
    },
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


def best_of(pop):
    best = pop[0]
    for x in pop:
        if f(x) < f(best):
            best = x
    return best


def tournament(pop):
    a = pop[int(rand() * len(pop))]
    b = pop[int(rand() * len(pop))]
    return a if f(a) <= f(b) else b


def blend(a, b):
    lo, hi = min(a, b), max(a, b)
    gap = hi - lo
    return lo - 0.5 * gap + rand() * 2 * gap


def mutate(x, rate, size):
    if rand() < rate:
        x += size * math.sqrt(-2 * math.log(rand())) * math.cos(2 * math.pi * rand())
    return x


def report(generation, pop):
    total = 0.0
    for x in pop:
        total += f(x)
    best = best_of(pop)
    print(f"gen {generation:2d}: best x={best:.4f} f={f(best):.4f} mean f={total / len(pop):.4f}")


pop = [-2 + 4 * rand() for _ in range(8)]
report(0, pop)
for generation in range(1, 13):
    children = [best_of(pop)]
    while len(children) < len(pop):
        child = blend(tournament(pop), tournament(pop))
        children.append(mutate(child, 0.3, 0.2))
    pop = children
    if generation % 3 == 0:
        report(generation, pop)`,
      notes: [
        { line: 27, text: 'Tournament selection: two members picked at random, and the one with the lower value becomes a parent.' },
        { line: 33, text: 'Blend crossover. The child is drawn from an interval twice as long as the gap between its parents, centred on their midpoint.' },
        { line: 39, text: 'Gaussian mutation. With probability `rate`, add a bell-shaped random step of typical length `size`. The square root, logarithm and cosine turn two uniform random numbers into one bell-shaped one (the Box-Muller method).' },
        { line: 56, text: 'Elitism: the best member is copied into the next generation before any children are made.' },
        { line: 60, text: 'The children replace the whole population. Selection always draws parents from the old generation only.' },
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

function bestOf(pop) {
  let best = pop[0];
  for (const x of pop) if (f(x) < f(best)) best = x;
  return best;
}

function tournament(pop) {
  const a = pop[Math.floor(rand() * pop.length)];
  const b = pop[Math.floor(rand() * pop.length)];
  return f(a) <= f(b) ? a : b;
}

function blend(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const gap = hi - lo;
  return lo - 0.5 * gap + rand() * 2 * gap;
}

function mutate(x, rate, size) {
  if (rand() < rate) {
    x += size * Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
  }
  return x;
}

function report(generation, pop) {
  let total = 0;
  for (const x of pop) total += f(x);
  const best = bestOf(pop);
  console.log("gen " + String(generation).padStart(2, " ") + ": best x=" + best.toFixed(4)
    + " f=" + f(best).toFixed(4) + " mean f=" + (total / pop.length).toFixed(4));
}

let pop = [];
for (let i = 0; i < 8; i++) pop.push(-2 + 4 * rand());
report(0, pop);
for (let generation = 1; generation <= 12; generation++) {
  const children = [bestOf(pop)];
  while (children.length < pop.length) {
    const a = tournament(pop);
    const b = tournament(pop);
    children.push(mutate(blend(a, b), 0.3, 0.2));
  }
  pop = children;
  if (generation % 3 === 0) report(generation, pop);
}`,
    },
    cpp: {
      source: `#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

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

double best_of(const std::vector<double>& pop) {
    double best = pop[0];
    for (double x : pop) if (f(x) < f(best)) best = x;
    return best;
}

double tournament(const std::vector<double>& pop) {
    double a = pop[static_cast<int>(rnd() * pop.size())];
    double b = pop[static_cast<int>(rnd() * pop.size())];
    return f(a) <= f(b) ? a : b;
}

double blend(double a, double b) {
    double lo = std::min(a, b), hi = std::max(a, b);
    double gap = hi - lo;
    return lo - 0.5 * gap + rnd() * 2 * gap;
}

double mutate(double x, double rate, double size) {
    const double pi = 3.141592653589793;
    if (rnd() < rate) {
        double radius = std::sqrt(-2 * std::log(rnd()));
        x += size * radius * std::cos(2 * pi * rnd());
    }
    return x;
}

void report(int generation, const std::vector<double>& pop) {
    double total = 0;
    for (double x : pop) total += f(x);
    double best = best_of(pop);
    std::printf("gen %2d: best x=%.4f f=%.4f mean f=%.4f\\n", generation, best, f(best), total / pop.size());
}

int main() {
    std::vector<double> pop;
    for (int i = 0; i < 8; ++i) pop.push_back(-2 + 4 * rnd());
    report(0, pop);
    for (int generation = 1; generation <= 12; ++generation) {
        std::vector<double> children = {best_of(pop)};
        while (children.size() < pop.size()) {
            double a = tournament(pop);
            double b = tournament(pop);
            children.push_back(mutate(blend(a, b), 0.3, 0.2));
        }
        pop = children;
        if (generation % 3 == 0) report(generation, pop);
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The cost is counted in function evaluations, because scoring a candidate is usually far more expensive than selecting or blending. A run with N members and G generations evaluates the initial population and then one child per place per generation: N + G × (N − 1) evaluations with elitism, N + G × N without. The default run on this page uses 30 + 30 × 29 = 900.',
    cases: [
      { case: 'One generation', time: 'N evaluations (N − 1 with elitism)', when: 'Always. Selection, crossover and mutation add O(N · d) arithmetic for d variables.' },
      { case: 'One run', time: 'N + G × (N − 1) evaluations', when: 'The budget is chosen in advance. It does not depend on how hard the problem turns out to be.' },
      { case: 'Reaching the global minimum', time: 'No bound', when: 'No finite number of generations guarantees it.' },
    ],
    space: 'O(N · d): two populations of N candidates with d variables each, the current one and the one being built.',
    memory: 'Memory is rarely the constraint. Evaluations are. The evaluations within one generation are independent of each other, so they can be run in parallel on many processors, which is one practical reason to prefer a population method when each evaluation is a long simulation.',
    tradeoffs: 'A population explores many regions at once and is hard to trap in one dip, but it pays for every member in every generation. Compared with a single-candidate search given the same number of evaluations, each individual line of search gets only a small share of the budget.',
    assumptions: [
      'Cost is measured in function evaluations. One generation costs about N of them.',
      'The stated evaluation counts assume every child is evaluated once and the elite member is not re-evaluated.',
      'No convergence rate is claimed. How fast the population improves depends on the problem and on every parameter.',
    ],
  },

  tradeoffs: {
    excels: [
      'Black-box objectives where only a score is available.',
      'Rugged landscapes with many local minima, where a spread-out population is harder to trap than a single point.',
      'Candidates that are structures, such as bit strings, orderings, layouts or program trees, given suitable crossover and mutation operators.',
      'Problems with several competing objectives, where a population can represent a whole range of compromises.',
      'Settings where many evaluations can be run in parallel.',
    ],
    struggles: [
      'Problems where each evaluation is expensive and cannot be parallelized, since thousands of evaluations are normal.',
      'Smooth problems with available gradients, where gradient methods need far fewer evaluations.',
      'Fine precision: once near a minimum, random variation refines the answer slowly.',
      'Problems where blending two good candidates gives a bad one. Crossover then destroys more than it builds.',
    ],
    pitfalls: [
      'Premature convergence: the population becomes uniform around a local minimum before the global one is found.',
      'Many interacting parameters: population size, selection strength, crossover type, mutation rate and size. Good values differ from problem to problem.',
      'Judging by one run. Results vary with the seed, so report many runs.',
      'Flattering test functions. Many classic benchmarks, including the rippled surface on this page, have their best point at the centre of the search region, and operators that average their parents are drawn toward the centre whatever the function is. The blend crossover on this page places children around the midpoint of their parents, so it shares some of that bias. Test on shifted problems before trusting a result.',
      'Low dimension is misleading. On a two-variable map a few dozen random points already cover the surface fairly well. With hundreds of variables no population can.',
    ],
    misunderstandings: [
      "\"It simulates evolution.\" It borrows selection, crossover and mutation as ideas and leaves out nearly all of biology. Its success or failure on a problem tells you nothing about nature.",
      "\"Given enough generations it finds the best answer.\" It often settles on a good answer and stops improving. No practical run length guarantees the best one.",
      "\"More mutation means more creativity.\" Past a point, heavy mutation makes children unrelated to their parents, and the method becomes random search.",
      "\"Crossover is what makes it work.\" It depends on the problem. On some problems methods that use mutation and selection alone do as well, and how much crossover contributes has long been debated.",
    ],
    constraints: [
      'The evaluation budget usually fixes population size times generations. A larger population then means fewer generations.',
      'Constraints on candidates need special handling, such as repairing invalid children or penalizing them in the score.',
    ],
    alternatives: [
      { id: 'gradient-descent', name: 'Gradient Descent', when: 'The objective is smooth and its gradient can be computed.' },
      { id: 'simulated-annealing', name: 'Simulated Annealing', when: 'You want something simpler that keeps one candidate and still escapes local minima.' },
      { name: 'Evolution strategies such as CMA-ES', when: 'The variables are real numbers. These methods adapt the shape and size of their mutations and are usually stronger than a plain genetic algorithm on such problems.' },
      { name: 'Random search with restarts of a local method', when: 'As a baseline. If a genetic algorithm does not beat it, the extra machinery is not paying for itself.' },
      { id: 'knapsack', name: 'Exact methods such as dynamic programming', when: 'The problem has structure that allows an exact algorithm. An exact answer beats a heuristic one.' },
    ],
    comparison: {
      columns: ['', 'Genetic algorithm', 'Simulated annealing', 'Gradient descent'],
      rows: [
        ['Candidates kept', 'A population', 'One', 'One'],
        ['Information used', 'Function values only', 'Function values only', 'Gradients'],
        ['New candidates come from', 'Blending two parents, plus mutation', 'A small random change', 'A step against the gradient'],
        ['Evaluations in the default runs here', '900', 'About 300', 'At most 60 gradients'],
        ['Parallel evaluation', 'Natural: a whole generation at once', 'Not within one walk', 'Not applicable'],
        ['Guarantee', 'None', 'None with practical cooling', 'A stationary point'],
      ],
    },
  },

  applications: [
    { title: 'An evolved spacecraft antenna', status: 'established', text: 'NASA\'s Space Technology 5 mission, launched in 2006, carried an antenna whose bent-wire shape was produced by an evolutionary algorithm instead of being drawn by an engineer. Candidate shapes were scored by an electromagnetic simulation.' },
    { title: 'Design with several objectives', status: 'established', text: 'Real designs trade off goals such as weight against strength. NSGA-II, a genetic algorithm published by Kalyanmoy Deb and colleagues in 2002, evolves a population toward the whole set of best compromises and is one of the most widely used methods for such problems.' },
    { title: 'Evolving neural networks', status: 'established', text: 'Evolutionary methods are used to search over the structure and weights of neural networks. NEAT, published by Kenneth Stanley and Risto Miikkulainen in 2002, evolves both the wiring and the weights of small networks.' },
    { title: 'Timetables and rosters', status: 'illustrative', text: 'A candidate is a complete timetable, the score counts clashes and broken preferences, crossover swaps parts of two timetables, and mutation moves one lesson.' },
    { title: 'Tuning a simulated design', status: 'illustrative', text: 'When a design can only be judged by running a simulation, each member of the population is a set of design parameters, and a generation is a batch of simulations that can run side by side.' },
  ],

  connections: [
    { to: 'simulated-annealing', type: 'same-problem', why: 'Both are randomized searches that use only function values and accept no guarantee. Annealing perturbs one candidate and sometimes accepts a worse one. A genetic algorithm keeps many candidates and lets selection decide which survive.' },
    { to: 'gradient-descent', type: 'same-problem', why: 'Both lower a function step by step. Gradient descent uses the slope at one point to choose a direction. A genetic algorithm uses no slope and infers where to go from which members of a population score better.' },
    { to: 'monte-carlo', type: 'related', why: 'Both draw random samples and let the outcomes guide the answer. Monte Carlo sampling keeps its distribution fixed. A genetic algorithm reshapes the distribution of its samples every generation toward the better ones.' },
    { to: 'knapsack', type: 'related', why: 'Choosing which items to pack is naturally a string of yes-or-no bits, the classic encoding for a genetic algorithm. Dynamic programming solves it exactly when capacities are small. A genetic algorithm gives approximate answers when they are not.' },
    { to: 'backpropagation', type: 'related', why: 'Both are used to train neural networks. Backpropagation supplies the exact gradient of the loss, which gradient descent then follows. Evolutionary methods need only the loss value, at the cost of many more evaluations.' },
    { to: 'concept:heuristic', type: 'prerequisite', why: 'A genetic algorithm is a heuristic: a search strategy that often works well and comes with no promise that it will.' },
    { to: 'concept:exploration-exploitation', type: 'prerequisite', why: 'Selection exploits what the population has already found. Mutation and a spread-out population explore. Every parameter shifts the balance between the two.' },
    { to: 'concept:randomization', type: 'prerequisite', why: 'The starting population, the tournaments, the blend and the mutations are all random draws, which is why results are reported over many seeds.' },
    { to: 'discipline:biology', type: 'related', why: 'Selection, recombination and mutation are taken from the theory of evolution and from the practice of breeding, in a very simplified form.' },
    { to: 'discipline:ai', type: 'application', why: 'Search for a good design or strategy when only a score is available is a core problem of artificial intelligence, and evolutionary methods are one family of answers to it.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does elitism guarantee?',
      options: ['That the global minimum is found eventually', 'That the best value in the population never gets worse from one generation to the next', 'That every child is better than its parents', 'That the population stays spread out'],
      answer: 1,
      explain: [
        'Elitism protects what has been found. It does not help find what has not.',
        'Correct. The best member is copied into the next generation unchanged, so the best value can only stay the same or improve.',
        'Children are random blends and can easily be worse than both parents.',
        'Elitism slightly reduces variety, since one place is always taken by a copy.',
      ],
    },
    {
      type: 'predict',
      q: 'The mutation rate is set to 0 and the algorithm runs for 30 generations on the rippled surface (the "No mutation" preset). What does the final population look like?',
      options: ['Spread evenly over the map, as at the start', 'All 30 members sit on practically the same spot', 'Split into several groups, one in each dip', 'It keeps drifting and never settles'],
      answer: 1,
      explain: [
        'Selection removes poor members every generation, so the spread cannot survive.',
        'Correct. Selection keeps removing variety and nothing puts it back. By the end the members lie within a thousandth of a unit of each other, and blending two nearly identical parents gives nearly the same point again. In this run they collapse in a dip next to the centre, with value about 0.995, and cannot leave.',
        'Several groups can coexist for a while, but tournaments between them keep removing the weaker until one is left.',
        'Drift needs a source of change. With no mutation and identical members there is none.',
      ],
      tryInput: { ...DEFAULTS, seed: 2, mutationRate: 0 },
    },
    {
      type: 'debug',
      q: 'This genetic algorithm is supposed to minimize f, but the average value of the population rises every generation. What is wrong?',
      code: `def tournament(pop):
    a = pop[int(rand() * len(pop))]
    b = pop[int(rand() * len(pop))]
    return a if f(a) >= f(b) else b`,
      options: ['It should pick a and b without replacement', 'It keeps the member with the larger value, so the worse candidate becomes the parent', 'It needs a tournament of at least three', 'rand() should be seeded inside the function'],
      answer: 1,
      explain: [
        'Picking with replacement is fine. A member sometimes meets itself and wins.',
        'Correct. For minimization the parent must be the one with the lower value: `f(a) <= f(b)`. As written, the algorithm breeds from the losers and maximizes f.',
        'Two is the usual tournament size and works.',
        'Reseeding on every call would make every tournament identical.',
      ],
    },
    {
      type: 'choice',
      q: 'A run has stopped improving, and all members of the population are nearly identical but not at the global minimum. What is this called, and what caused it?',
      options: ['Overfitting, caused by too many generations', 'Premature convergence, caused by selection removing variety faster than mutation restores it', 'Divergence, caused by a mutation size that is too large', 'A plateau, caused by the function being flat'],
      answer: 1,
      explain: [
        'Overfitting is about a model matching its training data too closely. Nothing is being fitted to data here.',
        'Correct. Remedies include a larger population, weaker selection, more mutation, or restarting with fresh random members.',
        'Large mutations keep the population spread out. The symptom here is the opposite.',
        'The function is not flat. The population has simply lost the variety it would need to move.',
      ],
    },
    {
      type: 'challenge',
      title: 'Evolve a packing list',
      prompt: 'Take a 0/1 knapsack problem with 24 items of random weight and value and a capacity of half the total weight. Encode a candidate as 24 bits, one per item. Write a genetic algorithm with tournament selection, one-point crossover (the child takes the first k bits from one parent and the rest from the other) and bit-flip mutation. Decide how to treat candidates that exceed the capacity. Compare the best value found with the exact optimum from dynamic programming over 30 seeds, and report how often the optimum is reached and how many evaluations were used.',
      hints: ['Two common ways to handle overweight candidates: give them a penalized score, or repair them by removing items until they fit.', 'A mutation probability of about one divided by the number of bits is a common starting point.'],
    },
  ],

  compare: {
    idea: 'Evolve a population: select the better candidates, blend pairs of them, mutate the children, repeat.',
    requires: 'A way to score a candidate, and ways to combine and randomly alter candidates that suit how they are written down. It does not promise the best answer.',
    sensitivity: 'High. Results depend on population size, selection strength, the crossover and mutation settings, and the random seed.',
    memory: 'O(N · d) for a population of N candidates with d variables.',
    difficulty: 'moderate',
    difficultyNote: 'The loop is short. Choosing a representation, operators and parameters that suit the problem is the hard part.',
    limits: 'It needs many scores. It can settle too early on a mediocre answer. It is slow to polish an answer to fine precision.',
    useWhen: 'You can score a candidate but cannot describe the problem with a formula, you can afford thousands of scores, and a good answer is enough.',
  },

  advanced: {
    history: 'John Holland and his students at the University of Michigan developed genetic algorithms during the 1960s and 1970s. His 1975 book, *Adaptation in Natural and Artificial Systems*, presented them as a general model of adaptation and analysed them with what became known as the schema theorem. In the same year Kenneth De Jong\'s doctoral thesis studied them as function optimizers. Independently, Ingo Rechenberg and Hans-Paul Schwefel in Germany had developed evolution strategies for engineering design in the 1960s, working with real-valued parameters and mutation, and Lawrence Fogel in the United States had proposed evolutionary programming. David Goldberg\'s 1989 textbook brought genetic algorithms to a wide engineering audience. The separate traditions are now grouped together as evolutionary computation. How well the schema theorem explains the behaviour of real runs has been disputed ever since.',
    derivation: 'How strongly does a tournament of two favour good members? Rank the $N$ members from best ($r = 1$) to worst ($r = N$) and draw two at random with replacement. The member of rank $r$ wins if both draws have rank $r$ or worse, and at least one of them is $r$ itself:\n\n$$P(\\text{rank } r \\text{ wins}) = \\frac{(N-r+1)^2 - (N-r)^2}{N^2} = \\frac{2(N-r)+1}{N^2}.$$\n\nFor the best member this is $(2N-1)/N^2$, about $2/N$: twice the share it would get if parents were chosen blindly. For the worst it is $1/N^2$. With $N = 30$ the best member wins a given tournament with probability $59/900$, about 6.6 percent, against a blind share of 3.3 percent.\n\nThe same calculation shows how fast variety can disappear. Suppose a fraction $p$ of the population are copies of the best member and there is no crossover or mutation. A tournament returns one of those copies unless both draws miss them, so the fraction in the next generation is expected to be\n\n$$p\' = 1 - (1-p)^2 = 2p - p^2.$$\n\nWhile $p$ is small it doubles every generation. Starting from one copy, $p = 1/N$, the copies fill most of the population after about $\\log_2 N$ generations, which is only 5 for $N = 30$. Crossover and mutation have to create useful variety at least that fast, or the search converges on whatever was best early on.',
    variants: [
      { name: 'Binary-coded genetic algorithm', text: 'Holland\'s original form. Candidates are bit strings, crossover cuts two strings at a random position and swaps the tails, and mutation flips individual bits.' },
      { name: 'Evolution strategies and CMA-ES', text: 'Work on real vectors and rely mainly on Gaussian mutation, adapting its size and shape during the run. CMA-ES learns a full covariance matrix for its mutations.' },
      { name: 'Differential evolution', text: 'Creates a candidate by adding the scaled difference of two population members to a third, so step sizes adapt automatically to the spread of the population.' },
      { name: 'Genetic programming', text: 'Evolves programs or formulas, usually represented as trees, with crossover that swaps subtrees.' },
      { name: 'Multi-objective algorithms', text: 'Methods such as NSGA-II rank candidates by whether any other candidate is better on every objective, and evolve the whole set of best trade-offs at once.' },
      { name: 'Island models', text: 'Several populations evolve separately and occasionally exchange members, which preserves variety and suits parallel computers.' },
    ],
    implementation: 'Evaluate each candidate once and store the value with it. Use a fresh array for the next generation. Keep track of the variety in the population, for example the average distance between members, since a collapse in variety is the usual reason a run stalls. Where evaluations are expensive, run a generation\'s evaluations in parallel. Make every random draw come from a seeded generator so that runs can be repeated.',
    benchmarking: 'Report the distribution of results over many seeds at a fixed budget of function evaluations, never a single best run. Include random search and a simple local search with restarts as baselines. Use test functions whose optimum is shifted away from the centre of the search region, because many operators are biased toward the centre.',
    references: [
      { authors: 'J. H. Holland', year: 1975, title: 'Adaptation in Natural and Artificial Systems', venue: 'University of Michigan Press' },
      { authors: 'D. E. Goldberg', year: 1989, title: 'Genetic Algorithms in Search, Optimization, and Machine Learning', venue: 'Addison-Wesley' },
      { authors: 'L. J. Eshelman and J. D. Schaffer', year: 1993, title: 'Real-coded genetic algorithms and interval-schemata', venue: 'Foundations of Genetic Algorithms 2, Morgan Kaufmann' },
      { authors: 'D. H. Wolpert and W. G. Macready', year: 1997, title: 'No free lunch theorems for optimization', venue: 'IEEE Transactions on Evolutionary Computation 1(1), 67-82' },
      { authors: 'K. Deb, A. Pratap, S. Agarwal and T. Meyarivan', year: 2002, title: 'A fast and elitist multiobjective genetic algorithm: NSGA-II', venue: 'IEEE Transactions on Evolutionary Computation 6(2), 182-197' },
    ],
    furtherReading: [
      'M. Mitchell, *An Introduction to Genetic Algorithms*, MIT Press (1996).',
      'A. E. Eiben and J. E. Smith, *Introduction to Evolutionary Computing*, Springer.',
    ],
  },

  tests: [
    { name: 'default run reaches the central dip and uses the stated number of evaluations', input: {},
      check: (r, c) => (r.bestValue < 0.01 && Math.abs(r.x) < 0.5 && Math.abs(r.y) < 0.5 && c['function evaluations'] === 30 + 30 * 29) || `best ${r.bestValue}, ${c['function evaluations']} evaluations` },
    { name: 'with elitism the best value never gets worse', input: { ...DEFAULTS, seed: 11, landscape: 'himmelblau' },
      check: (r) => r.bestHistory.every((v, i) => i === 0 || v <= r.bestHistory[i - 1]) || 'the best value rose' },
    { name: 'without elitism the best value can get worse, and one more evaluation is used per generation', input: { ...DEFAULTS, elitism: false },
      check: (r, c) => (r.bestHistory.some((v, i) => i > 0 && v > r.bestHistory[i - 1]) && r.bestValue === Math.min(...r.bestHistory) && c['function evaluations'] === 30 + 30 * 30) || 'expected the best value to rise at least once' },
    { name: 'the unlucky seed converges in a dip next to the centre', input: { ...DEFAULTS, seed: 3 },
      check: (r) => (Math.abs(r.bestValue - 0.995) < 0.01 && Math.hypot(r.x - 1, r.y) < 0.2) || `best ${r.bestValue} at (${r.x}, ${r.y})` },
    { name: 'with no mutation the population collapses onto one spot', input: { ...DEFAULTS, seed: 2, mutationRate: 0 },
      check: (r) => (r.spread < 1e-3 && Math.abs(r.bestValue - 0.995) < 0.01) || `spread ${r.spread}, best ${r.bestValue}` },
    { name: 'every member stays inside the map', input: { ...DEFAULTS, landscape: 'rosenbrock', mutationRate: 1, mutationSize: 2 },
      check: (r) => r.finalPopulation.every(([x, y]) => x >= -2 && x <= 2 && y >= -1 && y <= 3) || 'a member left the map' },
    { name: 'finds a Himmelblau minimum', input: { ...DEFAULTS, landscape: 'himmelblau' },
      check: (r) => r.bestValue < 0.01 || `best ${r.bestValue}` },
    { name: 'the numbers in the worked example and the derivation', input: {},
      check: () => {
        const score = (x) => (x - 7) * (x - 7);
        const ok = [1, 4, 10, 12].map(score).join() === '36,9,9,25' && score(5.5) === 2.25 && score(6) === 1 && 5.5 >= 4 - 3 && 5.5 <= 10 + 3;
        const n = 30, pBest = (2 * n - 1) / (n * n);
        return (ok && pBest === 59 / 900 && Math.round(pBest * 1000) === 66 && Math.round(Math.log2(n)) === 5) || 'a quoted number is wrong';
      } },
    { name: 'the seed statistics quoted in Try this', input: {},
      check: () => {
        const a = seedScan({}, 1, 60), b = seedScan({ population: 6, generations: 100 }, 1, 60);
        return (a === 48 && b === 11) || `default ${a} of 60 in the central dip, tiny population ${b}`;
      } },
  ],
};
