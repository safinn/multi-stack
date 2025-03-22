import type { RenderToPipeableStreamOptions } from 'react-dom/server'
import type { ActionFunctionArgs, EntryContext, LoaderFunctionArgs } from 'react-router'
import crypto from 'node:crypto'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { contentSecurity } from '@nichtsam/helmet/content'
import { createReadableStreamFromReadable } from '@react-router/node'
import * as Sentry from '@sentry/node'
import { isbot } from 'isbot'
import { renderToPipeableStream } from 'react-dom/server'
import { ServerRouter } from 'react-router'
import { init } from './utils/env.server'
import { log } from './utils/logger.server'
import { NonceProvider } from './utils/NonceProvider'

export const streamTimeout = 5_000

init()

const MODE = process.env.NODE_ENV ?? 'development'

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false
    const userAgent = request.headers.get('user-agent')

    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      responseHeaders.append('Document-Policy', 'js-profiling')
    }

    const nonce = crypto.randomBytes(16).toString('hex')

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    const readyOption: keyof RenderToPipeableStreamOptions
      = (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? 'onAllReady'
        : 'onShellReady'

    const { pipe, abort } = renderToPipeableStream(
      <NonceProvider value={nonce}>
        <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
      </NonceProvider>,
      {
        [readyOption]() {
          shellRendered = true
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)

          responseHeaders.set('Content-Type', 'text/html')

          contentSecurity(responseHeaders, {
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
              directives: {
                fetch: {
                  'script-src': [
                    '\'self\'',
                    `\'nonce-${nonce}\'`,
                  ],
                  'connect-src': [
                    MODE === 'development' ? 'ws:' : '',
                    process.env.SENTRY_DSN ? '*.sentry.io' : undefined,
                    '\'self\'',
                  ],
                },
              },
            },

          })

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          )

          pipe(body)
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onError(error: unknown) {
          responseStatusCode = 500
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            log.error(error)
          }
        },
        nonce,
      },
    )

    // Abort the rendering stream after the `streamTimeout` so it has tine to
    // flush down the rejected boundaries
    setTimeout(abort, streamTimeout + 1000)
  })
}

export function handleError(error: unknown, { request }: LoaderFunctionArgs | ActionFunctionArgs) {
  if (!request.signal.aborted) {
    Sentry.captureException(error)
    log.error(error, 'error in action or loader')
  }
}
