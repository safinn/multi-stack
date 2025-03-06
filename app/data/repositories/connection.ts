import type { Insertable, Kysely, Selectable, Transaction } from 'kysely'
import type { Connection, DB } from 'kysely-codegen'

// T = the returned entity type
// E = the entity type used for inserts
// U = the entity type used for updates
export interface IConnectionRepository<T, E> {
  findByUserId: (userId: string) => Promise<T[]>
  findByProviderNameAndId: (providerName: string, providerId: string) => Promise<T | undefined>
  create: (connection: E) => Promise<T | undefined>
  countByUserId: (userId: string) => Promise<number | undefined>
  delete: (id: string, userId: string) => Promise<T | undefined>
}

export class ConnectionRepository implements IConnectionRepository<Selectable<Connection>, Insertable<Connection>> {
  private db: Kysely<DB> | Transaction<DB>
  constructor(db: Kysely<DB> | Transaction<DB>) {
    this.db = db
  }

  delete(id: string, userId: string): Promise<Selectable<Connection> | undefined> {
    return this.db
      .deleteFrom('connection')
      .where('id', '=', id)
      .where('userId', '=', userId)
      .returningAll()
      .executeTakeFirst()
  }

  async countByUserId(userId: string): Promise<number | undefined> {
    const a = await this.db
      .selectFrom('connection')
      .where('userId', '=', userId)
      .select(({ fn }) => fn.count<number>('id').as('count'))
      .executeTakeFirst()

    return a?.count
  }

  findByUserId(userId: string): Promise<Selectable<Connection>[]> {
    return this.db
      .selectFrom('connection')
      .where('userId', '=', userId)
      .selectAll()
      .execute()
  }

  create(connection: Insertable<Connection>): Promise<Selectable<Connection> | undefined> {
    return this.db
      .insertInto('connection')
      .values(connection)
      .returningAll()
      .executeTakeFirst()
  }

  findByProviderNameAndId(providerName: string, providerId: string): Promise<Selectable<Connection> | undefined> {
    return this.db
      .selectFrom('connection')
      .where('providerName', '=', providerName)
      .where('providerId', '=', providerId)
      .selectAll()
      .executeTakeFirst()
  }
}
