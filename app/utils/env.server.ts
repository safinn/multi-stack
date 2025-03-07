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
