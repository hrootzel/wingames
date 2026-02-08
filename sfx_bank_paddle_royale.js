export const BANK_PADDLEROYALE = {
  serve: (sfx, p = {}) => {
    const balls = Math.max(1, p.balls ?? 1);
    const base = 460 + (balls - 1) * 36;
    sfx.arp({ base, ratios: [1, 6 / 5, 3 / 2], stepMs: 24, type: 'square', volume: 0.06, duration: 0.035 });
  },

  stageStart: (sfx, p = {}) => {
    const stage = Math.max(1, p.stage ?? 1);
    const base = 294 * Math.pow(2, ((stage - 1) % 6) / 24);
    sfx.arp({ base, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 56, type: 'square', volume: 0.08, duration: 0.06 });
    sfx.tone({ freq: base * 0.5, type: 'triangle', duration: 0.18, volume: 0.05, delay: 0.02 });
  },

  paddleHit: (sfx) => {
    sfx.tone({ freq: 230, type: 'square', duty: 0.46, duration: 0.032, volume: 0.06 });
    sfx.tone({ freq: 115, type: 'triangle', duration: 0.06, volume: 0.04, delay: 0.004 });
  },

  wallHit: (sfx) => {
    sfx.tone({ freq: 175, type: 'square', duty: 0.22, duration: 0.024, volume: 0.04 });
    sfx.noise({ duration: 0.022, volume: 0.013, tint: 0.45 });
  },

  brickHit: (sfx, p = {}) => {
    const row = p.row ?? 0;
    const streak = Math.max(1, p.streak ?? 1);
    const isSilver = p.type === 'silver';

    const base = (isSilver ? 520 : 420) + row * 28 + Math.min(9, streak) * 9;
    const vol = isSilver ? 0.065 : 0.075;

    sfx.tone({ freq: base, type: isSilver ? 'triangle' : 'square', duty: 0.26, duration: 0.04, volume: vol, jitter: 4 });
    sfx.tone({ freq: base * 1.5, type: 'square', duty: 0.18, duration: 0.03, volume: 0.03, delay: 0.008, jitter: 8 });
    sfx.noise({ duration: 0.02, volume: isSilver ? 0.012 : 0.009, tint: isSilver ? 0.78 : 0.52, delay: 0.002 });
  },

  silverHit: (sfx, p = {}) => {
    const hp = Math.max(0, p.hp ?? 1);
    const freq = 760 - hp * 18;
    sfx.tone({ freq, type: 'triangle', duration: 0.07, volume: 0.045, jitter: 10 });
    sfx.tone({ freq: freq * 1.88, type: 'square', duty: 0.14, duration: 0.05, volume: 0.022, delay: 0.004 });
  },

  goldHit: (sfx) => {
    sfx.tone({ freq: 910, type: 'triangle', duration: 0.06, volume: 0.045 });
    sfx.tone({ freq: 1320, type: 'square', duty: 0.1, duration: 0.05, volume: 0.028, delay: 0.006 });
    sfx.noise({ duration: 0.03, volume: 0.012, tint: 0.86, delay: 0.002 });
  },

  brickBreak: (sfx, p = {}) => {
    const row = p.row ?? 0;
    const streak = Math.max(1, p.streak ?? 1);
    const base = 280 + row * 24 + Math.min(8, streak) * 6;
    sfx.tone({ freq: base, type: 'triangle', duration: 0.05, volume: 0.035 });
    sfx.noise({ duration: 0.04, volume: 0.02, tint: 0.35, delay: 0.002 });
  },

  capsuleDrop: (sfx, p = {}) => {
    const code = String(p.type ?? 'E');
    const idx = 'ESC DLBP'.replace(/\s/g, '').indexOf(code);
    const start = 520 + Math.max(0, idx) * 24;
    sfx.tone({ freq: start, type: 'square', duty: 0.2, duration: 0.09, volume: 0.03, slideTo: start * 0.72, slideMs: 0.09 });
  },

  capsuleCatch: (sfx, p = {}) => {
    const code = String(p.type ?? 'E');
    const offset = Math.max(0, 'ESCDLBP'.indexOf(code));
    const base = 420 + offset * 18;
    sfx.arp({ base, ratios: [1, 5 / 4, 3 / 2], stepMs: 32, type: 'square', volume: 0.06, duration: 0.045 });
  },

  capsuleExpand: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.18, volume: 0.05, slideTo: 330, slideMs: 0.18 });
  },

  capsuleSlow: (sfx) => {
    sfx.tone({ freq: 420, type: 'square', duty: 0.32, duration: 0.12, volume: 0.045, slideTo: 260, slideMs: 0.12 });
  },

  capsuleCatchMode: (sfx) => {
    sfx.chord({ freqs: [330, 392], duration: 0.09, type: 'triangle', volume: 0.042, spreadCents: 2 });
  },

  capsuleLaser: (sfx) => {
    sfx.tone({ freq: 640, type: 'square', duty: 0.16, duration: 0.08, volume: 0.05, slideTo: 880, slideMs: 0.08 });
  },

  capsuleBreak: (sfx) => {
    sfx.arp({ base: 370, ratios: [1, 6 / 5, 3 / 2, 2], stepMs: 28, type: 'square', volume: 0.06, duration: 0.04 });
    sfx.noise({ duration: 0.05, volume: 0.018, tint: 0.5, delay: 0.015 });
  },

  extraLife: (sfx) => {
    sfx.arp({ base: 523, ratios: [1, 5 / 4, 3 / 2, 2, 5 / 2], stepMs: 48, type: 'square', volume: 0.085, duration: 0.06 });
    sfx.tone({ freq: 262, type: 'triangle', duration: 0.26, volume: 0.06, delay: 0.02 });
  },

  multiball: (sfx) => {
    sfx.arp({ base: 392, ratios: [1, 6 / 5, 3 / 2, 9 / 5, 2], stepMs: 26, type: 'square', volume: 0.06, duration: 0.04 });
    sfx.noise({ duration: 0.03, volume: 0.016, tint: 0.62, delay: 0.01 });
  },

  laserFire: (sfx) => {
    sfx.tone({ freq: 1180, type: 'square', duty: 0.1, duration: 0.028, volume: 0.042, slideTo: 740, slideMs: 0.028 });
    sfx.noise({ duration: 0.016, volume: 0.01, tint: 0.88 });
  },

  laserHit: (sfx, p = {}) => {
    const row = p.row ?? 0;
    const f = 760 + row * 18;
    sfx.tone({ freq: f, type: 'triangle', duration: 0.036, volume: 0.03, jitter: 16 });
    sfx.noise({ duration: 0.022, volume: 0.012, tint: 0.8, delay: 0.002 });
  },

  lifeLost: (sfx, p = {}) => {
    const lives = Math.max(0, p.lives ?? 0);
    const base = lives <= 1 ? 185 : 205;
    sfx.tone({ freq: base, type: 'triangle', duration: 0.28, volume: 0.11, slideTo: base * 0.52, slideMs: 0.28 });
    sfx.noise({ duration: 0.11, volume: 0.04, tint: 0.12, delay: 0.08 });
  },

  continue: (sfx) => {
    sfx.arp({ base: 262, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 52, type: 'square', volume: 0.06, duration: 0.05 });
  },

  levelComplete: (sfx) => {
    sfx.arp({ base: 392, ratios: [1, 5 / 4, 3 / 2, 2], stepMs: 60, type: 'square', volume: 0.1, duration: 0.06 });
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.2, volume: 0.07, delay: 0.02 });
  },

  gameWin: (sfx) => {
    sfx.arp({ base: 523, ratios: [1, 5 / 4, 3 / 2, 2, 5 / 2], stepMs: 55, type: 'square', volume: 0.095, duration: 0.06 });
    sfx.chord({ freqs: [262, 330, 392], duration: 0.28, type: 'triangle', volume: 0.055, delay: 0.03 });
  },

  pause: (sfx) => {
    sfx.tone({ freq: 310, type: 'square', duty: 0.38, duration: 0.035, volume: 0.032 });
  },

  resume: (sfx) => {
    sfx.tone({ freq: 370, type: 'square', duty: 0.38, duration: 0.035, volume: 0.032 });
  },

  gameOver: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.4, volume: 0.12, slideTo: 110, slideMs: 0.4 });
    sfx.tone({ freq: 165, type: 'square', duty: 0.5, duration: 0.32, volume: 0.08, delay: 0.06, slideTo: 82, slideMs: 0.32 });
    sfx.noise({ duration: 0.2, volume: 0.05, tint: 0.1, delay: 0.12 });
  },
};
