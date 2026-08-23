# ── Etapa 1: compilar la app Angular ──────────────────────────
FROM node:24-alpine AS build
ARG APP_NAME
WORKDIR /workspace

RUN corepack enable

# Manifiestos primero: mejor cacheo de la capa de dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/console/package.json ./apps/console/
COPY apps/public-web/package.json ./apps/public-web/
COPY packages ./packages
COPY libs ./libs
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter "@mapit/${APP_NAME}" run build

# ── Etapa 2: servir con nginx ─────────────────────────────────
FROM nginx:alpine AS runtime
ARG APP_NAME
COPY --from=build /workspace/dist/${APP_NAME}/browser /usr/share/nginx/html
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf

# nginx:alpine ya trae el usuario `nginx`; el puerto 8080 no necesita root.
EXPOSE 8080
