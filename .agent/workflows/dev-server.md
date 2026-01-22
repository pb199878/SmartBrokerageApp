---
description: Start the development servers for API and mobile
---

# Start Development Servers

## API Server

// turbo

1. Start the NestJS backend:

```bash
cd packages/api && npm run start:dev
```

## Mobile App

// turbo 2. Start Expo development server:

```bash
cd packages/mobile && npx expo start
```

## Both (in separate terminals)

Run both servers simultaneously using two terminal windows or a tool like `concurrently`.
