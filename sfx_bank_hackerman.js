// Hackerman SFX bank (chiptune/terminal style)
// Drop-in compatible with the same SFX helper API used by BANK_PILLPOPPER
// (expects sfx.tone(), sfx.noise(), sfx.arp()).

export const BANK_HACKERMAN = {
  // --- UI / navigation ---
  uiHover: (sfx) => {
    sfx.noise({ duration: 0.008, volume: 0.02, tint: 0.4 });
    sfx.tone({ freq: 1200, type: 'square', duty: 0.125, duration: 0.01, volume: 0.03, jitter: 4 });
  },
  uiClick: (sfx) => {
    sfx.noise({ duration: 0.014, volume: 0.04, tint: 0.28 });
    sfx.tone({ freq: 920, type: 'square', duty: 0.25, duration: 0.02, volume: 0.06, jitter: 5 });
    sfx.tone({ freq: 240, type: 'triangle', duration: 0.03, volume: 0.035, delay: 0.006 });
  },
  openSettings: (sfx) => {
    sfx.arp({ base: 300, ratios: [1, 4/3, 3/2, 2], stepMs: 42, type: 'square', volume: 0.085, duration: 0.05 });
    sfx.noise({ duration: 0.03, volume: 0.02, tint: 0.2, delay: 0.02 });
  },
  closeSettings: (sfx) => {
    sfx.arp({ base: 300, ratios: [2, 3/2, 4/3, 1], stepMs: 42, type: 'square', volume: 0.075, duration: 0.05 });
    sfx.noise({ duration: 0.028, volume: 0.02, tint: 0.2, delay: 0.015 });
  },
  toggleTheme: (sfx) => {
    sfx.tone({ freq: 300, type: 'triangle', duration: 0.05, volume: 0.06 });
    sfx.tone({ freq: 520, type: 'square', duty: 0.25, duration: 0.025, volume: 0.05, delay: 0.015 });
    sfx.noise({ duration: 0.015, volume: 0.02, tint: 0.3, delay: 0.01 });
  },

  // --- Session lifecycle ---
  newSession: (sfx) => {
    // "connected" boot chirp
    sfx.arp({ base: 220, ratios: [1, 9/8, 5/4, 3/2, 2], stepMs: 50, type: 'square', volume: 0.09, duration: 0.06 });
    sfx.tone({ freq: 110, type: 'triangle', duration: 0.18, volume: 0.05, delay: 0.02 });
    sfx.noise({ duration: 0.035, volume: 0.03, tint: 0.18, delay: 0.02 });
  },
  sessionTerminated: (sfx) => {
    // short falling tone + glitch
    sfx.tone({ freq: 180, type: 'triangle', duration: 0.26, volume: 0.10, slideTo: 80, slideMs: 0.26 });
    sfx.tone({ freq: 120, type: 'square', duty: 0.5, duration: 0.16, volume: 0.06, delay: 0.05, slideTo: 60, slideMs: 0.16 });
    sfx.noise({ duration: 0.14, volume: 0.055, tint: 0.1, delay: 0.04 });
  },

  // --- Board editing ---
  slotSelect: (sfx) => {
    sfx.noise({ duration: 0.008, volume: 0.02, tint: 0.35 });
    sfx.tone({ freq: 1100, type: 'square', duty: 0.125, duration: 0.012, volume: 0.035, jitter: 4 });
  },
  placeSymbol: (sfx) => {
    // placing a digit/color into a slot (terminal keyboard click)
    sfx.noise({ duration: 0.012, volume: 0.035, tint: 0.35 });
    sfx.tone({ freq: 1400, type: 'square', duty: 0.125, duration: 0.012, volume: 0.05, jitter: 6 });
    sfx.tone({ freq: 240, type: 'triangle', duration: 0.02, volume: 0.03, delay: 0.004 });
  },
  removeSymbol: (sfx) => {
    // toggling off a symbol
    sfx.noise({ duration: 0.01, volume: 0.025, tint: 0.25 });
    sfx.tone({ freq: 320, type: 'square', duty: 0.5, duration: 0.028, volume: 0.055, slideTo: 220, slideMs: 0.03 });
  },
  backspace: (sfx) => {
    sfx.noise({ duration: 0.02, volume: 0.03, tint: 0.25 });
    sfx.tone({ freq: 220, type: 'square', duty: 0.5, duration: 0.025, volume: 0.065, jitter: 3 });
    sfx.tone({ freq: 120, type: 'triangle', duration: 0.04, volume: 0.03, delay: 0.01 });
  },
  clearRow: (sfx) => {
    sfx.tone({ freq: 320, type: 'triangle', duration: 0.12, volume: 0.1, slideTo: 140, slideMs: 0.12 });
    sfx.noise({ duration: 0.07, volume: 0.045, tint: 0.16, delay: 0.01 });
  },

  // --- Rule / error feedback ---
  duplicateBlocked: (sfx) => {
    // digits mode: already used digit
    sfx.tone({ freq: 200, type: 'square', duty: 0.5, duration: 0.05, volume: 0.09, jitter: 2 });
    sfx.tone({ freq: 140, type: 'square', duty: 0.5, duration: 0.06, volume: 0.075, delay: 0.03 });
    sfx.noise({ duration: 0.02, volume: 0.03, tint: 0.1, delay: 0.01 });
  },
  incompleteGuess: (sfx) => {
    sfx.tone({ freq: 300, type: 'triangle', duration: 0.06, volume: 0.08 });
    sfx.tone({ freq: 240, type: 'triangle', duration: 0.07, volume: 0.065, delay: 0.08 });
  },

  // --- Submission / feedback ---
  submit: (sfx) => {
    // classic terminal "bloop"
    sfx.tone({ freq: 620, type: 'triangle', duration: 0.07, volume: 0.095, slideTo: 420, slideMs: 0.07 });
    sfx.tone({ freq: 180, type: 'triangle', duration: 0.05, volume: 0.04, delay: 0.012 });
  },

  // Called after evaluate(). Parameterize with { bulls, cows, row }
  feedback: (sfx, p = {}) => {
    const bulls = Math.max(0, Math.min(4, p.bulls ?? 0));
    const cows  = Math.max(0, Math.min(4, p.cows ?? 0));

    // Bulls: bright confirmation chirps
    if (bulls > 0) {
      const base = 740 * Math.pow(1.10, bulls - 1);
      sfx.arp({ base, ratios: [1, 5/4, 3/2], stepMs: 42, type: 'square', volume: 0.09, duration: 0.05 });
    }

    // Cows: softer mid chirp(s)
    if (cows > 0) {
      const base = 440 * Math.pow(1.06, cows - 1);
      sfx.arp({ base, ratios: [1, 6/5], stepMs: 58, type: 'triangle', volume: 0.06, duration: 0.06, delay: 0.02 });
    }

    // Low click to end the submit cycle
    sfx.noise({ duration: 0.012, volume: 0.02, tint: 0.35, delay: 0.03 });
    sfx.tone({ freq: 220, type: 'square', duty: 0.5, duration: 0.02, volume: 0.04, delay: 0.035 });
  },

  rowAdvance: (sfx) => {
    // advance to next attempt (short scanline sweep)
    sfx.tone({ freq: 360, type: 'triangle', duration: 0.07, volume: 0.08, slideTo: 720, slideMs: 0.07 });
    sfx.noise({ duration: 0.04, volume: 0.03, tint: 0.24, delay: 0.02 });
  },

  // --- End states ---
  accessGranted: (sfx) => {
    // triumphant terminal arpeggio + low pad
    sfx.arp({ base: 330, ratios: [1, 5/4, 3/2, 2, 5/2], stepMs: 60, type: 'square', volume: 0.12, duration: 0.08 });
    sfx.arp({ base: 440, ratios: [1, 5/4, 3/2], stepMs: 55, type: 'square', volume: 0.09, duration: 0.06, delay: 0.08 });
    sfx.tone({ freq: 110, type: 'triangle', duration: 0.45, volume: 0.08, delay: 0.04 });
    sfx.tone({ freq: 660, type: 'square', duty: 0.125, duration: 0.08, volume: 0.06, delay: 0.12 });
    sfx.noise({ duration: 0.05, volume: 0.03, tint: 0.25, delay: 0.1 });
  },
  accessDenied: (sfx) => {
    // falling minor-ish feel + glitch noise
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.5, volume: 0.12, slideTo: 65, slideMs: 0.5 });
    sfx.tone({ freq: 180, type: 'square', duty: 0.5, duration: 0.38, volume: 0.08, delay: 0.06, slideTo: 60, slideMs: 0.38 });
    sfx.tone({ freq: 90, type: 'triangle', duration: 0.22, volume: 0.06, delay: 0.18 });
    sfx.noise({ duration: 0.2, volume: 0.07, tint: 0.12, delay: 0.12 });
  },

  reveal: (sfx) => {
    // reveal stinger (like a \"peek\" in a terminal)
    sfx.arp({ base: 280, ratios: [1, 4/3, 3/2, 2], stepMs: 36, type: 'square', volume: 0.10, duration: 0.05 });
    sfx.noise({ duration: 0.05, volume: 0.04, tint: 0.14, delay: 0.0 });
    sfx.tone({ freq: 720, type: 'square', duty: 0.25, duration: 0.03, volume: 0.05, delay: 0.02 });
  },
};
