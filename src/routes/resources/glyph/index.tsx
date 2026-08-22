import { component$ } from '@qwik.dev/core';
import GlyphGenerator from '~/components/glyph/GlyphGenerator';
import { generateHead } from '~/root';

export default component$(() => <GlyphGenerator />);

export const head = generateHead({
  title: 'Bedrock Glyph Generator',
  description: 'Create Minecraft Bedrock resource-pack glyph sheets from images.',
});
