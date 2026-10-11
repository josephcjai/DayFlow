# ==============================================================================
# DayFlow Production Dockerfile (Multi-Stage Build)
# ==============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and build TypeScript
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies for production runtime
RUN npm prune --production

# ==============================================================================
# Stage 2: Minimal Production Runtime
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Run as non-root user for container security
USER node

# Copy production node_modules and built artifacts
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
