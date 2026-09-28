// Browser-only color and grid recognition for screenshots of the game board.
// The returned board uses the same 0/1/2 states as solver.js.
function colorOf(r, g, b) {
  const low = Math.min(r, g, b);
  const high = Math.max(r, g, b);
  if (low >= 150 && high - low <= 55) return 1;
  if (r >= 130 && g >= 85 && b <= 135 && r >= g * .9 && g >= b * 1.25 && r >= b * 1.5) return 2;
  return 0;
}

function findBlocks({ width, height, data }) {
  const count = width * height;
  const mask = new Uint8Array(count);
  for (let i = 0, p = 0; i < count; i++, p += 4) {
    mask[i] = colorOf(data[p], data[p + 1], data[p + 2]) ? 1 : 0;
  }
  const queue = new Uint32Array(count);
  const blocks = [];
  const minimumArea = Math.max(35, Math.floor(count * .0001));
  for (let start = 0; start < count; start++) {
    if (mask[start] !== 1) continue;
    mask[start] = 2;
    queue[0] = start;
    let head = 0;
    let tail = 1;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = (current - x) / width;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const neighbors = [x > 0 ? current - 1 : -1, x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1, y < height - 1 ? current + width : -1];
      for (const next of neighbors) {
        if (next >= 0 && mask[next] === 1) {
          mask[next] = 2;
          queue[tail++] = next;
        }
      }
    }
    if (tail < minimumArea) continue;
    const blockWidth = maxX - minX + 1;
    const blockHeight = maxY - minY + 1;
    const ratio = blockWidth / blockHeight;
    if (ratio < .4 || ratio > 2.5 || blockWidth > width * .3 || blockHeight > height * .3) continue;
    blocks.push({ x: sumX / tail, y: sumY / tail, area: tail });
  }
  return blocks.sort((a, b) => b.area - a.area).slice(0, 32);
}

function fitAxis(blocks, key, size) {
  let best = null;
  const lower = size / 17;
  const upper = size / 3;
  for (let i = 0; i < blocks.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i === j) continue;
      const difference = blocks[j][key] - blocks[i][key];
      if (difference <= 0) continue;
      for (let gaps = 1; gaps <= 4; gaps++) {
        const step = difference / gaps;
        if (step < lower || step > upper) continue;
        for (let column = 0; column < 5; column++) {
          const origin = blocks[i][key] - column * step;
          if (origin < -step * .4 || origin + 4 * step > size + step * .4) continue;
          let score = 0;
          let matches = 0;
          const covered = new Set();
          for (const block of blocks) {
            const group = Math.round((block[key] - origin) / step);
            if (group < 0 || group > 4) continue;
            const distance = Math.abs(block[key] - (origin + group * step));
            if (distance > step * .32) continue;
            matches++;
            covered.add(group);
            score += 1 - distance / (step * .32);
          }
          score += covered.size * 1.8;
          if (!best || score > best.score) best = { origin, step, score, matches, coverage: covered.size };
        }
      }
    }
  }
  if (!best || best.coverage < 3 || best.matches < 5) return null;
  const centers = Array.from({ length: 5 }, (_, i) => best.origin + i * best.step);
  const sums = Array(5).fill(0);
  const counts = Array(5).fill(0);
  for (const block of blocks) {
    const group = Math.round((block[key] - best.origin) / best.step);
    if (group < 0 || group > 4 || Math.abs(block[key] - centers[group]) > best.step * .32) continue;
    sums[group] += block[key];
    counts[group]++;
  }
  for (let i = 0; i < 5; i++) if (counts[i]) centers[i] = sums[i] / counts[i];
  return { centers, step: best.step };
}

export function recognizeAt(image, xs, ys) {
  const { width, height, data } = image;
  const dx = Math.abs(xs[4] - xs[0]) / 4;
  const dy = Math.abs(ys[4] - ys[0]) / 4;
  if (dx < 8 || dy < 8 || !xs.every(Number.isFinite) || !ys.every(Number.isFinite)) {
    throw new Error('选定的棋盘范围太小或无效。');
  }
  const board = [];
  const uncertain = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const centerX = xs[col];
      const centerY = ys[row];
      const radiusX = dx * .26;
      const radiusY = dy * .24;
      const stride = Math.max(1, Math.floor(Math.min(dx, dy) / 22));
      let white = 0;
      let yellow = 0;
      let samples = 0;
      for (let y = Math.max(0, Math.floor(centerY - radiusY)); y <= Math.min(height - 1, Math.ceil(centerY + radiusY)); y += stride) {
        for (let x = Math.max(0, Math.floor(centerX - radiusX)); x <= Math.min(width - 1, Math.ceil(centerX + radiusX)); x += stride) {
          const offset = (y * width + x) * 4;
          const kind = colorOf(data[offset], data[offset + 1], data[offset + 2]);
          if (kind === 1) white++;
          else if (kind === 2) yellow++;
          samples++;
        }
      }
      const bright = Math.max(white, yellow);
      const state = bright < Math.max(3, samples * .08) ? 0 : white >= yellow ? 1 : 2;
      const index = row * 5 + col;
      board.push(state);
      if (state !== 0 && (bright < samples * .17 || Math.abs(white - yellow) < (white + yellow) * .18)) uncertain.push(index);
    }
  }
  return { board, centers: { xs, ys }, uncertain };
}

export function recognizeBoard(image) {
  const blocks = findBlocks(image);
  if (blocks.length < 6) return null;
  const horizontal = fitAxis(blocks, 'x', image.width);
  const vertical = fitAxis(blocks, 'y', image.height);
  if (!horizontal || !vertical) return null;
  const occupied = new Set();
  for (const block of blocks) {
    const col = horizontal.centers.reduce((best, x, i) => Math.abs(block.x - x) < Math.abs(block.x - horizontal.centers[best]) ? i : best, 0);
    const row = vertical.centers.reduce((best, y, i) => Math.abs(block.y - y) < Math.abs(block.y - vertical.centers[best]) ? i : best, 0);
    if (Math.abs(block.x - horizontal.centers[col]) < horizontal.step * .32 &&
        Math.abs(block.y - vertical.centers[row]) < vertical.step * .32) occupied.add(row * 5 + col);
  }
  if (occupied.size < 6) return null;
  return recognizeAt(image, horizontal.centers, vertical.centers);
}
