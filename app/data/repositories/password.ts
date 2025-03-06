import type { Insertable, Kysely, Selectable, Transaction, Updateable } from 'kysely'
import type { DB, Password } from 'kysely-codegen'

// T = the returned entity type
// E = the entity type used for inserts
// U = the entity type used for updates
export interface IPasswordRepository<T, E, U> {
  create: (password: E) => Promise<T | undefined>
  patchByUserId: (userId: string, password: U) => Promise<T | undefined>
  findByUserId: (userId: string) => Promise<T | undefined>
}

export class PasswordRepository implements IPasswordRepository<Selectable<Password>, Insertable<Password>, Updateable<Password>> {
  private db: Kysely<DB> | Transaction<DB>
  constructor(db: Kysely<DB> | Transaction<DB>) {
    this.db = db
  }

  findByUserId(userId: string): Promise<Selectable<Password> | undefined> {
    return this.db
      .selectFrom('password')
      .where('userId', '=', userId)
      .selectAll()
      .executeTakeFirst()
  }

  patchByUserId(userId: string, password: Updateable<Password>): Promise<Selectable<Password> | undefined> {
    return this.db
      .updateTable('password')
      .set(password)
      .where('userId', '=', userId)
      .returningAll()
      .executeTakeFirst()
  }

  create(password: Insertable<Password>): Promise<Selectable<Password> | undefined> {
    return this.db
      .insertInto('password')
      .values(password)
      .returningAll()
      .executeTakeFirst()
  }
}
