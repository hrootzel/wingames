// Hackerman — Mastermind / Bulls & Cows (no external libs)
// Assumptions:
// - Code length fixed at 4 (classic Mastermind & common Bulls/Cows)
// - Colors mode: 6 colors, repeats allowed (classic)
// - Digits mode: digits 0-9, repeats NOT allowed (classic Bulls & Cows)

const CODE_LEN = 4;

const COLORS = [
  { id: 0, name: "Red", hex: "#e53935" },
  { id: 1, name: "Blue", hex: "#1e88e5" },
  { id: 2, name: "Green", hex: "#43a047" },
  { id: 3, name: "Yellow", hex: "#fdd835" },
  { id: 4, name: "White", hex: "#f5f5f5" },
  { id: 5, name: "Black", hex: "#1e1e1e" },
];

const DEFAULT_SETTINGS = {
  mode: "colors",    // "colors" | "digits"
  theme: "dark",     // "dark" | "light"
  rows: 12,
};

const STORAGE_KEY = "hackerman_settings_v1";

let settings = loadSettings();
let state = null;
let lastStatusEnded = false;
let lastSecretRevealed = false;

// ---------- Utilities ----------
function $(sel){ return document.querySelector(sel); }

function popcount(x){
  let c = 0;
  while (x){ x &= x-1; c++; }
  return c;
}

function randInt(n){ return Math.floor(Math.random()*n); }

function shuffle(a){
  for (let i=a.length-1;i>0;i--){
    const j = randInt(i+1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hexToRgb(hex){
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned;
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function shadeHex(hex, amount){
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = amount < 0 ? 0 : 255;
  const p = Math.min(1, Math.max(0, Math.abs(amount)));
  const r = Math.round(rgb.r + (t - rgb.r) * p);
  const g = Math.round(rgb.g + (t - rgb.g) * p);
  const b = Math.round(rgb.b + (t - rgb.b) * p);
  return `rgb(${r}, ${g}, ${b})`;
}

function setDotColorVars(el, hex){
  el.style.setProperty('--dot-base', hex);
  el.style.setProperty('--dot-light', shadeHex(hex, 0.45));
  el.style.setProperty('--dot-dark', shadeHex(hex, -0.35));
}

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>t.classList.remove("show"), 1400);
}

function pulseElement(el){
  if (!el) return;
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}

// ---------- Persistence ----------
function loadSettings(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      mode: (parsed.mode === "digits" ? "digits" : "colors"),
      theme: (parsed.theme === "light" ? "light" : "dark"),
      rows: clampInt(parsed.rows, 6, 20, DEFAULT_SETTINGS.rows),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clampInt(v, lo, hi, fallback){
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// ---------- Game state ----------
function newGame(){
  const secret = (settings.mode === "colors")
    ? genSecretColors()
    : genSecretDigits();

  state = {
    secret,
    guesses: Array.from({length: settings.rows}, () => Array(CODE_LEN).fill(null)),
    feedback: Array.from({length: settings.rows}, () => null),
    row: 0,
    activePos: 0,
    selectedInput: null, // colors: color id; digits: digit
    ended: false,
    won: false,
  };

  renderAll();
  scrollToTopRow();
  updateSecretDisplay(false);
  updateStatus();
  toast("NEW SESSION: CONNECTED");
}

function genSecretColors(){
  const out = [];
  for (let i=0;i<CODE_LEN;i++) out.push(COLORS[randInt(COLORS.length)].id);
  return out;
}

function genSecretDigits(){
  // Classic Bulls & Cows typically uses unique digits.
  const digits = shuffle([0,1,2,3,4,5,6,7,8,9]);
  return digits.slice(0, CODE_LEN);
}

// ---------- Evaluation ----------
// Returns {bulls, cows} where:
// - bulls = correct symbol in correct position
// - cows  = correct symbol wrong position
function evaluate(guess, secret){
  let bulls = 0;
  const gRem = [];
  const sRem = [];

  for (let i=0;i<CODE_LEN;i++){
    if (guess[i] === secret[i]) bulls++;
    else {
      gRem.push(guess[i]);
      sRem.push(secret[i]);
    }
  }

  // Count cows via frequency
  const freq = new Map();
  for (const v of sRem) freq.set(v, (freq.get(v) || 0) + 1);

  let cows = 0;
  for (const v of gRem){
    const n = freq.get(v) || 0;
    if (n > 0){
      cows++;
      freq.set(v, n-1);
    }
  }

  return { bulls, cows };
}

// Mastermind display: black pegs = bulls; white pegs = cows
function feedbackToPegs({bulls, cows}){
  const pegs = [];
  for (let i=0;i<bulls;i++) pegs.push("black");
  for (let i=0;i<cows;i++) pegs.push("white");
  while (pegs.length < 4) pegs.push("empty");
  return pegs;
}

// ---------- Input rules ----------
function canEditRow(r){ return !state.ended && r === state.row; }

function setActivePos(i){
  if (state.ended) return;
  state.activePos = i;
  renderBoard();
}

function placeValue(value){
  if (state.ended) return;
  const r = state.row;
  const pos = state.activePos;

  if (!canEditRow(r)) return;

  const rowArr = state.guesses[r];

  // Toggle: if same already in position, remove
  if (rowArr[pos] === value){
    rowArr[pos] = null;
    renderBoard();
    updateStatus();
    return;
  }

  // Digits mode: prevent duplicate digits in the row (classic Bulls & Cows)
  if (settings.mode === "digits"){
    if (rowArr.includes(value)){
      toast("DUPLICATE DIGIT BLOCKED");
      return;
    }
  }

  rowArr[pos] = value;
  state.activePos = nextEditablePos(rowArr, pos);
  renderBoard();
  updateStatus();
}

function nextEditablePos(rowArr, from){
  // Next empty slot after 'from', else first empty, else keep last
  for (let i=from+1;i<CODE_LEN;i++) if (rowArr[i] == null) return i;
  for (let i=0;i<CODE_LEN;i++) if (rowArr[i] == null) return i;
  return from;
}

function backspace(){
  if (state.ended) return;
  const r = state.row;
  const rowArr = state.guesses[r];
  // Remove from active position if filled, else step backward to last filled
  if (rowArr[state.activePos] != null){
    rowArr[state.activePos] = null;
  } else {
    for (let i=state.activePos-1;i>=0;i--){
      if (rowArr[i] != null){
        rowArr[i] = null;
        state.activePos = i;
        break;
      }
    }
  }
  renderBoard();
  updateStatus();
}

function clearRow(){
  if (state.ended) return;
  const r = state.row;
  state.guesses[r] = Array(CODE_LEN).fill(null);
  state.activePos = 0;
  renderBoard();
  updateStatus();
}

function rowComplete(rowArr){
  return rowArr.every(v => v != null);
}

function submit(){
  if (state.ended) return;

  const r = state.row;
  const g = state.guesses[r];
  if (!rowComplete(g)){
    toast("INCOMPLETE GUESS");
    return;
  }

  const fb = evaluate(g, state.secret);
  state.feedback[r] = fb;

  if (fb.bulls === CODE_LEN){
    state.ended = true;
    state.won = true;
    updateSecretDisplay(true);
    renderBoard();
    updateStatus();
    toast("ACCESS GRANTED");
    return;
  }

  if (r === settings.rows - 1){
    state.ended = true;
    state.won = false;
    updateSecretDisplay(true);
    renderBoard();
    updateStatus();
    toast("ACCESS DENIED");
    return;
  }

  // advance row
  state.row++;
  state.activePos = 0;
  renderBoard();
  ensureActiveRowVisible();
  updateStatus();
}

function revealAndEnd(){
  if (state.ended) return;
  state.ended = true;
  state.won = false;
  updateSecretDisplay(true);
  renderBoard();
  updateStatus();
  toast("SESSION TERMINATED");
}

// ---------- Rendering ----------
function renderAll(){
  applyTheme();
  $("#modeLabel").textContent = `MODE: ${settings.mode.toUpperCase()}`;
  $("#rowsLabel").textContent = String(settings.rows);
  renderBoard();
  renderControls();
  updateHelp();
}

function renderBoard(){
  const rowsEl = $("#rows");
  rowsEl.innerHTML = "";

  for (let r=0;r<settings.rows;r++){
    const rowEl = document.createElement("div");
    rowEl.className = "row" + (r < state.row || state.ended ? " locked" : "");

    const slots = document.createElement("div");
    slots.className = "slots";

    for (let p=0;p<CODE_LEN;p++){
      const slot = document.createElement("div");
      slot.className = "slot";
      const editable = canEditRow(r);

      if (!editable) slot.classList.add("disabled");
      if (editable && p === state.activePos) slot.classList.add("active");

      const v = state.guesses[r][p];

      if (settings.mode === "digits"){
        const d = document.createElement("div");
        d.className = "digit";
        d.textContent = v == null ? "_" : String(v);
        slot.appendChild(d);
      } else {
        const dot = document.createElement("div");
        dot.className = "color";
        if (v == null) {
          dot.classList.add("empty");
        } else {
          setDotColorVars(dot, COLORS[v].hex);
        }
        slot.appendChild(dot);
      }

      slot.addEventListener("click", () => {
        if (!editable) return;
        setActivePos(p);
      });

      slots.appendChild(slot);
    }

    const fbEl = document.createElement("div");

    if (settings.mode === "colors"){
      fbEl.className = "feedback";
      const fb = state.feedback[r];
      const pegs = fb ? feedbackToPegs(fb) : ["empty","empty","empty","empty"];
      for (const kind of pegs){
        const peg = document.createElement("div");
        peg.className = "peg";
        if (kind === "black") peg.classList.add("black");
        else if (kind === "white") peg.classList.add("white");
        else peg.classList.add("empty");
        fbEl.appendChild(peg);
      }
    } else {
      fbEl.className = "fbText";
      const fb = state.feedback[r];
      fbEl.innerHTML = fb ? `Bulls: <b>${fb.bulls}</b><br/>Cows: <b>${fb.cows}</b>` : "&nbsp;";
    }

    rowEl.appendChild(slots);
    rowEl.appendChild(fbEl);
    rowsEl.appendChild(rowEl);
  }
}

function scrollToTopRow(){
  const scrollEl = document.querySelector(".scroll");
  if (scrollEl) scrollEl.scrollTop = 0;
}

function ensureActiveRowVisible(){
  const scrollEl = document.querySelector(".scroll");
  const rowsEl = $("#rows");
  if (!scrollEl || !rowsEl) return;
  const rowEl = rowsEl.children[state.row];
  if (!rowEl) return;
  const rowBottom = rowEl.offsetTop + rowEl.offsetHeight;
  const viewBottom = scrollEl.scrollTop + scrollEl.clientHeight;
  if (rowBottom > viewBottom - 4){
    scrollEl.scrollTop = rowBottom - scrollEl.clientHeight;
  }
}

function renderControls(){
  const root = $("#controlsMain");
  root.innerHTML = "";

  if (settings.mode === "colors"){
    const title = document.createElement("div");
    title.className = "mini";
    title.innerHTML = "Select a color, then tap a slot. Tap the same color in the same slot to remove.";
    root.appendChild(title);

    const palWrap = document.createElement("div");
    palWrap.className = "palette-wrap";

    const pal = document.createElement("div");
    pal.className = "palette";

    for (const c of COLORS){
      const sw = document.createElement("div");
        sw.className = "swatch";
        sw.title = c.name;
        sw.style.setProperty("--swatch-color", c.hex);

        if (state.selectedInput === c.id) sw.classList.add("active");

        sw.addEventListener("click", () => {
          if (state.ended) return;
          state.selectedInput = c.id;
          renderControls();
          // Place immediately into active position for speed.
          placeValue(c.id);
        });

      pal.appendChild(sw);
    }

    palWrap.appendChild(pal);

    const back = document.createElement("div");
    back.className = "key";
    back.textContent = "⌫";
    back.title = "Backspace";
    back.addEventListener("click", backspace);
    palWrap.appendChild(back);

    root.appendChild(palWrap);

  } else {
    const title = document.createElement("div");
    title.className = "mini";
    title.innerHTML = "Enter digits using the keypad. Digits are unique (no repeats).";
    root.appendChild(title);

    const pad = document.createElement("div");
    pad.className = "keypad";

    const keys = [1,2,3,4,5,6,7,8,9,0];
    for (const k of keys){
      const el = document.createElement("div");
      el.className = "key";
      el.textContent = String(k);

      const already = state.guesses[state.row].includes(k);
      if (!state.ended && already) el.classList.add("disabled");

      el.addEventListener("click", () => {
        if (state.ended) return;
        if (state.guesses[state.row].includes(k)){
          toast("DUPLICATE DIGIT BLOCKED");
          return;
        }
        placeValue(k);
      });

      pad.appendChild(el);
    }

    // Backspace key
    const bs = document.createElement("div");
    bs.className = "key";
    bs.textContent = "⌫";
    bs.title = "Backspace";
    bs.addEventListener("click", backspace);
    pad.appendChild(bs);

    // Jump to next/previous slot keys
    const prev = document.createElement("div");
    prev.className = "key";
    prev.textContent = "◀";
    prev.title = "Move left";
    prev.addEventListener("click", () => {
      if (state.ended) return;
      state.activePos = Math.max(0, state.activePos - 1);
      renderBoard();
    });
    pad.appendChild(prev);

    const next = document.createElement("div");
    next.className = "key";
    next.textContent = "▶";
    next.title = "Move right";
    next.addEventListener("click", () => {
      if (state.ended) return;
      state.activePos = Math.min(CODE_LEN - 1, state.activePos + 1);
      renderBoard();
    });
    pad.appendChild(next);

    root.appendChild(pad);
  }

  // Disable submit if ended
  $("#btn-submit").disabled = !!state.ended;
  $("#btn-clear").disabled = !!state.ended;
  $("#btn-reveal").disabled = !!state.ended;
}

function updateSecretDisplay(reveal){
  const el = $("#secretDisplay");
  if (!reveal){
    el.textContent = "\u2022".repeat(CODE_LEN);
    el.classList.remove("pulse");
    lastSecretRevealed = false;
    return;
  }

  if (settings.mode === "digits"){
    el.textContent = state.secret.join("");
  } else {
    // Render as colored dots
    el.innerHTML = "";
    for (const id of state.secret){
      const dot = document.createElement("span");
      dot.className = "secret-dot";
      setDotColorVars(dot, COLORS[id].hex);
      el.appendChild(dot);
    }
  }

  if (!lastSecretRevealed){
    pulseElement(el);
    lastSecretRevealed = true;
  }
}

function updateHelp(){
  const help = $("#helpText");
  if (settings.mode === "colors"){
    help.innerHTML = "Feedback: <b>black</b> = correct color & position. <b>white</b> = correct color wrong position.";
  } else {
    help.innerHTML = "Feedback: <b>Bulls</b> = correct digit & position. <b>Cows</b> = correct digit wrong position.";
  }
}

function updateStatus(){
  const s = $("#status");
  if (state.ended){
    if (state.won){
      s.textContent = "ACCESS GRANTED";
      s.classList.add("status-end", "status-win");
      s.classList.remove("status-lose");
    } else {
      s.textContent = "ACCESS DENIED";
      s.classList.add("status-end", "status-lose");
      s.classList.remove("status-win");
    }
    if (!lastStatusEnded){
      pulseElement(s);
      lastStatusEnded = true;
    }
    return;
  }

  s.classList.remove("status-end", "status-win", "status-lose", "pulse");
  lastStatusEnded = false;
  const g = state.guesses[state.row];
  const filled = g.filter(v => v != null).length;
  s.textContent = `row ${state.row+1}/${settings.rows} // ${filled}/${CODE_LEN} locked`;
}

function applyTheme(){
  document.body.dataset.theme = settings.theme;
  // Hacker-ish tagline shifts by theme
  $("#tagline").textContent = settings.theme === "dark"
    ? "// trace route: localhost → mainframe"
    : "// decrypt the pattern";
}

// ---------- Settings UI ----------
function openSettings(){
  syncSettingsFormFromState();
  $("#modal").classList.add("show");
}

function closeSettings(){
  $("#modal").classList.remove("show");
}

function syncSettingsFormFromState(){
  $("#sel-mode").value = settings.mode;
  $("#sel-theme").value = settings.theme;
  $("#rng-rows").value = String(settings.rows);
  $("#rowsVal").textContent = String(settings.rows);
}

function readSettingsForm(){
  const mode = $("#sel-mode").value === "digits" ? "digits" : "colors";
  const theme = $("#sel-theme").value === "light" ? "light" : "dark";
  const rows = clampInt($("#rng-rows").value, 6, 20, DEFAULT_SETTINGS.rows);
  return { mode, theme, rows };
}

function applySettings(next, startNew=false){
  const modeChanged = next.mode !== settings.mode;
  const rowsChanged = next.rows !== settings.rows;
  const themeChanged = next.theme !== settings.theme;

  settings = next;
  saveSettings();
  applyTheme();

  if (themeChanged){
    toast("THEME UPDATED");
  }

  // If mode/rows changed, the current board shape/secret changes. Start a new game.
  if (startNew || modeChanged || rowsChanged){
    newGame();
  } else {
    renderAll();
  }
}

// ---------- Event wiring ----------
function wireUI(){
  $("#btn-settings").addEventListener("click", openSettings);
  $("#btn-close").addEventListener("click", closeSettings);

  $("#btn-new").addEventListener("click", () => {
    newGame();
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  });
  $("#btn-submit").addEventListener("click", submit);
  $("#btn-clear").addEventListener("click", clearRow);
  $("#btn-reveal").addEventListener("click", revealAndEnd);

  // Modal background click closes
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeSettings();
  });

  $("#rng-rows").addEventListener("input", () => {
    $("#rowsVal").textContent = String($("#rng-rows").value);
  });

  $("#btn-apply").addEventListener("click", () => {
    const next = readSettingsForm();
    applySettings(next, false);
    closeSettings();
  });

  $("#btn-apply-new").addEventListener("click", () => {
    const next = readSettingsForm();
    applySettings(next, true);
    closeSettings();
  });

  $("#btn-reset").addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    applyTheme();
    syncSettingsFormFromState();
    newGame();
    toast("DEFAULTS RESTORED");
  });

  // Keyboard support (nice on desktop)
  window.addEventListener("keydown", (e) => {
    if (!state || state.ended) return;
    if ($("#modal").classList.contains("show")) return;

    if (settings.mode === "digits"){
      if (e.key >= "0" && e.key <= "9"){
        const d = Number(e.key);
        if (state.guesses[state.row].includes(d)) { toast("DUPLICATE DIGIT BLOCKED"); return; }
        placeValue(d);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete"){
        backspace();
        e.preventDefault();
        return;
      }
    } else {
      if (e.key >= "1" && e.key <= "6"){
        const idx = Number(e.key) - 1;
        if (COLORS[idx]){
          state.selectedInput = idx;
          renderControls();
          placeValue(idx);
        }
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete"){
        backspace();
        e.preventDefault();
        return;
      }
    }

    if (e.key === "Enter"){
      submit();
      e.preventDefault();
      return;
    }

    if (e.key === "Escape"){
      clearRow();
      return;
    }

    if (e.key === "ArrowLeft"){
      state.activePos = Math.max(0, state.activePos - 1);
      renderBoard();
      return;
    }

    if (e.key === "ArrowRight"){
      state.activePos = Math.min(CODE_LEN - 1, state.activePos + 1);
      renderBoard();
      return;
    }
  });
}

// ---------- Boot ----------
function boot(){
  applyTheme();
  wireUI();

  // Initialize modal form with settings
  syncSettingsFormFromState();

  // Label top bar
  $("#rowsLabel").textContent = String(settings.rows);

  newGame();
}

boot();



