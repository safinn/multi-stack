import type { Route } from './+types/two-factor-disable'
import { useFetcher } from 'react-router'
import { StatusButton } from '~/components/ui/status-button'
import { repositoryFactory } from '~/data/factory'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { requireRecentVerification } from '~/utils/auth/verify.server'
import { useDoubleCheck } from '~/utils/misc'
import { redirectWithToast } from '~/utils/toast.server'
import { twoFAVerificationType } from './two-factor'

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRecentVerification(request)
  const { user } = await requireUserInOrganization(request, params.organizationId)

  return { user }
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRecentVerification(request)
  const { user } = await requireUserInOrganization(request, params.organizationId)

  await repositoryFactory.getVerificationRepository().delete(twoFAVerificationType, user.id)

  const redirectTo = ['/app', params.organizationId, 'settings', 'two-factor']
    .filter(Boolean)
    .join('/')
  return redirectWithToast(redirectTo, {
    title: '2FA Disabled',
    description: 'Two factor authentication has been disabled.',
  })
}

export const handle = {
  breadcrumb: 'Disable Two Factor Authentication',
}

export default function TwoFactorDisableRoute() {
  const disable2FAFetcher = useFetcher<typeof action>()
  const dc = useDoubleCheck()

  return (
    <>
      <disable2FAFetcher.Form method="POST" className="space-y-4">
        <p className="max-w-lg text-sm">
          Disabling two factor authentication is not recommended. However, if
          you would like to do so, click here:
        </p>
        <StatusButton
          variant="destructive"
          status={disable2FAFetcher.state === 'loading' ? 'pending' : 'idle'}
          {...dc.getButtonProps({
            name: 'intent',
            value: 'disable',
            type: 'submit',
          })}
        >
          {dc.doubleCheck ? 'Are you sure?' : 'Disable 2FA'}
        </StatusButton>
      </disable2FAFetcher.Form>
    </>
  )
}
