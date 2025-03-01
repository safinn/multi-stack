import type { Info, Route } from './+types/connections'
import type { ProviderName } from '~/utils/connections'
import { invariantResponse } from '@epic-web/invariant'
import { useState } from 'react'
import { data, useFetcher } from 'react-router'
import { Icon } from '~/components/ui/icon'
import { StatusButton } from '~/components/ui/status-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { db } from '~/data/db'
import { ConnectionRepository } from '~/data/repositories/connection'
import { PasswordRepository } from '~/data/repositories/password'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { ProviderConnectionForm, providerIcons, providerNames, ProviderNameSchema } from '~/utils/connections'
import { resolveConnectionData } from '~/utils/connections.server'
import { createToastHeaders } from '~/utils/toast.server'

async function userCanDeleteConnections(userId: string) {
  const [password, connections] = await Promise.all([
    new PasswordRepository(db).findByUserId(userId),
    new ConnectionRepository(db).countByUserId(userId),
  ])

  // user can delete their connections if they have a password
  if (password)
    return true

  // users have to have more than one remaining connection to delete one
  return Boolean(connections && connections > 1)
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const rawConnections = await new ConnectionRepository(db).findByUserId(user.id)
  const connections: Array<{
    providerName: ProviderName
    id: string
    displayName: string
    link?: string | null
    createdAtFormatted: string
  }> = []
  for (const connection of rawConnections) {
    const r = ProviderNameSchema.safeParse(connection.providerName)
    if (!r.success)
      continue
    const providerName = r.data
    const connectionData = await resolveConnectionData(
      providerName,
      connection.providerId,
    )
    connections.push({
      ...connectionData,
      providerName,
      id: connection.id,
      createdAtFormatted: connection.createdAt.toLocaleString(),
    })
  }

  return data({
    user,
    connections,
    canDeleteConnections: await userCanDeleteConnections(user.id),
  })
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const formData = await request.formData()
  invariantResponse(
    formData.get('intent') === 'delete-connection',
    'Invalid intent',
  )
  invariantResponse(
    await userCanDeleteConnections(user.id),
    'You cannot delete your last connection unless you have a password.',
  )
  const connectionId = formData.get('connectionId')
  invariantResponse(typeof connectionId === 'string', 'Invalid connectionId')

  await new ConnectionRepository(db).delete(connectionId, user.id)

  const toastHeaders = await createToastHeaders({
    title: 'Deleted',
    description: 'Your connection has been deleted.',
  })
  return data({ status: 'success' } as const, { headers: toastHeaders })
}

export const handle = {
  breadcrumb: 'Connections',
}

export default function Connections({ loaderData, params }: Route.ComponentProps) {
  return (
    <div className="space-y-4">
      {loaderData.connections.length
        ? (
            <>
              <p>Here are your current connections:</p>
              <ul className="space-y-2">
                {loaderData.connections.map(c => (
                  <li key={c.id}>
                    <Connection
                      connection={c}
                      canDelete={loaderData.canDeleteConnections}
                    />
                  </li>
                ))}
              </ul>
            </>
          )
        : (
            <p>You don't have any connections yet.</p>
          )}

      <div className="max-w-64">
        {providerNames.map(providerName => (
          <ProviderConnectionForm
            key={providerName}
            type="Connect"
            providerName={providerName}
            redirectTo={['/app', params.organizationId, 'settings', 'connections'].filter(Boolean).join('/')}
          />
        ))}
      </div>
    </div>
  )
}

function Connection({
  connection,
  canDelete,
}: {
  connection: Info['loaderData']['connections'][number]
  canDelete: boolean
}) {
  const deleteFetcher = useFetcher<typeof action>()
  const [infoOpen, setInfoOpen] = useState(false)
  const icon = providerIcons[connection.providerName]
  return (
    <div className="flex justify-between gap-2 max-w-lg">
      <span className="inline-flex items-center gap-1.5">
        {icon}
        <span>
          {connection.link
            ? (
                <a href={connection.link} className="underline">
                  {connection.displayName}
                </a>
              )
            : (
                connection.displayName
              )}
          {' '}
          (
          {connection.createdAtFormatted}
          )
        </span>
      </span>
      {canDelete
        ? (
            <deleteFetcher.Form method="POST">
              <input name="connectionId" value={connection.id} type="hidden" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <StatusButton
                      name="intent"
                      value="delete-connection"
                      variant="destructive"
                      size="icon"
                      status={
                        deleteFetcher.state !== 'idle'
                          ? 'pending'
                          : (deleteFetcher.data?.status ?? 'idle')
                      }
                    >
                      <Icon name="cross" />
                    </StatusButton>
                  </TooltipTrigger>
                  <TooltipContent>Disconnect this account</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </deleteFetcher.Form>
          )
        : (
            <TooltipProvider>
              <Tooltip open={infoOpen} onOpenChange={setInfoOpen}>
                <TooltipTrigger onClick={() => setInfoOpen(true)}>
                  <Icon name="question-mark-circled"></Icon>
                </TooltipTrigger>
                <TooltipContent>
                  You cannot delete your last connection unless you have a password.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
    </div>
  )
}
