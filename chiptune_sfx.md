# Goal

Create a **stand‑alone JS module** that your games can import to play **old‑timey “NES‑ish”** sound effects using the **Web Audio API** (oscillators + envelopes + noise), with **sound banks** per game.

Covered games:
- Puzzle Fighter clone
- Puyo Puyo clone
- Dr. Mario clone

Event palette for each:
- `move`, `rotate`, `lock`, `clear`, `chain`, `gameOver`

---

## 1) Constraints / browser rules

- Browsers require a **user gesture** (click/keydown/touch) before audio can start.
- You should call `engine.unlock()` from your first input handler.
- Schedule audio using `audioCtx.currentTime` (stable timing, low jitter).

---

## 2) Recommended API design

### Public usage

```js
import { SfxEngine, BANK_PUYO, BANK_DRMARIO, BANK_PUZZLEFIGHTER } from './sfx_engine.js';

const sfx = new SfxEngine({ master: 0.6 });

window.addEventListener('keydown', () => sfx.unlock(), { once: true });

// Later, from your rules engine effects:
// sfx.play(BANK_PUYO, 'rotate');
// sfx.play(BANK_DRMARIO, 'clear', { viruses: 2 });
```

### Where it hooks into your engine

If your rules engine emits effects like:

```js
{ type:'MOVE' }
{ type:'ROTATE' }
{ type:'LOCK' }
{ type:'CLEAR', cleared: 8, chainIndex: 2 }
{ type:'GAME_OVER' }
```

You can translate them:

```js
function onEffects(effects) {
  for (const e of effects) {
    if (e.type === 'MOVE') sfx.play(BANK_PUYO, 'move');
    if (e.type === 'ROTATE') sfx.play(BANK_PUYO, 'rotate');
    if (e.type === 'LOCK') sfx.play(BANK_PUYO, 'lock');
    if (e.type === 'CLEAR') {
      // First link → "clear", later links → "chain" + "clear"
      if ((e.chainIndex ?? 1) >= 2) sfx.play(BANK_PUYO, 'chain', { chain: e.chainIndex });
      sfx.play(BANK_PUYO, 'clear', e);
    }
    if (e.type === 'GAME_OVER') sfx.play(BANK_PUYO, 'gameOver');
  }
}
```

---

## 3) Stand‑alone implementation (drop‑in)

Paste as `sfx_engine.js`.

```js
// sfx_engine.js

export class SfxEngine {
  constructor(opts = {}) {
    this.masterLevel = opts.master ?? 0.6;
    this.enabled = opts.enabled ?? true;

    this._ctx = null;
    this._master = null;
    this._compressor = null;

    // Small randomness to avoid robotic repetition
    this._rand = opts.rand ?? (() => Math.random());

    // Optional: cache periodic waves for NES-ish duty cycles
    this._waves = new Map();
  }

  get ctx() { return this._ctx; }

  // Must be called from a user gesture at least once
  unlock() {
    if (!this.enabled) return;
    this._ensure();
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (this._master) this._master.gain.value = this.enabled ? this.masterLevel : 0;
  }

  // --- Core primitives ---

  tone(params = {}) {
    if (!this.enabled) return;
    this._ensure();

    const ctx = this._ctx;
    const t0 = ctx.currentTime + (params.delay ?? 0);

    const freq = params.freq ?? 440;
    const dur  = params.duration ?? 0.08;
    const vol  = params.volume ?? 0.12;

    const attack = params.attack ?? 0.002;
    const decay  = params.decay  ?? Math.max(0.02, dur - attack);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Waveform
    if (params.duty) {
      osc.setPeriodicWave(this._getDutyWave(params.duty));
    } else {
      osc.type = params.type ?? 'square';
    }

    // Pitch
    const det = params.detune ?? 0;
    const jitter = params.jitter ?? 0; // in cents
    const detJ = (jitter ? (this._rand()*2 - 1) * jitter : 0);

    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.setValueAtTime(det + detJ, t0);

    // Optional pitch slide (gliss)
    if (params.slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, params.slideTo),
        t0 + Math.max(0.01, params.slideMs ?? dur)
      );
    }

    // Envelope (exponential feels chiptune-y)
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

    // Routing
    osc.connect(gain);
    gain.connect(this._compressor);

    osc.start(t0);
    osc.stop(t0 + dur);
  }

  // “Noise” for thuds/pops/sparks. tint=0..1 biases toward smoother (pink-ish)
  noise(params = {}) {
    if (!this.enabled) return;
    this._ensure();

    const ctx = this._ctx;
    const t0 = ctx.currentTime + (params.delay ?? 0);

    const dur = params.duration ?? 0.10;
    const vol = params.volume ?? 0.10;
    const tint = params.tint ?? 0.0;

    const sr = ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * dur));
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);

    let prev = 0;
    for (let i=0;i<len;i++) {
      const w = (this._rand()*2 - 1);
      prev = prev + tint * (w - prev);
      data[i] = (1 - tint) * w + tint * prev;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const gain = ctx.createGain();
    const attack = params.attack ?? 0.002;
    const decay  = params.decay  ?? Math.max(0.02, dur - attack);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

    src.connect(gain);
    gain.connect(this._compressor);

    src.start(t0);
    src.stop(t0 + dur);
  }

  // Convenience helpers
  chord({ freqs = [440, 550], duration = 0.10, type = 'square', volume = 0.08, spreadCents = 3, delay = 0 } = {}) {
    // Play multiple tones at the same start time, slight detune spread for width
    for (let i=0;i<freqs.length;i++) {
      this.tone({
        freq: freqs[i],
        duration,
        type,
        volume,
        jitter: 0,
        detune: (i - (freqs.length-1)/2) * spreadCents,
        delay,
      });
    }
  }

  arp({ base = 440, ratios = [1, 5/4, 3/2, 2], stepMs = 45, type = 'square', volume = 0.10, duration = 0.05, delay = 0 } = {}) {
    // Tiny arpeggio (NES-ish “jingle”)
    for (let i=0;i<ratios.length;i++) {
      this.tone({
        freq: base * ratios[i],
        duration,
        type,
        volume,
        jitter: 6,
        delay: delay + (i * stepMs) / 1000,
      });
    }
  }

  play(bank, name, payload = {}) {
    if (!this.enabled) return;
    const fn = bank?.[name];
    if (typeof fn === 'function') fn(this, payload);
  }

  // --- Internals ---

  _ensure() {
    if (this._ctx) return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this._ctx = new Ctx();

    // Mild compression makes cheap SFX feel punchier and prevents clipping
    this._compressor = this._ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -18;
    this._compressor.knee.value = 24;
    this._compressor.ratio.value = 6;
    this._compressor.attack.value = 0.003;
    this._compressor.release.value = 0.12;

    this._master = this._ctx.createGain();
    this._master.gain.value = this.enabled ? this.masterLevel : 0;

    this._compressor.connect(this._master);
    this._master.connect(this._ctx.destination);
  }

  // Duty wave (approx NES pulse duty cycles). duty in [0.125, 0.25, 0.5]
  _getDutyWave(duty) {
    const d = duty;
    const key = `duty:${d}`;
    const cached = this._waves.get(key);
    if (cached) return cached;

    // Build a band-limited-ish pulse via Fourier partials.
    // This is not perfect, but sounds closer to NES pulse than a pure square.
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);

    for (let k=1;k<n;k++) {
      // Fourier series for pulse wave: (2/k*pi) * sin(k*pi*d)
      const amp = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
      imag[k] = amp;
      real[k] = 0;
    }

    const wave = this._ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    this._waves.set(key, wave);
    return wave;
  }
}
```

---

## 4) Sound bank patterns

A bank is just a map of event names → functions.

Shape:

```js
export const BANK_EXAMPLE = {
  move:   (sfx, p) => { ... },
  rotate: (sfx, p) => { ... },
  lock:   (sfx, p) => { ... },
  clear:  (sfx, p) => { ... },
  chain:  (sfx, p) => { ... },
  gameOver:(sfx,p)=> { ... },
};
```

Notes:
- Keep volumes low (0.06–0.16) and let the compressor help.
- Use `jitter` (± cents) to add life.
- For chain sounds, scale pitch by `chain` (or by cleared size).

---

## 5) Sound palettes

### A) Puzzle Fighter palette (arcade / sparkly)

Design goals:
- Feels “arcade”, a bit sharper than Puyo.
- Crash/clear is energetic.

```js
export const BANK_PUZZLEFIGHTER = {
  move: (sfx) => {
    sfx.tone({ freq: 180, type: 'square', duty: 0.25, duration: 0.03, volume: 0.08, jitter: 8 });
  },

  rotate: (sfx) => {
    sfx.tone({ freq: 520, type: 'square', duty: 0.125, duration: 0.035, volume: 0.10, jitter: 10 });
  },

  lock: (sfx) => {
    // Low thud + tiny click
    sfx.tone({ freq: 120, type: 'triangle', duration: 0.06, volume: 0.14 });
    sfx.noise({ duration: 0.04, volume: 0.06, tint: 0.35, delay: 0.00 });
  },

  clear: (sfx, p) => {
    // Sparkle + snap. Scale with size if provided.
    const k = Math.min(1.8, 1 + ((p.cleared ?? 6) / 18));
    sfx.tone({ freq: 680 * k, type: 'square', duty: 0.25, duration: 0.05, volume: 0.12, jitter: 12, slideTo: 900*k, slideMs: 0.05 });
    sfx.noise({ duration: 0.06, volume: 0.05, tint: 0.10, delay: 0.01 });
  },

  chain: (sfx, p) => {
    // Short rising arp, stronger with chain index
    const ch = Math.max(2, p.chain ?? 2);
    const base = 360 * Math.pow(1.08, Math.min(10, ch));
    sfx.arp({ base, ratios: [1, 6/5, 3/2, 2], stepMs: 35, type: 'square', volume: 0.10, duration: 0.045 });
  },

  gameOver: (sfx) => {
    // Descending “wah‑wah” + noise tail
    sfx.tone({ freq: 220, type: 'sawtooth', duration: 0.25, volume: 0.10, slideTo: 110, slideMs: 0.25 });
    sfx.tone({ freq: 165, type: 'triangle', duration: 0.28, volume: 0.08, delay: 0.06, slideTo: 82, slideMs: 0.28 });
    sfx.noise({ duration: 0.22, volume: 0.06, tint: 0.0, delay: 0.10 });
  },
};
```

---

### B) Puyo Puyo palette (cute / bubbly)

Design goals:
- Softer waveforms (triangle/sine).
- Pop/chain has a “bouncy” musical feel.

```js
export const BANK_PUYO = {
  move: (sfx) => {
    sfx.tone({ freq: 240, type: 'triangle', duration: 0.03, volume: 0.07, jitter: 6 });
  },

  rotate: (sfx) => {
    sfx.tone({ freq: 420, type: 'triangle', duration: 0.035, volume: 0.08, jitter: 7 });
  },

  lock: (sfx) => {
    sfx.tone({ freq: 160, type: 'triangle', duration: 0.06, volume: 0.11 });
    sfx.noise({ duration: 0.03, volume: 0.04, tint: 0.55, delay: 0.00 });
  },

  clear: (sfx, p) => {
    // “bloop” up-gliss
    const n = (p.cleared ?? 4);
    const base = 520 + Math.min(220, n * 18);
    sfx.tone({ freq: base, type: 'sine', duration: 0.07, volume: 0.11, jitter: 6, slideTo: base * 1.35, slideMs: 0.07 });
  },

  chain: (sfx, p) => {
    // Classic: chain step sounds climb
    const ch = Math.max(2, p.chain ?? 2);
    const base = 520 * Math.pow(1.06, Math.min(12, ch));
    sfx.arp({ base, ratios: [1, 5/4, 3/2], stepMs: 38, type: 'triangle', volume: 0.10, duration: 0.055 });
  },

  gameOver: (sfx) => {
    // Sad slide down
    sfx.tone({ freq: 260, type: 'triangle', duration: 0.32, volume: 0.10, slideTo: 130, slideMs: 0.32 });
    sfx.noise({ duration: 0.18, volume: 0.04, tint: 0.35, delay: 0.10 });
  },
};
```

---

### C) Dr. Mario palette (NES‑ish / percussive)

Design goals:
- Pulse duty + triangle bass.
- Clears have a “ding” quality.

```js
export const BANK_DRMARIO = {
  move: (sfx) => {
    sfx.tone({ freq: 200, type: 'square', duty: 0.5, duration: 0.03, volume: 0.07, jitter: 4 });
  },

  rotate: (sfx) => {
    sfx.tone({ freq: 440, type: 'square', duty: 0.25, duration: 0.035, volume: 0.09, jitter: 5 });
  },

  lock: (sfx) => {
    // “clack” + light noise
    sfx.tone({ freq: 110, type: 'triangle', duration: 0.07, volume: 0.12 });
    sfx.tone({ freq: 330, type: 'square', duty: 0.125, duration: 0.03, volume: 0.06, delay: 0.01 });
    sfx.noise({ duration: 0.035, volume: 0.05, tint: 0.25, delay: 0.00 });
  },

  clear: (sfx, p) => {
    // Higher "ding" if viruses cleared (classic scoring cue)
    const v = (p.viruses ?? 0);
    const base = 660 + (v * 90);
    sfx.tone({ freq: base, type: 'square', duty: 0.25, duration: 0.09, volume: 0.11, jitter: 4 });
    sfx.tone({ freq: base * 1.5, type: 'triangle', duration: 0.06, volume: 0.06, delay: 0.00 });
  },

  chain: (sfx, p) => {
    // A short NES-ish success jingle that rises with chain index
    const ch = Math.max(2, p.chain ?? 2);
    const base = 440 * Math.pow(1.07, Math.min(10, ch));
    sfx.arp({ base, ratios: [1, 5/4, 3/2, 2], stepMs: 42, type: 'square', volume: 0.10, duration: 0.06 });
  },

  gameOver: (sfx) => {
    // Descending tri + pulse “buuuh”
    sfx.tone({ freq: 196, type: 'triangle', duration: 0.40, volume: 0.11, slideTo: 98, slideMs: 0.40 });
    sfx.tone({ freq: 146, type: 'square', duty: 0.5, duration: 0.32, volume: 0.07, delay: 0.06, slideTo: 73, slideMs: 0.32 });
    sfx.noise({ duration: 0.20, volume: 0.05, tint: 0.10, delay: 0.12 });
  },
};
```

---

## 6) Quick tuning guide

If it feels too harsh:
- lower `volume` (try 0.06–0.10)
- use `triangle` more, `sawtooth` less
- increase `attack` slightly (0.003–0.006)

If it clicks:
- ensure `attack >= 0.0015`
- don’t set gain to 0 exactly; use 0.0001 then exponential ramps

If it’s too repetitive:
- add `jitter: 5..12` cents on key sounds
- slightly randomize `freq` with a small multiplier

---

## 7) Minimal integration checklist

1. Create `SfxEngine` instance at startup.
2. Call `sfx.unlock()` on first gesture.
3. In your update loop, drain rule-engine effects.
4. Map effects → bank events.
5. Pass payload data (chain index, cleared size, viruses cleared) so sounds scale.



## 8) Simple Soundboard test page (HTML)

A soundoard page is a quick way to audition your banks and tune volumes/pitches without running the full game.

### File layout

- `soundboard.html` (soundboard UI)
- `sfx_engine.js` (the engine + exported banks)

> Note: because `type="module"` uses ES module imports, you’ll usually need to run a tiny local server (not `file://`).

Examples:
- Python: `python -m http.server 8080`
- Node: `npx serve .`

Then open `http://localhost:8080`.

### Optional: add a master-volume setter to `SfxEngine`

If you want the soundboard to adjust volume cleanly, add this method to your class:

```js
setMaster(level) {
  this.masterLevel = Math.max(0, Math.min(1, level));
  if (!this._ctx) return;           // not created yet
  if (!this._master) return;        // not created yet
  this._master.gain.value = this.enabled ? this.masterLevel : 0;
}
```

### `soundboard.html` (single-file soundboard)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chiptune SFX Soundboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 18px; background: #0f1117; color: #e7eaf0; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0; align-items: center; }
    button { padding: 10px 12px; border: 0; border-radius: 10px; background: #2a3142; color: #e7eaf0; cursor: pointer; }
    button:hover { background: #39425a; }
    button.primary { background: #3b62ff; }
    button.primary:hover { background: #2f56f0; }
    label { display: inline-flex; gap: 8px; align-items: center; }
    select, input { padding: 8px 10px; border-radius: 10px; border: 1px solid #3a4256; background: #141827; color: #e7eaf0; }
    input[type="range"] { padding: 0; }
    .panel { border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 14px; background: rgba(255,255,255,0.04); }
    .muted { color: rgba(231,234,240,0.65); }
    code { color: #b7c6ff; }
  </style>
</head>
<body>
  <h1 style="margin:0 0 6px;">Chiptune SFX Soundboard</h1>
  <div class="muted">Pick a bank, unlock audio (required by browsers), then press buttons to test SFX.</div>

  <div class="panel" style="margin-top:14px;">
    <div class="row">
      <button id="unlock" class="primary">Unlock / Enable Audio</button>

      <label>
        Bank
        <select id="bank">
          <option value="PF">Puzzle Fighter</option>
          <option value="PUYO">Puyo Puyo</option>
          <option value="DR">Dr. Mario</option>
        </select>
      </label>

      <label>
        Master
        <input id="master" type="range" min="0" max="1" step="0.01" value="0.60" />
      </label>

      <label>
        <input id="enabled" type="checkbox" checked /> Enabled
      </label>
    </div>

    <div class="row">
      <label>chain <input id="chain" type="number" min="1" max="20" value="2" style="width:76px;"></label>
      <label>cleared <input id="cleared" type="number" min="0" max="60" value="8" style="width:76px;"></label>
      <label>viruses <input id="viruses" type="number" min="0" max="6" value="2" style="width:76px;"></label>
      <span class="muted">(payload fields are optional; banks ignore what they don’t use)</span>
    </div>

    <div class="row">
      <button data-sfx="move">move</button>
      <button data-sfx="rotate">rotate</button>
      <button data-sfx="lock">lock</button>
      <button data-sfx="clear">clear</button>
      <button data-sfx="chain">chain</button>
      <button data-sfx="gameOver">game over</button>
    </div>

    <div class="muted" style="margin-top:10px;">
      Tip: If you don’t hear anything, click <code>Unlock / Enable Audio</code> again (some browsers suspend audio after tab switches).
    </div>
  </div>

  <script type="module">
    import { SfxEngine, BANK_PUZZLEFIGHTER, BANK_PUYO, BANK_DRMARIO } from './sfx_engine.js';

    const sfx = new SfxEngine({ master: 0.6 });

    const elUnlock = document.querySelector('#unlock');
    const elBank = document.querySelector('#bank');
    const elMaster = document.querySelector('#master');
    const elEnabled = document.querySelector('#enabled');
    const elChain = document.querySelector('#chain');
    const elCleared = document.querySelector('#cleared');
    const elViruses = document.querySelector('#viruses');

    function currentBank() {
      switch (elBank.value) {
        case 'PF': return BANK_PUZZLEFIGHTER;
        case 'PUYO': return BANK_PUYO;
        case 'DR': return BANK_DRMARIO;
      }
    }

    function payload() {
      return {
        chain: Number(elChain.value) || 1,
        chainIndex: Number(elChain.value) || 1, // some of your code may use chainIndex
        cleared: Number(elCleared.value) || 0,
        viruses: Number(elViruses.value) || 0,
      };
    }

    // Unlock
    elUnlock.addEventListener('click', () => {
      sfx.unlock();
    });

    // Master volume (requires setMaster; otherwise this fallback nudges internals for test-only)
    elMaster.addEventListener('input', () => {
      const v = Number(elMaster.value);
      if (typeof sfx.setMaster === 'function') sfx.setMaster(v);
      else {
        sfx.masterLevel = v;
        if (sfx._master) sfx._master.gain.value = sfx.enabled ? v : 0; // test harness fallback
      }
    });

    elEnabled.addEventListener('change', () => sfx.setEnabled(elEnabled.checked));

    // Buttons
    document.querySelectorAll('button[data-sfx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-sfx');
        sfx.play(currentBank(), name, payload());
      });
    });

    // Handy keyboard shortcuts (optional)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === ' ') { sfx.play(currentBank(), 'lock', payload()); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') sfx.play(currentBank(), 'move', payload());
      if (e.key === 'ArrowUp') sfx.play(currentBank(), 'rotate', payload());
      if (e.key.toLowerCase() === 'c') sfx.play(currentBank(), 'clear', payload());
      if (e.key.toLowerCase() === 'x') sfx.play(currentBank(), 'chain', payload());
      if (e.key.toLowerCase() === 'g') sfx.play(currentBank(), 'gameOver', payload());
    });

    // Auto-unlock on first click anywhere (nice QoL)
    window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
  </script>
</body>
</html>
```

### Quick workflow for tuning

1. Start the server (`python -m http.server 8080`).
2. Open the page.
3. Pick a bank.
4. Click **Unlock**.
5. Tap `rotate/move/lock/clear/chain` and adjust:
   - `master`
   - per-bank `volume`
   - per-bank `freq` and `duration`
   - `jitter` and `duty` for character
