# DocuPipe API Workflow - Complete Reference

## Overview

This document describes the complete API workflow for uploading, standardizing, and retrieving OREA form data from DocuPipe.

## Complete Workflow

```
1. Upload Document    → Get jobId + documentId
2. Poll Job Status    → Wait for parsing to complete
3. Standardize        → Get standardization jobId + standardizationIds
4. Poll Job Status    → Wait for standardization to complete
5. Get Results        → Retrieve extracted schema data
```

---

## Step 1: Upload Document

### Request
```typescript
POST /document
Content-Type: application/json

{
  "document": {
    "file": {
      "contents": "<base64-encoded-pdf>",
      "filename": "offer.pdf"
    }
  }
}
```

### Response (`DocuPipeUploadResponse`)
```typescript
{
  jobId: "job-abc123",           // Poll this for upload status
  documentId: "doc-xyz789",      // Use this for standardization
  status: "processing"
}
```

---

## Step 2: Poll Job Status (Upload)

### Request
```typescript
GET /job/{jobId}
```

### Response (`DocuPipeJobStatusResponse`)
```typescript
{
  jobId: "job-abc123",
  status: "processing" | "completed" | "failed" | "error",
  progress?: 50,
  error?: "Error message if failed"
}
```

**Keep polling** until `status === "completed"`

---

## Step 3: Standardize with Schema

### Request
```typescript
POST /v2/standardize/batch
Content-Type: application/json

{
  "schemaId": "your-schema-id",
  "documentIds": ["doc-xyz789"]
}
```

### Response (`DocuPipeStandardizeResponse`)
```typescript
{
  jobId: "std-job-456",                    // Poll this for standardization status
  status: "processing",
  timestamp: "2025-11-05T05:12:22.843Z",
  documentCount: 1,
  pageCount: 6,
  standardizationJobIds: ["..."],          // Deprecated
  standardizationIds: ["std-result-789"],  // ← Use these to get results
  details: "Processing 1 document(s)"
}
```

---

## Step 4: Poll Job Status (Standardization)

### Request
```typescript
GET /job/{stdJobId}
```

### Response (`DocuPipeJobStatusResponse`)
```typescript
{
  jobId: "std-job-456",
  status: "completed",  // Wait for this
  progress: 100
}
```

**Keep polling** until `status === "completed"`

---

## Step 5: Get Standardization Results

### Request
```typescript
GET /standardization/{standardizationId}
```

### Response (`DocuPipeStandardizationResult`)
```typescript
{
  standardizationId: "std-result-789",
  documentId: "doc-xyz789",
  schemaId: "your-schema-id",
  schemaName: "APS Schema V2",
  jobId: "std-job-456",
  filename: "offer.pdf",
  displayMode: "auto",
  timestamp: "2025-11-05T05:15:30.123Z",
  dataset: "my-dataset",
  metadata: {},
  
  data: {
    // ← This is the extracted OREA Form 100 data (DocuPipeOREAForm100Response)
    documentInfo: {
      formNumber: "100",
      formTitle: "Agreement of Purchase and Sale",
      organization: "Ontario Real Estate Association",
      jurisdiction: "for use in the Province of Ontario",
      revisionDate: "Revised 2020"
    },
    agreementDate: {
      day: "4th",
      month: "November",
      year: "2025"
    },
    parties: {
      buyer: "Pratyush Bhandari",
      seller: "Neha Mistry"
    },
    property: {
      address: "123 Main Street, Toronto ON M5V 3A8",
      dimensions: {
        frontage: "55 feet",
        depth: "100 feet"
      }
    },
    financialDetails: {
      purchasePrice: {
        amount: 675000,
        currency: "CDN$",
        amountInWords: "six hundred and seventy five thousand"
      },
      deposit: {
        amount: 5000,
        currency: "CDN$",
        payableTo: "Simran Sekhon"
      }
    },
    terms: {
      completion: {
        date: { day: "30th", month: "November", year: "2025" },
        time: "6:00 p.m."
      },
      irrevocability: {
        party: "Seller",
        until: "12 PM",
        date: { day: "11th", month: "November", year: "2025" }
      },
      chattelsIncluded: "Refrigerator, Stove, Dishwasher...",
      fixturesExcluded: "Dining room chandelier..."
    },
    schedules: ["A"],
    signatures: {
      buyer: [],
      seller: []
    },
    brokerageInfo: {
      buyerBrokerage: {
        name: "Neha Realty Inc.",
        phone: "6477722901"
      },
      listingBrokerage: {
        name: "Pratyush Realty Inc.",
        phone: "6475353859"
      }
    },
    acknowledgement: {
      buyer: [{
        date: "Nov 4th, 2026",
        addressForService: "16 Padbury Trail, Brampton ON, Canada L5W1V2"
      }]
    },
    lawyerInfo: {
      buyer: {
        name: "Simran Sekhon",
        address: "45 Susan Fenell Way",
        email: "simran.sekhon14@gmail.com",
        phone: "9057952937"
      }
    },
    notices: {
      buyer: {},
      seller: {}
    }
  }
}
```

---

## Our Implementation Workflow

```typescript
// In docupipe.service.ts → analyzeAndExtract()

// Step 1: Upload
const { jobId, documentId } = await analyzeDocument(pdfBuffer, filename);

// Step 2: Poll upload
await waitForCompletion(jobId);

// Step 3: Standardize with schema
const { jobId: stdJobId, standardizationIds } = await standardizeDocuments([documentId]);

// Step 4: Poll standardization
await waitForCompletion(stdJobId);

// Step 5: Get results
const standardizationId = standardizationIds[0];
const rawResponse = await getStandardizationResults(standardizationId);

// Step 6: Extract and validate
const extractedData = extractComprehensiveOfferData(rawResponse);
```

---

## Key Differences Between Responses

| Field | StandardizeResponse | StandardizationResult |
|-------|-------------------|---------------------|
| **Purpose** | Job metadata | Actual extracted data |
| **When returned** | POST /v2/standardize/batch | GET /standardization/{id} |
| **Contains schema data** | ❌ No | ✅ Yes (in `data` field) |
| **Used for** | Getting standardizationIds | Getting extracted form fields |
| **Has `data` field** | ❌ No | ✅ Yes - the full OREA schema |
| **Has `status`** | ✅ Yes | ❌ No (only in job endpoint) |
| **Has `timestamp`** | ✅ Yes | ✅ Yes |

---

## Error Handling

### HTTP 405 on `/schemas` endpoint

If you get this error:
```
❌ DocuPipe list schemas failed: Request failed with status code 405
   HTTP 405: Method Not Allowed - Your DocuPipe plan might not support listing schemas via API
   Please set DOCUPIPE_SCHEMA_ID directly in your .env file
```

**Solution:** Set schema ID directly instead of using schema name:
```bash
DOCUPIPE_SCHEMA_ID="your-actual-schema-id"
```

### Standardization Job Failed

If standardization fails:
```typescript
{
  jobId: "std-job-456",
  status: "error",
  details: "Schema not found" // or other error
}
```

**Fallback:** System automatically falls back to legacy extraction (no schema)

---

## Testing the Complete Flow

1. **Set your schema ID**:
   ```bash
   DOCUPIPE_API_KEY="your-key"
   DOCUPIPE_SCHEMA_ID="your-schema-id"
   ```

2. **Upload an APS PDF** via email or API

3. **Check logs** for complete workflow:
   ```
   📤 Uploading PDF to DocuPipe.ai...
   ✅ DocuPipe upload successful. Job ID: xxx, Document ID: yyy
   ⏳ DocuPipe still processing... waiting 1000ms
   ✅ DocuPipe processing completed
   🔍 Using standardization workflow with schema...
   📊 Standardizing 1 document(s) with schema: abc123...
   ✅ Standardization job created. Job ID: zzz
   ⏳ DocuPipe still processing... waiting 1000ms
   ✅ DocuPipe processing completed
   📥 Retrieving DocuPipe standardization results...
   ✅ DocuPipe standardization results retrieved
   ✅ Standardization workflow complete
   ✅ DocuPipe extraction complete. Validation: passed (using schema)
   ```

4. **Check database** - `DocumentAnalysis` should have:
   - `docupipeJobId` - Initial upload job
   - `docupipeDocumentId` - Document ID for reference
   - `docupipeStandardizationId` - Standardization result ID
   - `formFieldsExtracted` - Full schema JSON (like you showed)
   - `extractedData` - Flattened offer data

---

## Summary

✅ **Types now correctly match actual DocuPipe API**  
✅ **`DocuPipeStandardizeResponse`** = Job submission response (has `standardizationIds`)  
✅ **`DocuPipeStandardizationResult`** = Extraction results (has `data` with full schema)  
✅ **Ready to use with your schema ID** 🚀

