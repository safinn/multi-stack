# multi-stack

A modern template for building full-stack React applications using React Router.

Heavily inspired and built on the foundations of the excellent [epic-stack](https://github.com/epicweb-dev/epic-stack/) (probably should have been a fork) but with a modified email approach, database tools and multi-tenant support so users can be part of multiple teams/workspaces/organizations.

## Features

- First class multi-tenant support
- Server-side rendering
- Kysely for SQL database interaction (postgreSQL)
- Email/Password, OAuth2 and Passkey authentication with cookie-based sessions
- Role based access permissions
- Transactional email abstraction for use with any provider
- Typesafe forms with Conform
- Styling with Tailwind v4
- Linting and formatting with ESLint
- Static types with Typescript
- shadcn/ui component library
- Runtime schema validation with Zod

## Getting Started

#### Install the dependencies:

```bash
pnpm install
```

#### Setup environment variables

Set environment variables in a `.env` file. See [.env.example](.env.example).

#### Apply the migrations:

```bash
pnpm migrate:latest
```

### Development

Start the development server with HMR:

```bash
pnpm dev
```

Your application will be available at `http://localhost:3000`.

## Building for Production

Create a production build:

```bash
pnpm build
```
