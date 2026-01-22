---
description: Run Prisma migrations after schema changes
---

# Prisma Schema Migration

Use this workflow after modifying `packages/api/prisma/schema.prisma`.

## Steps

// turbo

1. Generate Prisma client:

```bash
cd packages/api && npx prisma generate
```

// turbo 2. Create and apply migration:

```bash
cd packages/api && npx prisma migrate dev --name <migration_name>
```

3. **Important**: Restart TypeScript Server in your editor:

   - Press `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows)
   - Type: `TypeScript: Restart TS Server`
   - Press Enter

4. If types still show errors, reload the editor window.
