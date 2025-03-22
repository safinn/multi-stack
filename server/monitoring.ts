import process from 'node:process'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import * as Sentry from '@sentry/react-router'

export function init() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 1 : 0,
    denyUrls: [
      /\/resources\/healthcheck/,
      // TODO: be smarter about the public assets...
      /\/build\//,
      /\/favicons\//,
      /\/img\//,
      /\/fonts\//,
      /\/favicon.ico/,
      /\/site\.webmanifest/,
    ],
    integrations: [
      Sentry.httpIntegration(),
      nodeProfilingIntegration(),
    ],
    beforeSendTransaction(event) {
      // ignore all healthcheck related transactions
      // note that name of header here is case-sensitive
      if (event.request?.headers?.['x-healthcheck'] === 'true') {
        return null
      }

      return event
    },
  })
}
