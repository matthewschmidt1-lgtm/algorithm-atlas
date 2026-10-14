// Binomial option pricing on a Cox-Ross-Rubinstein tree. This lesson explains a textbook model.
// It is not advice about buying or selling anything.

const QUIET = { record: false, count() {}, frame() {} };
const FINE = 500;                  // steps in the finer tree that a small tree is compared with
const TIE = 1e-9;                  // exercising must beat holding by more than this share of the strike

// Numbers for the notes, with a real minus sign and no "-0.00".
const money = (v, d = 2) => { const s = Math.abs(v).toFixed(d); return v < 0 && Number(s) !== 0 ? `−${s}` : s; };
const f4 = (v) => money(v, 4);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const par = (text) => (text.startsWith('−') ? `(${text})` : text);      // a negative number inside a sum

const payoffOf = (kind, strike) => (price) => Math.max(kind === 'call' ? price - strike : strike - price, 0);

// The whole method. Values the option at expiry, then works backwards one column at a time.
// `visit` is told about every node as it is valued, which is how the page draws the steps.
function solve({ spot, strike, up, growth, steps, kind, american }, visit) {
  const down = 1 / up;
  const p = (growth - down) / (up - down);
  const payoff = payoffOf(kind, strike);
  const priceAt = (i, j) => spot * Math.pow(up, 2 * j - i);       // after i steps, j of them up
  let later = new Array(steps + 1);
  for (let j = steps; j >= 0; j--) {
    const price = priceAt(steps, j);
    later[j] = payoff(price);
    if (visit) visit({ i: steps, j, price, value: later[j], leaf: true });
  }
  for (let i = steps - 1; i >= 0; i--) {
    const now = new Array(i + 1);
    for (let j = i; j >= 0; j--) {
      const hold = (p * later[j + 1] + (1 - p) * later[j]) / growth;
      const price = priceAt(i, j);
      const exercise = payoff(price);
      const exercised = american && exercise > hold + TIE * strike;
      now[j] = exercised ? exercise : hold;
      if (visit) visit({ i, j, price, ifUp: later[j + 1], ifDown: later[j], hold, exercise, exercised, value: now[j], leaf: false });
    }
    later = now;
  }
  return later[0];
}

// The Black-Scholes value of a European option, which the tree approaches as its steps get finer.
// It shares no code with the tree. The bell-curve area Φ(x) is summed from its power series.
function normalCdf(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;
  let term = x, sum = x;
  for (let k = 3; k < 400; k += 2) { term *= (x * x) / k; sum += term; }
  return 0.5 + sum * Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function blackScholes(kind, spot, strike, rate, sigma, years) {
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * years) / (sigma * Math.sqrt(years));
  const d2 = d1 - sigma * Math.sqrt(years);
  const call = spot * normalCdf(d1) - strike * Math.exp(-rate * years) * normalCdf(d2);
  return kind === 'call' ? call : call - spot + strike * Math.exp(-rate * years);
}

function resolve(input) {
  const kind = input.kind === 'call' ? 'call' : 'put';
  const american = input.style !== 'european';
  const spot = Number(input.spot), strike = Number(input.strike);
  const steps = Math.floor(Number(input.steps));
  const years = Number(input.years), rate = Number(input.rate) / 100;
  if (!(spot > 0) || !(strike > 0)) throw new Error('The share price and the strike price must both be greater than zero.');
  if (!(steps >= 1)) throw new Error('Use at least one step.');
  if (!(years > 0)) throw new Error('The time to expiry must be greater than zero.');
  if (!(rate >= 0)) throw new Error('This page handles interest rates of zero or more.');
  const dt = years / steps;
  const typed = Number(input.up) > 0;
  let up, sigma;
  if (typed) {
    up = Number(input.up);
    if (!(up > 1)) throw new Error('An up-move must multiply the price by more than 1, or the down-move 1/u would not be a fall. Type a number such as 1.25, or 0 to let the volatility decide.');
    sigma = Math.log(up) / Math.sqrt(dt);
  } else {
    sigma = Number(input.vol) / 100;
    if (!(sigma > 0)) throw new Error('The volatility must be greater than zero. With no swings in the price there is no tree to build.');
    up = Math.exp(sigma * Math.sqrt(dt));
  }
  return { kind, american, spot, strike, steps, years, rate, sigma, dt, typed, up, growth: Math.exp(rate * dt) };
}

function run(input, t) {
  const m = resolve(input);
  const { kind, american, spot, strike, steps: n, years, rate, sigma, dt, typed, up, growth } = m;
  const down = 1 / up, p = (growth - down) / (up - down), q = 1 - p;
  const valid = p > 0 && p < 1;                 // otherwise p is not a probability and the model's argument fails
  const picture = t.record !== false;
  const payoff = payoffOf(kind, strike);
  const verb = kind === 'put' ? 'sell' : 'buy';
  const exercisedAt = [];
  t.count('nodes valued', 0);

  if (!picture) {
    // Count-only and test runs: the same solve(), with nothing kept for drawing.
    const value = solve(m, (node) => { t.count('nodes valued'); if (node.exercised) exercisedAt.push([node.i, node.j]); });
    return { value, kind, style: american ? 'american' : 'european', steps: n, up, down, growth, p, valid, sigma, rate, years, spot, strike, exercisedAt, nodes: (n + 1) * (n + 2) / 2 };
  }

  // Everything below is the same calculation, told one node at a time.
  const S = [], V = [], early = [];
  for (let i = 0; i <= n; i++) { S.push(Array.from({ length: i + 1 }, (_, j) => spot * Math.pow(up, 2 * j - i))); V.push(new Array(i + 1).fill(null)); early.push(new Array(i + 1).fill(false)); }
  const id = (i, j) => `${i},${j}`;
  const legend = [
    { label: 'node being valued', role: 'current' },
    { label: 'the two later nodes it is worked out from', role: 'compare' },
    { label: 'valued', role: 'done' },
    ...(american ? [{ label: 'exercising now beats holding', role: 'target' }] : []),
  ];
  // cols: how many columns of prices exist so far. cur: the node being valued, if any.
  const tree = (cols, cur) => {
    const nodes = [], edges = [];
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= i; j++) {
      const isCur = cur && cur.i === i && cur.j === j;
      const isChild = cur && !cur.leaf && i === cur.i + 1 && (j === cur.j || j === cur.j + 1);
      const v = V[i][j];
      nodes.push({ id: id(i, j), x: n === 0 ? 0.5 : i / n, y: 0.5 - (2 * j - i) / (2 * n), label: money(S[i][j]),
        sub: v === null ? undefined : early[i][j] ? `${money(v)} ${n <= 4 ? 'exercise' : 'ex.'}` : money(v),
        role: isCur ? 'current' : isChild ? 'compare' : v === null ? 'default' : early[i][j] ? 'target' : 'done' });
    }
    for (let i = 0; i < cols; i++) for (let j = 0; j <= i; j++) {
      const active = cur && !cur.leaf && cur.i === i && cur.j === j;
      edges.push({ u: id(i, j), v: id(i + 1, j + 1), role: active ? 'active' : 'default', ...(active ? { w: p.toFixed(3) } : {}) });
      edges.push({ u: id(i, j), v: id(i + 1, j), role: active ? 'active' : 'default', ...(active ? { w: q.toFixed(3) } : {}) });
    }
    return { kind: 'graph', directed: false, aspect: [0.36, 0.36, 0.45, 0.6, 0.95, 1.15, 1.3][Math.min(n, 6)], nodes, edges, legend,
      title: 'Time runs left to right. Each node shows a share price, with the option\'s value underneath once it is known' };
  };
  const facts = (level, here) => {
    const cells = [{ t: f4(up), sub: 'up ×' }, { t: f4(down), sub: 'down ×' }];
    if (level >= 2) cells.push({ t: f4(growth), sub: 'cash grows ×' }, { t: f4(p), sub: 'weight on up (p)', role: valid ? 'pivot' : 'alert' }, { t: f4(q), sub: 'weight on down', role: valid ? undefined : 'alert' });
    return { kind: 'rows', title: 'The numbers every node uses', rows: [{ label: 'One step', cells }, ...(here ? [{ label: 'This node', cells: here }] : [])] };
  };
  const span = years === 1 ? '1 year' : `${years} years`;

  t.frame(() => ({ line: [0, 1],
    note: `${american ? 'An American' : 'A European'} ${kind} option gives its owner the right, with no duty, to ${verb} one share for ${money(strike)} ${american ? `at any time in the next ${span}` : `at the end of ${span} and not before`}. The share costs ${money(spot)} today. What is that right worth today? Nobody knows where the price will go, so the model lays out a tree of places it could go. The ${span} ${years === 1 ? 'is' : 'are'} cut into ${plural(n, 'equal step')} of ${money(dt, 3)} years, and the price moves once in each step.`,
    views: [tree(0, null)], vars: { kind, style: american ? 'American' : 'European', strike: money(strike), steps: n } }));

  t.frame(() => ({ line: 2,
    note: typed
      ? `In each step the price is multiplied either by u = **${f4(up)}**, an up-move, or by d = 1/u = **${f4(down)}**, a down-move. Here u was typed in by hand. Because d = 1/u, an up-move followed by a down-move lands back on the price it started from, so the branches of the tree join up again.`
      : `In each step the price is multiplied either by u, an up-move, or by d, a down-move. Their size comes from the volatility, a measure of how much the price tends to swing: ${money(100 * sigma, 0)}% a year here. Scaled to one step, u = e^(σ × √Δt) = e^(${money(sigma)} × √${money(dt, 3)}) = **${f4(up)}**, and d = 1/u = **${f4(down)}**. Because d = 1/u, an up-move followed by a down-move lands back on the price it started from, so the branches of the tree join up again.`,
    views: [tree(0, null), facts(1)], vars: { u: f4(up), d: f4(down) } }));

  t.frame(() => ({ line: [3, 4],
    note: valid
      ? `Cash in a safe account grows by the factor e^(r × Δt) = **${f4(growth)}** in one step. The method needs one more number, p = (growth − d) / (u − d) = (${f4(growth)} − ${f4(down)}) / (${f4(up)} − ${f4(down)}) = **${f4(p)}**. It is the chance of an up-move that would make the share grow, on average, exactly as fast as the safe account: ${f4(p)} × ${f4(up)} + ${f4(q)} × ${f4(down)} = ${f4(p * up + q * down)}. It is called the **risk-neutral probability**, and it is not a forecast of how often the price will really rise. It is the weight that makes the option cost the same as a mix of shares and cash with the same payoffs, and that is why no forecast is needed.`
      : `Cash in a safe account grows by the factor e^(r × Δt) = **${f4(growth)}** in one step. The method needs p = (growth − d) / (u − d) = (${f4(growth)} − ${f4(down)}) / (${f4(up)} − ${f4(down)}) = **${f4(p)}**. That is ${p >= 1 ? 'not below 1' : 'not above 0'}, so it cannot be a probability, and the weight on the down-move, ${f4(q)}, is ${q < 0 ? 'negative' : 'zero'}. The reason is that the steps are too long for these inputs: in one step cash grows by ${f4(growth)}, which is ${growth > up ? 'more than' : 'as much as'} even the up-move of ${f4(up)}. A share that the safe account beats in every branch is not something the model can price, because its whole argument rests on shares and cash each being worth holding. The recursion is carried out anyway, exactly as the code would do it, so that you can see what comes out.`,
    views: [tree(0, null), facts(2)], vars: { growth: f4(growth), p: f4(p), '1 − p': f4(q) } }));

  for (let i = 1; i <= n; i++) {
    t.frame(() => ({ line: [5, 6],
      note: `Prices after ${plural(i, 'step')}: each one is a price from the step before, times u or times d. They run from ${money(S[i][0])} to ${money(S[i][i])}.${i >= 2 ? ` There are ${i + 1} of them and not ${2 ** i}, because every path with the same number of up-moves ends at the same price.` : ''}${i === n ? ' This last column is expiry, the day the option runs out.' : ''}`,
      views: [tree(i, null), facts(2)], vars: { step: i, prices: i + 1 } }));
  }

  let firstBack = true;
  const value = solve(m, (node) => {
    const { i, j, price } = node;
    V[i][j] = node.value;
    early[i][j] = !!node.exercised;
    if (node.exercised) exercisedAt.push([i, j]);
    t.count('nodes valued');
    if (node.leaf) {
      const gain = node.value > 0;
      t.frame(() => ({ line: [7, 8],
        note: kind === 'put'
          ? (gain ? `At expiry with the share at ${money(price)}: the owner sells for ${money(strike)} a share worth ${money(price)} and gains ${money(strike)} − ${money(price)} = **${money(node.value)}**.` : `At expiry with the share at ${money(price)}: selling for ${money(strike)} a share worth ${money(price)} would gain nothing, so the owner lets the option lapse. It is worth **0**.`)
          : (gain ? `At expiry with the share at ${money(price)}: the owner buys for ${money(strike)} a share worth ${money(price)} and gains ${money(price)} − ${money(strike)} = **${money(node.value)}**.` : `At expiry with the share at ${money(price)}: buying for ${money(strike)} a share worth ${money(price)} would gain nothing, so the owner lets the option lapse. It is worth **0**.`),
        views: [tree(n, node), facts(2, [{ t: money(price), sub: 'share price' }, { t: money(strike), sub: 'strike' }, { t: money(node.value), sub: 'payoff', role: 'current' }])],
        vars: { step: n, 'share price': money(price), value: money(node.value) } }));
      return;
    }
    const lead = firstBack ? 'Now work backwards from expiry, one step at a time. ' : '';
    firstBack = false;
    const blend = `One step later the option is worth ${money(node.ifUp)} if the price goes up and ${money(node.ifDown)} if it goes down. Weigh those by p and 1 − p, then divide by the growth of cash to bring the amount back one step: (${f4(p)} × ${par(money(node.ifUp))} + ${par(f4(q))} × ${par(money(node.ifDown))}) / ${f4(growth)} = ${money(node.hold)}.`;
    let decision;
    if (!american) decision = ` A European option cannot be exercised before expiry, so that is its value here: **${money(node.value)}**.${valid && node.hold < node.exercise - TIE * strike ? ` Notice that it is less than the ${money(node.exercise)} that exercising now would pay. The owner has to wait, and waiting for money costs interest.` : ''}${node.value < 0 ? ' A negative value for a right that nobody is forced to use is impossible. It is the first sign that this tree cannot be trusted.' : ''}`;
    else if (node.exercised) {
      const plainSale = valid && kind === 'put' && rate > 0 && S[i + 1][j + 1] <= strike && Math.abs(node.ifUp - (strike - S[i + 1][j + 1])) < 1e-9 && Math.abs(node.ifDown - (strike - S[i + 1][j])) < 1e-9;
      decision = ` That is what holding on is worth. Exercising now would pay ${money(strike)} − ${money(price)} = ${money(node.exercise)}, which is more, so the value here is **${money(node.value)}**: exercise early.${plainSale ? ` The reason is interest. In both branches the owner would end up selling for ${money(strike)} one step later. Selling now brings in the same ${money(strike)} a step sooner, and cash in hand earns interest.` : valid && kind === 'put' && rate > 0 ? ` The interest earned by having the ${money(strike)} in hand now outweighs what could still be gained by waiting.` : ''}`;
    } else if (node.exercise > 0) decision = ` That is what holding on is worth. Exercising now would pay ${money(node.exercise)}, which is ${node.exercise < node.hold - TIE * strike ? 'less' : 'no more'}, so the owner holds and the value here is **${money(node.value)}**.${valid && node.exercise < node.hold - TIE * strike ? ' Holding is worth more because the payoff can still grow, while it can never fall below zero.' : ''}`;
    else decision = ` Exercising now would pay nothing, because the share is ${kind === 'put' ? 'not below' : 'not above'} ${money(strike)}, so the owner holds and the value here is **${money(node.value)}**.`;
    t.frame(() => ({ line: american ? [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] : [9, 10, 11, 12, 13, 14, 19, 20],
      note: `${lead}${i === 0 ? 'Today' : `After ${plural(i, 'step')}`}, share at ${money(price)}. ${blend}${decision}`,
      views: [tree(n, node), facts(2, [{ t: money(node.ifUp), sub: 'value if up', role: 'compare' }, { t: money(node.ifDown), sub: 'value if down', role: 'compare' }, { t: money(node.hold), sub: 'hold' },
        ...(american ? [{ t: money(node.exercise), sub: 'exercise now' }] : []), { t: money(node.value), sub: 'value here', role: node.exercised ? 'target' : 'current' }])],
      vars: { step: i, 'share price': money(price), hold: money(node.hold), ...(american ? { 'exercise now': money(node.exercise) } : {}), value: money(node.value) } }));
  });

  // Reference values for the last step: the European counterpart, a much finer tree, and the formula.
  // A tree whose up-move was typed in by hand has no volatility behind it, so it has nothing finer to be compared with.
  const european = american ? solve({ ...m, american: false }) : value;
  const fineUp = Math.exp(sigma * Math.sqrt(years / FINE)), fineGrowth = Math.exp(rate * years / FINE);
  const fineP = (fineGrowth - 1 / fineUp) / (fineUp - 1 / fineUp);
  const fineValid = !typed && fineP > 0 && fineP < 1;
  const fine = typed ? null : solve({ ...m, up: fineUp, growth: fineGrowth, steps: FINE });
  const formula = typed ? null : blackScholes(kind, spot, strike, rate, sigma, years);
  t.frame(() => {
    const coarse = typed ? '' : ` A tree of ${plural(n, 'step')} is coarse. With ${FINE} steps the same method gives ${money(fine)}`;
    let rest;
    if (!valid) rest = `${V.some((col) => col.some((v) => v < 0)) ? 'A right that nobody is forced to use can never be worth less than nothing, yet this tree produced a negative value. ' : ''}The number cannot be trusted, because p = ${f4(p)} is not a probability. ${fineValid ? `The same method with ${FINE} steps, where p is ${f4(fineP)}, gives **${money(fine)}**. The cure is more steps: p stays between 0 and 1 as long as the up-move in one step is larger than the growth of cash in one step.` : typed ? 'Type a larger up-move or choose a lower interest rate, so that the up-move is larger than the growth of cash in one step.' : `Even ${FINE} steps are too coarse for these inputs.`}`;
    else if (american) rest = `${exercisedAt.length ? `At ${plural(exercisedAt.length, 'node')} exercising at once beat holding.` : 'At no node did exercising early beat holding.'} The same option without the right to exercise early, the European ${kind}, is worth ${money(european)} on this tree, so that right adds ${money(value - european)}.${kind === 'call' ? ' For a call on a share that pays no dividend it adds nothing: exercising early would mean paying the strike sooner than necessary.' : rate === 0 ? ' With no interest there is nothing to gain from receiving the strike sooner, so the right is never used.' : ''}${typed ? '' : `${coarse}.`}`;
    else rest = typed ? 'The up-move was typed in by hand, so this is the exact value for the tree as drawn.' : `${coarse.trim()}, and the Black-Scholes formula, which is what the tree approaches as the steps shrink, gives ${money(formula)}.`;
    return { line: 21,
      note: `Back at today, the model values the option at **${money(value)}**. ${rest} All of this is the value inside the model, which assumes a volatility that never changes, a constant interest rate, no dividends and no trading costs. It explains how such contracts are reasoned about. It is not advice.`,
      views: [tree(n, null), facts(2)], vars: { value: money(value), ...(american ? { 'European value': money(european) } : {}), ...(typed ? {} : { [`${FINE} steps`]: money(fine) }) } };
  });

  return { value, kind, style: american ? 'american' : 'european', steps: n, up, down, growth, p, valid, sigma, rate, years, spot, strike, exercisedAt,
    nodes: (n + 1) * (n + 2) / 2, prices: S, values: V, european, fine, fineValid, formula };
}

// Shorthand for the tests: the model value for a full set of inputs, without drawing anything.
const price = (over) => run({ kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0, ...over }, QUIET);

export default {
  meta: {
    id: 'binomial-option-pricing',
    name: 'Binomial Option Pricing',
    aliases: ['binomial tree', 'Cox-Ross-Rubinstein model', 'CRR model', 'binomial options pricing model', 'lattice model', 'option pricing tree'],
    kind: 'algorithm',
    discipline: 'finance',
    alsoIn: [
      { id: 'algorithms', why: 'It is dynamic programming on a tree whose branches rejoin: each node is valued once, from the two nodes that follow it.' },
      { id: 'optimization', why: 'Choosing when to exercise an American option is an optimal stopping problem, solved here by comparing "stop now" with "carry on" at every node.' },
    ],
    subfield: 'Derivative pricing',
    family: 'Lattice methods',
    lab: 'dynamic-programming',
    year: 1979,
    authors: 'John C. Cox, Stephen A. Ross and Mark Rubinstein',
    summary: 'Values an option by building a tree of possible share prices and working backwards from the payoffs at expiry, node by node. A teaching model, not advice.',
    difficulty: 'intermediate',
    order: 345,
    paradigms: ['dynamic-programming'],
    randomized: false,
    approximate: true,
    time: { best: 'O(n²) for n steps', average: 'O(n²)', worst: 'O(n²)', class: 'quadratic' },
    space: { worst: 'O(n) for the price alone; O(n²) to keep every node', class: 'linear' },
    tags: {
      problems: ['what is the right to buy something later worth today', 'decide whether to use an option now or wait', 'put a value on a choice you can make in the future', 'work backwards from the possible outcomes to a value today', 'what is it worth to be allowed to sell at a fixed price', 'value a contract whose payoff depends on a future price'],
      techniques: ['backward induction', 'recombining tree', 'risk-neutral valuation', 'replication', 'early exercise test'],
      applications: ['finance'],
    },
    prerequisites: ['fibonacci-dp', 'concept:dynamic-programming', 'concept:expectation', 'concept:probability', 'concept:optimal-substructure'],
  },

  bigIdea: {
    simple: "An option is a ticket that lets you buy or sell something later, such as a share in a company, at a price fixed today. You may use the ticket or throw it away. Suppose a ticket lets you sell a share for 100 a year from now. If the share is then worth 80, the ticket gains you 20. If the share is worth 120, the ticket is useless and you ignore it. So what should the ticket cost today, when nobody knows the future price? This method draws a tree. From today's price the share can step up or step down. From each of those prices it can step up or down again, and so on until the last day. On the last day the ticket's worth is easy to see at every branch tip. Then you work backwards. The worth at each fork is a careful blend of the two worths that follow it. Fork by fork you arrive back at today, and the number you reach is the price of the ticket. It is the answer of a simplified model, not a promise about any real market.",
    when: 'A tree is the method to reach for when the option can be exercised before its last day (American style), when the rules of the payoff can be checked at each node, and when a few hundred steps give enough accuracy. For a European option on a share that pays no dividend, the Black-Scholes formula gives the limit of the tree directly and no tree is needed. When the payoff depends on the whole path of the price, or on several prices at once, the tree grows too large and simulation by [Monte Carlo](#/algorithm/monte-carlo) is the usual choice. This page explains how the model works. It is not guidance on buying or selling anything.',
    interesting: 'The real chance that the price goes up appears nowhere in the calculation. Two people who disagree completely about whether the share will rise must still agree on the model\'s price for the option. The reason is that the option\'s payoffs can be copied with the right mix of shares and cash, and that mix has a known cost today. A second surprise is in the counting: a tree of n steps has 2ⁿ possible paths, but they pass through only (n + 1)(n + 2)/2 different nodes, so the work grows with the square of n and not exponentially.',
    analogy: {
      title: 'Labelling a trail map from the ends back to the start',
      text: "Imagine a trail that forks again and again, with a prize of known size at the end of every branch. You stand at the start and want to know what the walk is worth. Looking forward is confusing, because there are so many routes. Looking backward is easy. Write the prize at every trail end. Each last fork then needs only the two numbers just beyond it, blended into one. Once those forks are labelled, the forks before them have what they need, and so on back to the start. If the rules let you stop at a fork and take a fixed reward instead, compare that reward with the fork's blended number and write down the larger.",
      limits: 'On a trail map the blend could be a plain average. In the model the blending weights are forced by the sizes of the up and down moves and by the interest rate, and they are nobody\'s forecast. The map also has tidy forks at fixed places. A real price can jump any distance at any moment, and every real trade costs something, both of which the model leaves out.',
    },
  },

  example: {
    setup: "A share costs 60 today. In each of two steps its price either doubles or halves. The ticket in the explanation above was a right to sell. This example uses the other kind, a right to buy, which is called a call option: the right to buy the share for 60 at the end of the second step, and not before. To keep the sums easy, money in the bank earns no interest here. What is the option worth today?",
    steps: [
      "Build the prices. After one step the share is at 120 or 30. After two steps it is at 240, 60 or 15. The middle price, 60, is reached in two ways: up then down, or down then up. So the tree has three end points and not four.",
      "Value the option at the end. At 240 the owner buys for 60 something worth 240 and gains 180. At 60, buying for 60 gains nothing. At 15 nobody would pay 60. So the option is worth 180, 0 and 0.",
      "Find the weights. Give the up-move a weight of one third and the down-move two thirds. With those weights the share is a fair bet when no interest is paid: one third of 120 plus two thirds of 30 is 40 + 20 = 60, today's price. These are the weights the method uses. They are not a forecast of what the price will do.",
      "Step back to the first step. At 120 the option leads to 180 or 0, so it is worth one third of 180 plus two thirds of 0, which is 60. At 30 it leads to 0 or 0, so it is worth 0.",
      "Step back to today. The option leads to 60 or 0, so it is worth one third of 60 plus two thirds of 0, which is 20.",
      "Check by copying. Hold two thirds of a share and borrow 20. Today that costs 40 − 20 = 20. After one step, if the price is 120, the holding is worth 80 − 20 = 60. If the price is 30, it is worth 20 − 20 = 0. Those are exactly the option's two values after one step.",
    ],
    result: "The option is worth 20 today. A mix of shares and borrowed money that costs 20 behaves exactly like the option over the first step, so any other price for the option would hand someone a profit without risk. Nowhere did the sums need to know how likely the price really is to double.",
    tryInput: { kind: 'call', style: 'european', spot: 60, strike: 60, rate: 0, steps: 2, up: 2 },
  },

  terms: [
    { term: "Share", meaning: "A small piece of a company that can be bought and sold. Its price changes from day to day." },
    { term: "Option", meaning: "A contract that gives its owner the right, but no duty, to buy or sell something at a fixed price on or before a fixed date." },
    { term: "Call and put", meaning: "A call is the right to buy. A put is the right to sell." },
    { term: "Strike price", meaning: "The fixed price written into the option, at which the owner may buy or sell." },
    { term: "Expiry", meaning: "The last day on which the option can be used. After it the option is worthless." },
    { term: "Exercise", meaning: "To use the option: to buy or sell at the strike price." },
    { term: "Payoff", meaning: "What exercising gains: for a put, the strike price minus the share price if that is positive, and otherwise nothing." },
    { term: "European and American", meaning: "A European option can be exercised only at expiry. An American option can be exercised on any day up to expiry. The names have nothing to do with where the options are traded." },
    { term: "Volatility", meaning: "A number that says how much the share price tends to swing in a year. A higher volatility gives a wider tree." },
    { term: "Risk-free rate", meaning: "The interest earned by money in a safe account. The model uses it to compare money now with money later." },
    { term: "Risk-neutral probability", meaning: "The weight given to an up-move in the blend. It is fixed by the up-move, the down-move and the interest rate, and it is not a forecast." },
    { term: "Discounting", meaning: "Shrinking a future amount to its worth today, because money received later could have been earning interest in the meantime." },
  ],

  takeaway: "Write down what the option pays at every possible final price, then step backwards through the tree, blending two later values into each earlier one, until you reach today.",

  viz: {
    describe: 'A tree drawn left to right, one column for each time step. Each node is an oval holding a share price. The top node of a column is the price after nothing but up-moves and the bottom node is the price after nothing but down-moves. Under each node, once it has been worked out, is the value of the option at that node. The node being valued is terracotta and the two later nodes it is computed from are ochre, with the two weights written on the lines that join them. Nodes already valued are forest green. For an American option, nodes where exercising at once is worth more than holding are brick and are marked exercise, shortened to ex. on larger trees. A strip of cells under the tree lists the up factor, the down factor, the growth of cash in one step and the two weights, and a second strip shows the numbers used at the current node.',
    inputs: [
      { id: 'kind', type: 'select', label: 'Kind of option', default: 'put', options: [{ value: 'put', label: 'Put (the right to sell)' }, { value: 'call', label: 'Call (the right to buy)' }] },
      { id: 'style', type: 'select', label: 'When it can be exercised', default: 'american', options: [{ value: 'american', label: 'American: any time up to expiry' }, { value: 'european', label: 'European: only at expiry' }] },
      { id: 'spot', type: 'range', label: 'Share price today', min: 20, max: 200, step: 1, default: 100 },
      { id: 'strike', type: 'range', label: 'Strike price', min: 20, max: 200, step: 1, default: 100 },
      { id: 'vol', type: 'range', label: 'Volatility (% a year)', min: 5, max: 80, step: 1, default: 20,
        help: 'How much the price tends to swing. It sets the size of the up and down moves.' },
      { id: 'rate', type: 'range', label: 'Interest rate (% a year)', min: 0, max: 15, step: 0.5, default: 5 },
      { id: 'years', type: 'range', label: 'Time to expiry (years)', min: 0.25, max: 3, step: 0.25, default: 1 },
      { id: 'steps', type: 'range', label: 'Steps in the tree (n)', min: 1, max: 6, step: 1, default: 4 },
      { id: 'up', type: 'number', label: 'Up-move typed by hand (0 = use the volatility)', default: 0, min: 0, max: 10,
        help: 'Leave at 0 for the Cox-Ross-Rubinstein rule. A number above 1, such as 2, sets the up-move directly, which is how the example by hand is run.' },
    ],
    presets: [
      { label: 'American put', values: { kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 } },
      { label: 'The same put, European', values: { kind: 'put', style: 'european', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 } },
      { label: 'American put, no interest', values: { kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 0, years: 1, steps: 4, up: 0 } },
      { label: 'American call', values: { kind: 'call', style: 'american', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 } },
      { label: 'Two steps by hand', values: { kind: 'call', style: 'european', spot: 60, strike: 60, rate: 0, years: 1, steps: 2, up: 2 } },
      { label: 'A tree too coarse for its inputs', values: { kind: 'put', style: 'european', spot: 100, strike: 100, vol: 10, rate: 12, years: 3, steps: 2, up: 0 } },
    ],
    tryThis: [
      'Load "American put" and step to the backward pass. At the node with the share at 74.08, holding is worth 24.68 and exercising now pays 25.92, so the node turns brick: exercise early. Three nodes end up brick, and the option is worth 5.88 today.',
      'Load "The same put, European". The node at 74.08 is now valued at 24.68, less than the 25.92 that exercising would pay, because the owner is not allowed to exercise yet. Today\'s value falls to 5.09. The difference, 0.79, is what the right to exercise early is worth on this tree.',
      'Load "American put, no interest". No node turns brick, and the American and European values are the same, 7.49. Early exercise of a put pays only because the strike arrives sooner and can earn interest. With no interest there is no reason to hurry.',
      'With the American put, move the number of steps from 3 to 4 to 5: the value goes 6.50, 5.88, 6.37. It zigzags around the value that a 500-step tree gives, 6.09, and the swings shrink as steps are added. A tree with few steps is a rough sketch.',
      'Load "A tree too coarse for its inputs". The weight p comes out as 1.27, which is not a probability, and one node is valued at −4.95, a negative price for a right nobody is forced to use. The tree says 1.13 where a 500-step tree says 0.10. The last step explains the cure.',
    ],
    run,
    report: (r, c) => {
      const lines = [`${r.style === 'american' ? 'American' : 'European'} ${r.kind}, share at ${money(r.spot)}, strike ${money(r.strike)}: the ${r.steps}-step tree values it at ${money(r.value)}.`];
      lines.push(`One step: up × ${f4(r.up)}, down × ${f4(r.down)}, cash grows × ${f4(r.growth)}, risk-neutral weight on up p = ${f4(r.p)}.`);
      if (!r.valid) lines.push(`p is not between 0 and 1, so this tree cannot be trusted.${r.fineValid ? ` A ${FINE}-step tree gives ${money(r.fine)}.` : ''}`);
      else if (r.style === 'american') lines.push(`Early exercise beats holding at ${plural(r.exercisedAt.length, 'node')}. European value on the same tree: ${money(r.european)}.${r.fine === null ? '' : ` With ${FINE} steps: ${money(r.fine)}.`}`);
      else if (r.fine !== null) lines.push(`With ${FINE} steps: ${money(r.fine)}. Black-Scholes formula: ${money(r.formula)}.`);
      else lines.push('The up-move was typed in by hand, so there is no finer tree to compare with.');
      lines.push(`${c['nodes valued'] || 0} nodes valued. A model value for study, not advice.`);
      return lines.join('\n');
    },
    experiment: {
      title: 'Nodes valued as the number of steps grows',
      note: 'Each point is a real run that values an American put on a tree of n steps and counts the nodes. The paths through the tree number 2ⁿ, but the branches rejoin, so there are only (n + 1)(n + 2)/2 nodes: doubling the steps makes about four times the work. The tests of this lesson measure the other side of the bargain: ten times the steps brings the price ten times closer to its limit.',
      metric: 'nodes valued',
      metricLabel: 'Nodes valued',
      sizeLabel: 'Steps in the tree (n)',
      sizes: [4, 8, 16, 32, 64, 128, 256, 512, 1024],
      variants: [{ id: 'put', label: 'American put' }],
      input: (n) => ({ kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: n, up: 0 }),
      theory: [{ label: '(n + 1)(n + 2) / 2', fn: (n) => (n + 1) * (n + 2) / 2 }],
    },
  },

  logic: {
    intuition: 'Take a single step. The share ends at one of two prices, so the option ends at one of two values. There are also two things you can hold today: shares and cash. Two unknown amounts, two outcomes to match: there is exactly one mix of shares and cash that ends up worth the same as the option in both outcomes. If two things are worth the same tomorrow whatever happens, they must cost the same today, or someone could buy the cheap one, sell the dear one and pocket the difference without risk. So the option is worth what the mix costs. Worked through, that cost is a weighted average of the option\'s two later values, brought back one step by the interest rate. A longer tree is the same step repeated. The values at expiry are known, so the step is applied to the last forks first, then to the forks before them, back to today.',
    steps: [
      'Divide the time to expiry T into n steps of length Δt = T / n.',
      'Set the up factor u = exp(σ·√Δt), where σ is the volatility, and the down factor d = 1/u. After i steps with j up-moves the price is S0·u^j·d^(i−j).',
      'Compute the growth of cash in one step, exp(r·Δt), and the risk-neutral probability p = (growth − d) / (u − d).',
      'At expiry, set the value at each node to the payoff: max(K − S, 0) for a put and max(S − K, 0) for a call, where K is the strike price.',
      'Step back one column. At each node compute the holding value (p · value after an up-move + (1 − p) · value after a down-move) / growth.',
      'For a European option, the holding value is the value. For an American option, the value is the larger of the holding value and the payoff from exercising at that node.',
      'Repeat until the first column. The value at its single node is the price today.',
    ],
    pseudocode: [
      'price(S0, K, r, σ, T, n):',
      '  Δt ← T / n',
      '  u ← exp(σ·√Δt);  d ← 1 / u',
      '  growth ← exp(r·Δt)',
      '  p ← (growth − d) / (u − d)',
      '  for step i, up-moves j:',
      '    S[i][j] ← S0·u^j·d^(i−j)',
      '  for j from 0 to n:',
      '    V[n][j] ← payoff(S[n][j])',
      '  for i from n − 1 down to 0:',
      '    for j from 0 to i:',
      '      Vu ← V[i+1][j+1]',
      '      Vd ← V[i+1][j]',
      '      hold ← p·Vu + (1−p)·Vd',
      '      hold ← hold / growth',
      '      if American:',
      '        now ← payoff(S[i][j])',
      '        V[i][j] ← larger of',
      '          hold and now',
      '      else:',
      '        V[i][j] ← hold',
      '  return V[0][0]',
    ],
    decisions: [
      { title: 'How many steps?', text: 'The tree\'s price differs from its own limit by an amount that shrinks roughly in proportion to 1/n, and it zigzags as n changes, most visibly when the strike sits near a node. A few hundred steps are common. Averaging the prices for n and n + 1 steps cancels much of the zigzag.' },
      { title: 'How are the up and down moves chosen?', text: 'Cox, Ross and Rubinstein set u = exp(σ·√Δt) and d = 1/u. This makes the branches rejoin, keeps the tree centred on today\'s price, and gives the price the right amount of spread as the steps shrink. Other choices exist, such as fixing both weights at one half and adjusting u and d to match. All of them lead to the same limit.' },
      { title: 'European or American?', text: 'The only difference in the code is one comparison per node. The difference in meaning is that the American owner makes a decision at every node, and the tree records the best one.' },
      { title: 'Keep the whole tree or one column?', text: 'Each column is computed from the one after it, so the price needs only one array of n + 1 values. Keeping the whole tree costs more memory and shows where early exercise happens.' },
      { title: 'What about dividends?', text: 'This page assumes the share pays none. A dividend lowers the share price when it is paid, which changes the tree and can make it worthwhile to exercise an American call early. Handling dividends is a standard extension and is not shown here.' },
    ],
    invariants: [
      'When column i has been filled, V[i][j] is the model value of the option at that node, given everything that can happen afterwards.',
      'p·u + (1 − p)·d equals the growth of cash in one step, so under the weights p and 1 − p the share grows on average at the interest rate.',
      'While 0 < p < 1, no value is negative, because each is a positive blend of values that are not negative.',
      'At every node the American value is at least the payoff from exercising there, and at least the European value.',
    ],
    edgeCases: [
      'One step: the tree is a single fork and the price is one blend of two payoffs.',
      'Interest rate zero: holding a put is never worth less than exercising it, so an American put and a European put have the same value.',
      'A call on a share that pays no dividend: exercising early never beats holding, so the American and European calls are equal.',
      'Steps too long for the inputs: if cash grows in one step by as much as the up-move, p is 1 or more. The weights stop being probabilities and the tree can return nonsense, including negative values. Use more steps.',
      'The strike exactly on a node: the payoff has a corner there, which is what makes the price zigzag between odd and even numbers of steps.',
      'Volatility of zero: u and d are both 1, the fork has no width, and the formula for p divides by zero.',
    ],
    correctness: 'Consider one node with share price S, and suppose the values one step later, V_up and V_down, are already correct. Hold Δ = (V_up − V_down) / (S·u − S·d) shares and put B in the safe account, with B chosen so that Δ·S·d + B·growth = V_down. Then the mix is also worth V_up after an up-move. A mix that matches the option in both outcomes must cost what the option costs, otherwise buying one and selling the other is a riskless profit. Its cost Δ·S + B simplifies to (p·V_up + (1 − p)·V_down) / growth with p = (growth − d) / (u − d), which is the line of code. The values at expiry are correct by the definition of the option, so by induction backwards through the columns every European value is correct within the model. For an American option the owner may also exercise, and will choose whichever is worth more, so the value is the larger of the two. Cox, Ross and Rubinstein further showed that as n grows the tree\'s price converges to the Black-Scholes value. All of this is correctness inside the model. Whether the model fits a real market is a separate question, taken up under what could go wrong.',
    mistakes: [
      'Using a forecast of the share\'s rise in place of p. The weights are fixed by u, d and the interest rate.',
      'Forgetting to divide by the growth of cash, which leaves every earlier value too high.',
      'Mixing units: an annual interest rate or volatility used as if it applied to one step.',
      'Testing early exercise against the wrong price, such as today\'s price or the price at expiry, instead of the price at the node.',
      'Updating one array in place in the wrong direction, so that a value is read after it has already been replaced.',
      'Comparing a tree with an odd number of steps to one with an even number and reading the zigzag as a real change in value.',
    ],
  },

  code: {
    sample: {
      input: 'First the two-step tree worked by hand: a share at 60 that doubles or halves, no interest, a call with strike 60. Then a share at 100, strike 100, interest 5% a year, volatility 20% a year and one year to expiry, on trees of 1 to 256 steps. The Black-Scholes values that the European columns approach are 5.5735 for the put and 10.4506 for the call.',
      expected: 'two steps by hand: 20.0000\nsteps  European put  American put  European call\n    1        7.2852        7.2852        12.1623\n    2        4.6634        5.7377         9.5405\n    4        5.0935        5.8828         9.9705\n   16        5.4496        6.0374        10.3267\n   64        5.5423        6.0775        10.4194\n  256        5.5657        6.0873        10.4428',
    },
    python: {
      source: `import math


def tree_price(spot, strike, up, growth, steps, kind, american):
    """Value an option on a tree. In each step the share price is multiplied
    by up or by 1 / up, and cash in a safe account grows by growth."""
    down = 1 / up
    p = (growth - down) / (up - down)   # risk-neutral weight on the up-move

    def payoff(price):
        if kind == "call":
            return max(price - strike, 0.0)
        return max(strike - price, 0.0)

    # Build the prices forward to expiry. Index j counts the up-moves.
    prices = [spot]
    for _ in range(steps):
        prices = [prices[0] * down] + [price * up for price in prices]
    values = [payoff(price) for price in prices]

    # Work backwards, one step at a time, to today.
    for i in range(steps - 1, -1, -1):
        for j in range(i + 1):
            up_part = p * values[j + 1]
            down_part = (1 - p) * values[j]
            hold = (up_part + down_part) / growth
            prices[j] = prices[j] * up      # the share price at this node
            if american:
                values[j] = max(hold, payoff(prices[j]))
            else:
                values[j] = hold
    return values[0]


def crr_price(spot, strike, rate, sigma, years, steps, kind, american):
    """Cox-Ross-Rubinstein: choose the up-move from the volatility."""
    dt = years / steps
    up = math.exp(sigma * math.sqrt(dt))
    growth = math.exp(rate * dt)
    return tree_price(spot, strike, up, growth, steps, kind, american)


by_hand = tree_price(60.0, 60.0, 2.0, 1.0, 2, "call", False)
print(f"two steps by hand: {by_hand:.4f}")
print("steps  European put  American put  European call")
for steps in [1, 2, 4, 16, 64, 256]:
    european_put = crr_price(100.0, 100.0, 0.05, 0.2, 1.0, steps, "put", False)
    american_put = crr_price(100.0, 100.0, 0.05, 0.2, 1.0, steps, "put", True)
    european_call = crr_price(100.0, 100.0, 0.05, 0.2, 1.0, steps, "call", False)
    print(f"{steps:5d}  {european_put:12.4f}  {american_put:12.4f}  {european_call:13.4f}")`,
      notes: [
        { line: 8, text: 'The risk-neutral weight. It depends only on the sizes of the two moves and on the growth of cash, never on a forecast.' },
        { line: 18, text: 'One more column of prices: the lowest is the old lowest times down, and every other one is an old price times up. The branches rejoin, so a column has only one more price than the one before.' },
        { line: 26, text: 'The value of holding on: blend the two later values with the weights p and 1 − p, then divide by the growth of cash to bring the amount back one step.' },
        { line: 27, text: 'The price at this node is the price one step later along the down branch, times up. It is needed only for the early-exercise test.' },
        { line: 29, text: 'An American option is worth the larger of holding and exercising now. This comparison is the whole difference between the two styles.' },
        { line: 38, text: 'The Cox-Ross-Rubinstein choice of up-move. The down-move is 1 / up, which is what makes the tree rejoin.' },
      ],
    },
    javascript: {
      source: `// Value an option on a tree. In each step the share price is multiplied
// by up or by 1 / up, and cash in a safe account grows by growth.
function treePrice(spot, strike, up, growth, steps, kind, american) {
  const down = 1 / up;
  const p = (growth - down) / (up - down);   // risk-neutral weight on the up-move
  const payoff = (price) => (kind === "call" ? Math.max(price - strike, 0.0) : Math.max(strike - price, 0.0));

  // Build the prices forward to expiry. Index j counts the up-moves.
  let prices = [spot];
  for (let step = 0; step < steps; step++) {
    prices = [prices[0] * down, ...prices.map((price) => price * up)];
  }
  const values = prices.map(payoff);

  // Work backwards, one step at a time, to today.
  for (let i = steps - 1; i >= 0; i--) {
    for (let j = 0; j <= i; j++) {
      const upPart = p * values[j + 1];
      const downPart = (1 - p) * values[j];
      const hold = (upPart + downPart) / growth;
      prices[j] = prices[j] * up;            // the share price at this node
      if (american) {
        values[j] = Math.max(hold, payoff(prices[j]));
      } else {
        values[j] = hold;
      }
    }
  }
  return values[0];
}

// Cox-Ross-Rubinstein: choose the up-move from the volatility.
function crrPrice(spot, strike, rate, sigma, years, steps, kind, american) {
  const dt = years / steps;
  const up = Math.exp(sigma * Math.sqrt(dt));
  const growth = Math.exp(rate * dt);
  return treePrice(spot, strike, up, growth, steps, kind, american);
}

const byHand = treePrice(60.0, 60.0, 2.0, 1.0, 2, "call", false);
console.log("two steps by hand: " + byHand.toFixed(4));
console.log("steps  European put  American put  European call");
for (const steps of [1, 2, 4, 16, 64, 256]) {
  const europeanPut = crrPrice(100.0, 100.0, 0.05, 0.2, 1.0, steps, "put", false);
  const americanPut = crrPrice(100.0, 100.0, 0.05, 0.2, 1.0, steps, "put", true);
  const europeanCall = crrPrice(100.0, 100.0, 0.05, 0.2, 1.0, steps, "call", false);
  console.log(String(steps).padStart(5, " ") + "  " + europeanPut.toFixed(4).padStart(12, " ") + "  " +
    americanPut.toFixed(4).padStart(12, " ") + "  " + europeanCall.toFixed(4).padStart(13, " "));
}`,
    },
    cpp: {
      source: `#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

double payoff(double price, double strike, bool call) {
    return call ? std::max(price - strike, 0.0) : std::max(strike - price, 0.0);
}

// Value an option on a tree. In each step the share price is multiplied
// by up or by 1 / up, and cash in a safe account grows by growth.
double tree_price(double spot, double strike, double up, double growth, int steps, bool call, bool american) {
    double down = 1 / up;
    double p = (growth - down) / (up - down);   // risk-neutral weight on the up-move

    // Build the prices forward to expiry. Index j counts the up-moves.
    std::vector<double> prices = {spot};
    for (int step = 0; step < steps; ++step) {
        std::vector<double> next = {prices[0] * down};
        for (double price : prices) next.push_back(price * up);
        prices = next;
    }
    std::vector<double> values;
    for (double price : prices) values.push_back(payoff(price, strike, call));

    // Work backwards, one step at a time, to today.
    for (int i = steps - 1; i >= 0; --i) {
        for (int j = 0; j <= i; ++j) {
            double up_part = p * values[j + 1];
            double down_part = (1 - p) * values[j];
            double hold = (up_part + down_part) / growth;
            prices[j] = prices[j] * up;          // the share price at this node
            if (american) {
                values[j] = std::max(hold, payoff(prices[j], strike, call));
            } else {
                values[j] = hold;
            }
        }
    }
    return values[0];
}

// Cox-Ross-Rubinstein: choose the up-move from the volatility.
double crr_price(double spot, double strike, double rate, double sigma, double years, int steps, bool call, bool american) {
    double dt = years / steps;
    double up = std::exp(sigma * std::sqrt(dt));
    double growth = std::exp(rate * dt);
    return tree_price(spot, strike, up, growth, steps, call, american);
}

int main() {
    double by_hand = tree_price(60.0, 60.0, 2.0, 1.0, 2, true, false);
    std::printf("two steps by hand: %.4f\\n", by_hand);
    std::printf("steps  European put  American put  European call\\n");
    const int sizes[] = {1, 2, 4, 16, 64, 256};
    for (int steps : sizes) {
        double european_put = crr_price(100.0, 100.0, 0.05, 0.2, 1.0, steps, false, false);
        double american_put = crr_price(100.0, 100.0, 0.05, 0.2, 1.0, steps, false, true);
        double european_call = crr_price(100.0, 100.0, 0.05, 0.2, 1.0, steps, true, false);
        std::printf("%5d  %12.4f  %12.4f  %13.4f\\n", steps, european_put, american_put, european_call);
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'A tree of n steps has (n + 1)(n + 2)/2 nodes and each is valued once with a fixed amount of arithmetic, so the time grows with the square of n. The price alone needs one array of n + 1 values. The other half of the cost is accuracy: the gap between the tree and its limit shrinks roughly like 1/n, so each extra correct digit costs ten times the steps and a hundred times the work.',
    cases: [
      { case: 'n steps (this page)', time: 'Θ(n²)', when: 'Always. Every node is visited once, whatever the inputs.' },
      { case: 'A tree whose branches did not rejoin', time: 'O(2ⁿ)', when: 'If an up-move followed by a down-move did not return to the same price, every path would need its own node. Setting d = 1/u avoids this.' },
      { case: 'Error of the price against its limit', time: 'about 1/n', when: 'Measured by the tests of this lesson for a European option: ten times the steps leaves a tenth of the gap to the Black-Scholes value.' },
      { case: 'Black-Scholes formula', time: 'O(1)', when: 'European options on a share without dividends only. It is the limit of the tree and needs no steps.' },
      { case: 'Monte Carlo with m simulated paths', time: 'O(m · n)', when: 'Error about 1/√m. Slower for one share, but its cost does not explode when the payoff depends on many prices.' },
    ],
    space: 'O(n) for the price alone, using one array that is overwritten column by column. O(n²) to keep the whole tree, as this page does in order to draw it.',
    memory: 'With one array the method touches memory in order and is fast in practice. A thousand steps is about half a million node updates, which a compiled program finishes in a few milliseconds.',
    tradeoffs: 'The tree handles early exercise with one extra comparison, which a closed formula cannot do, and it is simple enough to check by hand. Its accuracy improves slowly, and it becomes unusable when the payoff depends on several prices or on the path taken, because the number of nodes multiplies. Simulation scales better in those cases but handles early exercise only with added machinery.',
    assumptions: [
      'The count is of nodes valued, each costing a constant number of arithmetic operations.',
      'The 1/n behaviour of the error is an observation for plain puts and calls on this kind of tree, confirmed numerically by the tests. The error zigzags and is not a smooth curve.',
      'Accuracy here means closeness to the model\'s own limiting value. It says nothing about closeness to prices in a real market.',
      'The inputs are taken as known. In practice the volatility is an estimate, and the uncertainty in it is usually far larger than the error from using too few steps.',
    ],
  },

  tradeoffs: {
    struggles: [
      'The model assumes one volatility that never changes. Real volatility moves around and cannot be observed directly, and the prices of options in real markets imply different volatilities for different strikes, which a single number cannot reproduce.',
      'It assumes the price moves in small steps. Real prices sometimes jump, on news or in a crash, and across a jump the mix of shares and cash that is supposed to copy the option stops copying it.',
      'It assumes shares can be bought, sold and borrowed in any amount at no cost, and that money can be borrowed and lent at one fixed rate. Real trading has costs and limits, and borrowing costs more than lending earns.',
      'It assumes, on this page, that the share pays no dividends. Dividends change both the tree and the decision to exercise early.',
      'Payoffs that depend on the path the price took, such as its average or its lowest point: two paths that end at the same price no longer have the same value, so the branches cannot be merged.',
      'Options on several prices at once: the nodes multiply with every added price.',
    ],
    pitfalls: [
      'Entering the volatility or the interest rate as a percentage where the code expects a fraction, or the other way round.',
      'Steps so long that p leaves the range 0 to 1. The code still returns a number, and the number is meaningless.',
      'Quoting the result to many decimal places. With a few steps even the first decimal is unreliable.',
      'Treating the output as the price at which something can actually be traded.',
    ],
    misunderstandings: [
      '"p is the chance that the share goes up." It is not. It is the weight that makes a mix of shares and cash cost the same as the option it copies. The real chance of a rise does not enter the calculation at all.',
      '"The tree predicts where the price will go." The tree lists possibilities whose spread is set by the volatility you typed in. It contains no opinion about direction.',
      '"More steps make the answer more true." More steps bring the answer closer to the model\'s own limit. If the model\'s assumptions do not hold, that is a more exact answer to the wrong question.',
      '"An American option is always worth more than a European one." It is worth at least as much. For a call on a share that pays no dividend the two are worth exactly the same, because exercising early is never the better choice.',
      '"The model tells you whether an option is a good buy." It tells you what the option costs to copy under a list of assumptions. It gives no advice, and real prices differ from it for the reasons listed above.',
    ],
    constraints: [
      'The largest uncertainty is in the inputs, above all the volatility, which has to be estimated. For the default American put, a volatility of 25% in place of 20% moves the 500-step value from 6.09 to 7.97, which is about 30% more and far larger than the error from using too few steps.',
      'This lesson explains a model for study. It is not financial advice, and nothing in it is a recommendation to buy or sell anything.',
    ],
    alternatives: [
      { name: 'Black-Scholes formula', when: 'The option is European and the share pays no dividend. The formula is the limit of the tree and is evaluated in one step.' },
      { id: 'monte-carlo', name: 'Monte Carlo Estimation', when: 'The payoff depends on the whole path of the price or on several prices. Simulated paths are averaged, with an error that shrinks like one over the square root of their number.' },
      { name: 'Trinomial tree', when: 'A smoother approach to the limit is wanted for the same number of steps. Each node has three branches: up, level and down.' },
      { name: 'Finite-difference methods', when: 'The pricing problem is written as a differential equation and solved on a grid of prices and times, which handles early exercise and gives values for many starting prices at once.' },
      { name: 'Least-squares Monte Carlo', when: 'The option can be exercised early and depends on several prices, where a tree is too large. The method of Longstaff and Schwartz estimates the value of holding from the simulated paths.' },
    ],
    comparison: {
      columns: ['', 'Binomial tree', 'Black-Scholes formula', 'Monte Carlo simulation'],
      rows: [
        ['Early exercise', 'One comparison per node', 'Not handled', 'Only with added machinery'],
        ['Work', 'About n²/2 nodes for n steps', 'One formula', 'm paths of n steps'],
        ['Error against the model\'s exact value', 'About 1/n, zigzagging', 'None', 'About 1/√m, random'],
        ['Payoffs on many prices', 'Impractical', 'Not handled', 'Handled well'],
        ['Can be checked by hand', 'Yes, for a few steps', 'With a table of the bell curve', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Options that can be exercised early', status: 'established', text: 'No formula like Black-Scholes exists for an American put, so a numerical method is needed. The binomial tree is the standard first method taught and used for American-style options, because early exercise is a single comparison at each node.' },
    { title: 'Employee share options in company accounts', status: 'established', text: 'Companies that pay staff partly in share options must report an estimate of what those options are worth. The United States accounting standard on share-based payment, FASB Statement 123 as revised in 2004, names lattice models such as the binomial tree as an acceptable technique, since a tree can represent rules such as waiting periods and early exercise.' },
    { title: 'Trees of interest rates', status: 'established', text: 'The same construction is applied to interest rates in place of share prices. The Ho-Lee model of 1986 and the Black-Derman-Toy model of 1990 build recombining trees of future interest rates that agree with today\'s bond prices, and value bond options by stepping backwards through them.' },
    { title: 'Flexibility in business decisions', status: 'illustrative', text: 'A company that can delay a project, expand it or abandon it holds something like an option. Small trees are used to illustrate what that flexibility might be worth. The inputs are far harder to pin down than for a traded share, so the result is a way of organising an argument and not a measurement.' },
  ],

  connections: [
    { to: 'fibonacci-dp', type: 'prerequisite', why: 'Fibonacci by dynamic programming and the binomial tree both avoid exponential work by solving each shared subproblem once. In the tree, 2ⁿ price paths pass through only (n + 1)(n + 2)/2 nodes, and each node is valued a single time.' },
    { to: 'knapsack', type: 'related', why: 'The knapsack table and the American option tree make the same kind of choice in every cell: take the better of two alternatives, one of which is read from cells already filled. Knapsack chooses between taking and skipping an item, the tree between exercising and holding.' },
    { to: 'monte-carlo', type: 'same-problem', why: 'Monte Carlo estimation and the binomial tree both compute an expected payoff over uncertain price paths. The tree enumerates a simplified set of paths exactly, and Monte Carlo samples from the full set at random.' },
    { to: 'bellman-ford', type: 'related', why: 'Bellman-Ford and the binomial tree both apply Bellman\'s principle: the best value from a state is built from the best values of the states it leads to. The tree does it in a single backward sweep because its nodes are already ordered by time.' },
    { to: 'minimax', type: 'related', why: 'Minimax and the binomial tree both value a tree of future positions from the leaves back to the root. Minimax takes the best move at each node, while the binomial tree averages over the two price moves and, for an American option, also takes the better of exercising and holding.' },
    { to: 'q-learning', type: 'related', why: 'Valuing an American option is a small decision problem under uncertainty: at each node compare stopping with the expected value of carrying on. The binomial tree solves it exactly from a known model, and Q-learning estimates values of the same kind from experience when no model is given.' },
    { to: 'concept:dynamic-programming', type: 'prerequisite', why: 'The value at each node is computed once from the stored values of the two nodes after it, which is dynamic programming on a tree that rejoins.' },
    { to: 'concept:expectation', type: 'prerequisite', why: 'Each backward step is an expected value: the two later values weighted by p and 1 − p, then discounted.' },
    { to: 'concept:optimal-substructure', type: 'prerequisite', why: 'The best policy for an American option from a node onward does not depend on how the price reached that node, so the value at a node can be built from the values at the nodes after it.' },
    { to: 'concept:overlapping-subproblems', type: 'related', why: 'Up then down and down then up reach the same node. Those shared nodes are the overlapping subproblems that make the tree cheap.' },
    { to: 'concept:discretization', type: 'related', why: 'The tree replaces a price that moves continuously with one that moves in fixed steps. Finer steps bring its answer closer to that of the continuous model.' },
    { to: 'concept:convergence', type: 'advanced', why: 'As the number of steps grows, the tree\'s price approaches the Black-Scholes value, with an error that shrinks roughly like one over the number of steps.' },
    { to: 'discipline:optimization', type: 'application', why: 'Deciding when to exercise is an optimal stopping problem, and the backward comparison of exercising with holding is its solution by dynamic programming.' },
    { to: 'discipline:algorithms', type: 'application', why: 'The method is a standard example of how merging equivalent states turns an exponential enumeration into a quadratic table.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'The calculation never uses the real chance that the share price will rise. Why is it not needed?',
      options: ['Because the chance is always one half', 'Because the option\'s payoffs can be copied with a mix of shares and cash, and the cost of that mix does not depend on the chance', 'Because the volatility already contains it', 'Because the model assumes prices only go up'],
      answer: 1,
      explain: [
        'The method does not assume one half or any other value for the real chance. Its weight p comes from the sizes of the moves and the interest rate.',
        'A mix of shares and cash that ends up worth the same as the option in both branches must cost the same as the option today. That cost uses today\'s share price, the two possible moves and the interest rate, and nothing else.',
        'Volatility says how wide the swings are. It says nothing about which direction is more likely.',
        'Every node has an up-move and a down-move.',
      ],
    },
    {
      type: 'predict',
      q: 'The default American put shows three nodes where exercising early beats holding. Set the interest rate to 0 and leave everything else alone. How many nodes show early exercise now?',
      options: ['Three, as before', 'More than three', 'One', 'None'],
      answer: 3,
      explain: [
        'The interest rate is the reason those nodes preferred exercising. Take it away and the reason goes with it.',
        'A lower interest rate makes early exercise less attractive, not more.',
        'Not even one. With no interest, holding is never worth less than exercising.',
        'Exercising a put early brings in the strike sooner, and that helps only if cash earns interest. At a rate of 0 the American and European puts are both worth 7.49 on this tree.',
      ],
      tryInput: { kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 0, years: 1, steps: 4, up: 0 },
    },
    {
      type: 'debug',
      q: 'This function keeps one array and overwrites it column by column. On the two-step tree worked by hand (share at 60, doubles or halves, no interest, call with strike 60) it returns 33.33 where the answer is 20. What is wrong?',
      code: `def price(values, p, growth, steps):
    # values holds the payoffs at expiry, lowest price first
    for i in range(steps - 1, -1, -1):
        for j in range(i, -1, -1):
            values[j] = (p * values[j + 1] + (1 - p) * values[j]) / growth
    return values[0]`,
      options: ['p should be 0.5', 'The inner loop runs j downward, so values[j + 1] has already been replaced by this column\'s value when it is read; j must run upward', 'The result should be multiplied by growth, not divided', 'The outer loop should start at steps'],
      answer: 1,
      explain: [
        'For this tree p is one third, and the function receives it as an argument. The fault is in the loop.',
        'Entry j needs the old entries j and j + 1, which belong to the later column. Running j downward overwrites entry j + 1 first. Running j upward, each read still sees the later column. Here the faulty order gives 60 and 20 for the first step and then 33.33 for today.',
        'Dividing by the growth of cash is right: it brings a later amount back to an earlier time.',
        'The values at step number steps are the payoffs already in the array. The first column to compute is steps − 1.',
      ],
    },
    {
      type: 'choice',
      q: 'On a share that pays no dividend, with a positive interest rate, the American put is worth more than the European put, but the American call is worth exactly the same as the European call. Why the difference?',
      options: ['Calls cannot be exercised early', 'Exercising a put early brings in cash sooner, which earns interest; exercising a call early pays cash out sooner, which loses interest', 'Puts are riskier than calls', 'The tree handles calls less accurately'],
      answer: 1,
      explain: [
        'An American call can be exercised at any time. It is just never the better choice here.',
        'The put\'s owner receives the strike on exercising, so sooner is better when cash earns interest. The call\'s owner pays the strike, so later is better, and holding also keeps the protection against a fall.',
        'Riskiness is not what separates them. The direction of the cash payment is.',
        'The tree treats both the same way. The equality for calls holds in the model itself, not as an accident of the tree.',
      ],
    },
    {
      type: 'choice',
      q: 'A tree is built with long steps, a low volatility and a high interest rate, and p comes out as 1.27. What does that mean?',
      options: ['The share is certain to rise', 'The steps are too long: cash grows by more than the up-move in one step, the weights are not probabilities, and the result cannot be trusted', 'The option is very valuable', 'Nothing: p is only a label'],
      answer: 1,
      explain: [
        'p is not a forecast even when it lies between 0 and 1. Above 1 it is not a probability of anything.',
        'p exceeds 1 exactly when the growth of cash in one step exceeds the up-move. The weight on the down-move is then negative, and values can come out negative too. More steps shorten each step and bring p back between 0 and 1.',
        'p says nothing about how valuable the option is.',
        'The whole argument for the price rests on blending with weights between 0 and 1. Outside that range the blend is not an average of anything.',
      ],
    },
    {
      type: 'challenge',
      title: 'Smooth the zigzag',
      prompt: 'Using the code on this page, price the European put (share 100, strike 100, 5% interest, 20% volatility, one year) for every number of steps from 10 to 200 and plot the error against the Black-Scholes value 5.5735. You should see two interleaved curves, one for even and one for odd numbers of steps. Now plot the average of the prices for n and n + 1 steps. How much smaller is its error at n = 100? Then move the strike to 110 and look again: the pattern of the zigzag changes, because the strike no longer sits on a node.',
      hints: ['For this option the error at n steps is close to −2/n for even n and close to +1.75/n for odd n, so averaging two neighbours cancels most of it.', 'When the strike is not on a node, how far it lies from the nearest node changes with n, and the error wanders instead of alternating neatly.'],
    },
  ],

  compare: {
    idea: 'Build a tree of possible prices, value the option at the end, and work backwards node by node with weights fixed by the interest rate.',
    requires: 'Today\'s price, the fixed price and last day written into the option, an interest rate, and a number for how much the price tends to swing. That last number has to be estimated, and the answer depends heavily on it.',
    sensitivity: 'Very sensitive to the volatility input. The price also zigzags as the number of steps changes, by an amount that shrinks like 1/n.',
    memory: 'O(n) for the price alone, O(n²) to keep every node.',
    difficulty: 'moderate',
    difficultyNote: 'The loop is a dozen lines. Seeing why its weights are not real probabilities takes longer.',
    limits: 'It gives a value inside a simplified model: steady swings, no sudden jumps, no trading costs and, on this page, no dividends. Real markets break each of these, so the number is a reference point for study, not a prediction and not advice.',
    useWhen: 'You want to understand or compute what an option is worth in the standard textbook model, especially one that may be used before its last day.',
  },

  advanced: {
    history: 'Fischer Black and Myron Scholes published their option pricing formula in 1973, and Robert Merton published a broader treatment the same year. The mathematics involved, stochastic calculus and a partial differential equation, was out of reach of most students and practitioners. In 1979 John Cox, Stephen Ross and Mark Rubinstein published the binomial model, crediting William Sharpe with suggesting the discrete-time approach. It reaches the same price with nothing beyond algebra, shows the copying argument at every node, and handles early exercise, which the formula does not. Richard Rendleman and Brit Bartter published a similar two-state model in the same year. Cox, Ross and Rubinstein also showed that the tree\'s price converges to the Black-Scholes value as the number of steps grows. Scholes and Merton received the Nobel memorial prize in economics in 1997. Black had died in 1995.',
    derivation: 'One step. Let the share be at $S$, moving to $Su$ or $Sd$, and let cash grow by the factor $g = e^{r\\Delta t}$. Let the option be worth $V_u$ or $V_d$ after the step. Choose $\\Delta$ shares and $B$ in cash so that the mix matches the option in both outcomes:\n\n$$\\Delta S u + B g = V_u, \\qquad \\Delta S d + B g = V_d.$$\n\nSolving,\n\n$$\\Delta = \\frac{V_u - V_d}{S(u - d)}, \\qquad B = \\frac{u V_d - d V_u}{g\\,(u - d)}.$$\n\nThe cost of the mix today is\n\n$$V = \\Delta S + B = \\frac{1}{g}\\left[\\frac{g - d}{u - d}\\,V_u + \\frac{u - g}{u - d}\\,V_d\\right] = \\frac{p\\,V_u + (1 - p)\\,V_d}{g}, \\qquad p = \\frac{g - d}{u - d}.$$\n\nThe real probability of an up-move appears nowhere. The weights satisfy $p\\,u + (1-p)\\,d = g$: under them the share earns the risk-free rate on average, which is why $p$ is called risk-neutral.\n\nThe choice $u = e^{\\sigma\\sqrt{\\Delta t}}$, $d = 1/u$ gives the logarithm of the price a variance close to $\\sigma^2 \\Delta t$ per step, so that over many steps the price at expiry approaches the lognormal distribution assumed by Black and Scholes.',
    proof: 'Three facts the tests of this lesson check.\n\n**The weights are probabilities exactly when there is no free profit.** $0 < p < 1$ is the same as $d < g < u$. If $g \\ge u$, cash beats the share in both branches, and selling the share to hold cash is a riskless profit. If $g \\le d$, the share beats cash in both branches. The model only makes sense between the two.\n\n**Put-call parity holds on the tree exactly.** Let $C$ and $P$ be European call and put values with the same strike $K$, at a node with $m$ steps to expiry. Claim: $C - P = S - K g^{-m}$. At expiry ($m = 0$), $\\max(S - K, 0) - \\max(K - S, 0) = S - K$. If the claim holds one step later, then\n\n$$C - P = \\frac{p\\,(Su - K g^{-(m-1)}) + (1-p)\\,(Sd - K g^{-(m-1)})}{g} = \\frac{S\\,(pu + (1-p)d)}{g} - K g^{-m} = S - K g^{-m},$$\n\nusing $pu + (1-p)d = g$.\n\n**An American option is worth at least its European counterpart.** At expiry they are equal. If $V^A \\ge V^E$ at both later nodes and $0 < p < 1$, the American holding value is at least the European one, and the American value, being the larger of holding and exercising, is at least that. For a call with $r \\ge 0$ the two are equal: parity gives $C \\ge S - K g^{-m} \\ge S - K$, so holding is never worth less than exercising.',
    complexityProof: 'Column $i$ has $i + 1$ nodes, so the tree has $\\sum_{i=0}^{n}(i+1) = (n+1)(n+2)/2$ nodes. Each is valued once with a constant number of operations, giving $\\Theta(n^2)$ time. A column depends only on the column after it, so $n + 1$ stored values suffice. A tree without recombination would have $2^i$ nodes in column $i$ and $2^{n+1} - 1$ in total.',
    variants: [
      { name: 'Equal-probability tree', text: 'Fixes both weights at one half and adjusts the up and down factors to match, an alternative associated with Jarrow and Rudd. It has the same limit.' },
      { name: 'Trinomial tree', text: 'Three branches per node: up, level and down. It approaches the limit more smoothly and is closely related to finite-difference methods.' },
      { name: 'Trees centred on the strike', text: 'Choose the parameters so that the strike sits in a fixed position relative to the nodes, which removes most of the zigzag. The Leisen-Reimer tree is the best-known example.' },
      { name: 'Dividends', text: 'A continuous dividend yield changes the growth factor used in p. A dividend of a fixed amount on a known date shifts the tree at that date.' },
      { name: 'Implied trees', text: 'Let the up and down moves vary from node to node, chosen so that the tree reproduces the market prices of many traded options at once.' },
      { name: 'Averaging and extrapolation', text: 'Average the prices for n and n + 1 steps, or combine trees of different sizes, to cancel the leading part of the error.' },
    ],
    implementation: 'Use one array and update it from the lowest price upward, so that each read still sees the later column. Compute the node prices by repeated multiplication instead of calling a power function at every node. Work in fractions of a year and fractions for rates, and convert percentages at the edge of the program. Check that p lies strictly between 0 and 1 before trusting anything. For early exercise, leave a small tolerance in the comparison so that rounding does not turn a tie into a decision, as this page does.',
    benchmarking: 'Check a European price against the Black-Scholes formula and check that put-call parity holds to rounding error. Check an American price against a much finer tree. Report errors at both an odd and an even number of steps, since one can be flattering.',
    references: [
      { authors: 'J. C. Cox, S. A. Ross and M. Rubinstein', year: 1979, title: 'Option pricing: a simplified approach', venue: 'Journal of Financial Economics 7(3), 229-263' },
      { authors: 'F. Black and M. Scholes', year: 1973, title: 'The pricing of options and corporate liabilities', venue: 'Journal of Political Economy 81(3), 637-654' },
      { authors: 'R. C. Merton', year: 1973, title: 'Theory of rational option pricing', venue: 'Bell Journal of Economics and Management Science 4(1), 141-183' },
      { authors: 'R. J. Rendleman and B. J. Bartter', year: 1979, title: 'Two-state option pricing', venue: 'Journal of Finance 34(5), 1093-1110' },
    ],
    furtherReading: [
      'J. C. Hull, *Options, Futures, and Other Derivatives* (Pearson), the chapters on binomial trees.',
      'S. E. Shreve, *Stochastic Calculus for Finance I: The Binomial Asset Pricing Model* (Springer, 2004).',
      'F. A. Longstaff and E. S. Schwartz, "Valuing American options by simulation: a simple least-squares approach", *Review of Financial Studies* 14(1), 2001.',
    ],
  },

  tests: [
    { name: 'the tree worked by hand: share 60 that doubles or halves, no interest, call at 60 is worth 20', input: { kind: 'call', style: 'european', spot: 60, strike: 60, rate: 0, years: 1, steps: 2, up: 2 },
      check: (r, c) => {
        const near = (a, b) => Math.abs(a - b) < 1e-9;
        if (!(near(r.p, 1 / 3) && r.up === 2 && r.down === 0.5 && r.growth === 1)) return `p ${r.p}, u ${r.up}, d ${r.down}`;
        if (r.prices.map((col) => col.join(',')).join(' | ') !== '60 | 30,120 | 15,60,240') return `prices ${JSON.stringify(r.prices)}`;
        const want = [[20], [0, 60], [0, 0, 180]];
        for (let i = 0; i <= 2; i++) for (let j = 0; j <= i; j++) if (!near(r.values[i][j], want[i][j])) return `value at step ${i}, ${j} up-moves is ${r.values[i][j]}, by hand ${want[i][j]}`;
        // The copy: two thirds of a share and a loan of 20 matches the option after one step.
        const shares = (r.values[1][1] - r.values[1][0]) / (r.prices[1][1] - r.prices[1][0]), cash = r.values[1][0] - shares * r.prices[1][0];
        if (!(near(shares, 2 / 3) && near(cash, -20) && near(shares * 60 + cash, 20))) return `copy uses ${shares} shares and ${cash} cash`;
        const put = price({ kind: 'put', style: 'european', spot: 60, strike: 60, rate: 0, steps: 2, up: 2 });
        return (near(r.value, 20) && near(put.value, 20) && c['nodes valued'] === 6) || `call ${r.value}, put ${put.value}, ${c['nodes valued']} nodes`;
      } },
    { name: 'put-call parity for European options: call − put = share − strike × e^(−rT), to rounding error, on trees of every size', input: { kind: 'put', style: 'european', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 },
      check: () => {
        for (const [spot, strike, vol, rate, years] of [[100, 100, 20, 5, 1], [90, 110, 35, 3, 2], [150, 100, 60, 10, 0.5], [40, 45, 15, 0, 3], [100, 80, 25, 8, 0.25]]) {
          for (const steps of [1, 2, 3, 7, 50, 301]) {
            const o = { spot, strike, vol, rate, years, steps, style: 'european' };
            const call = price({ ...o, kind: 'call' }).value, put = price({ ...o, kind: 'put' }).value;
            const want = spot - strike * Math.exp(-rate / 100 * years);
            if (Math.abs(call - put - want) > 1e-9 * strike) return `share ${spot}, strike ${strike}, ${steps} steps: call − put = ${call - put}, expected ${want}`;
          }
        }
        return true;
      } },
    { name: 'an American option is worth at least its European counterpart at every size, and an American call equals the European call', input: { kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 },
      check: (r) => {
        if (!(r.value > r.european && r.values.every((col, i) => col.every((v, j) => v >= Math.max(100 - r.prices[i][j], 0) - 1e-12)))) return 'an American put value fell below its exercise value';
        let strictly = 0;
        for (const [spot, strike, vol, rate, years] of [[100, 100, 20, 5, 1], [90, 110, 35, 3, 2], [150, 100, 60, 10, 0.5], [40, 45, 15, 0, 3], [100, 120, 25, 8, 0.25]]) {
          for (const steps of [1, 2, 5, 40, 200]) {
            for (const kind of ['put', 'call']) {
              const o = { spot, strike, vol, rate, years, steps, kind };
              const am = price({ ...o, style: 'american' }), eu = price({ ...o, style: 'european' });
              if (!am.valid) return `p left the range 0 to 1 for ${JSON.stringify(o)}`;
              if (am.value < eu.value - 1e-9) return `American ${am.value} below European ${eu.value} for ${JSON.stringify(o)}`;
              if (kind === 'call' && (Math.abs(am.value - eu.value) > 1e-9 || am.exercisedAt.length)) return `American call differs from European for ${JSON.stringify(o)}`;
              if (kind === 'put' && rate === 0 && (Math.abs(am.value - eu.value) > 1e-9 || am.exercisedAt.length)) return `with no interest the American put should equal the European one: ${JSON.stringify(o)}`;
              if (kind === 'put' && am.value > eu.value + 1e-6) strictly++;
            }
          }
        }
        return strictly >= 15 || `the American put was strictly dearer in only ${strictly} cases`;
      } },
    { name: 'the price approaches the Black-Scholes value: within 0.005 at 1,000 steps, and ten times the steps leaves about a tenth of the gap', input: { kind: 'put', style: 'european', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 },
      check: (r) => {
        const bsPut = blackScholes('put', 100, 100, 0.05, 0.2, 1), bsCall = blackScholes('call', 100, 100, 0.05, 0.2, 1);
        // The formula itself, pinned to the widely quoted values for these inputs.
        if (bsPut.toFixed(4) !== '5.5735' || bsCall.toFixed(4) !== '10.4506' || Math.abs(normalCdf(1.96) - 0.9750021) > 1e-6 || Math.abs(r.formula - bsPut) > 1e-12) return `Black-Scholes gave ${bsPut} and ${bsCall}`;
        const gap = (steps, kind, o = {}) => price({ kind, style: 'european', steps, ...o }).value - (o.strike ? blackScholes(kind, 100, o.strike, 0.05, 0.2, 1) : kind === 'put' ? bsPut : bsCall);
        const g100 = gap(100, 'put'), g1000 = gap(1000, 'put'), c1000 = gap(1000, 'call'), odd = gap(1001, 'put');
        if (!(Math.abs(g1000) < 0.005 && Math.abs(c1000) < 0.005 && Math.abs(gap(1000, 'put', { strike: 110 })) < 0.005 && Math.abs(gap(1000, 'call', { strike: 90 })) < 0.005)) return `gaps at 1,000 steps: put ${g1000}, call ${c1000}`;
        const ratio = g100 / g1000;
        // The challenge hint: the gap is close to −2/n for even n and +1.75/n for odd n.
        if (!(Math.abs(g100 * 100 + 2) < 0.05 && Math.abs(g1000 * 1000 + 2) < 0.05 && Math.abs(gap(101, 'put') * 101 - 1.75) < 0.05 && Math.abs(odd * 1001 - 1.75) < 0.05)) return `gap × n: ${g100 * 100}, ${g1000 * 1000}, ${odd * 1001}`;
        if (!(ratio > 8 && ratio < 12)) return `gap at 100 steps is ${ratio.toFixed(2)} times the gap at 1,000, expected about 10`;
        // The zigzag: even and odd step counts err on opposite sides, and the 4-step tree is far coarser.
        return (g1000 < 0 && odd > 0 && Math.abs(r.value - bsPut) > 0.4 && Math.abs(r.fine - bsPut) < 0.01) || `zigzag ${g1000}, ${odd}; 4 steps ${r.value}; 500 steps ${r.fine}`;
      } },
    { name: 'default American put: 5.88 today, early exercise at three nodes, 24.68 to hold against 25.92 to exercise at 74.08', input: { kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 },
      check: (r, c) => {
        const eu = price({ style: 'european' });
        const holdAt30 = (r.p * r.values[4][1] + (1 - r.p) * r.values[4][0]) / r.growth;
        const ok = money(r.value) === '5.88' && money(r.european) === '5.09' && money(r.value - r.european) === '0.79' && Math.abs(eu.value - r.european) < 1e-12
          && r.exercisedAt.map((x) => x.join(',')).sort().join(' ') === '2,0 3,0 3,1' && money(r.prices[3][0]) === '74.08' && money(holdAt30) === '24.68' && money(r.values[3][0]) === '25.92'
          && Math.abs(r.values[3][0] - (100 - r.prices[3][0])) < 1e-12 && f4(r.p) === '0.5378' && money(r.fine) === '6.09' && c['nodes valued'] === 15 && r.nodes === 15;
        // The sentence about sensitivity to the volatility input: 6.09 becomes 7.97 at 25%.
        const wider = price({ vol: 25, steps: FINE }).value;
        if (!(money(wider) === '7.97' && Math.round(100 * (wider / r.fine - 1)) === 31 && wider - r.fine > 5 * Math.abs(r.value - r.fine))) return `at 25% volatility the 500-step value is ${wider}`;
        return ok || `value ${r.value}, European ${r.european}, exercise at ${JSON.stringify(r.exercisedAt)}, hold ${holdAt30}`;
      } },
    { name: 'tryThis: the European put values the 74.08 node at 24.68, below its exercise value; steps 3, 4, 5 give 6.50, 5.88, 6.37', input: { kind: 'put', style: 'european', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 },
      check: (r) => {
        const zig = [3, 4, 5].map((steps) => money(price({ steps }).value)).join(' ');
        return (money(r.value) === '5.09' && money(r.values[3][0]) === '24.68' && r.values[3][0] < 100 - r.prices[3][0] && r.exercisedAt.length === 0 && zig === '6.50 5.88 6.37') || `European ${r.value}, node ${r.values[3][0]}, steps 3 to 5: ${zig}`;
      } },
    { name: 'quiz: with no interest no node prefers early exercise, and both puts are worth 7.49', input: { kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 0, years: 1, steps: 4, up: 0 },
      check: (r) => (r.exercisedAt.length === 0 && money(r.value) === '7.49' && Math.abs(r.value - r.european) < 1e-9 && r.growth === 1) || `exercise at ${JSON.stringify(r.exercisedAt)}, value ${r.value}, European ${r.european}` },
    { name: 'quiz: the in-place update in the wrong direction turns the hand-worked 20 into 33.33', input: { kind: 'call', style: 'european', spot: 60, strike: 60, rate: 0, years: 1, steps: 2, up: 2 },
      check: (r) => {
        const sweep = (downward) => {
          const values = [0, 0, 180];
          for (let i = 1; i >= 0; i--) {
            if (downward) for (let j = i; j >= 0; j--) values[j] = (r.p * values[j + 1] + (1 - r.p) * values[j]) / r.growth;
            else for (let j = 0; j <= i; j++) values[j] = (r.p * values[j + 1] + (1 - r.p) * values[j]) / r.growth;
          }
          return values[0];
        };
        return (sweep(true).toFixed(2) === '33.33' && Math.abs(sweep(false) - 20) < 1e-9) || `downward ${sweep(true)}, upward ${sweep(false)}`;
      } },
    { name: 'a tree too coarse for its inputs: p = 1.27, a node worth −4.95, the tree says 1.13 where 500 steps say 0.10', input: { kind: 'put', style: 'european', spot: 100, strike: 100, vol: 10, rate: 12, years: 3, steps: 2, up: 0 },
      check: (r) => {
        const ok = !r.valid && money(r.p) === '1.27' && r.growth > r.up && money(r.values[1][0]) === '−4.95' && money(r.value) === '1.13' && r.fineValid && money(r.fine) === '0.10'
          && Math.abs(r.fine - blackScholes('put', 100, 100, 0.12, 0.10, 3)) < 0.005;
        return ok || `p ${r.p}, node ${r.values[1][0]}, value ${r.value}, fine ${r.fine}`;
      } },
    { name: 'the picture and the count-only run give the same price, there are (n + 1)(n + 2)/2 nodes, and one step is a single blend', input: { kind: 'put', style: 'american', spot: 100, strike: 105, vol: 30, rate: 4, years: 2, steps: 6, up: 0 },
      check: (r, c) => {
        const quiet = price({ strike: 105, vol: 30, rate: 4, years: 2, steps: 6 });
        if (quiet.value !== r.value || c['nodes valued'] !== 28 || quiet.exercisedAt.length !== r.exercisedAt.length) return `picture ${r.value}, count-only ${quiet.value}`;
        const one = price({ kind: 'call', style: 'european', steps: 1 });
        const byHand = one.p * Math.max(100 * one.up - 100, 0) / one.growth;
        return Math.abs(one.value - byHand) < 1e-12 || `one step gave ${one.value}, by hand ${byHand}`;
      } },
    { name: 'code sample: the values printed for 4 and 256 steps', input: { kind: 'put', style: 'american', spot: 100, strike: 100, vol: 20, rate: 5, years: 1, steps: 4, up: 0 },
      check: (r) => {
        const row = (steps) => [price({ style: 'european', steps }).value, price({ steps }).value, price({ kind: 'call', style: 'european', steps }).value].map((v) => v.toFixed(4)).join(' ');
        return (row(4) === '5.0935 5.8828 9.9705' && row(256) === '5.5657 6.0873 10.4428' && row(1) === '7.2852 7.2852 12.1623') || `4 steps: ${row(4)}; 256 steps: ${row(256)}`;
      } },
  ],
};
