import test from 'node:test';
import assert from 'node:assert/strict';

class TestElement {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.classList = {
      add: name => { this.className += ` ${name}`; },
      toggle: (name, enabled) => {
        const names = new Set((this.className || '').split(' ').filter(Boolean));
        if (enabled) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      },
    };
    this.hidden = false;
  }
  setAttribute() {}
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  replaceChildren(...children) {
    assert.ok(children.every(child => child instanceof TestElement), 'preview must contain cells, not undefined');
    this.children = children;
  }
  append(child) { this.children.push(child); }
  focus() {}
  click() { this.listeners.get('click')?.(); }
}

test('preview, file upload, and clipboard paste update the board', async () => {
  const elements = new Map();
  const documentListeners = new Map();
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new TestElement());
      return elements.get(selector);
    },
    createElement() { return new TestElement(); },
    addEventListener(name, listener) { documentListeners.set(name, listener); },
  };
  try {
    await import('./app.js');
    const editor = elements.get('#editor-board');
    assert.equal(editor.children.length, 25);
    editor.children[0].click(); // blank -> white
    elements.get('#solve-button').click();
    const preview = elements.get('#preview-board');
    assert.equal(preview.children.length, 25);
    assert.equal(preview.children[0].className, 'cell cell-白色 next-cell');
    elements.get('#next-button').click();
    assert.equal(preview.children.length, 25);
    assert.equal(preview.children[0].className, 'cell cell-黄色');
    elements.get('#reset-button').click();
    assert.ok(editor.children.every(cell => cell.className === 'cell cell-空白'));

    const width = 600;
    const height = 600;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileX = Math.floor((x - 50) / 100);
        const tileY = Math.floor((y - 50) / 100);
        const colored = tileX >= 0 && tileX < 5 && tileY >= 0 && tileY < 5 &&
          (x - 50) % 100 < 60 && (y - 50) % 100 < 60;
        const offset = (y * width + x) * 4;
        data[offset] = colored ? 238 : 35;
        data[offset + 1] = colored ? 174 : 45;
        data[offset + 2] = colored ? 30 : 55;
        data[offset + 3] = 255;
      }
    }
    const context = {
      drawImage() {}, putImageData() {}, strokeRect() {}, fillRect() {}, fillText() {},
      getImageData() { return { width, height, data }; },
    };
    elements.get('#image-canvas').getContext = () => context;
    globalThis.createImageBitmap = async () => ({ width, height, close() {} });
    const input = elements.get('#image-upload');
    input.files = [{ type: 'image/jpeg', size: 1000 }];
    await input.listeners.get('change')();
    assert.equal(elements.get('#image-status').textContent, '识别完成');
    elements.get('#apply-recognition-button').click();
    assert.ok(editor.children.every(cell => cell.className === 'cell cell-黄色'));

    elements.get('#reset-button').click();
    let prevented = false;
    await documentListeners.get('paste')({
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => ({ type: 'image/png', size: 1000 }) }] },
      preventDefault() { prevented = true; },
    });
    assert.equal(prevented, true);
    assert.equal(elements.get('#image-status').textContent, '识别完成');
    elements.get('#apply-recognition-button').click();
    assert.ok(editor.children.every(cell => cell.className === 'cell cell-黄色'));

    prevented = false;
    await documentListeners.get('paste')({
      clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] },
      preventDefault() { prevented = true; },
    });
    assert.equal(prevented, false);
  } finally {
    delete globalThis.document;
    delete globalThis.createImageBitmap;
  }
});
