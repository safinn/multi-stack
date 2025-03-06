import type { SubmissionResult } from '@conform-to/react'
import type { Params } from 'react-router'
import type { Route } from './+types/onboarding-provider'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, href, redirect, useSearchParams } from 'react-router'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { z } from 'zod'
import { CheckboxField, ErrorList, Field } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { repositoryFactory } from '~/data/factory'
import { requireAnonymous, sessionKey, signupWithConnection } from '~/utils/auth/auth.server'
import { onboardingEmailSessionKey } from '~/utils/auth/onboarding.server'
import { authSessionStorage } from '~/utils/auth/session.server'
import { verifySessionStorage } from '~/utils/auth/verification.sever'
import { ProviderNameSchema } from '~/utils/connections'
import { log } from '~/utils/logger.server'
import { useIsPending } from '~/utils/misc'
import { redirectWithToast } from '~/utils/toast.server'
import { UsernameSchema } from '~/utils/user-validation'

export const providerIdKey = 'providerId'
export const prefilledProfileKey = 'prefilledProfile'

const SignupFormSchema = z.object({
  imageUrl: z.string().optional(),
  username: UsernameSchema,
  agreeToTermsOfServiceAndPrivacyPolicy: z.boolean({
    required_error: 'You must agree to the terms of service and privacy policy',
  }),
  remember: z.boolean().optional(),
  redirectTo: z.string().optional(),
  invitationId: z.string().optional(),
})

async function requireData({
  request,
  params,
}: {
  request: Request
  params: Params
}) {
  await requireAnonymous(request)
  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const email = verifySession.get(onboardingEmailSessionKey)
  const providerId = verifySession.get(providerIdKey)
  const result = z
    .object({
      email: z.string(),
      providerName: ProviderNameSchema,
      providerId: z.string(),
    })
    .safeParse({ email, providerName: params.provider, providerId })
  if (result.success) {
    return result.data
  }
  else {
    log.error(result.error)
    throw redirect(href('/signup'))
  }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { email } = await requireData({ request, params })

  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const prefilledProfile = verifySession.get(prefilledProfileKey)

  return {
    email,
    status: 'idle',
    submission: {
      status: undefined,
      initialValue: prefilledProfile ?? {},
      error: { '': [] },
    } as SubmissionResult,
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { email, providerId, providerName } = await requireData({
    request,
    params,
  })
  const formData = await request.formData()
  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )

  const submission = await parseWithZod(formData, {
    schema: SignupFormSchema.refine(async (data) => {
      const existingUser = await repositoryFactory.getUserRepository().findByUsername(data.username)
      return !existingUser
    }, {
      message: 'A user already exists with this username',
      path: ['username'],
    }).transform(async (data) => {
      const session = await signupWithConnection({
        ...data,
        email,
        providerId,
        providerName,
      })
      return { ...data, session }
    }),
    async: true,
  })

  if (submission.status !== 'success') {
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

  let redirectUrl = redirectTo
  if (!redirectUrl && submission.value.invitationId) {
    const membership = await repositoryFactory.getMembershipRepository().findByInvitationId(submission.value.invitationId)
    if (membership) {
      const organization = await repositoryFactory.getOrganizationRepository().findById(membership.organizationId)
      redirectUrl = `/app/${organization?.shortId}`
    }
  }

  return redirectWithToast(
    safeRedirect(redirectUrl),
    { title: 'Welcome', description: 'Thanks for signing up!' },
    { headers },
  )
}

export default function OnboardingProvider({ loaderData, actionData }: Route.ComponentProps) {
  const isPending = useIsPending()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const invitationId = searchParams.get('invitationId')

  const [form, fields] = useForm({
    constraint: getZodConstraint(SignupFormSchema),
    lastResult: actionData ?? loaderData.submission,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: SignupFormSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <>
      <p>
        Welcome aboard
        {' '}
        {loaderData.email}
        !
      </p>
      <Form method="POST" {...getFormProps(form)}>
        <Field
          className="max-w-72"
          labelProps={{ htmlFor: fields.username.id, children: 'Username' }}
          inputProps={{
            ...getInputProps(fields.username, { type: 'text' }),
            autoComplete: 'username',
          }}
          errors={fields.username.errors}
        />
        <CheckboxField
          labelProps={{
            htmlFor: fields.agreeToTermsOfServiceAndPrivacyPolicy.id,
            children: 'Do you agree to our Terms of Service and Privacy Policy?',
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
        {redirectTo
          ? (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            )
          : null}

        {invitationId
          ? (
              <input type="hidden" name="invitationId" value={invitationId} />
            )
          : null}

        <ErrorList errors={form.errors} id={form.errorId} />

        <StatusButton
          className="mt-6"
          status={isPending ? 'pending' : (form.status ?? 'idle')}
          type="submit"
          disabled={isPending}
        >
          Create an account
        </StatusButton>
      </Form>
    </>
  )
}
