import { makeRng } from '../../js/lib/rng.js';

// Grid worlds. S is where every episode starts, G the goal, H the hazard, # a wall.
const WORLDS = {
  room: { label: 'Small room with a wall (3 by 4)', map: ['...G', '.#.H', 'S...'] },
  open: { label: 'Open room, hazard in the middle (4 by 5)', map: ['....G', '.....', '..H..', 'S....'] },
  cliff: { label: 'Cliff edge (3 by 6)', map: ['......', '......', 'SHHHHG'] },
};
const MOVES = [
  { name: 'up', dr: -1, dc: 0 },
  { name: 'right', dr: 0, dc: 1 },
  { name: 'down', dr: 1, dc: 0 },
  { name: 'left', dr: 0, dc: -1 },
];
const GOAL_REWARD = 10, HAZARD_REWARD = -10;
const STEP_LIMIT = 100;       // an episode that wanders this long is stopped
const DETAIL_CHANGES = 8;     // episodes are shown one update at a time until this many values have changed

function readWorld(id) {
  const def = WORLDS[id] || WORLDS.room;
  const rows = def.map.length, cols = def.map[0].length;
  const kind = [];
  let start = 0;
  def.map.forEach((line, r) => [...line].forEach((ch, c) => {
    kind.push(ch === '#' ? 'wall' : ch === 'G' ? 'goal' : ch === 'H' ? 'hazard' : 'free');
    if (ch === 'S') start = r * cols + c;
  }));
  return { id: WORLDS[id] ? id : 'room', rows, cols, kind, start, n: rows * cols };
}
const cellName = (w, s) => `${String.fromCharCode(65 + (s % w.cols))}${Math.floor(s / w.cols) + 1}`;
const terminal = (w, s) => w.kind[s] === 'goal' || w.kind[s] === 'hazard';

// What happens when the agent tries a move: where it ends up and the reward it gets.
function tryMove(w, s, a) {
  const r = Math.floor(s / w.cols) + MOVES[a].dr, c = (s % w.cols) + MOVES[a].dc;
  if (r < 0 || r >= w.rows || c < 0 || c >= w.cols) return { next: s, reward: 0, bump: 'edge' };
  const next = r * w.cols + c;
  if (w.kind[next] === 'wall') return { next: s, reward: 0, bump: 'wall' };
  return { next, reward: w.kind[next] === 'goal' ? GOAL_REWARD : w.kind[next] === 'hazard' ? HAZARD_REWARD : 0, bump: null };
}

// The exact values, found by value iteration. It is given the whole map and the rewards,
// which the learning agent never is, and it shares no code with the learning loop: it has
// its own copy of the rules of movement. The demonstration uses it only to measure how far
// the learned table is from the truth, and the tests use it as the reference answer.
function exactValues(w, gamma) {
  const V = new Float64Array(w.n);
  const land = (s, a) => {
    const row = Math.floor(s / w.cols) + [-1, 0, 1, 0][a], col = (s % w.cols) + [0, 1, 0, -1][a];
    const inside = row >= 0 && row < w.rows && col >= 0 && col < w.cols && w.kind[row * w.cols + col] !== 'wall';
    return inside ? row * w.cols + col : s;
  };
  const pay = (s2, s) => (s2 === s ? 0 : w.kind[s2] === 'goal' ? 10 : w.kind[s2] === 'hazard' ? -10 : 0);
  const moveValue = (s, a) => { const s2 = land(s, a); return pay(s2, s) + (w.kind[s2] === 'free' ? gamma * V[s2] : 0); };
  for (let sweep = 0; sweep < 10000; sweep++) {
    let change = 0;
    for (let s = 0; s < w.n; s++) {
      if (w.kind[s] !== 'free') continue;
      const best = Math.max(moveValue(s, 0), moveValue(s, 1), moveValue(s, 2), moveValue(s, 3));
      change = Math.max(change, Math.abs(best - V[s]));
      V[s] = best;
    }
    if (change < 1e-12) break;
  }
  const Q = new Float64Array(w.n * 4);
  for (let s = 0; s < w.n; s++) if (w.kind[s] === 'free') for (let a = 0; a < 4; a++) Q[s * 4 + a] = moveValue(s, a);
  return Q;
}

// The fewest moves from the start to the goal, by breadth-first search that avoids the hazard.
function shortestRoute(w) {
  const dist = new Map([[w.start, 0]]);
  const queue = [w.start];
  for (let k = 0; k < queue.length; k++) {
    const s = queue[k];
    if (w.kind[s] === 'goal') return dist.get(s);
    for (let a = 0; a < 4; a++) {
      const { next } = tryMove(w, s, a);
      if (next === s || w.kind[next] === 'hazard' || dist.has(next)) continue;
      dist.set(next, dist.get(s) + 1);
      queue.push(next);
    }
  }
  return Infinity;
}

const num = (x, places = 3) => {
  const v = Math.round(x * 10 ** places) / 10 ** places;
  const s = String(Math.abs(v));
  return (v < 0 ? '−' : '') + s;
};

function run(input, t) {
  const w = readWorld(input.world);
  const alpha = Number(input.alpha), gamma = Number(input.gamma), epsilon = Number(input.epsilon);
  const episodes = Math.max(1, Math.floor(input.episodes));
  const rng = makeRng(input.seed * 7919 + w.n);
  const Q = new Float64Array(w.n * 4);
  const tried = new Int32Array(w.n * 4);
  const lastTried = new Int32Array(w.n * 4);   // the episode in which each move was last made
  const exact = exactValues(w, gamma);
  const free = [];
  for (let s = 0; s < w.n; s++) if (w.kind[s] === 'free') free.push(s);
  const meanGap = () => { let sum = 0; for (const s of free) for (let a = 0; a < 4; a++) sum += Math.abs(Q[s * 4 + a] - exact[s * 4 + a]); return sum / (free.length * 4); };
  const gapHistory = [[0, meanGap()]];
  const firstGap = gapHistory[0][1];
  const pct = Math.round(epsilon * 100);
  const g = num(gamma), al = num(alpha);
  let updates = 0, goals = 0, hazards = 0, timeouts = 0, shownChanges = 0, spreadExplained = false;
  const log = [];               // the first updates, with every number that went into them

  const bestAt = (s) => Math.max(Q[s * 4], Q[s * 4 + 1], Q[s * 4 + 2], Q[s * 4 + 3]);
  const legend = [{ label: 'value above 0', role: 'forest' }, { label: 'value below 0', role: 'brick' }, { label: 'value just updated', role: 'current' }, { label: 'the agent', role: 'ink' }, { label: 'path this episode', role: 'ochre' }, { label: 'wall', role: 'wall' }];
  const off = (p) => [p[0] + 0.14, p[1] + 0.14];   // paths are drawn a little off centre so they do not cross the numbers
  const corners = (s) => { const c = s % w.cols, y = w.rows - 1 - Math.floor(s / w.cols); return { c, y, mid: [c + 0.5, y + 0.5] }; };
  const triangle = (s, a) => {
    const { c, y, mid } = corners(s);
    const tl = [c, y + 1], tr = [c + 1, y + 1], br = [c + 1, y], bl = [c, y];
    return [mid, ...[[tl, tr], [tr, br], [br, bl], [bl, tl]][a]];
  };
  const textAt = (s, a) => { const { c, y } = corners(s); return [[c + 0.5, y + 0.8], [c + 0.79, y + 0.5], [c + 0.5, y + 0.2], [c + 0.21, y + 0.5]][a]; };

  const worldView = ({ agent = null, lit = null, trail = null, route = null, arrows = false, title } = {}) => {
    const layers = [];
    const lines = [], diagonals = [];
    for (let s = 0; s < w.n; s++) {
      const { c, y } = corners(s);
      if (w.kind[s] === 'wall') layers.push({ type: 'rect', x: c, y, w: 1, h: 1, role: 'wall' });
      else if (w.kind[s] === 'goal') layers.push({ type: 'rect', x: c, y, w: 1, h: 1, role: 'forest', fillAlpha: 0.4 });
      else if (w.kind[s] === 'hazard') layers.push({ type: 'rect', x: c, y, w: 1, h: 1, role: 'brick', fillAlpha: 0.4 });
      else {
        for (let a = 0; a < 4; a++) {
          const q = Q[s * 4 + a];
          if (q !== 0) layers.push({ type: 'polygon', points: triangle(s, a), role: q > 0 ? 'forest' : 'brick', fill: true, fillAlpha: 0.1 + 0.55 * Math.min(1, Math.abs(q) / 10), stroke: false });
        }
        diagonals.push([c, y, c + 1, y + 1], [c, y + 1, c + 1, y]);
      }
      lines.push([c, y, c + 1, y], [c, y + 1, c + 1, y + 1], [c, y, c, y + 1], [c + 1, y, c + 1, y + 1]);
    }
    layers.push({ type: 'segments', segments: diagonals, role: 'faint', width: 0.7, alpha: 0.5 });
    layers.push({ type: 'segments', segments: lines, role: 'muted', width: 1, alpha: 0.6 });
    if (lit) layers.push({ type: 'polygon', points: triangle(lit.s, lit.a), role: 'current', fill: true, fillAlpha: 0.3, width: 2.5 });
    if (trail && trail.length > 1) layers.push({ type: 'line', points: trail.map((s) => off(corners(s).mid)), role: 'ochre', width: 2, alpha: 0.75 });
    if (route && route.length > 1) layers.push({ type: 'line', points: route.map((s) => off(corners(s).mid)), role: 'path', width: 5, alpha: 0.85 });
    if (arrows) {
      const segs = [];
      for (const s of free) {
        if (route && route.includes(s)) continue;
        const best = bestAt(s);
        const top = [0, 1, 2, 3].filter((k) => Q[s * 4 + k] === best);
        if (top.length !== 1) continue;      // no single best move: the table has nothing definite to say here
        const a = top[0];
        const { mid } = corners(s);
        segs.push([mid[0], mid[1], mid[0] + 0.13 * MOVES[a].dc, mid[1] - 0.13 * MOVES[a].dr]);
      }
      layers.push({ type: 'segments', segments: segs, role: 'ink', width: 2, arrow: true });
    }
    for (let s = 0; s < w.n; s++) {
      const { c, y } = corners(s);
      if (w.kind[s] === 'goal') layers.push({ type: 'text', at: [c + 0.5, y + 0.2], text: 'GOAL +10', role: 'text', align: 'center', dy: 4, size: 12 });
      else if (w.kind[s] === 'hazard') layers.push({ type: 'text', at: [c + 0.5, y + 0.2], text: 'HAZARD −10', role: 'text', align: 'center', dy: 4, size: 12 });
      else if (w.kind[s] === 'free') {
        for (let a = 0; a < 4; a++) {
          layers.push({ type: 'text', at: textAt(s, a), text: tried[s * 4 + a] ? num(Q[s * 4 + a], 2) : '·', role: tried[s * 4 + a] ? 'text' : 'faint', align: 'center', dy: 4, size: 11 });
        }
      }
    }
    for (let c = 0; c < w.cols; c++) layers.push({ type: 'text', at: [c + 0.5, w.rows + 0.08], text: String.fromCharCode(65 + c), role: 'muted', align: 'center', size: 11 });
    for (let r = 0; r < w.rows; r++) layers.push({ type: 'text', at: [-0.12, w.rows - 1 - r + 0.5], text: String(r + 1), role: 'muted', align: 'center', dy: 4, size: 11 });
    if (agent !== null) layers.push({ type: 'points', points: [{ x: corners(agent).mid[0], y: corners(agent).mid[1], r: 8 }], role: 'ink', ring: true });
    else layers.push({ type: 'points', points: [{ x: corners(w.start).mid[0], y: corners(w.start).mid[1], r: 4 }], role: 'ink', hollow: true });
    return { kind: 'scene', x: [-0.25, w.cols], y: [0, w.rows + 0.25], equal: true, axes: false, aspect: Math.min(0.78, (w.rows + 0.25) / (w.cols + 0.25)), layers, legend,
      title: title || 'Each cell holds four values, one for each move out of it: up, right, down, left. A dot means that move has never been tried.' };
  };
  const tallyRow = (episode) => ({ label: 'So far', cells: [{ t: episode, sub: 'episode' }, { t: updates, sub: 'updates' }, { t: goals, sub: 'reached the goal', role: goals ? 'done' : 'default' }, { t: hazards, sub: 'hit the hazard', role: hazards ? 'rejected' : 'default' }, ...(timeouts ? [{ t: timeouts, sub: 'ran out of steps' }] : [])] });
  const chart = () => ({ kind: 'scene', aspect: 0.2, x: [0, episodes], y: [0, Math.max(...gapHistory.map((p) => p[1])) * 1.08 || 1], axes: { xLabel: 'episode', yLabel: 'average gap' },
    title: 'How far the table is from the exact values, averaged over every move in every cell. The agent cannot see this. The exact values were worked out separately, with full knowledge of the map.',
    layers: [{ type: 'line', points: gapHistory.map((p) => [p[0], p[1]]), role: 'terracotta', width: 2 }] });

  t.frame(() => ({ line: [0, 1],
    note: `The agent starts in **${cellName(w, w.start)}**, the cell with the small ring. It can move up, right, down or left. Reaching the goal pays +10 and stepping into the hazard pays −10. Either one ends the episode, and the agent is put back at the start. Every other step pays 0. The agent is not told any of this. It keeps a table with one value for each move in each cell, all 0 to begin with, and corrects one value after every step. It will run ${episodes} ${episodes === 1 ? 'episode' : 'episodes'}, exploring at random on ${pct}% of its steps.`,
    views: [worldView(), { kind: 'rows', title: 'Progress', rows: [tallyRow(0)] }, chart()], vars: { 'ε (explore)': num(epsilon), 'α (learning rate)': al, 'γ (discount)': g } }));

  // what has happened since the last step that was shown
  let since = { from: 1, episodes: 0, updates: 0, goals: 0, hazards: 0, timeouts: 0 };
  const sampleEvery = Math.max(1, Math.ceil((episodes - 12) / 14));
  const showEpisode = (ep) => ep === episodes || ep <= 12 || (ep - 12) % sampleEvery === 0;

  for (let ep = 1; ep <= episodes; ep++) {
    let s = w.start;
    const trail = [s];
    let steps = 0, explored = 0, changed = 0, ending = 'limit';
    let quiet = [];             // consecutive updates that changed nothing, folded into one step
    const detailed = shownChanges < DETAIL_CHANGES;
    const flushQuiet = () => {
      if (!quiet.length) return;
      const batch = quiet;
      quiet = [];
      const allZero = batch.every((u) => u.old === 0 && u.target === 0);
      const here = s, soFar = trail.slice(), rewardSeen = goals + hazards > 0;
      t.frame(() => ({ line: [4, 7, 8, 9],
        note: `Episode ${ep}. The agent takes ${batch.length === 1 ? 'one more step' : `${batch.length} more steps`} (${batch.slice(0, 8).map((u) => u.move).join(', ')}${batch.length > 8 ? ', and so on' : ''}) and is now in ${cellName(w, here)}. ${batch.length === 1 ? 'The update changed nothing' : 'None of the updates changed anything'}: ${allZero ? `each time the reward was 0 and the best value in the cell it arrived at was 0, so the target was 0, the same as the value already in the table. ${rewardSeen ? 'The few values learned so far lie elsewhere, and a value can only be passed back from a cell that has one.' : 'Until a reward has been seen there is nothing to learn from.'}` : 'each time the target came out equal to the value already in the table.'}`,
        views: [worldView({ agent: here, trail: soFar }), { kind: 'rows', title: 'Progress', rows: [tallyRow(ep)] }, chart()], vars: { episode: ep, step: steps } }));
    };

    while (!terminal(w, s) && steps < STEP_LIMIT) {
      // choose a move: explore with probability epsilon, otherwise the highest value, ties broken at random
      let a, how;
      const best = bestAt(s);
      if (rng.next() < epsilon) { a = rng.int(0, 3); how = 'explore'; explored++; } else {
        const ties = [0, 1, 2, 3].filter((k) => Q[s * 4 + k] === best);
        a = ties.length === 1 ? ties[0] : ties[rng.int(0, ties.length - 1)];
        how = ties.length === 1 ? 'best' : 'tie';
      }
      const { next, reward, bump } = tryMove(w, s, a);
      const done = terminal(w, next);
      const old = Q[s * 4 + a];
      const ahead = done ? 0 : bestAt(next);
      const target = done ? reward : reward + gamma * ahead;
      const fresh = old + alpha * (target - old);
      Q[s * 4 + a] = fresh;
      tried[s * 4 + a]++;
      lastTried[s * 4 + a] = ep;
      updates++;
      steps++;
      t.count('updates');
      if (fresh !== old) changed++;
      if (log.length < 400) log.push({ cell: s, move: a, reward, next, done, old, ahead, target, fresh });
      const from = s;
      s = next;
      trail.push(s);
      if (done) ending = w.kind[next];

      if (detailed) {
        const individually = fresh !== old || done || (ep === 1 && steps <= 2);
        if (!individually) quiet.push({ move: MOVES[a].name, old, target });
        else {
          flushQuiet();
          if (fresh !== old) shownChanges++;
          const spread = !done && fresh !== old;
          const firstSpread = spread && !spreadExplained;
          if (spread) spreadExplained = true;
          const soFar = trail.slice(), stepNo = steps, wasBest = best;
          t.frame(() => {
            const choice = how === 'explore'
              ? `This is one of the ${pct}% of steps on which it explores, so it picks a move at random: ${MOVES[a].name}.`
              : how === 'best'
                ? `It takes the move with the highest value there: ${MOVES[a].name}, at ${num(wasBest)}.`
                : `Its highest values there are tied at ${num(wasBest)}${wasBest === 0 ? ', because it has learned nothing in favour of any of them yet' : ''}, so it picks one of the tied moves at random: ${MOVES[a].name}.`;
            const moved = bump ? `That runs into ${bump === 'wall' ? 'the wall' : 'the edge of the world'}, so it stays in ${cellName(w, from)}, with reward 0.`
              : done ? (reward > 0 ? 'That reaches the **goal**: reward +10, and the episode ends.' : 'That is the **hazard**: reward −10, and the episode ends.')
                : `It arrives in ${cellName(w, next)}, with reward 0.`;
            const aim = done
              ? `The target for "${MOVES[a].name} from ${cellName(w, from)}" is the reward alone, ${num(reward)}, because nothing comes after the end of an episode.`
              : `The target for "${MOVES[a].name} from ${cellName(w, from)}" is the reward plus ${g} times the best value in ${cellName(w, next)}: ${num(reward)} + ${g} × ${num(ahead)} = ${num(target)}.`;
            const result = `The old value was ${num(old)}. Move it ${Math.round(alpha * 100)}% of the way to the target: ${num(old)} + ${al} × (${num(target)} − ${num(old)}) = **${num(fresh)}**.${fresh === old ? ' Nothing changes: no reward has been seen near here yet, so there is nothing to pass back.' : firstSpread ? ` No reward was paid on this step. The value came from the cell ahead, which learned it on an earlier visit. This is how a reward spreads backwards through the table, one cell at a time.` : spread ? ' Again the change comes from the cell ahead, not from a reward.' : ''}`;
            return { line: how === 'explore' ? [5, 7, 8, 9] : [6, 7, 8, 9],
              note: `Episode ${ep}, step ${stepNo}. The agent is in **${cellName(w, from)}**. ${choice} ${moved} ${aim} ${result}`,
              views: [worldView({ agent: next, lit: { s: from, a }, trail: soFar }),
                { kind: 'rows', title: 'The update, number by number', rows: [
                  { label: 'This update', cells: [{ t: num(old), sub: 'old value' }, { t: num(reward), sub: 'reward' }, { t: done ? 'none' : num(ahead), sub: 'best value in the new cell' }, { t: num(target), sub: done ? 'target = reward' : `target = reward + ${g} × best` }, { t: num(fresh), sub: 'new value', role: 'current' }] },
                  tallyRow(ep)] },
                chart()],
              vars: { episode: ep, step: stepNo, cell: cellName(w, from), move: MOVES[a].name, reward: num(reward), target: num(target), 'new value': num(fresh) } };
          });
        }
      }
    }
    if (detailed) flushQuiet();
    if (ending === 'goal') goals++; else if (ending === 'hazard') hazards++; else timeouts++;
    since.episodes++; since.updates += steps;
    if (ending === 'goal') since.goals++; else if (ending === 'hazard') since.hazards++; else since.timeouts++;
    gapHistory.push([ep, meanGap()]);

    if (detailed) {
      const end = s, soFar = trail.slice(), nChanged = changed, nSteps = steps, how = ending;
      t.frame(() => ({ line: [2, 3],
        note: `Episode ${ep} is over after ${nSteps} ${nSteps === 1 ? 'step' : 'steps'}: ${how === 'goal' ? 'the agent reached the goal' : how === 'hazard' ? 'the agent stepped into the hazard' : `the agent wandered for ${STEP_LIMIT} steps without reaching the goal or the hazard and was stopped`}. ${nChanged === 0 ? 'No value in the table changed.' : nChanged === 1 ? 'Only one value in the table changed.' : `${nChanged} values in the table changed.`} ${ep === 1 ? 'One update changes one value, and it can only draw on the reward just received and the cell just entered, so the first episodes change very little. The agent goes back to the start and tries again.' : 'The values next to the goal and the hazard are learned first. Each later visit can carry a value one cell further back.'}`,
        views: [worldView({ agent: end, trail: soFar }), { kind: 'rows', title: 'Progress', rows: [tallyRow(ep)] }, chart()], vars: { episode: ep, steps: nSteps, 'values changed': nChanged } }));
      since = { from: ep + 1, episodes: 0, updates: 0, goals: 0, hazards: 0, timeouts: 0 };
    } else if (showEpisode(ep)) {
      const end = s, soFar = trail.slice(), block = since, nSteps = steps, nExplored = explored, how = ending;
      const gapNow = gapHistory[gapHistory.length - 1][1];
      const startBest = bestAt(w.start), startExact = Math.max(exact[w.start * 4], exact[w.start * 4 + 1], exact[w.start * 4 + 2], exact[w.start * 4 + 3]);
      t.frame(() => {
        const ended = (k, what) => `${k} ${what}`;
        const lead = block.episodes === 1
          ? `Episode ${ep}: ${nSteps} ${nSteps === 1 ? 'step' : 'steps'}, ${nExplored} of them random, and ${nSteps} ${nSteps === 1 ? 'update' : 'updates'} of the same kind as before. The agent ${how === 'goal' ? 'reached the goal' : how === 'hazard' ? 'stepped into the hazard' : 'ran out of steps'}.`
          : `Episodes ${block.from} to ${ep}: ${block.episodes} more runs from the start and ${block.updates} more updates of the same kind. ${[block.goals ? ended(block.goals, 'reached the goal') : '', block.hazards ? ended(block.hazards, 'ended in the hazard') : '', block.timeouts ? ended(block.timeouts, 'ran out of steps') : ''].filter(Boolean).join(', ')}. The path drawn is the last of them.`;
        return { line: [2, 3, 4],
          note: `${lead} The best value at the start is now ${num(startBest, 2)}, and the exact value is ${num(startExact, 2)}. The average gap between the table and the exact values is ${num(gapNow, 2)}.`,
          views: [worldView({ agent: end, trail: soFar }), { kind: 'rows', title: 'Progress', rows: [tallyRow(ep)] }, chart()], vars: { episode: ep, 'best value at start': num(startBest, 2), 'average gap': num(gapNow, 2) } };
      });
      since = { from: ep + 1, episodes: 0, updates: 0, goals: 0, hazards: 0, timeouts: 0 };
    }
  }

  // The route the finished table gives: from the start, always take the highest value. Ties go to the first move in the order up, right, down, left.
  const route = [w.start];
  const routeMoves = [];
  let outcome = 'goal';
  for (let s = w.start; ;) {
    const best = bestAt(s);
    const a = [0, 1, 2, 3].find((k) => Q[s * 4 + k] === best);
    const { next } = tryMove(w, s, a);
    routeMoves.push(MOVES[a].name);
    if (next === s) { outcome = 'stuck'; break; }
    if (route.includes(next)) { route.push(next); outcome = 'loop'; break; }
    route.push(next);
    if (w.kind[next] === 'goal') break;
    if (w.kind[next] === 'hazard') { outcome = 'hazard'; break; }
    s = next;
  }
  const shortest = shortestRoute(w);
  const gapOf = (i) => Math.abs(Q[i] - exact[i]);
  let worst = free[0] * 4;
  for (const s of free) for (let a = 0; a < 4; a++) if (gapOf(s * 4 + a) > gapOf(worst)) worst = s * 4 + a;
  const maxGap = gapOf(worst);
  let routeGap = 0;
  if (outcome === 'goal') route.slice(0, -1).forEach((s, k) => { routeGap = Math.max(routeGap, gapOf(s * 4 + MOVES.findIndex((m) => m.name === routeMoves[k]))); });
  let untried = 0;
  for (const s of free) for (let a = 0; a < 4; a++) if (!tried[s * 4 + a]) untried++;
  const finalGap = meanGap();

  t.frame(() => {
    const said = routeMoves.length > 14 ? `${routeMoves.slice(0, 14).join(', ')}, and so on` : routeMoves.join(', ');
    const verdict = outcome === 'goal'
      ? `That gives ${said}: **${routeMoves.length} moves to the goal**. ${routeMoves.length === shortest ? `No route is shorter than ${shortest} moves, so the agent has found a best route.` : `The shortest route takes only ${shortest}. The agent has settled for a longer way round${epsilon === 0 ? ', and since it never explores it will never find out that a shorter one exists' : ''}.`}`
      : outcome === 'hazard' ? `That gives ${said}, which walks **into the hazard**. The table is not good enough to act on yet.`
        : outcome === 'loop' ? `That gives ${said}, which comes back to a cell it has already been in and would go round for ever. The table **does not yet lead to the goal**.`
          : `In ${cellName(w, route[route.length - 1])} the highest value belongs to a move into a wall or the edge, so the agent would stand still. The table **does not yet lead to the goal**.`;
    return { line: 11,
      note: `Training is over: ${episodes} ${episodes === 1 ? 'episode' : 'episodes'}, ${updates} updates. Now stop exploring and, from the start, always take the move with the highest value. ${verdict} An arrow marks the best move in each other cell where one move has come out ahead of the rest.`,
      views: [worldView({ route, arrows: true, title: 'The finished table. The thick line is the route it gives from the start. An arrow marks the best move in each other cell where one stands out.' }), { kind: 'rows', title: 'Progress', rows: [tallyRow(episodes)] }, chart()],
      vars: { 'route length': outcome === 'goal' ? routeMoves.length : 'no route', 'shortest possible': shortest } };
  });
  t.frame(() => {
    const ws = Math.floor(worst / 4), wa = worst % 4;
    return { line: null,
      note: `How good is the table itself? The exact values were worked out separately by value iteration, a method that is handed the map and the rewards. ${outcome === 'goal' ? `Along the route, the learned values are within ${num(Math.max(routeGap, 0.001), 3)} of the exact ones. ` : ''}The largest gap anywhere is ${num(maxGap, 2)}, for "${MOVES[wa].name} from ${cellName(w, ws)}", a move the agent ${tried[worst] === 0 ? 'never tried' : `tried ${tried[worst] === 1 ? 'once' : `${tried[worst]} times`}, the last time in episode ${lastTried[worst]}`}. ${untried ? `${untried} of the ${free.length * 4} moves ${untried === 1 ? 'was' : 'were'} never tried at all. ` : 'Every move was tried at least once. '}${maxGap < 0.01 ? 'The table has learned the exact values, to two decimal places, without ever being shown the map.' : 'A value is only as good as the number of times its move has been tried, and the moves the agent seldom makes stay rough. More exploring fills them in, at the price of more wasted steps while learning.'}`,
      views: [worldView({ route, arrows: true, title: 'The finished table. The thick line is the route it gives from the start. An arrow marks the best move in each other cell where one stands out.' }),
        { kind: 'rows', title: 'The table against the exact values', rows: [{ label: 'Gap', cells: [...(outcome === 'goal' ? [{ t: num(routeGap, 3), sub: 'largest on the route', role: 'done' }] : []), { t: num(maxGap, 2), sub: 'largest anywhere' }, { t: num(finalGap, 2), sub: 'average' }, { t: untried, sub: 'moves never tried' }] }] },
        chart()],
      vars: { 'largest gap': num(maxGap, 3), 'average gap': num(finalGap, 3) } };
  });

  return {
    world: w.id, rows: w.rows, cols: w.cols, kinds: w.kind.slice(), start: w.start,
    alpha, gamma, epsilon, episodes, updates, goals, hazards, timeouts,
    Q: Array.from(Q), exact: Array.from(exact), tried: Array.from(tried),
    route, routeMoves, outcome, shortest, maxGap, routeGap, meanGap: finalGap, untried, log,
  };
}

// Checks shared by the tests.
const quiet = { count() {}, frame() {} };
const DEFAULTS = { world: 'room', epsilon: 0.2, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 };
const silentRun = (input) => run({ ...DEFAULTS, ...input }, quiet);
// The exact values must satisfy the rule that defines them. This check has its own copy of the rules of movement.
function exactIsConsistent(r) {
  const at = (s, a) => {
    const row = Math.floor(s / r.cols) + (a === 0 ? -1 : a === 2 ? 1 : 0), col = (s % r.cols) + (a === 1 ? 1 : a === 3 ? -1 : 0);
    if (row < 0 || row >= r.rows || col < 0 || col >= r.cols || r.kinds[row * r.cols + col] === 'wall') return s;
    return row * r.cols + col;
  };
  for (let s = 0; s < r.kinds.length; s++) {
    if (r.kinds[s] !== 'free') continue;
    for (let a = 0; a < 4; a++) {
      const s2 = at(s, a);
      const want = r.kinds[s2] === 'goal' ? 10 : r.kinds[s2] === 'hazard' ? -10 : r.gamma * Math.max(...r.exact.slice(s2 * 4, s2 * 4 + 4));
      if (Math.abs(r.exact[s * 4 + a] - want) > 1e-9) return `the reference value for cell ${s}, move ${a} is ${r.exact[s * 4 + a]}, but the rule gives ${want}`;
    }
  }
  return true;
}
// Every learned value within `tolerance` of the exact one, and the route read off the table is a shortest one.
function learnedExactly(r, tolerance) {
  const consistent = exactIsConsistent(r);
  if (consistent !== true) return consistent;
  let worst = 0;
  for (let i = 0; i < r.Q.length; i++) worst = Math.max(worst, Math.abs(r.Q[i] - r.exact[i]));
  if (worst > tolerance) return `the largest gap from the exact values is ${worst}, above the tolerance of ${tolerance}`;
  return routeIsShortest(r);
}
function routeIsShortest(r) {
  if (r.outcome !== 'goal') return `the route read off the table ends in "${r.outcome}", not at the goal`;
  if (r.kinds[r.route[r.route.length - 1]] !== 'goal') return 'the route does not end on the goal cell';
  for (let i = 1; i < r.route.length; i++) {
    const a = r.route[i - 1], b = r.route[i];
    if (Math.abs(Math.floor(a / r.cols) - Math.floor(b / r.cols)) + Math.abs((a % r.cols) - (b % r.cols)) !== 1) return 'the route jumps between cells that are not neighbours';
    if (r.kinds[b] === 'wall' || r.kinds[b] === 'hazard') return 'the route passes through a wall or the hazard';
  }
  return r.routeMoves.length === r.shortest || `the route takes ${r.routeMoves.length} moves, the shortest takes ${r.shortest}`;
}

export default {
  meta: {
    id: 'q-learning',
    name: 'Q-Learning',
    aliases: ['Q learning', 'reinforcement learning', 'tabular Q-learning', 'temporal-difference learning', 'TD learning', 'learning from rewards'],
    kind: 'algorithm',
    discipline: 'ai',
    alsoIn: [
      { id: 'machine-learning', why: 'It is the usual first example of reinforcement learning, the branch of machine learning that learns from rewards instead of from labelled examples.' },
      { id: 'robotics', why: 'A robot can use it to learn which action to take in each situation by trial and error, when nobody can write down exactly how its actions will turn out.' },
    ],
    subfield: 'Reinforcement learning',
    family: 'Temporal-difference learning',
    lab: 'machine-learning',
    year: 1989,
    authors: 'Christopher Watkins',
    summary: 'Learns how good each action is in each situation by trying actions, seeing the reward, and nudging a table of values toward what it has just experienced.',
    difficulty: 'intermediate',
    order: 268,
    paradigms: ['iterative-refinement', 'dynamic-programming', 'randomized-sampling'],
    randomized: true,
    approximate: true,
    time: { best: 'O(A) per step, for A actions', average: 'O(A) per step', worst: 'No fixed number of steps: the values converge in the limit', class: 'iterative' },
    space: { worst: 'O(S·A)', class: 'linear' },
    tags: {
      problems: ['learn by trial and error', 'teach a program to reach a goal using only rewards', 'learn which action is best in each situation', 'train an agent to avoid danger and find a reward', 'make good decisions without being told the rules', 'learn from a reward that only arrives at the end'],
      techniques: ['value table', 'temporal-difference update', 'epsilon-greedy exploration', 'discounting', 'Bellman equation'],
      applications: ['machine learning', 'robotics', 'games'],
    },
    prerequisites: ['concept:state-space', 'concept:dynamic-programming', 'concept:learning-rate', 'concept:exploration-exploitation'],
  },

  bigIdea: {
    simple: "Q-learning is a way for a computer to learn what to do by trying things and seeing what happens. Nobody tells it the rules. Picture a robot in a room it has never seen. Somewhere there is a prize, and somewhere a hole it can fall into. The robot keeps a notebook. For every spot in the room, and every direction it could step from that spot, the notebook holds one number: its guess at how well things will turn out if it steps that way. At first every guess is zero. The robot wanders. When a step wins the prize, it raises the number for that step. When a step lands in the hole, it lowers it. And here is what makes it work. When a step only leads to a spot that already has a good number, part of that goodness is copied back to the step. So good numbers spread, one step at a time, from the prize back to the start. In the end the robot follows the biggest number from each spot. Now and then it still tries a random step, in case a better way exists.",
    when: "Use it when an agent has to choose one action after another, the result of an action can only be found out by trying it, and the situations and actions are few enough to list in a table: a small maze, a simple game, a machine with a handful of settings. If the rules and rewards are already known there is no need to learn by trial. The same values can be computed directly by dynamic programming, or a route can be found with [A* search](#/algorithm/a-star). If there are too many situations to list, the table has to give way to a function that estimates the values, usually a neural network, and that is much harder to train.",
    interesting: "The agent learns the best way to act without acting that way. Its update asks what the best next move would be worth, whichever move it actually makes next. So an agent that wanders completely at random still ends up with a table that describes the best route. This is called off-policy learning, and the demonstration shows it: set the exploration rate to 1 in the small room and the route read off the table at the end is still a shortest one.",
    analogy: {
      title: 'Signposts in a park with no map',
      text: "You walk in a large park with no map, looking for the café. At every junction stands a signpost with one blank space for each path. The first time a path brings you straight to the café, you write a high number in that path's space. Later you arrive at an earlier junction and take a path that leads to a junction whose best number is already high. You write a slightly lower number for the path that got you there. Walk after walk, the numbers spread outward from the café. In the end, from any junction, you can reach the café by following the highest number on each signpost.",
      limits: "A person would remember the whole walk and start to picture the map. Q-learning remembers nothing except the numbers, and after each step it changes only the one number for the step just taken, using only the next signpost. That is why it is slow: one walk moves what has been learned back by a single junction. The picture also hides the gamble at every junction, between following the best number and trying a path whose number is low or blank, which is the only way to find out that a signpost is wrong. And a park stays put. If the same path could lead to different places on different days, each number would have to become an average over many tries.",
    },
  },

  example: {
    setup: "A robot is in a short corridor: cell B, then cell C, then the goal. Reaching the goal gives a reward of 10. Every other step gives 0. The robot keeps one number for the move \"right\" in each cell, its guess at how good that move is. Both numbers start at 0. After each step it moves one number halfway toward a target. The target is the reward it just got, plus 0.9 times the best number in the cell it arrived in. (The 0.9 says that a reward one step away is worth a little less than a reward in hand.)",
    steps: [
      "First run. From B the robot steps right to C. The reward is 0, and C's number is still 0, so the target is 0 + 0.9 × 0 = 0. B's number stays 0.",
      "From C it steps right into the goal. The reward is 10, and nothing comes after the goal, so the target is 10. C's number moves halfway from 0 to 10: it becomes 5.",
      "Second run. From B it steps right to C. The reward is 0, but C's number is now 5, so the target is 0 + 0.9 × 5 = 4.5. B's number moves halfway from 0 to 4.5: it becomes 2.25.",
      "From C into the goal again. The target is 10. C's number moves halfway from 5 to 10: it becomes 7.5.",
      "Keep going. C's number closes in on 10, and B's on 0.9 × 10 = 9.",
    ],
    result: "After two runs the numbers are 2.25 for B and 7.5 for C, on their way to 9 and 10. Notice the order in which they appeared. The cell next to the goal learned first, and the cell before it could only learn once that had happened. News of the reward travels backwards from the goal, one cell per run. The demonstration produces exactly these numbers in cells B1 and C1 of its top row during its first two episodes.",
    tryInput: { world: 'room', epsilon: 0.2, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 },
  },

  terms: [
    { term: "Agent", meaning: "The learner that chooses what to do: here, the robot moving through the grid." },
    { term: "State", meaning: "The situation the agent is in. In a grid world it is the cell the agent stands on." },
    { term: "Action", meaning: "One of the things the agent can do in a state: here, a move up, right, down or left." },
    { term: "Reward", meaning: "A number the agent is given after an action, saying how good the result was. It can be negative." },
    { term: "Episode", meaning: "One attempt, from the start until the agent reaches the goal or the hazard." },
    { term: "Value of a move (Q-value)", meaning: "The agent's current guess at the total reward it will collect if it makes that move from that state and acts as well as it can afterwards." },
    { term: "Q-table", meaning: "The table holding one value for every move in every state." },
    { term: "Learning rate", meaning: "How far a value is moved toward its target in one update: 0.5 means halfway." },
    { term: "Discount", meaning: "A number below 1 that makes a reward count for less the more steps away it is." },
    { term: "Exploration rate", meaning: "The share of steps on which the agent ignores its table and moves at random, to find out about moves it would not otherwise try." },
  ],

  takeaway: "After every step, nudge your guess for that step toward the reward you got plus the best you now expect from where you landed, and good guesses will spread back from the reward.",

  viz: {
    describe: 'A small grid world seen from above. The agent is a dark dot, the goal cell is green and marked +10, the hazard cell is brick red and marked −10, and walls are dark blocks. Every other cell is divided into four triangles, one for each move out of it (up, right, down, left), and each triangle shows the value the agent currently holds for that move. A dot means the move has never been tried. Triangles shade green as a value rises above zero and brick red as it falls below. The triangle just updated is outlined in terracotta, and an ochre line traces the agent\'s path in the current episode. Under the grid, a row gives the numbers that went into the latest update, and a small chart shows the average difference between the table and the exact values, episode by episode. At the end the route the table gives is drawn as a thick green line, with arrows for the best move in the other cells.',
    inputs: [
      { id: 'world', type: 'select', label: 'World', options: Object.entries(WORLDS).map(([value, def]) => ({ value, label: def.label })), default: 'room' },
      { id: 'epsilon', type: 'range', label: 'Exploration rate (ε)', min: 0, max: 1, step: 0.05, default: 0.2,
        help: 'The share of steps on which the agent moves at random instead of following its table. 0 never explores. 1 always does.' },
      { id: 'alpha', type: 'range', label: 'Learning rate (α)', min: 0.1, max: 1, step: 0.1, default: 0.5,
        help: 'How far each update moves a value toward its target. 1 replaces the old value outright.' },
      { id: 'gamma', type: 'range', label: 'Discount (γ)', min: 0.5, max: 0.95, step: 0.05, default: 0.9,
        help: 'How much a reward one step further away is worth. Lower values make the agent care more about getting there quickly.' },
      { id: 'episodes', type: 'range', label: 'Episodes', min: 5, max: 3000, step: 5, default: 200 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 40 },
    ],
    presets: [
      { label: 'Small room, exploring 1 step in 5', values: { world: 'room', epsilon: 0.2, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 } },
      { label: 'Small room, always exploring', values: { world: 'room', epsilon: 1, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 } },
      { label: 'Small room, never exploring', values: { world: 'room', epsilon: 0, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 } },
      { label: 'Cliff edge, never exploring', values: { world: 'cliff', epsilon: 0, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 1 } },
      { label: 'Cliff edge, exploring 1 step in 5', values: { world: 'cliff', epsilon: 0.2, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 1 } },
      { label: 'Open room', values: { world: 'open', epsilon: 0.2, alpha: 0.5, gamma: 0.9, episodes: 300, seed: 5 } },
    ],
    tryThis: [
      'Step through the first four episodes of the default run and watch the top row. The value of "right from C1" goes 5, 7.5, 8.75. Only after C1 has a value does B1 get one, and only then A1.',
      'Load the three "Small room" presets in turn and compare the last step of each. All three give a 5-move route. Without exploring, 12 of the 36 moves were never tried and the average gap from the exact values stays above 6. With constant exploring every value is exact, but look at the tally: the agent itself ended 135 of its 200 episodes in the hazard, because it never used what it had learned.',
      'Load "Cliff edge, never exploring" and then "Cliff edge, exploring 1 step in 5". Without exploring the agent keeps the first route that worked, 9 moves long. With exploring it finds the 7-move route along the edge of the cliff.',
      'In the small room, set the learning rate to 1. Each value now jumps straight to its target. In a world with no chance in it that is the fastest setting. Then try 0.1 and watch how many more episodes the chart takes to come down.',
      'Lower the discount to 0.5 and compare the values near the start with the ones you saw at 0.9. A reward four steps away is now worth very little, so the values far from the goal are small and close together.',
    ],
    run,
    report: (r) => `After ${r.episodes} episodes and ${r.updates} updates: ${r.goals} reached the goal, ${r.hazards} hit the hazard${r.timeouts ? `, ${r.timeouts} ran out of steps` : ''}.\nRoute from the finished table: ${r.outcome === 'goal' ? `${r.routeMoves.join(', ')} (${r.routeMoves.length} moves; the shortest possible is ${r.shortest})` : r.outcome === 'hazard' ? 'leads into the hazard' : 'does not reach the goal'}.\nGap from the exact values: largest ${r.maxGap.toFixed(3)}, average ${r.meanGap.toFixed(3)}. Moves never tried: ${r.untried}.`,
    experiment: {
      title: 'Steps taken while training, for three exploration rates',
      note: 'Each point is a real training run in the small room, counting every step the agent took, which is also the number of updates. An agent that mostly follows its table soon needs little more than the 5 steps of the shortest route per episode. An agent that always moves at random never gets quicker, so its total grows in proportion to the number of episodes: that is the price of its better table. The dashed line is 5 steps per episode, drawn for comparison.',
      metric: 'updates',
      metricLabel: 'Steps taken (updates)',
      sizeLabel: 'Episodes of training',
      sizes: [50, 100, 200, 400, 800, 1600],
      variants: [
        { id: 'low', label: 'Explores on 5% of steps' },
        { id: 'mid', label: 'Explores on 20% of steps' },
        { id: 'all', label: 'Always explores' },
      ],
      input: (n, variant, seed) => ({ world: 'room', epsilon: { low: 0.05, mid: 0.2, all: 1 }[variant], alpha: 0.5, gamma: 0.9, episodes: n, seed }),
      theory: [
        { label: 'proportional to the number of episodes (scaled)', fn: (n) => n, scaled: true, variant: 'all' },
        { label: '5 steps per episode, the shortest route', fn: (n) => 5 * n, reference: true },
      ],
    },
  },

  logic: {
    intuition: 'Write `Q(s, a)` for the total reward to expect from taking action `a` in state `s` and then acting as well as possible, with later rewards counted for less. If those numbers were known, acting well would be easy: in each state, take the action with the largest one. They also obey a consistency rule. The value of an action is the reward it pays plus the discounted value of the best action in the state it leads to. Q-learning turns that rule into a correction. After each step it works out "reward plus discounted best next value" from what has just happened, compares it with the entry in the table, and moves the entry part of the way toward it. Entries next to a reward are corrected by the reward itself. Entries further away are corrected by their neighbours. Done often enough, everywhere, the table settles on the one set of numbers that satisfies the rule.',
    steps: [
      'Set every `Q(s, a)` to 0. Any starting values will do.',
      'Put the agent in the start state.',
      'Choose an action. With probability `ε`, pick one at random (explore). Otherwise pick the action with the highest value in the current state (exploit), breaking ties at random.',
      'Take the action. Observe the reward `r` and the new state `s′`.',
      'Compute the target: `r + γ · max Q(s′, a′)`, the maximum being over the actions `a′` available in `s′`. If `s′` ends the episode, the target is just `r`.',
      'Move the entry toward the target: `Q(s, a) ← Q(s, a) + α · (target − Q(s, a))`.',
      'Continue from `s′`. When an episode ends, go back to step 2. Stop after a set number of episodes, or when the values have stopped changing.',
    ],
    pseudocode: [
      'q_learning(world, α, γ, ε, episodes):',
      '  Q[s][a] ← 0 for every state s and action a',
      '  repeat for each episode:',
      '    s ← the start state',
      '    while s does not end the episode:',
      '      with probability ε: a ← a random action',
      '      otherwise: a ← the action with the highest Q[s][a]',
      '      take action a; observe reward r and new state s′',
      '      target ← r + γ · max over a′ of Q[s′][a′]     // just r if s′ ends the episode',
      '      Q[s][a] ← Q[s][a] + α · (target − Q[s][a])',
      '      s ← s′',
      '  return Q',
    ],
    decisions: [
      { title: 'How much to explore?', text: 'With no exploring the agent keeps the first route that works and never learns whether a better one exists. With constant exploring it learns every value but never makes use of them. A common compromise is to start with a high exploration rate and lower it as training goes on.' },
      { title: 'How large a learning rate?', text: 'In a world where the same action always has the same result, as on this page, a rate of 1 is best: each target is exact given the values it is built from, so there is nothing to average. Where results vary by chance, a target is one noisy sample, and the rate must be small, or shrink over time, so that the entry settles on the average.' },
      { title: 'How much to discount?', text: 'A discount close to 1 makes the agent weigh distant rewards almost as much as near ones. A lower one makes it impatient. In a task that never ends, the discount must be below 1 or the totals would grow without limit. On this page it is also the only thing that makes a shorter route worth more than a longer one, because ordinary steps cost nothing.' },
      { title: 'What rewards to give?', text: 'The agent pursues exactly what is rewarded. Here only the goal and the hazard pay anything. Charging a small cost for every step is a common alternative that also favours short routes. Rewarding something that merely looks like progress can teach the agent to collect that reward for ever and never finish.' },
      { title: 'What starting values?', text: 'Zeros are neutral. Starting every entry high makes untried moves look attractive, which pushes the agent to try everything once without any random exploring.' },
    ],
    invariants: [
      'An entry changes only when its own action is taken in its own state. Everything else in the table is left alone.',
      'With rewards between −10 and +10, a table that starts at 0 and a learning rate of at most 1, every entry stays between −10 and +10: each new value lies between the old value and a target that is itself in that range.',
      'The exact values are a resting point. If every entry equals its exact value, every target equals the entry it is compared with, and no update changes anything.',
    ],
    edgeCases: [
      'No exploring at all: once one route has been learned the agent follows it every time and never tries the rest. The cliff world shows it settling on a route two moves longer than necessary.',
      'A move that is never tried keeps its starting value, however long training runs. The final table can have a correct route and many meaningless entries beside it.',
      'An agent that cannot find the goal or the hazard would wander for ever, so an episode is cut off after 100 steps. The updates made before the cut are still valid.',
      'A reward that comes only at the very end is slow to learn from, because each visit passes the news back by one state.',
      'Two moves with equal values: the route read off the table takes the first in a fixed order. During training, ties are broken at random so that the agent does not walk into the same wall for ever.',
      'A world with chance in it, such as a floor on which the agent sometimes slips: a learning rate of 1 would make each entry copy the latest lucky or unlucky result.',
    ],
    correctness: 'The exact values are defined by one rule, the Bellman optimality equation: the value of an action equals the expected reward plus the discounted value of the best action in the next state. With a discount below 1 that rule has exactly one solution. Each update replaces an entry by a mixture of its old value and a fresh sample of the right-hand side of the rule. Watkins and Dayan proved in 1992 that if every action is tried in every state again and again without end, and the learning rates shrink at a suitable pace, the table converges to that solution with probability 1, whatever the agent does in between. That last clause is why exploring matters, and also why it is safe: the update uses the best next value, not the value of the move the agent goes on to make, so random moves do not distort what is learned. In a world without chance the argument is simpler. Every target is exactly right once the entries it depends on are right. The entries next to the goal and the hazard depend on nothing else, so they close in on their exact values first, and each further ring of entries follows the ring before it.',
    mistakes: [
      'Building the target from the value of the move the agent actually makes next, instead of the best value in the new state. That is a different algorithm, SARSA, which learns how good the exploring behaviour is, not how good the best behaviour would be.',
      'Adding a discounted next value when the new state has ended the episode. Nothing follows the end, so the target there is the reward alone.',
      'Always breaking ties in favour of the first action. An agent with a table of zeros then repeats the same move for ever.',
      'Judging the agent by the rewards it earns while training. Those include its random steps. Test it with exploring switched off.',
      'Switching exploring off too early, which freezes whatever route happens to have been found.',
      'Updating the entry for the new state instead of the state the action was taken from.',
    ],
  },

  code: {
    sample: {
      input: 'The 3 by 4 room from the demonstration: S is the start, G the goal (+10), H the hazard (−10) and # a wall. The agent trains for 2,000 episodes with a learning rate of 0.5, a discount of 0.9 and random moves on 30% of its steps, using a small fixed random number generator. The program prints the best move it has learned for each cell, the value of the best move at the start, and the route that follows.',
      expected: '2000 episodes, 14185 updates\n> > > G\n^ # ^ H\n^ > ^ <\nValue of the best move at the start: 6.561\nRoute: up, up, right, right, right',
    },
    python: {
      source: `WORLD = ["...G",
         ".#.H",
         "S..."]
ROWS, COLS = len(WORLD), len(WORLD[0])
MOVES = [(-1, 0), (0, 1), (1, 0), (0, -1)]      # up, right, down, left
NAMES = ["up", "right", "down", "left"]
ALPHA, GAMMA = 0.5, 0.9
EXPLORE_PERCENT = 30
EPISODES, STEP_LIMIT = 2000, 100

seed = 2024


def rand():
    """A small fixed random number generator, written out so every language agrees."""
    global seed
    seed = seed * 48271 % 2147483647
    return seed


def step(cell, move):
    """Try a move. Returns the new cell, the reward, and whether the episode is over."""
    r, c = cell // COLS + MOVES[move][0], cell % COLS + MOVES[move][1]
    if not (0 <= r < ROWS and 0 <= c < COLS) or WORLD[r][c] == "#":
        return cell, 0.0, False
    if WORLD[r][c] == "G":
        return r * COLS + c, 10.0, True
    if WORLD[r][c] == "H":
        return r * COLS + c, -10.0, True
    return r * COLS + c, 0.0, False


def choose(values):
    if rand() % 100 < EXPLORE_PERCENT:
        return rand() % 4
    best = [m for m in range(4) if values[m] == max(values)]
    return best[rand() % len(best)]


start = "".join(WORLD).index("S")
q = [[0.0] * 4 for _ in range(ROWS * COLS)]
updates = 0
for episode in range(EPISODES):
    cell, over, steps = start, False, 0
    while not over and steps < STEP_LIMIT:
        move = choose(q[cell])
        new_cell, reward, over = step(cell, move)
        target = reward if over else reward + GAMMA * max(q[new_cell])
        q[cell][move] += ALPHA * (target - q[cell][move])
        cell = new_cell
        steps += 1
        updates += 1

print(f"{EPISODES} episodes, {updates} updates")
for r in range(ROWS):
    row = []
    for c in range(COLS):
        values = q[r * COLS + c]
        row.append("^>v<"[values.index(max(values))] if WORLD[r][c] in ".S" else WORLD[r][c])
    print(" ".join(row))
print(f"Value of the best move at the start: {max(q[start]):.3f}")
route, cell, over = [], start, False
while not over and len(route) < 20:
    move = q[cell].index(max(q[cell]))
    route.append(NAMES[move])
    cell, _, over = step(cell, move)
print("Route: " + ", ".join(route))`,
      notes: [
        { line: 24, text: 'A move into a wall or off the edge leaves the agent where it is, with no reward. The agent is never told why it did not move.' },
        { line: 34, text: 'Explore: on 30 steps in 100, ignore the table and move at random.' },
        { line: 36, text: 'Exploit: otherwise take a move with the highest value. When several are tied, as they all are at the start, one of them is picked at random.' },
        { line: 48, text: 'The target. If the episode is over it is the reward alone. Otherwise it is the reward plus the discounted value of the best move in the new cell, whichever move the agent goes on to make.' },
        { line: 49, text: 'The update: move this one entry a fraction `ALPHA` of the way from its old value to the target. Nothing else in the table changes.' },
        { line: 64, text: 'To use what has been learned, stop exploring and take the highest value in each cell.' },
      ],
    },
    javascript: {
      source: `const WORLD = ["...G",
               ".#.H",
               "S..."];
const ROWS = WORLD.length, COLS = WORLD[0].length;
const MOVES = [[-1, 0], [0, 1], [1, 0], [0, -1]];   // up, right, down, left
const NAMES = ["up", "right", "down", "left"];
const ALPHA = 0.5, GAMMA = 0.9;
const EXPLORE_PERCENT = 30;
const EPISODES = 2000, STEP_LIMIT = 100;

let seed = 2024;

// A small fixed random number generator, written out so every language agrees.
function rand() {
  seed = (seed * 48271) % 2147483647;
  return seed;
}

// Try a move. Returns the new cell, the reward, and whether the episode is over.
function step(cell, move) {
  const r = Math.floor(cell / COLS) + MOVES[move][0], c = (cell % COLS) + MOVES[move][1];
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS || WORLD[r][c] === "#") return [cell, 0, false];
  if (WORLD[r][c] === "G") return [r * COLS + c, 10, true];
  if (WORLD[r][c] === "H") return [r * COLS + c, -10, true];
  return [r * COLS + c, 0, false];
}

function choose(values) {
  if (rand() % 100 < EXPLORE_PERCENT) return rand() % 4;
  const top = Math.max(...values);
  const best = [0, 1, 2, 3].filter((m) => values[m] === top);
  return best[rand() % best.length];
}

const start = WORLD.join("").indexOf("S");
const q = Array.from({ length: ROWS * COLS }, () => [0, 0, 0, 0]);
let updates = 0;
for (let episode = 0; episode < EPISODES; episode++) {
  let cell = start, over = false, steps = 0;
  while (!over && steps < STEP_LIMIT) {
    const move = choose(q[cell]);
    const [newCell, reward, done] = step(cell, move);
    const target = done ? reward : reward + GAMMA * Math.max(...q[newCell]);
    q[cell][move] += ALPHA * (target - q[cell][move]);
    cell = newCell;
    over = done;
    steps += 1;
    updates += 1;
  }
}

console.log(EPISODES + " episodes, " + updates + " updates");
for (let r = 0; r < ROWS; r++) {
  const row = [];
  for (let c = 0; c < COLS; c++) {
    const values = q[r * COLS + c];
    row.push(".S".includes(WORLD[r][c]) ? "^>v<"[values.indexOf(Math.max(...values))] : WORLD[r][c]);
  }
  console.log(row.join(" "));
}
console.log("Value of the best move at the start: " + Math.max(...q[start]).toFixed(3));
const route = [];
let cell = start, over = false;
while (!over && route.length < 20) {
  const move = q[cell].indexOf(Math.max(...q[cell]));
  route.push(NAMES[move]);
  [cell, , over] = step(cell, move);
}
console.log("Route: " + route.join(", "));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <array>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

const std::vector<std::string> WORLD = {"...G",
                                        ".#.H",
                                        "S..."};
const int ROWS = 3, COLS = 4;
const int MOVES[4][2] = {{-1, 0}, {0, 1}, {1, 0}, {0, -1}};  // up, right, down, left
const std::string NAMES[4] = {"up", "right", "down", "left"};
const double ALPHA = 0.5, GAMMA = 0.9;
const int EXPLORE_PERCENT = 30;
const int EPISODES = 2000, STEP_LIMIT = 100;

long long seed = 2024;

// A small fixed random number generator, written out so every language agrees.
int rnd() {
    seed = seed * 48271 % 2147483647;
    return static_cast<int>(seed);
}

struct Outcome {
    int cell;
    double reward;
    bool over;
};

// Try a move. Returns the new cell, the reward, and whether the episode is over.
Outcome step(int cell, int move) {
    int r = cell / COLS + MOVES[move][0], c = cell % COLS + MOVES[move][1];
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || WORLD[r][c] == '#') return {cell, 0.0, false};
    if (WORLD[r][c] == 'G') return {r * COLS + c, 10.0, true};
    if (WORLD[r][c] == 'H') return {r * COLS + c, -10.0, true};
    return {r * COLS + c, 0.0, false};
}

double highest(const std::array<double, 4>& values) {
    return *std::max_element(values.begin(), values.end());
}

int choose(const std::array<double, 4>& values) {
    if (rnd() % 100 < EXPLORE_PERCENT) return rnd() % 4;
    std::vector<int> best;
    for (int m = 0; m < 4; ++m) {
        if (values[m] == highest(values)) best.push_back(m);
    }
    return best[rnd() % static_cast<int>(best.size())];
}

int main() {
    int start = 0;
    for (int i = 0; i < ROWS * COLS; ++i) {
        if (WORLD[i / COLS][i % COLS] == 'S') start = i;
    }
    std::vector<std::array<double, 4>> q(ROWS * COLS, std::array<double, 4>{0.0, 0.0, 0.0, 0.0});
    int updates = 0;
    for (int episode = 0; episode < EPISODES; ++episode) {
        int cell = start, steps = 0;
        bool over = false;
        while (!over && steps < STEP_LIMIT) {
            int move = choose(q[cell]);
            Outcome result = step(cell, move);
            double ahead = GAMMA * highest(q[result.cell]);
            double target = result.over ? result.reward : result.reward + ahead;
            double change = ALPHA * (target - q[cell][move]);
            q[cell][move] += change;
            cell = result.cell;
            over = result.over;
            ++steps;
            ++updates;
        }
    }

    std::cout << EPISODES << " episodes, " << updates << " updates\\n";
    for (int r = 0; r < ROWS; ++r) {
        for (int c = 0; c < COLS; ++c) {
            const auto& values = q[r * COLS + c];
            char mark = WORLD[r][c];
            if (mark == '.' || mark == 'S') {
                mark = "^>v<"[std::max_element(values.begin(), values.end()) - values.begin()];
            }
            std::cout << mark << (c + 1 < COLS ? " " : "\\n");
        }
    }
    std::cout << "Value of the best move at the start: " << std::fixed << std::setprecision(3) << highest(q[start]) << "\\n";
    std::cout << "Route: ";
    int cell = start, moves = 0;
    bool over = false;
    while (!over && moves < 20) {
        int move = static_cast<int>(std::max_element(q[cell].begin(), q[cell].end()) - q[cell].begin());
        Outcome result = step(cell, move);
        std::cout << (moves ? ", " : "") << NAMES[move];
        cell = result.cell;
        over = result.over;
        ++moves;
    }
    std::cout << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One update is cheap: a table lookup, and a maximum over the actions of one state. What costs is the number of steps the agent must take before the table is any good, and that depends on the world, the rewards, the settings and luck. No general formula gives it.',
    cases: [
      { case: 'One update', time: 'O(A)', when: 'Finding the best value in the new state looks once at each of its A actions. Everything else is constant work.' },
      { case: 'A reward k steps away', time: 'At least k updates along the way', when: 'Each update passes a value back by one state, so a state k steps from the only reward cannot learn of it until k separate updates have carried it there.' },
      { case: 'Always exploring', time: 'Proportional to the number of episodes', when: 'An agent that never uses its table takes the same average number of steps in its last episode as in its first. The chart on this page measures this.' },
      { case: 'Convergence', time: 'Only in the limit', when: 'The table is guaranteed to reach the exact values only as every action in every state is tried without limit. After any finite amount of training it is an approximation.' },
    ],
    space: 'O(S·A): one number for each action in each state. The demonstration\'s small room has 9 open cells and 4 moves, so 36 numbers.',
    memory: 'The table is the whole memory, and its size is the trouble. The number of states is the product of the possibilities of everything that describes a situation. A board of 20 squares that can each be empty or hold one of two kinds of piece already has 3 to the power 20 states, about 3.5 billion. Beyond small problems the table is replaced by a function that estimates values from a description of the state.',
    tradeoffs: 'More exploring gives a more complete and accurate table and costs more steps, many of them wasted or harmful. A larger learning rate learns faster and, where results vary by chance, less steadily. A discount nearer 1 looks further ahead and takes longer to settle.',
    assumptions: [
      'The state tells the agent everything that matters for what happens next. If it does not, the same table entry has to stand for situations that differ, and the values can be wrong however long training lasts.',
      'States and actions are few enough to keep one number for each pair.',
      'The worlds on this page have no chance in them: a move from a cell always leads to the same place. The guarantee of convergence in a world with chance also needs learning rates that shrink over time.',
      'The chart counts steps taken in this implementation, in one small world, with one random seed for each point. It illustrates the cost of exploring. It is not a general benchmark.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Problems with very many states, where a table cannot be stored and most of its entries would never be visited anyway.',
      'Rewards that are rare or arrive late. The agent wanders with nothing to learn from until it stumbles on one.',
      'Tasks where trying things is slow, costly or dangerous, since it needs a great many tries and some of them go badly.',
      'Situations the agent cannot fully observe, where two different states look the same to it.',
      'Worlds with a lot of chance. Taking the maximum of noisy estimates tends to pick out the ones that are too high, so values are overestimated.',
    ],
    pitfalls: [
      'A reward that does not quite mean what was intended. The agent will maximise the reward as given, including any loophole in it.',
      'Measuring performance during training, with random steps included, and concluding that the agent has learned less than it has.',
      'Lowering the exploration rate too quickly.',
      'Treating the end of an episode like any other state when building the target.',
    ],
    misunderstandings: [
      "\"The agent has to behave well in order to learn well.\" It does not. The update is built from the best next value, not from what the agent does next, so even an agent moving entirely at random learns the values of the best behaviour.",
      "\"The numbers in the table are rewards.\" They are predictions of all the reward still to come, discounted by how far off it is. A cell three steps from the goal has a high value although stepping out of it pays nothing.",
      "\"Once the route is right, the table is right.\" The route depends only on which value is largest in a few cells. The values of moves the agent seldom makes can be far off, or still blank.",
      "\"Exploring is wasted effort once a route has been found.\" Without it the agent cannot find out that a shorter route exists, or notice if the world changes.",
    ],
    constraints: [
      'Training is usually done in a simulation, where a million tries cost little and a fall harms nothing, and the result is then moved to the real machine.',
      'Where tries are scarce, each experience is stored and replayed many times instead of being used for one update and thrown away.',
      'An agent that must be safe while it learns cannot be allowed to explore freely.',
    ],
    alternatives: [
      { name: 'Value iteration', when: 'The rules and rewards are known. It computes the same values directly, by sweeping over every state, with no trial and error. This page uses it as the reference answer.' },
      { name: 'SARSA', when: 'It matters how the agent does while it is still exploring. SARSA learns the value of the behaviour actually followed, random steps included, so it keeps further from a hazard.' },
      { name: 'Deep Q-learning', when: 'The states are too many to list, such as images. A neural network takes the place of the table.' },
      { id: 'a-star', name: 'A* Search', when: 'The map is known and all you need is a route.' },
      { id: 'minimax', name: 'Minimax with Alpha-Beta Pruning', when: 'The task is a two-player game with known rules that can be searched a few moves ahead.' },
      { name: 'Policy gradient methods', when: 'The actions are continuous, such as the force on a motor, so there is no list of actions to take a maximum over.' },
    ],
    comparison: {
      columns: ['', 'Q-learning', 'Value iteration', 'SARSA'],
      rows: [
        ['Needs the rules in advance', 'No', 'Yes', 'No'],
        ['Learns from', 'The steps it takes', 'Sweeps over every state', 'The steps it takes'],
        ['The values describe', 'The best possible behaviour', 'The best possible behaviour', 'The behaviour being followed, exploring included'],
        ['Affected by how it explores', 'Only in how fast it learns', 'Does not explore', 'In what it learns as well'],
      ],
    },
  },

  applications: [
    { title: 'Playing video games from the screen', status: 'established', text: 'In 2015 researchers at DeepMind combined Q-learning with a deep neural network in place of the table. One program, given only the screen image and the score, learned to play dozens of Atari 2600 games, many of them about as well as a human tester or better.' },
    { title: 'A model of learning in the brain', status: 'established', text: 'The quantity at the centre of the update, the gap between what was expected and what happened, is used by neuroscientists as a model of signals carried by dopamine neurons. Recordings from those neurons show activity that rises when a reward is better than predicted and falls when it is worse.' },
    { title: 'Robot skills learned by trial', status: 'illustrative', text: 'A robot that has to learn when to push, grip or step can be trained by reward, usually in simulation first because real tries are slow and wear the machine. With more than a few sensors the table must be replaced by a function that estimates values.' },
    { title: 'Tuning a controller', status: 'illustrative', text: 'A system with a few settings and a measurable result, such as a set of traffic lights or a heating schedule, can be framed as states, actions and a reward. The agent tries settings and keeps the ones that score well over time.' },
  ],

  connections: [
    { to: 'concept:exploration-exploitation', type: 'prerequisite', why: 'Every step of Q-learning is a choice between using the best value known so far and trying something else to learn more. The exploration rate sets the balance.' },
    { to: 'concept:learning-rate', type: 'prerequisite', why: 'Each Q-learning update moves a value a fixed fraction of the way toward its target, and that fraction is a learning rate: too large and the value chases every sample, too small and it learns slowly.' },
    { to: 'concept:dynamic-programming', type: 'prerequisite', why: 'Q-learning rests on the idea behind dynamic programming: the value of a state can be built from the values of the states that follow it. Dynamic programming computes them from known rules, and Q-learning learns them from experience.' },
    { to: 'concept:state-space', type: 'prerequisite', why: 'The Q-learning table has one row for every state the agent can be in, so the method only works when the state space is small enough to list.' },
    { to: 'fibonacci-dp', type: 'related', why: 'Both fill a table in which each entry depends on entries for what comes next. Fibonacci by dynamic programming fills it once, in a fixed order, from a known rule. Q-learning fills it gradually, in whatever order the agent happens to wander.' },
    { to: 'gradient-descent', type: 'related', why: 'Gradient descent and Q-learning both improve a guess through many small corrections scaled by a learning rate. Gradient descent steps down the slope of an error, and Q-learning steps toward a target built from the reward just received.' },
    { to: 'monte-carlo', type: 'related', why: 'Monte Carlo estimation and Q-learning both learn from samples instead of from a formula. Monte Carlo averages whole outcomes, while Q-learning uses one step of real experience and fills in the rest from its own current estimates.' },
    { to: 'bayesian-updating', type: 'related', why: 'Bayesian updating and Q-learning both revise a belief a little with each observation instead of starting again. Bayesian updating weighs the evidence by an exact rule of probability, and Q-learning moves a value by a fixed fraction of its surprise.' },
    { to: 'a-star', type: 'same-problem', why: 'A* and Q-learning can both produce a shortest route across a grid. A* is handed the map and searches it. Q-learning is given no map and learns the route from rewards, at a far greater cost in steps.' },
    { to: 'minimax', type: 'related', why: 'Minimax and Q-learning both value a position by the values of the positions that can follow it. Minimax works them out by searching a game whose rules it knows, and Q-learning learns them from the rewards it meets.' },
    { to: 'backpropagation', type: 'advanced', why: 'Deep Q-learning replaces the Q-learning table with a neural network that estimates the values, and that network is trained by backpropagation.' },
    { to: 'discipline:robotics', type: 'application', why: 'A robot can learn which action to take in each situation from reward alone, which is the Q-learning setting, when the effect of its actions is too complicated to model by hand.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'The learning rate is 0.5 and the discount is 0.9. A move has the value 2. The agent makes it, gets a reward of 0, and arrives in a cell whose best value is 8. What is the move\'s new value?',
      options: ['4.6', '7.2', '5', '9.2'],
      answer: 0,
      explain: [
        'The target is 0 + 0.9 × 8 = 7.2. The value moves halfway from 2 to 7.2: 2 + 0.5 × (7.2 − 2) = 4.6.',
        '7.2 is the target. With a learning rate of 0.5 the value only goes halfway there.',
        '5 is halfway from 2 to 8, which leaves out the discount. The target is 0.9 × 8, not 8.',
        '9.2 adds the target to the old value. The update moves the old value toward the target. It does not add them.',
      ],
    },
    {
      type: 'predict',
      q: 'In the small room, set the exploration rate to 1. The agent now moves at random on every step of all 200 episodes and never once follows its table. What route does the finished table give?',
      options: ['None: the table is noise, because the agent never practised a good route', 'A shortest route to the goal, 5 moves', 'A route to the goal, but a long wandering one', 'A route into the hazard'],
      answer: 1,
      explain: [
        'What the agent practises does not matter. Each update asks what the best next move would be worth, not what the agent does next.',
        'Random movement tries every move in every cell many times, and each update is built from the best next value. So the table ends up exact, and its route is a shortest one, although the agent never walked it on purpose.',
        'The wandering shows in how the agent behaved while training, not in the table. The table records the best that could be done from each cell.',
        'Moves into the hazard are learned as −10 the first few times they are tried, so the finished table steers away from it.',
      ],
      tryInput: { world: 'room', epsilon: 1, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 },
    },
    {
      type: 'debug',
      q: 'This is meant to be Q-learning. With plenty of exploring, the values it learns for cells beside the hazard come out much lower than the exact values. What is wrong?',
      code: `move = choose(q[cell])
while not over:
    new_cell, reward, over = step(cell, move)
    next_move = choose(q[new_cell])          # may be a random move
    target = reward if over else reward + GAMMA * q[new_cell][next_move]
    q[cell][move] += ALPHA * (target - q[cell][move])
    cell, move = new_cell, next_move`,
      options: [
        'The target uses the value of the move chosen next, which is sometimes random. It should use the best value in the new cell: `max(q[new_cell])`',
        'The discount should be applied to the reward as well',
        'The learning rate should be 1',
        'The reward should be added after the update, not inside the target',
      ],
      answer: 0,
      explain: [
        'As written, a cell beside the hazard is charged for the times the next random move falls in. That is the algorithm called SARSA, which values the behaviour actually followed. Q-learning takes the maximum, so it values the best behaviour.',
        'The reward has just been received, so it is not discounted. Only what comes later is.',
        'The learning rate changes how fast the values move, not where they are heading.',
        'The reward belongs in the target. Without it nothing would ever be learned from reaching the goal.',
      ],
    },
    {
      type: 'choice',
      q: 'In the first episode that reaches the goal, how many values in the table rise above zero?',
      options: ['One: the move that stepped into the goal', 'All the moves on the path the agent took', 'Every move in every cell next to the goal', 'None until the second visit'],
      answer: 0,
      explain: [
        'Each update uses only the reward just received and the cell just entered. Every earlier step of the episode was updated while all the values ahead of it were still 0.',
        'That would need the agent to remember its path and go back over it. Plain Q-learning updates one entry per step and keeps no memory of the path.',
        'Only the move actually made is updated. The other moves into the goal stay at 0 until they are tried.',
        'The reward itself is enough to change the last move on the first visit.',
      ],
    },
    {
      type: 'challenge',
      title: 'A slippery floor',
      prompt: 'Change the world so that the floor is slippery: on 20% of steps the agent moves in a direction chosen at random instead of the one it picked. Train with a learning rate of 1 and look at how the values near the hazard jump about from one episode to the next. Then train with a learning rate that shrinks as each entry is updated more often, and compare the table with exact values from value iteration, which must now average over the possible results of each move.',
      hints: [
        'Keep a count of how many times each entry has been updated and use 1 divided by that count as its learning rate. The entry then holds the plain average of its targets.',
        'In value iteration, the value of a move is now 0.8 times the value of its intended result plus 0.2 times the average over the four random directions.',
        'Expect the best route to keep one cell further from the hazard than before.',
      ],
    },
  ],

  compare: {
    idea: 'Keep a number for every action in every situation. After each step, move one number toward the reward just received plus the best number in the situation that follows.',
    requires: 'Something that can try the task over and over and be told a score for how each step went, cheaply and without harm. The different situations and choices must be few enough to keep a number for each. It does not need to be told the rules.',
    sensitivity: 'High. How many steps it needs, and whether it finds the best behaviour at all, depend on the exploration rate, the learning rate, how often rewards occur and the random seed.',
    memory: 'O(S·A): one number for each action in each state.',
    difficulty: 'moderate',
    difficultyNote: 'The update is a single line. Choosing rewards and settings so that it learns what you meant is the hard part.',
    limits: 'It learns slowly, because each try teaches it about one step only, so it needs a very large number of tries. That makes it better suited to a simulation than to the real world. It stops working when there are too many different situations to keep a number for each one.',
    useWhen: 'You cannot write down how to do the task, but you can let a program try it again and again and tell it how well each try went.',
  },

  advanced: {
    history: 'Christopher Watkins introduced Q-learning in his 1989 doctoral thesis at the University of Cambridge, *Learning from Delayed Rewards*. It joined two lines of work. One was the dynamic programming of Richard Bellman from the 1950s, which computes the value of a state from the values of its successors when the rules are known. The other was temporal-difference learning, set out by Richard Sutton in 1988, which learns a prediction from the difference between one estimate and the next. In 1992 Watkins and Peter Dayan published a proof that the table converges to the optimal values, provided every action is tried in every state without limit and the learning rates shrink suitably. In 2015 Volodymyr Mnih and colleagues at DeepMind replaced the table with a deep neural network and showed that the result could learn to play many Atari video games from the screen image and the score.',
    derivation: 'Let $Q^*(s, a)$ be the expected discounted total of future rewards when action $a$ is taken in state $s$ and the best action is taken ever after. Splitting off the first step gives the Bellman optimality equation\n\n$$Q^*(s, a) = \\mathbb{E}\\big[\\, r + \\gamma \\max_{a\'} Q^*(s\', a\') \\,\\big],$$\n\nwhere the expectation is over the reward $r$ and the next state $s\'$, and the maximum is taken as 0 when $s\'$ ends the episode. Dynamic programming solves this equation by computing the expectation, which requires knowing the probabilities of each $s\'$. Q-learning does not know them. It replaces the expectation by the single sample it has just observed and takes a small step toward it:\n\n$$Q(s, a) \\leftarrow Q(s, a) + \\alpha \\, \\delta, \\qquad \\delta = r + \\gamma \\max_{a\'} Q(s\', a\') - Q(s, a).$$\n\nThe quantity $\\delta$ is the temporal-difference error: the gap between the new one-step estimate and the old one. Written another way, the update is $Q(s,a) \\leftarrow (1 - \\alpha)\\,Q(s,a) + \\alpha\\,(r + \\gamma \\max_{a\'} Q(s\', a\'))$, a running average of sampled targets. Because the target contains a maximum over the next actions and not the action the agent goes on to take, the equation being solved is the one for the best behaviour, whatever behaviour produced the samples.',
    proof: '**Uniqueness of the solution.** Define the operator $T$ on tables by $(TQ)(s,a) = \\mathbb{E}[\\, r + \\gamma \\max_{a\'} Q(s\', a\') \\,]$. For two tables $Q_1$ and $Q_2$,\n\n$$|(TQ_1)(s,a) - (TQ_2)(s,a)| \\le \\gamma \\, \\mathbb{E}\\big[\\, |\\max_{a\'} Q_1(s\', a\') - \\max_{a\'} Q_2(s\', a\')| \\,\\big] \\le \\gamma \\, \\lVert Q_1 - Q_2 \\rVert_\\infty,$$\n\nsince the maxima of two functions differ by at most the largest difference between the functions. So $T$ shrinks distances by the factor $\\gamma < 1$ and has exactly one fixed point, which is $Q^*$.\n\n**A world without chance.** Here each update sets $Q(s,a) \\leftarrow (1-\\alpha)\\,Q(s,a) + \\alpha\\,(TQ)(s,a)$ exactly. Let $\\Delta = \\lVert Q - Q^* \\rVert_\\infty$. Using $TQ^* = Q^*$ and the bound above, the error of the updated entry is at most $(1-\\alpha)\\Delta + \\alpha\\gamma\\Delta = (1 - \\alpha(1-\\gamma))\\,\\Delta$, and no other entry changes, so $\\Delta$ never grows. Once every entry has been updated at least once since some moment, every error is at most $(1 - \\alpha(1-\\gamma))$ times the $\\Delta$ of that moment. If every entry keeps being updated, the error therefore shrinks geometrically to 0.\n\n**The general case.** With chance in the world each target is a noisy sample of $(TQ)(s,a)$, and the argument needs the theory of stochastic approximation. Watkins and Dayan (1992) proved that $Q$ converges to $Q^*$ with probability 1 if rewards are bounded, every state-action pair is updated infinitely often, and the learning rates $\\alpha_n$ used for each pair satisfy $\\sum_n \\alpha_n = \\infty$ and $\\sum_n \\alpha_n^2 < \\infty$. A constant learning rate does not satisfy the second condition: with noise the table then keeps fluctuating around $Q^*$ instead of settling.',
    variants: [
      { name: 'SARSA', text: 'Builds the target from the action the agent actually takes next. It learns the value of the behaviour being followed, exploring included.' },
      { name: 'Expected SARSA', text: 'Builds the target from the average of the next values, weighted by how likely the agent is to choose each action. It removes the randomness of the next choice from the update.' },
      { name: 'Double Q-learning', text: 'Keeps two tables and uses one to choose the best next action and the other to value it. This removes the tendency of a single maximum over noisy estimates to come out too high.' },
      { name: 'Deep Q-network (DQN)', text: 'Replaces the table with a neural network. Stored experience is replayed in random order, and the targets come from a copy of the network that is refreshed only now and then, both to keep training stable.' },
      { name: 'Eligibility traces, Q(λ)', text: 'Keeps a fading record of recently visited entries and shares each correction among them, so that a reward reaches many steps back in one episode instead of one.' },
      { name: 'Dyna-Q', text: 'Learns a model of the world from the same experience and uses it to make extra, imagined updates between real steps.' },
    ],
    implementation: 'Store the table as one flat array indexed by state and action. Break ties at random when choosing an action. Handle the end of an episode explicitly, so that no value is carried back from beyond it. Put a limit on episode length. Lower the exploration rate over time if the agent\'s behaviour during training matters. Evaluate with exploring switched off, on separate episodes, and fix the random seed so that a run can be repeated.',
    benchmarking: 'A single run says little, because results vary a great deal with the seed. Report averages over many seeds with their spread. Plot learning curves against the number of steps taken, not episodes, since episodes differ in length. Where the problem is small enough, compare the learned values with exact ones from value iteration, as this page does.',
    references: [
      { authors: 'C. J. C. H. Watkins', year: 1989, title: 'Learning from Delayed Rewards', venue: 'PhD thesis, King\'s College, University of Cambridge' },
      { authors: 'C. J. C. H. Watkins and P. Dayan', year: 1992, title: 'Q-learning', venue: 'Machine Learning 8(3-4), 279-292' },
      { authors: 'R. S. Sutton', year: 1988, title: 'Learning to predict by the methods of temporal differences', venue: 'Machine Learning 3(1), 9-44' },
      { authors: 'R. Bellman', year: 1957, title: 'Dynamic Programming', venue: 'Princeton University Press' },
      { authors: 'V. Mnih, K. Kavukcuoglu, D. Silver and others', year: 2015, title: 'Human-level control through deep reinforcement learning', venue: 'Nature 518, 529-533' },
      { authors: 'W. Schultz, P. Dayan and P. R. Montague', year: 1997, title: 'A neural substrate of prediction and reward', venue: 'Science 275(5306), 1593-1599' },
      { authors: 'H. van Hasselt', year: 2010, title: 'Double Q-learning', venue: 'Advances in Neural Information Processing Systems 23' },
    ],
    furtherReading: [
      'R. S. Sutton and A. G. Barto, *Reinforcement Learning: An Introduction*, second edition (MIT Press, 2018), the chapter on temporal-difference learning.',
      'S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, the chapter on reinforcement learning.',
    ],
  },

  tests: [
    { name: 'small room, always exploring, 2,000 episodes: every value within 0.001 of value iteration, and the route is a shortest one', input: { world: 'room', epsilon: 1, alpha: 0.5, gamma: 0.9, episodes: 2000, seed: 3 },
      check: (r) => {
        const ok = learnedExactly(r, 0.001);
        if (ok !== true) return ok;
        // closed form for this room: the start is 5 moves from the goal, so its best value is 10 × 0.9^4
        const startBest = Math.max(...r.Q.slice(r.start * 4, r.start * 4 + 4));
        return (Math.abs(startBest - 6.561) < 0.001 && r.routeMoves.length === 5 && r.untried === 0) || `best value at the start is ${startBest}, expected 6.561`;
      } },
    { name: 'open room, exploring half the time, 3,000 episodes: every value within 0.001 of value iteration, route of 7 moves', input: { world: 'open', epsilon: 0.5, alpha: 0.5, gamma: 0.9, episodes: 3000, seed: 3 },
      check: (r) => (learnedExactly(r, 0.001) === true && r.routeMoves.length === 7) || `${learnedExactly(r, 0.001)}; route of ${r.routeMoves.length} moves` },
    { name: 'cliff edge, exploring half the time, 3,000 episodes: values within 0.001, and the route runs along the edge', input: { world: 'cliff', epsilon: 0.5, alpha: 0.5, gamma: 0.9, episodes: 3000, seed: 3 },
      check: (r) => (learnedExactly(r, 0.001) === true && r.routeMoves.join() === 'up,right,right,right,right,right,down') || `${learnedExactly(r, 0.001)}; route ${r.routeMoves.join()}` },
    { name: 'the same tolerance holds for 20 other seeds in the small room', input: { world: 'room', epsilon: 1, alpha: 0.5, gamma: 0.9, episodes: 1000, seed: 11 },
      check: () => {
        for (let seed = 1; seed <= 20; seed++) {
          const ok = learnedExactly(silentRun({ epsilon: 1, episodes: 1000, seed }), 0.001);
          if (ok !== true) return `seed ${seed}: ${ok}`;
        }
        return true;
      } },
    { name: 'default run: a shortest route, exact along it, and every recorded update obeys the update rule', input: { world: 'room', epsilon: 0.2, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 },
      check: (r, c) => {
        const route = routeIsShortest(r);
        if (route !== true) return route;
        if (r.routeGap > 0.001) return `the values along the route are off by ${r.routeGap}`;
        if (c.updates !== r.updates || r.goals + r.hazards + r.timeouts !== 200) return 'the counts of updates or episodes do not add up';
        if (r.Q.some((q) => q < -10 || q > 10)) return 'a value left the range from -10 to 10';
        for (const u of r.log) {
          const target = u.done ? u.reward : u.reward + 0.9 * u.ahead;
          if (Math.abs(u.target - target) > 1e-12 || Math.abs(u.fresh - (u.old + 0.5 * (target - u.old))) > 1e-12) return 'a recorded update does not follow the rule';
        }
        return true;
      } },
    { name: 'the worked example: C1 goes 5, 7.5, 8.75 and B1 goes 2.25, 4.5 in the first episodes', input: { world: 'room', epsilon: 0.2, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 },
      check: (r) => {
        const series = (cell, move) => r.log.filter((u) => u.cell === cell && u.move === move && u.fresh !== u.old).slice(0, 3).map((u) => u.fresh).join();
        const c1 = series(2, 1), b1 = series(1, 1);
        const firstGoal = r.log.find((u) => u.reward === 10);
        return (c1 === '5,7.5,8.75' && b1.startsWith('2.25,4.5') && firstGoal.old === 0 && firstGoal.fresh === 5 && 0 + 0.5 * (0.9 * 5 - 0) === 2.25) || `C1: ${c1}; B1: ${b1}`;
      } },
    { name: 'the predicted run: moving at random throughout still gives a shortest route of 5 moves', input: { world: 'room', epsilon: 1, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 },
      check: (r) => (routeIsShortest(r) === true && r.routeMoves.length === 5 && r.maxGap < 0.001) || `${routeIsShortest(r)}; largest gap ${r.maxGap}` },
    { name: 'the three small-room presets: all give a 5-move route, with 12 moves untried when never exploring and 135 falls when always exploring', input: { world: 'room', epsilon: 0, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 40 },
      check: (r) => {
        if (routeIsShortest(r) !== true || r.untried !== 12 || r.meanGap <= 6) return `never exploring: ${routeIsShortest(r)}, ${r.untried} untried, average gap ${r.meanGap}`;
        const always = silentRun({ epsilon: 1 });
        return (routeIsShortest(always) === true && always.hazards === 135 && always.maxGap < 0.001) || `always exploring: ${always.hazards} falls, largest gap ${always.maxGap}`;
      } },
    { name: 'never exploring on the cliff keeps a 9-move route where 7 is possible, and exploring finds the 7', input: { world: 'cliff', epsilon: 0, alpha: 0.5, gamma: 0.9, episodes: 200, seed: 1 },
      check: (r) => {
        if (r.outcome !== 'goal' || r.routeMoves.length !== 9 || r.shortest !== 7) return `without exploring: ${r.outcome} in ${r.routeMoves.length} moves`;
        const explored = silentRun({ world: 'cliff', epsilon: 0.2, seed: 1 });
        return (explored.outcome === 'goal' && explored.routeMoves.length === 7) || `with exploring: ${explored.outcome} in ${explored.routeMoves.length} moves`;
      } },
    { name: 'the reference values match the closed form on the cliff: 10 × 0.9^6 at the start', input: { world: 'cliff', epsilon: 0.2, alpha: 0.5, gamma: 0.9, episodes: 50, seed: 2 },
      check: (r) => {
        const best = Math.max(...r.exact.slice(r.start * 4, r.start * 4 + 4));
        return (exactIsConsistent(r) === true && Math.abs(best - 10 * 0.9 ** 6) < 1e-9 && r.shortest === 7) || `exact value at the start is ${best}`;
      } },
  ],
};
