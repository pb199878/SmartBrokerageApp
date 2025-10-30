# Agreements Module

This module handles OREA Agreement of Purchase and Sale (APS) signing with guided seller intake and embedded Dropbox Sign integration.

## Architecture

### Flow Overview

```
Buyer sends APS via email
    ↓
Attachment stored in Supabase
    ↓
Seller taps "Sign APS" → ApsGuidedFormScreen
    ↓
Seller fills guided form (with help text)
    ↓
POST /agreements/aps/prepare
    ↓
Backend:
  1. Downloads buyer's APS PDF
  2. Detects OREA version
  3. Flattens PDF (preserves buyer data)
  4. Prefills seller's data
  5. Uploads prepared PDF
  6. Creates Dropbox Sign request
  7. Returns sign URL
    ↓
ApsSigningScreen opens WebView with sign URL
    ↓
Seller signs in Dropbox Sign
    ↓
Webhook: signature_request_all_signed
    ↓
Backend downloads final signed PDF
    ↓
Agreement status → SIGNED
```

## Services

### AgreementsService
Main orchestrator for the APS signing flow.

**Key Methods:**
- `prepareAgreement()` - Prepare APS for signing
- `getAgreement()` - Get agreement details
- `handleDropboxSignWebhook()` - Process webhook events

### PdfService
Handles all PDF manipulation using `pdf-lib`.

**Key Methods:**
- `detectOreaVersion()` - Detect OREA form version
- `flattenPdf()` - Flatten form fields
- `prefillSellerData()` - Add seller data to PDF

### DropboxSignService
Wrapper for Dropbox Sign API (REST).

**Key Methods:**
- `createEmbeddedSignatureRequest()` - Create signature request
- `getEmbeddedSignUrl()` - Get signing URL
- `downloadSignedDocument()` - Download final PDF

## Controllers

### AgreementsController
Main REST API endpoints.

**Endpoints:**
- `POST /agreements/aps/prepare` - Prepare APS
- `GET /agreements/:id` - Get agreement

### AgreementsWebhookController
Webhook handler for Dropbox Sign events.

**Endpoints:**
- `POST /agreements/webhooks/dropbox-sign` - Handle events

## Database Schema

### Agreement
Tracks the overall agreement state.

**Fields:**
- `id` - UUID
- `listingId` - Associated listing
- `buyerApsAttachmentId` - Link to email attachment
- `buyerApsFileKey` - Direct file reference
- `oreaVersion` - Detected version (e.g., "APS-2024")
- `preparedFileKey` - Prepared PDF key
- `sellerEmail` - Seller email
- `sellerName` - Seller name
- `intakeData` - JSON of seller responses
- `status` - Agreement status

**Status Flow:**
```
PENDING_SELLER_INTAKE
    ↓
PREPARING
    ↓
READY_TO_SIGN
    ↓
SIGNING_IN_PROGRESS (when viewed)
    ↓
SIGNED (when complete)
```

### SignatureRequest
Tracks Dropbox Sign signature requests.

**Fields:**
- `id` - UUID
- `agreementId` - Associated agreement
- `provider` - "DROPBOX_SIGN"
- `providerRequestId` - Dropbox Sign request ID
- `providerSignatureId` - Dropbox Sign signature ID
- `signerEmail` - Signer email
- `signUrl` - Embedded sign URL
- `finalDocumentFileKey` - Final signed PDF key
- `status` - Request status

## Configuration

### Environment Variables
```env
DROPBOX_SIGN_API_KEY=your_api_key
DROPBOX_SIGN_CLIENT_ID=your_client_id
```

### Dropbox Sign Setup
1. Create API app: https://app.hellosign.com/api/dashboard
2. Enable "Embedded Signing"
3. Set callback URL: `https://yourapi.com/agreements/webhooks/dropbox-sign`
4. Whitelist your domain for embedded signing

## Coordinate Calibration

The PDF field coordinates in `@smart-brokerage/shared/src/orea/aps-v2024.map.ts` are placeholders. You must calibrate them to the actual OREA Form 100 PDF layout.

### Finding Coordinates

1. **Use a PDF viewer** with coordinate display (e.g., Adobe Acrobat, PDF-XChange)
2. **Measure from bottom-left** of the page (PDF coordinate system)
3. **Update the map**:

```typescript
export const APS_2024_FIELD_COORDINATES: Record<string, FieldCoordinate> = {
  sellerLegalName: {
    page: 3,        // 0-indexed (4th page)
    x: 120,         // From left edge
    y: 500,         // From bottom edge
    width: 400,     // Max text width
    fontSize: 10,   // Font size
  },
  // ... etc
};
```

### Signature Fields

Signature and initial positions are defined separately:

```typescript
export const APS_2024_SIGNATURE_FIELDS: SignatureField[] = [
  {
    type: 'signature',
    page: 4,
    x: 100,
    y: 200,
    width: 200,
    height: 40,
    required: true,
    label: 'Seller Signature',
  },
  // ... etc
];
```

## Testing

### Local Testing (Stub Mode)
Without Dropbox Sign credentials, the service runs in stub mode:
- Logs all operations
- Returns fake IDs
- Skips actual API calls

### Testing with Real PDFs
1. Get a sample OREA Form 100 PDF
2. Fill it partially (as a buyer would)
3. Upload via email to your app
4. Trigger the signing flow
5. Verify coordinates are correct

### Testing Webhooks
Use ngrok or similar to expose your local server:

```bash
ngrok http 3000
```

Set the webhook URL in Dropbox Sign to:
```
https://your-ngrok-url.ngrok.io/agreements/webhooks/dropbox-sign
```

## Error Handling

### Common Issues

**"Could not detect OREA version"**
- PDF is not a standard OREA form
- Page count doesn't match expected versions
- Solution: Add version fingerprints or manual version selection

**"Failed to download PDF"**
- Signed URL expired
- Supabase not configured
- Solution: Check Supabase credentials, increase URL expiry

**"Signature request failed"**
- Dropbox Sign API error
- Invalid field coordinates (off-page)
- Solution: Check API logs, verify field positions

**"WebView won't load"**
- Cross-origin restrictions
- Expired sign URL
- Solution: Fall back to opening in browser

## API Examples

### Prepare Agreement

**Request:**
```json
POST /agreements/aps/prepare
{
  "source": {
    "type": "attachment",
    "attachmentId": "att_123"
  },
  "listingId": "listing_456",
  "seller": {
    "email": "seller@example.com",
    "name": "Jane Doe"
  },
  "intake": {
    "sellerLegalName": "Jane Elizabeth Doe",
    "sellerAddress": "123 Oak St, Toronto, ON",
    "sellerPhone": "416-555-0100",
    "lawyerName": "John Smith",
    "lawyerFirm": "Smith & Associates",
    "lawyerEmail": "john@smithlaw.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "agreementId": "agr_789",
    "signUrl": "https://app.hellosign.com/sign/..."
  }
}
```

### Get Agreement

**Request:**
```
GET /agreements/agr_789
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agr_789",
    "listingId": "listing_456",
    "status": "SIGNED",
    "oreaVersion": "APS-2024",
    "sellerEmail": "seller@example.com",
    "sellerName": "Jane Doe",
    "createdAt": "2025-10-30T10:00:00Z",
    "signedAt": "2025-10-30T10:15:00Z",
    "signatureRequest": {
      "id": "sig_999",
      "status": "SIGNED",
      "signedAt": "2025-10-30T10:15:00Z"
    },
    "finalDocumentUrl": "https://supabase.co/storage/..."
  }
}
```

## Security

### Webhook Verification
TODO: Implement webhook signature verification using HMAC.

See: https://developers.hellosign.com/api/reference/webhook-callbacks/

### Access Control
TODO: Add authentication middleware to ensure only authorized sellers can access/sign agreements.

## Monitoring

### Key Metrics
- Agreement preparation time
- Signing completion rate
- Webhook delivery success
- PDF processing errors

### Logs to Watch
- `[AgreementsService]` - High-level flow
- `[PdfService]` - PDF processing
- `[DropboxSignService]` - API calls
- `[AgreementsWebhookController]` - Webhook events

## Future Enhancements

1. **Multi-Signer Support** - Handle buyer + seller
2. **Version Auto-Detection** - Better fingerprinting
3. **Field Validation** - Check for logical errors
4. **Document Preview** - Show before signing
5. **Signature History** - Track all versions
6. **Smart Defaults** - Pre-fill from listing data
7. **Counter-Offers** - Generate modified PDFs
8. **Batch Signing** - Sign multiple documents

