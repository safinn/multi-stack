import type { Route } from './+types/settings'
import { invariantResponse } from '@epic-web/invariant'
import { useFetcher } from 'react-router'
import ArrowLink from '~/components/arrow-link'
import { Icon } from '~/components/ui/icon'
import { StatusButton } from '~/components/ui/status-button'
import { db } from '~/data/db'
import { PasswordRepository } from '~/data/repositories/password'
import { SessionRepository } from '~/data/repositories/session'
import { UserRepository } from '~/data/repositories/user'
import { VerificationRepository } from '~/data/repositories/verification'
import { requireUserInOrganization, sessionKey } from '~/utils/auth/auth.server'
import { twoFAVerificationType } from '~/utils/auth/login.server'
import { authSessionStorage } from '~/utils/auth/session.server'
import { useDoubleCheck } from '~/utils/misc'
import { redirectWithToast } from '~/utils/toast.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)

  const sessions = await new SessionRepository(db).sessionCount(user.id)
  const twoFactorVerification = await new VerificationRepository(db).fetchLatest(twoFAVerificationType, user.id)
  const password = await new PasswordRepository(db).findByUserId(user.id)

  return {
    user,
    sessions,
    hasPassword: Boolean(password),
    isTwoFactorEnabled: Boolean(twoFactorVerification),
  }
}

interface ProfileActionArgs {
  request: Request
  userId: string
  formData: FormData
}

const signOutOfSessionsActionIntent = 'sign-out-of-sessions'
const deleteDataActionIntent = 'delete-data'

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case signOutOfSessionsActionIntent: {
      return signOutOfSessionsAction({ request, userId: user.id, formData })
    }
    case deleteDataActionIntent: {
      return deleteDataAction({ request, userId: user.id, formData })
    }
    default: {
      throw new Response(`Invalid intent "${intent}"`, { status: 400 })
    }
  }
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-4">
      <ul>
        <li>
          <ArrowLink to="change-email">
            Change email from
            {' '}
            {loaderData.user.email}
          </ArrowLink>
        </li>
        <li>
          <ArrowLink to="two-factor">
            {loaderData.isTwoFactorEnabled ? '2FA is enabled' : 'Enable 2FA'}
          </ArrowLink>
        </li>
        <li>
          <ArrowLink to={loaderData.hasPassword ? 'password' : 'password/create'}>
            {loaderData.hasPassword ? 'Change password' : 'Create a password'}
          </ArrowLink>
        </li>
        <li>
          <ArrowLink to="connections">
            Manage connections
          </ArrowLink>
        </li>
        <li>
          <ArrowLink to="passkeys">
            Manage passkeys
          </ArrowLink>
        </li>
      </ul>

      <h3 className="font-mono text-sm">Organization</h3>

      <ul>
        <li>
          <ArrowLink to="org">
            General
          </ArrowLink>
        </li>
        <li>
          <ArrowLink to="org/members">
            Members
          </ArrowLink>
        </li>
      </ul>

      <SignOutOfSessions loaderData={loaderData} />
      <DeleteData />
    </div>
  )
}

async function signOutOfSessionsAction({ request, userId }: ProfileActionArgs) {
  const authSession = await authSessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const sessionId = authSession.get(sessionKey)
  invariantResponse(
    sessionId,
    'You must be authenticated to sign out of other sessions',
  )

  await new SessionRepository(db).deleteAllExceptCurrent(userId, sessionId)

  return { status: 'success' } as const
}

function SignOutOfSessions({
  loaderData,
}: {
  loaderData: Route.ComponentProps['loaderData']
}) {
  const dc = useDoubleCheck()

  const fetcher = useFetcher<typeof signOutOfSessionsAction>()
  const otherSessionsCount = Number(loaderData.sessions?.count) - 1

  return (
    <div>
      {otherSessionsCount
        ? (
            <fetcher.Form method="POST">
              <StatusButton
                {...dc.getButtonProps({
                  type: 'submit',
                  name: 'intent',
                  value: signOutOfSessionsActionIntent,
                })}
                variant={dc.doubleCheck ? 'destructive' : 'default'}
                status={
                  fetcher.state !== 'idle'
                    ? 'pending'
                    : (fetcher.data?.status ?? 'idle')
                }
              >
                <Icon name="avatar">
                  {dc.doubleCheck
                    ? `Are you sure?`
                    : `Sign out of ${otherSessionsCount} other session(s)`}
                </Icon>
              </StatusButton>
            </fetcher.Form>
          )
        : (
            <Icon name="avatar">This is your only session</Icon>
          )}
    </div>
  )
}

async function deleteDataAction({ userId }: ProfileActionArgs) {
  await new UserRepository(db).delete(userId)

  return redirectWithToast('/', {
    type: 'success',
    title: 'Data Deleted',
    description: 'All of your data has been deleted',
  })
}

function DeleteData() {
  const dc = useDoubleCheck()
  const fetcher = useFetcher<typeof deleteDataAction>()

  return (
    <div>
      <fetcher.Form method="POST">
        <StatusButton
          {...dc.getButtonProps({
            type: 'submit',
            name: 'intent',
            value: deleteDataActionIntent,
          })}
          variant={dc.doubleCheck ? 'destructive' : 'default'}
          status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
        >
          <Icon name="trash">
            {dc.doubleCheck ? `Are you sure?` : `Delete all your data`}
          </Icon>
        </StatusButton>
      </fetcher.Form>
    </div>
  )
}
