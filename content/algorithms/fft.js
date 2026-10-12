import { makeRng } from '../../js/lib/rng.js';

const TAU = 2 * Math.PI;
const isPowerOfTwo = (n) => Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;

// Number formatting for notes. Values are rounded first so that a tiny negative never prints as "−0".
const tidy = (v, d = 2) => { const p = Math.pow(10, d); const r = Math.round(v * p) / p; return r === 0 ? 0 : r; };
const show = (v, d = 2) => String(tidy(v, d)).replace('-', '−');
const cx = (a, b) => {
  const A = tidy(a), B = tidy(b);
  if (B === 0) return show(A);
  if (A === 0) return `${show(B)}i`;
  return `${show(A)} ${B < 0 ? '−' : '+'} ${show(Math.abs(B))}i`;
};
const binary = (i, bits) => i.toString(2).padStart(bits, '0');
const withCommas = (v) => v.toLocaleString('en-US');

function reverseBits(i, bits) {
  let r = 0;
  for (let b = 0; b < bits; b++) { r = (r << 1) | (i & 1); i >>= 1; }
  return r;
}

// The signal: either the custom samples, or a sum of up to three sine waves plus noise.
function buildSignal(input) {
  const custom = input.custom || [];
  if (custom.length) {
    if (!isPowerOfTwo(custom.length)) throw new Error(`The custom signal has ${custom.length} sample${custom.length === 1 ? '' : 's'}. This FFT needs a power of two: 2, 4, 8, 16, 32 or 64.`);
    return { x: custom.slice(), n: custom.length, tones: [], custom: true };
  }
  const n = Number(input.n);
  if (!isPowerOfTwo(n)) throw new Error('The number of samples must be a power of two.');
  const tones = [[input.f1, input.a1], [input.f2, input.a2], [input.f3, input.a3]].filter(([f, a]) => a > 0 && f > 0);
  const rng = makeRng(input.seed);
  const x = [];
  for (let j = 0; j < n; j++) {
    let v = 0;
    for (const [f, a] of tones) v += a * Math.sin((TAU * f * j) / n);
    if (input.noise > 0) v += rng.normal(0, input.noise);
    x.push(v);
  }
  return { x, n, tones, custom: false };
}

// The direct transform, straight from the definition: n sums of n terms each. It shares no code
// with the FFT below, so it serves both as the slow variant in the experiment and as the
// reference answer in the tests. Each term multiplies a sample by a point on the unit circle,
// which is counted as one complex multiplication (as it would be for a complex-valued signal).
function directDFT(x, t = null) {
  const n = x.length;
  const re = new Array(n).fill(0), im = new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      const angle = (-TAU * ((j * k) % n)) / n;
      re[k] += x[j] * Math.cos(angle);
      im[k] += x[j] * Math.sin(angle);
      if (t) t.count('complex multiplications');
    }
  }
  return { re, im };
}

// One-sided amplitude: how tall a sine wave of each whole-number frequency would have to be.
function amplitudes(re, im) {
  const n = re.length, out = [];
  for (let k = 0; k <= n / 2; k++) out.push(((k === 0 || k === n / 2 ? 1 : 2) * Math.hypot(re[k], im[k])) / n);
  return out;
}
// Peaks: bins at least as tall as both neighbours and at least a quarter as tall as the tallest bin.
function findPeaks(amp) {
  const top = Math.max(...amp);
  if (!(top > 1e-9)) return [];
  const peaks = [];
  for (let k = 0; k < amp.length; k++) {
    const left = k > 0 ? amp[k - 1] : -Infinity, right = k < amp.length - 1 ? amp[k + 1] : -Infinity;
    if (amp[k] >= 0.25 * top && amp[k] >= left && amp[k] >= right) peaks.push(k);
  }
  return peaks;
}

function run(input, t) {
  const { x, n, tones, custom } = buildSignal(input);
  const bits = Math.round(Math.log2(n));
  const scale = Math.max(...x.map(Math.abs), 1e-9) * 1.15;

  const signalView = () => {
    const pts = x.map((v, j) => [j, v]);
    const layers = [{ type: 'segments', segments: [[-0.5, 0, n - 0.5, 0]], role: 'muted', width: 1 }, { type: 'line', points: pts, role: 'moss', width: 2 }];
    if (n <= 64) layers.push({ type: 'points', points: pts, role: 'moss', r: 2.8 });
    return { kind: 'scene', title: `The signal: ${n} samples, one after another`, x: [-0.5, n - 0.5], y: [-scale, scale], aspect: 0.2, axes: { xLabel: 'sample number (time)' }, layers };
  };
  const spectrumView = (amp, peaks) => {
    const top = Math.max(...amp, 1e-9);
    // A short custom signal has no "peaks" to speak of: mark every frequency that is present and label its amount.
    const small = custom && n <= 8;
    const marked = small ? amp.map((_, k) => k).filter((k) => amp[k] > 1e-9 * top) : peaks;
    const roles = {};
    for (const k of marked) roles[k] = 'done';
    const layers = [{ type: 'bars', xs: amp.map((_, k) => k), heights: amp, barWidth: 0.7, role: 'sage', roles }];
    if (marked.length <= 8) for (const k of marked) layers.push({ type: 'text', at: [k, amp[k] + 0.04 * top], text: small ? show(amp[k]) : String(k), role: 'text', align: 'center' });
    return { kind: 'scene', title: 'The spectrum: how much of each frequency the signal contains', x: [-0.6, n / 2 + 0.6], y: [0, top * 1.2], aspect: 0.36, axes: { xLabel: 'frequency: whole cycles per window (bin number)', yLabel: 'amplitude' }, layers,
      legend: small ? [{ label: 'amount of each frequency', role: 'done' }] : [{ label: 'peak, labelled with its frequency', role: 'done' }, { label: 'other frequencies', role: 'sage' }] };
  };

  if (input.method === 'dft') {
    const d = directDFT(x, t);
    const amp = amplitudes(d.re, d.im), peaks = findPeaks(amp);
    t.frame(() => ({ line: null, note: `Comparison run: the direct transform. Each of the ${n} outputs is a sum over all ${n} samples, so it used ${withCommas(n * n)} complex multiplications.`, views: [signalView(), spectrumView(amp, peaks)] }));
    return { re: d.re, im: d.im, amplitude: amp, peaks, n, x, method: 'dft' };
  }

  const re = x.slice(), im = new Array(n).fill(0);
  const blockOf = new Array(n).fill(1);        // length of the block each entry currently belongs to (for colouring)
  // Table of the n/2 twist factors e^(−2πi·q/n). The factor for position k of a block of m is entry k·n/m.
  const wr = [], wi = [];
  for (let q = 0; q < n / 2; q++) { wr.push(Math.cos((TAU * q) / n)); wi.push(-Math.sin((TAU * q) / n)); }
  const perButterfly = n <= 32, perBlock = n <= 256;

  // The tallest entry the array will hold once the level with block length m is complete. It fixes the
  // vertical scale for the whole level. Computed on a copy, for the picture only, when the level's
  // first frame is drawn (before any of its butterflies have run); nothing here is counted.
  let ceiling = { m: 0, top: 1 };
  const levelCeiling = (m) => {
    if (ceiling.m === m) return ceiling.top;
    const cr = re.slice(), ci = im.slice();
    let top = 0;
    for (let i = 0; i < n; i++) top = Math.max(top, Math.hypot(cr[i], ci[i]));
    for (let s = 0; s < n; s += m) {
      for (let k = 0; k < m / 2; k++) {
        const q = k * (n / m), i = s + k, j = i + m / 2;
        const vr = wr[q] * cr[j] - wi[q] * ci[j], vi = wr[q] * ci[j] + wi[q] * cr[j];
        top = Math.max(top, Math.hypot(cr[i] + vr, ci[i] + vi), Math.hypot(cr[i] - vr, ci[i] - vi));
      }
    }
    ceiling = { m, top: Math.max(top, 1e-9) };
    return ceiling.top;
  };

  // real: signed sample values (reordering stage). Otherwise the size of each complex entry at the
  // level that builds blocks of length `level`; `cuts` is the block length whose boundaries are drawn.
  const workView = ({ real = false, level = 2, cuts = 1, roles = {}, title }) => {
    const heights = real ? re.slice() : re.map((v, i) => Math.hypot(v, im[i]));
    const top = real ? scale : levelCeiling(level) * 1.12;
    const layers = [];
    if (real) layers.push({ type: 'segments', segments: [[-0.5, 0, n - 0.5, 0]], role: 'muted', width: 1 });
    if (cuts >= 2 && cuts < n) {
      const lines = [];
      for (let s = cuts; s < n; s += cuts) lines.push([s - 0.5, 0, s - 0.5, top]);
      layers.push({ type: 'segments', segments: lines, role: 'muted', width: 1, alpha: 0.55 });
    }
    layers.push({ type: 'bars', xs: heights.map((_, i) => i), heights, barWidth: 0.7, role: 'default', roles });
    return { kind: 'scene', title, x: [-0.6, n - 0.4], y: real ? [-top, top] : [0, top], aspect: 0.36, axes: { xLabel: 'position in the working array' }, layers,
      legend: real
        ? [{ label: 'sample value', role: 'default' }, { label: 'pair just swapped', role: 'swap' }]
        : [{ label: 'pair being combined', role: 'active' }, { label: 'merged at this level', role: 'moss' }, { label: 'waiting', role: 'default' }] };
  };
  const reorderTitle = 'Working array: the samples, being put in bit-reversed order';

  const about = custom
    ? `The signal is ${n} custom samples: ${x.map((v) => show(v)).join(', ')}.`
    : `The signal is ${n} samples of ${tones.length ? `${tones.length === 1 ? 'a sine wave' : `${tones.length} sine waves added together`} (${tones.map(([f, a]) => `${show(f)} cycle${f === 1 ? '' : 's'} at amplitude ${show(a)}`).join(', ')})` : 'silence'}${input.noise > 0 ? `, plus random noise of typical size ${show(input.noise)}` : ''}.`;
  t.frame(() => ({ line: [0, 1],
    note: `${about} The task is to find how much of each frequency it contains. The FFT works on an array that starts as a copy of the samples, and needs ${bits} level${bits === 1 ? '' : 's'} of merging because ${n} = 2 multiplied by itself ${bits} time${bits === 1 ? '' : 's'}.`,
    views: [signalView(), workView({ real: true, title: 'Working array: a copy of the samples' })], vars: { n, levels: bits } }));

  // Stage 1: bit-reversal permutation.
  let swaps = 0;
  for (let i = 0; i < n; i++) {
    const r = reverseBits(i, bits);
    if (i < r) {
      const tmp = re[i]; re[i] = re[r]; re[r] = tmp;
      swaps++;
      if (perButterfly) {
        t.frame(() => ({ line: 2,
          note: `Reorder. Position ${i} is ${binary(i, bits)} in binary. Read backwards that is ${binary(r, bits)}, which is ${r}. Swap the entries at positions ${i} and ${r}.`,
          views: [signalView(), workView({ real: true, roles: { [i]: 'swap', [r]: 'swap' }, title: reorderTitle })], vars: { i, 'reversed i': r, swaps } }));
      }
    }
  }
  t.frame(() => ({ line: 2,
    note: `Reordering done with ${swaps} swap${swaps === 1 ? '' : 's'}. Each entry now sits at the position whose binary digits are its original position read backwards. ${n >= 4 ? `Positions 0 and 1 hold samples 0 and ${n / 2}, which were half the signal apart. ` : ''}In this order, every later step combines entries that lie next to each other.`,
    views: [signalView(), workView({ real: true, title: reorderTitle })], vars: { swaps } }));

  // Stage 2: log2(n) levels of butterflies.
  let level = 0;
  for (let m = 2; m <= n; m *= 2) {
    level++;
    const half = m / 2, lv = level;
    const levelTitle = `Working array at level ${lv}: the size of each entry, in blocks of ${m}`;
    t.frame(() => ({ line: 3,
      note: half === 1
        ? `Level 1 of ${bits}. Each single entry is already the spectrum of one sample. Now merge neighbouring entries into blocks of 2: each pair (u, v) becomes its sum and its difference.`
        : `Level ${lv} of ${bits}. Every block of ${half} holds the spectrum of ${half} of the samples. Merge neighbouring blocks into blocks of ${m}. Each merge takes ${half} butterflies, and the level takes ${n / 2} in all.`,
      views: [signalView(), workView({ level: m, cuts: half, title: levelTitle })], vars: { level: lv, 'block length': m } }));
    for (let s = 0; s < n; s += m) {
      for (let k = 0; k < half; k++) {
        const q = k * (n / m);
        const i = s + k, j = i + half;
        const ur = re[i], ui = im[i], br = re[j], bi = im[j];
        const vr = wr[q] * br - wi[q] * bi, vi = wr[q] * bi + wi[q] * br;
        t.count('complex multiplications');
        re[i] = ur + vr; im[i] = ui + vi;
        re[j] = ur - vr; im[j] = ui - vi;
        blockOf[i] = m; blockOf[j] = m;
        if (perButterfly) {
          t.frame(() => {
            const roles = {};
            for (let p = 0; p < n; p++) if (blockOf[p] === m) roles[p] = 'moss';
            roles[i] = 'active'; roles[j] = 'active';
            const turn = (360 * k) / m;
            return { line: [6, 7, 8, 9, 10],
              note: `Butterfly on positions ${i} and ${j}. u = ${cx(ur, ui)}. ${k === 0 ? `The twist w is 1 (no turn), so v is the lower entry itself, ${cx(vr, vi)}.` : `The lower entry ${cx(br, bi)} is multiplied by the twist w, a turn of ${show(turn, 1)}° clockwise, giving v = ${cx(vr, vi)}.`} Position ${i} becomes u + v = **${cx(re[i], im[i])}** and position ${j} becomes u − v = **${cx(re[j], im[j])}**.`,
              views: [signalView(), workView({ level: m, cuts: m, roles, title: levelTitle })],
              vars: { level: lv, block: `${s} to ${s + m - 1}`, k, u: cx(ur, ui), v: cx(vr, vi) } };
          });
        }
      }
      if (!perButterfly && perBlock) {
        t.frame(() => {
          const roles = {};
          for (let p = 0; p < n; p++) if (blockOf[p] === m) roles[p] = 'moss';
          for (let p = s; p < s + m; p++) roles[p] = 'active';
          return { line: [4, 5],
            note: `Level ${lv}: merged positions ${s} to ${s + m - 1} into one block of ${m} with ${half} butterfl${half === 1 ? 'y' : 'ies'}. It now holds the spectrum of ${m} of the samples.`,
            views: [signalView(), workView({ level: m, cuts: m, roles, title: levelTitle })], vars: { level: lv, block: `${s} to ${s + m - 1}` } };
        });
      }
    }
    if (!perBlock) {
      t.frame(() => ({ line: [3, 4, 5], note: `Level ${lv} done: ${n / m} block${n / m === 1 ? '' : 's'} of ${m}, built with ${n / 2} butterflies.`,
        views: [signalView(), workView({ level: m, cuts: m, title: levelTitle })], vars: { level: lv } }));
    }
  }

  const amp = amplitudes(re, im), peaks = findPeaks(amp);
  const used = (n / 2) * bits;
  const sampleBin = Math.max(1, Math.min(3, n / 2 - 1));
  const listed = custom && n <= 8
    ? `The amounts are ${amp.map((a, k) => `${show(a)} at frequency ${k}`).join(', ')}.`
    : peaks.length
      ? `${peaks.length === 1 ? 'The peak is' : 'The peaks are'} at ${peaks.slice(0, 6).map((k) => `frequency ${k} (amplitude ${show(amp[k])})`).join(', ')}${peaks.length > 6 ? ` and ${peaks.length - 6} more` : ''}.`
      : 'No frequency stands out.';
  t.frame(() => ({ line: 11,
    note: `Done. The working array is now one block of ${n}: the spectrum of the whole signal. The chart shows it as amplitudes: a bar of height 1 at frequency ${sampleBin} means "a wave of height 1 that fits ${sampleBin} cycle${sampleBin === 1 ? '' : 's'} into the window". ${listed} The FFT used ${withCommas(used)} complex multiplications, ${n / 2} at each of ${bits} level${bits === 1 ? '' : 's'}. Computing each output separately would take ${withCommas(n * n)}.`,
    views: [signalView(), spectrumView(amp, peaks)], vars: custom && n <= 8 ? { n, levels: bits } : { n, levels: bits, peaks: peaks.join(', ') || 'none' } }));

  return { re, im, amplitude: amp, peaks, n, x, swaps, levels: bits, method: 'fft' };
}

const quiet = { count() {}, frame() {} };
const base = { n: '32', f1: 2, a1: 1, f2: 5, a2: 0.6, f3: 9, a3: 0.4, noise: 0, seed: 7, custom: [] };
const maxDifference = (r) => {
  const ref = directDFT(r.x);
  let worst = 0;
  for (let k = 0; k < r.n; k++) worst = Math.max(worst, Math.hypot(r.re[k] - ref.re[k], r.im[k] - ref.im[k]));
  return worst;
};

export default {
  meta: {
    id: 'fft',
    name: 'Fast Fourier Transform',
    aliases: ['FFT', 'Cooley-Tukey algorithm', 'radix-2 FFT', 'discrete Fourier transform', 'DFT', 'spectrum analysis'],
    kind: 'algorithm',
    discipline: 'mathematics',
    alsoIn: [
      { id: 'physics', why: 'Spectral analysis: finding which frequencies are present in a measured signal, and solving wave and diffusion equations in the frequency domain.' },
      { id: 'computer-vision', why: 'Images are filtered and analysed by their spatial frequencies. JPEG compression uses the related discrete cosine transform.' },
      { id: 'algorithms', why: 'It multiplies two polynomials or two very large integers in O(n log n) operations, where the schoolbook method takes O(n²).' },
    ],
    subfield: 'Transforms',
    family: 'Fourier analysis',
    lab: 'mathematics',
    year: 1965,
    authors: 'James W. Cooley and John W. Tukey',
    summary: 'Computes the discrete Fourier transform of n samples in O(n log n) operations by merging the transforms of the even and odd samples.',
    difficulty: 'advanced',
    order: 470,
    paradigms: ['divide-and-conquer', 'transform'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', class: 'linearithmic' },
    space: { worst: 'O(n)', class: 'linear' },
    tags: {
      problems: ['find the frequencies in a signal', 'which notes are in a sound', 'spectrum of a signal', 'frequency analysis', 'remove noise from a signal', 'multiply polynomials quickly'],
      techniques: ['divide and conquer', 'butterfly operation', 'bit reversal', 'roots of unity', 'in-place transform'],
      applications: ['signal processing', 'image processing', 'data compression', 'scientific computing', 'networking'],
    },
    prerequisites: ['concept:complex-numbers', 'concept:fourier-transform', 'concept:divide-and-conquer', 'concept:recursion', 'merge-sort'],
  },

  bigIdea: {
    simple: "A Fourier transform takes a mixed-up signal and tells you what simple ingredients it is made of. Think of a chord on a piano. Three keys are pressed together, and the three notes travel through the air as one wobbling wave. A microphone records only that one combined wave. Yet your ear can tell that three notes are in it. A Fourier transform does the same job with arithmetic. It takes the recorded wave and reports how much of each pitch it contains: a lot of this note, some of that one, none of the others. The fast Fourier transform, or FFT, is a quick way to do that arithmetic. The plain way checks the recording against every possible pitch, one at a time, which is slow. The FFT splits the recording into halves again and again, and reuses the work that different pitches have in common. For a recording of about a thousand numbers, that is roughly two hundred times less work. That speed is why phones, audio software and medical scanners can use it constantly.",
    what: 'The discrete Fourier transform takes n samples of a signal and returns n numbers, one for each whole number of cycles that fits in the window. Each says how strongly a wave of that frequency is present, and with what timing. The fast Fourier transform is an algorithm that computes exactly these numbers in about n log₂ n operations where the definition needs n².',
    why: 'Many questions are hard to answer from a signal as it arrives and easy to answer from its frequencies: which notes are playing, where the hum is, which radio channel carries which data. The transform was understood long before it was practical. For a million samples the direct method needs a trillion multiplications and the FFT about ten million, which turned frequency analysis from an occasional calculation into something done continuously.',
    when: 'Use it whenever you need the frequency content of evenly spaced samples, or want an operation that is simple in the frequency domain: filtering, convolution, multiplying polynomials. The radix-2 form in this lesson needs a power-of-two length; library FFTs handle any length. If you need only a handful of frequencies, computing those few directly can be cheaper than a full FFT.',
    interesting: 'The saving comes from one observation. The transform of n samples can be assembled from the transform of the even-numbered samples and the transform of the odd-numbered ones, with one multiplication per pair of outputs. Each half can be split the same way. This is the recurrence of [merge sort](#/algorithm/merge-sort), and it gives the same n log n cost.',
    where: 'It is one of the most widely used numerical algorithms. Wi-Fi and mobile networks use it to place data on many radio frequencies at once and to read it back. Magnetic resonance scanners use it to turn measurements into images. Audio tools use it to show and edit spectra, and the related discrete cosine transform is the core of JPEG image compression.',
    analogy: {
      title: 'Hearing the notes in a chord',
      text: 'When a chord is played, the air carries a single complicated vibration: the sum of the vibrations of each string. Nothing in that vibration is labelled with the names of the notes. Even so, a listener hears the separate notes, because the ear responds to each pitch on its own. A Fourier transform is the same unmixing done with numbers. It is handed the single combined wave and gives back a list: this pitch at this strength, that pitch at that strength.',
      limits: 'The ear listens continuously and judges pitch on its own scale. The FFT looks at one fixed block of samples and can only report on a fixed ladder of frequencies: 0, 1, 2, 3 and so on whole cycles per block. A note that falls between two rungs is smeared across several of them. The FFT also describes the block as a whole, so it cannot say when within the block a note began or ended. And it cannot see any frequency above half the sampling rate: such a note shows up disguised as a lower one.',
    },
  },

  example: {
    setup: "Four measurements of a signal, taken one after another, are 6, 1, 4, 1. They were made by adding three simple patterns: a steady level (1, 1, 1, 1), a slow wave that rises and falls once (1, 0, −1, 0), and a fast wave that flips at every measurement (1, −1, 1, −1). How much of each pattern is in the signal?",
    steps: [
      "Split the measurements by position. The first and third are 6 and 4. The second and fourth are 1 and 1.",
      "For each pair, take the sum and the difference. From 6 and 4: sum 10, difference 2. From 1 and 1: sum 2, difference 0.",
      "Combine the two sums in the same way. Their sum is 10 + 2 = 12, and their difference is 10 − 2 = 8.",
      "Combine the two differences, 2 and 0. In general the second one is first given a quarter-turn twist, which needs a kind of number with two parts. Here it is 0, so the twist changes nothing, and the two results are 2 + 0 = 2 and 2 − 0 = 2.",
      "Read off the amounts. The steady level is 12 ÷ 4 = 3. The fast wave is 8 ÷ 4 = 2. The slow wave appeared twice, as 2 and 2, so it is (2 + 2) ÷ 4 = 1.",
    ],
    result: "The signal is 3 of the steady level, 1 of the slow wave and 2 of the fast wave. Check the first measurement: 3 + 1 + 2 = 6. Check the second: 3 + 0 − 2 = 1. The whole calculation was four additions or subtractions at each of two levels, and the second level reused the sums from the first. That reuse is what makes the method fast.",
    tryInput: { custom: [6, 1, 4, 1] },
  },

  terms: [
    { term: "Signal", meaning: "A quantity that changes over time, such as the air pressure of a sound." },
    { term: "Sample", meaning: "One measurement of a signal. A recording is a long list of samples taken at equal time intervals." },
    { term: "Frequency", meaning: "How many times a wave repeats in a given time. Higher frequency sounds like higher pitch." },
    { term: "Amplitude", meaning: "The height of a wave: how strong it is." },
    { term: "Sine wave", meaning: "The smoothest possible repeating wave, the shape of a pure tone." },
    { term: "Spectrum", meaning: "The list of how much of each frequency a signal contains." },
    { term: "Bin", meaning: "One entry of the spectrum. Bin 3 holds the amount of the wave that fits exactly 3 cycles into the block of samples." },
    { term: "Window", meaning: "The block of samples being analysed." },
    { term: "Complex number", meaning: "A number with two parts. Here it records a wave's strength and its timing together, and multiplying by one can rotate another." },
    { term: "Butterfly", meaning: "The basic move of the FFT: replace two numbers by their sum and their difference, after giving the second one a twist." },
  ],

  takeaway: "A signal is a mix of pure waves, and the FFT finds how much of each is present by splitting the samples in half again and again and reusing the shared work.",

  viz: {
    describe: 'Two charts. The upper one plots the signal: its samples in time order, joined by a line. The lower one shows the FFT\'s working array as a row of bars. First the bars are the samples, and brick-red pairs mark the swaps that put them in bit-reversed order. Then each bar shows the size of an entry while blocks are merged level by level: terracotta marks the pair being combined, moss marks entries already merged at this level, and thin vertical lines separate blocks. In the last step the lower chart becomes the spectrum, one bar per frequency, with the peaks in forest green and labelled with their frequency (for a short custom signal, every frequency present is marked and labelled with its amount).',
    inputs: [
      { id: 'n', type: 'select', label: 'Number of samples (n)', default: '32',
        options: [{ value: '8', label: '8' }, { value: '16', label: '16' }, { value: '32', label: '32' }, { value: '64', label: '64' }, { value: '128', label: '128' }],
        help: 'Must be a power of two. Up to 32 every butterfly is shown; above that, every merged block.' },
      { id: 'f1', type: 'range', label: 'Wave 1: cycles per window', min: 1, max: 24, step: 0.5, default: 2 },
      { id: 'a1', type: 'range', label: 'Wave 1: amplitude', min: 0, max: 2, step: 0.1, default: 1 },
      { id: 'f2', type: 'range', label: 'Wave 2: cycles per window', min: 1, max: 24, step: 0.5, default: 5 },
      { id: 'a2', type: 'range', label: 'Wave 2: amplitude', min: 0, max: 2, step: 0.1, default: 0.6 },
      { id: 'f3', type: 'range', label: 'Wave 3: cycles per window', min: 1, max: 24, step: 0.5, default: 9 },
      { id: 'a3', type: 'range', label: 'Wave 3: amplitude', min: 0, max: 2, step: 0.1, default: 0.4,
        help: 'Set an amplitude to 0 to leave that wave out.' },
      { id: 'noise', type: 'range', label: 'Noise level', min: 0, max: 1.5, step: 0.05, default: 0.2,
        help: 'Random jitter added to every sample.' },
      { id: 'seed', type: 'seed', label: 'Noise seed', default: 7 },
      { id: 'custom', type: 'list', label: 'Custom samples (optional)', default: [], maxLength: 64,
        help: 'If filled in, these numbers are the signal and the sliders are ignored. The count must be a power of two.' },
    ],
    presets: [
      { label: 'A chord of three notes, with noise', values: { n: '32', f1: 2, a1: 1, f2: 5, a2: 0.6, f3: 9, a3: 0.4, noise: 0.2, custom: [] } },
      { label: 'The same chord, no noise', values: { n: '32', f1: 2, a1: 1, f2: 5, a2: 0.6, f3: 9, a3: 0.4, noise: 0, custom: [] } },
      { label: 'One pure note', values: { n: '32', f1: 3, a1: 1, a2: 0, a3: 0, noise: 0, custom: [] } },
      { label: 'A note between two bins', values: { n: '32', f1: 4.5, a1: 1, a2: 0, a3: 0, noise: 0, custom: [] } },
      { label: 'Too fast to capture', values: { n: '32', f1: 20, a1: 1, a2: 0, a3: 0, noise: 0, custom: [] } },
      { label: 'Notes under heavy noise', values: { n: '128', f1: 6, a1: 1, f2: 13, a2: 0.6, f3: 9, a3: 0, noise: 0.6, custom: [] } },
      { label: 'The worked example', values: { custom: [6, 1, 4, 1] } },
      { label: 'A single click', values: { custom: [1, 0, 0, 0, 0, 0, 0, 0] } },
    ],
    tryThis: [
      'Load "The same chord, no noise" and go to the last step. The bars at frequencies 2, 5 and 9 have heights 1, 0.6 and 0.4, the amplitudes of the three waves. Change the amplitude of wave 2 and only the bar at 5 changes.',
      'Load "A note between two bins". A wave of 4.5 cycles does not fit the window a whole number of times, so no single bin matches it. Its energy spreads over many bins, mostly 4 and 5. This is called leakage, and it comes from analysing a finite block, not from any fault in the FFT.',
      'Load "Too fast to capture". With 32 samples the highest frequency that can be told apart is 16 cycles. A wave of 20 cycles produces exactly the same samples as one of 12 cycles turned upside down, so the peak appears at 12. This is called aliasing.',
      'Load "Notes under heavy noise" and then lower the number of samples to 32. With 128 samples the two notes stand clear of the noise. With 32 they are harder to pick out, because a longer window averages the noise down while each note keeps its height.',
      'With 16 samples, step through the levels and count the butterflies in each: always 8, half the number of samples. Four levels of 8 make 32 multiplications, where the direct method needs 256.',
    ],
    run,
    report: (r, c) => {
      const mult = c['complex multiplications'] || 0;
      const head = r.method === 'dft'
        ? `Direct transform of ${r.n} samples: ${withCommas(mult)} complex multiplications.`
        : `FFT of ${r.n} samples: ${withCommas(mult)} complex multiplications over ${r.levels} level${r.levels === 1 ? '' : 's'} (the direct transform would use ${withCommas(r.n * r.n)}).`;
      const tops = r.peaks.slice(0, 6).map((k) => `${k} (amplitude ${show(r.amplitude[k], 3)})`).join(', ');
      return `${head}\nPeaks at frequency: ${tops || 'none'}${r.peaks.length > 6 ? ', ...' : ''}`;
    },
    experiment: {
      title: 'Complex multiplications as the signal gets longer',
      note: 'Each point is a real run on a signal of n samples. The FFT is this page\'s algorithm. The direct transform, implemented in the same module, computes each of the n outputs as a separate sum over all n samples. Both counts are exact: (n/2) log₂ n for the FFT, one per butterfly, and n² for the direct transform.',
      metric: 'complex multiplications',
      metricLabel: 'Complex multiplications',
      sizeLabel: 'Number of samples (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512, 1024],
      variants: [
        { id: 'fft', label: 'FFT' },
        { id: 'dft', label: 'Direct transform' },
      ],
      input: (n, variant, seed) => ({ n, method: variant, seed, custom: [] }),
      theory: [
        { label: '(n/2) log₂ n', fn: (n) => (n / 2) * Math.log2(n), variant: 'fft' },
        { label: 'n²', fn: (n) => n * n, variant: 'dft' },
      ],
    },
  },

  logic: {
    intuition: 'To measure how much of a given frequency is in a signal, multiply each sample by the matching point of a wave of that frequency and add up. Doing that separately for n frequencies repeats a great deal of work, because the waves are closely related: the wave with k cycles, sampled at every second point, is the same as a wave with k cycles over half as many points. So the answer for the full signal can be built from the answers for its even-numbered and odd-numbered samples. Those two smaller problems share the same structure, and so on down to single samples.',
    steps: [
      'Copy the n samples into a working array. n must be a power of two.',
      'Rearrange the array so that the entry at each position moves to the position whose binary digits are the same digits read backwards. This is the order in which repeated even and odd splitting would deliver the samples.',
      'Treat every entry as a block of length 1: the transform of a single sample is the sample itself.',
      'Merge neighbouring blocks in pairs. For each position k in the first block, take u from the first block and the matching entry from the second block multiplied by a twist factor w, call it v. Write u + v into the first block and u − v into the second. This pair of updates is a butterfly.',
      'The twist factor for position k in a merged block of length m is the point on the unit circle a fraction k/m of a full turn clockwise from 1.',
      'Repeat the merging with blocks of 2, 4, 8 and so on until one block of length n remains. It is the transform.',
    ],
    pseudocode: [
      'fft(x):',
      '  A ← copy of x;  n ← length of x',
      '  for each i with i < reverse_bits(i): swap A[i] and A[reverse_bits(i)]',
      '  for m = 2, 4, 8, ..., n:',
      '    for each block start s = 0, m, 2m, ...:',
      '      for k = 0 to m/2 − 1:',
      '        w ← e^(−2πi·k/m)',
      '        u ← A[s + k]',
      '        v ← w · A[s + k + m/2]',
      '        A[s + k] ← u + v',
      '        A[s + k + m/2] ← u − v',
      '  return A',
    ],
    decisions: [
      { title: 'Recursive or iterative?', text: 'The recursive form follows the mathematics directly: split into even and odd samples, transform each, merge. The iterative form in this lesson does the same merges bottom-up, in place, after one reordering pass. It avoids allocating arrays at every level and is the form most implementations use.' },
      { title: 'Where do the twist factors come from?', text: 'They are the n-th roots of unity. This page computes a table of n/2 of them once and looks them up, so the only multiplications counted are the ones inside butterflies. Computing each factor from the previous one by repeated multiplication is cheaper per factor but accumulates rounding error.' },
      { title: 'Which sign and which scaling?', text: 'Conventions differ. This lesson uses a negative exponent for the forward transform and no scaling, so the inverse must divide by n. Whatever the choice, forward and inverse must use opposite signs, and the factor of 1/n must appear exactly once between them.' },
      { title: 'What if n is not a power of two?', text: 'This radix-2 algorithm cannot run. Padding the signal with zeros to the next power of two works but changes which frequencies the bins stand for. General FFT libraries use mixed-radix and other algorithms that keep O(n log n) for any length.' },
    ],
    invariants: [
      'After the level with block length m, every block of m consecutive entries is the discrete Fourier transform of m of the samples: those whose index, read in binary, ends in the digits that identify the block.',
      'Each level performs exactly n/2 butterflies, one complex multiplication each.',
    ],
    edgeCases: [
      'A frequency that is not a whole number of cycles per window: its energy leaks into neighbouring bins.',
      'A frequency above half the sampling rate: it is indistinguishable from a lower one and appears there (aliasing).',
      'A constant signal: everything lands in bin 0.',
      'A single spike: every bin has the same size. A signal sharply located in time is spread evenly over all frequencies.',
      'A length that is not a power of two: this algorithm rejects it.',
      'Real-valued input: the second half of the output mirrors the first (bin n − k is the complex conjugate of bin k), so only bins 0 to n/2 carry information.',
    ],
    correctness: 'Write ω for e^(−2πi/n). The transform is X[k] = Σ x[j]·ω^(jk). Split the sum into even and odd j. The even terms form the transform E of the even samples and the odd terms form ω^k times the transform O of the odd samples, both of length n/2, so X[k] = E[k] + ω^k·O[k] for k below n/2. For the upper half, E and O repeat with period n/2 and ω^(k + n/2) = −ω^k, so X[k + n/2] = E[k] − ω^k·O[k]. These two formulas are the butterfly. By induction on the block length, starting from blocks of one sample, every merge produces a correct transform of its samples. The bit-reversal reordering places the samples so that the two halves being merged are always adjacent blocks.',
    mistakes: [
      'Overwriting A[s + k] and then using the new value to compute A[s + k + m/2]. Both updates must use the old u.',
      'Leaving out the bit-reversal step, or applying each swap twice by not testing i < reverse_bits(i).',
      'Using the full length n in the twist factor at every level, where the block length m is required.',
      'Reading bin k as a frequency in hertz. Bin k means k cycles per window; in hertz that is k times the sampling rate divided by n.',
      'Forgetting the 1/n in the inverse transform, or applying it in both directions.',
      'Interpreting the mirrored upper half of the spectrum of a real signal as extra frequencies.',
    ],
  },

  code: {
    sample: {
      input: 'Eight samples of sin(2πj/8) + 0.5·sin(2π·3j/8): one cycle at amplitude 1 plus three cycles at amplitude 0.5. Print the magnitude of each output.',
      expected: 'bin 0: 0.0000\nbin 1: 4.0000\nbin 2: 0.0000\nbin 3: 2.0000\nbin 4: 0.0000\nbin 5: 2.0000\nbin 6: 0.0000\nbin 7: 4.0000',
    },
    python: {
      source: `import cmath
import math


def reverse_bits(i, bits):
    r = 0
    for _ in range(bits):
        r = (r << 1) | (i & 1)
        i >>= 1
    return r


def fft(x):
    n = len(x)
    bits = n.bit_length() - 1
    a = [complex(v) for v in x]
    for i in range(n):
        r = reverse_bits(i, bits)
        if i < r:
            a[i], a[r] = a[r], a[i]
    m = 2
    while m <= n:
        for s in range(0, n, m):
            for k in range(m // 2):
                w = cmath.exp(-2j * cmath.pi * k / m)
                u = a[s + k]
                v = w * a[s + k + m // 2]
                a[s + k] = u + v
                a[s + k + m // 2] = u - v
        m *= 2
    return a


n = 8
signal = [math.sin(2 * math.pi * j / n) + 0.5 * math.sin(2 * math.pi * 3 * j / n) for j in range(n)]
for k, value in enumerate(fft(signal)):
    print(f"bin {k}: {abs(value):.4f}")`,
      notes: [
        { line: 19, text: 'Each pair is swapped once. Without the test i < r every swap would be made twice and undo itself.' },
        { line: 22, text: 'm is the block length. It doubles each pass, so there are log₂ n passes.' },
        { line: 25, text: 'The twist factor: the point on the unit circle a fraction k/m of a turn clockwise from 1. It depends on the block length m, not on n.' },
        { line: 26, text: 'u is saved before either entry is overwritten. Both new values need the old one.' },
        { line: 28, text: 'The butterfly: the sum goes to the first half of the block and the difference to the second half.' },
      ],
    },
    javascript: {
      source: `function reverseBits(i, bits) {
  let r = 0;
  for (let b = 0; b < bits; b++) {
    r = (r << 1) | (i & 1);
    i >>= 1;
  }
  return r;
}

// Returns the real and imaginary parts of the transform as two arrays.
function fft(x) {
  const n = x.length;
  const bits = Math.round(Math.log2(n));
  const re = x.slice();
  const im = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const r = reverseBits(i, bits);
    if (i < r) [re[i], re[r]] = [re[r], re[i]];
  }
  for (let m = 2; m <= n; m *= 2) {
    for (let s = 0; s < n; s += m) {
      for (let k = 0; k < m / 2; k++) {
        const angle = (-2 * Math.PI * k) / m;
        const wr = Math.cos(angle), wi = Math.sin(angle);
        const i = s + k, j = s + k + m / 2;
        const ur = re[i], ui = im[i];
        const vr = wr * re[j] - wi * im[j];
        const vi = wr * im[j] + wi * re[j];
        re[i] = ur + vr; im[i] = ui + vi;
        re[j] = ur - vr; im[j] = ui - vi;
      }
    }
  }
  return [re, im];
}

const n = 8;
const signal = [];
for (let j = 0; j < n; j++) {
  signal.push(Math.sin((2 * Math.PI * j) / n) + 0.5 * Math.sin((2 * Math.PI * 3 * j) / n));
}
const [re, im] = fft(signal);
for (let k = 0; k < n; k++) {
  console.log("bin " + k + ": " + Math.hypot(re[k], im[k]).toFixed(4));
}`,
    },
    cpp: {
      source: `#include <cmath>
#include <complex>
#include <cstdio>
#include <utility>
#include <vector>

using cd = std::complex<double>;
const double PI = std::acos(-1.0);

int reverse_bits(int i, int bits) {
    int r = 0;
    for (int b = 0; b < bits; ++b) {
        r = (r << 1) | (i & 1);
        i >>= 1;
    }
    return r;
}

std::vector<cd> fft(const std::vector<double>& x) {
    int n = static_cast<int>(x.size());
    int bits = 0;
    while ((1 << bits) < n) ++bits;
    std::vector<cd> a(x.begin(), x.end());
    for (int i = 0; i < n; ++i) {
        int r = reverse_bits(i, bits);
        if (i < r) std::swap(a[i], a[r]);
    }
    for (int m = 2; m <= n; m *= 2) {
        for (int s = 0; s < n; s += m) {
            for (int k = 0; k < m / 2; ++k) {
                cd w = std::polar(1.0, -2 * PI * k / m);
                cd u = a[s + k];
                cd v = w * a[s + k + m / 2];
                a[s + k] = u + v;
                a[s + k + m / 2] = u - v;
            }
        }
    }
    return a;
}

int main() {
    const int n = 8;
    std::vector<double> signal(n);
    for (int j = 0; j < n; ++j) {
        signal[j] = std::sin(2 * PI * j / n) + 0.5 * std::sin(2 * PI * 3 * j / n);
    }
    std::vector<cd> out = fft(signal);
    for (int k = 0; k < n; ++k) {
        std::printf("bin %d: %.4f\\n", k, std::abs(out[k]));
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'There are log₂ n levels, and each level performs n/2 butterflies. A butterfly is one complex multiplication, one addition and one subtraction. The total is (n/2) log₂ n multiplications and n log₂ n additions and subtractions, against n² multiplications for the direct method.',
    cases: [
      { case: 'Every input', time: 'O(n log n)', when: 'The work depends only on n, not on the values of the samples. Exactly (n/2) log₂ n complex multiplications.' },
      { case: 'Direct transform', time: 'O(n²)', when: 'Each of n outputs computed as its own sum over n samples. Shown for comparison in the chart.' },
      { case: 'n = 1,024', time: '5,120 against 1,048,576', when: 'The FFT uses about 205 times fewer multiplications. The ratio is 2n / log₂ n and keeps growing with n.' },
    ],
    space: 'O(n): the working array of n complex numbers, transformed in place, plus a table of n/2 twist factors.',
    memory: 'At the early levels the two entries of a butterfly are neighbours; at the last level they are n/2 apart. For very large n those long strides fall outside the processor cache, and high-performance libraries reorganize the computation into cache-sized pieces.',
    tradeoffs: 'The FFT computes all n frequencies at once. If only a few are needed, computing them one by one costs O(n) each and can be cheaper. The radix-2 form is the simplest but requires a power-of-two length; more general forms cost more code, not more time.',
    assumptions: [
      'n is a power of two.',
      'One arithmetic operation on complex numbers costs constant time. The twist factors come from a table computed once.',
      'Counts on this page are complex multiplications inside butterflies. For the direct transform, multiplying a sample by a point on the unit circle is counted as one complex multiplication.',
      'Results are exact up to floating-point rounding, which grows only slowly with the length (at most in proportion to log n).',
    ],
  },

  tradeoffs: {
    excels: [
      'Finding the frequency content of long, evenly sampled signals.',
      'Operations that are costly in time or space but simple per frequency: convolution, correlation, filtering, differentiation.',
      'Multiplying polynomials and very large integers.',
    ],
    struggles: [
      'Signals whose frequency content changes during the window. The spectrum averages over the whole block and loses the timing.',
      'Samples that are not evenly spaced. The algorithm assumes a regular grid.',
      'Short windows when fine frequency resolution is needed. Bins are one cycle per window apart, and no algorithm can do better with the same data.',
    ],
    pitfalls: [
      'Leakage: a frequency between bins spreads into its neighbours and can hide weaker components. Tapering the block with a window function reduces it.',
      'Aliasing: frequencies above half the sampling rate must be removed before sampling, because afterwards they cannot be told from lower ones.',
      'Mismatched conventions for sign and scaling between a forward and an inverse routine.',
      'Zero padding, which makes the spectrum look smoother without adding any real resolution.',
    ],
    misunderstandings: [
      "\"The FFT is a different transform from the discrete Fourier transform.\" It is an algorithm, not a transform. It computes exactly the same numbers as the definition, only faster.",
      "\"A peak in bin 5 means a frequency of 5 hertz.\" Bin 5 means 5 cycles in the analysed block. The frequency in hertz is 5 times the sampling rate divided by the number of samples.",
      "\"The spectrum tells you when each note was played.\" It reports what is present in the block as a whole. To follow notes over time, the signal is cut into short overlapping blocks and each is transformed.",
      "\"Taking more samples per second gives finer frequency detail.\" A higher sampling rate raises the highest frequency that can be seen. Finer detail comes only from a longer stretch of signal.",
    ],
    constraints: [
      'Real-time systems transform fixed-size blocks and accept a delay of one block length.',
      'Production libraries such as FFTW choose among many algorithm variants at run time to suit the length and the processor.',
    ],
    alternatives: [
      { name: 'Direct DFT', when: 'n is tiny, or as a reference for testing an FFT.' },
      { name: 'Goertzel algorithm', when: 'Only one or a few frequencies are needed, such as detecting the tones of a telephone keypad.' },
      { name: 'Short-time Fourier transform', when: 'The frequency content changes over time and you need to see when.' },
      { name: 'Wavelet transforms', when: 'You want fine time detail for high frequencies and fine frequency detail for low ones.' },
      { name: 'Number-theoretic transform', when: 'Exact integer results are required, as in big-integer multiplication, with no rounding error.' },
    ],
    comparison: {
      columns: ['', 'FFT (radix-2)', 'Direct DFT', 'Goertzel, for one frequency'],
      rows: [
        ['Multiplications', '(n/2) log₂ n', 'n²', 'About n'],
        ['Frequencies produced', 'All n', 'All n', 'One'],
        ['Length restriction', 'Power of two', 'None', 'None'],
        ['Result', 'The DFT, up to rounding', 'The DFT, up to rounding', 'One bin of the DFT'],
      ],
    },
  },

  applications: [
    { title: 'Wireless and broadband communication', status: 'established', text: 'Wi-Fi, 4G and 5G mobile networks and DSL lines send data on many closely spaced frequencies at once, a scheme called OFDM. The transmitter builds the signal with an inverse FFT and the receiver separates the frequencies with an FFT.' },
    { title: 'Magnetic resonance imaging', status: 'established', text: 'An MRI scanner measures the spatial frequencies of the body\'s response, not the picture itself. The image is reconstructed with an inverse FFT in two or three dimensions.' },
    { title: 'Audio analysis and processing', status: 'established', text: 'Spectrum displays, equalizers, pitch detection and noise reduction all work on the frequency content of short blocks of sound obtained with the FFT.' },
    { title: 'Multiplying polynomials and large integers', status: 'established', text: 'Multiplying two polynomials is a convolution of their coefficients, which becomes a term-by-term product after a Fourier transform. The Schönhage-Strassen algorithm uses this idea to multiply very large integers.' },
    { title: 'Image and sound compression', status: 'established', text: 'JPEG, MP3 and related formats transform small blocks into frequency components and store the important ones precisely and the rest coarsely. They use the discrete cosine transform and its variants, which are closely related to the Fourier transform and computed with FFT-style algorithms.' },
    { title: 'Simulating waves, heat and fluids', status: 'established', text: 'Spectral methods transform a field into frequencies, where differentiation is a multiplication, do the calculus there, and transform back. The FFT makes each step affordable.' },
  ],

  connections: [
    { to: 'merge-sort', type: 'related', why: 'Both split the input in half, solve each half, and combine in linear time. The shared recurrence T(n) = 2T(n/2) + O(n) gives both their n log n cost.' },
    { to: 'concept:divide-and-conquer', type: 'prerequisite', why: 'The transform of n samples is assembled from the transforms of the even and odd samples, each half as long.' },
    { to: 'concept:complex-numbers', type: 'prerequisite', why: 'Each output records a strength and a timing together, and the twist factors are points on the unit circle that rotate entries before they are combined.' },
    { to: 'concept:fourier-transform', type: 'prerequisite', why: 'The FFT is a fast way to compute the discrete form of the Fourier transform. The transform itself is the idea; the FFT is the algorithm.' },
    { to: 'concept:recurrence', type: 'advanced', why: 'The cost satisfies M(n) = 2M(n/2) + n/2, whose solution is (n/2) log₂ n.' },
    { to: 'convolution', type: 'application', why: 'Convolution in time is multiplication in frequency, so a long convolution can be computed with three FFTs in O(n log n).' },
    { to: 'shors-algorithm', type: 'advanced', why: 'Shor\'s algorithm finds the period of a function with the quantum Fourier transform, the same transform applied to the amplitudes of a quantum state.' },
    { to: 'runge-kutta-4', type: 'related', why: 'Spectral simulations of waves and fluids pair the two: the FFT handles the derivatives in space and a Runge-Kutta method advances the solution in time.' },
    { to: 'discipline:physics', type: 'application', why: 'Measured signals are routinely analysed by their spectra, and many physical laws are simplest when written for one frequency at a time.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Blurring, sharpening and many other filters act on the spatial frequencies of an image, and block transforms of the same family underlie image compression.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'After the FFT of a block of n samples, what does the entry in bin k describe?',
      options: ['The k-th sample of the signal', 'How strongly a wave with k cycles per block is present, and its timing', 'The frequency k in hertz, whatever the sampling rate', 'The time at which frequency k occurred'],
      answer: 1,
      explain: [
        'The samples are the input. The output is indexed by frequency, not by time.',
        'Correct. The size of the entry gives the strength of that wave and its angle gives the timing (phase).',
        'Bin k is k cycles per block. Converting to hertz needs the sampling rate and the block length.',
        'The transform of one block carries no information about when within the block something happened.',
      ],
    },
    {
      type: 'predict',
      q: 'A block of 32 samples contains a single sine wave that completes 20 cycles in the block. Where will the peak of the spectrum appear?',
      options: ['At bin 20', 'At bin 12', 'At bin 16', 'Nowhere: the spectrum will be flat'],
      answer: 1,
      explain: [
        'The chart only goes up to bin 16, half the number of samples. Nothing faster can be distinguished.',
        'Correct. With 32 samples, a wave of 20 cycles gives exactly the same samples as a wave of 32 − 20 = 12 cycles turned upside down. This is aliasing.',
        'Bin 16 is the fastest wave that can be represented, one that flips at every sample. The folded frequency is 32 − 20, not 16.',
        'The samples are far from constant, so the energy has to show up somewhere.',
      ],
      tryInput: { n: '32', f1: 20, a1: 1, a2: 0, a3: 0, noise: 0, custom: [] },
    },
    {
      type: 'debug',
      q: 'This butterfly produces wrong results for every block length. What is wrong?',
      code: `w = cmath.exp(-2j * cmath.pi * k / m)
v = w * a[s + k + m // 2]
a[s + k] = a[s + k] + v
a[s + k + m // 2] = a[s + k] - v`,
      options: ['The twist factor should use n, not m', 'The last line uses the entry that was just overwritten; the old value must be saved first', 'v should be added in both lines', 'The exponent should be positive'],
      answer: 1,
      explain: [
        'The twist depends on the block length m. Using n would be a different bug.',
        'Correct. After line 3, a[s + k] holds u + v, so line 4 stores (u + v) − v = u instead of u − v. Save u in a variable before either assignment.',
        'One output is the sum and the other the difference.',
        'A positive exponent gives the inverse transform (without its scaling). It is a convention, not the cause of this failure.',
      ],
    },
    {
      type: 'choice',
      q: 'A signal has 1,024 samples. About how many complex multiplications does the radix-2 FFT need, counting one per butterfly?',
      options: ['1,024', '5,120', '10,240', '1,048,576'],
      answer: 1,
      explain: [
        'That would be a single multiplication per sample. Each of the 10 levels needs 512.',
        'Correct. There are log₂ 1,024 = 10 levels of 512 butterflies each: 5,120.',
        'That is n log₂ n. Each butterfly handles two entries with one multiplication, so the count is half of it.',
        'That is n², the cost of computing each output directly.',
      ],
    },
    {
      type: 'challenge',
      title: 'Go back, then clean up a signal',
      prompt: 'Write the inverse transform by reusing your forward FFT: take the complex conjugate of every entry, run the forward FFT, take the conjugate again and divide by n. Check that it restores a signal exactly, up to rounding. Then build a noisy signal from two sine waves, transform it, set to zero every bin whose size is below a quarter of the largest, and transform back. Plot the result against the noise-free signal. Explain why this works when the waves fit the window a whole number of times and works less well when they do not.',
      hints: ['For a real signal remember to keep both bin k and its mirror bin n − k, or the output will no longer be real.', 'A wave between two bins leaks into many bins, most of them small. Zeroing the small ones throws away part of the wave along with the noise.'],
    },
  ],

  compare: {
    idea: 'Build the transform of n samples from the transforms of the even and odd samples, level by level.',
    requires: 'n evenly spaced samples with n a power of two (for this radix-2 form). Complex arithmetic.',
    sensitivity: 'None in cost: the operation count depends only on n. The meaning of the output is sensitive to the window length and sampling rate.',
    memory: 'O(n): in place, plus a table of n/2 twist factors.',
    difficulty: 'high',
    difficultyNote: 'The code is short, but the indexing, the bit reversal and the sign and scaling conventions are easy to get subtly wrong.',
    limits: 'Evenly spaced samples only. Frequency resolution fixed by the window length. No timing information within the block.',
    useWhen: 'You need all the frequencies of a sampled signal, or want to do in the frequency domain something that is expensive in time.',
  },

  advanced: {
    history: 'James Cooley and John Tukey published the algorithm in 1965, and it spread quickly through signal processing. The idea was older than they knew. Carl Friedrich Gauss used an equivalent method around 1805 to fit trigonometric curves to the orbits of asteroids; it was published only after his death and went unnoticed. In 1942 Danielson and Lanczos described the halving step for X-ray diffraction calculations done by hand. The paper by Heideman, Johnson and Burrus listed in the references traces this history.',
    derivation: 'Let $\\omega_n = e^{-2\\pi i/n}$ and $X_k = \\sum_{j=0}^{n-1} x_j\\,\\omega_n^{jk}$. Separate even and odd $j$:\n\n$$X_k = \\sum_{j=0}^{n/2-1} x_{2j}\\,\\omega_n^{2jk} + \\omega_n^{k}\\sum_{j=0}^{n/2-1} x_{2j+1}\\,\\omega_n^{2jk}.$$\n\nSince $\\omega_n^2 = \\omega_{n/2}$, the two sums are the transforms $E_k$ and $O_k$ of the even and odd samples, each of length $n/2$. They are periodic with period $n/2$, and $\\omega_n^{k+n/2} = -\\omega_n^{k}$, so for $0 \\le k < n/2$:\n\n$$X_k = E_k + \\omega_n^{k} O_k, \\qquad X_{k+n/2} = E_k - \\omega_n^{k} O_k.$$\n\nApplying the same split to $E$ and $O$ repeatedly sorts the samples by the bits of their index from least significant to most, which is why the iterative algorithm starts from bit-reversed order.',
    proof: 'Parseval\'s identity gives a check on any implementation. For the unscaled transform used here,\n\n$$\\sum_{j=0}^{n-1} |x_j|^2 = \\frac{1}{n}\\sum_{k=0}^{n-1} |X_k|^2.$$\n\nIt follows from the orthogonality of the sampled waves: $\\sum_{k} \\omega_n^{(j-l)k}$ equals $n$ when $j = l$ and $0$ otherwise. The same orthogonality gives the inverse transform, $x_j = \\frac{1}{n}\\sum_k X_k\\,\\omega_n^{-jk}$. For a real sine wave of amplitude $a$ with a whole number $f$ of cycles, $0 < f < n/2$, the only nonzero outputs are $X_f$ and $X_{n-f}$, each of size $an/2$, which is why this page plots $2|X_k|/n$ as the amplitude.',
    complexityProof: 'Let $M(n)$ be the number of complex multiplications. Merging two half-length transforms takes $n/2$ of them, so $M(n) = 2M(n/2) + n/2$ with $M(1) = 0$. Unrolling over the $\\log_2 n$ levels, each level contributes $n/2$, so $M(n) = \\frac{n}{2}\\log_2 n$. The direct transform uses $n$ multiplications for each of $n$ outputs, $n^2$ in all. The ratio is $2n/\\log_2 n$: about 205 for $n = 1024$ and about 100,000 for $n = 2^{20}$.',
    variants: [
      { name: 'Inverse FFT', text: 'The same algorithm with the opposite sign in the exponent and a final division by n. It can also be obtained from the forward routine by conjugating the input and the output.' },
      { name: 'Real-input FFT', text: 'Exploits the mirror symmetry of the spectrum of a real signal to compute only bins 0 to n/2, in about half the time and memory.' },
      { name: 'Mixed-radix and split-radix FFTs', text: 'Split into three, four, five or other numbers of parts instead of two, so that lengths with small prime factors are handled directly. Split-radix reduces the operation count further for powers of two.' },
      { name: 'Bluestein and Rader algorithms', text: 'Rewrite a transform of arbitrary or prime length as a convolution, which is then computed with power-of-two FFTs. They keep O(n log n) for every n.' },
      { name: 'Multidimensional FFT', text: 'A two-dimensional transform is a one-dimensional FFT of every row followed by one of every column. Used for images and volumes.' },
      { name: 'Number-theoretic transform', text: 'Replaces complex roots of unity with roots of unity in modular arithmetic, giving exact integer results. Used in big-integer and polynomial multiplication.' },
    ],
    implementation: 'Precompute the twist factors once per length. Test against a direct DFT on random input, and check Parseval\'s identity and the round trip through the inverse. Decide the scaling convention and document it. For real work use an established library: they handle any length, exploit real input, and are tuned to the processor.',
    benchmarking: 'Operation counts for a fixed algorithm are exact, as on this page. Running time is another matter: it depends strongly on the length (powers of two and lengths with small factors are fastest), on cache behaviour and on vector instructions, so measure on the lengths you will use.',
    references: [
      { authors: 'J. W. Cooley and J. W. Tukey', year: 1965, title: 'An algorithm for the machine calculation of complex Fourier series', venue: 'Mathematics of Computation 19, 297-301' },
      { authors: 'M. T. Heideman, D. H. Johnson and C. S. Burrus', year: 1984, title: 'Gauss and the history of the fast Fourier transform', venue: 'IEEE ASSP Magazine 1(4), 14-21' },
      { authors: 'M. Frigo and S. G. Johnson', year: 2005, title: 'The design and implementation of FFTW3', venue: 'Proceedings of the IEEE 93(2), 216-231' },
      { authors: 'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein', year: 2009, title: 'Introduction to Algorithms (3rd edition)', venue: 'MIT Press' },
    ],
    furtherReading: [
      'Cormen, Leiserson, Rivest and Stein, *Introduction to Algorithms*, chapter "Polynomials and the FFT".',
      'A. V. Oppenheim and R. W. Schafer, *Discrete-Time Signal Processing*, for sampling, leakage and windowing.',
      'W. H. Press, S. A. Teukolsky, W. T. Vetterling and B. P. Flannery, *Numerical Recipes* (3rd edition), chapter 12, "Fast Fourier Transform".',
    ],
  },

  tests: [
    { name: 'matches the direct DFT within 1e-9 on the default noisy chord', input: {},
      check: (r, c) => {
        const d = maxDifference(r);
        if (d > 1e-9) return `largest difference from the direct DFT is ${d}`;
        return c['complex multiplications'] === 80 || `counted ${c['complex multiplications']} multiplications, expected (32/2) × 5 = 80`;
      } },
    { name: 'matches the direct DFT for every length from 2 to 256, with noise and off-bin frequencies', input: { ...base },
      check: () => {
        for (const n of [8, 16, 32, 64, 128, 256]) {
          const r = run({ ...base, n: String(n), f1: 2.5, f2: 3, f3: 1, noise: 0.7, seed: n + 3 }, quiet);
          const d = maxDifference(r);
          if (d > 1e-9) return `n = ${n}: difference ${d}`;
        }
        for (const custom of [[3, -1], [1, 2, 3, 4], [0.5, -2, 7, 1, 0, 0, -3, 9]]) {
          const r = run({ ...base, custom }, quiet);
          const d = maxDifference(r);
          if (d > 1e-9) return `custom length ${custom.length}: difference ${d}`;
        }
        return true;
      } },
    { name: 'Parseval: the sum of squared samples equals the sum of squared outputs divided by n', input: { ...base, n: '64', noise: 0.5, f2: 7.5 },
      check: (r) => {
        const time = r.x.reduce((s, v) => s + v * v, 0);
        const freq = r.re.reduce((s, v, k) => s + v * v + r.im[k] * r.im[k], 0) / r.n;
        return Math.abs(time - freq) <= 1e-9 * Math.max(1, time) || `time ${time}, frequency ${freq}`;
      } },
    { name: 'a clean chord gives peaks at exactly the input frequencies with the input amplitudes', input: { ...base },
      check: (r) => {
        if (r.peaks.join(',') !== '2,5,9') return `peaks at ${r.peaks.join(', ')}`;
        const want = { 2: 1, 5: 0.6, 9: 0.4 };
        for (let k = 0; k <= 16; k++) if (Math.abs(r.amplitude[k] - (want[k] || 0)) > 1e-9) return `bin ${k} has amplitude ${r.amplitude[k]}`;
        return true;
      } },
    { name: 'the default noisy chord still has its peaks at 2, 5 and 9', input: {},
      check: (r) => r.peaks.join(',') === '2,5,9' || `peaks at ${r.peaks.join(', ')}` },
    { name: 'the worked example: 6, 1, 4, 1 transforms to 12, 2, 8, 2 and amounts 3, 1, 2', input: { custom: [6, 1, 4, 1] },
      check: (r, c) => {
        const want = [12, 2, 8, 2];
        if (r.re.some((v, k) => Math.abs(v - want[k]) > 1e-12) || r.im.some((v) => Math.abs(v) > 1e-12)) return `transform ${r.re.join(', ')} / ${r.im.join(', ')}`;
        if ([3, 1, 2].some((v, k) => Math.abs(r.amplitude[k] - v) > 1e-12)) return `amounts ${r.amplitude.join(', ')}`;
        return (c['complex multiplications'] === 4 && r.swaps === 1) || `${c['complex multiplications']} multiplications, ${r.swaps} swaps`;
      } },
    { name: 'the quiz prediction: 20 cycles in 32 samples appears at bin 12', input: { n: '32', f1: 20, a1: 1, a2: 0, a3: 0, noise: 0, custom: [] },
      check: (r) => (r.peaks.join(',') === '12' && Math.abs(r.amplitude[12] - 1) < 1e-9) || `peaks at ${r.peaks.join(', ')}` },
    { name: 'operation counts: (n/2) log2 n for the FFT and n² for the direct transform', input: { ...base, n: '16' },
      check: (r, c) => {
        if (c['complex multiplications'] !== 32) return `n = 16: ${c['complex multiplications']}`;
        for (const n of [8, 64, 1024]) {
          const tally = (method) => { const t = { n: 0, count() { this.n++; }, frame() {} }; run({ ...base, n, method }, t); return t.n; };
          if (tally('fft') !== (n / 2) * Math.log2(n)) return `FFT at n = ${n}: ${tally('fft')}`;
          if (n <= 64 && tally('dft') !== n * n) return `direct at n = ${n}: ${tally('dft')}`;
        }
        return (1024 / 2) * 10 === 5120 && 1024 * 1024 === 1048576;
      } },
    { name: 'a single click has a flat spectrum, a constant has only bin 0, and real input is mirror-symmetric', input: { custom: [1, 0, 0, 0, 0, 0, 0, 0] },
      check: (r) => {
        if (r.re.some((v) => Math.abs(v - 1) > 1e-12) || r.im.some((v) => Math.abs(v) > 1e-12)) return 'the click does not transform to all ones';
        const flat = run({ ...base, custom: [2, 2, 2, 2, 2, 2, 2, 2] }, quiet);
        if (Math.abs(flat.re[0] - 16) > 1e-12 || flat.re.slice(1).some((v) => Math.abs(v) > 1e-12)) return 'the constant signal leaks out of bin 0';
        const any = run({ ...base, noise: 0.4, f1: 3.5 }, quiet);
        for (let k = 1; k < any.n; k++) if (Math.abs(any.re[k] - any.re[any.n - k]) > 1e-9 || Math.abs(any.im[k] + any.im[any.n - k]) > 1e-9) return `bin ${k} is not the conjugate of bin ${any.n - k}`;
        return true;
      } },
    { name: 'a length that is not a power of two is refused', input: { ...base },
      check: () => {
        try { run({ ...base, custom: [1, 2, 3] }, quiet); } catch (e) { return /power of two/.test(e.message) || `unexpected message: ${e.message}`; }
        return 'expected an error for three samples';
      } },
  ],
};
