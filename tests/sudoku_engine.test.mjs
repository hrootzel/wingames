import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIFF_PROFILE,
  TECHNIQUE_LEVELS,
  certifyDifficulty,
  countClues,
  countSolutions,
  generatePuzzle,
  rateByLogicalSolve,
  solveByTechniques,
} from '../sudoku_engine.js';

function grid(text) {
  assert.equal(text.length, 81);
  return Array.from(text, (char) => Number(char));
}

const CERTIFIED_CASES = {
  easy: {
    puzzle: '000000050060034100900201080070500802300000000095000700051069000236010970080027501',
    solution: '127986354568734129943251687674593812312678495895142736751869243236415978489327561',
  },
  medium: {
    puzzle: '003008490029700010008900050084000600900060005050873040000009060002000000100427008',
    solution: '573618492429735816618942357784591623931264785256873149847359261392186574165427938',
  },
  hard: {
    puzzle: '015200800000060709000000004200630900060000007000801640500000108370089005000520070',
    solution: '915274836482365719637918524248637951169452387753891642526743198374189265891526473',
  },
  extreme: {
    puzzle: '600000002050860003200701800300009000106050000098000030800903100000000000005410009',
    solution: '681534792957862413243791856374289561126357984598146237862973145419625378735418629',
  },
};

test('difficulty profiles progress across the solver ladder', () => {
  assert.equal(DIFF_PROFILE.easy.minLevel, 2);
  assert.equal(DIFF_PROFILE.easy.maxLevel, 2);
  assert.equal(DIFF_PROFILE.medium.minLevel, 2);
  assert.equal(DIFF_PROFILE.medium.maxLevel, 3);
  assert.equal(DIFF_PROFILE.hard.minLevel, 4);
  assert.equal(DIFF_PROFILE.hard.maxLevel, 5);
  assert.equal(DIFF_PROFILE.extreme.minLevel, 5);
  assert.equal(DIFF_PROFILE.extreme.maxLevel, 7);

  assert.ok(DIFF_PROFILE.easy.minClues > DIFF_PROFILE.extreme.minClues);
  assert.ok(DIFF_PROFILE.medium.targetScore > DIFF_PROFILE.easy.targetScore);
  assert.ok(DIFF_PROFILE.hard.targetScore > DIFF_PROFILE.medium.targetScore);
  assert.ok(DIFF_PROFILE.extreme.targetScore > DIFF_PROFILE.hard.targetScore);

  assert.equal(TECHNIQUE_LEVELS['naked-single'], 1);
  assert.equal(TECHNIQUE_LEVELS['hidden-triple'], 3);
  assert.equal(TECHNIQUE_LEVELS.skyscraper, 4);
  assert.equal(TECHNIQUE_LEVELS['xy-wing'], 5);
  assert.equal(TECHNIQUE_LEVELS['simple-coloring'], 6);
  assert.equal(TECHNIQUE_LEVELS['xy-chain'], 7);
});

for (const [diff, fixture] of Object.entries(CERTIFIED_CASES)) {
  test(`${diff} fixture is unique and certified without guessing`, () => {
    const puzzle = grid(fixture.puzzle);
    const solution = grid(fixture.solution);
    const profile = DIFF_PROFILE[diff];

    assert.equal(countSolutions(puzzle.slice(), 2), 1);
    const certification = certifyDifficulty(puzzle, solution, profile);
    assert.equal(certification.ok, true, certification.reason);
    assert.equal(certification.report.solved, true);
    assert.ok(certification.report.maxLevelUsed >= profile.minLevel);
    assert.ok(certification.report.maxLevelUsed <= profile.maxLevel);
    assert.equal(certification.lowerReport.solved, false);
  });
}

test('the logical trace retains eliminations across later assignments', () => {
  const fixture = CERTIFIED_CASES.extreme;
  const puzzle = grid(fixture.puzzle);
  const solution = grid(fixture.solution);
  const { board, report } = solveByTechniques(puzzle, {
    maxLevel: DIFF_PROFILE.extreme.maxLevel,
    collectTrace: true,
  });

  assert.equal(report.solved, true);
  assert.deepEqual(board, solution);
  const eliminationIndex = report.trace.findIndex((step) => step.eliminations.length > 0);
  assert.ok(eliminationIndex >= 0);
  assert.ok(report.trace.slice(eliminationIndex + 1).some((step) => step.assignments.length > 0));
  assert.ok(report.maxLevelUsed >= 5);
});

test('runtime generation always returns a certified puzzle in every tier', () => {
  for (const [diff, profile] of Object.entries(DIFF_PROFILE)) {
    const generated = generatePuzzle(diff);
    assert.equal(generated.difficulty.certified, true);
    assert.ok(['generated', 'certified-fallback'].includes(generated.difficulty.source));
    assert.equal(countClues(generated.puzzle), generated.difficulty.clues);
    assert.equal(countSolutions(generated.puzzle.slice(), 2), 1);

    const certification = certifyDifficulty(generated.puzzle, generated.solution, profile);
    assert.equal(certification.ok, true, `${diff}: ${certification.reason}`);
  }
});

test('embedded fallback path remains certified', () => {
  for (const [diff, profile] of Object.entries(DIFF_PROFILE)) {
    const previousAttempts = profile.maxAttempts;
    profile.maxAttempts = 0;
    try {
      for (let i = 0; i < 8; i++) {
        const generated = generatePuzzle(diff);
        assert.equal(generated.difficulty.source, 'certified-fallback');
        const certification = certifyDifficulty(generated.puzzle, generated.solution, profile);
        assert.equal(certification.ok, true, `${diff}: ${certification.reason}`);
      }
    } finally {
      profile.maxAttempts = previousAttempts;
    }
  }
});

test('a contradictory grid is rejected', () => {
  const invalid = grid(`11${'0'.repeat(79)}`);
  assert.equal(countSolutions(invalid.slice(), 2), 0);
  const report = rateByLogicalSolve(invalid, null, { maxLevel: 7 });
  assert.equal(report.solved, false);
  assert.equal(report.valid, false);
});
