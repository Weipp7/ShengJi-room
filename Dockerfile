# ---- 构建层：安装全部依赖并构建 web 静态产物 + server bundle ----
# 注意：pnpm 11 依赖 Node 22 内置模块，基础镜像不低于 node:22
FROM node:22-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# 先复制清单文件，利用 Docker 层缓存加速依赖安装
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/game/package.json packages/game/
COPY packages/bot/package.json packages/bot/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- 运行层：仅生产依赖 + 构建产物 ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/game/package.json packages/game/
COPY packages/bot/package.json packages/bot/
RUN pnpm install --prod --frozen-lockfile

# server 为 esbuild 单文件 bundle（workspace 包已打入），web 为 vite 静态产物
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
