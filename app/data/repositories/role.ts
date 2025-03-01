import type { Kysely, Selectable } from 'kysely'
import type { DB, Role } from 'kysely-codegen'

// T = the returned entity type
export interface IRoleRepository<T> {
  findAll: (roles: string[]) => Promise<T[]>
}

export class RoleRepository implements IRoleRepository<Selectable<Role>> {
  private db: Kysely<DB>
  constructor(db: Kysely<DB>) {
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
