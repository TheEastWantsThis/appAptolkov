FROM node:24.20.0-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack install --global pnpm@11.19.0
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared
COPY prisma prisma
COPY prisma.config.ts prisma.config.ts
RUN pnpm db:generate && pnpm --filter @watchroom/shared build && pnpm --filter @watchroom/api build

FROM node:24.20.0-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /workspace

COPY --from=build --chown=node:node /workspace/node_modules node_modules
COPY --from=build --chown=node:node /workspace/apps/api/node_modules apps/api/node_modules
COPY --from=build --chown=node:node /workspace/apps/api/package.json apps/api/package.json
COPY --from=build --chown=node:node /workspace/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /workspace/packages/shared packages/shared
COPY --from=build --chown=node:node /workspace/prisma prisma
COPY --from=build --chown=node:node /workspace/prisma.config.ts prisma.config.ts

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --output-document=- "http://127.0.0.1:${API_PORT:-4000}/health/live" || exit 1
CMD ["node", "apps/api/dist/index.js"]
