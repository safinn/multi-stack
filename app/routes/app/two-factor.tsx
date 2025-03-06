import type { VerificationTypes } from '../auth/verify'
import type { Route } from './+types/two-factor'
import { generateTOTP } from '@epic-web/totp'
import { Link, redirect, useFetcher } from 'react-router'
import { uuidv7 } from 'uuidv7'
import { Icon } from '~/components/ui/icon'
import { StatusButton } from '~/components/ui/status-button'
import { repositoryFactory } from '~/data/factory'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { twoFAVerifyVerificationType } from '~/utils/auth/verify.server'

export const twoFAVerificationType = '2fa' satisfies VerificationTypes

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const verification = await repositoryFactory.getVerificationRepository().fetchLatest(twoFAVerificationType, user.id)
  return { is2FAEnabled: Boolean(verification), user }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const { otp: _otp, charSet, ...config } = await generateTOTP()
  const verificationData = {
    ...config,
    charset: charSet,
    type: twoFAVerifyVerificationType,
    target: user.id,
  }

  await repositoryFactory.getVerificationRepository().upsert({
    ...verificationData,
    id: uuidv7(),
  })

  const redirectTo = ['/app', params.organizationId, 'settings', 'two-factor', 'verify']
    .filter(Boolean)
    .join('/')

  return redirect(redirectTo)
}

export const handle = {
  breadcrumb: 'Two Factor Authentication',
}

export default function TwoFactor({ loaderData }: Route.ComponentProps) {
  const enable2FAFetcher = useFetcher<typeof action>()

  return (
    <div className="space-y-4">
      {loaderData.is2FAEnabled
        ? (
            <>
              <p className="max-w-lg text-sm">
                <Icon name="check">
                  You have enabled two-factor authentication.
                </Icon>
              </p>
              <Link to="disable">
                <Icon name="lock-open">Disable 2FA</Icon>
              </Link>
            </>
          )
        : (
            <>
              <p className="text-sm max-w-lg">
                Two factor authentication adds an extra layer of security to your
                account. You will need to enter a code from an authenticator app
                to log in.
              </p>
              <enable2FAFetcher.Form method="POST">
                <StatusButton
                  type="submit"
                  name="intent"
                  value="enable"
                  status={enable2FAFetcher.state === 'loading' ? 'pending' : 'idle'}
                >
                  Enable 2FA
                </StatusButton>
              </enable2FAFetcher.Form>
            </>
          )}
    </div>
  )
}
