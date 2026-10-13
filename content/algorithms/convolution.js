import { makeRng } from '../../js/lib/rng.js';

const NINTH = 1 / 9;
// The kernels on offer, exactly as they are written down. "sobel-x" measures change from left to
// right, "sobel-y" change from top to bottom.
const KERNELS = {
  blur: [[NINTH, NINTH, NINTH], [NINTH, NINTH, NINTH], [NINTH, NINTH, NINTH]],
  sharpen: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
  'sobel-x': [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
  'sobel-y': [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
  shift: [[0, 0, 0], [0, 0, 1], [0, 0, 0]],
};
const KERNEL_NAMES = {
  blur: 'blur kernel', sharpen: 'sharpen kernel', 'sobel-x': 'horizontal Sobel kernel', 'sobel-y': 'vertical Sobel kernel',
  shift: 'kernel with a single 1 on its right side', custom: 'kernel you typed',
};
const SIDE = 9;

const minus = (s) => s.replace('-', '−');
const num = (v) => {
  if (Math.abs(v) < 5e-10) return '0';
  const r = Math.round(v);
  if (Math.abs(v - r) < 1e-9) return minus(String(r));
  return minus(v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2));
};
const weightText = (w) => {
  if (Math.abs(w - Math.round(w)) < 1e-12) return num(w);
  const n = w * 9;
  return Math.abs(n - Math.round(n)) < 1e-9 ? `${minus(String(Math.round(n)))}/9` : num(w);
};
const turned = (k) => k.slice().reverse().map((row) => row.slice().reverse());
const sameKernel = (a, b, sign = 1) => a.every((row, i) => row.every((w, j) => Math.abs(w - sign * b[i][j]) < 1e-12));

function makeImage(id, n, seed) {
  const rng = makeRng(seed * 7919 + n);
  const lo = Math.floor(n / 3), hi = n - lo, mid = Math.floor(n / 2);
  const at = (r, c) => {
    switch (id) {
      case 'step': return c < mid ? 2 : 8;
      case 'diagonal': return c > r ? 8 : 1;
      case 'ramp': return c % 10;
      case 'dot': return r === mid && c === mid ? 9 : 0;
      case 'flat': return 5;
      case 'noise': return rng.int(0, 9);
      default: return r >= lo && r < hi && c >= lo && c < hi ? 9 : 1;
    }
  };
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => at(r, c)));
}

function parsePixels(text) {
  const rows = text.split(/[\s,;/|]+/).filter(Boolean);
  if (rows.some((r) => /[^0-9]/.test(r))) throw new Error('Type an image as rows of digits from 0 to 9 with a space between the rows, for example 111999 111999 111999.');
  if (rows.some((r) => r.length !== rows[0].length)) throw new Error('Every row of the image needs the same number of digits.');
  if (rows.length > 12 || rows[0].length > 12) throw new Error('At most 12 rows and 12 columns, so that the numbers stay readable.');
  return rows.map((r) => r.split('').map(Number));
}

// The same sums with no tracing. Used inside frame thunks only, to fix the shading scale of a
// picture and to compare a turned kernel with the kernel as written. The tests do not use it.
function plainSlide(image, kernel) {
  const out = [];
  for (let r = 0; r + kernel.length <= image.length; r++) {
    const row = [];
    for (let c = 0; c + kernel[0].length <= image[0].length; c++) {
      let sum = 0;
      for (let a = 0; a < kernel.length; a++) for (let b = 0; b < kernel[0].length; b++) sum += kernel[a][b] * image[r + a][c + b];
      row.push(sum);
    }
    out.push(row);
  }
  return out;
}
const peak = (grid) => Math.max(0, ...grid.flat().filter((v) => v !== null).map(Math.abs));

/* ---- pictures ---- */
const GAP = 1.5;
// One block of cells inside a scene. `frame` is the size of the dashed outline the block sits in.
function drawPanel(layers, { ox, title, grid, signed, scale, frame, inset = [0, 0], box, cell }) {
  const [FR, FC] = frame;
  layers.push({ type: 'text', at: [ox + FC / 2, FR + 0.4], text: title, role: 'muted', align: 'center', size: 11.5 });
  if (inset[0] || inset[1]) layers.push({ type: 'rect', x: ox, y: 0, w: FC, h: FR, fill: false, stroke: true, role: 'faint', dash: [3, 4], width: 1 });
  grid.forEach((row, r) => row.forEach((v, c) => {
    const x = ox + inset[1] + c, y = FR - 1 - inset[0] - r;
    if (v === null) { layers.push({ type: 'rect', x: x + 0.05, y: y + 0.05, w: 0.9, h: 0.9, role: 'default', fillAlpha: 0.12 }); return; }
    const strength = Math.min(1, Math.abs(v) / (scale || 1));
    layers.push({ type: 'rect', x: x + 0.05, y: y + 0.05, w: 0.9, h: 0.9, role: !signed ? 'sage' : v < 0 ? 'brick' : 'forest', fillAlpha: 0.1 + (signed ? 0.42 : 0.6) * strength });
    const label = num(v);
    layers.push({ type: 'text', at: [x + 0.5, y + 0.5], dy: 4, text: label, role: 'text', align: 'center', size: label.length >= 4 ? 9.5 : label.length === 3 ? 10.5 : 11 });
  }));
  if (box) layers.push({ type: 'rect', x: ox + box.c, y: FR - box.r - box.h, w: box.w, h: box.h, fill: false, stroke: true, role: 'current', width: 3 });
  if (cell) layers.push({ type: 'rect', x: ox + inset[1] + cell[1], y: FR - 1 - inset[0] - cell[0], w: 1, h: 1, fill: false, stroke: true, role: 'current', width: 3 });
}
function scene(title, panels, legend) {
  const layers = [];
  let ox = 0, tall = 0;
  for (const p of panels) { drawPanel(layers, { ...p, ox }); ox += p.frame[1] + GAP; tall = Math.max(tall, p.frame[0]); }
  const wide = ox - GAP;
  return { kind: 'scene', title, x: [-0.3, wide + 0.3], y: [-0.3, tall + 1.1], aspect: Math.min(0.62, Math.max(0.28, (tall + 1.4) / (wide + 0.6))), equal: true, axes: false, layers, legend };
}
const LEGEND = [
  { label: 'where the kernel is, and the output cell it fills', role: 'current' },
  { label: 'image numbers (a stronger shade is a larger number)', role: 'sage' },
  { label: 'output above zero', role: 'forest' },
  { label: 'output below zero', role: 'brick' },
];

function run(input, t) {
  const typed = typeof input.pixels === 'string' ? input.pixels.trim() : '';
  const image = input.customImage || (typed ? parsePixels(typed) : makeImage(input.image, Math.round(input.side || SIDE), input.seed));
  const R = image.length, C = image[0].length;
  const own = input.customKernel || (Array.isArray(input.custom) && input.custom.length ? input.custom : null);
  if (own && !input.customKernel && own.length !== 9) throw new Error('Your own kernel needs exactly nine numbers, typed row by row. Leave the field empty to use the kernel chosen above.');
  const mode = own ? 'custom' : input.kernel in KERNELS ? input.kernel : 'edges';
  const flip = !!input.flip;
  const written = input.customKernel || (own ? [own.slice(0, 3), own.slice(3, 6), own.slice(6, 9)] : mode === 'edges' ? KERNELS['sobel-x'] : KERNELS[mode]);
  const kh = written.length, kw = written[0].length;
  if (R < kh || C < kw) throw new Error(`The image is ${R} by ${C}, which is smaller than the ${kh} by ${kw} kernel, so the kernel does not fit anywhere.`);
  const OR = R - kh + 1, OC = C - kw + 1;
  const inset = [(kh - 1) / 2, (kw - 1) / 2];
  const imageTop = Math.max(9, ...image.flat());
  const imagePanel = (box) => ({ title: `image, ${R} by ${C}`, grid: image, signed: false, scale: imageTop, frame: [R, C], box });
  const operation = flip ? 'convolution' : 'cross-correlation';

  // The algorithm. Lays the kernel over every position where it fits, as written (no turning here).
  const slide = (kernel, name, describe) => {
    const out = Array.from({ length: OR }, () => new Array(OC).fill(null));
    let scale = null;
    const unsigned = !kernel.flat().some((w) => w < 0);
    for (let r = 0; r < OR; r++) {
      for (let c = 0; c < OC; c++) {
        let sum = 0;
        for (let a = 0; a < kh; a++) for (let b = 0; b < kw; b++) sum += kernel[a][b] * image[r + a][c + b];
        t.count('kernel multiplications', kh * kw);
        out[r][c] = sum;
        t.frame(() => {
          if (scale === null) scale = unsigned ? Math.max(imageTop, peak(plainSlide(image, kernel))) : peak(plainSlide(image, kernel));
          const patch = Array.from({ length: kh }, (_, a) => image[r + a].slice(c, c + kw));
          const cells = patch.map((row, a) => [...row.map(num), a === Math.floor(kh / 2) ? '×' : '', ...kernel[a].map(weightText), a === Math.floor(kh / 2) ? '=' : '', ...row.map((p, b) => num(kernel[a][b] * p))]);
          const roles = {};
          patch.forEach((row, a) => row.forEach((p, b) => {
            roles[`${a},${b}`] = 'current';
            const q = kernel[a][b] * p;
            if (Math.abs(q) > 1e-12) roles[`${a},${2 * kw + 2 + b}`] = q < 0 ? 'alert' : 'done';
          }));
          const head = (label) => Array.from({ length: kw }, (_, b) => (b === Math.floor(kw / 2) ? label : ''));
          return {
            line: [4, 5, 6],
            note: `The kernel covers rows ${r + 1} to ${r + kh} and columns ${c + 1} to ${c + kw} of the image. ${describe(patch, sum)} That number goes into the output at row ${r + 1}, column ${c + 1}, the place that matches the middle of the kernel.`,
            views: [
              scene(`Sliding the ${name} over the image`, [imagePanel({ r, c, h: kh, w: kw }), { title: `output, ${OR} by ${OC}`, grid: out.map((row) => row.slice()), signed: !unsigned, scale, frame: [R, C], inset, cell: [r, c] }], LEGEND),
              { kind: 'table', title: `Each number under the kernel times the weight in the same place. The ${kh * kw} products add up to ${num(sum)}`,
                colLabels: [...head('pixels'), '', ...head('weights'), '', ...head('products')], cells, roles },
            ],
            vars: { 'output row': r + 1, 'output column': c + 1, sum: num(sum) },
          };
        });
      }
    }
    return out;
  };

  // What one sum means, in words, with the numbers that make the claim checkable.
  const describer = (kernel, kind) => (patch, sum) => {
    const ws = kernel.flat(), ps = patch.flat(), n = ws.length;
    const flat = ps.every((p) => p === ps[0]);
    const wsum = ws.reduce((a, b) => a + b, 0);
    let pos = 0, neg = 0, total = 0;
    ws.forEach((w, i) => { const q = w * ps[i]; if (q > 0) pos += q; else neg -= q; total += ps[i]; });
    if (ws.every((w) => w > 0 && Math.abs(w - ws[0]) < 1e-12)) return `Every weight is ${weightText(ws[0])}, so the sum is the ${n} numbers added together, ${num(total)}, times ${weightText(ws[0])}: **${num(sum)}**.${Math.abs(wsum - 1) < 1e-9 ? ` Because the weights add up to 1, this is the average of the ${n} numbers.` : ''}`;
    if (flat && Math.abs(wsum) < 1e-12) return `All ${n} numbers under the kernel are ${num(ps[0])}, so each product is a weight times ${num(ps[0])}. The weights add up to 0, so the products cancel and the sum is **0**. A flat patch has no edge.`;
    if (ws.filter((w) => Math.abs(w) > 1e-12).length === 1) return `Only one weight is not 0, so the sum is that weight times the number beneath it: **${num(sum)}**.`;
    let text = neg > 0 || ws.some((w) => w < 0) ? `The products above zero add up to ${num(pos)} and the products below zero to ${num(-neg)}, so the sum is ${num(pos)} − ${num(neg)} = **${num(sum)}**.` : `The products add up to **${num(sum)}**.`;
    if (kind === 'x' || kind === 'y') {
      // Which side carries the positive weights decides what a positive sum means. A turned Sobel kernel has them on the other side.
      const forward = (kind === 'x' ? kernel[Math.floor(kh / 2)][kw - 1] : kernel[kh - 1][Math.floor(kw / 2)]) > 0;
      const sides = kind === 'x' ? ['right-hand column', 'left-hand column', 'from left to right'] : ['bottom row', 'top row', 'from top to bottom'];
      const plus = forward ? sides[0] : sides[1], less = forward ? sides[1] : sides[0];
      text += Math.abs(sum) < 1e-9 ? ` The ${plus} has the positive weights and the ${less} the negative ones, and here the two sides balance, so there is no change ${sides[2]} at this spot.`
        : ` The ${plus} has the positive weights and the ${less} the negative ones, so a ${sum > 0 ? 'positive' : 'negative'} sum means the numbers get ${(sum > 0) === forward ? 'larger' : 'smaller'} ${sides[2]} here.`;
    } else if (flat && Math.abs(wsum - 1) < 1e-9) {
      text += ` The weights add up to 1 and the patch is flat, so the sum is the same number that was there before.`;
    }
    return text;
  };

  const symmetric = sameKernel(turned(written), written), opposite = sameKernel(turned(written), written, -1);
  const turnEffect = symmetric ? 'This kernel looks the same after half a turn, so turning it changes nothing: for a kernel like this, convolution and cross-correlation give identical outputs.'
    : opposite ? 'Half a turn swaps the sign of every weight in this kernel, so every output number will have the opposite sign to the one cross-correlation gives.'
      : 'This kernel does not look the same after half a turn, so the two operations give different outputs.';
  const both = mode === 'edges';
  const how = flip
    ? `The switch "turn the kernel" is on, so ${both ? 'each kernel' : 'the kernel'} is turned half a turn before it slides. That is **convolution** in the strict mathematical sense. ${both ? 'Half a turn swaps the sign of every weight in a Sobel kernel, so every Sobel output will have the opposite sign to the one cross-correlation gives.' : turnEffect}`
    : `${both ? 'Each kernel' : 'The kernel'} is used exactly as it is written, without turning it. Strictly speaking that is **cross-correlation**. Convolution in the strict sense turns the kernel half a turn first. Image software and neural network libraries usually skip the turn and still say "convolution". ${both ? 'Switch on "turn the kernel" to see what the turn does to these two.' : symmetric ? 'This kernel looks the same after half a turn, so here the two operations give identical outputs.' : 'Switch on "turn the kernel" to see what the turn does to this kernel.'}`;
  const places = (k) => `${k} ${k === 1 ? 'place' : 'places'}`;
  const sizeWhy = `A kernel must lie wholly inside the image, so it has ${places(OR)} to stand from top to bottom and ${places(OC)} from left to right. The output is therefore ${OR} by ${OC}, smaller than the image.`;

  if (mode !== 'edges') {
    const used = flip ? turned(written) : written;
    const name = KERNEL_NAMES[mode] || 'kernel';
    const kind = mode === 'sobel-x' ? 'x' : mode === 'sobel-y' ? 'y' : null;
    t.frame(() => ({ line: flip ? [8, 9] : 0,
      note: `The image is a grid of ${R * C} numbers, one for each pixel. The ${name} is a ${kh} by ${kw} grid of weights${flip && !symmetric ? '. After its half turn they read, row by row' : ', row by row'}: ${used.map((row) => row.map(weightText).join(', ')).join(' / ')}. It will be laid over every ${kh} by ${kw} patch of the image in turn. ${how} ${sizeWhy}`,
      views: [scene(`The image and the empty output`, [imagePanel(null), { title: `output, ${OR} by ${OC}`, grid: Array.from({ length: OR }, () => new Array(OC).fill(null)), signed: false, scale: 1, frame: [R, C], inset }], LEGEND),
        { kind: 'table', title: `The ${name}${flip ? ', after its half turn' : ''}`, colLabels: Array.from({ length: kw }, (_, b) => `column ${b + 1}`), rowLabels: Array.from({ length: kh }, (_, a) => `row ${a + 1}`), corner: 'weights', cells: used.map((row) => row.map(weightText)) }],
      vars: { operation, 'image size': `${R} × ${C}`, 'output size': `${OR} × ${OC}` } }));
    const output = slide(used, name, describer(used, kind));
    const flatOut = output.flat();
    const lo = Math.min(...flatOut), hi = Math.max(...flatOut), zeros = flatOut.filter((v) => Math.abs(v) < 1e-9).length;
    const unsigned = !used.flat().some((w) => w < 0);
    const nonzero = flatOut.filter((v) => Math.abs(v) >= 1e-9);
    const nzLo = Math.min(...nonzero), nzHi = Math.max(...nonzero);
    t.frame(() => {
      const other = plainSlide(image, flip ? written : turned(written));
      const same = other.every((row, r) => row.every((v, c) => Math.abs(v - output[r][c]) < 1e-9));
      const negated = other.every((row, r) => row.every((v, c) => Math.abs(v + output[r][c]) < 1e-9));
      const compare = same ? `Run it again ${flip ? 'without the turn' : 'with the kernel turned'} and every output number is the same${symmetric ? ', because this kernel is unchanged by half a turn' : ' for this image'}.`
        : negated ? `Run it again ${flip ? 'without the turn' : 'with the kernel turned'} and every output number has the opposite sign, because half a turn swaps the sign of every weight in this kernel.`
          : `Run it again ${flip ? 'without the turn' : 'with the kernel turned'} and the output is different, because this kernel does not look the same after half a turn.`;
      const meaning = mode === 'blur' ? `Each output number is the average of nine image numbers, so sudden jumps are spread over neighbouring cells. The output runs from ${num(lo)} to ${num(hi)}.`
        : mode === 'sharpen' ? `The output runs from ${num(lo)} to ${num(hi)}. Where the image is flat the numbers are unchanged, because the weights add up to 1. Next to a jump the kernel pushes the two sides further apart, which is what makes an edge look crisper.`
          : kind ? `The output is 0 in ${zeros} of its ${OR * OC} places, where the image does not change ${kind === 'x' ? 'from left to right' : 'from top to bottom'} under the kernel.${zeros < OR * OC ? ` Everywhere else it is ${Math.abs(nzLo - nzHi) < 1e-9 ? num(nzLo) : `between ${num(nzLo)} and ${num(nzHi)}`}.` : ''}`
            : `The output runs from ${num(lo)} to ${num(hi)}.`;
      return { line: 7, note: `The kernel has visited all ${OR * OC} positions, with ${kh * kw} multiplications at each: ${OR * OC * kh * kw} in all. ${meaning} ${compare}`,
        views: [scene(`The image and the finished output (${operation})`, [imagePanel(null), { title: `output, ${OR} by ${OC}`, grid: output, signed: !unsigned, scale: unsigned ? Math.max(imageTop, peak(output)) : peak(output), frame: [R, C], inset }], LEGEND)],
        vars: { operation, smallest: num(lo), largest: num(hi) } };
    });
    return { mode, flip, operation, image, rows: R, cols: C, outRows: OR, outCols: OC, kernel: written, used, output, positions: OR * OC };
  }

  /* ---- edge strength: both Sobel kernels, then one number per place ---- */
  const kx = flip ? turned(KERNELS['sobel-x']) : KERNELS['sobel-x'];
  const ky = flip ? turned(KERNELS['sobel-y']) : KERNELS['sobel-y'];
  t.frame(() => ({ line: 10,
    note: `The image is a grid of ${R * C} numbers, one for each pixel. Two 3 by 3 kernels will slide over it. The horizontal Sobel kernel measures how fast the numbers change from left to right, and the vertical one how fast they change from top to bottom. Then the two outputs are combined into one edge strength for every place. ${how} ${sizeWhy}`,
    views: [scene('The image and the empty output', [imagePanel(null), { title: `output, ${OR} by ${OC}`, grid: Array.from({ length: OR }, () => new Array(OC).fill(null)), signed: false, scale: 1, frame: [R, C], inset }], LEGEND),
      { kind: 'table', title: `The two Sobel kernels${flip ? ', each after its half turn' : ''}`, colLabels: ['', 'horizontal', '', '', '', 'vertical', ''], cells: kx.map((row, a) => [...row.map(weightText), '', ...ky[a].map(weightText)]) }],
    vars: { operation, 'image size': `${R} × ${C}`, 'output size': `${OR} × ${OC}` } }));
  const gx = slide(kx, 'horizontal Sobel kernel', describer(kx, 'x'));
  t.frame(() => ({ line: 12,
    note: `The horizontal Sobel kernel is finished. Its output is 0 in ${gx.flat().filter((v) => Math.abs(v) < 1e-9).length} of ${OR * OC} places, where the numbers under it did not change from left to right. It cannot see an edge that runs from left to right, because along such an edge its left and right columns hold the same numbers. The vertical Sobel kernel is the same kernel turned a quarter turn, and it is run next to catch those.`,
    views: [scene('Horizontal Sobel output, complete', [imagePanel(null), { title: 'change from left to right', grid: gx, signed: true, scale: peak(gx), frame: [R, C], inset }], LEGEND)],
    vars: { operation, done: 'horizontal Sobel' } }));
  const gy = slide(ky, 'vertical Sobel kernel', describer(ky, 'y'));
  const strength = Array.from({ length: OR }, () => new Array(OC).fill(null));
  for (let r = 0; r < OR; r++) {
    for (let c = 0; c < OC; c++) strength[r][c] = Math.sqrt(gx[r][c] * gx[r][c] + gy[r][c] * gy[r][c]);
    t.count('edge strengths', OC);
    t.frame(() => {
      let best = 0;
      for (let c = 1; c < OC; c++) if (strength[r][c] > strength[r][best]) best = c;
      const top = Math.max(peak(gx), peak(gy)), sTop = Math.sqrt(2) * top;
      const frameOf = [OR, OC];
      return { line: [13, 14],
        note: `Row ${r + 1} of the edge strength map. For each place, square the two Sobel outputs, add the squares and take the square root. ${strength[r][best] > 1e-9 ? `The strongest in this row is at column ${best + 1}: √(${num(gx[r][best])}² + ${num(gy[r][best])}²) = **${num(strength[r][best])}**.` : 'Both Sobel outputs are 0 all along this row, so every strength in it is **0**.'} Squaring removes the sign, so an edge counts the same whether the image gets brighter or darker across it, and the strength is 0 only where both outputs are 0.`,
        views: [scene('Combining the two Sobel outputs', [
          { title: 'left to right', grid: gx, signed: true, scale: top, frame: frameOf, box: { r, c: 0, h: 1, w: OC } },
          { title: 'top to bottom', grid: gy, signed: true, scale: top, frame: frameOf, box: { r, c: 0, h: 1, w: OC } },
          { title: 'edge strength', grid: strength.map((row) => row.slice()), signed: true, scale: sTop, frame: frameOf, box: { r, c: 0, h: 1, w: OC } },
        ], [{ label: 'row being combined', role: 'current' }, { label: 'above zero', role: 'forest' }, { label: 'below zero', role: 'brick' }]),
          { kind: 'rows', title: `Row ${r + 1}, place by place`, rows: [
            { label: 'Left to right', cells: gx[r].map((v, c) => ({ t: num(v), role: c === best && strength[r][best] > 1e-9 ? 'current' : 'default' })) },
            { label: 'Top to bottom', cells: gy[r].map((v, c) => ({ t: num(v), role: c === best && strength[r][best] > 1e-9 ? 'current' : 'default' })) },
            { label: 'Strength', cells: strength[r].map((v, c) => ({ t: num(v), role: c === best && v > 1e-9 ? 'current' : v > 1e-9 ? 'done' : 'default' })) },
          ] }],
        vars: { 'output row': r + 1, 'strongest here': num(strength[r][best]) } };
    });
  }
  const flatS = strength.flat();
  const hi = Math.max(...flatS), zeros = flatS.filter((v) => v < 1e-9).length;
  t.frame(() => {
    const other = plainSlide(image, flip ? KERNELS['sobel-x'] : turned(KERNELS['sobel-x']));
    const negated = other.every((row, r) => row.every((v, c) => Math.abs(v + gx[r][c]) < 1e-9));
    return { line: 15,
      note: `The edge strength map is finished. It is 0 in ${zeros} of its ${OR * OC} places, ${zeros ? 'where the image is flat under both kernels, ' : ''}and its largest value is ${num(hi)}. ${hi > 1e-9 ? 'The large values trace the places where the image numbers change, whichever way the edge runs.' : 'A flat image has no edges, so there is nothing to find.'} ${negated && hi > 1e-9 ? `${flip ? 'Without the turn' : 'With both kernels turned half a turn'}, every Sobel output would have the opposite sign. Squaring removes signs, so this map would be exactly the same.` : ''}`,
      views: [scene(`The image and its edge strength (${operation})`, [imagePanel(null), { title: 'edge strength', grid: strength, signed: true, scale: peak(strength), frame: [R, C], inset }], [LEGEND[1], { label: 'edge strength (a stronger shade is a larger number)', role: 'forest' }])],
      vars: { operation, 'largest strength': num(hi), 'places with no edge': zeros } };
  });
  return { mode, flip, operation, image, rows: R, cols: C, outRows: OR, outCols: OC, kernel: KERNELS['sobel-x'], used: kx, gx, gy, strength, output: strength, positions: OR * OC };
}

/* ---- independent references for the tests (they share no code with run) ---- */
// Cross-correlation by shifting: for each kernel weight, add that weight times a shifted copy of
// the whole image. The loops are nested the other way round from the implementation above.
function shiftAndAdd(image, kernel) {
  const kh = kernel.length, kw = kernel[0].length, OR = image.length - kh + 1, OC = image[0].length - kw + 1;
  const out = Array.from({ length: OR }, () => new Array(OC).fill(0));
  for (let a = 0; a < kh; a++) for (let b = 0; b < kw; b++) {
    if (kernel[a][b] === 0) continue;
    for (let r = 0; r < OR; r++) for (let c = 0; c < OC; c++) out[r][c] += kernel[a][b] * image[r + a][c + b];
  }
  return out;
}
// Convolution straight from its definition, with the kernel index running backwards.
function byDefinition(image, kernel) {
  const kh = kernel.length, kw = kernel[0].length, OR = image.length - kh + 1, OC = image[0].length - kw + 1;
  return Array.from({ length: OR }, (_, r) => Array.from({ length: OC }, (_, c) => {
    let s = 0;
    for (let a = 0; a < kh; a++) for (let b = 0; b < kw; b++) s += kernel[a][b] * image[r + kh - 1 - a][c + kw - 1 - b];
    return s;
  }));
}
const gridsMatch = (x, y, eps = 1e-9) => {
  if (x.length !== y.length || x[0].length !== y[0].length) return `sizes differ: ${x.length} by ${x[0].length} against ${y.length} by ${y[0].length}`;
  for (let r = 0; r < x.length; r++) for (let c = 0; c < x[0].length; c++) if (!(Math.abs(x[r][c] - y[r][c]) <= eps)) return `row ${r + 1}, column ${c + 1}: ${x[r][c]} against ${y[r][c]}`;
  return true;
};
const QUIET = { count() {}, frame() {} };
const BASE = { image: 'square', pixels: '', kernel: 'edges', custom: [], flip: false, seed: 4 };
const BOX5 = Array.from({ length: 5 }, () => new Array(5).fill(1 / 25));

export default {
  meta: {
    id: 'convolution',
    name: 'Convolution and Edge Detection',
    aliases: ['image filter', 'Sobel filter', 'Sobel operator', 'image kernel', 'convolution matrix', 'cross-correlation', '2D convolution', 'edge detector', 'sliding window filter'],
    kind: 'algorithm',
    discipline: 'computer-vision',
    alsoIn: [
      { id: 'deep-learning', why: 'A convolutional layer slides kernels like these across its input, with the weights learned from examples instead of written by hand.' },
      { id: 'computer-graphics', why: 'Blurring, sharpening and embossing a picture are all done by sliding a fixed kernel over its pixels.' },
    ],
    subfield: 'Image processing',
    family: 'Linear filters',
    lab: 'neural-networks',
    summary: 'Slides a small grid of weights over an image and writes one weighted sum per position. The weights decide whether the result is a blur, a sharper image or a map of the edges.',
    difficulty: 'intermediate',
    order: 652,
    paradigms: ['transform'],
    randomized: false,
    approximate: false,
    time: { best: 'O(N · K)', average: 'O(N · K)', worst: 'O(N · K) for N pixels and K kernel weights', class: 'linear' },
    space: { worst: 'O(N) for the output image', class: 'linear' },
    tags: {
      problems: ['find the edges in a photo', 'blur a picture', 'sharpen a photo', 'outline the shapes in a picture', 'find where brightness changes in an image', 'smooth out speckles in an image'],
      techniques: ['sliding window', 'weighted sum', 'kernel', 'finite differences', 'cross-correlation'],
      applications: ['image processing', 'computer graphics', 'machine learning', 'signal processing'],
    },
    prerequisites: ['concept:array', 'concept:matrix'],
  },

  bigIdea: {
    simple: "A picture on a screen is a grid of tiny squares called pixels. Each pixel is stored as a number that says how bright it is. Convolution makes a new picture from an old one with the help of a small grid of numbers called a kernel. Lay the kernel over one patch of the picture. Multiply each pixel in the patch by the kernel number lying on top of it. Add up the results. That single sum becomes one pixel of the new picture. Then slide the kernel one step along and do it again, until it has visited every patch. Different kernels do different jobs. If all the kernel numbers are equal, each new pixel is an average of its neighbours, and the picture turns blurry. If one side of the kernel is negative and the other side positive, the sum is zero where the picture is smooth and large where the brightness changes suddenly. Those sudden changes are edges: the outlines of things.",
    when: 'Use it when what you want at each pixel depends only on a small neighbourhood around that pixel, and in the same way everywhere in the image: smoothing, sharpening, measuring how fast brightness changes, or looking for a small fixed pattern. It is the wrong tool when the rule should differ from place to place, or when the answer depends on parts of the image that are far apart. Sobel edge strength is a first step and not a finished outline: it gives a number at every pixel, and something else has to decide which numbers count as an edge.',
    interesting: 'One short loop does very different jobs depending on nine numbers. Change the weights and the same code blurs, sharpens or finds edges. That is also the idea behind convolutional neural networks: keep the loop, and let training choose the weights. The networks then find kernels for themselves, and the ones nearest the input often turn out to respond to edges, much like the Sobel kernels that people designed by hand.',
    analogy: {
      title: 'A card with nine windows',
      text: "Take a card with a three by three block of windows cut in it, and write a number beside each window. Lay the card on a page covered in numbers, multiply what shows through each window by the number beside it, add up the nine products, and write the total on a second sheet at the matching place. Then slide the card one square and repeat. Think of the numbers on the card as what the card responds to. A card with negative numbers down one side and positive numbers down the other gives a total far from zero where the numbers on the page rise from one side of the patch to the other, and a total of zero where the page is flat. The second sheet then becomes a map of where that kind of change was found.",
      limits: "The card hides a choice about the border, where it would hang off the page. Here the card simply never goes there, so the second sheet comes out smaller. And a card finds only its own pattern. An edge card says where brightness changes. It does not know whether the edge belongs to a face or a shadow.",
    },
  },

  example: {
    setup: "A tiny image, three rows of six pixels, is dark on the left and bright on the right. Every row reads 1, 1, 1, 9, 9, 9. The kernel is the horizontal Sobel kernel, three rows of three weights: (−1, 0, 1), then (−2, 0, 2), then (−1, 0, 1). Its left column is negative and its right column is positive, so it compares what is on its right with what is on its left. The image is three rows tall, so the kernel fits in only one row of positions, and it can stand in four places from left to right.",
    steps: [
      "First place: the kernel covers columns 1 to 3, where every pixel is 1. Top row: −1 × 1 + 0 × 1 + 1 × 1 = 0. Middle row: −2 + 0 + 2 = 0. Bottom row: 0. The sum is 0.",
      "Slide one step: columns 2 to 4. Now the kernel's left column sits on 1s and its right column on 9s. Top row: −1 × 1 + 0 × 1 + 1 × 9 = 8. Middle row: −2 × 1 + 0 + 2 × 9 = 16. Bottom row: 8. The sum is 8 + 16 + 8 = 32.",
      "Slide again: columns 3 to 5. The left column is still on 1s and the right column on 9s, so the sum is 32 again.",
      "Last place: columns 4 to 6, where every pixel is 9. Top row: −9 + 0 + 9 = 0. The other rows cancel the same way. The sum is 0.",
    ],
    result: "The output is one row of four numbers: 0, 32, 32, 0. It is zero where the image is flat, however bright or dark, and large where the brightness jumps. Notice that the answer is 32 for a jump of 8. The weights on each side add up to 4, so this kernel reports four times the difference between its right and left columns.",
    tryInput: { image: 'square', pixels: '111999 111999 111999', kernel: 'sobel-x', custom: [], flip: false, seed: 4 },
  },

  terms: [
    { term: "Pixel", meaning: "One small square of a picture. A picture is a grid of them." },
    { term: "Greyscale image", meaning: "A picture with no colour, in which each pixel is a single number saying how bright it is." },
    { term: "Kernel", meaning: "A small grid of numbers, often three by three, that is slid over the image. Also called a filter or a mask." },
    { term: "Weight", meaning: "One of the numbers in a kernel. It says how much the pixel beneath it counts, and whether it counts for or against." },
    { term: "Patch", meaning: "The block of pixels that the kernel is lying on at one moment." },
    { term: "Weighted sum", meaning: "Multiply each pixel in the patch by the weight on top of it, then add the products." },
    { term: "Edge", meaning: "A place in a picture where the brightness changes suddenly, such as the outline of an object." },
    { term: "Sobel kernel", meaning: "A three by three kernel that is negative on one side and positive on the other, so that its sum measures how fast brightness changes across it." },
    { term: "Edge strength", meaning: "One number per pixel made from the two Sobel sums. It is large at an edge whichever way the edge runs." },
    { term: "Cross-correlation", meaning: "Sliding the kernel over the image exactly as it is written. This is what the demonstration does unless you ask it to turn the kernel." },
    { term: "Convolution", meaning: "In the strict sense, the same sliding sum with the kernel turned half a turn first. In everyday use the word covers both." },
    { term: "Padding", meaning: "Extra made-up pixels placed around the image so that the kernel can reach the border and the output keeps the size of the image." },
  ],

  takeaway: "Slide a small grid of weights across a picture and write down one weighted sum at each stop: the weights decide whether you get a blur, a sharper picture or a map of the edges.",

  viz: {
    describe: 'Two grids of numbers side by side. On the left is the image: each cell shows one pixel as a number from 0 to 9 and is shaded more strongly the larger the number. A terracotta outline marks the three by three patch the kernel is lying on. On the right is the output, drawn inside a dashed outline the size of the image so that each output cell sits where the middle of the kernel was. Output cells are shaded green when above zero and brick red when below zero, and the cell just filled has a terracotta outline. Under the picture a table shows the nine numbers under the kernel, the nine weights, and the nine products that are added up. When both Sobel kernels are used, a last stage shows their two outputs and the edge strength made from them, one row at a time.',
    inputs: [
      { id: 'image', type: 'select', label: 'Image', default: 'square', options: [
        { value: 'square', label: 'A bright square on a dark background' },
        { value: 'step', label: 'Dark on the left, bright on the right' },
        { value: 'diagonal', label: 'A diagonal edge' },
        { value: 'ramp', label: 'A ramp: each column 1 brighter than the last' },
        { value: 'dot', label: 'One bright dot' },
        { value: 'flat', label: 'Flat: every pixel is 5' },
        { value: 'noise', label: 'Random pixels (uses the seed)' },
      ] },
      { id: 'pixels', type: 'text', label: 'Or type your own image', default: '', maxLength: 160,
        help: 'Rows of digits from 0 to 9, with a space between rows. For example: 111999 111999 111999' },
      { id: 'kernel', type: 'select', label: 'Kernel', default: 'edges', options: [
        { value: 'edges', label: 'Both Sobel kernels, combined into edge strength' },
        { value: 'sobel-x', label: 'Sobel horizontal: change from left to right' },
        { value: 'sobel-y', label: 'Sobel vertical: change from top to bottom' },
        { value: 'blur', label: 'Blur: every weight is 1/9' },
        { value: 'sharpen', label: 'Sharpen: 5 in the middle, −1 on four sides' },
        { value: 'shift', label: 'A single 1 on the right side' },
      ] },
      { id: 'custom', type: 'list', label: 'Or type your own kernel', default: [], maxLength: 9,
        help: 'Nine numbers, row by row. For example 0 0 0 0 1 0 0 0 0 copies the image, and 1 0 0 0 0 0 0 0 -1 compares two opposite corners.' },
      { id: 'flip', type: 'toggle', label: 'Turn the kernel half a turn first (strict convolution)', default: false },
      { id: 'seed', type: 'seed', label: 'Random seed (for the random image)', default: 4 },
    ],
    presets: [
      { label: 'Edges of a square', values: { ...BASE } },
      { label: 'Worked example: one edge, horizontal Sobel', values: { ...BASE, pixels: '111999 111999 111999', kernel: 'sobel-x' } },
      { label: 'Blur a single dot', values: { ...BASE, image: 'dot', kernel: 'blur' } },
      { label: 'Sharpen an edge', values: { ...BASE, image: 'step', kernel: 'sharpen' } },
      { label: 'A ramp under the horizontal Sobel', values: { ...BASE, image: 'ramp', kernel: 'sobel-x' } },
      { label: 'A flat image has no edges', values: { ...BASE, image: 'flat' } },
      { label: 'A single 1 on the right, over a dot', values: { ...BASE, image: 'dot', kernel: 'shift' } },
      { label: 'The same, with the kernel turned', values: { ...BASE, image: 'dot', kernel: 'shift', flip: true } },
      { label: 'A diagonal edge', values: { ...BASE, image: 'diagonal' } },
    ],
    tryThis: [
      'Load "A single 1 on the right, over a dot" and note where the 9 lands in the output: one cell to the left of the dot, because the kernel copies whatever is on its right. Then load "The same, with the kernel turned". The 9 now lands one cell to the right. This kernel does not look the same after half a turn, so cross-correlation and strict convolution disagree.',
      'Choose the blur kernel and switch "Turn the kernel" on and off. Nothing changes, because nine equal weights look the same after half a turn. Do the same with the horizontal Sobel kernel: every output number changes sign and nothing else.',
      'Load "Blur a single dot". The single 9 becomes a three by three block of 1s. The total brightness is still 9, because the weights add up to 1. Blurring spreads brightness around without creating or losing any.',
      'Load "A ramp under the horizontal Sobel". The output is 8 everywhere. The kernel compares columns two steps apart, which differ by 2, and its weights on each side add up to 4. Now switch to the blur or sharpen kernel on the same ramp: the middle of the image comes out unchanged.',
      'Load "Sharpen an edge" and look at the two output columns beside the jump. One dips below the dark side (−4) and the other rises above the bright side (14). That overshoot is what makes a sharpened edge look crisp, and too much of it is what makes over-sharpened photos show pale outlines.',
      'Type your own kernel: `0 0 0 0 1 0 0 0 0`. Every output number is the image number under the middle of the kernel, so the output is the image with its border removed. Then try `1 0 0 0 0 0 0 0 -1`, which subtracts the bottom right corner of each patch from the top left one, on the diagonal edge and on the square.',
    ],
    run,
    report: (r, c) => {
      const flatOut = r.output.flat();
      const head = `${r.operation === 'convolution' ? 'Convolution (kernel turned half a turn)' : 'Cross-correlation (kernel used as written)'} of a ${r.rows} by ${r.cols} image with a ${r.kernel.length} by ${r.kernel[0].length} kernel.`;
      const body = r.mode === 'edges'
        ? `Edge strength from both Sobel kernels: ${r.outRows} by ${r.outCols} values from ${num(Math.min(...flatOut))} to ${num(Math.max(...flatOut))}, of which ${flatOut.filter((v) => v < 1e-9).length} are 0.`
        : `Output: ${r.outRows} by ${r.outCols} values from ${num(Math.min(...flatOut))} to ${num(Math.max(...flatOut))}.`;
      return `${head}\n${body}\n${(c['kernel multiplications'] || 0).toLocaleString('en-US')} kernel multiplications: ${r.kernel.length * r.kernel[0].length} at each of ${r.positions} positions${r.mode === 'edges' ? ', for each of the two kernels' : ''}.`;
    },
    experiment: {
      title: 'Multiplications as the image grows',
      note: 'Each point is a real run on a square image of random pixels, counting every multiplication of a pixel by a kernel weight. The kernel visits every position where it fits and multiplies once per weight. The curves are the exact counts that follow from that, not fitted lines.',
      metric: 'kernel multiplications',
      metricLabel: 'Kernel multiplications',
      sizeLabel: 'Image side in pixels (n)',
      sizes: [8, 16, 32, 64, 128],
      variants: [{ id: 'k3', label: '3 by 3 kernel' }, { id: 'k5', label: '5 by 5 kernel' }],
      input: (n, variant, seed) => ({ ...BASE, image: 'noise', side: n, seed, kernel: 'blur', ...(variant === 'k5' ? { customKernel: BOX5 } : {}) }),
      theory: [
        { label: '9 (n − 2)²', fn: (n) => 9 * (n - 2) * (n - 2), variant: 'k3' },
        { label: '25 (n − 4)²', fn: (n) => 25 * (n - 4) * (n - 4), variant: 'k5' },
      ],
    },
  },

  logic: {
    intuition: 'A kernel is a small pattern, and the weighted sum is a score for how well the patch beneath it matches that pattern. Where the bright pixels of the patch line up with positive weights and the dark pixels with negative weights, the products are all large and of one sign, and the score is high. Where the patch is flat, a kernel whose weights add up to zero scores zero whatever the brightness, because the positive and negative products cancel. Sliding the kernel asks the same question at every position, so the output is a map of where the pattern occurs. A blur kernel asks "what is the average around here?". A Sobel kernel asks "is it brighter on one side than the other?".',
    steps: [
      'Choose a kernel. To do convolution in the strict sense, turn it half a turn first. To do cross-correlation, use it as written.',
      'Place the kernel in the top left corner of the image, so that it covers a patch of its own size.',
      'Multiply each pixel in the patch by the weight lying on it, and add the products.',
      'Write the sum into the output, at the place that matches the position of the kernel.',
      'Slide the kernel one pixel to the right and repeat. At the end of a row, go back to the left and move down one pixel. Stop when the kernel has stood everywhere it fits.',
      'For edge strength, do all of this twice, once with each Sobel kernel. Then, at every place, square the two sums, add them, and take the square root.',
    ],
    pseudocode: [
      'slide(image, kernel):',
      '  for each row r where the kernel fits:',
      '    for each column c where the kernel fits:',
      '      sum ← 0',
      '      for each kernel cell (a, b):',
      '        sum ← sum + kernel[a][b] × image[r + a][c + b]',
      '      output[r][c] ← sum',
      '  return output',
      'convolve(image, kernel):',
      '  return slide(image, kernel turned half a turn)',
      'edge_strength(image):',
      '  gx ← slide(image, sobel_x)',
      '  gy ← slide(image, sobel_y)',
      '  for each output cell (r, c):',
      '    strength[r][c] ← √(gx[r][c]² + gy[r][c]²)',
      '  return strength',
    ],
    decisions: [
      { title: 'Turn the kernel, or not?', text: 'The function `slide` above is cross-correlation: weight (a, b) meets the pixel a rows down and b columns along from the corner of the patch. Convolution, as mathematics defines it, pairs the weights with the pixels in the opposite order, which is the same as turning the kernel half a turn and then sliding it. The demonstration and the code samples do cross-correlation unless you ask for the turn. So do most image libraries and neural network libraries, even where the function is named "convolution". The difference vanishes whenever the kernel looks the same after half a turn, because then the turned kernel is the same grid of numbers. The blur and sharpen kernels are like that. The Sobel kernels are not: half a turn swaps the sign of every weight, so the two operations give outputs of opposite sign, and the edge strength, which squares them, is the same either way.' },
      { title: 'What happens at the border?', text: 'A three by three kernel cannot be centred on a border pixel without hanging off the image. This page uses the simplest answer: the kernel only stands where it fits, so an image of R by C pixels gives an output of R − 2 by C − 2. The alternative is padding: surround the image with extra pixels, either zeros or copies of the nearest real pixel, so that the output keeps the size of the image. Zero padding invents a dark frame, which an edge kernel then reports as an edge all the way round.' },
      { title: 'Which numbers go in the kernel?', text: 'For a blur, positive weights that add up to 1, so that a flat area keeps its brightness. For an edge detector, weights that add up to 0, so that a flat area gives 0. For sharpening, a large positive middle and negative neighbours that together add up to 1. The Sobel kernel also gives the middle row double weight, which averages a little along the edge and makes the result less sensitive to single noisy pixels.' },
      { title: 'How are the two Sobel outputs combined?', text: 'By the length of the arrow whose two parts are the left-to-right change and the top-to-bottom change: the square root of the sum of the squares. A cheaper version adds the two absolute values. It avoids the square root and gives somewhat larger numbers on diagonal edges.' },
      { title: 'How far does the kernel move each time?', text: 'One pixel here. Moving two or more pixels at a time, called a stride, gives a smaller output and is common in neural networks.' },
    ],
    invariants: [
      'After the kernel has left a position, the output cell for that position holds the weighted sum of the original image there. The image itself is never changed.',
      'Every output number depends only on the pixels that were under the kernel at that position.',
      'The output of a sum of two images is the sum of their outputs, and doubling every pixel doubles every output.',
    ],
    edgeCases: [
      'A flat image: a kernel whose weights add up to 1 returns the same flat value, and a kernel whose weights add up to 0 returns 0 everywhere.',
      'An image exactly the size of the kernel gives a single output number.',
      'An image smaller than the kernel gives no output at all. The demonstration refuses it and says why.',
      'A kernel with a single 1 in the middle copies the image. With the 1 off-centre it shifts the image, and the direction of the shift is opposite for cross-correlation and for convolution.',
      'Outputs can fall below 0 or rise above the largest pixel value. To show them as a picture they must be rescaled or clipped, and clipping the negative half of a Sobel output throws away half of the edges.',
    ],
    correctness: 'There is little to prove about the loop itself: it evaluates a formula, and each output cell is, by construction, the weighted sum of the patch that the formula names. What deserves an argument is the claim that the sums mean something. Take a kernel whose weights add up to 0, and a patch in which every pixel has the same value v. Each product is a weight times v, so the sum is v times the sum of the weights, which is 0. So such a kernel is blind to flat areas, whatever their brightness. In the same way a kernel whose weights add up to 1 returns v on a flat patch, so a blur leaves flat areas alone. For the horizontal Sobel kernel, group the products by column: the sum is the weighted total of the right column minus the weighted total of the left column, with weights 1, 2, 1. It is positive when the right side is brighter, negative when the left side is brighter, and zero when they balance. Finally, turning a kernel half a turn sends weight (a, b) to the opposite position. If the kernel has equal weights at opposite positions, the turned kernel is the same grid, so convolution and cross-correlation compute identical sums.',
    mistakes: [
      'Writing the output into the image while the loop is still running, so that later sums read numbers that have already been filtered.',
      'Assuming a library function called "convolution" turns the kernel. Many do not. With a kernel that is not symmetric, check on a single bright dot.',
      'Forgetting that the output is smaller than the image, and reading past the last row or column.',
      'Storing a Sobel output in a type that cannot hold negative numbers or numbers above 255.',
      'Using blur weights that do not add up to 1, so that the whole image gets brighter or darker.',
      'Swapping the two Sobel kernels. The one that measures change from left to right responds to edges that run up and down.',
    ],
  },

  code: {
    sample: {
      input: 'A 5 by 6 image that is dark (1) except for a bright block (9) in its lower right part. It is filtered with the blur kernel and both Sobel kernels, the two Sobel outputs are combined into edge strength, and the horizontal Sobel kernel is run once more turned half a turn.',
      expected: 'blur\n1.00 1.89 2.78 3.67\n1.00 2.78 4.56 6.33\n1.00 3.67 6.33 9.00\nsobel x\n0.00 8.00 8.00 0.00\n0.00 24.00 24.00 0.00\n0.00 32.00 32.00 0.00\nsobel y\n0.00 8.00 24.00 32.00\n0.00 8.00 24.00 32.00\n0.00 0.00 0.00 0.00\nedge strength\n0.00 11.31 25.30 32.00\n0.00 25.30 33.94 32.00\n0.00 32.00 32.00 0.00\nsobel x, kernel turned half a turn (convolution)\n0.00 -8.00 -8.00 0.00\n0.00 -24.00 -24.00 0.00\n0.00 -32.00 -32.00 0.00\nblur changed by the turn: no',
    },
    python: {
      source: `import math


def correlate(image, kernel):
    """Slide the kernel over the image as written: one weighted sum per position."""
    kh, kw = len(kernel), len(kernel[0])
    out = []
    for r in range(len(image) - kh + 1):
        row = []
        for c in range(len(image[0]) - kw + 1):
            total = 0.0
            for a in range(kh):
                for b in range(kw):
                    total += kernel[a][b] * image[r + a][c + b]
            row.append(total)
        out.append(row)
    return out


def half_turn(kernel):
    return [row[::-1] for row in kernel[::-1]]


def convolve(image, kernel):
    """Convolution in the strict sense: turn the kernel half a turn, then slide it."""
    return correlate(image, half_turn(kernel))


def show(title, grid):
    print(title)
    for row in grid:
        print(" ".join(f"{v:.2f}" for v in row))


IMAGE = [
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 9, 9, 9],
    [1, 1, 1, 9, 9, 9],
    [1, 1, 1, 9, 9, 9],
]
BLUR = [[1 / 9] * 3 for _ in range(3)]
SOBEL_X = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
SOBEL_Y = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]

gx = correlate(IMAGE, SOBEL_X)
gy = correlate(IMAGE, SOBEL_Y)
strength = [[math.sqrt(x * x + y * y) for x, y in zip(rx, ry)] for rx, ry in zip(gx, gy)]
show("blur", correlate(IMAGE, BLUR))
show("sobel x", gx)
show("sobel y", gy)
show("edge strength", strength)
show("sobel x, kernel turned half a turn (convolution)", convolve(IMAGE, SOBEL_X))
changed = convolve(IMAGE, BLUR) != correlate(IMAGE, BLUR)
print("blur changed by the turn:", "yes" if changed else "no")`,
      notes: [
        { line: 8, text: 'The kernel only stands where it fits, so there are `len(image) - kh + 1` rows of positions. The output is smaller than the image.' },
        { line: 14, text: 'The whole method is this line. Weight (a, b) meets the pixel a rows down and b columns along from the corner of the patch. Nothing is turned, so this is cross-correlation.' },
        { line: 21, text: 'Reversing the rows and then each row turns the kernel half a turn. For the blur kernel this gives back the same grid, which is why the last line of the output says "no".' },
        { line: 26, text: 'Convolution in the strict sense is the same sliding sum with the turned kernel. For the Sobel kernel the turn swaps every sign, so the printed numbers are the negatives of the earlier ones.' },
        { line: 48, text: 'Edge strength: the two Sobel outputs for the same place, squared, added, and square-rooted.' },
      ],
    },
    javascript: {
      source: `// Slide the kernel over the image as written: one weighted sum per position.
function correlate(image, kernel) {
  const kh = kernel.length, kw = kernel[0].length;
  const out = [];
  for (let r = 0; r + kh <= image.length; r++) {
    const row = [];
    for (let c = 0; c + kw <= image[0].length; c++) {
      let total = 0;
      for (let a = 0; a < kh; a++) {
        for (let b = 0; b < kw; b++) total += kernel[a][b] * image[r + a][c + b];
      }
      row.push(total);
    }
    out.push(row);
  }
  return out;
}

function halfTurn(kernel) {
  return kernel.slice().reverse().map((row) => row.slice().reverse());
}

// Convolution in the strict sense: turn the kernel half a turn, then slide it.
function convolve(image, kernel) {
  return correlate(image, halfTurn(kernel));
}

function show(title, grid) {
  console.log(title);
  for (const row of grid) console.log(row.map((v) => v.toFixed(2)).join(" "));
}

const IMAGE = [
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 9, 9, 9],
  [1, 1, 1, 9, 9, 9],
  [1, 1, 1, 9, 9, 9],
];
const BLUR = [0, 1, 2].map(() => [1 / 9, 1 / 9, 1 / 9]);
const SOBEL_X = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
const SOBEL_Y = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

const gx = correlate(IMAGE, SOBEL_X);
const gy = correlate(IMAGE, SOBEL_Y);
const strength = gx.map((row, r) => row.map((x, c) => Math.sqrt(x * x + gy[r][c] * gy[r][c])));
show("blur", correlate(IMAGE, BLUR));
show("sobel x", gx);
show("sobel y", gy);
show("edge strength", strength);
show("sobel x, kernel turned half a turn (convolution)", convolve(IMAGE, SOBEL_X));
const changed = JSON.stringify(convolve(IMAGE, BLUR)) !== JSON.stringify(correlate(IMAGE, BLUR));
console.log("blur changed by the turn: " + (changed ? "yes" : "no"));`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <vector>

using Grid = std::vector<std::vector<double>>;

// Slide the kernel over the image as written: one weighted sum per position.
Grid correlate(const Grid& image, const Grid& kernel) {
    const size_t kh = kernel.size(), kw = kernel[0].size();
    Grid out;
    for (size_t r = 0; r + kh <= image.size(); ++r) {
        std::vector<double> row;
        for (size_t c = 0; c + kw <= image[0].size(); ++c) {
            double total = 0.0;
            for (size_t a = 0; a < kh; ++a) {
                for (size_t b = 0; b < kw; ++b) {
                    const double product = kernel[a][b] * image[r + a][c + b];
                    total += product;
                }
            }
            row.push_back(total);
        }
        out.push_back(row);
    }
    return out;
}

Grid half_turn(const Grid& kernel) {
    Grid turned(kernel.rbegin(), kernel.rend());
    for (auto& row : turned) row = std::vector<double>(row.rbegin(), row.rend());
    return turned;
}

// Convolution in the strict sense: turn the kernel half a turn, then slide it.
Grid convolve(const Grid& image, const Grid& kernel) {
    return correlate(image, half_turn(kernel));
}

void show(const char* title, const Grid& grid) {
    std::printf("%s\\n", title);
    for (const auto& row : grid) {
        for (size_t c = 0; c < row.size(); ++c) std::printf("%s%.2f", c ? " " : "", row[c]);
        std::printf("\\n");
    }
}

int main() {
    const Grid image = {
        {1, 1, 1, 1, 1, 1},
        {1, 1, 1, 1, 1, 1},
        {1, 1, 1, 9, 9, 9},
        {1, 1, 1, 9, 9, 9},
        {1, 1, 1, 9, 9, 9},
    };
    const Grid blur(3, std::vector<double>(3, 1.0 / 9));
    const Grid sobel_x = {{-1, 0, 1}, {-2, 0, 2}, {-1, 0, 1}};
    const Grid sobel_y = {{-1, -2, -1}, {0, 0, 0}, {1, 2, 1}};

    const Grid gx = correlate(image, sobel_x), gy = correlate(image, sobel_y);
    Grid strength = gx;
    for (size_t r = 0; r < gx.size(); ++r) {
        for (size_t c = 0; c < gx[r].size(); ++c) strength[r][c] = std::sqrt(gx[r][c] * gx[r][c] + gy[r][c] * gy[r][c]);
    }
    show("blur", correlate(image, blur));
    show("sobel x", gx);
    show("sobel y", gy);
    show("edge strength", strength);
    show("sobel x, kernel turned half a turn (convolution)", convolve(image, sobel_x));
    const bool changed = convolve(image, blur) != correlate(image, blur);
    std::printf("blur changed by the turn: %s\\n", changed ? "yes" : "no");
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The kernel stands once at every position where it fits and does one multiplication per weight. For an image of R by C pixels and a kernel of h by w weights that is (R − h + 1) × (C − w + 1) × h × w multiplications: about the number of pixels times the number of weights. There is no best or worst case. The work does not depend on what the image shows.',
    cases: [
      { case: 'Any image, 3 by 3 kernel', time: 'O(N)', when: 'Nine multiplications per position, whatever the pixels are. N is the number of pixels.' },
      { case: 'Any image, kernel of K weights', time: 'O(N · K)', when: 'Always. A 5 by 5 kernel costs nearly three times as much per position as a 3 by 3 one.' },
      { case: 'Separable kernel', time: 'O(N · (h + w))', when: 'The kernel can be written as a column of h weights times a row of w weights, as the blur and Sobel kernels can. Slide the row, then slide the column over the result.' },
      { case: 'Very large kernel', time: 'O(N log N)', when: 'The sliding sum is computed by multiplying Fourier transforms instead, which costs the same whatever the size of the kernel.' },
    ],
    space: 'O(N) for the output, which must be a separate grid from the image. Nothing else is stored apart from the kernel.',
    memory: 'The loop reads the image a few neighbouring rows at a time, which suits the way memory is laid out. Because every output cell is computed independently, the work splits cleanly across processor cores and is a natural fit for graphics processors.',
    tradeoffs: 'A larger kernel sees more of the image at each position, so it can blur more or respond to wider patterns, and it costs more per pixel and loses a wider border. Splitting a separable kernel into a row pass and a column pass saves multiplications at the price of one temporary image. The Fourier route only pays off for kernels far larger than three by three.',
    assumptions: [
      'One multiplication and one addition take constant time.',
      'The kernel only stands where it fits (no padding) and moves one pixel at a time. With padding the count is N × K exactly.',
      'The image has one number per pixel. A colour image is three such grids and costs three times as much.',
      'The chart counts multiplications by kernel weights in the implementation on this page. It says nothing about running time on real hardware, where memory access and parallel execution matter as much.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Noise. A Sobel kernel reports every sudden change, and a speckle of noise is a sudden change. Edge maps of noisy photos are full of false edges unless the image is blurred first.',
      'Deciding what counts as an edge. The output is a strength at every pixel, and a threshold has to be chosen to turn it into a yes or no. No single threshold suits every image.',
      'Thick edges. A sharp boundary gives a band of large values two or three pixels wide, not a thin line.',
      'Anything that needs more than a small neighbourhood. A three by three kernel cannot tell a long straight line from a short scratch.',
      'Soft edges. A change spread over many pixels gives a small difference under a small kernel and may be missed.',
    ],
    pitfalls: [
      'Zero padding puts a false edge around the whole image.',
      'Showing a Sobel output as a picture without handling the negative values hides half of the edges.',
      'Comparing edge strengths between kernels of different sizes or scalings as if the numbers meant the same thing.',
    ],
    misunderstandings: [
      "\"Convolution and cross-correlation are two names for one thing.\" They differ by a half turn of the kernel. They give the same output only when the kernel looks the same after that turn. With any other kernel the outputs differ, sometimes just in sign, as with the Sobel kernels, and sometimes completely.",
      "\"A convolutional neural network performs convolution.\" The operation in most neural network libraries is cross-correlation. It makes no difference to what a network can learn, because the weights are learned, and a network would simply learn the turned kernel. It matters only when you copy kernels from one program to another.",
      "\"The Sobel kernel finds the edges.\" It gives a number at every pixel that says how fast the brightness is changing there. Turning those numbers into clean, thin outlines takes further steps, such as blurring first, thinning the bands and choosing thresholds.",
      "\"A bigger output number means a brighter spot.\" For an edge kernel it means a bigger change in brightness. A flat white area and a flat black area both give 0.",
    ],
    constraints: [
      'Real images are large: a 12 megapixel photo has 12 million positions, so practical implementations run in parallel or on a graphics processor.',
      'Pixel values are often stored as whole numbers from 0 to 255, and outputs must be kept in a wider type before being rescaled.',
      'Colour images need a decision: filter each colour separately, or convert to brightness first.',
    ],
    alternatives: [
      { name: 'Canny edge detector', when: 'You want thin, connected edge lines instead of a strength at every pixel. It starts from the same gradient and adds blurring, thinning and two thresholds.' },
      { name: 'Median filter', when: 'You want to remove speckles without blurring edges. It replaces each pixel by the middle value of its neighbourhood, which is not a weighted sum.' },
      { name: 'Gaussian blur', when: 'You want a smoother blur than nine equal weights give. Its weights fall off with distance from the middle.' },
      { id: 'fft', name: 'Filtering in the frequency domain', when: 'The kernel is very large. Multiplying Fourier transforms costs the same whatever the kernel size.' },
      { name: 'Learned kernels (a convolutional neural network)', when: 'You do not know which patterns matter and you have labelled examples to learn them from.' },
    ],
    comparison: {
      columns: ['', 'Sobel edge strength', 'Canny edge detector', 'Learned kernels'],
      rows: [
        ['Output', 'A strength at every pixel', 'Thin lines: edge or not', 'Whatever the network was trained to give'],
        ['Weights come from', 'A fixed design', 'A fixed design', 'Training on examples'],
        ['Settings to choose', 'None, until you threshold', 'Amount of blur and two thresholds', 'A whole network and its training'],
        ['Handles noise', 'Poorly', 'Better, because it blurs first', 'As well as its training data allowed'],
      ],
    },
  },

  applications: [
    { title: 'Photo editing', status: 'established', text: 'Blur, sharpen and emboss tools in image editors are kernels slid over the picture. Some editors, GIMP among them, also let the user type the weights of a kernel directly.' },
    { title: 'Edge detection as a first step in computer vision', status: 'established', text: 'Classical vision pipelines begin by estimating how brightness changes at every pixel. The Canny edge detector, still a standard tool, computes this gradient with derivative kernels such as Sobel after a blur, and then thins and thresholds the result.' },
    { title: 'Convolutional neural networks', status: 'established', text: 'Networks for recognizing images are built from layers that slide many small kernels over their input, with weights set by training. LeCun and colleagues used such networks to read handwritten digits in the 1990s, and the 2012 ImageNet result of Krizhevsky, Sutskever and Hinton made them the standard approach to image recognition for years afterwards.' },
    { title: 'Filtering sound and other signals', status: 'established', text: 'The same sliding weighted sum along a line of samples, instead of across a grid, is how digital filters smooth a signal, remove hum or add an echo.' },
    { title: 'Checking parts on a production line', status: 'illustrative', text: 'A camera looks down on parts passing on a belt. An edge map of each frame gives the outline of the part, which can be measured and compared with the outline it should have.' },
  ],

  connections: [
    { to: 'concept:matrix', type: 'prerequisite', why: 'An image and a kernel are both grids of numbers, and convolution combines them by multiplying matching entries and adding, the same operation that builds a matrix product one entry at a time.' },
    { to: 'concept:derivative', type: 'related', why: 'A Sobel kernel estimates the derivative of brightness by subtracting the pixels on one side from the pixels on the other. Convolution turns the idea of a slope into something that can be computed on a grid.' },
    { to: 'fft', type: 'related', why: 'Convolution in the image corresponds to multiplication of Fourier transforms, so for very large kernels the fast Fourier transform computes the same sliding sums at a cost that does not grow with the kernel.' },
    { to: 'perceptron', type: 'related', why: 'A perceptron computes a weighted sum of its inputs. One step of convolution is the same weighted sum taken over a small patch, and the whole operation applies that one set of weights at every position of the image.' },
    { to: 'backpropagation', type: 'related', why: 'Convolution with hand-written weights finds edges. Backpropagation lets a convolutional network choose its own kernel weights, by computing how the error changes with every one of them.' },
    { to: 'k-means', type: 'related', why: 'k-means clustering of pixel colours splits an image into regions, and edge detection by convolution finds the boundaries between regions. They approach the same task, dividing up a picture, from opposite sides.' },
    { to: 'bresenham-line', type: 'related', why: 'Bresenham\'s algorithm decides which pixels to switch on to draw a line, and convolution with an edge kernel finds where lines and boundaries are in pixels that are already there. One writes the pixel grid and the other reads it.' },
    { to: 'graph-neural-network', type: 'advanced', why: 'Convolution combines each pixel with its neighbours on a regular grid. A graph neural network does the same for data in which each item has its own set of neighbours, so it must combine them in a way that needs no fixed order.' },
    { to: 'discipline:deep-learning', type: 'application', why: 'Convolutional layers are convolution with learned weights, stacked so that later layers respond to arrangements of the patterns found by earlier ones.' },
    { to: 'discipline:computer-graphics', type: 'application', why: 'Graphics uses the same sliding kernels to soften, sharpen and resize images.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'A 9 by 9 image is filtered with a 3 by 3 kernel that only stands where it fits entirely inside the image. How large is the output?',
      options: ['9 by 9', '7 by 7', '8 by 8', '3 by 3'],
      answer: 1,
      explain: [
        'That would need the kernel to hang over the border, which needs padding.',
        'The kernel can stand in 9 − 3 + 1 = 7 places from left to right and 7 from top to bottom.',
        'Each side loses one row or column, so two are lost in each direction, not one.',
        '3 by 3 is the size of the kernel. The output has one number for every position of the kernel.',
      ],
    },
    {
      type: 'predict',
      q: 'In the ramp image every column is 1 brighter than the column to its left: 0, 1, 2 and so on. What does the horizontal Sobel kernel give?',
      options: ['0 everywhere, because a ramp has no edge', '1 everywhere, the difference between neighbouring columns', '8 everywhere', 'Numbers that grow from left to right, like the image'],
      answer: 2,
      explain: [
        'The kernel gives 0 only where its left and right columns hold the same numbers. On a ramp they never do.',
        'The kernel compares columns two steps apart and adds three rows with weights 1, 2 and 1, so the result is larger than the plain difference.',
        'The right column is 2 brighter than the left one, and the weights on each side add up to 4: 4 × 2 = 8. The slope is the same everywhere, so the output is too.',
        'The output measures how fast the image changes, not how bright it is. A steady slope gives a steady number.',
      ],
      tryInput: { ...BASE, image: 'ramp', kernel: 'sobel-x' },
    },
    {
      type: 'debug',
      q: 'This blur is meant to replace every inner pixel by the average of its 3 by 3 neighbourhood. The result is smeared towards the bottom right and does not match a reference. What is wrong?',
      code: `for r in range(1, rows - 1):
    for c in range(1, cols - 1):
        total = 0
        for a in range(3):
            for b in range(3):
                total += image[r + a - 1][c + b - 1] / 9
        image[r][c] = total`,
      options: ['The division by 9 should happen after the loops', 'The result is written back into the image, so later sums read pixels that have already been blurred', 'The loops should start at 0', 'A blur needs negative weights'],
      answer: 1,
      explain: [
        'Dividing each term or dividing the total gives the same answer apart from rounding.',
        'Each output must be computed from the original image. Write the sums into a separate output grid.',
        'Starting at 0 would make the kernel read outside the image.',
        'A blur uses positive weights that add up to 1. Negative weights belong to sharpening and edge kernels.',
      ],
    },
    {
      type: 'choice',
      q: 'For which of these kernels do cross-correlation and strict convolution give exactly the same output on every image?',
      options: ['Any kernel whose weights add up to 0', 'A kernel that looks the same after being turned half a turn', 'Any 3 by 3 kernel', 'The Sobel kernels'],
      answer: 1,
      explain: [
        'The Sobel kernels add up to 0, and turning them changes the sign of the output.',
        'Convolution is cross-correlation with the turned kernel. If turning leaves the kernel unchanged, the two are the same calculation.',
        'A kernel with a single 1 on its right side shifts the image one way under cross-correlation and the other way under convolution.',
        'Half a turn swaps the sign of every Sobel weight, so the two outputs have opposite signs. Only the edge strength, which squares them, agrees.',
      ],
    },
    {
      type: 'challenge',
      title: 'Keep the border',
      prompt: 'Change `correlate` so that the output has the same size as the image. Try two kinds of padding: imagine zeros outside the image, or imagine that each border pixel is repeated outwards. Run the horizontal Sobel kernel on a flat image of 5s with each. One of them reports strong edges along the left and right borders, and the other reports none. Explain why, then decide which padding you would use before a blur and which before an edge detector.',
      hints: ['You do not need to build a bigger image. Write a function that returns the pixel at (r, c), and decide inside it what to return when r or c is out of range.', 'With zeros outside, the kernel at the left border sees 0 on one side and 5 on the other, which looks like an edge.'],
    },
  ],

  compare: {
    idea: 'Slide a small grid of weights over the image and write one weighted sum per position.',
    requires: 'A picture stored as a grid of numbers, and a small grid of weights chosen for the job. You must also decide what happens at the border, where the small grid does not fit.',
    sensitivity: 'The result depends entirely on the weights. Edge kernels are sensitive to noise, because noise is also a sudden change.',
    memory: 'O(N): one output grid besides the image.',
    difficulty: 'low',
    difficultyNote: 'Four nested loops. The care goes into borders, into whether the kernel is turned, and into what the output numbers mean.',
    limits: 'It only looks at a few neighbouring pixels at a time, so it cannot judge anything that needs a wider view. An edge map is a number at every pixel, and it still takes more work to get clean outlines. Speckled or grainy pictures give many false edges.',
    useWhen: 'You want to blur or sharpen a picture, or to mark the places where its brightness changes suddenly.',
  },

  advanced: {
    history: 'Convolution as a mathematical operation is far older than digital images and was studied in analysis and probability long before computers. Its use on pictures grew with digital image processing in the 1960s. The Sobel operator is credited to Irwin Sobel and Gary Feldman, who presented it in a 1968 talk at the Stanford Artificial Intelligence Project. It was not published as a paper at the time and became widely known through the 1973 textbook of Richard Duda and Peter Hart, which describes it and credits Sobel. David Marr and Ellen Hildreth gave an influential account of edge detection in 1980, and John Canny\'s 1986 paper set out criteria for a good edge detector and derived the method that carries his name. Kernels with learned weights go back to Kunihiko Fukushima\'s neocognitron of 1980 and to the networks that Yann LeCun and colleagues trained by backpropagation from 1989 onwards.',
    derivation: 'Write the image as $I$ and a kernel of $h \\times w$ weights as $K$, both indexed from 0. **Cross-correlation**, the function `slide`, is\n\n$$(I \\star K)[r, c] = \\sum_{a=0}^{h-1} \\sum_{b=0}^{w-1} K[a, b]\\; I[r + a,\\, c + b].$$\n\n**Convolution** pairs the same weights with the pixels in the opposite order:\n\n$$(I * K)[r, c] = \\sum_{a=0}^{h-1} \\sum_{b=0}^{w-1} K[a, b]\\; I[r + h - 1 - a,\\, c + w - 1 - b].$$\n\nSubstituting $a\' = h - 1 - a$ and $b\' = w - 1 - b$ shows that $I * K = I \\star \\tilde K$, where $\\tilde K[a, b] = K[h - 1 - a,\\, w - 1 - b]$ is the kernel turned half a turn. So if $\\tilde K = K$ the two operations agree on every image, and if $\\tilde K = -K$, as for the Sobel kernels, they differ exactly in sign.\n\nMathematics prefers the turned form because it behaves like multiplication. Convolution is commutative and associative, so filtering with one kernel and then another equals filtering once with the convolution of the two kernels. Cross-correlation has neither property. Convolving an image that is a single 1 reproduces the kernel, and cross-correlating it reproduces the turned kernel, which is the quickest test of what a library does.\n\n**Why the Sobel kernel measures a slope.** It is the product of a column and a row,\n\n$$\\begin{pmatrix} -1 & 0 & 1 \\\\ -2 & 0 & 2 \\\\ -1 & 0 & 1 \\end{pmatrix} = \\begin{pmatrix} 1 \\\\ 2 \\\\ 1 \\end{pmatrix} \\begin{pmatrix} -1 & 0 & 1 \\end{pmatrix}.$$\n\nThe row $(-1, 0, 1)$ is a central difference: it subtracts the pixel on the left from the pixel on the right, which estimates twice the slope. The column $(1, 2, 1)$ averages that estimate over three rows, weighting the middle one double, and multiplies by 4. On an image whose brightness rises by $s$ per pixel from left to right, the output is $8s$ everywhere. With $G_x$ and $G_y$ the two outputs, the edge strength is the length of the gradient estimate, $\\sqrt{G_x^2 + G_y^2}$, and its direction is $\\operatorname{atan2}(G_y, G_x)$.',
    complexityProof: 'The kernel fits at $R - h + 1$ row positions and $C - w + 1$ column positions. At each one the inner loops run $h \\cdot w$ times, with one multiplication and one addition each. The total is $(R - h + 1)(C - w + 1)\\,h\\,w$ multiplications, which for a square image of side $n$ and a 3 by 3 kernel is $9(n - 2)^2$. This is the count plotted in the experiment. A separable kernel $K = u\\,v^\\top$ can be applied as a row pass with $v$ followed by a column pass with $u$, because $I \\star (u v^\\top) = (I \\star v^\\top) \\star u$, for about $N (h + w)$ multiplications in place of $N h w$.',
    variants: [
      { name: 'Padding', text: 'Surround the image with zeros, with copies of the border pixels or with a mirror image, so that the output is as large as the input.' },
      { name: 'Stride', text: 'Move the kernel more than one pixel at a time to get a smaller output.' },
      { name: 'Gaussian blur', text: 'A blur whose weights follow a bell curve. It is separable and smoother than equal weights.' },
      { name: 'Prewitt and Scharr kernels', text: 'Other three by three derivative kernels. They differ from Sobel in the weights of the smoothing column.' },
      { name: 'Laplacian', text: 'A kernel that estimates the second derivative, responding to edges in every direction with a single pass. The sharpen kernel on this page is the image minus a Laplacian.' },
      { name: 'Convolutional layer', text: 'Many kernels with learned weights, applied across several input channels at once and followed by a simple function applied to each output number.' },
    ],
    implementation: 'Write results to a separate output grid. Keep sums in a signed type that is wide enough: Sobel on 8-bit pixels ranges from −1020 to 1020. Where a kernel is separable, do two passes with short kernels. For display, take absolute values or add an offset before scaling into the visible range. To find out whether a library turns the kernel, filter an image that is zero except for a single 1 with a kernel that is not symmetric, and see which way round the kernel comes out.',
    benchmarking: 'Time per megapixel for a stated kernel size, border rule and pixel type is the usual figure. Report whether the implementation is separable, how many processor cores or which graphics processor it used, and check the output against a plain four-loop reference before timing anything.',
    references: [
      { authors: 'R. O. Duda and P. E. Hart', year: 1973, title: 'Pattern Classification and Scene Analysis', venue: 'Wiley' },
      { authors: 'D. Marr and E. Hildreth', year: 1980, title: 'Theory of edge detection', venue: 'Proceedings of the Royal Society of London B 207, 187-217' },
      { authors: 'J. Canny', year: 1986, title: 'A computational approach to edge detection', venue: 'IEEE Transactions on Pattern Analysis and Machine Intelligence 8(6), 679-698' },
      { authors: 'Y. LeCun, L. Bottou, Y. Bengio and P. Haffner', year: 1998, title: 'Gradient-based learning applied to document recognition', venue: 'Proceedings of the IEEE 86(11), 2278-2324' },
      { authors: 'R. C. Gonzalez and R. E. Woods', year: 2018, title: 'Digital Image Processing, 4th edition', venue: 'Pearson' },
      { authors: 'I. Goodfellow, Y. Bengio and A. Courville', year: 2016, title: 'Deep Learning', venue: 'MIT Press' },
    ],
    furtherReading: [
      'I. Goodfellow, Y. Bengio and A. Courville, *Deep Learning*, chapter 9, "Convolutional Networks", which states plainly that many libraries implement cross-correlation under the name convolution.',
      'R. Szeliski, *Computer Vision: Algorithms and Applications*, the chapter on image processing.',
    ],
  },

  tests: [
    { name: 'every kernel matches an independent shift-and-add computation on a random image', input: { ...BASE, image: 'noise', seed: 11, kernel: 'blur' },
      check: (r) => {
        for (const id of Object.keys(KERNELS)) {
          const got = run({ ...BASE, image: 'noise', seed: 11, kernel: id }, QUIET);
          const ok = gridsMatch(got.output, shiftAndAdd(got.image, KERNELS[id]));
          if (ok !== true) return `${id}: ${ok}`;
        }
        return (r.outRows === 7 && r.outCols === 7 && gridsMatch(r.output, shiftAndAdd(r.image, KERNELS.blur)) === true) || 'the blur output or its size is wrong';
      } },
    { name: 'with the kernel turned, the output matches convolution computed straight from its definition', input: { ...BASE, image: 'noise', seed: 23, kernel: 'shift', flip: true },
      check: (r) => {
        for (const id of Object.keys(KERNELS)) {
          const got = run({ ...BASE, image: 'noise', seed: 23, kernel: id, flip: true }, QUIET);
          const ok = gridsMatch(got.output, byDefinition(got.image, KERNELS[id]));
          if (ok !== true) return `${id}: ${ok}`;
        }
        const plain = shiftAndAdd(r.image, KERNELS.shift);
        return (r.operation === 'convolution' && gridsMatch(r.output, plain) !== true) || 'for a kernel that is not symmetric the turn should change the output';
      } },
    { name: 'a blur whose weights add up to 1 leaves a flat image unchanged', input: { ...BASE, image: 'flat', kernel: 'blur' },
      check: (r) => {
        const wsum = r.used.flat().reduce((a, b) => a + b, 0);
        return (Math.abs(wsum - 1) < 1e-12 && r.output.flat().length === 49 && r.output.flat().every((v) => Math.abs(v - 5) < 1e-12)) || `weights add up to ${wsum}, outputs ${r.output[0].join(', ')}`;
      } },
    { name: 'the edge kernels give exactly zero on a flat image, and so does the edge strength', input: { ...BASE, image: 'flat', kernel: 'edges' },
      check: (r) => (r.gx.flat().every((v) => v === 0) && r.gy.flat().every((v) => v === 0) && r.strength.flat().every((v) => v === 0)
        && run({ ...BASE, pixels: '7777 7777 7777 7777', kernel: 'sobel-y' }, QUIET).output.flat().every((v) => v === 0)) || 'an edge kernel gave a value other than 0 on a flat image' },
    { name: 'edge strength is the root of the summed squares of two independently computed Sobel outputs', input: { ...BASE, image: 'noise', seed: 5, kernel: 'edges' },
      check: (r) => {
        const gx = shiftAndAdd(r.image, KERNELS['sobel-x']), gy = shiftAndAdd(r.image, KERNELS['sobel-y']);
        const want = gx.map((row, i) => row.map((x, j) => Math.hypot(x, gy[i][j])));
        const ok = [gridsMatch(r.gx, gx), gridsMatch(r.gy, gy), gridsMatch(r.strength, want)].find((x) => x !== true);
        return ok === undefined || ok;
      } },
    { name: 'turning a symmetric kernel changes nothing; turning a Sobel kernel flips every sign and leaves the strength alone', input: { ...BASE, image: 'noise', seed: 8, kernel: 'edges', flip: true },
      check: (r) => {
        const img = { ...BASE, image: 'noise', seed: 8 };
        for (const id of ['blur', 'sharpen']) {
          const a = run({ ...img, kernel: id }, QUIET).output, b = run({ ...img, kernel: id, flip: true }, QUIET).output;
          if (JSON.stringify(a) !== JSON.stringify(b)) return `${id} changed when its kernel was turned`;
        }
        const plain = run({ ...img, kernel: 'edges' }, QUIET);
        const neg = (g) => g.map((row) => row.map((v) => -v));
        const ok = [gridsMatch(r.gx, neg(plain.gx)), gridsMatch(r.gy, neg(plain.gy)), gridsMatch(r.strength, plain.strength)].find((x) => x !== true);
        return (ok === undefined && plain.gx.flat().some((v) => v !== 0)) || ok || 'the random image gave no edges at all';
      } },
    { name: 'the worked example: a strip 1 1 1 9 9 9 gives 0, 32, 32, 0', input: { ...BASE, pixels: '111999 111999 111999', kernel: 'sobel-x' },
      check: (r, c) => (r.outRows === 1 && r.output[0].join(',') === '0,32,32,0' && c['kernel multiplications'] === 36) || `output ${JSON.stringify(r.output)}, ${c['kernel multiplications']} multiplications` },
    { name: 'the default run: a square gives ±32 on its sides, 0 in its middle and on the flat border', input: { ...BASE },
      check: (r, c) => {
        const row = r.gx[3].join(','), ok = row === '0,32,32,0,-32,-32,0';
        const transposed = r.gy.every((line, i) => line.every((v, j) => v === r.gx[j][i]));
        const zeros = r.strength.flat().filter((v) => v === 0).length;
        return (ok && transposed && r.strength[3][3] === 0 && r.strength[0][0] === 0 && zeros === 25 && Math.abs(r.strength[2][2] - Math.sqrt(2 * 24 * 24)) < 1e-12 && c['kernel multiplications'] === 2 * 49 * 9 && c['edge strengths'] === 49)
          || `middle row of gx ${row}, ${zeros} zeros, ${c['kernel multiplications']} multiplications`;
      } },
    { name: 'the predicted answer: the horizontal Sobel kernel gives 8 everywhere on a ramp, and blur and sharpen leave it unchanged', input: { ...BASE, image: 'ramp', kernel: 'sobel-x' },
      check: (r) => {
        if (!r.output.flat().every((v) => v === 8)) return `Sobel on a ramp gave ${r.output[0].join(', ')}`;
        const inner = r.image.slice(1, -1).map((row) => row.slice(1, -1));
        const sharp = run({ ...BASE, image: 'ramp', kernel: 'sharpen' }, QUIET).output, blur = run({ ...BASE, image: 'ramp', kernel: 'blur' }, QUIET).output;
        return (gridsMatch(sharp, inner, 0) === true && gridsMatch(blur, inner, 1e-12) === true) || 'blur or sharpen changed the inside of a ramp';
      } },
    { name: 'a single 1 on the right moves a dot one cell left, and one cell right once the kernel is turned', input: { ...BASE, image: 'dot', kernel: 'shift' },
      check: (r) => {
        const find = (g) => { const hits = []; g.forEach((row, i) => row.forEach((v, j) => { if (v !== 0) hits.push(`${i},${j},${v}`); })); return hits.join(' '); };
        const flipped = run({ ...BASE, image: 'dot', kernel: 'shift', flip: true }, QUIET);
        // The dot is at image (4, 4). Output cell (i, j) sits under image pixel (i + 1, j + 1).
        return (find(r.output) === '3,2,9' && find(flipped.output) === '3,4,9') || `as written: ${find(r.output)}; turned: ${find(flipped.output)}`;
      } },
    { name: 'the numbers quoted in Try this: blurring a dot, and sharpening a step', input: { ...BASE, image: 'dot', kernel: 'blur' },
      check: (r) => {
        const ones = r.output.flat().filter((v) => Math.abs(v - 1) < 1e-12).length, total = r.output.flat().reduce((a, b) => a + b, 0);
        const sharp = run({ ...BASE, image: 'step', kernel: 'sharpen' }, QUIET).output;
        return (ones === 9 && Math.abs(total - 9) < 1e-12 && sharp.every((row) => row.join(',') === '2,2,-4,14,8,8,8')) || `${ones} ones, total ${total}, sharpened row ${sharp[0].join(',')}`;
      } },
    { name: 'the output of a sum of two images is the sum of their outputs', input: { ...BASE, image: 'noise', seed: 2, kernel: 'sharpen' },
      check: (r) => {
        const other = run({ ...BASE, image: 'noise', seed: 9, kernel: 'sharpen' }, QUIET);
        const both = run({ ...BASE, customImage: r.image.map((row, i) => row.map((v, j) => v + other.image[i][j])), kernel: 'sharpen' }, QUIET);
        return gridsMatch(both.output, r.output.map((row, i) => row.map((v, j) => v + other.output[i][j])), 1e-9);
      } },
    { name: 'a typed kernel and a typed image are used as given, and the count is positions times weights', input: { ...BASE, pixels: '12345 67890 13579 24680', custom: [1, 0, 0, 0, 0, 0, 0, 0, -1] },
      check: (r, c) => {
        const want = shiftAndAdd([[1, 2, 3, 4, 5], [6, 7, 8, 9, 0], [1, 3, 5, 7, 9], [2, 4, 6, 8, 0]], [[1, 0, 0], [0, 0, 0], [0, 0, -1]]);
        return (r.mode === 'custom' && r.outRows === 2 && r.outCols === 3 && gridsMatch(r.output, want, 0) === true && r.output[0].join(',') === '-4,-5,-6' && c['kernel multiplications'] === 54) || `output ${JSON.stringify(r.output)}`;
      } },
    { name: 'a 5 by 5 kernel on a larger image also matches the reference', input: { ...BASE, image: 'noise', side: 12, seed: 6, kernel: 'blur', customKernel: BOX5 },
      check: (r, c) => (r.outRows === 8 && gridsMatch(r.output, shiftAndAdd(r.image, BOX5)) === true && c['kernel multiplications'] === 25 * 64) || `${r.outRows} rows, ${c['kernel multiplications']} multiplications` },
  ],
};
