import type { Route } from './+types/healthcheck'
import { repositoryFactory } from '~/data/factory'
import { log } from '~/utils/logger.server'

export async function loader({ request }: Route.LoaderArgs) {
  const host = request.headers.get('X-Forwarded-Host') ?? request.headers.get('host')

  try {
    await Promise.all([
      repositoryFactory.getUserRepository().countAll().then((r) => {
        if (r === undefined)
          return Promise.reject(new Error('user count is undefined'))
      }),
      fetch(`${new URL(request.url).protocol}${host}`, {
        method: 'HEAD',
        headers: { 'X-Healthcheck': 'true' },
      }).then((r) => {
        if (!r.ok)
          return Promise.reject(r)
      }),
    ])

    return new Response('OK')
  }
  catch (error) {
    log.error(error, 'healthcheck error')
    return new Response('ERROR', { status: 500 })
  }
}
