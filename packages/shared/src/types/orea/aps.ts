// OREA Agreement of Purchase and Sale (APS) types

// Note: Agreement and SignatureRequest models have been consolidated into Offer model
// See packages/api/prisma/schema.prisma for the unified Offer model

// OREA APS intake data structure (seller's responses + buyer offer details)
// Note: Most fields are prefilled from listing/extracted from buyer's offer
export interface ApsIntake {
  // Property information (from listing/buyer offer)
  propertyAddress?: string;
  legalDescription?: string;
  
  // Financial details (from buyer's offer)
  purchasePrice?: number;
  depositAmount?: number;
  depositDueDate?: string;
  
  // Dates (from buyer's offer)
  completionDate?: string;
  possessionDate?: string;
  
  // Seller information (PREFILLED from listing/user profile)
  sellerLegalName?: string; // Prefilled, seller can edit if needed
  sellerAddress?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  
  // Lawyer information (PREFILLED from listing)
  lawyerName?: string;
  lawyerFirm?: string;
  lawyerAddress?: string;
  lawyerPhone?: string;
  lawyerEmail?: string;
  
  // Inclusions/Exclusions
  inclusions?: string; // Chattels included (from buyer's offer)
  exclusions?: string; // Fixtures excluded (seller fills this)
  fixtures?: string; // Fixtures (from buyer's offer)
  chattels?: string; // Chattels (from buyer's offer)
  
  // Optional: Rental items buyer needs to know about
  rentalItems?: string; // e.g., "Hot water tank ($25/month)"
  
  // Additional terms
  additionalTerms?: string;
  
  // Optional: Additional notes from seller
  sellerNotes?: string;
}

// API request/response types for Offer preparation
export interface PrepareOfferForSigningRequest {
  intake: ApsIntake;
  seller: {
    email: string;
    name: string;
  };
}

export interface PrepareOfferForSigningResponse {
  signUrl: string;
  expiresAt: number;
}

/**
 * @deprecated Use Offer model instead
 * Legacy types kept for backwards compatibility
 */
export interface PrepareAgreementRequest {
  source: {
    type: 'attachment' | 'fileKey';
    attachmentId?: string;
    fileKey?: string;
  };
  listingId: string;
  seller: {
    email: string;
    name?: string;
  };
  intake: ApsIntake;
}

/**
 * @deprecated Use Offer model instead
 */
export interface PrepareAgreementResponse {
  agreementId: string;
  signUrl: string;
}

/**
 * @deprecated Use Offer model instead
 */
export interface AgreementDetail {
  id: string;
  listingId: string;
  status: any;
  oreaVersion?: string;
  sellerEmail: string;
  sellerName?: string;
  createdAt: string;
  updatedAt: string;
  preparedAt?: string;
  signedAt?: string;
  errorMessage?: string;
  signatureRequest?: {
    id: string;
    status: any;
    signUrl?: string;
    viewedAt?: string;
    signedAt?: string;
  };
  finalDocumentUrl?: string;
}

