# Multi-stage build for Smart Brokerage API
# NOTE: Build context should be the monorepo root
FROM node:20-alpine AS builder

# Install GraphicsMagick for PDF to image conversion
RUN apk add --no-cache graphicsmagick

# Set working directory to monorepo root
WORKDIR /app

# Copy root package.json and package-lock.json (for workspaces)
COPY package*.json ./

# Copy all package.json files for workspaces
COPY packages/api/package*.json ./packages/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/mobile/package*.json ./packages/mobile/

# Install ALL dependencies from root (handles workspaces correctly)
RUN npm install

# Copy source code (includes tsconfig.json in each package)
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared

# Build the shared package FIRST (API depends on it)
WORKDIR /app/packages/shared
RUN npm run build && ls -la dist/

# Generate Prisma client
WORKDIR /app/packages/api
RUN npx prisma generate

# Build the API application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install GraphicsMagick in production image
RUN apk add --no-cache graphicsmagick

# Verify GraphicsMagick installation
RUN gm version

WORKDIR /app/packages/api

# Copy built application and dependencies from builder
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package*.json ./
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist
COPY --from=builder /app/packages/shared/package.json /app/packages/shared/package.json

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/main.js"]

