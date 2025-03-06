import type { Route } from './+types/change-email'
import process from 'node:process'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, href, redirect } from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { repositoryFactory } from '~/data/factory'
import { emailer } from '~/email/emailer'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { newEmailAddressSessionKey } from '~/utils/auth/change-email.server'
import { verifySessionStorage } from '~/utils/auth/verification.sever'
import { createVerification, requireRecentVerification } from '~/utils/auth/verify.server'
import { useIsPending } from '~/utils/misc'
import { EmailSchema } from '~/utils/user-validation'

const ChangeEmailSchema = z.object({
  email: EmailSchema,
})

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRecentVerification(request)
  const { user } = await requireUserInOrganization(request, params.organizationId)
  if (!user) {
    const params = new URLSearchParams({ redirectTo: request.url })
    throw redirect(`${href('/login')}?${params}`)
  }
  return { user }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const formData = await request.formData()
  const submission = await parseWithZod(formData, {
    schema: ChangeEmailSchema.refine(async (data) => {
      const existingUser = await repositoryFactory.getUserRepository().findByEmail(data.email)
      return !existingUser
    }, {
      message: 'This email is already in use.',
      path: ['email'],
    }),
    async: true,
  })

  if (submission.status !== 'success') {
    return data(
      submission.reply(),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }
  const { otp, redirectTo, verifyUrl } = await createVerification({
    period: 10 * 60,
    request,
    target: user.id,
    type: 'change-email',
    redirectTo: ['/app', params.organizationId, 'settings'].filter(Boolean).join('/'),
  })

  await emailer.send(submission.value.email, 'change_email', {
    productName: process.env.PRODUCT_NAME,
    otp,
    verifyUrl,
  })

  const verifySession = await verifySessionStorage.getSession()
  verifySession.set(newEmailAddressSessionKey, submission.value.email)
  return redirect(redirectTo.toString(), {
    headers: {
      'set-cookie': await verifySessionStorage.commitSession(verifySession),
    },
  })
}

export const handle = {
  breadcrumb: 'Change Email',
}

export default function ChangeEmail({ actionData }: Route.ComponentProps) {
  const isPending = useIsPending()

  const [form, fields] = useForm({
    constraint: getZodConstraint(ChangeEmailSchema),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ChangeEmailSchema })
    },
  })

  return (
    <>
      <Form method="POST" {...getFormProps(form)}>
        <Field
          className="max-w-72"
          labelProps={{ children: 'New Email' }}
          inputProps={{
            ...getInputProps(fields.email, { type: 'email' }),
            autoComplete: 'email',
          }}
          errors={fields.email.errors}
        />
        <ErrorList id={form.errorId} errors={form.errors} />
        <StatusButton
          className="mt-6"
          status={isPending ? 'pending' : (form.status ?? 'idle')}
          type="submit"
          disabled={isPending}
        >
          Send Confirmation
        </StatusButton>
      </Form>
    </>
  )
}
