import type { loader as rootLoader } from '~/root'
import { Link, useLocation, useNavigate, useRouteLoaderData } from 'react-router'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Icon } from './ui/icon'

export default function TeamSelector() {
  const navigate = useNavigate()
  const location = useLocation()
  const rootData = useRouteLoaderData<typeof rootLoader>('root')

  const currentPathOrgShortId = rootData?.memberships?.find(mem => location.pathname.split('/')[2] === mem.organization?.shortId)?.organization?.shortId
  const currentOrg = rootData?.organization

  function handleSelectTeam(orgShortId?: string) {
    if (!orgShortId)
      return

    const pathAfterAppAndOrg = location.pathname.split('/').slice(currentPathOrgShortId ? 3 : 2).join('/')
    navigate(`/app/${orgShortId}${pathAfterAppAndOrg ? `/${pathAfterAppAndOrg}` : ''}`)
  }

  function onCloseAutoFocus(event: Event) {
    event.preventDefault()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="w-52 justify-between">
        <Button size="sm" variant="outline">
          {currentOrg?.name}
          <Icon name="chevron-down" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" onCloseAutoFocus={onCloseAutoFocus}>
        {rootData?.memberships
          ?.filter(mem => mem.organization?.id !== rootData.organization?.id)
          .map(mem => (
            <DropdownMenuItem key={mem.id} onClick={() => handleSelectTeam(mem.organization?.shortId)}>
              {mem.organization?.name}
            </DropdownMenuItem>
          ))}
        {rootData?.memberships
          ?.filter(mem => mem.organization?.id !== rootData.organization?.id)
          .length
          ? <DropdownMenuSeparator />
          : null}
        <Link to={`/app${currentPathOrgShortId ? `/${currentPathOrgShortId}` : ''}/settings/org/new`}>
          <DropdownMenuItem className="gap-2">
            <Icon name="add" />
            Create Organization
          </DropdownMenuItem>
        </Link>

      </DropdownMenuContent>
    </DropdownMenu>
  )
}
