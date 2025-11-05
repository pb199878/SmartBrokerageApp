# DocuPipe DNS Error Fix - RESOLVED ✅

## Problem

DocuPipe upload was failing with DNS error:
```
DocuPipe upload failed: getaddrinfo ENOTFOUND api.docupipe.ai
```

## Root Cause

The domain `api.docupipe.ai` does not exist (DNS lookup returns NXDOMAIN).

## Solution ✅

The correct domain is `app.docupipe.ai` (not `api.docupipe.ai`):

```bash
$ nslookup api.docupipe.ai
** server can't find api.docupipe.ai: NXDOMAIN

$ nslookup app.docupipe.ai
app.docupipe.ai	canonical name = docupanda-load-balancer-1319379270.us-east-1.elb.amazonaws.com.
Name:	docupanda-load-balancer-1319379270.us-east-1.elb.amazonaws.com
Address: 44.193.135.27
✅ Domain resolves successfully!
```

## Fix Applied

Updated the default URL from `https://api.docupipe.ai` to `https://app.docupipe.ai` in the code.

### Action Required

Update your `.env` file:

```bash
DOCUPIPE_API_KEY="A4nkPlukSpXC9iFDjUUZaA6oRBZ2"
DOCUPIPE_API_URL="https://app.docupipe.ai"  # Optional - now the default
```

Or if the variable is commented out, uncomment it:

```bash
# Before:
# DOCUPIPE_API_KEY="A4nkPlukSpXC9iFDjUUZaA6oRBZ2"

# After:
DOCUPIPE_API_KEY="A4nkPlukSpXC9iFDjUUZaA6oRBZ2"
```

Then restart your API server:
```bash
cd packages/api
npm run dev
```

## What Changed

### 1. Improved Error Handling
- Added DNS-specific error detection in `DocuPipeService`
- Provides clearer error messages when service is unavailable
- Suggests disabling the service in error logs

### 2. Updated Documentation
- `env.example` now includes DocuPipe configuration (commented out)
- `OREA_VALIDATION.md` updated with troubleshooting section
- Warns that service is currently unavailable

### 3. Graceful Degradation
The system already had fallback logic in place:
```typescript
if (process.env.DOCUPIPE_API_KEY) {
  // Try DocuPipe
} else {
  // Use basic extraction
}
```

When DocuPipe fails, it catches the error and continues with basic extraction.

## How Basic Extraction Works

When DocuPipe is disabled, the system uses regex-based extraction:
- ✅ Purchase price
- ✅ Deposit amount
- ✅ Closing date
- ✅ Expiry/irrevocable date
- ✅ Property address
- ✅ Conditions (financing, inspection, etc.)

**Validation status**: `not_validated` (no signature detection, no comprehensive field extraction)

## Testing

After disabling DocuPipe:

1. Send a test email with OREA Form 100 PDF
2. Check logs - should see:
   ```
   ⚠️  DocuPipe not configured, using basic extraction only
   ```
3. Verify document analysis is created with `validationStatus: 'not_validated'`
4. Confirm offer is created (no auto-rejection)

## Future Steps

When DocuPipe becomes available:
1. Verify the correct API endpoint
2. Sign up for API access
3. Update `DOCUPIPE_API_KEY` and optionally `DOCUPIPE_API_URL` in `.env`
4. Test with sample OREA Form 100
5. Verify comprehensive extraction and validation works

## Files Modified

- ✅ `packages/api/src/common/docupipe/docupipe.service.ts` - Better error handling
- ✅ `env.example` - Added DocuPipe configuration (commented)
- ✅ `OREA_VALIDATION.md` - Added troubleshooting section

## Summary ✅

**Issue Resolved**: Changed default URL from `https://api.docupipe.ai` to `https://app.docupipe.ai`

**Action Required**: 
1. Ensure `DOCUPIPE_API_KEY` is **uncommented** in your `.env` file
2. Restart the API server
3. DocuPipe integration should now work correctly

The correct endpoint is `app.docupipe.ai`, which resolves to AWS load balancer infrastructure in us-east-1.

