# Railway + Mailgun Webhook Debugging Guide

## The Problem

When testing Mailgun webhooks **locally or via direct API calls**, the payload is received correctly. However, when deployed to **Railway in production**, the webhook payload appears **empty**.

### Root Cause

**Mailgun uses different Content-Types for webhooks:**
- `application/x-www-form-urlencoded` - for emails without attachments
- `multipart/form-data` - **for emails WITH attachments**

The standard NestJS body parser doesn't handle `multipart/form-data` out of the box - it requires special middleware like `multer`.

### Additional Railway Considerations

1. **Railway uses a reverse proxy** - need to set `trust proxy`
2. **Body size limits** - Railway may have different limits than local dev
3. **Content-Type headers** - May be modified by Railway's infrastructure

## The Solution

### 1. Install Required Dependencies

```bash
npm install multer @types/multer
```

### 2. Configure Body Parser in `main.ts`

```typescript
const app = await NestFactory.create(AppModule, {
  bodyParser: true,
  rawBody: true, // Keep raw body for webhook signature verification
});

// Increase payload limits for Mailgun (attachment metadata can be large)
const express = await import('express');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Trust Railway's proxy
if (process.env.RAILWAY_ENVIRONMENT) {
  app.set('trust proxy', 1);
}
```

### 3. Use Multer Interceptor for Mailgun Endpoint

In `email.controller.ts`:

```typescript
import { UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

@Post('mailgun')
@UseInterceptors(AnyFilesInterceptor()) // Handles multipart/form-data
async handleMailgunWebhook(@Req() req: Request, @Body() payload: any) {
  console.log('📦 Content-Type:', req.headers['content-type']);
  console.log('📦 Payload keys:', payload ? Object.keys(payload) : 'EMPTY');
  
  if (!payload || Object.keys(payload).length === 0) {
    console.error('❌ Empty payload!');
    console.error('Headers:', req.headers);
    return { error: 'Empty payload' };
  }
  
  return this.emailService.processInboundEmail(payload);
}
```

## Testing

### Local Testing with Multipart Data

Use the provided test script:

```bash
./test-mailgun-multipart.sh
```

This simulates how Mailgun actually sends webhooks in production (with `multipart/form-data`).

### Railway Testing

1. Deploy your changes to Railway
2. Check Railway logs for the debug output:
   ```
   📧 Received Mailgun webhook
   📦 Content-Type: multipart/form-data; boundary=...
   📦 Payload keys: sender,recipient,subject,body-plain,...
   ```

3. If payload is still empty, check:
   - Railway service logs for errors
   - Mailgun webhook delivery logs
   - Network tab if testing via browser/Postman

### Debugging Empty Payloads

If you still see empty payloads:

1. **Check Content-Type**: Look for `req.headers['content-type']` in logs
2. **Check Railway environment**: Ensure `RAILWAY_ENVIRONMENT` is set
3. **Check body size**: Large emails might exceed default limits
4. **Check Mailgun webhook settings**: Ensure the URL is correct
5. **Check Railway service**: Ensure it's running and accessible

## Common Issues

### Issue: Works locally but not on Railway

**Cause**: Railway's reverse proxy handles requests differently

**Solution**: 
- Set `trust proxy` in main.ts
- Use `@Req() req: Request` to access raw request object
- Log `req.headers` to see what Railway is sending

### Issue: Works with JSON test but not real Mailgun webhook

**Cause**: Mailgun uses `multipart/form-data` for emails with attachments

**Solution**: 
- Add `@UseInterceptors(AnyFilesInterceptor())` to webhook endpoint
- Test with `test-mailgun-multipart.sh` script

### Issue: Payload too large

**Cause**: Default body parser limits are too small

**Solution**:
- Increase limits in main.ts: `{ limit: '50mb' }`
- Check Railway service plan limits

## Verification Checklist

- [ ] Installed `multer` and `@types/multer`
- [ ] Added `@UseInterceptors(AnyFilesInterceptor())` to webhook endpoint
- [ ] Configured body parser with increased limits in main.ts
- [ ] Set `trust proxy` for Railway environment
- [ ] Added debug logging for Content-Type and payload keys
- [ ] Tested locally with `test-mailgun-multipart.sh`
- [ ] Deployed to Railway and tested with real email
- [ ] Checked Railway logs for debug output
- [ ] Verified Mailgun webhook delivery succeeded

## Key Takeaways

1. **Mailgun uses multipart/form-data** when emails have attachments
2. **Standard body parser doesn't handle multipart** - need multer
3. **Railway requires special proxy configuration** - set trust proxy
4. **Body size limits matter** - increase for webhooks with attachment metadata
5. **Always log Content-Type and payload** - essential for debugging

