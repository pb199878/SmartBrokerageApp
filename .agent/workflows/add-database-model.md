---
description: Add a new database model to the Prisma schema
---

# Add New Database Model

## Steps

1. **Update Schema**: Edit `packages/api/prisma/schema.prisma`

   - Use snake_case for table names
   - Add appropriate relations

2. **Generate Client**:
   // turbo

```bash
cd packages/api && npx prisma generate
```

3. **Create Migration**:

```bash
cd packages/api && npx prisma migrate dev --name add_<model_name>
```

4. **Add Types**: Create/update types in `packages/shared/src/types/`

   - Use interfaces for object shapes
   - Use enums for status/category fields

5. **Create Service Methods**: Add CRUD operations to appropriate service

6. **Restart TypeScript Server** (Cmd+Shift+P → "TypeScript: Restart TS Server")

## Naming Conventions

- Database tables: `snake_case`
- TypeScript interfaces: `PascalCase`
- Service methods: `camelCase`
