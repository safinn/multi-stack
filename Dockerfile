ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-alpine AS build
ARG PNPM_VERSION=10.8.0
RUN npm install -g pnpm@$PNPM_VERSION

# installs all dependencies, including devDependencies
FROM build AS development-dependencies-env
COPY ./package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm i --frozen-lockfile

# installs only production dependencies
# sets NODE_ENV to production
FROM build AS production-dependencies-env
ENV NODE_ENV=production
COPY ./package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod=true

# copy everything in the root directory
# copy node_modules including development dependencies
# build the app
FROM build AS build-env

ARG COMMIT_SHA
ENV COMMIT_SHA=$COMMIT_SHA

COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app

# Use the following environment variables to configure Sentry
# ENV SENTRY_ORG=
# ENV SENTRY_PROJECT=

# Mount the secret and set it as an environment variable and run the build
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
  export SENTRY_AUTH_TOKEN=$(cat /run/secrets/SENTRY_AUTH_TOKEN) && \
  pnpm run build

# copy the package.json, pnpm-lock.yaml and server.js files
# copy the production node_module dependencies
# copy the build directory
# set NODE_ENV to production
# run the start command
FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
COPY ./package.json pnpm-lock.yaml server.js /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY migrations /app/migrations
WORKDIR /app
ENTRYPOINT ["npm", "run"]
CMD ["start"]
