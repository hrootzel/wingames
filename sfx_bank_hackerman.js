// Hackerman SFX bank (chiptune/terminal style)
// Drop-in compatible with the same SFX helper API used by BANK_PILLPOPPER
// (expects sfx.tone(), sfx.noise(), sfx.arp()).

export const BANK_HACKERMAN = {
  // --- UI / navigation ---
  uiHover: (sfx) => {
    sfx.tone({ freq: 880, type: 'square', duty: 0.125, duration: 0.02, volume: 0.04, jitter: 3 });
  },
  uiClick: (sfx) => {
    sfx.tone({ freq: 660, type: 'square', duty: 0.25, duration: 0.03, volume: 0.07, jitter: 2 });
    sfx.tone({ freq: 990, type: 'triangle', duration: 0.02, volume: 0.04, delay: 0.01 });
  },
  openSettings: (sfx) => {
    sfx.arp({ base: 330, ratios: [1, 5/4, 3/2, 2], stepMs: 46, type: 'square', volume: 0.085, duration: 0.05 });
  },
  closeSettings: (sfx) => {
    sfx.arp({ base: 330, ratios: [2, 3/2, 5/4, 1], stepMs: 46, type: 'square', volume: 0.075, duration: 0.05 });
  },
  toggleTheme: (sfx) => {
    sfx.tone({ freq: 262, type: 'triangle', duration: 0.05, volume: 0.07 });
    sfx.tone({ freq: 392, type: 'square', duty: 0.5, duration: 0.03, volume: 0.05, delay: 0.02 });
  },

  // --- Session lifecycle ---
  newSession: (sfx) => {
    // "connected" boot chirp
    sfx.arp({ base: 220, ratios: [1, 9/8, 5/4, 3/2, 2], stepMs: 52, type: 'square', volume: 0.09, duration: 0.06 });
    sfx.noise({ duration: 0.03, volume: 0.03, tint: 0.15, delay: 0.02 });
  },
  sessionTerminated: (sfx) => {
    // short falling tone + glitch
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.22, volume: 0.10, slideTo: 98, slideMs: 0.22 });
    sfx.noise({ duration: 0.12, volume: 0.05, tint: 0.08, delay: 0.04 });
  },

  // --- Board editing ---
  slotSelect: (sfx) => {
    sfx.tone({ freq: 520, type: 'square', duty: 0.5, duration: 0.018, volume: 0.045, jitter: 2 });
  },
  placeSymbol: (sfx) => {
    // placing a digit/color into a slot (terminal keyboard click)
    sfx.noise({ duration: 0.012, volume: 0.035, tint: 0.35 });
    sfx.tone({ freq: 1400, type: 'square', duty: 0.125, duration: 0.012, volume: 0.05, jitter: 6 });
    sfx.tone({ freq: 240, type: 'triangle', duration: 0.02, volume: 0.03, delay: 0.004 });
  },
  removeSymbol: (sfx) => {
    // toggling off a symbol
    sfx.tone({ freq: 370, type: 'square', duty: 0.5, duration: 0.03, volume: 0.06, slideTo: 300, slideMs: 0.03 });
  },
  backspace: (sfx) => {
    sfx.tone({ freq: 300, type: 'square', duty: 0.5, duration: 0.03, volume: 0.07, jitter: 2 });
    sfx.noise({ duration: 0.02, volume: 0.025, tint: 0.18, delay: 0.0 });
  },
  clearRow: (sfx) => {
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.08, volume: 0.10 });
    sfx.noise({ duration: 0.06, volume: 0.04, tint: 0.12, delay: 0.0 });
  },

  // --- Rule / error feedback ---
  duplicateBlocked: (sfx) => {
    // digits mode: already used digit
    sfx.tone({ freq: 180, type: 'square', duty: 0.5, duration: 0.05, volume: 0.09, jitter: 1 });
    sfx.tone({ freq: 120, type: 'square', duty: 0.5, duration: 0.06, volume: 0.07, delay: 0.03 });
  },
  incompleteGuess: (sfx) => {
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.07, volume: 0.085 });
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.07, volume: 0.06, delay: 0.09 });
  },

  // --- Submission / feedback ---
  submit: (sfx) => {
    sfx.tone({ freq: 660, type: 'square', duty: 0.125, duration: 0.04, volume: 0.095, jitter: 3 });
    sfx.noise({ duration: 0.02, volume: 0.03, tint: 0.20, delay: 0.01 });
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
    sfx.tone({ freq: 220, type: 'square', duty: 0.5, duration: 0.02, volume: 0.04, delay: 0.04 });
  },

  rowAdvance: (sfx) => {
    // advance to next attempt (short scanline sweep)
    sfx.tone({ freq: 330, type: 'triangle', duration: 0.06, volume: 0.08, slideTo: 660, slideMs: 0.06 });
    sfx.noise({ duration: 0.035, volume: 0.03, tint: 0.22, delay: 0.02 });
  },

  // --- End states ---
  accessGranted: (sfx) => {
    // triumphant terminal arpeggio + low pad
    sfx.arp({ base: 392, ratios: [1, 5/4, 3/2, 2], stepMs: 55, type: 'square', volume: 0.11, duration: 0.08 });
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.30, volume: 0.08, delay: 0.03 });
  },
  accessDenied: (sfx) => {
    // falling minor-ish feel + glitch noise
    sfx.tone({ freq: 220, type: 'triangle', duration: 0.30, volume: 0.10, slideTo: 110, slideMs: 0.30 });
    sfx.tone({ freq: 165, type: 'square', duty: 0.5, duration: 0.20, volume: 0.07, delay: 0.06, slideTo: 82.5, slideMs: 0.20 });
    sfx.noise({ duration: 0.14, volume: 0.05, tint: 0.10, delay: 0.10 });
  },

  reveal: (sfx) => {
    // reveal stinger (like a \"peek\" in a terminal)
    sfx.arp({ base: 262, ratios: [1, 4/3, 3/2, 2], stepMs: 38, type: 'square', volume: 0.10, duration: 0.05 });
    sfx.noise({ duration: 0.05, volume: 0.04, tint: 0.12, delay: 0.0 });
  },
};
