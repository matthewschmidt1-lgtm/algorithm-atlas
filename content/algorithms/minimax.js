import { makeRng } from '../../js/lib/rng.js';
import { layoutTree } from '../../js/lib/graphs.js';

const SHAPES = { b2d4: { b: 2, d: 4 }, b2d3: { b: 2, d: 3 }, b3d2: { b: 3, d: 2 } };
const TREES = [
  { value: 'b2d4', label: '4 moves deep, 2 choices each (16 endings)' },
  { value: 'b2d3', label: '3 moves deep, 2 choices each (8 endings)' },
  { value: 'b3d2', label: '2 moves deep, 3 choices each (9 endings)' },
  { value: 'ttt', label: 'Noughts and crosses: X to move' },
];
const ORDERS = [
  { value: 'given', label: 'As dealt' },
  { value: 'best', label: 'Best move first (the ideal case)' },
];

// The noughts-and-crosses position searched by the demonstration. Squares are numbered 1 to 9,
// left to right and top to bottom. O threatens the diagonal 3, 5, 7.
const TTT_START = 'XXOOOX...';
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const lineOf = (board) => LINES.find(([a, b, c]) => board[a] !== '.' && board[a] === board[b] && board[a] === board[c]);

// A tree with b moves at every position and every line of play d moves long. Max moves first.
function uniformTree(b, d, scores) {
  let next = 0, leafAt = 0;
  const make = (depth) => {
    const node = { id: next++, depth, kids: [], leaf: depth === d };
    if (node.leaf) node.score = scores[leafAt++];
    else {
      node.who = depth % 2 === 0 ? 'max' : 'min';
      for (let k = 0; k < b; k++) node.kids.push(make(depth + 1));
    }
    return node;
  };
  return make(0);
}

// Every line of play from a noughts-and-crosses position. X is Max: +1 if X wins, -1 if O wins, 0 for a draw.
function tttTree(start) {
  let next = 0;
  const make = (board, turn, depth, move) => {
    const node = { id: next++, depth, kids: [], board, move };
    const line = lineOf(board);
    if (line || !board.includes('.')) {
      node.leaf = true;
      node.line = line || null;
      node.score = line ? (board[line[0]] === 'X' ? 1 : -1) : 0;
    } else {
      node.leaf = false;
      node.who = turn === 'X' ? 'max' : 'min';
      for (let i = 0; i < 9; i++) {
        if (board[i] === '.') node.kids.push(make(board.slice(0, i) + turn + board.slice(i + 1), turn === 'X' ? 'O' : 'X', depth + 1, { player: turn, sq: i }));
      }
    }
    return node;
  };
  const xs = start.split('X').length - 1, os = start.split('O').length - 1;
  return make(start, xs <= os ? 'X' : 'O', 0, null);
}

// The true value of every position by plain minimax. This shares no code with the search
// below. It is used to put the best move first when that order is asked for, and to check
// the answer in the last step.
function trueValue(node) {
  if (node.leaf) return (node.truth = node.score);
  let best = node.who === 'max' ? -Infinity : Infinity;
  for (const kid of node.kids) {
    const v = trueValue(kid);
    if (node.who === 'max' ? v > best : v < best) best = v;
  }
  return (node.truth = best);
}

function run(input, t) {
  const ttt = input.tree === 'ttt' && !input.depth;
  const pruning = !!input.pruning;
  const order = input.order === 'best' ? 'best' : 'given';
  let root, shape = null;
  if (ttt) root = tttTree(TTT_START);
  else {
    shape = input.depth ? { b: input.branching || 2, d: input.depth } : SHAPES[input.tree] || SHAPES.b2d4;
    const count = shape.b ** shape.d;
    let scores = Array.isArray(input.leaves) && input.leaves.length ? input.leaves.slice() : null;
    if (scores && scores.length !== count) throw new Error(`This tree has ${count} endings, so it needs ${count} scores. You typed ${scores.length}. Clear the box to use random scores, or choose a tree with ${scores.length} endings if there is one.`);
    if (!scores) {
      const rng = makeRng(input.seed * 9973 + shape.b * 31 + shape.d);
      scores = Array.from({ length: count }, () => rng.int(1, 20));
    }
    root = uniformTree(shape.b, shape.d, scores);
  }
  if (order === 'best') {
    trueValue(root);
    const sortKids = (node) => {
      if (node.leaf) return;
      node.kids.sort((x, y) => (node.who === 'max' ? y.truth - x.truth : x.truth - y.truth));
      node.kids.forEach(sortKids);
    };
    sortKids(root);
  }

  // Positions in the order plain depth-first search would meet them, and names for the notes.
  const all = [];
  const collect = (node) => { all.push(node); node.kids.forEach(collect); };
  collect(root);
  const total = all.filter((n) => n.leaf).length;
  if (ttt) for (const n of all) n.name = n.move ? `${n.move.player} on ${n.move.sq + 1}` : 'start';
  else {
    let k = 0;
    const level = [root];
    for (let i = 0; i < level.length; i++) {
      const n = level[i];
      if (n.leaf) continue;
      n.name = k < 26 ? String.fromCharCode(65 + k) : `N${k}`;
      k++;
      level.push(...n.kids);
    }
  }

  const st = new Array(all.length);       // undefined (not reached), 'open', 'exact', 'upper', 'lower', 'pruned'
  const val = new Array(all.length);
  const sure = new Array(all.length);     // for an open position: is its running value a real limit on its true value?
  const bestKid = new Array(all.length);
  const stack = [];
  let examined = 0, skipped = 0, cuts = 0;
  let carry = null;                       // an opening sentence for the next step

  const P = (who) => (ttt ? (who === 'max' ? 'X' : 'O') : who === 'max' ? 'Max' : 'Min');
  const sc = (v) => (v === Infinity ? '+∞' : v === -Infinity ? '−∞' : v < 0 ? `−${-v}` : ttt && v > 0 ? `+${v}` : String(v));
  const worth = (v) => (ttt ? `${sc(v)} (${v > 0 ? 'X wins' : v < 0 ? 'O wins' : 'a draw'})` : sc(v));
  const at = (n) => (ttt ? (n === root ? 'the starting position' : `the position after ${n.name}`) : `**${n.name}**`);
  const At = (n) => { const s = at(n); return s[0] === '*' ? s : s[0].toUpperCase() + s.slice(1); };
  const plural = (k, word) => `${k} ${word}${k === 1 ? '' : word.endsWith('ch') ? 'es' : 's'}`;
  const label = (n) => {
    if (n.leaf) return sc(n.score);
    const s = st[n.id];
    if (!s || s === 'pruned') return '?';
    if (s === 'open') return Number.isFinite(val[n.id]) && sure[n.id] ? `${n.who === 'max' ? '≥' : '≤'}${sc(val[n.id])}` : '?';
    return s === 'exact' ? sc(val[n.id]) : `${s === 'upper' ? '≤' : '≥'}${sc(val[n.id])}`;
  };
  const known = (n) => (st[n.id] === 'exact' ? `exactly ${worth(val[n.id])}` : st[n.id] === 'upper' ? `at most ${worth(val[n.id])}` : `at least ${worth(val[n.id])}`);

  const legend = [
    { label: 'being looked at', role: 'current' },
    { label: 'on the current line of play', role: 'frontier' },
    { label: 'value worked out exactly', role: 'done' },
    ...(pruning ? [{ label: 'only a limit is known (≤ or ≥)', role: 'rejected' }, { label: 'cut: never looked at', role: 'dim' }] : []),
    { label: 'best line of play', role: 'path' },
  ];
  let pos = null;
  const views = ({ current = null, pv = null, alpha, beta } = {}) => {
    if (!pos) pos = layoutTree(root, (n) => n.kids);
    const onStack = new Set(stack);
    const onPv = pv ? new Set(pv) : null;
    const roleOf = (n) => {
      if (onPv && onPv.has(n)) return 'path';
      if (n === current) return 'current';
      const s = st[n.id];
      if (s === 'open') return 'frontier';
      if (s === 'exact') return 'done';
      if (s === 'upper' || s === 'lower') return 'rejected';
      if (s === 'pruned') return 'dim';
      return 'default';
    };
    const edges = [];
    for (const n of all) {
      for (const kid of n.kids) {
        let role = 'default';
        if (onPv) role = onPv.has(n) && onPv.has(kid) ? 'path' : st[kid.id] === 'pruned' ? 'dim' : 'default';
        else if (st[kid.id] === 'pruned') role = st[n.id] === 'pruned' ? 'dim' : 'rejected';
        else if (onStack.has(n) && (onStack.has(kid) || kid === current)) role = 'active';
        edges.push({ u: n.id, v: kid.id, role });
      }
    }
    const tree = {
      kind: 'graph', directed: false, aspect: 0.5, legend,
      title: ttt
        ? 'Each circle is a position, labelled with its score: +1 if X wins, 0 for a draw, −1 if O wins. X wants the score high and O wants it low. The caption says which move leads there.'
        : 'Max moves at the top and wants a high score. Min moves next and wants a low one, and they take turns. The bottom row holds the score of each ending.',
      nodes: all.map((n) => {
        const p = pos.get(n);
        const sub = ttt ? (n.move ? `${n.move.player} on ${n.move.sq + 1}` : `${P(n.who)} to move`) : n.leaf ? undefined : `${n.name} ${n.who}`;
        return { id: n.id, x: p.x, y: p.y, label: label(n), sub, role: roleOf(n) };
      }),
      edges,
    };
    const rows = [pv
      ? { label: 'Best line', cells: pv.map((n) => ({ t: n.leaf && !ttt ? 'ending' : n.name, sub: label(n), role: 'path' })) }
      : { label: 'Line of play', cells: stack.map((n) => ({ t: n.name, sub: label(n), role: n === current ? 'current' : 'frontier' })) }];
    if (pruning && alpha !== undefined) {
      rows.push({ label: 'Already sure', cells: [
        { t: sc(alpha), sub: `${P('max')} has at least this (α)`, role: Number.isFinite(alpha) ? 'done' : 'default' },
        { t: sc(beta), sub: `${P('min')} has at most this (β)`, role: Number.isFinite(beta) ? 'done' : 'default' },
      ] });
    }
    rows.push({ label: 'Endings', cells: [{ t: examined, sub: 'examined' }, ...(pruning ? [{ t: skipped, sub: 'cut', role: skipped ? 'rejected' : 'default' }] : []), { t: total, sub: 'in the tree' }] });
    const out = [tree];
    if (ttt) {
      const shownNode = current || (pv ? pv[pv.length - 1] : root);
      const b = shownNode.board;
      const win = shownNode.line || [];
      out.push({ kind: 'rows', title: pv ? 'The board at the end of the best line of play' : 'The board in the position being looked at',
        rows: [0, 1, 2].map((r) => ({ label: '', cells: [0, 1, 2].map((c) => {
          const i = r * 3 + c;
          return { t: b[i] === '.' ? '·' : b[i], sub: i + 1, role: win.includes(i) ? 'alert' : shownNode.move && shownNode.move.sq === i ? 'current' : b[i] === '.' ? 'dim' : 'default' };
        }) })) });
    }
    out.push({ kind: 'rows', title: pv ? 'The result' : pruning ? 'Where the search is, and what each player is already sure of on this line' : 'Where the search is', rows });
    return out;
  };
  const emit = (make) => {
    const c = carry;
    carry = null;
    t.frame(() => {
      const f = make();
      if (c) f.note = `${c.lead} ${f.note}`;
      return f;
    });
  };

  const search = (node, alpha, beta, aFrom, bFrom) => {
    if (node.leaf) {
      t.count('endings examined');
      examined++;
      st[node.id] = 'exact';
      val[node.id] = node.score;
      return;
    }
    const isMax = node.who === 'max';
    const who = P(node.who);
    st[node.id] = 'open';
    val[node.id] = isMax ? -Infinity : Infinity;
    sure[node.id] = true;
    stack.push(node);
    if (node !== root) {
      const a0 = alpha, b0 = beta;
      emit(() => {
        const limits = [];
        if (pruning && Number.isFinite(a0)) limits.push(`${P('max')} is already sure of ${sc(a0)} at ${at(aFrom)}`);
        if (pruning && Number.isFinite(b0)) limits.push(`${P('min')} is already sure of ${sc(b0)} at ${at(bFrom)}`);
        return { line: isMax ? [2, 3] : [9, 10],
          note: `${ttt ? `Try **${node.name}**. The game is not over, so ${who} chooses next` : `Go down to **${node.name}**, where ${who} chooses`} and will take the ${isMax ? 'highest' : 'lowest'} score on offer.${limits.length ? ` On the way here, ${limits.join(' and ')}.` : ''}`,
          views: views({ current: node, alpha: a0, beta: b0 }), vars: { position: node.name, chooser: who, ...(pruning ? { α: sc(a0), β: sc(b0) } : {}) } };
      });
    }
    let wasCut = false;
    for (let i = 0; i < node.kids.length; i++) {
      const kid = node.kids[i];
      search(kid, alpha, beta, aFrom, bFrom);
      const v = val[kid.id], kind = st[kid.id];
      const old = val[node.id], oldSure = sure[node.id];
      const better = isMax ? v > old : v < old;
      if (better) {
        val[node.id] = v;
        bestKid[node.id] = kid;
        sure[node.id] = kind !== (isMax ? 'upper' : 'lower');
      }
      const best = val[node.id];
      const left = node.kids.length - 1 - i;
      const a1 = alpha, b1 = beta;
      const nowSure = sure[node.id];
      emit(() => {
        let seen;
        if (kid.leaf && ttt) seen = `Try **${kid.name}**. ${kid.line ? `That completes the line ${kid.line.map((x) => x + 1).join(', ')}, so ${kid.board[kid.line[0]]} wins` : 'The board is full and nobody has a line of three, so it is a draw'}: the score is **${sc(v)}**.`;
        else if (kid.leaf) seen = `Look at the next ending below ${node.name}: it scores **${sc(v)}**.`;
        else seen = `${ttt ? `Back from ${kid.name}: that position` : `**${kid.name}** is finished: it`} is worth ${known(kid)}${kind === 'exact' ? `, the ${isMax ? 'lowest' : 'highest'} score ${P(kid.who)} can get there` : ', which is all the search needed to know about it'}.`;
        let react;
        const lim = isMax ? 'at least' : 'at most';
        if (better && nowSure && (!Number.isFinite(old) || !oldSure)) react = `${who} chooses at ${at(node)} and can always take this branch, so ${at(node)} is worth ${lim} ${sc(v)}.`;
        else if (better && nowSure) react = `${who} chooses at ${at(node)} and had ${sc(old)} in hand. ${sc(v)} is ${isMax ? 'higher' : 'lower'}, so ${who} switches to this branch: ${at(node)} is now worth ${lim} ${sc(v)}.`;
        else if (better) react = `That is only a ${isMax ? 'ceiling' : 'floor'} for this branch, not its value, so it tells ${who} nothing definite about ${at(node)} yet.`;
        else react = `${who} chooses at ${at(node)} and ${oldSure ? `already has ${sc(old)} in hand` : `has seen nothing here that could beat ${sc(old)}`}. ${sc(v)} is ${v === old ? 'no better' : isMax ? 'lower' : 'higher'}, so nothing changes there.`;
        return { line: isMax ? (kid.leaf ? [1, 5] : [5]) : kid.leaf ? [1, 12] : [12], note: `${seen} ${react}`,
          views: views({ current: kid.leaf ? kid : node, alpha: a1, beta: b1 }), vars: { position: node.name, chooser: who, 'best so far': sc(best), ...(pruning ? { α: sc(a1), β: sc(b1) } : {}) } };
      });
      if (!pruning) continue;
      const cut = isMax ? best >= beta : best <= alpha;
      if (cut) {
        if (left === 0) break;            // nothing is left to skip, so there is nothing to cut
        wasCut = true;
        cuts++;
        t.count('cuts');
        let gone = 0;
        const mark = (n) => { st[n.id] = 'pruned'; if (n.leaf) gone++; else n.kids.forEach(mark); };
        for (let j = i + 1; j < node.kids.length; j++) mark(node.kids[j]);
        skipped += gone;
        const from = isMax ? bFrom : aFrom, bound = isMax ? beta : alpha;
        const other = P(isMax ? 'min' : 'max');
        t.frame(() => ({ line: isMax ? 6 : 13,
          note: `**Cut.** ${At(node)} is worth ${isMax ? 'at least' : 'at most'} ${sc(best)}, because ${who} chooses here and can take the branch just looked at. But at ${at(from)}, ${other} already has a branch worth ${sc(bound)}, which is ${best === bound ? 'just as good' : 'better'} for ${other}. So ${other} has no reason to let play come this way. The ${left === 1 ? 'branch' : `${left} branches`} not yet looked at here could only make ${at(node)} ${isMax ? 'higher' : 'lower'}, since ${who} picks the ${isMax ? 'highest' : 'lowest'}, and that changes nothing. ${plural(gone, 'ending')} skipped.`,
          views: views({ current: node, alpha: a1, beta: b1 }), vars: { position: node.name, chooser: who, 'best so far': sc(best), α: sc(a1), β: sc(b1), 'endings skipped': gone } }));
        break;
      }
      if (isMax) { if (best > alpha) { alpha = best; aFrom = node; } } else if (best < beta) { beta = best; bFrom = node; }
      const bound = isMax ? beta : alpha;
      if (left > 0 && Number.isFinite(bound)) {
        const from = isMax ? bFrom : aFrom;
        const other = P(isMax ? 'min' : 'max');
        carry = {
          lead: nowSure
            ? `${At(node)} is worth ${isMax ? 'at least' : 'at most'} ${sc(best)} so far, which is still ${isMax ? 'less' : 'more'} than the ${sc(bound)} ${other} is sure of at ${at(from)}. Another branch here could still matter, so the search goes on.`
            : `Nothing definite is known about ${at(node)} yet, so the search goes on.` };
      }
    }
    // What the finished position is known to be worth: its exact value, or only a limit.
    const best = val[node.id];
    if (wasCut) st[node.id] = isMax ? 'lower' : 'upper';
    else if (isMax) {
      const ceiling = node.kids.every((k) => st[k.id] !== 'lower');
      const floor = node.kids.some((k) => val[k.id] === best && st[k.id] !== 'upper');
      st[node.id] = ceiling && floor ? 'exact' : ceiling ? 'upper' : 'lower';
    } else {
      const floor = node.kids.every((k) => st[k.id] !== 'upper');
      const ceiling = node.kids.some((k) => val[k.id] === best && st[k.id] !== 'lower');
      st[node.id] = ceiling && floor ? 'exact' : floor ? 'lower' : 'upper';
    }
    stack.pop();
  };

  st[root.id] = 'open';
  t.frame(() => ({ line: 16,
    note: ttt
      ? `X is to move, and O threatens to complete the diagonal 3, 5, 7. The tree shows every way the game can end from here. An ending scores +1 if X wins, 0 for a draw and −1 if O wins. X will pick the highest score it can reach, and O the lowest.${pruning ? ' With alpha-beta pruning on, the search stops looking at a move as soon as one reply shows it to be worse than a move already found.' : ' With pruning off, every ending is looked at.'}`
      : `Two players take turns. **Max** moves first, at the top, and wants the final score to be as high as possible. **Min** moves next and wants it as low as possible. The ${total} numbers along the bottom are the scores of the ${total} ways the game can end. The search works out what the top position is worth if both play as well as they can.${pruning ? ' With alpha-beta pruning on, it skips branches that cannot change that answer.' : ' With pruning off, it looks at every ending.'}`,
    views: views({ current: root, alpha: -Infinity, beta: Infinity }), vars: { endings: total, pruning: pruning ? 'on' : 'off' } }));
  st[root.id] = undefined;
  search(root, -Infinity, Infinity, null, null);

  const value = val[root.id];
  const pv = [root];
  while (!pv[pv.length - 1].leaf) pv.push(bestKid[pv[pv.length - 1].id]);
  const line = ttt ? pv.slice(1).map((n) => n.name) : pv.map((n) => (n.leaf ? `the ending that scores ${sc(n.score)}` : n.name));
  t.frame(() => {
    const truth = trueValue(root);
    const check = truth === value
      ? (pruning ? `Plain minimax, which looks at all ${total}, was run on the same tree as a check. It gives ${sc(truth)} as well.` : `Switch pruning on to see how many of them can be skipped without changing this answer.`)
      : `Plain minimax on the same tree gives ${sc(truth)}, which does not match. That would be a fault in this page.`;
    return { line: root.who === 'max' ? [8, 16] : [15, 16],
      note: `The search is over. ${ttt ? 'The starting position' : `**${root.name}**`} is worth **${worth(value)}**: that is the score ${P('max')} can be sure of, however well ${P('min')} replies. The best line of play is ${ttt ? line.join(', then ') : line.join(', ')}, so ${P(root.who)} should ${ttt ? `play square ${pv[1].move.sq + 1}` : pv[1].leaf ? 'take that ending' : `move to ${pv[1].name}`}. ${pruning ? `Alpha-beta looked at ${examined} of the ${total} endings and skipped ${skipped}${cuts ? `, in ${plural(cuts, 'cut')}` : ', because no cut was possible with the moves in this order'}.` : `Plain minimax looked at all ${total} endings.`} ${check}`,
      views: views({ pv }), vars: { value: sc(value), 'endings in the tree': total, ...(pruning ? { 'endings skipped': skipped } : {}) } };
  });

  const nested = (n) => (n.leaf ? n.score : n.kids.map(nested));
  return {
    value, examined, skipped, total, cuts, pruning, order, ttt,
    shape: shape ? { branching: shape.b, depth: shape.d } : null,
    line,
    bestMove: ttt ? pv[1].move.sq + 1 : pv[1].leaf ? null : pv[1].name,
    tree: nested(root),
    maxFirst: root.who === 'max',
    // one entry per position, in depth-first order: what the search concluded about it
    nodes: all.map((n) => ({ kind: st[n.id] || 'unseen', value: val[n.id] === undefined ? null : val[n.id], leaf: n.leaf })),
  };
}

// Reference for the tests: plain minimax over the nested lists in a result. It shares no code with run().
function referenceValue(tree, maxToMove) {
  if (!Array.isArray(tree)) return tree;
  const values = tree.map((kid) => referenceValue(kid, !maxToMove));
  return maxToMove ? Math.max(...values) : Math.min(...values);
}
// Every conclusion the search reached must be true: exact values equal the reference, and limits hold.
function conclusionsHold(r) {
  let at = 0, problem = true;
  const walk = (tree, maxToMove) => {
    const node = r.nodes[at++];
    const truth = referenceValue(tree, maxToMove);
    if (node.kind === 'exact' && node.value !== truth) problem = `a position reported as exactly ${node.value} is really worth ${truth}`;
    if (node.kind === 'upper' && truth > node.value) problem = `a position reported as at most ${node.value} is really worth ${truth}`;
    if (node.kind === 'lower' && truth < node.value) problem = `a position reported as at least ${node.value} is really worth ${truth}`;
    if (node.kind === 'open') problem = 'a position was left unfinished';
    if (Array.isArray(tree)) tree.forEach((kid) => walk(kid, !maxToMove));
  };
  walk(r.tree, r.maxFirst);
  if (problem !== true) return problem;
  if (r.nodes[0].kind !== 'exact') return 'the value at the top should always be exact';
  if (r.examined + r.skipped !== r.total) return 'examined and skipped endings do not add up to the total';
  return r.value === referenceValue(r.tree, r.maxFirst) || `the search returned ${r.value}, plain minimax gives ${referenceValue(r.tree, r.maxFirst)}`;
}
const quiet = { count() {}, frame() {} };
const silentRun = (input) => run({ tree: 'b2d4', pruning: true, order: 'given', seed: 1, leaves: [], ...input }, quiet);

const WORKED = [4, 7, 5, 2, 9, 8, 6, 3, 1];
const REVERSED = [6, 3, 1, 2, 9, 8, 4, 7, 5];

export default {
  meta: {
    id: 'minimax',
    name: 'Minimax with Alpha-Beta Pruning',
    aliases: ['minimax', 'minmax', 'alpha-beta pruning', 'alpha-beta search', 'game tree search', 'adversarial search'],
    kind: 'algorithm',
    discipline: 'ai',
    alsoIn: [
      { id: 'algorithms', why: 'It is depth-first search over a tree of positions, with a rule for passing values back up the tree and a bound for abandoning branches early.' },
      { id: 'optimization', why: 'Choosing the option whose worst case is best is a standard decision rule, and alpha-beta is a form of branch and bound: it discards options that a known bound already rules out.' },
    ],
    subfield: 'Search',
    family: 'Adversarial (game) search',
    lab: 'graphs',
    summary: 'Chooses a move in a two-player game by assuming the opponent always replies as well as possible, and skips branches that provably cannot change the choice.',
    difficulty: 'intermediate',
    order: 265,
    paradigms: ['graph-search'],
    randomized: false,
    approximate: false,
    time: { best: 'O(b^(d/2)) with pruning and the best move tried first', average: 'Depends on the order of moves', worst: 'O(b^d)', class: 'exponential' },
    space: { worst: 'O(b·d)', class: 'linear' },
    tags: {
      problems: ['how does a computer choose a move in a game', 'play noughts and crosses perfectly', 'pick the best move against an opponent', 'look several moves ahead', 'how does a chess program think', 'plan for the worst an opponent can do'],
      techniques: ['game tree', 'depth-first search', 'pruning', 'evaluation function', 'move ordering'],
      applications: ['games'],
    },
    prerequisites: ['dfs', 'concept:tree', 'concept:recursion', 'concept:state-space'],
  },

  bigIdea: {
    simple: "Minimax is how a computer chooses a move in a game for two players, such as noughts and crosses or chess. It looks ahead. It imagines each move it could make, then each reply the other player could make, then its own answers to those, and so on. At the end of every imagined line of play it writes down a score: high if the game went well for the computer, low if it went badly. Then it works backwards. On its own turns it assumes it will pick the move with the highest score. On the other player's turns it assumes they will pick the move with the lowest score, the one that is worst for the computer. The move that still comes out best is the one it plays. There is also a shortcut, called alpha-beta pruning. Once one reply shows that a move is worse than a move already found, the computer stops looking at that move. Its other replies no longer matter. The shortcut never changes the answer. It only saves work.",
    when: "Use it for games where two players take turns, both can see the whole position, and whatever is good for one is bad for the other: noughts and crosses, draughts, chess, Connect Four. If the game is small enough to search to the end, the result is perfect play. If it is not, stop at a fixed number of moves ahead and score the positions reached with an estimate. Always switch pruning on, since it returns the same value for less work. Games with dice or hidden cards, and games with too many moves per turn to search, need other methods, such as sampling many lines of play at random, which builds on [Monte Carlo estimation](#/algorithm/monte-carlo).",
    interesting: "Pruning costs nothing in accuracy, and how much it saves depends only on the order in which moves are tried. If the best move at every position is tried first, the search looks at roughly the square root of the number of endings, which lets it look about twice as many moves ahead in the same time. With an unlucky order it saves nothing. So a strong game program spends a great deal of its effort on guessing which move to try first.",
    analogy: {
      title: 'Choose a bag, and a rival picks what you get from it',
      text: "Three bags sit on a table. You choose a bag, and then a rival, who wants you to get as little as possible, takes one thing out of it and hands it to you. To choose well you look into each bag and find its worst item, because that is the one you will be given. Then you take the bag whose worst item is best. That is minimax. Now the shortcut. Say the worst thing in the first bag is worth 4. You open the second bag and the first thing you see is worth 2. You can close that bag at once. Your rival would hand you that item or something worse, and you already have a bag that guarantees 4. Whatever else is in the second bag makes no difference.",
      limits: "A bag is one choice deep. A game goes many turns deep, with you and your rival choosing in turn, so each item in a bag is itself a bag, and a limit found near the top of the tree is carried down to cut branches far below. The picture also assumes your rival always picks what is worst for you. A real opponent makes mistakes, and minimax does nothing to tempt them into one. And in a large game nobody can look into every bag: the search has to stop early and estimate.",
    },
  },

  example: {
    setup: "Two players, Max and Min. Max wants a high score and Min wants a low one. Max is at position A and can move to B, C or D. Then Min chooses one of three endings, and each ending has a score. Under B the endings score 4, 7 and 5. Under C they score 2, 9 and 8. Under D they score 6, 3 and 1. Which move should Max make?",
    steps: [
      "Look under B. Min would choose the lowest of 4, 7 and 5, so B is worth 4. By moving to B, Max can be sure of 4.",
      "Look under C. Its first ending scores 2. Min could choose that, so C is worth 2 or less. That is already worse for Max than the 4 from B.",
      "So stop looking at C. Its other endings, 9 and 8, are skipped. Min would only turn down the 2 for something lower still, and lower makes C even worse for Max.",
      "Look under D. Its first ending scores 6. That is better than 4, so D might still beat B, and the search has to go on. The next ending scores 3. Now D is worth 3 or less, which is worse than 4. Skip its last ending, the 1.",
      "Max moves to B, and the game is worth 4.",
    ],
    result: "The answer is 4, found by looking at 6 of the 9 endings. Checking all 9 gives the same answer: the lowest scores under B, C and D are 4, 2 and 1, and the highest of those is 4. Notice that the search never found out what C and D are really worth. It found out only that each is worse than B, and that was enough.",
    tryInput: { tree: 'b3d2', leaves: WORKED, pruning: true, order: 'given' },
  },

  terms: [
    { term: "Position", meaning: "One state of the game: where everything is, and whose turn it is." },
    { term: "Game tree", meaning: "A drawing of every way the game can go: the position now at the top, each move as a line down to the position it leads to, and so on down to the ends of the game." },
    { term: "Ending", meaning: "A position where the game is over, so its score is known. In the tree it is a leaf: nothing hangs below it." },
    { term: "Max and Min", meaning: "Names for the two players. Max wants the final score to be as high as possible and Min wants it as low as possible." },
    { term: "Value of a position", meaning: "The score the game will end with from that position if both players make their best moves from then on." },
    { term: "Branch", meaning: "One move out of a position, together with everything that can follow it." },
    { term: "Pruning", meaning: "Leaving a branch unexamined because it has been shown that it cannot change the answer. Also called a cut." },
    { term: "Alpha and beta", meaning: "Two running limits the search carries with it: alpha is the score Max is already sure of, and beta is the score Min is already sure of." },
    { term: "Evaluation function", meaning: "A quick estimate of how good an unfinished position is, used when the game is too large to search to the end." },
  ],

  takeaway: "Assume your opponent will always make the reply that is worst for you, choose the move whose worst case is best, and stop studying a move as soon as one reply proves it worse than a move you already have.",

  viz: {
    describe: 'A game tree drawn with the position to move from at the top and the endings along the bottom, each ending labelled with its score. Levels alternate between Max, who takes the highest value below, and Min, who takes the lowest. The position being looked at is terracotta and the positions on the current line of play are ochre. A position whose value has been worked out exactly turns forest green and shows the value. A position that was cut shows only a limit, such as ≤2, in brick red, and the branches that were never looked at are greyed out with a dashed line leading to them. Rows under the tree show the current line of play, the scores each player is already sure of (alpha and beta), and how many endings have been examined and skipped. At the end the best line of play is drawn in forest green. With the noughts-and-crosses option the board of the position being looked at is shown as well.',
    inputs: [
      { id: 'tree', type: 'select', label: 'What to search', options: TREES, default: 'b2d4' },
      { id: 'pruning', type: 'toggle', label: 'Alpha-beta pruning', default: true,
        help: 'Off: plain minimax looks at every ending. On: branches that cannot change the answer are cut.' },
      { id: 'order', type: 'select', label: 'Order in which moves are tried', options: ORDERS, default: 'given',
        help: '"Best move first" sorts the moves at every position using the true values. A real program cannot know those in advance, so this shows the most that pruning can ever save.' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 16 },
      { id: 'leaves', type: 'list', label: 'Or type your own ending scores', default: [], maxLength: 16, min: -99, max: 99, integer: true,
        help: 'Whole numbers, left to right along the bottom of the tree. Give exactly as many as the chosen tree has endings. Not used for noughts and crosses.' },
    ],
    presets: [
      { label: 'Worked example (9 endings)', values: { tree: 'b3d2', leaves: WORKED, pruning: true, order: 'given' } },
      { label: 'Worked example, no pruning', values: { tree: 'b3d2', leaves: WORKED, pruning: false, order: 'given' } },
      { label: 'Deeper tree', values: { tree: 'b2d4', seed: 16, leaves: [], pruning: true, order: 'given' } },
      { label: 'Deeper tree, best move first', values: { tree: 'b2d4', seed: 16, leaves: [], pruning: true, order: 'best' } },
      { label: 'Noughts and crosses: X must block', values: { tree: 'ttt', leaves: [], pruning: true, order: 'given' } },
    ],
    tryThis: [
      'Load "Worked example (9 endings)" and step through it, then load "Worked example, no pruning". Both end with the value 4. Count the endings examined: 6 with pruning, 9 without.',
      'Load "Deeper tree" and note how many endings are examined. Then load "Deeper tree, best move first". The scores are the same but the moves are tried in a different order, and the count drops to 7 of 16, the fewest possible for this shape.',
      'Load "Noughts and crosses: X must block". Watch what happens after X tries square 8: one reply by O is enough to rule the move out, and the other reply is never looked at.',
      'In the worked example, type the three groups in the opposite order: 6, 3, 1, 2, 9, 8, 4, 7, 5. The value is still 4, but now nothing can be cut. Work out why before you run it.',
    ],
    run,
    report: (r) => `Value of the top position: ${r.value}. Best line of play: ${r.line.join(', ')}.\n${r.examined} of ${r.total} endings examined${r.pruning ? `, ${r.skipped} skipped in ${r.cuts} ${r.cuts === 1 ? 'cut' : 'cuts'}.` : '. Plain minimax always examines all of them.'}`,
    experiment: {
      title: 'Endings examined as the search looks further ahead',
      note: 'Each point is a real run on a tree with 2 choices at every position and random scores from 1 to 20. Plain minimax examines every ending, so its count doubles with each extra move. Alpha-beta with the moves in the order they were dealt examines far fewer. Alpha-beta with the best move first at every position examines the fewest that any method could: the sorting uses the true values, which a real program does not have, so that series is a limit and not something a program can count on.',
      metric: 'endings examined',
      metricLabel: 'Endings examined',
      sizeLabel: 'Moves looked ahead (d), with 2 choices per move',
      sizes: [2, 3, 4, 5, 6, 8, 10, 12, 14],
      variants: [
        { id: 'plain', label: 'Plain minimax' },
        { id: 'given', label: 'Alpha-beta, moves as dealt' },
        { id: 'best', label: 'Alpha-beta, best move first' },
      ],
      input: (n, variant, seed) => ({ depth: n, branching: 2, seed, leaves: [], pruning: variant !== 'plain', order: variant === 'best' ? 'best' : 'given' }),
      theory: [
        { label: '2^d', fn: (n) => 2 ** n, variant: 'plain' },
        { label: '2^⌈d/2⌉ + 2^⌊d/2⌋ − 1', fn: (n) => 2 ** Math.ceil(n / 2) + 2 ** Math.floor(n / 2) - 1, variant: 'best' },
      ],
    },
  },

  logic: {
    intuition: 'A position where the game is over has a known score. Any other position is worth whatever the player to move can get out of it: the highest value among its children if Max is to move, the lowest if Min is. Apply that rule from the endings upward and every position gets a value, including the one on the board now. Alpha-beta adds two numbers that travel down the tree with the search. `α` is the best score Max has already secured at some position on the path from the root, and `β` is the best (that is, lowest) score Min has secured on that path. A position can only affect the answer if its value lies strictly between them. The moment a Min position is shown to be worth `α` or less, or a Max position `β` or more, one of the players has a better choice earlier on the path, and the rest of that position can be left unexamined.',
    steps: [
      'Start at the current position with `α = −∞` and `β = +∞`: neither player is sure of anything yet.',
      'If the position is an ending, return its score. In a game too large to finish, also stop at a chosen depth and return an estimate of the position.',
      'If Max is to move, search the children one at a time. Keep the highest value returned so far as `best`, and raise `α` to `best` whenever `best` is higher.',
      'If `best` reaches `β` or more, stop and return it. Min has a choice earlier on the path that is at least as good for Min, so play will not come here.',
      'If Min is to move, do the mirror image: keep the lowest value as `best`, lower `β` to it, and stop as soon as `best` is `α` or less.',
      'The value returned for the root is the value of the game, and the child that produced it is the move to play.',
    ],
    pseudocode: [
      'search(position, α, β):',
      '  if position is an ending: return its score',
      '  if Max is to move:',
      '    best ← −∞',
      '    for each child of position:',
      '      best ← max(best, search(child, α, β))',
      '      if best ≥ β: return best      // alpha-beta only: cut',
      '      α ← max(α, best)              // alpha-beta only',
      '    return best',
      '  else:                             // Min is to move',
      '    best ← +∞',
      '    for each child of position:',
      '      best ← min(best, search(child, α, β))',
      '      if best ≤ α: return best      // alpha-beta only: cut',
      '      β ← min(β, best)              // alpha-beta only',
      '    return best',
      'value ← search(root, −∞, +∞)',
    ],
    decisions: [
      { title: 'Search to the end, or stop early?', text: 'Only small games can be searched to the end. For the rest, the search stops a fixed number of moves ahead and scores the positions it reaches with an evaluation function, for example by counting pieces. The answer is then only as good as those estimates. Everything else in the algorithm stays the same.' },
      { title: 'In what order should moves be tried?', text: 'The order never changes the value returned. It changes the work by a large factor, because a cut can only happen after a good move has been found. Programs try the moves most likely to be best first: captures, the best move found by a shallower search of the same position, and moves that caused a cut in a neighbouring position.' },
      { title: 'Cut on a tie, or only on strictly better?', text: 'This page cuts when `best ≥ β` or `best ≤ α`, so a tie is enough. A branch that can only equal what the other player already has cannot improve on it, so the value is safe. The effect is that among equally good moves the first one found is kept.' },
      { title: 'Two halves or one?', text: 'The pseudocode has a Max half and a Min half. Many programs fold them into one by always scoring from the point of view of the player to move and negating the value at each level. That form is called negamax. It is the same algorithm with less code.' },
    ],
    invariants: [
      'At every position being searched, `α < β`. `α` is the highest value Max has secured at any Max position on the path from the root, and `β` is the lowest value Min has secured at any Min position on that path.',
      'A value returned strictly between `α` and `β` is the exact minimax value of that position. A returned value of `α` or less is an upper limit on its true value, and a returned value of `β` or more is a lower limit.',
      'The root is searched with `α = −∞` and `β = +∞`, so the value returned for it is always exact.',
    ],
    edgeCases: [
      'A position with a single legal move is worth whatever that move is worth. Nothing can be cut there.',
      'Several moves can share the best value. The search keeps the first one it finds, and with pruning on it may never learn that the others were equal.',
      'With an unlucky order of moves no branch is cut at all, and alpha-beta does exactly the work of plain minimax. Reversing the three groups in the worked example does this.',
      'A game in which positions can repeat has lines of play that never end. The search needs a depth limit or a rule that scores a repeated position.',
      'A depth limit can stop the search in the middle of an exchange, so that a piece about to be lost still counts as held. Programs extend the search at such unsettled positions.',
      'Dice, hidden cards, or more than two sides break the assumption that one player maximises and the other minimises a single score. The method does not apply as it stands.',
    ],
    correctness: 'For plain minimax the argument is an induction on the height of a position. An ending has its true score by definition. A position above it is worth the best its mover can get, and by the induction its children already have their true values, so taking the highest for Max or the lowest for Min gives its true value. For alpha-beta the claim to prove is the second invariant: a search of a position with `α < β` returns the exact value when the result lies strictly between them, an upper limit when it is `α` or less, and a lower limit when it is `β` or more. Take a Max position. If the loop finishes without a cut, `best` is the highest of the returned values. Children that returned exact values or upper limits cannot truly be worth more than they returned, so the position is worth at most `best`, and if `best` is above `α` the child that returned it was searched with a window that makes its value exact, so the position is worth exactly `best`. If the loop is cut, some child returned `β` or more, that child is worth at least what it returned, and Max can choose it, so the position is worth at least `best`. A value of `β` or more can never be chosen by Min, who has `β` available earlier, so no ancestor needs more than that limit. The Min case is the mirror image, and the root, searched with the widest window, is always exact.',
    mistakes: [
      'Getting the two cut tests the wrong way round: a Max position is cut when `best ≥ β`, a Min position when `best ≤ α`. Swapping them throws away good moves without any error.',
      'Forgetting to raise `α` (or lower `β`) after a child has improved `best`. The result is still correct, but far fewer branches are cut.',
      'Treating the value of a cut position as its true value, for example when storing results for reuse. It is only a limit.',
      'Scoring endings from the wrong player\'s point of view. In the two-halves form every score is from Max\'s side. In the negamax form it is from the side of the player to move.',
      'Counting a win in five moves the same as a win in one. The program then has no reason to finish the game. Subtracting a little for each move taken makes quicker wins score higher.',
    ],
  },

  code: {
    sample: {
      input: 'Three trees, each searched twice: by plain minimax and with alpha-beta pruning. The first is the worked example, with endings 4, 7, 5, 2, 9, 8, 6, 3, 1. The second is the same tree with its three groups in the opposite order. The third has 3 choices per move, is 6 moves deep, and has 729 scores from a small fixed generator.',
      expected: 'Worked example: minimax 4 after 9 endings, alpha-beta 4 after 6 endings\nSame tree, groups reversed: minimax 4 after 9 endings, alpha-beta 4 after 9 endings\nRandom tree, 6 moves deep: minimax 6 after 729 endings, alpha-beta 6 after 217 endings',
    },
    python: {
      source: `def make_leaves(count, seed):
    """Fixed pseudo-random scores from 1 to 20, the same in every language."""
    scores = []
    for _ in range(count):
        seed = seed * 48271 % 2147483647
        scores.append(seed % 20 + 1)
    return scores


def search(leaves, branching, depth, index, max_turn, alpha, beta, prune, seen):
    """Value of position \`index\` with \`depth\` moves still to play. \`seen\` counts endings."""
    if depth == 0:
        seen[0] += 1
        return leaves[index]
    best = float("-inf") if max_turn else float("inf")
    for k in range(branching):
        value = search(leaves, branching, depth - 1, index * branching + k,
                       not max_turn, alpha, beta, prune, seen)
        if max_turn:
            best = max(best, value)
            if prune and best >= beta:
                break
            alpha = max(alpha, best)
        else:
            best = min(best, value)
            if prune and best <= alpha:
                break
            beta = min(beta, best)
    return best


def report(name, leaves, branching, depth):
    parts = []
    for label, prune in (("minimax", False), ("alpha-beta", True)):
        seen = [0]
        value = search(leaves, branching, depth, 0, True, float("-inf"), float("inf"), prune, seen)
        parts.append(f"{label} {value} after {seen[0]} endings")
    print(name + ": " + ", ".join(parts))


report("Worked example", [4, 7, 5, 2, 9, 8, 6, 3, 1], 3, 2)
report("Same tree, groups reversed", [6, 3, 1, 2, 9, 8, 4, 7, 5], 3, 2)
report("Random tree, 6 moves deep", make_leaves(3 ** 6, 2024), 3, 6)`,
      notes: [
        { line: 12, text: 'No moves left to play: this is an ending. Count it and return its score. The endings are stored left to right in one list.' },
        { line: 17, text: 'The children of position `index` are positions `index * branching + k` one level down. The turn passes to the other player, and the current limits go down with the call.' },
        { line: 21, text: 'The cut for Max. `best` is already at least `beta`, the score Min is sure of elsewhere, so Min will not let play come here and the remaining children are skipped.' },
        { line: 23, text: 'Raise `alpha` so that the children still to come are searched knowing what Max has secured here.' },
        { line: 26, text: 'The mirror-image cut for Min: `best` is already at most `alpha`, the score Max is sure of elsewhere.' },
        { line: 36, text: 'The top position is searched with the widest possible limits, so the value that comes back is exact.' },
      ],
    },
    javascript: {
      source: `// Fixed pseudo-random scores from 1 to 20, the same in every language.
function makeLeaves(count, seed) {
  const scores = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 48271) % 2147483647;
    scores.push((seed % 20) + 1);
  }
  return scores;
}

// Value of position \`index\` with \`depth\` moves still to play. \`seen.count\` counts endings.
function search(leaves, branching, depth, index, maxTurn, alpha, beta, prune, seen) {
  if (depth === 0) {
    seen.count += 1;
    return leaves[index];
  }
  let best = maxTurn ? -Infinity : Infinity;
  for (let k = 0; k < branching; k++) {
    const value = search(leaves, branching, depth - 1, index * branching + k,
      !maxTurn, alpha, beta, prune, seen);
    if (maxTurn) {
      best = Math.max(best, value);
      if (prune && best >= beta) break;
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      if (prune && best <= alpha) break;
      beta = Math.min(beta, best);
    }
  }
  return best;
}

function report(name, leaves, branching, depth) {
  const parts = [];
  for (const [label, prune] of [["minimax", false], ["alpha-beta", true]]) {
    const seen = { count: 0 };
    const value = search(leaves, branching, depth, 0, true, -Infinity, Infinity, prune, seen);
    parts.push(label + " " + value + " after " + seen.count + " endings");
  }
  console.log(name + ": " + parts.join(", "));
}

report("Worked example", [4, 7, 5, 2, 9, 8, 6, 3, 1], 3, 2);
report("Same tree, groups reversed", [6, 3, 1, 2, 9, 8, 4, 7, 5], 3, 2);
report("Random tree, 6 moves deep", makeLeaves(3 ** 6, 2024), 3, 6);`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

const int INF = 1000000;  // larger than any score

// Fixed pseudo-random scores from 1 to 20, the same in every language.
std::vector<int> makeLeaves(int count, long long seed) {
    std::vector<int> scores;
    for (int i = 0; i < count; ++i) {
        seed = seed * 48271 % 2147483647;
        scores.push_back(static_cast<int>(seed % 20) + 1);
    }
    return scores;
}

// Value of position \`index\` with \`depth\` moves still to play. \`seen\` counts endings.
int search(const std::vector<int>& leaves, int branching, int depth, int index, bool maxTurn,
           int alpha, int beta, bool prune, int& seen) {
    if (depth == 0) {
        ++seen;
        return leaves[index];
    }
    int best = maxTurn ? -INF : INF;
    for (int k = 0; k < branching; ++k) {
        int value = search(leaves, branching, depth - 1, index * branching + k,
                           !maxTurn, alpha, beta, prune, seen);
        if (maxTurn) {
            best = std::max(best, value);
            if (prune && best >= beta) break;
            alpha = std::max(alpha, best);
        } else {
            best = std::min(best, value);
            if (prune && best <= alpha) break;
            beta = std::min(beta, best);
        }
    }
    return best;
}

void report(const std::string& name, const std::vector<int>& leaves, int branching, int depth) {
    std::cout << name << ":";
    const bool modes[2] = {false, true};
    for (bool prune : modes) {
        int seen = 0;
        int value = search(leaves, branching, depth, 0, true, -INF, INF, prune, seen);
        std::cout << (prune ? ", alpha-beta " : " minimax ") << value << " after " << seen << " endings";
    }
    std::cout << "\\n";
}

int main() {
    report("Worked example", {4, 7, 5, 2, 9, 8, 6, 3, 1}, 3, 2);
    report("Same tree, groups reversed", {6, 3, 1, 2, 9, 8, 4, 7, 5}, 3, 2);
    report("Random tree, 6 moves deep", makeLeaves(729, 2024), 3, 6);
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Write `b` for the number of moves available at each position and `d` for the number of moves the search looks ahead. The tree then has $b^d$ endings. Plain minimax examines every one of them. Alpha-beta examines somewhere between roughly the square root of that number and all of it, and the order in which moves are tried decides where in that range it falls.',
    cases: [
      { case: 'Plain minimax, always', time: 'O(b^d)', when: 'Every ending is examined exactly once: $b^d$ of them.' },
      { case: 'Alpha-beta, best move first at every position', time: 'O(b^(d/2))', when: 'Exactly $b^{\\lceil d/2 \\rceil} + b^{\\lfloor d/2 \\rfloor} - 1$ endings are examined. No method that is certain of the value can examine fewer.' },
      { case: 'Alpha-beta, moves in no particular order', time: 'Between the two', when: 'Still exponential in `d`, with a smaller base than `b`. The chart on this page measures it for random scores. No formula is claimed here.' },
      { case: 'Alpha-beta, unlucky order', time: 'O(b^d)', when: 'If no cut ever applies, every ending is examined, exactly as in plain minimax.' },
    ],
    space: 'O(b·d). The search is depth first, so it holds only the current line of play, at most `d` positions, and at each of them the list of up to `b` moves. The tree itself is never stored: positions are generated on the way down and forgotten on the way back up.',
    memory: 'Programs for real games add a table of positions already searched, because the same position is often reached by different orders of moves. That table is as large as memory allows and is the main use of memory in a game program.',
    tradeoffs: 'Each extra move of lookahead multiplies the work by `b` for plain minimax and, with good move ordering, by about the square root of `b` for alpha-beta. Time spent on ordering moves well is repaid many times over in cuts. A more careful evaluation function gives better play at the same depth but is slower at every position, which reduces the depth that can be reached in the time allowed.',
    assumptions: [
      'Two players move in turn, both see the whole position, and a single score measures the result: what one gains the other loses.',
      'The counts are for a uniform tree, with exactly `b` moves at every position and every line of play exactly `d` moves long.',
      'Scoring an ending takes constant time, and work is measured by the number of endings examined.',
      'The best-case count needs the best move to be tried first at every position. The demonstration arranges this by sorting with the true values, which a real program does not have.',
      'A position reached by two different orders of moves is counted and searched twice.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Games with many moves in each position. The work grows as a power of that number, and Go, with hundreds of legal moves in most positions, stayed out of reach of this method.',
      'Games where no simple estimate tells a good unfinished position from a bad one. A depth-limited search is only as good as its evaluation function.',
      'Games with chance or hidden information, where there is no single known tree to search.',
      'Opponents who do not play well. Minimax prepares for the best reply and makes no attempt to exploit a weak player.',
    ],
    pitfalls: [
      'A depth limit that falls just before something decisive happens gives a confident and wrong value. This is called the horizon effect.',
      'Poor move ordering, which leaves the code correct and the search many times slower than it need be.',
      'Reusing the value of a cut position as though it were exact.',
      'Deep recursion on a long game without a depth limit.',
    ],
    misunderstandings: [
      "\"Alpha-beta is faster but a little less accurate.\" It returns exactly the same value as plain minimax, every time. A branch is cut only when it is proved that nothing in it can change the answer.",
      "\"Minimax predicts what the opponent will do.\" It does not predict anything. It assumes the reply that is worst for you, so its value is a guarantee: you will do at least this well, and better if the opponent slips.",
      "\"The numbers on the cut positions are their values.\" They are limits. A position marked ≤2 is worth 2 or less, and the search stopped caring exactly how much less.",
      "\"A chess program searches to the end of the game.\" Only tiny games can be searched that far. A chess program looks a limited number of moves ahead and estimates the positions it reaches.",
    ],
    constraints: [
      'A move usually has to be chosen within a time limit. Programs search one move deep, then two, then three, and play the best move from the deepest search that finished.',
      'The table of positions already searched has to fit in memory, so old entries are overwritten.',
      'The evaluation function runs at every position at the edge of the search, so its speed sets the depth that can be reached.',
    ],
    alternatives: [
      { name: 'Monte Carlo tree search', when: 'The game has too many moves per position, or no good way to estimate an unfinished position. It judges a position by sampling many lines of play from it.' },
      { name: 'Expectiminimax', when: 'The game has dice or shuffled cards. Chance is added as a third kind of position whose value is the average of its children.' },
      { id: 'q-learning', name: 'Q-Learning', when: 'The rules or the rewards are not given in advance and have to be learned by trying actions and seeing what happens.' },
      { id: 'a-star', name: 'A* Search', when: 'There is no opponent: you are looking for a route or for the solution to a puzzle.' },
      { name: 'A stored table of solved positions', when: 'The game, or the last few moves of it, is small enough to work out once and look up afterwards.' },
    ],
    comparison: {
      columns: ['', 'Plain minimax', 'Alpha-beta', 'Monte Carlo tree search'],
      rows: [
        ['Value found', 'Exact for the tree searched', 'Exact, and always the same as plain minimax', 'An estimate that improves with more samples'],
        ['Endings examined', 'All b^d', 'From about b^(d/2) up to b^d', 'As many as time allows'],
        ['Depends on move order', 'No', 'Strongly', 'No'],
        ['Suits', 'Tiny games, and checking other methods', 'Board games with a moderate number of moves per position', 'Games with very many moves per position'],
      ],
    },
  },

  applications: [
    { title: 'Chess programs', status: 'established', text: 'Deep Blue, the IBM machine that won a match against the world champion Garry Kasparov in 1997, was built around alpha-beta search running on special-purpose chips. Alpha-beta search to a limited depth, with an evaluation function at the edge, is still the method used by leading chess programs such as Stockfish.' },
    { title: 'Perfect play in small games', status: 'established', text: 'Noughts and crosses has few enough positions for minimax to follow every line to the end, as the demonstration on this page does for one position. Searched from the empty board, it shows that the game is a draw when both sides play well.' },
    { title: 'Computer opponents in board-game apps', status: 'illustrative', text: 'A program that plays Connect Four or draughts against you can be built from alpha-beta search and a simple evaluation function. Its difficulty setting can be the number of moves it is allowed to look ahead.' },
    { title: 'Planning for the worst case', status: 'illustrative', text: 'The same rule, choose the option whose worst outcome is best, is used outside games when the other side is an adversary or bad luck: a security team planning against the most damaging attack, or an engineer choosing a design for the worst load it may meet.' },
  ],

  connections: [
    { to: 'dfs', type: 'prerequisite', why: 'Minimax is depth-first search over the tree of game positions: it follows one line of play to its end, backs up, and tries the next. Depth-first search supplies the order of visiting, and minimax adds a value passed back up.' },
    { to: 'concept:tree', type: 'prerequisite', why: 'Minimax works on a game tree, with the current position at the root, one child for each legal move, and the ends of the game as leaves.' },
    { to: 'concept:recursion', type: 'prerequisite', why: 'The value of a position in minimax is defined by the values of the positions one move later, so the search is a function that calls itself on each child.' },
    { to: 'concept:state-space', type: 'related', why: 'The game tree that minimax searches is the state space of the game, unrolled from the current position one move at a time.' },
    { to: 'concept:backtracking', type: 'related', why: 'Backtracking abandons a partial solution as soon as it cannot succeed. Alpha-beta abandons a position in the minimax search as soon as it cannot change the choice at the root.' },
    { to: 'a-star', type: 'related', why: 'A* and alpha-beta both use a bound to avoid exploring what cannot matter. A* leaves positions whose estimated total cost is too high, and alpha-beta leaves positions whose value is already outside the range that could change the choice. A* searches with no opponent, minimax against one.' },
    { to: 'fibonacci-dp', type: 'related', why: 'Both compute a value at the top of a tree of subproblems from the values below. Fibonacci by dynamic programming stores each subproblem so that it is solved once, and game programs add the same idea to minimax by storing positions reached through different orders of moves.' },
    { to: 'monte-carlo', type: 'related', why: 'Monte Carlo tree search swaps the full minimax search for Monte Carlo estimation: it judges a position by the average result of many sampled lines of play, which works where the tree is too large for alpha-beta.' },
    { to: 'q-learning', type: 'related', why: 'Minimax and Q-learning both give a position a value by looking at the values of the positions that can follow it. Minimax computes them by searching a game whose rules it knows, and Q-learning learns them from experience.' },
    { to: 'discipline:optimization', type: 'application', why: 'Robust optimization picks the design whose worst case is best, the same rule minimax applies to a game tree, and alpha-beta is a form of the branch-and-bound method used there to discard options that a bound already rules out.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'It is Min\'s turn in a position whose three children are worth 3, 8 and 5. What is the position worth?',
      options: ['3', '5', '8', '16'],
      answer: 0,
      explain: [
        'Min takes the lowest value on offer, and Max can do nothing about it once play has reached this position.',
        '5 is the middle value. Neither player has a reason to settle for it: Min can get 3.',
        '8 is what Max would take if it were Max\'s turn. It is Min who chooses here.',
        'The values are not added. One move is made, so the position is worth the value of one child.',
      ],
    },
    {
      type: 'predict',
      q: 'The worked example examined 6 of its 9 endings. Suppose the three groups are given in the opposite order: 6, 3, 1 first, then 2, 9, 8, then 4, 7, 5. What does alpha-beta do now?',
      options: ['Examines 6 endings again and finds 4', 'Examines all 9 endings and finds 4', 'Examines 6 endings and finds a different value', 'Examines 3 endings and finds 4'],
      answer: 1,
      explain: [
        'The cuts in the worked example depended on finding the best move, worth 4, first. Here it comes last, so the earlier groups cannot be judged against it.',
        'The first group is worth only 1, so the second cannot be cut: its first ending, 2, is already better than 1. It turns out to be worth 2, and every ending of the third group is above 2. Nothing is cut. The value is still 4, because the order of the moves never changes the value.',
        'The value cannot change. The tree is the same tree: only the order in which its branches are tried is different.',
        'Three endings is one group. The search cannot know the other two groups are worse without looking at least at their first endings.',
      ],
      tryInput: { tree: 'b3d2', leaves: REVERSED, pruning: true, order: 'given' },
    },
    {
      type: 'debug',
      q: 'This is the Max half of an alpha-beta search. On some trees it returns a lower value than plain minimax does. What is wrong?',
      code: `def max_value(node, alpha, beta):
    if node.is_ending():
        return node.score
    best = float("-inf")
    for child in node.children:
        best = max(best, min_value(child, alpha, beta))
        if best <= alpha:
            break
        alpha = max(alpha, best)
    return best`,
      options: ['The cut test uses the wrong limit: a Max position should be cut when `best >= beta`', '`alpha` should be raised before `best` is updated', 'It should return `alpha` instead of `best`', 'The loop should try the children in reverse order'],
      answer: 0,
      explain: [
        'As written, the loop stops as soon as the first child is no better than what Max already has, although a later child might be far better. The right test stops when `best` is already too good for Min to allow: `best >= beta`.',
        '`alpha` is raised from `best`, so `best` has to be updated first. The order of those two lines is right.',
        'Returning `best` is fine and is what the standard form does. The fault is in when the loop stops.',
        'The order of the children changes how much is cut, never the value. A correct search gives the right value in any order.',
      ],
    },
    {
      type: 'choice',
      q: 'Max is already sure of 5 from an earlier move. In another branch, Min has a reply that scores 3. Why can the rest of that branch be skipped?',
      options: [
        'Because 3 is the lowest score in the tree',
        'Because the branch is now worth 3 or less whatever else it holds, and Max prefers the 5 already in hand',
        'Because Min always chooses the first reply',
        'Because looking further would take too long',
      ],
      answer: 1,
      explain: [
        'Nothing is known about the rest of the tree. The argument needs only the comparison between 3 and 5.',
        'Min chooses in that branch and can take the 3, so other replies matter only if they are lower still. Either way the branch is worse for Max than 5, and Max will not go there.',
        'Min chooses the lowest reply, not the first. The point is that one low reply is enough to settle the comparison.',
        'A cut is not a way of saving time by giving up accuracy. It is made only when the skipped part provably cannot matter.',
      ],
    },
    {
      type: 'choice',
      q: 'Which order of trying moves lets alpha-beta cut the most?',
      options: ['Worst move first', 'Best move first', 'A random order', 'The order makes no difference'],
      answer: 1,
      explain: [
        'A weak first move sets a weak limit, and almost nothing can be cut against it.',
        'A cut needs a strong move already in hand to compare against. With the best move first at every position, the search examines about the square root of the number of endings.',
        'A random order cuts some branches, but fewer than the best order does. The chart on this page shows the gap.',
        'The order makes no difference to the value. It makes a very large difference to the work.',
      ],
    },
    {
      type: 'challenge',
      title: 'Play noughts and crosses perfectly',
      prompt: 'Write a program that plays noughts and crosses from the empty board using minimax with alpha-beta pruning, searching every line to the end. Have it count the endings it examines for its first move, with pruning and without. Then change the scoring so that it prefers a quick win to a slow one and a slow loss to a quick one, and check that it never loses when you play against it.',
      hints: [
        'Represent the board as nine squares. A position is an ending if either player has three in a line or no square is empty.',
        'Score a win as 10 minus the number of moves played and a loss as that number minus 10. A draw scores 0.',
        'With best play by both sides the game is a draw, so the value of the empty board should come out as 0.',
      ],
    },
  ],

  compare: {
    idea: 'Look ahead through the lines of play, assume each player picks what is best for them, and skip any line that provably cannot change the choice.',
    requires: 'A game for two players who take turns, where both can see everything and what is good for one is bad for the other. You need the rules, and a way to score a finished game or to make a fair guess about an unfinished one.',
    sensitivity: 'High for alpha-beta: the order in which moves are tried changes the work from about the square root of the number of endings to all of them. None for plain minimax, which always examines everything.',
    memory: 'Small: O(b·d), the current line of play and the moves at each position on it.',
    difficulty: 'moderate',
    difficultyNote: 'Plain minimax is a few lines of recursion. Pruning adds two tests that are easy to write the wrong way round.',
    limits: 'The number of possible lines of play grows very quickly as you look further ahead, so in a big game it can only look a few moves deep and has to guess from there. It does not handle dice, hidden cards or more than two sides.',
    useWhen: 'You want a program to choose a move in a two-player board game, and the game is small enough to look several moves ahead.',
  },

  advanced: {
    history: 'The rule of choosing the move whose worst outcome is best belongs to the theory of games, where John von Neumann proved the minimax theorem for two-player zero-sum games in 1928. In 1950 Claude Shannon described how a computer could play chess by searching a tree of moves to a limited depth, scoring the positions reached with an evaluation function, and passing the scores back up by the minimax rule. Alpha-beta pruning has no single inventor. Several researchers arrived at it independently in the late 1950s and early 1960s, and its early descriptions were informal. Donald Knuth and Ronald Moore published a thorough analysis in 1975, with a proof of correctness and the count of positions examined when the best move is always tried first. Judea Pearl\'s analysis of 1982 settled how its work grows on randomly ordered trees. In 1997 IBM\'s Deep Blue, built around alpha-beta search on special-purpose chips, won a six-game match against the world chess champion Garry Kasparov.',
    derivation: 'Write $V(p)$ for the minimax value of a position $p$, $u(p)$ for the score of an ending, and $C(p)$ for the children of $p$. Then\n\n$$V(p) = \\begin{cases} u(p) & \\text{if } p \\text{ is an ending} \\\\ \\max_{c \\in C(p)} V(c) & \\text{if Max is to move} \\\\ \\min_{c \\in C(p)} V(c) & \\text{if Min is to move.} \\end{cases}$$\n\nPlain minimax evaluates this definition directly. For alpha-beta, define the clamp of a number to a window, $\\operatorname{clamp}(x, \\alpha, \\beta) = \\max(\\alpha, \\min(\\beta, x))$. The value of the root depends on $V(p)$ only through $\\operatorname{clamp}(V(p), \\alpha, \\beta)$, where $\\alpha$ and $\\beta$ are the limits in force at $p$: if $V(p) \\le \\alpha$, some Max ancestor already has a child worth $\\alpha$ and will not prefer the line through $p$, and if $V(p) \\ge \\beta$, some Min ancestor already has a child worth $\\beta$. So it is enough for the search to return a number $v$ with\n\n- $v = V(p)$ when $\\alpha < v < \\beta$,\n- $V(p) \\le v$ when $v \\le \\alpha$,\n- $V(p) \\ge v$ when $v \\ge \\beta$.\n\nAt a Max position, once the running maximum reaches $\\beta$ the third case already holds whatever the remaining children are worth, because further children can only raise a maximum. That is the cut.',
    proof: '**Claim.** For $\\alpha < \\beta$, the call `search(p, α, β)` returns $v$ satisfying the three conditions above.\n\n**Proof**, by induction on the height of $p$. An ending returns $u(p) = V(p)$, which satisfies all three. Let $p$ be a Max position and suppose the claim holds for its children. The children are searched in order with windows $(\\alpha_i, \\beta)$, where $\\alpha_i$ is $\\alpha$ raised to the running maximum, and a child is searched only while that maximum is below $\\beta$, so every window is valid.\n\n*If the loop is cut* at child $c$, then $v \\ge \\beta$, and $v$ was returned by a child whose result is at least $\\beta > \\alpha_i$. By the induction that child is worth at least what it returned, so $V(p) \\ge V(c) \\ge v$: the third condition.\n\n*If the loop finishes*, $v$ is the largest value returned, and $v < \\beta$ or the cut was triggered by the last child, which is covered above. Every child returned less than $\\beta$, so by the induction each child is worth at most what it returned, giving $V(p) \\le v$. If $v \\le \\alpha$ that is the second condition. If $v > \\alpha$, consider the first child $c$ to return $v$. Its window was $(\\alpha_i, \\beta)$ with $\\alpha_i < v < \\beta$, so by the induction $V(c) = v$, hence $V(p) \\ge v$ and therefore $V(p) = v$: the first condition.\n\nThe Min case follows by exchanging the roles of the two limits. The root is called with $(-\\infty, +\\infty)$, where only the first condition can apply, so the value returned is $V(\\text{root})$. $\\blacksquare$',
    complexityProof: 'Take a uniform tree with $b$ moves per position and depth $d$, and let its value be $v$. To be certain that the value is at least $v$, a search must have seen a full plan for Max: one chosen move at each Max position, and every reply at each Min position. Such a plan contains $b^{\\lfloor d/2 \\rfloor}$ endings, because the tree has $\\lfloor d/2 \\rfloor$ levels at which Min moves. To be certain the value is at most $v$ it must have seen a full plan for Min, which contains $b^{\\lceil d/2 \\rceil}$ endings. The two plans share exactly one ending, the one reached when both are followed. So any method that proves the value examines at least\n\n$$b^{\\lceil d/2 \\rceil} + b^{\\lfloor d/2 \\rfloor} - 1$$\n\nendings. When the best move is tried first at every position, alpha-beta examines exactly these and no others, which is the result of Knuth and Moore. For even $d$ the count is $2b^{d/2} - 1$, about twice the square root of $b^d$. Put the other way round: in the time plain minimax needs to look $d$ moves ahead, alpha-beta with ideal ordering looks about $2d$ moves ahead.',
    variants: [
      { name: 'Negamax', text: 'Scores every position from the point of view of the player to move and negates the value at each level, so that one function serves both players.' },
      { name: 'Depth-limited search with an evaluation function', text: 'Stops a fixed number of moves ahead and returns an estimate of the position. This is the form used for every game too large to finish.' },
      { name: 'Iterative deepening', text: 'Searches to depth 1, then 2, then 3, and so on until time runs out. The best move from each search is tried first in the next, which improves the cuts enough to repay the repeated work.' },
      { name: 'Transposition table', text: 'Stores the result for each position searched, with a note of whether it is exact or a limit, so that a position reached again by another order of moves need not be searched again.' },
      { name: 'Principal variation search', text: 'Searches the first move with a full window and the rest with a window of zero width, which only tests whether a move can beat the first. A move that passes the test is searched again properly.' },
      { name: 'Quiescence search', text: 'At the depth limit, keeps following captures and other forcing moves until the position is quiet, so that the evaluation is not taken in the middle of an exchange.' },
      { name: 'Expectiminimax', text: 'Adds chance positions, such as a roll of the dice, whose value is the probability-weighted average of their children.' },
    ],
    implementation: 'Generate moves on the way down and undo them on the way back up, so that only one board is kept in memory. Keep the search in negamax form to avoid maintaining two copies of the logic. Sort or at least partly order the moves before searching them. When results are stored in a transposition table, store with each value whether it is exact, a lower limit or an upper limit, and use it only in a way that respects that. Test the pruned search against plain minimax on many small random trees: the two must always return the same value.',
    benchmarking: 'Report positions or endings examined as well as time, and state the move ordering used, since it changes the count by a large factor. Compare searches at equal depth, or at equal time with the depth reached. When testing playing strength, changes should be judged over many games, because single games are decided by chance details.',
    references: [
      { authors: 'J. von Neumann', year: 1928, title: 'Zur Theorie der Gesellschaftsspiele', venue: 'Mathematische Annalen 100, 295-320' },
      { authors: 'C. E. Shannon', year: 1950, title: 'Programming a computer for playing chess', venue: 'Philosophical Magazine, Series 7, 41(314), 256-275' },
      { authors: 'D. E. Knuth and R. W. Moore', year: 1975, title: 'An analysis of alpha-beta pruning', venue: 'Artificial Intelligence 6(4), 293-326' },
      { authors: 'J. Pearl', year: 1982, title: 'The solution for the branching factor of the alpha-beta pruning algorithm and its optimality', venue: 'Communications of the ACM 25(8), 559-564' },
      { authors: 'M. Campbell, A. J. Hoane Jr. and F.-h. Hsu', year: 2002, title: 'Deep Blue', venue: 'Artificial Intelligence 134(1-2), 57-83' },
    ],
    furtherReading: [
      'S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, the chapter on adversarial search and games.',
      'J. Pearl, *Heuristics: Intelligent Search Strategies for Computer Problem Solving* (Addison-Wesley, 1984), the chapters on game trees.',
    ],
  },

  tests: [
    { name: 'the worked example: value 4 after 6 of 9 endings, with the 9, 8 and 1 skipped', input: { tree: 'b3d2', leaves: WORKED, pruning: true, order: 'given' },
      check: (r, c) => {
        const ok = conclusionsHold(r);
        if (ok !== true) return ok;
        const skippedScores = r.nodes.filter((n) => n.leaf).map((n, i) => (n.kind === 'pruned' ? WORKED[i] : null)).filter((x) => x !== null);
        return (r.value === 4 && c['endings examined'] === 6 && r.skipped === 3 && c.cuts === 2 && skippedScores.join() === '9,8,1' && r.bestMove === 'B') || `value ${r.value}, examined ${c['endings examined']}, skipped ${skippedScores}`;
      } },
    { name: 'the worked example without pruning examines all 9 endings and gives the same value', input: { tree: 'b3d2', leaves: WORKED, pruning: false, order: 'given' },
      check: (r, c) => (conclusionsHold(r) === true && r.value === 4 && c['endings examined'] === 9 && r.skipped === 0 && !c.cuts) || `value ${r.value}, examined ${c['endings examined']}` },
    { name: 'the predicted run: with the groups reversed nothing is cut and the value is still 4', input: { tree: 'b3d2', leaves: REVERSED, pruning: true, order: 'given' },
      check: (r, c) => (conclusionsHold(r) === true && r.value === 4 && c['endings examined'] === 9 && r.skipped === 0) || `value ${r.value}, examined ${c['endings examined']}` },
    { name: 'alpha-beta agrees with plain minimax and with an independent reference on 1,600 seeded trees, and never examines more endings', input: { tree: 'b2d4', seed: 16, leaves: [], pruning: true, order: 'given' },
      check: (r) => {
        if (conclusionsHold(r) !== true) return conclusionsHold(r);
        for (const [branching, depth] of [[2, 4], [2, 3], [3, 2], [3, 3]]) {
          for (let seed = 1; seed <= 200; seed++) {
            for (const order of ['given', 'best']) {
              const pruned = silentRun({ branching, depth, seed, order, pruning: true });
              const plain = silentRun({ branching, depth, seed, order, pruning: false });
              const reference = referenceValue(pruned.tree, true);
              const where = `${branching} choices, ${depth} deep, seed ${seed}, order ${order}`;
              if (pruned.value !== reference || plain.value !== reference) return `${where}: alpha-beta ${pruned.value}, plain ${plain.value}, reference ${reference}`;
              if (plain.examined !== plain.total) return `${where}: plain minimax examined ${plain.examined} of ${plain.total}`;
              if (pruned.examined > plain.examined) return `${where}: alpha-beta examined more endings than plain minimax`;
              const sound = conclusionsHold(pruned);
              if (sound !== true) return `${where}: ${sound}`;
            }
          }
        }
        return true;
      } },
    { name: 'with the best move first, exactly b^⌈d/2⌉ + b^⌊d/2⌋ − 1 endings are examined', input: { tree: 'b2d4', seed: 16, leaves: [], pruning: true, order: 'best' },
      check: (r, c) => {
        if (c['endings examined'] !== 7 || conclusionsHold(r) !== true) return `the 16-ending tree examined ${c['endings examined']}, expected 7`;
        for (const [b, d] of [[2, 3], [2, 7], [2, 10], [3, 2], [3, 5], [4, 4], [5, 3]]) {
          for (let seed = 1; seed <= 20; seed++) {
            const best = silentRun({ depth: d, branching: b, seed, order: 'best' });
            const formula = b ** Math.ceil(d / 2) + b ** Math.floor(d / 2) - 1;
            if (best.examined !== formula) return `b=${b}, d=${d}, seed ${seed}: examined ${best.examined}, formula gives ${formula}`;
            if (best.value !== referenceValue(best.tree, true)) return `b=${b}, d=${d}, seed ${seed}: wrong value`;
          }
        }
        return true;
      } },
    { name: 'noughts and crosses: X must block on square 7, the game is a draw, and 4 of 6 endings are examined', input: { tree: 'ttt', leaves: [], pruning: true, order: 'given' },
      check: (r, c) => (conclusionsHold(r) === true && r.value === 0 && r.bestMove === 7 && r.total === 6 && c['endings examined'] === 4 && c.cuts === 2) || `value ${r.value}, move ${r.bestMove}, examined ${c['endings examined']} of ${r.total}` },
    { name: 'noughts and crosses without pruning reaches the same value from all 6 endings', input: { tree: 'ttt', leaves: [], pruning: false, order: 'given' },
      check: (r, c) => (conclusionsHold(r) === true && r.value === 0 && r.bestMove === 7 && c['endings examined'] === 6) || `value ${r.value}, examined ${c['endings examined']}` },
  ],
};
