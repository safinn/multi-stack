import type { Insertable, Kysely, Selectable, Transaction, Updateable } from 'kysely'
import type { DB, Organization } from 'kysely-codegen'

// T = the returned entity type
// E = the entity type used for inserts
// U = the entity type used for updates
export interface IOrganizationRepository<T, E, U> {
  create: (organization: E) => Promise<T | undefined>
  findById: (id: string) => Promise<T | undefined>
  patch: (id: string, organization: U) => Promise<T | undefined>
  delete: (id: string) => Promise<T | undefined>
}

export class OrganizationRepository implements IOrganizationRepository<Selectable<Organization>, Insertable<Organization>, Updateable<Organization>> {
  private db: Kysely<DB> | Transaction<DB>
  constructor(db: Kysely<DB> | Transaction<DB>) {
    this.db = db
  }

  delete(id: string): Promise<Selectable<Organization> | undefined> {
    return this.db
      .deleteFrom('organization')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  patch(id: string, organization: Updateable<Organization>): Promise<Selectable<Organization> | undefined> {
    return this.db.updateTable('organization')
      .set(organization)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  findById(id: string): Promise<Selectable<Organization> | undefined> {
    return this.db
      .selectFrom('organization')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
  }

  create(organization: Insertable<Organization>): Promise<Selectable<Organization> | undefined> {
    return this.db
      .insertInto('organization')
      .values(organization)
      .returningAll()
      .executeTakeFirst()
  }
}
