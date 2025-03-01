import { Form } from 'react-router'
import { z } from 'zod'
import { Icon } from '~/components/ui/icon.js'
import { StatusButton } from '~/components/ui/status-button'
import { useIsPending } from './misc'

export const GOOGLE_PROVIDER_NAME = 'google'
// to add another provider, set their name here and add it to the providerNames below

export const providerNames = [GOOGLE_PROVIDER_NAME] as const
export const ProviderNameSchema = z.enum(providerNames)
export type ProviderName = z.infer<typeof ProviderNameSchema>

export const providerLabels: Record<ProviderName, string> = {
  [GOOGLE_PROVIDER_NAME]: 'Google',
} as const

export const providerIcons: Record<ProviderName, React.ReactNode> = {
  [GOOGLE_PROVIDER_NAME]: <Icon name="google-logo" />,
} as const

export function ProviderConnectionForm({
  redirectTo,
  invitationId,
  type,
  providerName,
}: {
  redirectTo?: string | null
  invitationId?: string | null
  type: 'Connect' | 'Login' | 'Signup'
  providerName: ProviderName
}) {
  const label = providerLabels[providerName]
  const formAction = `/auth/${providerName}`
  const isPending = useIsPending({ formAction })

  return (
    <Form
      action={formAction}
      method="POST"
    >
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
      <StatusButton
        type="submit"
        className="w-full"
        status={isPending ? 'pending' : 'idle'}
      >
        <span className="inline-flex items-center gap-1.5">
          {providerIcons[providerName]}
          <span>
            {type}
            {' '}
            with
            {' '}
            {label}
          </span>
        </span>
      </StatusButton>
    </Form>
  )
}
