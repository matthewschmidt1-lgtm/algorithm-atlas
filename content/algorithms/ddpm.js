import { makeRng } from '../../js/lib/rng.js';

// The whole training set: four 10 x 10 black-and-white glyphs.
const SIZE = 10, D = SIZE * SIZE;
const GLYPHS = [
  { id: 'plus', label: 'Plus', rows: ['..........', '....##....', '....##....', '....##....', '.########.', '.########.', '....##....', '....##....', '....##....', '..........'] },
  { id: 'ring', label: 'Ring', rows: ['..........', '..######..', '.##....##.', '.#......#.', '.#......#.', '.#......#.', '.#......#.', '.##....##.', '..######..', '..........'] },
  { id: 'cross', label: 'Cross', rows: ['..........', '.##....##.', '..##..##..', '...####...', '....##....', '....##....', '...####...', '..##..##..', '.##....##.', '..........'] },
  { id: 'triangle', label: 'Triangle', rows: ['..........', '....##....', '....##....', '...#..#...', '...#..#...', '..#....#..', '..#....#..', '.#......#.', '.########.', '..........'] },
];
// Pixels are stored the way diffusion models store them: -1 for background, +1 for ink.
const TRAIN = GLYPHS.map((g) => Float64Array.from(g.rows.join(''), (ch) => (ch === '#' ? 1 : -1)));
const N = TRAIN.length;

const f3 = (v) => (Math.abs(v) < 0.0005 ? '0.000' : v.toFixed(3).replace('-', '−'));
const pc = (w) => (w > 0.995 ? (w > 0.99995 ? '100%' : '99%+') : w < 0.005 ? (w < 0.00005 ? '0%' : 'under 1%') : `${Math.round(w * 100)}%`);

// Linear noise schedule. beta[t] rises in a straight line from 0.1/T to 20/T, which for T = 1000 is the
// 0.0001 to 0.02 used by Ho, Jain and Abbeel. abar[t] is the product of (1 - beta) up to step t.
function schedule(T) {
  const beta = new Float64Array(T + 1), abar = new Float64Array(T + 1);
  abar[0] = 1;
  for (let t = 1; t <= T; t++) {
    beta[t] = (0.1 + (19.9 * (t - 1)) / Math.max(1, T - 1)) / T;
    abar[t] = abar[t - 1] * (1 - beta[t]);
  }
  return { beta, abar };
}

// The optimal denoiser for a finite training set. Given a noisy picture x at a noise level where
// x = sqrt(abar) * clean + sqrt(1 - abar) * noise, Bayes' rule gives each training image a weight
// proportional to exp(-|x - sqrt(abar) * image|^2 / (2 * (1 - abar))). The best guess of the clean
// picture is the weighted average of the training images.
function denoise(x, abar, train = TRAIN) {
  const s = Math.sqrt(abar), v = 1 - abar, n = train.length, d = x.length;
  const dist = new Array(n);
  for (let i = 0; i < n; i++) {
    let q = 0;
    for (let k = 0; k < d; k++) { const m = x[k] - s * train[i][k]; q += m * m; }
    dist[i] = q;
  }
  const nearest = dist.indexOf(Math.min(...dist));
  let weights;
  if (v < 1e-12) weights = dist.map((_, i) => (i === nearest ? 1 : 0));
  else {
    const raw = dist.map((q) => Math.exp(-(q - dist[nearest]) / (2 * v)));   // subtracting the smallest distance avoids underflow
    const total = raw.reduce((a, b) => a + b, 0);
    weights = raw.map((r) => r / total);
  }
  const guess = new Float64Array(d);
  for (let i = 0; i < n; i++) for (let k = 0; k < d; k++) guess[k] += weights[i] * train[i][k];
  return { weights, guess, nearest };
}

const rms = (a, b) => { let q = 0; for (let k = 0; k < a.length; k++) q += (a[k] - b[k]) ** 2; return Math.sqrt(q / a.length); };
const shade = (v) => Math.min(1, Math.max(0, (v + 1) / 2));   // -1..+1 to 0..1 for display

// Thumbnails of the training images never change, so their drawing layers are built once.
const CELL = 12.5, LEFT = 1, GUESS_X = 53;
const thumb = (pixels, ox) => {
  const layers = [{ type: 'rect', x: ox, y: 1, w: SIZE, h: SIZE, role: 'default', fillAlpha: 0.16 }];
  for (let k = 0; k < D; k++) {
    const v = shade(pixels[k]);
    if (v > 0.03) layers.push({ type: 'rect', x: ox + (k % SIZE), y: 1 + (SIZE - 1 - Math.floor(k / SIZE)), w: 1, h: 1, role: 'text', fillAlpha: 0.9 * v });
  }
  return layers;
};
const TRAIN_LAYERS = TRAIN.flatMap((img, i) => thumb(img, LEFT + CELL * i));

function run(input, t) {
  const T = Math.round(input.steps);
  if (T < 2) throw new Error('At least two steps are needed.');
  const mode = input.mode === 'forward' ? 'forward' : 'reverse';
  const pick = Math.max(0, GLYPHS.findIndex((g) => g.id === input.image));
  const rng = makeRng(input.seed);
  const { beta, abar } = schedule(T);
  const noise = () => Float64Array.from({ length: D }, () => rng.normal());

  const picture = (x, title) => ({ kind: 'grid', title, rows: SIZE, cols: SIZE, values: Array.from(x, shade), palette: 'gray' });
  const panel = (d) => {
    const top = d.weights.indexOf(Math.max(...d.weights));
    const layers = TRAIN_LAYERS.slice();
    d.weights.forEach((w, i) => {
      const ox = LEFT + CELL * i;
      layers.push({ type: 'rect', x: ox, y: -0.1, w: SIZE, h: 0.6, role: 'default', fillAlpha: 0.25 });
      if (w > 0.002) layers.push({ type: 'rect', x: ox, y: -0.1, w: SIZE * w, h: 0.6, role: 'forest', fillAlpha: 1 });
      layers.push({ type: 'text', at: [ox + SIZE / 2, -1.7], text: `${GLYPHS[i].label} ${pc(w)}`, role: i === top && w > 0.5 ? 'text' : 'muted', align: 'center' });
      if (i === top && w > 0.5) layers.push({ type: 'rect', x: ox - 0.3, y: 0.7, w: SIZE + 0.6, h: SIZE + 0.6, role: 'forest', fill: false, stroke: true, width: 2 });
    });
    layers.push(...thumb(d.guess, GUESS_X));
    layers.push({ type: 'text', at: [GUESS_X + SIZE / 2, -1.7], text: 'best guess', role: 'text', align: 'center' });
    layers.push({ type: 'text', at: [GUESS_X - 1.3, 5.6], text: '→', role: 'muted', align: 'center', size: 16 });
    return { kind: 'scene', title: 'Training images, their weights, and the denoiser\'s best guess', x: [0, GUESS_X + SIZE + 1], y: [-2.8, 11.6], aspect: 0.23, equal: true, axes: false, layers,
      legend: [{ label: 'weight: how likely this training image is the clean picture', role: 'forest' }] };
  };
  const level = (tt) => `signal ${f3(Math.sqrt(abar[tt]))}, noise ${f3(Math.sqrt(1 - abar[tt]))}`;

  if (mode === 'forward') {
    const x0 = TRAIN[pick];
    let x = Float64Array.from(x0);
    const varianceRatio = [];
    t.frame(() => ({ line: 0, note: `The forward process, which is how training examples are made. Start with a clean training image, the ${GLYPHS[pick].label.toLowerCase()}. Each of the ${T} steps will fade the picture slightly and add a little fresh random noise. No learning happens in this direction.`,
      views: [picture(x, 'Clean image (step 0)'), panel(denoise(x, 1))], vars: { step: 0, signal: '1.000', noise: '0.000' } }));
    const every = Math.max(1, Math.ceil(T / 150));
    for (let s = 1; s <= T; s++) {
      const e = noise();
      const keep = Math.sqrt(1 - beta[s]), add = Math.sqrt(beta[s]);
      for (let k = 0; k < D; k++) x[k] = keep * x[k] + add * e[k];
      t.count('noising steps');
      // What is left besides the faded original should have variance 1 - abar.
      let q = 0;
      for (let k = 0; k < D; k++) q += (x[k] - Math.sqrt(abar[s]) * x0[k]) ** 2;
      varianceRatio.push(q / D / (1 - abar[s]));
      if (s % every === 0 || s === T) {
        t.frame(() => {
          const d = denoise(x, abar[s]);
          const best = Math.max(...d.weights);
          return { line: 1, note: `Noising step ${s} of ${T}: multiply every pixel by ${f3(keep)} and add random noise of size ${f3(add)}. Taken together, the picture is now the original times ${f3(Math.sqrt(abar[s]))} plus noise of size ${f3(Math.sqrt(1 - abar[s]))}. ${best > 0.99 ? `The denoiser can still tell which training image it came from: it gives the ${GLYPHS[d.nearest].label.toLowerCase()} ${pc(best)}.` : best > 0.5 ? `The denoiser is no longer sure where this came from. Its strongest candidate, the ${GLYPHS[d.weights.indexOf(best)].label.toLowerCase()}, has ${pc(best)}.` : 'So little of the original is left that the denoiser cannot tell which image this was. Its best guess is a blur of all four.'}`,
            views: [picture(x, `After ${s} noising step${s === 1 ? '' : 's'} (${level(s)})`), panel(d)], vars: { step: s, signal: f3(Math.sqrt(abar[s])), noise: f3(Math.sqrt(1 - abar[s])) } };
        });
      }
    }
    const end = denoise(x, abar[T]);
    return { mode, T, image: GLYPHS[pick].id, signalLeft: Math.sqrt(abar[T]), varianceRatio, final: Array.from(x), weights: end.weights,
      nearest: GLYPHS[end.nearest].id, distance: rms(x, x0) };
  }

  // Reverse process: sampling.
  let x = noise();
  let decidedAt = null, undecidedUntil = null;
  t.frame(() => ({ line: [2, 3], note: `Sampling begins with **pure noise**: 100 pixels, each an independent random number. There is no picture hidden in it. One caution before the first step. The denoiser on this page is not a trained neural network. It is the exact, best possible denoiser for a training set of just four images, worked out from a formula. A sampler driven by it can only ever end on one of those four. Real diffusion models put a neural network in its place, and a network has to generalize.`,
    views: [picture(x, `Pure noise (step ${T})`), panel(denoise(x, abar[T]))], vars: { step: T, signal: f3(Math.sqrt(abar[T])), noise: f3(Math.sqrt(1 - abar[T])) } }));
  const every = Math.max(1, Math.ceil(T / 150));
  for (let s = T; s >= 1; s--) {
    const d = denoise(x, abar[s]);
    t.count('denoiser evaluations');
    const best = Math.max(...d.weights), top = d.weights.indexOf(best);
    if (decidedAt === null && best >= 0.99) decidedAt = s;
    if (undecidedUntil === null && best >= 0.5) undecidedUntil = s;
    const sa = Math.sqrt(abar[s]), sn = Math.sqrt(1 - abar[s]);
    const sigma = Math.sqrt((beta[s] * (1 - abar[s - 1])) / (1 - abar[s]));
    const z = s > 1 ? noise() : null;
    const before = x;
    const next = new Float64Array(D);
    for (let k = 0; k < D; k++) {
      const eps = (before[k] - sa * d.guess[k]) / sn;                       // the noise that the guess implies
      const mean = (before[k] - (beta[s] * eps) / sn) / Math.sqrt(1 - beta[s]);   // remove a little of it
      next[k] = mean + (z ? sigma * z[k] : 0);                               // and put a smaller amount of fresh noise back
    }
    if ((T - s) % every === 0 || s === 1) {
      t.frame(() => ({ line: [5, 6, 7, 8], note: `Step ${s} of ${T} (${level(s)}). The denoiser compares this picture with a faded copy of each training image. ${best < 0.5
        ? `None stands out: the weights are ${d.weights.map(pc).join(', ')}. Its best guess is therefore a blur of all four.`
        : best < 0.99 ? `The ${GLYPHS[top].label.toLowerCase()} is pulling ahead with a weight of ${pc(best)}, so the best guess is starting to look like it.`
          : `It is now certain the clean picture is the ${GLYPHS[top].label.toLowerCase()} (weight ${pc(best)}).`} The sampler removes a little of the noise that the guess implies${s > 1 ? ` and adds fresh noise of size ${f3(sigma)}` : ' and, on this last step, adds no fresh noise'}.`,
        views: [picture(before, `Sample at step ${s} (${level(s)})`), panel(d)], vars: { step: s, signal: f3(sa), noise: f3(sn), 'top weight': pc(best) } }));
    }
    x = next;
  }
  const end = denoise(x, 1);
  const distance = rms(x, TRAIN[end.nearest]);
  t.frame(() => ({ line: 9, note: `Finished. The sample is the ${GLYPHS[end.nearest].label.toLowerCase()}, and it matches that training image exactly (pixel difference ${f3(distance)}). Nothing new was created. With a perfect denoiser and four training images, sampling is a slow way of picking one of the four at random. A different seed starts from different noise and may pick another one. A real model can produce pictures outside its training set only because its network is an approximation of this formula and not the formula itself.`,
    views: [picture(x, 'Finished sample (step 0)'), panel(end)], vars: { step: 0, result: GLYPHS[end.nearest].label, 'pixel difference': f3(distance) } }));
  return { mode, T, final: Array.from(x), nearest: GLYPHS[end.nearest].id, nearestLabel: GLYPHS[end.nearest].label, distance, weights: end.weights,
    decidedAt, undecidedUntil, signalLeft: Math.sqrt(abar[T]) };
}

const DEFAULTS = { mode: 'reverse', steps: 100, seed: 7, image: 'ring' };
const QUIET = { count() {}, frame() {} };

export default {
  meta: {
    id: 'ddpm',
    name: 'Diffusion Models (DDPM)',
    aliases: ['denoising diffusion probabilistic model', 'diffusion model', 'denoising diffusion', 'DDPM'],
    kind: 'model',
    discipline: 'deep-learning',
    alsoIn: [
      { id: 'computer-vision', why: 'Diffusion models are the basis of the leading systems for generating and editing images.' },
      { id: 'physics', why: 'The forward process is modelled on physical diffusion, in which random motion gradually erases structure.' },
      { id: 'statistics', why: 'Sampling is a Markov chain of Gaussian steps, and the ideal denoiser is a posterior mean given by Bayes\' rule.' },
    ],
    subfield: 'Generative models',
    family: 'Diffusion models',
    lab: 'neural-networks',
    year: 2020,
    authors: 'Jonathan Ho, Ajay Jain and Pieter Abbeel',
    summary: 'Generates data by starting from pure noise and removing it in many small steps, using a network trained to undo a fixed, gradual noising process.',
    difficulty: 'advanced',
    order: 660,
    paradigms: ['randomized-sampling', 'probabilistic-inference', 'iterative-refinement'],
    randomized: true,
    approximate: true,
    time: { best: 'T denoiser evaluations per sample', average: 'T denoiser evaluations per sample', worst: 'T denoiser evaluations per sample', class: 'iterative' },
    space: { worst: 'O(D) for a sample of D values, plus the denoiser', class: 'linear' },
    tags: {
      problems: ['generate images', 'make a picture from noise', 'text to image', 'sample from a learned distribution', 'remove noise from an image'],
      techniques: ['noise schedule', 'denoising', 'ancestral sampling', 'Gaussian noise', 'Markov chain'],
      applications: ['image processing', 'machine learning', 'signal processing', 'bioinformatics'],
    },
    prerequisites: ['backpropagation', 'gradient-descent', 'monte-carlo', 'concept:gaussian-distribution', 'concept:neural-network', 'concept:markov-chain', 'concept:bayes-theorem', 'concept:sampling'],
  },

  bigIdea: {
    simple: "A diffusion model makes pictures by learning to undo damage. Take a clear photo and sprinkle a little random speckle over it, like static on an old television. Do it again, and again. After many rounds nothing is left but static. That direction is easy and needs no cleverness. Now imagine a program that has watched this happen to millions of pictures. It learns to look at a speckled picture and guess what the clean one underneath was. To make a brand new picture, start from pure static. Ask the program for its guess, and use it to wipe away a little of the speckle. Then ask again. Step by step, shapes come out of the static. The starting static is different every time, so the finished picture is different every time. The demonstration on this page is open about one limit. Its guesser is a plain formula that knows only four tiny pictures by heart, so those four are all it can ever produce.",
    what: 'A denoising diffusion probabilistic model is a way to generate new data such as images. A fixed forward process turns any training image into Gaussian noise over T small steps. A neural network, the denoiser, is trained to look at a noisy image and predict the noise in it, which amounts to predicting the clean image. Generation runs the other way: start from pure noise and apply the denoiser T times, removing a little noise at each step.',
    why: 'Producing a realistic image in one jump is very hard to learn. Diffusion divides the job into many easy steps, each of which only has to make a noisy picture slightly cleaner, and the network is trained with an ordinary squared-error loss. Jascha Sohl-Dickstein and colleagues introduced the idea in 2015, taking it from the physics of diffusion. In 2020 Jonathan Ho, Ajay Jain and Pieter Abbeel showed that a simplified version of it produces high-quality images.',
    when: 'Use a diffusion model to generate images, audio or other continuous data when sample quality and variety matter more than speed. Sampling needs many evaluations of a large network, so it is a poor fit when an answer is needed in a single fast pass. The denoiser is trained by [backpropagation](#/algorithm/backpropagation).',
    interesting: 'For a fixed training set, the best possible denoiser can be written down exactly, and a sampler that uses it can only reproduce the training images. That is what this page runs. So a diffusion model that produces something new is one whose network is not that perfect denoiser. What makes these models useful is the particular way a neural network falls short of memorizing, and why it falls short so helpfully is still being researched.',
    where: 'Text-to-image systems such as Stable Diffusion, DALL·E 2 and Imagen are diffusion models. The same method is used to synthesize speech and music, to sharpen and fill in images, and to propose new protein structures.',
    analogy: {
      title: 'A drop of ink in water, played backwards',
      text: 'Let a drop of ink fall into a glass of water. At first it is a sharp, intricate shape. Random jostling of the water spreads it out, and after a while the glass is an even grey with no trace of the shape. Film this and play it backwards: an even grey gathers itself into a drop. A diffusion model learns what one step of that backwards film looks like. Given a slightly-too-blurry frame, it produces a slightly sharper one. Starting from plain grey and applying that step many times, it arrives at a drop.',
      limits: "Real diffusion cannot be run backwards, and the model does not recover any particular drop that once existed. It makes up a plausible one, and a different one every time, because the grey it starts from is fresh random noise. Ink also spreads by moving through space, while the model's noise is added to each pixel separately and nothing moves. And the picture leaves out the hard part: the backwards step is not a law of nature here. It has to be learned from examples, and the result is only as good as that learning.",
    },
  },

  example: {
    setup: "Shrink the problem to pictures with one pixel. The training set holds just two of them: one whose pixel is 1 and one whose pixel is −1. Pick a moment partway through the noising process at which a picture is its clean value times 0.6, plus random noise times 0.8. We noise one training picture, then ask what a perfect denoiser would say about the result.",
    steps: [
      "Forward. Take the clean value 1. The random noise drawn this time is −0.125. The noisy value is 0.6 × 1 + 0.8 × (−0.125) = 0.6 − 0.1 = 0.5.",
      "Now forget where 0.5 came from. If the clean value was 1, the noisy value should be near 0.6. If it was −1, it should be near −0.6. The value 0.5 is only 0.1 from the first and 1.1 from the second.",
      "Turn those distances into weights. A value that is far off needs an unusually large noise to explain it, which is unlikely. The exact rule gives the clean value 1 a weight of about 72 in 100 and the clean value −1 a weight of about 28 in 100.",
      "The denoiser's best guess is the weighted average: 0.72 × 1 + 0.28 × (−1) = 0.44. It is not a training value. It is a hedge between the two.",
      "The noise that guess implies is (0.5 − 0.6 × 0.44) ÷ 0.8, about 0.3. The sampler takes a small step that removes part of it, then repeats at a lower noise level.",
    ],
    result: "The guess, 0.44, is neither 1 nor −1, and the implied noise, 0.3, is not the true noise, −0.125. A single step cannot do better, because 0.5 really could have come from either picture. As the noise level drops over later steps, the weights move toward 100 to 0, and the last guess lands exactly on a training value. On which one depends on the random noise along the way.",
  },

  terms: [
    { term: "Generative model", meaning: "A program that produces new examples resembling the data it was built from, such as new pictures." },
    { term: "Noise", meaning: "Random numbers added to data. Here each pixel gets its own independent random number drawn from a bell-shaped distribution." },
    { term: "Forward process", meaning: "The fixed recipe that destroys a picture in many small steps, each fading it slightly and adding a little noise." },
    { term: "Noise schedule", meaning: "The list that says how much noise each step adds. It decides how quickly the picture disappears." },
    { term: "Denoiser", meaning: "The part that looks at a noisy picture and estimates the clean picture, or equally the noise in it. In a real model it is a neural network." },
    { term: "Reverse process", meaning: "Generation: start from pure noise and apply the denoiser step by step, from the noisiest level down to none. Also called sampling." },
    { term: "Training set", meaning: "The collection of examples the model is built from. On this page it is four small pictures." },
    { term: "Memorize", meaning: "To reproduce training examples exactly. The opposite, producing sensible examples that were not in the training set, is called generalizing." },
  ],

  takeaway: "Learn to remove a little noise from a picture, then start from pure noise and remove a little, many times over.",

  viz: {
    describe: 'A 10 by 10 grid of grey pixels shows the current picture: pure noise at the start of sampling, a recognizable shape at the end. Below it, a strip shows the four training images, a plus, a ring, a cross and a triangle. Under each is a bar and a percentage: the weight the denoiser gives that image as the explanation of the current picture. At the right of the strip is the denoiser\'s best guess of the clean picture, which is the weighted average of the four. This demonstration uses no neural network. Its denoiser is the exact optimal one for these four images, so it can only ever reproduce one of them. Real models approximate that denoiser with a network, which is why they can produce new images.',
    inputs: [
      { id: 'mode', type: 'select', label: 'Direction', options: [{ value: 'reverse', label: 'Reverse: generate from pure noise' }, { value: 'forward', label: 'Forward: add noise to an image' }], default: DEFAULTS.mode },
      { id: 'steps', type: 'range', label: 'Steps (T)', min: 25, max: 200, step: 25, default: DEFAULTS.steps,
        help: 'The noise added per step shrinks as T grows, so that the picture is always fully destroyed by the last step.' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: DEFAULTS.seed },
      { id: 'image', type: 'select', label: 'Image to add noise to (forward only)', options: GLYPHS.map((g) => ({ value: g.id, label: g.label })), default: DEFAULTS.image },
    ],
    presets: [
      { label: 'Generate from noise', values: { ...DEFAULTS } },
      { label: 'Another seed, another image', values: { ...DEFAULTS, seed: 2 } },
      { label: 'Forward: destroy the ring', values: { ...DEFAULTS, mode: 'forward' } },
      { label: 'Few, coarse steps', values: { ...DEFAULTS, steps: 25 } },
      { label: 'Many fine steps', values: { ...DEFAULTS, steps: 200 } },
    ],
    tryThis: [
      'Play the default run and watch the weights under the training images. For roughly the first third of the steps they stay near 25% each and the best guess is a blur of all four. Then one image pulls ahead, and by about the halfway point the denoiser is certain. The rest of the run only cleans up. The choice of image was made by noise, early, while the picture still looked like static.',
      'Press Randomize several times. The final image changes, and it is always exactly one of the four. Over the seeds 1 to 200 the counts are 50 plus, 62 ring, 49 cross and 39 triangle. An even split would be 50 each, and differences of this size are what chance produces in 200 draws.',
      'Load "Forward: destroy the ring" and watch the same weights in the other direction. The denoiser stays certain for a long time after your eye has lost the ring, then loses it too. By the last step all four weights are near 25%: no information about the starting image is left.',
      'Compare "Few, coarse steps" with "Many fine steps". Both end on a training image. With real networks, the number of steps is a trade between speed and quality. With this perfect denoiser even coarse steps cannot go wrong, which is one more way the demonstration is easier than the real thing.',
    ],
    run,
    report: (r, c) => (r.mode === 'forward'
      ? `Forward process on the ${r.image} for ${r.T} steps.\nSignal left at the end: ${r.signalLeft.toFixed(4)} of the original. Denoiser's weights at the end: ${r.weights.map((w) => `${Math.round(w * 100)}%`).join(', ')}.\n${c['noising steps'] || 0} noising steps. Nothing is learned in this direction.`
      : `Sampling for ${r.T} steps ended on the training image "${r.nearestLabel}" (pixel difference ${r.distance.toFixed(3)}).\nThe denoiser first gave one image more than 50% at step ${r.undecidedUntil} and at least 99% at step ${r.decidedAt}.\n${c['denoiser evaluations'] || 0} denoiser evaluations. This demonstration can only reproduce its four training images.`),
  },

  logic: {
    intuition: 'Adding a little Gaussian noise is a small, simple change. Undoing it is also a small change, close to Gaussian, provided you know roughly what the clean picture looks like. So instead of learning to produce a picture outright, learn the answer to an easier question at every noise level: given this noisy picture, what is the best guess of the clean one? With that answer in hand, generation is a walk from pure noise toward the data, in which each step trusts the current guess only a little and keeps some randomness, so that different walks end in different places.',
    steps: [
      'Choose a noise schedule: small numbers β₁ to β_T that say how much noise each of the T steps adds. Let α_t = 1 − β_t, and let ᾱ_t be the product of α₁ up to α_t. It says how much of the original picture survives after t steps.',
      'Forward process. After t steps a picture x₀ has become x_t = √ᾱ_t · x₀ + √(1 − ᾱ_t) · noise. This formula jumps straight to any step, which is how training examples are made.',
      'Training, in a real model. Pick a training image, a step t and some noise at random, form x_t, and ask the network to predict the noise. Adjust the network to reduce the squared error. This page skips training and uses the exact optimal answer instead.',
      'Sampling. Start with x_T made of pure noise.',
      'At step t, ask the denoiser for its best guess x̂₀ of the clean picture, and work out the noise ε̂ that this guess implies.',
      'Move to step t − 1: subtract a small multiple of ε̂ and rescale, which gives the mean μ of the next picture. Then add a smaller amount of fresh noise. On the final step add none.',
      'After step 1, what remains is the sample.',
    ],
    pseudocode: [
      'forward(x₀):',
      '  for t = 1 … T:  x_t ← √(1−β_t)·x_{t−1} + √β_t·noise',
      'sample():',
      '  x_T ← pure noise',
      '  for t = T … 1:',
      '    x̂₀ ← denoise(x_t, t)',
      '    ε̂ ← (x_t − √ᾱ_t·x̂₀) / √(1−ᾱ_t)',
      '    μ ← (x_t − β_t·ε̂ / √(1−ᾱ_t)) / √α_t',
      '    x_{t−1} ← μ + σ_t·noise   (none when t = 1)',
      '  return x₀',
    ],
    decisions: [
      { title: 'What plays the denoiser here?', text: 'Not a network. For a training set of N images x₁ … x_N the best possible guess, in the squared-error sense, has a closed form: a weighted average of the training images, with weights proportional to exp(−‖x_t − √ᾱ_t · x_i‖² / (2(1 − ᾱ_t))). A network trained to perfection on these four images would compute exactly this. The page runs the formula so that nothing is hidden, and accepts the consequence: it memorizes by construction.' },
      { title: 'How many steps?', text: 'Ho and colleagues used T = 1000. Fewer steps means larger jumps, for which the simple Gaussian form of each reverse step is a cruder approximation. Much later work is about getting good samples from tens of steps or fewer.' },
      { title: 'Which noise schedule?', text: 'This page uses a linear schedule: β rises in a straight line from 0.1/T to 20/T, which for T = 1000 is the 0.0001 to 0.02 of the original paper. Other schedules, such as the cosine schedule, destroy the picture more evenly.' },
      { title: 'How much fresh noise per step?', text: 'The sampler adds noise with variance σ_t² = β_t (1 − ᾱ_{t−1}) / (1 − ᾱ_t), one of the two choices examined in the original paper. Adding none at all gives a deterministic sampler, the idea behind the later DDIM method.' },
      { title: 'What should the network predict?', text: 'The noise, the clean picture, or a mixture of the two. They carry the same information, since any one can be computed from another together with x_t. The original paper reported its best samples when the network predicted the noise.' },
    ],
    invariants: [
      'At every step the denoiser\'s weights are non-negative and add up to 1, so its best guess always lies between the training images.',
      'In the forward process, x_t is distributed as √ᾱ_t · x₀ plus Gaussian noise of variance 1 − ᾱ_t. The signal\'s share and the noise variance always add up to 1.',
      'ᾱ_t decreases with t, from 1 at step 0 to nearly 0 at step T.',
    ],
    edgeCases: [
      'The last sampling step, t = 1, adds no fresh noise. Otherwise the result would be left slightly noisy.',
      'If ᾱ_T is not close to 0, the forward process never reaches pure noise, and starting the sampler from pure noise starts it somewhere the denoiser was never trained for.',
      'Too few steps make each β large. With the schedule used here, T = 20 would give a final β of 1, which wipes out the picture in one step and makes the update divide by zero. The slider starts at 25 for that reason.',
      'A training set with one image: every weight goes to that image and every sample is that image.',
      'Two training images that are equally good explanations of x_t get equal weights. Only the fresh noise of later steps breaks the tie.',
    ],
    correctness: 'Two facts are exact. First, the jump formula for the forward process follows from adding independent Gaussian noises: after t steps the surviving signal is √ᾱ_t and the accumulated noise variance is 1 − ᾱ_t. A test on this page checks that against the step-by-step simulation. Second, for a finite training set the squared-error-optimal denoiser is the posterior mean given by Bayes\' rule, which is the weighted average described above. What is approximate is the reverse step. The true reverse of a small noising step is nearly Gaussian, and it becomes exactly Gaussian only as the steps become infinitely small. In that limit a sampler with the exact denoiser draws from exactly the training distribution, which here means each of the four images with probability one quarter. Nothing guarantees that a trained network matches the optimal denoiser, and the interesting behaviour of real models, good and bad, comes from that mismatch.',
    mistakes: [
      'Adding fresh noise on the final step, which leaves every sample slightly speckled.',
      'Confusing ᾱ_t with α_t, or 1 − ᾱ_t with its square root. The formulas mix all four.',
      'Feeding the network pictures scaled 0 to 1 when the noise schedule assumes values centred on zero, such as −1 to 1.',
      'Evaluating a generative model only by how good its samples look, without checking whether they are copies of training images.',
      'Assuming a demonstration with an exact denoiser, like this one, shows how new images arise. It shows the sampling mechanism only.',
    ],
  },

  code: {
    sample: {
      input: 'A one-dimensional version: the training set is the three numbers −1, 0.2 and 1. Use 40 steps and the same linear schedule and optimal denoiser as the visualization, with a small fixed random number generator so that every language prints the same numbers. Print one sampling run, then the results of ten more.',
      expected: 'signal left after 40 noising steps: 0.002\nt=32: x=0.771 guess=0.073\nt=24: x=0.467 guess=0.011\nt=16: x=-0.218 guess=0.065\nt= 8: x=-0.602 guess=-0.719\nt= 0: x=-1.000 guess=-1.000\nten samples: 1.000 1.000 0.200 0.200 0.200 0.200 -1.000 1.000 -1.000 1.000',
    },
    python: {
      source: `import math

DATA = [-1.0, 0.2, 1.0]  # the whole training set: three numbers
T = 40
state = 2020


def rand():
    """Park-Miller generator: the same numbers in every language."""
    global state
    state = state * 48271 % 2147483647
    return state / 2147483647


def gauss():
    """One bell-curve random number from two uniform ones (Box-Muller)."""
    return math.sqrt(-2 * math.log(rand())) * math.cos(2 * math.pi * rand())


beta = [0.0]
abar = [1.0]  # abar[t]: fraction of the original signal's variance left after t steps
for t in range(1, T + 1):
    beta.append((0.1 + 19.9 * (t - 1) / (T - 1)) / T)
    abar.append(abar[t - 1] * (1 - beta[t]))


def denoise(x, t):
    """Best guess of the clean value: every training value, weighted by how well it explains x."""
    total = 0.0
    guess = 0.0
    for d in DATA:
        miss = x - math.sqrt(abar[t]) * d
        weight = math.exp(-miss * miss / (2 * (1 - abar[t])))
        total += weight
        guess += weight * d
    return guess / total


def sample(show):
    x = gauss()
    for t in range(T, 0, -1):
        x0 = denoise(x, t)
        eps = (x - math.sqrt(abar[t]) * x0) / math.sqrt(1 - abar[t])
        mean = (x - beta[t] * eps / math.sqrt(1 - abar[t])) / math.sqrt(1 - beta[t])
        sigma = math.sqrt(beta[t] * (1 - abar[t - 1]) / (1 - abar[t]))
        x = mean + (sigma * gauss() if t > 1 else 0.0)
        if show and (t - 1) % 8 == 0:
            print(f"t={t - 1:2d}: x={x:.3f} guess={x0:.3f}")
    return x


print(f"signal left after {T} noising steps: {math.sqrt(abar[T]):.3f}")
sample(True)
print("ten samples: " + " ".join(f"{sample(False):.3f}" for _ in range(10)))`,
      notes: [
        { line: 23, text: 'The linear noise schedule, and the running product `abar` that says how much of the original signal is left after t steps.' },
        { line: 27, text: 'The optimal denoiser for this training set. Each training value is weighted by how well it explains the noisy x, and the guess is the weighted average. A real model replaces this function with a neural network.' },
        { line: 43, text: 'The noise that the guess implies: what must have been added to the faded guess to give x.' },
        { line: 44, text: 'The DDPM update: remove a small part of that noise and undo the fading of this step.' },
        { line: 46, text: 'Add fresh noise, except on the last step. This randomness is why different runs end on different training values.' },
        { line: 54, text: 'Ten samples. Each one is exactly a training value: with an exact denoiser, sampling can only return what it was given.' },
      ],
    },
    javascript: {
      source: `const DATA = [-1.0, 0.2, 1.0]; // the whole training set: three numbers
const T = 40;
let state = 2020;

// Park-Miller generator: the same numbers in every language.
function rand() {
  state = (state * 48271) % 2147483647;
  return state / 2147483647;
}

// One bell-curve random number from two uniform ones (Box-Muller).
function gauss() {
  return Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
}

const beta = [0];
const abar = [1]; // abar[t]: fraction of the original signal's variance left after t steps
for (let t = 1; t <= T; t++) {
  beta.push((0.1 + (19.9 * (t - 1)) / (T - 1)) / T);
  abar.push(abar[t - 1] * (1 - beta[t]));
}

// Best guess of the clean value: every training value, weighted by how well it explains x.
function denoise(x, t) {
  let total = 0;
  let guess = 0;
  for (const d of DATA) {
    const miss = x - Math.sqrt(abar[t]) * d;
    const weight = Math.exp((-miss * miss) / (2 * (1 - abar[t])));
    total += weight;
    guess += weight * d;
  }
  return guess / total;
}

function sample(show) {
  let x = gauss();
  for (let t = T; t >= 1; t--) {
    const x0 = denoise(x, t);
    const eps = (x - Math.sqrt(abar[t]) * x0) / Math.sqrt(1 - abar[t]);
    const mean = (x - (beta[t] * eps) / Math.sqrt(1 - abar[t])) / Math.sqrt(1 - beta[t]);
    const sigma = Math.sqrt((beta[t] * (1 - abar[t - 1])) / (1 - abar[t]));
    x = mean + (t > 1 ? sigma * gauss() : 0);
    if (show && (t - 1) % 8 === 0) {
      console.log("t=" + String(t - 1).padStart(2, " ") + ": x=" + x.toFixed(3) + " guess=" + x0.toFixed(3));
    }
  }
  return x;
}

console.log("signal left after " + T + " noising steps: " + Math.sqrt(abar[T]).toFixed(3));
sample(true);
const results = [];
for (let i = 0; i < 10; i++) results.push(sample(false).toFixed(3));
console.log("ten samples: " + results.join(" "));`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <vector>

const double DATA[3] = {-1.0, 0.2, 1.0};  // the whole training set: three numbers
const int T = 40;
const double PI = 3.141592653589793;
long long state = 2020;
std::vector<double> beta_(T + 1, 0.0), abar(T + 1, 1.0);

// Park-Miller generator: the same numbers in every language.
double rnd() {
    state = state * 48271 % 2147483647;
    return static_cast<double>(state) / 2147483647;
}

// One bell-curve random number from two uniform ones (Box-Muller).
double gauss() {
    double radius = std::sqrt(-2 * std::log(rnd()));
    return radius * std::cos(2 * PI * rnd());
}

// Best guess of the clean value: every training value, weighted by how well it explains x.
double denoise(double x, int t) {
    double total = 0, guess = 0;
    for (double d : DATA) {
        double miss = x - std::sqrt(abar[t]) * d;
        double weight = std::exp(-miss * miss / (2 * (1 - abar[t])));
        total += weight;
        guess += weight * d;
    }
    return guess / total;
}

double sample(bool show) {
    double x = gauss();
    for (int t = T; t >= 1; --t) {
        double x0 = denoise(x, t);
        double eps = (x - std::sqrt(abar[t]) * x0) / std::sqrt(1 - abar[t]);
        double mean = (x - beta_[t] * eps / std::sqrt(1 - abar[t])) / std::sqrt(1 - beta_[t]);
        double sigma = std::sqrt(beta_[t] * (1 - abar[t - 1]) / (1 - abar[t]));
        x = mean + (t > 1 ? sigma * gauss() : 0.0);
        if (show && (t - 1) % 8 == 0) std::printf("t=%2d: x=%.3f guess=%.3f\\n", t - 1, x, x0);
    }
    return x;
}

int main() {
    for (int t = 1; t <= T; ++t) {
        beta_[t] = (0.1 + 19.9 * (t - 1) / (T - 1)) / T;
        abar[t] = abar[t - 1] * (1 - beta_[t]);
    }
    std::printf("signal left after %d noising steps: %.3f\\n", T, std::sqrt(abar[T]));
    sample(true);
    std::printf("ten samples:");
    for (int i = 0; i < 10; ++i) std::printf(" %.3f", sample(false));
    std::printf("\\n");
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Generating one sample takes T evaluations of the denoiser, one per step, and they cannot be run in parallel because each step needs the result of the one before. In a real model the denoiser is a large neural network, so sampling is far more expensive than for a model that generates in a single pass. On this page the denoiser compares the picture with each of N training images of D pixels, which costs O(N · D) per step.',
    cases: [
      { case: 'One sample, DDPM sampler', time: 'T denoiser evaluations', when: 'T = 1000 in the original paper. The steps are sequential.' },
      { case: 'One sample on this page', time: 'O(T · N · D)', when: 'N = 4 training images of D = 100 pixels, with the exact denoiser.' },
      { case: 'One training example, real model', time: 'One forward and one backward pass of the network', when: 'Thanks to the jump formula, training needs a single noise level per example and never simulates the whole chain.' },
    ],
    space: 'One picture of D values during sampling, plus the denoiser. For a real model the denoiser is the network\'s weights. For the exact denoiser on this page it is the whole training set.',
    memory: 'The exact denoiser has to hold every training image, which is one reason it is not a practical model: its memory and its time per step both grow with the size of the training set. A network\'s size is fixed whatever the amount of training data.',
    tradeoffs: 'More steps give a more faithful reverse process and cost proportionally more time. Much of the work since 2020 has been about cutting the number of steps, by deterministic samplers, better numerical solvers, or training a second model to imitate many steps in one.',
    assumptions: [
      'Cost is counted in denoiser evaluations. For a real model each one is a full pass through a large network.',
      'The statements about training describe real diffusion models. Nothing is trained on this page.',
      'The exact denoiser shown here is only feasible because the training set is tiny.',
    ],
  },

  tradeoffs: {
    excels: [
      'Sample quality and variety on images, audio and similar continuous data.',
      'Stable training: the loss is a plain squared error, with no second network to balance against.',
      'Flexible use after training: the same model can be steered by a text prompt, asked to fill in a missing region, or to vary an existing image.',
    ],
    struggles: [
      'Speed. Each sample needs many passes through a large network.',
      'Cost. Training the best-known models took very large datasets and amounts of computation.',
      'Discrete data such as text, where adding a little Gaussian noise has no natural meaning.',
    ],
    pitfalls: [
      'Reproducing training data. Real models have been shown to emit near-copies of some images from their training sets, especially ones that appeared many times.',
      'Mismatched endpoints: if the forward process does not quite reach pure noise, sampling starts from a distribution the network never saw.',
      'Small mistakes in the schedule constants, which give samples that are washed out, too bright or still noisy without any error message.',
    ],
    misunderstandings: [
      "\"The picture is hidden in the noise and the model uncovers it.\" The starting noise contains no picture. The model invents one as it goes, and the noise only decides which.",
      "\"The model stores its training images and stitches them together.\" A real model's network is far smaller than its training set and cannot hold it. The exact denoiser on this page does hold its four images, which is why it is not a real model.",
      "\"The forward, noise-adding process is learned.\" It is a fixed formula. Only the denoiser is learned.",
      "\"This demonstration shows a diffusion model creating images.\" It shows the sampling loop with a perfect denoiser, which can only reproduce training images. Creating new ones needs a network that generalizes.",
    ],
    constraints: [
      'Large models run the diffusion in a compressed representation of the image, not on the pixels, to make each step affordable.',
      'Because models can reproduce training examples, what data they were trained on has legal and ethical weight.',
    ],
    alternatives: [
      { name: 'Generative adversarial networks', when: 'Generation must be a single fast pass, and the harder training is acceptable.' },
      { name: 'Autoregressive models', when: 'The data is a sequence of discrete symbols, such as text, generated one piece at a time.' },
      { name: 'Variational autoencoders', when: 'A compact, structured code for each example matters more than the sharpness of samples.' },
      { id: 'metropolis-hastings', name: 'Markov chain Monte Carlo', when: 'The probability of any candidate can be computed up to a constant, so no model needs to be learned.' },
    ],
    comparison: {
      columns: ['', 'This page', 'A real diffusion model'],
      rows: [
        ['Denoiser', 'An exact formula over 4 stored images', 'A trained neural network'],
        ['Training', 'None', 'Long training runs on very large datasets'],
        ['What sampling returns', 'One of the 4 training images, exactly', 'Usually an image not in the training set'],
        ['Why', 'The exact denoiser is the posterior mean over the training set', 'The network approximates that denoiser and generalizes'],
        ['Steps', '25 to 200', '1000 in the original paper, far fewer with later samplers'],
      ],
    },
  },

  applications: [
    { title: 'Text-to-image generation', status: 'established', text: 'Stable Diffusion, DALL·E 2 and Imagen generate images from a written prompt with diffusion models. The prompt is fed to the denoiser as an extra input, so that each denoising step is steered toward pictures matching the text.' },
    { title: 'Speech and audio synthesis', status: 'established', text: 'Diffusion models such as DiffWave and WaveGrad generate audio waveforms by denoising, guided by a spectrogram of the sound to be produced.' },
    { title: 'Protein design', status: 'established', text: 'RFdiffusion, published in 2023, applies the same idea to the three-dimensional coordinates of a protein backbone, starting from random positions and denoising toward a plausible structure.' },
    { title: 'Editing and restoring images', status: 'established', text: 'Because sampling proceeds step by step, known parts of an image can be held fixed while the rest is generated. This is used to fill in missing regions and to increase resolution.' },
    { title: 'Planning robot movements', status: 'illustrative', text: 'A sequence of future robot actions can be treated like an image: start from a random sequence and denoise it, conditioned on what the robot currently sees.' },
  ],

  connections: [
    { to: 'backpropagation', type: 'prerequisite', why: 'A real denoiser is a neural network, and it is trained by backpropagating the squared error between the noise it predicts and the noise that was added.' },
    { to: 'monte-carlo', type: 'prerequisite', why: 'Both produce results from random draws. Every sample here is the end of a chain of random steps, and a property of the model can only be estimated by averaging many samples.' },
    { to: 'metropolis-hastings', type: 'related', why: 'Both are Markov chains built to end up sampling a target distribution. Metropolis-Hastings needs a formula for the target and corrects each step by accepting or refusing it. A diffusion model has no formula and learns its steps from data.' },
    { to: 'simulated-annealing', type: 'related', why: 'Both start with a great deal of randomness and reduce it gradually, so that large-scale decisions are made early and details settle late.' },
    { to: 'bayesian-updating', type: 'prerequisite', why: 'The exact denoiser is Bayes\' rule: each training image is a hypothesis, the noisy picture is the evidence, and the weights are the updated beliefs.' },
    { to: 'gradient-descent', type: 'prerequisite', why: 'Training the denoiser means minimizing a loss by gradient steps. Sampling itself also resembles a noisy descent, since each step moves the picture toward regions the model considers more likely.' },
    { to: 'attention', type: 'advanced', why: 'The denoising networks of current image models rely on attention layers, both within the image and between the image and a text prompt.' },
    { to: 'concept:markov-chain', type: 'prerequisite', why: 'In both directions each step depends only on the current picture and fresh noise, which makes the forward and reverse processes Markov chains.' },
    { to: 'concept:gaussian-distribution', type: 'prerequisite', why: 'Every step adds Gaussian noise, and sums of Gaussians are Gaussian, which is what allows the forward process to jump to any step in one formula.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Image generation, editing and restoration are the best-known uses of diffusion models.' },
    { to: 'discipline:physics', type: 'related', why: 'The forward process is a discretized diffusion, the same mathematics that describes ink spreading in water or heat spreading in a solid.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Which part of a diffusion model is learned from data?',
      options: ['The forward process that adds noise', 'The noise schedule', 'The denoiser used in the reverse process', 'The random noise that sampling starts from'],
      answer: 2,
      explain: [
        'The forward process is a fixed formula: fade a little, add a little noise.',
        'The schedule is chosen by the designer in standard DDPM. Some later variants learn it, but that is not what makes the model work.',
        'Correct. The only learned component is the function that looks at a noisy picture and estimates the clean one, or the noise in it.',
        'The starting noise is drawn fresh from a fixed distribution every time.',
      ],
    },
    {
      type: 'predict',
      q: 'The visualization starts from pure noise and runs 100 reverse steps with the exact optimal denoiser for its four training images. What is the final picture?',
      options: ['A blurry average of the four images', 'Exactly one of the four training images', 'A new shape that combines parts of several images', 'Something that still looks like noise'],
      answer: 1,
      explain: [
        'The blurry average is the denoiser\'s guess at the start, when it cannot tell the images apart. It does not survive to the end.',
        'Correct. As the noise level falls, the weights collapse onto a single training image and the last step returns it exactly. This demonstration memorizes by construction.',
        'That would require a denoiser that generalizes. The exact one never leaves the four images it knows.',
        'The reverse process removes the noise completely by the last step.',
      ],
      tryInput: { ...DEFAULTS },
    },
    {
      type: 'debug',
      q: 'Samples from this loop are always close to a training value but never exactly on one: each is off by a small random amount. What is wrong?',
      code: `for t in range(T, 0, -1):
    x0 = denoise(x, t)
    eps = (x - math.sqrt(abar[t]) * x0) / math.sqrt(1 - abar[t])
    mean = (x - beta[t] * eps / math.sqrt(1 - abar[t])) / math.sqrt(1 - beta[t])
    sigma = math.sqrt(beta[t])
    x = mean + sigma * gauss()`,
      options: ['eps should be divided by (1 − abar[t]) without the square root', 'Fresh noise is added on every step, including the last one', 'The loop should run from t = 1 up to T', 'mean should be multiplied by sqrt(1 − beta[t]) instead of divided'],
      answer: 1,
      explain: [
        'The square root is right: the noise in x has standard deviation √(1 − abar).',
        'Correct. At t = 1 the step should return the mean with no noise added. Here even the final step adds noise of size √β₁, which is what leaves the samples slightly off.',
        'Sampling runs from the noisiest step down to the cleanest.',
        'Dividing is right: it undoes the fading by √(1 − β) that the forward step applied.',
      ],
    },
    {
      type: 'choice',
      q: 'Why can a real diffusion model produce images that are not in its training set, when the demonstration on this page cannot?',
      options: ['It uses more steps', 'It adds more noise at the start', 'Its denoiser is a neural network that approximates the optimal denoiser and generalizes', 'It was trained on colour images'],
      answer: 2,
      explain: [
        'More steps with the exact denoiser still end on a training image.',
        'The starting noise only chooses among outcomes. It does not create new ones.',
        'Correct. The exact denoiser is a weighted average of training images and collapses onto one of them. A network of limited size, trained on far more images than it can store, has to learn regularities instead, and those carry over to pictures it never saw.',
        'The kind of image is irrelevant to the argument.',
      ],
    },
    {
      type: 'challenge',
      title: 'Make the exact denoiser forget',
      prompt: 'Work in two dimensions. Take about 30 training points arranged on a circle. First run the sampler with the exact optimal denoiser, 200 times, and confirm that every sample lands on a training point. Then blunt the denoiser: divide the exponent in its weights by a constant larger than 1, so that it is less sure which training point a noisy point came from. Run 200 samples again and plot them. Describe where the samples now fall, and say in what sense the blunted denoiser has generalized and in what sense it is simply wrong.',
      hints: ['The weights are exp(−distance² / (2(1 − ᾱ_t))). Blunting them replaces 2(1 − ᾱ_t) by a larger number.', 'Look at whether new samples fall on the circle between training points, inside it, or both.'],
    },
  ],

  compare: {
    idea: 'Turn data into noise by a fixed gradual process, learn to undo one small step of it, and generate by undoing all the steps starting from pure noise.',
    requires: 'A large training set and a neural network trained as a denoiser at every noise level. On this page, an exact formula over four stored images stands in for the network.',
    sensitivity: 'Moderate. Depends on the noise schedule, the number of sampling steps and above all the quality of the denoiser.',
    memory: 'One sample plus the denoiser. The exact denoiser must store the whole training set.',
    difficulty: 'high',
    difficultyNote: 'The sampling loop is a few lines. The constants are easy to get subtly wrong, and training a real denoiser is a large engineering task.',
    limits: 'Slow sampling. Can reproduce training data. With an exact denoiser, as here, it can do nothing else.',
    useWhen: 'You need high-quality, varied samples of images or similar data and can afford many network evaluations per sample.',
  },

  advanced: {
    history: 'Jascha Sohl-Dickstein, Eric Weiss, Niru Maheswaranathan and Surya Ganguli proposed in 2015 to learn a generative model by reversing a gradual diffusion process, an idea taken from non-equilibrium thermodynamics. In 2019 Yang Song and Stefano Ermon developed a closely related approach based on estimating the gradient of the log-density of the data at many noise levels. In 2020 Jonathan Ho, Ajay Jain and Pieter Abbeel simplified the training objective to predicting the added noise, connected the two lines of work, and reported image quality that brought the method wide attention. In 2021 Song and colleagues described both as discretizations of a stochastic differential equation, and Prafulla Dhariwal and Alex Nichol reported diffusion models surpassing generative adversarial networks on image synthesis. Robin Rombach and colleagues showed in 2022 that running the diffusion in a compressed latent space makes high-resolution generation far cheaper, the design behind Stable Diffusion.',
    derivation: '**The forward process.** One step is $x_t = \\sqrt{1 - \\beta_t}\\, x_{t-1} + \\sqrt{\\beta_t}\\, \\epsilon_t$ with $\\epsilon_t \\sim \\mathcal{N}(0, I)$. Write $\\alpha_t = 1 - \\beta_t$ and $\\bar\\alpha_t = \\prod_{s \\le t} \\alpha_s$. Unrolling the recursion, the coefficient of $x_0$ is $\\sqrt{\\bar\\alpha_t}$, and the independent noises add up to a single Gaussian whose variance $v_t$ obeys $v_t = \\alpha_t v_{t-1} + \\beta_t$, with solution $v_t = 1 - \\bar\\alpha_t$. So\n\n$$x_t = \\sqrt{\\bar\\alpha_t}\\, x_0 + \\sqrt{1 - \\bar\\alpha_t}\\, \\epsilon, \\qquad \\epsilon \\sim \\mathcal{N}(0, I).$$\n\n**The optimal denoiser.** Suppose $x_0$ is one of the training images $x_1, \\dots, x_N$, each equally likely. Given $x_t$, Bayes\' rule gives image $i$ the posterior probability\n\n$$w_i(x_t) = \\frac{\\exp\\left(-\\lVert x_t - \\sqrt{\\bar\\alpha_t}\\, x_i \\rVert^2 / (2(1 - \\bar\\alpha_t))\\right)}{\\sum_j \\exp\\left(-\\lVert x_t - \\sqrt{\\bar\\alpha_t}\\, x_j \\rVert^2 / (2(1 - \\bar\\alpha_t))\\right)}.$$\n\nThe guess that minimizes the expected squared error is the posterior mean, $\\hat x_0 = \\mathbb{E}[x_0 \\mid x_t] = \\sum_i w_i(x_t)\\, x_i$, and the matching noise estimate is $\\hat\\epsilon = (x_t - \\sqrt{\\bar\\alpha_t}\\, \\hat x_0)/\\sqrt{1 - \\bar\\alpha_t}$. A network trained with the DDPM loss\n\n$$L = \\mathbb{E}_{x_0, t, \\epsilon}\\, \\lVert \\epsilon - \\epsilon_\\theta(\\sqrt{\\bar\\alpha_t}\\, x_0 + \\sqrt{1 - \\bar\\alpha_t}\\, \\epsilon,\\, t) \\rVert^2$$\n\non this training set has $\\hat\\epsilon$ as its exact minimizer.\n\n**The reverse step.** If $x_0$ were known, the distribution of $x_{t-1}$ given $x_t$ and $x_0$ would be Gaussian with variance $\\tilde\\beta_t = \\beta_t (1 - \\bar\\alpha_{t-1})/(1 - \\bar\\alpha_t)$ and a mean that is a fixed combination of $x_t$ and $x_0$. Substituting the estimate $\\hat x_0$, written in terms of $\\hat\\epsilon$, gives the sampling update\n\n$$x_{t-1} = \\frac{1}{\\sqrt{\\alpha_t}}\\left(x_t - \\frac{\\beta_t}{\\sqrt{1 - \\bar\\alpha_t}}\\, \\hat\\epsilon\\right) + \\sigma_t z, \\qquad z \\sim \\mathcal{N}(0, I),$$\n\nwith $\\sigma_t^2 = \\tilde\\beta_t$ on this page and $z = 0$ at $t = 1$. At $t = 1$ the update returns $\\hat x_0$ itself, because $\\bar\\alpha_1 = \\alpha_1$. Once the weights have collapsed onto one image, that is the image returned.',
    variants: [
      { name: 'Score-based models', text: 'Describe the same process in continuous time as a stochastic differential equation. The network estimates the score, the gradient of the log-density of noisy data, which is the predicted noise up to a scale factor.' },
      { name: 'DDIM', text: 'A deterministic sampler for the same trained network that adds no fresh noise and can take much larger steps, reducing a thousand steps to tens.' },
      { name: 'Improved schedules and learned variances', text: 'The cosine schedule destroys information more evenly than the linear one, and the network can be trained to predict the variance of each reverse step as well as its mean.' },
      { name: 'Latent diffusion', text: 'Compresses images with a separate autoencoder and runs the diffusion on the compressed representation, which makes each step far cheaper.' },
      { name: 'Guidance', text: 'Steers sampling toward a condition such as a text prompt by combining the predictions of the network with and without the condition.' },
    ],
    implementation: 'Precompute β, α and ᾱ for every step and check that ᾱ at the last step is close to zero. Scale data to be centred on zero. In an exact denoiser, subtract the smallest distance before exponentiating so that the weights do not all underflow to zero in high dimensions. Test the forward process by comparing the step-by-step simulation with the jump formula, and test a sampler on a tiny dataset where the exact answer is known, as on this page.',
    benchmarking: 'Image generators are usually compared by statistics computed over many samples, such as the Fréchet Inception Distance, together with the number of network evaluations per sample. Such scores do not detect copying, so the nearest training images to a sample should be inspected as well.',
    references: [
      { authors: 'J. Ho, A. Jain and P. Abbeel', year: 2020, title: 'Denoising diffusion probabilistic models', venue: 'Advances in Neural Information Processing Systems 33 (NeurIPS)' },
      { authors: 'J. Sohl-Dickstein, E. Weiss, N. Maheswaranathan and S. Ganguli', year: 2015, title: 'Deep unsupervised learning using nonequilibrium thermodynamics', venue: 'Proceedings of the 32nd International Conference on Machine Learning (ICML)' },
      { authors: 'Y. Song, J. Sohl-Dickstein, D. P. Kingma, A. Kumar, S. Ermon and B. Poole', year: 2021, title: 'Score-based generative modeling through stochastic differential equations', venue: 'International Conference on Learning Representations (ICLR)' },
      { authors: 'J. Song, C. Meng and S. Ermon', year: 2021, title: 'Denoising diffusion implicit models', venue: 'International Conference on Learning Representations (ICLR)' },
      { authors: 'T. Karras, M. Aittala, T. Aila and S. Laine', year: 2022, title: 'Elucidating the design space of diffusion-based generative models', venue: 'Advances in Neural Information Processing Systems 35 (NeurIPS)' },
      { authors: 'R. Rombach, A. Blattmann, D. Lorenz, P. Esser and B. Ommer', year: 2022, title: 'High-resolution image synthesis with latent diffusion models', venue: 'IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)' },
    ],
    furtherReading: [
      'N. Carlini and colleagues, "Extracting training data from diffusion models", USENIX Security Symposium (2023), on real models reproducing training images.',
      'A. Nichol and P. Dhariwal, "Improved denoising diffusion probabilistic models", ICML (2021), on the cosine schedule and learned variances.',
    ],
  },

  tests: [
    { name: 'the schedule: accumulated noise variance equals 1 - abar at every step', input: {},
      check: () => {
        for (const T of [25, 50, 100, 200, 1000]) {
          const { beta, abar } = schedule(T);
          let v = 0;
          for (let t = 1; t <= T; t++) {
            v = (1 - beta[t]) * v + beta[t];
            if (Math.abs(v - (1 - abar[t])) > 1e-12) return `T=${T}: variance ${v} but 1 - abar = ${1 - abar[t]} at step ${t}`;
            if (!(beta[t] > 0 && beta[t] < 1 && abar[t] < abar[t - 1])) return `T=${T}: bad schedule at step ${t}`;
          }
          if (abar[T] > 1e-4) return `T=${T}: abar at the end is ${abar[T]}`;
        }
        const ho = schedule(1000).beta;
        return (Math.abs(ho[1] - 1e-4) < 1e-15 && Math.abs(ho[1000] - 0.02) < 1e-15) || 'T = 1000 does not reproduce 0.0001 to 0.02';
      } },
    { name: 'the simulated forward process has the noise variance the schedule predicts', input: { ...DEFAULTS, mode: 'forward', steps: 200, seed: 3 },
      check: (r, c) => {
        const mean = r.varianceRatio.reduce((a, b) => a + b, 0) / r.varianceRatio.length;
        const ok = Math.abs(mean - 1) < 0.05 && r.varianceRatio.every((v) => v > 0.6 && v < 1.6) && r.signalLeft < 0.01
          && r.weights.every((w) => Math.abs(w - 0.25) < 0.1) && c['noising steps'] === 200;
        return ok || `mean variance ratio ${mean}, signal left ${r.signalLeft}`;
      } },
    { name: 'the default reverse run ends exactly on a training image', input: {},
      check: (r, c) => (r.distance < 1e-9 && r.nearest === 'plus' && r.decidedAt === 50 && c['denoiser evaluations'] === 100) || `distance ${r.distance}, nearest ${r.nearest}, decided at ${r.decidedAt}` },
    { name: 'reverse runs from 200 seeds all end on a training image, split roughly evenly', input: {},
      check: () => {
        const counts = { plus: 0, ring: 0, cross: 0, triangle: 0 };
        for (let seed = 1; seed <= 200; seed++) {
          const r = run({ ...DEFAULTS, seed }, QUIET);
          if (r.distance > 1e-9) return `seed ${seed} ended ${r.distance} away from the nearest training image`;
          counts[r.nearest]++;
        }
        return (counts.plus === 50 && counts.ring === 62 && counts.cross === 49 && counts.triangle === 39) || JSON.stringify(counts);
      } },
    { name: 'coarse and fine step counts also end on a training image', input: { ...DEFAULTS, steps: 25, seed: 11 },
      check: (r) => (r.distance < 1e-9 && run({ ...DEFAULTS, steps: 200, seed: 11 }, QUIET).distance < 1e-9) || `distance ${r.distance}` },
    { name: 'the denoiser weights are a probability distribution and the guess stays between the images', input: {},
      check: () => {
        const rng = makeRng(5);
        for (const a of [0.9, 0.5, 0.1, 0.001]) {
          const x = Float64Array.from({ length: D }, () => rng.normal());
          const d = denoise(x, a);
          if (Math.abs(d.weights.reduce((p, q) => p + q, 0) - 1) > 1e-12 || d.weights.some((w) => w < 0)) return 'weights are not a distribution';
          if (Array.from(d.guess).some((v) => v < -1 - 1e-12 || v > 1 + 1e-12)) return 'guess leaves the range of the training images';
        }
        return true;
      } },
    { name: 'the worked example by hand', input: {},
      check: () => {
        const noisy = 0.6 * 1 + 0.8 * -0.125;
        const d = denoise(Float64Array.of(noisy), 0.36, [Float64Array.of(1), Float64Array.of(-1)]);
        const eps = (noisy - 0.6 * d.guess[0]) / 0.8;
        return (Math.abs(noisy - 0.5) < 1e-12 && Math.round(d.weights[0] * 100) === 72 && Math.round(d.weights[1] * 100) === 28
          && Math.round(d.guess[0] * 100) === 44 && Math.round(eps * 10) === 3) || `weights ${d.weights}, guess ${d.guess[0]}, noise ${eps}`;
      } },
  ],
};
