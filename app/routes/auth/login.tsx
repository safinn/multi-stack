import type { Route } from './+types/login'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { startAuthentication } from '@simplewebauthn/browser'
import { useOptimistic, useState, useTransition } from 'react'
import { data, Form, Link, useNavigate, useSearchParams } from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { CheckboxField, ErrorList, Field } from '~/components/forms'
import { Icon } from '~/components/ui/icon'
import { Separator } from '~/components/ui/separator'
import { StatusButton } from '~/components/ui/status-button'
import { login, requireAnonymous } from '~/utils/auth/auth.server'
import { handleNewSession } from '~/utils/auth/login.server'
import { ProviderConnectionForm, providerNames } from '~/utils/connections'
import { checkHoneypot } from '~/utils/honeypot.server'
import { getErrorMessage, useIsPending } from '~/utils/misc'
import { PasswordSchema, UsernameSchema } from '~/utils/user-validation'

const LoginFormSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  redirectTo: z.string().default('/app'),
  remember: z.boolean().optional(),
})

const AuthenticationOptionsSchema = z.object({
  options: z.object({ challenge: z.string() }),
}) satisfies z.ZodType<{ options: PublicKeyCredentialRequestOptionsJSON }>

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request)
  return null
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request)
  const formData = await request.formData()
  await checkHoneypot(formData)
  const submission = await parseWithZod(formData, {
    schema: intent => LoginFormSchema.transform(async (data, ctx) => {
      if (intent !== null)
        return { ...data, session: null }

      const url = new URL(request.url)
      const invitationId = url.searchParams.get('invitationId') || undefined

      const session = await login(data, invitationId)
      if (!session) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid username or password',
        })
        return z.NEVER
      }

      return { ...data, session }
    }),
    async: true,
  })

  if (submission.status !== 'success' || !submission.value.session) {
    return data(
      submission.reply({ hideFields: ['password'] }),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const { session, remember, redirectTo } = submission.value

  return handleNewSession({
    request,
    session,
    remember: remember ?? false,
    redirectTo,
  })
}

export default function Login({ actionData }: Route.ComponentProps) {
  const isPending = useIsPending()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const invitationId = searchParams.get('invitationId')

  const [form, fields] = useForm({
    constraint: getZodConstraint(LoginFormSchema),
    defaultValue: { redirectTo },
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginFormSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <div className="max-w-sm space-y-8">
      <Form method="POST" {...getFormProps(form)}>
        <HoneypotInputs />
        <Field
          labelProps={{ htmlFor: fields.username.id, children: 'Username' }}
          inputProps={{ ...getInputProps(fields.username, { type: 'email' }), autoFocus: true }}
          errors={fields.username.errors}
        />
        <Field
          labelProps={{ htmlFor: fields.password.id, children: 'Password' }}
          inputProps={{ ...getInputProps(fields.password, { type: 'password' }) }}
          errors={fields.password.errors}
        />
        <div className="flex justify-between">
          <CheckboxField
            labelProps={{ htmlFor: fields.remember.id, children: 'Remember me' }}
            buttonProps={getInputProps(fields.remember, { type: 'checkbox' })}
            errors={fields.remember.errors}
          />
          <Link
            to="/forgot-password"
            className="text-body-xs font-semibold"
          >
            Forgot password?
          </Link>
        </div>
        <input
          {...getInputProps(fields.redirectTo, { type: 'hidden' })}
        />
        <ErrorList errors={form.errors} id={form.errorId} />
        <StatusButton
          className="w-full"
          status={isPending ? 'pending' : (form.status ?? 'idle')}
          type="submit"
          disabled={isPending}
        >
          Log in
        </StatusButton>
      </Form>

      <Separator />

      <PasskeyLogin
        redirectTo={redirectTo}
        remember={fields.remember.value === 'on'}
      />

      <Separator />

      <ul className="flex flex-col gap-5">
        {providerNames.map(providerName => (
          <li key={providerName}>
            <ProviderConnectionForm
              type="Login"
              providerName={providerName}
              redirectTo={redirectTo}
              invitationId={invitationId}
            />
          </li>
        ))}
      </ul>

      <div>
        <span className="text-muted-foreground">New here? </span>
        <Link to="/signup">Create an account</Link>
      </div>
    </div>
  )
}

const VerificationResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    location: z.string(),
  }),
  z.object({
    status: z.literal('error'),
    error: z.string(),
  }),
])

function PasskeyLogin({
  redirectTo,
  remember,
}: {
  redirectTo: string | null
  remember: boolean
}) {
  const [isPending] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [passkeyMessage, setPasskeyMessage] = useOptimistic<string | null>(
    'Login with a passkey',
  )
  const navigate = useNavigate()

  const handlePasskeyLogin = async () => {
    try {
      setPasskeyMessage('Generating Authentication Options')
      // Get authentication options from the server
      const optionsResponse = await fetch('/webauthn/authentication')
      const json = await optionsResponse.json()
      const { options } = AuthenticationOptionsSchema.parse(json)

      setPasskeyMessage('Requesting your authorization')
      const authResponse = await startAuthentication({ optionsJSON: options })
      setPasskeyMessage('Verifying your passkey')

      // Verify the authentication with the server
      const verificationResponse = await fetch('/webauthn/authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authResponse, remember, redirectTo }),
      })

      const verificationJson = await verificationResponse.json().catch(() => ({
        status: 'error',
        error: 'Unknown error',
      }))

      const parsedResult = VerificationResponseSchema.safeParse(verificationJson)
      if (!parsedResult.success) {
        throw new Error(parsedResult.error.message)
      }
      else if (parsedResult.data.status === 'error') {
        throw new Error(parsedResult.data.error)
      }
      const { location } = parsedResult.data

      setPasskeyMessage('You\'re logged in! Navigating...')
      await navigate(location ?? '/')
    }
    catch (error) {
      const errorMessage = getErrorMessage(error)
      setError(`Failed to authenticate with passkey: ${errorMessage}`)
    }
  }

  return (
    <form action={handlePasskeyLogin}>
      <StatusButton
        id="passkey-login-button"
        aria-describedby="passkey-login-button-error"
        className="w-full"
        status={isPending ? 'pending' : error ? 'error' : 'idle'}
        type="submit"
        disabled={isPending}
      >
        <span className="inline-flex items-center gap-1.5">
          <Icon name="passkey" />
          <span>{passkeyMessage}</span>
        </span>
      </StatusButton>
      <div className="mt-2">
        <ErrorList errors={[error]} id="passkey-login-button-error" />
      </div>
    </form>
  )
}
