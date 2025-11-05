import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import type {
  Listing,
  MessageThread,
  Message,
  SendMessageDto,
  ListingSender,
  Offer,
  DeclineOfferDto,
  CounterOfferDto,
  Attachment,
  PrepareOfferForSigningRequest,
  PrepareOfferForSigningResponse,
  ApiResponse,
  ApsIntake,
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

  getSenders: async (listingId: string): Promise<ListingSender[]> => {
    const response = await api.get(`/listings/${listingId}/senders`);
    return response.data.data;
  },

  // UPDATED: Get threads for a specific sender on a listing
  getThreadsBySender: async (listingId: string, senderId: string): Promise<MessageThread[]> => {
    const response = await api.get(`/listings/${listingId}/senders/${senderId}/threads`);
    return response.data.data;
  }
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

  getOffers: async (threadId: string): Promise<Offer[]> => {
    const response = await api.get(`/threads/${threadId}/offers`);
    return response.data.data;
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

  resend: async (messageId: string): Promise<Message> => {
    const response = await api.post(`/messages/${messageId}/resend`);
    return response.data;
  },
};

// ============================================================
// ATTACHMENTS API
// ============================================================

export const attachmentsApi = {
  get: async (id: string): Promise<Attachment> => {
    const response = await api.get(`/attachments/${id}`);
    return response.data.data;
  },

  getDownloadUrl: async (id: string): Promise<string> => {
    const response = await api.get(`/attachments/${id}/download`);
    return response.data.data.url;
  },

  getPreviewUrl: async (id: string): Promise<string> => {
    const response = await api.get(`/attachments/${id}/preview`);
    return response.data.data.url;
  },
};

// ============================================================
// OFFERS API
// ============================================================

export const offersApi = {
  get: async (id: string): Promise<Offer> => {
    const response = await api.get(`/offers/${id}`);
    return response.data.data;
  },

  accept: async (offerId: string): Promise<{ signUrl: string; expiresAt: number }> => {
    const response = await api.post(`/offers/${offerId}/accept`);
    return response.data.data;
  },

  getSignUrl: async (offerId: string): Promise<{ signUrl: string; expiresAt: number }> => {
    const response = await api.get(`/offers/${offerId}/sign-url`);
    return response.data.data;
  },

  decline: async (dto: DeclineOfferDto): Promise<Offer> => {
    const response = await api.post(`/offers/${dto.offerId}/decline`, dto);
    return response.data.data;
  },

  counter: async (dto: CounterOfferDto): Promise<{ signUrl: string; expiresAt: number }> => {
    const response = await api.post(`/offers/${dto.offerId}/counter`, dto);
    return response.data.data;
  },
};

// ============================================================
// OFFERS API (EXTENDED)
// ============================================================

/**
 * Prepare offer for signing with guided intake
 * Replaces the old agreementsApi.prepare()
 */
export const prepareOfferForSigning = async (
  offerId: string,
  intake: ApsIntake,
  seller: { email: string; name: string }
): Promise<PrepareOfferForSigningResponse> => {
  const response = await api.post<ApiResponse<PrepareOfferForSigningResponse>>(
    `/offers/${offerId}/prepare-signature`,
    { intake, seller },
  );
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to prepare offer for signing');
  }
  
  return response.data.data!;
};

/**
 * @deprecated Use prepareOfferForSigning() instead
 * Legacy agreements API kept for backwards compatibility
 */
export const agreementsApi = {
  prepare: async (): Promise<any> => {
    throw new Error('agreementsApi.prepare() is deprecated. Use prepareOfferForSigning() instead');
  },
  get: async (): Promise<any> => {
    throw new Error('agreementsApi.get() is deprecated. Use offersApi.get() instead');
  },
};

export default api;

