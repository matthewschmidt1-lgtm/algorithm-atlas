// How a measured series is compared with the formula a lesson states for it.
//
// A lesson's experiment declares formulas (viz.experiment.theory). The content pipeline
// runs the lesson's real implementation at every size, counts the operations, and asks
// this module how the counts relate to each formula. The answer is stored with the lesson
// and shown to readers, so a stated cost is never just asserted.
//
// The relations, from strongest to weakest:
//   exact    every measured count equals the formula
//   close    every count in the larger half of the sizes is within 15% of the formula
//   growth   counts and formula grow at the same rate (their ratio is steady at the larger sizes)
//   upper    counts never exceed the formula (the formula is an upper limit)
//   lower    counts never fall below the formula (the formula is a lower limit)
//   average  the formula is an expected value over random inputs: single runs scatter around it,
//            and their average ratio to it is within 20% (only for formulas marked expected: true)
//   differs  none of the above: the claim and the implementation disagree
//
// A formula marked reference: true is drawn for scale only. It is not a claim about the
// implementation and is not checked.

export const RELATION_TEXT = {
  exact: 'matches the formula exactly',
  close: 'stays within 15% of the formula',
  growth: 'grows at the same rate as the formula',
  upper: 'never exceeds the formula, which is an upper limit',
  lower: 'never falls below the formula, which is a lower limit',
  average: 'scatters around the formula, which is an average over random inputs',
  differs: 'does not match the formula',
};
export const RELATION_SHORT = { exact: 'Exact match', close: 'Within 15%', growth: 'Same growth rate', upper: 'Within the stated limit', lower: 'Above the stated limit', average: 'Matches on average', differs: 'Mismatch' };

// points: [[size, measured]], fn: size -> predicted count
export function compareToFormula(points, fn, { scaled = false, expected = false } = {}) {
  const rows = points
    .map(([n, m]) => ({ n, m, f: fn(n) }))
    .filter((r) => Number.isFinite(r.m) && Number.isFinite(r.f));
  if (rows.length < 2) return { relation: 'differs', detail: 'too few measured points', rows };
  const upper = rows.slice(Math.floor(rows.length / 2));
  const relErr = (r) => Math.abs(r.m - r.f) / Math.max(Math.abs(r.f), 1e-12);
  const ratios = upper.filter((r) => r.f > 0 && r.m > 0).map((r) => r.m / r.f);
  const spread = ratios.length >= 2 ? Math.max(...ratios) / Math.min(...ratios) : Infinity;
  const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

  if (!scaled) {
    if (rows.every((r) => Math.abs(r.m - r.f) <= Math.max(0.5, 0.002 * Math.abs(r.f)))) return { relation: 'exact', detail: `all ${rows.length} sizes agree`, rows };
    const worst = Math.max(...upper.map(relErr));
    if (worst <= 0.15) return { relation: 'close', detail: `largest gap ${pct(worst)} at the larger sizes`, rows };
    if (rows.every((r) => r.m <= r.f * (1 + 1e-9) + 1e-9)) return { relation: 'upper', detail: `reaches at most ${pct(Math.max(...rows.map((r) => r.m / (r.f || 1))))} of the limit`, rows };
    if (rows.every((r) => r.m >= r.f * (1 - 1e-9) - 1e-9)) return { relation: 'lower', detail: `at least ${pct(Math.min(...rows.map((r) => r.m / (r.f || 1))))} of the limit`, rows };
  }
  if (expected) {
    const all = rows.filter((r) => r.f > 0 && r.m > 0).map((r) => r.m / r.f);
    const mean = Math.exp(all.reduce((a, x) => a + Math.log(x), 0) / (all.length || 1));
    if (all.length >= 3 && mean >= 0.8 && mean <= 1.25) return { relation: 'average', detail: `single runs range from ${pct(Math.min(...all))} to ${pct(Math.max(...all))} of the formula and average ${pct(mean)}`, rows };
  }
  if (spread <= 1.3) return { relation: 'growth', detail: `ratio to the formula varies by ${pct(spread - 1)} across the larger sizes`, rows };
  return { relation: 'differs', detail: Number.isFinite(spread) ? `ratio to the formula drifts by ${pct(spread - 1)}` : 'no comparable points', rows };
}
