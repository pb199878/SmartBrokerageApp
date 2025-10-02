// API configuration
// TODO: Update with your actual API URL when deployed

// For local development:
// - iOS Simulator: use localhost
// - Android Emulator: use 10.0.2.2
// - Physical device: use your computer's IP address (e.g., 192.168.1.x)

export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000' // Change to your computer's IP if testing on physical device
  : 'https://your-api-url.railway.app'; // TODO: Update when deployed to Railway

export const API_ENDPOINTS = {
  listings: '/listings',
  threads: '/threads',
  messages: '/messages',
} as const;

