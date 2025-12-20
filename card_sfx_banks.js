// Card game sound banks for SfxEngine.
// Exports: BANK_KLONDIKE, BANK_SPIDER, BANK_BLACKJACK, BANK_VIDEO_POKER

const RAT = {
  m3: 6 / 5,
  M3: 5 / 4,
  P5: 3 / 2,
  P4: 4 / 3,
  OCT: 2,
};

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export const BANK_KLONDIKE = {
  click: (sfx) => {
    sfx.tone({ freq: 820, type: 'square', duty: 0.25, duration: 0.018, volume: 0.06, jitter: 6 });
  },
  pickup: (sfx) => {
    sfx.tone({ freq: 520, type: 'square', duty: 0.5, duration: 0.022, volume: 0.07, jitter: 6 });
  },
  place: (sfx) => {
    sfx.tone({ freq: 430, type: 'triangle', duration: 0.03, volume: 0.08 });
    sfx.noise({ duration: 0.02, volume: 0.03, tint: 0.65, delay: 0.0 });
  },
  flip: (sfx) => {
    sfx.noise({ duration: 0.05, volume: 0.05, tint: 0.25 });
    sfx.tone({ freq: 980, type: 'square', duty: 0.125, duration: 0.02, volume: 0.06, delay: 0.015, jitter: 10 });
  },
  deal: (sfx) => {
    sfx.tone({ freq: 760, type: 'square', duty: 0.25, duration: 0.016, volume: 0.06, jitter: 8 });
    sfx.tone({ freq: 680, type: 'square', duty: 0.25, duration: 0.016, volume: 0.05, delay: 0.035, jitter: 8 });
  },
  foundation: (sfx) => {
    sfx.arp({ base: 520, ratios: [1, RAT.M3, RAT.P5], stepMs: 32, type: 'triangle', volume: 0.07, duration: 0.04 });
  },
  invalid: (sfx) => {
    sfx.tone({ freq: 220, type: 'sawtooth', duration: 0.1, volume: 0.07, slideTo: 140, slideMs: 0.1 });
  },
  undo: (sfx) => {
    sfx.arp({ base: 520, ratios: [RAT.P5, RAT.M3, 1], stepMs: 30, type: 'triangle', volume: 0.06, duration: 0.04 });
  },
  win: (sfx) => {
    sfx.arp({ base: 392, ratios: [1, RAT.M3, RAT.P5, RAT.OCT], stepMs: 55, type: 'square', volume: 0.08, duration: 0.06 });
    sfx.chord({ freqs: [392, 392 * RAT.P5, 392 * RAT.OCT], duration: 0.18, type: 'triangle', volume: 0.05, delay: 0.22 });
  },
};

export const BANK_SPIDER = {
  pickup: (sfx) => {
    sfx.tone({ freq: 560, type: 'square', duty: 0.25, duration: 0.02, volume: 0.075, jitter: 7 });
  },
  place: (sfx) => {
    sfx.tone({ freq: 460, type: 'triangle', duration: 0.03, volume: 0.085 });
    sfx.noise({ duration: 0.022, volume: 0.035, tint: 0.6 });
  },
  flip: (sfx) => {
    sfx.noise({ duration: 0.055, volume: 0.05, tint: 0.25 });
    sfx.tone({ freq: 1040, type: 'square', duty: 0.125, duration: 0.018, volume: 0.06, delay: 0.012, jitter: 10 });
  },
  dealRow: (sfx, p = {}) => {
    const n = Math.max(1, p.count ?? 10);
    for (let i = 0; i < n; i++) {
      sfx.tone({
        freq: 740 - i * 16,
        type: 'square',
        duty: 0.25,
        duration: 0.014,
        volume: 0.05,
        delay: i * 0.018,
        jitter: 6,
      });
    }
    sfx.noise({ duration: 0.14, volume: 0.03, tint: 0.18, delay: 0.0 });
  },
  invalid: (sfx) => {
    sfx.tone({ freq: 200, type: 'sawtooth', duration: 0.11, volume: 0.075, slideTo: 125, slideMs: 0.11 });
  },
  undo: (sfx) => {
    sfx.arp({ base: 520, ratios: [RAT.P5, RAT.M3, 1], stepMs: 28, type: 'triangle', volume: 0.06, duration: 0.038 });
  },
  stackComplete: (sfx) => {
    sfx.arp({ base: 440, ratios: [1, RAT.M3, RAT.P5, RAT.OCT], stepMs: 45, type: 'triangle', volume: 0.09, duration: 0.055 });
    sfx.tone({ freq: 880, type: 'square', duty: 0.25, duration: 0.1, volume: 0.05, delay: 0.2, slideTo: 660, slideMs: 0.1 });
  },
  win: (sfx) => {
    sfx.arp({ base: 392, ratios: [1, RAT.M3, RAT.P5, RAT.OCT, RAT.P5], stepMs: 50, type: 'square', volume: 0.09, duration: 0.06 });
    sfx.chord({ freqs: [392, 392 * RAT.M3, 392 * RAT.P5], duration: 0.22, type: 'triangle', volume: 0.06, delay: 0.3 });
  },
};

export const BANK_BLACKJACK = {
  bet: (sfx, p = {}) => {
    const amt = Math.max(1, p.amount ?? 1);
    const k = 1 + Math.min(0.6, Math.log2(amt) * 0.08);
    sfx.tone({ freq: 520 * k, type: 'square', duty: 0.25, duration: 0.02, volume: 0.08, jitter: 7 });
    sfx.noise({ duration: 0.018, volume: 0.03, tint: 0.6, delay: 0.0 });
  },
  shuffle: (sfx) => {
    sfx.noise({ duration: 0.2, volume: 0.05, tint: 0.15 });
    sfx.tone({ freq: 280, type: 'triangle', duration: 0.12, volume: 0.04, slideTo: 220, slideMs: 0.12 });
  },
  dealCard: (sfx) => {
    sfx.noise({ duration: 0.035, volume: 0.03, tint: 0.3 });
    sfx.tone({ freq: 760, type: 'square', duty: 0.25, duration: 0.016, volume: 0.07, delay: 0.01, jitter: 8 });
  },
  hit: (sfx) => {
    BANK_BLACKJACK.dealCard(sfx);
  },
  stand: (sfx) => {
    sfx.tone({ freq: 360, type: 'triangle', duration: 0.05, volume: 0.08 });
    sfx.tone({ freq: 540, type: 'triangle', duration: 0.04, volume: 0.06, delay: 0.03 });
  },
  blackjack: (sfx) => {
    sfx.arp({ base: 660, ratios: [1, RAT.M3, RAT.P5, RAT.OCT], stepMs: 40, type: 'triangle', volume: 0.1, duration: 0.07 });
    sfx.tone({ freq: 1320, type: 'sine', duration: 0.1, volume: 0.06, delay: 0.18 });
  },
  bust: (sfx) => {
    sfx.noise({ duration: 0.1, volume: 0.05, tint: 0.05 });
    sfx.tone({ freq: 240, type: 'sawtooth', duration: 0.16, volume: 0.08, slideTo: 120, slideMs: 0.16 });
  },
  win: (sfx) => {
    sfx.arp({ base: 440, ratios: [1, RAT.M3, RAT.P5], stepMs: 55, type: 'triangle', volume: 0.09, duration: 0.07 });
  },
  lose: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.18, volume: 0.07, slideTo: 165, slideMs: 0.18 });
  },
  push: (sfx) => {
    sfx.tone({ freq: 420, type: 'square', duty: 0.5, duration: 0.03, volume: 0.06, jitter: 5 });
  },
  payout: (sfx, p = {}) => {
    const ratio = Math.max(1, p.ratio ?? 1);
    const base = 440 * (1 + Math.min(0.8, (ratio - 1) * 0.35));
    sfx.arp({ base, ratios: [1, RAT.M3, RAT.P5, RAT.OCT], stepMs: 45, type: 'square', volume: 0.1, duration: 0.07 });
    sfx.noise({ duration: 0.06, volume: 0.03, tint: 0.05, delay: 0.12 });
  },
};

export const BANK_VIDEO_POKER = {
  coin: (sfx, p = {}) => {
    const amt = Math.max(1, p.amount ?? 1);
    const n = Math.min(4, amt);
    for (let i = 0; i < n; i++) {
      sfx.tone({ freq: 880 + i * 90, type: 'square', duty: 0.25, duration: 0.022, volume: 0.08, delay: i * 0.04, jitter: 10 });
      sfx.noise({ duration: 0.018, volume: 0.02, tint: 0.25, delay: i * 0.04 });
    }
  },
  bet: (sfx, p = {}) => {
    const step = Math.max(1, p.step ?? 1);
    const k = 1 + Math.min(0.5, step * 0.06);
    sfx.tone({ freq: 620 * k, type: 'square', duty: 0.125, duration: 0.03, volume: 0.09, jitter: 10 });
    sfx.tone({ freq: 820 * k, type: 'square', duty: 0.125, duration: 0.028, volume: 0.08, delay: 0.05, jitter: 10 });
  },
  deal: (sfx) => {
    sfx.noise({ duration: 0.1, volume: 0.035, tint: 0.18 });
    sfx.arp({ base: 520, ratios: [1, RAT.M3, RAT.P5], stepMs: 28, type: 'square', volume: 0.07, duration: 0.045 });
  },
  holdToggle: (sfx, p = {}) => {
    const on = !!p.on;
    if (on) {
      sfx.tone({ freq: 960, type: 'square', duty: 0.25, duration: 0.04, volume: 0.09, jitter: 10 });
      sfx.tone({ freq: 1280, type: 'square', duty: 0.25, duration: 0.028, volume: 0.06, delay: 0.03, jitter: 10 });
    } else {
      sfx.tone({ freq: 720, type: 'square', duty: 0.25, duration: 0.035, volume: 0.07, jitter: 10, slideTo: 640, slideMs: 0.035 });
    }
  },
  draw: (sfx) => {
    sfx.noise({ duration: 0.1, volume: 0.03, tint: 0.2 });
    sfx.arp({ base: 440, ratios: [1, RAT.M3, RAT.P5], stepMs: 30, type: 'square', volume: 0.07, duration: 0.045 });
  },
  payoutSmall: (sfx, p = {}) => {
    const credits = Math.max(1, p.credits ?? 1);
    const k = 1 + Math.min(1.2, Math.log2(credits + 1) * 0.18);
    sfx.arp({ base: 660 * k, ratios: [1, RAT.M3, RAT.P5], stepMs: 45, type: 'triangle', volume: 0.1, duration: 0.07 });
    sfx.noise({ duration: 0.08, volume: 0.03, tint: 0.08, delay: 0.1 });
  },
  payoutBig: (sfx, p = {}) => {
    const credits = Math.max(10, p.credits ?? 20);
    const k = 1 + Math.min(1.6, Math.log2(credits + 1) * 0.22);
    sfx.arp({ base: 520 * k, ratios: [1, RAT.M3, RAT.P5, RAT.OCT, RAT.P5], stepMs: 40, type: 'square', volume: 0.11, duration: 0.075 });
    sfx.chord({ freqs: [440 * k, 440 * k * RAT.M3, 440 * k * RAT.P5], duration: 0.22, type: 'triangle', volume: 0.07, delay: 0.28 });
    const n = 6;
    for (let i = 0; i < n; i++) {
      sfx.tone({ freq: 1200 + i * 90, type: 'square', duty: 0.125, duration: 0.02, volume: 0.04, delay: 0.22 + i * 0.035, jitter: 12 });
      sfx.noise({ duration: 0.018, volume: 0.015, tint: 0.12, delay: 0.22 + i * 0.035 });
    }
  },
  lose: (sfx) => {
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.22, volume: 0.08, slideTo: 150, slideMs: 0.22 });
  },
};
