export const BANK_MYRIAPOD = {
  // High, snappy “pew” with a tiny noisy click (closer to the arcade chirp).
  shoot: (sfx) => {
    // Bright pulse sweep
    sfx.tone({
      freq: 1700,
      slideTo: 950,
      slideMs: 0.045,
      type: 'square',
      duty: 0.125,
      duration: 0.045,
      volume: 0.065,
      attack: 0.001,
      decay: 0.044,
      jitter: 2,
    });
    // A very short “edge” overtone
    sfx.tone({
      freq: 3200,
      slideTo: 1800,
      slideMs: 0.022,
      type: 'square',
      duty: 0.0625,
      duration: 0.022,
      volume: 0.018,
      attack: 0.001,
      decay: 0.02,
      delay: 0.003,
      jitter: 1,
    });
    // Tiny click (POKEY-ish transient)
    sfx.noise({
      duration: 0.012,
      volume: 0.018,
      tint: 0.35,
      attack: 0.001,
      decay: 0.011,
    });
  },

  // Short “step” tick. Optionally takes payload.rate (higher => slightly higher pitch).
  centipedeMove: (sfx, payload = {}) => {
    const rate = Number(payload.rate ?? 1);
    const r = Number.isFinite(rate) ? Math.max(0.6, Math.min(2.5, rate)) : 1;

    // Low thump + a tiny higher click on top.
    const f0 = 62 + 18 * (r - 1); // subtle pitch lift when moving faster

    sfx.tone({
      freq: f0,
      type: 'square',
      duty: 0.25,
      duration: 0.022,
      volume: 0.020,
      attack: 0.001,
      decay: 0.021,
      jitter: 1.5,
    });
    sfx.tone({
      freq: f0 * 2.2,
      type: 'square',
      duty: 0.125,
      duration: 0.014,
      volume: 0.010,
      attack: 0.001,
      decay: 0.013,
      delay: 0.004,
      jitter: 1.5,
    });
    // Very quiet “digital grit” (kept tiny because this triggers often)
    sfx.noise({
      duration: 0.01,
      volume: 0.004,
      tint: 0.2,
      delay: 0.002,
      attack: 0.001,
      decay: 0.009,
    });
  },

  // Crunchy burst + pitch drop (arcade-style hit/explosion).
  explosion: (sfx) => {
    // Bright crack
    sfx.noise({
      duration: 0.11,
      volume: 0.070,
      tint: 0.18,
      attack: 0.001,
      decay: 0.109,
    });
    // Body (descending “boom”)
    sfx.tone({
      freq: 240,
      slideTo: 70,
      slideMs: 0.16,
      type: 'square',
      duty: 0.5,
      duration: 0.16,
      volume: 0.050,
      attack: 0.002,
      decay: 0.158,
      jitter: 2,
    });
    // Small metallic tick (helps it read as “arcade”)
    sfx.tone({
      freq: 1200,
      slideTo: 800,
      slideMs: 0.03,
      type: 'square',
      duty: 0.125,
      duration: 0.03,
      volume: 0.012,
      delay: 0.01,
      attack: 0.001,
      decay: 0.029,
      jitter: 3,
    });
  },

  // Classic “you died” downward siren + noisy crumble.
  playerDeath: (sfx) => {
    // Layered descending sweeps
    sfx.tone({
      freq: 1200,
      slideTo: 140,
      slideMs: 0.58,
      type: 'square',
      duty: 0.25,
      duration: 0.58,
      volume: 0.085,
      attack: 0.003,
      decay: 0.577,
      jitter: 1,
    });
    sfx.tone({
      freq: 820,
      slideTo: 110,
      slideMs: 0.58,
      type: 'square',
      duty: 0.125,
      duration: 0.58,
      volume: 0.045,
      delay: 0.01,
      attack: 0.003,
      decay: 0.577,
      jitter: 2,
    });

    // “Crunch” tail
    sfx.noise({
      duration: 0.38,
      volume: 0.050,
      tint: 0.12,
      delay: 0.10,
      attack: 0.002,
      decay: 0.378,
    });

    // A few short “glitch” pops during the fall
    const pops = [0.16, 0.24, 0.33];
    for (let i = 0; i < pops.length; i++) {
      sfx.tone({
        freq: 520 + i * 70,
        slideTo: 220,
        slideMs: 0.05,
        type: 'square',
        duty: 0.0625,
        duration: 0.05,
        volume: 0.016,
        delay: pops[i],
        attack: 0.001,
        decay: 0.049,
        jitter: 6,
      });
    }
  },

  // Spider “wibbledy-wibbledy” warble: a quick wavering sequence.
  spider: (sfx) => {
    // Low base buzz under the warble
    sfx.tone({
      freq: 105,
      type: 'square',
      duty: 0.25,
      duration: 0.12,
      volume: 0.012,
      attack: 0.002,
      decay: 0.118,
      jitter: 10,
    });

    const base = 310;
    const seq = [1.0, 0.78, 0.92, 0.70, 0.88, 0.66];
    const step = 0.028;

    for (let i = 0; i < seq.length; i++) {
      sfx.tone({
        freq: base * seq[i],
        type: 'square',
        duty: 0.5,
        duration: 0.05,
        volume: 0.030,
        delay: i * step,
        attack: 0.001,
        decay: 0.049,
        jitter: 12,
      });
    }
  },

  // Flea: sharp descending chirps (reads like the classic falling “peep”).
  flea: (sfx) => {
    const freqs = [1500, 1150, 900, 720];
    for (let i = 0; i < freqs.length; i++) {
      sfx.tone({
        freq: freqs[i],
        slideTo: Math.max(220, freqs[i] * 0.65),
        slideMs: 0.028,
        type: 'square',
        duty: 0.125,
        duration: 0.03,
        volume: 0.022,
        delay: i * 0.018,
        attack: 0.001,
        decay: 0.029,
        jitter: 3,
      });
    }
  },

  // Scorpion: raspier, lower glide + a hint of noise.
  scorpion: (sfx) => {
    sfx.noise({
      duration: 0.06,
      volume: 0.018,
      tint: 0.06,
      attack: 0.001,
      decay: 0.059,
    });
    sfx.tone({
      freq: 330,
      slideTo: 150,
      slideMs: 0.10,
      type: 'square',
      duty: 0.25,
      duration: 0.10,
      volume: 0.030,
      attack: 0.001,
      decay: 0.099,
      jitter: 8,
    });
    // Small follow-up tick
    sfx.tone({
      freq: 210,
      type: 'square',
      duty: 0.125,
      duration: 0.025,
      volume: 0.012,
      delay: 0.06,
      attack: 0.001,
      decay: 0.024,
      jitter: 6,
    });
  },

  // Extra life: bright rising riff + a final chord.
  bonusLife: (sfx) => {
    sfx.arp({
      base: 330, // E4-ish
      ratios: [1, 5 / 4, 3 / 2, 2, 5 / 2],
      stepMs: 58,
      type: 'square',
      volume: 0.070,
      duration: 0.075,
    });
    // Final “sparkle” chord
    sfx.chord({
      freqs: [660, 825, 990],
      duration: 0.11,
      type: 'square',
      volume: 0.030,
      spreadCents: 4,
      delay: 0.30,
    });
  },

  // Round complete: quick celebratory flourish.
  waveComplete: (sfx) => {
    // Up then resolve
    const base = 262; // C4-ish
    sfx.arp({
      base,
      ratios: [1, 5 / 4, 3 / 2, 2],
      stepMs: 55,
      type: 'square',
      volume: 0.060,
      duration: 0.07,
    });
    sfx.arp({
      base: base * 2,
      ratios: [1, 3 / 2, 5 / 4, 1],
      stepMs: 45,
      type: 'square',
      volume: 0.045,
      duration: 0.06,
      delay: 0.24,
    });
  },
};
