import { createRequestHandler } from '@react-router/express'
import express from 'express'
import { init } from '~/utils/env.server'
import { httpLogger } from '~/utils/logger.server.js'
import 'react-router'

// Verify that all environment variables are set
init()

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
