import { ColorGradient, getRGBColorStop, getShadowColors, sortColors } from './rgbirdflop.js';

const grid = 16;
const atlas = document.querySelector('#atlas');
const preview = document.querySelector('#atlas-preview');
const pageInput = document.querySelector('#page');
const atlasInput = document.querySelector('#atlas-input');
const tileInput = document.querySelector('#tile-input');
const textInput = document.querySelector('#text');
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
let copiedSequence = '';
let pendingTileImage = null;
const format = { bold: false, italic: false, underline: false, shadow: false };
let colors = [{ hex: '#54daf4', pos: 0 }, { hex: '#545eb6', pos: 100 }];
let shadowColors = null;

for (let value = 0xe0; value <= 0xf8; value++) {
  const prefix = value.toString(16).toUpperCase();
  pageInput.add(new Option(`glyph_${prefix}.png · U+${prefix}00–U+${prefix}FF`, prefix, prefix === page, prefix === page));
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
function setPage(prefix) { page=prefix.toUpperCase();copiedSequence='';if(!Array.from(pageInput.options).some(option=>option.value===page)) pageInput.add(new Option(`glyph_${page}.png · U+${page}00–U+${page}FF`,page)); pageInput.value=page; }
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
function hexRgb(hex) { const value = parseInt(hex.slice(1), 16); return [(value >> 16) & 255, (value >> 8) & 255, value & 255]; }
function rgbHex(rgb) { return `#${rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`; }
function gradientPalette(count) {
  const options={colors:sortColors(colors),shadowColors:shadowColors?sortColors(shadowColors):null};
  const foreground=new ColorGradient(options.colors.map(getRGBColorStop),count,document.querySelector('#gradient').value);
  const shadow=new ColorGradient(getShadowColors(options).map(getRGBColorStop),count);
  return Array.from({length:count},()=>({foreground:foreground.next(),shadow:shadow.next()}));
}
function minecraftFont() {
  const selected=document.querySelector('#font').value;
  if(selected!=='minecraft')return selected;
  if(format.bold&&format.italic)return 'MinecraftBoldItalic, MinecraftBoldItalicAlt, MinecraftOfficial, sans-serif';
  if(format.bold)return 'MinecraftBold, MinecraftBoldAlt, MinecraftOfficial, sans-serif';
  if(format.italic)return 'MinecraftItalic, MinecraftItalicAlt, MinecraftOfficial, sans-serif';
  return 'MinecraftRegular, MinecraftOfficial, MinecraftRegularAlt, MinecraftRus, sans-serif';
}
function sequencePlan(text) {
  const chars=Array.from(text),palette=gradientPalette(chars.length),items=[];
  let output='',used=0;
  chars.forEach((char,index)=>{
    if(/\s/u.test(char)){output+=char;return;}
    if(slot+used>=256)return;
    items.push({char,targetSlot:slot+used,palette:[palette[index]]});
    output+=String.fromCodePoint(parseInt(page,16)*256+slot+used);used++;
  });
  return {items,output,charCount:items.length};
}
function renderColors() { const wrap=document.querySelector('#colors');wrap.replaceChildren();colors.forEach((stop,index)=>{const row=document.createElement('div');row.className='color-stop';row.innerHTML=`<input type="color" value="${stop.hex}"><input type="number" min="0" max="100" value="${stop.pos}" aria-label="위치"><button type="button" aria-label="삭제">×</button>`;const inputs=row.querySelectorAll('input');inputs[0].addEventListener('input',()=>{stop.hex=inputs[0].value;render();});inputs[1].addEventListener('input',()=>{stop.pos=Math.min(100,Math.max(0,Number(inputs[1].value)));render();});row.querySelector('button').addEventListener('click',()=>{if(colors.length<=1)return;colors.splice(index,1);renderColors();render();});wrap.append(row);}); }
function renderShadowColors() { const wrap=document.querySelector('#shadow-colors');wrap.replaceChildren();if(!shadowColors)return;shadowColors.forEach((stop,index)=>{const row=document.createElement('div');row.className='color-stop';row.innerHTML=`<input type="color" value="${stop.hex}"><input type="number" min="0" max="100" value="${stop.pos}" aria-label="그림자 위치"><button type="button" aria-label="그림자 색상 삭제">×</button>`;const inputs=row.querySelectorAll('input');inputs[0].addEventListener('input',()=>{stop.hex=inputs[0].value;render();});inputs[1].addEventListener('input',()=>{stop.pos=Math.min(100,Math.max(0,Number(inputs[1].value)));render();});row.querySelector('button').addEventListener('click',()=>{if(shadowColors.length<=1)return;shadowColors.splice(index,1);renderShadowColors();render();});wrap.append(row);}); }
function drawText(context, commit, text=textInput.value, targetSlot=slot, fixedPalette=null) {
  if (!text) return;
  const size=cellSize(), x=(targetSlot%grid)*size, y=Math.floor(targetSlot/grid)*size;
  const tile=document.createElement('canvas');tile.width=size;tile.height=size;const tileContext=tile.getContext('2d',{willReadFrequently:true});
  const family=minecraftFont(),customFont=document.querySelector('#font').value!=='minecraft',style=customFont?`${format.italic?'italic ':''}${format.bold?'700 ':'400 '}`:'';
  let fontSize=Math.max(1,Math.round(size*Number(scaleInput.value)));tileContext.font=`${style}${fontSize}px ${family}`;
  const chars=Array.from(text.replace(/\n/g,' ')),letterGap=chars.length>1?Number(document.querySelector('#spacing').value):0;let widths=chars.map(char=>tileContext.measureText(char).width),total=widths.reduce((sum,value)=>sum+value,0)+letterGap*Math.max(0,chars.length-1);
  const rightGap=fixedPalette!==null?Math.max(0,Math.round(size/8)*Number(document.querySelector('#spacing').value)):0;
  if(total>size-rightGap){fontSize=Math.max(1,Math.floor(fontSize*(size-rightGap)/total));tileContext.font=`${style}${fontSize}px ${family}`;widths=chars.map(char=>tileContext.measureText(char).width);total=widths.reduce((sum,value)=>sum+value,0)+letterGap*Math.max(0,chars.length-1);}
  tileContext.textBaseline='middle'; const align=document.querySelector('#align').value; tileContext.textAlign='center';
  const sequenceCell=fixedPalette!==null,anchor=sequenceCell?0:align==='left'?0:align==='right'?size-rightGap:size/2;
  const offsetX=Number(document.querySelector('#offset-x').value)||0, offsetY=Number(document.querySelector('#offset-y').value)||0;
  let cursor=sequenceCell?0:anchor-total*(align==='center'?0.5:align==='right'?1:0);
  const palette=fixedPalette??gradientPalette(chars.length);
  chars.forEach((char,index)=>{const width=widths[index],color=palette[index]??palette[0];if(format.shadow){tileContext.fillStyle=rgbHex(color.shadow);tileContext.fillText(char,cursor+width/2+1+offsetX,size/2+1+offsetY);}tileContext.fillStyle=rgbHex(color.foreground);tileContext.fillText(char,cursor+width/2+offsetX,size/2+offsetY);if(format.underline)tileContext.fillRect(cursor+offsetX,size/2+fontSize*.42+offsetY,width,Math.max(1,fontSize/14));cursor+=width+letterGap;});
  const image=tileContext.getImageData(0,0,size,size);let maxOpaqueX=-1,maxOpaqueY=0;for(let index=0;index<image.data.length;index+=4){image.data[index+3]=image.data[index+3]>=96?255:0;if(image.data[index+3]===255){const pixel=index/4,x=pixel%size,y=Math.floor(pixel/size);if(x>maxOpaqueX){maxOpaqueX=x;maxOpaqueY=y;}}}if(sequenceCell&&maxOpaqueX>=0&&rightGap>0)for(let distance=1;distance<=rightGap&&maxOpaqueX+distance<size;distance++)image.data[(maxOpaqueY*size+maxOpaqueX+distance)*4+3]=20;tileContext.putImageData(image,0,0);
  if(commit)context.clearRect(x,y,size,size);context.imageSmoothingEnabled=false;context.drawImage(tile,x,y);document.querySelector('#render-info').textContent=`실제 ${fontSize}px · 셀 ${size}px · 픽셀 알파 적용`;
}
function drawTileImage(context,commit) {
  if(!pendingTileImage)return;
  const size=cellSize(),x=(slot%grid)*size,y=Math.floor(slot/grid)*size,fit=document.querySelector('#image-fit').value,scaleValue=Number(document.querySelector('#image-scale').value),offsetX=Number(document.querySelector('#image-offset-x').value),offsetY=Number(document.querySelector('#image-offset-y').value),sourceWidth=pendingTileImage.width,sourceHeight=pendingTileImage.height;
  let width=size,height=size;if(fit!=='stretch'){const base=fit==='cover'?Math.max(size/sourceWidth,size/sourceHeight):Math.min(size/sourceWidth,size/sourceHeight);width=Math.max(1,Math.round(sourceWidth*base*scaleValue));height=Math.max(1,Math.round(sourceHeight*base*scaleValue));}
  const targetX=x+Math.floor((size-width)/2)+offsetX,targetY=y+Math.floor((size-height)/2)+offsetY;if(commit)context.clearRect(x,y,size,size);context.save();context.beginPath();context.rect(x,y,size,size);context.clip();context.imageSmoothingEnabled=false;context.drawImage(pendingTileImage,targetX,targetY,width,height);context.restore();
}
function render() {
  preview.width = atlas.width; preview.height = atlas.height;
  const context = preview.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, preview.width, preview.height);
  context.drawImage(atlas, 0, 0);
  const plan=sequencePlan(textInput.value);if(document.querySelector('#packing').value==='sequence'&&plan.items.length)plan.items.forEach(item=>drawText(context,false,item.char,item.targetSlot,item.palette));else drawText(context,false);
  drawTileImage(context,false);
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
  const name = file.name.match(/^glyph_([0-9a-f]{1,4})\.png$/i);
  if (!name) { error.textContent = 'glyph_E2.png처럼 코드페이지 파일명만 열 수 있습니다. default8.png 등은 다른 폰트 규칙을 사용합니다.'; return; }
  if (parseInt(name[1],16)>0x10ff) { error.textContent = '유니코드 범위를 벗어난 글리프 페이지입니다.'; return; }
  const image = await imageFromFile(file);
  if (image.width < grid || image.height < grid || image.width > 8192 || image.height > 8192) { error.textContent = '가로·세로 16px 이상, 최대 8192px인 PNG가 필요합니다.'; return; }
  const sourceWidth=image.width,sourceHeight=image.height,size=Math.floor(Math.min(sourceWidth,sourceHeight)/grid)*grid;
  setPage(name[1]); atlas.width=size;atlas.height=size;const context=atlas.getContext('2d');context.imageSmoothingEnabled=false;context.drawImage(image,0,0,sourceWidth,sourceHeight,0,0,size,size);
  fileName.textContent = file.name; error.textContent = sourceWidth===size&&sourceHeight===size?'':`원본 ${sourceWidth}×${sourceHeight}px → 편집 아틀라스 ${size}×${size}px`; render();
});
preview.addEventListener('click', event => {
  const rect = preview.getBoundingClientRect(); const size = cellSize();
  const x = (event.clientX - rect.left) * preview.width / rect.width;
  const y = (event.clientY - rect.top) * preview.height / rect.height;
  slot = Math.min(255, Math.max(0, Math.floor(y / size) * grid + Math.floor(x / size)));copiedSequence='';document.querySelector('#copy').textContent='PUA 문자 복사';render();
});
pageInput.addEventListener('change', () => { page = pageInput.value;copiedSequence='';document.querySelector('#copy').textContent='PUA 문자 복사';render(); });
tileInput.addEventListener('change',async()=>{const file=tileInput.files[0];if(!file)return;pendingTileImage=await imageFromFile(file);document.querySelector('#image-name').textContent=`${file.name} · ${pendingTileImage.width}×${pendingTileImage.height}px`;render();});
['image-fit','image-scale','image-offset-x','image-offset-y'].forEach(id=>document.querySelector(`#${id}`).addEventListener('input',()=>{document.querySelector('#image-scale-value').textContent=`${Math.round(Number(document.querySelector('#image-scale').value)*100)}%`;render();}));
document.querySelector('#apply-image').addEventListener('click',()=>{if(!pendingTileImage)return;drawTileImage(atlas.getContext('2d'),true);pendingTileImage=null;tileInput.value='';document.querySelector('#image-name').textContent='선택된 이미지 없음';render();});
document.querySelector('#download-tile').addEventListener('click',()=>{const size=cellSize(),tile=document.createElement('canvas');tile.width=size;tile.height=size;tile.getContext('2d').drawImage(atlas,(slot%grid)*size,Math.floor(slot/grid)*size,size,size,0,0,size,size);tile.toBlob(blob=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`U+${codePoint().toString(16).toUpperCase()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);},'image/png');});
document.querySelector('#apply-text').addEventListener('click', async () => {
  if (!textInput.value) return;await document.fonts.ready;const sequence=document.querySelector('#packing').value==='sequence',plan=sequencePlan(textInput.value),context=atlas.getContext('2d');if(sequence)plan.items.forEach(item=>drawText(context,true,item.char,item.targetSlot,item.palette));else drawText(context,true);copiedSequence=sequence?plan.output:String.fromCodePoint(codePoint());document.querySelector('#copy').textContent=sequence?`${plan.charCount}자 PUA 문자열 복사`:'PUA 문자 복사';textInput.value='';render();
});
['text','packing','gradient','font','scale','spacing','offset-x','offset-y','align'].forEach(id=>document.querySelector(`#${id}`).addEventListener('input',()=>{document.querySelector('#size-value').textContent=`${Math.round(Number(scaleInput.value)*100)}%`;document.querySelector('#spacing-value').textContent=`${document.querySelector('#spacing').value}px`;render();}));
document.querySelector('#add-color').addEventListener('click',()=>{const last=colors.at(-1);colors.push({hex:last.hex,pos:100});const count=colors.length-1;colors=colors.map((color,index)=>({...color,pos:Math.round(index/count*100)}));renderColors();render();});
document.querySelector('#custom-shadow').addEventListener('change',event=>{shadowColors=event.target.checked?colors.map(color=>({hex:rgbHex(hexRgb(color.hex).map(value=>value*.25)),pos:color.pos})):null;document.querySelector('#shadow-editor').hidden=!shadowColors;renderShadowColors();render();});
document.querySelector('#add-shadow-color').addEventListener('click',()=>{if(!shadowColors)return;const last=shadowColors.at(-1);shadowColors.push({hex:last.hex,pos:100});const count=shadowColors.length-1;shadowColors=shadowColors.map((color,index)=>({...color,pos:Math.round(index/count*100)}));renderShadowColors();render();});
['bold','italic','underline','shadow'].forEach(id=>document.querySelector(`#${id}`).addEventListener('click',()=>{format[id]=!format[id];document.querySelector(`#${id}`).setAttribute('aria-pressed',String(format[id]));if(id==='shadow')document.querySelector('#shadow-controls').hidden=!format.shadow;render();}));
document.querySelector('#font-input').addEventListener('change',async()=>{const file=document.querySelector('#font-input').files[0];if(!file)return;const family=`forBE-${Date.now()}`,url=URL.createObjectURL(file),face=new FontFace(family,`url(${url})`);await face.load();document.fonts.add(face);document.querySelector('#font').add(new Option(file.name,family,true,true));URL.revokeObjectURL(url);render();});
document.querySelector('#clear').addEventListener('click', () => { const size = cellSize(); atlas.getContext('2d').clearRect((slot % grid) * size, Math.floor(slot / grid) * size, size, size); render(); });
document.querySelector('#copy').addEventListener('click', async () => { await navigator.clipboard.writeText(copiedSequence||String.fromCodePoint(codePoint()));const label=document.querySelector('#copy').textContent;document.querySelector('#copy').textContent='복사됨';setTimeout(()=>document.querySelector('#copy').textContent=label,1200); });
document.querySelector('#download').addEventListener('click', () => atlas.toBlob(blob => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = glyphName(); link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }, 'image/png'));
renderColors();renderShadowColors();resetAtlas();
