import type { Route } from './+types/signup'
import process from 'node:process'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { data, Form, href, Link, redirect, useSearchParams } from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms'
import { Separator } from '~/components/ui/separator'
import { StatusButton } from '~/components/ui/status-button'
import { repositoryFactory } from '~/data/factory'
import { emailer } from '~/email/emailer'
import { getUser, requireAnonymous } from '~/utils/auth/auth.server'
import { createVerification, invitationQueryParam } from '~/utils/auth/verify.server'
import { ProviderConnectionForm, providerNames } from '~/utils/connections'
import { checkHoneypot } from '~/utils/honeypot.server'
import { useIsPending } from '~/utils/misc'
import { EmailSchema } from '~/utils/user-validation'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const invitationId = url.searchParams.get(invitationQueryParam)

  if (invitationId) {
    const user = await getUser(request)
    // Claim the invitation for the logged in user
    if (user) {
      const membership = await repositoryFactory.getMembershipRepository().claim(user.id, invitationId)
      if (membership) {
        const organization = await repositoryFactory.getOrganizationRepository().findById(membership.organizationId)
        return redirect(href('/app/:organizationId?', { organizationId: organization?.shortId }))
      }
    }
  }

  await requireAnonymous(request)
  return null
}

const SignupSchema = z.object({
  email: EmailSchema,
})

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request)
  const formData = await request.formData()
  await checkHoneypot(formData)

  // Validate the form data
  const submission = await parseWithZod(formData, {
    schema: SignupSchema.refine(async (data) => {
      // Check if a user with the email already exists
      const user = await repositoryFactory.getUserRepository().findByEmail(data.email)
      return !user
    }, {
      message: 'A user with this email already exists',
      path: ['email'],
    }),
    async: true,
  })

  if (submission.status !== 'success') {
    return data(submission.reply(), {
      status: 400,
    })
  }

  const { email } = submission.value
  const { otp, redirectTo, verifyUrl } = await createVerification({
    request,
    type: 'onboarding',
    target: email,
    period: 600,
  })

  // Send the verification email
  const { PRODUCT_NAME } = process.env
  invariantResponse(PRODUCT_NAME, 'PRODUCT_NAME must be set')
  await emailer.send(email, 'onboarding_verify', { otp, verifyUrl, productName: PRODUCT_NAME })

  // Redirect to the verify page
  return redirect(redirectTo.toString(), {
    status: 302,
  })
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams()
  const isPending = useIsPending()
  const redirectTo = searchParams.get('redirectTo')
  const invitationId = searchParams.get('invitationId')

  const [form, fields] = useForm({
    constraint: getZodConstraint(SignupSchema),
    // Sync the result of last submission
    lastResult: actionData,
    // Configure when each field should be validated
    shouldRevalidate: 'onBlur',
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: SignupSchema })
    },
  })

  return (
    <div className="max-w-sm space-y-8">
      <Form method="POST" {...getFormProps(form)}>
        <HoneypotInputs />
        <Field
          labelProps={{ htmlFor: fields.email.id, children: 'Email' }}
          inputProps={{ ...getInputProps(fields.email, { type: 'email' }), autoFocus: true }}
          errors={fields.email.errors}
          infoMessage="We'll never share your email with anyone else."
        />
        <ErrorList errors={form.errors} id={form.errorId} />
        <StatusButton
          className="mt-6 w-full"
          status={isPending ? 'pending' : (form.status ?? 'idle')}
          type="submit"
          disabled={isPending}
        >
          Create an account
        </StatusButton>
      </Form>

      <Separator />

      <ul className="flex flex-col gap-5">
        {providerNames.map(providerName => (
          <li key={providerName}>
            <ProviderConnectionForm
              type="Signup"
              providerName={providerName}
              redirectTo={redirectTo}
              invitationId={invitationId}
            />
          </li>
        ))}
      </ul>
      <div>
        <span className="text-muted-foreground">Already have an account? </span>
        <Link to={`/login?${searchParams.toString()}`}>
          Login
        </Link>
      </div>
    </div>
  )
}
