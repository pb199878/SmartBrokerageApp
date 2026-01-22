---
description: Add a new API endpoint to the NestJS backend
---

# Add New API Endpoint

## Checklist

1. **Controller**: Add route handler to appropriate controller in `packages/api/src/`

   - Controllers handle HTTP only
   - Use appropriate decorators (`@Get`, `@Post`, etc.)
   - Return consistent response shape: `{ success: boolean, data?: T, error?: string }`

2. **Service**: Implement business logic in the corresponding service

   - Use `PrismaService` for database operations
   - Handle null cases
   - Use transactions for multi-step operations

3. **Mobile Client**: Add API method to `packages/mobile/src/services/api.ts`

4. **React Query**: Create hook in the mobile screen that uses the new endpoint

5. **Types**: If new data shapes are needed, add to `packages/shared/src/types/`

## Code Patterns

### Controller Example

```typescript
@Get(':id')
async getById(@Param('id') id: string) {
  const data = await this.service.findById(id);
  return { success: true, data };
}
```

### Service Example

```typescript
async findById(id: string) {
  return this.prisma.model.findUnique({ where: { id } });
}
```
