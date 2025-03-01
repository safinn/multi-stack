import type { Route } from './+types/app'
import ArrowLink from '~/components/arrow-link'
import { requireUserInOrganization } from '~/utils/auth/auth.server'

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, organization: organiastion } = await requireUserInOrganization(request, params.organizationId)
  return { user, organiastion }
}

export default function App({ loaderData: { user } }: Route.ComponentProps) {
  return (
    <div className="space-y-4">
      <p>
        Welcome,
        {' '}
        {user.username}
        !
      </p>

      <ul>
        <li>
          <ArrowLink to="settings">Settings</ArrowLink>
        </li>
      </ul>
    </div>
  )
}
