export const BANK_MYRIAPOD = {
  shoot: (sfx) => {
    sfx.tone({ freq: 880, type: 'square', duty: 0.125, duration: 0.04, volume: 0.08 });
  },
  centipedeMove: (sfx) => {
    sfx.tone({ freq: 110, type: 'triangle', duration: 0.06, volume: 0.06 });
  },
  explosion: (sfx) => {
    sfx.noise({ duration: 0.12, volume: 0.09, tint: 0.15 });
    sfx.tone({ freq: 180, type: 'triangle', duration: 0.1, volume: 0.06, slideTo: 60, slideMs: 0.1 });
  },
  playerDeath: (sfx) => {
    sfx.tone({ freq: 440, type: 'triangle', duration: 0.3, volume: 0.12, slideTo: 110, slideMs: 0.3 });
    sfx.noise({ duration: 0.2, volume: 0.08, tint: 0.12, delay: 0.05 });
  },
  spider: (sfx) => {
    sfx.tone({ freq: 330, type: 'square', duty: 0.25, duration: 0.08, volume: 0.07, jitter: 3 });
  },
  flea: (sfx) => {
    sfx.tone({ freq: 660, type: 'square', duty: 0.5, duration: 0.05, volume: 0.06, slideTo: 440, slideMs: 0.05 });
  },
  scorpion: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.1, volume: 0.07, jitter: 2 });
  },
  bonusLife: (sfx) => {
    sfx.arp({ base: 523, ratios: [1, 5/4, 3/2, 2], stepMs: 70, type: 'square', volume: 0.1, duration: 0.08 });
  },
  waveComplete: (sfx) => {
    sfx.arp({ base: 392, ratios: [1, 5/4, 3/2], stepMs: 60, type: 'square', volume: 0.09, duration: 0.07 });
  },
};
