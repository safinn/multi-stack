import type { Route } from './+types/passkeys'
import { startRegistration } from '@simplewebauthn/browser'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { Form, useRevalidator } from 'react-router'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/ui/icon'
import { repositoryFactory } from '~/data/factory'
import { requireUserInOrganization } from '~/utils/auth/auth.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const passkeys = await repositoryFactory.getPasskeyRepository().findByUserId(user.id)
  return { passkeys: passkeys || [] }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'delete') {
    const passkeyId = formData.get('passkeyId')
    if (typeof passkeyId !== 'string') {
      return Response.json(
        { status: 'error', error: 'Invalid passkey ID' },
        { status: 400 },
      )
    }

    await repositoryFactory.getPasskeyRepository().delete(passkeyId, user.id)
    return Response.json({ status: 'success' })
  }

  return Response.json(
    { status: 'error', error: 'Invalid intent' },
    { status: 400 },
  )
}

export const handle = {
  breadcrumb: 'Passkeys',
}

const RegistrationOptionsSchema = z.object({
  options: z.object({
    rp: z.object({
      id: z.string(),
      name: z.string(),
    }),
    user: z.object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
    }),
    challenge: z.string(),
    pubKeyCredParams: z.array(
      z.object({
        type: z.literal('public-key'),
        alg: z.number(),
      }),
    ),
    authenticatorSelection: z
      .object({
        authenticatorAttachment: z
          .enum(['platform', 'cross-platform'])
          .optional(),
        residentKey: z
          .enum(['required', 'preferred', 'discouraged'])
          .optional(),
        userVerification: z
          .enum(['required', 'preferred', 'discouraged'])
          .optional(),
        requireResidentKey: z.boolean().optional(),
      })
      .optional(),
  }),
}) satisfies z.ZodType<{ options: PublicKeyCredentialCreationOptionsJSON }>

export default function Passkeys({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator()
  const [error, setError] = useState<string | null>(null)

  const handlePasskeyGeneration = async () => {
    try {
      setError(null)
      const resp = await fetch('/webauthn/registration')
      const jsonResult = await resp.json()
      const parsedResult = RegistrationOptionsSchema.parse(jsonResult)

      const regResult = await startRegistration({
        optionsJSON: parsedResult.options,
      })
      const verificationResp = await fetch('/webauthn/registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regResult),
      })

      if (!verificationResp.ok) {
        throw new Error('Failed to verify registration')
      }
      void revalidator.revalidate()
    }
    catch (err) {
      console.error('Failed to create passkey:', err)
      setError('Failed to create passkey. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      <form action={handlePasskeyGeneration}>
        <Button type="submit" variant="secondary">
          <Icon name="add">Register new passkey</Icon>
        </Button>
      </form>

      {error
        ? (
            <div className="rounded-md bg-destructive/15 p-4 text-destructive max-w-sm">
              {error}
            </div>
          )
        : null}

      {loaderData.passkeys.length
        ? (
            <ul>
              {loaderData.passkeys.map(passkey => (
                <li key={passkey.id} className="flex items-center gap-4 p-4">
                  <div>
                    {passkey.deviceType === 'platform'
                      ? 'Device'
                      : 'Security Key'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Registered
                    {' '}
                    {formatDistanceToNow(new Date(passkey.createdAt))}
                    {' '}
                    ago
                  </div>
                  <Form method="POST">
                    <input type="hidden" name="passkeyId" value={passkey.id} />
                    <Button type="submit" variant="destructive" name="intent" value="delete" size="sm">
                      <Icon name="trash">Delete</Icon>
                    </Button>
                  </Form>
                </li>
              ))}
            </ul>
          )
        : (
            <div className="text-muted-foreground">
              No passkeys registered yet
            </div>
          )}

    </div>
  )
}
