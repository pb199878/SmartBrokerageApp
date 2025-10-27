# Attachment Testing Guide

## Overview

The attachment system filters irrelevant files BEFORE downloading to save S3 storage space and bandwidth. This document explains the filtering logic and how to test it.

## Filtering Rules

### ✅ DOWNLOADED (Relevant Attachments)

Files that pass ALL these checks are downloaded:

1. **PDFs > 100KB** - Likely important documents
2. **Files with priority keywords** in filename:
   - "offer", "aps", "form", "agreement", "amendment", "schedule", "contract"
3. **Not matching exclusion criteria** (see below)

### ❌ FILTERED (Irrelevant Attachments)

Files matching ANY of these criteria are skipped:

1. **Signature images**: < 50KB PNG/JPG/JPEG with keywords:
   - "signature", "logo", "banner", "icon"

2. **Disclaimer files**: Filename contains:
   - "disclaimer", "notice", "footer", "confidentiality"

3. **Very small files**: < 10KB non-PDF files
   - Likely not important documents

## Test Coverage

### Test Script: `./test-email-routing-attachments.sh`

**12 comprehensive tests** covering:

| Test | Description | Expected Result | File Size | Type |
|------|-------------|-----------------|-----------|------|
| 1 | OREA Form PDF | ✅ Download | 425 KB | PDF |
| 2 | Signature image | ❌ Filter | 15 KB | PNG |
| 3 | Company logo | ❌ Filter | 22 KB | PNG |
| 4 | Disclaimer text | ❌ Filter | 8.5 KB | TXT |
| 5 | Mixed attachments | ⚖️ Partial (2/4) | Various | Mixed |
| 6 | Very small file | ❌ Filter | 3 KB | TXT |
| 7 | Large offer PDF | ✅ Download (priority) | 520 KB | PDF |
| 8 | Missing content-type | ✅ Handle gracefully | 150 KB | PDF |
| 9 | Missing size | ✅ Handle gracefully | Unknown | PDF |
| 10 | Special characters | ✅ Handle gracefully | 280 KB | PDF |
| 11 | Confidentiality notice | ❌ Filter | 25 KB | PDF |
| 12 | Icon image | ❌ Filter | 8 KB | PNG |

## Running Tests

### Prerequisites

1. Start the API server:
   ```bash
   cd packages/api
   npm run dev
   ```

2. Ensure database is seeded:
   ```bash
   npm run prisma:seed
   ```

### Run Attachment Tests

```bash
./test-email-routing-attachments.sh
```

### Verify Results

#### 1. Check API Logs

Look for filtering messages:
```
⏭️  Skipping signature/logo: agent_signature.png
⏭️  Skipping disclaimer: email_disclaimer.txt
⏭️  Skipping small file: note.txt
```

Look for download confirmations:
```
📎 Downloading attachment: APS_Form_100.pdf
✅ Uploaded attachment to: attachments/{listingId}/{threadId}/{messageId}/APS_Form_100.pdf
```

#### 2. Query Attachments

```bash
# Get all threads with attachments
curl http://localhost:3000/threads | jq '.data[] | select(.messages[].attachments != null)'

# Count attachments (should be ~7 from tests)
curl http://localhost:3000/threads | jq '[.data[].messages[].attachments[]] | length'
```

#### 3. Check Database

Open Prisma Studio:
```bash
cd packages/api
npm run prisma:studio
```

Navigate to `attachments` table - should see ~7 records:
- `APS_Form_100_123_Main_Street.pdf`
- `APS_Form_100.pdf`
- `Schedule_A.pdf`
- `Offer_Agreement_123_Main_St.pdf`
- `document.pdf`
- `Amendment_Form_120.pdf`
- `Offer - Client's Property (2024).pdf`

#### 4. Verify Supabase Storage

Check the `attachments` bucket in Supabase:
```
attachments/
  └── {listingId}/
      └── {threadId}/
          └── {messageId}/
              ├── APS_Form_100_123_Main_Street.pdf
              ├── APS_Form_100.pdf
              ├── Schedule_A.pdf
              └── ...
```

## Prioritization Logic

Downloaded attachments are prioritized in this order:

1. **High Priority (+10 points)**: "offer", "aps", "form", "agreement", "amendment", "schedule"
2. **Medium Priority (+5 points)**: "contract", "document", "signed"
3. **PDF Bonus (+8 points)**: application/pdf content type
4. **Size Bonus (+3 points)**: Files > 100KB

Example priority calculation:
```
"Offer_Agreement_123_Main_St.pdf" = 10 (offer) + 10 (agreement) + 8 (PDF) + 3 (size) = 31 points
"Schedule_A.pdf" = 10 (schedule) + 8 (PDF) + 3 (size) = 21 points
"document.pdf" = 5 (document) + 8 (PDF) + 3 (size) = 16 points
```

Attachments are downloaded in priority order (highest first).

## Edge Cases Handled

### 1. Missing Content-Type
- Defaults to `application/octet-stream`
- Still processes based on filename and size

### 2. Missing Size
- Defaults to `0`
- Still downloads if filename has priority keywords

### 3. Special Characters in Filename
- Handled gracefully by Supabase Storage
- S3 keys preserve special characters

### 4. Network Failures
- Individual attachment failures don't stop processing
- Error logged, continues with remaining attachments

### 5. Invalid URLs
- Caught by axios, logged as error
- Other attachments in same email still processed

## Production Considerations

### Mailgun Webhook Format

Real Mailgun payloads look like this:
```json
{
  "attachments": [
    {
      "filename": "APS_Form_100.pdf",
      "content-type": "application/pdf",
      "size": 425000,
      "url": "https://storage.mailgun.net/v3/domains/mg.yourapp.ca/messages/WyJhMjk..."
    }
  ]
}
```

The `url` is a **temporary signed URL** that expires after a few minutes. Our system:
1. Immediately downloads from Mailgun URL
2. Uploads to our Supabase Storage (permanent)
3. Stores S3 key in database
4. Generates our own signed URLs on demand

### Performance

- **Filtering**: < 1ms (no network calls)
- **Downloading**: ~100-500ms per file (depends on size and network)
- **Total processing**: Typically < 2 seconds for email with 3 attachments

### Storage Savings

Typical email with offer:
- **Without filtering**: 450 KB (all attachments)
- **With filtering**: 380 KB (OREA form only)
- **Savings**: 15.5% per email

Over 1000 emails/month:
- **Without filtering**: ~450 MB
- **With filtering**: ~380 MB
- **Monthly savings**: ~70 MB (~15%)

## Troubleshooting

### No attachments downloaded

1. Check API logs for filtering messages
2. Verify attachment has valid URL in webhook payload
3. Check Supabase credentials in `.env`
4. Test Supabase connection: `npm run test:supabase`

### All attachments filtered

1. Check filtering logic in `attachments.service.ts`
2. Verify filename doesn't match exclusion keywords
3. Check file size (should be > 10KB for non-PDFs)

### Download fails

1. Check network connectivity
2. Verify Mailgun URL is valid and not expired
3. Check Supabase bucket permissions
4. Review error logs for specific failure reason

