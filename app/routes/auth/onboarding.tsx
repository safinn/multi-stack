import type { Route } from './+types/onboarding'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, href, redirect, useSearchParams } from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { z } from 'zod'
import { CheckboxField, Field } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { db } from '~/data/db'
import { UserRepository } from '~/data/repositories/user'
import { requireAnonymous, sessionKey, signup } from '~/utils/auth/auth.server'
import { onboardingEmailSessionKey } from '~/utils/auth/onboarding.server'
import { authSessionStorage } from '~/utils/auth/session.server'
import { verifySessionStorage } from '~/utils/auth/verification.sever'
import { invitationQueryParam } from '~/utils/auth/verify.server'
import { checkHoneypot } from '~/utils/honeypot.server'
import { useIsPending } from '~/utils/misc'
import { PasswordAndConfirmPasswordSchema, UsernameSchema } from '~/utils/user-validation'

const SignupFormSchema = z
  .object({
    username: UsernameSchema,
    agreeToTermsOfServiceAndPrivacyPolicy: z.boolean({
      required_error:
        'You must agree to the terms of service and privacy policy',
    }),
    remember: z.boolean().optional(),
    redirectTo: z.string().optional(),
  })
  .and(PasswordAndConfirmPasswordSchema)

async function requireOnboardingEmail(request: Request) {
  await requireAnonymous(request)
  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const email = verifySession.get(onboardingEmailSessionKey)
  if (typeof email !== 'string' || !email) {
    throw redirect(href('/signup'))
  }
  return email
}

export async function loader({ request }: Route.LoaderArgs) {
  const email = await requireOnboardingEmail(request)
  return { email }
}

export async function action({ request }: Route.ActionArgs) {
  const email = await requireOnboardingEmail(request)
  const formData = await request.formData()
  await checkHoneypot(formData)
  const submission = await parseWithZod(formData, {
    schema: intent => SignupFormSchema.refine(async (data) => {
      const existingUser = await new UserRepository(db).findByUsername(data.username)
      return !existingUser
    }, {
      message: 'A user already exists with this username',
      path: ['username'],
    }).transform(async (data) => {
      if (intent !== null)
        return { ...data, session: null }

      const url = new URL(request.url)
      const invitationId = url.searchParams.get(invitationQueryParam) || undefined

      const session = await signup({ ...data, email, invitationId })
      return { ...data, session }
    }),
    async: true,
  })

  if (submission.status !== 'success' || !submission.value.session) {
    return data(
      submission.reply(),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const { session, remember, redirectTo } = submission.value

  const authSession = await authSessionStorage.getSession(
    request.headers.get('cookie'),
  )
  authSession.set(sessionKey, session.id)

  const verifySession = await verifySessionStorage.getSession()
  const headers = new Headers()
  headers.append(
    'set-cookie',
    await authSessionStorage.commitSession(authSession, {
      expires: remember ? session.expirationDate : undefined,
    }),
  )
  headers.append(
    'set-cookie',
    await verifySessionStorage.destroySession(verifySession),
  )

  return redirect(safeRedirect(redirectTo), { headers })
}

export default function Onboarding({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/app'
  const isPending = useIsPending()

  const [form, fields] = useForm({
    id: 'onboarding-form',
    constraint: getZodConstraint(SignupFormSchema),
    defaultValue: { redirectTo },
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: SignupFormSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <>
      <Form method="POST" {...getFormProps(form)}>
        <HoneypotInputs />
        <Field
          className="max-w-72"
          labelProps={{ htmlFor: fields.username.id, children: 'Username' }}
          inputProps={{ ...getInputProps(fields.username, { type: 'text' }), autoFocus: true }}
          errors={fields.username.errors}
        />
        <Field
          className="max-w-72"
          labelProps={{ htmlFor: fields.password.id, children: 'Password' }}
          inputProps={{ ...getInputProps(fields.password, { type: 'password' }) }}
          errors={fields.password.errors}
        />
        <Field
          className="max-w-72"
          labelProps={{ htmlFor: fields.confirmPassword.id, children: 'Confirm Password' }}
          inputProps={{ ...getInputProps(fields.confirmPassword, { type: 'password' }) }}
          errors={fields.confirmPassword.errors}
        />
        <CheckboxField
          labelProps={{
            htmlFor: fields.agreeToTermsOfServiceAndPrivacyPolicy.id,
            children: 'Agree to terms of service and privacy policy',
          }}
          buttonProps={getInputProps(
            fields.agreeToTermsOfServiceAndPrivacyPolicy,
            { type: 'checkbox' },
          )}
          errors={fields.agreeToTermsOfServiceAndPrivacyPolicy.errors}
        />
        <CheckboxField
          labelProps={{
            htmlFor: fields.remember.id,
            children: 'Remember me',
          }}
          buttonProps={getInputProps(fields.remember, { type: 'checkbox' })}
          errors={fields.remember.errors}
        />
        <input {...getInputProps(fields.redirectTo, { type: 'hidden' })} />
        <StatusButton
          className="mt-6"
          status={isPending ? 'pending' : (form.status ?? 'idle')}
          type="submit"
          disabled={isPending}
        >
          Create account
        </StatusButton>
      </Form>
    </>
  )
}
