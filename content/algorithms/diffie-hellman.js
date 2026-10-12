// Diffie-Hellman key exchange with toy-sized numbers.
// Every parameter on this page is far too small to be secure. The lesson says so in the summary,
// the simple explanation and the frames, and it shows the eavesdropper recovering the secret by brute force.
// All products stay far below 2^53, so plain JavaScript numbers are exact here.

const SAFE_PRIMES = [23, 47, 59, 83, 107, 167]; // each is 2q + 1 with q prime

function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

// Square-and-multiply, reading the exponent's bits from the left. Counts its multiplications if asked to.
function power(base, exponent, mod, t, counter) {
  let result = 1;
  for (const bit of exponent.toString(2)) {
    result = (result * result) % mod;
    if (counter) t.count(counter);
    if (bit === '1') {
      result = (result * base) % mod;
      if (counter) t.count(counter);
    }
  }
  return result;
}

// How many different values the powers of g take before returning to 1.
function orderOf(g, p) {
  let x = g % p, k = 1;
  while (x !== 1) { x = (x * g) % p; k++; }
  return k;
}

// For the experiment: the smallest base whose powers reach every value from 1 to p − 1.
function fullBase(p) {
  for (let g = 2; g < p; g++) if (orderOf(g, p) === p - 1) return g;
  return 2;
}

// Shows the plain power when it is small enough to print, as a check a reader can do by hand.
const spelled = (base, exponent, mod) => {
  const full = base ** exponent;
  return full < 1e7 ? `${base}^${exponent} = ${full.toLocaleString('en-US')}, and the remainder after dividing by ${mod} is` : `${base}^${exponent} mod ${mod} =`;
};

function run(input, t) {
  const p = Math.floor(Number(input.p));
  const g = Math.floor(Number(input.g));
  const a = Math.floor(Number(input.a));
  const b = Math.floor(Number(input.b));
  const attacker = !!input.attacker;
  const m = Math.floor(Number(input.m ?? 13));
  if (!isPrime(p) || p < 5) throw new Error('p must be a prime number of at least 5.');
  if (!(g >= 2 && g <= p - 2)) throw new Error(`The base g must be between 2 and p − 2 = ${p - 2}. The values 1 and p − 1 are useless as a base: their powers are only ever 1 or p − 1.`);
  for (const [who, x] of [['Alice', a], ['Bob', b]].concat(attacker ? [['Mallory', m]] : [])) {
    if (!(x >= 1 && x <= p - 2)) throw new Error(`${who}'s secret must be between 1 and p − 2 = ${p - 2}.`);
  }

  const order = orderOf(g, p);
  const lanes = { alice: [], channel: [], bob: [] };
  const put = (lane, key, label, value, note, short) => { lanes[lane].push({ key, label, value, note, short: short || key }); };
  // The board carries no title or legend of its own: with either, the shared stylesheet squeezes the
  // three lanes into one narrow column. The strip underneath carries the legend instead.
  const tried = [];
  const picture = (hot = [], roles = {}, found = null) => {
    const roleOf = (it) => (hot.includes(it.key) ? 'current' : roles[it.key]);
    const rows = [{ label: attacker ? 'Mallory holds' : 'Eve has seen', cells: lanes.channel.map((it) => ({ t: it.value, sub: it.short, role: roleOf(it) })) }];
    if (found !== null) rows.push({ label: `${g}^x mod ${p}`, cells: tried.map(([x, v]) => ({ t: v, sub: `x=${x}`, role: found && v === A ? 'alert' : 'default' })) });
    return [
      { kind: 'board', columns: [
        { title: 'Alice', role: 'forest', items: lanes.alice },
        { title: attacker ? 'Channel, controlled by Mallory' : 'Public channel', role: 'ochre', items: lanes.channel },
        { title: 'Bob', role: 'moss', items: lanes.bob },
      ].map((col) => ({ ...col, items: col.items.map((it) => ({ label: it.label, value: it.value, note: it.note, role: roleOf(it) })) })) },
      { kind: 'rows', title: attacker ? 'Everything the attacker in the middle knows' : 'Everything the eavesdropper knows', rows,
        legend: attacker
          ? [{ label: 'this step', role: 'current' }, { label: 'secrets that should match but do not', role: 'alert' }, { label: 'keys the attacker holds', role: 'ochre' }]
          : [{ label: 'this step', role: 'current' }, { label: 'the shared secret', role: 'done' }, { label: 'found by the eavesdropper', role: 'alert' }] },
    ];
  };
  const WARNING = 'These numbers are **toy-sized and insecure**. They are for learning only.';

  put('channel', 'p', 'prime p', p, 'agreed in the open');
  put('channel', 'g', 'base g', g, 'agreed in the open');
  t.frame(() => ({
    line: [0, 1],
    note: `Alice and Bob want to end up with the same secret number, although ${attacker ? 'everything they send passes through someone else\'s hands' : 'an eavesdropper, Eve, reads everything they send'}. They start by agreeing, in the open, on a prime **p = ${p}** and a base **g = ${g}**. All arithmetic from here on is "mod ${p}": multiply, divide by ${p}, keep the remainder. ${WARNING}`,
    views: picture(['p', 'g']),
    vars: { p, g },
  }));
  t.frame(() => ({
    line: 1,
    note: order === p - 1
      ? `The powers of ${g} (${g}, ${g}², ${g}³ and so on, each taken mod ${p}) run through all ${p - 1} values from 1 to ${p - 1} before repeating. Such a base is called a **generator**. It gives the secret the most places to hide.`
      : `The powers of ${g} (${g}, ${g}², ${g}³ and so on, each taken mod ${p}) take only ${order} of the ${p - 1} possible values before repeating. The exchange still works, but every number sent, and the final secret, will be one of those ${order} values.`,
    views: picture(['g']),
    vars: { p, g, 'values g can reach': order },
  }));

  // Alice
  put('alice', 'a', 'secret a', a, 'chosen privately, never sent');
  t.frame(() => ({
    line: 2,
    note: `Alice picks a secret number, **a = ${a}**. She tells nobody.`,
    views: picture(['a']), vars: { a },
  }));
  const A = power(g, a, p, t, 'modular multiplications');
  put('alice', 'A', 'A = g^a mod p', A, 'safe to show');
  t.frame(() => ({
    line: 3,
    note: `Alice computes **A = g^a mod p**: ${spelled(g, a, p)} **${A}**. This is easy to compute, and for large numbers nobody knows a fast way to work back from A to a.`,
    views: picture(['A']), vars: { a, A },
  }));

  let M = null;
  if (attacker) {
    M = power(g, m, p, t, 'modular multiplications');
    put('channel', 'A', 'A, taken from Alice', A, 'intercepted, not passed on', 'A');
    put('channel', 'm', 'Mallory\'s secret m', m);
    put('channel', 'M', 'M = g^m mod p', M, 'sent to both sides');
    put('bob', 'gotA', 'received "from Alice"', M, 'really Mallory\'s M');
    t.frame(() => ({
      line: [15, 16],
      note: `Alice sends ${A}, but Mallory controls the channel. She keeps Alice's number and sends Bob her own instead: with her secret m = ${m} she computes **M = ${g}^${m} mod ${p} = ${M}**. Bob has no way to tell that ${M} did not come from Alice, because nothing in the exchange proves who sent a number.`,
      views: picture(['A', 'M', 'gotA']), vars: { A, M },
    }));
  } else {
    put('channel', 'A', 'A, from Alice to Bob', A);
    put('bob', 'gotA', 'received from Alice', A);
    t.frame(() => ({
      line: 3,
      note: `Alice sends **${A}** to Bob across the public channel. Eve sees it too.`,
      views: picture(['A', 'gotA']), vars: { A },
    }));
  }

  // Bob
  put('bob', 'b', 'secret b', b, 'chosen privately, never sent');
  t.frame(() => ({
    line: 4,
    note: `Bob picks his own secret number, **b = ${b}**, and tells nobody.`,
    views: picture(['b']), vars: { b },
  }));
  const B = power(g, b, p, t, 'modular multiplications');
  put('bob', 'B', 'B = g^b mod p', B, 'safe to show');
  t.frame(() => ({
    line: 5,
    note: `Bob computes **B = g^b mod p**: ${spelled(g, b, p)} **${B}**.`,
    views: picture(['B']), vars: { b, B },
  }));
  if (attacker) {
    put('channel', 'B', 'B, taken from Bob', B, 'intercepted, not passed on');
    put('alice', 'gotB', 'received "from Bob"', M, 'really Mallory\'s M');
    t.frame(() => ({
      line: [15, 16],
      note: `Bob sends ${B}. Mallory keeps it as well and sends Alice the same **M = ${M}** in its place.`,
      views: picture(['B', 'M', 'gotB']), vars: { B, M },
    }));
  } else {
    put('channel', 'B', 'B, from Bob to Alice', B);
    put('alice', 'gotB', 'received from Bob', B);
    t.frame(() => ({
      line: 5,
      note: `Bob sends **${B}** to Alice across the public channel. Eve now knows p = ${p}, g = ${g}, A = ${A} and B = ${B}, and nothing else.`,
      views: picture(['B', 'gotB']), vars: { B },
    }));
  }

  // Both sides finish.
  const fromBob = attacker ? M : B;
  const fromAlice = attacker ? M : A;
  const sharedAlice = power(fromBob, a, p, t, 'modular multiplications');
  put('alice', 'sA', 'secret = received^a mod p', sharedAlice, 'never sent');
  t.frame(() => ({
    line: 6,
    note: `Alice raises the number she received to her own secret: ${spelled(fromBob, a, p)} **${sharedAlice}**.`,
    views: picture(['gotB', 'a', 'sA']), vars: { 'Alice computes': sharedAlice },
  }));
  const sharedBob = power(fromAlice, b, p, t, 'modular multiplications');
  put('bob', 'sB', 'secret = received^b mod p', sharedBob, 'never sent');
  t.frame(() => ({
    line: 7,
    note: `Bob raises the number he received to his own secret: ${spelled(fromAlice, b, p)} **${sharedBob}**.`,
    views: picture(['gotA', 'b', 'sB']), vars: { 'Bob computes': sharedBob },
  }));

  const result = { p, g, a, b, A, B, sharedAlice, sharedBob, agree: sharedAlice === sharedBob, order, generator: order === p - 1, attacker };

  if (attacker) {
    const withAlice = power(A, m, p, t, 'modular multiplications');
    const withBob = power(B, m, p, t, 'modular multiplications');
    put('channel', 'kA', 'A^m mod p', withAlice, 'equals Alice\'s secret', 'A^m');
    put('channel', 'kB', 'B^m mod p', withBob, 'equals Bob\'s secret', 'B^m');
    t.frame(() => ({
      line: 17,
      note: `Mallory raises the two numbers she intercepted to her secret m. ${A}^${m} mod ${p} = **${withAlice}**, which is what Alice holds, and ${B}^${m} mod ${p} = **${withBob}**, which is what Bob holds. ${sharedAlice === sharedBob ? 'Here the two happen to be equal, but Mallory knows them either way.' : 'Alice and Bob do not share a secret with each other at all.'}`,
      views: picture(['kA', 'kB'], { sA: 'alert', sB: 'alert' }), vars: { 'Alice holds': sharedAlice, 'Bob holds': sharedBob },
    }));
    t.frame(() => ({
      line: 17,
      note: `Each of them shares a secret with Mallory and believes it is shared with the other. Mallory can read every later message, re-lock it with the other key and pass it on. This is the **man-in-the-middle attack**. Diffie-Hellman on its own does not say who you are talking to. Real protocols such as TLS add digital signatures so that each side can check where a number came from. ${WARNING}`,
      views: picture([], { sA: 'alert', sB: 'alert', kA: 'ochre', kB: 'ochre', m: 'ochre' }), vars: { 'Alice holds': sharedAlice, 'Bob holds': sharedBob },
    }));
    return { ...result, M, m, malloryWithAlice: withAlice, malloryWithBob: withBob };
  }

  t.frame(() => ({
    line: 8,
    note: `Both arrive at **${sharedAlice}**. Alice computed (g^b)^a and Bob computed (g^a)^b, and both are g^(a×b) mod p. The secret itself was never sent. They can now use it as a key to scramble their messages.`,
    views: picture([], { sA: 'done', sB: 'done' }), vars: { 'shared secret': sharedAlice },
  }));

  // The eavesdropper's side: brute-force search for an exponent that produces A.
  t.frame(() => ({
    line: [10, 11],
    note: `Now take Eve's side. She saw p = ${p}, g = ${g}, A = ${A} and B = ${B}. To get the secret she needs a or b, so she must find an x with ${g}^x mod ${p} = ${A}. This is the **discrete logarithm problem**. For a well-chosen prime of 2048 bits no feasible method is known. With p = ${p} she can simply try every x.`,
    views: picture([], { sA: 'done', sB: 'done' }, false), vars: { A, B },
  }));
  let x = 1;
  let value = g % p;
  for (;;) {
    t.count('eavesdropper trials');
    tried.push([x, value]);
    if (value === A) break;
    const xx = x, vv = value;
    t.frame(() => ({
      line: 12,
      note: `Eve tries x = ${xx}: ${g}^${xx} mod ${p} = ${vv}, which is not ${A}. Notice how the values jump around with no visible pattern. That is what makes working backwards hard when p is large.`,
      views: picture([], { sA: 'done', sB: 'done' }, false), vars: { x: xx, 'g^x mod p': vv },
    }));
    value = (value * g) % p;
    x++;
  }
  const eveSecret = power(B, x, p);
  const trials = x;
  put('channel', 'eveX', 'Eve finds x', x, `after ${trials} ${trials === 1 ? 'try' : 'tries'}`, 'x');
  put('channel', 'eveS', 'Eve computes B^x mod p', eveSecret, 'the shared secret', 'B^x');
  t.frame(() => ({
    line: [12, 13],
    note: `x = ${x} gives ${A}. ${x === a ? 'So x is Alice\'s secret a.' : `That is not Alice's a = ${a}, but it produces the same A, so it works just as well.`} Eve computes ${B}^${x} mod ${p} = **${eveSecret}** and has the shared secret after ${trials} ${trials === 1 ? 'try' : 'tries'}. This is why ${WARNING.replace('These numbers are', 'these numbers are')} Real exchanges use primes of 2048 bits or more, or elliptic curves, where such a search is hopeless.`,
    views: picture(['eveX', 'eveS'], { sA: 'done', sB: 'done', eveX: 'alert', eveS: 'alert' }, true), vars: { x, 'Eve computes': eveSecret },
  }));

  return { ...result, eveExponent: x, eveTrials: trials, eveSecret };
}

// Independent reference for the tests: exact big-integer arithmetic, no square-and-multiply.
const bigPow = (base, exponent, mod) => Number((BigInt(base) ** BigInt(exponent)) % BigInt(mod));
function sound(r) {
  if (r.A !== bigPow(r.g, r.a, r.p)) return `A should be ${bigPow(r.g, r.a, r.p)}, got ${r.A}`;
  if (r.B !== bigPow(r.g, r.b, r.p)) return `B should be ${bigPow(r.g, r.b, r.p)}, got ${r.B}`;
  const s = bigPow(r.g, r.a * r.b, r.p);
  if (r.sharedAlice !== s || r.sharedBob !== s) return `both sides should hold g^(ab) mod p = ${s}, got ${r.sharedAlice} and ${r.sharedBob}`;
  if (!r.agree) return 'the two sides disagree';
  if (bigPow(r.g, r.eveExponent, r.p) !== r.A) return 'the exponent Eve found does not reproduce A';
  if (r.eveSecret !== s) return 'Eve\'s brute-force result is not the shared secret';
  if (bigPow(r.g, r.order, r.p) !== 1) return 'reported order is wrong';
  return true;
}
// Passes only if the exchange is sound and the extra condition holds.
const soundAnd = (r, condition, message) => { const s = sound(r); return s !== true ? s : condition || message; };

export default {
  meta: {
    id: 'diffie-hellman',
    name: 'Diffie-Hellman Key Exchange',
    aliases: ['DH', 'Diffie-Hellman-Merkle key exchange', 'key agreement', 'DHE', 'exponential key exchange'],
    kind: 'protocol',
    discipline: 'cryptography',
    alsoIn: [
      { id: 'mathematics', why: 'It is modular exponentiation in a finite group, and its security is a statement about the discrete logarithm problem in number theory.' },
      { id: 'distributed-systems', why: 'Key agreement is the first step of secure connections between machines, including the TLS handshake.' },
    ],
    subfield: 'Key exchange',
    family: 'Discrete-logarithm cryptography',
    lab: 'cryptography',
    year: 1976,
    authors: 'Whitfield Diffie and Martin E. Hellman',
    summary: 'Two parties agree on a shared secret over a public channel using modular powers. Shown with toy numbers that are insecure and for learning only.',
    difficulty: 'intermediate',
    order: 840,
    paradigms: ['number-theoretic'],
    randomized: false,
    approximate: false,
    time: { best: 'O(k³) bit operations per party', average: 'O(k³) bit operations per party', worst: 'O(k³) bit operations per party', class: 'cubic' },
    space: { worst: 'O(k) bits: a few numbers the size of p', class: 'linear' },
    tags: {
      problems: ['agree on a secret key', 'share a password over an open channel', 'secure a connection', 'key exchange', 'encrypt a conversation'],
      techniques: ['modular exponentiation', 'discrete logarithm', 'one-way function', 'public-key cryptography'],
      applications: ['security', 'networking', 'distributed systems'],
    },
    prerequisites: ['modular-exponentiation', 'concept:modular-arithmetic', 'concept:prime-numbers', 'concept:one-way-function'],
  },

  bigIdea: {
    simple: 'Diffie-Hellman key exchange lets two people agree on a secret number while everyone else is listening. That sounds impossible. If Alice and Bob have never met, and a stranger hears every word they say, how can they end up sharing a secret? The answer is a kind of arithmetic that is easy to do and very hard to undo. Alice and Bob each pick a private number and keep it to themselves. Each one scrambles a public starting number using their private number, and sends the result. Then each scrambles what they received, using their own private number again. Both arrive at the same final number. The listener saw the two scrambled results, but cannot work backwards to either private number, so cannot reach the final one. That final number becomes the key that locks the rest of the conversation. On this page the numbers are tiny so that you can follow every step. Numbers this small are easy to crack. They are for learning only and protect nothing.',
    what: 'Diffie-Hellman is a protocol, a fixed sequence of messages, by which two parties who share nothing in advance compute a common secret over a channel anyone can read. Both agree publicly on a prime $p$ and a base $g$. Alice keeps a secret $a$ and sends $g^a \\bmod p$. Bob keeps a secret $b$ and sends $g^b \\bmod p$. Each raises the other\'s number to their own secret, and both obtain $g^{ab} \\bmod p$. **The parameters in this lesson are toy-sized and insecure.**',
    why: 'Before 1976, two people who wanted to communicate in secret first had to share a key by some trusted route, such as a courier. That does not scale to millions of strangers. Whitfield Diffie and Martin Hellman showed that a shared key can be created in the open, and with that they started public-key cryptography.',
    when: 'It is used whenever two machines need a fresh shared key and can exchange a few messages, which is at the start of almost every encrypted connection. It gives a shared secret and nothing else: it does not encrypt data by itself, and it does not prove who is at the other end, so it is always combined with authentication. When only one message can be sent and the receiver already has a published key, public-key encryption such as [RSA](#/algorithm/rsa) is used instead. Do not write your own version for real use. Use a reviewed library and standard parameters.',
    interesting: 'The eavesdropper is given everything except two numbers that never travel, and that is enough to shut her out. The whole protocol rests on a gap between two directions of one calculation: raising to a power modulo a prime takes a few thousand multiplications even for enormous numbers (see [fast modular exponentiation](#/algorithm/modular-exponentiation)), while the reverse, the discrete logarithm, has no known efficient method for well-chosen groups.',
    where: 'Diffie-Hellman key agreement, today mostly in its elliptic-curve form, sets up the keys in TLS (the protocol behind HTTPS), SSH, IPsec virtual private networks and end-to-end encrypted messengers such as Signal.',
    analogy: {
      title: 'Mixing paint in public',
      text: 'Alice and Bob agree, in the open, on a common paint colour, say yellow. Each secretly chooses a private colour. Each mixes their private colour into some yellow and sends the mixture to the other, where anyone can see it. Then each stirs their own private colour into the mixture they received. Both now hold yellow plus Alice\'s colour plus Bob\'s colour, the same final shade. A spy saw yellow and the two mixtures. Separating a mixture back into its ingredients is impractical, and without one of the private colours she cannot make the final shade.',
      limits: 'Paint is only a picture of "easy to do, hard to undo". Un-mixing paint is hard for physical reasons. Undoing the arithmetic is hard only as far as anyone knows: for large, well-chosen numbers no fast method has been found, but nobody has proved that none exists, and a large quantum computer could do it. With small numbers, like the ones on this page, it is easy. The picture also says nothing about who you are mixing with. If someone sits in the middle and swaps the tins, Alice and Bob each end up sharing a colour with that person instead of with each other. The real protocol has exactly this weakness unless the messages are also signed.',
    },
  },

  example: {
    setup: 'Alice and Bob agree in public on the prime 23 and the base 5. All arithmetic is done "mod 23": after multiplying, divide by 23 and keep only the remainder. Alice secretly picks 3 and Bob secretly picks 6. These numbers are far too small to be safe. They are only for following the steps.',
    steps: [
      'Alice works out 5 to the power 3, which is 125. Since 125 = 5 × 23 + 10, the remainder is 10. She sends 10 to Bob in the open.',
      'Bob works out 5 to the power 6. He already knows that 5 to the power 3 leaves 10, so he squares that: 10 × 10 = 100 = 4 × 23 + 8. The remainder is 8. He sends 8 to Alice in the open.',
      'Alice raises the 8 she received to her secret 3. First 8 × 8 = 64, which leaves 18. Then 18 × 8 = 144 = 6 × 23 + 6. Her result is 6.',
      'Bob raises the 10 he received to his secret 6. First 10 × 10 × 10 = 1000 = 43 × 23 + 11, which leaves 11. Then 11 × 11 = 121 = 5 × 23 + 6. His result is 6.',
      'An eavesdropper saw 23, 5, 10 and 8. To get 6 she needs one of the secrets. With numbers this small she can try the powers of 5 in turn: 5, then 25 which leaves 2, then 10. The third power matches what Alice sent, so Alice\'s secret is 3.',
    ],
    result: 'Alice and Bob both hold 6 without ever sending it. The eavesdropper found it too, in three tries, because 23 is tiny. With a prime hundreds of digits long the same search would never finish.',
    tryInput: { p: 23, g: 5, a: 3, b: 6, attacker: false },
  },

  terms: [
    { term: 'Key', meaning: 'A secret number used to lock (encrypt) and unlock (decrypt) messages.' },
    { term: 'Prime number', meaning: 'A whole number greater than 1 that can be divided evenly only by 1 and itself, such as 23.' },
    { term: 'Mod', meaning: 'Short for modulo. "Mod 23" means: divide by 23 and keep only the remainder. Clock arithmetic is the everyday version, mod 12.' },
    { term: 'Power', meaning: 'A number multiplied by itself a given number of times. 5 to the power 3 is 5 × 5 × 5.' },
    { term: 'Private key', meaning: 'A number one person chooses and never reveals. Here, Alice\'s a and Bob\'s b.' },
    { term: 'Public value', meaning: 'A number that is sent in the open and that an eavesdropper is assumed to see.' },
    { term: 'Shared secret', meaning: 'The number both sides end up with, and that was never sent.' },
    { term: 'Discrete logarithm', meaning: 'The reverse of taking a power mod a prime: given the result, find the exponent. Believed to be very hard for large, well-chosen primes.' },
    { term: 'One-way function', meaning: 'A calculation that is easy to carry out and impractical to reverse.' },
    { term: 'Authentication', meaning: 'Checking that a message really comes from the person it claims to come from.' },
    { term: 'Man-in-the-middle attack', meaning: 'An attack in which someone sits between two parties, runs a separate exchange with each, and relays their messages unnoticed.' },
  ],

  takeaway: 'Each side mixes a private number into a public one, swaps the results and mixes again, so both reach the same secret and it never has to travel.',

  viz: {
    describe: 'A board with three lanes: Alice on the left, the public channel in the middle and Bob on the right. Cards appear in each lane as the exchange proceeds, showing the agreed prime and base, each side\'s private number, the values sent across and the secret each side computes. The card for the current step is terracotta and the matching shared secrets turn forest green. Below the board, a strip of cells then shows the eavesdropper trying every exponent until one reproduces Alice\'s public value. With the attacker switched on, the middle lane belongs to Mallory, who replaces both public values with her own, and the two secrets that fail to match are brick red. All numbers are toy-sized and insecure.',
    inputs: [
      { id: 'p', type: 'select', label: 'Prime p (toy-sized, insecure)', default: 23, options: SAFE_PRIMES.map((v) => ({ value: v, label: String(v) })),
        help: 'Each choice is a "safe prime": (p − 1) / 2 is also prime. Real primes have 2048 bits or more.' },
      { id: 'g', type: 'range', label: 'Base g', min: 2, max: 21, step: 1, default: 5,
        help: 'The public number both sides raise to their secret powers.' },
      { id: 'a', type: 'range', label: 'Alice\'s secret a', min: 2, max: 21, step: 1, default: 6 },
      { id: 'b', type: 'range', label: 'Bob\'s secret b', min: 2, max: 21, step: 1, default: 15 },
      { id: 'attacker', type: 'toggle', label: 'Put an attacker (Mallory) in the middle', default: false,
        help: 'Shows what happens when nothing proves who sent each number.' },
      { id: 'm', type: 'range', label: 'Mallory\'s secret m', min: 2, max: 21, step: 1, default: 13,
        help: 'Used only when the attacker is switched on.' },
    ],
    presets: [
      { label: 'A basic exchange', values: { p: 23, g: 5, a: 6, b: 15, attacker: false } },
      { label: 'The worked example', values: { p: 23, g: 5, a: 3, b: 6, attacker: false } },
      { label: 'A base that reaches only half the values', values: { p: 23, g: 2, a: 6, b: 15, attacker: false } },
      { label: 'A larger toy prime', values: { p: 167, g: 5, a: 19, b: 12, attacker: false } },
      { label: 'Attacker in the middle', values: { p: 23, g: 5, a: 6, b: 15, attacker: true, m: 13 } },
    ],
    tryThis: [
      'Run "A basic exchange" to the end and count Eve\'s tries. Then raise Alice\'s secret a and run it again. Eve\'s work grows with a, and it can never exceed p − 2. That ceiling is why p has to be enormous.',
      'Load "A base that reaches only half the values". With g = 2 and p = 23 the powers of g repeat after 11 steps, so A, B and the secret can only be one of 11 numbers. Compare with g = 5, whose powers reach all 22.',
      'Load "Attacker in the middle" and compare the secret Alice computes with the one Bob computes. Then ask what, in the messages they received, could have told them something was wrong.',
    ],
    run,
    report: (r, c) => {
      const head = `Public: p = ${r.p}, g = ${r.g} (its powers take ${r.order} of ${r.p - 1} possible values).\nAlice: secret a = ${r.a}, sends A = ${r.A}.   Bob: secret b = ${r.b}, sends B = ${r.B}.`;
      if (r.attacker) return `${head}\nMallory replaced both with M = ${r.M}.\nAlice holds ${r.sharedAlice}, Bob holds ${r.sharedBob}. Mallory holds both.\nTOY PARAMETERS: insecure, for learning only.`;
      return `${head}\nShared secret: Alice computes ${r.sharedAlice}, Bob computes ${r.sharedBob}.\nEavesdropper: found x = ${r.eveExponent} after ${r.eveTrials} ${r.eveTrials === 1 ? 'try' : 'tries'} and recovered ${r.eveSecret}.\n${c['modular multiplications'] || 0} modular multiplications by the honest parties.\nTOY PARAMETERS: insecure, for learning only.`;
    },
    experiment: {
      title: 'The eavesdropper\'s search as the prime grows',
      note: 'Each point is a real run with a safe prime p, a base whose powers reach all p − 1 values, and Alice\'s secret set to p − 2, the worst case for an eavesdropper who tries x = 1, 2, 3 and so on. Her search grows in step with p. The work of an honest party grows only with the number of digits of p. Much better attacks than trying every exponent are known, so real security needs far larger primes than this chart alone would suggest.',
      metric: 'eavesdropper trials',
      metricLabel: 'Exponents tried by the eavesdropper',
      sizeLabel: 'Prime p',
      sizes: [23, 47, 107, 179, 359, 719, 1439, 2879],
      variants: [{ id: 'worst', label: 'Brute-force search for a' }],
      input: (p) => ({ p, g: fullBase(p), a: p - 2, b: 3, attacker: false }),
      theory: [
        { label: 'p − 2 tries', fn: (p) => p - 2 },
        { label: 'multiplications by one honest party, at most 4 log₂ p + 4', fn: (p) => 4 * Math.log2(p) + 4 },
      ],
    },
  },

  logic: {
    intuition: 'Raising to a power can be done in either order: $(g^a)^b = (g^b)^a = g^{ab}$, and this stays true when every result is reduced modulo $p$. So Alice can apply her secret to Bob\'s public number, Bob can apply his to Alice\'s, and they meet at the same value. An observer has $g^a$ and $g^b$ but neither exponent, and multiplying the two only gives $g^{a+b}$, which is no help.',
    steps: [
      'Alice and Bob agree publicly on a large prime `p` and a base `g`.',
      'Alice chooses a secret number `a` at random and computes `A = g^a mod p`. She sends `A` to Bob.',
      'Bob chooses a secret number `b` at random and computes `B = g^b mod p`. He sends `B` to Alice.',
      'Alice computes `s = B^a mod p`.',
      'Bob computes `s = A^b mod p`. The two values are equal.',
      'Both feed `s` into a key derivation function to obtain the keys that encrypt the rest of the session, and then discard `a` and `b`.',
    ],
    pseudocode: [
      'diffie_hellman:',
      '  public: prime p and base g',
      '  Alice: choose secret a',
      '  Alice: send A ← g^a mod p',
      '  Bob:   choose secret b',
      '  Bob:   send B ← g^b mod p',
      '  Alice: s ← B^a mod p',
      '  Bob:   s ← A^b mod p',
      '  both now hold s = g^(a·b) mod p',
      '',
      'eavesdropper(p, g, A, B):  (toy p only)',
      '  x ← 1',
      '  while g^x mod p ≠ A: x ← x + 1',
      '  return B^x mod p',
      '',
      'attacker_in_the_middle:  (nothing is signed)',
      '  replace A and B in transit with M ← g^m mod p',
      '  share A^m with Alice and B^m with Bob',
    ],
    decisions: [
      { title: 'Which prime?', text: 'The prime must be so large that discrete logarithms are infeasible, 2048 bits or more by current guidance, and $p - 1$ must have a large prime factor. The usual choice is a safe prime, $p = 2q + 1$ with $q$ prime. Standard, published primes are used so that nobody has to trust a home-made one.' },
      { title: 'Which base?', text: 'The base should generate a large subgroup. With a safe prime, every base other than 1 and $p - 1$ generates either all $p - 1$ values or the $q$ quadratic residues. Many standards deliberately pick a base that generates the subgroup of prime order $q$.' },
      { title: 'How are the secrets chosen?', text: 'Uniformly at random from a cryptographically secure generator, fresh for every exchange. A predictable secret is as bad as a small prime. The sliders on this page exist only so that you can see the effect of a choice.' },
      { title: 'Finite field or elliptic curve?', text: 'The same protocol works in any group where discrete logarithms are hard. Elliptic-curve groups reach comparable security with keys of about 256 bits, which is why most deployments now use them.' },
      { title: 'How is the other side authenticated?', text: 'Not by Diffie-Hellman. The exchanged values are signed with long-term keys, or tied to a password or a pre-shared key, by the surrounding protocol.' },
    ],
    invariants: [
      'The secrets a and b never leave the party that chose them.',
      'Every transmitted value is a power of g modulo p, so it lies in the subgroup generated by g.',
      'With no interference, Alice\'s result and Bob\'s result are both equal to g^(a·b) mod p.',
    ],
    edgeCases: [
      'A base of 1 or p − 1 makes every public value 1 or p − 1, and the secret can be guessed at once. Implementations reject received values of 0, 1 and p − 1.',
      'A base that generates a small subgroup limits the secret to a few values. A received value should be checked to lie in the intended subgroup.',
      'A secret of 1 sends the base itself. Secrets must be drawn at random from the full range.',
      'If p − 1 has only small prime factors, discrete logarithms are easy however large p is. This is why safe primes are used.',
      'An active attacker who can replace messages defeats the unauthenticated protocol completely.',
    ],
    correctness: 'Alice computes $B^a \\bmod p = (g^b)^a \\bmod p$ and Bob computes $A^b \\bmod p = (g^a)^b \\bmod p$. Reducing modulo $p$ at any point does not change the final remainder, because $(x \\bmod p)(y \\bmod p) \\equiv xy \\pmod p$. Both results therefore equal $g^{ab} \\bmod p$. Security is a separate claim and is an assumption, not a theorem: it requires that computing $g^{ab}$ from $g^a$ and $g^b$ is infeasible (the computational Diffie-Hellman assumption). Anyone who can compute discrete logarithms can do it. Whether the reverse is true in general is not known.',
    mistakes: [
      'Using the protocol without authentication and assuming the other side is who it claims to be.',
      'Reusing the same secret exponent for many sessions, which gives up forward secrecy.',
      'Choosing a prime that is too small, or generating a custom prime instead of using a standard group.',
      'Using the raw shared number directly as an encryption key instead of passing it through a key derivation function.',
      'Computing g^a as an ordinary integer and reducing afterwards. The intermediate number is astronomically large. Reduce after every multiplication.',
      'Writing your own implementation for real use. Timing differences and missing checks leak secrets even when the arithmetic is right.',
    ],
  },

  code: {
    sample: {
      input: 'The toy exchange p = 23, g = 5 with secrets a = 6 and b = 15, followed by an eavesdropper who tries every exponent. Insecure parameters, for illustration only.',
      expected: 'public: p=23 g=5\nAlice sends A=8\nBob sends B=19\nAlice computes 2\nBob computes 2\neavesdropper finds x=6 after 6 tries and computes 2',
    },
    python: {
      source: `def power(base, exponent, mod):
    """Square-and-multiply, reading the exponent's bits from the left."""
    result = 1
    for bit in bin(exponent)[2:]:
        result = result * result % mod
        if bit == "1":
            result = result * base % mod
    return result


# Toy parameters: far too small to be secure. For illustration only.
p, g = 23, 5
a, b = 6, 15          # private: a real exchange draws these at random

A = power(g, a, p)    # Alice -> Bob, in the open
B = power(g, b, p)    # Bob -> Alice, in the open
alice_secret = power(B, a, p)
bob_secret = power(A, b, p)

print(f"public: p={p} g={g}")
print(f"Alice sends A={A}")
print(f"Bob sends B={B}")
print(f"Alice computes {alice_secret}")
print(f"Bob computes {bob_secret}")

# The eavesdropper knows p, g, A and B. With a toy prime she can try every exponent.
x, value = 1, g % p
while value != A:
    value = value * g % p
    x += 1
print(f"eavesdropper finds x={x} after {x} tries and computes {power(B, x, p)}")`,
      notes: [
        { line: 5, text: 'Reducing after every multiplication keeps the numbers smaller than p squared, however large the exponent is.' },
        { line: 15, text: 'A is safe to publish only because recovering a from it is believed infeasible for large primes. With p = 23 it is not safe at all.' },
        { line: 17, text: 'Alice uses Bob\'s public value and her own secret. Bob does the mirror image on the next line. Both get g to the power a times b.' },
        { line: 27, text: 'The attack: step through the powers of g until one equals A. This loop runs up to p − 2 times, which is why real primes have 2048 bits or more.' },
      ],
    },
    javascript: {
      source: `// Square-and-multiply, reading the exponent's bits from the left.
// Products stay below 23 * 23 here. For real sizes you would need BigInt.
function power(base, exponent, mod) {
  let result = 1;
  for (const bit of exponent.toString(2)) {
    result = (result * result) % mod;
    if (bit === "1") result = (result * base) % mod;
  }
  return result;
}

// Toy parameters: far too small to be secure. For illustration only.
const p = 23, g = 5;
const a = 6, b = 15; // private: a real exchange draws these at random

const A = power(g, a, p); // Alice -> Bob, in the open
const B = power(g, b, p); // Bob -> Alice, in the open
const aliceSecret = power(B, a, p);
const bobSecret = power(A, b, p);

console.log("public: p=" + p + " g=" + g);
console.log("Alice sends A=" + A);
console.log("Bob sends B=" + B);
console.log("Alice computes " + aliceSecret);
console.log("Bob computes " + bobSecret);

// The eavesdropper knows p, g, A and B. With a toy prime she can try every exponent.
let x = 1, value = g % p;
while (value !== A) {
  value = (value * g) % p;
  x++;
}
console.log("eavesdropper finds x=" + x + " after " + x + " tries and computes " + power(B, x, p));`,
    },
    cpp: {
      source: `#include <cstdint>
#include <iostream>

// Square-and-multiply, reading the exponent's bits from the left.
std::uint64_t power(std::uint64_t base, std::uint64_t exponent, std::uint64_t mod) {
    std::uint64_t result = 1;
    for (int i = 63; i >= 0; --i) {
        result = result * result % mod;
        if ((exponent >> i) & 1) result = result * base % mod;
    }
    return result;
}

int main() {
    // Toy parameters: far too small to be secure. For illustration only.
    const std::uint64_t p = 23, g = 5;
    const std::uint64_t a = 6, b = 15;  // private: a real exchange draws these at random

    const std::uint64_t A = power(g, a, p);  // Alice -> Bob, in the open
    const std::uint64_t B = power(g, b, p);  // Bob -> Alice, in the open
    const std::uint64_t aliceSecret = power(B, a, p);
    const std::uint64_t bobSecret = power(A, b, p);

    std::cout << "public: p=" << p << " g=" << g << "\\n";
    std::cout << "Alice sends A=" << A << "\\n";
    std::cout << "Bob sends B=" << B << "\\n";
    std::cout << "Alice computes " << aliceSecret << "\\n";
    std::cout << "Bob computes " << bobSecret << "\\n";

    // The eavesdropper knows p, g, A and B. With a toy prime she can try every exponent.
    std::uint64_t x = 1, value = g % p;
    while (value != A) {
        value = value * g % p;
        ++x;
    }
    std::cout << "eavesdropper finds x=" << x << " after " << x << " tries and computes " << power(B, x, p) << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each party performs two modular exponentiations: one to make its public value and one to compute the shared secret. With square-and-multiply, an exponent of k bits costs at most 2k modular multiplications, so the honest work grows with the number of digits of p. An eavesdropper who tries every exponent does work proportional to p itself, which doubles with every extra bit. That asymmetry is the security.',
    cases: [
      { case: 'Each honest party', time: 'At most 4k modular multiplications', when: 'k is the number of bits of p. Two exponentiations with exponents of up to k bits.' },
      { case: 'In bit operations', time: 'O(k³)', when: 'With schoolbook multiplication, one modular multiplication of k-bit numbers costs O(k²).' },
      { case: 'Eavesdropper, trying every exponent', time: 'O(p) = O(2^k) multiplications', when: 'What this page shows. Hopeless beyond toy sizes.' },
      { case: 'Eavesdropper, generic square-root methods', time: 'O(√q) group operations', when: 'Baby-step giant-step or Pollard\'s rho in a subgroup of prime order q.' },
      { case: 'Eavesdropper, number field sieve', time: 'Sub-exponential in k', when: 'The best known classical method for prime fields. It is the reason primes need thousands of bits, not hundreds.' },
    ],
    space: 'Each party stores a handful of numbers the size of p. The messages are two numbers of k bits.',
    memory: 'Generic attacks trade memory for time: baby-step giant-step stores about √q values, while Pollard\'s rho needs almost none.',
    tradeoffs: 'Larger groups cost more per handshake and give more security. Elliptic-curve groups give the same estimated security with much smaller numbers and faster handshakes, at the price of more intricate mathematics. Fresh secrets for every session cost an extra exponentiation and protect past sessions if a long-term key leaks later.',
    assumptions: [
      'The numbers on this page are toy-sized. The asymptotic statements describe real sizes, where k is 2048 or more.',
      'Security assumes that computing g^(ab) from g^a and g^b is infeasible in the chosen group. This is a conjecture, not a proven fact.',
      'The statements about attacks concern classical computers. Shor\'s algorithm computes discrete logarithms in polynomial time on a sufficiently large quantum computer.',
      'The chart counts exponents tried by a brute-force eavesdropper, not the cost of the best known attack.',
    ],
  },

  tradeoffs: {
    excels: [
      'Creating a fresh shared key between parties with no prior shared secret.',
      'Forward secrecy: with a new exchange per session, a later theft of long-term keys does not expose recorded traffic.',
      'Low cost: a few modular exponentiations, or elliptic-curve operations, per connection.',
    ],
    struggles: [
      'Any setting with an active attacker and no authentication. It cannot tell a friend from an impostor.',
      'Parties that are not online at the same time, unless one side publishes its public value in advance.',
      'A future with large quantum computers, which would break both the finite-field and the elliptic-curve forms.',
    ],
    pitfalls: [
      'Weak or widely shared parameters. An attacker can invest in one precomputation per prime and reuse it against every connection that uses that prime.',
      'Missing validation of received values, which allows small-subgroup attacks.',
      'Side channels: exponentiation code whose running time depends on the secret bits.',
    ],
    misunderstandings: [
      '"Diffie-Hellman encrypts messages." It only produces a shared secret. A separate cipher uses that secret to encrypt.',
      '"It proves who you are talking to." It proves nothing about identity. Without signatures or another check, an attacker in the middle can run one exchange with each side.',
      '"It is proven secure." Its security is an assumption that no efficient method for the underlying problem exists. No such method is publicly known for well-chosen parameters, and none has been ruled out.',
      '"A secret that works on this page would work in practice." Every number here can be broken by trying all the possibilities. Real parameters are hundreds of digits long.',
    ],
    constraints: [
      'Finite-field groups below 2048 bits are no longer considered acceptable.',
      'Protocols negotiate from a short list of standard groups and curves instead of accepting arbitrary parameters.',
      'Migration to quantum-resistant key agreement has begun, often run alongside an elliptic-curve exchange.',
    ],
    alternatives: [
      { id: 'rsa', name: 'RSA key transport', when: 'One side has an RSA key pair and the other simply encrypts a random key to it. Simpler, but without forward secrecy, and no longer used this way in TLS 1.3.' },
      { name: 'Elliptic-curve Diffie-Hellman (X25519 and others)', when: 'Almost always, in new systems. Same protocol in a different group, with much smaller keys.' },
      { name: 'Post-quantum key encapsulation (ML-KEM)', when: 'Protection is needed against future quantum computers. Often combined with an elliptic-curve exchange.' },
      { name: 'Pre-shared keys', when: 'The two parties can exchange a secret securely in advance and their number is small.' },
    ],
    comparison: {
      columns: ['', 'Diffie-Hellman', 'RSA key transport', 'Pre-shared key'],
      rows: [
        ['Needs a prior shared secret', 'No', 'No', 'Yes'],
        ['Hard problem relied on', 'Discrete logarithm (Diffie-Hellman problem)', 'Factoring (RSA problem)', 'None'],
        ['Forward secrecy', 'Yes, with fresh secrets per session', 'No', 'No'],
        ['Authenticates the parties', 'No, must be added', 'The receiver only, if its public key is trusted', 'Yes, implicitly'],
        ['Broken by a large quantum computer', 'Yes', 'Yes', 'No'],
      ],
    },
  },

  applications: [
    { title: 'TLS, the protocol behind HTTPS', status: 'established', text: 'In TLS 1.3 the client and server always perform an ephemeral Diffie-Hellman exchange, over a finite field or more commonly an elliptic curve, and the server signs the handshake so that the client knows whom it exchanged keys with.' },
    { title: 'SSH', status: 'established', text: 'Secure Shell sets up each session with a Diffie-Hellman or elliptic-curve Diffie-Hellman exchange and authenticates it with the server\'s host key.' },
    { title: 'IPsec virtual private networks', status: 'established', text: 'The Internet Key Exchange protocol used by IPsec negotiates a standard Diffie-Hellman group and derives the tunnel\'s keys from the shared secret.' },
    { title: 'End-to-end encrypted messaging', status: 'established', text: 'The Signal protocol combines several elliptic-curve Diffie-Hellman exchanges to start a conversation and keeps performing new ones as messages flow, so that keys change continually.' },
  ],

  connections: [
    { to: 'modular-exponentiation', type: 'prerequisite', why: 'Every step of the protocol is a modular power, and it is practical only because square-and-multiply computes one in a number of multiplications proportional to the bit length.' },
    { to: 'concept:modular-arithmetic', type: 'prerequisite', why: 'All values live among the remainders modulo a prime, where multiplication wraps around and powers scatter unpredictably.' },
    { to: 'concept:one-way-function', type: 'prerequisite', why: 'Modular exponentiation is easy and its inverse, the discrete logarithm, is believed to be hard. The protocol is that asymmetry put to use.' },
    { to: 'concept:public-key-cryptography', type: 'related', why: 'It was the first published scheme in which secrecy does not depend on a key shared in advance.' },
    { to: 'concept:prime-numbers', type: 'prerequisite', why: 'Working modulo a prime guarantees that the non-zero remainders form a group with a generator.' },
    { to: 'rsa', type: 'same-problem', why: 'Both let strangers establish secrecy over an open channel using modular powers. RSA relies on factoring and can also sign, while Diffie-Hellman relies on discrete logarithms and only agrees on a key.' },
    { to: 'miller-rabin', type: 'related', why: 'Finding the large primes that Diffie-Hellman groups are built on requires a fast primality test.' },
    { to: 'shors-algorithm', type: 'advanced', why: 'Shor\'s quantum algorithm finds the period of modular powers, which yields discrete logarithms and would break this protocol.' },
    { to: 'sha-256', type: 'related', why: 'The raw shared number is passed through a hash-based key derivation function before it is used as a key.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Machines that have never met use it to set up an encrypted channel across a network they do not trust.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Eve has seen p, g, A and B. What would she have to compute to learn the shared secret?',
      options: ['A × B mod p', 'An exponent x with g^x mod p = A (or the same for B)', 'The square root of p', 'Nothing more: A and B are the secret'],
      answer: 1,
      explain: [
        'A × B is g^(a+b), not g^(a×b). It does not help.',
        'Correct. With such an x she can compute B^x mod p, exactly as Alice does. Finding x is the discrete logarithm problem.',
        'The size of p matters, but its square root has nothing to do with the secret.',
        'A and B are public. The secret is a third number that neither of them reveals directly.',
      ],
    },
    {
      type: 'predict',
      q: 'With p = 23, g = 5, a = 6 and b = 15, switch on the attacker with m = 13. What will Alice and Bob end up holding?',
      options: ['The same secret as without the attacker', 'The same secret as each other, but a different one from before', 'Two different numbers, each of which Mallory also knows', 'Nothing: the exchange fails with an error'],
      answer: 2,
      explain: [
        'Neither of them ever receives the other\'s real public value, so the original secret is never formed.',
        'They would match only by coincidence. Each one mixes a different secret into Mallory\'s number.',
        'Correct. Alice computes M^a and Bob computes M^b. Mallory computes A^m and B^m, which are the same two numbers. Here they are 18 and 7.',
        'Nothing looks wrong to either side. That is what makes the attack dangerous.',
      ],
      tryInput: { p: 23, g: 5, a: 6, b: 15, attacker: true, m: 13 },
    },
    {
      type: 'debug',
      q: 'In this program the two keys come out different. Which line is wrong?',
      code: `A = power(g, a, p)          # Alice sends A
B = power(g, b, p)          # Bob sends B
alice_key = power(A, a, p)
bob_key = power(A, b, p)`,
      options: ['Line 1: Alice should compute power(a, g, p)', 'Line 2: Bob should reuse Alice\'s secret', 'Line 3: Alice must raise Bob\'s value B, not her own A, to her secret', 'Line 4: Bob should raise B to his secret'],
      answer: 2,
      explain: [
        'The base is g and the exponent is the secret. Line 1 is right.',
        'Each side has its own secret. Sharing one would defeat the purpose.',
        'Correct. Each side combines the other side\'s public value with its own secret. `power(B, a, p)` gives g^(ab), while `power(A, a, p)` gives g^(a·a).',
        'Bob correctly raises Alice\'s value A to his own secret b.',
      ],
    },
    {
      type: 'choice',
      q: 'Why do real deployments use a prime of 2048 bits or more, or an elliptic curve, instead of a prime like 23?',
      options: ['Larger primes make the arithmetic faster', 'With a small prime, the exponent can be found by trying the possibilities or by known faster methods', 'Small primes do not have generators', 'The shared secret must be at least 2048 bits long to be used as a key'],
      answer: 1,
      explain: [
        'Larger primes make each multiplication slower. The cost is accepted for the security.',
        'Correct. The eavesdropper\'s work grows with the size of the group. It has to be so large that even the best known methods are out of reach.',
        'Every prime has generators. For 23, the number 5 is one.',
        'Keys for ciphers are much shorter, typically 128 or 256 bits, and are derived from the shared secret.',
      ],
    },
    {
      type: 'challenge',
      title: 'A faster eavesdropper: baby-step giant-step',
      prompt: 'The eavesdropper on this page needs up to p − 2 tries. Implement the baby-step giant-step method, which finds x with g^x ≡ A (mod p) in about √p multiplications. Let n be the ceiling of √(p − 1). Store g^j mod p for j = 0 to n − 1 in a table. Then compute A × (g^(−n))^i mod p for i = 0, 1, 2 and so on until the result appears in the table. Then x = i × n + j. Count the multiplications for the primes in the experiment and compare them with brute force.',
      hints: [
        'g^(−n) mod p equals g^(p − 1 − n) mod p, by Fermat\'s little theorem.',
        'Use a hash map from value to exponent for the table, so that each lookup takes constant time.',
        'The method trades memory for time: it stores about √p numbers.',
      ],
    },
  ],

  compare: {
    idea: 'Each side raises a public base to a private exponent, swaps the results, and raises again to reach the same value.',
    requires: 'A group where discrete logarithms are hard, random secrets, and separate authentication of the exchanged values.',
    sensitivity: 'Security depends entirely on parameter size and quality. The toy sizes on this page offer none.',
    memory: 'A few numbers the size of the prime.',
    difficulty: 'moderate',
    difficultyNote: 'The arithmetic is short. Doing it safely (validation, constant time, authentication) is specialist work.',
    limits: 'No authentication. Broken by a large quantum computer. Useless with small or badly chosen parameters.',
    useWhen: 'Two parties need a fresh shared key over an open channel, through a vetted library and inside an authenticated protocol.',
  },

  advanced: {
    history: 'Whitfield Diffie and Martin Hellman published the protocol in 1976 in "New directions in cryptography", the paper that introduced public-key cryptography to the open research community. They built on Ralph Merkle\'s earlier idea of agreeing on a key over a public channel, and Hellman later suggested that the scheme be called Diffie-Hellman-Merkle key exchange. In 1997 the British agency GCHQ disclosed that Malcolm Williamson had found an equivalent scheme there in the 1970s, following work by James Ellis and Clifford Cocks. Elliptic-curve versions followed the independent proposals of Neal Koblitz and Victor Miller in the mid-1980s to use elliptic-curve groups in cryptography.',
    derivation: 'Work in the multiplicative group of non-zero remainders modulo a prime $p$, which has $p - 1$ elements and is cyclic. Alice computes\n\n$$s_A = B^a \\bmod p = (g^b)^a \\bmod p = g^{ab} \\bmod p,$$\n\nand Bob computes\n\n$$s_B = A^b \\bmod p = (g^a)^b \\bmod p = g^{ab} \\bmod p,$$\n\nso $s_A = s_B$. If $g$ has order $r$ (the smallest $r > 0$ with $g^r \\equiv 1$), then exponents only matter modulo $r$ and every value that appears is one of $r$ elements. For a safe prime $p = 2q + 1$ the possible orders are 1, 2, $q$ and $2q$, so every base other than $1$ and $p - 1$ generates at least $q$ elements. In the default example, $p = 23$, $q = 11$, the base 5 has order 22 and the base 2 has order 11.',
    proof: 'The man-in-the-middle attack always succeeds against the unauthenticated protocol. Mallory chooses $m$ and sends $M = g^m \\bmod p$ to both parties in place of $B$ and $A$. Alice computes $M^a = g^{ma}$ and Bob computes $M^b = g^{mb}$. Mallory, who received $A = g^a$ and $B = g^b$, computes $A^m = g^{am}$ and $B^m = g^{bm}$. So Mallory shares one key with each party. Every message Alice or Bob receives has the same distribution as in an honest run, a power of $g$, so no test on the messages alone can detect the substitution. Detection needs information the attacker cannot forge, such as a signature under a key the other side already trusts.',
    complexityProof: 'Square-and-multiply processes the exponent bit by bit with one squaring per bit and one extra multiplication per 1 bit, so an exponent below $p$ costs at most $2\\lceil \\log_2 p \\rceil$ modular multiplications, and a party performs two exponentiations. The brute-force eavesdropper computes $g, g^2, g^3, \\dots$ until reaching $A$, which takes $x$ multiplications where $x$ is the discrete logarithm, at most the order of $g$. For a generator and $a = p - 2$ this is exactly $p - 2$ steps, the curve in the experiment.',
    variants: [
      { name: 'Ephemeral Diffie-Hellman (DHE, ECDHE)', text: 'New secrets for every session, discarded afterwards. Gives forward secrecy and is the only mode TLS 1.3 allows.' },
      { name: 'Elliptic-curve Diffie-Hellman', text: 'The same exchange in the group of points on an elliptic curve, such as Curve25519 (X25519) or NIST P-256.' },
      { name: 'Authenticated key exchange', text: 'Diffie-Hellman combined with signatures or long-term keys, as in the TLS handshake and the Station-to-Station protocol.' },
      { name: 'ElGamal encryption', text: 'Turns the exchange into public-key encryption: the receiver\'s public value is published in advance and the sender attaches a fresh one to each message.' },
      { name: 'Password-authenticated key exchange', text: 'Variants in which a shared password authenticates the exchange without exposing the password to offline guessing.' },
    ],
    implementation: 'Use a maintained cryptographic library and a standard group or curve. Draw secrets from the operating system\'s secure random generator. Validate received public values. Use constant-time exponentiation. Derive keys from the shared secret with a key derivation function that also takes in the handshake transcript. Authenticate the exchange.',
    benchmarking: 'Handshake cost is usually reported as exchanges per second for a stated group or curve on stated hardware. Compare groups at equal estimated security levels, not at equal key lengths: a 256-bit elliptic curve is compared with a finite-field prime of about 3072 bits.',
    references: [
      { authors: 'W. Diffie and M. E. Hellman', year: 1976, title: 'New directions in cryptography', venue: 'IEEE Transactions on Information Theory 22(6), 644-654' },
      { authors: 'R. C. Merkle', year: 1978, title: 'Secure communications over insecure channels', venue: 'Communications of the ACM 21(4), 294-299' },
      { authors: 'D. Adrian and others', year: 2015, title: 'Imperfect forward secrecy: how Diffie-Hellman fails in practice', venue: 'Proceedings of the 22nd ACM Conference on Computer and Communications Security (CCS)' },
      { authors: 'E. Rescorla', year: 2018, title: 'The Transport Layer Security (TLS) Protocol Version 1.3', venue: 'RFC 8446, Internet Engineering Task Force' },
    ],
    furtherReading: [
      'A. J. Menezes, P. C. van Oorschot and S. A. Vanstone, *Handbook of Applied Cryptography*, chapter 12, "Key establishment protocols".',
      'J. Katz and Y. Lindell, *Introduction to Modern Cryptography*, the chapter on key exchange and the Diffie-Hellman protocol.',
      'D. Boneh and V. Shoup, *A Graduate Course in Applied Cryptography*, the chapters on the Diffie-Hellman problem and key exchange.',
    ],
  },

  tests: [
    { name: 'default exchange matches exact big-integer arithmetic', input: {},
      check: (r) => soundAnd(r, r.A === 8 && r.B === 19 && r.sharedAlice === 2 && r.sharedBob === 2 && r.eveTrials === 6 && r.order === 22, `got A=${r.A} B=${r.B} s=${r.sharedAlice}, ${r.eveTrials} tries`) },
    { name: 'the worked example: A = 10, B = 8, secret 6, found by Eve in 3 tries', input: { p: 23, g: 5, a: 3, b: 6, attacker: false },
      check: (r) => soundAnd(r, r.A === 10 && r.B === 8 && r.sharedAlice === 6 && r.sharedBob === 6 && r.eveTrials === 3, `got A=${r.A} B=${r.B} s=${r.sharedAlice}, ${r.eveTrials} tries`) },
    { name: 'a base of order 11 still agrees', input: { p: 23, g: 2, a: 6, b: 15, attacker: false },
      check: (r) => soundAnd(r, r.order === 11 && r.generator === false, `order ${r.order}`) },
    { name: 'Eve may find a different exponent that works equally well', input: { p: 23, g: 2, a: 17, b: 4, attacker: false },
      check: (r) => soundAnd(r, r.eveExponent === 6 && r.eveExponent !== r.a, `Eve found ${r.eveExponent}`) },
    { name: 'the largest toy prime', input: { p: 167, g: 5, a: 19, b: 12, attacker: false },
      check: (r) => soundAnd(r, r.order === 166 && r.generator === true, `order ${r.order}`) },
    { name: 'every listed prime with extreme secrets', input: { p: 107, g: 21, a: 21, b: 2, attacker: false }, check: sound },
    { name: 'attacker in the middle: the two sides hold different secrets that Mallory knows', input: { p: 23, g: 5, a: 6, b: 15, attacker: true, m: 13 },
      check: (r) => (r.M === 21 && r.sharedAlice === 18 && r.sharedBob === 7 && !r.agree && r.malloryWithAlice === 18 && r.malloryWithBob === 7
        && r.sharedAlice === bigPow(5, 6 * 13, 23) && r.sharedBob === bigPow(5, 15 * 13, 23)) || `Alice ${r.sharedAlice}, Bob ${r.sharedBob}, Mallory ${r.malloryWithAlice}/${r.malloryWithBob}` },
  ],
};
