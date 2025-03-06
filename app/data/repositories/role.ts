import type { Kysely, Selectable, Transaction } from 'kysely'
import type { DB, Role } from 'kysely-codegen'

// T = the returned entity type
export interface IRoleRepository<T> {
  findAll: (roles: string[]) => Promise<T[]>
}

export class RoleRepository implements IRoleRepository<Selectable<Role>> {
  private db: Kysely<DB> | Transaction<DB>
  constructor(db: Kysely<DB> | Transaction<DB>) {
    this.db = db
  }

  // findAll excludes the super role
  async findAll(): Promise<Selectable<Role>[]> {
    const roles = await this.db
      .selectFrom('role')
      .selectAll()
      .distinct()
      .orderBy('order', 'asc')
      .execute()

    return roles.filter(role => role.name !== 'super')
  }
}
