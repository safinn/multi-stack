import type { SentryReactRouterBuildOptions } from '@sentry/react-router'
import path from 'node:path'
import process from 'node:process'
import { reactRouter } from '@react-router/dev/vite'
import { sentryReactRouter } from '@sentry/react-router'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import svgSpriteTypePlugin from './app/svg/svgSpritePlugin'

const MODE = process.env.NODE_ENV

const sentryConfig: SentryReactRouterBuildOptions = {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  release: {
    name: process.env.COMMIT_SHA,
  },
  unstable_sentryVitePluginOptions: {
    release: {
      name: process.env.COMMIT_SHA,
      setCommits: {
        auto: true,
      },
    },
    sourcemaps: {
      filesToDeleteAfterUpload: ['./build/**/*.map'],
    },
  },
}

export default defineConfig(config => ({
  build: {
    rollupOptions: config.isSsrBuild
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
    sourcemap: true,
  },
  sentryConfig,
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    svgSpriteTypePlugin({
      spriteFilePath: './app/svg/sprite.svg',
    }),
    MODE === 'production' && process.env.SENTRY_AUTH_TOKEN
      ? sentryReactRouter(sentryConfig, config)
      : null,
  ],
  optimizeDeps: {
    exclude: ['@node-rs/argon2'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
  },
}))
