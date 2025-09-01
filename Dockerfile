# InstaCares Next.js Dockerfile
# Multi-stage build for optimal production image

# Base image with Node.js
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci --omit=dev; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
ENV SKIP_ENV_VALIDATION=true
RUN npm run build:prod

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./server.js

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create directories for uploads and logs
RUN mkdir -p public/uploads logs
RUN chown -R nextjs:nodejs public/uploads logs

# Install PM2 globally for process management
RUN npm install pm2 -g

# Copy PM2 configuration
COPY --from=builder /app/ecosystem.config.js ./

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Create healthcheck script
RUN echo 'const http = require("http"); \
const options = { \
  hostname: "localhost", \
  port: 3000, \
  path: "/api/health", \
  method: "GET", \
  timeout: 2000 \
}; \
const req = http.request(options, (res) => { \
  if (res.statusCode === 200) { \
    process.exit(0); \
  } else { \
    process.exit(1); \
  } \
}); \
req.on("error", () => process.exit(1)); \
req.on("timeout", () => process.exit(1)); \
req.end();' > healthcheck.js

CMD ["node", "server.js"]