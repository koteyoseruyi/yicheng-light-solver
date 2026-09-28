import test from 'node:test';
import assert from 'node:assert/strict';
import { solveBoard, toggleAt } from './solver.js';

function bruteForce(board) {
  const active = board.map((v, i) => v ? i : -1).filter(i => i >= 0);
  let minimum = Infinity;
  for (let mask = 0; mask < 1 << active.length; mask++) {
    let state = board;
    let clicks = 0;
    for (let i = 0; i < active.length; i++) {
      if (mask & (1 << i)) { state = toggleAt(state, active[i]); clicks++; }
    }
    if (state.every(v => v !== 1)) minimum = Math.min(minimum, clicks);
  }
  return minimum;
}

test('empty and completed boards need no clicks', () => {
  assert.deepEqual(solveBoard(Array(25).fill(0)).steps, []);
  assert.deepEqual(solveBoard(Array(25).fill(2)).steps, []);
});

test('reports an impossible state when adjacent cells require different parity', () => {
  const board = Array(25).fill(0);
  board[0] = 1;
  board[1] = 2;
  assert.equal(solveBoard(board).solvable, false);
});

test('solver finds the exact minimum for all 3^6 states of a 2 by 3 corner', () => {
  const locations = [0, 1, 2, 5, 6, 7];
  for (let code = 0; code < 3 ** locations.length; code++) {
    const board = Array(25).fill(0);
    let value = code;
    for (const index of locations) { board[index] = value % 3; value = Math.floor(value / 3); }
    const expected = bruteForce(board);
    const result = solveBoard(board);
    assert.equal(result.solvable, Number.isFinite(expected), `state ${code}`);
    if (result.solvable) {
      assert.equal(result.steps.length, expected, `state ${code}`);
      let state = board;
      for (const index of result.steps) state = toggleAt(state, index);
      assert.ok(state.every(v => v !== 1), `state ${code}`);
    }
  }
});

test('a full-board scramble is solved correctly', () => {
  let board = Array(25).fill(2);
  for (const index of [0, 3, 9, 12, 18, 24]) board = toggleAt(board, index);
  const result = solveBoard(board);
  assert.equal(result.solvable, true);
  let state = board;
  for (const index of result.steps) state = toggleAt(state, index);
  assert.ok(state.every(v => v === 2));
});
