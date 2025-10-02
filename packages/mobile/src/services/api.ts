import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import type {
  Listing,
  MessageThread,
  Message,
  SendMessageDto,
} from '@smart-brokerage/shared';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (for auth token when implemented)
api.interceptors.request.use((config) => {
  // TODO: Add auth token when authentication is implemented
  // const token = getAuthToken();
  // if (token) {
  //   config.headers.Authorization = `Bearer ${token}`;
  // }
  return config;
});

// Response interceptor (for error handling)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================================
// LISTINGS API
// ============================================================

export const listingsApi = {
  getAll: async (): Promise<Listing[]> => {
    const response = await api.get('/listings');
    return response.data;
  },

  getById: async (id: string): Promise<Listing> => {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },

  getThreads: async (listingId: string): Promise<MessageThread[]> => {
    const response = await api.get(`/listings/${listingId}/threads`);
    return response.data;
  },
};

// ============================================================
// THREADS API
// ============================================================

export const threadsApi = {
  getById: async (id: string): Promise<MessageThread> => {
    const response = await api.get(`/threads/${id}`);
    return response.data;
  },

  getMessages: async (threadId: string): Promise<Message[]> => {
    const response = await api.get(`/threads/${threadId}/messages`);
    return response.data;
  },

  markAsRead: async (threadId: string): Promise<void> => {
    await api.patch(`/threads/${threadId}/read`);
  },
};

// ============================================================
// MESSAGES API
// ============================================================

export const messagesApi = {
  send: async (dto: SendMessageDto): Promise<Message> => {
    const response = await api.post('/messages', dto);
    return response.data;
  },
};

export default api;

