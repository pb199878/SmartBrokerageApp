---
description: Seed the database with sample listings and test data
---

# Seed Database

This workflow seeds the database with sample listings for testing.

## Sample Data Created

- **Listing 1**: `l-abc123@inbox.yourapp.ca` (123 Main Street, Toronto)
- **Listing 2**: `l-xyz789@inbox.yourapp.ca` (456 Oak Avenue, Ottawa)
- Sample buyer agent senders

## Steps

// turbo

1. Run the seed command:

```bash
cd packages/api && npm run prisma:seed
```
