import type { Insertable, Kysely, Selectable, Transaction, Updateable } from 'kysely'
import type { DB, Verification } from 'kysely-codegen'
import type { VerificationTypes } from '~/routes/auth/verify'
import type { twoFAVerifyVerificationType } from '~/utils/auth/verify.server'

// T = the returned entity type
// E = the entity type used for inserts
export interface IVerificationRepository<T, E> {
  create: (verification: E) => Promise<T | undefined>
  fetchLatest: (type: VerificationTypes | typeof twoFAVerifyVerificationType, target: string) => Promise<T | undefined>
  delete: (type: VerificationTypes | typeof twoFAVerifyVerificationType, target: string) => Promise<T | undefined>
  upsert: (verification: E) => Promise<T | undefined>
  patchByTypeAndTarget: (type: string, target: string, verification: Updateable<Verification>) => Promise<T | undefined>
}

export class VerificationRepository implements IVerificationRepository<Selectable<Verification>, Insertable<Verification>> {
  private db: Kysely<DB> | Transaction<DB>
  constructor(db: Kysely<DB> | Transaction<DB>) {
    this.db = db
  }

  patchByTypeAndTarget(type: string, target: string, verification: Updateable<Verification>): Promise<Selectable<Verification> | undefined> {
    return this.db.updateTable('verification')
      .set(verification)
      .where('target', '=', target)
      .where('type', '=', type)
      .returningAll()
      .executeTakeFirst()
  }

  upsert(verification: Insertable<Verification>): Promise<Selectable<Verification> | undefined> {
    return this.db.insertInto('verification')
      .values(verification)
      .onConflict(oc => oc.columns(['target', 'type']).doUpdateSet(verification))
      .returningAll()
      .executeTakeFirst()
  }

  delete(type: VerificationTypes | typeof twoFAVerifyVerificationType, target: string): Promise<Selectable<Verification> | undefined> {
    return this.db.deleteFrom('verification')
      .where('target', '=', target)
      .where('type', '=', type)
      .returningAll()
      .executeTakeFirst()
  }

  fetchLatest(type: VerificationTypes | typeof twoFAVerifyVerificationType, target: string): Promise<Selectable<Verification> | undefined> {
    return this.db.selectFrom('verification')
      .selectAll()
      .where('type', '=', type)
      .where('target', '=', target)
      .orderBy('createdAt', 'desc')
      .executeTakeFirst()
  }

  create(verification: Insertable<Verification>): Promise<Selectable<Verification> | undefined> {
    return this.db.insertInto('verification')
      .values(verification)
      .onConflict(oc => oc.columns(['type', 'target']).doUpdateSet({
        secret: verification.secret,
        period: verification.period,
        digits: verification.digits,
        algorithm: verification.algorithm,
        charset: verification.charset,
        expiresAt: verification.expiresAt,
        createdAt: verification.createdAt,
      }))
      .returningAll()
      .executeTakeFirst()
  }
}
