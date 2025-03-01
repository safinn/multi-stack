import { href, redirect } from 'react-router'
import { db } from '~/data/db'
import { IdentityRespository } from '~/data/repositories/identity'
import { MembershipRepository } from '~/data/repositories/membership'
import { PermissionRepository } from '~/data/repositories/permissions'
import { requireUser, requireUserInOrganization } from './auth/auth.server'

type Action = 'create' | 'read' | 'update' | 'delete'
type Entity = 'user' | 'organization'
type Access = 'own' | 'any' | 'own,any' | 'any,own'
export type PermissionString =
  | `${Action}:${Entity}`
  | `${Action}:${Entity}:${Access}`

export function parsePermissionString(permissionString: PermissionString) {
  const [action, entity, access] = permissionString.split(':') as [
    Action,
    Entity,
    Access | undefined,
  ]
  return {
    action,
    entity,
    access: access ? (access.split(',') as Array<Access>) : undefined,
  }
}

// requireSuperRole checks a user has the super role on any membership
export async function requireSuperRole(request: Request) {
  const user = await requireUser(request)
  const superMembership = await new MembershipRepository(db).findSuper(user.id)

  if (!superMembership) {
    throw redirect(href('/app/:organizationId?'))
  }

  return user
}

export async function requireUserWithOrganizationRole(request: Request, roleName: string, organizationId: string) {
  const user = await requireUser(request)

  const membership = await new MembershipRepository(db).findByUserOrganizationAndRole(user.id, organizationId, roleName)

  if (!membership) {
    throw redirect(href('/app/:organizationId?'))
  }

  return user
}

export async function requireUserWithOrganizationPermission(request: Request, organizationShortId: string, permission: PermissionString) {
  const { user, organization: organiastion } = await requireUserInOrganization(request, organizationShortId)
  const permissionData = parsePermissionString(permission)

  const membership = await new IdentityRespository(db).findMembershipByUserAndOrganizationShortId(user.id, organiastion.shortId)
  if (!membership) {
    throw redirect(href('/app/:organizationId?'))
  }

  const permissions = await new PermissionRepository(db).findByRole(membership.roles)
  if (permissions.some(p => p.action === permissionData.action && p.entity === permissionData.entity && p.access.split(',').every(v => permissionData.access?.includes(v as Access)))) {
    return
  }

  throw redirect(href('/app/:organizationId?'))
}
