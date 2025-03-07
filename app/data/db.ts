import type { DB } from '~/data/db.d'
import process from 'node:process'
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

const { Pool } = pg

const { DATABASE_URL } = process.env

export const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: DATABASE_URL,
  }),
})

export const plugins = [
  new CamelCasePlugin(),
]

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<DB>({
  dialect,
  plugins,
})
