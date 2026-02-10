function metallicPing(sfx, freq, volume, delay = 0, decay = 0.08) {
  sfx.tone({
    freq,
    type: 'triangle',
    duration: decay,
    volume,
    delay,
    attack: 0.002,
    decay: Math.max(0.03, decay - 0.01),
  });
  sfx.noise({
    duration: Math.max(0.02, decay * 0.45),
    volume: volume * 0.35,
    delay: delay + 0.002,
    tint: 0.7,
  });
}

export const BANK_COIN_CASCADE = {
  move: (sfx) => {
    sfx.noise({ duration: 0.01, volume: 0.025, tint: 0.9 });
  },

  grab: (sfx) => {
    sfx.tone({
      freq: 1200,
      slideTo: 700,
      slideMs: 0.06,
      type: 'triangle',
      duration: 0.07,
      volume: 0.08,
      attack: 0.002,
      decay: 0.06,
    });
  },

  throw: (sfx) => {
    sfx.tone({
      freq: 620,
      slideTo: 920,
      slideMs: 0.05,
      type: 'square',
      duration: 0.06,
      volume: 0.08,
      attack: 0.002,
      decay: 0.05,
    });
    sfx.noise({ duration: 0.01, volume: 0.025, delay: 0.01, tint: 0.8 });
  },

  land: (sfx) => {
    metallicPing(sfx, 1680, 0.06, 0, 0.05);
  },

  convertSmall: (sfx) => {
    metallicPing(sfx, 920, 0.07, 0, 0.06);
    metallicPing(sfx, 1240, 0.05, 0.025, 0.06);
  },

  convertBig: (sfx) => {
    const notes = [1180, 1580, 2020];
    for (let i = 0; i < notes.length; i++) {
      metallicPing(sfx, notes[i], 0.07 - i * 0.01, i * 0.03, 0.075);
    }
  },

  chainStep: (sfx, payload) => {
    const chain = Math.max(1, payload.chain ?? 1);
    const base = 700 + Math.min(1200, chain * 120);
    const ratios = [1, 1.25, 1.5];
    for (let i = 0; i < ratios.length; i++) {
      sfx.tone({
        freq: base * ratios[i],
        type: 'triangle',
        duration: 0.07,
        volume: 0.07 - i * 0.012,
        delay: i * 0.04,
        attack: 0.002,
        decay: 0.06,
      });
    }
  },

  plus: (sfx) => {
    sfx.chord({ freqs: [740, 925, 1110], duration: 0.12, type: 'triangle', volume: 0.06 });
    sfx.noise({ duration: 0.02, volume: 0.03, tint: 0.9, delay: 0.01 });
  },

  minus: (sfx) => {
    sfx.tone({
      freq: 420,
      slideTo: 250,
      slideMs: 0.12,
      type: 'sawtooth',
      duration: 0.14,
      volume: 0.085,
      attack: 0.002,
      decay: 0.12,
    });
  },

  fizzle: (sfx) => {
    sfx.noise({ duration: 0.03, volume: 0.028, tint: 0.2 });
  },

  tick: (sfx) => {
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.03, volume: 0.04 });
  },

  levelUp: (sfx) => {
    const notes = [880, 1100, 1320];
    for (let i = 0; i < notes.length; i++) {
      sfx.tone({
        freq: notes[i],
        type: 'triangle',
        duration: 0.08,
        volume: 0.07 - i * 0.01,
        delay: i * 0.08,
      });
    }
  },

  danger: (sfx) => {
    sfx.tone({ freq: 190, type: 'square', duration: 0.06, volume: 0.06 });
    sfx.tone({ freq: 170, type: 'square', duration: 0.06, volume: 0.05, delay: 0.09 });
  },

  start: (sfx) => {
    sfx.arp({
      base: 392,
      ratios: [1, 1.25, 1.5, 2],
      stepMs: 60,
      duration: 0.08,
      type: 'triangle',
      volume: 0.06,
    });
  },

  pause: (sfx) => {
    sfx.tone({ freq: 460, type: 'triangle', duration: 0.07, volume: 0.05 });
  },

  resume: (sfx) => {
    sfx.tone({ freq: 640, type: 'triangle', duration: 0.07, volume: 0.05 });
  },

  gameOver: (sfx) => {
    sfx.tone({
      freq: 520,
      slideTo: 180,
      slideMs: 0.32,
      type: 'triangle',
      duration: 0.35,
      volume: 0.09,
      attack: 0.004,
      decay: 0.32,
    });
  },
};
