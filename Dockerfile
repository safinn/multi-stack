ARG NODE_VERSION=22.12.0
FROM node:${NODE_VERSION}-alpine AS build
ARG PNPM_VERSION=9.15.4
RUN npm install -g pnpm@$PNPM_VERSION

FROM build AS development-dependencies-env
COPY ./package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm i --frozen-lockfile

FROM build AS production-dependencies-env
ENV NODE_ENV=production
COPY ./package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod=true

FROM build AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm run build

FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
COPY ./package.json pnpm-lock.yaml server.js /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
CMD ["npm", "run", "start"]
