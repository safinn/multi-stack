import type { VerifyFunctionArgs } from './verify.server'
import type { VerificationTypes } from '~/routes/auth/verify'
import { invariant } from '@epic-web/invariant'
import { redirect } from 'react-router'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { db } from '~/data/db'
import { SessionRepository } from '~/data/repositories/session'
import { VerificationRepository } from '~/data/repositories/verification'
import { combineResponseInits } from '../misc'
import { redirectWithToast } from '../toast.server'
import { getUser, sessionKey } from './auth.server'
import { authSessionStorage } from './session.server'
import { verifySessionStorage } from './verification.sever'
import { getRedirectToUrl, twoFAVerifyVerificationType } from './verify.server'

export const unverifiedSessionIdKey = 'unverified-session-id'
export const verifiedTimeKey = 'verified-time'
export const rememberKey = 'remember'

export async function shouldRequestTwoFA(request: Request) {
  const authSession = await authSessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )
  if (verifySession.has(unverifiedSessionIdKey))
    return true
  const user = await getUser(request)
  if (!user)
    return false

  // if it's over two hours since they last verified, we should request 2FA again
  const userHasTwoFA = await new VerificationRepository(db).fetchLatest(twoFAVerifyVerificationType, user.id)

  if (!userHasTwoFA)
    return false
  const verifiedTime = authSession.get(verifiedTimeKey) ?? new Date(0)
  const twoHours = 1000 * 60 * 60 * 2
  return Date.now() - verifiedTime > twoHours
}

export async function handleVerification({ request, submission }: VerifyFunctionArgs) {
  invariant(
    submission.status === 'success',
    'Submission should be successful by now',
  )

  const authSession = await authSessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )

  const remember = verifySession.get(rememberKey)
  const { redirectTo } = submission.value
  const headers = new Headers()
  authSession.set(verifiedTimeKey, Date.now())

  const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey)

  if (unverifiedSessionId) {
    const session = await new SessionRepository(db).findById(unverifiedSessionId)
    if (!session) {
      throw await redirectWithToast('/login', {
        type: 'error',
        title: 'Invalid session',
        description: 'Could not find session to verify. Please try again.',
      })
    }

    authSession.set(sessionKey, unverifiedSessionId)
    headers.append(
      'set-cookie',
      await authSessionStorage.commitSession(authSession, {
        expires: remember ? session.expirationDate : undefined,
      }),
    )
  }
  else {
    headers.append(
      'set-cookie',
      await authSessionStorage.commitSession(authSession),
    )
  }

  headers.append(
    'set-cookie',
    await verifySessionStorage.destroySession(verifySession),
  )

  headers.append('location', safeRedirect(redirectTo))

  return redirect(safeRedirect(redirectTo), {
    headers,
  })
}

export const twoFAVerificationType = '2fa' satisfies VerificationTypes

export async function handleNewSession(
  {
    request,
    session,
    redirectTo,
    remember,
  }: {
    request: Request
    session: { userId: string, id: string, expirationDate: Date }
    redirectTo?: string
    remember: boolean
  },
  responseInit?: ResponseInit,
) {
  const verification = await new VerificationRepository(db).fetchLatest(twoFAVerificationType, session.userId)
  const userHasTwoFactor = Boolean(verification)

  if (userHasTwoFactor) {
    const verifySession = await verifySessionStorage.getSession()
    verifySession.set(unverifiedSessionIdKey, session.id)
    verifySession.set(rememberKey, remember)
    const redirectUrl = getRedirectToUrl({
      request,
      type: twoFAVerificationType,
      target: session.userId,
      redirectTo,
    })
    return redirect(
      `${redirectUrl.pathname}?${redirectUrl.searchParams}`,
      combineResponseInits(
        {
          headers: {
            'set-cookie': await verifySessionStorage.commitSession(verifySession),
          },
        },
        responseInit,
      ),
    )
  }
  else {
    const authSession = await authSessionStorage.getSession(
      request.headers.get('cookie'),
    )
    authSession.set(sessionKey, session.id)

    return redirect(
      safeRedirect(redirectTo),
      combineResponseInits(
        {
          headers: {
            'set-cookie': await authSessionStorage.commitSession(authSession, {
              expires: remember ? session.expirationDate : undefined,
            }),
          },
        },
        responseInit,
      ),
    )
  }
}
