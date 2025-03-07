import type { Kysely, Selectable, Transaction } from 'kysely'
import type { DB, Membership, Organization, User } from '~/data/db.d'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

export interface UserPassword {
  id: string
  username: string
  email: string
  hash?: string | null
}

export type MembershipUser = Selectable<Membership & { user?: Selectable<User> }>
export type MembershipOrganization = Selectable<Membership & { organization?: Selectable<Organization> }>
export type IdOrUsername = { id: string } | { username: string }

// T = the returned UP entity type
export interface IIdentityRepository<UP, M, MU, MO> {
  findUserByIdOrUsernameWithPassword: (identifier: { id: string } | { username: string }) => Promise<UP | undefined>
  findMembershipByUserAndOrganizationShortId: (userId: string, organizationShortId?: string) => Promise<M | undefined>
  findMembershipsByOrganizationWithUsers: (organizationId: string) => Promise<MU[]>
  findMembershipsByUserWithOrganization: (userId: string) => Promise<MO[]>
}

export class IdentityRespository implements IIdentityRepository<UserPassword, Selectable<Membership>, MembershipUser, MembershipOrganization> {
  private db: Kysely<DB> | Transaction<DB>
  constructor(db: Kysely<DB> | Transaction<DB>) {
    this.db = db
  }

  findMembershipsByUserWithOrganization(userId: string): Promise<MembershipOrganization[]> {
    return this.db
      .selectFrom('membership')
      .where('userId', '=', userId)
      .selectAll()
      .select(eb => [
        jsonObjectFrom(
          eb.selectFrom('organization')
            .whereRef('organization.id', '=', 'membership.organizationId')
            .selectAll(),
        ).$castTo<Selectable<Organization>>().as('organization'),
      ])
      .orderBy('membership.createdAt', 'asc')
      .execute()
  }

  findMembershipsByOrganizationWithUsers(organizationId: string): Promise<MembershipUser[]> {
    return this.db
      .selectFrom('membership')
      .where('organizationId', '=', organizationId)
      .selectAll()
      .select(eb => [
        jsonObjectFrom(
          eb.selectFrom('user')
            .whereRef('user.id', '=', 'membership.userId')
            .selectAll(),
        ).$castTo<Selectable<User>>().as('user'),
      ])
      .orderBy('membership.createdAt', 'asc')
      .execute()
  }

  async findMembershipByUserAndOrganizationShortId(userId: string, organizationShortId?: string): Promise<Selectable<Membership> | undefined> {
    if (!organizationShortId) {
      const org = await this.db
        .selectFrom('organization')
        .where('personalOrganizationUserId', '=', userId)
        .select('shortId')
        .executeTakeFirstOrThrow()

      organizationShortId = org.shortId
    }

    return this.db.selectFrom('membership')
      .where('membership.userId', '=', userId)
      .innerJoin('organization', 'membership.organizationId', 'organization.id')
      .where('organization.shortId', '=', organizationShortId)
      .selectAll()
      .executeTakeFirst()
  }

  findUserByIdOrUsernameWithPassword(identifier: IdOrUsername): Promise<UserPassword | undefined> {
    return this.db
      .selectFrom('user')
      .where(eb => eb.and(identifier))
      .leftJoin('password', 'user.id', 'password.userId')
      .select([
        'user.id',
        'user.username',
        'user.email',
        'password.hash',
      ])
      .executeTakeFirst()
  }
}
