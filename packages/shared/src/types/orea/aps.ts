// OREA Agreement of Purchase and Sale (APS) types

export enum AgreementStatus {
  PENDING_SELLER_INTAKE = 'PENDING_SELLER_INTAKE',
  PREPARING = 'PREPARING',
  READY_TO_SIGN = 'READY_TO_SIGN',
  SIGNING_IN_PROGRESS = 'SIGNING_IN_PROGRESS',
  SIGNED = 'SIGNED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum SignatureProvider {
  DROPBOX_SIGN = 'DROPBOX_SIGN',
}

export enum SignatureRequestStatus {
  CREATED = 'CREATED',
  VIEWED = 'VIEWED',
  SIGNED = 'SIGNED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
}

// OREA APS intake data structure (seller's responses)
export interface ApsIntake {
  // Property details
  propertyAddress?: string;
  legalDescription?: string;
  
  // Financial terms
  purchasePrice?: number;
  depositAmount?: number;
  depositDueDate?: Date | string;
  
  // Dates
  completionDate?: Date | string;
  possessionDate?: Date | string;
  
  // Inclusions/Exclusions
  inclusions?: string;
  exclusions?: string;
  
  // Fixtures and Chattels
  fixtures?: string;
  chattels?: string;
  
  // Rental items
  rentalItems?: string;
  
  // Seller representations
  sellerWarranties?: {
    complianceWithLaws?: boolean;
    noLegalActions?: boolean;
    noConflictingAgreements?: boolean;
    propertyTaxesCurrent?: boolean;
  };
  
  // Additional terms
  additionalTerms?: string;
  
  // HST information
  hstApplicable?: boolean;
  hstIncluded?: boolean;
  
  // Title search
  titleSearchAllowedDays?: number;
  
  // Seller information
  sellerLegalName?: string;
  sellerAddress?: string;
  sellerPhone?: string;
  
  // Lawyer information
  lawyerName?: string;
  lawyerFirm?: string;
  lawyerAddress?: string;
  lawyerPhone?: string;
  lawyerEmail?: string;
}

// API request/response types
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

export interface PrepareAgreementResponse {
  agreementId: string;
  signUrl: string;
}

export interface AgreementDetail {
  id: string;
  listingId: string;
  status: AgreementStatus;
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
    status: SignatureRequestStatus;
    signUrl?: string;
    viewedAt?: string;
    signedAt?: string;
  };
  finalDocumentUrl?: string;
}

