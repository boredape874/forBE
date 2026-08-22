export const GLYPH_GRID_SIZE = 16;

export const glyphCodePoint = (page: string, slot: number): number =>
  Number.parseInt(page, 16) * 0x100 + slot;

export const glyphCharacter = (page: string, slot: number): string =>
  String.fromCodePoint(glyphCodePoint(page, slot));

export const glyphHex = (page: string, slot: number): string =>
  `U+${glyphCodePoint(page, slot).toString(16).toUpperCase().padStart(4, '0')}`;

export const glyphFileName = (page: string): string =>
  `glyph_${page.toUpperCase()}.png`;
