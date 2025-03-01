import type { Route } from './+types/reset-password'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, href, redirect } from 'react-router'
import { ErrorList, Field } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { requireAnonymous, resetUserPassword } from '~/utils/auth/auth.server'
import { verifySessionStorage } from '~/utils/auth/verification.sever'
import { useIsPending } from '~/utils/misc'
import { PasswordAndConfirmPasswordSchema } from '~/utils/user-validation'

export const resetPasswordUsernameSessionKey = 'resetPasswordUsername'

const ResetPasswordSchema = PasswordAndConfirmPasswordSchema

async function requireResetPasswordUsername(request: Request) {
  await requireAnonymous(request)
  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const resetPasswordUsername = verifySession.get(
    resetPasswordUsernameSessionKey,
  )
  if (typeof resetPasswordUsername !== 'string' || !resetPasswordUsername) {
    throw redirect(href('/login'))
  }
  return resetPasswordUsername
}

export async function loader({ request }: Route.LoaderArgs) {
  const resetPasswordUsername = await requireResetPasswordUsername(request)
  return { resetPasswordUsername }
}

export async function action({ request }: Route.ActionArgs) {
  const resetPasswordUsername = await requireResetPasswordUsername(request)
  const formData = await request.formData()
  const submission = parseWithZod(formData, {
    schema: ResetPasswordSchema,
  })
  if (submission.status !== 'success') {
    return data(
      submission.reply(),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }
  const { password } = submission.value

  await resetUserPassword({ username: resetPasswordUsername, password })
  const verifySession = await verifySessionStorage.getSession()
  return redirect(href('/login'), {
    headers: {
      'set-cookie': await verifySessionStorage.destroySession(verifySession),
    },
  })
}

export default function ResetPassword({ actionData, loaderData }: Route.ComponentProps) {
  const isPending = useIsPending()

  const [form, fields] = useForm({
    id: 'reset-password',
    constraint: getZodConstraint(ResetPasswordSchema),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ResetPasswordSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <>
      <p className="text-body-md text-muted-foreground">
        Hi,
        {' '}
        {loaderData.resetPasswordUsername}
        . No worries. It happens all the
        time.
      </p>
      <Form method="POST" {...getFormProps(form)}>
        <Field
          className="max-w-72"
          labelProps={{ htmlFor: fields.password.id, children: 'New Password' }}
          inputProps={{ ...getInputProps(fields.password, { type: 'password' }), autoComplete: 'new-password', autoFocus: true }}
          errors={fields.password.errors}
        />
        <Field
          className="max-w-72"
          labelProps={{ htmlFor: fields.confirmPassword.id, children: 'Confirm Password' }}
          inputProps={{ ...getInputProps(fields.confirmPassword, { type: 'password' }), autoComplete: 'new-password' }}
          errors={fields.confirmPassword.errors}
        />
        <ErrorList errors={form.errors} id={form.errorId} />
        <StatusButton
          className="mt-6 block"
          status={isPending ? 'pending' : (form.status ?? 'idle')}
          type="submit"
          disabled={isPending}
        >
          Reset password
        </StatusButton>
      </Form>
    </>
  )
}
