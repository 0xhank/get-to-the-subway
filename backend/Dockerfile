# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

# Copy workspace config and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY shared/src shared/src
COPY shared/tsconfig.json shared/
COPY backend/src backend/src
COPY backend/tsconfig.json backend/
COPY backend/data backend/data

# Build shared first, then backend
RUN pnpm --filter @live-subway/shared build
RUN pnpm --filter @live-subway/backend build

# Production stage
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

# Copy workspace config and package files for production install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/backend/data backend/data

WORKDIR /app/backend

# Environment variables (set defaults, override in Railway)
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
