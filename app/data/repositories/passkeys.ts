import type { Insertable, Kysely, Selectable, Transaction } from 'kysely'
import type { DB, Passkey } from '~/data/db.d'

// T = the returned entity type
// E = the entity type used for inserts
export interface IPasskeyRepository<T, E> {
  findByUserId: (userId: string) => Promise<T[] | undefined>
  findById: (id: string) => Promise<T | undefined>
  create: (passkey: E) => Promise<T | undefined>
  delete: (id: string, userId: string) => Promise<void>
  patch: (id: string, passkey: Partial<E>) => Promise<T | undefined>
}

export class PasskeyRepository implements IPasskeyRepository<Selectable<Passkey>, Insertable<Passkey>> {
  private db: Kysely<DB> | Transaction<DB>
  constructor(db: Kysely<DB> | Transaction<DB>) {
    this.db = db
  }

  patch(id: string, passkey: Partial<Insertable<Passkey>>): Promise<Selectable<Passkey> | undefined> {
    return this.db
      .updateTable('passkey')
      .where('id', '=', id)
      .set(passkey)
      .returningAll()
      .executeTakeFirst()
  }

  async delete(id: string, userId: any): Promise<void> {
    await this.db
      .deleteFrom('passkey')
      .where('id', '=', id)
      .where('userId', '=', userId)
      .execute()
  }

  create(passkey: Insertable<Passkey>): Promise<Selectable<Passkey> | undefined> {
    return this.db
      .insertInto('passkey')
      .values(passkey)
      .returningAll()
      .executeTakeFirst()
  }

  findById(id: string): Promise<Selectable<Passkey> | undefined> {
    return this.db
      .selectFrom('passkey')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
  }

  findByUserId(userId: string): Promise<Selectable<Passkey>[] | undefined> {
    return this.db
      .selectFrom('passkey')
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .selectAll()
      .execute()
  }
}
