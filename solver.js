// 0 = empty, 1 = white, 2 = yellow. Empty cells are excluded from the system.
export function toggleAt(board, index) {
  if (board[index] === 0) return board.slice();
  const next = board.slice();
  const row = Math.floor(index / 5);
  const col = index % 5;
  for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < 5 && c >= 0 && c < 5) {
      const target = r * 5 + c;
      if (next[target] !== 0) next[target] = next[target] === 1 ? 2 : 1;
    }
  }
  return next;
}

function popcount(value) {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

// Solve A x = b over GF(2). Every valid click pattern is a particular
// solution XOR a combination of nullspace vectors. Search that space exactly.
export function solveBoard(board) {
  if (!Array.isArray(board) || board.length !== 25 || board.some(v => ![0, 1, 2].includes(v))) {
    throw new Error('棋盘必须包含 25 个空白、白色或黄色格子。');
  }
  const active = [];
  for (let i = 0; i < 25; i++) if (board[i] !== 0) active.push(i);
  const n = active.length;
  if (n === 0) return { solvable: true, steps: [], activeCount: 0 };

  const rows = [];
  const rhs = [];
  for (let r = 0; r < n; r++) {
    const target = active[r];
    const tr = Math.floor(target / 5);
    const tc = target % 5;
    let mask = 0;
    for (let c = 0; c < n; c++) {
      const source = active[c];
      const sr = Math.floor(source / 5);
      const sc = source % 5;
      if (Math.abs(tr - sr) + Math.abs(tc - sc) <= 1) mask |= 1 << c;
    }
    rows.push(mask);
    rhs.push(board[target] === 1 ? 1 : 0);
  }

  const pivots = [];
  let rank = 0;
  for (let col = 0; col < n; col++) {
    let pivot = rank;
    while (pivot < n && !(rows[pivot] & (1 << col))) pivot++;
    if (pivot === n) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    [rhs[rank], rhs[pivot]] = [rhs[pivot], rhs[rank]];
    for (let row = 0; row < n; row++) {
      if (row !== rank && (rows[row] & (1 << col))) {
        rows[row] ^= rows[rank];
        rhs[row] ^= rhs[rank];
      }
    }
    pivots.push(col);
    rank++;
  }

  for (let row = rank; row < n; row++) {
    if (rhs[row]) return { solvable: false, steps: [], activeCount: n };
  }

  let particular = 0;
  for (let row = 0; row < rank; row++) if (rhs[row]) particular |= 1 << pivots[row];
  const pivotSet = new Set(pivots);
  const basis = [];
  for (let free = 0; free < n; free++) {
    if (pivotSet.has(free)) continue;
    let vector = 1 << free;
    for (let row = 0; row < rank; row++) {
      if (rows[row] & (1 << free)) vector |= 1 << pivots[row];
    }
    basis.push(vector);
  }

  // A bit that no remaining basis vector can change is already fixed.
  // Its click count is a lower bound for every descendant in this search.
  basis.sort((a, b) => popcount(b) - popcount(a));
  const suffixUnion = new Array(basis.length + 1).fill(0);
  for (let i = basis.length - 1; i >= 0; i--) suffixUnion[i] = suffixUnion[i + 1] | basis[i];
  const allBits = (1 << n) - 1;
  let best = particular;
  let bestWeight = popcount(best);

  function search(depth, candidate) {
    if (popcount(candidate & (allBits ^ suffixUnion[depth])) >= bestWeight) return;
    if (depth === basis.length) {
      const weight = popcount(candidate);
      if (weight < bestWeight) { best = candidate; bestWeight = weight; }
      return;
    }
    const flipped = candidate ^ basis[depth];
    // Try the lighter-looking branch first to improve pruning quickly.
    if (popcount(flipped) < popcount(candidate)) {
      search(depth + 1, flipped);
      search(depth + 1, candidate);
    } else {
      search(depth + 1, candidate);
      search(depth + 1, flipped);
    }
  }
  if (bestWeight > 0) search(0, particular);

  const steps = [];
  for (let c = 0; c < n; c++) if (best & (1 << c)) steps.push(active[c]);
  return { solvable: true, steps, activeCount: n };
}
