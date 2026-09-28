import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizeAt, recognizeBoard } from './recognition.js';

function syntheticImage(board) {
  const width = 600;
  const height = 600;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 35; data[i + 1] = 45; data[i + 2] = 55; data[i + 3] = 255;
  }
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const state = board[row * 5 + col];
      if (!state) continue;
      const rgb = state === 1 ? [230, 231, 228] : [238, 174, 30];
      for (let y = 50 + row * 100; y < 110 + row * 100; y++) {
        for (let x = 50 + col * 100; x < 110 + col * 100; x++) {
          const offset = (y * width + x) * 4;
          data.set(rgb, offset);
        }
      }
    }
  }
  return { width, height, data };
}

test('recognizes colors at a calibrated grid', () => {
  const board = Array.from({ length: 25 }, (_, i) => i % 3);
  const image = syntheticImage(board);
  const centers = [80, 180, 280, 380, 480];
  assert.deepEqual(recognizeAt(image, centers, centers).board, board);
});

test('automatically locates and recognizes a five by five board', () => {
  const board = Array.from({ length: 25 }, (_, i) => i % 4 === 0 ? 0 : i % 2 ? 1 : 2);
  const result = recognizeBoard(syntheticImage(board));
  assert.ok(result);
  assert.deepEqual(result.board, board);
});
