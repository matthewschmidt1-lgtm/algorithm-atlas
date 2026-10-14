import { makeRng } from '../../js/lib/rng.js';

const LOOKUPS = [
  { value: 'present', label: 'The key that was hardest to insert' },
  { value: 'absent', label: 'A key that is not in the table' },
];

// Distinct random keys. Small tables get two-digit keys so the arithmetic can be done by eye.
function makeKeys(count, m, rng) {
  const top = m <= 20 ? 99 : m * 1000;
  const seen = new Set();
  const keys = [];
  while (keys.length < count) {
    const k = rng.int(1, top);
    if (!seen.has(k)) { seen.add(k); keys.push(k); }
  }
  return { keys, seen, top };
}

const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
const fmt2 = (v) => (Math.round(v * 100) / 100).toString();

function longestRun(table) {
  const m = table.length;
  if (table.every((v) => v !== null)) return m;
  let best = 0, run = 0;
  for (let i = 0; i < 2 * m; i++) { // twice around, so a run that wraps past the end is counted whole
    if (table[i % m] !== null) { run += 1; if (run > best) best = run; } else run = 0;
  }
  return Math.min(best, m);
}

function run(input, t) {
  const m = Math.max(2, Math.floor(input.size));
  const usingCustom = Array.isArray(input.custom) && input.custom.length > 0;
  const rng = makeRng((input.seed || 1) * 17 + m);
  let keys, seen, top = 999;
  if (usingCustom) {
    keys = input.custom.slice();
    seen = new Set(keys);
  } else {
    const want = Math.max(1, Math.floor(input.keys));
    if (want > m) throw new Error(`A table with ${m} slots cannot hold ${want} keys. Use fewer keys or a larger table. Real hash tables grow before they get this full.`);
    ({ keys, seen, top } = makeKeys(want, m, rng));
  }
  if (seen.size > m) throw new Error(`A table with ${m} slots cannot hold ${seen.size} different keys. Use fewer keys or a larger table.`);
  const n = keys.length;
  const home = (k) => ((k % m) + m) % m;
  const table = new Array(m).fill(null);
  const probesPer = [];
  let insertProbes = 0, stored = 0;

  const legend = [{ label: 'slot about to be checked', role: 'compare' }, { label: 'taken by another key', role: 'rejected' }, { label: 'key placed or found', role: 'done' }];
  // slots: { index: role } for this frame; cur: index into keys of the key being inserted; lookup: key being looked up.
  const views = ({ slots = {}, cur = -1, lookup = null } = {}) => {
    const rows = [
      { label: 'Keys', cells: keys.map((k, j) => ({ t: k, role: j === cur ? 'active' : j < probesPer.length ? 'dim' : undefined })) },
      { label: 'Probes', cells: keys.map((k, j) => ({ t: j < probesPer.length ? probesPer[j] : '', role: 'dim' })) },
    ];
    if (lookup !== null) rows.push({ label: 'Looking up', cells: [{ t: lookup, role: 'target' }] });
    return [
      { kind: 'rows', title: `The table: ${m} slots, numbered 0 to ${m - 1}`, legend,
        rows: [{ label: 'Slots', cells: table.map((v, i) => ({ t: v === null ? '' : v, sub: i, role: slots[i] || (v === null ? 'dim' : undefined) })) }] },
      { kind: 'rows', title: 'Keys in the order they arrive, and the probes each one needed', rows },
    ];
  };

  t.frame(() => ({ line: null, note: `An empty table with ${m} slots, and ${plural(n, 'key')} to store. The hash function here is the simplest one there is: a key's **home slot** is the remainder when the key is divided by ${m}${m === 10 ? ', which is just its last digit' : ''}.`, views: views(), vars: { slots: m, keys: n } }));

  for (let j = 0; j < n; j++) {
    const key = keys[j];
    const h = home(key);
    t.frame(() => ({ line: [0, 1], note: `Insert **${key}**. Its home slot is ${key} mod ${m} = ${h}.`, views: views({ slots: { [h]: 'compare' }, cur: j }), vars: { key, 'home slot': h } }));
    let i = h, probes = 0;
    const tried = {};
    for (;;) {
      probes += 1;
      t.count('probes');
      if (table[i] === null) {
        table[i] = key;
        stored += 1;
        const at = i, p = probes;
        t.frame(() => ({ line: 5, note: `Slot ${at} is empty, so ${key} goes here. That took ${plural(p, 'probe')}${p === 1 ? ': the key is in its home slot' : `, and ${key} now sits ${plural(p - 1, 'slot')} past its home slot`}.`, views: views({ slots: { ...tried, [at]: 'done' }, cur: j }), vars: { key, 'home slot': h, slot: at, probes: p } }));
        break;
      }
      if (table[i] === key) {
        const at = i, p = probes;
        t.frame(() => ({ line: 3, note: `Slot ${at} already holds ${key}. A key is stored only once, so nothing changes.`, views: views({ slots: { ...tried, [at]: 'done' }, cur: j }), vars: { key, 'home slot': h, slot: at, probes: p } }));
        break;
      }
      const at = i, next = (i + 1) % m, p = probes;
      tried[at] = 'rejected';
      t.frame(() => ({ line: [2, 3, 4], note: `Slot ${at} is taken by ${table[at]}. That is a **collision**. Linear probing tries the next slot along, slot ${next}${next === 0 ? ', wrapping around from the end of the table to the start' : ''}.`, views: views({ slots: { ...tried, [next]: 'compare' }, cur: j }), vars: { key, 'home slot': h, slot: at, probes: p } }));
      i = next;
    }
    probesPer.push(probes);
    insertProbes += probes;
  }

  const average = insertProbes / n;
  const measure = input.measure === 'miss' ? 'miss' : 'insert';
  if (measure === 'insert') t.count('average probes', average);
  const load = stored / m;
  t.frame(() => ({ line: null, note: `All the keys are in. ${stored} of ${m} slots are full, so the **load factor** is ${fmt2(load)}. The insertions made ${plural(insertProbes, 'probe')} in total, an average of ${fmt2(average)} per key. The longest unbroken run of full slots is ${longestRun(table)}.`, views: views(), vars: { 'load factor': fmt2(load) } }));

  // Look up one key (traced), or many absent keys (count only, for the experiment).
  const search = (key, trace) => {
    const h = home(key);
    let i = h, probes = 0;
    const tried = {};
    if (trace) t.frame(() => ({ line: [7, 8], note: `Now look up **${key}**. A lookup retraces what an insertion would have done, starting from the home slot: ${key} mod ${m} = ${h}.`, views: views({ slots: { [h]: 'compare' }, lookup: key }), vars: { key, 'home slot': h } }));
    while (probes < m) {
      probes += 1;
      t.count('probes');
      const at = i, p = probes;
      if (table[i] === null) {
        if (trace) t.frame(() => ({ line: 12, note: `Slot ${at} is empty. If ${key} were in the table, its insertion would have stopped here or earlier, so ${key} is **not in the table**. That took ${plural(p, 'probe')}.`, views: views({ slots: { ...tried, [at]: 'alert' }, lookup: key }), vars: { key, 'home slot': h, slot: at, probes: p } }));
        return { key, index: -1, probes };
      }
      if (table[i] === key) {
        if (trace) t.frame(() => ({ line: 10, note: `Slot ${at} holds ${key}. Found after ${plural(p, 'probe')}.`, views: views({ slots: { ...tried, [at]: 'done' }, lookup: key }), vars: { key, 'home slot': h, slot: at, probes: p } }));
        return { key, index: i, probes };
      }
      tried[at] = 'rejected';
      const next = (i + 1) % m;
      if (trace) t.frame(() => ({ line: [9, 10, 11], note: `Slot ${at} holds ${table[at]}, not ${key}. That does not settle it: ${key} may have been pushed further along by a collision. Check slot ${next}.`, views: views({ slots: { ...tried, [next]: 'compare' }, lookup: key }), vars: { key, 'home slot': h, slot: at, probes: p } }));
      i = next;
    }
    if (trace) t.frame(() => ({ line: 12, note: `Every one of the ${m} slots has been checked and none holds ${key}. The table is completely full, so there was no empty slot to end the search early.`, views: views({ slots: tried, lookup: key }), vars: { key, probes } }));
    return { key, index: -1, probes };
  };

  let lookup;
  if (measure === 'miss') {
    const misses = Math.max(1, Math.floor(input.misses || 1000));
    let total = 0;
    for (let q = 0; q < misses; q++) {
      let k = rng.int(1, top);
      while (seen.has(k)) k = rng.int(1, top);
      lookup = search(k, false);
      total += lookup.probes;
    }
    t.count('average probes', total / misses);
  } else {
    let target;
    if (usingCustom) target = Math.floor(Number(input.target) || 0);
    else if (input.lookup === 'absent') {
      // Prefer an absent key whose home slot is taken, so the lookup has something to walk past.
      const pool = [];
      for (let k = 1; k <= top && pool.length < 400; k++) if (!seen.has(k)) pool.push(k);
      rng.shuffle(pool);
      target = pool.find((k) => table[home(k)] !== null);
      if (target === undefined) target = pool[0];
    } else {
      let best = 0;
      for (let j = 1; j < n; j++) if (probesPer[j] > probesPer[best]) best = j;
      target = keys[best];
    }
    lookup = search(target, true);
  }

  const final = lookup;
  t.frame(() => ({ line: null, note: `Done. ${final.index >= 0 ? `${final.key} was found in slot ${final.index}` : `${final.key} was reported absent`} after ${plural(final.probes, 'probe')}. With a load factor of ${fmt2(load)}, the insertions averaged ${fmt2(average)} probes each. Fill the table further and both numbers rise.`, views: views({ slots: final.index >= 0 ? { [final.index]: 'done' } : {}, lookup: final.key }), vars: { 'load factor': fmt2(load) } }));

  return { table: table.slice(), size: m, keys, probesPer, insertProbes, average, loadFactor: load, longestCluster: longestRun(table), lookup };
}

// Checks the property every later lookup relies on: walking forward from a key's home slot
// reaches the key before reaching any empty slot.
const tableIsConsistent = (r) => {
  const m = r.size;
  const stored = r.table.filter((v) => v !== null);
  const want = [...new Set(r.keys)].sort((a, b) => a - b);
  if (stored.slice().sort((a, b) => a - b).join(',') !== want.join(',')) return 'the table does not hold exactly the inserted keys';
  for (const k of want) {
    let i = ((k % m) + m) % m, steps = 0;
    while (r.table[i] !== k) {
      if (r.table[i] === null) return `key ${k} cannot be reached: an empty slot comes before it`;
      i = (i + 1) % m;
      if (++steps > m) return `key ${k} is missing`;
    }
  }
  const expected = r.table.indexOf(r.lookup.key);
  return r.lookup.index === expected || `lookup of ${r.lookup.key} returned ${r.lookup.index}, a scan of the table says ${expected}`;
};

export default {
  meta: {
    id: 'hash-table',
    name: 'Hash Table with Linear Probing',
    aliases: ['hash table', 'hash map', 'open addressing', 'linear probing', 'closed hashing', 'dictionary', 'associative array'],
    kind: 'data-structure',
    discipline: 'algorithms',
    alsoIn: [
      { id: 'distributed-systems', why: 'Spreading keys over machines instead of slots is the same idea, and consistent hashing grew out of it.' },
    ],
    subfield: 'Data structures',
    family: 'Hash tables',
    lab: 'data-structures',
    summary: 'Stores keys in an array at positions computed from the keys themselves. On a collision it tries the next slot along. Lookups take expected constant time while the table is not too full.',
    difficulty: 'intermediate',
    order: 170,
    paradigms: ['hashing'],
    randomized: false,
    approximate: false,
    time: { best: 'O(1)', average: 'O(1) expected, under hashing assumptions', worst: 'O(n)', class: 'constant' },
    space: { worst: 'O(n)', class: 'linear' },
    tags: {
      problems: ['look something up instantly', 'check whether an item has been seen before', 'store key and value pairs', 'count how often each word appears', 'remove duplicates', 'build a dictionary or map'],
      techniques: ['hashing', 'open addressing', 'linear probing', 'load factor', 'resizing'],
      applications: ['databases', 'compilers', 'standard libraries', 'networking', 'data processing'],
    },
    prerequisites: ['concept:array', 'concept:hashing', 'concept:modular-arithmetic', 'linear-search'],
  },

  bigIdea: {
    simple: "A hash table stores things so that you can find any one of them almost at once, without searching through the rest. Think of a cloakroom with a row of numbered hooks. When you hand in a coat, the attendant uses a fixed rule to turn your ticket number into a hook number, and hangs the coat there. When you come back, the same rule gives the same hook, so the attendant walks straight to it. Sometimes the rule sends two tickets to the same hook. The version in this lesson handles that simply: if the hook is taken, try the next hook along, then the next, until one is free. To find a coat later, start at its hook and walk along in the same way until you see it. If you reach an empty hook first, the coat is not there. This works well while plenty of hooks are free. As the rack fills, taken hooks bunch together and the walks get longer.",
    what: 'A hash table stores keys in an array. A **hash function** turns each key into a position in the array, its home slot, so the table can go straight to where a key should be. When two keys want the same slot, that is a collision. This lesson resolves collisions by **linear probing**: check the next slot, and the next, until an empty one is found. A lookup follows the same sequence of slots and stops at the key or at the first empty slot.',
    why: 'Searching an unsorted list takes time proportional to its length, and even a sorted list needs a logarithmic number of steps. Programs look things up constantly: a variable by its name, a user by an id, a web page by its address. A hash table makes each of those lookups take about the same small amount of time whether it holds a hundred keys or a hundred million, by computing where to look instead of comparing its way there.',
    when: 'Use a hash table when you need to insert, find and remove items by exact key, quickly, and you do not care about their order. If you need the keys in sorted order, the nearest key, or all keys in a range, use a sorted array with [binary search](#/algorithm/binary-search) or a search tree. If you must guarantee a limit on every single operation, remember that a hash table promises speed on average, not in the worst case.',
    interesting: 'Its speed depends on how full it is and almost not at all on how big it is. A table that is half full answers a typical lookup in about one and a half probes at any size. Let it fill to 90 percent and a lookup for a missing key takes about fifty. The cure is to make the table bigger before that happens, which costs a full rebuild now and then.',
    where: 'It is the dictionary, map, set or object of nearly every programming language. Python\'s `dict` uses open addressing, the family of methods this lesson belongs to, while Java\'s `HashMap` chains colliding keys in lists. Databases use hash tables to join tables and group rows, compilers use them for symbol tables, and network devices use them to match packets to connections.',
    analogy: {
      title: 'Assigned parking on a ring road',
      text: "Every resident of a circular street has an assigned parking space worked out from their house number. If someone else is already in your space, you drive on and take the next free one. Because the street is a ring, driving past the last space brings you round to the first. To find a neighbour's car, go to their assigned space and walk forward from there. You will reach the car before you reach a gap, because when they parked there was no gap between their assigned space and the one they took. That is why an empty space proves the car is not on the street.",
      limits: "On a real street cars drive away and leave gaps. In the table a gap means \"stop looking\", so an item that is removed must leave a marker behind, or items parked beyond it would be lost. And the rule that assigns places, called the hash function, does not follow house numbers along the street: a good one scatters items so that similar ones land far apart.",
    },
  },

  example: {
    setup: 'A table has 10 slots, numbered 0 to 9. The rule for choosing a slot is: take the last digit of the key. That slot is the key\'s home slot. Store the keys 23, 47, 13, 87 and 33, in that order. Each look at a slot is called a probe.',
    steps: [
      'Insert 23. Its home slot is 3. Slot 3 is empty, so 23 goes there. 1 probe.',
      'Insert 47. Its home slot is 7. Slot 7 is empty, so 47 goes there. 1 probe.',
      'Insert 13. Its home slot is 3, but 23 is already there. Try the next slot, 4. It is empty, so 13 goes there. 2 probes.',
      'Insert 87. Its home slot is 7, but 47 is there. Slot 8 is empty, so 87 goes there. 2 probes.',
      'Insert 33. Its home slot is 3, which holds 23. Slot 4 holds 13. Slot 5 is empty, so 33 goes there. 3 probes.',
      'Now look up 33. Start at slot 3: it holds 23. Slot 4 holds 13. Slot 5 holds 33. Found, after 3 probes.',
    ],
    result: 'The table holds 23, 13 and 33 in slots 3, 4 and 5, and 47 and 87 in slots 7 and 8. The five insertions took 9 probes, under 2 each. Notice that 33 ended up two slots from home because of keys that arrived earlier. Looking up 43, which was never stored, would check slots 3, 4 and 5, then find slot 6 empty and stop: not in the table, after 4 probes.',
    tryInput: { size: 10, custom: [23, 47, 13, 87, 33], target: 33 },
  },

  terms: [
    { term: 'Key', meaning: 'The thing you look an item up by, such as a number, a name or an id.' },
    { term: 'Slot', meaning: 'One numbered position in the table. Each slot holds one key or is empty.' },
    { term: 'Hash function', meaning: 'A fixed rule that turns a key into a number. The same key always gives the same number.' },
    { term: 'Home slot', meaning: 'The slot the hash function sends a key to. The key is stored there if the slot is free.' },
    { term: 'Collision', meaning: 'What happens when a key\'s home slot is already taken by a different key.' },
    { term: 'Probe', meaning: 'One look at one slot. Counting probes is how we measure the work a hash table does.' },
    { term: 'Linear probing', meaning: 'The rule used here for collisions: try the next slot along, one at a time, going back to slot 0 after the last slot.' },
    { term: 'Cluster', meaning: 'An unbroken run of full slots. Any key whose home slot is inside a cluster has to walk to the end of it.' },
    { term: 'Load factor', meaning: 'The fraction of slots that are full: the number of keys divided by the number of slots.' },
    { term: 'Tombstone', meaning: 'A marker left in a slot when a key is removed. It says "a key used to be here, keep looking".' },
  ],

  takeaway: 'Work out from the key itself where it should go, and if that place is taken, use the next free one along.',

  viz: {
    describe: 'A row of numbered slots, each empty or holding one key. For the key being inserted or looked up, the slot about to be checked is ochre (first its home slot, then each slot after it), slots found to be taken by other keys are brick red, and the slot where the key is placed or found is forest green. A second panel lists the keys in arrival order with the number of probes each one needed, and shows the key being looked up.',
    inputs: [
      { id: 'size', type: 'range', label: 'Table size (slots)', min: 5, max: 16, step: 1, default: 10, help: 'With 10 slots, a key\'s home slot is its last digit.' },
      { id: 'keys', type: 'range', label: 'Number of keys', min: 1, max: 16, step: 1, default: 7 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 5 },
      { id: 'lookup', type: 'select', label: 'Then look up', options: LOOKUPS, default: 'present' },
      { id: 'custom', type: 'list', label: 'Or type your own keys', default: [], maxLength: 16, min: 0, max: 999, integer: true,
        help: 'Comma-separated whole numbers, inserted in the order given.' },
      { id: 'target', type: 'number', label: 'Key to look up (used with your own keys)', default: 0, min: 0, max: 999 },
    ],
    presets: [
      { label: 'Half full', values: { size: 10, keys: 5, lookup: 'present', custom: [] } },
      { label: 'Nearly full', values: { size: 10, keys: 9, lookup: 'present', custom: [] } },
      { label: 'Nearly full, key not there', values: { size: 10, keys: 9, lookup: 'absent', custom: [] } },
      { label: 'Every key collides', values: { size: 10, custom: [3, 13, 23, 33, 43, 53], target: 53 } },
      { label: 'Wrapping past the end', values: { size: 10, custom: [8, 18, 9, 28, 38], target: 38 } },
    ],
    tryThis: [
      { ask: 'Load "Half full" and note two numbers in the report: the average probes per key and the longest run of full slots. "Nearly full" puts four more keys into the same table. Before you load it: which of the two numbers will change more?',
        reveal: 'The longest run. It grows from 4 slots to 9, which leaves a single empty slot in the table. The average hardly moves, from 1.6 to 1.67, because these four keys happened to land on or near free slots: they took 1, 3, 2 and 1 probes. The price of the long run is paid by whatever comes next. Load "Nearly full, key not there" and the lookup of 53 has to walk 6 slots before it meets the empty one.' },
      { ask: 'Load "Every key collides". All six keys end in 3, so they share one home slot. Before you run it: how many probes will the last key, 53, need? And how many will the six insertions take together?',
        reveal: '53 needs 6 probes and the six insertions take 21. Each key walks past all the keys before it, so the counts are 1, 2, 3, 4, 5 and 6. This is the worst case, and it is the hash function\'s fault, not bad luck.' },
      { ask: 'Load "Nearly full", which puts 9 keys in 10 slots, and note the total insertion probes and the longest run. Then raise the table size to 16, still with 9 keys. Will the insertions need more probes or fewer, and how long will the longest run be?',
        reveal: 'Fewer. The 9 insertions take 11 probes where they took 15, an average of 1.22 in place of 1.67, and seven of the nine keys go straight into their home slots. The longest run falls from 9 slots to 4. The demonstration draws different random keys for a different table size, so these are not the same nine keys. What changed the cost is the load factor, down from 0.9 to 0.56.' },
      { ask: 'Type your own keys `12, 22, 32, 15` and set the key to look up to 42, which is never stored. Three of the keys share home slot 2 with 42. The fourth, 15, does not. How many probes will the lookup of 42 take?',
        input: { size: 10, custom: [12, 22, 32, 15], target: 42 },
        reveal: 'It takes 5. The lookup walks past 12, 22 and 32 in slots 2, 3 and 4, then finds 15 in slot 5 where it hoped for an empty slot, and has to pass that too before slot 6 ends the search. Take 15 out of the list and the same lookup takes 4 probes. A key from a different home slot has lengthened the search: that is clustering.' },
    ],
    run,
    report: (r, c) => `Table: [${r.table.map((v) => (v === null ? '·' : v)).join(' ')}]\nLoad factor ${fmt2(r.loadFactor)} (${r.table.filter((v) => v !== null).length} of ${r.size} slots). Insertions: ${r.insertProbes} probes, ${fmt2(r.average)} per key on average. Longest run of full slots: ${r.longestCluster}.\nLookup of ${r.lookup.key}: ${r.lookup.index >= 0 ? `found in slot ${r.lookup.index}` : 'not in the table'} after ${r.lookup.probes} ${r.lookup.probes === 1 ? 'probe' : 'probes'}. ${c.probes || 0} probes in all.`,
    experiment: {
      title: 'Probes as the table fills up',
      note: 'Each point is a real run on a table of 50,000 slots filled with random keys to the given load factor. One series is the average number of probes per insertion, which is also the average cost of finding a key that is present. The other is the average over 5,000 lookups of keys that are absent. The curves are Knuth\'s formulas for linear probing with a hash function that spreads keys evenly. At high load the points scatter around the curves, because the cost is dominated by a few very long clusters.',
      metric: 'average probes',
      metricLabel: 'Average probes per operation',
      sizeLabel: 'Load factor (percent of slots full)',
      sizes: [10, 20, 30, 40, 50, 60, 70, 80, 90],
      variants: [
        { id: 'insert', label: 'Inserting, or finding a key that is present' },
        { id: 'miss', label: 'Looking up a key that is absent' },
      ],
      input: (percent, variant, seed) => ({ size: 50000, keys: Math.round(percent * 500), seed, custom: [], measure: variant, misses: 5000 }),
      theory: [
        { label: '½ (1 + 1/(1 − α))', fn: (p) => 0.5 * (1 + 1 / (1 - p / 100)), variant: 'insert' },
        { label: '½ (1 + 1/(1 − α)²)', fn: (p) => 0.5 * (1 + 1 / (1 - p / 100) ** 2), variant: 'miss' },
      ],
    },
  },

  logic: {
    intuition: 'An array can fetch the item at position 5 in one step, however large it is. A hash table turns "find the item with this key" into "fetch the item at this position" by computing the position from the key. The computation cannot give every key its own slot, so the table also needs a rule for what to do when a slot is taken, and the same rule has to be followed when looking the key up again.',
    steps: [
      'Compute the key\'s home slot: hash the key and take the remainder after dividing by the table size.',
      'To insert, look at the home slot. If it is empty, put the key there.',
      'If it holds a different key, move to the next slot, wrapping from the last slot back to slot 0, and look again. Repeat until an empty slot is found, then put the key there.',
      'To look a key up, start at its home slot and walk the same sequence of slots.',
      'If a slot holds the key, it is found. If a slot is empty, the key is not in the table: its insertion would have stopped at this slot or before it.',
      'When the table becomes too full, allocate a larger one and insert every key again, because home slots depend on the table size.',
    ],
    pseudocode: [
      'insert(T, key):',
      '  i ← hash(key) mod m',
      '  while T[i] is not empty:',
      '    if T[i] = key: return',
      '    i ← (i + 1) mod m',
      '  T[i] ← key',
      '',
      'lookup(T, key):',
      '  i ← hash(key) mod m',
      '  while T[i] is not empty:',
      '    if T[i] = key: return i',
      '    i ← (i + 1) mod m',
      '  return not found',
    ],
    decisions: [
      { title: 'Which hash function?', text: 'This lesson uses the key itself, reduced modulo the table size, so that you can check every step by eye. That is only safe when keys are already spread out. Real tables first scramble the key with a function designed so that similar keys land far apart, and often mix in a random seed chosen at startup so that nobody can predict which keys collide.' },
      { title: 'What to do on a collision?', text: 'Linear probing tries the next slot. It is simple and it reads memory in order, which processors handle well, but full slots tend to merge into long clusters. Quadratic probing and double hashing jump further to break clusters up. Separate chaining avoids probing altogether by keeping a small list of keys at each slot.' },
      { title: 'How full may the table get?', text: 'Costs rise sharply as the load factor approaches 1, so implementations set a ceiling, commonly somewhere between one half and seven eighths depending on the design, and grow the table when it is reached. Growing usually doubles the size, which keeps the average cost of an insertion constant even counting the rebuilds.' },
      { title: 'How to delete?', text: 'Emptying a slot would cut the path to any key that was pushed past it. The simple fix is a tombstone: a marker that lookups walk past and insertions may reuse. Tombstones still lengthen searches, so tables that delete often are rebuilt from time to time. Linear probing also allows an exact alternative, shifting later keys back to close the gap.' },
    ],
    invariants: [
      'For every key in the table, every slot from its home slot up to the slot where it is stored is full. There is no empty slot in between.',
      'Each key is stored at most once.',
      'At least one slot is empty, so that a search for an absent key is certain to stop. Keeping the load factor below a fixed ceiling guarantees this.',
    ],
    edgeCases: [
      'A completely full table: a search for an absent key finds no empty slot and must stop after checking every slot once, or it will loop forever.',
      'Inserting a key that is already present: the probe sequence reaches the existing copy before any empty slot, and nothing is added.',
      'Wrapping around: a key whose home slot is near the end of the table may be stored near the beginning.',
      'Deleting: the slot must become a tombstone, not an empty slot.',
      'Keys chosen by an adversary to share a home slot turn every operation into a linear scan.',
      'Negative keys: in some languages the remainder of a negative number is negative, which is not a valid slot.',
    ],
    correctness: 'The table keeps this invariant: for every stored key, all slots from its home slot to its actual slot are full. Insertion preserves it. A new key is placed in the first empty slot found by walking from its home slot, so every slot it passed is full, and filling one more slot cannot break the property for any other key. Now consider a lookup. It walks the same sequence of slots. If the key is stored, the invariant says the walk meets no empty slot before reaching it, so the key is found. If the key is not stored, the walk can only end at an empty slot (or after a full circuit), and reporting "not found" is right. Deletion by emptying a slot would break the invariant for keys stored beyond that slot, which is why tombstones are needed.',
    mistakes: [
      'Deleting by marking the slot empty. Keys that were pushed past that slot become unreachable although they are still in the table.',
      'Stopping a lookup at the first slot that holds a different key. A different key in the home slot proves nothing; only an empty slot does.',
      'Forgetting to wrap around at the end of the array, or wrapping with a remainder that can be negative.',
      'Copying slots unchanged into a bigger table when resizing. Home slots depend on the table size, so every key must be inserted again.',
      'Letting the table fill completely, after which a search for an absent key never finds an empty slot.',
      'Changing a key after it has been inserted. Its home slot changes and the table can no longer find it.',
    ],
  },

  code: {
    sample: {
      input: 'A table of 10 slots with the hash "key mod 10". Insert 23, 47, 13, 87, 33, 58 and 8, then look up 33 and 43.',
      expected: 'insert 23: slot 3, probes 1\ninsert 47: slot 7, probes 1\ninsert 13: slot 4, probes 2\ninsert 87: slot 8, probes 2\ninsert 33: slot 5, probes 3\ninsert 58: slot 9, probes 2\ninsert 8: slot 0, probes 3\ntable: 8 . . 23 13 33 . 47 87 58\nlookup 33: slot 5, probes 3\nlookup 43: not found, probes 4',
    },
    breakIt: [
      { change: 'Make `lookup` give up at the first slot that holds a different key. In its loop, replace the line that adds 1 to `probes` with a `break`. What will the two lookups print?',
        find: { python: '        probes += 1\n    return -1, probes', javascript: '    probes++;\n  }\n  return { slot: -1, probes };' },
        replace: { python: '        break\n    return -1, probes', javascript: '    break;\n  }\n  return { slot: -1, probes };' },
        reveal: 'Both lookups now print "not found, probes 1": "lookup 33: not found, probes 1" and "lookup 43: not found, probes 1". The second answer is right by luck. The first is wrong, because 33 is in slot 5, as the table line just above it shows. Its home slot 3 holds 23, and the lookup stops there. A different key in the home slot proves nothing, since the key may have been pushed along by a collision. Only an empty slot proves a key is absent.' },
      { change: 'Let the table fill completely: give it 7 slots instead of 10, exactly enough for the seven keys. What happens to the lookup of 43?',
        find: { python: '[EMPTY] * 10', javascript: 'new Array(10)' },
        replace: { python: '[EMPTY] * 7', javascript: 'new Array(7)' },
        hangs: true,
        reveal: 'The program never finishes, and the page stops it at the time limit. With 7 slots the seven keys fill the table, so no slot is empty. The lookup of 33 still works, because it meets 33 on its way. The lookup of 43 starts at slot 1 and walks round and round the table, waiting for an empty slot that does not exist. A real table must either stay partly empty, by growing before it fills, or count its probes and stop after one full circuit.' },
    ],
    python: {
      source: `EMPTY = None


def insert(table, key):
    m = len(table)
    i = key % m
    probes = 1
    while table[i] is not EMPTY:
        if table[i] == key:
            return i, probes
        i = (i + 1) % m
        probes += 1
    table[i] = key
    return i, probes


def lookup(table, key):
    m = len(table)
    i = key % m
    probes = 1
    while table[i] is not EMPTY:
        if table[i] == key:
            return i, probes
        i = (i + 1) % m
        probes += 1
    return -1, probes


table = [EMPTY] * 10
for key in [23, 47, 13, 87, 33, 58, 8]:
    slot, probes = insert(table, key)
    print(f"insert {key}: slot {slot}, probes {probes}")
print("table: " + " ".join("." if v is EMPTY else str(v) for v in table))
for key in [33, 43]:
    slot, probes = lookup(table, key)
    where = f"slot {slot}" if slot >= 0 else "not found"
    print(f"lookup {key}: {where}, probes {probes}")`,
      notes: [
        { line: 6, text: 'The home slot. Real code would scramble the key with a proper hash function before taking the remainder.' },
        { line: 8, text: 'Keep walking while slots are full. This loop relies on the table never being completely full.' },
        { line: 11, text: 'Linear probing: one slot along, wrapping from the last slot back to slot 0.' },
        { line: 21, text: 'A lookup walks exactly the same slots as the insertion did. It may stop only at the key or at an empty slot.' },
        { line: 26, text: 'Reaching an empty slot proves the key is absent: had it been inserted, it would be here or earlier.' },
      ],
    },
    javascript: {
      source: `const EMPTY = null;

function insert(table, key) {
  const m = table.length;
  let i = key % m;
  let probes = 1;
  while (table[i] !== EMPTY) {
    if (table[i] === key) return { slot: i, probes };
    i = (i + 1) % m;
    probes++;
  }
  table[i] = key;
  return { slot: i, probes };
}

function lookup(table, key) {
  const m = table.length;
  let i = key % m;
  let probes = 1;
  while (table[i] !== EMPTY) {
    if (table[i] === key) return { slot: i, probes };
    i = (i + 1) % m;
    probes++;
  }
  return { slot: -1, probes };
}

const table = new Array(10).fill(EMPTY);
for (const key of [23, 47, 13, 87, 33, 58, 8]) {
  const { slot, probes } = insert(table, key);
  console.log("insert " + key + ": slot " + slot + ", probes " + probes);
}
console.log("table: " + table.map((v) => (v === EMPTY ? "." : String(v))).join(" "));
for (const key of [33, 43]) {
  const { slot, probes } = lookup(table, key);
  const where = slot >= 0 ? "slot " + slot : "not found";
  console.log("lookup " + key + ": " + where + ", probes " + probes);
}`,
    },
    cpp: {
      source: `#include <iostream>
#include <utility>
#include <vector>

const int EMPTY = -1;  // keys in this sample are never negative

std::pair<int, int> insert(std::vector<int>& table, int key) {
    int m = static_cast<int>(table.size());
    int i = key % m;
    int probes = 1;
    while (table[i] != EMPTY) {
        if (table[i] == key) return {i, probes};
        i = (i + 1) % m;
        ++probes;
    }
    table[i] = key;
    return {i, probes};
}

std::pair<int, int> lookup(const std::vector<int>& table, int key) {
    int m = static_cast<int>(table.size());
    int i = key % m;
    int probes = 1;
    while (table[i] != EMPTY) {
        if (table[i] == key) return {i, probes};
        i = (i + 1) % m;
        ++probes;
    }
    return {-1, probes};
}

int main() {
    std::vector<int> table(10, EMPTY);
    for (int key : {23, 47, 13, 87, 33, 58, 8}) {
        auto [slot, probes] = insert(table, key);
        std::cout << "insert " << key << ": slot " << slot << ", probes " << probes << "\\n";
    }
    std::cout << "table:";
    for (int v : table) {
        if (v == EMPTY) std::cout << " .";
        else std::cout << " " << v;
    }
    std::cout << "\\n";
    for (int key : {33, 43}) {
        auto [slot, probes] = lookup(table, key);
        std::cout << "lookup " << key << ": ";
        if (slot >= 0) std::cout << "slot " << slot;
        else std::cout << "not found";
        std::cout << ", probes " << probes << "\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The cost of an operation is the number of slots it probes, and that depends on the load factor α (keys divided by slots), not on the size of the table. If the hash function spreads keys evenly, finding a key that is present takes about ½(1 + 1/(1 − α)) probes on average, and inserting a key or looking up one that is absent takes about ½(1 + 1/(1 − α)²). At α = 0.5 those are 1.5 and 2.5 probes. At α = 0.9 they are 5.5 and 50.5.',
    cases: [
      { case: 'Best', time: 'O(1)', when: 'The key is in its home slot, or its home slot is empty: one probe.' },
      { case: 'Expected', time: 'O(1)', when: 'The hash function spreads keys evenly and the load factor is kept below a fixed ceiling less than 1. The constant grows as that ceiling approaches 1.' },
      { case: 'Worst', time: 'O(n)', when: 'Many keys share a home slot or fall into one cluster, through a poor hash function, unlucky data or deliberate attack. Every operation then walks the cluster.' },
      { case: 'Insertion that triggers a resize', time: 'O(n) for that one insertion, O(1) amortized', when: 'The table has reached its load ceiling and every key is moved to a table twice the size. Spread over the insertions that led up to it, the cost per insertion stays constant.' },
    ],
    space: 'O(n). The array has more slots than keys, typically between about 1.2 and 2 times as many, depending on the load ceiling. Open addressing stores keys in the array itself and needs no pointers.',
    memory: 'Linear probing reads consecutive slots, so a probe sequence usually stays within one or two cache lines. That is its main practical advantage over schemes that jump around the table or follow pointers to separate lists, and it is why short clusters cost less in real time than the probe count suggests.',
    tradeoffs: 'A lower load ceiling buys shorter probe sequences with more memory. Linear probing buys cache-friendly access with a tendency to cluster. Hashing in general buys expected constant time by giving up order: the table cannot list keys in sorted order or find the nearest key without examining everything.',
    assumptions: [
      'The expected-time bounds assume the hash function sends each key to a slot uniformly at random and independently of the other keys. No fixed hash function can guarantee this for every possible set of keys.',
      'The load factor stays below a constant less than 1, which requires resizing as the table grows.',
      'Computing the hash of a key and comparing two keys each take constant time. For long strings both cost time proportional to the length of the key.',
      'The amortized bound for insertion assumes the table grows by a constant factor, such as doubling, each time it resizes.',
      'The formulas quoted are for linear probing without deletions. Tombstones count as full slots for the purpose of search cost.',
    ],
  },

  tradeoffs: {
    excels: [
      'Exact-match lookups, insertions and membership tests on large collections.',
      'Counting and grouping: one pass over the data with a table from item to count.',
      'Removing duplicates and detecting repeats.',
      'Workloads where memory access patterns matter, since linear probing touches neighbouring slots.',
    ],
    struggles: [
      'Anything that needs order: sorted output, smallest or largest key, nearest key, range queries.',
      'High load factors, where clusters make operations slow, especially unsuccessful lookups.',
      'Heavy deletion, which leaves tombstones that lengthen searches until the table is rebuilt.',
      'Settings that need a hard limit on every operation: a resize or a long cluster can make one operation far slower than the average.',
      'Keys chosen by an attacker who knows the hash function.',
    ],
    pitfalls: [
      'Deleting by emptying the slot, which silently hides other keys.',
      'A hash function that maps many real keys to few slots, for example one that ignores most of a string.',
      'Relying on the order in which a hash table lists its keys. It depends on the table size and insertion history.',
      'Using objects as keys and then changing them, so that their hash no longer matches the slot they are stored near.',
      'Resizing without reinserting every key.',
    ],
    misunderstandings: [
      '"A hash table lookup always takes one step." It takes one step when the key is in its home slot. Collisions add probes, and in the worst case a lookup examines every key. The honest claim is constant time on average, given a good hash function and a table that is not too full.',
      '"A good hash function has no collisions." Whenever there are more possible keys than slots, some keys must share a slot. A good hash function makes collisions rare and unpredictable. It cannot remove them.',
      '"A bigger table is slower to search." The cost depends on the load factor, the fraction of slots in use. A table of a million slots that is half full is searched as fast as a table of ten slots that is half full.',
      '"If the home slot holds a different key, the key I want is not in the table." It may have been pushed along by a collision. Only an empty slot proves that a key is absent.',
    ],
    constraints: [
      'Production tables scramble keys with a well-tested hash function and often add a per-process random seed, after demonstrations that a web server can be stalled by requests whose keys were chosen to collide.',
      'Resizing causes an occasional long pause. Systems that cannot tolerate one move the keys to the new table a few at a time.',
      'Most library tables store a value alongside each key and cache each key\'s hash to avoid recomputing it during a resize.',
    ],
    alternatives: [
      { id: 'binary-search', name: 'Binary Search on a sorted array', when: 'The data rarely changes and you need order, nearest keys or ranges as well as exact matches.' },
      { id: 'binary-search-tree', name: 'Binary Search Tree', when: 'You need ordered operations and guaranteed logarithmic time on data that changes.' },
      { id: 'linear-search', name: 'Linear Search', when: 'There are only a handful of items, so hashing would cost more than scanning.' },
      { name: 'Separate chaining', when: 'Deletions are frequent or the load factor is hard to control: each slot holds a list, so the table never fills and removal is simple.' },
      { name: 'Cuckoo hashing', when: 'Lookups must take a fixed small number of probes in the worst case, at the price of more complicated insertion.' },
    ],
    comparison: {
      columns: ['', 'Linear probing', 'Separate chaining', 'Sorted array + binary search'],
      rows: [
        ['Lookup', 'Expected O(1), worst O(n)', 'Expected O(1), worst O(n)', 'O(log n) always'],
        ['Insert', 'Expected O(1) amortized', 'Expected O(1) amortized', 'O(n)'],
        ['Delete', 'Needs tombstones or shifting', 'Simple', 'O(n)'],
        ['Load factor', 'Must stay below 1', 'May exceed 1', 'Not applicable'],
        ['Memory access', 'Neighbouring slots', 'Follows pointers', 'Jumps that halve each time'],
        ['Keys in sorted order', 'No', 'No', 'Yes'],
      ],
    },
  },

  applications: [
    { title: 'Dictionaries, maps and sets in programming languages', status: 'established', text: 'Python\'s `dict` and `set` use open addressing, and Java\'s `HashMap` uses separate chaining. Google\'s Abseil library and the Rust standard library use an open-addressing design that probes within small groups of neighbouring slots for cache efficiency.' },
    { title: 'Database joins and grouping', status: 'established', text: 'A hash join builds a hash table on the join column of one table, then looks up each row of the other table in it. Grouping rows for aggregates such as counts and sums works the same way, with the grouping columns as the key.' },
    { title: 'Compiler symbol tables', status: 'established', text: 'A compiler must find the declaration of a name each time the name is used. Symbol tables keyed by identifier are one of the oldest uses of hashing.' },
    { title: 'Caches', status: 'established', text: 'In-memory caches and key-value stores keep recently used results in a hash table keyed by the request, so a repeated request is answered by one lookup instead of recomputation.' },
    { title: 'Spotting duplicates in a stream', status: 'illustrative', text: 'To report the first repeated item in a long sequence, keep a hash set of everything seen so far and test each new item against it. The whole pass takes time proportional to the length of the sequence.' },
  ],

  connections: [
    { to: 'linear-search', type: 'prerequisite', why: 'After jumping to the home slot, linear probing is a linear search along the cluster. The table is fast because hashing keeps that search short.' },
    { to: 'binary-search', type: 'same-problem', why: 'Both find a key in an array. Binary search uses order and pays a logarithm; hashing gives up order and pays a constant on average.' },
    { to: 'consistent-hashing', type: 'advanced', why: 'Consistent hashing assigns keys to machines the way a hash table assigns keys to slots, arranged so that adding a machine moves few keys. An ordinary table moves nearly every key when it resizes.' },
    { to: 'union-find', type: 'related', why: 'Both are array-based structures with near-constant operations stated on average over a sequence, and a hash table is the usual way to turn arbitrary keys into the array indexes union-find works on.' },
    { to: 'counting-sort', type: 'related', why: 'Counting sort uses the key directly as an array index, which is a hash table with no collisions. Hashing extends the same trick to keys from a range far larger than the array.' },
    { to: 'concept:hashing', type: 'prerequisite', why: 'The structure rests on a hash function that maps keys to array positions deterministically and spreads them evenly.' },
    { to: 'concept:modular-arithmetic', type: 'prerequisite', why: 'Reducing a hash to a slot number and wrapping the probe sequence around the end of the array are both remainders modulo the table size.' },
    { to: 'concept:amortized-analysis', type: 'advanced', why: 'Doubling the table costs O(n) once, but spread over the n insertions that filled it the cost per insertion is constant.' },
    { to: 'concept:expectation', type: 'advanced', why: 'Its running-time guarantee is an expected value over the behaviour of the hash function, not a bound on every operation.' },
    { to: 'concept:array', type: 'prerequisite', why: 'Everything depends on the array\'s ability to read any slot in one step once its index is known.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Partitioning data across servers by the hash of its key is a hash table whose slots are machines.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'During a lookup with linear probing, when is it safe to conclude that a key is not in the table?',
      options: [
        'When its home slot holds a different key',
        'When the probe sequence reaches an empty slot',
        'After checking the home slot and the two slots after it',
        'When the probe sequence reaches the end of the array',
      ],
      answer: 1,
      explain: [
        'The key may have been pushed further along when it was inserted, because its home slot was already taken.',
        'Correct. An insertion puts the key in the first empty slot on its path, so if the key were present the lookup would have met it before any empty slot.',
        'There is no fixed distance. A key can sit as far from home as the cluster is long.',
        'The sequence wraps around to slot 0 and continues. Only an empty slot, or a full circuit, ends an unsuccessful search.',
      ],
    },
    {
      type: 'predict',
      q: 'A table has 7 slots, numbered 0 to 6, so a key\'s home slot is the remainder when the key is divided by 7. The keys 10, 17, 3, 24 and 5 are inserted into the empty table in that order. In which slot does 5 end up?',
      options: ['Slot 5, its home slot', 'Slot 6', 'Slot 0', 'Nowhere: there is no room after slot 6'],
      answer: 2,
      explain: [
        'Slot 5 is the home slot of 5, but it is already taken. 10, 17, 3 and 24 all have home slot 3, and the third of them, 3, was pushed along to slot 5.',
        'Slot 6 is taken too. 24 walked past slots 3, 4 and 5 and settled there.',
        'Correct. 10, 17, 3 and 24 fill slots 3, 4, 5 and 6. Then 5 finds its home slot taken by 3, finds slot 6 taken by 24, wraps around to slot 0 and goes in there after 3 probes. No key with home slot 5 was in its way, only keys from a different home slot.',
        'The probe sequence wraps from the last slot back to slot 0, and slots 0, 1 and 2 are all empty.',
      ],
      tryInput: { size: 7, custom: [10, 17, 3, 24, 5], target: 5 },
      check: (r) => (r.table.map((v) => (v === null ? '.' : v)).join(' ') === '5 . . 10 17 3 24' && r.probesPer.join(',') === '1,2,3,4,3' && r.lookup.index === 0 && r.lookup.probes === 3) || `table ${r.table.join(' ')}, probes ${r.probesPer.join(',')}`,
    },
    {
      type: 'debug',
      q: 'After this delete function is used, some keys that were never deleted can no longer be found. What is wrong?',
      code: `def delete(table, key):
    slot, probes = lookup(table, key)
    if slot >= 0:
        table[slot] = EMPTY`,
      options: [
        'Line 2: delete should not call lookup',
        'Line 3: the test should be `slot > 0`',
        'Line 4: the slot must be marked as a tombstone, not as empty, because lookups stop at empty slots',
        'Line 4: the keys after the slot must all be moved to their home slots',
      ],
      answer: 2,
      explain: [
        'Delete has to find the key first, and lookup is the way to do that.',
        'Slot 0 is a valid slot. `slot > 0` would make keys stored there impossible to delete.',
        'Correct. Any key that was pushed past this slot by a collision is now behind an empty slot, and a lookup will stop before reaching it. A tombstone tells lookups to keep going.',
        'Keys are stored away from home precisely because their home slots were taken. Moving them all home is generally impossible. The exact repair is more careful: shift a later key back only if that does not put it before its own home slot.',
      ],
    },
    {
      type: 'choice',
      q: 'A hash table with linear probing holds 900 keys in 1,000 slots and has become slow. Which change helps most?',
      options: [
        'Sort the keys inside the table',
        'Move the keys into a table of 2,000 slots, inserting each one again',
        'Copy the array into one of 2,000 slots, keeping every key at its current index',
        'Use a faster computer',
      ],
      answer: 1,
      explain: [
        'A key\'s position is fixed by its hash. Sorting would move keys away from where lookups expect them.',
        'Correct. The load factor drops from 0.9 to 0.45, which cuts the expected cost of an unsuccessful lookup from about 50 probes to about 2. Each key must be reinserted because its home slot depends on the table size.',
        'Home slots are computed from the table size. With a new size, lookups would start from different slots and miss the keys.',
        'A faster machine performs each probe sooner but still makes about fifty of them per unsuccessful lookup.',
      ],
    },
    {
      type: 'choice',
      q: 'Why is it wrong to say that hash table lookups take O(1) time, with no qualification?',
      options: [
        'Because computing a hash function always takes O(n) time',
        'Because the O(1) figure is an expectation that assumes a well-behaved hash function and a bounded load factor; the worst case is O(n)',
        'Because lookups take O(log n) time, like binary search',
        'Because it is only true for tables with a prime number of slots',
      ],
      answer: 1,
      explain: [
        'Hashing a fixed-size key takes constant time. Hashing a long string takes time proportional to its length, not to the number of keys in the table.',
        'Correct. If many keys land in one cluster, a lookup walks all of them. The constant-time claim is about the average under stated assumptions.',
        'Nothing in a hash table halves a range. Its typical cost does not grow with n at all.',
        'A prime size helps some simple hash functions spread keys. It is not what the O(1) claim depends on.',
      ],
    },
    {
      type: 'challenge',
      title: 'Deletion and growth',
      prompt: 'Extend the table in this lesson into a usable set of integers. Add `delete(key)` using a tombstone marker that lookups walk past and insertions may reuse. Then make the table grow: when full slots plus tombstones exceed two thirds of the capacity, allocate a table twice the size and reinsert every live key, dropping the tombstones. Test it first on a case you can follow by hand: start with 8 slots and the home slot `key mod 8`, insert 1, 9 and 17, delete 9, look up 17 and then 9, and insert 25. Then test it at size: starting again from 8 slots, insert the numbers 1 to 10,000, delete the even ones, and count how many odd numbers and how many even numbers are still found.',
      expect: 'In the small case 1, 9 and 17 go into slots 1, 2 and 3. After 9 is deleted, the lookup of 17 still finds it in slot 3 after 3 probes, because it walks past the tombstone in slot 2. The lookup of 9 reports not found after 4 probes, stopping at the empty slot 4. Inserting 25 puts it in slot 2, reusing the tombstone. In the large test the set holds 5,000 keys at the end, all 5,000 odd numbers are found, and none of the 5,000 even numbers is.',
      hints: [
        'Use three slot states: empty, tombstone and full. A lookup stops only at an empty slot.',
        'When inserting, remember the first tombstone you pass, keep walking until you reach an empty slot to be sure the key is not already present, then place the key at the remembered tombstone.',
        'Count tombstones toward the load when deciding to resize. Otherwise a table with few live keys can fill with tombstones and searches will never meet an empty slot.',
      ],
    },
  ],

  compare: {
    idea: 'Compute a slot from the key; on a collision, walk to the next free slot.',
    requires: 'A rule that spreads names evenly over the table, a table kept partly empty, and lookups by exact name.',
    sensitivity: 'High. Cost depends on the load factor and on how well the hash function spreads the actual keys.',
    memory: 'O(n), with a fixed fraction of slots deliberately left empty.',
    difficulty: 'moderate',
    difficultyNote: 'Insert and lookup are a few lines each. Deletion and resizing are where most bugs are found.',
    limits: 'It does not keep things in order. It is fast on average, not always: a bad run of collisions is slow. It slows sharply as the table fills.',
    useWhen: 'You need to store, find and check for things by their exact name very quickly, and do not need them kept in order.',
  },

  advanced: {
    history: 'Hashing was developed at IBM in the early 1950s. Linear probing was first implemented there in 1954, in an assembler for the IBM 701, by a group that included Gene Amdahl, Elaine McGraw and Arthur Samuel. W. W. Peterson published an influential early study of the technique in 1957 and introduced the term "open addressing". In 1963 Donald Knuth derived the exact expected number of probes for linear probing; the result and its derivation are in volume 3 of *The Art of Computer Programming*. Those results assume an ideal hash function. In 2007 Anna Pagh, Rasmus Pagh and Milan Ružić showed that hash functions with only 5-wise independence are enough for linear probing to run in expected constant time.',
    derivation: 'Why unsuccessful searches suffer more than successful ones. Insert keys one at a time into a table of $m$ slots, and let $\\alpha$ be the load factor at some moment. Knuth showed that, with uniform hashing and large $m$, the expected number of probes to insert the next key (the same as an unsuccessful search) is\n\n$$U(\\alpha) \\approx \\frac{1}{2}\\left(1 + \\frac{1}{(1-\\alpha)^2}\\right).$$\n\nA key that is found later is found by retracing its own insertion, so the cost of a successful search for it equals the cost of inserting it at the load factor of that earlier moment. Averaging over all keys inserted while the table filled from 0 to $\\alpha$ gives\n\n$$S(\\alpha) = \\frac{1}{\\alpha}\\int_0^{\\alpha} U(x)\\,dx = \\frac{1}{\\alpha}\\cdot\\frac{1}{2}\\left(\\alpha + \\frac{\\alpha}{1-\\alpha}\\right) = \\frac{1}{2}\\left(1 + \\frac{1}{1-\\alpha}\\right).$$\n\nMost keys were inserted when the table was emptier than it is now, which is why $S$ grows like $1/(1-\\alpha)$ while $U$ grows like $1/(1-\\alpha)^2$.',
    proof: 'Why clusters grow faster than keys arrive: primary clustering. Consider a cluster of $L$ consecutive full slots followed by an empty slot. A new key lands in that empty slot if its home slot is any of the $L$ slots of the cluster or the empty slot itself, so the cluster grows with probability $(L+1)/m$, while an isolated empty slot is filled with probability $1/m$. Long clusters therefore grow faster than short ones, and two clusters separated by a single empty slot merge when it fills. This positive feedback is what the $(1-\\alpha)^{-2}$ term measures. Schemes whose probe sequence depends on the key, such as double hashing, do not have it: under the idealised assumption that each probe is an independent uniform slot, an unsuccessful search takes $1/(1-\\alpha)$ expected probes, the mean of a geometric distribution with success probability $1-\\alpha$.',
    complexityProof: 'Amortized cost of growth. Suppose the table doubles whenever the load factor would exceed a ceiling $c$. A resize to capacity $2m$ reinserts at most $cm$ keys, at expected constant cost each because the new load is $c/2$. Before the next resize at least $cm$ further insertions must occur. Charging each of those insertions a constant amount pays for the next rebuild, so $n$ insertions cost $O(n)$ expected time in total, or $O(1)$ amortized expected time each. Growing by a fixed number of slots instead of a fixed factor would make the total quadratic.',
    variants: [
      { name: 'Separate chaining', text: 'Each slot holds a list (or small tree) of all keys hashed to it. Simple deletion and graceful behaviour at high load, at the cost of pointers and scattered memory.' },
      { name: 'Quadratic probing', text: 'Probe at offsets 1, 4, 9 and so on from the home slot. Breaks up primary clusters, though keys with the same home slot still follow the same path.' },
      { name: 'Double hashing', text: 'Use a second hash of the key as the step size, so keys with the same home slot take different paths. Close to the idealised 1/(1 − α) behaviour, with less cache locality.' },
      { name: 'Robin Hood hashing', text: 'Linear probing where an arriving key displaces a resident key that is closer to its own home slot. It evens out probe lengths and makes unsuccessful searches end early.' },
      { name: 'Cuckoo hashing', text: 'Each key has two possible slots, in two tables. A lookup checks both and nothing else, giving worst-case constant lookups; insertion may evict and relocate existing keys.' },
      { name: 'Backward-shift deletion', text: 'For linear probing, a deleted slot can be refilled by shifting later members of the cluster back, as long as no key moves before its home slot. No tombstones are needed.' },
    ],
    implementation: 'Use a power-of-two capacity with a hash function that mixes all bits well, or a prime capacity with a simpler one. Store the hash next to the key to speed up comparisons and resizing. Count tombstones toward the load. Choose the ceiling for the probing scheme: plain linear probing is often kept at or below about two thirds full.',
    benchmarking: 'Report the load factor and the mix of successful and unsuccessful lookups with any timing: unsuccessful lookups at high load are the expensive case and are easy to leave out. Use realistic keys, because a hash function that is fine on random integers may cluster badly on sequential ids or similar strings.',
    references: [
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 6.4', venue: 'Addison-Wesley' },
      { authors: 'W. W. Peterson', year: 1957, title: 'Addressing for random-access storage', venue: 'IBM Journal of Research and Development 1(2), 130-146' },
      { authors: 'A. Pagh, R. Pagh and M. Ružić', year: 2009, title: 'Linear probing with constant independence', venue: 'SIAM Journal on Computing 39(3)' },
      { authors: 'S. A. Crosby and D. S. Wallach', year: 2003, title: 'Denial of service via algorithmic complexity attacks', venue: 'Proceedings of the 12th USENIX Security Symposium' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Hash Tables".',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 3.4, covers separate chaining and linear probing side by side.',
      'R. Pagh and F. F. Rodler, "Cuckoo hashing", *Journal of Algorithms* 51(2), 2004.',
    ],
  },

  tests: [
    { name: 'every key is reachable from its home slot, and the lookup agrees with a scan', input: { size: 16, keys: 12, seed: 21, lookup: 'present', custom: [] }, check: tableIsConsistent },
    { name: 'a nearly full table stays consistent and reports an absent key as absent', input: { size: 13, keys: 12, seed: 8, lookup: 'absent', custom: [] },
      check: (r) => (tableIsConsistent(r) === true && r.lookup.index === -1 && !r.keys.includes(r.lookup.key)) || `consistency ${tableIsConsistent(r)}, lookup index ${r.lookup.index}` },
    { name: 'the worked example: slots, probes per key and the lookup of 33', input: { size: 10, custom: [23, 47, 13, 87, 33], target: 33 },
      check: (r) => (r.table.map((v) => (v === null ? '.' : v)).join(' ') === '. . . 23 13 33 . 47 87 .' && r.probesPer.join(',') === '1,1,2,2,3' && r.insertProbes === 9 && r.lookup.index === 5 && r.lookup.probes === 3) || `table ${r.table.join(' ')}, probes ${r.probesPer.join(',')}` },
    { name: 'the worked example: 43 is absent after 4 probes', input: { size: 10, custom: [23, 47, 13, 87, 33], target: 43 },
      check: (r) => (r.lookup.index === -1 && r.lookup.probes === 4) || `index ${r.lookup.index}, probes ${r.lookup.probes}` },
    { name: 'four keys that share a home slot: 3, 13, 23, 33 take 10 probes to insert', input: { size: 10, custom: [3, 13, 23, 33], target: 33 },
      check: (r) => (r.insertProbes === 10 && r.probesPer.join(',') === '1,2,3,4' && r.lookup.probes === 4) || `insert probes ${r.insertProbes}` },
    { name: 'the "every key collides" preset: 1 to 6 probes', input: { size: 10, custom: [3, 13, 23, 33, 43, 53], target: 53 },
      check: (r) => (r.probesPer.join(',') === '1,2,3,4,5,6' && r.longestCluster === 6) || `probes ${r.probesPer.join(',')}` },
    { name: 'probing wraps from the last slot to slot 0', input: { size: 10, custom: [8, 18, 9, 28, 38], target: 38 },
      check: (r) => (r.table[8] === 8 && r.table[9] === 18 && r.table[0] === 9 && r.table[1] === 28 && r.table[2] === 38 && r.lookup.index === 2 && r.lookup.probes === 5 && r.longestCluster === 5) || `table ${r.table.join(' ')}` },
    { name: 'the try-this case: 15 lengthens the search for 42', input: { size: 10, custom: [12, 22, 32, 15], target: 42 },
      check: (r) => (r.table[5] === 15 && r.lookup.index === -1 && r.lookup.probes === 5) || `lookup probes ${r.lookup.probes}` },
    { name: 'the try-this case without 15: the search for 42 takes 4 probes', input: { size: 10, custom: [12, 22, 32], target: 42 },
      check: (r) => (r.lookup.index === -1 && r.lookup.probes === 4) || `lookup probes ${r.lookup.probes}` },
    { name: 'the predict question: in 7 slots, 5 is pushed past 3 and 24 and wraps to slot 0', input: { size: 7, custom: [10, 17, 3, 24, 5], target: 5 },
      check: (r) => (r.table[0] === 5 && r.table[5] === 3 && r.table[6] === 24 && r.probesPer.join(',') === '1,2,3,4,3' && r.lookup.probes === 3) || `table ${r.table.join(' ')}` },
    { name: 'try-this numbers: half full, 8 probes for 5 keys and a longest run of 4', input: { size: 10, keys: 5, lookup: 'present', custom: [] },
      check: (r) => (r.insertProbes === 8 && r.longestCluster === 4 && r.probesPer.join(',') === '1,2,3,1,1') || `probes ${r.probesPer.join(',')}, run ${r.longestCluster}` },
    { name: 'try-this numbers: nearly full, 15 probes for 9 keys and a longest run of 9', input: { size: 10, keys: 9, lookup: 'present', custom: [] },
      check: (r) => (r.insertProbes === 15 && r.longestCluster === 9 && r.probesPer.join(',') === '1,2,3,1,1,1,3,2,1') || `probes ${r.probesPer.join(',')}, run ${r.longestCluster}` },
    { name: 'try-this numbers: nearly full, the absent key 53 takes 6 probes', input: { size: 10, keys: 9, lookup: 'absent', custom: [] },
      check: (r) => (r.lookup.key === 53 && r.lookup.index === -1 && r.lookup.probes === 6) || `lookup of ${r.lookup.key}: ${r.lookup.probes} probes` },
    { name: 'try-this numbers: 9 keys in 16 slots take 11 probes with a longest run of 4', input: { size: 16, keys: 9, lookup: 'present', custom: [] },
      check: (r) => (r.insertProbes === 11 && r.longestCluster === 4 && r.probesPer.filter((x) => x === 1).length === 7) || `probes ${r.probesPer.join(',')}, run ${r.longestCluster}` },
    { name: 'a completely full table ends an unsuccessful search after one circuit', input: { size: 5, custom: [1, 2, 3, 4, 5], target: 7 },
      check: (r) => (r.lookup.index === -1 && r.lookup.probes === 5 && r.loadFactor === 1) || `probes ${r.lookup.probes}` },
    { name: 'a repeated key is stored once', input: { size: 10, custom: [5, 15, 5], target: 15 },
      check: (r) => (r.table.filter((v) => v !== null).length === 2 && r.table[5] === 5 && r.table[6] === 15 && r.lookup.index === 6) || `table ${r.table.join(' ')}` },
  ],
};
