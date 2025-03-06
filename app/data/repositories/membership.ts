import type { Insertable, Kysely, Selectable, Transaction, Updateable } from 'kysely'
import type { DB, Membership } from 'kysely-codegen'

// T = the returned entity type
// E = the entity type used for inserts
// U = the entity type used for updates
export interface IMembershipRepository<T, E, U> {
  claim: (userId: string, invitiationId: string) => Promise<T | undefined>
  create: (membership: E) => Promise<T | undefined>
  findById: (id: string) => Promise<T | undefined>
  findByInvitationId: (invitationId: string) => Promise<T | undefined>
  // findSuper finds any membership with the super role for the given user
  findSuper: (userId: string) => Promise<T | undefined>
  findByUserOrganizationAndRole: (userId: string, organizationId: string, role: string) => Promise<T | undefined>
  delete: (id: string) => Promise<T | undefined>
  patch: (id: string, membership: U) => Promise<T | undefined>
}

export class MembershipRepository implements IMembershipRepository<Selectable<Membership>, Insertable<Membership>, Updateable<Membership>> {
  private db: Kysely<DB> | Transaction<DB>
  constructor(db: Kysely<DB> | Transaction<DB>) {
    this.db = db
  }

  patch(id: string, membership: Updateable<Membership>): Promise<Selectable<Membership> | undefined> {
    return this.db.updateTable('membership')
      .set(membership)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  findByInvitationId(invitationId: string): Promise<Selectable<Membership> | undefined> {
    return this.db
      .selectFrom('membership')
      .where('invitationId', '=', invitationId)
      .selectAll()
      .executeTakeFirst()
  }

  findById(id: string): Promise<Selectable<Membership> | undefined> {
    return this.db
      .selectFrom('membership')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
  }

  delete(id: string): Promise<Selectable<Membership> | undefined> {
    return this.db
      .deleteFrom('membership')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
  }

  findByUserOrganizationAndRole(userId: string, organizationId: string, role: string): Promise<Selectable<Membership> | undefined> {
    return this.db
      .selectFrom('membership')
      .where('organizationId', '=', organizationId)
      .where('userId', '=', userId)
      .where('roles', '@>', [[role]])
      .selectAll()
      .executeTakeFirst()
  }

  findSuper(userId: string): Promise<Selectable<Membership> | undefined> {
    return this.db
      .selectFrom('membership')
      .where('membership.userId', '=', userId)
      .where('membership.roles', '@>', ['super'])
      .selectAll()
      .executeTakeFirst()
  }

  create(membership: Insertable<Membership>): Promise<Selectable<Membership> | undefined> {
    return this.db
      .insertInto('membership')
      .values(membership)
      .returningAll()
      .executeTakeFirst()
  }

  // This method is used to claim a membership by a user.
  // Unclaimed memberships have a null userId and are created by an invitation.
  claim(userId: string, invitiationId: string): Promise<Selectable<Membership> | undefined> {
    return this.db.updateTable('membership')
      .where('invitationId', '=', invitiationId)
      .where('userId', 'is', null)
      .set('userId', userId)
      .returningAll()
      .executeTakeFirst()
  }
}
