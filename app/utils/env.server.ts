import process from 'node:process'
import { z } from 'zod'
import { log } from './logger.server'

const schema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test'] as const),
  DATABASE_URL: z.string(),
  SESSION_SECRET: z.string(),
  HONEYPOT_SECRET: z.string(),
  PRODUCT_NAME: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  SENTRY_DSN: z.string().optional(),
})

declare global {
  // eslint-disable-next-line ts/no-namespace
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof schema> {}
  }
}

export function init() {
  const parsed = schema.safeParse(process.env)

  if (parsed.success === false) {
    log.error(parsed.error.flatten().fieldErrors, '❌ Invalid environment variables:')

    throw new Error('Invalid environment variables')
  }
}

/**
 * This is used in both `entry.server.ts` and `root.tsx` to ensure that
 * the environment variables are set and globally available before the app is
 * started.
 *
 * NOTE: Do *not* add any environment variables in here that you do not wish to
 * be included in the client.
 * @returns all public ENV variables
 */
export function getEnv() {
  return {
    MODE: process.env.NODE_ENV,
    SENTRY_DSN: process.env.SENTRY_DSN,
  }
}

type ENV = ReturnType<typeof getEnv>

declare global {
  const ENV: ENV
  interface Window {
    ENV: ENV
  }
}
