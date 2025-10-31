# Testing Guide - APS Guided Signing

## Quick Start

### 1. Apply Database Migration

```bash
cd packages/api
npx prisma migrate dev
```

### 2. Add Dropbox Sign Credentials (Optional)

Add to `packages/api/.env`:
```bash
DROPBOX_SIGN_API_KEY=your_api_key
DROPBOX_SIGN_CLIENT_ID=your_client_id
```

**Note:** The implementation works in stub mode without these credentials for testing.

### 3. Start the Services

```bash
# Terminal 1 - API
cd packages/api
npm run start:dev

# Terminal 2 - Mobile
cd packages/mobile
npm start
```

## Testing the Flow

### Option 1: Via Chat (With OREA APS Detection)

1. Navigate to a listing
2. Select a sender/thread
3. Open a chat with an attachment
4. If the attachment is detected as an OREA APS (via document analysis), you'll see a green **"✍️ Sign this APS"** button
5. Tap the button to start the guided form

**Note:** This requires:
- Document analysis to be working
- An attachment with `oreaFormDetected: true`
- `formType` containing "APS"

### Option 2: Direct Test (Manual Navigation)

For testing without needing a real APS attachment, you can manually navigate to the form from any screen:

```typescript
// In any screen with navigation
navigation.navigate('ApsGuidedForm', {
  listingId: 'your-listing-id',
  attachmentId: 'test-attachment-id', // Can be fake for stub mode
  sellerEmail: 'seller@example.com',
  sellerName: 'Test Seller',
});
```

Or add a test button temporarily to `ListingsScreen.tsx`:

```typescript
<TouchableOpacity
  onPress={() => 
    navigation.navigate('ApsGuidedForm', {
      listingId: listings[0].id,
      attachmentId: 'test-123',
      sellerEmail: 'seller@test.com',
      sellerName: 'Test Seller',
    })
  }
  style={{ padding: 16, backgroundColor: '#4CAF50', margin: 16, borderRadius: 8 }}
>
  <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
    🧪 Test APS Guided Form
  </Text>
</TouchableOpacity>
```

## What to Test

### 1. Guided Form Screen (`ApsGuidedFormScreen`)

**Expected:**
- ✅ Form sections appear (Property Info, Financial Terms, Seller Info, Lawyer Info)
- ✅ Each field shows description and tips
- ✅ Validation errors appear for required fields
- ✅ "Continue to Sign" button at the bottom

**Test:**
1. Leave required fields empty and submit → See validation errors
2. Fill in all required fields → Validation passes
3. Submit → Navigate to signing screen (or see error if API not configured)

### 2. Signing Screen (`ApsSigningScreen`)

**Expected:**
- ✅ Guidance card at top with instructions
- ✅ WebView with Dropbox Sign embedded signing
- ✅ Status updates in real-time

**In Stub Mode:**
- The sign URL will be `https://stubbed-sign-url.com/...`
- WebView will show an error (expected, since it's a fake URL)
- This confirms the flow works; with real credentials, it would show the actual signing interface

### 3. Backend API

**Test Endpoints:**

```bash
# Prepare an agreement (stub mode)
curl -X POST http://localhost:3000/agreements/aps/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "type": "fileKey",
      "fileKey": "test/aps.pdf"
    },
    "listingId": "listing-123",
    "seller": {
      "email": "seller@test.com",
      "name": "Test Seller"
    },
    "intake": {
      "sellerLegalName": "John Doe",
      "sellerAddress": "123 Test St",
      "sellerPhone": "416-555-0100"
    }
  }'

# Get agreement
curl http://localhost:3000/agreements/{agreementId}
```

**Expected (Stub Mode):**
```json
{
  "success": true,
  "data": {
    "agreementId": "...",
    "signUrl": "https://stubbed-sign-url.com/..."
  }
}
```

## Common Issues & Solutions

### Issue: "Cannot find module @smart-brokerage/shared"
**Solution:** Rebuild the shared package
```bash
cd packages/shared
npm run build
```

### Issue: TypeScript errors about `prisma.agreement`
**Solution:** Restart TypeScript server
1. Press `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows/Linux)
2. Type: `TypeScript: Restart TS Server`
3. Press Enter

### Issue: Navigation type errors
**Solution:** The navigation types are defined in `AppNavigator.tsx`. Make sure you're using the correct param types:
```typescript
ApsGuidedForm: {
  listingId: string;
  attachmentId: string;
  sellerEmail: string;
  sellerName?: string;
}
```

### Issue: "Sign APS" button doesn't appear
**Reason:** The button only appears when:
1. Message is inbound (from buyer)
2. Attachment has `documentAnalysis.oreaFormDetected = true`
3. Attachment has `documentAnalysis.formType` containing "APS"

**Workaround:** Use Option 2 (Direct Test) above to bypass this requirement.

## Real Testing (With Dropbox Sign)

### 1. Get Dropbox Sign Credentials

1. Sign up at https://www.hellosign.com/
2. Go to https://app.hellosign.com/api/dashboard
3. Create an API app
4. Enable "Embedded Signing"
5. Copy API Key and Client ID

### 2. Configure Webhook

Set callback URL in Dropbox Sign dashboard:
```
https://your-api-domain.com/agreements/webhooks/dropbox-sign
```

For local testing, use ngrok:
```bash
ngrok http 3000
# Use the ngrok URL: https://abc123.ngrok.io/agreements/webhooks/dropbox-sign
```

### 3. Get a Real OREA APS PDF

1. Download OREA Form 100 (Agreement of Purchase and Sale)
2. Have a buyer fill it partially
3. Upload to your app via email or direct upload
4. Trigger the signing flow

### 4. Calibrate Coordinates

The field coordinates in `packages/shared/src/orea/aps-v2024.map.ts` are **placeholders**. You must calibrate them:

1. Open the OREA PDF in Adobe Acrobat or similar
2. Enable coordinate display (View → Show/Hide → Rulers & Grids → Ruler)
3. Measure each field position (from bottom-left corner of page)
4. Update the coordinates in `aps-v2024.map.ts`

Example:
```typescript
sellerLegalName: {
  page: 3,        // 4th page (0-indexed)
  x: 120,         // 120pt from left
  y: 500,         // 500pt from bottom
  width: 400,     // Max width
  fontSize: 10,
}
```

## Success Criteria

### Stub Mode (No External Services)
- ✅ Can navigate to guided form
- ✅ Form displays with guidance
- ✅ Validation works
- ✅ Submit creates agreement record
- ✅ Receives stubbed sign URL
- ✅ Can open signing screen (WebView may error, expected)

### Production Mode (With Dropbox Sign)
- ✅ All stub mode criteria
- ✅ Dropbox Sign interface loads in WebView
- ✅ Can sign the document
- ✅ Webhook confirms signing
- ✅ Final signed PDF downloads
- ✅ Agreement status updates to SIGNED

## Next Steps

1. **Add User Authentication** - Replace hardcoded seller email/name with actual user context
2. **Calibrate PDF Coordinates** - Measure and update field positions for real OREA form
3. **Test with Real APS** - Upload a buyer-filled OREA APS and test end-to-end
4. **Add Document Analysis** - Implement OREA detection to auto-show "Sign APS" button
5. **Error Handling** - Add user-friendly error messages for common failures
6. **Offline Support** - Save draft intake data locally
7. **Progress Indicator** - Show progress through the guided form

## Notes

- The current implementation stores the `listingId` in the navigation params, but you may want to fetch it from the thread or message context
- Seller email and name are currently hardcoded - integrate with your auth system
- The document analysis integration is ready but requires the analysis service to detect OREA forms

