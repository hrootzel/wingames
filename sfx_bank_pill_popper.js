export const BANK_PILLPOPPER = {
  move: (sfx) => {
    sfx.tone({ freq: 520, type: 'square', duty: 0.5, duration: 0.028, volume: 0.06, jitter: 1 });
  },
  rotate: (sfx) => {
    sfx.tone({ freq: 780, type: 'square', duty: 0.25, duration: 0.03, volume: 0.07, jitter: 1 });
  },
  lock: (sfx) => {
    sfx.tone({ freq: 110, type: 'triangle', duration: 0.08, volume: 0.12, slideTo: 82, slideMs: 0.08 });
    sfx.tone({ freq: 320, type: 'square', duty: 0.125, duration: 0.03, volume: 0.05, delay: 0.01 });
    sfx.noise({ duration: 0.035, volume: 0.04, tint: 0.2, delay: 0.0 });
  },
  settle: (sfx) => {
    sfx.tone({ freq: 260, type: 'square', duty: 0.5, duration: 0.025, volume: 0.045, jitter: 0 });
  },
  hardDrop: (sfx) => {
    sfx.tone({ freq: 92, type: 'triangle', duration: 0.08, volume: 0.12 });
    sfx.tone({ freq: 220, type: 'square', duty: 0.5, duration: 0.04, volume: 0.06, delay: 0.01 });
    sfx.noise({ duration: 0.04, volume: 0.05, tint: 0.15, delay: 0.0 });
  },
  clearPill: (sfx) => {
    sfx.tone({ freq: 880, type: 'square', duty: 0.25, duration: 0.05, volume: 0.08, jitter: 0 });
    sfx.tone({ freq: 440, type: 'triangle', duration: 0.06, volume: 0.05, delay: 0.0 });
  },
  clearVirus: (sfx, p) => {
    const v = Math.max(1, p.viruses ?? 1);
    const base = 740 + (v - 1) * 80;
    sfx.tone({ freq: base, type: 'square', duty: 0.125, duration: 0.07, volume: 0.1, slideTo: base * 0.75, slideMs: 0.07 });
    sfx.noise({ duration: 0.05, volume: 0.045, tint: 0.15, delay: 0.0 });
  },
  chain: (sfx, p) => {
    const ch = Math.max(2, p.chain ?? 2);
    const base = 440 * Math.pow(1.07, Math.min(10, ch));
    sfx.arp({ base, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 38, type: 'square', volume: 0.08, duration: 0.05 });
  },
  speedUp: (sfx) => {
    sfx.tone({ freq: 980, type: 'square', duty: 0.25, duration: 0.04, volume: 0.07, jitter: 0 });
  },
  stageStart: (sfx) => {
    sfx.arp({ base: 330, ratios: [1, 5 / 4, 3 / 2], stepMs: 55, type: 'square', volume: 0.08, duration: 0.06 });
  },
  stageClear: (sfx) => {
    sfx.arp({ base: 392, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 65, type: 'square', volume: 0.1, duration: 0.07 });
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.22, volume: 0.07, delay: 0.02 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.4, volume: 0.11, slideTo: 98, slideMs: 0.4 });
    sfx.tone({ freq: 146, type: 'square', duty: 0.5, duration: 0.32, volume: 0.07, delay: 0.06, slideTo: 73, slideMs: 0.32 });
    sfx.noise({ duration: 0.2, volume: 0.05, tint: 0.1, delay: 0.12 });
  },
};
