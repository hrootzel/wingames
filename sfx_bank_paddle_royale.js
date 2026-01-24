export const BANK_PADDLEROYALE = {
  paddleHit: (sfx) => {
    sfx.tone({ freq: 220, type: 'square', duty: 0.5, duration: 0.04, volume: 0.08 });
  },
  wallHit: (sfx) => {
    sfx.tone({ freq: 180, type: 'square', duty: 0.25, duration: 0.03, volume: 0.06 });
  },
  brickHit: (sfx, p) => {
    const row = p.row ?? 0;
    const base = 440 + row * 40;
    sfx.tone({ freq: base, type: 'square', duty: 0.25, duration: 0.05, volume: 0.09 });
    sfx.tone({ freq: base * 0.5, type: 'triangle', duration: 0.06, volume: 0.04, delay: 0.01 });
  },
  powerup: (sfx) => {
    sfx.arp({ base: 523, ratios: [1, 5/4, 3/2], stepMs: 40, type: 'square', volume: 0.08, duration: 0.05 });
  },
  lose: (sfx) => {
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.25, volume: 0.11, slideTo: 98, slideMs: 0.25 });
    sfx.noise({ duration: 0.12, volume: 0.04, tint: 0.1, delay: 0.08 });
  },
  levelComplete: (sfx) => {
    sfx.arp({ base: 392, ratios: [1, 5/4, 3/2, 2], stepMs: 60, type: 'square', volume: 0.1, duration: 0.06 });
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.2, volume: 0.07, delay: 0.02 });
  },
  gameOver: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.4, volume: 0.12, slideTo: 110, slideMs: 0.4 });
    sfx.tone({ freq: 165, type: 'square', duty: 0.5, duration: 0.32, volume: 0.08, delay: 0.06, slideTo: 82, slideMs: 0.32 });
    sfx.noise({ duration: 0.2, volume: 0.05, tint: 0.1, delay: 0.12 });
  },
};
