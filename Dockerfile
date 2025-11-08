# Use Node.js LTS with Debian (better for native modules)
FROM node:20-bookworm-slim

# Install system dependencies for canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/mobile/package*.json ./packages/mobile/

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY . .

# Build shared package
RUN npm run build:shared

# Generate Prisma client
RUN npm run prisma:generate

# Build API
WORKDIR /app/packages/api
RUN npm run build

# Set back to root
WORKDIR /app

# Expose port
EXPOSE 3000

# Start the API server
CMD ["npm", "run", "start:prod", "--workspace=@smart-brokerage/api"]

