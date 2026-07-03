# ─────────────────────────────────────────────────────────────────────────────
# Recurrsive API Server — Multi-stage Dockerfile
#
# Stage 1 (builder): Install dependencies, build all packages via Turbo
# Stage 2 (runner):  Slim production image with only dist + prod modules
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install build dependencies (some native modules need python3/make/g++)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy workspace config files first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Copy all package.json files to leverage Docker cache for dependencies
COPY packages/core/package.json packages/core/package.json
COPY packages/graph/package.json packages/graph/package.json
COPY packages/collectors/package.json packages/collectors/package.json
COPY packages/parsers/package.json packages/parsers/package.json
COPY packages/analyzers/package.json packages/analyzers/package.json
COPY packages/reasoning/package.json packages/reasoning/package.json
COPY packages/opportunities/package.json packages/opportunities/package.json
COPY packages/policy/package.json packages/policy/package.json
COPY packages/presentation/package.json packages/presentation/package.json
COPY apps/server/package.json apps/server/package.json

# Install all dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY packages/ packages/
COPY apps/server/ apps/server/

# Build all packages using Turbo (respects dependency order)
RUN pnpm exec turbo build --filter=@recurrsive/server...

# Prune dev dependencies for production
RUN pnpm prune --prod --no-optional

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install pnpm for workspace resolution at runtime
RUN corepack enable && corepack prepare pnpm@9 --activate

# Security: run as non-root
RUN addgroup --system --gid 1001 recurrsive && \
    adduser --system --uid 1001 recurrsive

WORKDIR /app

# Copy workspace config
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Copy built packages (dist directories + package.json for resolution)
COPY --from=builder /app/packages/core/package.json packages/core/package.json
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/graph/package.json packages/graph/package.json
COPY --from=builder /app/packages/graph/dist packages/graph/dist
COPY --from=builder /app/packages/collectors/package.json packages/collectors/package.json
COPY --from=builder /app/packages/collectors/dist packages/collectors/dist
COPY --from=builder /app/packages/parsers/package.json packages/parsers/package.json
COPY --from=builder /app/packages/parsers/dist packages/parsers/dist
COPY --from=builder /app/packages/analyzers/package.json packages/analyzers/package.json
COPY --from=builder /app/packages/analyzers/dist packages/analyzers/dist
COPY --from=builder /app/packages/reasoning/package.json packages/reasoning/package.json
COPY --from=builder /app/packages/reasoning/dist packages/reasoning/dist
COPY --from=builder /app/packages/opportunities/package.json packages/opportunities/package.json
COPY --from=builder /app/packages/opportunities/dist packages/opportunities/dist
COPY --from=builder /app/packages/policy/package.json packages/policy/package.json
COPY --from=builder /app/packages/policy/dist packages/policy/dist
COPY --from=builder /app/packages/presentation/package.json packages/presentation/package.json
COPY --from=builder /app/packages/presentation/dist packages/presentation/dist
COPY --from=builder /app/apps/server/package.json apps/server/package.json
COPY --from=builder /app/apps/server/dist apps/server/dist

# Copy pruned production node_modules
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/core/node_modules packages/core/node_modules
COPY --from=builder /app/packages/graph/node_modules packages/graph/node_modules
COPY --from=builder /app/packages/collectors/node_modules packages/collectors/node_modules
COPY --from=builder /app/packages/parsers/node_modules packages/parsers/node_modules
COPY --from=builder /app/packages/analyzers/node_modules packages/analyzers/node_modules
COPY --from=builder /app/packages/reasoning/node_modules packages/reasoning/node_modules
COPY --from=builder /app/packages/opportunities/node_modules packages/opportunities/node_modules
COPY --from=builder /app/packages/policy/node_modules packages/policy/node_modules
COPY --from=builder /app/packages/presentation/node_modules packages/presentation/node_modules
COPY --from=builder /app/apps/server/node_modules apps/server/node_modules

# Set ownership to non-root user
RUN chown -R recurrsive:recurrsive /app

USER recurrsive

# Expose the default API port
EXPOSE 3000

# Health check against the liveness endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Start the API server
CMD ["node", "apps/server/dist/bin.js"]
