# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/
COPY packages/types/package*.json ./packages/types/

# Install dependencies
RUN npm ci --workspace=apps/api --workspace=packages/database --workspace=packages/types

# Copy source files
COPY apps/api ./apps/api
COPY packages/database ./packages/database
COPY packages/types ./packages/types
COPY tsconfig.json ./

# Generate Prisma client
RUN npm run db:generate

# Build
RUN npm run build --workspace=apps/api

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nestjs

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/
COPY packages/types/package*.json ./packages/types/

# Install production dependencies only
RUN npm ci --workspace=apps/api --workspace=packages/database --workspace=packages/types --omit=dev

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nestjs

EXPOSE 3002

CMD ["node", "apps/api/dist/main.js"]
