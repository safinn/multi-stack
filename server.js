/* eslint-disable antfu/no-top-level-await */
import crypto from 'node:crypto'
import process from 'node:process'
import closeWithGrace from 'close-with-grace'
import compression from 'compression'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { log } from './app/utils/logger.server.ts'

// Short-circuit the type-checking of the built output.
const BUILD_PATH = './build/server/index.js'
const DEVELOPMENT = process.env.NODE_ENV === 'development'
const PORT = Number.parseInt(process.env.PORT || '3000')

const app = express()
app.set('trust proxy', 1)
app.disable('x-powered-by')

// Rate limiting
const maxMultiple = 1
const rateLimitDefault = {
  windowMs: 60 * 1000,
  max: 1000 * maxMultiple,
  standardHeaders: true,
  legacyHeaders: false,
}

const strongestRateLimit = rateLimit({
  ...rateLimitDefault,
  windowMs: 60 * 1000,
  max: 10 * maxMultiple,
})
const strongRateLimit = rateLimit({
  ...rateLimitDefault,
  windowMs: 60 * 1000,
  max: 100 * maxMultiple,
})
const generalRateLimit = rateLimit(rateLimitDefault)
app.use((req, res, next) => {
  const strongPaths = [
    '/login',
    '/signup',
    '/verify',
    '/admin',
    '/reset-password',
  ]
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (strongPaths.some(p => req.path.includes(p))) {
      return strongestRateLimit(req, res, next)
    }
    return strongRateLimit(req, res, next)
  }

  // the verify route is a special case because it's a GET route that
  // can have a token in the query string
  if (req.path.includes('/verify')) {
    return strongestRateLimit(req, res, next)
  }

  return generalRateLimit(req, res, next)
})

app.use(compression())

// nonce generation
app.use((_, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('hex')
  next()
})

app.use(
  helmet({
    xPoweredBy: false,
    contentSecurityPolicy: {
      directives: {
        'script-src': [
          '\'self\'',
          (req, res) => `'nonce-${res.locals.cspNonce}'`,
        ],
        'connect-src': [
          DEVELOPMENT ? 'ws:' : '',
          '\'self\'',
        ],
      },
    },
  }),
)

if (DEVELOPMENT) {
  log.info('Starting development server')
  const viteDevServer = await import('vite').then(vite =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  )
  app.use(viteDevServer.middlewares)

  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule('./server/app.ts')
      return await source.app(req, res, next)
    }
    catch (error) {
      if (typeof error === 'object' && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error)
      }
      next(error)
    }
  })
}
else {
  log.info('Starting production server')
  app.use(
    '/assets',
    express.static('build/client/assets', { immutable: true, maxAge: '1y' }),
  )
  app.use(express.static('build/client', { maxAge: '1h' }))
  app.use(await import(BUILD_PATH).then(mod => mod.app))
}

const server = app.listen(PORT, () => {
  log.info(`Server is running on http://localhost:${PORT}`)
})

closeWithGrace({
  delay: 3000,
}, async () => {
  await new Promise((resolve, reject) => {
    server.close(e => (e ? reject(e) : resolve('ok')))
  })
})
