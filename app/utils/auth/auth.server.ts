import type { Connection, Password, User } from 'kysely-codegen'
import type { ProviderUser } from '../providers/provider'
import argon2 from '@node-rs/argon2'
import { data, href, redirect } from 'react-router'
import { Authenticator } from 'remix-auth'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { uuidv7 } from 'uuidv7'
import { db } from '~/data/db'
import { ConnectionRepository } from '~/data/repositories/connection'
import { IdentityRespository, type IdOrUsername } from '~/data/repositories/identity'
import { MembershipRepository } from '~/data/repositories/membership'
import { OrganizationRepository } from '~/data/repositories/organization'
import { PasswordRepository } from '~/data/repositories/password'
import { SessionRepository } from '~/data/repositories/session'
import { UserRepository } from '~/data/repositories/user'
import { providers } from '../connections.server'
import { combineHeaders, shortId } from '../misc'
import { authSessionStorage } from './session.server'

export const authenticator = new Authenticator<ProviderUser>()

for (const [providerName, provider] of Object.entries(providers)) {
  authenticator.use(provider.getAuthStrategy(), providerName)
}

// Require that there is no logged in user.
// If there is a logged in user, redirect to the app.
export async function requireAnonymous(request: Request) {
  const user = await getUser(request)
  if (user) {
    throw redirect(href('/app/:organizationId?'))
  }
}

export const sessionKey = 'sessionId'

// Attempt to get the user from the session in the request.
// If the user is not logged in, return null.
// If the user is logged in, return the user.
// If the session is invalid, destroy the session and return null.
export async function getUser(request: Request) {
  const authSession = await authSessionStorage.getSession(
    request.headers.get('cookie'),
  )
  // If the session is not found, return null
  const sessionId = authSession.get(sessionKey)
  if (!sessionId)
    return null

  const session = await new SessionRepository(db).findById(sessionId)

  // If the session is valid, attempt to return the user
  if (session && session.expirationDate.getTime() >= Date.now()) {
    const user = await new UserRepository(db).findById(session.userId)
    if (user) {
      return user
    }
  }

  // If the session is invalid, destroy it
  throw redirect(href('/'), {
    headers: {
      'set-cookie': await authSessionStorage.destroySession(authSession),
    },
  })
}

// Attempt to get the user and organization from the session in the request.
// If the user is not logged in, return null.
// If the user is logged in, return the user.
// If the session is invalid, destroy the session and return null.
export async function getUserOrganizationMembership(request: Request, organizationShortId?: string) {
  const authSession = await authSessionStorage.getSession(
    request.headers.get('cookie'),
  )
  // If the session is not found, return null
  const sessionId = authSession.get(sessionKey)
  if (!sessionId)
    return null

  const session = await new SessionRepository(db).findById(sessionId)

  // If the session is valid, attempt to return the user
  if (session && session.expirationDate.getTime() >= Date.now()) {
    const [user, membership] = await Promise.all([
      new UserRepository(db).findById(session.userId),
      new IdentityRespository(db).findMembershipByUserAndOrganizationShortId(session.userId, organizationShortId),
    ])

    if (membership) {
      const organization = await new OrganizationRepository(db).findById(membership.organizationId)
      return { user, organization }
    }

    return { user }
  }

  // If the session is invalid, destroy it
  throw redirect(href('/'), {
    headers: {
      'set-cookie': await authSessionStorage.destroySession(authSession),
    },
  })
}

export async function getUserMemberships(userId?: string) {
  if (!userId)
    return undefined

  const identityRepo = new IdentityRespository(db)
  return await identityRepo.findMembershipsByUserWithOrganization(userId)
}

export async function requireUser(
  request: Request,
  { redirectTo }: { redirectTo?: string | null } = {},
) {
  const user = await getUser(request)
  if (!user) {
    const requestUrl = new URL(request.url)
    redirectTo
      = redirectTo === null
        ? null
        : redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`
    const loginParams = redirectTo ? new URLSearchParams({ redirectTo }) : null
    const loginRedirect = ['/login', loginParams?.toString()]
      .filter(Boolean)
      .join('?')
    throw redirect(loginRedirect)
  }
  return user
}

export async function requireUserInOrganization(
  request: Request,
  organizationId?: string,
  { redirectTo }: { redirectTo?: string | null } = {},
) {
  const membership = await getUserOrganizationMembership(request, organizationId)
  if (!membership?.user) {
    const requestUrl = new URL(request.url)
    redirectTo
      = redirectTo === null
        ? null
        : redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`
    const loginParams = redirectTo ? new URLSearchParams({ redirectTo }) : null
    const loginRedirect = ['/login', loginParams?.toString()]
      .filter(Boolean)
      .join('?')
    throw redirect(loginRedirect)
  }

  // Don't have access to the organization or doesn't exist so send 404
  if (!membership.organization) {
    throw data(null, { status: 404 })
  }

  return { user: membership.user, organization: membership.organization }
}

export const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30
export function getSessionExpirationDate() {
  return new Date(Date.now() + SESSION_EXPIRATION_TIME)
}

export async function getPasswordHash(password: string) {
  const hash = await argon2.hash(password, {
    memoryCost: 19923,
    timeCost: 2,
    parallelism: 1,
    algorithm: 2,
  })
  return hash
}

export async function signup({
  email,
  password,
  username,
  invitationId,
}: {
  email: User['email']
  username: User['username']
  password: string
  invitationId?: string
}) {
  const hashedPassword = await getPasswordHash(password)

  const session = await db.transaction().execute(async (tx) => {
    const user = await new UserRepository(tx).create({
      id: uuidv7(),
      email: email.toLocaleLowerCase(),
      username,
    })
    if (!user) {
      throw new Error('Failed to create user')
    }

    const organization = await new OrganizationRepository(tx).create({
      id: uuidv7(),
      shortId: shortId(6),
      name: username,
      description: 'Personal team',
      personalOrganizationUserId: user.id,
    })
    if (!organization) {
      throw new Error('Failed to create organization')
    }

    const membershipRepository = new MembershipRepository(tx)

    const membership = await membershipRepository.create({
      id: uuidv7(),
      organizationId: organization.id,
      userId: user.id,
      roles: ['admin'],
    })
    if (!membership) {
      throw new Error('Failed to create membership')
    }

    if (invitationId) {
      await membershipRepository.claim(user.id, invitationId)
    }

    const password = await new PasswordRepository(tx).create({
      userId: user.id,
      hash: hashedPassword,
    })
    if (!password) {
      throw new Error('Failed to create password')
    }

    const session = await new SessionRepository(tx).create({
      id: uuidv7(),
      userId: user.id,
      expirationDate: getSessionExpirationDate(),
    })
    if (!session) {
      throw new Error('Failed to create session')
    }

    return session
  })

  return session
}

export async function logout(
  {
    request,
    redirectTo = '/',
  }: {
    request: Request
    redirectTo?: string
  },
  responseInit?: ResponseInit,
) {
  const authSession = await authSessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const sessionId = authSession.get(sessionKey)
  // if this fails, we still need to delete the session from the user's browser
  // and it doesn't do any harm staying in the db anyway.
  if (sessionId) {
    await new SessionRepository(db).delete(sessionId)
  }
  throw redirect(safeRedirect(redirectTo), {
    ...responseInit,
    headers: combineHeaders(
      { 'set-cookie': await authSessionStorage.destroySession(authSession) },
      responseInit?.headers,
    ),
  })
}

export async function login({
  username,
  password,
}: {
  username: User['username']
  password: string
}, invitationId?: string) {
  const user = await verifyUserPassword({ username }, password)
  if (!user)
    return null

  const session = await new SessionRepository(db).create({
    id: uuidv7(),
    expirationDate: getSessionExpirationDate(),
    userId: user.id,
  })

  // Attempt to claim the invitation if there is one
  if (invitationId) {
    await new MembershipRepository(db).claim(user.id, invitationId)
  }

  return session
}

export async function verifyUserPassword(
  where: IdOrUsername,
  password: Password['hash'],
) {
  const userWithPassword = await new IdentityRespository(db)
    .findUserByIdOrUsernameWithPassword(where)

  if (!userWithPassword || !userWithPassword.hash) {
    return null
  }

  const isValid = await argon2.verify(userWithPassword.hash, password)
  if (!isValid) {
    return null
  }

  return { id: userWithPassword.id }
}

export async function resetUserPassword({
  username,
  password,
}: {
  username: User['username']
  password: string
}) {
  const hashedPassword = await getPasswordHash(password)

  const user = await new UserRepository(db).findByUsername(username)
  if (!user)
    return null

  return new PasswordRepository(db).patchByUserId(user.id, { hash: hashedPassword })
}

export async function signupWithConnection({
  email,
  username,
  providerId,
  providerName,
  invitationId,
}: {
  email: User['email']
  username: User['username']
  providerId: Connection['providerId']
  providerName: Connection['providerName']
  invitationId?: string
}) {
  return db.transaction().execute(async (tx) => {
    const user = await new UserRepository(tx).create({
      id: uuidv7(),
      email: email.toLocaleLowerCase(),
      username,
    })
    if (!user) {
      throw new Error('Failed to create user')
    }

    const organization = await new OrganizationRepository(tx).create({
      id: uuidv7(),
      shortId: shortId(6),
      name: username,
      description: 'Personal team',
      personalOrganizationUserId: user.id,
    })
    if (!organization) {
      throw new Error('Failed to create organization')
    }

    const membershipRepository = new MembershipRepository(tx)

    const membership = await membershipRepository.create({
      id: uuidv7(),
      organizationId: organization.id,
      userId: user.id,
      roles: ['admin'],
    })
    if (!membership) {
      throw new Error('Failed to create membership')
    }

    if (invitationId) {
      await membershipRepository.claim(user.id, invitationId)
    }

    const session = await new SessionRepository(tx).create({
      id: uuidv7(),
      userId: user.id,
      expirationDate: getSessionExpirationDate(),
    })
    if (!session) {
      throw new Error('Failed to create session')
    }

    const connection = await new ConnectionRepository(tx).create({
      id: uuidv7(),
      providerId,
      providerName,
      userId: user.id,
      providerDisplayName: email,
    })
    if (!connection) {
      throw new Error('Failed to create connection')
    }

    return session
  })
}
