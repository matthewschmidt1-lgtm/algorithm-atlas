// Textbook RSA with toy-sized primes.
// Everything here is insecure on two counts: the primes are tiny, and no padding is used.
// The lesson says so in the summary, the simple explanation and the frames, and it shows an
// attacker factoring n. All products stay below 2^53, so plain JavaScript numbers are exact.

const PRIMES = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61];
const EXPONENTS = [3, 5, 7, 11, 13, 17, 19, 23];

function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
// Small numbers are shown as they appear on the board. Only long products get thousands separators.
const fmt = (v) => (Math.abs(v) < 10000 ? String(v) : v.toLocaleString('en-US'));

// Prime pairs whose product has the stated number of bits, for the experiment.
const PAIRS = { 6: [5, 11], 8: [11, 23], 10: [23, 43], 12: [61, 67], 14: [113, 139], 16: [241, 271], 18: [503, 521], 20: [1013, 1033], 22: [2027, 2069], 24: [4093, 4099] };
function experimentInput(bits) {
  const [p, q] = PAIRS[bits];
  const phi = (p - 1) * (q - 1);
  let e = 3;
  while (gcd(e, phi) !== 1) e += 2;
  return { p, q, e, m: 2 };
}

function run(input, t) {
  const p = Math.floor(Number(input.p)), q = Math.floor(Number(input.q));
  const e = Math.floor(Number(input.e)), m = Math.floor(Number(input.m));
  if (!isPrime(p) || !isPrime(q)) throw new Error('p and q must both be prime numbers.');
  if (p === q) throw new Error('p and q must be two different primes. If they are equal, n is a perfect square and anyone can find p by taking its square root.');
  const n = p * q;
  const phi = (p - 1) * (q - 1);
  if (n > 9e7) throw new Error('These primes are too large for this demonstration, which keeps every product small enough to compute exactly.');
  if (!(e > 1 && e < phi)) throw new Error(`e must be greater than 1 and smaller than φ = ${phi}. Choose a smaller e or larger primes.`);
  const common = gcd(e, phi);
  if (common !== 1) throw new Error(`e = ${e} and φ = ${phi} are both divisible by ${common}, so no decryption exponent d exists. Choose an e that shares no factor with φ.`);
  if (!(m >= 0 && m < n)) throw new Error(`The message must be a whole number from 0 to n − 1 = ${n - 1}. Choose a smaller message or larger primes.`);

  const WARNING = 'This is **textbook RSA with toy numbers**: insecure, and for learning only.';
  const lanes = { keys: [], sender: [], receiver: [] };
  const put = (lane, key, label, value, note, secret) => { lanes[lane].push({ key, label, value, note, secret }); };
  const legend = [{ label: 'this step', role: 'current' }, { label: 'message and its recovered copy', role: 'done' }, { label: 'worked out by an attacker', role: 'alert' }];
  // The board carries no title or legend of its own: with either, the shared stylesheet squeezes the
  // three lanes into one narrow column. The view underneath carries the legend instead.
  const board = (hot, roles) => ({
    kind: 'board',
    columns: [
      { title: 'Key generation', role: 'ink', items: lanes.keys },
      { title: 'Sender', role: 'forest', items: lanes.sender },
      { title: 'Receiver', role: 'moss', items: lanes.receiver },
    ].map((col) => ({ ...col, items: col.items.map((it) => ({ label: it.label, value: it.value, note: it.note, role: hot.includes(it.key) ? 'current' : roles[it.key] })) })),
  });
  // Default second view: who is allowed to know what.
  const ledger = (hot) => ({
    kind: 'rows', title: 'Who may know what', legend,
    rows: [
      { label: 'Public', cells: lanes.keys.filter((it) => !it.secret).map((it) => ({ t: it.value, sub: it.key, role: hot.includes(it.key) ? 'current' : 'default' })) },
      { label: 'Kept secret', cells: lanes.keys.filter((it) => it.secret).map((it) => ({ t: it.value, sub: it.key, role: hot.includes(it.key) ? 'current' : 'default' })) },
    ],
  });
  const picture = (hot = [], roles = {}, second = null) => [board(hot, roles), second ? { ...second, legend } : ledger(hot)];

  /* ---- key generation ---- */
  put('keys', 'p', 'prime p', p, 'secret', true);
  put('keys', 'q', 'prime q', q, 'secret', true);
  t.frame(() => ({
    line: 0,
    note: `RSA lets anyone lock a message with a public key, so that only the holder of the matching private key can unlock it. The receiver starts by choosing two primes in secret: **p = ${p}** and **q = ${q}**. ${WARNING} Real keys use primes of a thousand bits or more, and real systems never use RSA in this bare form.`,
    views: picture(['p', 'q']),
    vars: { p, q },
  }));
  put('keys', 'n', 'n = p × q', n, 'public', false);
  t.frame(() => ({
    line: 1,
    note: `Multiply them: **n = ${p} × ${q} = ${fmt(n)}**. This number will be public. It is called the modulus, and all later arithmetic is done "mod n": multiply, divide by n, keep the remainder. Multiplying was easy. Recovering ${p} and ${q} from ${fmt(n)} is the hard direction, and only when the primes are huge.`,
    views: picture(['n']),
    vars: { n },
  }));
  put('keys', 'φ', 'φ = (p − 1)(q − 1)', phi, 'secret', true);
  t.frame(() => ({
    line: 2,
    note: `Compute **φ = (${p} − 1) × (${q} − 1) = ${fmt(phi)}**. It counts the numbers below n that share no factor with n. Only someone who knows p and q can compute it this way, and it must stay secret.`,
    views: picture(['φ']),
    vars: { n, 'φ': phi },
  }));
  put('keys', 'e', 'public exponent e', e, 'public', false);
  t.frame(() => ({
    line: 3,
    note: `Choose the public exponent **e = ${e}**. It must share no factor with φ = ${fmt(phi)}, otherwise locking could not be undone. The next steps check that with Euclid's algorithm, and the same calculation produces the private exponent d.`,
    views: picture(['e']),
    vars: { e, 'φ': phi },
  }));

  // Extended Euclid on (φ, e), keeping only the coefficient of e.
  const trace = [['', phi, 0], ['', e, 1]];
  const euclidView = (found) => ({
    kind: 'table', title: `Extended Euclid: find d with e × d = 1 (mod φ)`,
    colLabels: ['quotient', 'remainder r', 'coefficient t', 't × e mod φ'],
    cells: trace.map(([k, r, c]) => [k, r, c, ((c * e) % phi + phi) % phi]),
    roles: Object.fromEntries(trace.flatMap((row, i) => {
      const last = i === trace.length - 1;
      const isOne = found && row[1] === 1;
      return isOne ? [[`${i},1`, 'done'], [`${i},2`, 'done']] : last ? [[`${i},0`, 'current'], [`${i},1`, 'current'], [`${i},2`, 'current'], [`${i},3`, 'current']] : [];
    })),
  });
  let r0 = phi, r1 = e, t0 = 0, t1 = 1;
  t.frame(() => ({
    line: [7, 8],
    note: `Start with two rows: φ = ${fmt(phi)} with coefficient 0, and e = ${e} with coefficient 1. In every row, the remainder equals its coefficient times e, give or take a multiple of φ. The last column checks that.`,
    views: picture(['e', 'φ'], {}, euclidView(false)),
    vars: { r0, r1 },
  }));
  while (r1 !== 0) {
    const k = Math.floor(r0 / r1);
    const r2 = r0 - k * r1, t2 = t0 - k * t1;
    t.count('division steps');
    trace.push([k, r2, t2]);
    const a0 = r0, a1 = r1, b0 = t0, b1 = t1;
    t.frame(() => ({
      line: [9, 10, 11, 12],
      note: r2 === 0
        ? `${fmt(a0)} divided by ${fmt(a1)} is ${k} with remainder **0**, so the division stops. The last non-zero remainder, ${a1}, is the greatest common divisor of e and φ. It is 1, so e is a valid choice.`
        : `${fmt(a0)} divided by ${fmt(a1)} is ${k} with remainder **${fmt(r2)}**. Do the same to the coefficients: ${b0} − ${k} × ${b1 < 0 ? `(${b1})` : b1} = **${t2}**.${r2 === 1 ? ` The remainder is now 1, so this row says ${t2} × e leaves remainder 1 when divided by φ.` : ''}`,
      views: picture(['e', 'φ'], {}, euclidView(false)),
      vars: { quotient: k, remainder: r2, t: t2 },
    }));
    r0 = r1; r1 = r2; t0 = t1; t1 = t2;
  }
  const d = ((t0 % phi) + phi) % phi;
  put('keys', 'd', 'private exponent d', d, 'secret: the private key', true);
  t.frame(() => ({
    line: [13, 4],
    note: `The coefficient beside remainder 1 is ${t0}. ${t0 < 0 ? `It is negative, so add φ: ${t0} + ${fmt(phi)} = **${fmt(d)}**.` : `So **d = ${fmt(d)}**.`} Check: ${e} × ${fmt(d)} = ${fmt(e * d)} = ${fmt((e * d - 1) / phi)} × ${fmt(phi)} + 1. This **d** is the private exponent.`,
    views: picture(['d'], {}, euclidView(true)),
    vars: { e, d, 'e × d mod φ': (e * d) % phi },
  }));

  put('sender', 'pub', 'public key (n, e)', `(${n}, ${e})`, 'received in the open');
  put('receiver', 'priv', 'private key d', d, 'never leaves the receiver');
  t.frame(() => ({
    line: 5,
    note: `The receiver publishes the pair **(n, e) = (${fmt(n)}, ${e})** and keeps d = ${fmt(d)} private. The primes and φ must also stay secret or be destroyed: anyone who learns them can repeat the steps above and get d.`,
    views: picture(['pub', 'priv', 'n', 'e']),
    vars: { n, e, d },
  }));

  /* ---- square-and-multiply, shown one exponent bit at a time ---- */
  const power = (base, exponent, lane, hotKey, title, lines) => {
    const bits = exponent.toString(2);
    const values = [];
    const view = (i) => ({
      kind: 'rows', title,
      rows: [
        { label: `Bits of ${fmt(exponent)}`, cells: [...bits].map((bit, j) => ({ t: bit, role: j === i ? 'current' : j < i ? 'done' : 'default' })) },
        { label: 'Running value', cells: values.map((v, j) => ({ t: v, sub: bits[j] === '1' ? 'square, ×' : 'square', role: j === i ? 'current' : 'done' })) },
      ],
    });
    let result = 1;
    [...bits].forEach((bit, i) => {
      const before = result;
      const squared = (result * result) % n;
      t.count('modular multiplications');
      result = squared;
      if (bit === '1') {
        result = (result * base) % n;
        t.count('modular multiplications');
      }
      values.push(result);
      const after = result;
      t.frame(() => ({
        line: lines,
        note: `Bit ${i + 1} of ${bits.length} is **${bit}**. Square the running value: ${fmt(before)} × ${fmt(before)} = ${fmt(before * before)}, which is ${fmt(squared)} mod ${fmt(n)}.${bit === '1' ? ` The bit is 1, so also multiply by ${fmt(base)}: ${fmt(squared)} × ${fmt(base)} = ${fmt(squared * base)}, which is **${fmt(after)}** mod ${fmt(n)}.` : ' The bit is 0, so there is no extra multiplication.'}`,
        views: picture([hotKey], lane, view(i)),
        vars: { bit, 'running value': after },
      }));
    });
    return result;
  };

  /* ---- encryption ---- */
  put('sender', 'm', 'message m', m, 'what the sender wants to say');
  t.frame(() => ({
    line: 15,
    note: `The sender's message is the number **m = ${fmt(m)}**. To lock it, the sender computes m^e mod n = ${fmt(m)}^${e} mod ${fmt(n)}, using only the public key. The power is built up one bit of the exponent at a time, by repeated squaring, so that no number ever grows beyond n × n.`,
    views: picture(['m', 'pub'], { m: 'done' }),
    vars: { m, e, n },
  }));
  const c = power(m, e, { m: 'done' }, 'pub', `Encrypt: ${fmt(m)}^${e} mod ${fmt(n)} by square-and-multiply`, [15, 20, 21, 22]);
  put('sender', 'c', 'ciphertext c = m^e mod n', c, 'sent in the open');
  put('receiver', 'gotc', 'received c', c);
  const plainPower = m >= 2 && m ** e < n;
  const fixed = c === m;
  t.frame(() => ({
    line: 15,
    note: `The ciphertext is **c = ${fmt(c)}**. The sender transmits it, and anyone may see it.${fixed ? ` Notice that c equals m. The messages 0, 1 and n − 1 always encrypt to themselves, because 0, 1 and −1 are unchanged by an odd power and e is always odd. That is one of several reasons real systems never encrypt a raw message.` : ''}${plainPower ? ` Notice that ${m}^${e} = ${fmt(m ** e)} is smaller than n, so no remainder was ever taken. The ciphertext is an ordinary power, and anyone can undo it with an ordinary root. Small messages are one reason padding is essential.` : ''}`,
    views: picture(['c', 'gotc'], { m: 'done' }),
    vars: { m, c },
  }));

  /* ---- decryption ---- */
  t.frame(() => ({
    line: 16,
    note: `The receiver unlocks it with the private exponent: c^d mod n = ${fmt(c)}^${fmt(d)} mod ${fmt(n)}. The exponent is large, but square-and-multiply needs only one or two multiplications for each of its ${d.toString(2).length} bits.`,
    views: picture(['gotc', 'priv'], { m: 'done' }),
    vars: { c, d, n },
  }));
  const decrypted = power(c, d, { m: 'done' }, 'priv', `Decrypt: ${fmt(c)}^${fmt(d)} mod ${fmt(n)} by square-and-multiply`, [16, 20, 21, 22]);
  put('receiver', 'back', 'm = c^d mod n', decrypted, 'the original message');
  t.frame(() => ({
    line: 16,
    note: `The result is **${fmt(decrypted)}**, the original message. It works because e × d leaves remainder 1 when divided by φ, which makes raising to the power e and then to the power d bring every number back to itself mod n.`,
    views: picture(['back'], { m: 'done', back: 'done' }),
    vars: { m, c, 'decrypted': decrypted },
  }));
  if (decrypted !== m) throw new Error('Internal error: decryption did not return the message.');

  /* ---- the attacker's side: factor n by trial division ---- */
  let factor = 2;
  for (;;) {
    t.count('trial divisions');
    if (n % factor === 0) break;
    factor++;
  }
  const trials = factor - 1;
  const other = n / factor;
  t.frame(() => ({
    line: [1, 2, 4],
    note: `Now take an attacker's side. She knows only n = ${fmt(n)}, e = ${e} and c = ${fmt(c)}. She divides n by 2, 3, 4 and so on. After ${fmt(trials)} ${trials === 1 ? 'try' : 'tries'} she finds ${fmt(n)} = ${factor} × ${other}. With the two primes she computes φ and d exactly as the receiver did, and decrypts. A key this small is broken at once. Security rests entirely on n being too large to factor.`,
    views: picture([], { m: 'done', back: 'done' }, { kind: 'rows', title: 'An attacker who knows only the public values', rows: [
      { label: 'She sees', cells: [{ t: n, sub: 'n' }, { t: e, sub: 'e' }, { t: c, sub: 'c' }] },
      { label: 'She computes', cells: [{ t: factor, sub: 'factor', role: 'alert' }, { t: other, sub: 'factor', role: 'alert' }, { t: phi, sub: 'φ', role: 'alert' }, { t: d, sub: 'd', role: 'alert' }, { t: m, sub: 'm', role: 'alert' }] },
    ] }),
    vars: { 'factors found': `${factor} × ${other}` },
  }));
  t.frame(() => ({
    line: null,
    note: `Summary. Public: (n, e) = (${fmt(n)}, ${e}). Private: d = ${fmt(d)}. The message ${fmt(m)} became ${fmt(c)} and came back as ${fmt(decrypted)}. ${WARNING} Even with a huge n, RSA used exactly like this is unsafe: the same message always gives the same ciphertext, so anyone can test a guess by encrypting it. Real systems add random padding (OAEP) and use keys of 2048 bits or more.`,
    views: picture([], { m: 'done', back: 'done' }),
    vars: { n, e, d, m, c },
  }));

  return { p, q, n, phi, e, d, m, c, decrypted, coefficient: t0, attack: { factor, other, trials, m } };
}

// Independent reference for the tests: exact big-integer powers, no square-and-multiply, no Euclid.
const bigPow = (base, exponent, mod) => Number((BigInt(base) ** BigInt(exponent)) % BigInt(mod));
function sound(r) {
  if (r.n !== r.p * r.q) return 'n is not p × q';
  if (r.phi !== (r.p - 1) * (r.q - 1)) return 'φ is not (p − 1)(q − 1)';
  if (!(r.d > 0 && r.d < r.phi) || (r.e * r.d) % r.phi !== 1) return `d = ${r.d} is not the inverse of e modulo φ`;
  if (r.c !== bigPow(r.m, r.e, r.n)) return `ciphertext should be ${bigPow(r.m, r.e, r.n)}, got ${r.c}`;
  if (bigPow(r.c, r.d, r.n) !== r.m || r.decrypted !== r.m) return 'decryption did not return the message';
  if (r.attack.factor * r.attack.other !== r.n || r.attack.factor !== Math.min(r.p, r.q) || r.attack.trials !== r.attack.factor - 1) return 'the trial-division attack is wrong';
  return true;
}
// Passes only if the run is sound and the extra condition holds.
const soundAnd = (r, condition, message) => { const s = sound(r); return s !== true ? s : condition || message; };

export default {
  meta: {
    id: 'rsa',
    name: 'RSA',
    aliases: ['Rivest-Shamir-Adleman', 'RSA encryption', 'RSA cryptosystem', 'public-key encryption', 'textbook RSA'],
    kind: 'algorithm',
    discipline: 'cryptography',
    alsoIn: [
      { id: 'mathematics', why: 'It is applied number theory: Euclid\'s algorithm, Euler\'s theorem and modular exponentiation, with security resting on the difficulty of factoring.' },
    ],
    subfield: 'Public-key encryption',
    family: 'Factoring-based cryptography',
    lab: 'cryptography',
    year: 1978,
    authors: 'Ronald L. Rivest, Adi Shamir and Leonard Adleman',
    summary: 'Public-key encryption from two secret primes: anyone can encrypt with (n, e), only the holder of d can decrypt. Shown as insecure textbook RSA with toy primes.',
    difficulty: 'advanced',
    order: 850,
    paradigms: ['number-theoretic'],
    randomized: false,
    approximate: false,
    time: { best: 'O(k²) bit operations to encrypt with a small fixed e', average: 'O(k³) bit operations to decrypt', worst: 'O(k³) bit operations to decrypt', class: 'cubic' },
    space: { worst: 'O(k) bits: a few numbers the size of n', class: 'linear' },
    tags: {
      problems: ['send a secret message', 'encrypt with a public key', 'digital signature', 'keep data private', 'prove who sent a message'],
      techniques: ['modular exponentiation', 'extended Euclidean algorithm', 'prime factorization', 'trapdoor function', 'public-key cryptography'],
      applications: ['security', 'networking', 'distributed systems'],
    },
    prerequisites: ['modular-exponentiation', 'euclidean-algorithm', 'concept:modular-arithmetic', 'concept:prime-numbers', 'concept:public-key-cryptography'],
  },

  bigIdea: {
    simple: 'RSA is a way to send a secret to someone you have never met, without agreeing on a password first. Picture a padlock that anyone can snap shut but only one key can open. The receiver hands out open padlocks to everybody and keeps the key at home. To send a secret, you put it in a box, snap a padlock on it and post it. Not even you can open it again. Only the receiver can. RSA builds this padlock out of numbers. The receiver secretly picks two prime numbers, which are numbers such as 7 or 13 that nothing divides evenly except 1 and themselves. Multiplying the two primes gives a number that is made public. It acts as the padlock. The primes themselves stay secret and act as the key. Multiplying two primes is quick. Finding them again from the answer is extremely slow when the primes are hundreds of digits long. On this page the primes are tiny, so that you can follow every step. Numbers this small can be cracked at once. They are for learning only, and you should never build your own version to protect anything real.',
    what: 'RSA is a public-key cryptosystem. The receiver chooses two secret primes $p$ and $q$ and publishes their product $n$ together with an exponent $e$. From the primes the receiver also computes a private exponent $d$. A message $m$ is encrypted as $c = m^e \\bmod n$ and decrypted as $m = c^d \\bmod n$, each computed by [fast modular exponentiation](#/algorithm/modular-exponentiation). **This lesson shows textbook RSA with toy primes. The small size and the absence of padding each make it insecure. It is for learning only.**',
    why: 'In 1976 Diffie and Hellman described what public-key encryption and digital signatures would do, but had no way to build them. In 1977 Ron Rivest, Adi Shamir and Leonard Adleman at MIT found one: a function that anyone can compute in one direction and that only someone holding a secret, the factorization of $n$, can reverse. It was the first practical public-key cryptosystem that could both encrypt and sign.',
    when: 'In practice RSA is used through vetted libraries for two jobs: verifying digital signatures, and wrapping a short random key that then encrypts the real data with a much faster symmetric cipher. It is not used to encrypt long messages directly, and never without padding. For agreeing on session keys, [Diffie-Hellman](#/algorithm/diffie-hellman) exchanges have largely replaced it. Many new systems also prefer elliptic-curve signatures, which have smaller keys. Do not write your own RSA for real use.',
    interesting: 'The two exponents undo each other in either order. Applying the public exponent and then the private one gives encryption. Applying the private exponent first gives a value that anyone can check with the public key but only the key holder could have produced, which is the idea behind a digital signature. One piece of number theory provides both secrecy and proof of origin.',
    where: 'RSA signatures appear in many of the certificates that identify websites to browsers, in signed software updates, in SSH keys and in OpenPGP email encryption.',
    analogy: {
      title: 'An open padlock that anyone can snap shut',
      text: 'The receiver makes a padlock and a key, keeps the key, and gives copies of the open padlock to anyone who asks. A sender puts a message in a box and snaps the padlock shut. From that moment nobody can open the box, including the sender, except the person with the key. The padlock can be handed around freely because closing it teaches you nothing about how to open it.',
      limits: 'A steel padlock is opened by cutting it. The RSA padlock is opened by arithmetic: anyone who can split the public number into its two primes can make the key. Nobody has proved that this splitting must be slow, and a large enough quantum computer could do it quickly. A padlock also behaves the same way every time, and for a padlock that is fine. For RSA it is a weakness: locking the same message twice gives the same result, so a spy who can guess the message can lock her guess and compare. Real systems mix random padding into the message before locking it. The picture also leaves out how a sender knows the padlock really belongs to the receiver, which needs certificates.',
    },
  },

  example: {
    setup: 'The receiver picks the primes 3 and 11. Their product is 33, which is made public. From the primes the receiver computes (3 − 1) × (11 − 1) = 20, and keeps it secret. The public exponent is 3, which shares no factor with 20. The private exponent is 7, because 3 × 7 = 21, which is one more than 20. "Mod 33" means: divide by 33 and keep the remainder. These numbers are far too small to be safe and are only for following the steps. The message is the number 2.',
    steps: [
      'The sender raises the message to the public exponent: 2 to the power 3 is 8. That is already below 33, so the remainder is 8. The ciphertext is 8.',
      'The receiver must raise 8 to the private exponent 7, mod 33. Doing it in small steps keeps the numbers small. First 8 × 8 = 64, and 64 − 33 = 31. So 8 squared leaves 31.',
      'Multiply by 8 again: 31 × 8 = 248 = 7 × 33 + 17. So 8 to the power 3 leaves 17.',
      'Square that: 17 × 17 = 289 = 8 × 33 + 25. So 8 to the power 6 leaves 25.',
      'Multiply by 8 once more: 25 × 8 = 200 = 6 × 33 + 2. So 8 to the power 7 leaves 2.',
    ],
    result: 'The receiver recovers 2, the original message. Notice that the ciphertext 8 was simply 2 × 2 × 2, with no remainder taken, so anyone could have undone it with a cube root. That is one of several reasons why RSA is never used in this bare form, and why real systems pad the message with random data first.',
    tryInput: { p: 3, q: 11, e: 3, m: 2 },
  },

  terms: [
    { term: 'Encrypt', meaning: 'To scramble a message so that only the intended receiver can read it.' },
    { term: 'Ciphertext', meaning: 'The scrambled form of a message.' },
    { term: 'Prime number', meaning: 'A whole number greater than 1 that nothing divides evenly except 1 and itself.' },
    { term: 'Factoring', meaning: 'Finding the primes that multiply together to give a number. For 33 the answer is 3 and 11.' },
    { term: 'Mod', meaning: 'Short for modulo. "Mod 33" means: divide by 33 and keep only the remainder.' },
    { term: 'Public key', meaning: 'The pair of numbers (n, e) that anyone may know and use to encrypt.' },
    { term: 'Private key', meaning: 'The number d that only the receiver knows and that decrypts.' },
    { term: 'Modulus', meaning: 'The public number n, the product of the two secret primes.' },
    { term: 'Padding', meaning: 'Random data mixed into a message before encryption, so that the same message never encrypts the same way twice.' },
    { term: 'Digital signature', meaning: 'A value computed with a private key that anyone can check with the public key, proving who produced a message.' },
  ],

  takeaway: 'Multiplying two large primes is easy and undoing it is hard, so the product can be a public lock while the primes stay the private key.',

  viz: {
    describe: 'A board with three lanes: key generation, the sender and the receiver. Cards appear as the steps proceed: the secret primes, their product n, the value φ, the public exponent e and the private exponent d, then the public key and message on the sender\'s side, the ciphertext, and the recovered message on the receiver\'s side. The card for the current step is terracotta, and the message and its recovered copy are forest green. Under the board a second view changes with the phase: a table of the extended Euclidean algorithm while d is computed, strips showing the bits of the exponent and the running value during each square-and-multiply, and finally what an attacker computes after factoring n, in brick red. All numbers are toy-sized and insecure.',
    inputs: [
      { id: 'p', type: 'select', label: 'Prime p (toy-sized, insecure)', default: 61, options: PRIMES.map((v) => ({ value: v, label: String(v) })) },
      { id: 'q', type: 'select', label: 'Prime q (must differ from p)', default: 53, options: PRIMES.map((v) => ({ value: v, label: String(v) })) },
      { id: 'e', type: 'select', label: 'Public exponent e', default: 17, options: EXPONENTS.map((v) => ({ value: v, label: String(v) })),
        help: 'Must share no factor with φ = (p − 1)(q − 1) and be smaller than it.' },
      { id: 'm', type: 'number', label: 'Message m (a whole number below n)', default: 65, min: 0, integer: true,
        help: 'Real systems turn a short key or a hash into a number, pad it with random data, and encrypt that.' },
    ],
    presets: [
      { label: 'A classic toy key', values: { p: 61, q: 53, e: 17, m: 65 } },
      { label: 'The worked example', values: { p: 3, q: 11, e: 3, m: 2 } },
      { label: 'A small message that never wraps around', values: { p: 61, q: 53, e: 7, m: 2 } },
      { label: 'A message that encrypts to itself', values: { p: 61, q: 53, e: 17, m: 3232 } },
      { label: 'Another key', values: { p: 47, q: 59, e: 17, m: 1234 } },
    ],
    tryThis: [
      'Load "A classic toy key" and change only the message from 65 to 66. The ciphertext changes completely. Then run 65 again: you get exactly the same ciphertext as before. An eavesdropper who suspects the message is 65 can check that guess with the public key.',
      'Set p = 61, q = 53 and choose e = 3 or e = 5. The run stops with an error, because φ = 3120 is divisible by both. Read the message, then pick an e that works.',
      'Load "A small message that never wraps around". The ciphertext 128 is just 2 to the power 7. Raise the message until m to the power e first exceeds n and watch the ciphertext stop being an ordinary power.',
    ],
    run,
    report: (r, c) => `Keys: n = ${r.p} × ${r.q} = ${r.n}, φ = ${r.phi}, public exponent e = ${r.e}, private exponent d = ${r.d}.\nEncrypt: ${r.m}^${r.e} mod ${r.n} = ${r.c}\nDecrypt: ${r.c}^${r.d} mod ${r.n} = ${r.decrypted}\n${c['modular multiplications'] || 0} modular multiplications to encrypt and decrypt. ${c['division steps'] || 0} division steps to find d.\nAttacker: factored n = ${r.attack.factor} × ${r.attack.other} after ${r.attack.trials} trial divisions.\nTEXTBOOK RSA WITH TOY PRIMES: insecure, for learning only.`,
    experiment: {
      title: 'An attacker\'s trial divisions as n grows',
      note: 'Each point is a real run with two primes of nearly equal size whose product n has the stated number of bits. The attacker divides n by 2, 3, 4 and so on until a factor appears, which takes about √n tries: every 2 extra bits double her work. The key holder\'s work to decrypt grows only in proportion to the number of bits. Far better factoring methods than trial division are known, so real keys need 2048 bits or more, not the handful shown here.',
      metric: 'trial divisions',
      metricLabel: 'Trial divisions to factor n',
      sizeLabel: 'Size of n (bits)',
      sizes: [6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
      variants: [{ id: 'trial', label: 'Factoring by trial division' }],
      input: (bits) => experimentInput(bits),
      theory: [
        { label: 'about √n = 2^(bits ÷ 2)', fn: (bits) => 2 ** (bits / 2) },
        { label: 'multiplications to decrypt, at most 2 × bits', fn: (bits) => 2 * bits, reference: true },
      ],
    },
  },

  logic: {
    intuition: 'Working modulo $n = pq$, raising a number to the power $e$ scrambles it, and raising the result to a matching power $d$ unscrambles it, because exponents behave as if they were reduced modulo $\\varphi = (p-1)(q-1)$. If $ed$ leaves remainder 1 modulo $\\varphi$, then $m^{ed}$ is $m^1$. Finding $d$ from $e$ is easy with the [Euclidean algorithm](#/algorithm/euclidean-algorithm) if you know $\\varphi$, and knowing $\\varphi$ is as good as knowing $p$ and $q$. So the factorization of $n$ is a trapdoor: with it, reversing is easy. Without it, nobody knows how.',
    steps: [
      'Choose two different large primes `p` and `q` at random and keep them secret.',
      'Compute `n = p × q`. This is the public modulus.',
      'Compute `φ = (p − 1) × (q − 1)`.',
      'Choose a public exponent `e` between 1 and `φ` that shares no factor with `φ`.',
      'Use the extended Euclidean algorithm to find `d` with `e × d ≡ 1 (mod φ)`. Publish `(n, e)` and keep `d`.',
      'To encrypt a number `m` smaller than `n`, compute `c = m^e mod n` by square-and-multiply.',
      'To decrypt, compute `m = c^d mod n` the same way.',
    ],
    pseudocode: [
      'rsa_keygen(p, q, e):',
      '  n ← p × q',
      '  φ ← (p − 1) × (q − 1)',
      '  require gcd(e, φ) = 1',
      '  d ← inverse(e, φ)',
      '  public key (n, e), private key d',
      '',
      'inverse(e, φ):  (extended Euclid)',
      '  (r0, r1) ← (φ, e); (t0, t1) ← (0, 1)',
      '  while r1 ≠ 0:',
      '    k ← r0 div r1',
      '    (r0, r1) ← (r1, r0 − k × r1)',
      '    (t0, t1) ← (t1, t0 − k × t1)',
      '  return t0 mod φ  (needs r0 = 1)',
      '',
      'encrypt(m): c ← power(m, e, n)',
      'decrypt(c): m ← power(c, d, n)',
      '',
      'power(base, exponent, n):  (square-and-multiply)',
      '  result ← 1',
      '  for each bit of exponent, from the left:',
      '    result ← result × result mod n',
      '    if the bit is 1: result ← result × base mod n',
      '  return result',
    ],
    decisions: [
      { title: 'How large should the primes be?', text: 'Large enough that the best known factoring method cannot split n. Current guidance asks for an n of at least 2048 bits, so each prime has about 1024 bits. The primes must be chosen at random, be of similar size and not be too close together.' },
      { title: 'Which public exponent?', text: 'Almost everyone uses 65537. It is prime, so it rarely shares a factor with φ, and it has only two 1 bits, so encrypting and verifying take 17 multiplications. Very small exponents such as 3 are safe only with correct padding and have a history of practical attacks.' },
      { title: 'φ or λ?', text: 'This lesson uses Euler\'s φ = (p − 1)(q − 1), as the original paper did. Modern standards compute d modulo λ = lcm(p − 1, q − 1), which divides φ and gives a smaller d that works just as well.' },
      { title: 'How is the message prepared?', text: 'Never as a raw number. For encryption the message, usually a random symmetric key, is padded with OAEP. For signatures a hash of the message is padded with PSS. Padding adds randomness and structure that defeat the attacks on textbook RSA.' },
      { title: 'How is decryption made faster?', text: 'The key holder knows p and q, so it can compute the result modulo p and modulo q separately and combine the two with the Chinese remainder theorem. That is about four times faster than one exponentiation modulo n.' },
    ],
    invariants: [
      'In the extended Euclidean algorithm, every remainder r satisfies r ≡ t × e (mod φ) for its coefficient t.',
      'In square-and-multiply, after processing the leading bits of the exponent, the running value equals the base raised to the number those bits spell, mod n.',
      'e × d ≡ 1 (mod φ), so decrypting an encrypted message returns the message for every m from 0 to n − 1.',
    ],
    edgeCases: [
      'p = q: n is a perfect square, its square root reveals p, and the formula for φ used here is wrong.',
      'e shares a factor with φ: no inverse d exists, and encryption is not reversible.',
      'm ≥ n: the message is reduced mod n and information is lost. Messages must be smaller than n.',
      'm = 0, 1 or n − 1: the ciphertext equals the message.',
      'm^e < n: no reduction happens and the ciphertext is an ordinary power, undone by an ordinary root.',
      'm shares a factor with n: decryption still works, but such a ciphertext reveals a factor of n through a greatest common divisor. With real key sizes the chance of meeting one by accident is negligible.',
    ],
    correctness: 'Since $ed \\equiv 1 \\pmod{\\varphi}$, write $ed = 1 + k(p-1)(q-1)$. If $p$ does not divide $m$, Fermat\'s little theorem gives $m^{p-1} \\equiv 1 \\pmod p$, so $m^{ed} = m \\cdot (m^{p-1})^{k(q-1)} \\equiv m \\pmod p$. If $p$ divides $m$, both sides are $0$ modulo $p$. The same holds modulo $q$. So $m^{ed} - m$ is divisible by both $p$ and $q$, which are different primes, and therefore by $n = pq$. Hence $c^d \\equiv m^{ed} \\equiv m \\pmod n$ for every $m$, and since $0 \\le m < n$ the result is exactly $m$. This shows that decryption works. It says nothing about security, which is an assumption about the difficulty of factoring and of the RSA problem.',
    mistakes: [
      'Computing d as the inverse of e modulo n instead of modulo φ.',
      'Returning a negative coefficient from the extended Euclidean algorithm without reducing it mod φ.',
      'Computing m^e as a full integer before reducing. The number has millions of digits for real sizes. Reduce after every multiplication.',
      'Encrypting raw messages without padding, or with home-made padding.',
      'Generating primes with a weak random number generator. Keys that share a prime can be broken with a single greatest-common-divisor computation.',
      'Using code like the samples on this page for anything real. They leak the private exponent through timing and have none of the protections a library provides.',
    ],
  },

  code: {
    sample: {
      input: 'The toy key p = 61, q = 53, e = 17 and the message 65. Textbook RSA with insecure parameters, for illustration only.',
      expected: 'n = 3233, phi = 3120\npublic key (n, e) = (3233, 17)\nprivate key d = 2753\n65 encrypts to 2790\n2790 decrypts to 65',
    },
    python: {
      source: `def inverse(e, phi):
    """Extended Euclid: the d with e * d = 1 (mod phi)."""
    r0, r1 = phi, e
    t0, t1 = 0, 1
    while r1 != 0:
        k = r0 // r1
        r0, r1 = r1, r0 - k * r1
        t0, t1 = t1, t0 - k * t1
    if r0 != 1:
        raise ValueError("e shares a factor with phi, so it has no inverse")
    return t0 % phi


def power(base, exponent, n):
    """Square-and-multiply, reading the exponent's bits from the left."""
    result = 1
    for bit in bin(exponent)[2:]:
        result = result * result % n
        if bit == "1":
            result = result * base % n
    return result


# Toy primes and no padding: insecure. For illustration only.
p, q, e = 61, 53, 17
n = p * q
phi = (p - 1) * (q - 1)
d = inverse(e, phi)

message = 65
cipher = power(message, e, n)
plain = power(cipher, d, n)

print(f"n = {n}, phi = {phi}")
print(f"public key (n, e) = ({n}, {e})")
print(f"private key d = {d}")
print(f"{message} encrypts to {cipher}")
print(f"{cipher} decrypts to {plain}")`,
      notes: [
        { line: 8, text: 'The coefficient t follows the remainders step for step. Each remainder equals its t times e, up to a multiple of phi.' },
        { line: 11, text: 'The coefficient can come out negative. Reducing it mod phi gives the positive d. Python\'s `%` already returns a non-negative result here.' },
        { line: 18, text: 'Reduce after every multiplication. Without this the intermediate numbers would have thousands of digits even for this toy key.' },
        { line: 28, text: 'Computing d needs phi, and phi needs p and q. That is the trapdoor: the public key (n, e) alone does not give you d unless you can factor n.' },
        { line: 31, text: 'Textbook encryption: the bare power. A real system would first pad the message with random data (OAEP).' },
      ],
    },
    javascript: {
      source: `// Extended Euclid: the d with e * d = 1 (mod phi).
function inverse(e, phi) {
  let r0 = phi, r1 = e;
  let t0 = 0, t1 = 1;
  while (r1 !== 0) {
    const k = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - k * r1];
    [t0, t1] = [t1, t0 - k * t1];
  }
  if (r0 !== 1) throw new Error("e shares a factor with phi, so it has no inverse");
  return ((t0 % phi) + phi) % phi;
}

// Square-and-multiply, reading the exponent's bits from the left.
// Products stay below 3233 * 3233 here. For real sizes you would need BigInt.
function power(base, exponent, n) {
  let result = 1;
  for (const bit of exponent.toString(2)) {
    result = (result * result) % n;
    if (bit === "1") result = (result * base) % n;
  }
  return result;
}

// Toy primes and no padding: insecure. For illustration only.
const p = 61, q = 53, e = 17;
const n = p * q;
const phi = (p - 1) * (q - 1);
const d = inverse(e, phi);

const message = 65;
const cipher = power(message, e, n);
const plain = power(cipher, d, n);

console.log("n = " + n + ", phi = " + phi);
console.log("public key (n, e) = (" + n + ", " + e + ")");
console.log("private key d = " + d);
console.log(message + " encrypts to " + cipher);
console.log(cipher + " decrypts to " + plain);`,
    },
    cpp: {
      source: `#include <cstdint>
#include <iostream>
#include <stdexcept>

// Extended Euclid: the d with e * d = 1 (mod phi).
std::int64_t inverse(std::int64_t e, std::int64_t phi) {
    std::int64_t r0 = phi, r1 = e;
    std::int64_t t0 = 0, t1 = 1;
    while (r1 != 0) {
        const std::int64_t k = r0 / r1;
        const std::int64_t r2 = r0 - k * r1;
        const std::int64_t t2 = t0 - k * t1;
        r0 = r1; r1 = r2;
        t0 = t1; t1 = t2;
    }
    if (r0 != 1) throw std::invalid_argument("e shares a factor with phi, so it has no inverse");
    return ((t0 % phi) + phi) % phi;
}

// Square-and-multiply, reading the exponent's bits from the left.
std::int64_t power(std::int64_t base, std::int64_t exponent, std::int64_t n) {
    std::int64_t result = 1;
    for (int i = 62; i >= 0; --i) {
        result = result * result % n;
        if ((exponent >> i) & 1) result = result * base % n;
    }
    return result;
}

int main() {
    // Toy primes and no padding: insecure. For illustration only.
    const std::int64_t p = 61, q = 53, e = 17;
    const std::int64_t n = p * q;
    const std::int64_t phi = (p - 1) * (q - 1);
    const std::int64_t d = inverse(e, phi);

    const std::int64_t message = 65;
    const std::int64_t cipher = power(message, e, n);
    const std::int64_t plain = power(cipher, d, n);

    std::cout << "n = " << n << ", phi = " << phi << "\\n";
    std::cout << "public key (n, e) = (" << n << ", " << e << ")\\n";
    std::cout << "private key d = " << d << "\\n";
    std::cout << message << " encrypts to " << cipher << "\\n";
    std::cout << cipher << " decrypts to " << plain << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Let k be the number of bits of n. Every operation is built from multiplications of k-bit numbers modulo n. Encrypting with a small public exponent takes a handful of them. Decrypting with d, which has about k bits, takes between k and 2k. Finding d is a run of the Euclidean algorithm, which is fast. The attacker\'s task, factoring n, has no known efficient method on a classical computer, and that gap is the entire basis of the system.',
    cases: [
      { case: 'Encrypt or verify', time: 'O(k²) bit operations', when: 'The public exponent is small and fixed (65537 needs 17 modular multiplications), with schoolbook multiplication.' },
      { case: 'Decrypt or sign', time: 'O(k³) bit operations', when: 'About k squarings and up to k multiplications of k-bit numbers. The Chinese remainder theorem cuts the constant by about four.' },
      { case: 'Key generation', time: 'Dominated by finding two primes', when: 'Random candidates are tested for primality until two primes are found. The Euclid step for d takes O(k) divisions.' },
      { case: 'Attack by trial division', time: 'About √n = 2^(k/2) divisions', when: 'What this page shows. Hopeless beyond toy sizes.' },
      { case: 'Attack by the number field sieve', time: 'Sub-exponential in k', when: 'The best known classical factoring method. It is why n needs thousands of bits, not hundreds.' },
      { case: 'Attack by Shor\'s algorithm', time: 'Polynomial in k', when: 'Requires a large, error-corrected quantum computer, which does not exist at the time of writing.' },
    ],
    space: 'A few numbers of k bits: the modulus, the exponents and a running value. Messages and ciphertexts are k bits each.',
    memory: 'Key holders usually store p, q and a few precomputed values alongside d, to use the Chinese remainder theorem. That stored material is as sensitive as d.',
    tradeoffs: 'Larger keys are safer and slower: doubling k makes private-key operations roughly eight times as expensive. RSA public-key operations are fast and private-key operations slow, the opposite of some elliptic-curve schemes, which makes RSA convenient where verification is frequent and signing is rare. Because of the cost, RSA only ever wraps a short key or signs a hash. The bulk of the data is handled by symmetric ciphers.',
    assumptions: [
      'The numbers on this page are toy-sized. The asymptotic statements describe real sizes, where k is 2048 or more.',
      'Bit-operation counts assume schoolbook multiplication, which costs O(k²) for k-bit numbers.',
      'Security assumes that factoring n is infeasible and, more precisely, that computing e-th roots modulo n is infeasible without the factorization (the RSA assumption). Neither is proven.',
      'Factoring n breaks RSA. Whether RSA can be broken without factoring n is not known.',
      'The chart counts divisions by the simplest possible attacker. It shows the shape of the gap, not the cost of a real attack.',
    ],
  },

  tradeoffs: {
    excels: [
      'Digital signatures that are quick to verify.',
      'Encrypting a short secret, such as a symmetric key, to someone whose public key you know.',
      'Interoperability: it is supported almost everywhere and thoroughly studied.',
    ],
    struggles: [
      'Long messages. It can only handle numbers smaller than n, and it is thousands of times slower than symmetric encryption.',
      'Constrained devices, where 2048-bit arithmetic and large keys are costly compared with elliptic curves.',
      'Forward secrecy. If RSA is used to transport session keys, one stolen private key decrypts every recorded session.',
      'A future with large quantum computers.',
    ],
    pitfalls: [
      'No padding or flawed padding: deterministic ciphertexts, forgeable signatures and attacks that recover messages by sending many modified ciphertexts.',
      'Poor randomness in prime generation, producing keys that share a factor with other keys.',
      'Side channels: decryption time, power use or error messages that depend on secret values.',
      'Primes that are too close together or too small, which specialized factoring methods exploit.',
    ],
    misunderstandings: [
      '"RSA has been proven secure." It has not. Its security rests on the belief that factoring large numbers is infeasible, which decades of effort have failed to disprove. That is evidence, not proof.',
      '"The formula m^e mod n is all there is to RSA." That is textbook RSA, and it is broken in several ways whatever the key size. Secure RSA is the formula plus a carefully designed padding scheme.',
      '"RSA encrypts files and messages." In real systems RSA handles only a short key or a hash. A symmetric cipher encrypts the data.',
      '"A bigger public exponent is safer." The security does not come from e, which is public. It comes from the size of n and from correct padding.',
    ],
    constraints: [
      'Keys below 2048 bits are no longer considered acceptable.',
      'Standards specify the exact padding (OAEP for encryption, PSS for signatures) and how keys are generated and stored.',
      'Migration to quantum-resistant algorithms is under way for long-lived secrets.',
    ],
    alternatives: [
      { id: 'diffie-hellman', name: 'Diffie-Hellman Key Exchange', when: 'Both sides are online and want a fresh shared key with forward secrecy. This has replaced RSA key transport in TLS 1.3.' },
      { name: 'Elliptic-curve signatures (ECDSA, Ed25519)', when: 'Smaller keys and signatures and faster signing matter more than fast verification.' },
      { name: 'Post-quantum schemes (ML-KEM, ML-DSA)', when: 'The data must stay secret, or the signatures trustworthy, in a future with large quantum computers.' },
      { name: 'Symmetric encryption with a pre-shared key', when: 'The two parties already share a secret. It is far faster and needs none of this machinery.' },
    ],
    comparison: {
      columns: ['', 'RSA', 'Diffie-Hellman', 'Symmetric cipher'],
      rows: [
        ['What it provides', 'Encryption and signatures', 'A shared secret', 'Encryption with a shared key'],
        ['Keys needed in advance', 'The receiver\'s public key', 'None', 'A shared secret key'],
        ['Hard problem relied on', 'Factoring (RSA problem)', 'Discrete logarithm', 'None of this kind'],
        ['Speed', 'Slow, especially private-key operations', 'Slow, once per session', 'Fast'],
        ['Broken by a large quantum computer', 'Yes', 'Yes', 'No, with long enough keys'],
      ],
    },
  },

  applications: [
    { title: 'Certificates and signatures on the web', status: 'established', text: 'Many of the certificates that identify websites carry RSA public keys and RSA signatures. A browser verifies the chain of signatures before trusting a server. TLS 1.3 no longer uses RSA to transport session keys, but RSA signatures remain in wide use.' },
    { title: 'Signed software and updates', status: 'established', text: 'Operating systems and package managers verify a digital signature before installing software. RSA is one of the commonly used signature algorithms for this.' },
    { title: 'SSH and OpenPGP', status: 'established', text: 'SSH supports RSA keys for identifying servers and users, and OpenPGP supports RSA for signing messages and for encrypting the key that protects a message.' },
    { title: 'Hybrid encryption', status: 'established', text: 'To send a large file to the holder of an RSA key, software generates a random symmetric key, encrypts the file with it, and encrypts only that short key with RSA and OAEP padding.' },
  ],

  connections: [
    { to: 'modular-exponentiation', type: 'prerequisite', why: 'Encryption and decryption are each a single modular power, feasible only because square-and-multiply needs a number of multiplications proportional to the bit length of the exponent.' },
    { to: 'euclidean-algorithm', type: 'prerequisite', why: 'The private exponent is the modular inverse of the public one, computed by the extended form of Euclid\'s algorithm, and the same algorithm checks that e and φ share no factor.' },
    { to: 'diffie-hellman', type: 'same-problem', why: 'Both establish secrecy between strangers using modular powers that are easy to compute and hard to reverse. RSA relies on factoring and can also sign, while Diffie-Hellman relies on discrete logarithms and gives forward secrecy.' },
    { to: 'miller-rabin', type: 'related', why: 'Key generation needs large random primes, found by testing random candidates with a fast probabilistic primality test.' },
    { to: 'shors-algorithm', type: 'advanced', why: 'Shor\'s quantum algorithm factors n in polynomial time by finding the period of modular powers, which would recover every RSA private key.' },
    { to: 'grovers-search', type: 'related', why: 'Grover\'s algorithm speeds up unstructured search only quadratically, which weakens symmetric keys but can be offset by doubling their length. RSA faces the much stronger threat of Shor\'s algorithm, which exploits its number-theoretic structure.' },
    { to: 'sha-256', type: 'related', why: 'An RSA signature is computed on a hash of the message, not on the message itself, so signing depends on a collision-resistant hash function.' },
    { to: 'concept:one-way-function', type: 'prerequisite', why: 'Raising to the power e modulo n is easy to compute and believed hard to invert, except for someone who holds the trapdoor: the factorization of n.' },
    { to: 'concept:public-key-cryptography', type: 'prerequisite', why: 'RSA is the standard example of a system with separate public and private keys.' },
    { to: 'concept:prime-numbers', type: 'prerequisite', why: 'The key is built from two primes, and its security is the difficulty of recovering them from their product.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Signed certificates let machines on an untrusted network check each other\'s identity before exchanging data.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Which values may be published, and which must stay secret?',
      options: ['Publish n and d. Keep e, p and q secret.', 'Publish n and e. Keep d, p, q and φ secret.', 'Publish p and q. Keep n secret.', 'Publish everything except the message.'],
      answer: 1,
      explain: [
        'd is the private key. Publishing it lets anyone decrypt.',
        'Correct. The public key is (n, e). Knowing d decrypts directly, and knowing p, q or φ lets anyone compute d in a few steps.',
        'n is the product of p and q, so publishing the primes gives everything away.',
        'With p and q public, anyone can compute d and read the message.',
      ],
    },
    {
      type: 'predict',
      q: 'With p = 61, q = 53 (so n = 3233) and e = 7, the message m = 2 is encrypted. What is the ciphertext?',
      options: ['2', '14', '128', 'A number with no obvious relation to 2'],
      answer: 2,
      explain: [
        'Only 0, 1 and n − 1 encrypt to themselves.',
        'Encryption raises m to the power e. It does not multiply them.',
        'Correct. 2 to the power 7 is 128, which is below 3233, so no remainder is taken. The ciphertext is an ordinary power, and a seventh root recovers the message. This is one reason padding is required.',
        'That would be true for a message large enough for the power to wrap around n many times. This one is too small.',
      ],
      tryInput: { p: 61, q: 53, e: 7, m: 2 },
    },
    {
      type: 'debug',
      q: 'This key generation runs without error, but decryption returns the wrong message. Which line is wrong?',
      code: `n = p * q
phi = (p - 1) * (q - 1)
d = inverse(e, n)
cipher = power(message, e, n)
plain = power(cipher, d, n)`,
      options: ['Line 1: n should be p + q', 'Line 2: phi should be p × q − 1', 'Line 3: d must be the inverse of e modulo phi, not modulo n', 'Line 5: decryption should use e, not d'],
      answer: 2,
      explain: [
        'The modulus is the product of the primes.',
        '(p − 1)(q − 1) is right for two different primes.',
        'Correct. Exponents behave modulo φ, not modulo n. The decryption exponent must satisfy e × d ≡ 1 (mod φ).',
        'Raising to e again would encrypt a second time. Decryption needs the private exponent.',
      ],
    },
    {
      type: 'choice',
      q: 'Suppose n has 2048 bits, so that factoring it is out of reach. Why is textbook RSA, with no padding, still insecure?',
      options: ['The public exponent is too small to matter', 'The same message always gives the same ciphertext, so guesses can be checked, and ciphertexts can be combined to make new valid ones', 'Decryption stops working for large n', 'Anyone can compute φ from n'],
      answer: 1,
      explain: [
        'The size of e is not the main issue. Standard values such as 65537 are fine with proper padding.',
        'Correct. Encryption is deterministic, so an attacker who can guess the message can confirm the guess with the public key. It is also multiplicative: the product of two ciphertexts is the ciphertext of the product of the messages. Padding such as OAEP removes both problems.',
        'Decryption works for any size of n.',
        'Computing φ from n is as hard as factoring n.',
      ],
    },
    {
      type: 'challenge',
      title: 'Speed up decryption with the Chinese remainder theorem',
      prompt: 'The key holder knows p and q. Compute m_p = c^(d mod (p − 1)) mod p and m_q = c^(d mod (q − 1)) mod q, then combine them: with q_inv the inverse of q modulo p, let h = q_inv × (m_p − m_q) mod p and m = m_q + h × q. Check that this equals c^d mod n for every c with the toy key p = 61, q = 53, e = 17, and count the modular multiplications against the direct method. Then explain why an attacker who obtains m_p but a faulty m_q can factor n.',
      hints: [
        'The exponents d mod (p − 1) and d mod (q − 1) are about half as long as d, and the moduli are half as long as n.',
        'For the last part, consider the greatest common divisor of n and the difference between the faulty result and the correct one.',
      ],
    },
  ],

  compare: {
    idea: 'Publish the product of two secret primes. Encrypt by raising to a public power mod n, decrypt by raising to a private power.',
    requires: 'Two large random primes, a matching pair of exponents, proper padding of the message, and a message smaller than the modulus.',
    sensitivity: 'Security depends entirely on key size, randomness and padding. The toy sizes and bare formula on this page offer none.',
    memory: 'A few numbers the size of the modulus.',
    difficulty: 'high',
    difficultyNote: 'The arithmetic fits in thirty lines. A secure implementation (padding, constant time, key generation) is specialist work.',
    limits: 'Slow. It handles only short inputs. It is unsafe without padding. A large quantum computer would break it.',
    useWhen: 'You need to sign something or protect a key in a way almost everything understands. In practice, through a trusted library with standard padding.',
  },

  advanced: {
    history: 'Ron Rivest, Adi Shamir and Leonard Adleman devised the system at MIT in 1977, after Diffie and Hellman had set out the idea of public-key cryptography the year before. Martin Gardner described it in his Scientific American column in August 1977, together with a 129-digit challenge number that was factored in 1994. The paper appeared in Communications of the ACM in February 1978. MIT was granted a United States patent on the method in 1983, and it expired in 2000. In 1997 the British agency GCHQ disclosed that Clifford Cocks had found an equivalent system there in 1973. Padding schemes followed as attacks on the bare formula accumulated, notably OAEP by Mihir Bellare and Phillip Rogaway in 1994. In 2020 an 829-bit RSA modulus, RSA-250, was factored.',
    derivation: 'The extended Euclidean algorithm maintains, for every remainder $r_i$ in the division chain starting from $r_0 = \\varphi$ and $r_1 = e$, a coefficient $t_i$ with\n\n$$r_i \\equiv t_i\\, e \\pmod{\\varphi}.$$\n\nThis holds for $r_0 = \\varphi \\equiv 0 \\cdot e$ and $r_1 = e = 1 \\cdot e$. If it holds for two consecutive rows, then for $r_{i+1} = r_{i-1} - k r_i$ and $t_{i+1} = t_{i-1} - k t_i$ it holds as well, by subtracting $k$ times one congruence from the other. When the chain reaches $r_i = 1$, which it does exactly when $\\gcd(e, \\varphi) = 1$, the congruence reads $1 \\equiv t_i e \\pmod{\\varphi}$, so $d = t_i \\bmod \\varphi$. For the default key the chain is $3120, 17, 9, 8, 1, 0$ with coefficients $0, 1, -183, 184, -367$, giving $d = -367 + 3120 = 2753$.',
    proof: 'Decryption inverts encryption for every message. Let $ed = 1 + k(p-1)(q-1)$. Modulo $p$: if $p \\nmid m$ then $m^{p-1} \\equiv 1$ by Fermat\'s little theorem, so\n\n$$m^{ed} = m \\cdot \\left(m^{p-1}\\right)^{k(q-1)} \\equiv m \\pmod p,$$\n\nand if $p \\mid m$ then both sides are $0$. The same argument gives $m^{ed} \\equiv m \\pmod q$. Since $p$ and $q$ are distinct primes, $pq$ divides $m^{ed} - m$, that is $m^{ed} \\equiv m \\pmod n$. Note that the proof covers messages that share a factor with $n$, which an argument through Euler\'s theorem alone would not.\n\nTextbook RSA is also **multiplicative**: $(m_1 m_2)^e \\equiv m_1^e\\, m_2^e \\pmod n$. An attacker can therefore turn a ciphertext of $m$ into a valid ciphertext of $2m$ by multiplying it by $2^e$, without knowing $m$. Together with determinism this rules out the bare formula for real use.',
    complexityProof: 'Square-and-multiply performs one squaring per bit of the exponent and one further multiplication per 1 bit, so an exponent of $b$ bits costs between $b$ and $2b$ modular multiplications. With schoolbook arithmetic one multiplication of $k$-bit numbers costs $O(k^2)$, giving $O(k^3)$ for a $k$-bit exponent and $O(k^2)$ for a fixed small one. The Euclidean algorithm on numbers below $\\varphi$ takes $O(\\log \\varphi)$ division steps, since the remainder at least halves every two steps. Trial division finds the smaller prime factor after at most $\\sqrt{n}$ divisions, and for primes of similar size it needs close to that many.',
    variants: [
      { name: 'RSA-OAEP', text: 'Encryption with Optimal Asymmetric Encryption Padding, which randomizes the message and adds structure so that modified ciphertexts are rejected.' },
      { name: 'RSA-PSS and PKCS #1 v1.5 signatures', text: 'Signature schemes that pad a hash of the message before applying the private exponent. PSS is randomized and has a security proof in an idealized model.' },
      { name: 'CRT-RSA', text: 'Decryption and signing computed modulo p and q separately and recombined, about four times faster.' },
      { name: 'RSA-KEM', text: 'Encrypt a random number below n with the bare formula and derive a symmetric key from it with a hash. Padding is unnecessary because the input is uniformly random.' },
      { name: 'Rabin cryptosystem', text: 'A relative that uses squaring modulo n. Breaking it is provably as hard as factoring n.' },
    ],
    implementation: 'Use a maintained cryptographic library and never the bare formula. Generate primes from a secure random source and test them with a probabilistic primality test. Use e = 65537. Use OAEP for encryption and PSS for signatures. Make private-key operations constant-time and apply blinding. Verify the result of a CRT signature before releasing it.',
    benchmarking: 'RSA performance is reported separately for public-key and private-key operations at a stated key size, usually as operations per second. Compare with other schemes at equal estimated security: a 3072-bit RSA key is usually set against a 256-bit elliptic curve.',
    references: [
      { authors: 'R. L. Rivest, A. Shamir and L. Adleman', year: 1978, title: 'A method for obtaining digital signatures and public-key cryptosystems', venue: 'Communications of the ACM 21(2), 120-126' },
      { authors: 'M. Bellare and P. Rogaway', year: 1994, title: 'Optimal asymmetric encryption', venue: 'Advances in Cryptology: EUROCRYPT \'94, Lecture Notes in Computer Science 950, Springer' },
      { authors: 'D. Boneh', year: 1999, title: 'Twenty years of attacks on the RSA cryptosystem', venue: 'Notices of the American Mathematical Society 46(2), 203-213' },
      { authors: 'K. Moriarty, B. Kaliski, J. Jonsson and A. Rusch', year: 2016, title: 'PKCS #1: RSA Cryptography Specifications Version 2.2', venue: 'RFC 8017, Internet Engineering Task Force' },
      { authors: 'P. W. Shor', year: 1997, title: 'Polynomial-time algorithms for prime factorization and discrete logarithms on a quantum computer', venue: 'SIAM Journal on Computing 26(5), 1484-1509' },
    ],
    furtherReading: [
      'J. Katz and Y. Lindell, *Introduction to Modern Cryptography*, the chapters on public-key encryption and RSA.',
      'A. J. Menezes, P. C. van Oorschot and S. A. Vanstone, *Handbook of Applied Cryptography*, chapter 8, "Public-key encryption".',
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, the chapter "Number-Theoretic Algorithms".',
    ],
  },

  tests: [
    { name: 'the default key: n = 3233, d = 2753, 65 encrypts to 2790', input: {},
      check: (r) => soundAnd(r, r.n === 3233 && r.phi === 3120 && r.d === 2753 && r.c === 2790 && r.decrypted === 65 && r.coefficient === -367, `got n=${r.n} d=${r.d} c=${r.c}`) },
    { name: 'the worked example: p = 3, q = 11, e = 3, d = 7, 2 encrypts to 8', input: { p: 3, q: 11, e: 3, m: 2 },
      check: (r) => soundAnd(r, r.n === 33 && r.phi === 20 && r.d === 7 && r.c === 8 && r.decrypted === 2, `got d=${r.d} c=${r.c}`) },
    { name: 'a small message with e = 7 is an ordinary power', input: { p: 61, q: 53, e: 7, m: 2 },
      check: (r) => soundAnd(r, r.c === 128, `expected 128, got ${r.c}`) },
    { name: 'n − 1 encrypts to itself', input: { p: 61, q: 53, e: 17, m: 3232 },
      check: (r) => soundAnd(r, r.c === 3232, `got ${r.c}`) },
    { name: 'zero and a message sharing a factor with n still round-trip', input: { p: 61, q: 53, e: 17, m: 122 },
      check: (r) => soundAnd(r, r.decrypted === 122, `got ${r.decrypted}`) },
    { name: 'message 0', input: { p: 5, q: 11, e: 3, m: 0 },
      check: (r) => soundAnd(r, r.c === 0 && r.d === 27, `got c=${r.c} d=${r.d}`) },
    { name: 'the attacker finds the smaller prime after 52 trial divisions', input: {},
      check: (r) => soundAnd(r, r.attack.factor === 53 && r.attack.other === 61 && r.attack.trials === 52 && r.attack.m === 65, `got ${r.attack.factor} after ${r.attack.trials}`) },
    { name: 'another key matches exact big-integer arithmetic', input: { p: 47, q: 59, e: 17, m: 1234 }, check: sound },
  ],
};
