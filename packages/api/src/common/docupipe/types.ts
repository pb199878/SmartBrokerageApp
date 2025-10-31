/**
 * TypeScript interfaces for DocuPipe.ai OREA Form 100 schema
 * Based on actual DocuPipe response structure
 */

export interface DocuPipeDateObject {
  day?: string;
  month?: string;
  year?: string;
}

export interface DocuPipeDocumentInfo {
  formNumber?: string;
  formTitle?: string;
  organization?: string;
  jurisdiction?: string;
  revisionDate?: string;
}

export interface DocuPipeParties {
  buyer?: string;
  seller?: string;
}

export interface DocuPipePropertyLocation {
  side?: string;
  streetName?: string;
}

export interface DocuPipePropertyDimensions {
  frontage?: string;
  depth?: string;
}

export interface DocuPipeProperty {
  address?: string;
  location?: DocuPipePropertyLocation;
  dimensions?: DocuPipePropertyDimensions;
  legalDescription?: string;
  presentUse?: string;
}

export interface DocuPipePurchasePrice {
  amount?: number;
  currency?: string;
  amountInWords?: string;
}

export interface DocuPipeDeposit {
  timing?: 'Herewith' | 'Upon Acceptance' | 'as otherwise described in this Agreement';
  amount?: number;
  currency?: string;
  payableTo?: string;
}

export interface DocuPipeHST {
  applicability?: boolean;
  inclusion?: 'included in' | 'in addition to';
}

export interface DocuPipeFinancialDetails {
  purchasePrice?: DocuPipePurchasePrice;
  deposit?: DocuPipeDeposit;
  balanceDetails?: string;
  hst?: DocuPipeHST;
}

export interface DocuPipeIrrevocability {
  party?: 'Seller' | 'Buyer';
  until?: string;
  date?: DocuPipeDateObject;
}

export interface DocuPipeCompletion {
  date?: DocuPipeDateObject;
  time?: string;
}

export interface DocuPipeTitleSearchDeadline {
  time?: string;
  day?: string;
  month?: string;
  year?: string;
}

export interface DocuPipeTitleSearch {
  deadline?: DocuPipeTitleSearchDeadline;
}

export interface DocuPipeTerms {
  irrevocability?: DocuPipeIrrevocability;
  completion?: DocuPipeCompletion;
  chattelsIncluded?: string;
  fixturesExcluded?: string;
  rentalItems?: string;
  titleSearch?: DocuPipeTitleSearch;
}

export interface DocuPipeContactInfo {
  fax?: string;
  email?: string;
}

export interface DocuPipeNotices {
  seller?: DocuPipeContactInfo;
  buyer?: DocuPipeContactInfo;
}

export interface DocuPipeSignature {
  name?: string;
  date?: string;
}

export interface DocuPipeSpousalConsent {
  name?: string;
  date?: string;
}

export interface DocuPipeAcceptanceConfirmation {
  time?: string;
  date?: DocuPipeDateObject;
}

export interface DocuPipeInitials {
  buyer?: string[];
  seller?: string[];
}

export interface DocuPipeSignatures {
  buyer?: DocuPipeSignature[];
  seller?: DocuPipeSignature[];
  spousalConsent?: DocuPipeSpousalConsent;
  initials?: DocuPipeInitials;
  acceptanceConfirmation?: DocuPipeAcceptanceConfirmation;
}

export interface DocuPipeBrokerageInfo {
  name?: string;
  phone?: string;
  agent?: string;
}

export interface DocuPipeBrokerages {
  listingBrokerage?: DocuPipeBrokerageInfo;
  buyerBrokerage?: DocuPipeBrokerageInfo;
}

export interface DocuPipeAcknowledgementEntry {
  date?: string;
  addressForService?: string;
  phone?: string;
}

export interface DocuPipeAcknowledgement {
  seller?: DocuPipeAcknowledgementEntry[];
  buyer?: DocuPipeAcknowledgementEntry[];
}

export interface DocuPipeLawyerInfo {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  fax?: string;
}

export interface DocuPipeLawyers {
  seller?: DocuPipeLawyerInfo;
  buyer?: DocuPipeLawyerInfo;
}

/**
 * Complete OREA Form 100 response structure from DocuPipe.ai
 */
export interface DocuPipeOREAForm100Response {
  documentInfo?: DocuPipeDocumentInfo;
  agreementDate?: DocuPipeDateObject;
  parties?: DocuPipeParties;
  property?: DocuPipeProperty;
  financialDetails?: DocuPipeFinancialDetails;
  schedules?: string[];
  terms?: DocuPipeTerms;
  notices?: DocuPipeNotices;
  signatures?: DocuPipeSignatures;
  brokerageInfo?: DocuPipeBrokerages;
  acknowledgement?: DocuPipeAcknowledgement;
  lawyerInfo?: DocuPipeLawyers;
}

/**
 * DocuPipe API response for document upload
 */
export interface DocuPipeUploadResponse {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
}

/**
 * DocuPipe API response for job status
 */
export interface DocuPipeJobStatusResponse {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

/**
 * DocuPipe API response for extraction results
 */
export interface DocuPipeExtractionResponse {
  jobId: string;
  status: 'completed';
  data: DocuPipeOREAForm100Response;
}

/**
 * Signature detection result
 */
export interface SignatureInfo {
  buyerSignature1Detected: boolean;
  buyerSignature2Detected: boolean;
}

