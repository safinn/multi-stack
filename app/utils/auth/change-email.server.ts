import type { VerifyFunctionArgs } from './verify.server'
import process from 'node:process'
import { invariant } from '@epic-web/invariant'
import { data } from 'react-router'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { db } from '~/data/db'
import { UserRepository } from '~/data/repositories/user'
import { emailer } from '~/email/emailer'
import { targetQueryParam } from '~/routes/auth/verify'
import { redirectWithToast } from '../toast.server'
import { verifySessionStorage } from './verification.sever'
import { requireRecentVerification } from './verify.server'

export const newEmailAddressSessionKey = 'new-email-address'

export async function handleVerification({ submission, request }: VerifyFunctionArgs) {
  await requireRecentVerification(request)
  invariant(
    submission.status === 'success',
    'Submission should be successful by now',
  )

  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )

  const newEmail = verifySession.get(newEmailAddressSessionKey)
  if (!newEmail) {
    return data(submission.reply({
      formErrors: [
        'You must submit the code on the same device that requested the email change.',
      ],
    }), {
      status: 400,
    })
  }

  const userRepository = new UserRepository(db)
  const preUpdateUser = await userRepository.findById(submission.value[targetQueryParam])
  const user = await userRepository.patch(submission.value[targetQueryParam], { email: newEmail })

  await emailer.send(
    preUpdateUser!.email,
    'email_change_notice',
    { userId: user?.id, productName: process.env.PRODUCT_NAME },
  )

  // get redirectTo from query params
  const redirectTo = new URLSearchParams(request.url).get('redirectTo') || '/app'

  return redirectWithToast(
    safeRedirect(redirectTo),
    {
      title: 'Email Changed',
      type: 'success',
      description: `Your email has been changed to ${user?.email}`,
    },
    {
      headers: {
        'set-cookie': await verifySessionStorage.destroySession(verifySession),
      },
    },
  )
}
