import type { Route } from './+types/provider-callback'
import { redirect } from 'react-router'
import { uuidv7 } from 'uuidv7'
import { repositoryFactory } from '~/data/factory'
import { authenticator, getSessionExpirationDate, getUser } from '~/utils/auth/auth.server'
import { handleNewSession } from '~/utils/auth/login.server'
import { onboardingEmailSessionKey } from '~/utils/auth/onboarding.server'
import { verifySessionStorage } from '~/utils/auth/verification.sever'
import { providerLabels, ProviderNameSchema } from '~/utils/connections'
import { destroyInvitationIdHeader, getInvitationCookieValue } from '~/utils/invitation-cookie.server'
import { log } from '~/utils/logger.server'
import { combineHeaders } from '~/utils/misc'
import { normalizeEmail, normalizeUsername } from '~/utils/providers/provider'
import { destroyRedirectToHeader, getRedirectCookieValue } from '~/utils/redirect-cookie.server'
import { createToastHeaders, redirectWithToast } from '~/utils/toast.server'
import { prefilledProfileKey, providerIdKey } from './onboarding-provider'

const destroyRedirectTo = { 'set-cookie': destroyRedirectToHeader }
const destroyInvitationId = { 'set-cookie': destroyInvitationIdHeader }

export async function loader({ request, params }: Route.LoaderArgs) {
  const providerName = ProviderNameSchema.parse(params.provider)
  const redirectTo = getRedirectCookieValue(request)
  const invitationId = getInvitationCookieValue(request)
  const label = providerLabels[providerName]

  const authResult = await authenticator
    .authenticate(providerName, request)
    .then(
      data =>
        ({
          success: true,
          data,
        }) as const,
      error =>
        ({
          success: false,
          error,
        }) as const,
    )

  if (!authResult.success) {
    log.error(authResult.error)
    throw await redirectWithToast(
      '/login',
      {
        title: 'Auth Failed',
        description: `There was an error authenticating with ${label}.`,
        type: 'error',
      },
      { headers: combineHeaders(destroyRedirectTo, destroyInvitationId) },
    )
  }

  const { data: profile } = authResult

  const existingConnection = await repositoryFactory.getConnectionRepository().findByProviderNameAndId(providerName, profile.id.toString())

  const user = await getUser(request)

  const redirectToConnections = redirectTo || '/app/settings/connections'

  if (existingConnection && user) {
    if (existingConnection.userId === user.id) {
      if (invitationId) {
        await repositoryFactory.getMembershipRepository().claim(user.id, invitationId)
      }

      return redirectWithToast(
        redirectToConnections,
        {
          title: 'Already Connected',
          description: `Your "${profile.username}" ${label} account is already connected.`,
        },
        { headers: combineHeaders(destroyRedirectTo, destroyInvitationId) },
      )
    }
    else {
      return redirectWithToast(
        redirectToConnections,
        {
          title: 'Already Connected',
          description: `The "${profile.username}" ${label} account is already connected to another account.`,
        },
        { headers: combineHeaders(destroyRedirectTo, destroyInvitationId) },
      )
    }
  }

  // If we're already logged in, then link the account
  if (user) {
    await repositoryFactory.getConnectionRepository().create({
      id: uuidv7(),
      providerName,
      providerId: profile.id.toString(),
      userId: user.id,
      providerDisplayName: profile.email,
    })

    if (invitationId) {
      await repositoryFactory.getMembershipRepository().claim(user.id, invitationId)
    }

    return redirectWithToast(
      redirectToConnections,
      {
        title: 'Connected',
        type: 'success',
        description: `Your "${profile.username}" ${label} account has been connected.`,
      },
      { headers: combineHeaders(destroyRedirectTo, destroyInvitationId) },
    )
  }

  // Connection exists already? Make a new session
  if (existingConnection) {
    if (invitationId) {
      await repositoryFactory.getMembershipRepository().claim(existingConnection.userId, invitationId)
    }
    return makeSession({ request, userId: existingConnection.userId, invitationId })
  }

  // if the email matches a user in the db, then link the account and
  // make a new session
  const existingUser = await repositoryFactory.getUserRepository().findByEmail(profile.email.toLowerCase())
  if (existingUser) {
    await repositoryFactory.getConnectionRepository().create({
      id: uuidv7(),
      providerName,
      providerId: profile.id.toString(),
      userId: existingUser.id,
      providerDisplayName: profile.email,
    })

    if (invitationId) {
      await repositoryFactory.getMembershipRepository().claim(existingUser.id, invitationId)
    }

    return makeSession(
      { request, userId: existingUser.id, invitationId },
      {
        headers: await createToastHeaders({
          title: 'Connected',
          description: `Your "${profile.username}" ${label} account has been connected.`,
        }),
      },
    )
  }

  // this is a new user, so let's get them onboarded
  const verifySession = await verifySessionStorage.getSession()
  verifySession.set(onboardingEmailSessionKey, profile.email)
  verifySession.set(prefilledProfileKey, {
    ...profile,
    email: normalizeEmail(profile.email),
    username: typeof profile.username === 'string'
      ? normalizeUsername(profile.username)
      : undefined,
  })
  verifySession.set(providerIdKey, profile.id)

  const searchParams = new URLSearchParams()
  if (redirectTo) {
    searchParams.set('redirectTo', redirectTo)
  }
  if (invitationId) {
    searchParams.set('invitationId', invitationId)
  }
  const onboardingRedirect = [
    `/onboarding/${providerName}`,
    searchParams.size ? searchParams : null,
  ]
    .filter(Boolean)
    .join('?')
  return redirect(onboardingRedirect, {
    headers: combineHeaders(
      { 'set-cookie': await verifySessionStorage.commitSession(verifySession) },
      destroyRedirectTo,
      destroyInvitationId,
    ),
  })
}

async function makeSession(
  {
    request,
    userId,
    redirectTo,
    invitationId,
  }: { request: Request, userId: string, redirectTo?: string | null, invitationId?: string | null },
  responseInit?: ResponseInit,
) {
  redirectTo ??= '/'
  if (invitationId) {
    const membership = await repositoryFactory.getMembershipRepository().findByInvitationId(invitationId)
    if (membership) {
      const organization = await repositoryFactory.getOrganizationRepository().findById(membership.organizationId)
      redirectTo = `/app/${organization?.shortId}`
    }
  }

  const session = await repositoryFactory.getSessionRepository().create({
    id: uuidv7(),
    userId,
    expirationDate: getSessionExpirationDate(),
  })

  if (!session) {
    throw new Error('Failed to create session')
  }

  return handleNewSession(
    { request, session, redirectTo, remember: true },
    { headers: combineHeaders(responseInit?.headers, destroyRedirectTo, destroyInvitationId) },
  )
}
