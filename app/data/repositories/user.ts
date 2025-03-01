import type { Insertable, Kysely, Selectable, Updateable } from 'kysely'
import type { DB, User } from 'kysely-codegen'

// T = the returned entity type
// E = the entity type used for inserts
// U = the entity type used for updates
export interface IUserRepository<T, E, U> {
  findByUsername: (username: string) => Promise<T | undefined>
  findByEmail: (email: string) => Promise<T | undefined>
  findByUsernameOrEmail: (val: string) => Promise<T | undefined>
  create: (user: E) => Promise<T | undefined>
  findById: (id: string) => Promise<T | undefined>
  patch: (id: string, user: U) => Promise<T | undefined>
  delete: (id: string) => Promise<void>
}

export class UserRepository implements IUserRepository<Selectable<User>, Insertable<User>, Updateable<User>> {
  private db: Kysely<DB>
  constructor(db: Kysely<DB>) {
    this.db = db
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('user')
      .where('id', '=', id)
      .execute()
  }

  findByUsernameOrEmail(val: string): Promise<Selectable<User> | undefined> {
    return this.db.selectFrom('user')
      .where(eb => eb.or({ username: val, email: val }))
      .selectAll()
      .executeTakeFirst()
  }

  findByUsername(username: string): Promise<Selectable<User> | undefined> {
    return this.db.selectFrom('user').where('username', '=', username).selectAll().executeTakeFirst()
  }

  findByEmail(email: string): Promise<Selectable<User> | undefined> {
    return this.db.selectFrom('user').where('email', '=', email).selectAll().executeTakeFirst()
  }

  patch(id: string, user: Updateable<User>): Promise<Selectable<User> | undefined> {
    return this.db.updateTable('user')
      .set(user)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  create(user: Insertable<User>): Promise<Selectable<User> | undefined> {
    return this.db.insertInto('user').values(user).returningAll().executeTakeFirst()
  }

  findById(id: string): Promise<Selectable<User> | undefined> {
    return this.db.selectFrom('user').where('id', '=', id).selectAll().executeTakeFirst()
  }
}
