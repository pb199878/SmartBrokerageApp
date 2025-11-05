# Auto-Resolution of DocuPipe Schema by Name ✨

## What Changed

Previously, you had to manually configure the schema ID:
```bash
DOCUPIPE_SCHEMA_ID="abc123-def456-ghi789"  # Hard to remember!
```

**Now**, you can just use the schema name:
```bash
DOCUPIPE_SCHEMA_NAME="APS Schema V2"  # Much easier!
```

## How It Works

### First Document Upload
1. System sees `DOCUPIPE_SCHEMA_NAME="APS Schema V2"`
2. Calls DocuPipe API: `GET /schema` to list all schemas
3. Searches for schema with matching name (case-insensitive)
4. **Caches the ID** in memory
5. Uses it for standardization

### Subsequent Document Uploads
1. System checks cache for schema ID
2. Uses cached ID immediately
3. **No additional API calls needed**

## Configuration Priority

The system checks in this order:

1. **Provided parameter** (when calling methods directly)
2. **`DOCUPIPE_SCHEMA_ID`** env var (if set)
3. **Cached ID** (from previous schema name lookup)
4. **`DOCUPIPE_SCHEMA_NAME`** env var → auto-resolves ID
5. **Default**: `"APS Schema V2"` if neither ID nor name is set

## Benefits

✅ **No manual ID lookup** - Just use the schema name  
✅ **Cached for performance** - Only one API call per server restart  
✅ **Helpful error messages** - Shows available schemas if not found  
✅ **Backward compatible** - Schema ID still works (and is faster)  
✅ **Automatic fallback** - Uses legacy extraction if schema not found  

## New Methods Added

### `listSchemas()`
```typescript
const schemas = await docuPipeService.listSchemas();
// Calls: GET /schemas
// Returns array directly (no wrapper object)
console.log(schemas); // [{ id, name, description }, ...]
```

### `findSchemaIdByName(name)`
```typescript
const id = await docuPipeService.findSchemaIdByName("APS Schema V2");
// Returns: "abc123-def456..." or null
```

### `getSchemaId(providedId?)`
```typescript
// Auto-resolves using priority order above
const id = await docuPipeService.getSchemaId();
```

## Example Console Output

### When Schema is Found
```
✓ DocuPipe.ai integration enabled
✓ Will auto-resolve schema by name: "APS Schema V2"
📤 Uploading PDF to DocuPipe.ai...
✅ DocuPipe upload successful. Job ID: xxx, Document ID: yyy
🔍 Using standardization workflow with schema...
🔍 Looking up schema ID for: "APS Schema V2"
✅ Found schema: "APS Schema V2" (ID: abc123...)
📊 Standardizing 1 document(s) with schema: abc123...
✅ Standardization job created
✅ Standardization workflow complete
```

### When Schema is Not Found
```
🔍 Looking up schema ID for: "My Wrong Schema"
⚠️  Schema "My Wrong Schema" not found in DocuPipe
Available schemas: APS Schema V2, Amendment Schema, Waiver Schema
❌ Standardization failed, falling back to legacy extraction
```

## Quick Setup

**If your DocuPipe plan supports listing schemas:**

```bash
DOCUPIPE_API_KEY="your-api-key"
DOCUPIPE_SCHEMA_NAME="APS Schema V2"
```

**If you get HTTP 405 errors (schema listing not supported):**

```bash
DOCUPIPE_API_KEY="your-api-key"
DOCUPIPE_SCHEMA_ID="your-actual-schema-id"  # Get from DocuPipe dashboard
```

The system will:
1. Try to list schemas via `GET /schemas`
2. If that fails with 405, fall back to requiring `DOCUPIPE_SCHEMA_ID`
3. If no schema configured, use legacy extraction (no schema)

## Production Recommendation

For production, use the schema ID for slightly better performance:

```bash
DOCUPIPE_SCHEMA_ID="abc123-def456-ghi789"
```

This skips the lookup step entirely (saves ~100ms per server restart).

## Database URL SSL Flag

Don't forget to add the SSL flag to your Supabase connection:

```bash
DATABASE_URL="postgresql://postgres.xxx:[PASSWORD]@db.xxx.supabase.co:5432/postgres?sslmode=require"
```

Without `?sslmode=require`, migrations will fail with TLS errors.

