# Railway Deployment Guide (with Docker)

## Overview

The Smart Brokerage API uses Docker for Railway deployment to ensure **GraphicsMagick** is available for image-based validation.

## Why Docker?

✅ **Consistent environment** across local and production
✅ **GraphicsMagick + Ghostscript included** automatically
✅ **OpenSSL for Prisma** included
✅ **No buildpack configuration** needed
✅ **Faster deploys** with multi-stage builds

---

## Deployment Steps

### 1. Configure Railway for Docker

Railway automatically detects the Dockerfile in `packages/api/Dockerfile`.

**In Railway Dashboard:**

1. Go to your service settings
2. Under **"Build"**, ensure it says: `Dockerfile detected`
3. Set **Root Directory** to: `packages/api`
4. Set **Dockerfile Path** to: `Dockerfile`

### 2. Set Environment Variables

Add these to your Railway service:

```bash
# Required
DATABASE_URL=your_railway_postgres_url
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_key

# Optional
NODE_ENV=production
PORT=3000
MAILGUN_DOMAIN=your_domain
MAILGUN_API_KEY=your_mailgun_key
DROPBOX_SIGN_API_KEY=your_dropbox_sign_key
REDIS_URL=your_redis_url
```

### 3. Deploy

```bash
# Push to your main branch
git add .
git commit -m "Add Docker support for Railway deployment"
git push origin main
```

Railway will automatically:
1. Build the Docker image with GraphicsMagick
2. Run database migrations
3. Deploy the application

### 4. Verify Deployment

Check the logs in Railway dashboard for:

```
✅ Gemini AI initialized for APS parsing
✅ Gemini Vision initialized for signature detection
✅ GraphicsMagick detected for PDF to image conversion
```

If you see all three ✅, hybrid validation is working!

---

## Docker Build Configuration

### Multi-Stage Build

The Dockerfile uses a multi-stage build for efficiency:

**Stage 1: Builder**
- Installs all dependencies
- Generates Prisma client
- Builds TypeScript

**Stage 2: Production**
- Only includes runtime dependencies
- Smaller image size (~150MB vs ~600MB)
- Includes GraphicsMagick

### Key Features

```dockerfile
# All required system dependencies
RUN apk add --no-cache \
    graphicsmagick \
    ghostscript \      # Required for PDF processing
    openssl \          # Required for Prisma
    libc6-compat       # Required for Prisma on Alpine

# Verification step
RUN gm version && gs --version

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/health'...)"
```

---

## Local Testing with Docker

Test the Docker build locally before deploying:

```bash
# Build the image
cd packages/api
docker build -t smart-brokerage-api .

# Run locally
docker run -p 3000:3000 \
  -e DATABASE_URL="your_db_url" \
  -e GOOGLE_GEMINI_API_KEY="your_key" \
  smart-brokerage-api

# Test health endpoint
curl http://localhost:3000/health
```

---

## Troubleshooting

### Issue: "Dockerfile not found"

**Solution:** Check Root Directory setting in Railway:
- Should be: `packages/api`
- Not: `/` (project root)

### Issue: Build fails with "Cannot find module '@prisma/client'"

**Solution:** Ensure Prisma generate runs in Dockerfile:
```dockerfile
RUN npx prisma generate
```

This is already in the Dockerfile, so check that it's running in logs.

### Issue: GraphicsMagick not detected

**Solution:** Check Railway build logs for:
```
Step X/XX : RUN apk add --no-cache graphicsmagick
```

If missing, the Dockerfile wasn't used. Verify Railway settings.

### Issue: "Out of memory" during build

**Solution:** Railway's default memory should be sufficient, but if needed:
1. Go to service settings
2. Increase memory allocation
3. Or optimize Dockerfile by removing dev dependencies earlier

---

## Cost Optimization

### Image Size
Current image: ~150MB (production)
- node:20-alpine base: ~110MB
- GraphicsMagick: ~15MB
- App code: ~25MB

### Build Cache
Railway caches Docker layers, so subsequent builds are fast:
- First build: ~3-5 minutes
- Cached builds: ~30-60 seconds

### Resource Usage
- Memory: ~256MB-512MB typical
- CPU: Minimal (spikes during image conversion)
- Cost: ~$5-10/month on Railway's Hobby plan

---

## CI/CD Integration

Railway automatically deploys on git push. For more control:

### GitHub Actions Example

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Railway CLI
        run: npm i -g @railway/cli
      
      - name: Deploy
        run: railway up --service api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## Database Migrations

### Automatic Migrations

Add to Dockerfile if you want automatic migrations:

```dockerfile
# Before CMD line
RUN npx prisma migrate deploy
```

**Caution:** Only use in non-production environments or if you're sure migrations are safe.

### Manual Migrations (Recommended)

Run migrations manually via Railway CLI:

```bash
# Connect to Railway project
railway link

# Run migrations
railway run npx prisma migrate deploy
```

---

## Monitoring

### Health Check

Railway uses the built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health'...)"
```

Ensure your API has a `/health` endpoint:

```typescript
@Get('health')
health() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

### Logs

View real-time logs in Railway dashboard or via CLI:

```bash
railway logs
```

Look for hybrid validation messages:
```
🔬 Starting HYBRID validation (text + images)...
✅ Hybrid validation complete. Cross-validation score: 87.5%
```

---

## Rollback

If a deployment fails:

```bash
# Via Railway dashboard: Click "Rollback" on previous deployment
# Via CLI:
railway rollback
```

---

## Summary

✅ **Dockerfile created** at `packages/api/Dockerfile`
✅ **GraphicsMagick included** automatically
✅ **Multi-stage build** for efficiency
✅ **Health checks** configured
✅ **Railway auto-detects** and builds

**Next steps:**
1. Push code to Railway
2. Verify logs show "GraphicsMagick detected"
3. Test offer submission with hybrid validation

Your hybrid validation system will now work seamlessly on Railway! 🚀

