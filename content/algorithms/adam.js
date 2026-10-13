import { landscapeById, landscapeOptions, landscapeLayers, fromUnit } from '../../js/lib/landscapes.js';

const EPS = 1e-8;   // ε in the update rule. Fixed at the value suggested in the paper.
const TOL = 1e-3;   // a run stops when the gradient is shorter than this, as in the gradient descent lesson
const ROOT_HALF = Math.SQRT1_2;
const ASPECT = 0.5;  // height ÷ width of the map

// Two surfaces of this lesson's own, drawn with the shared landscape helpers. The ravine is 100 times
// more curved across (in y) than along (in x). The turned ravine is the same surface rotated by 45°.
const RAVINE = {
  id: 'ravine', label: 'Steep ravine (100 times more curved across than along)',
  f: (x, y) => 0.5 * x * x + 50 * y * y,
  grad: (x, y) => [x, 100 * y],
  x: [-4, 4], y: [-0.5, 0.5], minima: [[0, 0]], fmin: 0,
};
const TURNED = {
  id: 'ravine-turned', label: 'The same ravine turned 45°',
  f: (x, y) => { const u = (x + y) * ROOT_HALF, v = (x - y) * ROOT_HALF; return 0.5 * u * u + 50 * v * v; },
  grad: (x, y) => { const u = (x + y) * ROOT_HALF, v = (x - y) * ROOT_HALF; return [(u + 100 * v) * ROOT_HALF, (u - 100 * v) * ROOT_HALF]; },
  x: [-3, 3], y: [-3, 3], minima: [[0, 0]], fmin: 0,
};
const SURFACES = { ...landscapeById, [RAVINE.id]: RAVINE, [TURNED.id]: TURNED };
const SURFACE_OPTIONS = [{ value: RAVINE.id, label: RAVINE.label }, { value: TURNED.id, label: TURNED.label }, ...landscapeOptions];

// The experiment uses f = ½(u² + κv²), where (u, v) is (x, y) itself or (x, y) turned by 45°.
const quadratic = (kappa, turned) => (turned
  ? {
    id: 'quadratic', minima: [[0, 0]], start: [Math.SQRT2, 0],
    f: (x, y) => { const u = (x + y) * ROOT_HALF, v = (x - y) * ROOT_HALF; return 0.5 * (u * u + kappa * v * v); },
    grad: (x, y) => { const u = (x + y) * ROOT_HALF, v = (x - y) * ROOT_HALF; return [(u + kappa * v) * ROOT_HALF, (u - kappa * v) * ROOT_HALF]; },
  }
  : { id: 'quadratic', minima: [[0, 0]], start: [1, 1], f: (x, y) => 0.5 * (x * x + kappa * y * y), grad: (x, y) => [x, kappa * y] });

const minus = (s) => s.replace(/-/g, '−');
// Four significant figures, without trailing zeros.
const sig = (v) => {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  return minus(a >= 1e5 || a < 1e-4 ? v.toExponential(2) : String(Number(v.toPrecision(4))));
};
const f4 = (v) => (Number.isFinite(v) ? minus(Math.abs(v) >= 1000 ? v.toExponential(2) : v.toFixed(4)) : String(v));
const signed = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(4);
const at = (x, y) => `(${f4(x)}, ${f4(y)})`;
const pct = (v) => `${Number((v * 100).toFixed(2))}%`;
const AXES = ['x', 'y'];
// A tracer that records nothing, for the extra runs some tests make.
const quiet = { count() {}, frame() {} };

function run(input, t) {
  const L = input.landscape === 'quadratic' ? quadratic(input.kappa, !!input.turned) : SURFACES[input.landscape];
  if (!L) throw new Error('Unknown loss surface.');
  const mode = input.show === 'adam' || input.show === 'gd' ? input.show : 'both';
  const useAdam = mode !== 'gd', useGd = mode !== 'adam';
  const alpha = input.rate, b1 = input.beta1, b2 = input.beta2, correct = input.correct !== false;
  const eta = input.gdRate, maxSteps = input.steps;
  if (!(b1 >= 0 && b1 < 1) || !(b2 >= 0 && b2 < 1)) throw new Error('β₁ and β₂ must be at least 0 and below 1.');
  // The experiment stops at a set distance from the known minimum instead of at a small gradient.
  const stopDistance = input.stopDistance;
  const [x0, y0] = L.start || fromUnit(L, input.startX, input.startY);
  const nearest = (x, y) => Math.min(...L.minima.map((p) => Math.hypot(x - p[0], y - p[1])));
  const lost = (x, y, loss) => !Number.isFinite(loss) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6;

  const A = { x: x0, y: y0, m: [0, 0], v: [0, 0], p1: 1, p2: 1, path: [[x0, y0]], losses: [L.f(x0, y0)], status: 'budget', steps: 0 };
  const G = { x: x0, y: y0, path: [[x0, y0]], losses: [L.f(x0, y0)], status: 'running', steps: 0 };
  const trace = [];
  let maxRatio = 0;
  // Explanations that are given in full the first time and briefly, or not at all, after that.
  const told = new Set();
  const first = (key) => { if (told.has(key)) return false; told.add(key); return true; };
  const base = L.id === 'quadratic' ? [] : landscapeLayers(L);
  const rule = correct ? 'm̂ ÷ (√v̂ + ε)' : 'm ÷ (√v + ε)';

  // row: the numbers of the current step, filled in as they are computed. phase: which columns are new.
  const views = ({ g = null, plan = null, row = null, phase = '' } = {}) => {
    const layers = base.slice();
    if (useGd) {
      layers.push({ type: 'line', points: G.path.slice(), role: 'ink', width: 1.6 });
      layers.push({ type: 'points', points: G.path.slice(0, -1), role: 'ink', r: 1.8, alpha: 0.7 });
    }
    const px = useAdam ? A.x : G.x, py = useAdam ? A.y : G.y;
    // Arrows are drawn the same length on screen whatever their direction, although the two axes have different scales.
    const arrow = (v, role) => {
      const onScreen = Math.hypot(v[0] / (L.x[1] - L.x[0]), ASPECT * v[1] / (L.y[1] - L.y[0])) || 1;
      const scale = 0.11 / onScreen;
      layers.push({ type: 'segments', segments: [[px, py, px + v[0] * scale, py + v[1] * scale]], role, width: 2, arrow: true });
    };
    if (useAdam) {
      layers.push({ type: 'line', points: A.path.slice(), role: 'terracotta', width: 2 });
      layers.push({ type: 'points', points: A.path.slice(0, -1), role: 'terracotta', r: 2.2, alpha: 0.75 });
    }
    if (g) arrow([-g[0], -g[1]], 'ochre');
    if (plan && (plan[0] || plan[1])) arrow(plan, 'brick');
    if (useGd) layers.push({ type: 'points', points: [[G.x, G.y]], role: 'ink', r: useAdam ? 4 : 5.5, ring: !useAdam });
    if (useAdam) layers.push({ type: 'points', points: [[A.x, A.y]], role: 'terracotta', r: 5.5, ring: true });
    const legend = [{ label: 'contours of equal loss', role: 'sage' }, { label: 'known minimum', role: 'forest' }];
    if (useAdam) legend.push({ label: 'Adam\'s path', role: 'terracotta' });
    if (useGd) legend.push({ label: 'plain gradient descent\'s path', role: 'ink' });
    legend.push({ label: 'downhill direction (−gradient)', role: 'ochre' });
    if (useAdam) legend.push({ label: 'direction of Adam\'s next step', role: 'brick' });

    const out = [{ kind: 'scene', title: 'Path over the loss surface', x: L.x, y: L.y, aspect: ASPECT, axes: { xLabel: 'x', yLabel: 'y' }, layers, legend }];

    if (useAdam) {
      const cell = (v) => (v === null || v === undefined ? '·' : sig(v));
      const r = row || {};
      const cells = [0, 1].map((i) => [
        cell(r.g && r.g[i]), cell(A.m[i]), cell(A.v[i]), cell(r.mh && r.mh[i]), cell(r.vh && r.vh[i]), r.d ? signed(r.d[i]) : '·',
      ]);
      const cols = { g: [0], mv: [1, 2], hat: [3, 4], step: [5] }[phase] || [];
      const roles = {};
      for (const c of cols) { roles[`0,${c}`] = 'current'; roles[`1,${c}`] = 'current'; }
      out.push({ kind: 'table', title: `Adam's memory, one row for each coordinate${row ? ` (step ${row.t})` : ''}`, corner: '',
        colLabels: ['slope now (g)', 'average slope (m)', 'average squared slope (v)', correct ? 'corrected m̂' : 'm as used', correct ? 'corrected v̂' : 'v as used', 'step taken'],
        rowLabels: ['x', 'y'], cells, roles });
    }

    const all = (useAdam ? A.losses : []).concat(useGd ? G.losses : []).filter(Number.isFinite);
    const top = Math.max(...all, 1e-9);
    const chart = [];
    const curve = (losses, role, width) => chart.push({ type: 'line', points: losses.map((v, i) => [i, Number.isFinite(v) ? Math.min(v, top * 2) : top * 2]), role, width });
    if (useGd) curve(G.losses, 'ink', 1.6);
    if (useAdam) curve(A.losses, 'terracotta', 2);
    const chartLegend = [];
    if (useAdam) chartLegend.push({ label: 'Adam', role: 'terracotta' });
    if (useGd) chartLegend.push({ label: 'plain gradient descent', role: 'ink' });
    out.push({ kind: 'scene', title: 'Loss at each step', x: [0, Math.max(10, maxSteps)], y: [0, top * 1.08], aspect: 0.2, axes: { xLabel: 'step' }, layers: chart, legend: chartLegend });
    return out;
  };

  // One step of plain gradient descent, from its own position. Returns a sentence for the note.
  const gdCounter = useAdam ? 'plain descent gradient evaluations' : 'gradient evaluations';
  const gdStep = () => {
    if (G.status !== 'running') return '';
    const gg = L.grad(G.x, G.y);
    t.count(gdCounter);
    if (stopDistance === undefined && Math.hypot(gg[0], gg[1]) < TOL) {
      G.status = 'converged';
      return ` Plain gradient descent has stopped at ${at(G.x, G.y)} after ${G.steps} steps: the slope there is shorter than the tolerance.`;
    }
    const from = at(G.x, G.y), before = G.losses[G.losses.length - 1];
    G.x -= eta * gg[0]; G.y -= eta * gg[1];
    const loss = L.f(G.x, G.y);
    G.steps++;
    G.path.push([G.x, G.y]); G.losses.push(loss);
    if (lost(G.x, G.y, loss)) {
      G.status = 'diverged';
      return ` Plain gradient descent has left any sensible range: its learning rate of ${sig(eta)} is too large for this surface, so it has **diverged** and is not moved again.`;
    }
    const lead = G.steps === 1 ? `Plain gradient descent, with its single learning rate of ${sig(eta)},` : 'Plain gradient descent';
    return ` ${lead} moves from ${from} to ${at(G.x, G.y)}, and its loss ${loss <= before ? 'falls' : 'rises'} from ${sig(before)} to ${sig(loss)}.${loss > before ? ' A rise means its step jumped across the low ground.' : ''}`;
  };

  t.frame(() => {
    const what = mode === 'gd'
      ? `Plain gradient descent starts at ${at(x0, y0)}, where the loss is ${sig(A.losses[0])}, and will use one learning rate, ${sig(eta)}, for both coordinates.`
      : `Start at ${at(x0, y0)}, where the loss is ${sig(A.losses[0])}. Adam keeps two numbers of memory for each coordinate: **m**, a running average of the slope, and **v**, a running average of the squared slope. Both begin at 0, as the table shows.${useGd ? ` Plain gradient descent starts from the same point and is drawn in ink. It has no memory and one learning rate, ${sig(eta)}, for both coordinates.` : ''}`;
    const stretch = L.id === RAVINE.id ? ' The map is stretched: it is 8 units wide and only 1 unit tall, so the valley is much narrower than it looks.' : '';
    return { line: 1, note: `${what} The contour lines join points of equal loss, and the goal is the lowest point.${stretch}`, views: views(), vars: { x: f4(x0), y: f4(y0), loss: sig(A.losses[0]) } };
  });

  let k = 0;
  if (useAdam) {
    for (; k < maxSteps; k++) {
      if (stopDistance !== undefined && nearest(A.x, A.y) < stopDistance) { A.status = 'converged'; break; }
      const step = k + 1;
      const g = L.grad(A.x, A.y);
      t.count('gradient evaluations');
      const norm = Math.hypot(g[0], g[1]);
      if (stopDistance === undefined && norm < TOL) {
        A.status = 'converged';
        break;
      }
      const row = { t: step, g: g.slice() };
      const flips = AXES.filter((_, i) => trace.length && g[i] * trace[trace.length - 1].g[i] < 0);
      t.frame(() => {
        let note = `Step ${step}. At ${at(A.x, A.y)} the slope is ${sig(g[0])} in x and ${sig(g[1])} in y.`;
        const big = Math.abs(g[0]) >= Math.abs(g[1]) ? 0 : 1, small = 1 - big;
        if (step === 1 && g[small] !== 0) {
          const ratio = Math.abs(g[big] / g[small]);
          note += ratio >= 1.5
            ? ` The surface is ${sig(ratio)} times steeper in ${AXES[big]} than in ${AXES[small]}. Plain gradient descent moves each coordinate in proportion to its slope, so it would move ${sig(ratio)} times farther in ${AXES[big]}. The ochre arrow shows that direction.`
            : ' The ochre arrow shows the downhill direction, which is the way plain gradient descent would go.';
        } else if (flips.length) {
          note += ` The ${flips.join(' and ')} slope has changed sign since the last step, so the last step went past the place where the surface is level in ${flips.join(' and ')}.`;
        }
        return { line: [3, 4], note, views: views({ g, row, phase: 'g' }), vars: { t: step, 'g_x': sig(g[0]), 'g_y': sig(g[1]), loss: sig(A.losses[A.losses.length - 1]) } };
      });

      const m0 = A.m.slice(), v0 = A.v.slice();
      for (let i = 0; i < 2; i++) {
        A.m[i] = b1 * A.m[i] + (1 - b1) * g[i];
        A.v[i] = b2 * A.v[i] + (1 - b2) * g[i] * g[i];
      }
      t.frame(() => {
        let note;
        if (step === 1) {
          note = `Blend the new slope into the two running averages. **m** keeps ${pct(b1)} of its old value and takes ${pct(1 - b1)} of the new slope: it goes from 0 to ${sig(A.m[0])} in x and ${sig(A.m[1])} in y. **v** keeps ${pct(b2)} of its old value and takes ${pct(1 - b2)} of the squared slope: ${sig(A.v[0])} in x and ${sig(A.v[1])} in y. Slopes of opposite sign cancel in m, so m will come to hold the direction the slopes agree on. Squares cannot cancel, so v will hold how large the slopes have been.`;
        } else {
          note = `Blend the new slope into the averages. m: ${sig(b1)} × old + ${sig(1 - b1)} × slope gives ${sig(m0[0])} → **${sig(A.m[0])}** in x and ${sig(m0[1])} → **${sig(A.m[1])}** in y. v: ${sig(b2)} × old + ${sig(1 - b2)} × slope² gives ${sig(v0[0])} → **${sig(A.v[0])}** in x and ${sig(v0[1])} → **${sig(A.v[1])}** in y.`;
          const against = AXES.filter((_, i) => g[i] * m0[i] < 0);
          if (against.length) {
            note += first('against')
              ? ` In ${against.join(' and ')} the new slope points the opposite way to m, so it cancels part of what m held. m shrinks toward 0 there, and will change sign if the slope stays reversed.`
              : ` In ${against.join(' and ')} the new slope opposes m, so part of m is cancelled.`;
          }
        }
        return { line: [5, 6], note, views: views({ g, row, phase: 'mv' }), vars: { t: step, 'm_x': sig(A.m[0]), 'm_y': sig(A.m[1]), 'v_x': sig(A.v[0]), 'v_y': sig(A.v[1]) } };
      });

      A.p1 *= b1; A.p2 *= b2;
      const c1 = 1 - A.p1, c2 = 1 - A.p2;
      const mh = correct ? A.m.map((q) => q / c1) : A.m.slice();
      const vh = correct ? A.v.map((q) => q / c2) : A.v.slice();
      row.mh = mh; row.vh = vh;
      const d = [0, 1].map((i) => -alpha * mh[i] / (Math.sqrt(vh[i]) + EPS));
      t.frame(() => {
        let note;
        if (!correct) {
          const factor = c1 / Math.sqrt(c2);
          note = `Bias correction is switched off, so m and v are used as they stand. Both began at 0, so after ${step === 1 ? 'one step' : `${step} steps`} m holds only ${sig(c1)} of a full average and v only ${sig(c2)}. The step divides m by the square root of v, and the square root of ${sig(c2)} is ${sig(Math.sqrt(c2))}, so the two shortfalls do not cancel: this step will be ${sig(factor)} times as long as the corrected step would be.`;
        } else if (step === 1) {
          note = `Correct the start-up bias. Both averages began at 0, so after one step m holds only ${pct(c1)} of the slope and v only ${pct(c2)} of its square. Divide by those fractions: **m̂** = m ÷ ${sig(c1)} = ${sig(mh[0])} in x and ${sig(mh[1])} in y, which is the slope itself, and **v̂** = v ÷ ${sig(c2)} = ${sig(vh[0])} and ${sig(vh[1])}, which is its square. Without this, the first steps would come out the wrong length.`;
        } else if (step <= 3) {
          note = `Correct the start-up bias. Because both averages began at 0, after ${step} steps m holds a fraction 1 − ${sig(b1)}^${step} = ${sig(c1)} of a full average, and v a fraction 1 − ${sig(b2)}^${step} = ${sig(c2)}. Dividing by those fractions gives m̂ = ${sig(mh[0])} in x and ${sig(mh[1])} in y, and v̂ = ${sig(vh[0])} and ${sig(vh[1])}.`;
        } else {
          note = `Bias correction for step ${step}: m ÷ (1 − ${sig(b1)}^${step}) = m ÷ ${sig(c1)} gives m̂ = ${sig(mh[0])} in x and ${sig(mh[1])} in y. v ÷ (1 − ${sig(b2)}^${step}) = v ÷ ${sig(c2)} gives v̂ = ${sig(vh[0])} and ${sig(vh[1])}.`;
          if (c1 > 0.99 && c2 < 0.9 && first('late')) note += ' The correction to m is now almost 1 and has stopped mattering. The correction to v is still large, because v takes in each new value far more slowly than m does.';
        }
        if (step <= 2) note += ' The brick arrow shows the direction the step is about to take.';
        return { line: [7, 8], note, views: views({ g, plan: d, row, phase: 'hat' }), vars: { t: step, [correct ? 'm̂_x' : 'm_x']: sig(mh[0]), [correct ? 'm̂_y' : 'm_y']: sig(mh[1]), [correct ? 'v̂_x' : 'v_x']: sig(vh[0]), [correct ? 'v̂_y' : 'v_y']: sig(vh[1]) } };
      });

      const before = A.losses[A.losses.length - 1];
      A.x += d[0]; A.y += d[1];
      A.steps = step;
      const loss = L.f(A.x, A.y);
      A.path.push([A.x, A.y]); A.losses.push(loss);
      row.d = d;
      for (let i = 0; i < 2; i++) maxRatio = Math.max(maxRatio, Math.abs(d[i]) / alpha);
      trace.push({ g: g.slice(), m: A.m.slice(), v: A.v.slice(), mh: mh.slice(), vh: vh.slice(), d: d.slice() });
      const other = useGd ? gdStep() : '';
      t.frame(() => {
        const part = (i) => `${AXES[i]}: −${sig(alpha)} × (${sig(mh[i])} ÷ ${sig(Math.sqrt(vh[i]))}) = ${signed(d[i])}`;
        let note = `Take the step. Each coordinate moves by −α × ${rule}. ${part(0)}. ${part(1)}. The new position is ${at(A.x, A.y)}.`;
        if (step === 1 && correct && g[0] !== 0 && g[1] !== 0) {
          note += ` Both coordinates moved by the learning rate, ${sig(alpha)}, however different their slopes. On the first step m̂ is the slope and √v̂ is the size of the slope, so their ratio keeps only the sign.`;
        } else {
          note += ` The loss ${loss <= before ? 'fell' : 'rose'} from ${sig(before)} to ${sig(loss)}.`;
          const uphill = AXES.filter((_, i) => d[i] * g[i] > 0);
          if (loss > before && uphill.length) {
            note += first('uphill')
              ? ` It rose because m still carries earlier slopes: the step kept going in ${uphill.join(' and ')} although the slope there has already turned around. m needs a few steps to reverse.`
              : ` It rose because m has not yet reversed in ${uphill.join(' and ')}, where the slope has turned around.`;
          } else if (loss > before) {
            note += ' It rose because the step was long enough to cross the low ground and land higher on the far side.';
          }
          const short = [0, 1].filter((i) => g[i] !== 0 && Math.abs(d[i]) < 0.5 * alpha && Math.abs(mh[i]) < Math.sqrt(vh[i]));
          for (const i of short) {
            if (loss <= before && first(`short${i}`)) {
              note += ` The ${AXES[i]} step is well under α. √v̂ there is still ${sig(Math.sqrt(vh[i]))}, because v remembers the larger slopes from earlier, while m̂, which forgets faster and lets opposite signs cancel, is down to ${sig(Math.abs(mh[i]))}.`;
              break;
            }
          }
        }
        return { line: 9, note: note + other, views: views({ row, phase: 'step' }), vars: { t: step, x: f4(A.x), y: f4(A.y), loss: sig(loss) } };
      });
      if (lost(A.x, A.y, loss)) { A.status = 'diverged'; k++; break; }
    }
  } else {
    for (; k < maxSteps; k++) {
      if (stopDistance !== undefined && nearest(G.x, G.y) < stopDistance) { G.status = 'converged'; break; }
      const g = L.grad(G.x, G.y);
      const norm = Math.hypot(g[0], g[1]);
      if (stopDistance === undefined && norm < TOL) { t.count(gdCounter); G.status = 'converged'; break; }
      t.frame(() => ({ line: 4, note: `Step ${k + 1}. At ${at(G.x, G.y)} the slope is ${sig(g[0])} in x and ${sig(g[1])} in y. It points uphill, so the arrow shows the opposite direction.`, views: views({ g }), vars: { step: k + 1, 'g_x': sig(g[0]), 'g_y': sig(g[1]) } }));
      const said = gdStep();
      t.frame(() => ({ line: null, note: `Plain gradient descent has no averages to keep. It moves each coordinate by its slope times the one learning rate.${said}`, views: views(), vars: { step: k + 1, x: f4(G.x), y: f4(G.y), loss: sig(G.losses[G.losses.length - 1]) } }));
      if (G.status !== 'running') { k++; break; }
    }
    if (G.status === 'running') G.status = 'budget';
  }

  const main = useAdam ? A : G;
  const mainLoss = main.losses[main.losses.length - 1];
  t.frame(() => {
    const here = L.grad(main.x, main.y);
    const norm = Math.hypot(here[0], here[1]);
    const name = useAdam ? 'Adam' : 'Plain gradient descent';
    let note;
    if (main.status === 'converged') note = `${name} stopped after ${main.steps} steps at ${at(main.x, main.y)}, with loss ${sig(mainLoss)}. The slope there has length ${sig(norm)}, below the tolerance of ${TOL}, so the surface is level. That makes it a stationary point. Whether it is the lowest point of all depends on the surface and the start.`;
    else if (main.status === 'diverged') note = `${name} has left any sensible range after ${main.steps} steps. The learning rate is too large for this surface.`;
    else note = `Used all ${maxSteps} steps. ${name} is at ${at(main.x, main.y)} with loss ${sig(mainLoss)}. The slope there still has length ${sig(norm)}, so it has not settled yet.`;
    if (mode === 'both') {
      const gl = G.losses[G.losses.length - 1];
      if (G.status === 'diverged') {
        note += ` Plain gradient descent diverged: its learning rate of ${sig(eta)} was too large for this surface.`;
      } else {
        note += ` Plain gradient descent, after ${G.steps} steps at learning rate ${sig(eta)}, is at ${at(G.x, G.y)} with loss ${sig(gl)}.`;
        const ravine = L.id === RAVINE.id;
        const floor = L.fmin === undefined ? 0 : L.fmin;
        if (Math.hypot(main.x - G.x, main.y - G.y) < 0.1 && Math.min(mainLoss, gl) > floor + 1) {
          note += ' Both are in the same dip, far above the lowest point of the surface. Adam changes how the walk downhill is paced. It does not change where downhill leads.';
        } else if (mainLoss < gl) {
          note += ' Adam is lower.';
          if (ravine) note += ' Plain descent had to keep its learning rate small enough for the steep y direction, and that same small rate was all it had for the gentle x direction. Adam gave each coordinate a step length of its own.';
        } else if (gl < mainLoss) {
          note += ' Plain gradient descent is lower.';
          if (L.id === 'bowl') note += ' A round bowl is equally steep in every direction, so there is nothing for separate step lengths to fix, and plain descent with a well chosen rate goes straight in.';
        }
        note += ' This is one surface, one start and one pair of learning rates. It is not a ranking of the two methods.';
      }
    }
    return { line: 10, note, views: views(), vars: { steps: main.steps, x: f4(main.x), y: f4(main.y), loss: sig(mainLoss) } };
  });

  return {
    x: main.x, y: main.y, bestValue: mainLoss, steps: main.steps, status: main.status, losses: main.losses, path: main.path,
    trace, maxRatio, distance: nearest(main.x, main.y), alpha, method: useAdam ? 'adam' : 'gd',
    gd: useGd ? { x: G.x, y: G.y, bestValue: G.losses[G.losses.length - 1], steps: G.steps, status: G.status, losses: G.losses, path: G.path, distance: nearest(G.x, G.y) } : null,
  };
}

const DEFAULTS = { landscape: 'ravine', show: 'both', rate: 0.1, beta1: 0.9, beta2: 0.999, correct: true, gdRate: 0.019, steps: 60, startX: -0.5, startY: 0.4 };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const pow = Math.pow;
// The largest value |m̂| ÷ √v̂ can take after t steps, from the Cauchy-Schwarz inequality (see advanced.proof).
function ratioBound(b1, b2, t) {
  const r = (b1 * b1) / b2;
  const series = r === 1 ? t : (1 - pow(r, t)) / (1 - r);
  return ((1 - b1) / Math.sqrt(1 - b2)) * (Math.sqrt(1 - pow(b2, t)) / (1 - pow(b1, t))) * Math.sqrt(series);
}

export default {
  meta: {
    id: 'adam',
    name: 'Adam Optimizer',
    aliases: ['Adam', 'adaptive moment estimation', 'Adam optimiser', 'ADAM'],
    kind: 'algorithm',
    discipline: 'optimization',
    alsoIn: [
      { id: 'deep-learning', why: 'Adam and its close relatives are among the most widely used rules for turning the gradients from backpropagation into weight updates.' },
    ],
    subfield: 'Gradient methods',
    family: 'Adaptive first-order methods',
    lab: 'optimization',
    year: 2014,
    authors: 'Diederik P. Kingma and Jimmy Ba',
    summary: 'Gradient descent with memory: it steps along a running average of recent gradients and gives every parameter its own step size.',
    difficulty: 'advanced',
    order: 540,
    paradigms: ['gradient-based', 'iterative-refinement'],
    randomized: false,
    approximate: true,
    time: { best: 'O(d) per step', average: 'Number of steps depends on the problem', worst: 'No guarantee without assumptions', class: 'iterative' },
    space: { worst: 'O(d)', class: 'linear' },
    tags: {
      problems: ['train a neural network without tuning a step size for every weight', 'make training work when some settings need big steps and others need small ones', 'speed up learning that crawls along a narrow valley', 'choose step sizes automatically', 'make a neural network learn', 'minimize a function'],
      techniques: ['momentum', 'adaptive learning rate', 'exponential moving average', 'bias correction'],
      applications: ['machine learning', 'natural language', 'image processing', 'scientific computing'],
    },
    prerequisites: ['gradient-descent', 'stochastic-gradient-descent', 'concept:gradient', 'concept:learning-rate'],
  },

  bigIdea: {
    simple: "Adam is a recipe for walking downhill when you can only feel the slope under your feet. Picture a hiker in fog, in a long, narrow valley. A plain walker takes big steps where the ground is steep and tiny steps where it is nearly flat. That goes badly here. The steep side walls throw the walker from side to side, while the gentle slope along the valley floor, the way that matters, earns only tiny steps. Adam adds two kinds of memory. First, it remembers which way the slope has pointed lately and steps in that averaged direction. Side-to-side slopes keep flipping, so they cancel. The slope along the valley keeps pointing the same way, so it adds up. Second, it keeps a separate memory for north-south and for east-west of how big the slopes have usually been, and divides by it. A direction with huge slopes gets its steps shrunk. A direction with tiny slopes gets its steps stretched. Computers use this recipe to train neural networks, which have millions of adjustable numbers instead of two directions.",
    when: 'Reach for it when training a neural network and you want something that works reasonably well before any tuning, or when different parameters see gradients of very different sizes. Prefer [gradient descent](#/algorithm/gradient-descent) with a tuned rate, or a second-order method such as [Newton\'s method](#/algorithm/newtons-method), on small smooth problems where exact gradients are cheap. Stochastic gradient descent with momentum remains a strong choice when there is time to tune it, and on some problems it has been reported to give models that do better on new data. Which optimizer wins depends on the problem and on how carefully each one is tuned.',
    interesting: 'On the very first step, every parameter moves by almost exactly the learning rate, whether its slope is a thousand or a thousandth. Dividing the corrected average slope by the square root of the corrected average squared slope leaves nothing of the first gradient but its sign. After that, each parameter\'s step is the learning rate times the ratio of its average slope to its typical slope size. The ratio stays near 1 while the slopes keep agreeing and falls toward 0 when they keep cancelling. Multiply the whole loss by a million and Adam takes the same path.',
    analogy: {
      title: 'A fog walker with a memory and a separate stride for each compass direction',
      text: 'A walker in fog feels the slope underfoot and wants the valley floor. This walker keeps two notebooks. The first holds a running average of recent slopes, and the walker heads the way that average points, so a slope that flips back and forth is averaged away while a slope that persists builds up. The second holds, separately for north-south and for east-west, how large the slopes have typically been. Before stepping, the walker divides by the typical size in each direction. Where the ground has been steep, the stride is shortened. Where it has been gentle, the stride is lengthened. The result is a walker who covers ground at a similar pace in both directions, whatever the steepness.',
      limits: 'No real walker can stride one length north-south and a different length east-west at the same moment. Adam can, because it treats every adjustable number on its own. That is also where the picture gives a warning: the adjustment works along the compass directions only. If the valley runs diagonally, both compass directions see the same mixture of steep and gentle slopes, and the separate strides help much less. The memory has a cost too. Carried by its averaged direction, the walker goes past the lowest point and has to turn back. And a real network has millions of directions, not two.',
    },
  },

  example: {
    setup: "A surface with two settings, x and y. Its slope in x is equal to x, and its slope in y is 100 times y, so it is far steeper in y. Start at x = −2, y = 0.2. The lowest point is at x = 0, y = 0. The learning rate, the number that sets the step length, is 0.1. Adam keeps two running averages for each setting: one of the slope, and one of the slope multiplied by itself.",
    steps: [
      "At the start the slope is −2 in x and 100 × 0.2 = 20 in y. The y slope is ten times the x slope. Plain gradient descent would move y ten times as far as x.",
      "After one step, once the start-up correction is applied, the average slope is the slope itself: −2 and 20. The average squared slope is its square: 4 and 400. Their square roots are 2 and 20, the sizes of the two slopes.",
      "Divide each average slope by that size: −2 ÷ 2 = −1 and 20 ÷ 20 = 1. Multiply by the learning rate and step the opposite way. x goes from −2 to −1.9, and y goes from 0.2 to 0.1. Both moved by 0.1.",
      "At the new point the slopes are −1.9 and 100 × 0.1 = 10. The y slope has halved. Blending these with the first slopes and correcting gives average slopes of about −1.947 and 14.74, and sizes of about 1.951 and 15.81.",
      "Divide again: −1.947 ÷ 1.951 is about −0.998, and 14.74 ÷ 15.81 is about 0.932. So x moves by 0.0998 to about −1.8002, and y moves by 0.0932 to about 0.0068.",
    ],
    result: "In two steps x has gone from −2 to about −1.80 and y from 0.2 to about 0.007. The two settings moved almost the same distance each time, although one slope was ten times the other. Notice the second step in y: it was a little shorter than 0.1, because the y slope had shrunk and the average slope fell faster than the remembered size did.",
    tryInput: { ...DEFAULTS, show: 'adam' },
  },

  terms: [
    { term: "Loss", meaning: "A score for how wrong the current settings are. Lower is better." },
    { term: "Parameter", meaning: "One of the adjustable numbers being tuned. Here there are two, x and y. A neural network has millions." },
    { term: "Gradient", meaning: "The list of slopes of the loss, one for each parameter. Each slope says how fast the loss rises if that parameter is nudged upward." },
    { term: "Learning rate", meaning: "A number that sets how long the steps are. In Adam, a parameter whose slopes keep the same sign and size moves by about this much at every step." },
    { term: "Running average", meaning: "An average that is updated a little with each new value: keep most of the old average and mix in a small share of the new value. Old values fade out gradually." },
    { term: "Momentum", meaning: "Stepping along a running average of recent slopes instead of the newest slope alone." },
    { term: "Bias correction", meaning: "A fix for the first few steps. The running averages start at zero, which makes them too small at first, so each is divided by the fraction it has had time to fill up." },
    { term: "Adaptive", meaning: "Adjusting itself. Here, each parameter's step length is set from that parameter's own history of slopes." },
  ],

  takeaway: "Step the way the recent slopes agree on, and give every adjustable number its own step size, smaller where its slopes have been large.",

  viz: {
    describe: 'A contour map of a two-variable loss function, with a hollow green circle on each known minimum. A terracotta path shows every position Adam has visited, and an ink path shows plain gradient descent started from the same point. An ochre arrow shows the downhill direction at Adam\'s position and a brick arrow shows the direction of the step Adam is about to take. Below the map, a table with one row for x and one for y lists the current slope, the two running averages m and v, their bias-corrected values and the step taken, with the cells that have just changed highlighted. A third, smaller chart plots the loss at each step for both methods.',
    inputs: [
      { id: 'landscape', type: 'select', label: 'Loss surface', options: SURFACE_OPTIONS, default: DEFAULTS.landscape },
      { id: 'show', type: 'select', label: 'Run', default: DEFAULTS.show, options: [
        { value: 'both', label: 'Adam and plain gradient descent' },
        { value: 'adam', label: 'Adam alone' },
        { value: 'gd', label: 'Plain gradient descent alone' },
      ] },
      { id: 'rate', type: 'range', scale: 'log', label: 'Adam learning rate (α)', min: 0.001, max: 1, default: DEFAULTS.rate,
        help: 'About the distance a coordinate moves per step while its slopes keep agreeing. The paper suggests 0.001 for neural networks. This small map needs longer steps. Logarithmic slider.' },
      { id: 'beta1', type: 'range', label: 'Memory of the average slope (β₁)', min: 0, max: 0.99, step: 0.01, default: DEFAULTS.beta1,
        help: 'The share of m kept at each step. 0 means no momentum. The paper suggests 0.9.' },
      { id: 'beta2', type: 'range', label: 'Memory of the average squared slope (β₂)', min: 0.8, max: 0.999, step: 0.001, default: DEFAULTS.beta2,
        help: 'The share of v kept at each step. The paper suggests 0.999.' },
      { id: 'correct', type: 'toggle', label: 'Bias correction', default: DEFAULTS.correct },
      { id: 'gdRate', type: 'range', scale: 'log', label: 'Plain gradient descent learning rate (η)', min: 0.001, max: 1.2, default: DEFAULTS.gdRate,
        help: 'Used only by plain gradient descent. On the steep ravine it diverges above 0.02.' },
      { id: 'steps', type: 'range', label: 'Maximum steps', min: 10, max: 300, step: 10, default: DEFAULTS.steps },
      { id: 'startX', type: 'range', label: 'Start position, horizontal', min: -1, max: 1, step: 0.05, default: DEFAULTS.startX },
      { id: 'startY', type: 'range', label: 'Start position, vertical', min: -1, max: 1, step: 0.05, default: DEFAULTS.startY },
    ],
    presets: [
      { label: 'Steep ravine: Adam and plain descent', values: { ...DEFAULTS } },
      { label: 'Steep ravine, run until Adam stops', values: { ...DEFAULTS, steps: 200 } },
      { label: 'Adam alone (the worked example)', values: { ...DEFAULTS, show: 'adam' } },
      { label: 'Bias correction off', values: { ...DEFAULTS, show: 'adam', correct: false } },
      { label: 'No momentum (β₁ = 0)', values: { ...DEFAULTS, show: 'adam', beta1: 0, steps: 100 } },
      { label: 'The same ravine turned 45°', values: { ...DEFAULTS, landscape: 'ravine-turned', startX: -0.4, startY: -0.5, steps: 200 } },
      { label: 'Turned ravine, no momentum', values: { ...DEFAULTS, landscape: 'ravine-turned', show: 'adam', beta1: 0, startX: -0.4, startY: -0.5, steps: 200 } },
      { label: 'Round bowl: plain descent wins', values: { ...DEFAULTS, landscape: 'bowl', gdRate: 0.4, startX: -0.85, startY: 0.7 } },
      { label: 'Mild valley: plain descent is quicker', values: { ...DEFAULTS, landscape: 'valley', gdRate: 0.15, startX: -0.85, startY: 0.7, steps: 100 } },
      { label: 'Many local minima: both are trapped', values: { ...DEFAULTS, landscape: 'rastrigin', gdRate: 0.002, startX: -0.85, startY: 0.7, steps: 100 } },
    ],
    tryThis: [
      'Play the default run and watch the first step in the table. The slopes are −2 and 20, yet both coordinates move by 0.1. Then follow the ink path of plain gradient descent: it bounces across the ravine in y and creeps along it in x, because one learning rate has to serve both.',
      'Raise the plain gradient descent learning rate a little at a time to help it along. Just above 0.02 it diverges, because y is 100 times more curved than x and the limit is 2 divided by 100. That limit is what holds plain descent back here. No single rate is both safe for y and useful for x.',
      'Load "Bias correction off" and read step 1. The step is 3.162 times as long as with the correction, because m starts at 10 percent of the slope and the square root of v at about 3.2 percent. Turn the correction back on and compare the first few positions.',
      'Load "The same ravine turned 45°". Nothing about the surface has changed except its orientation, and plain gradient descent behaves as it did before. Adam now needs 177 steps to stop where it needed 131, and for the first 45 steps plain gradient descent has the lower loss. Each coordinate now sees a mixture of the steep and the gentle direction, so separate step sizes cannot treat them differently. The experiment below shows the gap widening as the valley narrows.',
      'Load "No momentum (β₁ = 0)". On this smooth ravine Adam now stops after 85 steps instead of 131 and no longer overshoots in x. With exact slopes and a valley that lines up with the axes, the separate step sizes do the work and the averaged direction only adds overshoot. Then load "Turned ravine, no momentum": the path zig-zags across the valley and has not settled after 200 steps. The averaged direction earns its place when the valley does not line up with the axes.',
      'In "No momentum (β₁ = 0)", watch y between steps 50 and 62. It has been resting on the valley floor, then leaps to about 0.27 and comes back. While y sat still its slopes were tiny, so v slowly forgot the large early ones, √v̂ shrank, and the y step grew until it overshot. The large slopes that followed refilled v. Adam\'s step sizes can grow as well as shrink.',
      'Load "Round bowl: plain descent wins" and "Mild valley: plain descent is quicker". When the directions do not differ much in steepness there is little for Adam to fix, and a well chosen single rate settles first. Adam also overshoots the minimum and has to come back, which is the price of its momentum.',
    ],
    run,
    report: (r) => {
      const say = (name, o) => `${name}: ${o.status === 'converged' ? 'stopped at a level point' : o.status === 'diverged' ? 'diverged' : 'still moving at the step limit'} after ${o.steps} steps, at (${f4(o.x)}, ${f4(o.y)}), loss ${sig(o.bestValue)}.`;
      const lines = [say(r.method === 'adam' ? 'Adam' : 'Plain gradient descent', r)];
      if (r.method === 'adam' && r.gd) lines.push(say('Plain gradient descent', r.gd));
      if (r.method === 'adam') lines.push(`Longest step in one coordinate: ${sig(r.maxRatio)} × α.`);
      return lines.join('\n');
    },
    experiment: {
      title: 'Steps to reach the minimum as the valley gets narrower',
      note: 'Each point is a real run on f = ½(u² + κv²) from u = 1, v = 1, counting steps until the position is within 0.001 of the minimum. Plain gradient descent uses learning rate 1/κ, the largest that never overshoots. Adam uses α = 0.1 with β₁ = 0.9 and β₂ = 0.999 at every κ. In the first two series u and v are the coordinates x and y themselves. Adam then takes the same number of steps at every κ, because dividing by √v̂ cancels any constant factor in a coordinate\'s slope. In the third series the same valley and the same start are turned by 45°, so each coordinate sees a mixture of the steep and the gentle direction. Adam\'s step count then grows with κ, and no formula is claimed for it. Plain gradient descent is unaffected by turning the valley, so its series would be the same in both cases.',
      metric: 'gradient evaluations',
      metricLabel: 'Steps to get within 0.001 of the minimum',
      sizeLabel: 'Condition number κ (steepest curvature ÷ gentlest curvature)',
      sizes: [2, 5, 10, 20, 50, 100, 200, 500],
      variants: [
        { id: 'gd', label: 'Plain gradient descent, rate 1/κ' },
        { id: 'adam', label: 'Adam, valley along the axes' },
        { id: 'turned', label: 'Adam, same valley turned 45°' },
      ],
      input: (kappa, variant) => ({ landscape: 'quadratic', kappa, turned: variant === 'turned', show: variant === 'gd' ? 'gd' : 'adam', rate: 0.1, beta1: 0.9, beta2: 0.999, correct: true, gdRate: 1 / kappa, steps: 100000, stopDistance: 1e-3 }),
      theory: [
        { label: 'ln(1000) ÷ −ln(1 − 1/κ), rounded up', fn: (k) => Math.ceil(Math.log(1000) / -Math.log(1 - 1 / k)), variant: 'gd' },
        { label: 'the same at every κ', fn: () => 1, scaled: true, variant: 'adam' },
      ],
    },
  },

  logic: {
    intuition: 'Plain gradient descent has one learning rate for every parameter. The rate has to be small enough for the steepest parameter, and is then far too small for the others. Adam replaces the raw gradient with a ratio. The top, m, is a running average of the gradient: the direction recent gradients agree on, with the disagreements cancelled out. The bottom, the square root of v, is the typical size of that parameter\'s recent gradients. The ratio has forgotten how large the gradients are and kept how consistent they are. Multiplied by α, it moves every parameter at a comparable pace.',
    steps: [
      'Set m and v to zero for every parameter, and choose α, β₁, β₂ and ε. The paper suggests α = 0.001, β₁ = 0.9, β₂ = 0.999 and ε = 10⁻⁸ as defaults for machine learning problems.',
      'Compute the gradient g at the current parameters. Everything below is done separately for each parameter.',
      'Update the first average: m becomes β₁ times its old value plus (1 − β₁) times g.',
      'Update the second average: v becomes β₂ times its old value plus (1 − β₂) times g squared.',
      'Correct the start-up bias. With t the number of steps taken so far, m̂ is m divided by (1 − β₁ᵗ) and v̂ is v divided by (1 − β₂ᵗ).',
      'Move the parameter by −α times m̂ divided by (√v̂ + ε).',
      'Repeat from step 2 until the gradient is small or the step budget is spent.',
    ],
    pseudocode: [
      'adam(f, θ, α, β₁, β₂, ε):',
      '  m ← 0;  v ← 0;  t ← 0',
      '  while θ not converged:',
      '    t ← t + 1',
      '    g ← ∇f(θ)',
      '    m ← β₁·m + (1 − β₁)·g',
      '    v ← β₂·v + (1 − β₂)·g²',
      '    m̂ ← m / (1 − β₁ᵗ)',
      '    v̂ ← v / (1 − β₂ᵗ)',
      '    θ ← θ − α·m̂ / (√v̂ + ε)',
      '  return θ',
    ],
    decisions: [
      { title: 'How large a learning rate?', text: 'In Adam α sets the scale of movement directly, since a parameter with steady gradients moves by about α per step. That makes a sensible first guess easier than in plain gradient descent, where the right rate depends on the unknown curvature. It does not remove the need to tune. In neural network training α is usually also changed during the run, for example raised gradually at the start and lowered later.' },
      { title: 'How long should the two memories be?', text: 'An average with share β remembers roughly the last 1/(1 − β) values, so the defaults give m a memory of about 10 steps and v about 1000. A shorter memory for v adapts faster to a change in gradient size, but makes the denominator jumpy. The bound in the proof section needs β₁² to be smaller than β₂, which the defaults satisfy comfortably.' },
      { title: 'Is momentum always worth having?', text: 'Not on every problem. On the smooth ravine of this page, Adam with β₁ = 0.5 stops in 64 steps and with β₁ = 0 in 85, against 131 at the default of 0.9, because with exact gradients and a valley along the axes the averaged direction mostly adds overshoot. On the turned ravine the order changes: β₁ = 0 has not settled after 300 steps, while 0.5 and 0.9 stop after 151 and 177. The suggested defaults were chosen on machine learning problems with noisy gradients, which this page does not simulate.' },
      { title: 'Why correct the bias?', text: 'Both averages start at zero, so early on they are pulled toward zero. For v with β₂ = 0.999 the pull lasts for hundreds of steps. Without the correction the denominator would be far too small at the start, and the first steps several times too long. The correction divides each average by exactly the fraction of it that has been filled.' },
      { title: 'What does ε do?', text: 'It prevents division by zero when a parameter\'s gradients have all been zero. It also sets a floor: when √v̂ is much smaller than ε the update turns into α·m̂/ε, which no longer adapts to the gradient size. Raising ε therefore makes Adam behave more like plain momentum.' },
    ],
    invariants: [
      'With bias correction, after the first step m̂ is the first gradient and v̂ is its square, so every parameter with a nonzero gradient g moves by α·|g| ÷ (|g| + ε), which differs from α only by the tiny fraction ε/|g|.',
      'If one parameter\'s gradient stays constant, then at every step m̂ equals that gradient and v̂ equals its square, so the parameter moves by α each step.',
      'Multiplying the loss by a positive constant multiplies m̂ and √v̂ by the same constant, so apart from ε the steps do not change.',
      'v is never negative, because it is an average of squares.',
    ],
    edgeCases: [
      'A parameter whose gradient is exactly zero from the start: m and v stay at zero and the step is 0 ÷ ε = 0.',
      'A gradient that has been zero for a long time and then is suddenly not: m̂ is about (1 − β₁)g and √v̂ about √(1 − β₂)·|g|, so the step is α(1 − β₁) ÷ √(1 − β₂), which is 3.16α at the default settings. The learning rate is not a hard limit on the step.',
      'Close to the minimum with a fixed α: the averaged direction carries the parameters past the lowest point, and they approach it by a shrinking wobble. A decreasing α settles this sooner.',
      'A valley that runs diagonally across the parameters: each parameter sees both the steep and the gentle direction, and scaling parameters separately cannot untangle them.',
      'A parameter whose gradients stay tiny for a long stretch: v gradually forgets the larger gradients of the past, √v̂ shrinks, and the effective step α ÷ √v̂ grows. On a steep coordinate it can grow until the next step overshoots and the parameter jumps. The "No momentum" preset shows this near step 57.',
      'β₁ = 0: there is no momentum and the method reduces to a bias-corrected form of RMSProp, which follows the sign of the newest gradient when gradient sizes change slowly.',
      'Gradients no larger than ε: the denominator is dominated by ε and the per-parameter scaling is lost.',
    ],
    correctness: 'Adam has no general guarantee of reaching a minimum. What can be proved exactly are the structural facts in the invariants: the size of the first step, the behaviour under a constant gradient, the indifference to the scale of the loss, and a bound on the step in terms of β₁ and β₂. The original paper included a convergence analysis for online convex problems. In 2018 Reddi, Kale and Kumar showed that this analysis contains an error and gave simple convex problems on which Adam does not converge to the best answer, because v can shrink and let the step size grow at the wrong moments. They proposed AMSGrad, which divides by the largest value of v seen so far, and analysed that variant instead. Convergence results for Adam itself have since been proved under additional conditions. On a smooth problem without noise, such as the ravine on this page, Adam with a fixed α approaches the minimum through a damped oscillation, as the demonstration shows.',
    mistakes: [
      'Dividing by v̂ instead of its square root. Steps then shrink with the square of the gradient: far too short where the surface is steep and far too long where it is gentle.',
      'Writing the bias correction as 1 − β·t instead of 1 − βᵗ, or starting t at 0, which divides by zero on the first step.',
      'Computing v as the square of m. The second average must be an average of squared gradients, which cannot cancel, not the square of an average, which can.',
      'Resetting m and v at every epoch, or failing to save them with the model. The optimizer then repeats its start-up phase each time.',
      'Adding weight decay to the gradient and expecting it to act as it does in plain gradient descent. The decay term is then divided by √v̂ like everything else. AdamW applies the decay separately for this reason.',
      'Assuming the suggested α = 0.001 suits every problem. It is a starting point for neural networks, not a constant of nature.',
    ],
  },

  code: {
    sample: {
      input: 'Minimize f(x, y) = ½x² + 50y² from (−2, 0.2) with Adam at α = 0.1, printing the first three steps and every twentieth, then run plain gradient descent from the same point with learning rate 0.019 for comparison.',
      expected: 'adam  step  1: x=-1.9000 y=0.1000 loss=2.3050\nadam  step  2: x=-1.8002 y=0.0068 loss=1.6226\nadam  step  3: x=-1.7006 y=-0.0672 loss=1.6717\nadam  step 20: x=-0.2225 y=-0.0477 loss=0.1386\nadam  step 40: x=0.2338 y=-0.0001 loss=0.0273\nadam  step 60: x=-0.0429 y=0.0022 loss=0.0012\nplain step 20: x=-1.3627 y=0.0243 loss=0.9581\nplain step 40: x=-0.9285 y=0.0030 loss=0.4315\nplain step 60: x=-0.6327 y=0.0004 loss=0.2001',
    },
    python: {
      source: `import math


def loss(x, y):
    return 0.5 * x * x + 50 * y * y


def grad(x, y):
    return x, 100 * y


alpha, beta1, beta2, eps = 0.1, 0.9, 0.999, 1e-8
x, y = -2.0, 0.2
mx = my = vx = vy = 0.0
power1 = power2 = 1.0
for t in range(1, 61):
    gx, gy = grad(x, y)
    mx = beta1 * mx + (1 - beta1) * gx
    my = beta1 * my + (1 - beta1) * gy
    vx = beta2 * vx + (1 - beta2) * gx * gx
    vy = beta2 * vy + (1 - beta2) * gy * gy
    power1 *= beta1
    power2 *= beta2
    mx_hat, my_hat = mx / (1 - power1), my / (1 - power1)
    vx_hat, vy_hat = vx / (1 - power2), vy / (1 - power2)
    x -= alpha * mx_hat / (math.sqrt(vx_hat) + eps)
    y -= alpha * my_hat / (math.sqrt(vy_hat) + eps)
    if t <= 3 or t % 20 == 0:
        print(f"adam  step {t:2d}: x={x:.4f} y={y:.4f} loss={loss(x, y):.4f}")

x, y = -2.0, 0.2
for t in range(1, 61):
    gx, gy = grad(x, y)
    x -= 0.019 * gx
    y -= 0.019 * gy
    if t % 20 == 0:
        print(f"plain step {t:2d}: x={x:.4f} y={y:.4f} loss={loss(x, y):.4f}")`,
      notes: [
        { line: 9, text: 'The slope in y is 100 times y, against x for the slope in x. This difference in scale is what a single learning rate cannot serve.' },
        { line: 18, text: 'The first running average, kept separately for x and y. Slopes of opposite sign cancel here.' },
        { line: 20, text: 'The second running average, of the squared slope. Squares are never negative, so this records size and cannot cancel.' },
        { line: 22, text: 'power1 holds β₁ to the power t and power2 holds β₂ to the power t, built up by one multiplication per step.' },
        { line: 24, text: 'Bias correction: divide each average by the fraction of it that has been filled since it started at zero.' },
        { line: 26, text: 'The update. Each coordinate is divided by its own typical slope size before stepping.' },
        { line: 34, text: 'Plain gradient descent for comparison: one learning rate for both coordinates, kept just under the limit of 0.02 that the steep y direction imposes.' },
      ],
    },
    javascript: {
      source: `const loss = (x, y) => 0.5 * x * x + 50 * y * y;
const grad = (x, y) => [x, 100 * y];
const show = (name, t, x, y) =>
  name + " step " + String(t).padStart(2, " ") + ": x=" + x.toFixed(4) + " y=" + y.toFixed(4) + " loss=" + loss(x, y).toFixed(4);

const alpha = 0.1, beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
let x = -2.0, y = 0.2;
let mx = 0, my = 0, vx = 0, vy = 0;
let power1 = 1, power2 = 1;
for (let t = 1; t <= 60; t++) {
  const [gx, gy] = grad(x, y);
  mx = beta1 * mx + (1 - beta1) * gx;
  my = beta1 * my + (1 - beta1) * gy;
  vx = beta2 * vx + (1 - beta2) * gx * gx;
  vy = beta2 * vy + (1 - beta2) * gy * gy;
  power1 *= beta1;
  power2 *= beta2;
  const mxHat = mx / (1 - power1), myHat = my / (1 - power1);
  const vxHat = vx / (1 - power2), vyHat = vy / (1 - power2);
  x -= alpha * mxHat / (Math.sqrt(vxHat) + eps);
  y -= alpha * myHat / (Math.sqrt(vyHat) + eps);
  if (t <= 3 || t % 20 === 0) console.log(show("adam ", t, x, y));
}

x = -2.0;
y = 0.2;
for (let t = 1; t <= 60; t++) {
  const [gx, gy] = grad(x, y);
  x -= 0.019 * gx;
  y -= 0.019 * gy;
  if (t % 20 === 0) console.log(show("plain", t, x, y));
}`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>

double loss(double x, double y) { return 0.5 * x * x + 50 * y * y; }

int main() {
    const double alpha = 0.1, beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
    double x = -2.0, y = 0.2;
    double mx = 0.0, my = 0.0, vx = 0.0, vy = 0.0;
    double power1 = 1.0, power2 = 1.0;
    for (int t = 1; t <= 60; ++t) {
        double gx = x, gy = 100 * y;
        mx = beta1 * mx + (1 - beta1) * gx;
        my = beta1 * my + (1 - beta1) * gy;
        vx = beta2 * vx + (1 - beta2) * gx * gx;
        vy = beta2 * vy + (1 - beta2) * gy * gy;
        power1 *= beta1;
        power2 *= beta2;
        double mxHat = mx / (1 - power1), myHat = my / (1 - power1);
        double vxHat = vx / (1 - power2), vyHat = vy / (1 - power2);
        x -= alpha * mxHat / (std::sqrt(vxHat) + eps);
        y -= alpha * myHat / (std::sqrt(vyHat) + eps);
        if (t <= 3 || t % 20 == 0) {
            std::printf("adam  step %2d: x=%.4f y=%.4f loss=%.4f\\n", t, x, y, loss(x, y));
        }
    }

    x = -2.0;
    y = 0.2;
    for (int t = 1; t <= 60; ++t) {
        double gx = x, gy = 100 * y;
        x -= 0.019 * gx;
        y -= 0.019 * gy;
        if (t % 20 == 0) {
            std::printf("plain step %2d: x=%.4f y=%.4f loss=%.4f\\n", t, x, y, loss(x, y));
        }
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One step of Adam costs one gradient plus a fixed amount of arithmetic for each parameter, so it is linear in the number of parameters, the same order as plain gradient descent. It stores two extra numbers per parameter. How many steps it needs has no general formula. On the family of valleys measured on this page the answer depends on orientation: when the valley lines up with the coordinates the step count does not depend on how narrow the valley is, and when it does not line up the count grows as the valley narrows.',
    cases: [
      { case: 'One step', time: 'O(d) beyond the gradient', when: 'A handful of multiplications, one division and one square root for each of the d parameters.' },
      { case: 'Quadratic valley aligned with the coordinates', time: 'Independent of the condition number κ', when: 'Each coordinate\'s slope is a constant times its distance from the minimum, and dividing by √v̂ cancels the constant. Measured in the experiment, and argued in the complexity proof.' },
      { case: 'Quadratic valley turned 45°', time: 'Grows with κ (measured, no formula claimed)', when: 'Each coordinate\'s slope mixes the steep and the gentle direction, so per-coordinate scaling cannot separate them.' },
      { case: 'Plain gradient descent on the same valley, rate 1/κ', time: 'About κ·ln(1/δ) steps to distance δ', when: 'The comparison series in the experiment. The gentle direction shrinks by the factor (1 − 1/κ) per step.' },
      { case: 'General smooth or noisy problems', time: 'No guarantee without further conditions', when: 'See the correctness section. Convergence has been proved for variants and under extra assumptions.' },
    ],
    space: 'O(d): the parameters, m and v. That is two vectors more than plain gradient descent and one more than gradient descent with momentum.',
    memory: 'The two averages are the same size as the model. For a network with a billion parameters stored as 32-bit numbers, m and v take 8 gigabytes together, on top of the 4 gigabytes for the parameters themselves.',
    tradeoffs: 'Adam trades memory and a more complicated update for less sensitivity to the scale of each parameter\'s gradient. Its momentum speeds travel along consistent directions and costs an overshoot at the end. Its long memory of gradient sizes steadies the step lengths and makes it slow to react when those sizes change.',
    assumptions: [
      'The cost per step counts arithmetic on numbers as constant time and excludes the cost of computing the gradient, which usually dominates.',
      'The step counts in the experiment are for exact gradients on a two-variable quadratic, from one starting point, with a stopping distance of 0.001. They illustrate the role of orientation and are not a general benchmark.',
      'Independence from κ in the aligned case ignores ε, which is negligible while gradients are much larger than 10⁻⁸.',
      'In machine learning the gradients are noisy estimates from mini-batches. Nothing on this page measures that setting.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Narrow valleys that run diagonally across the parameters, where separate step sizes cannot separate the steep direction from the gentle one.',
      'Landing precisely on a minimum with a fixed learning rate. It overshoots and wobbles in.',
      'Surfaces with many local minima. It is a downhill method and stops in whichever dip it reaches, as plain gradient descent does.',
      'Problems that are already well scaled, where a tuned single learning rate does as well with less machinery.',
    ],
    pitfalls: [
      'Treating the default settings as tuned. The learning rate still matters a great deal.',
      'Comparing optimizers when only one of them has had its learning rate tuned.',
      'Combining Adam with weight decay added to the gradient, and getting a weaker and uneven penalty.',
      'Judging by the training loss alone. An optimizer that lowers the training loss fastest does not always give the model that does best on new data.',
    ],
    misunderstandings: [
      "\"Adam needs no tuning.\" It is less sensitive to the learning rate than plain gradient descent, not insensitive. The best rate still has to be searched for, and it is usually varied during training.",
      "\"Adam is simply better than gradient descent.\" On the round bowl and the mild valley on this page a single well chosen rate reaches the minimum first. In machine learning, carefully tuned stochastic gradient descent with momentum has sometimes been reported to produce models that do better on new data. Which is better depends on the problem.",
      "\"Adam measures curvature, like Newton's method.\" It divides by the typical size of recent gradients, not by the curvature. On the ravine each coordinate's gradient is its curvature times its distance from the valley floor, so dividing by the gradient's size removes the curvature as well. In general the two are different quantities.",
      "\"A step can never be longer than the learning rate.\" The first step is the learning rate, and so are steps under a constant gradient. But a gradient that appears suddenly after many small ones can produce a step about three times as long at the default settings.",
      "\"Each parameter having its own step size means the shape of the valley no longer matters.\" Only its shape along the coordinate axes is handled. Turn the same valley by 45° and most of the advantage goes.",
    ],
    constraints: [
      'Two extra values must be stored for every parameter, which matters for very large models.',
      'The state of the optimizer, m, v and the step count, has to be saved and restored with the model if training is to resume smoothly.',
      'Results depend on the coordinate system: rewriting the same model with rotated parameters changes Adam\'s path, while plain gradient descent would be unaffected.',
    ],
    alternatives: [
      { id: 'gradient-descent', name: 'Gradient Descent', when: 'The problem is small, smooth and well scaled, and one learning rate can be tuned.' },
      { id: 'stochastic-gradient-descent', name: 'Stochastic Gradient Descent', when: 'There is time to tune the learning rate and its schedule, usually with momentum added. It needs less memory and is a strong baseline.' },
      { id: 'newtons-method', name: 'Newton\'s Method', when: 'There are few parameters and second derivatives are affordable. It handles a narrow valley in any orientation.' },
      { name: 'AdamW', when: 'Weight decay is wanted. It applies the decay directly to the parameters instead of passing it through the adaptive scaling.' },
      { name: 'RMSProp and AdaGrad', when: 'Per-parameter step sizes are wanted without momentum. AdaGrad suits sparse gradients, and its step sizes only ever shrink.' },
    ],
    comparison: {
      columns: ['', 'Gradient descent', 'With momentum', 'Adam'],
      rows: [
        ['Direction of the step', 'Newest gradient', 'Running average of gradients', 'Running average of gradients'],
        ['Step size per parameter', 'One rate for all', 'One rate for all', 'Own size, from past gradient sizes'],
        ['Extra memory', 'None', 'One vector', 'Two vectors'],
        ['Effect of rescaling the loss', 'Learning rate must be rescaled', 'Learning rate must be rescaled', 'None, apart from ε'],
        ['Effect of rotating the parameters', 'None', 'None', 'The path changes'],
      ],
    },
  },

  applications: [
    { title: 'Training Transformers', status: 'established', text: 'The paper that introduced the Transformer trained it with Adam, using β₁ = 0.9, β₂ = 0.98 and ε = 10⁻⁹ together with a learning rate that rises during a warm-up period and then falls. Adam and AdamW are widely used for training language models.' },
    { title: 'A standard optimizer in deep learning libraries', status: 'established', text: 'PyTorch and TensorFlow both ship Adam and AdamW, and many published training recipes start from them.' },
    { title: 'Generative adversarial networks', status: 'established', text: 'The DCGAN paper of Radford, Metz and Chintala trained its image generators with Adam and reported that lowering β₁ from 0.9 to 0.5 helped stabilize training.' },
    { title: 'Fitting a small differentiable model', status: 'illustrative', text: 'A physical or statistical model with a few dozen parameters of very different scales can be fitted with Adam without first working out a sensible scale for each parameter.' },
  ],

  connections: [
    { to: 'gradient-descent', type: 'prerequisite', why: 'Adam is gradient descent with two changes: it steps along a running average of gradients instead of the newest one, and it divides each parameter\'s step by the typical size of that parameter\'s gradients.' },
    { to: 'stochastic-gradient-descent', type: 'prerequisite', why: 'Adam was designed for the noisy mini-batch gradients of stochastic gradient descent. Its first average smooths that noise, and its second sets a step size for each parameter.' },
    { to: 'concept:gradient', type: 'prerequisite', why: 'Adam\'s two memories are running averages of the gradient and of its square, kept for every parameter.' },
    { to: 'concept:learning-rate', type: 'prerequisite', why: 'Adam turns one learning rate into a separate effective step size for each parameter, so understanding what the single rate does in gradient descent comes first.' },
    { to: 'concept:expectation', type: 'related', why: 'Adam\'s m and v estimate the expected value of the gradient and of its square, and the bias correction is exactly what makes those estimates right on average from the first step.' },
    { to: 'exponential-smoothing', type: 'related', why: 'Adam\'s running averages are exponential smoothing applied to the gradient and its square: each new value is blended into the old average with a fixed weight.' },
    { to: 'backpropagation', type: 'related', why: 'Backpropagation produces the gradient of a network\'s loss for every weight, and Adam decides how far to move each weight given that gradient and its history.' },
    { to: 'newtons-method', type: 'related', why: 'Newton\'s method and Adam both rescale the gradient before stepping. Newton divides by the true curvature in every direction, while Adam divides each coordinate by the typical size of its recent gradients, which is far cheaper and only works along the coordinate axes.' },
    { to: 'logistic-regression', type: 'application', why: 'The paper that introduced Adam tested it first on logistic regression, whose convex loss makes it a clean problem on which to compare optimizers.' },
    { to: 'attention', type: 'application', why: 'The Transformer, built on attention, was trained with Adam in the paper that introduced it, with the learning rate warmed up and then decayed.' },
    { to: 'discipline:deep-learning', type: 'application', why: 'Training a deep network means choosing an optimizer for the gradients from backpropagation, and Adam or one of its variants is a very common choice.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does Adam divide each parameter\'s step by the square root of v̂?',
      options: ['To make the steps shorter as training goes on', 'To remove the size of that parameter\'s gradients from its step, so steep and gentle parameters move at a similar pace', 'To measure the curvature of the loss exactly', 'To cancel the noise in the gradient'],
      answer: 1,
      explain: [
        'v is a running average, not a running total, so it does not grow steadily. Steadily shrinking steps are what AdaGrad does.',
        '√v̂ is the typical size of the parameter\'s recent gradients. Dividing by it leaves a ratio that depends on how consistent the gradients are, not on how large.',
        'Gradient size and curvature are different things. Adam uses no second derivatives.',
        'Smoothing noise is the job of m, the average in the numerator.',
      ],
    },
    {
      type: 'predict',
      q: 'On the steep ravine the starting slope is −2 in x and 20 in y, and α is 0.1. How far does Adam\'s first step move each coordinate?',
      options: ['x by 0.2 and y by 2, in proportion to the slopes', 'x by 0.1 and y by 0.1', 'x by 0.1 and y by 0.01, because the steep coordinate is held back', 'Neither moves until the averages have filled up'],
      answer: 1,
      explain: [
        'That is what plain gradient descent would do with a learning rate of 0.1, and in y it would overshoot badly.',
        'After bias correction m̂ is the slope and √v̂ is its size, so their ratio is −1 for x and +1 for y. Each coordinate moves by α.',
        'The steep coordinate is scaled down to the same step as the gentle one, not below it.',
        'Bias correction exists so that the first step is already full length.',
      ],
      tryInput: { ...DEFAULTS, show: 'adam' },
    },
    {
      type: 'debug',
      q: 'With this update the parameters with steep slopes barely move and the ones with gentle slopes take enormous steps. What is wrong?',
      code: `m = beta1 * m + (1 - beta1) * g
v = beta2 * v + (1 - beta2) * g * g
m_hat = m / (1 - beta1 ** t)
v_hat = v / (1 - beta2 ** t)
x -= alpha * m_hat / (v_hat + eps)`,
      options: ['The bias correction should multiply, not divide', 'The square root of v_hat is missing, so the step is divided by the squared size of the slope', 'v should use g, not g * g', 'eps should be subtracted'],
      answer: 1,
      explain: [
        'The averages start too small, so dividing by a fraction below 1 is the right correction.',
        'v_hat has the size of the slope squared. Dividing by it gives a step of about α ÷ |g|: with a slope of 100 the step is α/100, and with a slope of 0.01 it is 100α. The last line needs sqrt(v_hat).',
        'v must average the squares. An average of g could cancel to zero or go negative.',
        'eps is added so that the denominator cannot be zero.',
      ],
    },
    {
      type: 'choice',
      q: 'Bias correction is switched off, with β₁ = 0.9 and β₂ = 0.999. How does the first step compare with the corrected one?',
      options: ['It is about 3.2 times as long', 'It is ten times shorter, because m is only a tenth of the slope', 'It is the same, because the two shortfalls cancel', 'It is zero, because m and v start at zero'],
      answer: 0,
      explain: [
        'm is 0.1 of the slope, but √v is √0.001, about 0.032, of its size. The ratio is 0.1 ÷ 0.032, about 3.2, so the uncorrected step is that much longer.',
        'm is a tenth of the slope, but the step divides by √v, which has fallen short by even more.',
        'They would cancel only if 1 − β₁ equalled √(1 − β₂). Here they are 0.1 and about 0.032.',
        'After one update m and v are small but not zero.',
      ],
    },
    {
      type: 'challenge',
      title: 'Find what Adam is and is not indifferent to',
      prompt: 'Start from the code sample. First multiply the loss, and therefore both slopes, by 1000 and show that Adam visits the same positions while plain gradient descent now needs its learning rate divided by 1000. Then turn the ravine by 45°: use u = (x + y)/√2 and v = (x − y)/√2 with loss ½u² + 50v², and start from the point where u = −2 and v = 0.2. Count the steps Adam needs to get within 0.01 of the minimum in both orientations, and explain the difference from the slopes each coordinate sees.',
      hints: ['In the turned ravine the slope in x is (u + 100v)/√2 and the slope in y is (u − 100v)/√2.', 'Scaling the loss changes m̂ and √v̂ by the same factor. Check what happens to their ratio.', 'Plain gradient descent takes the same number of steps in both orientations. Why does it not care?'],
    },
  ],

  compare: {
    idea: 'Step along an average of recent slopes, and scale each adjustable number\'s step by how large its own slopes have been.',
    requires: 'A way to work out the slope of the score for every adjustable number, room to store two extra numbers for each one, and a step size, for which a rough guess is often good enough to start.',
    sensitivity: 'Moderate. Less sensitive than plain gradient descent to the learning rate and to parameters of different scales, but the learning rate still matters and the path depends on how the parameters are oriented.',
    memory: 'Three numbers per parameter: its value and its two running averages.',
    difficulty: 'moderate',
    difficultyNote: 'About ten lines of code. The care goes into the bias correction and into knowing what each setting does.',
    limits: 'It can walk past the lowest point and wobble back. It helps most when the hard directions line up with single adjustable numbers. It is not always the method that gives the best final result, and nothing guarantees that it reaches the lowest point.',
    useWhen: 'You are training a neural network, or any model whose adjustable numbers have slopes of very different sizes, and you want something that works fairly well before careful tuning.',
  },

  advanced: {
    history: 'Diederik Kingma and Jimmy Ba introduced Adam in a paper posted as a preprint in December 2014 and presented at the International Conference on Learning Representations in 2015. The name comes from adaptive moment estimation: m and v estimate the first and second moments of the gradient. The method joined two earlier lines of work. Momentum goes back to Polyak\'s heavy-ball method of 1964. Step sizes set for each parameter from its past squared gradients came with AdaGrad, published by Duchi, Hazan and Singer in 2011, which adds up all past squares, and with RMSProp, described by Tieleman and Hinton in course lectures in 2012, which uses a running average instead. Adam added momentum to RMSProp-style scaling and corrected the start-up bias of both averages. In 2018 Reddi, Kale and Kumar pointed out an error in the paper\'s convergence analysis and proposed the AMSGrad variant. Loshchilov and Hutter showed that weight decay should be applied separately from the adaptive update, which gave AdamW.',
    derivation: 'Unrolling the recursion for $m$ from $m_0 = 0$ gives\n\n$$m_t = (1 - \\beta_1)\\sum_{i=1}^{t} \\beta_1^{\\,t-i}\\, g_i.$$\n\nSuppose the gradients $g_i$ are random with a common expected value $\\mathbb{E}[g]$. Then\n\n$$\\mathbb{E}[m_t] = \\mathbb{E}[g]\\,(1 - \\beta_1)\\sum_{i=1}^{t}\\beta_1^{\\,t-i} = \\mathbb{E}[g]\\,(1 - \\beta_1^{\\,t}).$$\n\nSo $m_t$ underestimates the mean gradient by the factor $(1 - \\beta_1^{\\,t})$, and $\\hat m_t = m_t / (1 - \\beta_1^{\\,t})$ removes the bias. The same argument applied to $g_i^2$ gives $\\hat v_t = v_t / (1 - \\beta_2^{\\,t})$. The complete update, with every operation taken element by element, is\n\n$$m_t = \\beta_1 m_{t-1} + (1 - \\beta_1)\\,g_t, \\qquad v_t = \\beta_2 v_{t-1} + (1 - \\beta_2)\\,g_t^2,$$\n\n$$\\hat m_t = \\frac{m_t}{1 - \\beta_1^{\\,t}}, \\qquad \\hat v_t = \\frac{v_t}{1 - \\beta_2^{\\,t}}, \\qquad \\theta_t = \\theta_{t-1} - \\alpha\\,\\frac{\\hat m_t}{\\sqrt{\\hat v_t} + \\varepsilon}.$$\n\nWith $\\beta_2 = 0.999$ the factor $1 - \\beta_2^{\\,t}$ is 0.001 at $t = 1$ and still only 0.095 at $t = 100$, which is why the correction to $v$ matters for a long time.',
    proof: '**First step.** At $t = 1$, $m_1 = (1 - \\beta_1)g_1$ and $v_1 = (1 - \\beta_2)g_1^2$, so $\\hat m_1 = g_1$ and $\\hat v_1 = g_1^2$. The step in each coordinate is $-\\alpha\\,g_1/(|g_1| + \\varepsilon)$: its size is $\\alpha$ up to a relative error of $\\varepsilon/|g_1|$, whatever the size of $g_1$.\n\n**Constant gradient.** If $g_i = c$ for all $i$, the sums above give $m_t = c\\,(1 - \\beta_1^{\\,t})$ and $v_t = c^2(1 - \\beta_2^{\\,t})$, so $\\hat m_t = c$ and $\\hat v_t = c^2$ at every step, and every step has size $\\alpha\\,|c|/(|c| + \\varepsilon)$.\n\n**Scale.** Replacing $f$ by $s f$ with $s > 0$ multiplies every $g_i$ by $s$, hence $\\hat m_t$ by $s$ and $\\sqrt{\\hat v_t}$ by $s$. Their ratio is unchanged, so apart from $\\varepsilon$ the iterates are the same. The same holds coordinate by coordinate when different coordinates are scaled by different constants.\n\n**A bound on the step.** Write $r = \\beta_1^2/\\beta_2$. By the Cauchy-Schwarz inequality,\n\n$$m_t^2 = (1 - \\beta_1)^2\\Big(\\sum_{i=1}^{t} \\frac{\\beta_1^{\\,t-i}}{\\beta_2^{\\,(t-i)/2}}\\cdot \\beta_2^{\\,(t-i)/2} g_i\\Big)^2 \\le (1 - \\beta_1)^2 \\Big(\\sum_{k=0}^{t-1} r^k\\Big)\\Big(\\sum_{i=1}^{t}\\beta_2^{\\,t-i} g_i^2\\Big) = \\frac{(1 - \\beta_1)^2}{1 - \\beta_2}\\Big(\\sum_{k=0}^{t-1} r^k\\Big)\\, v_t.$$\n\nHence\n\n$$\\frac{|\\hat m_t|}{\\sqrt{\\hat v_t}} \\le \\frac{1 - \\beta_1}{\\sqrt{1 - \\beta_2}}\\cdot\\frac{\\sqrt{1 - \\beta_2^{\\,t}}}{1 - \\beta_1^{\\,t}}\\cdot\\Big(\\sum_{k=0}^{t-1} r^k\\Big)^{1/2}.$$\n\nAt $t = 1$ the right side is exactly 1. When $\\beta_1^2 < \\beta_2$ the sum is at most $1/(1 - r)$, so the step stays bounded by a fixed multiple of $\\alpha$ for all $t$. The tests on this page check every step of several runs against this bound.',
    complexityProof: 'Take $f(\\theta) = \\tfrac{1}{2}\\sum_j \\lambda_j \\theta_j^2$, a valley aligned with the coordinates. The gradient in coordinate $j$ is $\\lambda_j\\theta_j$, which involves no other coordinate, so each coordinate evolves on its own. By the scale property, the factor $\\lambda_j$ cancels in $\\hat m/\\sqrt{\\hat v}$, so apart from $\\varepsilon$ the sequence of values of $\\theta_j$ is the same for every $\\lambda_j > 0$. The whole path is therefore independent of the condition number, and so is the number of steps needed to come within a given distance of the minimum. This is the flat series in the experiment.\n\nPlain gradient descent with rate $\\eta$ multiplies $\\theta_j$ by $(1 - \\eta\\lambda_j)$ per step. With curvatures 1 and $\\kappa$ and $\\eta = 1/\\kappa$, the steep coordinate reaches zero in one step and the gentle one is $(1 - 1/\\kappa)^k$ after $k$ steps. Starting from 1, it is first below $\\delta$ when $k > \\ln(1/\\delta)/(-\\ln(1 - 1/\\kappa))$, which is close to $\\kappa\\ln(1/\\delta)$. The experiment uses $\\delta = 0.001$ and the measured counts match this formula exactly.\n\nWhen the valley is turned by 45°, the gradient in each coordinate is $(u \\pm \\kappa v)/\\sqrt{2}$, a mixture of both directions. Scaling a coordinate no longer scales one direction of the valley, the cancellation fails, and the measured step count grows with $\\kappa$.',
    variants: [
      { name: 'AdamW', text: 'Applies weight decay directly to the parameters instead of adding it to the gradient, so the decay is not rescaled by √v̂.' },
      { name: 'AMSGrad', text: 'Divides by the largest value of v seen so far, so a parameter\'s effective step size can never grow. Proposed to repair the convergence analysis.' },
      { name: 'AdaMax', text: 'From the same paper as Adam. Replaces the average of squared gradients with a decaying maximum of their absolute values.' },
      { name: 'Nadam', text: 'Adam with Nesterov-style momentum, which looks one step ahead along the averaged direction.' },
      { name: 'RMSProp', text: 'The scaling by a running average of squared gradients, without the averaged direction and without bias correction.' },
      { name: 'AdaGrad', text: 'Divides by the square root of the sum of all past squared gradients. Step sizes only ever shrink, which suits sparse problems and can stall long runs.' },
    ],
    implementation: 'Update m, v and the parameters in place. Keep the powers β₁ᵗ and β₂ᵗ as running products, or fold the two corrections into the learning rate, to avoid recomputing powers. Libraries differ in exactly where ε is added, so the same ε does not always mean the same thing. Save m, v and t with the model when checkpointing. Pair Adam with a learning rate schedule for long training runs.',
    benchmarking: 'Give every optimizer in a comparison the same budget for tuning its learning rate, and report how the settings were chosen. Report results on held-out data as well as the training loss, and repeat over several seeds. On small test functions like the ones here, state the starting point and the stopping rule, because both change the step counts.',
    references: [
      { authors: 'D. P. Kingma and J. Ba', year: 2015, title: 'Adam: A method for stochastic optimization', venue: 'International Conference on Learning Representations (ICLR). Preprint arXiv:1412.6980, 2014' },
      { authors: 'S. J. Reddi, S. Kale and S. Kumar', year: 2018, title: 'On the convergence of Adam and beyond', venue: 'International Conference on Learning Representations (ICLR)' },
      { authors: 'J. Duchi, E. Hazan and Y. Singer', year: 2011, title: 'Adaptive subgradient methods for online learning and stochastic optimization', venue: 'Journal of Machine Learning Research 12, 2121-2159' },
      { authors: 'I. Loshchilov and F. Hutter', year: 2019, title: 'Decoupled weight decay regularization', venue: 'International Conference on Learning Representations (ICLR)' },
      { authors: 'I. Goodfellow, Y. Bengio and A. Courville', year: 2016, title: 'Deep Learning', venue: 'MIT Press' },
    ],
    furtherReading: [
      'I. Goodfellow, Y. Bengio and A. Courville, *Deep Learning*, section 8.5, "Algorithms with Adaptive Learning Rates".',
      'A. C. Wilson, R. Roelofs, M. Stern, N. Srebro and B. Recht, "The marginal value of adaptive gradient methods in machine learning", *Advances in Neural Information Processing Systems* 30 (2017), for cases where adaptive methods did worse on new data than stochastic gradient descent.',
      'A. Vaswani and co-authors, "Attention is all you need", *Advances in Neural Information Processing Systems* 30 (2017), section 5.3, for the Adam settings and warm-up schedule used to train the Transformer.',
    ],
  },

  tests: [
    { name: 'the first step moves each coordinate by the learning rate, whatever its slope', input: { ...DEFAULTS, show: 'adam' },
      check: (r) => {
        const [x0, y0] = r.path[0], [x1, y1] = r.path[1];
        return (near(x0, -2, 1e-12) && near(y0, 0.2, 1e-12) && near(x1 - x0, 0.1, 1e-8) && near(y1 - y0, -0.1, 1e-8)) || `first step (${x1 - x0}, ${y1 - y0}) from (${x0}, ${y0})`;
      } },
    { name: 'the first step is the learning rate on a different surface and with a different rate', input: { ...DEFAULTS, show: 'adam', landscape: 'himmelblau', rate: 0.03, startX: 0.5, startY: -0.2 },
      check: (r) => {
        const dx = r.path[1][0] - r.path[0][0], dy = r.path[1][1] - r.path[0][1], g = r.trace[0].g;
        return (Math.abs(g[0]) > 1 && Math.abs(g[1]) > 1 && Math.abs(g[0] / g[1]) > 10 && near(dx, -0.03 * Math.sign(g[0]), 1e-8) && near(dy, -0.03 * Math.sign(g[1]), 1e-8)) || `step (${dx}, ${dy}) for gradient (${g})`;
      } },
    { name: 'the first three updates match the formulas written out without running averages', input: { ...DEFAULTS, show: 'adam' },
      check: (r) => {
        const a = 0.1, b1 = 0.9, b2 = 0.999, e = 1e-8;
        const grad = (p) => [p[0], 100 * p[1]];
        const p0 = r.path[0];
        const g1 = grad(p0);
        const p1 = [0, 1].map((i) => p0[i] - a * g1[i] / (Math.abs(g1[i]) + e));
        const g2 = grad(p1);
        const p2 = [0, 1].map((i) => {
          const mh = (b1 * (1 - b1) * g1[i] + (1 - b1) * g2[i]) / (1 - b1 * b1);
          const vh = (b2 * (1 - b2) * g1[i] * g1[i] + (1 - b2) * g2[i] * g2[i]) / (1 - b2 * b2);
          return p1[i] - a * mh / (Math.sqrt(vh) + e);
        });
        const g3 = grad(p2);
        const p3 = [0, 1].map((i) => {
          const mh = (1 - b1) * (b1 * b1 * g1[i] + b1 * g2[i] + g3[i]) / (1 - pow(b1, 3));
          const vh = (1 - b2) * (b2 * b2 * g1[i] * g1[i] + b2 * g2[i] * g2[i] + g3[i] * g3[i]) / (1 - pow(b2, 3));
          return p2[i] - a * mh / (Math.sqrt(vh) + e);
        });
        const ok = [p1, p2, p3].every((p, k) => near(p[0], r.path[k + 1][0], 1e-12) && near(p[1], r.path[k + 1][1], 1e-12));
        return ok || `expected ${JSON.stringify([p1, p2, p3])}, got ${JSON.stringify(r.path.slice(1, 4))}`;
      } },
    { name: 'the worked example: the positions and averages quoted in the text', input: { ...DEFAULTS, show: 'adam' },
      check: (r) => {
        const s = r.trace[1];
        return (near(r.path[1][0], -1.9, 1e-8) && near(r.path[1][1], 0.1, 1e-8) && near(r.path[2][0], -1.8002, 5e-5) && near(r.path[2][1], 0.0068, 5e-5)
          && near(s.mh[0], -1.947, 5e-4) && near(s.mh[1], 14.74, 5e-3) && near(Math.sqrt(s.vh[0]), 1.951, 5e-4) && near(Math.sqrt(s.vh[1]), 15.81, 5e-3)
          && near(s.d[0], 0.0998, 5e-5) && near(s.d[1], -0.0932, 5e-5)) || `step 2: ${JSON.stringify(s)}, path ${JSON.stringify(r.path.slice(0, 3))}`;
      } },
    { name: 'without bias correction the first step is (1 − β₁) ÷ √(1 − β₂) times as long', input: { ...DEFAULTS, show: 'adam', correct: false },
      check: (r) => {
        const want = 0.1 * 0.1 / Math.sqrt(1 - 0.999);
        const dx = r.path[1][0] - r.path[0][0], dy = r.path[1][1] - r.path[0][1];
        return (near(dx, want, 1e-7) && near(dy, -want, 1e-7) && near(want / 0.1, 3.162, 1e-3)) || `first step (${dx}, ${dy}), expected ±${want}`;
      } },
    { name: 'every step respects the Cauchy-Schwarz bound on its length', input: { ...DEFAULTS, show: 'adam', steps: 300 },
      check: (r) => {
        const worst = (res, b1, b2) => {
          let w = -Infinity;
          res.trace.forEach((s, k) => { for (const d of s.d) w = Math.max(w, Math.abs(d) / 0.1 - ratioBound(b1, b2, k + 1)); });
          return w;
        };
        const other = run({ ...DEFAULTS, show: 'adam', beta1: 0.5, beta2: 0.9, steps: 300 }, quiet);
        const plain = run({ ...DEFAULTS, show: 'adam', beta1: 0, steps: 300 }, quiet);
        const w = Math.max(worst(r, 0.9, 0.999), worst(other, 0.5, 0.9), worst(plain, 0, 0.999));
        return (r.trace.length > 50 && w <= 1e-9 && near(ratioBound(0.9, 0.999, 1), 1, 1e-12)) || `a step exceeds the bound by ${w} × α`;
      } },
    { name: 'the path does not depend on how steep the valley is when it lines up with the axes', input: { ...DEFAULTS, show: 'adam' },
      check: () => {
        const path = (kappa) => run({ landscape: 'quadratic', kappa, turned: false, show: 'adam', rate: 0.1, beta1: 0.9, beta2: 0.999, correct: true, gdRate: 0.1, steps: 80 }, quiet).path;
        const ref = path(10);
        const far = (other) => Math.max(...other.map((p, i) => Math.hypot(p[0] - ref[i][0], p[1] - ref[i][1])));
        const a = far(path(1)), b = far(path(1000));
        const turned = run({ landscape: 'quadratic', kappa: 1000, turned: true, show: 'adam', rate: 0.1, beta1: 0.9, beta2: 0.999, correct: true, gdRate: 0.1, steps: 80 }, quiet).path;
        const turned10 = run({ landscape: 'quadratic', kappa: 10, turned: true, show: 'adam', rate: 0.1, beta1: 0.9, beta2: 0.999, correct: true, gdRate: 0.1, steps: 80 }, quiet).path;
        const c = Math.max(...turned.map((p, i) => Math.hypot(p[0] - turned10[i][0], p[1] - turned10[i][1])));
        return (ref.length === 81 && a < 1e-6 && b < 1e-6 && c > 0.01) || `aligned paths differ by ${a} at κ = 1 and ${b} at κ = 1000; turned paths differ by ${c}`;
      } },
    { name: 'momentum: less of it stops sooner on the ravine, none of it fails on the turned ravine', input: { ...DEFAULTS, show: 'adam', beta1: 0, steps: 300 },
      check: (r) => {
        const go = (extra) => run({ ...DEFAULTS, show: 'adam', steps: 300, ...extra }, quiet);
        const t = { landscape: 'ravine-turned', startX: -0.4, startY: -0.5 };
        const half = go({ beta1: 0.5 }), full = go({}), t0 = go({ ...t, beta1: 0 }), t5 = go({ ...t, beta1: 0.5 }), t9 = go({ ...t });
        const leap = Math.max(...r.path.slice(55, 63).map((p) => Math.abs(p[1]))), calm = Math.max(...r.path.slice(20, 50).map((p) => Math.abs(p[1])));
        return (r.steps === 85 && half.steps === 64 && full.steps === 131 && [r, half, full].every((o) => o.status === 'converged')
          && t0.status === 'budget' && t5.status === 'converged' && t5.steps === 151 && t9.status === 'converged' && t9.steps === 177
          && near(leap, 0.27, 0.01) && calm < 1e-3)
          || `ravine steps ${r.steps}, ${half.steps}, ${full.steps}; turned ${t0.status}, ${t5.steps}, ${t9.steps}; leap ${leap}, calm ${calm}`;
      } },
    { name: 'plain gradient descent mode takes the textbook step', input: { ...DEFAULTS, show: 'gd', steps: 40 },
      check: (r) => {
        for (let k = 0; k < 40; k++) {
          const [x, y] = r.path[k];
          if (!near(r.path[k + 1][0], x - 0.019 * x, 1e-13) || !near(r.path[k + 1][1], y - 0.019 * 100 * y, 1e-13)) return `step ${k + 1} is not a gradient step`;
        }
        return (r.method === 'gd' && r.trace.length === 0) || 'wrong mode';
      } },
    { name: 'on the steep ravine Adam ends lower than plain descent, and plain descent diverges above 0.02', input: { ...DEFAULTS },
      check: (r) => {
        const hot = run({ ...DEFAULTS, gdRate: 0.0205, steps: 300 }, quiet);
        return (r.bestValue < 0.01 && r.gd.bestValue > 0.1 && r.gd.path.every((p, i) => i === 0 || Math.abs(p[0]) < Math.abs(r.gd.path[i - 1][0])) && hot.gd.bestValue > 1e3)
          || `Adam ${r.bestValue}, plain ${r.gd.bestValue}, plain at 0.0205 ${hot.gd.bestValue}`;
      } },
    { name: 'Adam stops at the minimum of the ravine, and takes longer on the turned ravine', input: { ...DEFAULTS, steps: 300 },
      check: (r) => {
        const turned = run({ ...DEFAULTS, landscape: 'ravine-turned', startX: -0.4, startY: -0.5, steps: 300 }, quiet);
        let behind = 0;
        for (let k = 1; k < turned.losses.length; k++) if (turned.losses[k] >= turned.gd.losses[k]) behind = k;
        const ahead = r.losses.every((v, k) => k === 0 || v < r.gd.losses[k]);
        return (r.status === 'converged' && r.steps === 131 && r.distance < 1e-3 && turned.status === 'converged' && turned.steps === 177 && turned.distance < 1e-3 && behind === 45 && ahead)
          || `ravine: ${r.status} after ${r.steps}; turned: ${turned.status} after ${turned.steps}, plain descent last ahead at step ${behind}`;
      } },
    { name: 'on the round bowl and the mild valley a single well chosen rate settles first', input: { ...DEFAULTS, landscape: 'bowl', gdRate: 0.4, startX: -0.85, startY: 0.7 },
      check: (r) => {
        const valley = run({ ...DEFAULTS, landscape: 'valley', gdRate: 0.15, startX: -0.85, startY: 0.7, steps: 100 }, quiet);
        return (r.gd.status === 'converged' && r.gd.steps < 10 && r.status === 'budget' && valley.gd.status === 'converged' && valley.status === 'budget' && valley.gd.bestValue < valley.bestValue)
          || `bowl: plain ${r.gd.status} after ${r.gd.steps}, Adam ${r.status}; valley: plain ${valley.gd.status}, Adam ${valley.status}`;
      } },
    { name: 'on the rippled surface both methods stop in the same local minimum', input: { ...DEFAULTS, landscape: 'rastrigin', gdRate: 0.002, startX: -0.85, startY: 0.7, steps: 300 },
      check: (r) => (near(r.x, r.gd.x, 0.02) && near(r.y, r.gd.y, 0.02) && r.bestValue > 10 && r.gd.bestValue > 10) || `Adam (${r.x}, ${r.y}) loss ${r.bestValue}; plain (${r.gd.x}, ${r.gd.y}) loss ${r.gd.bestValue}` },
  ],
};
