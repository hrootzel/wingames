export const BANK_PRISMPULSE = {
  move: (sfx) => {
    sfx.tone({ freq: 510, type: 'square', duty: 0.5, duration: 0.024, volume: 0.05, jitter: 2 });
  },
  rotate: (sfx) => {
    sfx.tone({ freq: 760, type: 'square', duty: 0.25, duration: 0.03, volume: 0.07, jitter: 2 });
  },
  lock: (sfx) => {
    sfx.tone({ freq: 120, type: 'triangle', duration: 0.07, volume: 0.1, slideTo: 90, slideMs: 0.07 });
    sfx.noise({ duration: 0.03, volume: 0.03, tint: 0.2, delay: 0.0 });
  },
  clearTick: (sfx, p) => {
    const n = Math.max(1, p.squares ?? 1);
    const base = 620 + Math.min(220, n * 28);
    sfx.tone({ freq: base, type: 'square', duty: 0.25, duration: 0.045, volume: 0.075 });
    sfx.tone({ freq: base * 0.5, type: 'triangle', duration: 0.06, volume: 0.04, delay: 0.005 });
  },
  combo: (sfx, p) => {
    const combo = Math.max(2, p.combo ?? 2);
    const base = 350 * Math.pow(1.07, Math.min(10, combo));
    sfx.arp({ base, ratios: [1, 5 / 4, 3 / 2], stepMs: 34, type: 'square', volume: 0.08, duration: 0.04 });
  },
  sweepClear: (sfx, p) => {
    const n = Math.max(1, p.squares ?? 1);
    const base = 680 + Math.min(240, n * 35);
    sfx.tone({ freq: base, type: 'square', duty: 0.125, duration: 0.06, volume: 0.08, slideTo: base * 0.78, slideMs: 0.06 });
    sfx.tone({ freq: base * 0.5, type: 'triangle', duration: 0.08, volume: 0.045, delay: 0.0 });
  },
  megaSweep: (sfx) => {
    sfx.arp({ base: 420, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 36, type: 'square', volume: 0.085, duration: 0.045 });
  },
  levelUp: (sfx) => {
    sfx.arp({ base: 370, ratios: [1, 5 / 4, 3 / 2], stepMs: 52, type: 'square', volume: 0.08, duration: 0.06 });
  },
  pause: (sfx) => {
    sfx.tone({ freq: 360, type: 'square', duty: 0.5, duration: 0.04, volume: 0.06 });
  },
  resume: (sfx) => {
    sfx.tone({ freq: 520, type: 'square', duty: 0.5, duration: 0.04, volume: 0.06 });
  },
  start: (sfx) => {
    sfx.arp({ base: 300, ratios: [1, 5 / 4, 3 / 2], stepMs: 45, type: 'square', volume: 0.07, duration: 0.05 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 210, type: 'triangle', duration: 0.34, volume: 0.1, slideTo: 110, slideMs: 0.34 });
    sfx.noise({ duration: 0.14, volume: 0.04, tint: 0.1, delay: 0.1 });
  },
};
