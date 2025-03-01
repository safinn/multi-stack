import type { Route } from './+types/logout'
import { href, redirect } from 'react-router'
import { logout } from '~/utils/auth/auth.server'

export async function loader() {
  return redirect(href('/'))
}

export function action({ request }: Route.ActionArgs) {
  return logout({ request })
}
