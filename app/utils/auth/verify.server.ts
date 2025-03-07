import type { Submission } from '@conform-to/react'
import type { Insertable } from 'kysely'
import type { z } from 'zod'
import type { Verification } from '~/data/db.d'
import type { VerificationTypes } from '~/routes/auth/verify'
import { parseWithZod } from '@conform-to/zod'
import { generateTOTP, verifyTOTP } from '@epic-web/totp'
import { data } from 'react-router'
import { uuidv7 } from 'uuidv7'
import { db } from '~/data/db'
import { repositoryFactory } from '~/data/factory'
import { VerificationRepository } from '~/data/repositories/verification'
import { codeQueryParam, redirectToQueryParam, targetQueryParam, typeQueryParam, VerifySchema } from '~/routes/auth/verify'
import { getDomainUrl } from '../misc'
import { redirectWithToast } from '../toast.server'
import { requireUser } from './auth.server'
import { handleVerification as handleChangeEmailVerification } from './change-email.server'
import { handleVerification as handleLoginTwoFactorVerification, shouldRequestTwoFA } from './login.server'
import { handleVerification as handleOnboardingVerification } from './onboarding.server'
import { handleVerification as handleResetPasswordVerification } from './reset-password.server'

export const invitationQueryParam = 'invitationId'
export const twoFAVerifyVerificationType = '2fa-verify'

export interface VerifyFunctionArgs {
  request: Request
  submission: Submission<
    z.input<typeof VerifySchema>,
    string[],
    z.output<typeof VerifySchema>
  >
  body: FormData | URLSearchParams
}

export function getRedirectToUrl({
  request,
  type,
  target,
  redirectTo,
}: {
  request: Request
  type: VerificationTypes | typeof twoFAVerifyVerificationType
  target: string
  redirectTo?: string
}) {
  const redirectToUrl = new URL(`${getDomainUrl(request)}/verify`)
  redirectToUrl.searchParams.set(typeQueryParam, type)
  redirectToUrl.searchParams.set(targetQueryParam, target)
  if (redirectTo) {
    redirectToUrl.searchParams.set(redirectToQueryParam, redirectTo)
  }

  // pass invitationId to the redirect url
  const url = new URL(request.url)
  const invitationId = url.searchParams.get(invitationQueryParam)
  if (invitationId) {
    redirectToUrl.searchParams.set(invitationQueryParam, invitationId)
  }

  return redirectToUrl
}

export async function createVerification({ request, type, target, period = 600, redirectTo }: {
  request: Request
  type: VerificationTypes
  target: string
  period?: number
  redirectTo?: string
}) {
  const { otp, charSet, ...config } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: '0123456789',
    period,
  })

  const verificationConfig: Insertable<Verification> = {
    id: uuidv7(),
    type,
    target,
    ...config,
    charset: charSet,
    expiresAt: new Date(Date.now() + config.period * 1000),
    createdAt: new Date(),
  }

  await repositoryFactory.getVerificationRepository().create(verificationConfig)

  const verifyUrl = getRedirectToUrl({ request, type, target, redirectTo })
  const verifyRedirectTo = new URL(verifyUrl.toString())

  verifyUrl.searchParams.set(codeQueryParam, otp)

  return { otp, redirectTo: verifyRedirectTo, verifyUrl }
}

export async function isCodeValid({
  code,
  type,
  target,
}: {
  code: string
  type: VerificationTypes | typeof twoFAVerifyVerificationType
  target: string
}) {
  const verification = await repositoryFactory.getVerificationRepository()
    .fetchLatest(type, target)

  if (!verification)
    return false

  // if the verification has expired
  if (verification.expiresAt !== null && verification.expiresAt < new Date()) {
    await repositoryFactory.getVerificationRepository().delete(type, target)
    return false
  }

  const result = await verifyTOTP({
    otp: code,
    ...verification,
  })
  return result !== null
}

export async function validateRequest(
  request: Request,
  body: URLSearchParams | FormData,
) {
  const submission = await parseWithZod(body, {
    schema: VerifySchema.refine(async (data) => {
      const codeIsValid = await isCodeValid({
        code: data[codeQueryParam],
        type: data[typeQueryParam],
        target: data[targetQueryParam],
      })
      return codeIsValid
    }, { message: 'Invalid code', path: ['code'] }),
    async: true,
  })

  if (submission.status !== 'success') {
    return data(submission.reply(), {
      status: 400,
    })
  }

  const { value: submissionValue } = submission

  const verificationRepository = new VerificationRepository(db)

  switch (submissionValue[typeQueryParam]) {
    case 'onboarding': {
      await verificationRepository.delete(submissionValue[typeQueryParam], submissionValue[targetQueryParam])
      return handleOnboardingVerification({ request, submission, body })
    }
    case 'reset-password': {
      await verificationRepository.delete(submissionValue[typeQueryParam], submissionValue[targetQueryParam])
      return handleResetPasswordVerification({ request, submission, body })
    }
    case 'change-email': {
      await verificationRepository.delete(submissionValue[typeQueryParam], submissionValue[targetQueryParam])
      return handleChangeEmailVerification({ request, submission, body })
    }
    case '2fa': {
      return handleLoginTwoFactorVerification({ request, submission, body })
    }
  }
}

export async function requireRecentVerification(request: Request) {
  const user = await requireUser(request)
  const shouldReverify = await shouldRequestTwoFA(request)
  if (shouldReverify) {
    const reqUrl = new URL(request.url)
    const redirectUrl = getRedirectToUrl({
      request,
      target: user.id,
      type: twoFAVerifyVerificationType,
      redirectTo: reqUrl.pathname + reqUrl.search,
    })
    throw await redirectWithToast(redirectUrl.toString(), {
      title: 'Please Reverify',
      description: 'Please reverify your account before proceeding',
    })
  }
}
