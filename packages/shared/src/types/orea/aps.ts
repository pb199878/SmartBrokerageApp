// OREA Agreement of Purchase and Sale (APS) types

// Note: Agreement and SignatureRequest models have been consolidated into Offer model
// See packages/api/prisma/schema.prisma for the unified Offer model

// ============================================================================
// APS Parser Types (for PDF extraction and analysis)
// ============================================================================

/**
 * Gemini-specific schema for OREA Form 100 extraction
 * This is the exact schema Gemini will return
 */
export interface GeminiApsSchema {
  agreement_date: {
    day: string;
    month: string;
    year: string;
  };
  buyer_full_name: string;
  seller_full_name: string;
  property: {
    property_address: string;
    property_fronting: string;
    property_side_of_street: string;
    property_frontage: string;
    property_depth: string;
    property_legal_description: string;
  };
  price_and_deposit: {
    purchase_price: {
      numeric: number;
      written: string;
      currency: string;
    };
    deposit: {
      numeric: number;
      written: string;
      timing: string;
      currency: string;
    };
  };
  irrevocability: {
    by_whom: string;
    time: string;
    day: string;
    month: string;
    year: string;
  };
  completion: {
    day: string;
    month: string;
    year: string;
  };
  notices: {
    seller_fax: string;
    seller_email: string;
    buyer_fax: string;
    buyer_email: string;
  };
  inclusions_exclusions: {
    chattels_included: string[];
    fixtures_excluded: string[];
    rental_items: string[];
  };
  hst: string; // "included" or "excluded"
  title_search: {
    day: string;
    month: string;
    year: string;
  };
  acknowledgment: {
    buyer: {
      name: string;
      date: string;
      lawyer: {
        name: string;
        address: string;
        email: string;
      };
    };
  };
  commission_trust: {
    cooperatingBrokerageSignature: string;
  };
}

// ============================================================================
// APS Parser Types (for PDF extraction and analysis)
// ============================================================================

/**
 * Confidence-scored field value from APS parser
 */
export interface ApsFieldValue<T = string | boolean | null> {
  value: T;
  source: 'acroform' | 'template' | 'ocr';
  confidence: number; // 0..1
}

/**
 * Party information (buyer/seller/agent)
 */
export interface ApsParty {
  fullName: string;
  confidence: number;
}

/**
 * Property details extracted from APS
 */
export interface ApsProperty {
  addressLine1?: string;
  municipality?: string;
  postalCode?: string;
  legalDesc?: string;
  confidence: number;
}

/**
 * Financial details from APS
 */
export interface ApsFinancials {
  price?: string;
  deposit?: string;
  depositDue?: 'herewith' | 'uponAcceptance' | 'asSpecified' | null;
  balanceDue?: string;
  irrevocable?: {
    date?: string;
    time?: string;
    timeZone?: string;
  };
  completionDate?: string;
  inclusions?: string[];
  exclusions?: string[];
  confidence: number;
}

/**
 * Conditions/contingencies from APS
 */
export interface ApsConditions {
  financing?: boolean;
  inspection?: boolean;
  statusCertificate?: boolean;
  other?: string[];
  confidence: number;
}

/**
 * Signature information from APS
 */
export interface ApsSignature {
  role: 'buyer' | 'seller' | 'agent' | 'witness' | 'initial';
  page: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  type: 'digital' | 'ink' | 'image';
  signerName?: string;
  signedAt?: string;
  confidence: number;
  raw?: {
    subFilter?: string;
    byteRange?: number[];
    name?: string;
  };
}

/**
 * Complete APS parse result - now matches Gemini schema
 */
export interface ApsParseResult {
  success: boolean;
  formVersion?: string;
  strategyUsed: 'acroform' | 'gemini';
  docConfidence: number; // Overall document confidence (0..1)
  
  // Gemini schema fields
  agreement_date?: {
    day: string;
    month: string;
    year: string;
  };
  buyer_full_name?: string;
  seller_full_name?: string;
  property?: {
    property_address?: string;
    property_fronting?: string;
    property_side_of_street?: string;
    property_frontage?: string;
    property_depth?: string;
    property_legal_description?: string;
  };
  price_and_deposit?: {
    purchase_price?: {
      numeric: number;
      written: string;
      currency: string;
    };
    deposit?: {
      numeric: number;
      written: string;
      timing: string;
      currency: string;
    };
  };
  irrevocability?: {
    by_whom: string;
    time: string;
    day: string;
    month: string;
    year: string;
  };
  completion?: {
    day: string;
    month: string;
    year: string;
  };
  notices?: {
    seller_fax: string;
    seller_email: string;
    buyer_fax: string;
    buyer_email: string;
  };
  inclusions_exclusions?: {
    chattels_included: string[];
    fixtures_excluded: string[];
    rental_items: string[];
  };
  hst?: string; // "included" or "excluded"
  title_search?: {
    day: string;
    month: string;
    year: string;
  };
  acknowledgment?: {
    buyer: {
      name: string;
      date: string;
      lawyer: {
        name: string;
        address: string;
        email: string;
      };
    };
  };
  commission_trust?: {
    cooperatingBrokerageSignature: string;
  };
  
  errors?: string[];
}

// ============================================================================
// Legacy APS Intake Types (for form filling)
// ============================================================================

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

