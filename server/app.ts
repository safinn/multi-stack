import process from 'node:process'
import { createRequestHandler } from '@react-router/express'
import express from 'express'
import { init } from '~/utils/env.server'
import { httpLogger } from '~/utils/logger.server.js'
import 'react-router'

const MODE = process.env.NODE_ENV ?? 'development'
const IS_PROD = MODE === 'production'
const SENTRY_ENABLED = IS_PROD && process.env.SENTRY_DSN

// Verify that all environment variables are set
init()

if (SENTRY_ENABLED) {
  void import('./monitoring').then(({ init }) => init())
}

declare module 'react-router' {
  interface AppLoadContext {
    cspNonce: string
  }
}

export const app = express()

app.use(httpLogger())

app.use(
  createRequestHandler({
    // @ts-expect-error - virtual module provided by React Router at build time
    build: () => import('virtual:react-router/server-build'),
    getLoadContext(_, res) {
      return {
        cspNonce: res.locals.cspNonce,
      }
    },
  }),
)
