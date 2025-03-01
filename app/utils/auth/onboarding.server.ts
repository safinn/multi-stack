import type { VerifyFunctionArgs } from './verify.server'
import { invariant } from '@epic-web/invariant'
import { redirect } from 'react-router'
import { targetQueryParam } from '~/routes/auth/verify'
import { verifySessionStorage } from './verification.sever'

export const onboardingEmailSessionKey = 'onboardingEmail'

export async function handleVerification({ request, submission }: VerifyFunctionArgs) {
  invariant(
    submission.status === 'success',
    'Submission should be successful by now',
  )
  const verifySession = await verifySessionStorage.getSession()
  verifySession.set(onboardingEmailSessionKey, submission.value[targetQueryParam])

  const url = new URL(request.url)
  const redirectUrl = `/onboarding${url.search}`

  return redirect(redirectUrl, {
    headers: {
      'Set-Cookie': await verifySessionStorage.commitSession(verifySession),
    },
  })
}
