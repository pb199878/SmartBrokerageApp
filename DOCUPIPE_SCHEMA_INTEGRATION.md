# DocuPipe Schema Standardization Integration

## Overview

This document describes the integration of DocuPipe's schema-based standardization workflow for extracting data from OREA Form 100 (Agreement of Purchase and Sale) documents.

## What Changed

### Previous Workflow (Generic Extraction)
```
1. Upload PDF → Get jobId
2. Poll job status
3. Get extraction results (no schema)
```

### New Workflow (Schema-Based Standardization)
```
1. Upload PDF → Get jobId + documentId
2. Poll job status (document parsing)
3. Standardize with schema → Get standardizationJobId + standardizationIds
4. Poll standardization job status
5. Get standardization results (structured according to schema)
```

## Benefits of Schema-Based Extraction

1. **Consistent Structure**: All documents are extracted into the same standardized schema ("APS Schema V2")
2. **Higher Accuracy**: DocuPipe applies your custom schema rules and field mappings
3. **Better Validation**: Schema ensures all required fields are properly extracted
4. **Future-Proof**: Update the schema without changing code

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Required: Your DocuPipe API key
DOCUPIPE_API_KEY="your-api-key-here"

# Optional: DocuPipe API URL (defaults to https://app.docupipe.ai)
DOCUPIPE_API_URL="https://app.docupipe.ai"

# Schema Configuration (choose one):
# Option 1: Use schema ID (faster, no API lookup)
DOCUPIPE_SCHEMA_ID="your-aps-schema-v2-id"

# Option 2: Use schema name (auto-resolves ID from DocuPipe)
DOCUPIPE_SCHEMA_NAME="APS Schema V2"
```

### Schema Configuration Options

You have **two ways** to configure the schema:

#### Option 1: Schema ID (Recommended for Production)
- **Faster**: No API call needed to resolve the ID
- **More stable**: Won't break if schema name changes
- Get it from DocuPipe dashboard → Schemas → Copy ID

#### Option 2: Schema Name (Easier for Setup)
- **Simpler**: Just use the schema name (e.g., "APS Schema V2")
- **Auto-resolves**: Automatically looks up the ID from DocuPipe
- **Cached**: ID is cached after first lookup (no repeated API calls)
- **Fallback**: Default is "APS Schema V2" if neither ID nor name is set

**How it works:**
1. First document upload → Calls DocuPipe `/schema` endpoint
2. Finds schema by name (case-insensitive match)
3. Caches the ID for future uploads
4. Uses cached ID for all subsequent uploads (no more API calls)

If schema is not found, you'll see:
```
⚠️  Schema "Your Schema Name" not found in DocuPipe
Available schemas: Schema 1, Schema 2, APS Schema V2
```

## Database Migration

New fields have been added to the `DocumentAnalysis` model:

```prisma
model DocumentAnalysis {
  // ... existing fields ...
  
  docupipeJobId            String?  // DocuPipe job ID for reference
  docupipeDocumentId       String?  // DocuPipe document ID (for standardization workflow)
  docupipeStandardizationId String? // DocuPipe standardization ID (when using schema)
  formFieldsExtracted      Json?    // Raw DocuPipe form fields (full response)
}
```

**To apply the migration:**

**Important:** If using Supabase, ensure your `DATABASE_URL` ends with `?sslmode=require`:

```bash
# Example:
DATABASE_URL="postgresql://postgres.xxxxx:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require"
```

Then run the migration:

```bash
cd packages/api
npx prisma migrate dev --name add_docupipe_standardization_fields
```

Or in production:
```bash
npx prisma migrate deploy
```

**If you get SSL/TLS errors:** Make sure your DATABASE_URL includes `?sslmode=require` at the end.

## Code Changes

### 1. New Types (`packages/api/src/common/docupipe/types.ts`)

Added interfaces for standardization workflow:

```typescript
export interface DocuPipeStandardizeResponse {
  jobId: string;
  standardizationIds: string[];
}

export interface DocuPipeStandardizationResult {
  standardizationId: string;
  documentId: string;
  schemaId: string;
  data: DocuPipeOREAForm100Response;
  status: 'completed';
}
```

### 2. New Service Methods (`packages/api/src/common/docupipe/docupipe.service.ts`)

#### `listSchemas()`
Lists all available schemas in your DocuPipe account.

```typescript
const schemas = await this.docuPipeService.listSchemas();
// Returns array directly: [{ id, name, description, ... }, ...]
```

#### `findSchemaIdByName(name)`
Automatically finds a schema ID by name (case-insensitive).

```typescript
const schemaId = await this.docuPipeService.findSchemaIdByName("APS Schema V2");
// Returns schema ID or null if not found
```

#### `getSchemaId(providedSchemaId?)`
Smart method that resolves schema ID in this priority:
1. Provided schema ID parameter
2. `DOCUPIPE_SCHEMA_ID` env var
3. Cached schema ID (from previous lookup)
4. Auto-resolve from `DOCUPIPE_SCHEMA_NAME`

```typescript
const schemaId = await this.docuPipeService.getSchemaId();
// Automatically resolves and caches the ID
```

#### `standardizeDocuments(documentIds, schemaId?)`
Standardizes one or more documents using the configured schema.

```typescript
const { jobId, standardizationIds } = await this.docuPipeService.standardizeDocuments(
  [documentId],
  'your-schema-id' // optional, auto-resolves if not provided
);
```

#### `getStandardizationResults(standardizationId)`
Retrieves the standardized data after the standardization job completes.

```typescript
const data = await this.docuPipeService.getStandardizationResults(standardizationId);
```

### 3. Updated Main Workflow (`analyzeAndExtract`)

The main `analyzeAndExtract` method now:
- Automatically uses standardization if `DOCUPIPE_SCHEMA_ID` or `DOCUPIPE_SCHEMA_NAME` is configured
- Auto-resolves schema ID from name if needed (with caching)
- Falls back to legacy extraction if schema is not configured or lookup fails
- Returns `documentId` and `standardizationId` for tracking

```typescript
const result = await this.docuPipeService.analyzeAndExtract(pdfBuffer, filename);
// result = { jobId, documentId, standardizationId, extractedData, rawResponse }
```

## How It Works

### With Schema Configured

When `DOCUPIPE_SCHEMA_ID` or `DOCUPIPE_SCHEMA_NAME` is set, the system:

1. **Uploads** the PDF to DocuPipe
2. **Waits** for document parsing to complete
3. **Standardizes** the document using your schema
4. **Waits** for standardization to complete
5. **Retrieves** the standardized data
6. **Extracts** offer data and validates
7. **Stores** all IDs in the database for reference

Console output (with schema ID):
```
✓ Using schema ID: your-schema-id
📤 Uploading PDF to DocuPipe.ai...
✅ DocuPipe upload successful. Job ID: xxx, Document ID: yyy
🔍 Using standardization workflow with schema...
📊 Standardizing 1 document(s) with schema: your-schema-id...
✅ Standardization job created. Job ID: zzz
✅ Standardization workflow complete
✅ DocuPipe extraction complete. Validation: passed (using schema)
```

Console output (with schema name - first upload):
```
✓ Will auto-resolve schema by name: "APS Schema V2"
📤 Uploading PDF to DocuPipe.ai...
✅ DocuPipe upload successful. Job ID: xxx, Document ID: yyy
🔍 Using standardization workflow with schema...
🔍 Looking up schema ID for: "APS Schema V2"
✅ Found schema: "APS Schema V2" (ID: abc123...)
📊 Standardizing 1 document(s) with schema: abc123...
✅ Standardization job created. Job ID: zzz
✅ Standardization workflow complete
✅ DocuPipe extraction complete. Validation: passed (using schema)
```

Console output (with schema name - subsequent uploads):
```
✓ Will auto-resolve schema by name: "APS Schema V2"
📤 Uploading PDF to DocuPipe.ai...
✅ DocuPipe upload successful. Job ID: xxx, Document ID: yyy
🔍 Using standardization workflow with schema...
📊 Standardizing 1 document(s) with schema: abc123... (cached)
✅ Standardization workflow complete
✅ DocuPipe extraction complete. Validation: passed (using schema)
```

### Without Schema (Fallback)

If neither `DOCUPIPE_SCHEMA_ID` nor `DOCUPIPE_SCHEMA_NAME` is set:

1. **Uploads** the PDF
2. **Waits** for parsing
3. **Retrieves** generic extraction results (no schema)

Console output:
```
⚠️  DOCUPIPE_SCHEMA_ID not set - using generic extraction
⚠️  No schema configured, using legacy extraction
```

## API Reference

Based on [DocuPipe Documentation](https://docs.docupipe.ai/reference/upload-and-standardize-multiple)

### Upload Document
```typescript
POST /document
Body: {
  document: {
    file: {
      contents: "<base64-encoded-pdf>",
      filename: "offer.pdf"
    }
  }
}
Response: { jobId, documentId }
```

### Standardize Batch
```typescript
POST /v2/standardize/batch
Body: {
  schemaId: "your-schema-id",
  documentIds: ["doc-id-1", "doc-id-2"]
}
Response: { jobId, standardizationIds }
```

### Get Standardization Results
```typescript
GET /standardization/{standardizationId}
Response: {
  standardizationId,
  documentId,
  schemaId,
  data: { /* structured data matching your schema */ }
}
```

## Testing

1. **Add your schema ID** to `.env`:
   ```bash
   DOCUPIPE_SCHEMA_ID="your-actual-schema-id"
   ```

2. **Restart the API server**:
   ```bash
   npm run dev
   ```

3. **Upload an APS document** via email or API

4. **Check logs** for standardization workflow messages

5. **Verify database** has `docupipeStandardizationId` populated

## Troubleshooting

### TypeScript Errors After Schema Changes

If you see TypeScript errors about missing fields:

1. **Restart TypeScript Server** in VS Code:
   - Press `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows)
   - Type: `TypeScript: Restart TS Server`
   - Press Enter

2. **Regenerate Prisma Client**:
   ```bash
   cd packages/api
   npx prisma generate
   ```

### Schema Not Being Used

Check that:
- `DOCUPIPE_SCHEMA_ID` is set in your `.env`
- The schema ID is correct (check DocuPipe dashboard)
- The API server has been restarted after adding the variable

### Validation Failures

If documents fail validation:
- Check that your schema matches the OREA Form 100 structure
- Verify required fields are mapped correctly in DocuPipe
- Review the `validationErrors` field in the database for details

## Migration Notes

- **Backward Compatible**: Existing code continues to work
- **Opt-In**: Set `DOCUPIPE_SCHEMA_ID` to enable standardization
- **Database Fields**: New fields are optional (nullable)
- **No Breaking Changes**: Legacy extraction still available via `analyzeAndExtractLegacy()`

## Next Steps

### Quick Setup (Using Schema Name)

1. **Just set your API key** in `.env`:
   ```bash
   DOCUPIPE_API_KEY="your-api-key-here"
   DOCUPIPE_SCHEMA_NAME="APS Schema V2"  # Or your schema name
   ```

2. **Run database migration**:
   ```bash
   cd packages/api
   npx prisma migrate dev --name add_docupipe_standardization_fields
   ```

3. **Restart your API server** and upload a test document

The system will automatically:
- Look up the schema ID from DocuPipe
- Cache it for future uploads
- Use it for all document standardization

### Production Setup (Using Schema ID)

For better performance in production, use the schema ID directly:

1. **Get your schema ID** from DocuPipe dashboard
2. **Set it in `.env`**:
   ```bash
   DOCUPIPE_SCHEMA_ID="your-schema-id-here"
   ```

This skips the lookup step and is slightly faster.

## References

- [DocuPipe Documentation](https://docs.docupipe.ai/reference/upload-and-standardize-multiple)
- [DocuPipe Schema Guide](https://docs.docupipe.ai)
- [OREA Form 100 Specification](https://www.orea.com)

