# Auto-Guided APS Signing Implementation Summary

## Overview
Implemented a complete guided signing experience for OREA Agreement of Purchase and Sale (APS) documents using Dropbox Sign embedded signing. This allows sellers to fill out guided forms in the mobile app, then sign buyer-provided APS documents with contextual guidance.

## Key Features

### 1. Two-Stage Flow
- **Stage 1**: In-app guided form with field-level help and validation
- **Stage 2**: Embedded Dropbox Sign WebView for signatures/initials only

### 2. Automatic PDF Processing
- Detects OREA APS version (2024, 2023, etc.)
- Flattens buyer's filled fields to preserve their data
- Prefills seller's intake data at exact coordinates
- Auto-applies signature/initial field overlays

### 3. Rich Guidance
- Section-based form with helper text for each field
- Field-level tips and examples
- Validation with clear error messages
- Sidecar guidance panel during signing

## Implementation Details

### Backend (NestJS)

#### New Modules
- **`agreements/`** - Complete module for APS handling
  - `agreements.service.ts` - Business logic
  - `agreements.controller.ts` - REST endpoints
  - `agreements-webhook.controller.ts` - Dropbox Sign webhooks
  - `pdf.service.ts` - PDF manipulation with pdf-lib
  - `dropbox-sign.service.ts` - Dropbox Sign API wrapper

#### Endpoints
- `POST /agreements/aps/prepare` - Prepare APS for signing
- `GET /agreements/:id` - Get agreement details
- `POST /agreements/webhooks/dropbox-sign` - Handle signing events

#### Database Models (Prisma)
```prisma
model Agreement {
  id                    String
  listingId             String
  buyerApsAttachmentId  String?  // Link to email attachment
  buyerApsFileKey       String?  // Direct file reference
  oreaVersion           String?
  preparedFileKey       String?
  sellerEmail           String
  sellerName            String?
  intakeData            Json?
  status                AgreementStatus
  // ... timestamps
  signatureRequests     SignatureRequest[]
}

model SignatureRequest {
  id                    String
  agreementId           String
  provider              SignatureProvider
  providerRequestId     String
  providerSignatureId   String?
  signerEmail           String
  signUrl               String?
  finalDocumentFileKey  String?
  status                SignatureRequestStatus
  // ... timestamps
}
```

#### Enums
- `AgreementStatus`: PENDING_SELLER_INTAKE, PREPARING, READY_TO_SIGN, SIGNING_IN_PROGRESS, SIGNED, FAILED, CANCELLED
- `SignatureRequestStatus`: CREATED, VIEWED, SIGNED, DECLINED, CANCELLED, ERROR

### Shared Types (`packages/shared`)

#### OREA Field Mapping (`src/orea/aps-v2024.map.ts`)
- Field coordinates for PDF text placement
- Signature/initial field positions for Dropbox Sign
- Guidance notes with descriptions, examples, and tips
- OREA version detection fingerprints

#### TypeScript Types (`src/types/orea/aps.ts`)
- `ApsIntake` - Seller intake data structure
- `PrepareAgreementRequest` - API request format
- `PrepareAgreementResponse` - API response format
- `AgreementDetail` - Full agreement details

### Mobile (Expo / React Native)

#### New Screens
1. **`ApsGuidedFormScreen`** - Guided intake form
   - Sectioned layout matching guidance structure
   - Field-level validation
   - Helper text and tips
   - Auto-focuses on errors

2. **`ApsSigningScreen`** - Embedded signing
   - Dropbox Sign WebView
   - Sidecar guidance panel
   - Status polling
   - Completion detection via URL redirect + webhooks

#### Navigation Routes
```typescript
ApsGuidedForm: {
  listingId: string;
  attachmentId: string;
  sellerEmail: string;
  sellerName?: string;
}

ApsSigning: {
  agreementId: string;
  signUrl: string;
  listingId: string;
}
```

#### API Client & Hooks
- `agreementsApi.prepare()` - Prepare agreement
- `agreementsApi.get()` - Get agreement details
- `usePrepareAgreement()` - Mutation hook
- `useAgreement()` - Query hook with auto-polling

## Architecture Decisions

### Why No Upload Endpoint?
Buyer APS documents are already stored via email attachments. The prepare endpoint accepts either:
- `attachmentId` - Link to existing email attachment
- `fileKey` - Direct Supabase storage key

### PDF Processing Flow
1. **Download** buyer's APS from Supabase
2. **Detect** OREA version via page count and fingerprints
3. **Flatten** form fields (preserves buyer's data as static text)
4. **Prefill** seller's data at mapped coordinates
5. **Upload** prepared PDF to Supabase
6. **Create** Dropbox Sign request with signature fields
7. **Return** sign URL to mobile app

### Field Coordinate Mapping
The `APS_2024_FIELD_COORDINATES` object maps field names to PDF coordinates:
```typescript
{
  sellerLegalName: { page: 3, x: 120, y: 500, width: 400, fontSize: 10 },
  // ... etc
}
```

**Note**: These coordinates are **placeholders** and must be calibrated to the actual OREA Form 100 PDF layout. Use a PDF coordinate tool to find exact positions.

### Signature Field Placement
Signature/initial fields are defined in `APS_2024_SIGNATURE_FIELDS`:
```typescript
{
  type: 'signature',
  page: 4,
  x: 100,
  y: 200,
  width: 200,
  height: 40,
  required: true,
  label: 'Seller Signature',
}
```

These are passed to Dropbox Sign via `form_fields_per_document` API parameter.

## Configuration Required

### Environment Variables
Add to `.env`:
```bash
DROPBOX_SIGN_API_KEY=your_api_key_here
DROPBOX_SIGN_CLIENT_ID=your_client_id_here
```

Get credentials from: https://app.hellosign.com/api/dashboard

### Dropbox Sign Setup
1. Create API app in Dropbox Sign dashboard
2. Enable "Embedded Signing"
3. Set callback URL: `https://yourapi.com/agreements/webhooks/dropbox-sign`
4. Add allowed domains for embedded signing

### Supabase Buckets
Create storage buckets:
- `agreements` - For prepared and signed PDFs
- `attachments` - Already exists for email attachments

## Usage Flow

### Triggering the Flow
From a message thread with an APS attachment:

```typescript
// In ChatScreen or attachment handler
navigation.navigate('ApsGuidedForm', {
  listingId: listing.id,
  attachmentId: attachment.id,
  sellerEmail: seller.email,
  sellerName: seller.name,
});
```

### Complete Flow
1. **User taps** "Sign APS" on an attachment
2. **Navigate** to `ApsGuidedFormScreen`
3. **Fill out** guided form with help text
4. **Submit** → Backend prepares PDF
5. **Navigate** to `ApsSigningScreen` with sign URL
6. **Sign** in Dropbox Sign WebView
7. **Webhook** confirms signing complete
8. **Poll** detects `SIGNED` status
9. **Success** alert and navigate back to listings

## Webhook Events Handled

- `signature_request_viewed` → Status: VIEWING
- `signature_request_signed` → Status: SIGNED (single signer)
- `signature_request_all_signed` → Download final PDF, status: SIGNED
- `signature_request_declined` → Status: CANCELLED

## Testing

### Stub Mode
All services run in stub mode without external credentials:
- DropboxSignService logs actions, returns fake IDs
- SupabaseService logs uploads (if not configured)
- PdfService still processes PDFs locally

### Testing Checklist
- [ ] Calibrate PDF coordinates for real OREA Form 100
- [ ] Test with buyer-filled APS PDF
- [ ] Verify signature field positions
- [ ] Test webhook delivery
- [ ] Test signing on mobile WebView
- [ ] Verify final signed PDF downloads

## Known Limitations

### Coordinate Calibration Required
The field coordinates in `aps-v2024.map.ts` are **estimates**. They must be calibrated to the actual OREA Form 100 PDF layout using a coordinate tool or trial-and-error.

### PDF Text Extraction
OREA version detection currently uses page count. For robust detection, integrate `pdf-parse` to extract and search text for fingerprints like "Form 100 - 2024".

### Single Signer Only
Current implementation assumes seller-only signing. For counter-offers or dual-signing scenarios, extend the signature request logic.

### WebView Limitations
Some mobile browsers/WebViews restrict cross-origin iframes. If Dropbox Sign fails to load, fall back to opening the `signUrl` in the device's default browser.

## Future Enhancements

1. **Multi-Signer Support** - Handle buyer + seller signing
2. **Counter-Offers** - Generate modified APS PDFs
3. **Document Templates** - Pre-populate common fields
4. **Signature History** - Track all signatures per listing
5. **Offline Draft Saving** - Save intake data locally
6. **PDF Preview** - Show preview before signing
7. **Field Auto-Fill** - Pre-populate from listing data
8. **Smart Validation** - Check for common mistakes (e.g., deposit > purchase price)

## Migration

Migration created but not applied. To apply:

```bash
cd packages/api
npx prisma migrate dev
```

This creates the `agreements` and `signature_requests` tables.

## Dependencies Added

### Backend
- `pdf-lib` - PDF manipulation
- `hellosign-sdk` - Dropbox Sign (deprecated, using REST API instead)
- `form-data` - For multipart requests

### Mobile
No new dependencies (uses existing React Query, WebView, React Native Paper)

## Files Created

### Backend
- `packages/api/src/modules/agreements/agreements.module.ts`
- `packages/api/src/modules/agreements/agreements.controller.ts`
- `packages/api/src/modules/agreements/agreements.service.ts`
- `packages/api/src/modules/agreements/agreements-webhook.controller.ts`
- `packages/api/src/modules/agreements/pdf.service.ts`
- `packages/api/src/modules/agreements/dropbox-sign.service.ts`

### Shared
- `packages/shared/src/types/orea/aps.ts`
- `packages/shared/src/orea/aps-v2024.map.ts`

### Mobile
- `packages/mobile/src/screens/ApsGuidedFormScreen.tsx`
- `packages/mobile/src/screens/ApsSigningScreen.tsx`
- `packages/mobile/src/hooks/agreements.ts`

### Updated
- `packages/api/prisma/schema.prisma` - Added models
- `packages/api/src/app.module.ts` - Imported AgreementsModule
- `packages/shared/src/index.ts` - Exported new types
- `packages/mobile/src/services/api.ts` - Added agreementsApi
- `packages/mobile/src/navigation/AppNavigator.tsx` - Added routes

## Summary

This implementation provides a **production-ready foundation** for guided APS signing with Dropbox Sign. The key advantage over basic embedded signing is the **rich, contextual guidance** provided to sellers throughout the form completion and signing process, reducing errors and improving the seller experience.

The coordinate mapping approach allows you to support **any PDF layout** by simply updating the coordinate map, making it future-proof for new OREA versions or other standardized forms.

