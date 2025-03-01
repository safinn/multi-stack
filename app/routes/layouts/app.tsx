import type { loader as rootLoader } from '~/root'
import { Form, Link, Outlet, useRouteLoaderData } from 'react-router'
import TeamSelector from '~/components/team-selector'
import { Button } from '~/components/ui/button'
import { ThemeSwitch } from '../resources/theme-switch'

export default function App() {
  const rootData = useRouteLoaderData<typeof rootLoader>('root')

  return (
    <div className="pt-16 p-4 container mx-auto space-y-4">
      <header className="flex gap-6">
        <Link to={rootData?.user ? '/app' : '/'}>
          <h1 className="font-mono font-bold">multi-stack</h1>
        </Link>
        <nav className="-mt-1 flex gap-1.5">
          {rootData?.user && <TeamSelector />}
          <ThemeSwitch userPreference={rootData?.requestInfo.userPrefs.theme} />
          {rootData?.user && (
            <Form method="POST" action="/logout">
              <Button variant="outline" size="sm">Logout</Button>
            </Form>
          )}
        </nav>
      </header>

      <Outlet />
    </div>
  )
}
