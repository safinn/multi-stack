import type { Route } from './+types/settings-profile'
import { Link, Outlet, useMatches } from 'react-router'
import { z } from 'zod'
import { Icon } from '~/components/ui/icon'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { cn } from '~/utils/misc'

export const BreadcrumbHandleSchema = z.object({ breadcrumb: z.any() })
export type BreadcrumbHandle = z.infer<typeof BreadcrumbHandleSchema>

const BreadcrumbHandleMatch = z.object({
  handle: BreadcrumbHandleSchema,
})

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserInOrganization(request, params.organizationId)
  return null
}

export default function SettingsProfile({ params }: Route.ComponentProps) {
  const matches = useMatches()
  const breadcrumbs = matches
    .map((m) => {
      const result = BreadcrumbHandleMatch.safeParse(m)
      if (!result.success || !result.data.handle.breadcrumb)
        return null
      return ({
        id: m.id,
        el: (
          <Link key={m.id} to={m.pathname} className="flex items-center">
            {result.data.handle.breadcrumb}
          </Link>
        ),
      }
      )
    })
    .filter(m => m != null)

  return (
    <div className="space-y-4">

      <ul className="flex font-mono text-sm gap-1.5">
        <li>
          <Link
            className={cn({ 'text-muted-foreground': breadcrumbs.length })}
            to={['/app', params.organizationId, 'settings'].filter(Boolean).join('/')}
          >
            Settings
          </Link>
        </li>
        {breadcrumbs.map(breadcrumb => (
          <li key={breadcrumb.id}>
            <Icon name="chevron-right">
              {breadcrumb.el}
            </Icon>
          </li>
        ))}
      </ul>

      <div>
        <Outlet />
      </div>
    </div>
  )
}
