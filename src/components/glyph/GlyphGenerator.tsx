import { $, component$, useSignal, useStore, useVisibleTask$ } from '@qwik.dev/core';
import Copy from 'lucide-icons-qwik/icons/Copy';
import Download from 'lucide-icons-qwik/icons/Download';
import ImageUp from 'lucide-icons-qwik/icons/ImageUp';
import Trash from 'lucide-icons-qwik/icons/Trash';
import { glyphCharacter, glyphFileName, glyphHex, GLYPH_GRID_SIZE } from '~/util/glyph';

type GlyphSettings = { page: string; slot: number; cellSize: number; text: string; textColor: string; textScale: number };
const pages = Array.from({ length: 25 }, (_, index) => (0xE0 + index).toString(16).toUpperCase());
const filePage = (name: string): string | undefined => name.match(/^glyph_([0-9a-f]{2})\.png$/i)?.[1]?.toUpperCase();
const loadImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다.')); };
  image.src = url;
});
const glyphContentSize = (canvas: HTMLCanvasElement, slot: number): string => {
  const cell = canvas.width / GLYPH_GRID_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return '확인 불가';
  const pixels = context.getImageData((slot % GLYPH_GRID_SIZE) * cell, Math.floor(slot / GLYPH_GRID_SIZE) * cell, cell, cell).data;
  let minX = cell; let minY = cell; let maxX = -1; let maxY = -1;
  for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
    if (pixels[(y * cell + x) * 4 + 3] === 0) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? '투명' : `${maxX - minX + 1}×${maxY - minY + 1}px`;
};

export default component$(() => {
  const atlas = useSignal<HTMLCanvasElement>();
  const preview = useSignal<HTMLCanvasElement>();
  const sourceName = useSignal('새 glyph_E2.png');
  const message = useSignal('');
  const copied = useSignal(false);
  const contentSize = useSignal('투명');
  const settings = useStore<GlyphSettings>({ page: 'E2', slot: 0, cellSize: 32, text: '', textColor: '#FFFFFF', textScale: 1 });
  const render = $(() => {
    const atlasCanvas = atlas.value;
    const previewCanvas = preview.value;
    if (!atlasCanvas || !previewCanvas) return;
    previewCanvas.width = atlasCanvas.width;
    previewCanvas.height = atlasCanvas.height;
    const context = previewCanvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    context.drawImage(atlasCanvas, 0, 0);
    const cell = atlasCanvas.width / GLYPH_GRID_SIZE;
    context.strokeStyle = '#ffffff55';
    context.lineWidth = Math.max(1, Math.round(cell / 32));
    for (let index = 0; index <= GLYPH_GRID_SIZE; index++) {
      const position = index * cell;
      context.beginPath(); context.moveTo(position, 0); context.lineTo(position, atlasCanvas.height); context.stroke();
      context.beginPath(); context.moveTo(0, position); context.lineTo(atlasCanvas.width, position); context.stroke();
    }
    const x = (settings.slot % GLYPH_GRID_SIZE) * cell;
    const y = Math.floor(settings.slot / GLYPH_GRID_SIZE) * cell;
    context.lineWidth = Math.max(2, Math.round(cell / 8));
    context.strokeStyle = '#60a5fa';
    context.strokeRect(x + context.lineWidth / 2, y + context.lineWidth / 2, cell - context.lineWidth, cell - context.lineWidth);
    contentSize.value = glyphContentSize(atlasCanvas, settings.slot);
  });
  const initialize = $(() => {
    if (!atlas.value) return;
    atlas.value.width = settings.cellSize * GLYPH_GRID_SIZE;
    atlas.value.height = settings.cellSize * GLYPH_GRID_SIZE;
    void render();
  });
  useVisibleTask$(() => { void initialize(); });
  const chooseSlot = $(async (event: MouseEvent, element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) * element.width / rect.width;
    const y = (event.clientY - rect.top) * element.height / rect.height;
    const cell = element.width / GLYPH_GRID_SIZE;
    settings.slot = Math.min(255, Math.max(0, Math.floor(y / cell) * GLYPH_GRID_SIZE + Math.floor(x / cell)));
    await render();
  });
  const uploadAtlas = $(async (_: Event, element: HTMLInputElement) => {
    const file = element.files?.[0];
    if (!file || file.type !== 'image/png') return;
    const image = await loadImage(file);
    const page = filePage(file.name);
    if (!page) {
      message.value = '이 편집기는 glyph_E0.png처럼 코드페이지 이름을 가진 Bedrock glyph 시트 전용입니다. default8.png 같은 일반 폰트 텍스처는 별도 규칙으로 처리해야 합니다.';
      return;
    }
    if (image.width !== image.height || image.width % GLYPH_GRID_SIZE !== 0 || image.width > 8192) {
      message.value = '정사각형이며 한 변이 16으로 나누어지는 PNG만 글리프 시트로 열 수 있습니다.';
      return;
    }
    if (!atlas.value) return;
    atlas.value.width = image.width;
    atlas.value.height = image.height;
    atlas.value.getContext('2d')?.drawImage(image, 0, 0);
    settings.cellSize = image.width / GLYPH_GRID_SIZE;
    if (pages.includes(page)) settings.page = page;
    sourceName.value = file.name;
    message.value = '';
    await render();
  });
  const replaceTile = $(async (_: Event, element: HTMLInputElement) => {
    const file = element.files?.[0];
    if (!file || !file.type.startsWith('image/') || !atlas.value) return;
    const image = await loadImage(file);
    const cell = atlas.value.width / GLYPH_GRID_SIZE;
    const x = (settings.slot % GLYPH_GRID_SIZE) * cell;
    const y = Math.floor(settings.slot / GLYPH_GRID_SIZE) * cell;
    const context = atlas.value.getContext('2d');
    if (!context) return;
    context.clearRect(x, y, cell, cell);
    context.imageSmoothingEnabled = false;
    const scale = Math.min(cell / image.width, cell / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    context.drawImage(image, x + Math.floor((cell - width) / 2), y + Math.floor((cell - height) / 2), width, height);
    await render();
  });
  const clearTile = $(async () => {
    if (!atlas.value) return;
    const cell = atlas.value.width / GLYPH_GRID_SIZE;
    atlas.value.getContext('2d')?.clearRect((settings.slot % GLYPH_GRID_SIZE) * cell, Math.floor(settings.slot / GLYPH_GRID_SIZE) * cell, cell, cell);
    await render();
  });
  const renderText = $(async () => {
    if (!atlas.value || settings.text.trim().length === 0) return;
    await document.fonts.ready;
    const cell = atlas.value.width / GLYPH_GRID_SIZE;
    const x = (settings.slot % GLYPH_GRID_SIZE) * cell;
    const y = Math.floor(settings.slot / GLYPH_GRID_SIZE) * cell;
    const context = atlas.value.getContext('2d');
    if (!context) return;
    context.clearRect(x, y, cell, cell);
    context.fillStyle = settings.textColor;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    let fontSize = Math.max(1, Math.floor(cell * settings.textScale));
    context.font = `${fontSize}px MinecraftRegular, MinecraftOfficial, sans-serif`;
    while (fontSize > 1 && context.measureText(settings.text).width > cell - 2) {
      fontSize--;
      context.font = `${fontSize}px MinecraftRegular, MinecraftOfficial, sans-serif`;
    }
    context.fillText(settings.text, x + cell / 2, y + cell / 2);
    await render();
  });
  const copyGlyph = $(async () => {
    await navigator.clipboard.writeText(glyphCharacter(settings.page, settings.slot));
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  });
  const download = $(() => atlas.value?.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = glyphFileName(settings.page); link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, 'image/png'));
  return <section class="mx-auto min-h-svh max-w-7xl px-6 pt-20 pb-10">
    <canvas ref={atlas} class="hidden" />
    <div class="mb-8 max-w-3xl"><p class="text-lum-accent mb-2 font-semibold">Minecraft Bedrock Edition · Browser-only</p><h1 class="mb-3 flex items-center gap-3 text-3xl font-extrabold"><ImageUp size={34} /> Bedrock Glyph 편집기</h1><p class="text-lum-text-secondary">기존 <code>glyph_EX.png</code>을 올리고 256개 슬롯을 그대로 편집합니다. 파일은 서버에 전송되지 않습니다.</p></div>
    <div class="grid gap-5 xl:grid-cols-[19rem_minmax(0,1fr)_18rem]">
      <aside class="lum-card lum-grad-bg-lum-card-bg/50 h-fit gap-5"><label class="flex cursor-pointer flex-col gap-2"><span class="font-semibold">글리프 시트 열기</span><span class="lum-btn lum-bg-blue/50 hover:lum-bg-blue justify-center"><ImageUp size={18} /> PNG 업로드</span><input class="sr-only" type="file" accept="image/png" onChange$={uploadAtlas} /><span class="text-lum-text-secondary truncate text-sm">{sourceName.value}</span></label><label class="flex flex-col gap-2"><span class="font-semibold">페이지</span><select class="lum-input" value={settings.page} onChange$={async (_, element) => { settings.page = element.value; await render(); }}>{pages.map((page) => <option key={page} value={page}>{`glyph_${page}.png · U+${page}00–U+${page}FF`}</option>)}</select><span class="text-lum-text-secondary text-sm">E0·E1은 바닐라 이모지와 겹칠 수 있어, 새 작업에는 E2–F8을 권장합니다.</span></label><div class="text-lum-text-secondary text-sm"><p>시트: {atlas.value ? `${atlas.value.width}×${atlas.value.height}px` : '준비 중'}</p><p>셀: {settings.cellSize}×{settings.cellSize}px</p><p>16×16 = 256개 주소</p></div>{message.value && <p class="rounded bg-red-500/20 p-3 text-sm text-red-200">{message.value}</p>}</aside>
      <div class="lum-card lum-grad-bg-lum-card-bg/50 min-w-0 gap-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-bold">글리프 시트</h2><p class="text-lum-text-secondary text-sm">칸을 선택한 뒤 오른쪽에서 교체합니다.</p></div><button class="lum-btn lum-bg-green/50 hover:lum-bg-green" onClick$={download}><Download size={18} /> {glyphFileName(settings.page)} 다운로드</button></div><div class="border-lum-border/20 flex max-h-[min(70vh,54rem)] min-h-96 items-center justify-center overflow-auto rounded border bg-black/30 p-4"><canvas ref={preview} onClick$={chooseSlot} class="max-w-none cursor-crosshair" style={{ imageRendering: 'pixelated' }} /></div></div>
      <aside class="lum-card lum-grad-bg-lum-card-bg/50 h-fit gap-5"><div><h2 class="text-xl font-bold">선택한 슬롯</h2><p class="text-lum-text-secondary mt-1 font-mono text-sm">행 {Math.floor(settings.slot / 16).toString(16).toUpperCase()} · 열 {(settings.slot % 16).toString(16).toUpperCase()}</p></div><div class="rounded border border-lum-border/20 bg-black/20 p-3"><p class="text-lum-text-secondary text-sm">코드포인트 · 실제 콘텐츠 크기</p><p class="font-mono text-lg">{glyphHex(settings.page, settings.slot)} · {contentSize.value}</p><p class="mt-2 text-3xl">{glyphCharacter(settings.page, settings.slot)}</p></div><button class="lum-btn lum-bg-transparent" onClick$={copyGlyph}><Copy size={18} /> {copied.value ? '문자 복사됨' : 'PUA 문자 복사'}</button><label class="flex flex-col gap-2"><span class="font-semibold">텍스트로 이 칸 만들기</span><input class="lum-input" value={settings.text} placeholder="예: SHOP" onInput$={(_, element) => { settings.text = element.value; }} /><span class="flex items-center gap-2"><input type="color" value={settings.textColor} onInput$={(_, element) => { settings.textColor = element.value; }} /><input class="flex-1" type="range" min="0.25" max="1" step="0.05" value={settings.textScale} onInput$={(_, element) => { settings.textScale = Number(element.value); }} /></span><button class="lum-btn lum-bg-violet/50 hover:lum-bg-violet" onClick$={renderText}>텍스트 적용</button></label><label class="flex cursor-pointer flex-col gap-2"><span class="font-semibold">이 칸을 이미지로 교체</span><span class="lum-btn lum-bg-blue/50 hover:lum-bg-blue justify-center"><ImageUp size={18} /> 이미지 선택</span><input class="sr-only" type="file" accept="image/png,image/webp,image/jpeg" onChange$={replaceTile} /></label><button class="lum-btn lum-bg-red/40 hover:lum-bg-red" onClick$={clearTile}><Trash size={18} /> 선택 칸 비우기</button><p class="text-lum-text-secondary text-sm">다운로드 파일을 리소스팩의 <code>font/{glyphFileName(settings.page)}</code>에 넣으면 됩니다.</p></aside>
    </div>
  </section>;
});
