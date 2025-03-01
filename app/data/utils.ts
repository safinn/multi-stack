import { sql } from 'kysely'

export function withTimestamps(qb: any) {
  return qb
    .addColumn('created_at', 'timestamptz', (col: any) =>
      col.defaultTo(sql`current_timestamp`).notNull())
    .addColumn('updated_at', 'timestamptz', (col: any) =>
      col.defaultTo(sql`current_timestamp`).notNull())
}

export function withSoftDeletes(qb: any) {
  return qb
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('deleted_by', 'uuid')
}
