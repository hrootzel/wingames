export const BANK_SNAKE = {
  move: (sfx) => {
    sfx.tone({ freq: 180, type: 'square', duty: 0.5, duration: 0.02, volume: 0.03 });
  },
  eat: (sfx) => {
    sfx.tone({ freq: 520, type: 'square', duty: 0.25, duration: 0.06, volume: 0.1 });
    sfx.tone({ freq: 780, type: 'triangle', duration: 0.08, volume: 0.06, delay: 0.02 });
  },
  die: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.3, volume: 0.12, slideTo: 80, slideMs: 0.3 });
    sfx.noise({ duration: 0.15, volume: 0.06, tint: 0.1, delay: 0.05 });
  },
  levelUp: (sfx) => {
    sfx.arp({ base: 440, ratios: [1, 5/4, 3/2], stepMs: 50, type: 'square', volume: 0.09, duration: 0.05 });
  },
};
