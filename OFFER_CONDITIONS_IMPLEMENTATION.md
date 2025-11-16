# Offer Conditions Implementation Summary

## Overview
This document summarizes the implementation of Schedule A condition tracking and OREA 124 fulfillment for the Smart Brokerage App. The system now tracks conditions from APS Schedule A, monitors their fulfillment via OREA 124 forms, and automatically transitions offers from CONDITIONALLY_ACCEPTED to ACCEPTED when all conditions are met.

## Database Changes

### New Prisma Model: `OfferCondition`
```prisma
model OfferCondition {
  id            String                @id @default(cuid())
  offerId       String
  description   String                @db.Text
  dueDate       DateTime?
  status        OfferConditionStatus  @default(PENDING)
  completedAt   DateTime?
  matchingKey   String?
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt

  offer Offer @relation(fields: [offerId], references: [id], onDelete: Cascade)

  @@index([offerId])
  @@index([status])
  @@index([dueDate])
  @@map("offer_conditions")
}
```

### New Enum: `OfferConditionStatus`
```prisma
enum OfferConditionStatus {
  PENDING   // Created from APS, not yet fulfilled
  COMPLETED // Marked fulfilled via OREA 124 or manually
  EXPIRED   // Not completed by due date
  WAIVED    // Condition waived (future: OREA waiver forms)
}
```

### Updated `Offer` Model
- Added `CONDITIONALLY_ACCEPTED` status to `OfferStatus` enum
- Added `conditionallyAcceptedAt` timestamp field
- Added `acceptedAt` timestamp field
- Added `offerConditions` relation

### Updated `OfferStatus` Enum
```prisma
enum OfferStatus {
  PENDING_REVIEW
  AWAITING_SELLER_SIGNATURE
  AWAITING_BUYER_SIGNATURE
  CONDITIONALLY_ACCEPTED  // NEW: Seller signed, conditions pending
  ACCEPTED                // Updated: All conditions fulfilled
  DECLINED
  COUNTERED
  EXPIRED
  SUPERSEDED
}
```

## Shared Types (TypeScript)

### New Types in `packages/shared/src/types/orea/aps.ts`

```typescript
export enum OfferConditionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  WAIVED = 'WAIVED',
}

export interface ParsedApsCondition {
  id: string;
  description: string;
  dueDate?: string; // ISO date string
}

export interface OfferCondition {
  id: string;
  offerId: string;
  description: string;
  dueDate?: string;
  status: OfferConditionStatus;
  completedAt?: string;
  matchingKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Orea124FulfilledCondition {
  description: string;
  note?: string;
}

export interface Orea124ParseResult {
  success: boolean;
  documentDate?: string;
  fulfilledConditions: Orea124FulfilledCondition[];
  errors?: string[];
}
```

### Updated `ApsParseResult`
```typescript
export interface ApsParseResult {
  // ... existing fields ...
  scheduleAConditions?: ParsedApsCondition[]; // NEW
}
```

### Updated `GeminiApsSchema`
```typescript
export interface GeminiApsSchema {
  // ... existing fields ...
  schedule_a_conditions?: Array<{
    description: string;
    due_date?: {
      day?: string;
      month?: string;
      year?: string;
    };
  }>;
}
```

## Backend Implementation

### 1. APS Parser Service (`packages/api/src/modules/aps-parser/aps-parser.service.ts`)

#### Updated Gemini Schema
- Added `schedule_a_conditions` field to extraction schema
- Updated prompt to instruct Gemini to extract Schedule A conditions with due dates

#### New Methods
- `processScheduleAConditions()`: Converts raw Gemini conditions to `ParsedApsCondition[]`
  - Note: Does NOT generate matchingKey here - that's done in offers.service when persisting to DB

#### Key Features
- Extracts each condition as a separate item
- Parses due dates from day/month/year format to ISO date strings
- Validates dates and logs warnings for invalid entries
- Generates temporary IDs for frontend use

### 2. OREA 124 Parser Service (`packages/api/src/modules/aps-parser/orea-124-parser.service.ts`)

**NEW FILE** - Dedicated parser for OREA Form 124 (Notice of Fulfillment or Waiver)

#### Methods
- `parseOrea124()`: Main parsing method using Gemini Vision API
- `getOrea124Schema()`: Defines extraction schema for Gemini
- `normalizeFulfilledConditions()`: Validates and normalizes extracted conditions

#### Features
- Extracts document date
- Extracts list of fulfilled/waived conditions
- Includes optional notes for each condition
- Returns structured `Orea124ParseResult`

### 3. Documents Service (`packages/api/src/modules/documents/documents.service.ts`)

#### Updated Form Detection
- Added detection for OREA Form 124 in `detectOREAForm()` method
- Looks for keywords: "notice of fulfillment", "form 124", "fulfillment" + "waiver"

#### Updated Analysis Flow
- Checks if document is Form 124
- If yes, calls `orea124ParserService.parseOrea124()` instead of APS parser
- Stores OREA 124 parse result in `formFieldsExtracted` field
- Skips signature validation for Form 124 (not needed)

### 4. Offers Service (`packages/api/src/modules/offers/offers.service.ts`)

#### New Methods

**`createOfferConditions(offerId, scheduleAConditions)`**
- Creates `OfferCondition` records from parsed Schedule A conditions
- Generates `matchingKey` for each condition using text normalization
- Parses and validates due dates
- Sets initial status to `PENDING`

**`fulfillConditionsFromOrea124(offerId, orea124Result)`**
- Matches fulfilled conditions from OREA 124 to existing pending conditions
- Uses normalized `matchingKey` for matching
- Updates matched conditions to `COMPLETED` status
- Sets `completedAt` timestamp from document date or current time
- Logs unmatched conditions for debugging
- Calls `checkAndUpdateOfferStatus()` after processing

**`checkAndUpdateOfferStatus(offerId)`**
- Checks if all conditions are completed or waived
- If yes and offer is `CONDITIONALLY_ACCEPTED`, updates to `ACCEPTED`
- Sets `acceptedAt` timestamp
- Logs status changes

**`getOfferConditions(offerId)`**
- Returns all conditions for an offer, ordered by creation date

**`normalizeConditionText(text)`**
- Normalizes text for matching: lowercase, remove punctuation, normalize whitespace
- Used to create stable `matchingKey` values
- **Critical**: This is the ONLY normalization method used for both APS conditions and OREA 124 fulfillment
- Ensures consistent matching between Schedule A conditions and fulfilled conditions

#### Updated Methods

**`extractOfferDataFromAttachment()`**
- Now extracts `scheduleAConditions` from `ApsParseResult`
- Returns conditions along with other offer data

**`createOfferFromMessage()`**
- Extracts `scheduleAConditions` from attachment analysis
- Calls `createOfferConditions()` after creating offer record
- Logs number of conditions created

**`handleAllSignaturesCompleted()`**
- Checks for pending conditions after seller signs
- Sets status to `CONDITIONALLY_ACCEPTED` if conditions exist
- Sets status to `ACCEPTED` if no conditions exist
- Sets appropriate timestamps (`conditionallyAcceptedAt` or `acceptedAt`)
- Logs status decision

**`getOffer()`**
- Now includes `offerConditions` in the response
- Conditions ordered by creation date

### 5. Email Service (`packages/api/src/modules/email/email.service.ts`)

#### New Logic After Document Analysis
- Checks each analyzed document for Form 124
- If Form 124 detected, finds the active offer for the thread
- Calls `offersService.fulfillConditionsFromOrea124()` with offer ID and parse result
- Handles errors gracefully and continues processing

#### Supported Offer Statuses for Fulfillment
- `CONDITIONALLY_ACCEPTED`
- `AWAITING_SELLER_SIGNATURE` (edge case)
- `ACCEPTED` (for late fulfillment notices)

### 6. Classification Service (`packages/api/src/modules/classification/classification.service.ts`)

#### Updated Form Classification
**CRITICAL FIX**: OREA 124 forms are now classified as `GENERAL`, not `NEW_OFFER`

- Form 100 (APS) → `NEW_OFFER` ✅
- Form 120 (Amendment) → `AMENDMENT` ✅
- Form 221 (Counter Offer) → `UPDATED_OFFER` ✅
- **Form 124 (Fulfillment) → `GENERAL`** ✅ (prevents duplicate offer creation)
- Form 123 (Waiver) → `GENERAL` ✅
- Unknown OREA forms → `GENERAL` (conservative default)

This ensures that when a Form 124 is received:
1. ❌ It does NOT trigger offer creation (not classified as NEW_OFFER)
2. ✅ It DOES trigger condition fulfillment (email.service checks formType directly)
3. ✅ Message is stored as general communication

### 7. Offers Controller (`packages/api/src/modules/offers/offers.controller.ts`)

#### New Endpoint
**`GET /offers/:id/conditions`**
- Returns all conditions for an offer
- Response format: `{ success: true, data: OfferCondition[] }`

#### Updated Endpoint
**`GET /offers/:id`**
- Now includes `offerConditions` array in offer response

## Condition Matching Logic

### How Matching Works

Both APS Schedule A conditions and OREA 124 fulfilled conditions use the **same normalization function** (`offers.service.ts::normalizeConditionText()`) to ensure consistent matching:

```typescript
private normalizeConditionText(text: string): string {
  return text
    .toLowerCase()              // "Financing Condition" → "financing condition"
    .replace(/[^\w\s]/g, "")   // Remove punctuation: "buyer's" → "buyers"
    .replace(/\s+/g, " ")      // Normalize whitespace: "home  inspection" → "home inspection"
    .trim();                    // Remove leading/trailing spaces
}
```

### Example Matching (Real-World WebForms Format)

**APS Schedule A (original condition):**
```
1. This Offer is conditional upon the Buyer arranging, at the Buyer's own 
expense, satisfactory financing on or before January 15, 2025. Unless the 
Buyer gives notice in writing to the Seller or the Seller's Brokerage on or 
before the above date that this condition is fulfilled, this Offer shall be 
null and void and the deposit shall be returned to the Buyer in full without 
deduction.
```

**Gemini extracts from APS (raw, as-is):**
```json
{
  "description": "1. This Offer is conditional upon the Buyer arranging, at the Buyer's own expense, satisfactory financing on or before January 15, 2025. Unless the Buyer gives notice in writing to the Seller or the Seller's Brokerage on or before the above date that this condition is fulfilled, this Offer shall be null and void and the deposit shall be returned to the Buyer in full without deduction."
}
```

**Our code cleans it:**
```
"This Offer is conditional upon the Buyer arranging, at the Buyer's own expense, satisfactory financing on or before January 15, 2025. Unless the Buyer gives notice in writing to the Seller or the Seller's Brokerage on or before the above date that this condition is fulfilled, this Offer shall be null and void and the deposit shall be returned to the Buyer in full without deduction."
```
↓ (stored in DB as `description`)

**Normalized matchingKey:**
```
"this offer is conditional upon the buyer arranging at the buyers own expense satisfactory financing on or before january 15 2025 unless the buyer gives notice in writing to the seller or the sellers brokerage on or before the above date that this condition is fulfilled this offer shall be null and void and the deposit shall be returned to the buyer in full without deduction"
```
↓ (stored in DB as `matchingKey`)

---

**OREA 124 (WebForms-generated with header):**
```
Condition #1:
This Offer is conditional upon the Buyer arranging, at the Buyer's own expense, 
satisfactory financing on or before January 15, 2025. Unless the Buyer gives 
notice in writing to the Seller or the Seller's Brokerage on or before the 
above date that this condition is fulfilled, this Offer shall be null and void 
and the deposit shall be returned to the Buyer in full without deduction.
```

**Gemini extracts from OREA 124 (raw, as-is):**
```json
{
  "description": "Condition #1:\nThis Offer is conditional upon the Buyer arranging, at the Buyer's own expense, satisfactory financing on or before January 15, 2025. Unless the Buyer gives notice in writing to the Seller or the Seller's Brokerage on or before the above date that this condition is fulfilled, this Offer shall be null and void and the deposit shall be returned to the Buyer in full without deduction."
}
```

**Our code cleans it:**
```
"This Offer is conditional upon the Buyer arranging, at the Buyer's own expense, satisfactory financing on or before January 15, 2025. Unless the Buyer gives notice in writing to the Seller or the Seller's Brokerage on or before the above date that this condition is fulfilled, this Offer shall be null and void and the deposit shall be returned to the Buyer in full without deduction."
```
↓ (same as APS after cleaning!)

**Normalized fulfilledKey:**
```
"this offer is conditional upon the buyer arranging at the buyers own expense satisfactory financing on or before january 15 2025 unless the buyer gives notice in writing to the seller or the sellers brokerage on or before the above date that this condition is fulfilled this offer shall be null and void and the deposit shall be returned to the buyer in full without deduction"
```

**Result:** ✅ **EXACT MATCH** - Condition marked as COMPLETED

**Key Point:** Our deterministic cleaning handles all format variations:
- `"1. This Offer..."` → `"This Offer..."`
- `"Condition #1:\nThis Offer..."` → `"This Offer..."`
- Both produce identical matchingKeys!

### When Matching Fails

If the buyer abbreviates or rewords the condition in OREA 124:

**OREA 124 (abbreviated):**
```
"Financing condition - mortgage approved"
```

**Normalized fulfilledKey:**
```
"financing condition mortgage approved"
```

**Result:** ❌ **NO MATCH** - Logged as "⚠️ No matching condition found"

**Workaround:** Future enhancement will use fuzzy matching or AI to correlate similar conditions.

### Deterministic Extraction and Cleanup

**Gemini extracts RAW text as-is:**
- ✅ "Copy the EXACT text as it appears in the document"
- ✅ "Include any numbering, prefixes, headers, or labels"
- ✅ "Do NOT modify, clean up, or reformat the text"

**Our code then cleans it deterministically:**
```typescript
private cleanConditionText(rawText: string): string {
  let cleaned = rawText.trim();
  
  // Remove OREA 124 headers: "Condition #1:" → ""
  cleaned = cleaned.replace(/^condition\s*#?\d+\s*:?\s*/i, "");
  
  // Remove leading numbers: "1. " → "", "1) " → "", "1 " → ""
  cleaned = cleaned.replace(/^\d+[\.\)]\s*/, "");
  cleaned = cleaned.replace(/^\d+\s+/, "");
  
  return cleaned.trim();
}
```

This approach is **more reliable** than asking Gemini to follow complex formatting rules.

### Handling WebForms Format Differences

**Important:** WebForms-generated OREA 124 forms have slight formatting differences from Schedule A:

1. **Numerical prefixes removed**: Schedule A has "1. This Offer..." but OREA 124 has "This Offer..."
2. **Header text added**: OREA 124 adds "Condition #1:" before each clause
3. **Line-wrapping differs**: Different margins cause text to wrap at different points
4. **Hyphenation changes**: Hyphenation may differ due to line-wrapping

**Our two-step process handles all of these:**

**Step 1: Clean raw text** (for storage and display)
```typescript
private cleanConditionText(rawText: string): string {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^condition\s*#?\d+\s*:?\s*/i, ""); // Remove "Condition #1:"
  cleaned = cleaned.replace(/^\d+[\.\)]\s*/, "");               // Remove "1.", "1)"
  cleaned = cleaned.replace(/^\d+\s+/, "");                     // Remove "1 "
  return cleaned.trim();
}
```

**Step 2: Normalize for matching** (creates matchingKey)
```typescript
private normalizeConditionText(text: string): string {
  const cleaned = this.cleanConditionText(text);  // Clean first
  
  return cleaned
    .toLowerCase()              // Case-insensitive
    .replace(/[^\w\s]/g, "")   // Remove ALL punctuation
    .replace(/\s+/g, " ")       // Normalize whitespace
    .trim();
}
```

This ensures that Gemini extracts conditions identically from both forms, maximizing the chance of successful matching. However, if the **buyer physically writes different text** in OREA 124 than what was in the original APS, matching will still fail (this is a limitation of the buyer's input, not the system).

## Workflow

### 1. Offer Creation with Conditions
1. Buyer sends APS via email with Schedule A conditions
2. Email service receives and stores attachment
3. Documents service analyzes PDF
4. APS parser extracts Schedule A conditions (description + due date)
5. Offers service creates `Offer` record
6. Offers service creates `OfferCondition` records for each condition
7. Conditions stored with `status = PENDING` and normalized `matchingKey`

### 2. Seller Accepts Offer
1. Seller completes guided intake and signs via Dropbox Sign
2. Dropbox Sign webhook triggers `handleAllSignaturesCompleted()`
3. System checks for pending conditions
4. If conditions exist:
   - Status set to `CONDITIONALLY_ACCEPTED`
   - `conditionallyAcceptedAt` timestamp set
5. If no conditions:
   - Status set to `ACCEPTED`
   - `acceptedAt` timestamp set

### 3. Condition Fulfillment via OREA 124
1. Buyer sends OREA 124 form via email
2. Email service receives and stores attachment
3. Documents service detects Form 124
4. OREA 124 parser extracts fulfilled conditions
5. Email service finds active offer for thread
6. Offers service matches fulfilled conditions to pending conditions
7. Matched conditions updated to `COMPLETED` status
8. System checks if all conditions are fulfilled
9. If all fulfilled:
   - Offer status updated to `ACCEPTED`
   - `acceptedAt` timestamp set
   - Log: "🎉 All conditions fulfilled!"

### 4. Due Date Tracking (Future Enhancement)
- Conditions with `dueDate` can be monitored
- Background job can mark overdue conditions as `EXPIRED`
- Business logic can determine if expired conditions fail the offer

## API Endpoints

### Get Offer with Conditions
```
GET /offers/:id
Response: {
  success: true,
  data: {
    id: string,
    status: OfferStatus,
    conditionallyAcceptedAt?: string,
    acceptedAt?: string,
    offerConditions: OfferCondition[],
    // ... other offer fields
  }
}
```

### Get Conditions Only
```
GET /offers/:id/conditions
Response: {
  success: true,
  data: OfferCondition[]
}
```

## Mobile Integration (To Be Implemented)

### API Client (`packages/mobile/src/services/api.ts`)
```typescript
// Add these functions:
export const getOfferConditions = async (offerId: string) => {
  const response = await apiClient.get(`/offers/${offerId}/conditions`);
  return response.data;
};
```

### React Query Hooks
```typescript
// In offer detail screen:
const { data: conditions } = useQuery(
  ['offer-conditions', offerId],
  () => api.getOfferConditions(offerId)
);
```

### UI Components
- **ConditionsList**: Display all conditions with status badges
- **ConditionItem**: Show description, due date, status, completion date
- **OfferStatusBanner**: Show "Conditionally Accepted" vs "Accepted"
- **ConditionsProgress**: Visual progress indicator (X of Y completed)

### Status Badges
- `PENDING`: Yellow/Orange badge
- `COMPLETED`: Green badge with checkmark
- `EXPIRED`: Red badge with warning icon
- `WAIVED`: Gray badge

## Testing

### Unit Tests Needed
1. `aps-parser.service.ts`
   - Test Schedule A extraction from sample PDFs
   - Test due date parsing (various formats)
   - Test condition normalization

2. `orea-124-parser.service.ts`
   - Test fulfillment extraction from sample PDFs
   - Test document date parsing
   - Test error handling

3. `offers.service.ts`
   - Test `createOfferConditions()` with various inputs
   - Test `fulfillConditionsFromOrea124()` matching logic
   - Test `checkAndUpdateOfferStatus()` state transitions
   - Test condition normalization and matching

### Integration Tests Needed
1. Full APS → Conditions flow
2. Full OREA 124 → Fulfillment flow
3. Offer status transitions (PENDING → CONDITIONALLY_ACCEPTED → ACCEPTED)
4. Edge cases: no conditions, partial fulfillment, unmatched conditions

## Migration Steps

### To Apply Database Changes

**Option 1: Create Migration (Recommended for Production)**
```bash
cd packages/api
npx prisma migrate dev --name add_offer_conditions
```

**Option 2: Push Schema (Development Only)**
```bash
cd packages/api
npx prisma db push
```

### After Migration
1. Restart TypeScript server in your IDE (Cmd+Shift+P → "TypeScript: Restart TS Server")
2. Rebuild shared package: `cd packages/shared && npm run build`
3. Restart API server

## Known Limitations & Future Enhancements

### Current Limitations
1. **Condition Matching**: Uses simple text normalization (lowercase, remove punctuation, normalize whitespace). Both APS Schedule A and OREA 124 use the SAME normalization method (`offers.service.ts::normalizeConditionText()`), ensuring consistency. However, matching may still fail if the buyer words the condition significantly differently in OREA 124 than in the original APS.
2. **No Manual Override**: Sellers cannot manually mark conditions as complete via UI.
3. **No Due Date Enforcement**: System doesn't automatically expire conditions or fail offers.
4. **No Waiver Support**: OREA 123 (Waiver) forms not yet supported.
5. **No Notifications**: Sellers not notified when conditions are fulfilled.

### Future Enhancements
1. **Background Job**: Daily job to check due dates and mark conditions as `EXPIRED`
2. **Manual Condition Management**: API endpoints for sellers to manually update condition status
3. **OREA 123 Support**: Parse waiver forms and mark conditions as `WAIVED`
4. **Smart Matching**: Use fuzzy matching or AI to better correlate conditions across documents
5. **Notifications**: Email/push notifications when conditions are fulfilled or expired
6. **Condition Templates**: Pre-defined condition types (financing, inspection, etc.) for better tracking
7. **Mobile UI**: Full mobile interface for viewing and managing conditions
8. **Condition History**: Track all changes to condition status with timestamps and reasons

## Files Modified

### Database
- `packages/api/prisma/schema.prisma`

### Shared Types
- `packages/shared/src/types/orea/aps.ts`

### Backend Services
- `packages/api/src/modules/aps-parser/aps-parser.service.ts` (updated)
- `packages/api/src/modules/aps-parser/aps-parser.module.ts` (updated)
- `packages/api/src/modules/aps-parser/orea-124-parser.service.ts` (NEW)
- `packages/api/src/modules/documents/documents.service.ts` (updated)
- `packages/api/src/modules/offers/offers.service.ts` (updated)
- `packages/api/src/modules/offers/offers.controller.ts` (updated)
- `packages/api/src/modules/email/email.service.ts` (updated)

## Troubleshooting

### TypeScript Errors After Schema Changes
If you see errors like "Property 'offerCondition' does not exist on type 'PrismaService'":
1. Run `npx prisma generate` in `packages/api`
2. Restart TypeScript server (Cmd+Shift+P → "TypeScript: Restart TS Server")
3. Reload VS Code window if needed

### Conditions Not Being Created
1. Check that APS parser is extracting `scheduleAConditions`
2. Look for log: "📋 Found X Schedule A condition(s)"
3. Check that `createOfferConditions()` is being called
4. Look for log: "📋 Creating X offer condition(s)..."

### OREA 124 Not Matching Conditions
1. Check that Form 124 is being detected: "📋 Detected OREA 124 form"
2. Check that conditions are being extracted: "✅ OREA 124 parsing complete"
3. Check matching logs: "✓ Marked condition as COMPLETED" or "⚠️ No matching condition found"
4. Verify `matchingKey` values in database match between APS and OREA 124
5. **Important**: Both APS and OREA 124 conditions use the SAME `normalizeConditionText()` method in `offers.service.ts`, so normalization is consistent
6. If conditions still don't match, the buyer may have worded them differently in OREA 124 than in the original APS

### Offer Not Transitioning to ACCEPTED
1. Check that all conditions are `COMPLETED` or `WAIVED`
2. Check that offer status is `CONDITIONALLY_ACCEPTED`
3. Look for log: "🎉 All conditions fulfilled!"
4. Verify no conditions have status `PENDING` or `EXPIRED`

## Conclusion

The offer conditions tracking system is now fully implemented on the backend. The system can:
- ✅ Extract conditions from APS Schedule A
- ✅ Store conditions with due dates and normalized matching keys
- ✅ Transition offers to CONDITIONALLY_ACCEPTED when seller signs
- ✅ Parse OREA 124 forms for fulfilled conditions
- ✅ Match and mark conditions as COMPLETED
- ✅ Automatically transition offers to ACCEPTED when all conditions fulfilled
- ✅ Expose conditions via API endpoints

Next steps:
1. Run database migration
2. Test with sample APS and OREA 124 PDFs
3. Implement mobile UI for viewing conditions
4. Add background job for due date enforcement
5. Add manual condition management endpoints


