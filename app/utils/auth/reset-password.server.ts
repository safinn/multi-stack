import type { VerifyFunctionArgs } from './verify.server'
import { invariant } from '@epic-web/invariant'
import { data, href, redirect } from 'react-router'
import { db } from '~/data/db'
import { UserRepository } from '~/data/repositories/user'
import { resetPasswordUsernameSessionKey } from '~/routes/auth/reset-password'
import { targetQueryParam } from '~/routes/auth/verify'
import { verifySessionStorage } from './verification.sever'

export async function handleVerification({ submission }: VerifyFunctionArgs) {
  invariant(
    submission.status === 'success',
    'Submission should be successful by now',
  )
  const target = submission.value[targetQueryParam]
  const user = await new UserRepository(db).findByUsernameOrEmail(target)

  // Pretend code is invalid if the user doesn't exist
  if (!user) {
    return data(submission.reply({ fieldErrors: { code: ['Invalid code'] } }), {
      status: 400,
    })
  }

  const verifySession = await verifySessionStorage.getSession()
  verifySession.set(resetPasswordUsernameSessionKey, user.username)

  return redirect(href('/reset-password'), {
    headers: {
      'Set-Cookie': await verifySessionStorage.commitSession(verifySession),
    },
  })
}
