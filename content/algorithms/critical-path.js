import { makeGraph } from '../../js/lib/graphs.js';
import { makeRng } from '../../js/lib/rng.js';

const NAME = '[A-Za-z][A-Za-z0-9]{0,9}';
const TASK = new RegExp(`^(${NAME})\\s*:\\s*(\\d{1,3})$`);
const LINK = new RegExp(`^(${NAME})\\s*(?:->|>)\\s*(${NAME})$`);

// "A:3, B:2, A>B": each item is a task with its days, or a dependency. Throws user-facing errors.
function parsePlan(text) {
  const parts = String(text).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const tasks = [];           // { id, days } in the order typed
  const byKey = new Map();    // lower-case name -> task, so "Roof" and "roof" are one task
  const links = [];
  for (const p of parts) {
    const task = p.match(TASK), link = p.match(LINK);
    if (task) {
      const key = task[1].toLowerCase();
      if (byKey.has(key)) throw new Error(`Task ${task[1]} is listed twice. Give each task one duration.`);
      const entry = { id: task[1], days: Number(task[2]) };
      byKey.set(key, entry);
      tasks.push(entry);
    } else if (link) links.push([link[1], link[2]]);
    else throw new Error(`Could not read "${p}". Write a task as A:3 (task A takes 3 days) and a dependency as A>B (A must finish before B can start).`);
  }
  if (!tasks.length) throw new Error('No tasks found. Write each task as a name and its number of days, such as A:3.');
  if (tasks.length > 14) throw new Error('At most 14 tasks, please.');
  const deps = [];
  const seen = new Set();
  for (const [a, b] of links) {
    const u = byKey.get(a.toLowerCase()), v = byKey.get(b.toLowerCase());
    const missing = !u ? a : !v ? b : null;
    if (missing) throw new Error(`Task ${missing} appears in a dependency but has no duration. Add it to the list as ${missing}:3, with its own number of days.`);
    const key = `${u.id}>${v.id}`;
    if (!seen.has(key)) { seen.add(key); deps.push([u.id, v.id]); }
  }
  return { tasks, deps };
}

// A random project: the shared graph generator supplies a connected set of dependencies
// with no cycle, and each task gets 1 to 9 days from the seed.
function randomProject(input) {
  const n = Math.max(2, Math.floor(Number(input.tasks) || 2));
  const seed = Math.floor(Number(input.seed) || 1);
  const g = makeGraph({ nodes: n, density: Number(input.density) || 0, seed, dag: true, weighted: false });
  const rng = makeRng(seed * 4099 + n);
  return { tasks: g.nodes.map((node) => ({ id: node.id, days: rng.int(1, 9) })), deps: g.edges.map((e) => [e.u, e.v]) };
}

// For the picture only: columns by the number of arrows on the longest chain leading to a
// task, and the width of the timeline. The rounds are capped so that a plan with a cycle
// (which the method itself rejects a moment later) cannot loop here.
function pictureOf(ids, days, deps) {
  const layer = new Map(ids.map((id) => [id, 0]));
  const finish = new Map(ids.map((id) => [id, days.get(id)]));
  for (let round = 0; round < ids.length; round++) {
    let changed = false;
    for (const [u, v] of deps) {
      if (layer.get(v) < layer.get(u) + 1) { layer.set(v, layer.get(u) + 1); changed = true; }
      if (finish.get(v) < finish.get(u) + days.get(v)) { finish.set(v, finish.get(u) + days.get(v)); changed = true; }
    }
    if (!changed) break;
  }
  const last = Math.max(...layer.values());
  const pos = new Map();
  for (let k = 0; k <= last; k++) {
    const column = ids.filter((id) => layer.get(id) === k);
    // order a column by the average height of the tasks its members wait for, to keep arrows short
    const height = (id) => {
      const ys = deps.filter(([u, v]) => v === id && pos.has(u)).map(([u]) => pos.get(u).y);
      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0.5;
    };
    const keyed = column.map((id, i) => ({ id, h: height(id), i })).sort((a, b) => a.h - b.h || a.i - b.i);
    const gap = Math.min(0.6, 0.84 / Math.max(1, keyed.length - 1));
    const nudge = keyed.length === 1 ? (k % 2 ? -0.12 : 0.12) : 0;   // keeps a long arrow from running through a lone box
    keyed.forEach(({ id }, i) => pos.set(id, { x: last === 0 ? 0.5 : 0.09 + 0.82 * (k / last), y: 0.5 + (i - (keyed.length - 1) / 2) * gap + nudge }));
  }
  return { pos, horizon: Math.max(1, ...finish.values()) };
}

const dayWord = (d) => (d === 1 ? 'day' : 'days');
const listOf = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function run(input, t) {
  const project = typeof input.plan === 'string' && input.plan.trim() ? parsePlan(input.plan) : randomProject(input);
  const ids = project.tasks.map((x) => x.id);
  const days = new Map(project.tasks.map((x) => [x.id, x.days]));
  const deps = project.deps;
  const before = new Map(ids.map((id) => [id, []]));   // before.get(v): the tasks v waits for
  const after = new Map(ids.map((id) => [id, []]));    // after.get(u): the tasks that wait for u
  deps.forEach(([u, v], e) => { before.get(v).push({ id: u, e }); after.get(u).push({ id: v, e }); });
  const ES = new Map(), EF = new Map(), LS = new Map(), LF = new Map(), slack = new Map();
  let length = null;
  let path = [];
  const pathEdges = new Set();

  let pic = null;
  const views = ({ current = null, other = null, edge = null, mark = [], final = false } = {}) => {
    pic = pic || pictureOf(ids, days, deps);
    const { pos, horizon } = pic;
    const critical = (id) => final && slack.get(id) === 0;
    const sub = (id) => {
      if (slack.has(id)) return slack.get(id) === 0 ? 'no slack' : `slack ${slack.get(id)}`;
      if (LS.has(id)) return `latest ${LS.get(id)} to ${LF.get(id)}`;
      if (EF.has(id)) return `${ES.get(id)} to ${EF.get(id)}`;
      return undefined;
    };
    const graph = {
      kind: 'graph', directed: true, aspect: 0.4,
      title: 'The project: arrows run from left to right and mean "must finish before"',
      nodes: ids.map((id) => ({ id, x: pos.get(id).x, y: pos.get(id).y, label: `${id} ${days.get(id)}d`, sub: sub(id),
        role: final ? (critical(id) ? 'path' : 'default') : id === current ? 'current' : id === other ? 'compare' : 'default' })),
      edges: deps.map(([u, v], e) => ({ u, v, role: final && pathEdges.has(e) ? 'path' : e === edge ? 'active' : 'default' })),
      legend: final
        ? [{ label: 'critical: no slack', role: 'path' }, { label: 'has slack', role: 'default' }]
        : [{ label: 'task being worked out', role: 'current' }, { label: 'task it is checked against', role: 'compare' }],
    };

    // Timeline: one row per task, a bar from its earliest start to its earliest finish,
    // and a pale extension as far as its latest finish once that is known.
    const n = ids.length;
    const step = horizon <= 12 ? 1 : horizon <= 24 ? 2 : horizon <= 60 ? 5 : 10;
    const marks = [];
    for (let d = 0; d <= horizon; d += step) marks.push(d);
    const layers = [{ type: 'segments', segments: marks.map((d) => [d, 0, d, n]), role: 'muted', width: 1, alpha: 0.2 }];
    for (const d of marks) layers.push({ type: 'text', at: [d, -0.75], text: String(d), role: 'faint', align: 'center', size: 10.5 });
    layers.push({ type: 'text', at: [-horizon * 0.03, -0.75], text: 'day', role: 'faint', align: 'right', size: 10.5 });
    ids.forEach((id, i) => {
      const y = n - 1 - i;
      const barRole = final ? (critical(id) ? 'forest' : 'sage') : id === current ? 'current' : id === other ? 'compare' : 'sage';
      layers.push({ type: 'text', at: [-horizon * 0.03, y + 0.33], text: id, role: id === current ? 'current' : 'text', align: 'right' });
      if (!EF.has(id)) return;
      if (LF.has(id) && LF.get(id) > EF.get(id)) layers.push({ type: 'rect', x: EF.get(id), y: y + 0.2, w: LF.get(id) - EF.get(id), h: 0.6, role: 'ochre', fillAlpha: 0.32 });
      if (days.get(id) > 0) layers.push({ type: 'rect', x: ES.get(id), y: y + 0.2, w: days.get(id), h: 0.6, role: barRole, fillAlpha: 0.92 });
      else layers.push({ type: 'points', points: [[ES.get(id), y + 0.5]], role: barRole, r: 4.5 });
    });
    if (length !== null) layers.push({ type: 'line', points: [[length, 0], [length, n]], role: 'ink', width: 1.6, dash: [4, 4] });
    const timeline = {
      kind: 'scene', axes: false, x: [-horizon * 0.2, horizon * 1.04], y: [-1.2, n + 0.15], aspect: Math.min(0.5, 0.07 + 0.034 * n),
      title: 'Timeline: each bar is a task placed as early as it can go',
      layers,
      legend: [{ label: 'task at its earliest', role: 'sage' }, { label: 'room to run late (slack)', role: 'ochre' }, { label: 'critical task', role: 'forest' }, { label: 'end of the project', role: 'ink' }],
    };

    const cols = [ES, EF, LS, LF, slack];
    const roles = {};
    for (const [id, col, role] of mark) roles[`${ids.indexOf(id)},${col}`] = role;
    if (final) ids.forEach((id, i) => { if (critical(id)) roles[`${i},5`] = 'path'; });
    const table = {
      kind: 'table', corner: 'task', title: 'All times are days counted from the start of the project',
      colLabels: ['days', 'earliest start', 'earliest finish', 'latest start', 'latest finish', 'slack'],
      rowLabels: ids,
      cells: ids.map((id) => [days.get(id), ...cols.map((m) => (m.has(id) ? m.get(id) : ''))]),
      roles,
    };
    return [graph, timeline, table];
  };

  const n = ids.length;
  t.frame(() => ({ line: 0, note: `This project has **${n} tasks**. Each box shows a task and how many days it takes. An arrow from one task to another means the first must finish before the second can start. Tasks that are not linked by arrows can run at the same time. Two questions: how soon can everything be finished, and which tasks have no room to run late?`, views: views(), vars: { tasks: n, dependencies: deps.length } }));

  // Put the tasks in an order in which every task comes after the tasks it waits for.
  const waiting = new Map(ids.map((id) => [id, before.get(id).length]));
  const order = ids.filter((id) => waiting.get(id) === 0);
  for (let head = 0; head < order.length; head++) {
    for (const { id: v } of after.get(order[head])) {
      t.count('dependencies examined');
      waiting.set(v, waiting.get(v) - 1);
      if (waiting.get(v) === 0) order.push(v);
    }
  }
  if (order.length < n) {
    // The tasks left over each wait for another left-over task. Walking backwards along
    // those waits must come back to a task already seen, and that closes a circle.
    const stuck = new Set(ids.filter((id) => !order.includes(id)));
    const seenAt = new Map();
    const walk = [];
    let v = [...stuck][0];
    while (!seenAt.has(v)) { seenAt.set(v, walk.length); walk.push(v); v = before.get(v).find((x) => stuck.has(x.id)).id; }
    const circle = walk.slice(seenAt.get(v)).reverse();
    throw new Error(circle.length === 1
      ? `Task ${circle[0]} is set to wait for itself, so it can never start. A project like this has no schedule, no length and no critical path. Remove the dependency ${circle[0]}>${circle[0]} and run it again.`
      : `These dependencies go round in a circle: ${circle.concat(circle[0]).join(' → ')}. Each task in the circle waits for the one before it, so none of them can ever be the first to start. With no possible order there is no schedule, no project length and no critical path. Remove one of those dependencies and run it again.`);
  }
  t.frame(() => ({ line: 1, note: deps.length
    ? `First, list the tasks so that each one comes after every task it waits for: **${order.join(', ')}**. The list is built by repeatedly taking a task that is not waiting for anything still unlisted, which looks at each of the ${deps.length} arrows once. Working in this order means a task is never handled before the tasks it waits for.`
    : `No task waits for another, so the tasks can be handled in any order. They are taken as listed: **${order.join(', ')}**.`,
    views: views(), vars: { order: order.join(' ') } }));

  // Forward pass: the earliest each task can start and finish.
  order.forEach((v, k) => {
    const lead = k === 0 ? 'Forward pass: find the earliest each task can start and finish, counting days from the start of the project, which is day 0. ' : '';
    const d = days.get(v);
    ES.set(v, 0);
    const needs = before.get(v);
    needs.forEach(({ id: u, e }, j) => {
      t.count('dependencies examined');
      const held = ES.get(v), cand = EF.get(u);
      if (cand > held) ES.set(v, cand);
      t.frame(() => ({ line: cand > held ? [4, 5, 6] : [4, 5],
        note: `${lead && j === 0 ? lead : ''}**${v}** waits for ${u}, and ${u} cannot finish before day ${cand}. ${j === 0 ? `So ${v} cannot start before day ${cand}.` : cand > held ? `That is later than day ${held}, so ${v} is now held back to day ${cand}.` : cand === held ? `Another task already holds ${v} back to that same day, so nothing changes.` : `Another task already holds ${v} back to day ${held}, which is later, so ${u} is not what delays it.`}`,
        views: views({ current: v, other: u, edge: e, mark: [[u, 2, 'compare'], [v, 1, 'current']] }), vars: { task: v, 'waits for': u, 'earliest start': ES.get(v) } }));
    });
    EF.set(v, ES.get(v) + d);
    t.frame(() => ({ line: needs.length ? 7 : [2, 3, 7],
      note: needs.length
        ? `${needs.length === 1 ? `${v} waits only for that task, so it starts as soon as that task ends` : `${v} needs ${needs.length === 2 ? 'both' : `all ${needs.length}`} of those tasks to be finished, so it starts when the last of them ends`}: earliest start ${ES.get(v)}. It takes ${d} ${dayWord(d)}, so its earliest finish is ${ES.get(v)} + ${d} = **${EF.get(v)}**.`
        : `${lead}**${v}** waits for nothing, so it can start at day 0. It takes ${d} ${dayWord(d)}, so the earliest it can finish is 0 + ${d} = **${EF.get(v)}**.`,
      views: views({ current: v, mark: [[v, 1, 'current'], [v, 2, 'current']] }), vars: { task: v, 'earliest start': ES.get(v), 'earliest finish': EF.get(v) } }));
  });

  length = Math.max(...ids.map((id) => EF.get(id)));
  const lastOnes = ids.filter((id) => EF.get(id) === length);
  t.frame(() => ({ line: 8, note: `Every task now has an earliest finish. The largest is ${length}, for ${listOf(lastOnes)}, so the project needs **${length} ${dayWord(length)}**. It cannot be done sooner, because each earliest start was forced by a chain of tasks that have to follow one another. The dashed line on the timeline marks day ${length}.`,
    views: views({ mark: lastOnes.map((id) => [id, 2, 'current']) }), vars: { 'project length': length } }));

  // Backward pass: the latest each task can finish and start without delaying the project.
  order.slice().reverse().forEach((v, k) => {
    const lead = k === 0 ? `Backward pass: find the latest each task can start and finish without pushing the project past day ${length}. ` : '';
    const d = days.get(v);
    LF.set(v, length);
    const feeds = after.get(v);
    feeds.forEach(({ id: w, e }, j) => {
      t.count('dependencies examined');
      const due = LF.get(v), cand = LS.get(w);
      if (cand < due) LF.set(v, cand);
      t.frame(() => ({ line: cand < due ? [11, 12, 13] : [11, 12],
        note: `${lead && j === 0 ? lead : ''}${w} waits for **${v}**, and ${w} must start by day ${cand}. ${j === 0 ? `So ${v} must be finished by day ${cand}.` : cand < due ? `That is earlier than day ${due}, so ${v} must now be finished by day ${cand}.` : cand === due ? `Another task already needs ${v} finished by that same day, so nothing changes.` : `Another task already needs ${v} finished by day ${due}, which is earlier, so ${w} is not the one pressing on it.`}`,
        views: views({ current: v, other: w, edge: e, mark: [[w, 3, 'compare'], [v, 4, 'current']] }), vars: { task: v, 'needed by': w, 'latest finish': LF.get(v) } }));
    });
    LS.set(v, LF.get(v) - d);
    t.frame(() => ({ line: feeds.length ? 14 : [9, 10, 14],
      note: feeds.length
        ? `${feeds.length === 1 ? `Only that task waits for ${v}, so ${v} must be finished by then` : `${v} must be finished in time for ${feeds.length === 2 ? 'both' : `all ${feeds.length}`} of those tasks, so the earliest of their deadlines decides`}: latest finish ${LF.get(v)}. It takes ${d} ${dayWord(d)}, so its latest start is ${LF.get(v)} − ${d} = **${LS.get(v)}**.`
        : `${lead}Nothing waits for **${v}**, so it only has to be done by the end of the project, day ${length}. It takes ${d} ${dayWord(d)}, so the latest it can start is ${length} − ${d} = **${LS.get(v)}**.`,
      views: views({ current: v, mark: [[v, 3, 'current'], [v, 4, 'current']] }), vars: { task: v, 'latest start': LS.get(v), 'latest finish': LF.get(v) } }));
  });

  // Slack: the gap between the earliest and the latest start.
  ids.forEach((v, k) => {
    const s = LS.get(v) - ES.get(v);
    slack.set(v, s);
    t.frame(() => ({ line: [15, 16],
      note: `${k === 0 ? 'Now compare the two passes, task by task. ' : ''}**${v}** can start as early as day ${ES.get(v)} and as late as day ${LS.get(v)}. ${k === 0 ? 'The gap between the two is called the **slack** of the task' : 'Slack'}: ${LS.get(v)} − ${ES.get(v)} = **${s}**. ${s === 0 ? `It has no room at all. If ${v} runs a day late, everything after it on its chain moves a day, and so does the end of the project. It is a **critical** task.` : `It can run up to ${s} ${dayWord(s)} late without delaying the project, as long as the tasks around it keep to their times. The pale bar on the timeline shows that room.`}`,
      views: views({ current: v, mark: [[v, 1, 'compare'], [v, 3, 'compare'], [v, 5, 'current']] }), vars: { task: v, slack: s } }));
  });

  // One critical path: start at a critical task that waits for nothing and keep stepping to a
  // critical task that starts exactly when the current one finishes.
  const criticalIds = ids.filter((id) => slack.get(id) === 0);
  const tight = (u, v) => slack.get(u) === 0 && slack.get(v) === 0 && EF.get(u) === ES.get(v);
  const tightCount = deps.filter(([u, v]) => tight(u, v)).length;
  let at = order.find((id) => slack.get(id) === 0 && ES.get(id) === 0);
  path = [at];
  for (;;) {
    const next = after.get(at).find((x) => tight(at, x.id));
    if (!next) break;
    pathEdges.add(next.e);
    path.push(next.id);
    at = next.id;
  }
  const several = criticalIds.length > path.length || tightCount > path.length - 1;
  if (several) deps.forEach(([u, v], e) => { if (tight(u, v)) pathEdges.add(e); });
  const loose = ids.filter((id) => slack.get(id) > 0);
  t.frame(() => ({ line: 17,
    note: `${criticalIds.length === n ? `All ${n} tasks have` : `${criticalIds.length} of the ${n} tasks ${criticalIds.length === 1 ? 'has' : 'have'}`} zero slack${criticalIds.length === n ? '' : `: ${listOf(criticalIds)}`}. ${path.length > 1 ? `Follow the arrows between them and they form a chain, **${path.join(' → ')}**, whose days add up to ${path.map((id) => days.get(id)).join(' + ')} = ${length}, exactly the length of the project.` : `**${path[0]}** alone takes ${length} ${dayWord(length)}, the whole length of the project.`} That is the **critical path**: the longest chain of tasks that must follow one another.${several ? ' This project has more than one chain of that length. Every arrow on any of them is drawn in green, and every task on any of them is critical.' : ''} ${loose.length ? `The other tasks have room to run late: ${listOf(loose.map((id) => `${id} by ${slack.get(id)}`))}.` : 'Nothing in this project can run late.'}`,
    views: views({ final: true }), vars: { 'project length': length, 'critical tasks': criticalIds.length } }));

  return {
    length, order, path, several, deps,
    critical: criticalIds,
    tasks: ids.map((id) => ({ id, days: days.get(id), es: ES.get(id), ef: EF.get(id), ls: LS.get(id), lf: LF.get(id), slack: slack.get(id) })),
  };
}

// Independent reference for the tests: walk every chain from a task that waits for nothing to
// a task that nothing waits for, add up its days, and keep the longest. It shares no code
// with the two passes above.
function everyChain(r) {
  const days = new Map(r.tasks.map((x) => [x.id, x.days]));
  const next = new Map(r.tasks.map((x) => [x.id, []]));
  const waits = new Set();
  for (const [u, v] of r.deps) { next.get(u).push(v); waits.add(v); }
  let longest = -1, chains = 0;
  let onLongest = new Set();
  const walk = (v, total, chain) => {
    const sum = total + days.get(v);
    const here = chain.concat(v);
    if (!next.get(v).length) {
      chains++;
      if (sum > longest) { longest = sum; onLongest = new Set(here); } else if (sum === longest) for (const id of here) onLongest.add(id);
      return;
    }
    for (const w of next.get(v)) walk(w, sum, here);
  };
  for (const x of r.tasks) if (!waits.has(x.id)) walk(x.id, 0, []);
  return { longest, onLongest, chains };
}

const matchesEveryChain = (r, c) => {
  const ref = everyChain(r);
  if (r.length !== ref.longest) return `project length ${r.length}, but the longest of all ${ref.chains} chains takes ${ref.longest}`;
  const zero = r.tasks.filter((x) => x.slack === 0).map((x) => x.id).sort().join(' ');
  const truth = [...ref.onLongest].sort().join(' ');
  if (zero !== truth) return `zero-slack tasks are ${zero}, but the tasks on a longest chain are ${truth}`;
  const by = new Map(r.tasks.map((x) => [x.id, x]));
  for (const x of r.tasks) {
    if (x.ef !== x.es + x.days || x.ls !== x.lf - x.days) return `${x.id}: finish is not start plus days`;
    if (x.slack < 0 || x.slack !== x.lf - x.ef) return `${x.id}: slack ${x.slack} is negative or differs between start and finish`;
    if (x.lf > r.length) return `${x.id}: latest finish is after the end of the project`;
  }
  for (const [u, v] of r.deps) {
    if (by.get(u).ef > by.get(v).es) return `${v} starts before ${u} finishes in the earliest schedule`;
    if (by.get(u).lf > by.get(v).ls) return `${v} starts before ${u} finishes in the latest schedule`;
  }
  const has = (u, v) => r.deps.some(([a, b]) => a === u && b === v);
  if (!r.path.every((id, i) => i === 0 || has(r.path[i - 1], id))) return 'the reported critical path does not follow real dependencies';
  if (r.path.reduce((s, id) => s + by.get(id).days, 0) !== r.length) return 'the days on the reported critical path do not add up to the project length';
  if ((c['dependencies examined'] || 0) !== 3 * r.deps.length) return `examined ${c['dependencies examined'] || 0} dependencies, expected 3 × ${r.deps.length}`;
  return true;
};

const SHED = 'base:3, windows:6, walls:4, fit:1, roof:2, paint:2, base>walls, windows>fit, walls>fit, walls>roof, fit>paint, roof>paint';
const slackOf = (r, id) => r.tasks.find((x) => x.id === id).slack;

export default {
  meta: {
    id: 'critical-path',
    name: 'Critical Path Method',
    aliases: ['CPM', 'critical path analysis', 'critical path scheduling', 'project scheduling', 'PERT/CPM', 'longest path in a project network'],
    kind: 'algorithm',
    discipline: 'optimization',
    alsoIn: [
      { id: 'graph-theory', why: 'A project is a directed graph with no cycles, and its critical path is the longest path through that graph, found in one sweep along a topological order.' },
    ],
    subfield: 'Scheduling',
    family: 'Project scheduling',
    lab: 'graphs',
    year: 1959,
    authors: 'James E. Kelley Jr. and Morgan R. Walker',
    summary: 'Finds the shortest possible length of a project and the tasks that cannot run late, with one forward and one backward sweep over tasks linked by dependencies.',
    difficulty: 'intermediate',
    order: 290,
    paradigms: ['dynamic-programming', 'graph-search'],
    randomized: false,
    approximate: false,
    time: { best: 'O(V + E)', average: 'O(V + E)', worst: 'O(V + E)', class: 'linear' },
    space: { worst: 'O(V)', class: 'linear' },
    tags: {
      problems: ['how long will the project take', 'which tasks can I delay', 'find the tasks that cannot run late', 'plan a project whose tasks depend on each other', 'how much spare time does a task have', 'find the longest chain of tasks'],
      techniques: ['forward pass', 'backward pass', 'slack', 'longest path', 'topological order'],
      applications: ['engineering design', 'logistics', 'data processing'],
    },
    prerequisites: ['topological-sort', 'concept:graph', 'concept:topological-order'],
  },

  bigIdea: {
    simple: "The critical path method works out how long a project must take and which jobs cannot be late. A project is a set of jobs, and some jobs have to wait for others. You cannot paint a wall before it is built. Jobs that do not wait for each other can be done at the same time by different people. So a project is usually much shorter than all of its jobs added together. What matters are the chains of jobs that must happen one after another. The longest chain sets the length of the whole project. It is called the critical path. If any job on it runs a day late, the whole project ends a day late. Jobs that are not on it have spare time, called slack. They can start a little late and nothing bad happens. Knowing this tells the person in charge where to watch closely and where there is room to breathe.",
    when: 'Use it when a piece of work breaks into tasks with known durations and "must finish before" links, and you need a finish date or a list of the tasks to watch. It assumes there are enough people and machines to run independent tasks at the same time. If they are limited, the length it gives is only a lower limit, and finding the real schedule is a much harder problem. If the durations are guesses, treat the result as one scenario, and look at PERT or a simulation for the spread.',
    interesting: 'The longest single task is often not critical, and the critical tasks are often not the ones people worry about. In the garden shed example on this page, the six-day wait for the windows has two days of slack, while the two-day roof has none. There is a second surprise. Finding the longest path through a general network is a hard problem with no known efficient method, yet for a project it takes one sweep, because a project cannot contain a cycle.',
    analogy: {
      title: 'Cooking a dinner with several dishes',
      text: 'A roast needs 20 minutes of preparation and then 100 minutes in the oven. The vegetables need 10 minutes of chopping and 20 minutes of cooking. A sauce takes 15 minutes. Everything should be ready together. Dinner cannot be served sooner than 120 minutes after you begin, because the two steps of the roast must follow one another and together they take that long. That chain is the critical path. The vegetables and the sauce can each be started at any moment inside a wide window, and dinner is still on time. Start the roast five minutes late, and dinner is five minutes late.',
      limits: 'One cook has two hands. The method assumes that tasks which do not wait for each other can always run at the same time, as if there were enough cooks and burners for everything. It also treats every time as known exactly, while real tasks run over. And it only describes the plan you gave it. It does not say how to make the project shorter.',
    },
  },

  example: {
    setup: 'Building a garden shed takes six tasks. Lay the base: 3 days. Wait for the windows to be delivered: 6 days. Build the walls: 4 days, after the base. Fit the windows: 1 day, after the walls are up and the windows have arrived. Put on the roof: 2 days, after the walls. Paint: 2 days, after the windows are fitted and the roof is on. Tasks that do not wait for each other can run at the same time. Count time in days from the start, so the project begins at day 0.',
    steps: [
      'Work forwards to find the earliest each task can finish. The base and the window delivery wait for nothing, so both begin at day 0. The base is done at day 3 and the windows arrive at day 6.',
      'The walls wait for the base, so they run from day 3 to day 7. The roof waits for the walls: day 7 to day 9. Fitting the windows waits for two things, the walls (day 7) and the delivery (day 6). It needs both, so it starts at the later one, day 7, and ends at day 8.',
      'Painting waits for the fitting (day 8) and the roof (day 9), so it runs from day 9 to day 11. The shed takes 11 days.',
      'Now work backwards to find the latest each task can finish without going past day 11. Painting must end by day 11, so it must start by day 9. The roof and the fitting must both be done by day 9. So the roof must start by day 7 and the fitting by day 8.',
      'The roof needs the walls by day 7 and the fitting needs them by day 8. The walls must be in time for both, so they must end by the earlier one, day 7, and start by day 3. The base must then end by day 3 and start at day 0. The windows must arrive by day 8, so their 6-day wait can begin as late as day 2.',
      'Compare the earliest and latest starts. Base: 0 and 0. Walls: 3 and 3. Roof: 7 and 7. Paint: 9 and 9. These four have no spare time. Windows: 0 and 2, so 2 spare days. Fitting: 7 and 8, so 1 spare day.',
    ],
    result: 'The shed takes 11 days, not the 18 you get by adding up every task. The chain base, walls, roof, paint adds up to 3 + 4 + 2 + 2 = 11 and has no spare time, so it is the critical path. Notice that the window delivery is the longest task of all, yet it can run 2 days late without harm.',
    tryInput: { plan: SHED },
  },

  terms: [
    { term: 'Task', meaning: 'One piece of work in the project, with a known number of days it takes.' },
    { term: 'Dependency', meaning: 'A rule that one task must finish before another can start.' },
    { term: 'Earliest start and earliest finish', meaning: 'The soonest a task could begin and end if nothing before it is delayed.' },
    { term: 'Forward pass', meaning: 'Going through the tasks from first to last to work out every earliest time.' },
    { term: 'Latest start and latest finish', meaning: 'The last moments a task could begin and end without making the whole project late.' },
    { term: 'Backward pass', meaning: 'Going through the tasks from last to first to work out every latest time.' },
    { term: 'Slack', meaning: 'How long a task can run late without delaying the project: its latest start minus its earliest start. Also called float.' },
    { term: 'Critical task', meaning: 'A task with no slack. Any delay to it delays the whole project.' },
    { term: 'Critical path', meaning: 'The longest chain of tasks that must follow one another. Its total length is the length of the project.' },
  ],

  takeaway: 'A project is as long as its longest chain of tasks that must follow one another, and only the tasks on that chain have no time to spare.',

  viz: {
    describe: 'Three linked pictures. On top, the project as boxes joined by arrows that run from left to right: each box is a task with its number of days, and an arrow means the task on the left must finish before the task on the right can start. The task being worked out is terracotta, the task it is checked against is ochre, and the caption under a box shows its times so far. In the middle, a timeline with one row per task: a bar runs from the earliest start to the earliest finish, and after the backward pass a pale ochre extension shows how far the task could run late. A dashed line marks the end of the project. At the bottom, a table of the earliest start, earliest finish, latest start, latest finish and slack of every task. At the end the critical tasks, their arrows and their bars turn forest green.',
    inputs: [
      { id: 'tasks', type: 'range', label: 'Number of tasks', min: 4, max: 12, step: 1, default: 7 },
      { id: 'density', type: 'range', label: 'Extra dependencies', min: 0, max: 1, step: 0.05, default: 0.3, help: '0 gives the fewest links that still join every task. 1 adds many more.' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 3, help: 'Chooses the links and gives each task 1 to 9 days.' },
      { id: 'plan', type: 'text', label: 'Or type your own project', default: '', maxLength: 600,
        help: 'Format: A:3, B:2, A>B. "A:3" is a task that takes 3 days. "A>B" means A must finish before B can start. Names can be short words. Leave empty to use the random project.' },
    ],
    presets: [
      { label: 'Random project', values: { tasks: 7, density: 0.3, seed: 3, plan: '' } },
      { label: 'Garden shed (worked example)', values: { plan: SHED } },
      { label: 'Two critical chains', values: { plan: 'A:2, B:4, C:4, D:3, E:1, A>B, A>C, B>D, C>D, A>E' } },
      { label: 'One long chain: nothing can slip', values: { plan: 'A:2, B:3, C:1, D:4, A>B, B>C, C>D' } },
      { label: 'No dependencies at all', values: { plan: 'A:2, B:5, C:3' } },
      { label: 'Larger project', values: { tasks: 12, density: 0.6, seed: 8, plan: '' } },
    ],
    tryThis: [
      'Load "Garden shed (worked example)" and watch the timeline during the forward pass. The bar for fit cannot begin until the bars for both walls and windows have ended, so it starts at the later of the two.',
      'In the shed plan, change `windows:6` to `windows:8`. The delivery uses up its 2 days of slack, the project still takes 11 days, and a second chain becomes critical. Change it to `windows:9` and the project grows to 12 days.',
      'In the shed plan, shorten a critical task: change `walls:4` to `walls:1`. The task is 3 days shorter but the project only 2 days shorter, because the chain through the window delivery takes over as the longest.',
      'Add `paint>base` to the end of the shed plan. The dependencies now go round in a circle, and the method stops and says why no schedule exists.',
      'Load "No dependencies at all". With nothing waiting for anything, the project is as long as its longest task, and every other task has slack.',
    ],
    run,
    report: (r, c) => {
      const loose = r.tasks.filter((x) => x.slack > 0);
      return `Project length: ${r.length} ${dayWord(r.length)}.\n`
        + `Critical path: ${r.path.join(' → ')} (${r.path.map((id) => r.tasks.find((x) => x.id === id).days).join(' + ')} = ${r.length}).${r.several ? ' Other chains are equally long.' : ''}\n`
        + `Slack: ${loose.length ? loose.map((x) => `${x.id} ${x.slack}`).join(', ') : 'none anywhere'}.\n`
        + `${r.tasks.length} tasks, ${r.deps.length} dependencies, ${c['dependencies examined'] || 0} dependency checks (each one three times: ordering, forward pass, backward pass).`;
    },
    experiment: {
      title: 'Dependency checks as the project grows',
      note: 'Each point is a real run on a random project. "Few dependencies" projects have one fewer dependency than tasks. "Many dependencies" projects have about 2.4 per task. Every dependency is looked at exactly three times: once to order the tasks, once in the forward pass and once in the backward pass.',
      metric: 'dependencies examined',
      metricLabel: 'Dependency checks',
      sizeLabel: 'Number of tasks (V)',
      sizes: [8, 16, 32, 64, 128, 256],
      variants: [{ id: 'sparse', label: 'Few dependencies' }, { id: 'dense', label: 'Many dependencies' }],
      input: (n, variant, seed) => ({ tasks: n, density: variant === 'dense' ? 1 : 0, seed, plan: '' }),
      theory: [
        { label: '3 (V − 1)', fn: (n) => 3 * (n - 1), variant: 'sparse' },
        { label: 'proportional to V (scaled)', fn: (n) => n, scaled: true, variant: 'dense' },
      ],
    },
  },

  logic: {
    intuition: 'A task cannot start until every task it waits for has finished, so its earliest start is the latest of their earliest finishes. Apply that rule to the tasks in dependency order and every earliest time falls out in one sweep. The largest earliest finish is the length of the project. The same reasoning run in reverse gives the latest times: a task must be finished by the earliest moment at which any task waiting for it has to start. Where the two sweeps give the same answer, the task is pinned in place.',
    steps: [
      'Put the tasks in a topological order, so that each task comes after every task it needs. If that cannot be done, the dependencies contain a cycle and there is no schedule.',
      'Forward pass. Take the tasks in that order. The earliest start `ES` of a task is the largest earliest finish among the tasks it needs, or 0 if it needs none. Its earliest finish `EF` is `ES` plus its duration.',
      'The project length `T` is the largest `EF` of any task.',
      'Backward pass. Take the tasks in the reverse order. The latest finish `LF` of a task is the smallest latest start among the tasks that need it, or `T` if none do. Its latest start `LS` is `LF` minus its duration.',
      'For every task, the slack is `LS − ES`. The same number comes from `LF − EF`.',
      'The tasks with slack 0 are critical. Stepping from one critical task to a critical task that starts exactly when it finishes traces a critical path.',
    ],
    pseudocode: [
      'critical_path(tasks, needs):',
      '  order ← topological order',
      '  for each task v in order:',
      '    ES[v] ← 0',
      '    for each u that v needs:',
      '      if EF[u] > ES[v]:',
      '        ES[v] ← EF[u]',
      '    EF[v] ← ES[v] + days[v]',
      '  T ← largest EF of any task',
      '  for each v in reverse order:',
      '    LF[v] ← T',
      '    for each w that needs v:',
      '      if LS[w] < LF[v]:',
      '        LF[v] ← LS[w]',
      '    LS[v] ← LF[v] − days[v]',
      '  for each task v:',
      '    slack[v] ← LS[v] − ES[v]',
      '  return T, tasks with slack 0',
    ],
    decisions: [
      { title: 'Why work in a topological order?', text: 'The earliest start of a task is computed from the earliest finishes of the tasks it needs. In a [topological order](#/algorithm/topological-sort) those are always final by the time they are read, so each task is handled once. Any other order would read times that have not been worked out yet.' },
      { title: 'Tasks in the boxes or on the arrows?', text: 'This page puts each task in a box and uses arrows only for dependencies. Most scheduling software draws projects this way. The original papers drew each task as an arrow between two events, which sometimes needs extra "dummy" arrows to express a dependency. Both drawings give the same numbers.' },
      { title: 'Which kind of slack?', text: 'The slack computed here is total slack: how late a task can run without delaying the end of the project, assuming everything before it ran on time. It is shared along a chain. A stricter measure, free slack, asks how late a task can run without delaying the earliest start of any task that waits for it.' },
      { title: 'What kinds of dependency are allowed?', text: 'Only "finish before start", with no gap. Real schedules also use links such as "start together", "finish together" and "start at least two days after". The two passes handle those with a small change to which time is read and an added lag, but this page keeps to the basic link.' },
    ],
    invariants: [
      'When the forward pass reaches a task, `EF` is already final for every task it needs, because they come earlier in the order.',
      '`ES[v]` equals the total duration of the longest chain of tasks leading up to `v`.',
      'After the backward pass, `T − LS[v]` equals the total duration of the longest chain of tasks that begins with `v`.',
      'For every dependency "u before v": `EF[u] ≤ ES[v]` and `LF[u] ≤ LS[v]`. For every task: `ES[v] ≤ LS[v]`.',
    ],
    edgeCases: [
      'A cycle in the dependencies: no task on it can ever be first, so no schedule exists. The method must detect this and stop.',
      'Several critical paths of equal length: every task on any of them has zero slack.',
      'No dependencies at all: the project is as long as its longest task, and that task is the only critical one unless there is a tie.',
      'A task that takes 0 days (a milestone, such as "permit approved"): the arithmetic is unchanged.',
      'Several tasks with nothing before them, or nothing after them: no special start or end task is needed, because the passes use 0 and `T` for those cases.',
      'A project in separate pieces with no links between them: the longest piece sets the length and every other piece has slack.',
    ],
    correctness: 'Three claims need showing. First, `ES[v]` is the length of the longest chain of tasks leading up to `v`. This holds for a task that needs nothing, where both are 0. For any other task, the longest chain leading up to it ends with one of the tasks `u` it needs, and consists of the longest chain up to `u` followed by `u` itself, which has length `ES[u] + days[u] = EF[u]`. Taking the largest over all such `u` gives the claim, and the topological order guarantees those values are ready. So `T`, the largest `EF`, is the length of the longest chain in the project. The project cannot be shorter than `T`, because the tasks on that chain cannot overlap. And it need not be longer, because starting every task at its `ES` breaks no dependency. Second, by the same argument run backwards, `T − LS[v]` is the length of the longest chain that begins with `v`. Third, `slack[v] = LS[v] − ES[v] = T − (ES[v] + (T − LS[v]))`, which is `T` minus the length of the longest chain passing through `v`. That is 0 exactly when `v` lies on a longest chain, and positive otherwise.',
    mistakes: [
      'Taking the smallest earliest finish in the forward pass, or the largest latest start in the backward pass. A task with two prerequisites must wait for the slower one.',
      'Starting the backward pass from each final task\'s own earliest finish instead of from the project length. A final task that ends early has slack, and that mistake hides it.',
      'Handling tasks in the order they were typed instead of in a topological order, so a task reads a time that has not been worked out yet.',
      'Adding all the durations together. That is the length of the project only if no two tasks ever run at the same time.',
      'Skipping the check for a cycle, so a circular plan produces nonsense or never finishes.',
    ],
  },

  code: {
    sample: {
      input: 'Two projects. The garden shed: base 3 days, windows 6, walls 4, fit 1, roof 2, paint 2, with base before walls, windows and walls before fit, walls before roof, fit and roof before paint. A loop: a before b, b before c, c before b.',
      expected: 'shed: 11 days\n  base: earliest 0 to 3, latest 0 to 3, slack 0, critical\n  windows: earliest 0 to 6, latest 2 to 8, slack 2\n  walls: earliest 3 to 7, latest 3 to 7, slack 0, critical\n  fit: earliest 7 to 8, latest 8 to 9, slack 1\n  roof: earliest 7 to 9, latest 7 to 9, slack 0, critical\n  paint: earliest 9 to 11, latest 9 to 11, slack 0, critical\nloop: the dependencies go round in a circle, so there is no schedule',
    },
    python: {
      source: `from collections import deque


def critical_path(days, needs):
    """days maps each task to its duration. needs is a list of (first, then) pairs."""
    before = {v: [] for v in days}
    after = {v: [] for v in days}
    for u, v in needs:
        before[v].append(u)
        after[u].append(v)
    waiting = {v: len(before[v]) for v in days}
    queue = deque(v for v in days if waiting[v] == 0)
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in after[u]:
            waiting[v] -= 1
            if waiting[v] == 0:
                queue.append(v)
    if len(order) < len(days):
        return None                                   # a cycle: no schedule exists
    es, ef, ls, lf = {}, {}, {}, {}
    for v in order:                                   # forward pass
        es[v] = max((ef[u] for u in before[v]), default=0)
        ef[v] = es[v] + days[v]
    length = max(ef.values())
    for v in reversed(order):                         # backward pass
        lf[v] = min((ls[w] for w in after[v]), default=length)
        ls[v] = lf[v] - days[v]
    return length, es, ef, ls, lf


def report(name, days, needs):
    result = critical_path(days, needs)
    if result is None:
        print(name + ": the dependencies go round in a circle, so there is no schedule")
        return
    length, es, ef, ls, lf = result
    print(f"{name}: {length} days")
    for v in days:
        slack = ls[v] - es[v]
        print(f"  {v}: earliest {es[v]} to {ef[v]}, latest {ls[v]} to {lf[v]}, slack {slack}"
              + (", critical" if slack == 0 else ""))


report("shed", {"base": 3, "windows": 6, "walls": 4, "fit": 1, "roof": 2, "paint": 2},
       [("base", "walls"), ("windows", "fit"), ("walls", "fit"),
        ("walls", "roof"), ("fit", "paint"), ("roof", "paint")])
report("loop", {"a": 1, "b": 2, "c": 3}, [("a", "b"), ("b", "c"), ("c", "b")])`,
      notes: [
        { line: 21, text: 'Tasks on a cycle never stop waiting, so they never enter the queue and the order comes out short. That is the test for a plan with no schedule.' },
        { line: 25, text: 'The forward rule: a task starts when the last of the tasks it needs has finished. `default=0` covers a task that needs nothing.' },
        { line: 27, text: 'The project is as long as the latest earliest finish.' },
        { line: 29, text: 'The backward rule: a task must be finished before the first of the tasks that need it has to start. `default=length` covers a task that nothing waits for.' },
        { line: 42, text: 'Slack is the gap between the latest and the earliest start. Zero means the task is critical.' },
      ],
    },
    javascript: {
      source: `function criticalPath(days, needs) {
  const tasks = Object.keys(days);
  const before = {}, after = {}, waiting = {};
  for (const v of tasks) { before[v] = []; after[v] = []; }
  for (const [u, v] of needs) { before[v].push(u); after[u].push(v); }
  for (const v of tasks) waiting[v] = before[v].length;
  const order = tasks.filter((v) => waiting[v] === 0);
  for (let head = 0; head < order.length; head++) {
    for (const v of after[order[head]]) {
      waiting[v] -= 1;
      if (waiting[v] === 0) order.push(v);
    }
  }
  if (order.length < tasks.length) return null;      // a cycle: no schedule exists
  const es = {}, ef = {}, ls = {}, lf = {};
  for (const v of order) {                           // forward pass
    es[v] = Math.max(0, ...before[v].map((u) => ef[u]));
    ef[v] = es[v] + days[v];
  }
  const length = Math.max(...tasks.map((v) => ef[v]));
  for (const v of order.slice().reverse()) {         // backward pass
    lf[v] = Math.min(length, ...after[v].map((w) => ls[w]));
    ls[v] = lf[v] - days[v];
  }
  return { length, es, ef, ls, lf };
}

function report(name, days, needs) {
  const r = criticalPath(days, needs);
  if (r === null) {
    console.log(name + ": the dependencies go round in a circle, so there is no schedule");
    return;
  }
  console.log(name + ": " + r.length + " days");
  for (const v of Object.keys(days)) {
    const slack = r.ls[v] - r.es[v];
    console.log("  " + v + ": earliest " + r.es[v] + " to " + r.ef[v] + ", latest " + r.ls[v]
      + " to " + r.lf[v] + ", slack " + slack + (slack === 0 ? ", critical" : ""));
  }
}

report("shed", { base: 3, windows: 6, walls: 4, fit: 1, roof: 2, paint: 2 },
  [["base", "walls"], ["windows", "fit"], ["walls", "fit"],
   ["walls", "roof"], ["fit", "paint"], ["roof", "paint"]]);
report("loop", { a: 1, b: 2, c: 3 }, [["a", "b"], ["b", "c"], ["c", "b"]]);`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

struct Schedule {
    bool ok = false;
    int length = 0;
    std::vector<int> es, ef, ls, lf;
};

// Tasks are numbered 0..n-1. needs holds (first, then) pairs.
Schedule criticalPath(const std::vector<int>& days, const std::vector<std::pair<int, int>>& needs) {
    int n = static_cast<int>(days.size());
    std::vector<std::vector<int>> before(n), after(n);
    std::vector<int> waiting(n, 0), order;
    for (auto [u, v] : needs) {
        before[v].push_back(u);
        after[u].push_back(v);
        ++waiting[v];
    }
    for (int v = 0; v < n; ++v) {
        if (waiting[v] == 0) order.push_back(v);
    }
    for (std::size_t head = 0; head < order.size(); ++head) {
        for (int v : after[order[head]]) {
            if (--waiting[v] == 0) order.push_back(v);
        }
    }
    Schedule s;
    if (static_cast<int>(order.size()) < n) return s;       // a cycle: no schedule exists
    s.ok = true;
    s.es.assign(n, 0); s.ef.assign(n, 0); s.ls.assign(n, 0); s.lf.assign(n, 0);
    for (int v : order) {                                    // forward pass
        for (int u : before[v]) s.es[v] = std::max(s.es[v], s.ef[u]);
        s.ef[v] = s.es[v] + days[v];
        s.length = std::max(s.length, s.ef[v]);
    }
    for (auto it = order.rbegin(); it != order.rend(); ++it) {   // backward pass
        int v = *it;
        s.lf[v] = s.length;
        for (int w : after[v]) s.lf[v] = std::min(s.lf[v], s.ls[w]);
        s.ls[v] = s.lf[v] - days[v];
    }
    return s;
}

void report(const std::string& name, const std::vector<std::string>& names, const std::vector<int>& days,
            const std::vector<std::pair<int, int>>& needs) {
    Schedule s = criticalPath(days, needs);
    if (!s.ok) {
        std::cout << name << ": the dependencies go round in a circle, so there is no schedule\\n";
        return;
    }
    std::cout << name << ": " << s.length << " days\\n";
    for (std::size_t v = 0; v < names.size(); ++v) {
        int slack = s.ls[v] - s.es[v];
        std::cout << "  " << names[v] << ": earliest " << s.es[v] << " to " << s.ef[v] << ", latest " << s.ls[v]
                  << " to " << s.lf[v] << ", slack " << slack << (slack == 0 ? ", critical" : "") << "\\n";
    }
}

int main() {
    report("shed", {"base", "windows", "walls", "fit", "roof", "paint"}, {3, 6, 4, 1, 2, 2},
           {{0, 2}, {1, 3}, {2, 3}, {2, 4}, {3, 5}, {4, 5}});
    report("loop", {"a", "b", "c"}, {1, 2, 3}, {{0, 1}, {1, 2}, {2, 1}});
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Ordering the tasks looks at every dependency once. So does the forward pass, and so does the backward pass. Each task is handled a fixed number of times. The total work is proportional to the number of tasks plus the number of dependencies.',
    cases: [
      { case: 'Any project', time: 'O(V + E)', when: 'V tasks and E dependencies, with each task holding a list of the tasks before and after it. The shape of the project makes no difference.' },
      { case: 'Dependencies kept in a V by V grid', time: 'O(V²)', when: 'Finding the tasks before or after a given task means scanning a whole row or column.' },
    ],
    space: 'O(V) beyond the project itself: four times and a slack per task, plus the order.',
    memory: 'A handful of numbers per task and one list of V task names. The lists of dependencies are read and never changed.',
    tradeoffs: 'The method is this cheap because it ignores how many people and machines there are. Add a limit on how many tasks can run at once and finding the shortest schedule becomes NP-hard. Scheduling tools therefore compute the critical path first and then apply rules of thumb to fit the plan to the resources.',
    assumptions: [
      'Each task stores a list of the tasks it needs and a list of the tasks that need it.',
      'Durations are numbers that can be added and compared in constant time.',
      'The chart on this page counts dependencies examined by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Limited people or machines. Two tasks with no dependency between them may still be unable to run together because the same crew does both. The method does not see that, so its project length is then too optimistic.',
      'Uncertain durations. A chain with a little slack on paper becomes the longest one as soon as its tasks run over. A single critical path gives a false sense of certainty.',
      'Projects whose plan changes as work goes on. The result is a snapshot, and it has to be recomputed whenever a task is added, finishes early or runs late.',
    ],
    pitfalls: [
      'Treating slack as if each task owned it. Slack belongs to a chain. If the first task on a chain uses it, the tasks after it have none left.',
      'Watching only the critical path. A chain with one day of slack deserves almost as much attention as a chain with none.',
      'Trusting the output more than the input. The method is exact arithmetic on durations that are usually estimates.',
      'Drawing the arrows the wrong way round. "B depends on A" is the arrow A>B.',
    ],
    misunderstandings: [
      '"The longest task is on the critical path." Not necessarily. A long task that runs alongside an even longer chain has slack, as the window delivery does in the shed example.',
      '"A project has one critical path." It can have several of equal length, and then every task on any of them is critical.',
      '"Slack is spare time that each task can use." Slack is shared by all the tasks on the same chain. Two tasks that each show 3 days of slack may have only 3 days between them.',
      '"Shortening a critical task by a day shortens the project by a day." Only until another chain becomes the longest. After that, the task you shortened is no longer critical.',
      '"Critical means important or difficult." It only means there is no spare time. A trivial task can be critical and a vital one can have weeks of slack.',
    ],
    constraints: [
      'Real schedules use working calendars, so "3 days" may skip weekends and holidays. The passes are the same but the date arithmetic is not.',
      'Durations come from people, who tend to pad their estimates or to be optimistic. The result inherits those habits.',
    ],
    alternatives: [
      { name: 'PERT', when: 'Durations are uncertain and you can give an optimistic, a most likely and a pessimistic estimate for each task. It runs the same two passes on a weighted average of the three.' },
      { id: 'monte-carlo', name: 'Monte Carlo simulation of the schedule', when: 'You want the chance of finishing by a given date. Draw random durations many times and run the two passes on each draw.' },
      { id: 'topological-sort', name: 'Topological sort alone', when: 'You only need a valid order for the tasks and durations do not matter.' },
      { name: 'Resource-constrained scheduling', when: 'People or machines are limited, so independent tasks cannot all run at once.' },
      { id: 'bellman-ford', name: 'Bellman-Ford with negated durations', when: 'You want the longest path in a network that is not known to be free of cycles. It is slower, but it reports the cycle instead of assuming there is none.' },
    ],
    comparison: {
      columns: ['', 'Critical Path Method', 'PERT', 'Resource-constrained scheduling'],
      rows: [
        ['Durations', 'One fixed number per task', 'Three estimates per task', 'One fixed number per task'],
        ['People and machines', 'Assumed unlimited', 'Assumed unlimited', 'Limited'],
        ['Result', 'Exact length and slack for the plan given', 'An expected length and a rough spread', 'A workable schedule, usually not proven shortest'],
        ['Cost', 'O(V + E)', 'O(V + E)', 'NP-hard in general'],
      ],
    },
  },

  applications: [
    { title: 'Construction scheduling', status: 'established', text: 'Building projects are planned as networks of tasks with durations and dependencies, and the critical path decides the completion date. Contractors use the slack figures to decide which late deliveries matter and which do not.' },
    { title: 'Project scheduling software', status: 'established', text: 'Tools such as Microsoft Project and Oracle Primavera P6 compute the schedule of a plan with the forward and backward passes, and show the critical tasks on a bar chart much like the timeline on this page.' },
    { title: 'Timing analysis of digital circuits', status: 'established', text: 'A chip designer needs to know whether every signal settles before the next clock tick. Static timing analysis runs a forward pass for the arrival time at each gate and a backward pass for the required time. The difference is called slack, and the slowest route through the logic is called the critical path.' },
    { title: 'Parallel builds and data pipelines', status: 'illustrative', text: 'When build steps or pipeline stages run in parallel on many machines, the wall-clock time cannot be less than the longest chain of steps that depend on one another. Finding that chain shows which step is worth speeding up.' },
    { title: 'Planning an event', status: 'illustrative', text: 'Booking a venue, printing invitations and arranging catering each take time and depend on one another. The two passes show the last safe date for each booking.' },
  ],

  connections: [
    { to: 'topological-sort', type: 'prerequisite', why: 'The Critical Path Method handles tasks in a topological order, so that every earliest time is computed after the times it depends on. Topological Sort is how that order is found, and it is also what detects a circular plan.' },
    { to: 'concept:topological-order', type: 'prerequisite', why: 'Both passes of the Critical Path Method walk a topological order of the project, once forwards and once backwards.' },
    { to: 'concept:graph', type: 'prerequisite', why: 'The Critical Path Method models a project as a directed graph: tasks are nodes and "must finish before" links are arrows.' },
    { to: 'bellman-ford', type: 'related', why: 'The critical path is a longest path, which is a shortest path once every duration is negated. Bellman-Ford can solve that because it allows negative costs, but the Critical Path Method needs only one sweep because a project has no cycles.' },
    { to: 'dijkstra', type: 'related', why: 'Dijkstra\'s Algorithm and the Critical Path Method both label each node with the best total over all routes to it, one keeping the smallest and the other the largest. Dijkstra cannot be turned to the longest chain, because negating the durations produces the negative costs it does not allow.' },
    { to: 'concept:dynamic-programming', type: 'related', why: 'The earliest finish of a task is built from the earliest finishes of the tasks before it, each worked out once and reused. The Critical Path Method is dynamic programming over the graph of the project.' },
    { to: 'monte-carlo', type: 'related', why: 'When durations are uncertain, Monte Carlo simulation runs the Critical Path Method on thousands of randomly drawn sets of durations to estimate the chance of finishing by a date.' },
    { to: 'simplex', type: 'advanced', why: 'The Critical Path Method reports a schedule but does not improve it. Deciding which tasks to pay to speed up, when each has a price per day saved, is a linear program that the Simplex Method can solve.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'A computation split across many machines can finish no sooner than its longest chain of dependent steps, which is the critical path of its task graph.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'A task waits for two others. One of them finishes at day 6 at the earliest, the other at day 9. What is the earliest start of the task?',
      options: ['Day 6', 'Day 9', 'Day 15', 'Day 7.5'],
      answer: 1,
      explain: [
        'At day 6 only one of the two tasks is finished. The task needs both.',
        'The task needs both to be finished, so it waits for the later of the two.',
        'The two tasks ran at the same time, so their finishing days are not added together.',
        'An average has no meaning here. The task can start only when the slower of the two is done.',
      ],
    },
    {
      type: 'predict',
      q: 'In the garden shed, the windows take 6 days to arrive and the shed takes 11 days. Suppose the delivery takes 8 days instead. How long does the shed take now?',
      options: ['Still 11 days', '12 days', '13 days', '19 days'],
      answer: 0,
      explain: [
        'The delivery had 2 days of slack and the delay uses exactly that. The length stays at 11, but the delivery and the fitting are now critical as well.',
        'That would happen with a 9-day delivery. An 8-day delivery only uses up the slack.',
        'The 2 extra days are absorbed by the delivery\'s slack. They are not added to the project.',
        'Tasks that do not wait for each other run at the same time, so the durations are not all added together.',
      ],
      tryInput: { plan: SHED.replace('windows:6', 'windows:8') },
    },
    {
      type: 'debug',
      q: 'This forward pass reports a project length that is too short. What is wrong?',
      code: `for v in order:
    es[v] = min((ef[u] for u in before[v]), default=0)
    ef[v] = es[v] + days[v]
length = max(ef.values())`,
      options: ['`min` should be `max`: a task must wait for the last of the tasks it needs, not the first', 'The loop should run through `order` in reverse', '`default=0` should be `default=1`', '`ef[v]` should subtract the duration'],
      answer: 0,
      explain: [
        'With `min`, a task starts as soon as any one of its prerequisites is done. It needs all of them, so it must wait for the largest earliest finish.',
        'The forward pass must go from first to last, so that the times it reads are already worked out. The backward pass is the one that runs in reverse.',
        'Day 0 is the start of the project, and a task that waits for nothing can begin then.',
        'A task finishes after it starts, so the duration is added.',
      ],
    },
    {
      type: 'choice',
      q: 'Task B waits only for task A. The plan shows 3 days of slack for each. A then finishes 3 days late. How much slack does B have now?',
      options: ['3 days, because each task has its own slack', 'None: the two tasks shared the same 3 days and A has used them', '6 days', 'The project is now 3 days late'],
      answer: 1,
      explain: [
        'Slack is not owned by a task. A\'s delay pushes B\'s earliest start 3 days later, right up to its latest start.',
        'B can now start no earlier than its latest start, so it has become critical. Slack belongs to the chain, not to each task on it.',
        'Slack along a chain is one shared amount. It does not add up.',
        'A used exactly its slack, so the project still finishes on time. One more day of delay to A or B would make it late.',
      ],
    },
    {
      type: 'choice',
      q: 'Why can the method find the longest chain so quickly, when the longest path in a general network is a hard problem?',
      options: ['Because projects are small', 'Because a project has no cycles, so tasks can be handled in an order where each is final when it is reached', 'Because it only finds an approximate answer', 'Because it tries every chain'],
      answer: 1,
      explain: [
        'The method stays fast on projects with many thousands of tasks. Size is not the reason.',
        'With no cycles there is a topological order, and one sweep along it settles every task. In a network with cycles no such order exists.',
        'The answer is exact for the durations given.',
        'Trying every chain is what the method avoids. The number of chains can grow very fast with the size of the project.',
      ],
    },
    {
      type: 'challenge',
      title: 'Free slack',
      prompt: 'Total slack is shared along a chain. Free slack is not: it is how late a task can run without delaying the earliest start of any task that waits for it. Extend one of the programs to print the free slack of every task. Check it on the garden shed, where the window delivery has 2 days of total slack. How much of that is free slack, and why?',
      hints: ['The free slack of a task is the smallest earliest start among the tasks that wait for it, minus its own earliest finish. For a task that nothing waits for, use the project length.', 'In the shed, fitting the windows can start at day 7 and the delivery can finish at day 6.'],
    },
  ],

  compare: {
    idea: 'Sweep forwards for the earliest time of every task, sweep backwards for the latest, and call a task critical where the two agree.',
    requires: 'A list of tasks, how long each one takes, and which tasks must finish before which others can start. Those links must not go round in a circle.',
    sensitivity: 'None in cost: every dependency is looked at three times whatever the project looks like. The answer is only as good as the durations put in.',
    memory: 'O(V): a few numbers per task.',
    difficulty: 'low',
    difficultyNote: 'Two short loops over an ordered list. The usual slips are taking the smaller value where the larger is needed, and reading slack as if each task owned it.',
    limits: 'It assumes there are always enough people and equipment to do unrelated tasks at the same time, and that every duration is known exactly. It tells you how long the plan takes, not how to make it shorter.',
    useWhen: 'You have a project made of tasks that depend on one another, and you want to know the soonest it can finish and which tasks must not run late.',
  },

  advanced: {
    history: 'The method was developed in the late 1950s by Morgan R. Walker of DuPont and James E. Kelley Jr. of Remington Rand, who were looking for a better way to schedule the construction and maintenance of chemical plants. They presented it in 1959, and Kelley published its mathematical basis in 1961. In the same years the United States Navy developed PERT for the Polaris missile programme. PERT uses the same network and the same two passes, and differs mainly in treating each duration as uncertain. The two were soon used together, and the combined name PERT/CPM is still common. The original papers drew each task as an arrow between events. The drawing with tasks in boxes, used on this page, became the usual one later.',
    proof: 'Let the project be a directed acyclic graph with a duration $d_v \\ge 0$ on each task $v$, and let $P(v)$ be the set of tasks $v$ needs and $S(v)$ the set of tasks that need $v$.\n\n**Forward pass.** Define $\\ell(v)$ as the largest total duration of a chain of tasks ending just before $v$, with $\\ell(v) = 0$ when $P(v)$ is empty. Any such chain ends with some $u \\in P(v)$, so $\\ell(v) = \\max_{u \\in P(v)} (\\ell(u) + d_u)$. The forward pass computes exactly this recurrence in topological order, so $ES[v] = \\ell(v)$ and $EF[v] = \\ell(v) + d_v$. Hence $T = \\max_v EF[v]$ is the largest total duration of any chain.\n\n**$T$ is the minimum project length.** Tasks on a chain cannot overlap, so no schedule is shorter than $T$. Starting every task at $ES[v]$ is a valid schedule, since $EF[u] \\le ES[v]$ whenever $u \\in P(v)$, and it finishes at $T$.\n\n**Backward pass.** Define $r(v)$ as the largest total duration of a chain that begins with $v$. Then $r(v) = d_v + \\max_{w \\in S(v)} r(w)$, with the maximum taken as $0$ when $S(v)$ is empty. By induction in reverse topological order, $LS[v] = T - r(v)$: if $S(v)$ is empty then $LS[v] = T - d_v$, and otherwise $LS[v] = \\min_{w \\in S(v)} LS[w] - d_v = T - \\max_{w} r(w) - d_v$.\n\n**Slack.** $LS[v] - ES[v] = T - (\\ell(v) + r(v))$, and $\\ell(v) + r(v)$ is the largest total duration of a chain through $v$. This is at most $T$, with equality exactly when $v$ lies on a longest chain. So the slack is never negative, and it is zero exactly for the tasks on a longest chain.',
    complexityProof: 'Ordering the tasks by counting unfinished prerequisites handles each task once and each dependency once: $O(V + E)$. In the forward pass the inner loop for task $v$ runs $|P(v)|$ times, and $\\sum_v |P(v)| = E$. In the backward pass it runs $|S(v)|$ times, and $\\sum_v |S(v)| = E$. Computing the slack is one subtraction per task. The total is $O(V + E)$, with exactly $3E$ dependency checks, which is what the chart on this page measures.',
    variants: [
      { name: 'PERT', text: 'Each task gets an optimistic estimate $a$, a most likely estimate $m$ and a pessimistic estimate $b$. The two passes are run on the weighted average $(a + 4m + b) / 6$, and the spread of the estimates along the critical path gives a rough idea of the uncertainty in the finish date.' },
      { name: 'Tasks on arrows', text: 'The original form of the method. Each task is an arrow between two events, and each event has an earliest and a latest time. Dummy arrows of zero duration express dependencies that cannot be drawn otherwise.' },
      { name: 'Free slack', text: 'The amount a task can run late without delaying the earliest start of any task after it. It is never more than the total slack, and using it harms nobody else.' },
      { name: 'Crashing', text: 'Each task can be shortened at a cost per day. The question is which tasks to shorten to reach a target date most cheaply. With linear costs this is a linear program, and the critical path changes as tasks are shortened.' },
      { name: 'Links with lags', text: 'Dependencies such as "start together", "finish together" or "start at least two days after" are handled by changing which time each pass reads and adding the lag.' },
      { name: 'Resource levelling', text: 'After the passes, tasks with slack are shifted within their windows to smooth out the demand for people or machines.' },
    ],
    implementation: 'Keep two lists per task, the tasks it needs and the tasks that need it, so that both passes can read their inputs directly. Reject a cyclic plan before either pass runs, and report one actual circle of tasks, since that is what the planner has to fix. When the project is updated often, only the tasks after a changed task need new earliest times and only the tasks before it need new latest times. For real calendars, do the passes in whole working days and convert to dates at the end.',
    benchmarking: 'The cost is linear and does not depend on the shape of the project, so timing mostly measures how the dependency lists are laid out in memory. Report tasks and dependencies handled per second. For a scheduling tool, the more useful measure is how quickly it recomputes after one task changes.',
    references: [
      { authors: 'J. E. Kelley Jr. and M. R. Walker', year: 1959, title: 'Critical-path planning and scheduling', venue: 'Proceedings of the Eastern Joint Computer Conference' },
      { authors: 'J. E. Kelley Jr.', year: 1961, title: 'Critical-path planning and scheduling: Mathematical basis', venue: 'Operations Research 9(3)' },
      { authors: 'D. G. Malcolm, J. H. Roseboom, C. E. Clark and W. Fazar', year: 1959, title: 'Application of a technique for research and development program evaluation', venue: 'Operations Research 7(5)' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, the section on single-source shortest paths in directed acyclic graphs, which treats critical paths in PERT charts.',
      'F. S. Hillier and G. J. Lieberman, *Introduction to Operations Research*, the chapter on project management with PERT/CPM.',
    ],
  },

  tests: [
    { name: 'the worked example: 11 days, critical path base, walls, roof, paint', input: { plan: SHED },
      check: (r, c) => (r.length === 11 && r.path.join(' ') === 'base walls roof paint' && r.critical.join(' ') === 'base walls roof paint' && slackOf(r, 'windows') === 2 && slackOf(r, 'fit') === 1 && !r.several && matchesEveryChain(r, c) === true)
        || `length ${r.length}, path ${r.path.join(' ')}, slack windows ${slackOf(r, 'windows')}, fit ${slackOf(r, 'fit')}; ${matchesEveryChain(r, c)}` },
    { name: 'default random project agrees with a search over every chain', input: {}, check: matchesEveryChain },
    { name: 'sparse random project agrees with a search over every chain', input: { tasks: 12, density: 0, seed: 11, plan: '' }, check: matchesEveryChain },
    { name: 'dense random project agrees with a search over every chain', input: { tasks: 12, density: 1, seed: 5, plan: '' }, check: matchesEveryChain },
    { name: 'another dense random project agrees with a search over every chain', input: { tasks: 10, density: 0.7, seed: 42, plan: '' }, check: matchesEveryChain },
    { name: 'two chains of equal length are both critical', input: { plan: 'A:2, B:4, C:4, D:3, E:1, A>B, A>C, B>D, C>D, A>E' },
      check: (r, c) => (r.length === 9 && r.critical.join('') === 'ABCD' && r.several && slackOf(r, 'E') === 6 && matchesEveryChain(r, c) === true) || `length ${r.length}, critical ${r.critical.join('')}, several ${r.several}` },
    { name: 'the predicted late delivery: still 11 days, and a second chain becomes critical', input: { plan: SHED.replace('windows:6', 'windows:8') },
      check: (r, c) => (r.length === 11 && r.critical.length === 6 && r.several && matchesEveryChain(r, c) === true) || `length ${r.length}, critical ${r.critical.join(' ')}` },
    { name: 'a delivery one day later than its slack lengthens the project', input: { plan: SHED.replace('windows:6', 'windows:9') },
      check: (r, c) => (r.length === 12 && r.path.join(' ') === 'windows fit paint' && matchesEveryChain(r, c) === true) || `length ${r.length}, path ${r.path.join(' ')}` },
    { name: 'shortening a critical task by 3 days shortens the shed by only 2', input: { plan: SHED.replace('walls:4', 'walls:1') },
      check: (r, c) => (r.length === 9 && r.path.join(' ') === 'windows fit paint' && slackOf(r, 'walls') === 1 && matchesEveryChain(r, c) === true) || `length ${r.length}, path ${r.path.join(' ')}` },
    { name: 'with no dependencies the longest task is the project', input: { plan: 'A:2, B:5, C:3' },
      check: (r, c) => (r.length === 5 && r.critical.join('') === 'B' && slackOf(r, 'A') === 3 && slackOf(r, 'C') === 2 && matchesEveryChain(r, c) === true) || `length ${r.length}, critical ${r.critical.join('')}` },
    { name: 'a single chain leaves no slack anywhere', input: { plan: 'A:2, B:3, C:1, D:4, A>B, B>C, C>D' },
      check: (r, c) => (r.length === 10 && r.critical.length === 4 && r.path.join('') === 'ABCD' && matchesEveryChain(r, c) === true) || `length ${r.length}, critical ${r.critical.join('')}` },
    { name: 'a task of 0 days and tasks typed out of order', input: { plan: 'ship:1, gate:0, build:5, test:2, build>gate, gate>ship, test>ship' },
      check: (r, c) => (r.length === 6 && r.critical.join(' ') === 'ship gate build' && slackOf(r, 'test') === 3 && matchesEveryChain(r, c) === true) || `length ${r.length}, critical ${r.critical.join(' ')}` },
    { name: 'a single task', input: { plan: 'only:4' },
      check: (r) => (r.length === 4 && r.path.join('') === 'only' && slackOf(r, 'only') === 0) || `length ${r.length}` },
  ],
};
