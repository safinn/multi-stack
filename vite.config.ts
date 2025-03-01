import path from 'node:path'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import svgSpriteTypePlugin from './app/svg/svgSpritePlugin'

export default defineConfig(({ isSsrBuild }) => ({
  build: {
    rollupOptions: isSsrBuild
      ? {
          input: './server/app.ts',
        }
      : undefined,
    assetsInlineLimit: (source: string) => {
      if (
        source.endsWith('sprite.svg')
        || source.endsWith('favicon.svg')
        || source.endsWith('apple-touch-icon.png')
      ) {
        return false
      }
    },
  },
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), svgSpriteTypePlugin({
    spriteFilePath: './app/svg/sprite.svg',
  })],
  optimizeDeps: {
    exclude: ['@node-rs/argon2'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
  },
}))
