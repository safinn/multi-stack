import { sql } from 'kysely'

export function withTimestamps(qb) {
  return qb
    .addColumn('created_at', 'timestamptz', col =>
      col.defaultTo(sql`current_timestamp`).notNull())
    .addColumn('updated_at', 'timestamptz', col =>
      col.defaultTo(sql`current_timestamp`).notNull())
}

export function withSoftDeletes(qb) {
  return qb
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('deleted_by', 'uuid')
}
