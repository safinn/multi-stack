import type { Route } from './+types/forgot-password'
import process from 'node:process'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { data, Link, redirect, useFetcher } from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { db } from '~/data/db'
import { UserRepository } from '~/data/repositories/user'
import { emailer } from '~/email/emailer'
import { createVerification } from '~/utils/auth/verify.server'
import { checkHoneypot } from '~/utils/honeypot.server'
import { EmailSchema, UsernameSchema } from '~/utils/user-validation'

const ForgotPasswordSchema = z.object({
  usernameOrEmail: z.union([EmailSchema, UsernameSchema]),
})

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  await checkHoneypot(formData)
  const submission = await parseWithZod(formData, {
    schema: ForgotPasswordSchema.refine(async (data) => {
      const user = await new UserRepository(db).findByUsernameOrEmail(data.usernameOrEmail)
      return user
    }, {
      path: ['usernameOrEmail'],
      message: 'No user exists with this username or email',
    }),
    async: true,
  })

  if (submission.status !== 'success') {
    return data(
      submission.reply(),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const { usernameOrEmail } = submission.value

  const user = await new UserRepository(db).findByUsernameOrEmail(usernameOrEmail)
  invariantResponse(user, 'Should have a user')

  const { verifyUrl, redirectTo, otp } = await createVerification({
    request,
    type: 'reset-password',
    target: usernameOrEmail,
    period: 10 * 60,
  })

  await emailer.send(user.email, 'forgot_password', {
    productName: process.env.PRODUCT_NAME,
    otp,
    verifyUrl,
  })

  return redirect(redirectTo.toString())
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const forgotPassword = useFetcher()

  const [form, fields] = useForm({
    constraint: getZodConstraint(ForgotPasswordSchema),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ForgotPasswordSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <>
      <forgotPassword.Form method="POST" {...getFormProps(form)}>
        <HoneypotInputs />
        <Field
          className="max-w-72"
          labelProps={{ htmlFor: fields.usernameOrEmail.id, children: 'Username or Email' }}
          inputProps={{ ...getInputProps(fields.usernameOrEmail, { type: 'text' }), autoFocus: true }}
          errors={fields.usernameOrEmail.errors}
        />
        <ErrorList errors={form.errors} id={form.errorId} />
        <StatusButton
          className="mt-6 block"
          status={
            forgotPassword.state === 'submitting'
              ? 'pending'
              : (form.status ?? 'idle')
          }
          type="submit"
          disabled={forgotPassword.state !== 'idle'}
        >
          Recover password
        </StatusButton>
      </forgotPassword.Form>
      <Link
        to="/login"
        className="text-body-sm font-bold"
      >
        Back to Login
      </Link>
    </>
  )
}
