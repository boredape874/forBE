const grid = 16;
const atlas = document.querySelector('#atlas');
const preview = document.querySelector('#atlas-preview');
const pageInput = document.querySelector('#page');
const atlasInput = document.querySelector('#atlas-input');
const tileInput = document.querySelector('#tile-input');
const textInput = document.querySelector('#text');
const colorInput = document.querySelector('#color');
const scaleInput = document.querySelector('#scale');
const fileName = document.querySelector('#file-name');
const atlasInfo = document.querySelector('#atlas-info');
const error = document.querySelector('#error');
const position = document.querySelector('#position');
const code = document.querySelector('#code');
const character = document.querySelector('#character');
const path = document.querySelector('#path');
let page = 'E2';
let slot = 0;

for (let value = 0xe0; value <= 0xf8; value++) {
  const prefix = value.toString(16).toUpperCase();
  pageInput.add(new Option(`glyph_${prefix}.png · U+${prefix}00–U+${prefix}FF`, prefix, prefix === page));
}

function codePoint() { return parseInt(page, 16) * 256 + slot; }
function glyphName() { return `glyph_${page}.png`; }
function cellSize() { return atlas.width / grid; }
function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다.')); };
    image.src = url;
  });
}
function contentSize() {
  const size = cellSize();
  const x0 = (slot % grid) * size;
  const y0 = Math.floor(slot / grid) * size;
  const pixels = atlas.getContext('2d').getImageData(x0, y0, size, size).data;
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (pixels[(y * size + x) * 4 + 3] === 0) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? '투명' : `${maxX - minX + 1}×${maxY - minY + 1}px`;
}
function render() {
  preview.width = atlas.width; preview.height = atlas.height;
  const context = preview.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, preview.width, preview.height);
  context.drawImage(atlas, 0, 0);
  const size = cellSize();
  context.strokeStyle = '#ffffff55'; context.lineWidth = Math.max(1, Math.round(size / 32));
  for (let index = 0; index <= grid; index++) {
    context.beginPath(); context.moveTo(index * size, 0); context.lineTo(index * size, atlas.height); context.stroke();
    context.beginPath(); context.moveTo(0, index * size); context.lineTo(atlas.width, index * size); context.stroke();
  }
  const x = (slot % grid) * size; const y = Math.floor(slot / grid) * size;
  context.strokeStyle = '#60a5fa'; context.lineWidth = Math.max(2, Math.round(size / 8));
  context.strokeRect(x + context.lineWidth / 2, y + context.lineWidth / 2, size - context.lineWidth, size - context.lineWidth);
  atlasInfo.textContent = `${atlas.width}×${atlas.height}px · 셀 ${size}×${size}px`;
  position.textContent = `행 ${Math.floor(slot / 16).toString(16).toUpperCase()} · 열 ${(slot % 16).toString(16).toUpperCase()}`;
  code.textContent = `U+${codePoint().toString(16).toUpperCase()} · ${contentSize()}`;
  character.textContent = String.fromCodePoint(codePoint());
  document.querySelector('#download').textContent = `${glyphName()} 다운로드`;
  path.textContent = `font/${glyphName()}`;
}
function resetAtlas(size = 512) { atlas.width = size; atlas.height = size; render(); }
atlasInput.addEventListener('change', async () => {
  const file = atlasInput.files[0]; if (!file) return;
  const name = file.name.match(/^glyph_([0-9a-f]{2})\.png$/i);
  if (!name) { error.textContent = 'glyph_E2.png처럼 코드페이지 파일명만 열 수 있습니다. default8.png 등은 다른 폰트 규칙을 사용합니다.'; return; }
  const image = await imageFromFile(file);
  if (image.width !== image.height || image.width % grid !== 0 || image.width > 8192) { error.textContent = '정사각형이고 한 변이 16으로 나누어지는 PNG가 필요합니다.'; return; }
  page = name[1].toUpperCase(); pageInput.value = page; atlas.width = image.width; atlas.height = image.height;
  atlas.getContext('2d').drawImage(image, 0, 0); fileName.textContent = file.name; error.textContent = ''; render();
});
preview.addEventListener('click', event => {
  const rect = preview.getBoundingClientRect(); const size = cellSize();
  const x = (event.clientX - rect.left) * preview.width / rect.width;
  const y = (event.clientY - rect.top) * preview.height / rect.height;
  slot = Math.min(255, Math.max(0, Math.floor(y / size) * grid + Math.floor(x / size))); render();
});
pageInput.addEventListener('change', () => { page = pageInput.value; render(); });
tileInput.addEventListener('change', async () => {
  const file = tileInput.files[0]; if (!file) return;
  const image = await imageFromFile(file); const size = cellSize(); const x = (slot % grid) * size; const y = Math.floor(slot / grid) * size;
  const context = atlas.getContext('2d'); context.clearRect(x, y, size, size); context.imageSmoothingEnabled = false;
  const scale = Math.min(size / image.width, size / image.height); const width = Math.max(1, Math.round(image.width * scale)); const height = Math.max(1, Math.round(image.height * scale));
  context.drawImage(image, x + Math.floor((size - width) / 2), y + Math.floor((size - height) / 2), width, height); render();
});
document.querySelector('#apply-text').addEventListener('click', async () => {
  const text = textInput.value.trim(); if (!text) return;
  await document.fonts.ready; const size = cellSize(); const x = (slot % grid) * size; const y = Math.floor(slot / grid) * size; const context = atlas.getContext('2d');
  context.clearRect(x, y, size, size); context.fillStyle = colorInput.value; context.textAlign = 'center'; context.textBaseline = 'middle';
  let fontSize = Math.max(1, Math.floor(size * Number(scaleInput.value))); context.font = `${fontSize}px MinecraftRegular, sans-serif`;
  while (fontSize > 1 && context.measureText(text).width > size - 2) { context.font = `${--fontSize}px MinecraftRegular, sans-serif`; }
  context.fillText(text, x + size / 2, y + size / 2); render();
});
document.querySelector('#clear').addEventListener('click', () => { const size = cellSize(); atlas.getContext('2d').clearRect((slot % grid) * size, Math.floor(slot / grid) * size, size, size); render(); });
document.querySelector('#copy').addEventListener('click', async () => { await navigator.clipboard.writeText(String.fromCodePoint(codePoint())); document.querySelector('#copy').textContent = '복사됨'; setTimeout(() => document.querySelector('#copy').textContent = 'PUA 문자 복사', 1200); });
document.querySelector('#download').addEventListener('click', () => atlas.toBlob(blob => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = glyphName(); link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }, 'image/png'));
resetAtlas();
