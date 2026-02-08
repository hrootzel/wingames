const RATIOS = {
  m3: 6 / 5,
  M3: 5 / 4,
  P4: 4 / 3,
  P5: 3 / 2,
  M6: 5 / 3,
  M7: 15 / 8,
  OCT: 2,
};

function crystalBell(sfx, {
  freq = 880,
  volume = 0.06,
  delay = 0,
  decay = 0.18,
  shimmer = true,
} = {}) {
  sfx.tone({
    freq,
    type: 'sine',
    duration: decay,
    volume,
    delay,
    attack: 0.002,
    decay: Math.max(0.03, decay - 0.01),
  });
  sfx.tone({
    freq: freq * RATIOS.OCT,
    type: 'triangle',
    duration: decay * 0.8,
    volume: volume * 0.42,
    delay: delay + 0.002,
    attack: 0.001,
    decay: Math.max(0.02, decay * 0.75),
  });
  if (shimmer) {
    // Slightly inharmonic overtone gives a glassy "crystal" edge.
    sfx.tone({
      freq: freq * 2.73,
      type: 'sine',
      duration: decay * 0.55,
      volume: volume * 0.26,
      delay: delay + 0.004,
      attack: 0.001,
      decay: Math.max(0.015, decay * 0.5),
    });
  }
}

function crystalChord(sfx, root, ratios, {
  volume = 0.055,
  spreadMs = 18,
  decay = 0.2,
  delay = 0,
} = {}) {
  for (let i = 0; i < ratios.length; i++) {
    crystalBell(sfx, {
      freq: root * ratios[i],
      volume: volume * (i === 0 ? 1 : 0.86),
      delay: delay + (i * spreadMs) / 1000,
      decay,
      shimmer: true,
    });
  }
}

export const BANK_PRISMPULSE = {
  move: (sfx) => {
    crystalBell(sfx, { freq: 1046.5, volume: 0.035, decay: 0.08, shimmer: false });
  },

  rotate: (sfx) => {
    crystalBell(sfx, { freq: 1174.7, volume: 0.04, decay: 0.11 });
    crystalBell(sfx, { freq: 1396.9, volume: 0.03, decay: 0.08, delay: 0.02 });
  },

  lock: (sfx) => {
    // Drop/lock: satisfying, longer "landing" ping.
    crystalChord(sfx, 523.25, [1, RATIOS.P5, RATIOS.OCT], {
      volume: 0.053,
      decay: 0.22,
      spreadMs: 14,
    });
    sfx.tone({
      freq: 261.63,
      type: 'triangle',
      duration: 0.16,
      volume: 0.032,
      slideTo: 233.08,
      slideMs: 0.16,
      attack: 0.003,
      decay: 0.14,
      delay: 0.01,
    });
  },

  hardDrop: (sfx) => {
    crystalChord(sfx, 440, [1, RATIOS.P5, RATIOS.OCT], {
      volume: 0.06,
      decay: 0.16,
      spreadMs: 8,
    });
    sfx.noise({ duration: 0.05, volume: 0.04, tint: 0.5 });
  },

  clearTick: (sfx, p) => {
    const n = Math.max(1, p.squares ?? 1);
    const root = 740 + Math.min(280, n * 45);
    crystalBell(sfx, { freq: root, volume: 0.06, decay: 0.18 });
    crystalBell(sfx, { freq: root * RATIOS.M3, volume: 0.036, decay: 0.13, delay: 0.028 });
    crystalBell(sfx, { freq: root * RATIOS.P5, volume: 0.03, decay: 0.11, delay: 0.052 });
  },

  combo: (sfx, p) => {
    const combo = Math.max(2, p.combo ?? 2);
    const root = 440 * Math.pow(1.06, Math.min(12, combo - 2));
    const phrase = [1, RATIOS.M3, RATIOS.P5, RATIOS.M6, RATIOS.OCT];
    for (let i = 0; i < phrase.length; i++) {
      crystalBell(sfx, {
        freq: root * phrase[i],
        volume: 0.05 - i * 0.004,
        decay: 0.16 - i * 0.012,
        delay: i * 0.04,
        shimmer: true,
      });
    }
  },

  sweepClear: (sfx, p) => {
    const n = Math.max(1, p.squares ?? 1);
    const root = 660 + Math.min(260, n * 34);
    crystalChord(sfx, root, [1, RATIOS.P4, RATIOS.P5], {
      volume: 0.052,
      decay: 0.2,
      spreadMs: 16,
    });
  },

  megaSweep: (sfx) => {
    crystalChord(sfx, 587.33, [1, RATIOS.M3, RATIOS.P5, RATIOS.OCT], {
      volume: 0.06,
      decay: 0.24,
      spreadMs: 15,
    });
    crystalBell(sfx, { freq: 1760, volume: 0.03, decay: 0.16, delay: 0.12, shimmer: true });
  },

  levelUp: (sfx) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < notes.length; i++) {
      crystalBell(sfx, {
        freq: notes[i],
        volume: 0.055 - i * 0.004,
        decay: 0.2 - i * 0.018,
        delay: i * 0.055,
      });
    }
  },

  pause: (sfx) => {
    crystalBell(sfx, { freq: 587.33, volume: 0.04, decay: 0.12, shimmer: false });
  },

  resume: (sfx) => {
    crystalBell(sfx, { freq: 698.46, volume: 0.04, decay: 0.13, shimmer: false });
    crystalBell(sfx, { freq: 880, volume: 0.028, decay: 0.09, delay: 0.02, shimmer: false });
  },

  start: (sfx) => {
    // Start/restart: musical crystal motif (major pentatonic contour).
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    for (let i = 0; i < notes.length; i++) {
      crystalBell(sfx, {
        freq: notes[i],
        volume: 0.052 - i * 0.003,
        decay: 0.2 - i * 0.014,
        delay: i * 0.05,
      });
    }
    crystalChord(sfx, 523.25, [1, RATIOS.P5, RATIOS.OCT], {
      volume: 0.034,
      decay: 0.22,
      spreadMs: 12,
      delay: 0.24,
    });
  },

  gameOver: (sfx) => {
    crystalBell(sfx, { freq: 440, volume: 0.05, decay: 0.2, shimmer: false });
    crystalBell(sfx, { freq: 349.23, volume: 0.042, decay: 0.2, delay: 0.09, shimmer: false });
    crystalBell(sfx, { freq: 261.63, volume: 0.036, decay: 0.24, delay: 0.18, shimmer: false });
  },

  danger: (sfx) => {
    crystalBell(sfx, { freq: 330, volume: 0.04, decay: 0.1, shimmer: false });
    crystalBell(sfx, { freq: 294, volume: 0.035, decay: 0.1, delay: 0.06, shimmer: false });
  },
};
