export enum MessageDirection {
  INBOUND = 'inbound',   // From buyer agent to seller
  OUTBOUND = 'outbound', // From seller to buyer agent
}

export enum MessageCategory {
  OFFER = 'offer',
  SHOWING = 'showing',
  GENERAL = 'general',
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string | null; // null if from seller
  senderEmail: string;
  senderName: string;
  direction: MessageDirection;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  rawEmailS3Key: string | null;
  createdAt: Date;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  s3Key: string;
  size: number;
  url?: string; // Signed URL for download
  createdAt: Date;
}

export interface SendMessageDto {
  threadId: string;
  text: string;
  attachments?: File[];
}

export interface MessageThread {
  id: string;
  listingId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  category: MessageCategory;
  lastMessageAt: Date;
  unreadCount: number;
  isVerified: boolean; // Is sender a verified agent
  messages?: Message[];
  listing?: {
    id: string;
    address: string;
  };
}

