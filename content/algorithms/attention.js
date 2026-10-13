// Scaled dot-product self-attention, one head, on a handful of tokens.
//
// What this lesson runs: the forward calculation softmax(Q Kᵀ / √d) V, exactly as defined, on
// vectors and matrices that were WRITTEN BY HAND for this page. Nothing is trained and nothing
// is predicted. It is one attention step, not a transformer and not a language model, and the
// lesson says so wherever a reader might think otherwise.

const D = 4;   // every vector on this page has four entries

// The lookup table: one fixed vector per word. Chosen by hand so that the result is easy to read:
// entry 1 is 1 for a noun, entry 2 is 1 for a verb, entry 3 is 1 for "the" and "a", and entry 4
// is only a tag that tells words of the same kind apart.
const VOCAB = new Map([
  ['the', [0, 0, 1, 0]], ['a', [0, 0, 1, 1]],
  ['dog', [1, 0, 0, 1]], ['cat', [1, 0, 0, 2]], ['mat', [1, 0, 0, 0]],
  ['saw', [0, 1, 0, 0]], ['sat', [0, 1, 0, 1]], ['chased', [0, 1, 0, 2]],
]);
const WORDS = [...VOCAB.keys()];
// The three matrices, also chosen by hand. W_Q makes verbs and "the" ask for nouns (first row)
// and nouns ask for verbs (second row). W_K makes a key that says what kind of word a token is.
const W_Q = [[0, 3, 2, 0], [2, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]];
const W_K = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]];
const W_V = [[1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 2]];

const dot = (a, b) => { let s = 0; for (let c = 0; c < a.length; c++) s += a[c] * b[c]; return s; };
const times = (M, x) => M.map((row) => dot(row, x));
// The position vector of the original transformer for vectors of four entries, positions counted from 0.
const positionVector = (p) => [Math.sin(p), Math.cos(p), Math.sin(p / 100), Math.cos(p / 100)];

const num = (v) => { const r = Math.round(v * 1000) / 1000; return String(Object.is(r, -0) ? 0 : r).replace('-', '−'); };
const f3 = (v) => (Math.abs(v) < 0.0005 ? '0.000' : v.toFixed(3).replace('-', '−'));
const vec = (x) => x.map(num).join(', ');
const vecF = (x) => x.map(f3).join(', ');
const ORD = ['1st', '2nd', '3rd', '4th'];
const listOf = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

function parseTokens(input) {
  const words = String(input.tokens ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) throw new Error(`Type one to six words from this list, separated by spaces: ${WORDS.join(', ')}.`);
  const bad = words.find((w) => !VOCAB.has(w));
  if (bad) throw new Error(`"${bad}" is not in this page's small vocabulary. Use only these words: ${WORDS.join(', ')}. A real model has a vector for every token its tokenizer can produce.`);
  if (words.length > 6 && !input.unlimited) throw new Error('Use at most six words, so that every score fits on the page.');
  return words;
}

function run(input, t) {
  const tokens = parseTokens(input);
  const n = tokens.length;
  const usePos = !!input.positions, useMask = !!input.mask, useScale = input.scale !== false;
  const divisor = useScale ? Math.sqrt(D) : 1;
  const labels = tokens.map((w, i) => `${i + 1} ${w}`);
  const name = (i) => `token ${i + 1}, **${tokens[i]}**`;
  const repeats = tokens.some((w, i) => tokens.indexOf(w) !== i);

  /* ---- line 1: one vector per token ---- */
  const base = tokens.map((w) => VOCAB.get(w).slice());
  const pos = tokens.map((_, p) => positionVector(p));
  const X = base.map((x, p) => (usePos ? x.map((v, c) => v + pos[p][c]) : x));
  const columns = ['1st', '2nd', '3rd', '4th'];
  t.frame(() => ({
    line: [0, 1],
    note: `The sequence has ${n} ${n === 1 ? 'token' : 'tokens'}: ${tokens.join(', ')}. Each one is replaced by a list of ${D} numbers, called its **vector**, looked up in a fixed table. On this page the table was written by hand. The 1st number is 1 for a noun, the 2nd is 1 for a verb, the 3rd is 1 for "the" or "a", and the 4th only tells words of the same kind apart. Nothing here was learned from text. In a real model the vectors are learned, and each has hundreds or thousands of numbers.${usePos ? '' : ` No position information is added in this run, so nothing below can depend on the order of the tokens.${repeats ? ' Tokens that are the same word start from exactly the same vector.' : ''}`}`,
    views: [{ kind: 'table', title: 'One vector for each token, from the fixed table', corner: 'token', rowLabels: labels, colLabels: columns, cells: base.map((x) => x.map(num)) }],
    vars: { tokens: n, 'numbers per vector': D },
  }));
  if (usePos) {
    t.frame(() => ({
      line: 1,
      note: `Position information is switched on. Every position has its own fixed vector, built from sine and cosine waves by the formula of the original transformer, and it is added to the token's vector, number by number. Positions are counted from 0, so the first token gets (${vecF(pos[0])}). ${repeats ? 'Two tokens that are the same word now start from different vectors, because they stand in different places.' : 'The same word in a different place would now start from a different vector.'} From here on, numbers are shown rounded to three decimals. One warning: the matrices on this page were not built to make use of position, so the pattern of weights below will not mean much. A trained model learns matrices that do use it.`,
      views: [{ kind: 'table', title: 'Token vector + position vector = the vector used from here on', corner: 'token', rowLabels: labels, colLabels: ['token vector', 'position vector', 'sum'],
        cells: base.map((x, p) => [vec(x), vecF(pos[p]), vecF(X[p])]), roles: Object.fromEntries(base.map((_, p) => [`${p},2`, 'current'])) }],
      vars: { tokens: n, 'numbers per vector': D },
    }));
  }

  /* ---- line 2: query, key and value for every token ---- */
  const Q = X.map((x) => times(W_Q, x)), K = X.map((x) => times(W_K, x)), V = X.map((x) => times(W_V, x));
  const show = usePos ? vecF : vec;
  const made = (upTo) => ({
    kind: 'table', title: 'Three new vectors for each token', corner: 'token', rowLabels: labels, colLabels: ['vector', 'query', 'key', 'value'],
    cells: X.map((x, i) => [show(x), upTo >= 1 ? show(Q[i]) : '', upTo >= 2 ? show(K[i]) : '', upTo >= 3 ? show(V[i]) : '']),
    roles: Object.fromEntries(X.flatMap((_, i) => [1, 2, 3].filter((c) => c <= upTo).map((c) => [`${i},${c}`, c === upTo ? 'current' : 'done']))),
    legend: [{ label: 'just computed', role: 'current' }, { label: 'computed earlier', role: 'done' }],
  });
  const matrix = (M, title) => ({ kind: 'table', title, corner: 'row', rowLabels: ['1', '2', '3', '4'], colLabels: ['× 1st', '× 2nd', '× 3rd', '× 4th'], cells: M.map((r) => r.slice()) });
  const pick = Math.min(1, n - 1);   // the token used for the worked line: the second one when there is one
  const sh = (v) => (show === vec ? num(v) : f3(v));
  const rowFor = (R) => Math.max(0, R[pick].findIndex((v) => v !== 0));   // a row whose result is not zero, when there is one
  const worked = (M, R) => { const row = rowFor(R); return `the ${ORD[row]} number of its ${R === Q ? 'query' : R === K ? 'key' : 'value'} is ${M[row].map((m, c) => `(${m} × ${sh(X[pick][c])})`).join(' + ')} = ${sh(R[pick][row])}`; };
  t.frame(() => ({
    line: 2,
    note: `Each token now gets three new vectors, each made from its own vector with a fixed table of numbers called a matrix. First the **query**, which says what the token is looking for. Each number of a query is a weighted sum of the token's ${D} numbers, using one row of the matrix. For ${name(pick)}, ${worked(W_Q, Q)}. This matrix was chosen by hand so that verbs and "the" ask for nouns, and nouns ask for verbs. In a real model it is learned.`,
    views: [made(1), matrix(W_Q, 'The query matrix: each row makes one number of the query')],
    vars: { making: 'queries' },
  }));
  t.frame(() => ({
    line: 2,
    note: `Next the **key**, made the same way with a second matrix. A key is what a token shows to the others: it is what their queries will be compared against. For ${name(pick)}, ${worked(W_K, K)}. A token's key is different from its query, because what a word offers is not the same as what it is looking for.`,
    views: [made(2), matrix(W_K, 'The key matrix: each row makes one number of the key')],
    vars: { making: 'keys' },
  }));
  t.frame(() => ({
    line: 2,
    note: `Last the **value**, made with a third matrix. The value is what a token hands over to any token that attends to it. For ${name(pick)}, ${worked(W_V, V)}. Queries and keys decide who listens to whom. Values are what gets passed along.`,
    views: [made(3), matrix(W_V, 'The value matrix: each row makes one number of the value')],
    vars: { making: 'values' },
  }));

  /* ---- lines 3 to 7: one row of the attention table per token ---- */
  const scores = [], scaled = [], weights = [], outputs = [];
  const tableLegend = [{ label: 'row being worked on', role: 'current' }, { label: 'largest weight in a finished row', role: 'done' }];
  if (useMask) tableLegend.push({ label: 'hidden by the mask: weight 0', role: 'dim' });
  const weightTable = (rowsDone, live) => {
    const cells = [], roles = {};
    for (let r = 0; r < n; r++) {
      const finished = r < rowsDone, current = live && r === rowsDone && live.length;
      const row = finished ? weights[r] : current ? live : null;
      const top = row ? Math.max(...row) : 0;
      cells.push(tokens.map((_, c) => {
        if (useMask && c > r) { roles[`${r},${c}`] = 'dim'; return row ? '0' : ''; }
        if (!row) return '';
        if (current) roles[`${r},${c}`] = 'current'; else if (row[c] >= top - 1e-12) roles[`${r},${c}`] = 'done';
        return f3(row[c]);
      }));
    }
    return { kind: 'table', title: 'Attention weights: each row is one token looking at all the tokens', corner: 'looking ↓  at →', rowLabels: labels, colLabels: labels, cells, roles, legend: rowsDone >= n ? tableLegend.slice(1) : tableLegend };
  };
  const hidden = (i, j) => useMask && j > i;
  // Which places of the two lists produce the score: the ones where neither has a zero.
  const matchText = (q, k) => {
    const places = q.map((v, c) => c).filter((c) => q[c] !== 0 && k[c] !== 0);
    return places.length === 1
      ? `Only the ${ORD[places[0]]} place counts, where the query has ${num(q[places[0]])} and the key has ${num(k[places[0]])}.`
      : `The ${listOf(places.map((c) => ORD[c]))} places count, because both lists have a number other than 0 there.`;
  };
  const perToken = (i, text, role) => tokens.map((_, j) => (hidden(i, j) ? { t: 'hidden', sub: labels[j], role: 'dim' } : { t: text(j), sub: labels[j], role: role ? role(j) : 'default' }));

  for (let i = 0; i < n; i++) {
    const allowed = tokens.map((_, j) => j).filter((j) => !hidden(i, j));
    const raw = new Array(n).fill(null);
    const title = `Working for token ${i + 1}, ${tokens[i]}`;
    const queryRow = { label: 'Its query', cells: Q[i].map((v, c) => ({ t: show === vec ? num(v) : f3(v), sub: ORD[c] })) };

    /* line 5, first half: the dot product of this query with every key it may look at */
    for (const j of allowed) {
      const s = dot(Q[i], K[j]);
      raw[j] = s;
      t.count('scores computed');
      const seen = raw.slice();
      const products = Q[i].map((q, c) => `(${show === vec ? num(q) : f3(q)} × ${show === vec ? num(K[j][c]) : f3(K[j][c])})`).join(' + ');
      const first = j === allowed[0];
      t.frame(() => ({
        line: [3, 4, 5],
        note: `${first ? `Now ${name(i)}, looks at the tokens${useMask ? ' it is allowed to see' : ''}, one at a time. First ` : `Token ${i + 1} (${tokens[i]}) now looks at `}${name(j)}${i === j ? ', which is itself' : ''}. Multiply the query of token ${i + 1} by the key of token ${j + 1}, number by number, and add: ${products} = **${num(s)}**.${first && i === 0 ? ' This sum is the **score**. It is large when the key has large numbers in the same places as the query, which is what "this key matches that query" means here.' : usePos ? '' : s === 0 ? ' No place has a non-zero number in both lists, so this key offers nothing the query asks for.' : ` ${matchText(Q[i], K[j])}`}${first && useMask && i < n - 1 ? ` The mask hides ${n - 1 - i === 1 ? `token ${n}` : n - 1 - i === 2 ? `tokens ${n - 1} and ${n}` : `tokens ${i + 2} to ${n}`} from token ${i + 1}, because ${n - 1 - i === 1 ? 'it comes' : 'they come'} later. No score is computed for ${n - 1 - i === 1 ? 'it' : 'them'}.` : ''}`,
        views: [weightTable(i, null), { kind: 'rows', title, legend: [{ label: 'key being compared now', role: 'compare' }, { label: 'score just computed', role: 'current' }], rows: [
          queryRow,
          { label: 'Keys', cells: perToken(i, (c) => show(K[c]), (c) => (c === j ? 'compare' : 'default')) },
          { label: 'Scores', cells: perToken(i, (c) => (seen[c] === null ? '?' : num(seen[c])), (c) => (c === j ? 'current' : seen[c] === null ? 'dim' : 'default')) },
        ] }],
        vars: { looking: labels[i], at: labels[j], score: num(s) },
      }));
    }
    scores.push(raw.slice());

    /* line 5, second half: divide by the square root of the vector length */
    const sc = raw.map((s) => (s === null ? null : s / divisor));
    scaled.push(sc.slice());
    const kept = allowed.map((j) => sc[j]);
    if (useScale) {
      t.frame(() => ({
        line: 5,
        note: `Divide each score by ${num(divisor)}, the square root of ${D}, which is how many numbers a key has: (${allowed.map((j) => num(raw[j])).join(', ')}) becomes (${kept.map(num).join(', ')}).${i === 0 ? ' The reason: a score is a sum of one product per number in the vector, so longer vectors tend to give larger scores. The next step exaggerates the gaps between large scores, and without this division one token would take nearly all the weight.' : ''}`,
        views: [weightTable(i, null), { kind: 'rows', title, rows: [
          { label: 'Scores', cells: perToken(i, (c) => num(raw[c])) },
          { label: `Divided by ${num(divisor)}`, cells: perToken(i, (c) => num(sc[c]), () => 'current') },
        ] }],
        vars: { looking: labels[i], 'divide by': num(divisor) },
      }));
    }

    /* line 6: softmax over the row */
    const exps = kept.map((s) => Math.exp(s));
    let total = 0;
    for (const e of exps) total += e;
    const w = new Array(n).fill(0);
    allowed.forEach((j, c) => { w[j] = exps[c] / total; });
    weights.push(w.slice());
    const top = Math.max(...w);
    const favourites = allowed.filter((j) => w[j] >= top - 1e-12);
    const flat = favourites.length === allowed.length;
    const expAt = (j) => exps[allowed.indexOf(j)];
    t.frame(() => ({
      line: 6,
      note: `${i === 0 ? `Turn the scores into **weights**: positive numbers that add up to 1. This step is called softmax.${useScale ? '' : ' (Scaling is switched off in this run, so the scores are used as they are.)'} First raise the number e, about 2.718, to the power of each score. That makes every number positive and lets a larger score stand out: ` : 'Softmax again. e to the power of each score: '}(${exps.map(f3).join(', ')}). Their total is ${f3(total)}. Divide each by the total: (${allowed.map((j) => f3(w[j])).join(', ')}). ${i === 0 ? 'Dividing by the total is what makes them add up to 1. ' : ''}${useMask && allowed.length < n ? 'The hidden tokens were left out of the total, so their weight is 0. ' : ''}${allowed.length === 1 ? `With only one token in view, all of the weight goes to it.` : flat ? `All the scores are equal, so token ${i + 1} spreads its weight evenly: it has no reason to prefer any token.` : `Token ${i + 1} (${tokens[i]}) gives its largest weight, ${f3(top)}, to ${listOf(favourites.map((j) => `token ${j + 1} (${tokens[j]})`))}.`}`,
      views: [weightTable(i, w), { kind: 'rows', title, rows: [
        { label: useScale ? `Scores ÷ ${num(divisor)}` : 'Scores', cells: perToken(i, (c) => num(sc[c])) },
        { label: 'e to that power', cells: perToken(i, (c) => f3(expAt(c))) },
        { label: 'Weights', cells: perToken(i, (c) => f3(w[c]), () => 'current') },
      ] }],
      vars: { looking: labels[i], total: f3(total), 'weights add up to': f3(w.reduce((a, b) => a + b, 0)) },
    }));

    /* line 7: the weighted sum of the values */
    const out = new Array(D).fill(0);
    for (const j of allowed) for (let c = 0; c < D; c++) out[c] += w[j] * V[j][c];
    outputs.push(out.slice());
    const twin = tokens.findIndex((word, k) => k < i && word === tokens[i]);
    const identical = twin >= 0 && outputs[twin].every((v, c) => v === out[c]);
    const blend = allowed.map((j) => `${f3(w[j])} × (${show(V[j])})`).join(' + ');
    t.frame(() => ({
      line: 7,
      note: `The **output** for ${name(i)}, is a blend of the value vectors, each multiplied by its weight: ${blend} = **(${vecF(out)})**.${i === 0 ? ' Because the weights add up to 1, this is a weighted average of the values. Tokens with a large weight contribute most of it.' : ''}${twin < 0 ? '' : identical && (usePos || useMask)
        ? ` It happens to equal the output of token ${twin + 1}, the other "${tokens[i]}", but only because every value blended here is the same vector. With ${usePos && useMask ? 'position information and the mask' : usePos ? 'position information' : 'the mask'} switched on, that is a coincidence of this input and not a rule.`
        : identical
        ? ` This is exactly the output of token ${twin + 1}, the other "${tokens[i]}". The two started from the same vector, so they made the same query, met the same keys and got the same weights. Nothing in the calculation knew that one stood in place ${twin + 1} and the other in place ${i + 1}.`
        : ` Token ${twin + 1} is also "${tokens[i]}", yet its output was different. ${usePos && useMask ? 'The position vectors gave the two different starting vectors, and the mask let them see different tokens.' : usePos ? 'The position vectors gave the two different starting vectors, so their queries and keys differ.' : `The mask let token ${twin + 1} see only ${twin + 1} ${twin === 0 ? 'token' : 'tokens'}, and lets this one see ${i + 1}.`}`}`,
      views: [weightTable(i + 1, null), { kind: 'rows', title, legend: [{ label: 'the output vector', role: 'done' }], rows: [
        { label: 'Weights', cells: perToken(i, (c) => f3(w[c])) },
        { label: 'Values', cells: perToken(i, (c) => show(V[c])) },
        { label: 'Output', cells: out.map((v, c) => ({ t: f3(v), sub: ORD[c], role: 'done' })) },
      ] }],
      vars: { 'output for': labels[i], 'rows finished': i + 1 },
    }));
  }

  const computed = useMask ? (n * (n + 1)) / 2 : n * n;
  t.frame(() => ({
    line: 8,
    note: `All ${n} ${n === 1 ? 'row is' : 'rows are'} finished: ${computed} ${computed === 1 ? 'score' : 'scores'}, ${n} ${n === 1 ? 'row' : 'rows'} of weights that each add up to 1, and one output vector per token. That is one complete attention step with one head. **What this was not:** the vectors and the three matrices were written by hand for this page. Nothing was learned from text, nothing here predicts a next word, and it is not a language model. A transformer runs this step many times with learned matrices, several heads side by side, position information and other layers in between. The text of this lesson describes those parts. The page does not run them.`,
    views: [weightTable(n, null), { kind: 'table', title: 'Output: one new vector for each token', corner: 'token', rowLabels: labels, colLabels: columns, cells: outputs.map((o) => o.map(f3)) }],
    vars: { tokens: n, 'rows finished': n },
  }));

  return { tokens, labels, d: D, positions: usePos, mask: useMask, scale: useScale, divisor, X, Q, K, V, scores, scaled, weights, outputs };
}

/* ---- an independent direct computation, for the tests ---- */

// It shares no code with run. It never forms queries or keys: the score of the pair (i, j) is the
// bilinear form xᵢᵀ (W_Qᵀ W_K) xⱼ. It shifts each row by its largest score before the exponential,
// and it blends the token vectors first and applies W_V once to the blend.
function direct(tokens, { positions = false, mask = false, scale = true } = {}) {
  const table = { the: [0, 0, 1, 0], a: [0, 0, 1, 1], dog: [1, 0, 0, 1], cat: [1, 0, 0, 2], mat: [1, 0, 0, 0], saw: [0, 1, 0, 0], sat: [0, 1, 0, 1], chased: [0, 1, 0, 2] };
  const M = [0, 1, 2, 3].map((a) => [0, 1, 2, 3].map((b) => [0, 1, 2, 3].reduce((s, c) => s + W_Q[c][a] * W_K[c][b], 0)));
  const X = tokens.map((w, p) => table[w].map((v, c) => (positions ? v + (c % 2 === 0 ? Math.sin : Math.cos)(p / 100 ** Math.floor(c / 2)) : v)));
  const n = tokens.length, weights = [], outputs = [];
  for (let i = 0; i < n; i++) {
    const logits = X.map((xj, j) => {
      if (mask && j > i) return -Infinity;
      let s = 0;
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) s += X[i][a] * M[a][b] * xj[b];
      return scale ? s / 2 : s;
    });
    const peak = Math.max(...logits);
    const e = logits.map((l) => Math.exp(l - peak));
    const z = e.reduce((s, v) => s + v, 0);
    const w = e.map((v) => v / z);
    const mix = [0, 1, 2, 3].map((c) => X.reduce((s, xj, j) => s + w[j] * xj[c], 0));
    weights.push(w);
    outputs.push(W_V.map((row) => row.reduce((s, m, c) => s + m * mix[c], 0)));
  }
  return { weights, outputs };
}

const near = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;
const rowsSumToOne = (r) => {
  for (const [i, row] of r.weights.entries()) {
    if (row.some((w) => !(w >= 0 && w <= 1))) return `row ${i + 1} has a weight outside 0 to 1`;
    if (!near(row.reduce((s, w) => s + w, 0), 1)) return `row ${i + 1} sums to ${row.reduce((s, w) => s + w, 0)}`;
  }
  return true;
};
const matchesDirect = (r) => {
  const ref = direct(r.tokens, { positions: r.positions, mask: r.mask, scale: r.scale });
  for (let i = 0; i < r.tokens.length; i++) {
    for (let j = 0; j < r.tokens.length; j++) if (!near(r.weights[i][j], ref.weights[i][j])) return `weight ${i + 1},${j + 1} is ${r.weights[i][j]}, the direct computation gives ${ref.weights[i][j]}`;
    for (let c = 0; c < 4; c++) if (!near(r.outputs[i][c], ref.outputs[i][c], 1e-11)) return `output ${i + 1},${c + 1} is ${r.outputs[i][c]}, the direct computation gives ${ref.outputs[i][c]}`;
  }
  return true;
};
// Every output is a weighted average of the values, so each of its numbers lies between the smallest and largest value in that place.
const insideValues = (r) => r.outputs.every((o) => o.every((v, c) => v >= Math.min(...r.V.map((x) => x[c])) - 1e-12 && v <= Math.max(...r.V.map((x) => x[c])) + 1e-12)) || 'an output lies outside the range of the values';
const all = (...checks) => (r, c) => { for (const check of checks) { const v = check(r, c); if (v !== true) return v; } return true; };
const sound = all(rowsSumToOne, matchesDirect, insideValues);

const DEFAULTS = { tokens: 'the dog saw the cat', positions: false, mask: false, scale: true };
const QUIET = { count() {}, frame() {} };

export default {
  meta: {
    id: 'attention',
    name: 'Attention and the Transformer',
    aliases: ['transformer', 'self-attention', 'scaled dot-product attention', 'attention mechanism', 'multi-head attention', 'transformers'],
    kind: 'model',
    discipline: 'deep-learning',
    alsoIn: [
      { id: 'nlp', why: 'Transformers were introduced for machine translation, and the large language models that followed are stacks of attention layers.' },
      { id: 'computer-vision', why: 'A vision transformer cuts an image into patches and lets every patch attend to every other, with the same layer that is used for text.' },
    ],
    subfield: 'Sequence models',
    family: 'Attention mechanisms',
    lab: 'neural-networks',
    year: 2017,
    authors: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser and Illia Polosukhin',
    summary: 'Lets every token in a sequence take a weighted blend of all the others, with weights from query-key scores. Stacked with other layers, this step forms the transformer.',
    difficulty: 'advanced',
    order: 656,
    paradigms: ['gradient-based', 'transform'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n² · d)', average: 'O(n² · d)', worst: 'O(n² · d)', class: 'quadratic' },
    space: { worst: 'O(n²) for the weights, plus O(n · d) for the vectors', class: 'quadratic' },
    tags: {
      problems: ['how does a chatbot decide which words matter', 'how does ChatGPT work', 'work out what a word like "it" refers to', 'let each word in a sentence use the other words', 'how a language model reads a whole sentence at once', 'mix information between the positions of a sequence'],
      techniques: ['dot product', 'softmax', 'weighted average', 'query, key and value', 'residual connection', 'positional encoding'],
      applications: ['natural language', 'machine learning', 'image processing', 'bioinformatics'],
    },
    prerequisites: ['backpropagation', 'concept:neural-network', 'concept:matrix', 'concept:linear-algebra'],
  },

  bigIdea: {
    simple: 'Attention is a way for each word in a sentence to collect information from the other words. Take the sentence: the cat sat on the mat because it was tired. To know what "it" means, you look back at "cat". A computer needs a way to do the same. In attention, every word sends out a question, and every word also wears a label saying what it has to offer. Questions, labels and everything else are lists of numbers. The computer compares one word\'s question with every word\'s label and gives each pair a score. A high score means: this word matters to that one. The scores are then turned into shares that add up to one whole, like slices of a pie. The word takes a blend of what the other words carry, with the biggest slices coming from the highest scores. Every word does this at once, so every word ends up knowing something about its sentence. A transformer is a program built by repeating this step many times, with other steps in between. The language models behind chatbots are transformers. Nobody writes their questions and labels by hand. They are found by training on enormous amounts of text.',
    when: 'Use attention when what an item means depends on other items that may be far away, and you can afford to compare every pair: words in a text, lines of code, patches of an image, positions in a protein. It needs a lot of training data, because almost nothing about the task is built in. The cost grows with the square of the sequence length, so very long inputs need a restricted form of it. When what matters is mostly local and data is limited, a model with more built-in assumptions, such as a convolutional network for images, can do better.',
    interesting: 'Be clear about what this page runs. The demonstration computes one attention step, with one head, on at most six tokens, using vectors and matrices that were written by hand. It is the real calculation, the same arithmetic a transformer performs, and every number can be checked. It is not a language model. Nothing was trained, there is no stack of layers, and it cannot predict a next word. The rest of a transformer is described in words below and is not run here. One property is easy to see even at this scale: with no position information, attention cannot tell in what order the tokens came. Two copies of the same word get identical outputs, and shuffling the input only shuffles the output.',
    analogy: {
      title: 'A room where everyone compares notes',
      text: "Picture a room of people, each holding three cards. The first card is a question: the kind of thing this person wants to know. The second is a badge, worn where everyone can see it, saying what this person knows about. The third is a page of notes, and it is the only card that changes hands. The badge is there to be matched against questions. The notes are what a good match earns. Each person compares their question with every badge in the room, their own included, then collects notes from everyone, taking a large share from the people whose badges matched well and a small share from the rest. Everyone leaves with a new page that mixes what the room knew, tilted towards what they asked about.",
      limits: "People would ask one or two others and ignore the rest. Attention takes a share from everyone it is allowed to see, and no share is ever exactly zero, only small. The cards are lists of numbers, a match is a sum of products, and nothing in the room understands anything. And because the questions and badges of a trained model were set by training, not written by anyone, it is often hard to say in words what a particular question is asking.",
    },
  },

  example: {
    setup: 'Take the five tokens "the dog saw the cat" and work out the output for one of them, "saw". A token is one item of the sequence, here a word. Each token has three lists of four numbers, set by hand for this example: a query (what it is looking for), a key (what it offers) and a value (what it hands over). The query of "saw" is 3, 0, 0, 0. The keys are: the 0, 0, 0, 1. dog 1, 0, 1, 0. saw 0, 1, 0, 0. cat 1, 0, 2, 0. The values are: the 0, 0, 1, 0. dog 2, 0, 0, 2. saw 0, 1, 0, 0. cat 3, 0, 0, 4.',
    steps: [
      'Score each token against the query of "saw": multiply the two lists number by number and add. For "dog": 3 × 1 + 0 × 0 + 0 × 1 + 0 × 0 = 3. For "cat" it is also 3. For "the" (both of them) and for "saw" itself it is 0, because their keys have a 0 where the query has its 3.',
      'Divide every score by 2, which is the square root of the list length, 4. The five scores 0, 3, 0, 0, 3 become 0, 1.5, 0, 0, 1.5.',
      'Make every score positive with the exponential function, which turns 0 into 1 and 1.5 into about 4.48. The five numbers are 1, 4.48, 1, 1, 4.48. Their total is 11.96.',
      'Divide each by the total to get the weights. For "dog" and "cat": 4.48 ÷ 11.96 = 0.375 each. For the other three: 1 ÷ 11.96 = 0.084 each. Together they add up to 1, apart from rounding.',
      'Blend the values with those weights. The first number of the output is 0.375 × 2 (from dog) + 0.375 × 3 (from cat), which is about 1.87. The other three values have 0 in that place and add nothing. Doing the same in each place gives about 1.87, 0.08, 0.17, 2.25.',
    ],
    result: 'The output for "saw" is about 1.87, 0.08, 0.17, 2.25. Three quarters of it came from "dog" and "cat", the two tokens whose keys matched its query. Notice the two copies of "the": they got the same score and the same weight, and nothing in the calculation could tell them apart.',
    tryInput: { ...DEFAULTS },
  },

  terms: [
    { term: 'Token', meaning: 'One item of the sequence being processed. For text it is a word or a piece of a word.' },
    { term: 'Vector', meaning: 'A list of numbers of a fixed length. Every token is turned into one before anything else happens.' },
    { term: 'Query', meaning: 'A vector made from a token that says what the token is looking for in the others.' },
    { term: 'Key', meaning: 'A vector made from a token that says what the token offers. Queries are compared against keys.' },
    { term: 'Value', meaning: 'A vector made from a token that is handed over to any token that attends to it.' },
    { term: 'Dot product', meaning: 'A way to compare two vectors: multiply them number by number and add up the results.' },
    { term: 'Score', meaning: 'The dot product of one token\'s query with another token\'s key. High means a good match.' },
    { term: 'Softmax', meaning: 'A calculation that turns a row of scores into positive numbers that add up to 1, giving higher scores larger shares.' },
    { term: 'Attention weight', meaning: 'The share, between 0 and 1, of one token\'s value that goes into another token\'s output.' },
    { term: 'Self-attention', meaning: 'Attention in which the queries, keys and values all come from the same sequence, so the tokens attend to each other.' },
    { term: 'Position information', meaning: 'Extra numbers given to each token that depend on where it stands in the sequence, because attention alone ignores order.' },
    { term: 'Head', meaning: 'One attention step with its own three matrices. A layer usually runs several heads side by side.' },
    { term: 'Transformer', meaning: 'A neural network built by stacking attention layers with feed-forward layers in between.' },
  ],

  takeaway: 'Each token scores every token, turns the scores into shares that add up to one, and takes that blend of what the others carry.',

  viz: {
    describe: 'Tables of numbers. The first frames show a table with one row for each token and the four numbers of its vector, then a table listing each token\'s query, key and value as they are computed, beside the matrix that produces them. After that the main table is the attention table: one row and one column per token, where the cell in a row gives the weight that the row\'s token puts on the column\'s token. Rows are filled in one at a time. The row being worked on is terracotta, and in a finished row the largest weight is forest green. Cells hidden by a causal mask are faint and hold 0. Under the table, strips of cells show the working for the current token: its query, every key, the score against each key, the scores after division, the exponentials, the weights, the values and the output vector. The last frame shows the full attention table and a table of the output vectors.',
    inputs: [
      { id: 'tokens', type: 'text', label: 'Tokens', default: DEFAULTS.tokens, maxLength: 44,
        help: 'One to six words from this list, separated by spaces: the, a, dog, cat, mat, saw, sat, chased. Each has a fixed vector written by hand for this page.' },
      { id: 'positions', type: 'toggle', label: 'Add position information', default: false,
        help: 'Adds a different fixed vector to the token at each position, using the sine and cosine formula of the original transformer.' },
      { id: 'mask', type: 'toggle', label: 'Hide later tokens (causal mask)', default: false,
        help: 'Each token may look only at itself and the tokens before it, as in a model that generates text from left to right.' },
      { id: 'scale', type: 'toggle', label: 'Divide scores by √d', default: true,
        help: 'The scaling step. Here d is 4, so scores are divided by 2. Switch it off to see what it is for.' },
    ],
    presets: [
      { label: 'The dog saw the cat', values: { ...DEFAULTS } },
      { label: 'Same words, shuffled', values: { ...DEFAULTS, tokens: 'cat the saw dog the' } },
      { label: 'With position information', values: { ...DEFAULTS, positions: true } },
      { label: 'Causal mask', values: { ...DEFAULTS, mask: true } },
      { label: 'No scaling', values: { ...DEFAULTS, scale: false } },
      { label: 'One word, three times', values: { ...DEFAULTS, tokens: 'the the the' } },
    ],
    tryThis: [
      'Run the default and compare rows 1 and 4 of the attention table, the two copies of "the". They are identical, and so are their outputs. Then load "With position information" and compare the same two rows: they now differ. Position information is the only thing that told them apart.',
      'Load "Same words, shuffled". The tokens are in a different order, and each word\'s row holds the same weights as before, moved to the new columns. With no position information, the calculation treats the sentence as a bag of words.',
      'Load "Causal mask". Row 1 can see only itself, so its whole weight is 1 on its own token. Now the two copies of "the" get different outputs even without position information, because the second one can see more tokens.',
      'Load "No scaling" and look at the row for "cat". Its largest weight rises from 0.498 to 0.765. The scores were twice as large, and softmax turns larger gaps between scores into more lopsided weights.',
      'Load "One word, three times". Every score is the same, so every weight is one third, and each output is simply the value of "the".',
    ],
    run,
    report: (r, c) => `Tokens: ${r.tokens.join(' ')}\nOne head, vectors of ${r.d} numbers.${r.positions ? ' Position vectors added.' : ' No position information.'}${r.mask ? ' Causal mask on.' : ''}${r.scale ? ` Scores divided by ${num(r.divisor)}.` : ' Scores not scaled.'}\n\nAttention weights (row: the token looking, column: the token looked at):\n${r.weights.map((row, i) => `  ${r.labels[i].padEnd(9)} ${row.map(f3).join('  ')}`).join('\n')}\n\nOutput vectors:\n${r.outputs.map((o, i) => `  ${r.labels[i].padEnd(9)} ${o.map(f3).join('  ')}`).join('\n')}\n\n${c['scores computed'] || 0} query-key scores computed. The vectors and matrices were chosen by hand. Nothing here was trained.`,
    experiment: {
      title: 'Scores computed as the sequence grows',
      note: 'Each point is a real run of one attention step on a sequence of n tokens, counting the query-key scores it computes. Every token is scored against every token, so doubling the length multiplies the work by four. With a causal mask each token looks only at itself and what came before, which is about half as many scores and still grows with the square of the length. This growth is why the amount of text a transformer can take in at once is limited.',
      metric: 'scores computed',
      metricLabel: 'Query-key scores',
      sizeLabel: 'Number of tokens (n)',
      sizes: [2, 4, 8, 16, 32, 64],
      variants: [
        { id: 'full', label: 'Every token sees every token' },
        { id: 'masked', label: 'Causal mask' },
      ],
      input: (n, variant) => ({ tokens: Array.from({ length: n }, (_, i) => WORDS[i % WORDS.length]).join(' '), positions: false, mask: variant === 'masked', scale: true, unlimited: true }),
      theory: [
        { label: 'n²', fn: (n) => n * n, variant: 'full' },
        { label: 'n(n + 1)/2', fn: (n) => (n * (n + 1)) / 2, variant: 'masked' },
      ],
    },
  },

  logic: {
    intuition: 'Attention is a soft version of looking something up. An ordinary lookup takes a query, finds the one stored key that equals it, and returns that key\'s value. Attention replaces "equals" with "how well does it match", measured by a dot product, and returns a weighted average of all the values. Because every step is smooth arithmetic, the matrices that produce queries, keys and values can be adjusted by [backpropagation](#/algorithm/backpropagation) until the lookups are useful.\n\nOne attention step only moves information between positions. A transformer puts it inside a block and repeats the block many times:\n\n- **Position information.** Before the first block, each token\'s vector is combined with a vector that depends on its position. Without this the model could not tell "dog saw cat" from "cat saw dog".\n- **Several heads.** A layer runs several attention steps side by side, each with its own three matrices, and joins their outputs. Different heads can attend to different things.\n- **Residual connection.** The output of the attention layer is added to its input. Each block therefore adjusts the vectors instead of replacing them.\n- **Feed-forward layer.** Each token\'s vector is then passed, on its own, through a small two-layer network. The same network is used at every position. This has a residual connection too.\n- **Normalization.** The vectors are rescaled around these steps, which keeps training stable.\n\nTo produce text, the vector at the last position after the final block is turned into one score for every token in the vocabulary. Softmax turns the scores into probabilities, one token is picked, it is added to the end of the input, and the whole calculation runs again for the next one.',
    steps: [
      'Turn every token into a vector by looking it up in a table. If position information is used, combine it with the token\'s vector now.',
      'From each token\'s vector compute three more with three matrices: its query, its key and its value.',
      'For a token i, compute a score against every token j it is allowed to look at: the dot product of i\'s query with j\'s key.',
      'Divide the scores by the square root of the number of entries in a key.',
      'Apply softmax to the row of scores: raise e to each one, then divide by the total. The results are the attention weights of token i, and they add up to 1.',
      'The output for token i is the sum of all the value vectors, each multiplied by its weight. Do steps 3 to 6 for every token.',
    ],
    pseudocode: [
      'attention(tokens):',
      '  x[i] ← vector of token i (plus its position vector, if used)',
      '  q[i] ← W_Q x[i];  k[i] ← W_K x[i];  v[i] ← W_V x[i]',
      '  for each token i:',
      '    for each token j that i may look at:',
      '      score[j] ← (q[i] · k[j]) / √d',
      '    weight ← softmax(score)',
      '    output[i] ← Σ weight[j] × v[j]',
      '  return output',
    ],
    decisions: [
      { title: 'Why three vectors for each token?', text: 'A token plays three parts. When it looks, it uses its query. When it is looked at, it shows its key. When it is chosen, it hands over its value. Keeping these apart lets the pattern be lopsided: a pronoun can look hard for a noun without the noun looking for the pronoun. With a single vector for all three parts, the score of a pair would be the same in both directions.' },
      { title: 'Why a dot product?', text: 'It is cheap, and all the scores for a whole sequence come from one matrix multiplication, which graphics processors do very fast. The earliest attention mechanisms scored a pair with a small neural network instead. The transformer paper chose the dot product because it is faster and uses less memory in practice.' },
      { title: 'Why divide by √d?', text: 'If the entries of a query and a key are independent with mean 0 and variance 1, their dot product has variance d, so typical scores grow like √d. Large scores push softmax towards putting all its weight on one token, where its slope is close to zero and training slows down. Dividing by √d keeps the scores at a similar size whatever the vector length.' },
      { title: 'Why softmax?', text: 'It gives weights that are positive and add up to 1, so the output is a weighted average of the values and stays on the same scale as they are. It is smooth, so gradients pass through it. And it is selective: a clear lead in score becomes a clear lead in weight.' },
      { title: 'Why the mask?', text: 'A model that generates text is trained to predict each token from the ones before it. If a position could attend to later tokens during training, it could simply copy the answer. The causal mask sets those scores to minus infinity before softmax, which makes their weights exactly 0.' },
      { title: 'Why add position vectors instead of building order in?', text: 'Leaving order out of the layer keeps every position equal: any token reaches any other in one step. Order is then supplied as data. The original transformer added fixed sine and cosine patterns to the token vectors, and reported nearly the same results with position vectors that were learned. Many later models encode the distance between two tokens inside the attention score instead.' },
    ],
    invariants: [
      'Every row of attention weights is made of numbers between 0 and 1 that add up to 1.',
      'Every output is a weighted average of the value vectors, so each of its entries lies between the smallest and the largest entry that the values have in that place.',
      'With no position information and no mask, tokens that are equal get equal outputs, and reordering the input reorders the outputs in the same way.',
      'With a causal mask, the output at a position depends only on that token and the ones before it. Changing a later token cannot change it.',
    ],
    edgeCases: [
      'A single token: it can only attend to itself, its weight is 1, and its output is its own value.',
      'All scores in a row equal: softmax gives every token the same weight, and the output is the plain average of the values.',
      'Very large scores: e raised to a large number overflows. Implementations subtract the largest score in the row from all of them first, which leaves the weights unchanged.',
      'One score far above the rest: its weight is almost 1 and the others almost 0. The layer then behaves like a hard lookup, and very little gradient reaches the other tokens.',
      'The same token twice with no position information: both copies get the same output. This is correct behaviour for the layer, and the reason position information exists.',
      'A row with every token masked has no weights at all: softmax would divide 0 by 0. A causal mask never does this, because a token can always see itself.',
      'Sequences of different lengths processed together are padded to one length, and the padding tokens are masked so that nothing attends to them.',
    ],
    correctness: 'This is a calculation, not a search, so being correct means computing $\\mathrm{softmax}(QK^\\top/\\sqrt{d})\\,V$ and nothing else. The properties above follow directly. Each weight is $e^{s_j}$ divided by the sum of such terms, so it is positive and the row sums to 1. The output is then a convex combination of the values. If the tokens are reordered and there is no position information or mask, each token still has the same query, key and value, and meets the same set of keys, so it gets the same weights on the same tokens and the same output: the output is reordered exactly as the input was. The tests on this page check each of these, and compare the weights and outputs with a second computation that shares no code with the first.\n\nWhat the calculation does not guarantee is that the weights mean anything. That depends entirely on the matrices. Here they were chosen by hand to give a readable pattern. In a trained model they are whatever training found, and whether a head\'s weights can be read as an explanation of the model\'s behaviour is disputed in the research literature.',
    mistakes: [
      'Applying softmax down the columns instead of along the rows. The weights that must add up to 1 are those of one token looking at all the others.',
      'Applying the mask after softmax. Zeroing weights afterwards leaves a row that no longer adds up to 1. The mask belongs on the scores, before softmax.',
      'Leaving out the division by √d, which makes training unstable for long vectors.',
      'Swapping the roles of query and key, so that the table is transposed and each token receives the weights meant for another.',
      'Forgetting position information and then wondering why the model ignores word order.',
      'Raising e to large scores without first subtracting the largest, which overflows.',
      'Reading attention weights as proof of what the model "was thinking".',
    ],
  },

  code: {
    sample: {
      input: 'One attention step on the five tokens "the dog saw the cat", with the same hand-written vectors and matrices as the demonstration: no position information, no mask, scores divided by 2. This is a forward calculation with fixed numbers. Nothing is trained. The programs print the attention weights, with the sum of each row, and then the output vector of each token.',
      expected: 'weights (row: the token looking, column: the token looked at)\nthe  0.169 0.279 0.103 0.169 0.279  sum 1.000\ndog  0.110 0.181 0.299 0.110 0.299  sum 1.000\nsaw  0.084 0.375 0.084 0.084 0.375  sum 1.000\nthe  0.169 0.279 0.103 0.169 0.279  sum 1.000\ncat  0.067 0.183 0.183 0.067 0.498  sum 1.000\noutputs\nthe  1.396 0.103 0.339 1.676\ndog  1.261 0.299 0.220 1.560\nsaw  1.873 0.084 0.167 2.248\nthe  1.396 0.103 0.339 1.676\ncat  1.862 0.183 0.135 2.360',
    },
    python: {
      source: `import math

TOKENS = ["the", "dog", "saw", "the", "cat"]
VECTORS = {"the": [0, 0, 1, 0], "dog": [1, 0, 0, 1], "saw": [0, 1, 0, 0], "cat": [1, 0, 0, 2]}
W_Q = [[0, 3, 2, 0], [2, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]]  # makes each query
W_K = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]]  # makes each key
W_V = [[1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 2]]  # makes each value


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def times(matrix, vector):
    return [dot(row, vector) for row in matrix]


def softmax(scores):
    exps = [math.exp(s) for s in scores]
    total = sum(exps)
    return [e / total for e in exps]


def attention(tokens):
    x = [VECTORS[t] for t in tokens]
    queries = [times(W_Q, v) for v in x]
    keys = [times(W_K, v) for v in x]
    values = [times(W_V, v) for v in x]
    scale = math.sqrt(len(keys[0]))
    weights, outputs = [], []
    for q in queries:
        row = softmax([dot(q, k) / scale for k in keys])
        weights.append(row)
        outputs.append([sum(w * v[c] for w, v in zip(row, values)) for c in range(len(values[0]))])
    return weights, outputs


def show(numbers):
    return " ".join(f"{n:.3f}" for n in numbers)


weights, outputs = attention(TOKENS)
print("weights (row: the token looking, column: the token looked at)")
for token, row in zip(TOKENS, weights):
    print(f"{token}  {show(row)}  sum {sum(row):.3f}")
print("outputs")
for token, out in zip(TOKENS, outputs):
    print(f"{token}  {show(out)}")`,
      notes: [
        { line: 4, text: 'The vectors and the three matrices below are fixed numbers written by hand. In a trained model they would be learned.' },
        { line: 21, text: 'Softmax: every exponential is positive, and dividing by their total makes the row add up to 1.' },
        { line: 26, text: 'Each token\'s query, key and value come from its own vector, through three different matrices.' },
        { line: 32, text: 'One row of the attention table: this token\'s query against every key, divided by the square root of the key length, then softmax.' },
        { line: 34, text: 'The output is the weighted sum of the value vectors, worked out one entry at a time.' },
      ],
    },
    javascript: {
      source: `const TOKENS = ["the", "dog", "saw", "the", "cat"];
const VECTORS = { the: [0, 0, 1, 0], dog: [1, 0, 0, 1], saw: [0, 1, 0, 0], cat: [1, 0, 0, 2] };
const W_Q = [[0, 3, 2, 0], [2, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]];  // makes each query
const W_K = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]];  // makes each key
const W_V = [[1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 2]];  // makes each value

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const times = (matrix, vector) => matrix.map((row) => dot(row, vector));

function softmax(scores) {
  const exps = scores.map((s) => Math.exp(s));
  const total = exps.reduce((sum, e) => sum + e, 0);
  return exps.map((e) => e / total);
}

function attention(tokens) {
  const x = tokens.map((t) => VECTORS[t]);
  const queries = x.map((v) => times(W_Q, v));
  const keys = x.map((v) => times(W_K, v));
  const values = x.map((v) => times(W_V, v));
  const scale = Math.sqrt(keys[0].length);
  const weights = [];
  const outputs = [];
  for (const q of queries) {
    const row = softmax(keys.map((k) => dot(q, k) / scale));
    weights.push(row);
    outputs.push(values[0].map((_, c) => row.reduce((sum, w, j) => sum + w * values[j][c], 0)));
  }
  return [weights, outputs];
}

const show = (numbers) => numbers.map((n) => n.toFixed(3)).join(" ");

const [weights, outputs] = attention(TOKENS);
console.log("weights (row: the token looking, column: the token looked at)");
TOKENS.forEach((token, i) => {
  const sum = weights[i].reduce((s, w) => s + w, 0);
  console.log(token + "  " + show(weights[i]) + "  sum " + sum.toFixed(3));
});
console.log("outputs");
TOKENS.forEach((token, i) => console.log(token + "  " + show(outputs[i])));`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <vector>

using Vec = std::vector<double>;
using Mat = std::vector<Vec>;

const char* NAMES[4] = {"the", "dog", "saw", "cat"};
const Mat VECTORS = {{0, 0, 1, 0}, {1, 0, 0, 1}, {0, 1, 0, 0}, {1, 0, 0, 2}};
const int TOKENS[5] = {0, 1, 2, 0, 3};  // the dog saw the cat
const Mat W_Q = {{0, 3, 2, 0}, {2, 0, 0, 0}, {0, 0, 0, 1}, {0, 0, 1, 0}};  // makes each query
const Mat W_K = {{1, 0, 0, 0}, {0, 1, 0, 0}, {0, 0, 0, 1}, {0, 0, 1, 0}};  // makes each key
const Mat W_V = {{1, 0, 0, 1}, {0, 1, 0, 0}, {0, 0, 1, 0}, {0, 0, 0, 2}};  // makes each value

double dot(const Vec& a, const Vec& b) {
    double sum = 0;
    for (std::size_t i = 0; i < a.size(); ++i) sum += a[i] * b[i];
    return sum;
}

Vec times(const Mat& matrix, const Vec& vector) {
    Vec out;
    for (const Vec& row : matrix) out.push_back(dot(row, vector));
    return out;
}

Vec softmax(const Vec& scores) {
    Vec out;
    double total = 0;
    for (double s : scores) { out.push_back(std::exp(s)); total += out.back(); }
    for (double& e : out) e /= total;
    return out;
}

void show(const Vec& numbers) {
    for (double n : numbers) std::printf(" %.3f", n);
}

int main() {
    Mat queries, keys, values;
    for (int t : TOKENS) {
        queries.push_back(times(W_Q, VECTORS[t]));
        keys.push_back(times(W_K, VECTORS[t]));
        values.push_back(times(W_V, VECTORS[t]));
    }
    const double scale = std::sqrt(static_cast<double>(keys[0].size()));
    Mat weights, outputs;
    for (const Vec& q : queries) {
        Vec scores;
        for (const Vec& k : keys) scores.push_back(dot(q, k) / scale);
        Vec row = softmax(scores);
        Vec out(values[0].size(), 0.0);
        for (std::size_t j = 0; j < values.size(); ++j)
            for (std::size_t c = 0; c < out.size(); ++c) out[c] += row[j] * values[j][c];
        weights.push_back(row);
        outputs.push_back(out);
    }
    std::printf("weights (row: the token looking, column: the token looked at)\\n");
    for (int i = 0; i < 5; ++i) {
        double sum = 0;
        for (double w : weights[i]) sum += w;
        std::printf("%s ", NAMES[TOKENS[i]]);
        show(weights[i]);
        std::printf("  sum %.3f\\n", sum);
    }
    std::printf("outputs\\n");
    for (int i = 0; i < 5; ++i) {
        std::printf("%s ", NAMES[TOKENS[i]]);
        show(outputs[i]);
        std::printf("\\n");
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'For n tokens with vectors of d numbers, one attention step computes n² scores, each a sum of d products, and n outputs, each a blend of n values: O(n² · d) time and O(n²) memory for the weights. The sequence length enters squared. Everything else in a transformer block treats the tokens one at a time and costs O(n · d²).',
    cases: [
      { case: 'One attention step, one head', time: 'O(n² · d)', when: 'Every token scores every token. The chart counts exactly n² scores.' },
      { case: 'With a causal mask', time: 'O(n² · d)', when: 'Each token scores itself and the earlier ones only: n(n + 1)/2 scores. That is about half, and still quadratic.' },
      { case: 'One transformer block', time: 'O(n² · d + n · d²)', when: 'Attention, plus the matrices applied to each token separately: making queries, keys and values, and the feed-forward layer. The second term assumes a feed-forward layer whose width is a fixed multiple of d.' },
      { case: 'Generating one more token, with stored keys and values', time: 'O(n · d + d²) per block', when: 'Under a causal mask the earlier tokens\' keys and values never change, so they are kept. The new token computes its own three vectors and one row of scores.' },
    ],
    space: 'O(n²) for the attention weights of one head, and O(n · d) for the queries, keys, values and outputs.',
    memory: 'The n² weights exist for every head of every layer, and during training all of them must be kept for the backward pass. This is the main reason the context length of a transformer is limited, and why halving the context saves far more than half the memory of the attention layers.',
    tradeoffs: 'Attention buys direct contact between any two positions, in one step and in parallel, and pays for it with work and memory that grow with the square of the length. A recurrent network makes the opposite trade: work linear in the length, but information between distant positions must survive every step in between, and the steps cannot be run in parallel.',
    assumptions: [
      'n is the number of tokens and d the number of entries in each vector. Queries, keys and values all have d entries here, and there is one head.',
      'Arithmetic on one pair of numbers is counted as one step.',
      'The chart counts query-key scores, each of which costs d multiplications. It does not measure time. Real implementations compute all the scores as one matrix product on hardware built for that.',
      'The bounds are for running the layer. How long a transformer takes to train has no simple formula.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Long sequences. Twice the tokens means four times the scores and four times the memory for the weights.',
      'Small training sets. Almost nothing about the task is built into the layer, so it has to learn from data what other designs assume from the start.',
      'Order, unless it is supplied. The layer itself treats its input as an unordered set.',
      'Exact, step-by-step procedures such as long arithmetic, where blending many values is a poor substitute for carrying out the steps.',
    ],
    pitfalls: [
      'A wrong softmax axis or a misplaced mask does not crash anything. The model simply trains badly, or learns to cheat by looking at tokens it should not see.',
      'Text must be cut into tokens first, and the choice of tokenizer changes what the model sees. See [byte-pair encoding](#/algorithm/byte-pair-encoding).',
      'Numbers that are fine in ordinary precision can overflow or lose accuracy in the half-precision arithmetic often used for speed.',
    ],
    misunderstandings: [
      '"This page shows how ChatGPT works." It shows the one calculation that the transformer design is built around, at toy size, with numbers written by hand. A model like that has learned weights, many layers and many heads, and its makers publish few details of its insides.',
      '"The attention weights show what the model is thinking." They show how one layer mixed its inputs. Whether they explain the model\'s final answer is disputed among researchers, and a large weight is not proof that a token mattered.',
      '"Attention is the whole transformer." Each block also has a feed-forward layer, and in the original design that layer holds about twice as many weights as the attention layer of the same block.',
      '"Each word attends to one other word." Every token puts some weight on every token it can see. The weights can be spread thinly or concentrated, but softmax never makes one exactly zero.',
      '"The model looks things up in a stored copy of its training text." The lookup in attention is among the tokens of the current input only. What the model learned from training is held in its weights, not in stored text.',
      '"A transformer reads text one word at a time, like a person." It processes all the positions of its input at once. Only the output is produced one token at a time.',
    ],
    constraints: [
      'A model has a maximum input length, fixed by how it was built and trained and by the memory that n² weights need.',
      'Useful models need very large amounts of training data and computing power. The arithmetic on this page is the easy part.',
    ],
    alternatives: [
      { name: 'Recurrent networks (LSTM, GRU)', when: 'Sequences arrive one item at a time and memory must stay fixed. Information between distant items has to pass through every step in between.' },
      { id: 'convolution', name: 'Convolutional networks', when: 'What matters is mostly local, as with neighbouring pixels in an image, and you want that assumption built in.' },
      { name: 'Sparse, local or approximate attention', when: 'The sequence is too long for every pair to be scored. Each token attends to a chosen subset, at some cost in what it can reach.' },
      { id: 'graph-neural-network', name: 'Graph neural networks', when: 'You already know which items are related, as a graph, and want information to flow only along those links.' },
    ],
    comparison: {
      columns: ['', 'Self-attention', 'Recurrent layer', 'Convolutional layer'],
      rows: [
        ['Work per layer', 'O(n² · d)', 'O(n · d²)', 'O(k · n · d²) for width k'],
        ['Steps that must run one after another', 'O(1)', 'O(n)', 'O(1)'],
        ['Layers between two distant positions', 'One', 'Up to n steps', 'Grows with the distance'],
        ['Knows the order of the sequence', 'Only if position information is added', 'Yes, by construction', 'Yes, within its window'],
      ],
    },
  },

  applications: [
    { title: 'Machine translation', status: 'established', text: 'The transformer was introduced in 2017 as a translation model, and tested on English to German and English to French. An encoder stack reads the source sentence, and a decoder stack writes the translation while attending both to what it has written and to the encoder\'s output.' },
    { title: 'Large language models', status: 'established', text: 'OpenAI\'s GPT models, whose name stands for generative pre-trained transformer, and Google\'s BERT are transformers. OpenAI\'s technical report on GPT-4 describes it as a Transformer-style model pre-trained to predict the next token in a document. Beyond statements like that, the makers of commercial models publish few details, and this page makes no claims about them.' },
    { title: 'Image recognition', status: 'established', text: 'The vision transformer of Dosovitskiy and colleagues cuts an image into square patches, treats each patch as a token, and applies a standard transformer. Trained on enough images, it matched the best convolutional networks of the time.' },
    { title: 'Protein structure prediction', status: 'established', text: 'AlphaFold 2, published in 2021, predicts the three-dimensional shape of a protein from its sequence with a network built largely from attention layers, including attention between pairs of positions in the chain.' },
    { title: 'Image generation from text', status: 'established', text: 'The denoising networks of diffusion models contain attention layers, and text-to-image systems use a form called cross-attention, in which positions in the image supply the queries and the tokens of the prompt supply the keys and values. See [diffusion models](#/algorithm/ddpm).' },
    { title: 'Recommending the next item', status: 'illustrative', text: 'A user\'s history of viewed items is a sequence, and a model can attend over it to weigh which earlier items say most about what comes next.' },
  ],

  connections: [
    { to: 'backpropagation', type: 'prerequisite', why: 'Every operation in attention is differentiable, so backpropagation can pass the error at a transformer\'s output back through the softmax and the dot products to the query, key and value matrices. That is how those matrices are learned.' },
    { to: 'concept:matrix', type: 'prerequisite', why: 'Attention is matrix arithmetic: queries, keys and values are each a matrix times the token vectors, and all the scores of a sequence are one matrix product.' },
    { to: 'concept:neural-network', type: 'prerequisite', why: 'A transformer is a neural network in which attention layers alternate with ordinary feed-forward layers, and all of its weights are trained together.' },
    { to: 'gradient-descent', type: 'related', why: 'Gradient descent is the rule that changes a transformer\'s weights. The hand-written matrices in the attention demonstration stand where numbers found by gradient descent would be in a trained model.' },
    { to: 'logistic-regression', type: 'related', why: 'Logistic regression turns one score into a probability with the logistic function. The softmax in attention does the same for a whole row of scores, turning them into shares that add up to 1.' },
    { to: 'byte-pair-encoding', type: 'related', why: 'Byte-pair encoding cuts text into the tokens that attention then works on. A transformer never sees letters or words, only the tokens its tokenizer produces.' },
    { to: 'hash-table', type: 'related', why: 'A hash table returns the one value whose key equals the query. Attention is a soft version of the same lookup: every key is scored against the query, and the answer is a weighted mix of all the values.' },
    { to: 'knn', type: 'related', why: 'k-nearest neighbours answers a query from the few stored examples closest to it. Attention weighs every token by how well its key matches the query, a soft form of the same idea in which no neighbour is left out entirely.' },
    { to: 'ddpm', type: 'application', why: 'The denoising network of a diffusion model usually contains attention layers, and text-to-image diffusion uses attention to let each part of the image draw on the tokens of the prompt.' },
    { to: 'convolution', type: 'same-problem', why: 'A convolution and an attention layer both compute a new value for each position from other positions. A convolution uses a fixed neighbourhood and fixed weights, while attention reaches every position and computes its weights from the content.' },
    { to: 'graph-neural-network', type: 'related', why: 'Self-attention is message passing on a graph in which every token is joined to every other and the strength of each link is computed from the tokens. A graph neural network passes messages along links that are given.' },
    { to: 'adam', type: 'related', why: 'The original transformer was trained with the Adam optimizer, which takes the gradients that backpropagation sends through the attention layers and sets the step size for each weight.' },
    { to: 'discipline:nlp', type: 'application', why: 'Translation, summarising, question answering and text generation are now mostly done with transformers, in which attention carries information between the tokens of a text.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Vision transformers apply attention to the patches of an image, so that any region can draw on any other in a single layer.' },
    { to: 'discipline:biology', type: 'application', why: 'Protein structure prediction uses attention to relate positions that are far apart along a protein chain but close together once it folds.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'After softmax, what is true of the attention weights in one row of the table?',
      options: ['They are positive and add up to 1', 'Exactly one of them is 1 and the rest are 0', 'They add up to the number of tokens', 'They can be negative when a score is negative'],
      answer: 0,
      explain: [
        'Each weight is e raised to a score, which is always positive, divided by the total of all of them, so the row adds up to 1.',
        'That would be a hard choice of one token. Softmax spreads the weight, giving larger shares to larger scores.',
        'Each row is divided by its own total, so it adds up to 1 however many tokens there are.',
        'A negative score gives a small weight, not a negative one, because e raised to any power is positive.',
      ],
    },
    {
      type: 'predict',
      q: 'The sequence "the dog saw the cat" contains "the" twice. With no position information and no mask, how do the outputs for the two copies compare?',
      options: ['They are exactly the same', 'They differ, because each "the" stands next to different words', 'The second is larger, because it comes later', 'They are the same size but point in opposite directions'],
      answer: 0,
      explain: [
        'Both start from the same vector, so they make the same query and the same key, meet the same set of keys, and get the same weights. Nothing in the calculation records where a token stands.',
        'The layer has no notion of "next to". Every token is compared with every token, whatever lies between them.',
        'Nothing in the calculation counts positions unless position information is added.',
        'Identical inputs to the same arithmetic give identical results.',
      ],
      tryInput: { ...DEFAULTS },
    },
    {
      type: 'predict',
      q: 'Now switch on the causal mask, still with no position information. Are the outputs for the two copies of "the" still the same?',
      options: ['Yes, because they are still the same word', 'No. The first can see only itself, and the second can see four tokens', 'No, because the mask changes the vector of each token', 'Yes, because the mask only affects the last token'],
      answer: 1,
      explain: [
        'The same word starts from the same vector, but the two copies no longer look at the same tokens.',
        'The first "the" puts its whole weight on itself. The second spreads its weight over itself and the three tokens before it. Different weights give different outputs.',
        'The mask changes nothing about the vectors. It only removes some tokens from view.',
        'The mask affects every row except the last, which can see everything anyway.',
      ],
      tryInput: { ...DEFAULTS, mask: true },
    },
    {
      type: 'debug',
      q: 'This code is meant to apply a causal mask, so that token i attends only to tokens 0 to i. Training goes badly. What is wrong?',
      code: `for i in range(n):
    scores = [dot(q[i], k[j]) / math.sqrt(d) for j in range(n)]
    weights = softmax(scores)
    for j in range(i + 1, n):
        weights[j] = 0.0
    output[i] = blend(weights, v)`,
      options: ['The scores should be multiplied by √d, not divided', 'The mask is applied after softmax, so the weights that remain no longer add up to 1', 'The inner loop should start at i, so that a token cannot see itself', 'softmax should be applied to the keys, not the scores'],
      answer: 1,
      explain: [
        'Dividing by √d is right. It keeps the scores from growing with the vector length.',
        'Softmax shared the weight among all n tokens, and then some of it was thrown away. Set the hidden scores to minus infinity before softmax, and the visible tokens share the whole weight.',
        'A token may attend to itself. Hiding it would leave the first token with nothing to look at.',
        'Softmax turns scores into weights. Keys are vectors, used to compute the scores.',
      ],
    },
    {
      type: 'choice',
      q: 'A sequence grows from 1,000 tokens to 2,000. Roughly how does the number of query-key scores in one attention step change?',
      options: ['It doubles', 'It becomes four times as large', 'It stays the same, because the vectors are the same length', 'It grows by 1,000'],
      answer: 1,
      explain: [
        'Doubling would be true if each token looked at a fixed number of others. Here each of twice as many tokens looks at twice as many.',
        'Every token is scored against every token, so the count is the square of the length: 1,000,000 becomes 4,000,000.',
        'The vector length sets the cost of one score, not how many scores there are.',
        'That would be growth in step with the length. The count grows with its square.',
      ],
    },
    {
      type: 'challenge',
      title: 'Two heads and a sense of order',
      prompt: 'Extend the sample program in two ways. First, add a second head: a second set of three matrices of your own choosing. Run both heads on the same tokens, join each token\'s two outputs end to end into one vector of eight numbers, and print it. Second, add position vectors before the queries, keys and values are made, using sine and cosine of the position as the demonstration does. Check three things with your program: every row of weights in both heads adds up to 1, the two copies of "the" get the same output without position vectors, and they get different outputs with them.',
      hints: ['Write attention so that it takes the three matrices as arguments. Each head is then one call.', 'To test the "same output" claim, compare the vectors entry by entry instead of comparing printed text, which can hide small differences.'],
    },
  ],

  compare: {
    idea: 'Every token scores every token with a query-key dot product, softmax turns each row of scores into weights, and the output is the weighted sum of the values.',
    requires: 'A sequence that has already been turned into lists of numbers, one list for each item. A way of telling the model what order the items are in, because this step ignores order. And, for a model that is any use, a great deal of example data and computing power to train it.',
    sensitivity: 'Once the weights are fixed, the same input always gives the same output. The cost depends on the square of the sequence length and hardly at all on what the tokens are.',
    memory: 'One weight for every pair of tokens: O(n²) for each head, plus the vectors.',
    difficulty: 'high',
    difficultyNote: 'The calculation is a few lines of arithmetic. Building and training a transformer that does something useful is a large engineering job.',
    limits: 'The work grows fast with length: twice as many items means four times as many comparisons. It has to be trained on a great deal of data before the comparisons mean anything. On its own it cannot tell what order the items came in.',
    useWhen: 'Each item in a sequence needs information from other items that may be far away, such as the words of a sentence, and you have the data and computing power to train a large model.',
  },

  advanced: {
    history: 'Attention entered neural networks through machine translation. In a paper posted in 2014 and published in 2015, Dzmitry Bahdanau, Kyunghyun Cho and Yoshua Bengio let a recurrent translation model compute, for each word it produced, a set of weights over the words of the source sentence, and use the weighted average of their representations. Their scores came from a small neural network. In 2015 Minh-Thang Luong, Hieu Pham and Christopher Manning compared several scoring functions, among them a plain dot product. In 2017 Ashish Vaswani and seven co-authors, in "Attention Is All You Need", removed the recurrent network altogether. Their model, the transformer, was built from attention and feed-forward layers alone. The paper introduced scaled dot-product attention in the form shown on this page, attention with several heads, and sine and cosine position vectors. In 2018 two papers showed what the design could do when trained on large amounts of unlabelled text: GPT, from Alec Radford and colleagues at OpenAI, trained a transformer to predict the next token, and BERT, from Jacob Devlin and colleagues at Google, trained one to fill in tokens that had been hidden. Work on vision transformers, from 2020, carried the same layer over to images.',
    derivation: 'Write $x_i \\in \\mathbb{R}^d$ for the vector of token $i$. One head computes\n\n$$q_i = W_Q x_i, \\qquad k_i = W_K x_i, \\qquad v_i = W_V x_i,$$\n\n$$\\alpha_{ij} = \\frac{\\exp\\!\\left(q_i \\cdot k_j / \\sqrt{d_k}\\right)}{\\sum_{l} \\exp\\!\\left(q_i \\cdot k_l / \\sqrt{d_k}\\right)}, \\qquad z_i = \\sum_j \\alpha_{ij}\\, v_j,$$\n\nwhere $d_k$ is the number of entries in a key. With the vectors stacked as the rows of matrices $Q$, $K$ and $V$, this is the formula of the transformer paper:\n\n$$\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right) V.$$\n\nA causal mask adds $-\\infty$ to the score of every pair with $j > i$ before the softmax.\n\n**Why $\\sqrt{d_k}$.** If the entries of $q$ and $k$ are independent with mean 0 and variance 1, then $q \\cdot k = \\sum_{c=1}^{d_k} q_c k_c$ has mean 0 and variance $d_k$. Dividing by $\\sqrt{d_k}$ brings the variance back to 1.\n\n**Several heads.** With $h$ heads, each has its own matrices and the original design gives each head keys of $d/h$ entries. The outputs of the heads are joined end to end and multiplied by one more matrix: $\\mathrm{MultiHead}(X) = [Z^{(1)}, \\ldots, Z^{(h)}]\\,W_O$.\n\n**The block.** In the original transformer one encoder block maps the token vectors $X$ to\n\n$$Y = \\mathrm{LayerNorm}\\big(X + \\mathrm{MultiHead}(X)\\big), \\qquad X\' = \\mathrm{LayerNorm}\\big(Y + \\mathrm{FFN}(Y)\\big),$$\n\nwith $\\mathrm{FFN}(y) = W_2 \\max(0, W_1 y + b_1) + b_2$ applied to each position separately. The terms $X + \\cdots$ and $Y + \\cdots$ are the residual connections. Many later models apply the normalization to the input of each sub-layer instead of to its output.\n\n**Position.** The original position vector has entries\n\n$$PE_{(p,\\,2i)} = \\sin\\!\\big(p / 10000^{2i/d}\\big), \\qquad PE_{(p,\\,2i+1)} = \\cos\\!\\big(p / 10000^{2i/d}\\big),$$\n\nand is added to the token vector before the first block. For $d = 4$ this is $(\\sin p, \\cos p, \\sin(p/100), \\cos(p/100))$, which is what the demonstration adds.\n\n**Output.** A language model multiplies the final vector at each position by a matrix with one row per vocabulary token and applies softmax, giving a probability for every possible next token. Training lowers the cross-entropy between those probabilities and the token that actually came next.',
    proof: '**Claim.** With no position information and no mask, self-attention commutes with reordering: if the tokens are permuted, the outputs are permuted in the same way. In particular, equal tokens get equal outputs.\n\n**Proof.** Let $\\pi$ be a permutation and let the reordered input be $x\'_i = x_{\\pi(i)}$. Queries, keys and values are computed from each vector separately, so $q\'_i = q_{\\pi(i)}$, $k\'_i = k_{\\pi(i)}$ and $v\'_i = v_{\\pi(i)}$. Then the score $q\'_i \\cdot k\'_j$ equals $q_{\\pi(i)} \\cdot k_{\\pi(j)}$. The softmax of row $i$ sums over all $j$, and as $j$ runs over all positions so does $\\pi(j)$, so the denominator is the same as in row $\\pi(i)$ of the original, and $\\alpha\'_{ij} = \\alpha_{\\pi(i)\\pi(j)}$. Therefore\n\n$$z\'_i = \\sum_j \\alpha_{\\pi(i)\\pi(j)}\\, v_{\\pi(j)} = \\sum_m \\alpha_{\\pi(i)m}\\, v_m = z_{\\pi(i)}.$$\n\nIf $x_a = x_b$, take $\\pi$ to be the swap of $a$ and $b$. The input is unchanged, so $z_a = z\'_a = z_b$. $\\blacksquare$\n\nA causal mask breaks the argument, because the sum in row $i$ then runs only over $j \\le i$, and that set is not preserved by $\\pi$.',
    complexityProof: 'Making the queries, keys and values is three matrix-vector products per token, $O(d^2)$ each, so $O(n d^2)$. There are $n^2$ ordered pairs $(i, j)$, and each score is a dot product of $d$ terms: $O(n^2 d)$. The softmax of one row costs $O(n)$, so $O(n^2)$ over all rows. Each output is a sum of $n$ vectors of $d$ entries: $O(n^2 d)$ in total. The attention step itself is therefore $O(n^2 d)$, and the block around it adds $O(n d^2)$. The weights occupy $n^2$ numbers. Under a causal mask the pairs are those with $j \\le i$, of which there are $n(n+1)/2$.',
    variants: [
      { name: 'Multi-head attention', text: 'Several heads run in parallel on the same input, each with its own matrices and usually with shorter keys, and their outputs are joined. The original base model used 8 heads, vectors of 512 numbers, and 6 blocks in each of its two stacks.' },
      { name: 'Cross-attention', text: 'The queries come from one sequence and the keys and values from another. The decoder of the original transformer uses it to consult the encoded source sentence, and text-to-image models use it to consult the prompt.' },
      { name: 'Encoder-only and decoder-only models', text: 'BERT keeps only the encoder stack, with no mask, so every token sees the whole input. The GPT models keep only the decoder stack, with a causal mask, and generate text one token at a time.' },
      { name: 'Other ways to encode position', text: 'Learned position vectors, encodings of the distance between two tokens added to the scores, and rotations applied to queries and keys are all in use in place of the original sine and cosine vectors.' },
      { name: 'Vision transformer', text: 'The tokens are patches of an image, each flattened and mapped to a vector by one matrix. The rest is a standard transformer encoder.' },
      { name: 'Efficient attention', text: 'A family of methods that avoid scoring every pair, by restricting each token to a window, to a sparse pattern or to a low-rank approximation of the weight table.' },
    ],
    implementation: 'Compute a whole layer as matrix products: stack the token vectors as rows, multiply by the three matrices, and form all the scores as one product of the query matrix with the transposed key matrix. Add the mask to the scores as minus infinity before softmax. Subtract each row\'s largest score before taking exponentials. Process many sequences at once by padding them to a common length and masking the padding. When generating text under a causal mask, keep the keys and values of the tokens already processed, since they cannot change, and compute only the new token\'s row. Check a new implementation against a slow, obvious one on a tiny input before trusting it.',
    benchmarking: 'Correctness comes first and is tested with properties: every row of weights adds up to 1, the layer commutes with reordering when there is no position information or mask, and under a causal mask changing a later token leaves earlier outputs untouched. Speed is reported in tokens processed per second and memory in relation to sequence length, on stated hardware and at stated precision, since both change the result. The quality of a trained model is a separate matter, measured on tasks, and says nothing about whether the attention layer is implemented correctly.',
    references: [
      { authors: 'A. Vaswani, N. Shazeer, N. Parmar, J. Uszkoreit, L. Jones, A. N. Gomez, Ł. Kaiser and I. Polosukhin', year: 2017, title: 'Attention Is All You Need', venue: 'Advances in Neural Information Processing Systems 30' },
      { authors: 'D. Bahdanau, K. Cho and Y. Bengio', year: 2015, title: 'Neural Machine Translation by Jointly Learning to Align and Translate', venue: 'International Conference on Learning Representations (ICLR)' },
      { authors: 'M.-T. Luong, H. Pham and C. D. Manning', year: 2015, title: 'Effective Approaches to Attention-based Neural Machine Translation', venue: 'Proceedings of the Conference on Empirical Methods in Natural Language Processing (EMNLP)' },
      { authors: 'A. Radford, K. Narasimhan, T. Salimans and I. Sutskever', year: 2018, title: 'Improving Language Understanding by Generative Pre-Training', venue: 'OpenAI technical report' },
      { authors: 'J. Devlin, M.-W. Chang, K. Lee and K. Toutanova', year: 2019, title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', venue: 'Proceedings of NAACL-HLT' },
      { authors: 'A. Dosovitskiy, L. Beyer, A. Kolesnikov, D. Weissenborn, X. Zhai, T. Unterthiner, M. Dehghani, M. Minderer, G. Heigold, S. Gelly, J. Uszkoreit and N. Houlsby', year: 2021, title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale', venue: 'International Conference on Learning Representations (ICLR)' },
      { authors: 'J. Jumper, R. Evans, A. Pritzel and colleagues', year: 2021, title: 'Highly accurate protein structure prediction with AlphaFold', venue: 'Nature 596' },
      { authors: 'S. Jain and B. C. Wallace', year: 2019, title: 'Attention is not Explanation', venue: 'Proceedings of NAACL-HLT' },
    ],
    furtherReading: [
      'J. Alammar, "The Illustrated Transformer" (2018).',
      'A. Rush, "The Annotated Transformer" (2018), a line-by-line implementation of the original paper.',
      'D. Jurafsky and J. H. Martin, *Speech and Language Processing* (3rd edition draft), the chapter on transformers.',
    ],
  },

  tests: [
    { name: 'each row of weights sums to 1 and the output matches an independent direct computation', input: {}, check: sound },
    { name: 'the same with position information', input: { ...DEFAULTS, positions: true }, check: sound },
    { name: 'the same with a causal mask', input: { ...DEFAULTS, mask: true }, check: sound },
    { name: 'the same without scaling', input: { ...DEFAULTS, scale: false }, check: sound },
    { name: 'the same on six other tokens with positions and mask together', input: { tokens: 'a cat chased the dog sat', positions: true, mask: true, scale: true }, check: sound },
    { name: 'identical tokens at different positions get identical outputs when no position information is added', input: {},
      check: (r) => (r.tokens[0] === 'the' && r.tokens[3] === 'the' && r.weights[0].every((w, j) => w === r.weights[3][j]) && r.outputs[0].every((v, c) => v === r.outputs[3][c])
        && r.outputs[0].some((v, c) => !near(v, r.outputs[1][c], 1e-3))) || 'the two copies of "the" did not get identical rows' },
    { name: 'with position information the same two tokens get different outputs', input: { ...DEFAULTS, positions: true },
      check: (r) => r.outputs[0].some((v, c) => Math.abs(v - r.outputs[3][c]) > 0.01) || 'position information made no difference' },
    { name: 'with a causal mask the same two tokens get different outputs, and later tokens are hidden', input: { ...DEFAULTS, mask: true },
      check: (r, c) => {
        for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (r.weights[i][j] !== 0) return `token ${i + 1} puts weight on the later token ${j + 1}`;
        if (r.weights[0][0] !== 1 || !r.outputs[0].every((v, k) => v === r.V[0][k])) return 'the first token should put its whole weight on itself';
        if (!r.outputs[0].some((v, k) => Math.abs(v - r.outputs[3][k]) > 0.01)) return 'the two copies of "the" still got the same output';
        return c['scores computed'] === 15 || `${c['scores computed']} scores computed, expected 15`;
      } },
    { name: 'under a causal mask, changing the last token leaves every earlier output unchanged', input: { ...DEFAULTS, mask: true },
      check: (r) => { const other = run({ ...DEFAULTS, tokens: 'the dog saw the mat', mask: true }, QUIET); return [0, 1, 2, 3].every((i) => r.outputs[i].every((v, c) => v === other.outputs[i][c])) || 'an earlier output changed'; } },
    { name: 'reordering the tokens reorders the outputs in the same way', input: { ...DEFAULTS, tokens: 'cat the saw dog the' },
      check: (r) => {
        const ref = run({ ...DEFAULTS }, QUIET), from = [4, 0, 2, 1, 3];   // position in the default order of each token of the shuffled order
        for (let i = 0; i < 5; i++) {
          if (ref.tokens[from[i]] !== r.tokens[i]) return 'the test permutation is wrong';
          for (let c = 0; c < 4; c++) if (!near(r.outputs[i][c], ref.outputs[from[i]][c])) return `output ${i + 1} differs after reordering`;
          for (let j = 0; j < 5; j++) if (!near(r.weights[i][j], ref.weights[from[i]][from[j]])) return `weight ${i + 1},${j + 1} differs after reordering`;
        }
        return true;
      } },
    { name: 'one word repeated gives equal weights and the value itself as output', input: { ...DEFAULTS, tokens: 'the the the' },
      check: (r) => (r.weights.every((row) => row.every((w) => near(w, 1 / 3))) && r.outputs.every((o) => o.every((v, c) => near(v, r.V[0][c])))) || 'weights were not all one third' },
    { name: 'a single token attends only to itself', input: { ...DEFAULTS, tokens: 'cat' },
      check: (r, c) => (r.weights.length === 1 && r.weights[0][0] === 1 && r.outputs[0].every((v, k) => v === r.V[0][k]) && c['scores computed'] === 1) || 'a lone token should return its own value' },
    { name: 'the numbers of the worked example and the code sample', input: {},
      check: (r, c) => {
        const same = (a, b) => a.length === b.length && a.every((v, k) => v === b[k]);
        const r3 = (x) => x.map((v) => v.toFixed(3)).join(' ');
        if (!same(r.Q[2], [3, 0, 0, 0]) || !same(r.K[0], [0, 0, 0, 1]) || !same(r.K[1], [1, 0, 1, 0]) || !same(r.K[2], [0, 1, 0, 0]) || !same(r.K[4], [1, 0, 2, 0])) return 'a query or key quoted in the example is wrong';
        if (!same(r.V[0], [0, 0, 1, 0]) || !same(r.V[1], [2, 0, 0, 2]) || !same(r.V[2], [0, 1, 0, 0]) || !same(r.V[4], [3, 0, 0, 4])) return 'a value quoted in the example is wrong';
        if (!same(r.scores[2], [0, 3, 0, 0, 3]) || !same(r.scaled[2], [0, 1.5, 0, 0, 1.5])) return 'the scores for "saw" are wrong';
        if (Math.exp(1.5).toFixed(2) !== '4.48' || (3 + 2 * Math.exp(1.5)).toFixed(2) !== '11.96') return 'the exponentials quoted are wrong';
        if (r3(r.weights[2]) !== '0.084 0.375 0.084 0.084 0.375' || !near(r.weights[2][1] + r.weights[2][4], 0.75, 0.001)) return `weights for "saw": ${r3(r.weights[2])}`;
        if (r3(r.outputs[2]) !== '1.873 0.084 0.167 2.248') return `output for "saw": ${r3(r.outputs[2])}`;
        if (r3(r.weights[0]) !== '0.169 0.279 0.103 0.169 0.279' || r3(r.weights[4]) !== '0.067 0.183 0.183 0.067 0.498' || r3(r.outputs[4]) !== '1.862 0.183 0.135 2.360') return 'a row printed by the code sample is wrong';
        return c['scores computed'] === 25 || `${c['scores computed']} scores computed, expected 25`;
      } },
    { name: 'without scaling the weights are more lopsided: cat goes from 0.498 to 0.765', input: { ...DEFAULTS, scale: false },
      check: (r) => {
        const scaledRun = run({ ...DEFAULTS }, QUIET);
        if (r.weights[4][4].toFixed(3) !== '0.765' || scaledRun.weights[4][4].toFixed(3) !== '0.498') return `cat on cat: ${r.weights[4][4]} unscaled, ${scaledRun.weights[4][4]} scaled`;
        return r.weights.every((row, i) => Math.max(...row) >= Math.max(...scaledRun.weights[i]) - 1e-12) || 'a row became flatter without scaling';
      } },
    { name: 'the position vector is the sine and cosine formula for four entries', input: { ...DEFAULTS, positions: true },
      check: (r) => {
        const first = [0, 1, 1, 1], third = [Math.sin(2), 1 + Math.cos(2), Math.sin(0.02), Math.cos(0.02)];   // "the" at position 0, "saw" at position 2
        return (r.X[0].every((v, c) => near(v, first[c])) && r.X[2].every((v, c) => near(v, third[c]))) || `vectors with position: ${r.X[0]} and ${r.X[2]}`;
      } },
    { name: 'the feed-forward layer of the original block has twice the weights of its attention layer', input: {},
      check: () => { const d = 512, ff = 2048; return (2 * d * ff === 2 * (4 * d * d)) || 'the ratio quoted in the text is wrong'; } },
  ],
};
