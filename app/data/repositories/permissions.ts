import type { Kysely, Selectable } from 'kysely'
import type { DB, Permission } from 'kysely-codegen'

// T = the returned entity type
export interface IPermissionRepository<T> {
  findByRole: (roles: string[]) => Promise<T[]>
}

export class PermissionRepository implements IPermissionRepository<Selectable<Permission>> {
  private db: Kysely<DB>
  constructor(db: Kysely<DB>) {
    this.db = db
  }

  findByRole(roles: string[]): Promise<Selectable<Permission>[]> {
    return this.db
      .selectFrom('permission')
      .leftJoin('permissionRole', 'permissionRole.permission', 'permission.id')
      .where('permissionRole.role', 'in', roles)
      .distinct()
      .selectAll()
      .execute()
  }
}
