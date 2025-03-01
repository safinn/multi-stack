import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { uuidv7 } from 'uuidv7'
import { withSoftDeletes, withTimestamps } from '../app/data/utils'

export async function up(db: Kysely<any>): Promise<void> {
  // users

  await db.schema
    .createTable('user')
    .addColumn('id', 'uuid', col => col.primaryKey().notNull())
    .addColumn('email', 'varchar(255)', col => col.notNull().unique())
    .addColumn('username', 'varchar(36)', col => col.notNull().unique())
    .$call(withTimestamps)
    .$call(withSoftDeletes)
    .execute()

  await db.schema
    .createTable('password')
    .addColumn('user_id', 'uuid', col => col.primaryKey().notNull().references('user.id').onDelete('cascade').onUpdate('cascade'))
    .addColumn('hash', 'text', col => col.notNull())
    .execute()

  await db.schema
    .createTable('verification')
    .addColumn('id', 'uuid', col => col.primaryKey().notNull())
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('target', 'text', col => col.notNull())
    .addColumn('secret', 'text', col => col.notNull())
    .addColumn('algorithm', 'text', col => col.notNull())
    .addColumn('digits', 'integer', col => col.notNull())
    .addColumn('period', 'integer', col => col.notNull())
    .addColumn('charset', 'text', col => col.notNull())
    .addColumn('expires_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', col => col.defaultTo(sql`current_timestamp`).notNull())
    .addUniqueConstraint('verification_unique_type_target', ['type', 'target'])
    .execute()

  await db.schema
    .createTable('session')
    .addColumn('id', 'uuid', col => col.primaryKey().notNull())
    .addColumn('user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade').onUpdate('cascade'))
    .addColumn('expiration_date', 'timestamptz', col => col.notNull())
    .$call(withTimestamps)
    .execute()

  await db.schema
    .createTable('connection')
    .addColumn('id', 'uuid', col => col.primaryKey().notNull())
    .addColumn('provider_name', 'text', col => col.notNull())
    .addColumn('provider_id', 'text', col => col.notNull().unique())
    .addColumn('user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade').onUpdate('cascade'))
    .addColumn('provider_display_name', 'text')
    .$call(withTimestamps)
    .execute()

  await db.schema
    .createTable('passkey')
    .addColumn('id', 'text', col => col.primaryKey().notNull())
    .addColumn('aaguid', 'text', col => col.notNull())
    .addColumn('public_key', 'bytea', col => col.notNull())
    .addColumn('user_id', 'uuid', col => col.notNull().references('user.id').onDelete('cascade').onUpdate('cascade'))
    .addColumn('webauthn_user_id', 'text', col => col.notNull())
    .addColumn('counter', 'bigint', col => col.notNull())
    .addColumn('device_type', 'text', col => col.notNull()) // 'singleDevice' or 'multiDevice'
    .addColumn('backed_up', 'boolean', col => col.notNull())
    .addColumn('transports', 'text') // Stored as comma-separated values
    .$call(withTimestamps)
    .execute()

  // organizations

  await db.schema
    .createTable('organization')
    .addColumn('id', 'uuid', col => col.primaryKey().notNull())
    .addColumn('short_id', 'text', col => col.notNull().unique())
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('description', 'text', col => col.notNull().defaultTo(''))
    .addColumn('personal_organization_user_id', 'uuid')
    .$call(withTimestamps)
    .execute()

  await db.schema
    .createTable('membership')
    .addColumn('id', 'uuid', col => col.primaryKey().notNull())
    .addColumn('organization_id', 'uuid', col => col.notNull().references('organization.id').onDelete('cascade').onUpdate('cascade'))
    .addColumn('user_id', 'uuid', col => col.references('user.id').onDelete('cascade').onUpdate('cascade'))
    .addColumn('invited_by_id', 'uuid', col => col.references('user.id').onDelete('set null').onUpdate('cascade'))
    .addColumn('invitation_id', 'uuid')
    .addColumn('invite_email', 'text')
    .addColumn('roles', sql`text[]`, col => col.notNull().defaultTo('{}'))
    .addUniqueConstraint('org', ['organization_id', 'user_id'])
    .$call(withTimestamps)
    .execute()

  // rbac

  await db.schema
    .createTable('role')
    .addColumn('name', 'text', col => col.primaryKey())
    .addColumn('description', 'text', col => col.notNull().defaultTo(''))
    .addColumn('order', 'integer', col => col.notNull())
    .$call(withTimestamps)
    .execute()

  await db.insertInto('role')
    .values([
      { name: 'super', description: 'Full power over the application', order: 0 },
      { name: 'admin', description: 'Admin with all abilities in the organization', order: 1 },
      { name: 'editor', description: 'Standard abilities', order: 2 },
      { name: 'viewer', description: 'Read-only abilities', order: 3 },
    ])
    .execute()

  await db.schema
    .createTable('permission')
    .addColumn('id', 'uuid', col => col.primaryKey().notNull())
    .addColumn('action', 'text', col => col.notNull())
    .addColumn('entity', 'text', col => col.notNull())
    .addColumn('access', 'text', col => col.notNull())
    .$call(withTimestamps)
    .execute()

  await db.schema
    .createTable('permission_role')
    .addColumn('permission', 'uuid', col => col.notNull().references('permission.id').onDelete('cascade').onUpdate('cascade'))
    .addColumn('role', 'text', col => col.notNull().references('role.name').onDelete('cascade').onUpdate('cascade'))
    .addUniqueConstraint('permission_role_unique', ['permission', 'role'])
    .execute()

  const createAnyUserPermissionId = uuidv7()
  const readAnyUserPermissionId = uuidv7()
  const readOwnUserPermissionId = uuidv7()
  const updateAnyUserPermissionId = uuidv7()
  const updateOwnUserPermissionId = uuidv7()
  const deleteAnyUserPermissionId = uuidv7()
  const deleteOwnUserPermissionId = uuidv7()
  const updateOwnOrganizationPermissionId = uuidv7()
  const deleteOwnOrganizationPermissionId = uuidv7()

  await db.insertInto('permission')
    .values([
      { id: createAnyUserPermissionId, action: 'create', entity: 'user', access: 'any' },
      { id: readAnyUserPermissionId, action: 'read', entity: 'user', access: 'any' },
      { id: readOwnUserPermissionId, action: 'read', entity: 'user', access: 'own' },
      { id: updateAnyUserPermissionId, action: 'update', entity: 'user', access: 'any' },
      { id: updateOwnUserPermissionId, action: 'update', entity: 'user', access: 'own' },
      { id: deleteAnyUserPermissionId, action: 'delete', entity: 'user', access: 'any' },
      { id: deleteOwnUserPermissionId, action: 'delete', entity: 'user', access: 'own' },
      { id: updateOwnOrganizationPermissionId, action: 'update', entity: 'organization', access: 'own' },
      { id: deleteOwnOrganizationPermissionId, action: 'delete', entity: 'organization', access: 'own' },
    ])
    .execute()

  await db.insertInto('permission_role')
    .values([
      { permission: createAnyUserPermissionId, role: 'admin' },
      { permission: readAnyUserPermissionId, role: 'admin' },
      { permission: readOwnUserPermissionId, role: 'editor' },
      { permission: updateAnyUserPermissionId, role: 'admin' },
      { permission: updateOwnUserPermissionId, role: 'editor' },
      { permission: deleteAnyUserPermissionId, role: 'admin' },
      { permission: deleteOwnUserPermissionId, role: 'editor' },
      { permission: updateOwnOrganizationPermissionId, role: 'admin' },
      { permission: deleteOwnOrganizationPermissionId, role: 'admin' },
    ])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // rbac

  await db.schema.dropTable('permission_role').execute()
  await db.schema.dropTable('permission').execute()
  await db.schema.dropTable('role').execute()

  // organizations

  await db.schema.dropTable('membership').execute()
  await db.schema.dropTable('organization').execute()

  // users

  await db.schema.dropTable('passkey').execute()
  await db.schema.dropTable('connection').execute()
  await db.schema.dropTable('session').execute()
  await db.schema.dropTable('verification').execute()
  await db.schema.dropTable('password').execute()
  await db.schema.dropTable('user').execute()
}
