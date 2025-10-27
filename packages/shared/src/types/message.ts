export enum MessageDirection {
  INBOUND = 'INBOUND',   // From buyer agent to seller
  OUTBOUND = 'OUTBOUND', // From seller to buyer agent
}

export enum MessageCategory {
  OFFER = 'OFFER',
  SHOWING = 'SHOWING',
  GENERAL = 'GENERAL',
}

export enum MessageSubCategory {
  NEW_OFFER = 'NEW_OFFER',
  UPDATED_OFFER = 'UPDATED_OFFER',
  VIEWING_REQUEST = 'VIEWING_REQUEST',
  AMENDMENT = 'AMENDMENT',
  GENERAL = 'GENERAL',
}

export enum MessageStatus {
  PENDING = 'PENDING',     // Message created but not yet sent
  SENT = 'SENT',           // Successfully sent via email
  FAILED = 'FAILED',       // Failed to send via email
  DELIVERED = 'DELIVERED', // Confirmed delivery (future: webhook from Mailgun)
}

export enum OfferStatus {
  PENDING_REVIEW = 'PENDING_REVIEW', // Seller hasn't reviewed yet
  AWAITING_SELLER_SIGNATURE = 'AWAITING_SELLER_SIGNATURE', // Seller accepted, waiting for signature
  AWAITING_BUYER_SIGNATURE = 'AWAITING_BUYER_SIGNATURE', // Counter-offer sent, waiting for buyer signature
  ACCEPTED = 'ACCEPTED', // Fully signed and accepted
  DECLINED = 'DECLINED', // Seller declined
  COUNTERED = 'COUNTERED', // Seller sent counter-offer
  EXPIRED = 'EXPIRED', // Offer expired
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
  status: MessageStatus;
  rawEmailS3Key: string | null;
  subCategory?: MessageSubCategory | null; // Classified intent
  classificationConfidence?: number | null; // 0-100 confidence score
  classificationReasoning?: string | null; // Why it was classified this way
  offerId?: string | null; // Link to offer if this message contains/relates to an offer
  createdAt: Date;
  attachments?: Attachment[];
  offer?: Offer | null; // Related offer if any
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  s3Key: string;
  size: number;
  url?: string; // Signed URL for download
  documentAnalysisId?: string | null;
  createdAt: Date;
  documentAnalysis?: DocumentAnalysis | null; // Analysis results if this is an analyzed document
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
  activeOfferId?: string | null; // Quick lookup for active offer in this thread
  lastMessageAt: Date;
  unreadCount: number;
  isVerified: boolean; // Is sender a verified agent
  messages?: Message[];
  listing?: {
    id: string;
    address: string;
  };
  activeOffer?: Offer | null; // Active offer if any
}

// ============================================================
// DOCUMENT ANALYSIS
// ============================================================

export interface DocumentAnalysis {
  id: string;
  attachmentId: string;
  formType?: string | null; // e.g., "Form 100 APS", "Form 120 Amendment"
  oreaFormDetected: boolean;
  relevanceScore: number; // 0-100, how relevant/important is this document
  confidence: number; // 0-100, confidence in the analysis
  extractedData?: Record<string, any> | null; // Structured data: {price, deposit, conditions, dates, etc}
  textContent?: string | null; // Extracted text from PDF
  pageCount?: number | null;
  createdAt: Date;
}

// ============================================================
// OFFERS
// ============================================================

export interface Offer {
  id: string;
  threadId: string;
  messageId: string; // The message that contained this offer
  status: OfferStatus;
  
  // Offer Details (extracted from documents)
  price?: number | null;
  deposit?: number | null;
  closingDate?: Date | null;
  conditions?: string | null;
  expiryDate?: Date | null;
  
  // Document references
  originalDocumentS3Key?: string | null; // Original unsigned offer from buyer agent
  signedDocumentS3Key?: string | null; // Signed document after acceptance
  counterOfferDocumentS3Key?: string | null; // Counter-offer document if sent
  
  // Dropbox Sign tracking
  hellosignSignatureRequestId?: string | null; // Dropbox Sign signature request ID
  sellerSignedAt?: Date | null;
  buyerSignedAt?: Date | null;
  
  // Metadata
  declineReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// OFFER DTOs
// ============================================================

export interface DeclineOfferDto {
  offerId: string;
  reason?: string;
}

export interface CounterOfferDto {
  offerId: string;
  price?: number;
  deposit?: number;
  closingDate?: Date;
  conditions?: string;
  expiryDate?: Date;
}

