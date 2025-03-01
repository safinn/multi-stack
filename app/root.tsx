import type { Route } from './+types/root'
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from 'react-router'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import stylesheet from './app.css?url'
import ArrowLink from './components/arrow-link'
import { useToast } from './components/toast'
import { href as iconsHref } from './components/ui/icon'
import { Toaster } from './components/ui/sonner'
import { useTheme } from './routes/resources/theme-switch'
import { getUserMemberships, getUserOrganizationMembership } from './utils/auth/auth.server'
import { ClientHintCheck, getHints } from './utils/client-hints'
import { honeypot } from './utils/honeypot.server'
import { getDomainUrl } from './utils/misc'
import { useNonce } from './utils/NonceProvider'
import { getTheme } from './utils/theme.server'
import { getToast } from './utils/toast.server'

export const links: Route.LinksFunction = () => [
  // Preload svg sprite as a resource to avoid render blocking
  { rel: 'preload', href: iconsHref, as: 'image' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
  { rel: 'stylesheet', href: stylesheet },
]

export async function loader({ request, params }: Route.LoaderArgs) {
  const { toast, headers: toastHeaders } = await getToast(request)
  const honeypotInputProps = await honeypot.getInputProps()
  const membership = await getUserOrganizationMembership(request, params.organizationId)
  const memberships = await getUserMemberships(membership?.user?.id)

  return data({
    user: membership?.user,
    organization: membership?.organization,
    memberships,
    requestInfo: {
      hints: getHints(request),
      origin: getDomainUrl(request),
      path: new URL(request.url).pathname,
      userPrefs: {
        theme: getTheme(request),
      },
    },
    toast,
    honeypotInputProps,
  }, {
    headers: toastHeaders, // may need to set header func
  })
}

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce()
  const theme = useTheme()

  return (
    <html lang="en" className={`${theme}`}>
      <head>
        <ClientHintCheck nonce={nonce} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        <Toaster />
      </body>
    </html>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  useToast(loaderData.toast)

  return (
    <HoneypotProvider {...loaderData.honeypotInputProps}>
      <Outlet />
    </HoneypotProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined
  const location = useLocation()

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details
      = error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details
  }
  else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
      {message === '404' && (
        <pre className="p-4 my-4 bg-muted text-sm w-full overflow-x-auto">
          <code>{location.pathname}</code>
        </pre>
      )}

      <ArrowLink to="/" direction="left">Back to home</ArrowLink>
    </main>
  )
}
