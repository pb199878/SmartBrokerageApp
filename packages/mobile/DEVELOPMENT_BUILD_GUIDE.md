# Development Build Guide

## Why You Need a Development Build

The following native modules require a custom development build (they don't work in Expo Go):
- ✅ `react-native-pdf` - For PDF viewing
- ✅ `react-native-webview` - For Dropbox Sign embedded signing
- ✅ `react-native-blob-util` - Required peer dependency for react-native-pdf

## ⚡ Quick Start

### Option A: Build Locally (Fastest for Development)

**For iOS (Mac only):**
```bash
cd packages/mobile

# Install dependencies
npx expo install expo-dev-client

# Prebuild (generates ios/ and android/ folders)
npx expo prebuild

# Build and run on iOS simulator
npx expo run:ios
```

**For Android:**
```bash
cd packages/mobile

# Install dependencies
npx expo install expo-dev-client

# Prebuild (generates ios/ and android/ folders)
npx expo prebuild

# Build and run on Android emulator
npx expo run:android
```

### Option B: Build with EAS (Cloud Build)

**Setup EAS:**
```bash
npm install -g eas-cli
eas login
eas build:configure
```

**Build for iOS:**
```bash
eas build --profile development --platform ios
```

**Build for Android:**
```bash
eas build --profile development --platform android
```

**Install on device:**
- Download the build from EAS dashboard
- Install on your physical device or simulator

## 📱 After Building

Once you have the development build installed:

```bash
# Start the dev server
npx expo start --dev-client

# Scan QR code with your development build app
# (NOT Expo Go - use your custom built app)
```

## 🔄 When to Rebuild

You only need to rebuild when:
- ✅ Adding new native modules
- ✅ Changing native configuration (app.json plugins, permissions, etc.)

You DON'T need to rebuild for:
- ❌ JavaScript/TypeScript code changes
- ❌ Component updates
- ❌ Style changes

## 🚀 For Production

When ready to deploy:

```bash
# Production builds
eas build --profile production --platform ios
eas build --profile production --platform android

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

## 📋 Troubleshooting

### "Command not found: eas"
```bash
npm install -g eas-cli
```

### "Xcode not found" (iOS)
You need Xcode installed on Mac for iOS builds locally.
Use EAS cloud build as alternative.

### "Android SDK not found" (Android)
Install Android Studio and SDK.
Use EAS cloud build as alternative.

### Stuck on old Expo Go app
1. Uninstall Expo Go
2. Install your development build from EAS or local build
3. Run `npx expo start --dev-client`

## 📖 More Info

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Run builds locally](https://docs.expo.dev/guides/local-app-development/)

