# 🚀 Quick Start Guide

Get the Smart Brokerage messaging MVP running in **5 minutes**!

## Step 1: Install Dependencies

```bash
npm install
```

This installs all packages in the monorepo (api, mobile, shared).

## Step 2: Set Up Environment

```bash
# Copy environment template
cp env.example .env

# No changes needed for local development!
# The app will use stubbed services and mock data
```

## Step 3: Start the Backend API

```bash
# Terminal 1
npm run api
```

You should see:
```
🚀 API running on: http://localhost:3000
📦 Prisma Service initialized (DB connection stubbed)
📦 Supabase Service initialized (STUBBED)
📦 Mailgun Service initialized (STUBBED)
```

## Step 4: Start the Mobile App

```bash
# Terminal 2
npm run mobile
```

This opens Expo Dev Tools. Choose:
- Press **`i`** for iOS Simulator (Mac only)
- Press **`a`** for Android Emulator
- Scan QR with **Expo Go** app on your phone

## Step 5: Explore the App

1. **Listings Screen** - You'll see 2 mock listings
2. Tap a listing → **Threads Screen** (no messages yet, since email webhook isn't connected)
3. Messages from buyer agents will appear here once Mailgun is set up

## 🎯 What Works Right Now (Without External Services)

✅ API runs locally with stubbed services  
✅ Mobile app connects to local API  
✅ Navigation between screens  
✅ Mock listings display  
✅ UI for threads and chat is ready  

## 🔌 What Needs External Services

⏳ Receiving emails from buyer agents (needs Mailgun)  
⏳ Storing messages in database (needs Supabase)  
⏳ Background job processing (needs Railway Redis)  
⏳ Push notifications (needs Expo account)  

## 🛠️ Next Steps

### When You're Ready to Connect Real Services

1. **Set up Supabase** (5 min)
   - Go to [supabase.com](https://supabase.com)
   - Create project
   - Copy `DATABASE_URL` to `.env`
   - Run migrations: `npm run prisma:migrate`
   - Seed database: `npm run prisma:seed`

2. **Set up Mailgun** (15 min)
   - Go to [mailgun.com](https://mailgun.com)
   - Add domain `inbox.yourapp.ca`
   - Configure DNS records
   - Copy API keys to `.env`

3. **Deploy to Railway** (10 min)
   - Go to [railway.app](https://railway.app)
   - Connect GitHub repo
   - Add Redis service
   - Add environment variables

4. **Uncomment Service Code**
   - In `packages/api/src/common/prisma/prisma.service.ts` - uncomment DB connection
   - In `packages/api/src/common/supabase/supabase.service.ts` - uncomment Supabase client
   - In `packages/api/src/app.module.ts` - uncomment BullMQ
   - Restart API: `npm run api`

## 📱 Testing on Your Phone

If you want to test on a **physical device** instead of simulator:

1. Open `packages/mobile/src/config/api.ts`
2. Change `API_BASE_URL`:
   ```typescript
   export const API_BASE_URL = 'http://YOUR_COMPUTER_IP:3000'
   ```
3. Find your IP:
   - Mac/Linux: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig`
4. Example: `http://192.168.1.100:3000`
5. Restart mobile app: `npm run mobile`

## 🎨 Customizing the UI

All mobile screens are in `packages/mobile/src/screens/`:
- `ListingsScreen.tsx` - Listings list
- `ThreadsScreen.tsx` - Message threads
- `ChatScreen.tsx` - Chat interface

Edit any of these files and they'll hot-reload in the app!

## 🐛 Common Issues

### Port 3000 already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Mobile app can't connect to API
- Make sure API is running (`npm run api`)
- Check `http://localhost:3000/listings` in your browser
- If on physical device, use your computer's IP (not localhost)

### Expo errors
```bash
# Clear Expo cache
cd packages/mobile
expo start -c
```

### TypeScript errors
```bash
# Regenerate shared types
cd packages/shared
npm run build
```

## 💡 Pro Tips

1. **Seed the database** with sample listings (when connected to Supabase):
   ```bash
   npm run prisma:seed
   ```
   This creates 2 listings with unique email addresses:
   - `l-abc123@inbox.yourapp.ca` (123 Main Street, Toronto)
   - `l-xyz789@inbox.yourapp.ca` (456 Oak Avenue, Ottawa)

2. **Test email routing** (when database is seeded):
   ```bash
   ./test-email-routing.sh
   ```
   This sends test emails to both listings to verify routing works.

3. **Use Prisma Studio** to view/edit database data:
   ```bash
   npm run prisma:studio
   ```

4. **Test API endpoints** with curl:
   ```bash
   curl http://localhost:3000/listings
   ```

5. **Watch API logs** for debugging - all stubbed actions are logged

6. **Use React Query DevTools** (already configured) - shake device in Expo to open

## 📚 Learn More

- [Full README](./README.md) - Comprehensive documentation
- [Architecture Overview](./README.md#-project-structure) - How it all fits together
- [API Endpoints](./README.md#-api-endpoints) - Backend API reference

---

**You're all set!** 🎉

Start building, and when you're ready to go live, follow the service setup steps above.

