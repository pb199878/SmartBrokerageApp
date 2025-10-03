// API configuration
// TODO: Update with your actual API URL when deployed

// For local development:
// - iOS Simulator: use localhost
// - Android Emulator: use 10.0.2.2
// - Physical device: use your computer's IP address (e.g., 192.168.1.x)

export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000' // Local development - testing with live DB
  : 'https://powerful-communication-production-c6e8.up.railway.app';

export const API_ENDPOINTS = {
  listings: '/listings',
  threads: '/threads',
  messages: '/messages',
} as const;

