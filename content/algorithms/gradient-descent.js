import { landscapeById, landscapeOptions, landscapeLayers, fromUnit } from '../../js/lib/landscapes.js';

const TOL = 1e-3;
const f4 = (v) => (Math.abs(v) >= 1000 ? v.toExponential(2) : v.toFixed(Math.abs(v) < 0.01 && v !== 0 ? 5 : 3));

// The experiment uses a family of quadratics f(x, y) = ½(x² + κy²) with condition number κ.
const quadratic = (kappa) => ({
  id: 'quadratic', f: (x, y) => 0.5 * (x * x + kappa * y * y), grad: (x, y) => [x, kappa * y],
  x: [-1.5, 1.5], y: [-1.5, 1.5], minima: [[0, 0]], fmin: 0,
});

function run(input, t) {
  const L = input.landscape === 'quadratic' ? quadratic(input.kappa) : landscapeById[input.landscape];
  if (!L) throw new Error('Unknown landscape.');
  const eta = input.rate, beta = input.momentum;
  const maxSteps = input.steps;
  let [x, y] = input.landscape === 'quadratic' ? [1, 1] : fromUnit(L, input.startX, input.startY);
  let vx = 0, vy = 0;
  const path = [[x, y]];
  const losses = [L.f(x, y)];
  let status = 'budget';
  const base = input.landscape === 'quadratic' ? [] : landscapeLayers(L);

  const views = (g) => {
    const layers = base.slice();
    layers.push({ type: 'line', points: path.slice(), role: 'terracotta', width: 2 });
    layers.push({ type: 'points', points: path.slice(0, -1), role: 'terracotta', r: 2.2, alpha: 0.75 });
    if (g) {
      const scale = 0.16 * (L.x[1] - L.x[0]) / (Math.hypot(g[0], g[1]) || 1);
      layers.push({ type: 'segments', segments: [[x, y, x - g[0] * scale, y - g[1] * scale]], role: 'ochre', width: 2, arrow: true });
    }
    layers.push({ type: 'points', points: [[x, y]], role: 'terracotta', r: 5.5, ring: true });
    const top = Math.max(...losses.filter(Number.isFinite), 1e-9);
    return [
      { kind: 'scene', title: 'Path over the loss surface', x: L.x, y: L.y, aspect: 0.6, axes: { xLabel: 'x', yLabel: 'y' }, layers,
        legend: [{ label: 'contours of equal loss', role: 'sage' }, { label: 'known minimum', role: 'forest' }, { label: 'path so far', role: 'terracotta' }, { label: 'downhill direction (−gradient)', role: 'ochre' }] },
      { kind: 'scene', title: 'Loss at each step', x: [0, Math.max(10, maxSteps)], y: [0, top * 1.08], aspect: 0.2, axes: { xLabel: 'step' },
        layers: [{ type: 'line', points: losses.map((v, i) => [i, Math.min(v, top * 2)]), role: 'forest', width: 2 }] },
    ];
  };

  t.frame(() => ({ line: 1, note: `Start at (${f4(x)}, ${f4(y)}), where the loss is ${f4(losses[0])}. The contour lines join points of equal loss; the goal is the lowest point.`, views: views(null), vars: { x: f4(x), y: f4(y), loss: f4(losses[0]) } }));

  let k = 0;
  for (; k < maxSteps; k++) {
    const g = L.grad(x, y);
    t.count('gradient evaluations');
    const norm = Math.hypot(g[0], g[1]);
    if (norm < TOL) {
      status = 'converged';
      t.frame(() => ({ line: 4, note: `The gradient has length ${norm.toExponential(1)}, below the tolerance. The surface is flat here, so stop: this is a stationary point.`, views: views(null), vars: { step: k, '‖g‖': norm.toExponential(1), loss: f4(losses[losses.length - 1]) } }));
      break;
    }
    t.frame(() => ({ line: 3, note: `The gradient here is (${f4(g[0])}, ${f4(g[1])}). It points uphill, so the arrow shows the opposite, downhill direction.`, views: views(g), vars: { step: k, '‖g‖': f4(norm), loss: f4(losses[losses.length - 1]) } }));
    vx = beta * vx - eta * g[0];
    vy = beta * vy - eta * g[1];
    x += vx; y += vy;
    const loss = L.f(x, y);
    const prevLoss = losses[losses.length - 1];
    path.push([x, y]);
    losses.push(loss);
    if (!Number.isFinite(loss) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) {
      status = 'diverged';
      t.frame(() => ({ line: 6, note: `The step overshot so badly that the position has left any sensible range. The learning rate is too large for this surface: the iteration has **diverged**.`, views: views(null), vars: { step: k + 1 } }));
      break;
    }
    t.frame(() => ({ line: [5, 6], note: `Step ${k + 1}: move by learning rate × gradient${beta > 0 ? ' plus momentum from earlier steps' : ''} to (${f4(x)}, ${f4(y)}). Loss ${loss < prevLoss ? 'fell' : 'rose'} from ${f4(prevLoss)} to ${f4(loss)}.${loss > prevLoss ? ' An increase means the step jumped past the bottom of the slope.' : ''}`,
      views: views(null), vars: { step: k + 1, x: f4(x), y: f4(y), loss: f4(loss) } }));
  }
  const finalLoss = losses[losses.length - 1];
  if (status === 'budget') {
    t.frame(() => ({ line: 7, note: `Used all ${maxSteps} steps. The loss is ${f4(finalLoss)} and the gradient is not yet below the tolerance, so more steps (or a better learning rate) are needed.`, views: views(null), vars: { steps: maxSteps, loss: f4(finalLoss) } }));
  } else if (status === 'converged') {
    t.frame(() => ({ line: 7, note: `Converged after ${k} steps at (${f4(x)}, ${f4(y)}) with loss ${f4(finalLoss)}. Gradient descent only guarantees a stationary point; whether it is the global minimum depends on the surface and the start.`, views: views(null), vars: { steps: k, loss: f4(finalLoss) } }));
  }
  return { x, y, bestValue: finalLoss, steps: path.length - 1, status, losses };
}

export default {
  meta: {
    id: 'gradient-descent',
    name: 'Gradient Descent',
    aliases: ['steepest descent', 'batch gradient descent', 'GD', 'gradient method'],
    kind: 'algorithm',
    discipline: 'optimization',
    alsoIn: [
      { id: 'machine-learning', why: 'Fitting a model means minimizing a loss; gradient descent and its variants are the standard way to do it.' },
      { id: 'deep-learning', why: 'Neural networks are trained by stochastic variants of gradient descent, with backpropagation supplying the gradient.' },
      { id: 'statistics', why: 'Maximum likelihood estimates without closed forms are found by following the gradient of the log-likelihood.' },
      { id: 'mathematics', why: 'It is the simplest iterative method of numerical optimization, analysed with calculus and linear algebra.' },
    ],
    subfield: 'Gradient methods',
    family: 'First-order methods',
    lab: 'optimization',
    compareGroup: 'landscape-minimization',
    year: 1847,
    authors: 'Augustin-Louis Cauchy',
    summary: 'Minimizes a differentiable function by repeatedly stepping in the direction of steepest descent, the negative gradient.',
    difficulty: 'intermediate',
    order: 500,
    paradigms: ['gradient-based', 'iterative-refinement'],
    randomized: false,
    approximate: true,
    time: { best: 'O(d) per step', average: 'O(κ log(1/ε)) steps (strongly convex)', worst: 'No guarantee without assumptions', class: 'iterative' },
    space: { worst: 'O(d)', class: 'linear' },
    tags: {
      problems: ['minimize a function', 'find the lowest point', 'train a model', 'make a neural network learn', 'fit parameters to data', 'reduce a loss'],
      techniques: ['gradient', 'learning rate', 'momentum', 'iterative update'],
      applications: ['machine learning', 'scientific computing', 'engineering design', 'statistics'],
    },
    prerequisites: ['concept:derivative', 'concept:gradient', 'concept:loss-function', 'concept:convergence'],
  },

  bigIdea: {
    simple: "Gradient descent is a way to find the lowest point of something when you cannot see all of it. Imagine standing on a hillside in thick fog. You want to reach the bottom of the valley. You cannot see the valley, but you can feel which way the ground slopes under your feet. So you take a small step downhill. Then you feel the slope again and take another step. Keep going, and you end up somewhere low. Computers use the same trick with numbers. They start with a guess. They measure how wrong the guess is, and work out which small change would make it less wrong. They make that change, then repeat, often millions of times. This is what people mean when they say a computer program is learning: each step makes its answers a little less wrong.",
    what: 'Gradient descent finds a low point of a function by taking repeated small steps downhill. At each position it computes the gradient, the direction in which the function rises fastest, and moves a short distance the opposite way.',
    why: 'Most interesting functions cannot be minimized with a formula. Augustin-Louis Cauchy proposed the method in 1847 for solving systems of equations arising in astronomy. It needs only the ability to compute a slope at the current point, which is why it scales to functions of millions or billions of variables.',
    when: 'Use it when the function is differentiable and you can compute its gradient, especially when the number of variables is large. Prefer [Newton\'s method](#/algorithm/newtons-method) when there are few variables and second derivatives are cheap. Prefer [simulated annealing](#/algorithm/simulated-annealing) or a [genetic algorithm](#/algorithm/genetic-algorithm) when there is no gradient or many deceptive local minima.',
    interesting: 'One number, the learning rate, decides everything. Too small and progress is painfully slow; slightly too large and the iterates bounce across the valley; larger still and they fly off to infinity. The boundary between these regimes is set by the curvature of the surface, and you can find it yourself in the visualization.',
    where: 'It is the engine of modern machine learning: every neural network is trained by a variant of it. It also fits statistical models, tunes engineering designs, and reconstructs images in medical scanners.',
    analogy: {
      title: "The steepest way down, and the length of your stride",
      limits: "A hiker moves smoothly and would feel the ground begin to rise. The algorithm jumps from point to point and finds out where it has landed only afterwards. A hillside also has only two directions to move in, while the problems solved in machine learning have millions of directions at once. And fog or no fog, a hiker who reaches a small dip may be nowhere near the deepest valley. The algorithm has the same weakness.",
      text: "Two things about the foggy hillside still need saying. First, of all the directions that lead down, you step in the steepest one. Second, the length of your stride matters. Tiny strides are safe but slow. Giant strides can carry you clear across the valley and up the other side. In the algorithm the stride length is a number you choose, called the learning rate.",
    },
  },

  example: {
    setup: "Find the lowest point of the curve y = x × x, starting from x = 4. For this curve, the slope at any point is 2 × x. Each step moves by one quarter of the slope. That fraction is called the learning rate.",
    steps: [
      "At x = 4 the slope is 2 × 4 = 8. A quarter of 8 is 2, so step from 4 down to 2.",
      "At x = 2 the slope is 4. A quarter of 4 is 1, so step from 2 down to 1.",
      "At x = 1 the slope is 2. A quarter of 2 is 0.5, so step from 1 down to 0.5.",
      "At x = 0.5 the slope is 1. A quarter of 1 is 0.25, so step from 0.5 down to 0.25.",
    ],
    result: "The guesses were 4, 2, 1, 0.5, 0.25. Each step halves the distance to the true lowest point, which is at x = 0. A step turns x into x − rate × 2 × x, which is (1 − 2 × rate) × x, so with a rate of one quarter every step multiplies the distance by one half. Whatever the rate, every step multiplies by that same number: the distance shrinks when the size of the number is below 1 and grows when it is above 1. The steps get shorter without being told to, because the slope gets gentler near the bottom.",
  },

  terms: [
    { term: "Function", meaning: "A rule that turns one or more input numbers into an output number." },
    { term: "Minimum", meaning: "An input where the output of a function is as low as it gets, at least compared with nearby inputs." },
    { term: "Slope", meaning: "How steeply the output changes when the input changes a little. Also called the derivative." },
    { term: "Gradient", meaning: "The slopes in every direction, collected together. It points in the direction of the steepest climb." },
    { term: "Loss", meaning: "A score for how wrong a guess is. Lower is better." },
    { term: "Learning rate", meaning: "A number that sets how long each step is." },
    { term: "Converge", meaning: "To settle down, getting closer and closer to one answer." },
    { term: "Convex", meaning: "Shaped like a single bowl, with no separate dips. On a convex surface, the first low point you find is the lowest one." },
  ],

  takeaway: "Feel which way is downhill, take a small step that way, and repeat.",

  viz: {
    describe: 'A contour map of a two-variable loss function, with closed curves joining points of equal loss and hollow green circles marking the known minima. A terracotta path shows every position visited so far and an ochre arrow shows the current downhill direction. A second, smaller chart plots the loss at each step.',
    inputs: [
      { id: 'landscape', type: 'select', label: 'Loss surface', options: landscapeOptions, default: 'bowl' },
      { id: 'rate', type: 'range', scale: 'log', label: 'Learning rate (η)', min: 0.001, max: 1.2, default: 0.1,
        help: 'Step length as a multiple of the gradient. Logarithmic slider.' },
      { id: 'momentum', type: 'range', label: 'Momentum (β)', min: 0, max: 0.95, step: 0.05, default: 0,
        help: '0 is plain gradient descent. Higher values carry over more of the previous step.' },
      { id: 'steps', type: 'range', label: 'Maximum steps', min: 10, max: 300, step: 10, default: 60 },
      { id: 'startX', type: 'range', label: 'Start position, horizontal', min: -1, max: 1, step: 0.05, default: -0.85 },
      { id: 'startY', type: 'range', label: 'Start position, vertical', min: -1, max: 1, step: 0.05, default: 0.7 },
    ],
    presets: [
      { label: 'Steady descent', values: { landscape: 'bowl', rate: 0.1, momentum: 0, steps: 60 } },
      { label: 'Step too large: divergence', values: { landscape: 'bowl', rate: 1.1, momentum: 0, steps: 80 } },
      { label: 'Zig-zag in a narrow valley', values: { landscape: 'valley', rate: 0.15, momentum: 0, steps: 80 } },
      { label: 'Same valley with momentum', values: { landscape: 'valley', rate: 0.15, momentum: 0.5, steps: 80 } },
      { label: 'Four minima', values: { landscape: 'himmelblau', rate: 0.005, momentum: 0, steps: 120 } },
      { label: 'Curved valley', values: { landscape: 'rosenbrock', rate: 0.004, momentum: 0.8, steps: 300 } },
      { label: 'Trapped by ripples', values: { landscape: 'rastrigin', rate: 0.002, momentum: 0, steps: 80 } },
    ],
    tryThis: [
      { ask: 'On the round bowl the slope in each direction is 2 × the position, as in the worked example. So one step multiplies the distance from the centre by (1 − 2 × rate). Work that number out for learning rates 0.25, 0.5, 0.76 and 1.1 before you run them. Which rate lands on the centre in a single step? Which one jumps to the far side on every step and still gets there? And what is the largest rate that can converge at all?',
        reveal: 'The multipliers are 0.5, 0, −0.52 and −1.2. At 0.25 each step halves the distance and the run converges in 13 steps. At 0.5 the multiplier is 0, so the first step lands exactly on the centre: 1 step. At 0.76 the minus sign throws the point to the far side each time, but only 0.52 times as far out, and it converges in 14 steps. At 1.1 every step lands 1.2 times farther out: after 60 steps the loss is 3.46e+10, and with the maximum raised to 300 the page reports "Diverged after 71 steps". The dividing line is a multiplier of −1, which is rate 1. Set it and the point jumps between (−2.55, 2.1) and (2.55, −2.1) for ever, with the loss stuck at 10.912. So the limit is 1, and 1 is 2 divided by 2. The 2 underneath is the curvature of this bowl, the number that turns a position into a slope. On a surface that curves more sharply the limit is smaller by the same factor.' },
      { ask: 'Load "Zig-zag in a narrow valley" and note how many steps it takes. "Same valley with momentum" keeps the valley, the start and the learning rate of 0.15, and adds momentum 0.5, so each step also carries half of the step before it. Before you load it: will it need more steps or fewer, and roughly how many?',
        reveal: 'Fewer: 25 steps against 49, about half, with nothing changed but the momentum. Along the valley floor every step points the same way, so the carried-over half adds to the next step and the path covers ground faster. Across the valley the steps keep changing side, so the carried-over half works against the next step and the swings die out sooner. More momentum is not better without limit. Raise it to 0.9 with the maximum steps at 300 and the same run takes 160 steps, because the point now swings far past the minimum along the valley as well and has to come back.' },
      { ask: 'Load "Four minima". All four hollow circles mark points where the loss is exactly 0, so none is better than another. The run ends at one of them. Now slide the horizontal start position from −0.85 to 0.85 and change nothing else. Will it end at the same one?',
        reveal: 'No. From the left it stops at (−2.805, 3.131) after 27 steps. From the right it stops at (3.000, 2.000) after 68 steps. Move the vertical start to −0.7 as well and it finds a third, (3.584, −1.848), after 63 steps. Every one of these runs converges. Which minimum it converges to is decided by where it starts, because each step only looks at the slope under the current point.' },
      { ask: 'Load "Trapped by ripples". The lowest point is at the centre, where the loss is 0. Where will the descent stop, and how far above 0? Then change the learning rate to 0.001, to 0.004 and to 0.01. Does any of them get it to the centre?',
        reveal: 'It stops at (−2.985, 2.985) with loss 17.909, in the dip nearest to where it started, after 10 steps. Rates 0.001 and 0.004 end in exactly the same dip, after 27 and 20 steps. At 0.01 the steps are too long for dips this sharp: the path never settles, and after 80 steps the loss is 20.704, higher than before. Changing the rate does not get it to the centre. Stopping in the nearest dip is a limit of following the local slope, not a setting to tune.' },
    ],
    run,
    report: (r, c) => `${r.status === 'converged' ? 'Converged' : r.status === 'diverged' ? 'Diverged' : 'Stopped at the step limit'} after ${r.steps} steps.\nFinal position: (${f4(r.x)}, ${f4(r.y)})   Final loss: ${f4(r.bestValue)}\n${c['gradient evaluations'] || 0} gradient evaluations.`,
    experiment: {
      title: 'Steps to converge as the valley gets narrower',
      note: 'Each point is a real run on f(x, y) = ½(x² + κy²) from (1, 1) until the gradient is below 0.001. "Plain" uses learning rate 1/κ; "momentum" uses the optimal heavy-ball settings for that κ. Curves are scaled to the last measured point of each series.',
      metric: 'gradient evaluations',
      metricLabel: 'Steps to converge',
      sizeLabel: 'Condition number κ (steepest curvature ÷ gentlest curvature)',
      sizes: [2, 5, 10, 20, 50, 100, 200],
      variants: [
        { id: 'plain', label: 'Plain gradient descent' },
        { id: 'momentum', label: 'With momentum' },
      ],
      input: (kappa, variant) => {
        if (variant === 'momentum') {
          const s = Math.sqrt(kappa);
          return { landscape: 'quadratic', kappa, rate: 4 / (s + 1) ** 2, momentum: ((s - 1) / (s + 1)) ** 2, steps: 20000 };
        }
        return { landscape: 'quadratic', kappa, rate: 1 / kappa, momentum: 0, steps: 20000 };
      },
      theory: [
        { label: 'proportional to κ', fn: (k) => k, scaled: true, variant: 'plain' },
        { label: 'proportional to √κ', fn: (k) => Math.sqrt(k), scaled: true, variant: 'momentum' },
      ],
    },
  },

  logic: {
    intuition: 'Close to any point, a smooth function looks like a tilted plane. On a plane, the fastest way down is straight against the slope. Gradient descent trusts that local picture for one short step, then looks again. The learning rate says how far to trust it.',
    steps: [
      'Choose a starting point and a learning rate η.',
      'Compute the gradient at the current point: the vector of partial derivatives, pointing in the direction of steepest increase.',
      'If the gradient is nearly zero, the surface is flat here. Stop.',
      'Otherwise move against the gradient: new position = old position − η × gradient. With momentum, also add a fraction β of the previous step.',
      'Repeat from step 2 until the gradient is small or the step budget is spent.',
    ],
    pseudocode: [
      'gradient_descent(f, x₀, η, β):',
      '  x ← x₀;  v ← 0',
      '  repeat up to max_steps times:',
      '    g ← ∇f(x)',
      '    if ‖g‖ < tolerance: stop',
      '    v ← β·v − η·g',
      '    x ← x + v',
      '  return x',
    ],
    decisions: [
      { title: 'How large a learning rate?', text: 'For a surface whose curvature never exceeds L, any η below 2/L makes the loss decrease, and 1/L is a safe default. In practice L is unknown, so the rate is tuned, scheduled to shrink over time, or chosen by a line search at each step.' },
      { title: 'Use momentum?', text: 'Momentum averages recent steps. Components that keep changing sign (bouncing across a valley) cancel; components that persist (sliding along it) build up. On ill-conditioned problems this cuts the number of steps from proportional to κ to proportional to √κ.' },
      { title: 'When to stop?', text: 'Common rules are a small gradient norm, a small change in loss, or a fixed step budget. This page uses a gradient norm below 0.001 or the maximum step count.' },
    ],
    invariants: [
      'With a learning rate below 2/L on an L-smooth function and no momentum, the loss never increases from one step to the next.',
    ],
    edgeCases: [
      'Learning rate too large: the iterates oscillate with growing amplitude and diverge.',
      'Saddle points and flat plateaus: the gradient is near zero although the point is not a minimum, so progress stalls.',
      'Local minima: on a non-convex function the method stops at whichever minimum the starting point leads to.',
      'Badly scaled variables create narrow valleys; rescaling the inputs often helps more than tuning the rate.',
      'Functions that are not differentiable everywhere (such as |x|) need subgradients and a decreasing step size.',
    ],
    correctness: 'Gradient descent does not promise the global minimum in general. What can be proved depends on assumptions. If the gradient is L-Lipschitz and η ≤ 1/L, each step lowers the loss by at least (η/2)‖∇f‖², so the gradient must tend to zero: the method reaches a stationary point. If the function is also convex, every stationary point is a global minimum and the gap to the optimum shrinks like 1/k after k steps. If it is strongly convex, the gap shrinks geometrically.',
    mistakes: [
      'Adding the gradient instead of subtracting it, which climbs uphill.',
      'Choosing a learning rate by trial on one problem and assuming it transfers to another with different scaling.',
      'Declaring success because the loss stopped changing, when the method is actually stuck on a plateau or bouncing in place.',
      'Forgetting to reset the momentum buffer when restarting from a new point.',
    ],
  },

  code: {
    sample: {
      input: 'First check the gradient formula at the point (1, 2) against slopes measured from the loss itself. Then minimize f(x, y) = (x − 3)² + 2(y + 1)² from (0, 0) with learning rate 0.1, printing every fifth step.',
      expected: 'gradient at (1, 2): formula (-4.0000, 12.0000), measured (-4.0000, 12.0000), agree to 4 decimals: yes\nstep  0: x=0.0000 y=0.0000 loss=11.0000\nstep  5: x=2.0170 y=-0.9222 loss=0.9785\nstep 10: x=2.6779 y=-0.9940 loss=0.1038\nstep 15: x=2.8944 y=-0.9995 loss=0.0111\nstep 20: x=2.9654 y=-1.0000 loss=0.0012\nstep 25: x=2.9887 y=-1.0000 loss=0.0001\nstep 30: x=2.9963 y=-1.0000 loss=0.0000',
    },
    breakIt: [
      { change: 'In the gradient, change the `4` in `4 * (y + 1)` to `2`, the kind of slip made when working out a slope by hand. Will the descent still reach the minimum at (3, −1), and which line of the output gives the mistake away?',
        find: { python: 'return 2 * (x - 3), 4 * (y + 1)', javascript: '[2 * (x - 3), 4 * (y + 1)]' },
        replace: { python: 'return 2 * (x - 3), 2 * (y + 1)', javascript: '[2 * (x - 3), 2 * (y + 1)]' },
        reveal: 'The first line now reads "formula (-4.0000, 6.0000), measured (-4.0000, 12.0000), agree to 4 decimals: NO". The descent itself still heads for the minimum: it ends with "step 30: x=2.9963 y=-0.9988 loss=0.0000", only a little behind in y. A gradient that is wrong by a factor still points downhill, so the loss falls and nothing looks broken. The check is the only line that catches it, which is why you compare a hand-written gradient with measured slopes before trusting a run.' },
      { change: 'In the update of x, change `-=` to `+=`, so that x moves with the gradient instead of against it. The gradient check runs first. Will it catch this?',
        find: { python: 'x -= rate * gx', javascript: 'x -= rate * gx;' },
        replace: { python: 'x += rate * gx', javascript: 'x += rate * gx;' },
        reveal: 'No. The first line still ends "agree to 4 decimals: yes", because the gradient is right. The mistake is in what the loop does with it. x now climbs away from 3: the output goes "step  5: x=-4.4650 y=-0.9222 loss=55.7377" and ends "step 30: x=-709.1289 y=-1.0000 loss=507127.6292". y, whose update still subtracts, settles at −1 as before. A loss that rises on every step, whatever small rate you use, is the sign of a flipped update.' },
      { change: 'Change the learning rate from `0.1` to `0.6`. On the round bowl in the demonstration a rate of 0.6 converges in 6 steps. Will it converge here?',
        find: { python: 'rate = 0.1', javascript: 'const rate = 0.1;' },
        replace: { python: 'rate = 0.6', javascript: 'const rate = 0.6;' },
        reveal: 'It does not. x is fine, reaching 3.0000 by step 10, but y swings from side to side and grows: "step  5: x=3.0010 y=-6.3782 loss=57.8509", ending "step 30: x=3.0000 y=24200.4324 loss=1171418656.1142". This function curves twice as sharply in y as the bowl does: the slope in y is 4 × (y + 1), so each step multiplies the distance in y by 1 − 4 × 0.6 = −1.4. The limit here is 2/4 = 0.5. A rate that worked on one surface says nothing about another with different curvature.' },
    ],
    python: {
      source: `def loss(x, y):
    return (x - 3) ** 2 + 2 * (y + 1) ** 2


def grad(x, y):
    return 2 * (x - 3), 4 * (y + 1)


# Check the formula in grad against slopes measured from loss itself.
h = 1e-5
fx, fy = grad(1.0, 2.0)
mx = (loss(1.0 + h, 2.0) - loss(1.0 - h, 2.0)) / (2 * h)
my = (loss(1.0, 2.0 + h) - loss(1.0, 2.0 - h)) / (2 * h)
verdict = "yes" if abs(fx - mx) < 0.00005 and abs(fy - my) < 0.00005 else "NO"
print(f"gradient at (1, 2): formula ({fx:.4f}, {fy:.4f}), measured ({mx:.4f}, {my:.4f}), agree to 4 decimals: {verdict}")

x, y = 0.0, 0.0
rate = 0.1
for step in range(31):
    if step % 5 == 0:
        print(f"step {step:2d}: x={x:.4f} y={y:.4f} loss={loss(x, y):.4f}")
    gx, gy = grad(x, y)
    x -= rate * gx
    y -= rate * gy`,
      notes: [
        { line: 6, text: 'The gradient is the pair of partial derivatives. For this function they can be written by hand; in machine learning they come from automatic differentiation.' },
        { line: 12, text: 'A slope measured without any formula: nudge x a little each way and divide the change in loss by the distance between the two points. If the hand-written gradient is right, the two numbers match. The point (1, 2) is arbitrary; any point where neither slope is zero will do.' },
        { line: 18, text: 'The learning rate. This function\'s largest curvature is 4, so any rate below 2/4 = 0.5 converges.' },
        { line: 23, text: 'The update: move against the gradient. The minus sign is the whole algorithm.' },
      ],
    },
    javascript: {
      source: `const loss = (x, y) => (x - 3) ** 2 + 2 * (y + 1) ** 2;
const grad = (x, y) => [2 * (x - 3), 4 * (y + 1)];

// Check the formula in grad against slopes measured from loss itself.
const h = 1e-5;
const [fx, fy] = grad(1, 2);
const mx = (loss(1 + h, 2) - loss(1 - h, 2)) / (2 * h);
const my = (loss(1, 2 + h) - loss(1, 2 - h)) / (2 * h);
const verdict = Math.abs(fx - mx) < 0.00005 && Math.abs(fy - my) < 0.00005 ? "yes" : "NO";
console.log("gradient at (1, 2): formula (" + fx.toFixed(4) + ", " + fy.toFixed(4) + "), measured (" + mx.toFixed(4) + ", " + my.toFixed(4) + "), agree to 4 decimals: " + verdict);

let x = 0, y = 0;
const rate = 0.1;
for (let step = 0; step <= 30; step++) {
  if (step % 5 === 0) {
    const s = String(step).padStart(2, " ");
    console.log("step " + s + ": x=" + x.toFixed(4) + " y=" + y.toFixed(4) + " loss=" + loss(x, y).toFixed(4));
  }
  const [gx, gy] = grad(x, y);
  x -= rate * gx;
  y -= rate * gy;
}`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <utility>

double loss(double x, double y) { return (x - 3) * (x - 3) + 2 * (y + 1) * (y + 1); }

std::pair<double, double> grad(double x, double y) { return {2 * (x - 3), 4 * (y + 1)}; }

int main() {
    // Check the formula in grad against slopes measured from loss itself.
    const double h = 1e-5;
    auto [fx, fy] = grad(1.0, 2.0);
    double mx = (loss(1.0 + h, 2.0) - loss(1.0 - h, 2.0)) / (2 * h);
    double my = (loss(1.0, 2.0 + h) - loss(1.0, 2.0 - h)) / (2 * h);
    const char* verdict = std::fabs(fx - mx) < 0.00005 && std::fabs(fy - my) < 0.00005 ? "yes" : "NO";
    std::printf("gradient at (1, 2): formula (%.4f, %.4f), measured (%.4f, %.4f), agree to 4 decimals: %s\\n", fx, fy, mx, my, verdict);

    double x = 0.0, y = 0.0;
    const double rate = 0.1;
    for (int step = 0; step <= 30; ++step) {
        if (step % 5 == 0) {
            std::printf("step %2d: x=%.4f y=%.4f loss=%.4f\\n", step, x, y, loss(x, y));
        }
        auto [gx, gy] = grad(x, y);
        x -= rate * gx;
        y -= rate * gy;
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The cost has two parts: the price of one step and the number of steps. One step costs one gradient evaluation, which is linear in the number of variables for most models. The number of steps depends on the shape of the function, not just its size.',
    cases: [
      { case: 'Smooth and strongly convex', time: 'O(κ log(1/ε)) steps', when: 'κ is the condition number (largest curvature divided by smallest). The error shrinks by a constant factor every step.' },
      { case: 'Smooth and convex', time: 'O(1/ε) steps', when: 'The gap to the optimum shrinks like 1/k after k steps.' },
      { case: 'Smooth, non-convex', time: 'O(1/ε²) steps to a point with gradient below ε', when: 'Only a stationary point is guaranteed, which may be a local minimum or a saddle.' },
      { case: 'Learning rate above 2/L', time: 'May diverge', when: 'L is the largest curvature. No number of steps helps.' },
    ],
    space: 'O(d) for d variables: the current point, its gradient, and the momentum vector if used.',
    memory: 'Because it stores no matrix of second derivatives, memory stays linear in the number of parameters. This is what makes it usable for models with billions of parameters, where Newton\'s method would need a matrix with billions squared entries.',
    tradeoffs: 'Each step is cheap but uses little information, so many steps are needed on ill-conditioned problems. Second-order methods take far fewer, far more expensive steps. Momentum and adaptive methods sit in between.',
    assumptions: [
      'The function is differentiable and its gradient is L-Lipschitz (its curvature is bounded by L).',
      'The gradient is computed exactly. Stochastic gradient descent uses noisy estimates and has different rates.',
      'ε is the target accuracy in loss; "step" means one gradient evaluation.',
      'The chart on this page counts steps on a specific two-variable quadratic; it illustrates the κ dependence and is not a general benchmark.',
    ],
  },

  tradeoffs: {
    excels: [
      'Very high-dimensional problems where only gradients are affordable.',
      'Smooth, convex or nearly convex objectives.',
      'Settings where an approximate minimum is enough.',
    ],
    struggles: [
      'Ill-conditioned problems (long narrow valleys), unless momentum or preconditioning is added.',
      'Objectives with many poor local minima or wide flat plateaus.',
      'Non-differentiable or discrete problems, where no gradient exists.',
    ],
    misunderstandings: [
      "\"It finds the best possible answer.\" It finds a low point near where it started. On a bumpy surface there may be lower points elsewhere that it never reaches.",
      "\"A bigger learning rate is always faster.\" Only up to a limit set by how sharply the surface curves. Past that limit each step overshoots, and the method gets worse instead of better.",
      "\"The downhill direction points at the minimum.\" It points straight down the slope from where you stand. That is usually not the direct line to the lowest point, which is why paths zig-zag in narrow valleys.",
    ],
    pitfalls: [
      'A learning rate tuned for one scaling of the inputs fails after the inputs are rescaled.',
      'Sign errors and gradient bugs; always compare an analytic gradient against finite differences.',
      'Mistaking a plateau for convergence.',
    ],
    constraints: [
      'On large datasets the full gradient is too expensive, so practice uses stochastic mini-batch estimates.',
      'Deep learning relies on adaptive variants and learning-rate schedules rather than a single fixed rate.',
    ],
    alternatives: [
      { id: 'newtons-method', name: 'Newton\'s Method', when: 'Few variables and cheap second derivatives: converges in far fewer steps.' },
      { id: 'simulated-annealing', name: 'Simulated Annealing', when: 'No gradient is available, or the landscape has many local minima.' },
      { id: 'genetic-algorithm', name: 'Genetic Algorithm', when: 'The search space is discrete or the objective is a black box.' },
      { id: 'stochastic-gradient-descent', name: 'Stochastic Gradient Descent', when: 'The loss is a sum over a large dataset and full gradients are too costly.' },
      { id: 'adam', name: 'Adam', when: 'Training neural networks, where per-parameter adaptive step sizes help.' },
    ],
    comparison: {
      columns: ['', 'Gradient descent', 'Newton\'s method', 'Simulated annealing'],
      rows: [
        ['Information used', 'First derivatives', 'First and second derivatives', 'Function values only'],
        ['Cost per step', 'O(d)', 'O(d³) to solve the linear system', 'One function evaluation'],
        ['Steps needed', 'Many on ill-conditioned problems', 'Few near the solution', 'Very many'],
        ['Escapes local minima', 'No', 'No', 'Often, given a slow cooling schedule'],
      ],
    },
  },

  applications: [
    { title: 'Training neural networks', status: 'established', text: 'Every deep learning framework trains models with stochastic variants of gradient descent. Backpropagation computes the gradient of the loss with respect to all weights, and the optimizer takes the step.' },
    { title: 'Fitting statistical models', status: 'established', text: 'Logistic regression and other generalized linear models have no closed-form solution. Their maximum likelihood estimates are found by gradient-based iteration.' },
    { title: 'Iterative image reconstruction', status: 'established', text: 'Computed tomography and MRI reconstruction are posed as minimizing the mismatch between predicted and measured signals, solved with gradient methods.' },
    { title: 'Scientific parameter estimation', status: 'established', text: 'Calibrating the parameters of a physical model to observations by least squares is a minimization problem routinely solved with gradient-based optimizers.' },
    { title: 'Tuning a design', status: 'illustrative', text: 'If a simulation can report how a quantity such as drag changes with each design parameter, descent can improve a shape step by step.' },
  ],

  connections: [
    { to: 'backpropagation', type: 'application', why: 'Backpropagation is how the gradient is computed for a neural network. Gradient descent is what is done with it.' },
    { to: 'linear-regression', type: 'application', why: 'Least-squares fitting is a convex quadratic, the ideal case in which gradient descent provably reaches the global minimum.' },
    { to: 'logistic-regression', type: 'application', why: 'Its loss is convex but has no closed-form minimizer, so it is fitted by gradient steps.' },
    { to: 'newtons-method', type: 'same-problem', why: 'Both seek a point where the gradient is zero. Newton\'s method rescales the step by the inverse curvature, which removes the dependence on conditioning that slows gradient descent.' },
    { to: 'simulated-annealing', type: 'same-problem', why: 'Both walk across a landscape looking for low ground. Annealing sometimes accepts uphill moves, trading speed for the ability to leave local minima.' },
    { to: 'euler-method', type: 'related', why: 'Gradient descent is Euler\'s method applied to the differential equation dx/dt = −∇f(x). The learning rate is the time step, and both become unstable when it is too large.' },
    { to: 'concept:gradient', type: 'prerequisite', why: 'The method consists of evaluating the gradient and stepping against it.' },
    { to: 'concept:convexity', type: 'prerequisite', why: 'Convexity is the condition under which a local minimum is guaranteed to be global.' },
    { to: 'concept:learning-rate', type: 'prerequisite', why: 'The step size determines whether the iteration converges, crawls or diverges.' },
    { to: 'discipline:machine-learning', type: 'application', why: 'Learning from data is posed as minimizing a loss over parameters.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does the update subtract the gradient rather than add it?',
      options: ['Subtraction is numerically more stable', 'The gradient points toward steepest increase, and we want to decrease the function', 'The gradient is always negative', 'It makes the learning rate positive'],
      answer: 1,
      explain: [
        'Stability is not the reason; the sign determines the direction of travel.',
        'Correct. The gradient points uphill, so the opposite direction is the locally fastest way down.',
        'Gradient components can have either sign.',
        'The learning rate is positive by convention regardless.',
      ],
    },
    {
      type: 'predict',
      q: 'The narrow valley is f(x, y) = ½x² + 6y². Its slope is 1 × x along the valley and 12 × y across it. On the round bowl a learning rate of 0.18 converges in 20 steps. What happens in the narrow valley with learning rate 0.18, no momentum and up to 120 steps?',
      options: ['It converges, a little more slowly than on the bowl', 'It settles along the valley, but the swings across it grow until the run is stopped as diverged', 'It flies off in both directions at once', 'It reaches the valley floor quickly and then stalls there, short of the minimum'],
      answer: 1,
      explain: [
        'It would if 0.18 were below the limit for this surface. The limit is 2 divided by the largest curvature, and across the valley that is 2/12, about 0.167. The bowl\'s limit of 1 does not carry over.',
        'Each step multiplies x by 1 − 0.18 = 0.82, so x shrinks to 0. It multiplies y by 1 − 12 × 0.18 = −1.16, so y changes side and grows by 16 percent every step. The page reports "Diverged after 91 steps", with x at 0 and y past a million.',
        'Each direction has its own multiplier. Along the valley it is 1 − 0.18 = 0.82, which shrinks x on every step. Only y, with a multiplier of −1.16, grows.',
        'That is the picture for a rate that is safe but small. Here the trouble is the opposite: the rate is too large for the steep direction, where each step multiplies y by −1.16.',
      ],
      tryInput: { landscape: 'valley', rate: 0.18, momentum: 0, steps: 120 },
      check: (r) => (r.status === 'diverged' && r.steps === 91 && Math.abs(r.x) < 1e-6 && Math.abs(r.y) > 1e6) || `status ${r.status} after ${r.steps} steps at (${r.x}, ${r.y})`,
    },
    {
      type: 'debug',
      q: 'This loop makes the loss grow on every step, whatever small learning rate is used. What is wrong?',
      code: `for step in range(100):
    gx, gy = grad(x, y)
    x += rate * gx
    y += rate * gy`,
      options: ['The learning rate should be recomputed each step', 'It adds the gradient, which is gradient ascent', 'It should use the previous gradient', 'range(100) is too many steps'],
      answer: 1,
      explain: [
        'A fixed rate is fine for a smooth function.',
        'Correct. `+=` moves uphill. The update must be `x -= rate * gx`.',
        'Using a stale gradient would be a different bug.',
        'Too many steps cannot make a correct descent loop increase the loss.',
      ],
    },
    {
      type: 'choice',
      q: 'Gradient descent stops at a point where the gradient is zero. What can you conclude?',
      options: ['It is the global minimum', 'It is a local minimum', 'It is a stationary point: a minimum, a maximum or a saddle', 'The learning rate was too small'],
      answer: 2,
      explain: [
        'Only guaranteed if the function is convex.',
        'It might be a saddle point, flat in some directions and curving up or down in others.',
        'Correct. A zero gradient only says the surface is locally flat. More information is needed to classify the point.',
        'The stopping point does not reveal anything about the rate.',
      ],
    },
    {
      type: 'challenge',
      title: 'Find the stability limit, then beat it',
      prompt: 'For f(x, y) = ½x² + 6y², determine by experiment the largest learning rate that still converges, and explain the value using the curvature in each direction. Start every run from (1, 1) and stop when the length of the gradient falls below 0.001. Then implement a backtracking line search: start each step with a trial rate of 1 and halve it until the loss decreases by at least half of what the gradient predicts. Count its gradient evaluations and compare them with a fixed rate of 0.15.',
      expect: 'The largest rate that converges is just under 1/6, about 0.1667. Each step multiplies y by (1 − 12 × rate), which reaches −1 at rate 2/12. Along the valley the multiplier is (1 − rate), which causes no trouble. From (1, 1), a fixed rate of 0.15 converges in 45 steps (46 gradient evaluations), 0.16 takes 113 steps, and 0.17 is past the limit and never converges. Backtracking from a trial rate of 1 converges in 40 steps (41 gradient evaluations) and ends near (0.00066, −0.00003). On the way it tests 151 trial rates, each costing one loss evaluation. So it saves little over a well-chosen fixed rate. What it saves is having to find that rate.',
      hints: ['Along y the update multiplies y by (1 − 12η). When does its absolute value exceed 1?', 'The sufficient-decrease test is f(x − ηg) ≤ f(x) − ½η‖g‖².'],
    },
  ],

  compare: {
    idea: 'Step repeatedly against the gradient, the direction of steepest local increase.',
    requires: 'A smooth quantity to minimize, its slope, and a sensible step size. It reaches a point where the slope is flat. That is the lowest point overall only if the surface is a single bowl.',
    sensitivity: 'High. Very sensitive to the learning rate, the starting point and the conditioning of the surface.',
    memory: 'O(d): the current point and one or two vectors of the same size.',
    difficulty: 'low',
    difficultyNote: 'A few lines of code. The difficulty is in choosing the learning rate and getting the gradient right.',
    limits: 'It stops at the nearest flat point, which may not be the lowest. It is slow in long narrow valleys. It needs the slope.',
    useWhen: 'The thing to minimize changes smoothly, you can work out its slope, and the problem is large.',
  },

  advanced: {
    history: 'Cauchy described the method in a short 1847 note to the French Academy of Sciences. It was studied as "steepest descent" in numerical analysis through the twentieth century. Robbins and Monro introduced stochastic approximation in 1951, the basis of stochastic gradient descent. Polyak proposed the heavy-ball momentum method in 1964, and Nesterov published an accelerated method with optimal convergence rate for smooth convex functions in 1983.',
    derivation: 'Assume $\\nabla f$ is $L$-Lipschitz. Then $f$ is bounded above by a quadratic around any point (the descent lemma):\n\n$$f(y) \\le f(x) + \\nabla f(x)^\\top (y - x) + \\frac{L}{2}\\lVert y - x\\rVert^2.$$\n\nSubstituting the gradient step $y = x - \\eta\\nabla f(x)$ gives\n\n$$f(y) \\le f(x) - \\eta\\left(1 - \\frac{L\\eta}{2}\\right)\\lVert\\nabla f(x)\\rVert^2.$$\n\nThe loss therefore decreases whenever $0 < \\eta < 2/L$, and the guaranteed decrease is largest at $\\eta = 1/L$, where it equals $\\frac{1}{2L}\\lVert\\nabla f(x)\\rVert^2$.',
    proof: 'For the quadratic $f(x) = \\frac{1}{2}x^\\top A x$ with eigenvalues $\\mu \\le \\lambda_i \\le L$, one step multiplies the component of $x$ along the $i$-th eigenvector by $(1 - \\eta\\lambda_i)$. Convergence requires $|1 - \\eta\\lambda_i| < 1$ for all $i$, that is $\\eta < 2/L$. With $\\eta = 1/L$ the slowest component contracts by $1 - \\mu/L = 1 - 1/\\kappa$ per step, so reaching accuracy $\\varepsilon$ takes about $\\kappa\\ln(1/\\varepsilon)$ steps. The best fixed rate is $\\eta = 2/(L+\\mu)$, giving contraction factor $\\frac{\\kappa-1}{\\kappa+1}$.',
    complexityProof: 'For convex $L$-smooth $f$ with $\\eta = 1/L$, combining the descent lemma with convexity yields $f(x_k) - f^\\star \\le \\frac{L\\lVert x_0 - x^\\star\\rVert^2}{2k}$. The heavy-ball method with optimal parameters on a quadratic contracts by $\\frac{\\sqrt{\\kappa}-1}{\\sqrt{\\kappa}+1}$ per step, which is why the experiment on this page shows growth proportional to $\\sqrt{\\kappa}$ with momentum.',
    variants: [
      { name: 'Stochastic gradient descent (SGD)', text: 'Estimates the gradient from a random mini-batch of data. Each step is cheap and noisy; the noise also helps escape shallow traps.' },
      { name: 'Momentum (heavy ball)', text: 'Adds a fraction of the previous step. Damps oscillation across valleys and accelerates along them.' },
      { name: 'Nesterov accelerated gradient', text: 'Evaluates the gradient at a look-ahead point. Achieves the optimal O(1/k²) rate for smooth convex functions.' },
      { name: 'Adaptive methods (AdaGrad, RMSProp, Adam)', text: 'Keep a separate effective learning rate for each parameter based on the history of its gradients.' },
      { name: 'Line search', text: 'Chooses the step length afresh at every iteration by testing candidates along the descent direction.' },
    ],
    implementation: 'Verify gradients numerically with central differences before trusting any result. Normalize or standardize inputs so that curvature is similar in all directions. Monitor the loss: a rising or oscillating curve signals a rate that is too high.',
    benchmarking: 'Report results against the number of gradient evaluations, and state the stopping tolerance. Comparisons across optimizers are only meaningful when each has had its learning rate tuned with similar effort.',
    references: [
      { authors: 'A.-L. Cauchy', year: 1847, title: 'Méthode générale pour la résolution des systèmes d\'équations simultanées', venue: 'Comptes Rendus de l\'Académie des Sciences 25, 536-538' },
      { authors: 'B. T. Polyak', year: 1964, title: 'Some methods of speeding up the convergence of iteration methods', venue: 'USSR Computational Mathematics and Mathematical Physics 4(5), 1-17' },
      { authors: 'H. Robbins and S. Monro', year: 1951, title: 'A stochastic approximation method', venue: 'The Annals of Mathematical Statistics 22(3), 400-407' },
      { authors: 'Y. Nesterov', year: 2004, title: 'Introductory Lectures on Convex Optimization: A Basic Course', venue: 'Kluwer Academic Publishers' },
    ],
    furtherReading: [
      'S. Boyd and L. Vandenberghe, *Convex Optimization*, chapter 9, "Unconstrained minimization".',
      'G. Goh, "Why Momentum Really Works", *Distill* (2017).',
    ],
  },

  tests: [
    { name: 'converges to the minimum of the bowl', input: { landscape: 'bowl', rate: 0.1, momentum: 0, steps: 200 },
      check: (r) => (r.status === 'converged' && Math.hypot(r.x, r.y) < 1e-2) || `status ${r.status}, ended at (${r.x}, ${r.y})` },
    { name: 'diverges above the stability limit', input: { landscape: 'bowl', rate: 1.05, momentum: 0, steps: 300 },
      check: (r) => r.status === 'diverged' || r.bestValue > 1e6 || `expected divergence, got ${r.status}` },
    { name: 'loss never increases below the stability limit', input: { landscape: 'valley', rate: 0.1, momentum: 0, steps: 100 },
      check: (r) => r.losses.every((v, i) => i === 0 || v <= r.losses[i - 1] + 1e-12) || 'loss increased' },
    { name: 'reaches a Himmelblau minimum', input: { landscape: 'himmelblau', rate: 0.005, momentum: 0, steps: 300 },
      check: (r) => r.bestValue < 1e-4 || `final loss ${r.bestValue}` },
    { name: 'the narrow valley without momentum takes 49 steps at rate 0.15', input: { landscape: 'valley', rate: 0.15, momentum: 0, steps: 80 },
      check: (r) => (r.status === 'converged' && r.steps === 49) || `status ${r.status}, steps ${r.steps}` },
    { name: 'the same valley at the same rate with momentum 0.5 takes 25 steps', input: { landscape: 'valley', rate: 0.15, momentum: 0.5, steps: 80 },
      check: (r) => (r.status === 'converged' && r.steps === 25) || `status ${r.status}, steps ${r.steps}` },
    { name: 'on the bowl one step multiplies the distance by (1 − 2 × rate): the loss ratio is that number squared', input: { landscape: 'bowl', rate: 0.76, momentum: 0, steps: 10 },
      check: (r) => r.losses.slice(1).every((v, i) => Math.abs(v / r.losses[i] - 0.52 * 0.52) < 1e-9) || `loss ratios ${r.losses.slice(1, 4).map((v, i) => v / r.losses[i])}` },
    { name: 'bowl at rate 0.5 lands on the centre in one step', input: { landscape: 'bowl', rate: 0.5, momentum: 0, steps: 60 },
      check: (r) => (r.status === 'converged' && r.steps === 1 && r.bestValue === 0) || `status ${r.status}, steps ${r.steps}, loss ${r.bestValue}` },
    { name: 'bowl at rate 0.25 converges in 13 steps', input: { landscape: 'bowl', rate: 0.25, momentum: 0, steps: 60 },
      check: (r) => (r.status === 'converged' && r.steps === 13) || `status ${r.status}, steps ${r.steps}` },
    { name: 'bowl at rate 0.6 converges in 6 steps (quoted by the code sample break-it)', input: { landscape: 'bowl', rate: 0.6, momentum: 0, steps: 60 },
      check: (r) => (r.status === 'converged' && r.steps === 6) || `status ${r.status}, steps ${r.steps}` },
    { name: 'bowl at rate 0.76 overshoots and converges in 14 steps', input: { landscape: 'bowl', rate: 0.76, momentum: 0, steps: 60 },
      check: (r) => (r.status === 'converged' && r.steps === 14) || `status ${r.status}, steps ${r.steps}` },
    { name: 'bowl at rate 1 sits exactly on the limit: the loss never changes', input: { landscape: 'bowl', rate: 1, momentum: 0, steps: 60 },
      check: (r) => (r.status === 'budget' && r.losses.every((v) => Math.abs(v - 10.9125) < 1e-9) && Math.abs(r.x + 2.55) < 1e-9 && Math.abs(r.y - 2.1) < 1e-9) || `status ${r.status}, loss ${r.bestValue}, at (${r.x}, ${r.y})` },
    { name: 'bowl at rate 1.1 is reported as diverged after 71 steps', input: { landscape: 'bowl', rate: 1.1, momentum: 0, steps: 300 },
      check: (r) => (r.status === 'diverged' && r.steps === 71) || `status ${r.status}, steps ${r.steps}` },
    { name: 'the narrow valley at rate 0.18 diverges across the valley after 91 steps while x goes to 0', input: { landscape: 'valley', rate: 0.18, momentum: 0, steps: 120 },
      check: (r) => (r.status === 'diverged' && r.steps === 91 && Math.abs(r.x) < 1e-6 && Math.abs(r.y) > 1e6) || `status ${r.status}, steps ${r.steps}, at (${r.x}, ${r.y})` },
    { name: 'too much momentum is slower: 0.9 takes 160 steps in the narrow valley at rate 0.15', input: { landscape: 'valley', rate: 0.15, momentum: 0.9, steps: 300 },
      check: (r) => (r.status === 'converged' && r.steps === 160) || `status ${r.status}, steps ${r.steps}` },
    { name: 'four minima: starting on the right ends at (3, 2) after 68 steps', input: { landscape: 'himmelblau', rate: 0.005, momentum: 0, steps: 120, startX: 0.85 },
      check: (r) => (r.status === 'converged' && r.steps === 68 && Math.hypot(r.x - 3, r.y - 2) < 1e-3) || `status ${r.status}, steps ${r.steps}, at (${r.x}, ${r.y})` },
    { name: 'ripples: rates 0.001 to 0.004 all stop in the dip at (−2.985, 2.985), loss 17.909', input: { landscape: 'rastrigin', rate: 0.004, momentum: 0, steps: 80 },
      check: (r) => (r.status === 'converged' && r.steps === 20 && Math.abs(r.bestValue - 17.909) < 1e-3 && Math.hypot(r.x + 2.985, r.y - 2.985) < 1e-3) || `status ${r.status}, steps ${r.steps}, loss ${r.bestValue}` },
    { name: 'Things to try: the other figures quoted for the bowl, the four minima and the ripples', input: { landscape: 'himmelblau', rate: 0.005, momentum: 0, steps: 120 },
      check: (r) => {
        const q = { count() {}, frame() {} };
        const go = (input) => run({ landscape: 'bowl', rate: 0.1, momentum: 0, steps: 60, startX: -0.85, startY: 0.7, ...input }, q);
        const third = go({ landscape: 'himmelblau', rate: 0.005, steps: 120, startX: 0.85, startY: -0.7 });
        const hot = go({ rate: 1.1 });
        const rip = [0.002, 0.001, 0.004].map((rate) => go({ landscape: 'rastrigin', rate, steps: 80 }));
        const wild = go({ landscape: 'rastrigin', rate: 0.01, steps: 80 }), wilder = go({ landscape: 'rastrigin', rate: 0.01, steps: 300 });
        const ok = r.status === 'converged' && r.steps === 27 && Math.hypot(r.x + 2.805, r.y - 3.131) < 1e-3
          && third.status === 'converged' && third.steps === 63 && Math.hypot(third.x - 3.584, third.y + 1.848) < 1e-3
          && hot.status === 'budget' && Math.abs(hot.bestValue / 1e10 - 3.46) < 5e-3
          && rip.every((x) => x.status === 'converged' && Math.abs(x.bestValue - 17.909) < 1e-3 && Math.hypot(x.x + 2.985, x.y - 2.985) < 1e-3) && rip.map((x) => x.steps).join(',') === '10,27,20'
          && wild.status === 'budget' && Math.abs(wild.bestValue - 20.704) < 5e-4 && wilder.status === 'budget';
        return ok || `four minima ${r.steps} and ${third.steps} steps; bowl at 1.1: ${hot.bestValue}; ripples ${rip.map((x) => x.steps)}; rate 0.01: ${wild.status} ${wild.bestValue}`;
      } },
    { name: 'momentum converges in the narrow valley', input: { landscape: 'valley', rate: 0.05, momentum: 0.8, steps: 300 },
      check: (r) => (r.status === 'converged' && r.bestValue < 1e-5) || `status ${r.status}, loss ${r.bestValue}` },
  ],
};
