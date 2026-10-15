# PR媒体管理系统 - 多阶段构建
# 构建：docker compose build / 部署见 README

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ---------- 依赖安装 ----------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- 构建 ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 生成 Prisma Client（如构建机网络受限，可参考 README「构建机网络问题」小节）
RUN npx prisma generate
RUN npm run build

# ---------- 运行 ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# standalone 产物 + 静态资源
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# 保留 Prisma CLI 与 seed 所需的开发依赖，便于容器内执行首次迁移和初始化
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# 保留 prisma 目录（含 schema），以便容器内执行 migrate deploy
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
