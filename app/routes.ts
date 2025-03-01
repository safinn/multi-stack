import type { RouteConfig } from '@react-router/dev/routes'
import { index, layout, prefix, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),

  layout('routes/layouts/app.tsx', [
    ...prefix('app', [

      // All app routes should go below an organization prefix
      ...prefix(':organizationId?', [

        index('routes/app/app.tsx'),

        route('settings', 'routes/app/settings-profile.tsx', [
          index('routes/app/settings.tsx'),
          route('change-email', 'routes/app/change-email.tsx'),
          route('connections', 'routes/app/connections.tsx'),
          route('passkeys', 'routes/app/passkeys.tsx'),
          route('password', 'routes/app/password.tsx'),
          route('password/create', 'routes/app/password-create.tsx'),
          route('two-factor', 'routes/app/two-factor.tsx'),
          route('two-factor/disable', 'routes/app/two-factor-disable.tsx'),
          route('two-factor/verify', 'routes/app/two-factor-verify.tsx'),
          route('org/members', 'routes/app/org-members.tsx'),
          route('org/new', 'routes/app/org-new.tsx'),
          route('org', 'routes/app/org.tsx'),
        ]),

      ]),

    ]),

    // auth
    route('login', 'routes/auth/login.tsx'),
    route('logout', 'routes/auth/logout.tsx'),
    route('signup', 'routes/auth/signup.tsx'),
    route('forgot-password', 'routes/auth/forgot-password.tsx'),
    route('reset-password', 'routes/auth/reset-password.tsx'),
    route('onboarding', 'routes/auth/onboarding.tsx'),
    route('onboarding/:provider', 'routes/auth/onboarding-provider.tsx'),
    route('verify', 'routes/auth/verify.tsx'),
    route('auth/:provider', 'routes/auth/provider.ts'),
    route('auth/:provider/callback', 'routes/auth/provider-callback.tsx'),
    route('webauthn/registration', 'routes/auth/webauthn/registration.ts'),
    route('webauthn/authentication', 'routes/auth/webauthn/authentication.ts'),
  ]),

  // resources
  ...prefix('resources', [
    route('theme-switch', 'routes/resources/theme-switch.tsx'),
  ]),

  route('*', 'routes/catch-all.tsx'),

] satisfies RouteConfig
