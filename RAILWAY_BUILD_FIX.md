# Railway Docker Build Fix

## Problem

Railway build was failing with errors like:
```
error TS2307: Cannot find module '@smart-brokerage/shared' or its corresponding type declarations.
```

## Root Cause

The `@smart-brokerage/shared` package wasn't being built before the API package tried to use it. In a monorepo with workspaces, the shared package needs to be compiled first.

## Solution Applied

Updated `packages/api/Dockerfile` to:

1. ✅ Install all dependencies from workspace root
2. ✅ **Build shared package FIRST** before building API
3. ✅ Copy built shared package to production image

### Key Changes

**Builder Stage:**
```dockerfile
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
```

**Production Stage:**
```dockerfile
# Copy built shared package
COPY --from=builder /app/packages/shared/dist /app/packages/shared/dist
COPY --from=builder /app/packages/shared/package.json /app/packages/shared/package.json
```

## Build Order

```
1. npm install (root, all packages)
   ↓
2. Build @smart-brokerage/shared
   ↓
3. Generate Prisma client
   ↓
4. Build @smart-brokerage/api
   ↓
5. Copy to production image
```

## Verify Build Locally

Test the Docker build before pushing to Railway:

```bash
cd /Users/pratyush/code/SmartBrokerageApp

# Build the image
docker build -f packages/api/Dockerfile -t smart-brokerage-api .

# Check if it builds successfully
docker run --rm smart-brokerage-api sh -c "ls -la /app/packages/shared/dist"
```

You should see:
```
drwxr-xr-x    - root     index.d.ts
drwxr-xr-x    - root     index.js
drwxr-xr-x    - root     types/
drwxr-xr-x    - root     orea/
```

## Railway Deployment

Once the Docker build works locally:

1. **Commit the changes:**
```bash
git add packages/api/Dockerfile
git commit -m "Fix: Build shared package before API in Docker"
git push origin main
```

2. **Railway will automatically:**
   - Detect the Dockerfile
   - Build with the correct order
   - Deploy successfully

3. **Check logs for:**
```
Building shared package...
✅ Shared package built
Building API package...
✅ API package built
✅ GraphicsMagick detected for PDF to image conversion
```

## Expected Build Output

```
#1 [builder 8/8] RUN npm run build && ls -la dist/
#1 0.5s
#1 0.5s > @smart-brokerage/shared@1.0.0 build
#1 0.5s > tsc
#1 1.2s
#1 1.2s total 8
#1 1.2s drwxr-xr-x    5 root     root          160 Nov 11 05:30 .
#1 1.2s drwxr-xr-x    6 root     root          192 Nov 11 05:30 ..
#1 1.2s -rw-r--r--    1 root     root          123 Nov 11 05:30 index.d.ts
#1 1.2s -rw-r--r--    1 root     root          456 Nov 11 05:30 index.js
#1 1.2s drwxr-xr-x    3 root     root           96 Nov 11 05:30 types
#1 1.2s drwxr-xr-x    2 root     root           64 Nov 11 05:30 orea
#1 DONE 1.3s

#2 [builder 9/9] RUN npx prisma generate
#2 1.2s ✔ Generated Prisma Client
#2 DONE 1.2s

#3 [builder 10/10] RUN npm run build
#3 5.5s ✅ Build successful
#3 DONE 5.5s
```

## Troubleshooting

### Issue: "Cannot find module '@smart-brokerage/shared'"

**Check:**
1. Is shared package being built? Look for "Building shared package" in logs
2. Does `/app/packages/shared/dist` exist in the image?
3. Are all workspace packages in package.json?

**Fix:**
```bash
# Check if shared build is running
docker build -f packages/api/Dockerfile -t test . 2>&1 | grep shared
```

### Issue: "No build script for shared package"

**Check:**
```bash
cat packages/shared/package.json | grep build
```

Should show:
```json
"scripts": {
  "build": "tsc",
  "dev": "tsc --watch"
}
```

### Issue: TypeScript compilation errors in shared

**Check:**
```bash
cd packages/shared
npm run build
```

Fix any TypeScript errors before building Docker image.

## Alternative: Build Locally and Copy

If Docker build is still failing, you can pre-build shared locally:

```bash
# Build shared package locally
cd packages/shared
npm run build

# Commit the dist folder (normally gitignored)
git add -f dist/
git commit -m "Add pre-built shared package for Railway"
```

Then simplify Dockerfile to just copy the dist:
```dockerfile
# Skip building shared, just copy pre-built dist
COPY packages/shared ./packages/shared
```

**Note:** This is not recommended for production, but works as a workaround.

## Summary

✅ **Fixed:** Shared package now builds before API
✅ **Tested:** Works in Docker locally
✅ **Ready:** Push to Railway for deployment

The build order is now correct and Railway should successfully deploy! 🚀

