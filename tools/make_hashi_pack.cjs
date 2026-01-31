const fs = require('node:fs');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

const BASE_SEED = 'HASHI_PACK_V1';
const DEFAULT_TARGET_COUNT = 50;
const DEFAULT_THREADS = 4;
const DEFAULT_OUT = path.resolve(__dirname, '..', 'hashi_pack_output.js');

const PRESETS = {
  easy: { w: [9, 12], h: [9, 12], islands: [10, 18], dbl: [0.05, 0.18], tries: 140 },
  medium: { w: [12, 16], h: [12, 16], islands: [18, 30], dbl: [0.12, 0.28], tries: 220 },
  hard: { w: [16, 22], h: [16, 22], islands: [28, 48], dbl: [0.2, 0.4], tries: 320 },
};

const TARGET_COUNTS = {
  easy: DEFAULT_TARGET_COUNT,
  medium: DEFAULT_TARGET_COUNT,
  hard: DEFAULT_TARGET_COUNT,
};

function loadGenerator() {
  const localPath = path.resolve(__dirname, '..', '..', 'bridges-generator', 'lib', 'index.cjs.js');
  if (fs.existsSync(localPath)) {
    return require(localPath);
  }
  return require('bridges-generator');
}

const { generate } = loadGenerator();

function hash32FNV1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seedU32) {
  let a = seedU32 >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromSeed(seedString) {
  return mulberry32(hash32FNV1a(seedString));
}

function withSeededMathRandom(rng, fn) {
  const old = Math.random;
  Math.random = rng;
  try {
    return fn();
  } finally {
    Math.random = old;
  }
}

function pickInt(rng, [a, b]) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pickFloat(rng, [a, b]) {
  return a + rng() * (b - a);
}

function puzzleFromMatrix(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const islands = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const v = grid[r][c] | 0;
      if (v > 0) islands.push({ r, c, target: v });
    }
  }
  return { w, h, islands };
}

function canonicalizeIslands(w, islands) {
  return islands
    .map((island) => ({
      r: Math.max(0, Math.floor(island.r)),
      c: Math.max(0, Math.floor(island.c)),
      target: Math.max(0, Math.floor(island.target)),
    }))
    .sort((a, b) => (a.r * w + a.c) - (b.r * w + b.c));
}

function encodeTR1(puzzleIR) {
  const w = puzzleIR.w;
  const h = puzzleIR.h;
  const posMap = new Map();
  for (const island of puzzleIR.islands) {
    posMap.set(island.r * w + island.c, island.target);
  }
  const total = w * h;
  let t = 0;
  let out = '';
  while (t < total) {
    if (posMap.has(t)) {
      out += String(posMap.get(t));
      t += 1;
      continue;
    }
    let run = 0;
    while (t < total && !posMap.has(t) && run < 26) {
      run += 1;
      t += 1;
    }
    out += String.fromCharCode(96 + run);
  }
  return `TR1:${w.toString(36)}x${h.toString(36)}:${out}`;
}

function looksReasonable(puzzleIR) {
  if (!puzzleIR || puzzleIR.islands.length < 2) return false;
  for (const isl of puzzleIR.islands) {
    if (isl.target < 1 || isl.target > 8) return false;
  }
  return true;
}

function parseArg(name, fallback) {
  const arg = process.argv.find((v) => v.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = Number.parseInt(arg.split('=')[1], 10);
  return Number.isFinite(value) ? value : fallback;
}

function parseStringArg(name, fallback) {
  const arg = process.argv.find((v) => v.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = arg.slice(`--${name}=`.length).trim();
  return value || fallback;
}

function generateEntryForIndex(diff, index, maxTries, seenCodes) {
  const preset = PRESETS[diff];
  const seedBase = `${BASE_SEED}|${diff}|${String(index).padStart(4, '0')}`;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const seed = `${seedBase}|try:${attempt}`;
    const rng = rngFromSeed(seed);
    const rows = pickInt(rng, preset.h);
    const cols = pickInt(rng, preset.w);
    const islandsCount = pickInt(rng, preset.islands);
    const dbl = pickFloat(rng, preset.dbl);

    let generated;
    try {
      generated = withSeededMathRandom(rng, () => generate(rows, cols, islandsCount, dbl));
    } catch {
      continue;
    }
    if (!generated || !generated.puzzle) continue;
    const puzzleIR = puzzleFromMatrix(generated.puzzle);
    puzzleIR.islands = canonicalizeIslands(puzzleIR.w, puzzleIR.islands);
    if (!looksReasonable(puzzleIR)) continue;

    const code = encodeTR1(puzzleIR);
    if (seenCodes && seenCodes.has(code)) continue;

    return {
      index,
      code,
      meta: { rows, cols, islands: islandsCount, dbl, seed },
    };
  }
  return null;
}

function runWorker() {
  const { diff, start, count, maxTries } = workerData;
  const results = [];
  for (let i = 0; i < count; i++) {
    const index = start + i;
    const entry = generateEntryForIndex(diff, index, maxTries, null);
    if (!entry) {
      throw new Error(`Failed to generate puzzle index ${index}`);
    }
    results.push(entry);
    if ((i + 1) % 10 === 0 || i + 1 === count) {
      parentPort.postMessage({ type: 'progress', done: i + 1, total: count, diff });
    }
  }
  parentPort.postMessage({ type: 'done', results, diff });
}

async function generateBatch(diff, startIndex, needed, maxTries, threadCount) {
  if (needed <= 0) return [];
  const perThread = Math.ceil(needed / threadCount);
  const workers = [];
  let completed = 0;

  for (let t = 0; t < threadCount; t++) {
    const start = startIndex + t * perThread;
    const count = Math.min(perThread, needed - t * perThread);
    if (count <= 0) continue;
    workers.push(new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { diff, start, count, maxTries } });
      worker.on('message', (msg) => {
        if (msg.type === 'progress') return;
        if (msg.type === 'done') {
          completed += msg.results.length;
          console.log(`${diff}: ${startIndex + completed}/${startIndex + needed}`);
          resolve(msg.results);
        }
      });
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
      });
    }));
  }

  const results = (await Promise.all(workers)).flat();
  results.sort((a, b) => a.index - b.index);
  return results;
}

async function runMain() {
  const args = process.argv.slice(2);
  const diffArg = args.find((arg) => !arg.startsWith('--')) || 'all';
  const targetOverride = parseArg('count', null);
  const threads = parseArg('threads', DEFAULT_THREADS);
  const triesOverride = parseArg('tries', null);
  const startOverride = parseArg('start', 0);
  const outArg = parseStringArg('out', DEFAULT_OUT);

  const outPath = path.resolve(outArg);
  const packs = { easy: [], medium: [], hard: [] };
  const seenCodes = new Set();

  const diffs = diffArg === 'all' ? Object.keys(PRESETS) : [diffArg];
  for (const diff of diffs) {
    if (!PRESETS[diff]) {
      console.warn(`Unknown difficulty: ${diff}`);
      continue;
    }
    const preset = PRESETS[diff];
    const target = Number.isFinite(targetOverride) ? targetOverride : TARGET_COUNTS[diff];
    const maxTries = Number.isFinite(triesOverride) ? triesOverride : preset.tries;
    const needed = Math.max(0, target);
    if (needed === 0) continue;

    const startIndex = Number.isFinite(startOverride) ? startOverride : 0;
    const results = await generateBatch(diff, startIndex, needed, maxTries, threads);
    const unique = [];
    for (const entry of results) {
      if (seenCodes.has(entry.code)) continue;
      seenCodes.add(entry.code);
      unique.push(entry);
    }

    let index = startIndex + needed;
    let extras = 0;
    const maxExtra = needed * 3;
    while (unique.length < needed && extras < maxExtra) {
      const entry = generateEntryForIndex(diff, index, maxTries, seenCodes);
      index += 1;
      extras += 1;
      if (!entry) continue;
      if (seenCodes.has(entry.code)) continue;
      seenCodes.add(entry.code);
      unique.push(entry);
      if (unique.length % 10 === 0 || unique.length === needed) {
        console.log(`${diff}: ${existingCount + unique.length}/${target} (top-up)`);
      }
    }

    if (unique.length < needed) {
      throw new Error(`Only generated ${unique.length}/${target} puzzles for ${diff}`);
    }

    unique.sort((a, b) => a.index - b.index);
    for (let i = 0; i < needed; i++) {
      const entry = unique[i];
      const index = i;
      packs[diff].push({
        id: `${diff[0].toUpperCase()}${String(index + 1).padStart(4, '0')}`,
        name: `${diff[0].toUpperCase()}${diff.slice(1)} ${String(index + 1).padStart(3, '0')}`,
        code: entry.code,
        meta: entry.meta,
      });
    }
  }

  const output = `export const HASHI_PACKS = ${JSON.stringify(packs, null, 2)};\n`;
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`Wrote ${outPath}`);
}

if (isMainThread) {
  runMain().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  runWorker();
}
