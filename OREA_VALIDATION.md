# OREA Form Validation & Data Extraction

## Overview

Comprehensive OREA Form 100 validation and data extraction using DocuPipe.ai. Automatically validates buyer offers, extracts detailed form data, and rejects invalid submissions with email notifications.

## Features

### 1. Comprehensive Data Extraction

Extracts 20+ fields from OREA Form 100 using DocuPipe.ai:

**Financial Details**:
- Purchase Price
- Deposit Amount
- Deposit Timing (Herewith, Upon Acceptance, etc.)

**Dates**:
- Closing Date
- Irrevocability Date (offer expiry)
- Possession Date

**Buyer Information**:
- Buyer Name(s)
- Buyer Address
- Buyer Phone
- Buyer Email

**Buyer's Lawyer**:
- Lawyer Name
- Lawyer Address
- Lawyer Phone
- Lawyer Email

**Property & Terms**:
- Property Address
- Inclusions (chattels included)
- Exclusions (fixtures excluded)
- Conditions (from Schedule A)

**Agent Information**:
- Buyer Agent Name
- Buyer Brokerage Name

**Signatures**:
- Buyer Signature Detection
- Signature Dates

### 2. Automatic Validation

Validates OREA forms before creating offers:

**Validation Rules**:
- ✅ Buyer signature(s) must be present
- ✅ Purchase price must be filled in and > $0
- ✅ Deposit amount must be specified
- ✅ Closing date must be filled in
- ✅ Buyer name must be specified

**Validation Status**:
- `passed` - All validation checks passed, offer created
- `failed` - Validation failed, offer rejected with email notification
- `not_validated` - DocuPipe not configured, basic extraction only

### 3. Auto-Rejection Flow

Invalid offers are automatically rejected:

1. **Validation Check**: After DocuPipe extraction, form is validated
2. **Rejection Email**: If validation fails, buyer agent receives detailed email
3. **No Offer Created**: Invalid offers are NOT created in the database
4. **Error Logging**: All validation errors logged for debugging

**Rejection Email Template**:
```
Subject: Offer Submission Issue - [Property Address]

Dear Agent,

Your offer submission for [Property Address] could not be accepted due to 
the following validation issues:

❌ signatures.buyer: Buyer signature is required
❌ financialDetails.purchasePrice: Purchase price must be filled in

Please ensure:
✓ All buyer signatures are present
✓ Purchase price is filled in
✓ All required fields are completed

Reply to this email with the corrected OREA Form 100.
```

### 4. Mobile App Integration

ApsReviewScreen now displays real extracted data:

**Before**: Mock/hard-coded data
**After**: Real data from DocuPipe extraction

All buyer offer details are automatically populated from the extracted form data.

## Architecture

### Database Schema

**DocumentAnalysis model** (extended):
```prisma
model DocumentAnalysis {
  // ... existing fields
  
  // Validation fields
  validationStatus       String?  // 'passed', 'failed', 'not_validated'
  validationErrors       Json?    // Array of {field, message}
  hasRequiredSignatures  Boolean? // Buyer signatures detected
  priceMatchesExtracted  Boolean? // Price filled correctly
  docupipeJobId          String?  // DocuPipe job ID
  formFieldsExtracted    Json?    // Raw DocuPipe response
}
```

### Services

**DocuPipeService** (`packages/api/src/common/docupipe/`):
- Uploads PDF to DocuPipe.ai
- Polls for processing completion
- Retrieves extraction results
- Maps DocuPipe schema to our data structure

**DocumentsService** (`packages/api/src/modules/documents/documents.service.ts`):
- Integrates DocuPipe for OREA forms
- Calls `validateOREAForm()` method
- Stores validation results

**OffersService** (`packages/api/src/modules/offers/offers.service.ts`):
- Checks validation status before creating offer
- Calls `autoRejectInvalidOffer()` if validation fails
- Sends rejection email to buyer agent

## Setup

### 1. Environment Variables

Add to `.env`:
```bash
# DocuPipe.ai Configuration
DOCUPIPE_API_KEY=your_docupipe_api_key
DOCUPIPE_API_URL=https://api.docupipe.ai  # Optional, defaults to this
```

### 2. DocuPipe.ai Schema Setup

**Manual Step** - Configure OREA Form 100 schema in DocuPipe.ai dashboard:

1. Log into DocuPipe.ai
2. Create new schema for "OREA Form 100"
3. Define all fields matching the schema (see plan for full field list)
4. Save and note the Schema ID

The schema should match the structure documented in:
`packages/api/src/common/docupipe/types.ts`

### 3. Database Migration

Already applied via:
```bash
npx prisma migrate dev --name add_validation_fields_to_document_analysis
```

### 4. Dependencies

DocuPipe uses standard HTTP REST API (axios):
```bash
cd packages/api
npm install  # axios should already be installed
```

## Usage

### Automatic Flow

1. **Email Received**: Buyer agent emails OREA Form 100 to listing email
2. **PDF Analysis**: System detects OREA form via pdf-parse
3. **DocuPipe Extraction**: PDF sent to DocuPipe for comprehensive extraction
4. **Validation**: Form validated against requirements
5. **Decision**:
   - **Valid**: Offer created, seller can review in mobile app
   - **Invalid**: Rejection email sent, NO offer created

### Manual Testing

Run the test script:
```bash
./test-orea-validation.sh
```

Test scenarios:
1. Valid form - all fields filled
2. Missing buyer signature
3. Blank purchase price
4. Missing deposit
5. Missing closing date
6. Missing buyer name

## Validation Errors

Common validation errors and solutions:

| Error | Field | Solution |
|-------|-------|----------|
| Buyer signature is required | signatures.buyer | Ensure buyer has signed the form |
| Purchase price must be filled in | financialDetails.purchasePrice | Fill in the purchase price field |
| Deposit amount must be specified | financialDetails.deposit | Fill in the deposit amount |
| Closing date must be specified | terms.completion.date | Fill in the closing/completion date |
| Buyer name must be specified | parties.buyer | Fill in buyer name(s) |

## Monitoring

### Backend Logs

Watch for these log messages:

**Success**:
```
✅ DocuPipe extraction complete. Validation: passed
✅ Created offer [offer-id] from message [message-id]
```

**Validation Failure**:
```
❌ OREA Form validation failed with 2 error(s):
   - signatures.buyer: Buyer signature is required
   - financialDetails.purchasePrice: Purchase price must be filled in
❌ Offer validation failed. Auto-rejecting...
📧 Sending rejection email for invalid offer...
✅ Rejection email sent to agent@example.com
```

**DocuPipe Disabled**:
```
⚠️  DocuPipe not configured, using basic extraction only
```

### Database Queries

Check validation results:
```sql
-- Get recent document analyses with validation status
SELECT 
  id, 
  form_type, 
  validation_status, 
  validation_errors,
  has_required_signatures,
  price_matches_extracted
FROM document_analyses
WHERE orea_form_detected = true
ORDER BY created_at DESC
LIMIT 10;

-- Get rejected offers (validation failed)
SELECT 
  m.id as message_id,
  m.subject,
  m.from_email,
  da.validation_errors
FROM messages m
JOIN attachments a ON a.id = (
  SELECT id FROM attachments WHERE message_id = m.id LIMIT 1
)
JOIN document_analyses da ON da.id = a.document_analysis_id
WHERE da.validation_status = 'failed'
ORDER BY m.created_at DESC;
```

## Troubleshooting

### Issue: DocuPipe not extracting data

**Symptoms**: Validation status is `not_validated`, extraction is basic only

**Solutions**:
1. Check `DOCUPIPE_API_KEY` is set in `.env`
2. Verify API key is valid
3. Check backend logs for DocuPipe errors
4. Ensure PDF is valid OREA Form 100

### Issue: All forms failing validation

**Symptoms**: All OREA forms marked as `failed`

**Solutions**:
1. Check DocuPipe schema is configured correctly
2. Verify field mappings in `DocuPipeService.extractComprehensiveOfferData()`
3. Test with known-good OREA Form 100 PDF
4. Check validation logic in `DocumentsService.validateOREAForm()`

### Issue: Rejection emails not sending

**Symptoms**: Validation fails but no email sent

**Solutions**:
1. Check `MAILGUN_API_KEY` is configured
2. Verify `MAILGUN_DOMAIN` is set
3. Check backend logs for email errors
4. Ensure sender email exists in database

## Future Enhancements

Potential improvements:

1. **Multiple Form Types**: Extend validation to Forms 120, 221, 123, etc.
2. **Seller Signature Validation**: Validate seller signatures on accepted offers
3. **Conditional Validation**: Validate conditions in Schedule A
4. **Price Reasonability Check**: Flag if price is significantly off market value
5. **Manual Override**: Allow sellers to accept flagged offers
6. **Validation Dashboard**: Admin view of all validation results

## Files Modified

**Backend**:
- `packages/api/prisma/schema.prisma` - Added validation fields
- `packages/api/src/common/docupipe/docupipe.service.ts` - NEW
- `packages/api/src/common/docupipe/docupipe.module.ts` - NEW
- `packages/api/src/common/docupipe/types.ts` - NEW
- `packages/api/src/modules/documents/documents.service.ts` - DocuPipe integration
- `packages/api/src/modules/documents/documents.module.ts` - Import DocuPipeModule
- `packages/api/src/modules/offers/offers.service.ts` - Auto-rejection logic

**Mobile**:
- `packages/mobile/src/screens/ApsReviewScreen.tsx` - Use real extracted data

**Testing**:
- `test-orea-validation.sh` - Test script and documentation

## Success Criteria

✅ Valid OREA forms with signatures + price → offers created
✅ Missing buyer signatures → auto-rejected with email
✅ Blank/missing purchase price → auto-rejected with email
✅ Validation results stored in database for audit
✅ All buyer offer fields extracted via DocuPipe (20+ fields)
✅ Mobile ApsReviewScreen displays real extracted data
✅ No mock data in production
✅ Buyer info, lawyer info, conditions, inclusions all populated
✅ Valid email → DocuPipe → validation passes → offer created → mobile displays data
✅ Invalid email → validation fails → rejection email → no offer created

## Support

For issues or questions:
1. Check this documentation
2. Review backend logs
3. Run test script: `./test-orea-validation.sh`
4. Check DocuPipe.ai dashboard for processing status

