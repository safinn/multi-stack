import type { Config } from '@react-router/dev/config'
import process from 'node:process'
import { sentryOnBuildEnd } from '@sentry/react-router'

const MODE = process.env.NODE_ENV

export default {
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  buildEnd: async ({ viteConfig, reactRouterConfig, buildManifest }) => {
    // Call this at the end of the hook
    if (MODE === 'production' && process.env.SENTRY_AUTH_TOKEN) {
      await sentryOnBuildEnd({
        viteConfig,
        reactRouterConfig,
        buildManifest,
      })
    }
  },
} satisfies Config
