// Common API response types

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// Mailgun webhook payload (simplified)
export interface MailgunWebhookPayload {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': {
    event: string;
    recipient: string;
    sender: string;
    subject: string;
    'body-plain': string;
    'body-html': string;
    'message-headers': Array<[string, string]>;
    attachments: Array<{
      filename: string;
      'content-type': string;
      size: number;
      url: string;
    }>;
  };
}

