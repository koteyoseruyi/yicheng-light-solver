import { solveBoard, toggleAt } from './solver.js';
import { recognizeAt, recognizeBoard } from './recognition.js';

let board = Array(25).fill(0);
let solvedBoard = null;
let steps = [];
let previewStep = 0;

const editorBoard = document.querySelector('#editor-board');
const previewBoard = document.querySelector('#preview-board');
const resultEmpty = document.querySelector('#result-empty');
const resultContent = document.querySelector('#result-content');
const solutionView = document.querySelector('#solution-view');
const resultSummary = document.querySelector('#result-summary');
const statusBadge = document.querySelector('#status-badge');
const stepList = document.querySelector('#step-list');
const previewCounter = document.querySelector('#preview-counter');
const previousButton = document.querySelector('#previous-button');
const nextButton = document.querySelector('#next-button');
const uploadInput = document.querySelector('#image-upload');
const imageStatus = document.querySelector('#image-status');
const imagePanel = document.querySelector('#image-panel');
const imageCanvas = document.querySelector('#image-canvas');
const recognitionMessage = document.querySelector('#recognition-message');
const applyRecognitionButton = document.querySelector('#apply-recognition-button');
const calibrateButton = document.querySelector('#calibrate-button');
let uploadedImage = null;
let recognition = null;
let calibrating = false;
let calibrationPoints = [];
let uploadToken = 0;

function nameOf(state) { return ['空白', '白色', '黄色'][state]; }
function coordinate(index) { return `第 ${Math.floor(index / 5) + 1} 行第 ${index % 5 + 1} 列`; }

function renderEditor() {
  editorBoard.replaceChildren(...board.map((state, index) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `cell cell-${nameOf(state)}`;
    cell.setAttribute('aria-label', `${coordinate(index)}，${nameOf(state)}；点击切换`);
    cell.title = `${coordinate(index)}：${nameOf(state)}`;
    cell.addEventListener('click', () => {
      board[index] = (board[index] + 1) % 3;
      clearResult();
      renderEditor();
      editorBoard.children[index].focus();
    });
    return cell;
  }));
}

function clearResult() {
  solvedBoard = null;
  steps = [];
  previewStep = 0;
  resultEmpty.hidden = false;
  resultContent.hidden = true;
  solutionView.hidden = true;
  statusBadge.textContent = '等待求解';
  statusBadge.className = 'status-badge status-idle';
}

function renderPreview() {
  let state = solvedBoard.slice();
  for (let i = 0; i < previewStep; i++) state = toggleAt(state, steps[i]);
  previewBoard.replaceChildren(...state.map((value, index) => {
    const cell = document.createElement('div');
    cell.className = `cell cell-${nameOf(value)}`;
    cell.setAttribute('aria-label', `${coordinate(index)}，${nameOf(value)}`);
    const upcoming = steps.indexOf(index);
    if (upcoming >= previewStep && upcoming !== -1) {
      const marker = document.createElement('span');
      marker.className = 'step-marker';
      marker.textContent = String(upcoming + 1);
      cell.append(marker);
    }
    if (upcoming === previewStep && previewStep < steps.length) cell.classList.add('next-cell');
    return cell;
  }));
  [...stepList.children].forEach((item, index) => {
    item.classList.toggle('step-done', index < previewStep);
    item.classList.toggle('step-current', index === previewStep);
  });
  previewCounter.textContent = `第 ${previewStep} 步，共 ${steps.length} 步`;
  previousButton.disabled = previewStep === 0;
  nextButton.disabled = previewStep === steps.length;
  nextButton.textContent = previewStep === steps.length ? '已完成' : '下一步';
}

function solve() {
  const result = solveBoard(board);
  resultEmpty.hidden = true;
  resultContent.hidden = false;
  solutionView.hidden = !result.solvable || result.steps.length === 0;
  statusBadge.className = `status-badge ${result.solvable ? 'status-solved' : 'status-impossible'}`;
  if (!result.solvable) {
    statusBadge.textContent = '无解';
    resultSummary.textContent = '这个棋盘没有办法全部变成黄色。请检查格子的颜色和空白位置。';
    return;
  }
  steps = result.steps;
  solvedBoard = board.slice();
  previewStep = 0;
  if (steps.length === 0) {
    statusBadge.textContent = '已完成';
    resultSummary.textContent = result.activeCount === 0 ? '棋盘上还没有方块。请先输入游戏中的颜色。' : '所有方块已经是黄色，无需点击。';
    return;
  }
  statusBadge.textContent = `最少 ${steps.length} 步`;
  resultSummary.textContent = `点击以下 ${steps.length} 个格子即可通关。`;
  stepList.replaceChildren(...steps.map((index, i) => {
    const item = document.createElement('li');
    item.innerHTML = `<span class="list-number">${i + 1}</span><span>${coordinate(index)}</span>`;
    return item;
  }));
  renderPreview();
}

function drawImagePreview() {
  if (!uploadedImage) return;
  const context = imageCanvas.getContext('2d');
  context.putImageData(uploadedImage, 0, 0);
  if (recognition) {
    const { xs, ys } = recognition.centers;
    const width = Math.abs(xs[4] - xs[0]) / 4 * .7;
    const height = Math.abs(ys[4] - ys[0]) / 4 * .7;
    const colors = ['#74bedb', '#ffffff', '#ffd35d'];
    const labels = ['空', '白', '黄'];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const state = recognition.board[row * 5 + col];
        const x = xs[col];
        const y = ys[row];
        context.strokeStyle = colors[state];
        context.lineWidth = 3;
        context.strokeRect(x - width / 2, y - height / 2, width, height);
        context.fillStyle = '#101722dd';
        context.fillRect(x - 12, y - 12, 24, 24);
        context.fillStyle = colors[state];
        context.font = 'bold 16px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(labels[state], x, y);
      }
    }
  }
  for (let i = 0; i < calibrationPoints.length; i++) {
    const point = calibrationPoints[i];
    context.beginPath();
    context.arc(point.x, point.y, 8, 0, Math.PI * 2);
    context.fillStyle = '#ff6a6a';
    context.fill();
  }
}

function showRecognition(result) {
  recognition = result;
  calibrating = false;
  calibrationPoints = [];
  applyRecognitionButton.disabled = false;
  const uncertainCount = result.uncertain.length;
  recognitionMessage.textContent = uncertainCount
    ? `已识别棋盘，有 ${uncertainCount} 格颜色不太确定。请对照图片检查，填入后可逐格修改。`
    : '已识别棋盘。请对照图片检查，填入后可逐格修改。';
  drawImagePreview();
}

async function loadImage(file) {
  const token = ++uploadToken;
  if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
    imageStatus.textContent = '请选择不超过 20 MB 的图片。';
    return;
  }
  imageStatus.textContent = '正在识别图片';
  try {
    const bitmap = await createImageBitmap(file);
    if (token !== uploadToken) { bitmap.close?.(); return; }
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    imageCanvas.width = Math.max(1, Math.round(bitmap.width * scale));
    imageCanvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = imageCanvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, imageCanvas.width, imageCanvas.height);
    bitmap.close?.();
    uploadedImage = context.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    recognition = null;
    calibrating = false;
    calibrationPoints = [];
    applyRecognitionButton.disabled = true;
    imagePanel.hidden = false;
    const result = recognizeBoard(uploadedImage);
    if (result) {
      showRecognition(result);
      imageStatus.textContent = '识别完成';
    } else {
      imageStatus.textContent = '未能自动定位棋盘';
      recognitionMessage.textContent = '点击调整定位，然后在图片上依次点击左上角和右下角格子的中心。';
      drawImagePreview();
    }
  } catch (error) {
    imageStatus.textContent = `图片读取失败：${error.message}`;
    imagePanel.hidden = true;
  }
}

uploadInput.addEventListener('change', async () => {
  const file = uploadInput.files?.[0];
  if (file) await loadImage(file);
  uploadInput.value = '';
});

document.addEventListener('paste', async event => {
  const items = Array.from(event.clipboardData?.items ?? []);
  let file = items.find(item => item.type.startsWith('image/'))?.getAsFile();
  if (!file) file = Array.from(event.clipboardData?.files ?? []).find(item => item.type.startsWith('image/'));
  if (!file) return;
  event.preventDefault();
  await loadImage(file);
});

calibrateButton.addEventListener('click', () => {
  if (!uploadedImage) return;
  calibrating = true;
  calibrationPoints = [];
  recognition = null;
  applyRecognitionButton.disabled = true;
  recognitionMessage.textContent = '请先点击左上角格子的中心，再点击右下角格子的中心。';
  drawImagePreview();
});

imageCanvas.addEventListener('click', event => {
  if (!calibrating || !uploadedImage) return;
  const bounds = imageCanvas.getBoundingClientRect();
  calibrationPoints.push({
    x: (event.clientX - bounds.left) * imageCanvas.width / bounds.width,
    y: (event.clientY - bounds.top) * imageCanvas.height / bounds.height,
  });
  if (calibrationPoints.length === 1) {
    recognitionMessage.textContent = '请点击右下角格子的中心。';
    drawImagePreview();
    return;
  }
  const [first, last] = calibrationPoints;
  if (last.x - first.x < 32 || last.y - first.y < 32) {
    calibrationPoints = [];
    recognitionMessage.textContent = '定位范围太小，请重新点击左上角和右下角格子的中心。';
    drawImagePreview();
    return;
  }
  const xs = Array.from({ length: 5 }, (_, i) => first.x + (last.x - first.x) * i / 4);
  const ys = Array.from({ length: 5 }, (_, i) => first.y + (last.y - first.y) * i / 4);
  showRecognition(recognizeAt(uploadedImage, xs, ys));
  imageStatus.textContent = '定位已调整';
});

applyRecognitionButton.addEventListener('click', () => {
  if (!recognition) return;
  board = recognition.board.slice();
  clearResult();
  renderEditor();
  imagePanel.hidden = true;
  imageStatus.textContent = '识别结果已填入棋盘，可点击格子修正后求解。';
});

document.querySelector('#solve-button').addEventListener('click', solve);
document.querySelector('#reset-button').addEventListener('click', () => { board = Array(25).fill(0); clearResult(); renderEditor(); });
previousButton.addEventListener('click', () => { if (previewStep > 0) { previewStep--; renderPreview(); } });
nextButton.addEventListener('click', () => { if (previewStep < steps.length) { previewStep++; renderPreview(); } });
document.querySelector('#restart-preview-button').addEventListener('click', () => { previewStep = 0; renderPreview(); });

renderEditor();
