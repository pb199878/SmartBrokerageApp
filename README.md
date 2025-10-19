# Smart Brokerage App

A digital-first FSBO (For Sale By Owner) platform for Ontario real estate sellers. The platform provides MLS exposure, messaging with buyer agents, and transaction management tools.

## 📁 Project Structure

```
SmartBrokerageApp/
├── packages/
│   ├── api/                    # NestJS Backend API
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules
│   │   │   │   ├── email/      # Email webhook & processing
│   │   │   │   ├── listings/   # Listing management
│   │   │   │   ├── threads/    # Message threads
│   │   │   │   └── messages/   # Message sending
│   │   │   └── common/         # Shared services
│   │   │       ├── prisma/     # Database service
│   │   │       ├── supabase/   # Storage service
│   │   │       └── mailgun/    # Email service
│   │   └── prisma/
│   │       └── schema.prisma   # Database schema
│   │
│   ├── mobile/                 # Expo React Native App
│   │   ├── src/
│   │   │   ├── screens/        # App screens
│   │   │   ├── navigation/     # Navigation setup
│   │   │   ├── services/       # API client
│   │   │   └── config/         # Configuration
│   │   └── App.tsx
│   │
│   └── shared/                 # Shared TypeScript types
│       └── src/types/
│
├── package.json                # Root workspace config
└── env.example                 # Environment variables template
```

## 🚀 Tech Stack

### Backend
- **Framework**: NestJS (TypeScript)
- **Database**: Supabase Postgres
- **ORM**: Prisma
- **Storage**: Supabase Storage
- **Email**: Mailgun (inbound webhooks + outbound API)
- **Queue**: BullMQ + Railway Redis
- **Hosting**: Railway

### Mobile
- **Framework**: Expo (React Native)
- **Navigation**: React Navigation
- **State**: React Query + Zustand
- **UI**: React Native Paper
- **Push**: Expo Push Notifications

### Shared
- **Language**: TypeScript
- **Types**: Shared across API & Mobile

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL (or Supabase account)
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator

### 1. Clone and Install

```bash
# Clone the repository
cd SmartBrokerageApp

# Install all dependencies (monorepo)
npm install

# Install workspace dependencies
npm install --workspaces
```

### 2. Environment Setup

Copy `env.example` to `.env` in the root directory:

```bash
cp env.example .env
```

For **local development without external services**, you can use these values:

```env
# Local Postgres (or leave as-is for stubbed mode)
DATABASE_URL="postgresql://postgres:password@localhost:5432/smart_brokerage"

# Stubbed services (will work with mock data)
SUPABASE_URL="https://stubbed.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="stubbed-key"
MAILGUN_API_KEY="stubbed-key"
MAILGUN_DOMAIN="inbox.yourapp.ca"
REDIS_URL="redis://localhost:6379"

# API config
NODE_ENV="development"
PORT="3000"
API_URL="http://localhost:3000"
```

### 3. Database Setup (Optional for MVP)

The app will work with **stubbed data** initially. When you're ready to connect a real database:

#### Option A: Local Postgres

```bash
# Install Postgres locally
brew install postgresql  # Mac
# or use Docker:
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres

# Create database
createdb smart_brokerage

# Update .env with your DATABASE_URL
```

#### Option B: Supabase (Recommended)

1. Go to [supabase.com](https://supabase.com) and create a project
2. Get your connection string from Settings → Database
3. Update `.env` with:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (from Settings → API)

#### Run Migrations

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with sample listings
npm run prisma:seed

# Open Prisma Studio (DB GUI)
npm run prisma:studio
```

### 4. Start Development

#### Terminal 1: Start API

```bash
npm run api
```

The API will start at `http://localhost:3000`

#### Terminal 2: Start Mobile App

```bash
npm run mobile
```

This will start Expo. You can:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on your phone

#### Or start both at once:

```bash
npm run dev
```

## 📱 Mobile App Usage

The app has three main screens:

1. **Listings Screen** - View all your property listings
2. **Threads Screen** - View all message threads for a listing
3. **Chat Screen** - Chat interface for replying to buyer agents

### Testing Locally

The mobile app is configured to hit `http://localhost:3000` by default. 

**If testing on a physical device:**

1. Open `packages/mobile/src/config/api.ts`
2. Change `API_BASE_URL` to your computer's IP:
   ```typescript
   export const API_BASE_URL = 'http://192.168.1.XXX:3000'
   ```
3. Find your IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)

## 🔧 API Endpoints

### Listings
- `GET /listings` - Get all listings
- `GET /listings/:id` - Get listing by ID
- `POST /listings` - Create new listing
- `GET /listings/:id/threads` - Get threads for listing

### Threads
- `GET /threads/:id` - Get thread details
- `GET /threads/:id/messages` - Get messages in thread
- `PATCH /threads/:id/read` - Mark thread as read

### Messages
- `POST /messages` - Send message (seller reply)

### Webhooks
- `POST /webhooks/mailgun` - Mailgun inbound email webhook

## 📧 Email Routing & Listings

### Listing Email Addresses

After seeding the database, you'll have **two listings** with unique email addresses:

| Listing | Address | Email Address |
|---------|---------|---------------|
| Listing 1 | 123 Main Street, Toronto | `l-abc123@inbox.yourapp.ca` |
| Listing 2 | 456 Oak Avenue, Ottawa | `l-xyz789@inbox.yourapp.ca` |

### How Email Routing Works

1. **Buyer agent sends email** to a listing's email address (e.g., `l-abc123@inbox.yourapp.ca`)
2. **Mailgun receives email** → POSTs to `/webhooks/mailgun`
3. **API extracts listing alias** from recipient (`l-abc123`)
4. **API looks up listing** by `emailAlias` in database
5. **API creates/updates thread** using the listing's UUID (not the alias)
6. **Message is stored** and linked to the correct listing
7. **Seller sees message** in mobile app under the specific listing

### Email Flow (When Mailgun is Connected)

1. Buyer agent emails: `l-abc123@inbox.yourapp.ca` or `l-xyz789@inbox.yourapp.ca`
2. Mailgun receives email → POSTs to `/webhooks/mailgun`
3. API processes email:
   - Extracts listing alias from recipient
   - Looks up listing by emailAlias
   - Parses sender, subject, body, attachments
   - Creates/updates thread using listing UUID
   - Stores message in DB
   - Uploads raw email to Supabase Storage
   - (TODO) Sends push notification to seller
4. Seller sees message in mobile app
5. Seller replies → API sends email via Mailgun

## 🔐 Services to Register For

When you're ready to move beyond local development:

### 1. Supabase (Database + Storage)
- Sign up: [supabase.com](https://supabase.com)
- Create project
- Create two storage buckets:
  - `emails` - for raw email storage (.eml files)
  - `attachments` - for PDFs, images, etc.
- Update `.env` with credentials

### 2. Mailgun (Email)
- Sign up: [mailgun.com](https://mailgun.com)
- Add domain: `inbox.yourapp.ca`
- Set up DNS records (MX, TXT for verification)
- Create inbound route: Forward to `https://your-api.railway.app/webhooks/mailgun`
- Update `.env` with:
  - `MAILGUN_API_KEY`
  - `MAILGUN_DOMAIN`
  - `MAILGUN_WEBHOOK_SIGNING_KEY`

### 3. Railway (Hosting + Redis)
- Sign up: [railway.app](https://railway.app)
- Create new project
- Add services:
  - Web service (API) - connect GitHub repo
  - Redis database
- Railway auto-populates `REDIS_URL`
- Add other environment variables from `.env`

### 4. Vercel (Future - Admin UI)
- Sign up: [vercel.com](https://vercel.com)
- Deploy Next.js admin dashboard (when built)

## 🚦 Feature Checklist

### ✅ MVP - Messaging (Current)
- [x] Project structure (monorepo)
- [x] Backend API with NestJS
- [x] Prisma schema for messaging
- [x] Stubbed services (Mailgun, Supabase, Redis)
- [x] Mobile app with Expo
- [x] Listings screen
- [x] Threads screen (message list)
- [x] Chat screen (send/receive messages)
- [ ] Connect real services (Supabase, Mailgun, Railway)
- [ ] Email webhook processing
- [ ] Push notifications
- [ ] Attachment handling

### 🔜 Phase 2 - Agent Verification
- [ ] Domain whitelist
- [ ] Manual verification flow in admin
- [ ] "Verified Agent" badge in mobile app

### 🔜 Phase 3 - Admin Dashboard
- [ ] Next.js admin UI
- [ ] Thread monitoring
- [ ] Agent approval interface
- [ ] Compliance audit logs

### 🔜 Phase 4 - Advanced Features
- [ ] Showing scheduler
- [ ] Auto-response templates
- [ ] Deposit tracking
- [ ] APS form detection
- [ ] SLA monitoring & reminders

## 🧪 Testing

```bash
# Run API tests (when implemented)
cd packages/api
npm test

# Run mobile tests (when implemented)
cd packages/mobile
npm test
```

## 📦 Deployment

### API (Railway)

```bash
# Railway will auto-deploy on git push
git push origin main

# Or deploy manually
cd packages/api
railway up
```

### Mobile (Expo)

```bash
# Build for iOS/Android
cd packages/mobile
eas build --platform ios
eas build --platform android

# Submit to App Store / Play Store
eas submit
```

## 🐛 Troubleshooting

### API won't start
- Check if port 3000 is available: `lsof -i :3000`
- Verify `.env` file exists
- Check Node version: `node -v` (should be 18+)

### Mobile app can't connect to API
- Verify API is running: `curl http://localhost:3000/listings`
- Check `API_BASE_URL` in `packages/mobile/src/config/api.ts`
- For physical device, use computer's IP address (not localhost)

### Prisma errors
- Run `npm run prisma:generate` after schema changes
- Verify `DATABASE_URL` in `.env`
- Check Postgres is running: `psql -h localhost -U postgres`

### Expo errors
- Clear cache: `expo start -c`
- Reinstall deps: `rm -rf node_modules && npm install`
- Update Expo: `expo upgrade`

## 📚 Documentation

- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase Docs](https://supabase.com/docs)
- [Mailgun API](https://documentation.mailgun.com/en/latest/)

## 🤝 Contributing

This is a personal project, but feel free to fork and adapt for your own use!

## 📄 License

Proprietary - All rights reserved.

---

**Next Steps:**
1. ✅ Run `npm install` to set up the project
2. ✅ Start the API: `npm run api`
3. ✅ Start the mobile app: `npm run mobile`
4. 🔜 Register for Supabase, Mailgun, Railway
5. 🔜 Connect real services and test email flow
