import type { Insertable, Kysely, Selectable } from 'kysely'
import type { DB, Session } from 'kysely-codegen'

// T = the returned entity type
// E = the entity type used for inserts
export interface ISessionRepository<T, E> {
  findById: (id: string) => Promise<T | undefined>
  create: (session: E) => Promise<T | undefined>
  delete: (id: string) => Promise<T | undefined>
  sessionCount: (userId: string) => Promise<{
    count: string | number | bigint
  } | undefined>
  deleteAllExceptCurrent: (userId: string, currentSessionId: string) => Promise<T[] | undefined>
}

export class SessionRepository implements ISessionRepository<Selectable<Session>, Insertable<Session>> {
  private db: Kysely<DB>
  constructor(db: Kysely<DB>) {
    this.db = db
  }

  // id is the session to
  deleteAllExceptCurrent(userId: string, currentSessionId: string): Promise<Selectable<Session>[] | undefined> {
    return this.db
      .deleteFrom('session')
      .where('userId', '=', userId)
      .where('id', '!=', currentSessionId)
      .returningAll()
      .execute()
  }

  async sessionCount(userId: string) {
    return this.db
      .selectFrom('session')
      .where('userId', '=', userId)
      .select(eb => eb.fn.count('id').as('count'))
      .executeTakeFirst()
  }

  delete(id: string): Promise<Selectable<Session> | undefined> {
    return this.db
      .deleteFrom('session')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  create(session: Insertable<Session>): Promise<Selectable<Session> | undefined> {
    return this.db
      .insertInto('session')
      .values(session)
      .returningAll()
      .executeTakeFirst()
  }

  findById(id: string): Promise<Selectable<Session> | undefined> {
    return this.db
      .selectFrom('session')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
  }
}
