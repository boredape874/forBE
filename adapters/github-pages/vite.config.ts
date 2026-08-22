import { staticAdapter } from '@qwik.dev/router/adapters/static/vite';
import { extendConfig } from '@qwik.dev/router/vite';
import baseConfig from '../../vite.config.ts';

export default extendConfig(baseConfig, () => ({
  base: '/forBE/',
  build: {
    ssr: true,
    rollupOptions: {
      input: ['src/entry.ssr.tsx'],
    },
  },
  plugins: [
    staticAdapter({
      basePathname: '/forBE/',
      include: ['/resources/glyph/'],
      origin: 'https://boredape874.github.io',
      outDir: 'dist-pages',
    }),
  ],
}));
