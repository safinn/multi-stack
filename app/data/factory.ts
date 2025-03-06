import type { Kysely, Transaction } from 'kysely'
import type { DB } from 'kysely-codegen'
import { db } from './db'
import { ConnectionRepository } from './repositories/connection'
import { IdentityRespository } from './repositories/identity'
import { MembershipRepository } from './repositories/membership'
import { OrganizationRepository } from './repositories/organization'
import { PasskeyRepository } from './repositories/passkeys'
import { PasswordRepository } from './repositories/password'
import { PermissionRepository } from './repositories/permissions'
import { RoleRepository } from './repositories/role'
import { SessionRepository } from './repositories/session'
import { UserRepository } from './repositories/user'
import { VerificationRepository } from './repositories/verification'

export class RepositoryFactory {
  constructor(private db: Kysely<DB> | Transaction<DB>) {}

  async transaction<T>(callback: (factory: RepositoryFactory) => Promise<T>): Promise<T> {
    if (this.db.isTransaction) {
      // Already in a transaction, reuse it
      return callback(this)
    }

    return this.db.transaction().execute(async (trx) => {
      const factory = new RepositoryFactory(trx)
      return callback(factory)
    })
  }

  getConnectionRepository() {
    return new ConnectionRepository(this.db)
  }

  getIdentityRepository() {
    return new IdentityRespository(this.db)
  }

  getMembershipRepository() {
    return new MembershipRepository(this.db)
  }

  getOrganizationRepository() {
    return new OrganizationRepository(this.db)
  }

  getPasskeyRepository() {
    return new PasskeyRepository(this.db)
  }

  getPasswordRepository() {
    return new PasswordRepository(this.db)
  }

  getPermissionRepository() {
    return new PermissionRepository(this.db)
  }

  getRoleRepository() {
    return new RoleRepository(this.db)
  }

  getSessionRepository() {
    return new SessionRepository(this.db)
  }

  getUserRepository() {
    return new UserRepository(this.db)
  }

  getVerificationRepository() {
    return new VerificationRepository(this.db)
  }
}

export const repositoryFactory = new RepositoryFactory(db)
