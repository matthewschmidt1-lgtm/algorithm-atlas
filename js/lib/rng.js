// Small seeded PRNG (mulberry32) so every randomized demonstration is reproducible from its seed.

export function makeRng(seed = 1) {
  let a = (Math.floor(seed) >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /** uniform float in [lo, hi) */
    float: (lo = 0, hi = 1) => lo + (hi - lo) * next(),
    /** uniform integer in [lo, hi] inclusive */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** standard normal via Box-Muller, scaled */
    normal: (mu = 0, sigma = 1) => {
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** in-place Fisher-Yates shuffle; returns the array */
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
  return rng;
}
