export const BANK_PLOPPLOP = {
  // Move  horizontally
  move: (sfx) => {
    sfx.tone({ freq: 196, type: 'square', duration: 0.025, volume: 0.06 });
  },
  // Rotate pair
  rotate: (sfx) => {
    sfx.tone({ freq: 330, type: 'triangle', duration: 0.04, volume: 0.09 });
    sfx.tone({ freq: 392, type: 'triangle', duration: 0.03, volume: 0.07, delay: 0.02 });
  },
  // Place/lock
  lock: (sfx) => {
    sfx.tone({ freq: 147, type: 'triangle', duration: 0.08, volume: 0.1, slideTo: 110, slideMs: 0.08 });
    sfx.noise({ duration: 0.04, volume: 0.05, tint: 0.5 });
  },
  hardDrop: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.07, volume: 0.12, slideTo: 110, slideMs: 0.07 });
    sfx.tone({ freq: 440, type: 'sine', duration: 0.04, volume: 0.06, delay: 0.01, slideTo: 330, slideMs: 0.04 });
    sfx.noise({ duration: 0.04, volume: 0.05, tint: 0.4 });
  },
  // clear sounds (7 levels, pitch increases with chain)
  // Arcade uses same waveform with pitch envelope offset per chain level
  clear: (sfx, p) => {
    const chain = Math.min(7, Math.max(1, p.chain ?? 1));
    // Base frequencies from arcade: chain 1=~523Hz, each level adds ~2 semitones
    const baseFreq = 523 * Math.pow(1.122, chain - 1);
    const pops = Math.min(4, Math.max(1, Math.floor((p.cleared ?? 4) / 3)));
    for (let i = 0; i < pops; i++) {
      sfx.tone({
        freq: baseFreq + i * 40,
        type: 'sine',
        duration: 0.06,
        volume: 0.11,
        slideTo: (baseFreq + i * 40) * 1.15,
        slideMs: 0.06,
        delay: i * 0.012,
      });
    }
    sfx.noise({ duration: 0.03, volume: 0.03, tint: 0.6, delay: 0.01 });
  },
  // Combo complete fanfares (escalating with chain length)
  chain: (sfx, p) => {
    const ch = Math.max(2, p.chain ?? 2);
    // Arcade has 3 combo complete SFX, cycling/escalating
    const tier = Math.min(3, Math.ceil(ch / 3));
    const base = 392 * Math.pow(1.12, tier);
    // Arpeggio pattern from arcade: major chord sweep
    sfx.arp({ base, ratios: [1, 1.25, 1.5, 2], stepMs: 35, type: 'triangle', volume: 0.12, duration: 0.05 });
    if (ch >= 4) {
      sfx.tone({ freq: base * 2, type: 'square', duration: 0.08, volume: 0.06, delay: 0.14 });
    }
  },
  // All clear bonus
  allClear: (sfx) => {
    sfx.arp({ base: 523, ratios: [1, 1.25, 1.5, 2, 2.5], stepMs: 60, type: 'square', volume: 0.1, duration: 0.07 });
    sfx.tone({ freq: 262, type: 'triangle', duration: 0.3, volume: 0.08, delay: 0.02 });
    sfx.tone({ freq: 523, type: 'sine', duration: 0.15, volume: 0.06, delay: 0.32 });
  },
  // Lose/game over
  gameOver: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.35, volume: 0.1, slideTo: 110, slideMs: 0.35 });
    sfx.noise({ duration: 0.2, volume: 0.04, tint: 0.3, delay: 0.1 });
  },
  // Garbage fall (minor/major variants)
  garbageFall: (sfx, p) => {
    const count = Math.min(30, p.count ?? 1);
    const isMajor = count >= 6;
    sfx.noise({ duration: isMajor ? 0.12 : 0.06, volume: isMajor ? 0.08 : 0.05, tint: 0.4 });
    sfx.tone({ freq: isMajor ? 110 : 147, type: 'triangle', duration: 0.08, volume: 0.07 });
  },
  // Danger warning (board getting high)
  danger: (sfx) => {
    sfx.tone({ freq: 220, type: 'square', duration: 0.06, volume: 0.07 });
    sfx.tone({ freq: 196, type: 'square', duration: 0.06, volume: 0.06, delay: 0.08 });
  },
};
