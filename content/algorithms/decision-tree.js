import { makeDataset, datasetOptions, datasetById, CLASS_ROLES, DATA_RANGE } from '../../js/lib/datasets.js';
import { layoutTree } from '../../js/lib/graphs.js';

const FRESH_POINTS = 400;   // new points from the same source, used only to test the finished tree
const EPS = 1e-12;          // two scores closer than this count as a tie
const FEATURES = ['x', 'y'];
const trim = (v, d) => {
  const s = v.toFixed(d);
  return Number(s) === 0 ? (0).toFixed(d) : s;
};
const f3 = (v) => trim(v, 3);
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const num = (v) => String(Math.round(v * 1e4) / 1e4).replace('-', '−');
const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

function resolvePoints(input) {
  if (Array.isArray(input.custom) && input.custom.length) {
    const c = input.custom;
    if (c.length % 3 !== 0 || c.length < 6) throw new Error('Type your own points as x, y, class triples (class 0 or 1), with at least two points.');
    const pts = [];
    for (let i = 0; i < c.length; i += 3) {
      if (c[i + 2] !== 0 && c[i + 2] !== 1) throw new Error('The third number of every triple is the class and must be 0 or 1.');
      pts.push({ x: c[i], y: c[i + 1], label: c[i + 2] });
    }
    // Frame the chart around the typed points. The two features may be in different units.
    const frame = (vals) => {
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const pad = hi > lo ? (hi - lo) * 0.12 : 0.5;
      return [lo - pad, hi + pad];
    };
    return { pts, xRange: frame(pts.map((p) => p.x)), yRange: frame(pts.map((p) => p.y)), fresh: null, custom: true };
  }
  const pts = makeDataset({ dataset: input.dataset, points: input.points, seed: input.seed }).points;
  const fresh = makeDataset({ dataset: input.dataset, points: FRESH_POINTS, seed: input.seed + 1000 }).points;
  return { pts, xRange: DATA_RANGE, yRange: DATA_RANGE, fresh, custom: false };
}

// Gini impurity of a group holding c0 points of class 0 and c1 of class 1.
const gini = (c0, c1) => {
  const m = c0 + c1;
  return m === 0 ? 0 : 1 - (c0 / m) * (c0 / m) - (c1 / m) * (c1 / m);
};
// The score of a split: the Gini of each side, weighted by the share of the points on that side.
const weighted = (left, right) => {
  const ml = left[0] + left[1], mr = right[0] + right[1];
  return (ml * gini(left[0], left[1]) + mr * gini(right[0], right[1])) / (ml + mr);
};

// Every split of the points `idx` on one feature, found with one sorted sweep. The points
// are sorted by the feature and moved from the right side to the left one at a time, so
// the class counts of both sides are known at each threshold without recounting.
function scanFeature(pts, idx, f, onSplit) {
  const key = FEATURES[f];
  const order = idx.slice().sort((a, b) => pts[a][key] - pts[b][key] || a - b);
  const total = [0, 0];
  for (const i of order) total[pts[i].label]++;
  const left = [0, 0];
  const found = [];
  for (let k = 0; k < order.length - 1; k++) {
    left[pts[order[k]].label]++;
    const a = pts[order[k]][key], b = pts[order[k + 1]][key];
    if (a === b) continue; // no threshold fits between two equal values
    let threshold = (a + b) / 2;
    if (!(threshold < b)) threshold = a;
    const right = [total[0] - left[0], total[1] - left[1]];
    const split = { feature: f, threshold, left: left.slice(), right, score: weighted(left, right) };
    found.push(split);
    onSplit(split, found);
  }
  return found;
}

function run(input, t) {
  const { pts, xRange, yRange, fresh, custom } = resolvePoints(input);
  const n = pts.length;
  const limit = input.depth;
  const limitText = Number.isFinite(limit) ? `the limit of ${limit}` : 'no limit';
  const detailed = n <= 12; // small enough to show every single split being scored

  let nextId = 1;
  const nodes = [];
  const makeNode = (idx, depth, box, parent, side) => {
    const counts = [0, 0];
    for (const i of idx) counts[pts[i].label]++;
    const node = { id: nextId++, idx, depth, box, parent, side, counts, gini: gini(counts[0], counts[1]), majority: counts[1] > counts[0] ? 1 : 0,
      state: 'pending', reason: null, feature: null, threshold: null, score: null, left: null, right: null };
    nodes.push(node);
    return node;
  };
  const root = makeNode(pts.map((_, i) => i), 0, { x0: xRange[0], x1: xRange[1], y0: yRange[0], y1: yRange[1] }, null, null);
  const splits = [];
  const ask = (node) => `${FEATURES[node.feature]} ≤ ${num(node.threshold)}`;
  const tally = (c) => `${c[0]} of class 0 and ${c[1]} of class 1`;
  const giniSum = (c) => { const m = c[0] + c[1]; return `1 − (${c[0]}/${m})² − (${c[1]}/${m})² = ${f3(gini(c[0], c[1]))}`; };
  const wrongIn = (node) => Math.min(node.counts[0], node.counts[1]);

  // ---- pictures ----
  const sceneView = ({ current = null, split = null, errors = false, showFresh = false } = {}) => {
    const layers = [];
    for (const nd of nodes) {
      if (nd.state === 'split') continue;
      const purity = Math.max(nd.counts[0], nd.counts[1]) / nd.idx.length; // 0.5 (even mix) to 1 (pure)
      layers.push({ type: 'rect', x: nd.box.x0, y: nd.box.y0, w: nd.box.x1 - nd.box.x0, h: nd.box.y1 - nd.box.y0, role: CLASS_ROLES[nd.majority], fillAlpha: 0.04 + 0.44 * (purity - 0.5) });
    }
    const made = nodes.filter((nd) => nd.state === 'split').map((nd) => (nd.feature === 0 ? [nd.threshold, nd.box.y0, nd.threshold, nd.box.y1] : [nd.box.x0, nd.threshold, nd.box.x1, nd.threshold]));
    if (made.length) layers.push({ type: 'segments', segments: made, role: 'ink', width: 1.6 });
    if (showFresh) for (const c of [0, 1]) layers.push({ type: 'points', points: fresh.filter((p) => p.label === c).map((p) => [p.x, p.y]), role: CLASS_ROLES[c], r: 1.8, alpha: 0.5 });
    if (current) {
      const b = current.box;
      layers.push({ type: 'line', points: [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], closed: true, role: 'compare', width: 2.5 });
      if (split) layers.push({ type: 'segments', segments: [split.feature === 0 ? [split.threshold, b.y0, split.threshold, b.y1] : [b.x0, split.threshold, b.x1, split.threshold]], role: 'compare', width: 2.2, dash: [7, 5] });
    }
    const inside = current ? new Set(current.idx) : null;
    for (const c of [0, 1]) {
      const dimmed = [], shown = [];
      pts.forEach((p, i) => { if (p.label === c) (inside && !inside.has(i) ? dimmed : shown).push([p.x, p.y]); });
      if (dimmed.length) layers.push({ type: 'points', points: dimmed, role: CLASS_ROLES[c], r: 3.4, alpha: 0.3 });
      if (shown.length) layers.push({ type: 'points', points: shown, role: CLASS_ROLES[c], r: 4 });
    }
    if (errors) {
      const wrong = [];
      for (const nd of nodes) if (nd.state === 'leaf') for (const i of nd.idx) if (pts[i].label !== nd.majority) wrong.push([pts[i].x, pts[i].y]);
      if (wrong.length) layers.push({ type: 'points', points: wrong, role: 'alert', hollow: true, r: 8 });
    }
    const legend = [{ label: 'class 0', role: CLASS_ROLES[0] }, { label: 'class 1', role: CLASS_ROLES[1] }, { label: 'shading: the class a box predicts, stronger where the box is purer', role: 'muted' },
      { label: 'split already made', role: 'ink' }, { label: 'group and split being examined', role: 'compare' }];
    if (errors) legend.push({ label: 'training point the tree gets wrong', role: 'alert' });
    if (showFresh) legend.push({ label: 'small dots: fresh points the tree never saw', role: 'muted' });
    return { kind: 'scene', title: 'Training points and the boxes the tree has made', x: xRange, y: yRange, aspect: 0.7, equal: !custom, axes: { xLabel: 'x (feature 1)', yLabel: 'y (feature 2)' }, layers, legend };
  };

  const treeView = (current = null) => {
    const pos = layoutTree(root, (nd) => (nd.left ? [nd.left, nd.right] : []));
    const crowded = nodes.length > 15;
    const levels = Math.max(...nodes.map((nd) => nd.depth)) + 1; // a taller picture for a deeper tree, so that levels do not overlap
    return { kind: 'graph', title: 'The tree so far: at each question, yes goes left and no goes right', directed: false, aspect: Math.min(1, Math.max(0.36, 0.09 * levels + 0.05)),
      nodes: nodes.map((nd) => {
        const p = pos.get(nd);
        const label = nd.state === 'split' ? ask(nd) : nd.state === 'leaf' ? (crowded ? String(nd.majority) : `class ${nd.majority}`) : '?';
        return { id: nd.id, x: p.x, y: p.y, label, sub: `${nd.counts[0]} | ${nd.counts[1]}`, role: nd === current ? 'frontier' : nd.state === 'leaf' ? CLASS_ROLES[nd.majority] : nd.state === 'split' ? 'ink' : 'default' };
      }),
      edges: nodes.filter((nd) => nd.left).flatMap((nd) => [{ u: nd.id, v: nd.left.id }, { u: nd.id, v: nd.right.id }]),
      legend: [{ label: 'question', role: 'ink' }, { label: 'leaf predicting class 0', role: CLASS_ROLES[0] }, { label: 'leaf predicting class 1', role: CLASS_ROLES[1] }, { label: 'being examined', role: 'frontier' },
        { label: 'under each node: its class 0 | class 1 points', role: 'muted' }] };
  };

  const scoreChart = (node, f, found, best) => {
    const range = f === 0 ? xRange : yRange;
    const layers = [{ type: 'segments', segments: [[range[0], node.gini, range[1], node.gini]], role: 'muted', width: 1.2, dash: [5, 4] }];
    if (found.length > 1) layers.push({ type: 'line', points: found.map((s) => [s.threshold, s.score]), role: 'compare', width: 1.2 });
    if (found.length) layers.push({ type: 'points', points: found.map((s) => [s.threshold, s.score]), role: 'compare', r: 3 });
    if (best && best.feature === f) layers.push({ type: 'points', points: [[best.threshold, best.score]], role: 'ink', r: 5.5, hollow: true });
    return { kind: 'scene', title: `Score of every split on ${FEATURES[f]} at node ${node.id} (weighted Gini: lower is better)`, x: range, y: [0, 0.56], aspect: 0.2, axes: { xLabel: `threshold on ${FEATURES[f]}`, yLabel: 'score' }, layers,
      legend: [{ label: 'one split', role: 'compare' }, { label: 'lowest score', role: 'ink' }, { label: "the group's own Gini, before any split", role: 'muted' }] };
  };

  // ---- the algorithm ----
  t.frame(() => ({ line: 0,
    note: `${n} training points${custom ? ' that you typed' : ` from the "${datasetById[input.dataset].label}" set`}, each labelled class 0 or class 1: ${tally(root.counts)}. A decision tree divides the chart into boxes with straight splits, one feature at a time, trying to end with a single class in each box. How mixed a group is gets measured by its **Gini impurity**: the chance that two points picked from it at random carry different labels. It is 0 for a group of one class and 0.5 for an even mix. For all ${n} points it is ${giniSum(root.counts)}.`,
    views: [sceneView(), treeView()], vars: { points: n, 'depth limit': Number.isFinite(limit) ? limit : 'none', Gini: f3(root.gini) } }));

  const makeLeaf = (node, reason) => {
    node.state = 'leaf';
    node.reason = reason;
    const m = node.idx.length, wrong = wrongIn(node);
    const tie = node.counts[0] === node.counts[1];
    const verdict = tie ? `The two classes are tied, and this page gives a tie to class 0, so ${plural(wrong, 'training point')} here will be labelled wrongly.`
      : `It becomes a leaf that predicts the majority, class ${node.majority}, and so labels its ${plural(wrong, 'minority point')} wrongly.`;
    let note;
    if (reason === 'pure') note = `**Node ${node.id}** holds ${m === 1 ? `a single point, of class ${node.majority}` : `${m} points, all of class ${node.majority}`}, so its Gini is 0. There is nothing left to separate, and it becomes a **leaf**: any point that lands in this box is predicted class ${node.majority}.`;
    else if (reason === 'depth') note = `**Node ${node.id}** holds ${tally(node.counts)}, Gini ${f3(node.gini)}. It is still mixed, but it sits ${plural(node.depth, 'question')} below the top, which is the depth limit, so no further split is allowed. ${verdict}`;
    else note = `**Node ${node.id}** holds ${tally(node.counts)}, but ${m === 2 ? 'both' : `all ${m}`} points sit at exactly the same position. No threshold on x or on y can put identical points on different sides, so this group cannot be divided. ${verdict}`;
    t.frame(() => ({ line: [1, 2], note, views: [sceneView({ current: node, errors: true }), treeView(node)], vars: { node: node.id, depth: node.depth, 'class 0': node.counts[0], 'class 1': node.counts[1], predicts: `class ${node.majority}` } }));
  };

  const grow = (node) => {
    const m = node.idx.length;
    if (node.counts[0] === 0 || node.counts[1] === 0) return makeLeaf(node, 'pure');
    if (node.depth >= limit) return makeLeaf(node, 'depth');

    t.frame(() => ({ line: [1, 3],
      note: `**Node ${node.id}**, the box outlined in ochre, holds ${tally(node.counts)}. Its Gini is ${giniSum(node.counts)}. The group is mixed and it is ${node.depth === 0 ? 'at the top of the tree' : `${plural(node.depth, 'question')} below the top`}, short of ${limitText}, so look for the split that leaves the two sides least mixed.`,
      views: [sceneView({ current: node }), treeView(node)], vars: { node: node.id, depth: node.depth, 'class 0': node.counts[0], 'class 1': node.counts[1], Gini: f3(node.gini) } }));

    let best = null, tried = 0, tiedWith = null;
    const bestOf = [null, null];
    for (let f = 0; f < 2; f++) {
      const key = FEATURES[f];
      const found = scanFeature(pts, node.idx, f, (split, soFar) => {
        t.count('splits scored');
        tried++;
        const before = best;
        const better = !best || split.score < best.score - EPS;
        if (!better && Math.abs(split.score - best.score) <= EPS && !tiedWith) tiedWith = split;
        if (better) { best = split; tiedWith = null; }
        if (!bestOf[f] || split.score < bestOf[f].score - EPS) bestOf[f] = split;
        if (detailed) {
          const shown = soFar.slice(), bestHere = bestOf[f];
          t.frame(() => {
            const ml = split.left[0] + split.left[1], mr = split.right[0] + split.right[1];
            const verdict = !before ? 'It is the first split tried, so it is the best so far.'
              : better ? `That beats the best so far, ${f3(before.score)}, so this split takes the lead.`
                : Math.abs(split.score - before.score) <= EPS ? `That only ties the best so far, ${FEATURES[before.feature]} ≤ ${num(before.threshold)}, and a tie keeps the earlier split.`
                  : `That does not beat the best so far, ${f3(before.score)} for ${FEATURES[before.feature]} ≤ ${num(before.threshold)}.`;
            return { line: [4, 5],
              note: `Try **${key} ≤ ${num(split.threshold)}**. The left side gets ${tally(split.left)} (Gini ${f3(gini(split.left[0], split.left[1]))}), the right side ${tally(split.right)} (Gini ${f3(gini(split.right[0], split.right[1]))}). Each side counts in proportion to its size, so the score is (${ml}/${m}) × ${f3(gini(split.left[0], split.left[1]))} + (${mr}/${m}) × ${f3(gini(split.right[0], split.right[1]))} = **${f3(split.score)}**. ${verdict}`,
              views: [sceneView({ current: node, split }), treeView(node), scoreChart(node, f, shown, bestHere)],
              vars: { node: node.id, split: `${key} ≤ ${num(split.threshold)}`, score: f3(split.score), 'best so far': f3((better ? split : before).score) } };
          });
        }
      });
      if (!detailed) {
        const top = bestOf[f];
        t.frame(() => ({ line: [3, 4, 5],
          note: found.length === 0
            ? `Feature ${f + 1} (${key}): all ${m} points in this group have the same ${key}, so no threshold on ${key} can divide them. Nothing to score.`
            : `Feature ${f + 1} (${key}): sort the ${m} points by ${key} and put a threshold halfway between each pair of neighbouring values. That gives ${plural(found.length, 'possible split')}. Each is scored by the Gini of its two sides, with each side counting in proportion to its size. The lowest score on ${key} is **${f3(top.score)}** for **${key} ≤ ${num(top.threshold)}**, which puts ${tally(top.left)} on the left (Gini ${f3(gini(top.left[0], top.left[1]))}) and ${tally(top.right)} on the right (Gini ${f3(gini(top.right[0], top.right[1]))}). The chart shows the score of every split on ${key}.`,
          views: [sceneView({ current: node, split: top }), treeView(node), scoreChart(node, f, found, top)],
          vars: { node: node.id, feature: key, 'splits on this feature': found.length, 'best score': top ? f3(top.score) : 'none' } }));
      }
    }
    if (!best) return makeLeaf(node, 'same');

    node.state = 'split';
    node.feature = best.feature;
    node.threshold = best.threshold;
    node.score = best.score;
    const key = FEATURES[best.feature];
    const goesLeft = (i) => pts[i][key] <= best.threshold;
    const b = node.box;
    const boxL = best.feature === 0 ? { ...b, x1: best.threshold } : { ...b, y1: best.threshold };
    const boxR = best.feature === 0 ? { ...b, x0: best.threshold } : { ...b, y0: best.threshold };
    node.left = makeNode(node.idx.filter(goesLeft), node.depth + 1, boxL, node, 'yes');
    node.right = makeNode(node.idx.filter((i) => !goesLeft(i)), node.depth + 1, boxR, node, 'no');
    const noGain = node.gini - best.score <= EPS;
    const record = { node: node.id, depth: node.depth, indices: node.idx.slice(), feature: best.feature, threshold: best.threshold, score: best.score, parentGini: node.gini,
      left: best.left.slice(), right: best.right.slice(), bestOf: bestOf.map((s) => (s ? { threshold: s.threshold, score: s.score } : null)), tried, tie: !!tiedWith, noGain };
    splits.push(record);
    const other = bestOf[1 - best.feature];
    t.frame(() => {
      let why;
      if (noGain) why = `No split lowers the impurity at all: the best score, ${f3(best.score)}, equals the group's own Gini. The tree splits anyway, because a split that gains nothing now can still set up a useful split one level down.`;
      else why = `That takes the impurity of this group from ${f3(node.gini)} down to ${f3(best.score)}, and no other single split leaves less, which is the whole reason for choosing it. The choice is **greedy**: it looks one step ahead and is never revisited.`;
      const rival = !other ? `No split on ${FEATURES[1 - best.feature]} was possible.` : `The best split on ${FEATURES[1 - best.feature]} scored ${f3(other.score)}.`;
      const tieNote = tiedWith ? ` Another split, ${FEATURES[tiedWith.feature]} ≤ ${num(tiedWith.threshold)}, reached the same score. A tie goes to the split that was tried first: x before y, then the lower threshold.` : '';
      return { line: [6, 7, 8],
        note: `Of the ${plural(tried, 'split')} scored at node ${node.id}, the lowest score is **${f3(best.score)}** for **${key} ≤ ${num(best.threshold)}**. ${rival}${tieNote} ${why} Points with ${key} ≤ ${num(best.threshold)} go left to node ${node.left.id} (${tally(node.left.counts)}), the rest go right to node ${node.right.id} (${tally(node.right.counts)}).`,
        views: [sceneView({ current: node }), treeView(node), scoreChart(node, best.feature, scanFeature(pts, node.idx, best.feature, () => {}), best)],
        vars: { node: node.id, question: `${key} ≤ ${num(best.threshold)}`, 'Gini before': f3(node.gini), 'score after': f3(best.score) } };
    });
    grow(node.left);
    grow(node.right);
  };
  grow(root);

  // ---- what was built, and how well it predicts ----
  const leaves = nodes.filter((nd) => nd.state === 'leaf');
  const depth = Math.max(...leaves.map((nd) => nd.depth));
  const predict = (p, maxDepth = Infinity) => {
    let nd = root;
    while (nd.state === 'split' && nd.depth < maxDepth) nd = (nd.feature === 0 ? p.x : p.y) <= nd.threshold ? nd.left : nd.right;
    return nd.majority;
  };
  const score = (set, maxDepth) => set.reduce((s, p) => s + (predict(p, maxDepth) === p.label ? 1 : 0), 0);
  const correct = score(pts);
  const accuracy = correct / n;
  const pure = leaves.every((nd) => nd.reason === 'pure');
  const byDepth = [];
  for (let d = 0; d <= depth; d++) byDepth.push({ depth: d, train: score(pts, d) / n, fresh: fresh ? score(fresh, d) / fresh.length : null });
  const freshCorrect = fresh ? score(fresh) : null;
  const freshAccuracy = fresh ? freshCorrect / fresh.length : null;

  const ruleOf = (leaf) => {
    const parts = [];
    for (let nd = leaf; nd.parent; nd = nd.parent) parts.unshift(`${FEATURES[nd.parent.feature]} ${nd.side === 'yes' ? '≤' : '>'} ${num(nd.parent.threshold)}`);
    return `${parts.length ? `if ${parts.join(' and ')}, ` : ''}predict class ${leaf.majority} (${leaf.idx.length === 1 ? 'right for the one training point in that box' : `right for ${leaf.counts[leaf.majority]} of the ${leaf.idx.length} training points in that box`})`;
  };
  t.frame(() => {
    const size = `The tree is finished: ${plural(splits.length, 'question')} and ${leaves.length} ${leaves.length === 1 ? 'leaf' : 'leaves'}, with the deepest leaf ${plural(depth, 'question')} below the top.`;
    const fit = pure
      ? `Every leaf holds a single class, so the tree labels all ${n} training points correctly: **${pct(accuracy)}**. That shows it can reproduce the points it was built from. It says nothing yet about points it has not seen.`
      : `It labels ${correct} of the ${n} training points correctly: **${pct(accuracy)}**. The ${plural(n - correct, 'point')} ringed in brick ${n - correct === 1 ? 'sits in a leaf that predicts' : 'sit in leaves that predict'} the other class.`;
    const rules = leaves.length <= 4 ? ` Read from the top, the tree is ${leaves.length === 1 ? 'one rule' : `${leaves.length} rules`}: ${leaves.map(ruleOf).join('; ')}.` : ' Each leaf can be read as a rule: follow the answers from the top question down to it.';
    return { line: 9, note: `${size} ${fit}${rules}`, views: [sceneView({ errors: true }), treeView()], vars: { questions: splits.length, leaves: leaves.length, depth, 'training accuracy': pct(accuracy) } };
  });

  if (fresh) {
    const bestFresh = byDepth.reduce((a, b) => (b.fresh > a.fresh + EPS ? b : a));
    t.frame(() => {
      const chart = { kind: 'scene', title: 'Accuracy of this tree cut off at each depth', x: [-0.2, Math.max(depth, 1) + 0.2], y: [0.4, 1.04], aspect: 0.24, axes: { xLabel: 'depth (questions asked before the tree must answer)', yLabel: 'accuracy' },
        layers: [
          { type: 'line', points: byDepth.map((r) => [r.depth, r.train]), role: 'ink', width: 2 },
          { type: 'points', points: byDepth.map((r) => [r.depth, r.train]), role: 'ink', r: 3.5 },
          { type: 'line', points: byDepth.map((r) => [r.depth, r.fresh]), role: 'compare', width: 2 },
          { type: 'points', points: byDepth.map((r) => [r.depth, r.fresh]), role: 'compare', r: 3.5 },
        ],
        legend: [{ label: 'on the training points', role: 'ink' }, { label: `on ${FRESH_POINTS} fresh points`, role: 'compare' }] };
      const gap = accuracy - freshAccuracy;
      let verdict;
      if (bestFresh.depth < depth && bestFresh.fresh > freshAccuracy + EPS) verdict = `Accuracy on the training points can only rise with depth, because splitting a box never adds to the minority points inside it. Accuracy on fresh points does not have to follow: it was highest at depth ${bestFresh.depth} (${pct(bestFresh.fresh)}) and the deeper splits brought it down to ${pct(freshAccuracy)}. Those deeper splits fitted accidents of these ${n} points that the fresh points do not share. That is **overfitting**.`;
      else verdict = `Accuracy on the training points can only rise with depth, because splitting a box never adds to the minority points inside it. On this data the fresh points kept up: their accuracy at the full depth of ${depth} is as high as at any shallower depth.${gap > 0.05 ? ` The gap of ${(100 * gap).toFixed(1)} points between the two scores is still the amount by which the training score flatters the tree.` : ''}`;
      return { line: null,
        note: `Now the honest test. ${FRESH_POINTS} new points from the same source, none of them used to build the tree, are dropped into its boxes (the small dots). The tree labels ${freshCorrect} of them correctly: **${pct(freshAccuracy)}**, against ${pct(accuracy)} on its own training points. ${verdict}`,
        views: [sceneView({ showFresh: true }), treeView(), chart], vars: { 'training accuracy': pct(accuracy), 'fresh accuracy': pct(freshAccuracy), 'best depth on fresh points': bestFresh.depth } };
    });
  }

  const plain = (nd) => (nd.state === 'split'
    ? { id: nd.id, depth: nd.depth, counts: nd.counts.slice(), majority: nd.majority, feature: nd.feature, threshold: nd.threshold, score: nd.score, left: plain(nd.left), right: plain(nd.right) }
    : { id: nd.id, depth: nd.depth, counts: nd.counts.slice(), majority: nd.majority, leaf: true, reason: nd.reason });
  return { accuracy, correct, n, freshAccuracy, freshCorrect, freshN: fresh ? fresh.length : 0, depth, limit, leaves: leaves.length, questions: splits.length, pure, splits, byDepth, tree: plain(root),
    predictions: pts.map((p) => predict(p)), rootGini: root.gini, points: pts };
}


// ---- independent references for the tests ----

// A tracer that records nothing, for tests that need extra runs to compare against.
const SILENT = { count() {}, frame() {} };
const DEFAULTS = { dataset: 'overlap', points: 40, seed: 3, depth: 3, custom: [] };
const quiet = (input) => run({ ...DEFAULTS, ...input }, SILENT);

// The lowest score any threshold on either feature can reach for the points `idx`, found the
// slow way: every point's own coordinate is tried as a threshold and both sides are counted
// again from scratch. It shares no code with the sorted sweep in scanFeature.
function bruteForceBest(pts, idx) {
  let best = Infinity;
  for (const key of ['x', 'y']) {
    for (const i of idx) {
      const cut = pts[i][key];
      let l0 = 0, l1 = 0, r0 = 0, r1 = 0;
      for (const j of idx) {
        if (pts[j][key] <= cut) { if (pts[j].label === 1) l1++; else l0++; } else if (pts[j].label === 1) r1++; else r0++;
      }
      const ml = l0 + l1, mr = r0 + r1;
      if (ml === 0 || mr === 0) continue;
      const impurity = (a, b) => (2 * a * b) / ((a + b) * (a + b)); // Gini of two classes, written as 2p(1 − p)
      best = Math.min(best, (ml * impurity(l0, l1) + mr * impurity(r0, r1)) / (ml + mr));
    }
  }
  return best;
}

function splitsAreBest(r) {
  for (const s of r.splits) {
    const key = s.feature === 0 ? 'x' : 'y';
    const left = [0, 0], right = [0, 0];
    for (const i of s.indices) (r.points[i][key] <= s.threshold ? left : right)[r.points[i].label]++;
    if (left.join() !== s.left.join() || right.join() !== s.right.join()) return `node ${s.node}: recorded sides ${s.left} / ${s.right}, recounted ${left} / ${right}`;
    if (left[0] + left[1] === 0 || right[0] + right[1] === 0) return `node ${s.node}: a split left one side empty`;
    const reference = bruteForceBest(r.points, s.indices);
    if (Math.abs(reference - s.score) > 1e-9) return `node ${s.node}: chose score ${s.score}, but brute force over every threshold finds ${reference}`;
    if (s.score > s.parentGini + 1e-12) return `node ${s.node}: the split raised the impurity from ${s.parentGini} to ${s.score}`;
  }
  return true;
}

// Follow a point down the plain tree in the result, independently of run's own predict.
function walk(tree, p) {
  let node = tree;
  while (!node.leaf) node = (node.feature === 0 ? p.x : p.y) <= node.threshold ? node.left : node.right;
  return node;
}
const hasConflict = (pts) => pts.some((p, i) => pts.some((q, j) => j > i && p.x === q.x && p.y === q.y && p.label !== q.label));
function fitsPerfectly(r) {
  if (hasConflict(r.points)) return 'this test needs data with no two identical points carrying different labels';
  for (const p of r.points) { const leaf = walk(r.tree, p); if (leaf.majority !== p.label) return `the point (${p.x}, ${p.y}) of class ${p.label} lands in a leaf predicting class ${leaf.majority}`; }
  if (!r.pure || r.accuracy !== 1) return `pure ${r.pure}, training accuracy ${r.accuracy}`;
  return true;
}

const EXAMPLE = [5, 2, 1, 4, 6, 1, 3, 4, 1, 1, 1, 1, 0, 3, 0, 1, 5, 0, 2, 7, 0, 0, 8, 0];
const XOR4 = [0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1];

export default {
  meta: {
    id: 'decision-tree',
    name: 'Decision Tree Learning',
    aliases: ['decision tree', 'decision trees', 'classification tree', 'CART', 'classification and regression trees', 'ID3', 'C4.5', 'recursive partitioning', 'tree induction'],
    kind: 'algorithm',
    discipline: 'machine-learning',
    alsoIn: [
      { id: 'statistics', why: 'Statisticians developed tree methods under the name recursive partitioning, as a way to model data without assuming a formula for how the outcome depends on the measurements.' },
      { id: 'ai', why: 'A learned tree is a set of if-then rules, which made tree induction a practical way to get rules from examples in place of writing them by hand.' },
    ],
    subfield: 'Supervised learning',
    family: 'Tree-based methods',
    lab: 'machine-learning',
    summary: 'Learns a tree of yes-or-no questions from labelled examples by repeatedly choosing the split that leaves the two sides least mixed, then predicts by following the answers.',
    difficulty: 'intermediate',
    order: 635,
    paradigms: ['greedy', 'divide-and-conquer'],
    randomized: false,
    approximate: true,
    time: { best: 'O(d·n log n) for one split', average: 'O(d·n log² n) for a balanced tree', worst: 'O(d·n² log n) when every split removes one point', class: 'linearithmic' },
    space: { worst: 'O(n) for the points plus one record per question', class: 'linear' },
    tags: {
      problems: ['which customers are likely to leave', 'explain why a prediction was made', 'turn past cases into if-then rules', 'classify a new example', 'find which measurements separate two outcomes', 'decide who qualifies from past decisions'],
      techniques: ['recursive partitioning', 'Gini impurity', 'information gain', 'greedy splitting', 'depth limit', 'pruning'],
      applications: ['machine learning', 'statistics', 'finance', 'data processing', 'image processing'],
    },
    prerequisites: ['concept:supervised-learning', 'concept:feature-space', 'concept:greedy', 'concept:tree'],
  },

  bigIdea: {
    simple: "A decision tree is a list of yes-or-no questions, asked in order, that ends in a prediction. Think of a phone company that wants to know which customers are about to leave. It has records of past customers: how long each had been with the company, how often each rang to complain, and whether they left. The computer looks for the single question that best sorts those records into leavers and stayers. Perhaps it is: did they complain more than twice? No question sorts perfectly, so each of the two groups gets a question of its own, and so on. Drawn on paper, the questions branch like an upside-down tree. To predict for a new customer, start at the top and follow the answers down. The path also tells you why, because the reasons are the answers along the way. There is one trap. Keep adding questions and the tree ends up memorizing the old customers, quirks and all. Then it predicts new customers worse, not better.",
    when: "Use a decision tree when the reasons matter as much as the prediction, when the measurements come in different kinds and units, or when you want a quick look at which measurements separate two outcomes. Choose something else when the border between the classes is a slanted straight line, which [logistic regression](#/algorithm/logistic-regression) states with one weight per measurement. Choose something else, too, when small changes in the data must not change the answer, or when accuracy is all that counts and nobody needs to read the model. In that last case many trees voting together usually beat one.",
    interesting: "The rule that grows the tree never looks more than one question ahead and never changes a question once it is chosen. That short-sighted rule can still fit a set of examples exactly, noise included, which is the method's strength and its weakness at once. Choosing the questions turns out to be the easy part. The hard part is deciding when to stop asking.",
    analogy: {
      title: "The key at the front of a field guide",
      text: "Many field guides open with a key. Are the leaves needles or flat? If needles, do they grow in bundles? Each answer sends you to another question until you arrive at a name. A decision tree is a key of exactly that kind, with one difference: nobody wrote it. The computer built it from a pile of specimens that were already named, by choosing at each step the question that separated them best.",
      limits: "A botanist writes a key from an understanding of plants, and it holds for every specimen of the species. A learned tree knows only the specimens it was shown, and a different pile could give a different key. The botanist can plan the whole key at once, while the tree is built one question at a time by a simple score that never looks ahead. The questions are also narrower than a botanist's: each asks whether one number is above or below a value. Finally, a key ends in a certain name. A leaf of a learned tree ends in a majority, and some of the specimens that reached it may have been something else.",
    },
  },

  example: {
    setup: "A phone company has records of eight past customers. For each it knows how many times the customer rang the help line in their last month, how many years they had been a customer, and whether they left. Four left: (5 calls, 2 years), (4, 6), (3, 4) and (1, 1). Four stayed: (0, 3), (1, 5), (2, 7) and (0, 8). To score how mixed a group is, multiply the fraction who left by the fraction who stayed, and double it. A group that is all one kind scores 0. An even mix scores 0.5, which is the highest a group can score. In the demonstration on this page, calls are x, years are y, and leaving is class 1.",
    steps: [
      "All eight together: half left and half stayed. The score is 2 × 1/2 × 1/2 = 0.5, as mixed as a group can be.",
      "Try the question \"at most 2 calls?\". Five customers say yes: four stayed and one left, which scores 2 × 1/5 × 4/5 = 0.32. Three say no, and all three left, which scores 0. Count each side by its share of the customers: 5/8 × 0.32 + 3/8 × 0 = 0.2.",
      "Score every other question the same way. There are four more about calls and seven about years. None comes in below 0.2. The best question about years is \"at most 2 years?\", which scores 0.333. So the first question is the one about calls.",
      "The three customers with more than 2 calls all left, so that side is finished. The five with at most 2 calls are still mixed, so they get a question of their own. \"At most 2 years?\" separates them completely: the one who says yes left, and the four who say no stayed. The score is 0.",
      "Every group now holds a single kind, so there is nothing left to ask.",
    ],
    result: "The finished tree asks two questions at most. More than 2 calls: predict that the customer leaves. Otherwise, at most 2 years with the company: predict that the customer leaves. Otherwise: predict that the customer stays. It is right about all eight customers it was built from, and it gives its reasons in words anyone can check. What it does not give is any promise about a ninth customer. Eight records are very few, and the whole second question rests on one person.",
    tryInput: { custom: EXAMPLE, depth: 3 },
  },

  terms: [
    { term: "Feature", meaning: "One measured number describing an example, such as a count of calls. On this page there are two, called x and y, and each is one axis of the chart." },
    { term: "Class", meaning: "The answer attached to an example, such as left or stayed. Here the two classes are called class 0 and class 1." },
    { term: "Training points", meaning: "The examples whose class is already known, which the tree is built from." },
    { term: "Split", meaning: "A yes-or-no question about one feature, of the form: is x at most this value? It divides a group of points in two." },
    { term: "Threshold", meaning: "The value a split compares against. Points at or below it go one way, and points above it go the other." },
    { term: "Gini impurity", meaning: "A score for how mixed a group is: the chance that two points picked from it at random are of different classes. It is 0 for a group of one class and 0.5 for an even mix of two." },
    { term: "Node", meaning: "One place in the tree. It holds a group of training points and either asks a question about them or gives a prediction." },
    { term: "Leaf", meaning: "A node that asks nothing more. It predicts the class that most of its training points have." },
    { term: "Depth", meaning: "How many questions lie between the top of the tree and a node. The depth limit is the most questions the tree may ask in a row." },
    { term: "Greedy", meaning: "Taking the choice that looks best right now, without checking where it leads later and without ever taking it back." },
    { term: "Overfitting", meaning: "Fitting the accidents of the training points so closely that predictions on new points get worse." },
    { term: "Fresh points", meaning: "Examples from the same source that were kept away while the tree was built, so that they give a fair test of it." },
  ],

  takeaway: "Keep asking the yes-or-no question that best separates the examples, stop before the questions start describing accidents, and read each prediction and its reasons off the path.",

  viz: {
    describe: 'A scatter plot of training points, green for class 0 and terracotta for class 1. The tree divides the plot into boxes with straight splits parallel to the axes. Each box is shaded in the colour of the class it predicts, more strongly the purer it is. An ochre outline marks the group being examined and a dashed ochre line marks the split being scored, while splits already made are ink lines. Below the plot the tree itself is drawn: questions in ink, leaves in the colour of the class they predict, and under every node the number of class 0 and class 1 points it holds. While a group is searched, a small chart plots the score of every possible split on one feature against its threshold, with a dashed line at the impurity of the group before splitting. In the last frame brick rings mark the training points the tree gets wrong, small dots show fresh points, and a chart compares accuracy on training points and on fresh points at every depth.',
    inputs: [
      { id: 'dataset', type: 'select', label: 'Dataset', options: datasetOptions, default: 'overlap' },
      { id: 'points', type: 'range', label: 'Training points', min: 10, max: 80, step: 2, default: 40 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 3 },
      { id: 'depth', type: 'range', label: 'Depth limit', min: 1, max: 16, step: 1, default: 3,
        help: 'The most questions the tree may ask in a row. At 16 the trees here nearly always grow until every leaf holds one class, and the last step says whether this one did.' },
      { id: 'custom', type: 'list', label: 'Or type your own training points', default: [], maxLength: 120, min: -1000, max: 1000, placeholder: 'e.g. 5, 2, 1, 0, 3, 0, 1, 5, 0',
        help: 'Read as x, y, class triples, with class 0 or 1. Leave empty to use the generated dataset.' },
    ],
    presets: [
      { label: 'Overlapping groups, three questions deep', values: { dataset: 'overlap', points: 40, seed: 3, depth: 3, custom: [] } },
      { label: 'One question only', values: { dataset: 'overlap', points: 40, seed: 3, depth: 1, custom: [] } },
      { label: 'Fully grown: every training point right', values: { dataset: 'overlap', points: 40, seed: 3, depth: 16, custom: [] } },
      { label: 'Moons: a curve built from steps', values: { dataset: 'moons', points: 40, seed: 1, depth: 16, custom: [] } },
      { label: 'XOR corners: the first split looks useless', values: { dataset: 'xor', points: 40, seed: 3, depth: 16, custom: [] } },
      { label: 'Worked example: eight customers', values: { custom: EXAMPLE, depth: 3 } },
    ],
    tryThis: [
      { ask: 'Run the default and stop at the first step that says "Feature 1 (x)". The small chart shows the score of every threshold on x for all 40 points, and the lowest point of that curve is the split drawn as a dashed line on the plot. Before you step on to the same search on y: will the best split on y beat the best split on x?',
        reveal: 'No. The best split on x is x ≤ 0.186 with a score of 0.212. The best on y is y ≤ 0.018 with a score of 0.245. The two are close because these groups differ along both axes, but the lower score wins, so the first question is about x. All 76 thresholds were scored to find it.' },
      { ask: 'Go to the last frame of the default and write down its two accuracies, on the training points and on the fresh points. Now load "Fully grown: every training point right". The training score can only go up. Which way will the score on the 400 fresh points go, and by roughly how much?',
        reveal: 'Down. The default gets 39 of 40 training points and 349 of 400 fresh points. The fully grown tree needs only one more level of questions to get 40 of 40, and on the fresh points it drops to 331 of 400. Look at the plot to see why: the new boxes are small and each is drawn around one or two points.' },
      { ask: 'Load "One question only". A tree this small is called a decision stump. Knowing that it gets only one question, will it choose a different split from the first split of the deeper default tree?',
        reveal: 'No. It asks x ≤ 0.186, the same first question as every deeper tree on this data, and gets 35 of 40 training points and 324 of 400 fresh points. The split is chosen by its score alone, without regard to how many questions may follow, and a greedy choice is never revisited.' },
      { ask: 'Load "XOR corners: the first split looks useless" and stop at node 1. All 40 points together score 0.500. How far below 0.500 will the best single split get, and how many levels of questions will the tree need before the fresh points score clearly better than a coin toss?',
        reveal: 'The best split, y ≤ 0.763, scores 0.459, and the best on x scores 0.461. The curve hardly dips below the dashed line, because no single question separates opposite corners. The tree takes the best of a poor lot. After one question it gets 193 of 400 fresh points and after two it gets 194, both slightly worse than guessing. The reward shows at the third level (266) and the fourth (347). Compare that accuracy chart with the one from the overlapping groups.' },
      { ask: 'Load "Moons: a curve built from steps". The true border is curved and the tree can only split parallel to the axes, so it builds a staircase six questions deep. On the overlapping groups the deepest questions hurt the fresh points. Will they hurt here too?',
        reveal: 'No. The fully grown tree gets 383 of 400 fresh points, its best score at any depth. Stopped at depth 2 it would get 357. More depth is not always overfitting. It depends on whether the detail being fitted is real, and here the curve is real.' },
    ],
    run,
    report: (r, c) => `${r.questions} question${r.questions === 1 ? '' : 's'}, ${r.leaves} ${r.leaves === 1 ? 'leaf' : 'leaves'}, deepest leaf ${r.depth} below the top${Number.isFinite(r.limit) ? ` (limit ${r.limit})` : ''}. ${r.pure ? 'Every leaf holds a single class.' : 'Some leaves are still mixed.'}\nTraining accuracy: ${pct(r.accuracy)} (${r.correct} of ${r.n}).${r.freshN ? `\nAccuracy on ${r.freshN} fresh points from the same source: ${pct(r.freshAccuracy)} (${r.freshCorrect} of ${r.freshN}).` : ''}\n${c['splits scored'] || 0} splits scored.`,
    experiment: {
      title: 'Splits scored as the training set grows',
      note: 'Each point is a real run on n points from the overlapping dataset, counting every split whose score was computed. A tree limited to one question scores one split for each gap between neighbouring values, on each of the two features, so it scores at most 2(n − 1). It falls a little short because the generated coordinates are rounded to three decimals and some coincide. A fully grown tree repeats the search in every group it creates. The n log₂ n curve is drawn only to give a sense of scale and is not a claim about this data. Sorting, which is the larger part of the running time, is not counted here.',
      metric: 'splits scored',
      metricLabel: 'Splits scored',
      sizeLabel: 'Training points (n)',
      sizes: [25, 50, 100, 200, 400],
      variants: [
        { id: 'stump', label: 'One question (depth limit 1)' },
        { id: 'full', label: 'Fully grown' },
      ],
      input: (n, variant, seed) => ({ dataset: 'overlap', points: n, seed, depth: variant === 'stump' ? 1 : Infinity, custom: [] }),
      theory: [
        { label: '2(n − 1), one split per gap on each feature', fn: (n) => 2 * (n - 1), variant: 'stump' },
        { label: 'n log₂ n, for scale', fn: (n) => n * Math.log2(n), variant: 'full', reference: true },
      ],
    },
  },

  logic: {
    intuition: "A good question is one whose answer tells you a lot about the class. Before the question the group is a mixture. After a good question each side is closer to being all one class. Gini impurity turns \"how mixed\" into a number, so that every possible question can be scored and the best one taken. Once a group has been divided, each half is just a smaller group with the same problem, so the same procedure is applied to it. That is why growing a tree is naturally recursive: grow a tree for a group by choosing one split, then growing a tree for each side.",
    steps: [
      "Start with all the training points in one group, at the top of the tree.",
      "If the group holds a single class, or the depth limit has been reached, make it a leaf that predicts its majority class.",
      "Otherwise, for each feature, sort the group by that feature and consider a threshold halfway between each pair of neighbouring values. Score each such split by the Gini impurity of its two sides, weighted by their sizes.",
      "Take the split with the lowest score. If two tie, keep the one tried first.",
      "Send the points at or below the threshold to one child group and the rest to the other, and repeat from the second step for each child.",
      "To predict a new point, start at the top, answer each question, and return the class of the leaf you reach.",
    ],
    pseudocode: [
      'grow(points, depth):',
      '  if pure or depth = limit:',
      '    return leaf(majority)',
      '  for each feature f:',
      '    for each threshold t:',
      '      score ← weighted Gini',
      '  f, t ← lowest score',
      '  yes ← grow(f ≤ t side)',
      '  no ← grow(f > t side)',
      '  return question(f ≤ t)',
    ],
    decisions: [
      { title: 'How should a split be scored?', text: 'This page uses Gini impurity, the measure used by CART. The other common choice is entropy, which gives the criterion called information gain. In practice the two often choose the same or similar splits. The plain error rate is a poor score for growing a tree. Take 800 points, 400 of each class. One split gives sides of 300 and 100 against 100 and 300. Another gives 200 and 400 against 200 and 0. Both leave 200 points in the minority, so the error rate cannot tell them apart. Gini scores them 0.375 and 0.333 and prefers the second, which has produced a pure side that needs no more work.' },
      { title: 'Where may a threshold go?', text: 'Any threshold between two neighbouring values sends the same training points left and right, so only one per gap needs scoring. The midpoint is the usual convention. It matters only for new points that fall inside the gap.' },
      { title: 'When should growth stop?', text: 'This page stops at a depth limit. Other common rules are a minimum number of points per leaf, or a minimum drop in impurity. The approach in CART is different: grow the tree fully, then prune it back, removing the branches that help least for their size and choosing how much to remove with data held back for the purpose.' },
      { title: 'What if no split helps?', text: 'A rule that stops when the best split brings no improvement would give up on the XOR pattern at the first step, because every single split there leaves both sides as mixed as before. This page splits whenever a threshold exists, and relies on the depth limit to stop.' },
      { title: 'What does a leaf predict?', text: 'Its majority class. This page gives a tied leaf to class 0. A leaf can also report the fraction of each class among its training points, as a rough estimate of probability.' },
    ],
    invariants: [
      'The boxes of the leaves and of the groups still waiting to be examined always cover the whole chart without overlapping, so every point, old or new, lies in exactly one of them.',
      'Every training point in a node satisfies all the answers on the path from the top of the tree to that node.',
      'A split never raises the weighted impurity of the group it divides, and never increases the number of training points the tree gets wrong.',
    ],
    edgeCases: [
      'All training points of one class: the tree is a single leaf and asks nothing.',
      'Identical points with different classes: no threshold can separate them, so they share a leaf and at least one is predicted wrongly whatever the depth.',
      'No split lowers the impurity, as in the exact XOR pattern: the tree splits anyway and the gain appears one level down.',
      'Several points sharing a value of a feature: no threshold fits between them, so there are fewer splits to score.',
      'A leaf with equal numbers of both classes: the prediction comes from the tie rule, not from the data.',
      'A feature stretched or squeezed, for example by changing its units or taking its logarithm: the thresholds change but the same points go left and right, because only the order of the values matters.',
    ],
    correctness: "Three things are guaranteed. The procedure **stops**: every split divides a group into two smaller groups, neither of them empty, so a tree on n points makes at most n − 1 splits. Each split chosen is **the best single split** of its group under the score, because every distinct way of dividing the group by a threshold on one feature is scored. And a tree grown without a depth limit **labels every training point correctly**, provided no two identical points carry different classes: a mixed group then contains two points that differ in some feature, a threshold fits between them, and so growth cannot stop while any group is mixed.\n\nTwo things are not guaranteed. The tree is not the smallest tree that fits the data. Hyafil and Rivest showed in 1976 that constructing an optimal binary decision tree, in the sense of one that needs the fewest questions on average, is NP-complete, and the greedy rule makes no attempt at it. More importantly, nothing here says the tree will be right about new points. That is a question about the data, and it is answered by testing on points the tree has not seen.",
    mistakes: [
      'Judging a tree by its accuracy on the points it was built from.',
      'Averaging the impurities of the two sides without weighting them by size, which rewards splits that slice off a single point.',
      'Stopping as soon as no split improves the score, which fails on patterns like XOR.',
      'Using "at most" when training and "less than" when predicting, so that a point sitting exactly on a threshold is sent the other way.',
      'Recounting both sides from scratch for every threshold, when one sorted sweep keeps the counts up to date.',
      'Choosing the depth by looking at the test points, then reporting the accuracy on those same points.',
      'Reading the top question as the cause of the outcome.',
    ],
  },

  code: {
    sample: {
      input: 'Grow a tree on the eight customers of the worked example (calls to the help line, years as a customer, left or stayed), print it, and use it to predict for three new customers. The third has been a customer for exactly 2 years, the value the second question compares against.',
      expected: 'all 8 customers: Gini 0.500\ncalls <= 2.5? (score 0.200)\n  yes: years <= 2.0? (score 0.000)\n    yes: predict leave (1 of 1)\n    no: predict stay (4 of 4)\n  no: predict leave (3 of 3)\ncalls 1, years 6: stay\ncalls 4, years 9: leave\ncalls 1, years 2: leave',
    },
    breakIt: [
      { change: 'In `predict`, change the comparison from "at most" to "less than": `<=` becomes `<`. Training still uses "at most". Which of the three new customers gets a different prediction?',
        find: { python: 'node = node["yes"] if p[node["f"]] <= node["t"] else node["no"]', javascript: 'node = p[node.f] <= node.t ? node.yes : node.no;' },
        replace: { python: 'node = node["yes"] if p[node["f"]] < node["t"] else node["no"]', javascript: 'node = p[node.f] < node.t ? node.yes : node.no;' },
        reveal: 'The last line changes from "calls 1, years 2: leave" to "calls 1, years 2: stay". The printed tree is the same, because training was not touched. The third customer has exactly 2 years, and the second question is "years <= 2.0?". Training put that value on the yes side. The changed `predict` sends it to the no side, into a leaf of four customers who stayed. The other two customers sit on no threshold, so they are unaffected, which is how this mistake gets through a quick test.' },
      { change: 'In the line that scores a split, replace the weighted sum by a plain average of the two sides: `(gini(yes) + gini(no)) / 2`. Will the program grow a different tree on these eight customers?',
        find: { python: 'score = (len(yes) * gini(yes) + len(no) * gini(no)) / len(group)', javascript: 'const score = (yes.length * gini(yes) + no.length * gini(no)) / group.length;' },
        replace: { python: 'score = (gini(yes) + gini(no)) / 2', javascript: 'const score = (gini(yes) + gini(no)) / 2;' },
        reveal: 'Not on these eight. The only line that changes is the first question, which now reads "calls <= 2.5? (score 0.160)" where it read 0.200. The pure side of three customers scores 0 and now counts for half the result, when it holds only three of the eight. The same split still wins, so the tree and the predictions are right by luck. To see the fault bite, also add a ninth customer `(6, 2, 0)` to the list: six calls, two years, stayed. The correct program still asks "calls <= 2.5?" first (score 0.344). The averaged one asks "years <= 1.5? (score 0.234)", a question that cuts off a single customer, and its answer for the third new customer turns from leave to stay.' },
    ],
    python: {
      source: `points = [(5, 2, 1), (4, 6, 1), (3, 4, 1), (1, 1, 1), (0, 3, 0), (1, 5, 0), (2, 7, 0), (0, 8, 0)]
features = ["calls", "years"]
outcomes = ["stay", "leave"]


def gini(group):
    share = sum(p[2] for p in group) / len(group)
    return 1.0 - share * share - (1.0 - share) * (1.0 - share)


def best_split(group):
    best = None
    for f in range(2):
        values = sorted(set(p[f] for p in group))
        for low, high in zip(values, values[1:]):
            t = (low + high) / 2
            yes = [p for p in group if p[f] <= t]
            no = [p for p in group if p[f] > t]
            score = (len(yes) * gini(yes) + len(no) * gini(no)) / len(group)
            if best is None or score < best["score"] - 1e-12:
                best = {"score": score, "f": f, "t": t, "yes": yes, "no": no}
    return best


def grow(group, depth, limit):
    leavers = sum(p[2] for p in group)
    mixed = 0 < leavers < len(group)
    split = best_split(group) if mixed and depth < limit else None
    if split is None:
        label = 1 if leavers > len(group) - leavers else 0
        return {"label": label, "agree": max(leavers, len(group) - leavers), "size": len(group)}
    split["yes"] = grow(split["yes"], depth + 1, limit)
    split["no"] = grow(split["no"], depth + 1, limit)
    return split


def show(node, indent, answer):
    if "label" in node:
        print(f"{indent}{answer}predict {outcomes[node['label']]} ({node['agree']} of {node['size']})")
        return
    print(f"{indent}{answer}{features[node['f']]} <= {node['t']:.1f}? (score {node['score']:.3f})")
    show(node["yes"], indent + "  ", "yes: ")
    show(node["no"], indent + "  ", "no: ")


def predict(node, p):
    while "label" not in node:
        node = node["yes"] if p[node["f"]] <= node["t"] else node["no"]
    return outcomes[node["label"]]


print(f"all {len(points)} customers: Gini {gini(points):.3f}")
tree = grow(points, 0, 3)
show(tree, "", "")
for p in [(1, 6), (4, 9), (1, 2)]:
    print(f"calls {p[0]}, years {p[1]}: {predict(tree, p)}")`,
      notes: [
        { line: 8, text: 'Gini impurity for two classes: one minus the squared share of each class. It is 0 when the group is all one class and 0.5 when it is an even mix.' },
        { line: 16, text: 'Thresholds go halfway between neighbouring distinct values. Any other threshold in the same gap would divide these points identically.' },
        { line: 17, text: 'For clarity this sample builds both sides again for every threshold. The demonstration on this page sorts once and updates the counts as it sweeps, which gives the same splits with less work.' },
        { line: 19, text: 'The score of a split. Each side is weighted by its size, so a pure side holding one point cannot outweigh a mixed side holding the rest.' },
        { line: 20, text: 'Keep a split only if it is clearly better than the best so far. On a tie the earlier split stays, and the small margin keeps that rule steady in floating-point arithmetic.' },
        { line: 28, text: 'The two stopping rules: a group of one class, or the depth limit. A mixed group whose points are all identical has no threshold to try, and best_split then returns None as well.' },
        { line: 48, text: 'Prediction uses the same "at most" comparison as training. If the two differed, a point exactly on a threshold would be sent to the wrong side.' },
      ],
    },
    javascript: {
      source: `const points = [[5, 2, 1], [4, 6, 1], [3, 4, 1], [1, 1, 1], [0, 3, 0], [1, 5, 0], [2, 7, 0], [0, 8, 0]];
const features = ["calls", "years"];
const outcomes = ["stay", "leave"];

function gini(group) {
  const share = group.filter((p) => p[2] === 1).length / group.length;
  return 1 - share * share - (1 - share) * (1 - share);
}

function bestSplit(group) {
  let best = null;
  for (let f = 0; f < 2; f++) {
    const values = [...new Set(group.map((p) => p[f]))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < values.length; i++) {
      const t = (values[i] + values[i + 1]) / 2;
      const yes = group.filter((p) => p[f] <= t);
      const no = group.filter((p) => p[f] > t);
      const score = (yes.length * gini(yes) + no.length * gini(no)) / group.length;
      if (best === null || score < best.score - 1e-12) best = { score, f, t, yes, no };
    }
  }
  return best;
}

function grow(group, depth, limit) {
  const leavers = group.filter((p) => p[2] === 1).length;
  const mixed = leavers > 0 && leavers < group.length;
  const split = mixed && depth < limit ? bestSplit(group) : null;
  if (split === null) {
    const label = leavers > group.length - leavers ? 1 : 0;
    return { label, agree: Math.max(leavers, group.length - leavers), size: group.length };
  }
  split.yes = grow(split.yes, depth + 1, limit);
  split.no = grow(split.no, depth + 1, limit);
  return split;
}

function show(node, indent, answer) {
  if (node.label !== undefined) {
    console.log(indent + answer + "predict " + outcomes[node.label] + " (" + node.agree + " of " + node.size + ")");
    return;
  }
  console.log(indent + answer + features[node.f] + " <= " + node.t.toFixed(1) + "? (score " + node.score.toFixed(3) + ")");
  show(node.yes, indent + "  ", "yes: ");
  show(node.no, indent + "  ", "no: ");
}

function predict(node, p) {
  while (node.label === undefined) node = p[node.f] <= node.t ? node.yes : node.no;
  return outcomes[node.label];
}

console.log("all " + points.length + " customers: Gini " + gini(points).toFixed(3));
const tree = grow(points, 0, 3);
show(tree, "", "");
for (const p of [[1, 6], [4, 9], [1, 2]]) {
  console.log("calls " + p[0] + ", years " + p[1] + ": " + predict(tree, p));
}`,
    },
    cpp: {
      source: `#include <algorithm>
#include <cstdio>
#include <iterator>
#include <set>
#include <string>
#include <vector>

struct Point { double f[2]; int label; };
typedef std::vector<Point> Group;
struct Node {  // a question when f >= 0, otherwise a leaf
    int f = -1, label = 0, agree = 0, size = 0, yes = -1, no = -1;
    double t = 0.0, score = 0.0;
    Group yesGroup, noGroup;
};

const char* features[] = {"calls", "years"};
const char* outcomes[] = {"stay", "leave"};
std::vector<Node> nodes;

int leaversIn(const Group& group) {
    int k = 0;
    for (const Point& p : group) k += p.label;
    return k;
}

double gini(const Group& group) {
    double share = (double)leaversIn(group) / group.size();
    return 1.0 - share * share - (1.0 - share) * (1.0 - share);
}

Node bestSplit(const Group& group) {
    Node best;
    for (int f = 0; f < 2; ++f) {
        std::set<double> values;
        for (const Point& p : group) values.insert(p.f[f]);
        for (auto low = values.begin(), high = std::next(low); high != values.end(); ++low, ++high) {
            double t = (*low + *high) / 2;
            Group yes, no;
            for (const Point& p : group) (p.f[f] <= t ? yes : no).push_back(p);
            double score = (yes.size() * gini(yes) + no.size() * gini(no)) / group.size();
            if (best.f < 0 || score < best.score - 1e-12) {
                best.f = f; best.t = t; best.score = score;
                best.yesGroup = yes; best.noGroup = no;
            }
        }
    }
    return best;
}

int grow(const Group& group, int depth, int limit) {
    int size = (int)group.size(), leavers = leaversIn(group);
    Node node;
    if (leavers > 0 && leavers < size && depth < limit) node = bestSplit(group);
    if (node.f < 0) {
        node.label = leavers > size - leavers ? 1 : 0;
        node.agree = std::max(leavers, size - leavers);
        node.size = size;
    } else {
        node.yes = grow(node.yesGroup, depth + 1, limit);
        node.no = grow(node.noGroup, depth + 1, limit);
    }
    nodes.push_back(node);
    return (int)nodes.size() - 1;
}

void show(int id, const std::string& indent, const std::string& answer) {
    const Node& node = nodes[id];
    if (node.f < 0) {
        std::printf("%s%spredict %s (%d of %d)\\n", indent.c_str(), answer.c_str(), outcomes[node.label], node.agree, node.size);
        return;
    }
    std::printf("%s%s%s <= %.1f? (score %.3f)\\n", indent.c_str(), answer.c_str(), features[node.f], node.t, node.score);
    show(node.yes, indent + "  ", "yes: ");
    show(node.no, indent + "  ", "no: ");
}

const char* predict(int id, const double p[2]) {
    while (nodes[id].f >= 0) id = p[nodes[id].f] <= nodes[id].t ? nodes[id].yes : nodes[id].no;
    return outcomes[nodes[id].label];
}

int main() {
    const Group points = {{{5, 2}, 1}, {{4, 6}, 1}, {{3, 4}, 1}, {{1, 1}, 1}, {{0, 3}, 0}, {{1, 5}, 0}, {{2, 7}, 0}, {{0, 8}, 0}};
    std::printf("all %d customers: Gini %.3f\\n", (int)points.size(), gini(points));
    int root = grow(points, 0, 3);
    show(root, "", "");
    const double fresh[3][2] = {{1, 6}, {4, 9}, {1, 2}};
    for (const auto& p : fresh) std::printf("calls %d, years %d: %s\\n", (int)p[0], (int)p[1], predict(root, p));
    return 0;
}`,
    },
  },

  complexity: {
    summary: "The cost of growing a tree is the cost of searching for splits. For one group and one feature, sort the points and sweep once, updating the class counts as each point crosses the threshold. A tree repeats that in every group it creates, so the total depends on the shape the tree takes: cheap when splits divide groups roughly in half, expensive when each split removes a point or two. Predicting is cheap in every case: one comparison per question on the path.",
    cases: [
      { case: 'Scoring every split of one group on one feature', time: 'O(m log m)', when: 'Sorting the m points dominates. The sweep that follows scores all the thresholds in O(m).' },
      { case: 'One node', time: 'O(d·m log m)', when: 'The search is repeated for each of the d features.' },
      { case: 'Whole tree, balanced', time: 'O(d·n log² n)', when: 'Each level of the tree holds all n points between its groups, and a tree whose splits divide groups roughly in half has about log₂ n levels.' },
      { case: 'Whole tree, worst case', time: 'O(d·n² log n)', when: 'Every split removes a single point, so the tree has n − 1 levels.' },
      { case: 'Predicting one point', time: 'O(depth)', when: 'One comparison at each question on the path from the top to a leaf.' },
      { case: 'An optimal tree', time: 'NP-complete', when: 'Constructing the binary tree that asks the fewest questions on average is NP-complete (Hyafil and Rivest, 1976). Greedy growth does not attempt it.' },
    ],
    space: 'O(n) for the training points and the lists of which points belong to which group, plus one small record per question and per leaf. A tree on n points has at most n leaves.',
    memory: 'Once grown, the tree needs only its questions and leaf labels. The training points can be thrown away, which is the opposite of k-nearest neighbours.',
    tradeoffs: 'Greedy growth is fast and simple, and the result can be read. The price is that the tree is not the best possible one, and that it is unstable: a few different training points can change an early split and with it everything below. Sorting each feature once at the start, and keeping that order as groups are divided, removes the repeated sorting and brings a balanced tree down to O(d·n log n).',
    assumptions: [
      'n is the number of training points, d the number of features (2 on this page) and m the number of points in one group.',
      'The bounds describe the implementation shown, which sorts again inside every group.',
      '"Balanced" is a description of how the splits happen to fall on the data, not something the algorithm arranges.',
      'The experiment counts splits scored, on generated data. It does not count the sorting, and it is an illustration, not a benchmark.',
      'The NP-completeness result concerns finding an optimal tree. It says nothing against the greedy procedure, which runs in polynomial time and makes no claim to be optimal.',
    ],
  },

  tradeoffs: {
    struggles: [
      'A border that runs at a slant. Each split is parallel to an axis, so a diagonal has to be approximated by a staircase of many small splits.',
      'Small training sets. The tree is unstable: remove or add a few points and an early split can move, changing every question beneath it.',
      'Outcomes that rise smoothly with a feature. A tree can only answer in steps, one constant per box.',
      'Patterns where no single feature helps alone, such as XOR. The greedy rule cannot see a gain that needs two questions to appear.',
      'Rare outcomes. If only a few customers in a hundred leave, most leaves predict staying, and the accuracy looks good while the tree is useless.',
    ],
    pitfalls: [
      'Reporting accuracy on the training points.',
      'Letting the tree grow until every leaf is pure, then trusting leaves that hold one or two points.',
      'Treating the features in the top questions as causes. If two features move together, the tree picks one and ignores the other, and a slightly different sample would have picked the other.',
      'Acting on a rule the tree found without testing whether acting on it changes anything.',
      'Using data in the features that would not be known at the moment of prediction.',
    ],
    misunderstandings: [
      "\"A deeper tree is a better tree.\" A deeper tree is better on the points it was built from, always. On new points it is often worse, because the deepest questions describe accidents of the sample. The \"Fully grown\" preset is deeper than the default and scores lower on fresh points.",
      "\"If the tree gets every training point right, it has found the pattern.\" A fully grown tree gets every training point right for any data in which identical points agree, including data with labels assigned by coin toss. A perfect score on the training points shows only that the tree has memorized them.",
      "\"The first question is the cause of the outcome.\" The first question is the single split that best separates these examples. It shows that the feature goes along with the outcome in this data. It does not show what would happen if you changed the feature.",
      "\"The algorithm finds the best tree.\" It finds the best next split, one at a time. A different first question, worse on its own, can lead to a smaller and more accurate tree, and the greedy rule will never try it.",
      "\"The features have to be put on the same scale first, as for nearest neighbours.\" A split only asks whether a value is above or below a threshold, so only the order of the values matters. Measuring a feature in different units moves the thresholds and changes nothing else.",
    ],
    constraints: [
      'In practice a single tree is used when it must be read. When accuracy matters more, hundreds of trees are combined, as in random forests and gradient boosting, at the cost of the readability.',
      'Standard libraries control growth with a depth limit, a minimum number of points per leaf, and pruning, with the settings chosen by cross-validation.',
    ],
    alternatives: [
      { id: 'logistic-regression', name: 'Logistic Regression', when: 'The border between the classes is close to a straight line at any angle, and you want a probability and one weight per feature.' },
      { id: 'knn', name: 'k-Nearest Neighbours', when: 'The border has an irregular shape, the features are on comparable scales, and there is no need to explain the prediction as a rule.' },
      { name: 'Random forest', when: 'Accuracy and stability matter more than being able to read the model. Many trees, each grown on a random resample of the data, vote.' },
      { name: 'Gradient-boosted trees', when: 'The data are a table of mixed features and the best accuracy is wanted. Small trees are added one after another, each correcting the errors of those before.' },
      { name: 'A rule written by an expert', when: 'There are too few examples to learn from, or the rule must be justified by something other than past data.' },
    ],
    comparison: {
      columns: ['', 'Decision tree', 'k-nearest neighbours', 'Logistic regression'],
      rows: [
        ['Shape of the border', 'Boxes with sides parallel to the axes', 'Any shape the points suggest', 'One straight line'],
        ['Work before predicting', 'Grow the tree once', 'None: store the points', 'Fit the weights by gradient descent'],
        ['Cost of one prediction', 'One comparison per question on the path', 'A distance to every stored point', 'One weighted sum'],
        ['Depends on feature units', 'No', 'Yes', 'The weights do, the predictions need not'],
        ['Gives reasons a person can read', 'Yes, as a rule', 'Only by showing the neighbours', 'Yes, as weights'],
        ['Handles the XOR dataset', 'Yes, with enough depth', 'Yes', 'No'],
      ],
    },
  },

  applications: [
    { title: 'The building block of forests and boosted ensembles', status: 'established', text: 'Random forests and gradient-boosted trees combine hundreds or thousands of trees grown by the procedure on this page, each on a different resample of the data or on the errors of the trees before it. These ensembles are standard tools for prediction from tables of data.' },
    { title: 'Recognizing body parts in depth images', status: 'established', text: 'Shotton and colleagues described in 2011 how forests of randomized decision trees label each pixel of a depth image with the body part it belongs to, quickly enough to track a person in real time. Each question in those trees compares the depths at two nearby pixels.' },
    { title: 'Which customers are likely to leave, and why', status: 'illustrative', text: 'A subscription business has, for each past customer, a few measurements and whether they cancelled. A shallow tree grown on those records gives both a prediction for current customers and a short rule for each group at risk, such as "more than two complaints last month". The rule shows who tends to leave. Whether contacting those customers keeps them is a separate question that only an experiment can answer.' },
    { title: 'Lending decisions that must be explained', status: 'illustrative', text: 'A lender that has to give an applicant the reason for a refusal can read it off the path through a small tree: which thresholds the application fell on the wrong side of. The same readability lets a reviewer check the rule for unfair questions.' },
    { title: 'Short rules for use without a computer', status: 'illustrative', text: 'A tree of three or four questions fits on a card. In settings such as triage, where a decision is made quickly by a person, a rule of that size can be followed by hand and checked against later outcomes.' },
  ],

  connections: [
    { to: 'concept:supervised-learning', type: 'prerequisite', why: 'A decision tree is learned from examples whose class is already known, which is the setting supervised learning describes.' },
    { to: 'concept:feature-space', type: 'prerequisite', why: 'Each example is a point whose coordinates are its measurements, and a decision tree works by dividing that space into boxes.' },
    { to: 'concept:greedy', type: 'prerequisite', why: 'Decision tree learning is a greedy algorithm: it takes the split that scores best now and never reconsiders it, which is fast but does not give the best tree.' },
    { to: 'concept:tree', type: 'prerequisite', why: 'The learned model is a rooted binary tree, with a question at each inner node and a prediction at each leaf.' },
    { to: 'concept:overfitting', type: 'related', why: 'A decision tree left to grow fits its training points exactly, which makes it one of the plainest demonstrations of overfitting and of why depth has to be limited.' },
    { to: 'concept:entropy', type: 'related', why: 'Entropy is the other common way to score a split in decision tree learning. Like Gini impurity it is zero for a pure group and largest for an even mix.' },
    { to: 'concept:np-hardness', type: 'related', why: 'Finding an optimal decision tree is NP-complete, which is the reason decision tree learning settles for a greedy search.' },
    { to: 'knn', type: 'same-problem', why: 'A decision tree and k-nearest neighbours can both draw borders that are not straight. The tree does its work in advance and ignores the scale of the features, while nearest neighbours does its work at prediction time and depends on scale.' },
    { to: 'logistic-regression', type: 'same-problem', why: 'Both classify a point from its features. Logistic regression makes one cut at any angle, and a decision tree makes many cuts that are each parallel to an axis.' },
    { to: 'perceptron', type: 'same-problem', why: 'The perceptron learns a single straight border and cannot represent XOR. A decision tree represents XOR with two levels of questions.' },
    { to: 'k-means', type: 'related', why: 'k-means and a decision tree both divide feature space into regions. k-means has no labels and draws its regions around centres, while a decision tree uses the labels and draws boxes.' },
    { to: 'linear-regression', type: 'related', why: 'A tree grown to predict a number, called a regression tree, answers with one constant per box, where linear regression answers with a single line across the whole range.' },
    { to: 'binary-search', type: 'related', why: 'Predicting with a decision tree is a search by comparisons: like binary search, each answer discards part of the space and only one path is followed.' },
    { to: 'ab-testing', type: 'related', why: 'A decision tree shows which groups differ in past data. An A/B test checks whether acting on that difference changes the outcome, which the tree cannot show.' },
    { to: 'discipline:statistics', type: 'application', why: 'Recursive partitioning is a nonparametric method of regression and classification: it models an outcome without assuming a formula for how it depends on the measurements.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Forests of decision trees have been used to label the pixels of depth images with body parts, fast enough for real-time tracking.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'A group holds 8 points of class 0 and 2 of class 1. What is its Gini impurity?',
      options: ['0.2', '0.32', '0.5', '0.8'],
      answer: 1,
      explain: [
        'That is the share of class 1, which is the error rate of predicting the majority. Gini impurity is 1 − 0.8² − 0.2².',
        '1 − 0.8² − 0.2² = 1 − 0.64 − 0.04 = 0.32. It is also 2 × 0.8 × 0.2, the chance that two points drawn at random differ.',
        '0.5 is the impurity of an even mix. This group is mostly one class, so it scores lower.',
        '0.8 is the share of class 0. Impurity is low when one class dominates, and for two classes it can never exceed 0.5.',
      ],
    },
    {
      type: 'predict',
      q: 'Four points: (0, 0) and (1, 1) are class 0, while (0, 1) and (1, 0) are class 1. The tree may ask two questions in a row. How good is the best first split, and how does the finished tree do?',
      options: ['The first split scores 0, and the tree gets all four right', 'The first split scores 0.5, no better than not splitting, yet the tree gets all four right', 'The first split scores 0.5, so the tree cannot separate them and gets two right', 'The first split scores 0.25, and the tree gets three right'],
      answer: 1,
      explain: [
        'A score of 0 would mean one question separates the classes. Here every single split leaves one point of each class on each side.',
        'Any first split puts one point of each class on each side, so both sides score 0.5, the same as the whole group. The split is made anyway, and on each side a second question separates the two remaining points.',
        'A rule that stopped when no split improved would end there. This tree splits whenever a threshold exists, and the second level finishes the job.',
        'There are only two possible first splits, x ≤ 0.5 and y ≤ 0.5, and both score 0.5.',
      ],
      tryInput: { custom: XOR4, depth: 2 },
      check: (r) => (Math.abs(r.splits[0].score - 0.5) < 1e-12 && Math.abs(r.splits[0].parentGini - 0.5) < 1e-12 && r.correct === 4 && r.n === 4 && r.questions === 3) || `first split scores ${r.splits[0].score}, ${r.correct} of ${r.n} right`,
    },
    {
      type: 'debug',
      q: 'With this line for scoring a split, the tree keeps choosing splits that cut one point off the edge of a group. What is wrong?',
      code: `def score(yes, no):
    return (gini(yes) + gini(no)) / 2`,
      options: ['It should use entropy, not Gini', 'It should add the two impurities without dividing by 2', 'Each side should be weighted by its share of the points', 'It should take the smaller of the two impurities'],
      answer: 2,
      explain: [
        'Entropy with the same unweighted average would have the same fault.',
        'Dividing by 2 or not changes every score by the same factor, so the same split would win.',
        'A side holding one point is pure and scores 0. Counted as half the result, it makes the split look good however mixed the other side is. Weighting by size, (len(yes) * gini(yes) + len(no) * gini(no)) / (len(yes) + len(no)), gives a one-point side one point of influence.',
        'The smaller impurity would be 0 for any split with a pure side, which makes the fault worse.',
      ],
    },
    {
      type: 'choice',
      q: 'On one dataset a tree three questions deep gets 97% of its training points and 87% of fresh points right. A fully grown tree gets 100% and 83%. Which would you use to predict for new customers, and why?',
      options: ['The fully grown tree, because it makes no mistakes', 'The shallower tree, because the fresh points are the fair test', 'Either, because the difference is within what chance allows on any data', 'Neither, because a tree that is not perfect cannot be trusted'],
      answer: 1,
      explain: [
        'It makes no mistakes on points whose answers it was built from. On points it has not seen it is the worse of the two.',
        'New customers are points the tree has not seen, so accuracy on fresh points is the measure that matters. The extra questions of the full tree bought 3 points of training accuracy and cost 4 points where it counts.',
        'The gap may be small, but that is a question to settle with more fresh points, not a reason to ignore the only fair measurement available.',
        'No model of noisy data is perfect on new points. The useful question is which model is least wrong.',
      ],
    },
    {
      type: 'challenge',
      title: 'Prune with points held back',
      prompt: 'Split a dataset into three parts: one to grow a tree, one to prune it and one to test it. Grow the tree fully on the first part. Then, working from the bottom up, replace a question by a leaf whenever doing so does not lower the accuracy on the second part. Report the accuracy of the full tree and of the pruned tree on the third part, and the number of leaves in each.\n\nTest it on this division first, written as (calls, years, class) with class 1 for a customer who left. Grow on the eight customers of the worked example. Prune with (0, 2, 0), (2, 1, 0), (4, 3, 1), (1, 6, 0) and (5, 5, 1). Test on (2, 2, 0), (0, 1, 0), (3, 8, 1), (1, 4, 0), (6, 1, 1) and (1, 2, 1). Then repeat on a larger dataset with ten different random divisions.',
      expect: 'On the division given, the full tree has 3 leaves and gets 4 of the 6 test customers right. Pruning removes the question "years <= 2.0?": on the pruning part the tree gets 3 of 5 with that question and 5 of 5 with a leaf in its place. The top question stays, because turning it into a leaf would drop the pruning part from 5 of 5 to 3 of 5. The pruned tree has 2 leaves and gets 5 of the 6 test customers right. It now gets (1, 2, 1) wrong, the one test customer the removed question was right about, and gets (2, 2, 0) and (0, 1, 0) right.',
      hints: [
        'Store in every node the majority class of its training points, so that any question can be turned into a leaf without regrowing.',
        'The third part must play no role in growing or pruning. If it does, its accuracy is no longer a fair test.',
        'Expect the pruned tree to be much smaller. Whether it is also more accurate will vary between the ten divisions, which is itself worth reporting.',
      ],
    },
  ],

  compare: {
    idea: 'Ask the yes-or-no question that best separates the examples, then do the same for each side.',
    requires: 'Past examples whose outcome is already known, each described by the same measurements. The more examples there are, the more questions the tree can be trusted to ask.',
    sensitivity: 'High. A few different examples can change the first question and everything under it.',
    memory: 'One small record per question. The examples are not needed once the tree is built.',
    difficulty: 'moderate',
    difficultyNote: 'The recursion is short. The care goes into scoring splits correctly and into deciding when to stop.',
    limits: 'It asks about one measurement at a time, so a slanted or curved border takes many questions. Left to grow, it memorizes its examples and gets worse on new ones. One tree is usually less accurate than many trees voting together.',
    useWhen: 'You need a prediction that comes with reasons a person can read and check, such as which customers are likely to leave and why.',
  },

  advanced: {
    history: "Tree-structured rules were developed more than once. In 1963 Morgan and Sonquist proposed a procedure that repeatedly divided survey respondents into two groups by the question that best explained a response, to find interactions that standard regression missed. In 1984 Breiman, Friedman, Olshen and Stone published *Classification and Regression Trees*, known as CART, which gave the method the form used here: binary splits, Gini impurity, and growing a large tree before pruning it back. In machine learning, Quinlan's ID3 algorithm, published in 1986, chose splits by information gain, and his later C4.5 extended it to numeric features and pruning. Hyafil and Rivest had shown in 1976 that finding an optimal tree is NP-complete, which explains why all of these methods are greedy. The instability of single trees later became an asset: Breiman's bagging (1996) and random forests (2001) average many trees grown on resampled data, and Friedman's gradient boosting (2001) adds small trees one after another.",
    derivation: "Suppose a group holds classes in proportions $p_1, \\dots, p_K$. Label a random point of the group by drawing a class at random with those same proportions. The chance that the label is wrong is\n\n$$G = \\sum_{k} p_k (1 - p_k) = 1 - \\sum_{k} p_k^2,$$\n\nwhich is the Gini impurity. For two classes with proportion $p$ of class 1 it is $2p(1-p)$: zero at $p = 0$ or $1$, and largest, $\\tfrac12$, at $p = \\tfrac12$.\n\nA split sends a fraction $w_L$ of the group left and $w_R = 1 - w_L$ right, with class 1 proportions $p_L$ and $p_R$, and $p = w_L p_L + w_R p_R$. The score of the split is $w_L G(p_L) + w_R G(p_R)$. Because $G$ is a concave function of $p$,\n\n$$w_L G(p_L) + w_R G(p_R) \\le G(w_L p_L + w_R p_R) = G(p),$$\n\nso no split can raise the impurity. $G$ is strictly concave, so equality holds only when $p_L = p_R$: a split gains nothing exactly when both sides have the same mixture as the whole. That is the XOR case. The error rate $\\min(p, 1-p)$ is concave too, but not strictly, which is why it scores many useful splits as worthless.",
    proof: "**A fully grown tree fits its training points.** Assume no two training points with identical features have different classes, and that growth stops only at a pure group or at a group with no possible split. Let a group be mixed. It contains points $a$ and $b$ of different classes, and by assumption they differ in some feature, say $a_f < b_f$. The sorted values of feature $f$ in the group therefore include two neighbouring distinct values, a threshold between them divides the group into two non-empty parts, and so a split exists. A mixed group is thus never a leaf, every leaf is pure, and every training point is predicted as its own class.\n\n**Training errors never increase.** A leaf holding $a$ points of one class and $b$ of the other gets $\\min(a, b)$ of them wrong. If it is split into sides holding $(a_L, b_L)$ and $(a_R, b_R)$, the new count is $\\min(a_L, b_L) + \\min(a_R, b_R) \\le \\min(a_L + a_R,\\, b_L + b_R) = \\min(a, b)$. So accuracy on the training points can only rise with depth, whatever the data. The same argument says nothing about fresh points, and the demonstration shows they can go either way.",
    complexityProof: "For one group of $m$ points and one feature, sorting costs $O(m \\log m)$. The sweep then moves one point at a time from the right side to the left, updating two class counts and evaluating the score in constant time, for $O(m)$ in total. With $d$ features a node costs $O(d\\, m \\log m)$. The groups at any one depth are disjoint, so their sizes sum to at most $n$ and a level costs $O(d\\, n \\log n)$. A tree of depth $h$ therefore costs $O(h\\, d\\, n \\log n)$: $O(d\\, n \\log^2 n)$ when $h = O(\\log n)$ and $O(d\\, n^2 \\log n)$ when $h = n - 1$.\n\nThe number of splits scored has a simple bound. A group of $m$ points offers at most $m - 1$ thresholds per feature. In the worst case each split removes one point, the groups have sizes $n, n-1, \\dots, 2$, and with two features the total is $\\sum_{m=2}^{n} 2(m-1) = n(n-1)$.",
    variants: [
      { name: 'ID3 and C4.5', text: 'Quinlan\'s family of algorithms. They score splits with entropy, allow a split on a categorical feature to have one branch per category, and in C4.5 correct the bias this gives towards features with many categories.' },
      { name: 'Regression trees', text: 'The same procedure for predicting a number. A split is scored by the squared error left on its two sides, and a leaf predicts the mean of its training points.' },
      { name: 'Cost-complexity pruning', text: 'The pruning method of CART. It adds a penalty for each leaf to the training error and removes the branches whose contribution does not cover the penalty, with the size of the penalty chosen by cross-validation.' },
      { name: 'Random forests', text: 'Many trees, each grown fully on a random resample of the data and allowed to consider only a random subset of the features at each split. Their votes are averaged, which removes much of the instability of a single tree.' },
      { name: 'Gradient-boosted trees', text: 'Small trees added one after another, each fitted to the errors left by the sum of those before it.' },
      { name: 'Oblique trees', text: 'Trees whose questions compare a weighted sum of several features with a threshold, so that a split can run at a slant. The search for each split is much harder.' },
    ],
    implementation: "Sort each feature once and keep the order as groups are divided. Use the same comparison, at most or less than, in training and in prediction. Compare scores with a small tolerance so that ties are broken the same way on every machine. Keep the class counts in every node: they give probability estimates, and they let a question be turned back into a leaf when pruning. Decide in advance how a tied leaf predicts.",
    benchmarking: "Report accuracy on data that played no part in growing the tree or in choosing its depth, alongside the accuracy of always predicting the majority class. Give the depth and the number of leaves. Because single trees are unstable, repeat over several random divisions of the data and report the spread, not one number.",
    references: [
      { authors: 'L. Breiman, J. H. Friedman, R. A. Olshen and C. J. Stone', year: 1984, title: 'Classification and Regression Trees', venue: 'Wadsworth' },
      { authors: 'J. R. Quinlan', year: 1986, title: 'Induction of decision trees', venue: 'Machine Learning 1(1), 81-106' },
      { authors: 'L. Hyafil and R. L. Rivest', year: 1976, title: 'Constructing optimal binary decision trees is NP-complete', venue: 'Information Processing Letters 5(1), 15-17' },
      { authors: 'J. N. Morgan and J. A. Sonquist', year: 1963, title: 'Problems in the analysis of survey data, and a proposal', venue: 'Journal of the American Statistical Association 58, 415-434' },
      { authors: 'L. Breiman', year: 2001, title: 'Random forests', venue: 'Machine Learning 45(1), 5-32' },
      { authors: 'J. Shotton, A. Fitzgibbon, M. Cook, T. Sharp, M. Finocchio, R. Moore, A. Kipman and A. Blake', year: 2011, title: 'Real-time human pose recognition in parts from single depth images', venue: 'IEEE Conference on Computer Vision and Pattern Recognition (CVPR)' },
    ],
    furtherReading: [
      'T. Hastie, R. Tibshirani and J. Friedman, *The Elements of Statistical Learning* (2nd edition), section 9.2, "Tree-Based Methods".',
      'J. R. Quinlan, *C4.5: Programs for Machine Learning*, Morgan Kaufmann, 1993.',
    ],
  },

  tests: [
    { name: 'default: every chosen split matches a brute-force search over every threshold', input: {},
      check: (r, c) => {
        const tried = r.splits.reduce((s, x) => s + x.tried, 0);
        if (c['splits scored'] !== tried) return `counted ${c['splits scored']} splits scored, but the nodes record ${tried}`;
        return splitsAreBest(r);
      } },
    { name: 'moons, fully grown: every chosen split matches brute force', input: { dataset: 'moons', points: 40, seed: 1, depth: 16 }, check: splitsAreBest },
    { name: 'XOR, 80 points, fully grown: every chosen split matches brute force', input: { dataset: 'xor', points: 80, seed: 5, depth: 16 }, check: splitsAreBest },
    { name: 'a fully grown tree labels every one of its training points correctly', input: { dataset: 'overlap', points: 40, seed: 3, depth: 16 },
      check: (r) => {
        const here = fitsPerfectly(r);
        if (here !== true) return here;
        for (const dataset of ['overlap', 'moons', 'xor', 'separable']) for (const seed of [1, 2, 3, 4, 5, 6]) for (const points of [10, 40, 80]) {
          const full = quiet({ dataset, points, seed, depth: Infinity });
          const verdict = fitsPerfectly(full);
          if (verdict !== true) return `${dataset}, ${points} points, seed ${seed}: ${verdict}`;
          const best = splitsAreBest(full);
          if (best !== true) return `${dataset}, ${points} points, seed ${seed}: ${best}`;
        }
        return true;
      } },
    { name: 'identical points with different classes cannot be separated at any depth', input: { custom: [1, 1, 0, 1, 1, 1, 2, 2, 0, 3, 1, 1], depth: 16 },
      check: (r) => {
        if (r.pure || r.correct !== 3) return `pure ${r.pure}, correct ${r.correct} of 4`;
        const stuck = walk(r.tree, { x: 1, y: 1 });
        return (stuck.reason === 'same' && stuck.counts.join() === '1,1') || `the leaf holding the identical points: ${JSON.stringify(stuck)}`;
      } },
    { name: 'the worked example: 0.5 at the top, calls ≤ 2.5 scores 0.2, then years ≤ 2 scores 0', input: { custom: EXAMPLE, depth: 3 },
      check: (r, c) => {
        const near = (a, b) => Math.abs(a - b) < 1e-9;
        if (!near(r.rootGini, 0.5) || r.splits.length !== 2) return `top Gini ${r.rootGini}, ${r.splits.length} splits`;
        const [a, b] = r.splits;
        if (a.feature !== 0 || a.threshold !== 2.5 || !near(a.score, 0.2) || a.left.join() !== '4,1' || a.right.join() !== '0,3') return `first split ${JSON.stringify(a)}`;
        if (a.bestOf[1].threshold !== 2.5 || !near(a.bestOf[1].score, 1 / 3) || a.tried !== 12) return `best split on years ${JSON.stringify(a.bestOf[1])}, ${a.tried} tried`;
        if (b.feature !== 1 || b.threshold !== 2 || !near(b.score, 0) || !near(b.parentGini, 0.32)) return `second split ${JSON.stringify(b)}`;
        if (r.accuracy !== 1 || r.leaves !== 3 || c['splits scored'] !== 18) return `accuracy ${r.accuracy}, leaves ${r.leaves}, ${c['splits scored']} splits scored`;
        const says = (x, y) => walk(r.tree, { x, y }).majority;
        return (says(1, 6) === 0 && says(4, 9) === 1 && says(1, 2) === 1 && splitsAreBest(r) === true) || 'predictions for the three new customers differ from the code sample';
      } },
    { name: 'exact XOR: the first split gains nothing, and two levels still get all four right (quiz prediction)', input: { custom: XOR4, depth: 2 },
      check: (r) => {
        const first = r.splits[0];
        if (Math.abs(first.score - 0.5) > 1e-12 || !first.noGain || !first.tie) return `first split ${JSON.stringify(first)}`;
        if (r.accuracy !== 1 || r.depth !== 2 || r.leaves !== 4) return `accuracy ${r.accuracy}, depth ${r.depth}, leaves ${r.leaves}`;
        const stump = quiet({ custom: XOR4, depth: 1 });
        return stump.accuracy === 0.5 || `with one question the accuracy is ${stump.accuracy}`;
      } },
    { name: 'default and fully grown presets: 39 of 40 and 349 of 400, then 40 of 40 and 331 of 400', input: { dataset: 'overlap', points: 40, seed: 3, depth: 16 },
      check: (r) => {
        const shallow = quiet({});
        if (shallow.correct !== 39 || shallow.freshCorrect !== 349 || shallow.depth !== 3) return `default: ${shallow.correct} of 40, ${shallow.freshCorrect} of 400, depth ${shallow.depth}`;
        if (r.correct !== 40 || r.freshCorrect !== 331 || r.depth !== 4) return `fully grown: ${r.correct} of 40, ${r.freshCorrect} of 400, depth ${r.depth}`;
        return true;
      } },
    { name: 'training accuracy never falls with depth, and a tree limited to depth d is the top d levels of a deeper one', input: { dataset: 'overlap', points: 60, seed: 6, depth: 16 },
      check: (r) => {
        for (let d = 1; d < r.byDepth.length; d++) if (r.byDepth[d].train < r.byDepth[d - 1].train) return `training accuracy fell from depth ${d - 1} to ${d}`;
        if (r.byDepth[0].train !== 0.5 || r.byDepth[r.depth].train !== r.accuracy) return 'the accuracy chart does not start at the majority rate or end at the tree\'s own accuracy';
        for (let d = 1; d <= r.depth; d++) {
          const limited = quiet({ dataset: 'overlap', points: 60, seed: 6, depth: d });
          if (limited.accuracy !== r.byDepth[d].train || limited.freshAccuracy !== r.byDepth[d].fresh) return `a tree grown with limit ${d} scores ${limited.accuracy} and ${limited.freshAccuracy}, the cut-off tree ${r.byDepth[d].train} and ${r.byDepth[d].fresh}`;
          const top = r.splits.filter((s) => s.depth < d).map((s) => `${s.node}:${s.feature}:${s.threshold}`).sort().join();
          const own = limited.splits.map((s) => `${s.depth}:${s.feature}:${s.threshold}`).sort().join();
          const topByDepth = r.splits.filter((s) => s.depth < d).map((s) => `${s.depth}:${s.feature}:${s.threshold}`).sort().join();
          if (own !== topByDepth || !top) return `the splits of the depth ${d} tree are not the top ${d} levels of the full tree`;
        }
        return true;
      } },
    { name: 'a depth limit of 1 asks exactly one question, the first question of the deeper tree', input: { dataset: 'overlap', points: 40, seed: 3, depth: 1 },
      check: (r, c) => {
        const deep = quiet({ depth: 16 });
        if (r.questions !== 1 || r.leaves !== 2 || r.depth !== 1) return `${r.questions} questions, ${r.leaves} leaves`;
        if (r.splits[0].feature !== deep.splits[0].feature || r.splits[0].threshold !== deep.splits[0].threshold) return 'the stump\'s split differs from the first split of the full tree';
        return (c['splits scored'] === r.splits[0].tried && c['splits scored'] <= 2 * (r.n - 1)) || `${c['splits scored']} splits scored`;
      } },
    { name: 'training points of a single class give a tree that asks nothing', input: { custom: [0, 0, 1, 1, 2, 1, 3, 1, 1], depth: 5 },
      check: (r, c) => (r.questions === 0 && r.leaves === 1 && r.accuracy === 1 && r.tree.leaf && r.tree.majority === 1 && !c['splits scored']) || `${r.questions} questions, ${r.leaves} leaves, accuracy ${r.accuracy}` },
    { name: 'moons preset: deeper questions help on fresh points (357 of 400 at depth 2, 383 at full depth)', input: { dataset: 'moons', points: 40, seed: 1, depth: 16 },
      check: (r) => (r.depth === 6 && r.pure && r.freshCorrect === 383 && Math.round(r.byDepth[2].fresh * 400) === 357) || `depth ${r.depth}, fresh ${r.freshCorrect}, at depth 2 ${r.byDepth[2].fresh * 400}` },
    { name: 'XOR preset: the first split barely lowers the impurity, and accuracy on fresh points arrives late', input: { dataset: 'xor', points: 40, seed: 3, depth: 16 },
      check: (r) => {
        const first = r.splits[0];
        if (!(first.score > 0.42 && first.score <= 0.5)) return `first split scores ${first.score}`;
        if (!(r.byDepth[1].fresh < 0.55 && r.freshAccuracy > 0.8 && r.pure)) return `fresh accuracy ${r.byDepth[1].fresh} at depth 1 and ${r.freshAccuracy} at the end`;
        return splitsAreBest(r);
      } },
    { name: 'rescaling a feature changes the thresholds and not the predictions', input: { custom: EXAMPLE, depth: 3 },
      check: (r) => {
        const stretched = EXAMPLE.map((v, i) => (i % 3 === 0 ? v * 1000 : v));
        const other = quiet({ custom: stretched, depth: 3 });
        if (other.splits.length !== r.splits.length) return 'a different number of splits after rescaling';
        for (let i = 0; i < r.splits.length; i++) {
          const a = r.splits[i], b = other.splits[i];
          if (a.feature !== b.feature || a.left.join() !== b.left.join() || a.right.join() !== b.right.join()) return `split ${i + 1} divides the points differently after rescaling`;
          if (a.feature === 0 && b.threshold !== a.threshold * 1000) return `threshold ${a.threshold} became ${b.threshold}`;
        }
        return other.predictions.join() === r.predictions.join() || 'predictions changed';
      } },
  ],
};
