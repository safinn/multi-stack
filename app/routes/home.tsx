import type { loader as rootLoader } from '~/root'
import { Form, useRouteLoaderData } from 'react-router'
import ArrowLink from '~/components/arrow-link'
import { Button } from '~/components/ui/button'
import { ThemeSwitch } from './resources/theme-switch'

export function meta() {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ]
}

export default function Home() {
  const rootData = useRouteLoaderData<typeof rootLoader>('root')

  return (
    <main className="pt-16 p-4 container mx-auto space-y-8">

      <header className="flex gap-6">
        <h1 className="font-mono font-bold">multi-stack</h1>
        <nav className="-mt-1 flex gap-1.5">
          <ThemeSwitch userPreference={rootData?.requestInfo.userPrefs.theme} />
          {rootData?.user && (
            <Form method="POST" action="/logout">
              <Button variant="outline" size="sm">Logout</Button>
            </Form>
          )}
        </nav>
      </header>

      {/* no user */}
      {!rootData?.user
        && (
          <ul>
            <li>
              <ArrowLink to="/login">Log in</ArrowLink>
            </li>
            <li>
              <ArrowLink to="/signup">Sign up</ArrowLink>
            </li>
          </ul>
        )}

      {rootData?.user
        && (
          <ul>
            <li>
              <ArrowLink to="/app">Dashboard</ArrowLink>
            </li>
          </ul>
        )}

      <ul className="list-disc space-y-3">
        <li>
          First class organistaion/team support
        </li>
        <li>
          Sever rendered
          {' '}
          <LinkHref href="https://reactrouter.com">React Router</LinkHref>
          {' '}
          application
        </li>
        <li>
          <LinkHref href="https://kysely.dev">Kysely</LinkHref>
          {' '}
          for SQL database interaction
        </li>
        <li>
          Email/Password,
          {' '}
          <LinkHref href="https://github.com/sergiodxa/remix-auth">Remix Auth</LinkHref>
          {' '}
          {' '}
          (OAuth2, OIDC) and
          {' '}
          <LinkHref href="https://simplewebauthn.dev/">WebAuthn</LinkHref>
          {' '}
          authentication with
          {' '}
          <LinkHref href="https://reactrouter.com/explanation/sessions-and-cookies">cookie-based sessions</LinkHref>
        </li>
        <li>
          Role-based user permissions
        </li>
        <li>
          Transactional email abstraction for use with any provider
        </li>
        <li>
          Progressively Enhanced and fully type safe forms with
          {' '}
          <LinkHref href="https://conform.guide">Conform</LinkHref>
        </li>
        <li>
          Styling with
          {' '}
          <LinkHref href="https://tailwindcss.com">Tailwind</LinkHref>
        </li>
        <li>
          Linting and formatting with
          {' '}
          <LinkHref href="https://github.com/antfu/eslint-config">ESLint</LinkHref>
        </li>
        <li>
          Static Types with
          {' '}
          <LinkHref href="https://www.typescriptlang.org/">TypeScript</LinkHref>
        </li>
        <li>
          Runtime schema validation with
          {' '}
          <LinkHref href="https://zod.dev/">zod</LinkHref>
        </li>
      </ul>

    </main>
  )
}

function LinkHref({ href, children }: { href: string, children: React.ReactNode }) {
  return (
    <a href={href} className="hover:underline text-sky-500">
      {children}
    </a>
  )
}
