import { SERIES } from '../../js/viz/theme.js';

// The demonstration hash. These are the final mixing steps of MurmurHash3: two rounds of
// "xor with a shifted copy, multiply by an odd constant". It scrambles a 32-bit number well
// enough to spread points evenly round the ring, and it is a one-to-one mapping, so two
// different ids never land on the same position. It is not a cryptographic hash, and it is
// not what any particular production system uses.
function mix32(x) {
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

const TWO32 = 4294967296;
const QUIET = { count() {}, frame() {} };   // a tracer that records nothing, used by the tests
const deg = (pos) => `${((pos / TWO32) * 360).toFixed(1)}°`;
const colour = (s) => SERIES[(s - 1) % SERIES.length];
const pct = (a, b) => `${Math.round((100 * a) / b)}%`;

// The owner of position p: the first ring point at or after p, wrapping past the end.
// `ring` is sorted by position. Binary search, so about log2(points) comparisons.
function successor(ring, p, t) {
  let lo = 0, hi = ring.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    t.count('lookup comparisons');
    if (ring[mid].pos < p) lo = mid + 1; else hi = mid;
  }
  return ring[lo === ring.length ? 0 : lo];
}

function run(input, t) {
  const n = Math.max(1, Math.floor(input.servers)), K = Math.max(1, Math.floor(input.keys));
  const v = Math.max(1, Math.floor(input.vnodes)), adding = input.event !== 'remove';
  if (!adding && n < 2) throw new Error('Removing a server needs at least two servers to start with.');
  const salt = mix32(2 * Math.floor(input.seed || 1) + 1);
  const h = (id) => { t.count('hash evaluations'); return mix32((salt + id) >>> 0); };
  const keyHash = (k) => h(k);                                   // keys are numbered 1..K
  const serverPoints = (s) => Array.from({ length: v }, (_, i) => ({ pos: h(0x40000000 + s * 4096 + i), s }));
  const byPos = (a, b) => a.pos - b.pos;

  /* ---- drawing ---- */
  const CL = -1.3, CR = 1.3;
  const at = (pos, r, cx) => [cx + r * Math.sin((2 * Math.PI * pos) / TWO32), r * Math.cos((2 * Math.PI * pos) / TWO32)];
  const arc = (from, to, r, cx) => {
    const a = from / TWO32;
    let b = to / TWO32;
    if (b <= a) b += 1;
    const steps = Math.max(2, Math.ceil((b - a) * 140));
    return Array.from({ length: steps + 1 }, (_, i) => at((a + ((b - a) * i) / steps) * TWO32, r, cx));
  };
  const circle = (r, cx) => arc(0, TWO32 - 1, r, cx).concat([at(0, r, cx)]);

  let ring = [];                 // current ring points, sorted
  let present = [];              // server ids currently on the ring
  let leaving = [];              // points of a server that has just been removed
  const hashes = [];             // key hashes, in key order
  let ringOwner = [], modOwner = [], modN = 0;
  let movedRing = null, movedMod = null;       // Sets of key indices once the event has played
  let ringBefore = null, modBefore = null;     // per-server counts before the event
  let changedArcs = [];
  const countBy = (owners, ids) => Object.fromEntries(ids.map((s) => [s, owners.filter((o) => o === s).length]));

  const views = ({ lookup, fresh, centre } = {}) => {
    const layers = [];
    const total = ring.length + leaving.length;
    layers.push({ type: 'line', points: circle(1, CL), role: 'faint', width: 1.2 });
    layers.push({ type: 'line', points: circle(1, CR), role: 'faint', width: 1.2, dash: [2, 5] });
    for (const [a, label] of [[0, '0°'], [0.25, '90°'], [0.5, '180°'], [0.75, '270°']]) {
      const p = at(a * TWO32, 0.8, CL);
      layers.push({ type: 'text', at: p, text: label, role: 'faint', align: 'center', size: 10, dy: 4 });
    }
    // ownership arcs: each ring point owns the stretch that ends at it
    ring.forEach((q, i) => {
      const prev = ring[(i + ring.length - 1) % ring.length];
      if (ring.length === 1) layers.push({ type: 'line', points: circle(1.09, CL), role: colour(q.s), width: 3.5, alpha: 0.85 });
      else {
        const changed = changedArcs.includes(q.pos);
        layers.push({ type: 'line', points: arc(prev.pos, q.pos, 1.09, CL), role: colour(q.s), width: changed ? 8 : 3.5, alpha: changed ? 1 : 0.85 });
      }
    });
    if (lookup) {
      const path = arc(lookup.from, lookup.to, 0.91, CL);
      const m = path.length;
      layers.push({ type: 'line', points: path.slice(0, m - 1), role: 'active', width: 2 });
      layers.push({ type: 'segments', segments: [[...path[m - 2], ...path[m - 1]]], role: 'active', width: 2, arrow: true });
    }
    // keys, on both circles
    const small = { L: {}, R: {} }, big = { L: {}, R: {} };
    const add = (bucket, role, p) => { (bucket[role] = bucket[role] || []).push(p); };
    hashes.forEach((pos, k) => {
      const rRole = ringOwner[k] ? colour(ringOwner[k]) : 'muted';
      add(movedRing && movedRing.has(k) ? big.L : small.L, rRole, at(pos, 1, CL));
      const mRole = modOwner[k] ? colour(modOwner[k]) : 'muted';
      add(movedMod && movedMod.has(k) ? big.R : small.R, mRole, at(pos, 1, CR));
    });
    for (const side of ['L', 'R']) {
      for (const [role, pts] of Object.entries(small[side])) layers.push({ type: 'points', points: pts, role, r: K > 120 ? 2.2 : 3 });
      for (const [role, pts] of Object.entries(big[side])) layers.push({ type: 'points', points: pts, role, r: K > 120 ? 3.4 : 4.6, ring: true });
    }
    // servers
    const sr = total <= 12 ? 7.5 : total <= 40 ? 5.5 : 4;
    if (leaving.length) layers.push({ type: 'points', points: leaving.map((q) => at(q.pos, 1, CL)), role: colour(leaving[0].s), r: sr, hollow: true });
    for (const s of present) {
      const mine = ring.filter((q) => q.s === s);
      layers.push({ type: 'points', points: mine.map((q) => at(q.pos, 1, CL)), role: colour(s), r: sr, ring: s === fresh });
    }
    if (total <= 12) for (const q of ring.concat(leaving)) layers.push({ type: 'text', at: at(q.pos, 1.24, CL), text: `S${q.s}`, role: 'text', align: 'center', dy: 4 });
    const cl = (centre && centre.left) || ['hash ring'], cr = (centre && centre.right) || ['hash mod n', 'compared later'];
    cl.forEach((line, i) => layers.push({ type: 'text', at: [CL, 0], text: line, role: i ? 'muted' : 'text', align: 'center', dy: (i - (cl.length - 1) / 2) * 17 + 4, mono: false, size: i ? 11.5 : 13 }));
    cr.forEach((line, i) => layers.push({ type: 'text', at: [CR, 0], text: line, role: i ? 'muted' : 'text', align: 'center', dy: (i - (cr.length - 1) / 2) * 17 + 4, mono: false, size: i ? 11.5 : 13 }));

    const ids = [...new Set(present.concat(leaving.map((q) => q.s)))].sort((a, b) => a - b);
    const legend = ids.map((s) => ({ label: `S${s}`, role: colour(s) })).concat(movedRing ? [{ label: 'larger dot with a halo: a key that changed server', role: 'muted' }] : []);
    const column = (title, owners, before, moved, expected) => {
      const now = countBy(owners, ids);
      const items = ids.map((s) => ({ label: `S${s}`, value: before ? `${before[s] ?? 0} → ${now[s]}` : hashes.length && owners.some(Boolean) ? String(now[s]) : '', role: colour(s) }));
      items.push({ label: 'keys moved', value: moved ? `${moved.size} of ${K}` : 'no change yet', role: moved ? 'alert' : undefined, note: moved ? `${pct(moved.size, K)} moved; about ${expected} expected on average` : undefined });
      return { title, items };
    };
    const after = adding ? n + 1 : n - 1;
    return [
      { kind: 'scene', title: 'Left: the hash ring. Right: the same keys, coloured by hash mod n', x: [-2.62, 2.62], y: [-1.36, 1.36], aspect: 0.54, equal: true, axes: false, layers, legend },
      { kind: 'board', columns: [   // no title: a titled board is squeezed into one grid column by the shared stylesheet
        column('Keys per server: hash ring', ringOwner, ringBefore, movedRing, adding ? `1 in ${n + 1}` : `1 in ${n}`),
        column(`Keys per server: hash mod ${modN || n}`, modOwner, modBefore, movedMod, adding ? `${n} in ${n + 1}` : `${after} in ${n}`),
      ] },
    ];
  };

  /* ---- 1. build the ring ---- */
  t.frame(() => ({
    line: null,
    note: `The left circle is the **hash ring**. Positions run clockwise from 0° at the top, all the way round and back to 0°. A hash function, a fixed rule that scrambles a number into another number, will give every server and every key a position on it. Its real output is a whole number below about 4.3 billion; the picture shows it as an angle.`,
    views: views(),
    vars: { servers: n, keys: K, 'positions per server': v },
  }));
  for (let s = 1; s <= n; s++) {
    const pts = serverPoints(s);
    ring = ring.concat(pts).sort(byPos);
    present.push(s);
    t.frame(() => ({
      line: [0, 1, 2],
      note: v === 1
        ? `Server **S${s}** is hashed to position ${deg(pts[0].pos)}. From now on it owns the stretch of ring that ends there: the coloured arc running clockwise from the previous server up to S${s}.`
        : `Server **S${s}** is hashed ${v} times and gets ${v} positions: ${pts.slice(0, 4).map((q) => deg(q.pos)).join(', ')}${v > 4 ? ` and ${v - 4} more` : ''}. These extra positions are called virtual nodes. Each one owns the arc that ends at it.`,
      views: views({ fresh: s }),
      vars: { servers: `${s} of ${n}`, 'ring points': ring.length },
    }));
  }

  /* ---- 2. place the keys ---- */
  const shownOneByOne = Math.min(6, K);
  for (let k = 0; k < K; k++) {
    const pos = keyHash(k + 1);
    hashes.push(pos);
    const before = t.counters ? t.counters['lookup comparisons'] || 0 : 0;
    const q = successor(ring, pos, t);
    ringOwner[k] = q.s;
    if (k < shownOneByOne) {
      const used = (t.counters ? t.counters['lookup comparisons'] || 0 : 0) - before;
      const wrapped = q.pos < pos;
      t.frame(() => ({
        line: [4, 5, 6, 7, 8],
        note: `Key ${k + 1} is hashed to position ${deg(pos)}. Going clockwise from there, the first server position is S${q.s} at ${deg(q.pos)}${wrapped ? ', after passing 0° at the top' : ''}, so **S${q.s}** stores key ${k + 1}. The search took ${used} comparison${used === 1 ? '' : 's'} in the sorted list of ${ring.length} ring positions.`,
        views: views({ lookup: { from: pos, to: q.pos } }),
        vars: { key: k + 1, hash: pos, position: deg(pos), owner: `S${q.s}` },
      }));
    }
  }
  const beforeRing = ring.slice();
  const ringCounts0 = countBy(ringOwner, present);
  t.frame(() => ({
    line: [4, 5, 6, 7, 8],
    note: `${K > shownOneByOne ? `The other ${K - shownOneByOne} keys are placed the same way. ` : ''}Each key is coloured by the server that stores it. The counts are ${present.map((s) => `S${s}: ${ringCounts0[s]}`).join(', ')}.${v === 1 ? ' They are uneven because the arcs are uneven: with one position per server, the arc lengths are a matter of luck.' : ''}`,
    views: views(),
    vars: { keys: K, 'ring points': ring.length },
  }));

  /* ---- 3. the comparison scheme: hash mod n ---- */
  modN = n;
  for (let k = 0; k < K; k++) modOwner[k] = (hashes[k] % n) + 1;
  const modCounts0 = countBy(modOwner, present);
  t.frame(() => ({
    line: [15, 16],
    note: `For comparison, the plain scheme: number the servers and take **hash mod ${n}**, the remainder after dividing the key's hash by ${n}. Remainder 0 means S1, remainder 1 means S2, and so on. The right circle shows the same keys in the same places, coloured by that rule. The colours are mixed all the way round, because a remainder has nothing to do with position.`,
    views: views({ centre: { right: [`hash mod ${n}`, 'owner = remainder + 1'] } }),
    vars: { keys: K, 'example': `key 1: ${hashes[0]} mod ${n} = ${hashes[0] % n}, so S${(hashes[0] % n) + 1}` },
  }));

  /* ---- 4. the event ---- */
  const who = adding ? n + 1 : n;
  ringBefore = ringCounts0; modBefore = modCounts0;
  let newPts = [];
  if (adding) {
    newPts = serverPoints(who);
    ring = ring.concat(newPts).sort(byPos);
    present.push(who);
    t.frame(() => ({
      line: [10, 0, 1, 2],
      note: v === 1
        ? `A new server, **S${who}**, joins. The hash function puts it at ${deg(newPts[0].pos)}. No other server moves.`
        : `A new server, **S${who}**, joins. The hash function gives it ${v} positions on the ring. No other server moves.`,
      views: views({ fresh: who }),
      vars: { event: `add S${who}`, 'ring points': ring.length },
    }));
  } else {
    leaving = ring.filter((q) => q.s === who);
    ring = ring.filter((q) => q.s !== who);
    present = present.filter((s) => s !== who);
    t.frame(() => ({
      line: 12,
      note: `Server **S${who}** leaves, shown as ${v === 1 ? 'a hollow circle' : 'hollow circles'}. Its position${v === 1 ? '' : 's'} on the ring disappear${v === 1 ? 's' : ''}. No other server moves.`,
      views: views(),
      vars: { event: `remove S${who}`, 'ring points': ring.length },
    }));
  }

  // Ring: recompute each key's owner on the new ring.
  const mr = new Set();
  const oldRingOwner = ringOwner.slice();
  for (let k = 0; k < K; k++) {
    const q = successor(ring, hashes[k], t);
    if (q.s !== ringOwner[k]) mr.add(k);
    ringOwner[k] = q.s;
  }
  movedRing = mr;
  // The arcs whose owner changed: those ending at a new point, or those that absorbed a removed point.
  if (adding) changedArcs = newPts.map((q) => q.pos);
  else changedArcs = [...new Set(leaving.map((q) => successor(ring, q.pos, QUIET).pos))];
  const destinations = [...new Set([...mr].map((k) => ringOwner[k]))].sort((a, b) => a - b);
  t.frame(() => {
    let text;
    if (adding && v === 1) {
      const i = ring.findIndex((q) => q.pos === newPts[0].pos);
      const prev = ring[(i + ring.length - 1) % ring.length], next = ring[(i + 1) % ring.length];
      text = `On the ring, S${who} takes over one arc: from S${prev.s} at ${deg(prev.pos)} clockwise to its own position at ${deg(newPts[0].pos)}, drawn thick. The **${mr.size} key${mr.size === 1 ? '' : 's'}** on that arc used to carry on to S${next.s}. Now ${mr.size === 1 ? 'it reaches' : 'they reach'} S${who} first, so ${mr.size === 1 ? 'it moves' : 'they move'}. The other ${K - mr.size} keys still reach the same server as before and stay where they are.`;
    } else if (adding) {
      text = `On the ring, S${who} takes over the ${v} arcs that end at its positions, drawn thick. The **${mr.size} key${mr.size === 1 ? '' : 's'}** on those arcs now reach S${who} first, so they move to it. The other ${K - mr.size} keys still reach the same server as before and stay where they are.`;
    } else {
      text = `On the ring, the keys S${who} held carry on clockwise to the next server position${destinations.length ? `, which belongs to ${destinations.map((s) => `S${s}`).join(' or ')}` : ''}. Those **${mr.size} key${mr.size === 1 ? '' : 's'}** move. The arcs that grew are drawn thick. The other ${K - mr.size} keys were never S${who}'s, so nothing about them changes.`;
    }
    return {
      line: adding ? [10, 11] : [12, 13],
      note: text,
      views: views({ centre: { left: ['hash ring', `${mr.size} of ${K} keys moved`], right: [`hash mod ${n}`, 'not yet updated'] } }),
      vars: { event: adding ? `add S${who}` : `remove S${who}`, 'moved on the ring': `${mr.size} of ${K}` },
    };
  });

  // Modulo: every key is recomputed with the new server count.
  const m2 = adding ? n + 1 : n - 1;
  const oldModOwner = modOwner.slice();
  const mm = new Set();
  for (let k = 0; k < K; k++) {
    const now = (hashes[k] % m2) + 1;
    if (now !== modOwner[k]) mm.add(k);
  }
  const examples = Math.min(3, K);
  for (let k = 0; k < examples; k++) {
    const was = oldModOwner[k], now = (hashes[k] % m2) + 1;
    t.frame(() => ({
      line: [15, 16],
      note: `Modulo hashing must now divide by ${m2} instead of ${n}. Key ${k + 1} has hash ${hashes[k]}. Before: ${hashes[k]} mod ${n} = ${hashes[k] % n}, so S${was}. Now: ${hashes[k]} mod ${m2} = ${hashes[k] % m2}, so S${now}. ${was === now ? 'By luck the two agree, and this key **stays**.' : 'The key **moves**.'}`,
      views: views({ centre: { left: ['hash ring', `${mr.size} of ${K} keys moved`], right: [`hash mod ${n} → mod ${m2}`, `checking key ${k + 1}`] } }),
      vars: { key: k + 1, hash: hashes[k], [`mod ${n}`]: hashes[k] % n, [`mod ${m2}`]: hashes[k] % m2 },
    }));
  }
  for (let k = 0; k < K; k++) modOwner[k] = (hashes[k] % m2) + 1;
  modN = m2;
  movedMod = mm;
  t.frame(() => ({
    line: [15, 16],
    note: `Every key is recomputed as hash mod ${m2}. **${mm.size} of ${K}** land on a different server, and they are scattered all round the right circle. A key stays only when its two remainders happen to agree, which for a well-mixed hash is about 1 time in ${Math.max(n, m2)}.`,
    views: views({ centre: { left: ['hash ring', `${mr.size} of ${K} keys moved`], right: [`hash mod ${m2}`, `${mm.size} of ${K} keys moved`] } }),
    vars: { 'moved on the ring': `${mr.size} of ${K}`, 'moved with modulo': `${mm.size} of ${K}` },
  }));
  t.frame(() => ({
    line: null,
    note: `Result: the hash ring moved **${mr.size} of ${K}** keys (${pct(mr.size, K)}) and modulo hashing moved **${mm.size} of ${K}** (${pct(mm.size, K)}). On average the ring moves about 1 key in ${adding ? n + 1 : n}, the share that one server holds, which is the least any scheme could move and still ${adding ? 'give the new server its share' : 'rehouse the lost server\'s keys'}. This single run can be above or below that average.`,
    views: views({ centre: { left: ['hash ring', `${mr.size} of ${K} keys moved`], right: [`hash mod ${m2}`, `${mm.size} of ${K} keys moved`] } }),
    vars: { 'moved on the ring': `${mr.size} of ${K}`, 'moved with modulo': `${mm.size} of ${K}` },
  }));

  if (input.measure) t.count('keys moved', input.measure === 'modulo' ? mm.size : mr.size);

  return {
    servers: n, keys: K, vnodes: v, event: adding ? 'add' : 'remove', server: who,
    hashes, ringBefore: beforeRing, ringAfter: ring.slice(),
    ownerBefore: oldRingOwner, ownerAfter: ringOwner.slice(), modOwnerBefore: oldModOwner, modOwnerAfter: modOwner.slice(),
    movedRing: mr.size, movedMod: mm.size, countsBefore: ringCounts0, countsAfter: countBy(ringOwner, present),
  };
}

/* ---- independent checks for the tests ---- */

// Owner by a plain linear scan, sharing no code with the binary search in run().
function slowOwner(ring, p) {
  let best = null, lowest = ring[0];
  for (const q of ring) {
    if (q.pos < lowest.pos) lowest = q;
    if (q.pos >= p && (best === null || q.pos < best.pos)) best = q;
  }
  return (best || lowest).s;
}

function checkEvent(r) {
  let movedRing = 0, movedMod = 0;
  const m2 = r.event === 'add' ? r.servers + 1 : r.servers - 1;
  for (let k = 0; k < r.keys; k++) {
    const was = slowOwner(r.ringBefore, r.hashes[k]), now = slowOwner(r.ringAfter, r.hashes[k]);
    if (was !== r.ownerBefore[k] || now !== r.ownerAfter[k]) return `key ${k + 1}: the lookup disagrees with a linear scan`;
    if (was !== now) {
      movedRing++;
      if (r.event === 'add' && now !== r.server) return `key ${k + 1} moved to S${now}, not to the new server`;
      if (r.event === 'remove' && was !== r.server) return `key ${k + 1} moved although its server did not leave`;
    } else if (r.event === 'remove' && was === r.server) return `key ${k + 1} still belongs to the removed server`;
    if ((r.hashes[k] % r.servers) !== (r.hashes[k] % m2)) movedMod++;
  }
  if (movedRing !== r.movedRing) return `reported ${r.movedRing} ring moves, counted ${movedRing}`;
  if (movedMod !== r.movedMod) return `reported ${r.movedMod} modulo moves, counted ${movedMod}`;
  return true;
}

export default {
  meta: {
    id: 'consistent-hashing',
    name: 'Consistent Hashing',
    aliases: ['hash ring', 'ring hashing', 'consistent hash ring', 'virtual nodes'],
    kind: 'data-structure',
    discipline: 'distributed-systems',
    alsoIn: [
      { id: 'algorithms', why: 'It is a hash table whose buckets can be added and removed without rehashing everything, built from a sorted list and binary search.' },
    ],
    subfield: 'Partitioning and load balancing',
    family: 'Hash-based partitioning',
    lab: 'data-structures',
    year: 1997,
    authors: 'D. Karger, E. Lehman, T. Leighton, R. Panigrahy, M. Levine and D. Lewin',
    summary: 'Assigns keys to servers by position on a ring, so that adding or removing one server moves only the keys next to it instead of nearly all of them.',
    difficulty: 'intermediate',
    order: 920,
    paradigms: ['hashing'],
    randomized: false,
    approximate: false,
    time: { best: 'O(log(n·v)) per lookup', average: 'O(log(n·v)) per lookup', worst: 'O(log(n·v)) per lookup', class: 'logarithmic' },
    space: { worst: 'O(n·v)', class: 'linear' },
    tags: {
      problems: ['which server holds this data', 'spread data across servers', 'add a server without moving everything', 'share load between machines', 'distributed cache', 'sharding'],
      techniques: ['hash ring', 'virtual nodes', 'binary search', 'clockwise successor'],
      applications: ['distributed systems', 'databases', 'networking'],
    },
    prerequisites: ['hash-table', 'binary-search', 'concept:hashing', 'concept:modular-arithmetic'],
  },

  bigIdea: {
    simple: "Big websites keep their data on many computers, called servers. To fetch a piece of data, a program must know which server holds it. A simple rule is to number the servers and do a little arithmetic on the data's name. That rule has a flaw. Add or remove one server, and almost every piece of data is suddenly assigned somewhere else. Nearly everything would have to be copied to a new home. Consistent hashing avoids this. Imagine a circle, like a clock face. Each server is given a spot on the circle. Each piece of data is given a spot too. The data belongs to the first server you meet when you walk clockwise from its spot. Now add a new server. It takes over only the stretch of circle just behind it. The data on that stretch moves to the new server. Everything else stays exactly where it was.",
    what: 'Consistent hashing is a way to decide which of several servers is responsible for each key. A hash function maps every server and every key to a position on a ring. A key belongs to the first server found clockwise from the key\'s position. When a server joins, it takes keys only from its clockwise neighbour; when one leaves, its keys pass to that neighbour. No other key changes owner.',
    why: 'David Karger and colleagues at MIT introduced it in 1997 for caching web pages. A popular page can attract more requests than one machine can serve, so copies are spread over many caches, and the set of working caches keeps changing. With the usual rule, hash mod n, every change in n sends almost every request to a cache that does not yet hold the page. They wanted a rule under which a change disturbs as little as possible.',
    when: 'Use it when keys must be spread over a set of machines that changes over time, and moving a key is expensive: a cache that would have to be refilled, or stored data that would have to be copied. If the number of buckets never changes, plain modulo hashing, as used inside a [hash table](#/algorithm/hash-table), is simpler and balances just as well. If the servers are few and you can afford to score each one per lookup, rendezvous hashing gives the same minimal movement without a ring.',
    interesting: 'With hash mod n, going from n to n + 1 servers moves about n out of every n + 1 keys. With a ring, it moves about 1 out of every n + 1, and that is the smallest fraction possible, because the new server has to be given its share from somewhere. The price is balance: a few random points cut a ring into very unequal arcs, which is why practical rings give every server many positions.',
    where: 'Amazon\'s Dynamo storage system partitions its keys this way, and so do the distributed databases modelled on it. Client libraries for distributed caches use it to choose a cache server, peer-to-peer lookup systems such as Chord are built on it, and some network load balancers use a variant to keep each connection on the same backend.',
    analogy: {
      title: 'Stops on a circular bus route',
      text: 'A road runs in a ring round a town, with houses all along it and a handful of bus stops. Everybody walks clockwise along the road to the first stop they come to. If the town builds a new stop, only the households between the previous stop and the new one change their habits: they now reach the new stop first. If a stop closes, only its own passengers are affected. They walk on to the next one. Nobody else in town notices.',
      limits: 'Houses and bus stops stand where they do for reasons. On a hash ring every position is a scrambled number with no meaning, and that scrambling is what spreads the keys evenly. Nobody walks, either: finding the next server is a quick search in a sorted list of positions. The picture also leaves out two things real systems add. Each server is given many positions, not one, so that the stretches even out. And each item is usually stored on several servers in a row, so that losing one server loses no data.',
    },
  },

  example: {
    setup: "Picture a ring with positions numbered 0 to 99, where 99 is followed by 0 again. Three servers have been given positions: A at 10, B at 40 and C at 75. Six keys have positions 7, 22, 38, 51, 64 and 93. A key belongs to the first server at or after its position, going upward and wrapping round past 99.",
    steps: [
      "Key 7 reaches A at 10. Keys 22 and 38 reach B at 40. Keys 51 and 64 reach C at 75. Key 93 passes 99, wraps round to 0 and reaches A at 10.",
      "So A holds 7 and 93, B holds 22 and 38, and C holds 51 and 64.",
      "Now add a server D at position 55. Check each key again. Key 51 now reaches D at 55 before it reaches C, so it moves to D.",
      "Key 64 is past 55, so it still reaches C. Keys 7, 22, 38 and 93 never came near 55. Only 1 key out of 6 has moved.",
      "Compare the plain rule: divide the key's number by the number of servers and use the remainder. With 3 servers the remainders of 7, 22, 38, 51, 64, 93 are 1, 1, 2, 0, 1, 0. With 4 servers they are 3, 2, 2, 3, 0, 1.",
    ],
    result: "On the ring, 1 key out of 6 moved, and it moved to the new server. With the remainder rule, 5 keys out of 6 got a different remainder and would have to move. Only 38 kept its place, because 38 leaves remainder 2 both times.",
  },

  terms: [
    { term: "Server", meaning: "One of the computers that share the job of storing the data. Also called a node." },
    { term: "Key", meaning: "The name or number that identifies one piece of data, such as a user id or a web address." },
    { term: "Hash function", meaning: "A fixed rule that scrambles any input into a number that looks random. The same input always gives the same number." },
    { term: "Hash ring", meaning: "The range of all possible hash values, pictured as a circle so that the largest value is followed by the smallest." },
    { term: "Owner", meaning: "The server responsible for a key: the first server position at or after the key's position, going clockwise." },
    { term: "Modulo", meaning: "The remainder left after a division. 14 modulo 4 is 2, because 14 is 3 fours with 2 left over." },
    { term: "Virtual node", meaning: "One of several positions given to the same server, so that its share of the ring is made of many small pieces instead of one piece of luck-dependent size." },
    { term: "Rebalancing", meaning: "Moving keys between servers after the set of servers has changed." },
  ],

  takeaway: "Put servers and keys on a circle and give each key to the next server clockwise; then adding or removing a server only disturbs the keys right beside it.",

  viz: {
    describe: 'Two circles side by side. The left circle is the hash ring: positions run clockwise from 0 degrees at the top. Servers are large labelled dots, each in its own colour, and the arc each server owns is drawn in that colour just outside the ring. Keys are small dots on the ring, coloured by the server that owns them. The right circle shows the same keys at the same positions, coloured instead by the server that hash mod n assigns. After a server is added or removed, every key that changed server is drawn larger with a halo, and arcs that changed owner are drawn thick. Below, a board lists the number of keys on each server under both schemes, before and after, and how many keys moved.',
    inputs: [
      { id: 'servers', type: 'range', label: 'Servers to start with', min: 2, max: 6, step: 1, default: 4 },
      { id: 'keys', type: 'range', label: 'Number of keys', min: 10, max: 200, step: 10, default: 60 },
      { id: 'vnodes', type: 'range', label: 'Positions per server (virtual nodes)', min: 1, max: 12, step: 1, default: 1,
        help: 'With 1, each server owns a single arc of luck-dependent length. More positions make the shares more even.' },
      { id: 'event', type: 'select', label: 'Then', options: [{ value: 'add', label: 'Add a server' }, { value: 'remove', label: 'Remove a server' }], default: 'add' },
      { id: 'seed', type: 'seed', label: 'Seed for the hash', default: 44 },
    ],
    presets: [
      { label: 'Add a fifth server', values: { servers: 4, keys: 60, vnodes: 1, event: 'add', seed: 44 } },
      { label: 'Remove a server', values: { servers: 4, keys: 60, vnodes: 1, event: 'remove', seed: 44 } },
      { label: 'Eight virtual nodes each', values: { servers: 4, keys: 120, vnodes: 8, event: 'add', seed: 44 } },
      { label: 'Two servers become three', values: { servers: 2, keys: 60, vnodes: 1, event: 'add', seed: 12 } },
      { label: 'Six servers, many keys', values: { servers: 6, keys: 200, vnodes: 4, event: 'remove', seed: 9 } },
    ],
    tryThis: [
      'Load "Add a fifth server" and step to the end. On the left, the haloed keys sit together on one arc, just before S5. On the right they are everywhere. Read the two "keys moved" lines on the board.',
      'Keep the same settings and press Randomize a few times. The modulo count stays close to four fifths of the keys. The ring count jumps about, because with one position per server the size of the arc S5 lands in is a matter of luck.',
      'Now raise "Positions per server" to 8 and randomize again. The ring count settles near one fifth of the keys, and the per-server counts on the board become much more even.',
      'Switch to "Remove a server". On the ring only the departing server\'s keys move, and they go to the next position clockwise. Compare how many keys modulo hashing moves for the same change.',
    ],
    run,
    report: (r, c) => `${r.event === 'add' ? `Added S${r.server} to` : `Removed S${r.server} from`} ${r.servers} servers holding ${r.keys} keys (${r.vnodes} position${r.vnodes === 1 ? '' : 's'} per server).\nHash ring: ${r.movedRing} keys moved (${pct(r.movedRing, r.keys)}).   Hash mod n: ${r.movedMod} keys moved (${pct(r.movedMod, r.keys)}).\nKeys per server on the ring afterwards: ${Object.entries(r.countsAfter).map(([s, k]) => `S${s}=${k}`).join(', ')}\n${c['hash evaluations'] || 0} hash evaluations, ${c['lookup comparisons'] || 0} comparisons in ring lookups.`,
    experiment: {
      title: 'Keys that move when one more server joins',
      note: 'Each point is a real run with 2000 keys and 32 positions per server: build a ring of n servers, add one more, and count the keys whose server changed. The same keys are also assigned by hash mod n and then by hash mod (n + 1). The curves are the averages predicted for a well-mixed hash, not fitted to the points.',
      metric: 'keys moved',
      metricLabel: 'Keys that changed server (out of 2000)',
      sizeLabel: 'Servers before the new one joins (n)',
      sizes: [2, 4, 8, 16, 32, 64],
      variants: [
        { id: 'ring', label: 'Hash ring' },
        { id: 'modulo', label: 'Hash mod n' },
      ],
      input: (n, variant, seed) => ({ servers: n, keys: 2000, vnodes: 32, event: 'add', seed, measure: variant }),
      theory: [
        { label: '2000 / (n + 1)', fn: (n) => 2000 / (n + 1), variant: 'ring' },
        { label: '2000 · n / (n + 1)', fn: (n) => (2000 * n) / (n + 1), variant: 'modulo' },
      ],
    },
  },

  logic: {
    intuition: 'With hash mod n, the number of servers is inside the formula, so changing it changes the answer for almost every key. On a ring, the number of servers appears nowhere. A key\'s owner depends only on where the key is and where the nearest server clockwise is. Adding or removing a server far away on the ring cannot change that, so the damage is confined to one neighbourhood.',
    steps: [
      'Choose a hash function and treat its range of outputs as a ring, where the largest value wraps round to zero.',
      'For each server, hash its identifier to get a position on the ring. To use virtual nodes, hash it several times with a counter attached and keep all the positions.',
      'Keep every position in a list sorted by value, each tagged with its server.',
      'To find the owner of a key, hash the key, then find the first position in the list that is at or after the key\'s hash. If there is none, wrap round and take the first position in the list.',
      'To add a server, insert its positions. The keys on the arcs just before those positions now belong to it and must be copied from their previous owners.',
      'To remove a server, delete its positions. Its keys now belong to whichever positions come next clockwise.',
    ],
    pseudocode: [
      'place(server s):',
      '  for i in 0 .. v − 1:',
      '    ring.insert(h(s, i), s)',
      '',
      'owner(key):',
      '  p ← h(key)',
      '  find first ring point ≥ p',
      '  none? wrap to the first',
      '  return its server',
      '',
      'add(s): place(s)',
      '  keys just before s move to s',
      'remove(s): delete its points',
      '  its keys move clockwise',
      '',
      'modulo_owner(key):',
      '  return h(key) mod n',
    ],
    decisions: [
      { title: 'How many positions per server?', text: 'One position per server gives arcs of wildly different lengths, so some servers hold several times their fair share. With v positions each, a server\'s share is the sum of v small arcs and its relative spread shrinks roughly like 1/√v. Deployed systems use from tens to a few hundred. More positions cost memory and make the sorted list longer.' },
      { title: 'Which hash function?', text: 'It must spread inputs evenly and be the same on every machine. It does not need to be cryptographic unless an adversary can choose keys. This lesson uses a small 32-bit mixing function for demonstration. Real systems have used MD5, SHA-1 and fast non-cryptographic hashes.' },
      { title: 'How is the ring stored?', text: 'A sorted array with binary search is enough when servers change rarely, because lookups vastly outnumber changes. A balanced search tree makes insertions and deletions cheaper when membership changes often.' },
      { title: 'Which server is "next" for copies?', text: 'Systems that keep several copies of each key store them on the next few distinct servers clockwise. With virtual nodes, consecutive positions can belong to the same server, so repeats have to be skipped.' },
    ],
    invariants: [
      'Every key belongs to the server whose ring position is the first at or after the key\'s position, clockwise.',
      'A key\'s owner changes only if a server position is inserted or deleted on the arc between the key and its current owner\'s position.',
      'When a server is added, every key that moves, moves to the new server. When a server is removed, the keys that move are exactly the ones it held.',
    ],
    edgeCases: [
      'A key whose position is beyond the last server position wraps round to the first. Forgetting this is the classic bug.',
      'A key that hashes to exactly a server\'s position belongs to that server, by the "at or after" rule.',
      'Two servers that hash to the same position need a tie-breaking rule. With a 32-bit hash and a few hundred positions this is rare but not impossible; wider hashes make it negligible.',
      'A single server owns the whole ring.',
      'Servers of different capacity can be given numbers of positions in proportion to their capacity.',
      'If the server that leaves has crashed, its keys cannot be copied from it. Consistent hashing only says where they belong now; getting the data there is the job of replication.',
    ],
    correctness: 'The owner of a key is a function of two things only: the key\'s position and the set of server positions. Suppose a server s is added. Take any key and let q be the position that owned it before. If none of the new positions falls on the arc from the key clockwise to q, then q is still the first position at or after the key, and the owner is unchanged. If one or more do, the first of them now comes before q, and it belongs to s, so the key moves to s and nowhere else. Removal is the same argument run backwards: a key is affected only if the position that owned it is deleted, in which case it passes to the next position clockwise. For the size of the disturbance, assume the hash places positions independently and uniformly. By symmetry each of the n + 1 servers is equally likely to own any given key once s has joined, so the chance that a key belongs to s, and therefore moved, is 1/(n + 1).',
    mistakes: [
      'Not wrapping round at the end of the sorted list, so keys past the last position have no owner or cause an out-of-range error.',
      'Using a hash that differs between machines or program runs, such as a language\'s built-in randomized string hash. All clients must compute identical positions.',
      'Using one position per server and then being surprised that one server holds half the keys.',
      'Assuming that adding a server relieves every existing server equally. With few positions it mostly relieves one neighbour.',
      'Treating consistent hashing as a replication or failure-handling scheme. It only decides ownership.',
    ],
  },

  code: {
    sample: {
      input: 'Forty keys, four servers with eight ring positions each, then a fifth server is added. The same keys are also assigned by hash mod 4 and hash mod 5.',
      expected: 'ring before: 8 18 6 8\nring after:  6 12 4 8 10\nring moved 10 of 40\nmodulo moved 32 of 40',
    },
    python: {
      source: `import bisect

MASK = 0xFFFFFFFF


def mix32(x):
    x = ((x ^ (x >> 16)) * 0x85EBCA6B) & MASK
    x = ((x ^ (x >> 13)) * 0xC2B2AE35) & MASK
    return x ^ (x >> 16)


def build_ring(servers, copies):
    return sorted((mix32(1000 * s + i + 1), s) for s in servers for i in range(copies))


def ring_owner(ring, key):
    i = bisect.bisect_left(ring, (mix32(key + 50000), -1))
    return ring[i % len(ring)][1]


def moved(before, after):
    return sum(1 for a, b in zip(before, after) if a != b)


keys = range(40)
old = build_ring([0, 1, 2, 3], 8)
new = build_ring([0, 1, 2, 3, 4], 8)
ring_before = [ring_owner(old, k) for k in keys]
ring_after = [ring_owner(new, k) for k in keys]
mod_before = [mix32(k + 50000) % 4 for k in keys]
mod_after = [mix32(k + 50000) % 5 for k in keys]
print("ring before: " + " ".join(str(ring_before.count(s)) for s in range(4)))
print("ring after:  " + " ".join(str(ring_after.count(s)) for s in range(5)))
print(f"ring moved {moved(ring_before, ring_after)} of {len(keys)}")
print(f"modulo moved {moved(mod_before, mod_after)} of {len(keys)}")`,
      notes: [
        { line: 6, text: 'The demonstration hash: two rounds of xor-shift and multiply, kept to 32 bits. It is a toy for this lesson, not what any particular production system uses.' },
        { line: 13, text: 'Each server is hashed `copies` times. The ring is just the sorted list of (position, server) pairs.' },
        { line: 17, text: '`bisect_left` finds the first ring position at or after the key\'s hash, by binary search.' },
        { line: 18, text: 'The `%` wraps round: a key past the last position belongs to the first one.' },
        { line: 31, text: 'The comparison scheme. The server count is inside the formula, which is exactly why changing it reshuffles nearly every key.' },
      ],
    },
    javascript: {
      source: `function mix32(x) {
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

function buildRing(servers, copies) {
  const ring = [];
  for (const s of servers) {
    for (let i = 0; i < copies; i++) ring.push([mix32(1000 * s + i + 1), s]);
  }
  return ring.sort((a, b) => a[0] - b[0]);
}

function ringOwner(ring, key) {
  const p = mix32(key + 50000);
  let lo = 0, hi = ring.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ring[mid][0] < p) lo = mid + 1; else hi = mid;
  }
  return ring[lo % ring.length][1];
}

const moved = (before, after) => before.filter((owner, k) => owner !== after[k]).length;
const count = (owners, s) => owners.filter((owner) => owner === s).length;

const keys = Array.from({ length: 40 }, (_, k) => k);
const oldRing = buildRing([0, 1, 2, 3], 8);
const newRing = buildRing([0, 1, 2, 3, 4], 8);
const ringBefore = keys.map((k) => ringOwner(oldRing, k));
const ringAfter = keys.map((k) => ringOwner(newRing, k));
const modBefore = keys.map((k) => mix32(k + 50000) % 4);
const modAfter = keys.map((k) => mix32(k + 50000) % 5);
console.log("ring before: " + [0, 1, 2, 3].map((s) => count(ringBefore, s)).join(" "));
console.log("ring after:  " + [0, 1, 2, 3, 4].map((s) => count(ringAfter, s)).join(" "));
console.log("ring moved " + moved(ringBefore, ringAfter) + " of " + keys.length);
console.log("modulo moved " + moved(modBefore, modAfter) + " of " + keys.length);`,
    },
    cpp: {
      source: `#include <algorithm>
#include <cstdint>
#include <iostream>
#include <utility>
#include <vector>

using Ring = std::vector<std::pair<std::uint32_t, int>>;

std::uint32_t mix32(std::uint32_t x) {
    x = (x ^ (x >> 16)) * 0x85EBCA6Bu;
    x = (x ^ (x >> 13)) * 0xC2B2AE35u;
    return x ^ (x >> 16);
}

Ring buildRing(int servers, int copies) {
    Ring ring;
    for (int s = 0; s < servers; ++s) {
        for (int i = 0; i < copies; ++i) ring.push_back({mix32(1000 * s + i + 1), s});
    }
    std::sort(ring.begin(), ring.end());
    return ring;
}

int ringOwner(const Ring& ring, int key) {
    auto it = std::lower_bound(ring.begin(), ring.end(), std::make_pair(mix32(key + 50000), -1));
    return it == ring.end() ? ring.front().second : it->second;
}

int main() {
    const int keys = 40;
    Ring oldRing = buildRing(4, 8), newRing = buildRing(5, 8);
    std::vector<int> before(4, 0), after(5, 0);
    int ringMoved = 0, modMoved = 0;
    for (int k = 0; k < keys; ++k) {
        int a = ringOwner(oldRing, k), b = ringOwner(newRing, k);
        ++before[a];
        ++after[b];
        if (a != b) ++ringMoved;
        if (mix32(k + 50000) % 4 != mix32(k + 50000) % 5) ++modMoved;
    }
    std::cout << "ring before:";
    for (int c : before) std::cout << " " << c;
    std::cout << "\\nring after: ";
    for (int c : after) std::cout << " " << c;
    std::cout << "\\nring moved " << ringMoved << " of " << keys << "\\n";
    std::cout << "modulo moved " << modMoved << " of " << keys << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The ring is a sorted list of n·v positions, where n is the number of servers and v the positions per server. Finding a key\'s owner is one hash and one binary search. The more important cost is not time but movement: how many keys must be copied when the set of servers changes.',
    cases: [
      { case: 'Lookup', time: 'O(log(n·v))', when: 'One hash evaluation and a binary search over the sorted positions.' },
      { case: 'Add or remove a server', time: 'O(v log(n·v)) to update a balanced tree', when: 'With a plain sorted array, inserting or deleting v positions costs O(n·v) instead, which is fine when membership changes rarely.' },
      { case: 'Keys moved per change', time: 'K / n on average', when: 'For K keys. Only the affected server\'s share moves. Modulo hashing moves about K·(n − 1)/n.' },
    ],
    space: 'O(n·v) for the ring: one entry per server position. Nothing is stored per key.',
    memory: 'A ring of a few hundred servers with a hundred or so positions each is tens of thousands of small entries, which fits in a processor cache. Every client that routes requests needs its own copy and must be told when membership changes.',
    tradeoffs: 'More positions per server buy better balance and smoother hand-over at the cost of memory and slightly longer searches. Compared with modulo hashing, the ring gives up perfect simplicity and, at low v, even balance, in exchange for moving very few keys. Rendezvous hashing matches the minimal movement with no stored structure but looks at every server on each lookup.',
    assumptions: [
      'The hash function spreads positions evenly and independently enough to be treated as random.',
      'The "keys moved" figures are averages. A single change can move more or fewer, especially with few positions per server.',
      'Evaluating the hash takes constant time for keys of bounded length.',
      'The counts on this page are from a 32-bit demonstration hash and a few hundred keys. They illustrate the proportions and are not performance measurements of a real system.',
    ],
  },

  tradeoffs: {
    excels: [
      'Clusters whose membership changes: servers added for capacity, removed for maintenance, or lost to failures.',
      'Caches, where every key that changes server is a cache miss.',
      'Stores where moving a key means copying its data across the network.',
      'Decentralized systems: any client with the same list of servers computes the same owner with no coordination.',
    ],
    struggles: [
      'Balance with few positions per server: some servers get several times their share.',
      'Skewed workloads. The ring spreads keys evenly, not requests, so one very popular key still lands on one server.',
      'Tiny clusters with fixed membership, where the ring is extra machinery for no gain.',
      'Uses that need keys in sorted order. Hashing scatters neighbouring keys, so range queries touch every server.',
    ],
    pitfalls: [
      'Clients with different views of which servers exist will disagree about owners until their lists converge.',
      'A hash function that is not identical across languages and library versions splits the cluster silently.',
      'Removing a failed server shifts its whole load onto its clockwise neighbours, which can overload them in turn if they were already busy.',
    ],
    misunderstandings: [
      "\"No keys move when a server is added.\" Some must, or the new server would be empty. The point is that only about one server's share moves, and all of it goes to the new server.",
      "\"The ring spreads the load evenly.\" Only on average, and only with many positions per server. With one position each, the arcs are random lengths and the shares can be very unequal.",
      "\"Consistent hashing keeps data safe when a server fails.\" It only tells you which server a key belongs to. Keeping extra copies on other servers is a separate mechanism built on top of it.",
      "\"The hash ring is a physical or network layout.\" It is only a way of picturing numbers. Servers that are neighbours on the ring can be in different buildings.",
    ],
    constraints: [
      'Real systems store each key on several consecutive servers and must skip virtual nodes belonging to a server already chosen.',
      'Membership itself has to be agreed on, usually by a separate protocol such as gossip or a consensus service.',
      'When servers differ in capacity, positions are assigned in proportion to it.',
    ],
    alternatives: [
      { id: 'hash-table', name: 'Plain modulo hashing', when: 'The number of buckets is fixed, or everything can be rehashed at once, as inside a single in-memory hash table.' },
      { name: 'Rendezvous (highest random weight) hashing', when: 'There are few servers: score every server for the key and pick the highest. Same minimal movement, no ring to store.' },
      { name: 'Jump consistent hash', when: 'Buckets are numbered 0 to n − 1 and only ever added or removed at the end. No memory, near-perfect balance.' },
      { name: 'Range partitioning', when: 'Keys must stay in sorted order across servers so that range scans are efficient.' },
    ],
    comparison: {
      columns: ['', 'Hash ring', 'Hash mod n', 'Rendezvous hashing'],
      rows: [
        ['Keys moved when one of n servers changes', 'About 1/n', 'About (n − 1)/n', 'About 1/n'],
        ['Lookup cost', 'O(log(n·v))', 'O(1)', 'O(n)'],
        ['Stored state', 'n·v sorted positions', 'Just n', 'The server list'],
        ['Balance', 'Good only with many positions', 'Even', 'Even'],
      ],
    },
  },

  applications: [
    { title: 'Amazon\'s Dynamo', status: 'established', text: 'Dynamo, the key-value store described by DeCandia and colleagues in 2007, partitions data across storage nodes with consistent hashing and gives each node many virtual nodes on the ring. Each key is also replicated on the following distinct nodes clockwise.' },
    { title: 'Distributed databases', status: 'established', text: 'Apache Cassandra, whose design draws on Dynamo, arranges its nodes on a token ring and assigns each row to a node by the hash of its partition key.' },
    { title: 'Distributed caches', status: 'established', text: 'Client libraries for cache servers such as memcached commonly offer consistent hashing for choosing a server, so that adding or losing one cache machine invalidates only a fraction of the cached entries instead of nearly all of them.' },
    { title: 'Web content delivery', status: 'established', text: 'The original paper was about spreading requests for web pages over a changing set of caches. Two of its authors, Tom Leighton and Daniel Lewin, went on to found Akamai, whose content delivery network grew out of that research.' },
    { title: 'Peer-to-peer lookup', status: 'established', text: 'The Chord protocol assigns both peers and keys identifiers on a ring by consistent hashing, and adds routing tables so that any peer can find a key\'s owner in a logarithmic number of hops.' },
  ],

  connections: [
    { to: 'hash-table', type: 'prerequisite', why: 'Both map a key to a bucket by hashing it. A hash table can afford to rehash everything when it grows; consistent hashing is the answer when the buckets are machines and rehashing means copying data across a network.' },
    { to: 'binary-search', type: 'prerequisite', why: 'Finding a key\'s owner is a search for the first position at or after the key\'s hash in a sorted list.' },
    { to: 'concept:hashing', type: 'prerequisite', why: 'The scheme depends on a hash function that turns identifiers into evenly spread, repeatable positions.' },
    { to: 'concept:load-balancing', type: 'related', why: 'The goal is to share work among machines evenly while disturbing as little as possible when the set of machines changes.' },
    { to: 'concept:modular-arithmetic', type: 'related', why: 'The ring is arithmetic modulo the size of the hash range, and the scheme it replaces assigns keys by a remainder.' },
    { to: 'concept:expectation', type: 'advanced', why: 'The guarantee is an average: by symmetry a new server is expected to take 1/(n + 1) of the keys, and virtual nodes reduce the spread around that average.' },
    { to: 'reservoir-sampling', type: 'related', why: 'Both rest on the same counting fact: when option number n + 1 arrives, a fair scheme switches to it with probability 1/(n + 1) and otherwise leaves things alone.' },
    { to: 'raft', type: 'related', why: 'They solve neighbouring problems in the same systems. Consistent hashing decides which servers hold a key; a consensus protocol keeps those servers\' copies in agreement.' },
    { to: 'discipline:algorithms', type: 'related', why: 'It is a dictionary data structure in which the buckets themselves can come and go.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'A new server joins a hash ring. Which keys change owner?',
      options: ['All of them', 'A random selection from every server', 'Only the keys on the arcs just before the new server\'s positions, and they all move to the new server', 'None'],
      answer: 2,
      explain: [
        'That is what happens with hash mod n, where the server count is part of the formula.',
        'Keys do not move between the old servers at all. Every move is to the new server.',
        'Correct. For any other key, the first server position clockwise is the same as before.',
        'The new server has to take over some keys, or it would be doing no work.',
      ],
    },
    {
      type: 'predict',
      q: 'Sixty keys are spread over 4 servers by hash mod 4. A fifth server is added and the rule becomes hash mod 5. About how many keys change server?',
      options: ['About 12, one fifth', 'About 30, one half', 'About 48, four fifths', 'All 60'],
      answer: 2,
      explain: [
        'One fifth is what the hash ring moves on average. Modulo hashing is far worse.',
        'There is no reason for half. A key stays only if its remainders modulo 4 and modulo 5 agree.',
        'Correct. A key stays only when hash mod 4 equals hash mod 5, which happens for 4 hash values out of every 20. The run on this page moves exactly 48 of the 60.',
        'A few keys stay by coincidence: those whose two remainders happen to be equal.',
      ],
      tryInput: { servers: 4, keys: 60, vnodes: 1, event: 'add', seed: 44 },
    },
    {
      type: 'debug',
      q: 'This lookup works for most keys and then crashes with an index error for some. What is missing?',
      code: `def owner(ring, key):
    # ring is a sorted list of (position, server)
    i = bisect.bisect_left(ring, (hash32(key), -1))
    return ring[i][1]`,
      options: ['The ring should be sorted in descending order', 'Wrap-around: when i equals len(ring), the owner is ring[0]', 'bisect_right should be used instead', 'The hash should be taken modulo the number of servers'],
      answer: 1,
      explain: [
        'Ascending order is what the binary search needs.',
        'Correct. A key whose hash is larger than every server position has no position after it. On a ring, the next position is the first one in the list.',
        'That changes only what happens on an exact tie. The crash would remain.',
        'That would turn it back into modulo hashing and lose the point of the ring.',
      ],
    },
    {
      type: 'choice',
      q: 'Why do practical rings give each server many positions instead of one?',
      options: ['To make lookups faster', 'So that each server\'s share is the sum of many small arcs and comes out close to the average', 'To keep several copies of each key', 'Because one position can only hold a limited number of keys'],
      answer: 1,
      explain: [
        'More positions make the sorted list longer, so lookups get slightly slower.',
        'Correct. A single random arc can easily be several times longer or shorter than average. A sum of many random arcs is much steadier.',
        'Replication is a separate mechanism: storing a key on the next few distinct servers clockwise.',
        'A position is just a number. It places no limit on how many keys fall before it.',
      ],
    },
    {
      type: 'challenge',
      title: 'Rendezvous hashing',
      prompt: 'Implement the main alternative to the ring. For a key, compute a score hash(key, server) for every server and assign the key to the server with the highest score. Using 2000 keys, measure how many change server when you go from 8 servers to 9, and when one of the 8 is removed. Compare with the ring from this lesson at 1 position per server and at 64. Then compare how evenly each scheme spreads the keys.',
      hints: ['Combine key and server id into one number before mixing, for example mix32(key * 31 + server * 7919).', 'When a server is added, a key moves only if the new server\'s score beats its current best. Argue why that happens with probability 1/(n + 1).', 'To measure balance, report the largest and smallest per-server counts.'],
    },
  ],

  compare: {
    idea: 'Hash servers and keys onto a ring and give each key to the next server clockwise.',
    requires: 'A hash function that every participant computes identically, and an agreed list of servers.',
    sensitivity: 'Balance depends strongly on the number of positions per server. Movement per change is about one server\'s share regardless.',
    memory: 'O(n·v): one sorted entry per server position, nothing per key.',
    difficulty: 'moderate',
    difficultyNote: 'The ring itself is a sorted list and a binary search. The hard parts in practice are membership, replication and balance.',
    limits: 'Uneven shares without virtual nodes. Scatters keys, so no efficient range queries. Decides ownership only.',
    useWhen: 'Keys must be spread over a set of servers that changes, and moving keys is costly.',
  },

  advanced: {
    history: 'Consistent hashing was introduced by David Karger, Eric Lehman, Tom Leighton, Rina Panigrahy, Matthew Levine and Daniel Lewin of MIT at the ACM Symposium on Theory of Computing in 1997, as part of a scheme for relieving overloaded web servers with a network of caches. Leighton and Lewin founded Akamai the following year. In 1998 David Thaler and Chinya Ravishankar published highest random weight hashing, now usually called rendezvous hashing, which achieves the same minimal disruption differently. Chord (2001) used consistent hashing as the basis of a peer-to-peer lookup service, and the Dynamo paper (2007) made the ring with virtual nodes a standard design for distributed key-value stores.',
    derivation: 'Why modulo hashing moves almost everything: going from $n$ to $n+1$ servers, a key with hash $h$ stays put exactly when $h \\bmod n = h \\bmod (n+1)$. Because $n$ and $n+1$ share no common factor, the pair of remainders is determined by $h \\bmod n(n+1)$ and takes each of the $n(n+1)$ possible combinations equally often. The two remainders are equal for exactly $n$ of those combinations, namely $h \\bmod n(n+1) \\in \\{0, 1, \\dots, n-1\\}$. So for a uniform hash\n\n$$P(\\text{key stays}) = \\frac{n}{n(n+1)} = \\frac{1}{n+1}, \\qquad P(\\text{key moves}) = \\frac{n}{n+1}.$$\n\nOn the ring, with all positions independent and uniform, the roles are reversed. After the new server joins there are $n+1$ servers that are statistically identical, so each owns any given key with probability $\\frac{1}{n+1}$. A key moves exactly when the new server owns it, so\n\n$$P(\\text{key moves}) = \\frac{1}{n+1}.$$',
    proof: 'Minimal disruption cannot be improved on by a balanced scheme. Suppose $K$ keys are shared equally among $n$ servers and a server is added. For the result to be balanced, the new server must end up with $K/(n+1)$ keys, and every one of them was previously somewhere else, so at least $K/(n+1)$ keys move. The ring moves that many in expectation and moves no key between two old servers. The same count applies to removal: the $K/n$ keys on the departing server must go somewhere, and the ring moves only those.\n\nOn balance: with one position per server, the $n$ arcs are the gaps between $n$ uniform random points on a circle. The longest gap is about $\\frac{\\ln n}{n}$ of the ring with high probability, a factor $\\ln n$ above the average $\\frac1n$. With $v$ positions per server, a server\'s share is a sum of $v$ gaps out of $nv$; its mean is still $\\frac1n$ and its standard deviation is about $\\frac{1}{n\\sqrt{v}}$. Karger and colleagues show that $v$ proportional to $\\log n$ keeps every share within a constant factor of the average with high probability.',
    complexityProof: 'A lookup hashes the key once and binary-searches $nv$ sorted positions, taking at most $\\lceil \\log_2(nv + 1) \\rceil$ comparisons. Adding a server inserts $v$ positions; in a balanced search tree each insertion costs $O(\\log(nv))$. The number of keys that must be transferred is the number that fall on the new server\'s arcs, which has expectation $K/(n+1)$ by the symmetry argument above.',
    variants: [
      { name: 'Virtual nodes', text: 'Each server is hashed to many positions. This evens out shares and spreads a departing server\'s load over many successors instead of one.' },
      { name: 'Rendezvous (highest random weight) hashing', text: 'Each key scores every server with a hash of the pair and goes to the highest scorer. No ring is stored; lookups cost O(n).' },
      { name: 'Jump consistent hash', text: 'A short loop that maps a key to one of n numbered buckets with no stored state and almost perfectly even shares. Buckets can only be added or removed at the end of the numbering.' },
      { name: 'Consistent hashing with bounded loads', text: 'Caps each server at a fixed multiple of the average load. A key whose server is full continues clockwise to the next one with room.' },
      { name: 'Maglev hashing', text: 'Builds a fixed-size lookup table from per-server preference lists. It gives very even shares and constant-time lookups, with slightly more movement when the set of servers changes.' },
    ],
    implementation: 'Use a hash with at least 64 bits so that position collisions are negligible, and make sure every client in every language computes it identically. Derive virtual node positions from the server\'s stable identifier and a counter. Store the ring as a sorted array if membership changes rarely. When choosing replicas, walk clockwise and skip positions whose server has already been chosen. Publish membership changes to all clients in a way that orders them, so that clients converge on the same ring.',
    benchmarking: 'Measure three things separately: the fraction of keys that move per membership change, the ratio of the most loaded server to the average, and lookup time. Report them for realistic key distributions as well as uniform ones, because a ring balances keys, not request volume.',
    references: [
      { authors: 'D. Karger, E. Lehman, T. Leighton, R. Panigrahy, M. Levine and D. Lewin', year: 1997, title: 'Consistent hashing and random trees: distributed caching protocols for relieving hot spots on the World Wide Web', venue: 'Proceedings of the 29th Annual ACM Symposium on Theory of Computing (STOC), 654-663' },
      { authors: 'G. DeCandia, D. Hastorun, M. Jampani, G. Kakulapati, A. Lakshman, A. Pilchin, S. Sivasubramanian, P. Vosshall and W. Vogels', year: 2007, title: 'Dynamo: Amazon\'s highly available key-value store', venue: 'Proceedings of the 21st ACM Symposium on Operating Systems Principles (SOSP), 205-220' },
      { authors: 'I. Stoica, R. Morris, D. Karger, M. F. Kaashoek and H. Balakrishnan', year: 2001, title: 'Chord: a scalable peer-to-peer lookup service for internet applications', venue: 'Proceedings of ACM SIGCOMM 2001' },
      { authors: 'D. G. Thaler and C. V. Ravishankar', year: 1998, title: 'Using name-based mappings to increase hit rates', venue: 'IEEE/ACM Transactions on Networking 6(1)' },
      { authors: 'J. Lamping and E. Veach', year: 2014, title: 'A fast, minimal memory, consistent hash algorithm', venue: 'arXiv:1406.2294' },
    ],
    furtherReading: [
      'M. Kleppmann, *Designing Data-Intensive Applications*, chapter 6, "Partitioning".',
      'V. Mirrokni, M. Thorup and M. Zadimoghaddam, "Consistent hashing with bounded loads", *Proceedings of the ACM-SIAM Symposium on Discrete Algorithms* (2018).',
    ],
  },

  tests: [
    { name: 'default run: only keys in the new server\'s arc move, all to the new server, and the lookup matches a linear scan', input: {},
      check: (r) => checkEvent(r) },
    { name: 'the default run moves 9 of 60 keys on the ring and 48 of 60 with modulo', input: { servers: 4, keys: 60, vnodes: 1, event: 'add', seed: 44 },
      check: (r) => (r.movedRing === 9 && r.movedMod === 48) || `ring ${r.movedRing}, modulo ${r.movedMod}` },
    { name: 'removing a server moves exactly the keys it held', input: { servers: 4, keys: 60, vnodes: 1, event: 'remove', seed: 44 },
      check: (r) => {
        const verdict = checkEvent(r);
        if (verdict !== true) return verdict;
        return r.movedRing === r.countsBefore[r.server] || `moved ${r.movedRing}, but S${r.server} held ${r.countsBefore[r.server]}`;
      } },
    { name: 'ownership rules hold with virtual nodes, for both events, across 60 configurations', input: {},
      check: () => {
        for (let seed = 1; seed <= 10; seed++) for (const event of ['add', 'remove']) for (const [servers, vnodes] of [[2, 1], [5, 3], [6, 12]]) {
          const verdict = checkEvent(run({ servers, keys: 150, vnodes, event, seed }, QUIET));
          if (verdict !== true) return `servers=${servers} vnodes=${vnodes} ${event} seed=${seed}: ${verdict}`;
        }
        return true;
      } },
    { name: 'the fraction moved on the ring averages about 1/(n + 1), and modulo about n/(n + 1)', input: {},
      check: () => {
        const n = 5, K = 400, seeds = 200;
        let ring = 0, mod = 0;
        for (let seed = 1; seed <= seeds; seed++) { const r = run({ servers: n, keys: K, vnodes: 1, event: 'add', seed }, QUIET); ring += r.movedRing; mod += r.movedMod; }
        const fr = ring / (K * seeds), fm = mod / (K * seeds);
        if (Math.abs(fr - 1 / (n + 1)) > 0.03) return `ring fraction ${fr.toFixed(3)}, expected about ${(1 / (n + 1)).toFixed(3)}`;
        if (Math.abs(fm - n / (n + 1)) > 0.02) return `modulo fraction ${fm.toFixed(3)}, expected about ${(n / (n + 1)).toFixed(3)}`;
        return true;
      } },
    { name: 'with many virtual nodes a single run is already close to 1/(n + 1)', input: {},
      check: () => {
        const r = run({ servers: 9, keys: 5000, vnodes: 200, event: 'add', seed: 3 }, QUIET);
        const f = r.movedRing / r.keys;
        return (f > 0.08 && f < 0.12 && r.movedMod / r.keys > 0.85) || `ring fraction ${f.toFixed(3)}, modulo fraction ${(r.movedMod / r.keys).toFixed(3)}`;
      } },
    { name: 'the worked example: on a 0 to 99 ring, adding D at 55 moves only key 51; modulo moves 5 of 6', input: {},
      check: () => {
        const keys = [7, 22, 38, 51, 64, 93];
        const before = [{ pos: 10, s: 'A' }, { pos: 40, s: 'B' }, { pos: 75, s: 'C' }];
        const after = [{ pos: 10, s: 'A' }, { pos: 40, s: 'B' }, { pos: 55, s: 'D' }, { pos: 75, s: 'C' }];
        const a = keys.map((k) => successor(before, k, QUIET).s).join(''), b = keys.map((k) => successor(after, k, QUIET).s).join('');
        if (a !== 'ABBCCA' || b !== 'ABBDCA') return `owners before ${a}, after ${b}`;
        const mod3 = keys.map((k) => k % 3).join(','), mod4 = keys.map((k) => k % 4).join(',');
        if (mod3 !== '1,1,2,0,1,0' || mod4 !== '3,2,2,3,0,1') return `remainders ${mod3} and ${mod4}`;
        return keys.filter((k) => k % 3 !== k % 4).length === 5 || 'expected 5 of 6 to move under modulo';
      } },
    { name: 'the demonstration hash is one-to-one on a sample, so positions never collide', input: {},
      check: () => {
        const seen = new Set();
        for (let i = 1; i <= 20000; i++) seen.add(mix32(i));
        return seen.size === 20000 || 'two inputs hashed to the same value';
      } },
  ],
};
