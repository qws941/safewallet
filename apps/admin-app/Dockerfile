# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3002
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy package files
COPY package*.json ./
COPY apps/admin-app/package*.json ./apps/admin-app/
COPY packages/ui/package*.json ./packages/ui/
COPY packages/types/package*.json ./packages/types/

# Install dependencies
RUN npm ci

# Copy source files
COPY apps/admin-app ./apps/admin-app
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
COPY tsconfig.json ./

# Build packages first
RUN npm run build --workspace=packages/types --if-present
RUN npm run build --workspace=packages/ui --if-present

# Build app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=apps/admin-app

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/apps/admin-app/.next/standalone ./
COPY --from=builder /app/apps/admin-app/.next/static ./apps/admin-app/.next/static

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/admin-app/server.js"]
