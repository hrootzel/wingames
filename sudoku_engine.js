export const DIFF_PROFILE = {
  easy: {
    minClues: 31,
    maxClues: 37,
    minLevel: 2,
    maxLevel: 2,
    targetLevel: 2,
    minScore: 78,
    maxScore: 190,
    targetScore: 125,
    minNonSingleSteps: 1,
    minAdvancedSteps: 0,
    maxAttempts: 600,
    poolSize: 2,
  },
  medium: {
    minClues: 29,
    maxClues: 35,
    minLevel: 2,
    maxLevel: 3,
    targetLevel: 3,
    minScore: 120,
    maxScore: 310,
    targetScore: 205,
    minNonSingleSteps: 2,
    minAdvancedSteps: 0,
    maxAttempts: 600,
    poolSize: 8,
  },
  hard: {
    minClues: 25,
    maxClues: 32,
    minLevel: 4,
    maxLevel: 5,
    targetLevel: 4,
    minScore: 205,
    maxScore: 560,
    targetScore: 335,
    minNonSingleSteps: 5,
    minAdvancedSteps: 1,
    maxAttempts: 360,
    poolSize: 3,
  },
  extreme: {
    minClues: 22,
    maxClues: 29,
    minLevel: 5,
    maxLevel: 7,
    targetLevel: 5,
    minScore: 305,
    maxScore: 920,
    targetScore: 470,
    minNonSingleSteps: 7,
    minAdvancedSteps: 2,
    maxAttempts: 360,
    poolSize: 6,
  },
};


const CERTIFIED_FALLBACKS = {
  easy: [
    ['000000050060034100900201080070500802300000000095000700051069000236010970080027501', '127986354568734129943251687674593812312678495895142736751869243236415978489327561'],
    ['960000700105000040370000100809006070037050000256700008001300820720080610008610000', '964125783185973246372864159819436572437258961256791438691347825723589614548612397'],
    ['945000100000000000167904580406200910009410000000300005010700000000009421004601758', '945863172382175694167924583436258917859417236721396845518742369673589421294631758'],
    ['000530600320700000000028039005007200008002105234005006400050061190870000003010080', '849531627326749518751628439615487293978362145234195876487253961192876354563914782'],
  ],
  medium: [
    ['709310008000900027040050000600080274003009850000240039080006700100007000904000300', '769312548538964127241758963695183274423679851817245639382496715156837492974521386'],
    ['000009001329816050000400000075000130090007006830500090540000809000704000000090240', '458279361329816457167435928675982134291347586834561792546123879982754613713698245'],
    ['003008490029700010008900050084000600900060005050873040000009060002000000100427008', '573618492429735816618942357784591623931264785256873149847359261392186574165427938'],
    ['500900103000580600000300850036009420700003001000400700409102000300000240850000010', '584926173213587694697341852136879425745263981928415736479132568361758249852694317'],
  ],
  hard: [
    ['015200800000060709000000004200630900060000007000801640500000108370089005000520070', '915274836482365719637918524248637951169452387753891642526743198374189265891526473'],
    ['603000000000000100508600004380000000006050030140260800030009020201407000007000000', '673145289492738165518692374385971642726854931149263857834519726261487593957326418'],
    ['700093000000000007083001900000002005090600080301000000850000046400000208000045790', '765493812914268537283751964648912375592637481371584629857329146439176258126845793'],
    ['390604007070500000800701600100902000030840071400000000600037089010000030000400700', '391624857276583194854791623168972345935846271427315968642137589719258436583469712'],
  ],
  extreme: [
    ['600000002050860003200701800300009000106050000098000030800903100000000000005410009', '681534792957862413243791856374289561126357984598146237862973145419625378735418629'],
    ['002000000600400080050090006008000002000150060901048050000061400730009000000300000', '382615794619472583457893216578936142243157968961248357825761439734589621196324875'],
    ['400090000090800503050040089004509200020000400080600000562030010030006000000050002', '478395621291867543356142789714589236625713498983624175562438917139276854847951362'],
    ['009100054850000000004000380700020000008040000000900700007500042000068007180400005', '379182654851634279264759381716825493928347516543916728637591842495268137182473965'],
  ],
};

export const ALL_MASK = (1 << 9) - 1;

export function idx(r, c) {
  return r * 9 + c;
}

export function row(i) {
  return Math.floor(i / 9);
}

export function col(i) {
  return i % 9;
}

export function boxIndex(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

export function bit(d) {
  return 1 << (d - 1);
}

export function popcount(x) {
  let count = 0;
  let value = x;
  while (value) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

export function firstDigit(mask) {
  return Math.floor(Math.log2(mask)) + 1;
}

export function maskToDigits(mask) {
  const out = [];
  for (let d = 1; d <= 9; d++) {
    if (mask & bit(d)) out.push(d);
  }
  return out;
}

export const ROWS = Array.from({ length: 9 }, () => []);
export const COLS = Array.from({ length: 9 }, () => []);
export const BOXES = Array.from({ length: 9 }, () => []);

for (let r = 0; r < 9; r++) {
  for (let c = 0; c < 9; c++) {
    const i = idx(r, c);
    ROWS[r].push(i);
    COLS[c].push(i);
    BOXES[boxIndex(r, c)].push(i);
  }
}

export const UNITS = ROWS.concat(COLS, BOXES);
export const PEERS = Array.from({ length: 81 }, () => []);
const PEER_SETS = Array.from({ length: 81 }, () => new Set());
for (const unit of UNITS) {
  for (const i of unit) {
    for (const j of unit) {
      if (i !== j) PEER_SETS[i].add(j);
    }
  }
}
for (let i = 0; i < 81; i++) PEERS[i] = Array.from(PEER_SETS[i]);

const TECHNIQUE_WEIGHT = {
  'naked-single': 1,
  'hidden-single': 2,
  'locked-candidates': 5,
  'naked-pair': 6,
  'hidden-pair': 8,
  'naked-triple': 10,
  'hidden-triple': 11,
  'x-wing': 15,
  skyscraper: 16,
  'two-string-kite': 17,
  'xy-wing': 20,
  'xyz-wing': 22,
  swordfish: 24,
  'w-wing': 29,
  'simple-coloring': 31,
  jellyfish: 37,
  'xy-chain': 40,
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function combinations(values, size) {
  const out = [];
  const picked = [];
  function walk(start) {
    if (picked.length === size) {
      out.push(picked.slice());
      return;
    }
    const need = size - picked.length;
    for (let i = start; i <= values.length - need; i++) {
      picked.push(values[i]);
      walk(i + 1);
      picked.pop();
    }
  }
  walk(0);
  return out;
}

function sees(a, b) {
  return PEER_SETS[a].has(b);
}

export function candidateMask(board, i) {
  if (board[i] !== 0) return 0;
  let used = 0;
  for (const p of PEERS[i]) {
    const value = board[p];
    if (value) used |= bit(value);
  }
  return ALL_MASK & ~used;
}

export function computeCandidates(board) {
  const cand = Array(81).fill(0);
  for (let i = 0; i < 81; i++) cand[i] = candidateMask(board, i);
  return cand;
}

function makeMove(technique, level, assignments = [], eliminations = [], premises = []) {
  const merged = new Map();
  for (const elimination of eliminations) {
    if (!elimination || !elimination.mask) continue;
    merged.set(elimination.i, (merged.get(elimination.i) || 0) | elimination.mask);
  }
  return {
    technique,
    level,
    weight: TECHNIQUE_WEIGHT[technique] || level,
    assignments,
    eliminations: Array.from(merged.entries()).map(([i, mask]) => ({ i, mask })),
    premises,
  };
}

function eliminationTargets(board, cand, cells, mask, excluded = new Set()) {
  const out = [];
  for (const i of cells) {
    if (excluded.has(i) || board[i] !== 0) continue;
    const removed = cand[i] & mask;
    if (removed) out.push({ i, mask: removed });
  }
  return out;
}

function commonPeerEliminations(board, cand, a, b, digit, excluded = new Set()) {
  const mask = bit(digit);
  const out = [];
  for (let i = 0; i < 81; i++) {
    if (excluded.has(i) || board[i] !== 0 || !(cand[i] & mask)) continue;
    if (sees(i, a) && sees(i, b)) out.push({ i, mask });
  }
  return out;
}

function candidateStateValid(board, cand) {
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0 && cand[i] === 0) return false;
  }
  for (const unit of UNITS) {
    let placedMask = 0;
    for (const i of unit) {
      const value = board[i];
      if (!value) continue;
      const valueBit = bit(value);
      if (placedMask & valueBit) return false;
      placedMask |= valueBit;
    }
    for (let d = 1; d <= 9; d++) {
      const dBit = bit(d);
      if (placedMask & dBit) continue;
      let possible = false;
      for (const i of unit) {
        if (board[i] === 0 && (cand[i] & dBit)) {
          possible = true;
          break;
        }
      }
      if (!possible) return false;
    }
  }
  return true;
}

function assignDigit(board, cand, i, d) {
  if (board[i] !== 0 && board[i] !== d) return false;
  if (board[i] === 0 && !(cand[i] & bit(d))) return false;
  board[i] = d;
  cand[i] = 0;
  const dBit = bit(d);
  for (const p of PEERS[i]) {
    if (board[p] === d) return false;
    if (board[p] === 0) cand[p] &= ~dBit;
  }
  return candidateStateValid(board, cand);
}

function applyMove(board, cand, move) {
  for (const assignment of move.assignments) {
    if (!assignDigit(board, cand, assignment.i, assignment.d)) return false;
  }
  for (const elimination of move.eliminations) {
    if (board[elimination.i] !== 0) continue;
    cand[elimination.i] &= ~elimination.mask;
  }
  return candidateStateValid(board, cand);
}

function techNakedSingle(board, cand) {
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0 && popcount(cand[i]) === 1) {
      return makeMove('naked-single', 1, [{ i, d: firstDigit(cand[i]) }]);
    }
  }
  return null;
}

function techHiddenSingle(board, cand) {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const dBit = bit(d);
      let found = -1;
      let count = 0;
      for (const i of unit) {
        if (board[i] === 0 && (cand[i] & dBit)) {
          found = i;
          count += 1;
          if (count > 1) break;
        }
      }
      if (count === 1) return makeMove('hidden-single', 1, [{ i: found, d }], [], unit);
    }
  }
  return null;
}

function techLockedCandidates(board, cand) {
  for (let b = 0; b < 9; b++) {
    const box = BOXES[b];
    for (let d = 1; d <= 9; d++) {
      const dBit = bit(d);
      const cells = box.filter((i) => board[i] === 0 && (cand[i] & dBit));
      if (cells.length < 2) continue;
      const r0 = row(cells[0]);
      if (cells.every((i) => row(i) === r0)) {
        const eliminations = eliminationTargets(board, cand, ROWS[r0], dBit, new Set(box));
        if (eliminations.length) return makeMove('locked-candidates', 2, [], eliminations, cells);
      }
      const c0 = col(cells[0]);
      if (cells.every((i) => col(i) === c0)) {
        const eliminations = eliminationTargets(board, cand, COLS[c0], dBit, new Set(box));
        if (eliminations.length) return makeMove('locked-candidates', 2, [], eliminations, cells);
      }
    }
  }

  for (let r = 0; r < 9; r++) {
    for (let d = 1; d <= 9; d++) {
      const dBit = bit(d);
      const cells = ROWS[r].filter((i) => board[i] === 0 && (cand[i] & dBit));
      if (cells.length < 2) continue;
      const b = boxIndex(row(cells[0]), col(cells[0]));
      if (!cells.every((i) => boxIndex(row(i), col(i)) === b)) continue;
      const eliminations = eliminationTargets(board, cand, BOXES[b], dBit, new Set(ROWS[r]));
      if (eliminations.length) return makeMove('locked-candidates', 2, [], eliminations, cells);
    }
  }

  for (let c = 0; c < 9; c++) {
    for (let d = 1; d <= 9; d++) {
      const dBit = bit(d);
      const cells = COLS[c].filter((i) => board[i] === 0 && (cand[i] & dBit));
      if (cells.length < 2) continue;
      const b = boxIndex(row(cells[0]), col(cells[0]));
      if (!cells.every((i) => boxIndex(row(i), col(i)) === b)) continue;
      const eliminations = eliminationTargets(board, cand, BOXES[b], dBit, new Set(COLS[c]));
      if (eliminations.length) return makeMove('locked-candidates', 2, [], eliminations, cells);
    }
  }
  return null;
}

function techNakedSubset(board, cand, size, technique, level) {
  for (const unit of UNITS) {
    const eligible = unit.filter((i) => {
      if (board[i] !== 0) return false;
      const count = popcount(cand[i]);
      return count >= 2 && count <= size;
    });
    if (eligible.length < size) continue;
    for (const cells of combinations(eligible, size)) {
      let union = 0;
      for (const i of cells) union |= cand[i];
      if (popcount(union) !== size) continue;
      const eliminations = eliminationTargets(board, cand, unit, union, new Set(cells));
      if (eliminations.length) return makeMove(technique, level, [], eliminations, cells);
    }
  }
  return null;
}

function techHiddenSubset(board, cand, size, technique, level) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const unit of UNITS) {
    for (const digitSet of combinations(digits, size)) {
      let subsetMask = 0;
      for (const d of digitSet) subsetMask |= bit(d);
      const cells = unit.filter((i) => board[i] === 0 && (cand[i] & subsetMask));
      if (cells.length !== size) continue;
      let allDigitsPresent = true;
      for (const d of digitSet) {
        if (!cells.some((i) => cand[i] & bit(d))) {
          allDigitsPresent = false;
          break;
        }
      }
      if (!allDigitsPresent) continue;
      const eliminations = [];
      for (const i of cells) {
        const removed = cand[i] & ~subsetMask;
        if (removed) eliminations.push({ i, mask: removed });
      }
      if (eliminations.length) return makeMove(technique, level, [], eliminations, cells);
    }
  }
  return null;
}

function fishTechnique(board, cand, size, technique, level) {
  for (let d = 1; d <= 9; d++) {
    const dBit = bit(d);
    const rowBases = [];
    for (let r = 0; r < 9; r++) {
      const covers = [];
      for (let c = 0; c < 9; c++) {
        const i = idx(r, c);
        if (board[i] === 0 && (cand[i] & dBit)) covers.push(c);
      }
      if (covers.length >= 2 && covers.length <= size) rowBases.push({ base: r, covers });
    }
    for (const selected of combinations(rowBases, size)) {
      const coverSet = new Set(selected.flatMap((entry) => entry.covers));
      if (coverSet.size !== size) continue;
      const baseSet = new Set(selected.map((entry) => entry.base));
      const eliminations = [];
      for (const c of coverSet) {
        for (let r = 0; r < 9; r++) {
          if (baseSet.has(r)) continue;
          const i = idx(r, c);
          if (board[i] === 0 && (cand[i] & dBit)) eliminations.push({ i, mask: dBit });
        }
      }
      if (eliminations.length) {
        return makeMove(technique, level, [], eliminations, selected.flatMap((entry) => entry.covers.map((c) => idx(entry.base, c))));
      }
    }

    const colBases = [];
    for (let c = 0; c < 9; c++) {
      const covers = [];
      for (let r = 0; r < 9; r++) {
        const i = idx(r, c);
        if (board[i] === 0 && (cand[i] & dBit)) covers.push(r);
      }
      if (covers.length >= 2 && covers.length <= size) colBases.push({ base: c, covers });
    }
    for (const selected of combinations(colBases, size)) {
      const coverSet = new Set(selected.flatMap((entry) => entry.covers));
      if (coverSet.size !== size) continue;
      const baseSet = new Set(selected.map((entry) => entry.base));
      const eliminations = [];
      for (const r of coverSet) {
        for (let c = 0; c < 9; c++) {
          if (baseSet.has(c)) continue;
          const i = idx(r, c);
          if (board[i] === 0 && (cand[i] & dBit)) eliminations.push({ i, mask: dBit });
        }
      }
      if (eliminations.length) {
        return makeMove(technique, level, [], eliminations, selected.flatMap((entry) => entry.covers.map((r) => idx(r, entry.base))));
      }
    }
  }
  return null;
}

function techSkyscraper(board, cand) {
  for (let d = 1; d <= 9; d++) {
    const dBit = bit(d);
    const links = [];
    for (let r = 0; r < 9; r++) {
      const cells = ROWS[r].filter((i) => board[i] === 0 && (cand[i] & dBit));
      if (cells.length === 2) links.push(cells);
    }
    for (const [a, b] of combinations(links, 2)) {
      const shared = a.filter((i) => b.some((j) => col(j) === col(i)));
      if (shared.length !== 1) continue;
      const baseA = shared[0];
      const baseB = b.find((j) => col(j) === col(baseA));
      const roofA = a.find((i) => i !== baseA);
      const roofB = b.find((i) => i !== baseB);
      if (col(roofA) === col(roofB)) continue;
      const excluded = new Set([baseA, baseB, roofA, roofB]);
      const eliminations = commonPeerEliminations(board, cand, roofA, roofB, d, excluded);
      if (eliminations.length) return makeMove('skyscraper', 4, [], eliminations, [...excluded]);
    }

    const colLinks = [];
    for (let c = 0; c < 9; c++) {
      const cells = COLS[c].filter((i) => board[i] === 0 && (cand[i] & dBit));
      if (cells.length === 2) colLinks.push(cells);
    }
    for (const [a, b] of combinations(colLinks, 2)) {
      const shared = a.filter((i) => b.some((j) => row(j) === row(i)));
      if (shared.length !== 1) continue;
      const baseA = shared[0];
      const baseB = b.find((j) => row(j) === row(baseA));
      const roofA = a.find((i) => i !== baseA);
      const roofB = b.find((i) => i !== baseB);
      if (row(roofA) === row(roofB)) continue;
      const excluded = new Set([baseA, baseB, roofA, roofB]);
      const eliminations = commonPeerEliminations(board, cand, roofA, roofB, d, excluded);
      if (eliminations.length) return makeMove('skyscraper', 4, [], eliminations, [...excluded]);
    }
  }
  return null;
}

function techTwoStringKite(board, cand) {
  for (let d = 1; d <= 9; d++) {
    const dBit = bit(d);
    const rowLinks = [];
    const colLinks = [];
    for (let r = 0; r < 9; r++) {
      const cells = ROWS[r].filter((i) => board[i] === 0 && (cand[i] & dBit));
      if (cells.length === 2) rowLinks.push(cells);
    }
    for (let c = 0; c < 9; c++) {
      const cells = COLS[c].filter((i) => board[i] === 0 && (cand[i] & dBit));
      if (cells.length === 2) colLinks.push(cells);
    }
    for (const rLink of rowLinks) {
      for (const cLink of colLinks) {
        for (const rJoin of rLink) {
          for (const cJoin of cLink) {
            if (rJoin === cJoin) continue;
            if (boxIndex(row(rJoin), col(rJoin)) !== boxIndex(row(cJoin), col(cJoin))) continue;
            const farR = rLink.find((i) => i !== rJoin);
            const farC = cLink.find((i) => i !== cJoin);
            if (farR === farC) continue;
            const excluded = new Set([...rLink, ...cLink]);
            const eliminations = commonPeerEliminations(board, cand, farR, farC, d, excluded);
            if (eliminations.length) return makeMove('two-string-kite', 4, [], eliminations, [...excluded]);
          }
        }
      }
    }
  }
  return null;
}

function techXYWing(board, cand) {
  for (let pivot = 0; pivot < 81; pivot++) {
    if (board[pivot] !== 0 || popcount(cand[pivot]) !== 2) continue;
    const pMask = cand[pivot];
    const wings = PEERS[pivot].filter((i) => {
      if (board[i] !== 0 || popcount(cand[i]) !== 2) return false;
      return popcount(cand[i] & pMask) === 1 && cand[i] !== pMask;
    });
    for (const [a, b] of combinations(wings, 2)) {
      const sharedA = cand[a] & pMask;
      const sharedB = cand[b] & pMask;
      if (sharedA === sharedB || popcount(sharedA) !== 1 || popcount(sharedB) !== 1) continue;
      const zMask = cand[a] & cand[b] & ~pMask;
      if (popcount(zMask) !== 1) continue;
      const z = firstDigit(zMask);
      const excluded = new Set([pivot, a, b]);
      const eliminations = commonPeerEliminations(board, cand, a, b, z, excluded);
      if (eliminations.length) return makeMove('xy-wing', 5, [], eliminations, [pivot, a, b]);
    }
  }
  return null;
}

function techXYZWing(board, cand) {
  for (let pivot = 0; pivot < 81; pivot++) {
    if (board[pivot] !== 0 || popcount(cand[pivot]) !== 3) continue;
    const pMask = cand[pivot];
    const wings = PEERS[pivot].filter((i) => {
      if (board[i] !== 0 || popcount(cand[i]) !== 2) return false;
      return (cand[i] & ~pMask) === 0;
    });
    for (const [a, b] of combinations(wings, 2)) {
      if ((cand[a] | cand[b]) !== pMask) continue;
      const zMask = cand[a] & cand[b];
      if (popcount(zMask) !== 1) continue;
      const z = firstDigit(zMask);
      const excluded = new Set([pivot, a, b]);
      const eliminations = [];
      for (let i = 0; i < 81; i++) {
        if (excluded.has(i) || board[i] !== 0 || !(cand[i] & zMask)) continue;
        if (sees(i, pivot) && sees(i, a) && sees(i, b)) eliminations.push({ i, mask: zMask });
      }
      if (eliminations.length) return makeMove('xyz-wing', 5, [], eliminations, [pivot, a, b]);
    }
  }
  return null;
}

function strongLinksForDigit(board, cand, d) {
  const dBit = bit(d);
  const links = [];
  const seen = new Set();
  for (const unit of UNITS) {
    const cells = unit.filter((i) => board[i] === 0 && (cand[i] & dBit));
    if (cells.length !== 2) continue;
    const key = cells[0] < cells[1] ? `${cells[0]}:${cells[1]}` : `${cells[1]}:${cells[0]}`;
    if (!seen.has(key)) {
      seen.add(key);
      links.push(cells);
    }
  }
  return links;
}

function techWWing(board, cand) {
  const bivalue = [];
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0 && popcount(cand[i]) === 2) bivalue.push(i);
  }
  for (const [w1, w2] of combinations(bivalue, 2)) {
    if (cand[w1] !== cand[w2] || sees(w1, w2)) continue;
    const digits = maskToDigits(cand[w1]);
    for (const linkDigit of digits) {
      const eliminateDigit = digits.find((d) => d !== linkDigit);
      for (const [a, b] of strongLinksForDigit(board, cand, linkDigit)) {
        if ([a, b].includes(w1) || [a, b].includes(w2)) continue;
        const connected = (sees(w1, a) && sees(w2, b)) || (sees(w1, b) && sees(w2, a));
        if (!connected) continue;
        const excluded = new Set([w1, w2, a, b]);
        const eliminations = commonPeerEliminations(board, cand, w1, w2, eliminateDigit, excluded);
        if (eliminations.length) return makeMove('w-wing', 6, [], eliminations, [w1, w2, a, b]);
      }
    }
  }
  return null;
}

function techSimpleColoring(board, cand) {
  for (let d = 1; d <= 9; d++) {
    const dBit = bit(d);
    const adjacency = new Map();
    for (const [a, b] of strongLinksForDigit(board, cand, d)) {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      if (!adjacency.has(b)) adjacency.set(b, new Set());
      adjacency.get(a).add(b);
      adjacency.get(b).add(a);
    }
    const globalSeen = new Set();
    for (const start of adjacency.keys()) {
      if (globalSeen.has(start)) continue;
      const colors = new Map([[start, 0]]);
      const queue = [start];
      globalSeen.add(start);
      while (queue.length) {
        const current = queue.shift();
        const nextColor = 1 - colors.get(current);
        for (const next of adjacency.get(current) || []) {
          if (!colors.has(next)) {
            colors.set(next, nextColor);
            globalSeen.add(next);
            queue.push(next);
          }
        }
      }
      if (colors.size < 2) continue;
      const groups = [[], []];
      for (const [cell, color] of colors) groups[color].push(cell);

      for (let color = 0; color <= 1; color++) {
        let conflict = false;
        for (const [a, b] of combinations(groups[color], 2)) {
          if (sees(a, b)) {
            conflict = true;
            break;
          }
        }
        if (conflict) {
          const eliminations = groups[color]
            .filter((i) => board[i] === 0 && (cand[i] & dBit))
            .map((i) => ({ i, mask: dBit }));
          if (eliminations.length) return makeMove('simple-coloring', 6, [], eliminations, Array.from(colors.keys()));
        }
      }

      const component = new Set(colors.keys());
      const eliminations = [];
      for (let i = 0; i < 81; i++) {
        if (component.has(i) || board[i] !== 0 || !(cand[i] & dBit)) continue;
        const seesColor0 = groups[0].some((cell) => sees(i, cell));
        const seesColor1 = groups[1].some((cell) => sees(i, cell));
        if (seesColor0 && seesColor1) eliminations.push({ i, mask: dBit });
      }
      if (eliminations.length) return makeMove('simple-coloring', 6, [], eliminations, Array.from(colors.keys()));
    }
  }
  return null;
}

function techXYChain(board, cand) {
  const bivalue = [];
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0 && popcount(cand[i]) === 2) bivalue.push(i);
  }
  const bivalueSet = new Set(bivalue);
  const neighbors = new Map();
  for (const i of bivalue) neighbors.set(i, PEERS[i].filter((p) => bivalueSet.has(p)));
  const maxDepth = 8;
  let expansions = 0;
  const maxExpansions = 18000;

  for (const start of bivalue) {
    const startDigits = maskToDigits(cand[start]);
    for (const endpointDigit of startDigits) {
      const outgoing = startDigits.find((d) => d !== endpointDigit);
      const path = [start];
      const visited = new Set(path);

      function dfs(current, requiredDigit) {
        if (path.length >= maxDepth || expansions >= maxExpansions) return null;
        for (const next of neighbors.get(current) || []) {
          if (visited.has(next) || !(cand[next] & bit(requiredDigit))) continue;
          expansions += 1;
          const nextDigits = maskToDigits(cand[next]);
          const nextOutgoing = nextDigits.find((d) => d !== requiredDigit);
          if (!nextOutgoing) continue;
          path.push(next);
          visited.add(next);

          if (nextOutgoing === endpointDigit && path.length >= 3) {
            const excluded = new Set(path);
            const eliminations = commonPeerEliminations(board, cand, start, next, endpointDigit, excluded);
            if (eliminations.length) {
              return makeMove('xy-chain', 7, [], eliminations, path.slice());
            }
          }

          const result = dfs(next, nextOutgoing);
          if (result) return result;
          visited.delete(next);
          path.pop();
        }
        return null;
      }

      const result = dfs(start, outgoing);
      if (result) return result;
      if (expansions >= maxExpansions) return null;
    }
  }
  return null;
}

const TECHNIQUES = [
  { name: 'naked-single', level: 1, find: techNakedSingle },
  { name: 'hidden-single', level: 1, find: techHiddenSingle },
  { name: 'locked-candidates', level: 2, find: techLockedCandidates },
  { name: 'naked-pair', level: 2, find: (board, cand) => techNakedSubset(board, cand, 2, 'naked-pair', 2) },
  { name: 'hidden-pair', level: 3, find: (board, cand) => techHiddenSubset(board, cand, 2, 'hidden-pair', 3) },
  { name: 'naked-triple', level: 3, find: (board, cand) => techNakedSubset(board, cand, 3, 'naked-triple', 3) },
  { name: 'hidden-triple', level: 3, find: (board, cand) => techHiddenSubset(board, cand, 3, 'hidden-triple', 3) },
  { name: 'x-wing', level: 4, find: (board, cand) => fishTechnique(board, cand, 2, 'x-wing', 4) },
  { name: 'skyscraper', level: 4, find: techSkyscraper },
  { name: 'two-string-kite', level: 4, find: techTwoStringKite },
  { name: 'xy-wing', level: 5, find: techXYWing },
  { name: 'xyz-wing', level: 5, find: techXYZWing },
  { name: 'swordfish', level: 5, find: (board, cand) => fishTechnique(board, cand, 3, 'swordfish', 5) },
  { name: 'w-wing', level: 6, find: techWWing },
  { name: 'simple-coloring', level: 6, find: techSimpleColoring },
  { name: 'jellyfish', level: 7, find: (board, cand) => fishTechnique(board, cand, 4, 'jellyfish', 7) },
  { name: 'xy-chain', level: 7, find: techXYChain },
];

export const TECHNIQUE_LEVELS = Object.freeze(Object.fromEntries(TECHNIQUES.map((tech) => [tech.name, tech.level])));

function solvedBoardValid(board) {
  if (board.some((value) => value < 1 || value > 9)) return false;
  for (const unit of UNITS) {
    let mask = 0;
    for (const i of unit) mask |= bit(board[i]);
    if (mask !== ALL_MASK) return false;
  }
  return true;
}

export function solveByTechniques(puzzle, options = {}) {
  const maxLevel = options.maxLevel ?? 7;
  const collectTrace = options.collectTrace !== false;
  const board = puzzle.slice();
  const cand = computeCandidates(board);
  const report = {
    solved: false,
    valid: candidateStateValid(board, cand),
    reason: null,
    steps: 0,
    placements: 0,
    eliminations: 0,
    nonSingleSteps: 0,
    advancedSteps: 0,
    hardSteps: 0,
    maxLevelUsed: 0,
    hardestStepIndex: -1,
    rawScore: 0,
    score: 0,
    techniques: {},
    trace: collectTrace ? [] : undefined,
  };
  if (!report.valid) {
    report.reason = 'invalid-start';
    return { board, candidates: cand, report };
  }

  const allowed = TECHNIQUES.filter((tech) => tech.level <= maxLevel);
  const maxSteps = 1200;
  while (report.steps < maxSteps) {
    if (board.every((value) => value !== 0)) {
      report.solved = solvedBoardValid(board);
      report.valid = report.solved;
      report.reason = report.solved ? 'solved' : 'invalid-complete';
      break;
    }

    let move = null;
    for (const tech of allowed) {
      move = tech.find(board, cand);
      if (move) break;
    }
    if (!move) {
      report.reason = 'stuck';
      break;
    }
    if (!applyMove(board, cand, move)) {
      report.valid = false;
      report.reason = 'contradiction';
      break;
    }

    const assignmentCount = move.assignments.length;
    let eliminationCount = 0;
    for (const elimination of move.eliminations) eliminationCount += popcount(elimination.mask);
    report.steps += 1;
    report.placements += assignmentCount;
    report.eliminations += eliminationCount;
    report.maxLevelUsed = Math.max(report.maxLevelUsed, move.level);
    if (move.level >= 2) report.nonSingleSteps += 1;
    if (move.level >= 4) report.advancedSteps += 1;
    if (move.level >= 5) report.hardSteps += 1;
    if (move.level === report.maxLevelUsed) report.hardestStepIndex = report.steps - 1;
    report.techniques[move.technique] = (report.techniques[move.technique] || 0) + 1;
    report.rawScore += move.weight + eliminationCount;
    if (collectTrace) {
      report.trace.push({
        technique: move.technique,
        level: move.level,
        assignments: move.assignments.map((entry) => ({ ...entry })),
        eliminations: move.eliminations.map((entry) => ({ ...entry })),
        premises: move.premises.slice(),
      });
    }
  }
  if (report.steps >= maxSteps && !report.solved) report.reason = 'step-limit';

  const lateRatio = report.steps > 1 && report.hardestStepIndex >= 0
    ? report.hardestStepIndex / (report.steps - 1)
    : 0;
  report.score = Math.round(
    report.rawScore
      + report.maxLevelUsed * 16
      + report.nonSingleSteps * 2
      + report.advancedSteps * 7
      + report.hardSteps * 7
      + lateRatio * 24,
  );
  return { board, candidates: cand, report };
}

export function rateByLogicalSolve(puzzle, solution = null, options = {}) {
  const { board, report } = solveByTechniques(puzzle, options);
  if (report.solved && solution) {
    for (let i = 0; i < 81; i++) {
      if (board[i] !== solution[i]) {
        report.solved = false;
        report.valid = false;
        report.reason = 'wrong-solution';
        break;
      }
    }
  }
  return report;
}

function buildConstraintState(board) {
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const value = board[i];
    if (!value) continue;
    const dBit = bit(value);
    const r = row(i);
    const c = col(i);
    const b = boxIndex(r, c);
    if ((rows[r] & dBit) || (cols[c] & dBit) || (boxes[b] & dBit)) return null;
    rows[r] |= dBit;
    cols[c] |= dBit;
    boxes[b] |= dBit;
  }
  return { rows, cols, boxes };
}

function fastMask(state, i) {
  return ALL_MASK & ~(state.rows[row(i)] | state.cols[col(i)] | state.boxes[boxIndex(row(i), col(i))]);
}

function findBestCellFast(board, state) {
  let bestI = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const mask = fastMask(state, i);
    const count = popcount(mask);
    if (count === 0) return { i, mask, count };
    if (count < bestCount) {
      bestI = i;
      bestMask = mask;
      bestCount = count;
      if (count === 1) break;
    }
  }
  return bestI < 0 ? null : { i: bestI, mask: bestMask, count: bestCount };
}

function placeFast(board, state, i, d) {
  const dBit = bit(d);
  board[i] = d;
  state.rows[row(i)] |= dBit;
  state.cols[col(i)] |= dBit;
  state.boxes[boxIndex(row(i), col(i))] |= dBit;
}

function clearFast(board, state, i, d) {
  const dBit = bit(d);
  board[i] = 0;
  state.rows[row(i)] &= ~dBit;
  state.cols[col(i)] &= ~dBit;
  state.boxes[boxIndex(row(i), col(i))] &= ~dBit;
}

export function countSolutions(board, limit = 2) {
  const state = buildConstraintState(board);
  if (!state) return 0;
  let count = 0;
  function search() {
    if (count >= limit) return;
    const spot = findBestCellFast(board, state);
    if (!spot) {
      count += 1;
      return;
    }
    if (spot.count === 0) return;
    for (const d of maskToDigits(spot.mask)) {
      placeFast(board, state, spot.i, d);
      search();
      clearFast(board, state, spot.i, d);
      if (count >= limit) return;
    }
  }
  search();
  return count;
}

export function generateSolvedGrid() {
  const board = Array(81).fill(0);
  const state = buildConstraintState(board);
  function search() {
    const spot = findBestCellFast(board, state);
    if (!spot) return true;
    if (spot.count === 0) return false;
    const digits = shuffle(maskToDigits(spot.mask));
    for (const d of digits) {
      placeFast(board, state, spot.i, d);
      if (search()) return true;
      clearFast(board, state, spot.i, d);
    }
    return false;
  }
  search();
  return board;
}

export function countClues(board) {
  return board.reduce((count, value) => count + (value !== 0 ? 1 : 0), 0);
}

function digHolesUnique(solution, minClues, maxClues) {
  const puzzle = solution.slice();
  const target = randomInt(minClues, maxClues);
  let clues = 81;
  let progress = true;
  while (progress && clues > target) {
    progress = false;
    const indices = shuffle(Array.from({ length: 81 }, (_, i) => i).filter((i) => puzzle[i] !== 0));
    for (const i of indices) {
      if (clues <= target) break;
      const backup = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle.slice(), 2) === 1) {
        clues -= 1;
        progress = true;
      } else {
        puzzle[i] = backup;
      }
    }
  }
  return puzzle;
}

function profileDistance(profile, clues, report) {
  const levelDistance = Math.abs(report.maxLevelUsed - profile.targetLevel) * 150;
  const scoreDistance = Math.abs(report.score - profile.targetScore);
  const clueMid = (profile.minClues + profile.maxClues) / 2;
  const clueDistance = Math.abs(clues - clueMid) * 4;
  return levelDistance + scoreDistance + clueDistance;
}

export function matchesDifficultyProfile(puzzle, report, profile) {
  const clues = countClues(puzzle);
  if (!report.solved || !report.valid) return false;
  if (clues < profile.minClues || clues > profile.maxClues) return false;
  if (report.maxLevelUsed < profile.minLevel || report.maxLevelUsed > profile.maxLevel) return false;
  if (report.score < profile.minScore || report.score > profile.maxScore) return false;
  if (report.nonSingleSteps < profile.minNonSingleSteps) return false;
  if (report.advancedSteps < profile.minAdvancedSteps) return false;
  return true;
}

export function certifyDifficulty(puzzle, solution, profile) {
  if (countSolutions(puzzle.slice(), 2) !== 1) {
    return { ok: false, reason: 'not-unique', report: null, lowerReport: null };
  }
  const report = rateByLogicalSolve(puzzle, solution, { maxLevel: profile.maxLevel, collectTrace: true });
  if (!matchesDifficultyProfile(puzzle, report, profile)) {
    return { ok: false, reason: 'profile-mismatch', report, lowerReport: null };
  }
  let lowerReport = null;
  if (profile.minLevel > 1) {
    lowerReport = rateByLogicalSolve(puzzle, solution, { maxLevel: profile.minLevel - 1, collectTrace: false });
    if (lowerReport.solved) {
      return { ok: false, reason: 'lower-solver-succeeded', report, lowerReport };
    }
  }
  return { ok: true, reason: 'certified', report, lowerReport };
}

function decodeGrid(text) {
  if (typeof text !== 'string' || text.length !== 81 || /[^0-9]/.test(text)) {
    throw new Error('Invalid embedded Sudoku grid.');
  }
  return Array.from(text, (char) => Number(char));
}

function certifiedFallback(diff, profile) {
  const entries = CERTIFIED_FALLBACKS[diff] || CERTIFIED_FALLBACKS.easy;
  const [puzzleText, solutionText] = entries[randomInt(0, entries.length - 1)];
  const puzzle = decodeGrid(puzzleText);
  const solution = decodeGrid(solutionText);
  const certification = certifyDifficulty(puzzle, solution, profile);
  if (!certification.ok) {
    throw new Error(`Embedded ${diff} Sudoku fallback failed certification: ${certification.reason}`);
  }
  return {
    puzzle,
    solution,
    report: certification.report,
    clues: countClues(puzzle),
    distance: profileDistance(profile, countClues(puzzle), certification.report),
    source: 'certified-fallback',
  };
}

export function generatePuzzle(diff) {
  const requestedDiff = Object.prototype.hasOwnProperty.call(DIFF_PROFILE, diff) ? diff : 'easy';
  const profile = DIFF_PROFILE[requestedDiff];
  const qualified = [];

  for (let attempt = 0; attempt < profile.maxAttempts; attempt++) {
    const solution = generateSolvedGrid();
    const puzzle = digHolesUnique(solution, profile.minClues, profile.maxClues);
    const clues = countClues(puzzle);
    if (clues < profile.minClues || clues > profile.maxClues) continue;

    const report = rateByLogicalSolve(puzzle, solution, { maxLevel: profile.maxLevel, collectTrace: false });
    if (!matchesDifficultyProfile(puzzle, report, profile)) continue;
    if (profile.minLevel > 1) {
      const lower = rateByLogicalSolve(puzzle, solution, { maxLevel: profile.minLevel - 1, collectTrace: false });
      if (lower.solved) continue;
    }

    qualified.push({
      puzzle,
      solution,
      report,
      clues,
      distance: profileDistance(profile, clues, report),
      source: 'generated',
    });
    if (qualified.length >= profile.poolSize) break;
  }

  const selected = qualified.length
    ? qualified.sort((a, b) => a.distance - b.distance)[0]
    : certifiedFallback(requestedDiff, profile);

  return {
    puzzle: selected.puzzle,
    solution: selected.solution,
    difficulty: {
      requested: requestedDiff,
      certified: true,
      source: selected.source,
      clues: selected.clues,
      ...selected.report,
    },
  };
}
