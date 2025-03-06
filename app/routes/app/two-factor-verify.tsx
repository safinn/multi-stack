import type { Route } from './+types/two-factor-verify'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { getTOTPAuthUri } from '@epic-web/totp'
import * as QRCode from 'qrcode'
import { data, Form, redirect, useNavigation } from 'react-router'
import { z } from 'zod'
import { ErrorList, OTPField } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { db } from '~/data/db'
import { repositoryFactory } from '~/data/factory'
import { VerificationRepository } from '~/data/repositories/verification'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { isCodeValid } from '~/utils/auth/verify.server'
import { getDomainUrl, useIsPending } from '~/utils/misc'
import { redirectWithToast } from '~/utils/toast.server'
import { twoFAVerificationType } from './two-factor'

export const twoFAVerifyVerificationType = '2fa-verify'

const CancelSchema = z.object({ intent: z.literal('cancel') })
const VerifySchema = z.object({
  intent: z.literal('verify'),
  code: z.string().min(6).max(6),
})

const ActionSchema = z.discriminatedUnion('intent', [
  CancelSchema,
  VerifySchema,
])

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)

  const verification = await repositoryFactory.getVerificationRepository().fetchLatest(twoFAVerifyVerificationType, user.id)
  if (!verification) {
    const redirectTo = ['/app', params.organizationId, 'settings', 'two-factor']
      .filter(Boolean)
      .join('/')
    return redirect(redirectTo)
  }

  const issuer = new URL(getDomainUrl(request)).host
  const otpUri = getTOTPAuthUri({
    ...verification,
    algorithm: verification.algorithm,
    accountName: user.email,
    issuer,
  })
  const qrCode = await QRCode.toDataURL(otpUri)
  return { otpUri, qrCode, user }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const formData = await request.formData()

  const submission = await parseWithZod(formData, {
    schema: () =>
      ActionSchema.refine(async (data) => {
        if (data.intent === 'cancel')
          return true
        const codeIsValid = await isCodeValid({
          code: data.code,
          type: twoFAVerifyVerificationType,
          target: user.id,
        })
        return codeIsValid
      }, {
        message: 'Invalid code',
        path: ['code'],
      }),
    async: true,
  })

  if (submission.status !== 'success') {
    return data(
      submission.reply(),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const verificationRepository = new VerificationRepository(db)
  const redirectTo = ['/app', params.organizationId, 'settings', 'two-factor']
    .filter(Boolean)
    .join('/')

  switch (submission.value.intent) {
    case 'cancel': {
      await verificationRepository.delete(twoFAVerifyVerificationType, user.id)
      return redirect(redirectTo)
    }
    case 'verify': {
      await verificationRepository.patchByTypeAndTarget(twoFAVerifyVerificationType, user.id, {
        type: twoFAVerificationType,
      })
      return redirectWithToast(redirectTo, {
        type: 'success',
        title: 'Enabled',
        description: 'Two-factor authentication has been enabled.',
      })
    }
  }
}

export const handle = {
  breadcrumb: 'Verify Two Factor Authentication',
}

export default function TwoFactorVerify({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isPending = useIsPending()
  const pendingIntent = isPending ? navigation.formData?.get('intent') : null

  const [form, fields] = useForm({
    id: 'verify-form',
    constraint: getZodConstraint(ActionSchema),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ActionSchema })
    },
  })
  const lastSubmissionIntent = fields.intent.value

  return (
    <>
      <div className="space-y-2">
        <img alt="qr code" src={loaderData.qrCode} className="h-56 w-56" />
        <p className="max-w-lg">Scan this QR code with your authenticator app.</p>
        <p className="text-sm max-w-lg">
          If you cannot scan the QR code, you can manually add this account to
          your authenticator app using this code:
        </p>
        <pre
          className="max-w-lg p-4 my-4 bg-muted text-sm w-full overflow-x-auto whitespace-pre-wrap break-all"
          aria-label="One-time Password URI"
        >
          {loaderData.otpUri}
        </pre>
        <p className="text-sm max-w-lg">
          Once you've added the account, enter the code from your authenticator
          app below. Once you enable 2FA, you will need to enter a code from
          your authenticator app every time you log in or perform important
          actions. Do not lose access to your authenticator app, or you will
          lose access to your account.
        </p>
      </div>

      <Form method="POST" {...getFormProps(form)}>
        <OTPField
          labelProps={{
            htmlFor: fields.code.id,
            children: 'Code',
          }}
          inputProps={{
            ...getInputProps(fields.code, { type: 'text' }),
            autoFocus: true,
            autoComplete: 'one-time-code',
          }}
          errors={fields.code.errors}
        />
        <ErrorList id={form.errorId} errors={form.errors} />

        <div className="flex gap-4">
          <StatusButton
            status={
              pendingIntent === 'verify'
                ? 'pending'
                : lastSubmissionIntent === 'verify'
                  ? (form.status ?? 'idle')
                  : 'idle'
            }
            type="submit"
            name="intent"
            value="verify"
          >
            Submit
          </StatusButton>
          <StatusButton
            variant="secondary"
            status={
              pendingIntent === 'cancel'
                ? 'pending'
                : lastSubmissionIntent === 'cancel'
                  ? (form.status ?? 'idle')
                  : 'idle'
            }
            type="submit"
            name="intent"
            value="cancel"
            disabled={isPending}
          >
            Cancel
          </StatusButton>
        </div>
      </Form>
    </>
  )
}
