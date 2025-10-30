// OREA Form 100 - Agreement of Purchase and Sale (2024 Edition)
// Field coordinates and guidance for seller intake

export interface FieldCoordinate {
  page: number; // 0-indexed
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
}

export interface SignatureField {
  type: 'signature' | 'initial' | 'date';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label: string;
}

export interface GuidanceNote {
  section: string;
  field: string;
  title: string;
  description: string;
  example?: string;
  tips?: string[];
}

// Field coordinate mappings for prefilling text on the PDF
// These will need to be calibrated to the actual OREA Form 100 PDF layout
export const APS_2024_FIELD_COORDINATES: Record<string, FieldCoordinate> = {
  // Property Information (Page 1)
  propertyAddress: { page: 0, x: 120, y: 720, width: 400, fontSize: 10 },
  legalDescription: { page: 0, x: 120, y: 695, width: 400, fontSize: 9 },
  
  // Financial Terms (Page 1)
  purchasePrice: { page: 0, x: 350, y: 650, width: 150, fontSize: 11 },
  depositAmount: { page: 0, x: 350, y: 625, width: 150, fontSize: 10 },
  depositDueDate: { page: 0, x: 350, y: 600, width: 150, fontSize: 10 },
  
  // Dates (Page 1)
  completionDate: { page: 0, x: 350, y: 560, width: 150, fontSize: 10 },
  possessionDate: { page: 0, x: 350, y: 535, width: 150, fontSize: 10 },
  
  // Inclusions/Exclusions (Page 2)
  inclusions: { page: 1, x: 80, y: 680, width: 450, fontSize: 9 },
  exclusions: { page: 1, x: 80, y: 630, width: 450, fontSize: 9 },
  fixtures: { page: 1, x: 80, y: 580, width: 450, fontSize: 9 },
  chattels: { page: 1, x: 80, y: 530, width: 450, fontSize: 9 },
  rentalItems: { page: 1, x: 80, y: 480, width: 450, fontSize: 9 },
  
  // Additional Terms (Page 3)
  additionalTerms: { page: 2, x: 80, y: 600, width: 450, fontSize: 9 },
  
  // Seller Information (Page 4)
  sellerLegalName: { page: 3, x: 120, y: 500, width: 400, fontSize: 10 },
  sellerAddress: { page: 3, x: 120, y: 475, width: 400, fontSize: 9 },
  sellerPhone: { page: 3, x: 120, y: 450, width: 200, fontSize: 10 },
  
  // Lawyer Information (Page 4)
  lawyerName: { page: 3, x: 120, y: 400, width: 300, fontSize: 10 },
  lawyerFirm: { page: 3, x: 120, y: 375, width: 300, fontSize: 10 },
  lawyerAddress: { page: 3, x: 120, y: 350, width: 400, fontSize: 9 },
  lawyerPhone: { page: 3, x: 120, y: 325, width: 200, fontSize: 10 },
  lawyerEmail: { page: 3, x: 120, y: 300, width: 300, fontSize: 10 },
};

// Signature and initial fields for Dropbox Sign
// These positions are where the seller needs to sign/initial
export const APS_2024_SIGNATURE_FIELDS: SignatureField[] = [
  {
    type: 'signature',
    page: 4,
    x: 100,
    y: 200,
    width: 200,
    height: 40,
    required: true,
    label: 'Seller Signature',
  },
  {
    type: 'date',
    page: 4,
    x: 320,
    y: 200,
    width: 120,
    height: 40,
    required: true,
    label: 'Date Signed',
  },
  {
    type: 'initial',
    page: 0,
    x: 500,
    y: 50,
    width: 50,
    height: 30,
    required: true,
    label: 'Initial Page 1',
  },
  {
    type: 'initial',
    page: 1,
    x: 500,
    y: 50,
    width: 50,
    height: 30,
    required: true,
    label: 'Initial Page 2',
  },
  {
    type: 'initial',
    page: 2,
    x: 500,
    y: 50,
    width: 50,
    height: 30,
    required: true,
    label: 'Initial Page 3',
  },
  {
    type: 'initial',
    page: 3,
    x: 500,
    y: 50,
    width: 50,
    height: 30,
    required: true,
    label: 'Initial Page 4',
  },
];

// Guidance notes for the mobile intake form
export const APS_2024_GUIDANCE: GuidanceNote[] = [
  {
    section: 'Property Information',
    field: 'propertyAddress',
    title: 'Property Address',
    description: 'The full civic address of the property being sold.',
    example: '123 Main Street, Toronto, ON M5V 1A1',
    tips: [
      'This should match the address on your deed',
      'Include unit number if applicable',
    ],
  },
  {
    section: 'Property Information',
    field: 'legalDescription',
    title: 'Legal Description',
    description: 'The legal description from your property deed or title.',
    example: 'LOT 15, PLAN 123, CITY OF TORONTO',
    tips: [
      'Found on your property deed or tax bill',
      'Contact your lawyer if you\'re unsure',
    ],
  },
  {
    section: 'Financial Terms',
    field: 'purchasePrice',
    title: 'Purchase Price',
    description: 'The total purchase price offered by the buyer.',
    tips: [
      'Verify this matches the buyer\'s offer',
      'This is the total price before adjustments',
    ],
  },
  {
    section: 'Financial Terms',
    field: 'depositAmount',
    title: 'Deposit Amount',
    description: 'The deposit amount the buyer will pay upon acceptance.',
    tips: [
      'Typically 5% of purchase price',
      'Held in trust by the buyer\'s brokerage',
    ],
  },
  {
    section: 'Financial Terms',
    field: 'depositDueDate',
    title: 'Deposit Due Date',
    description: 'When the deposit must be paid to the buyer\'s brokerage.',
    example: 'Within 24 hours of acceptance',
    tips: [
      'Usually within 24-48 hours of acceptance',
      'Verify this timeline works for you',
    ],
  },
  {
    section: 'Dates',
    field: 'completionDate',
    title: 'Completion Date',
    description: 'The date when ownership legally transfers to the buyer.',
    tips: [
      'Also called "closing date"',
      'Allow enough time to move out',
      'Consider timing with your next purchase',
    ],
  },
  {
    section: 'Dates',
    field: 'possessionDate',
    title: 'Possession Date',
    description: 'The date when the buyer can take physical possession of the property.',
    tips: [
      'Usually the same as completion date',
      'Can be different if negotiated',
    ],
  },
  {
    section: 'Inclusions & Exclusions',
    field: 'inclusions',
    title: 'Inclusions',
    description: 'Items that are included in the sale (beyond fixtures).',
    example: 'All window coverings, refrigerator, stove, dishwasher, central air conditioning',
    tips: [
      'List all appliances and equipment included',
      'Be specific to avoid disputes',
    ],
  },
  {
    section: 'Inclusions & Exclusions',
    field: 'exclusions',
    title: 'Exclusions',
    description: 'Items that you are keeping and will remove before closing.',
    example: 'Custom dining room chandelier, garden shed',
    tips: [
      'List anything you want to take with you',
      'Must be removed before possession date',
    ],
  },
  {
    section: 'Inclusions & Exclusions',
    field: 'fixtures',
    title: 'Fixtures',
    description: 'Items permanently attached to the property.',
    example: 'Light fixtures, built-in appliances, window coverings',
    tips: [
      'Fixtures automatically convey unless excluded',
      'List all fixtures included in the sale',
    ],
  },
  {
    section: 'Inclusions & Exclusions',
    field: 'chattels',
    title: 'Chattels',
    description: 'Moveable items included in the sale.',
    example: 'Freestanding appliances, furniture (if any)',
    tips: [
      'Chattels must be specifically listed',
      'Do not assume chattels are included',
    ],
  },
  {
    section: 'Inclusions & Exclusions',
    field: 'rentalItems',
    title: 'Rental Items',
    description: 'Any items on the property that are rented or leased.',
    example: 'Hot water tank ($25/month rental)',
    tips: [
      'Disclose all rental items and their costs',
      'Buyer will assume these rental agreements',
    ],
  },
  {
    section: 'Additional Terms',
    field: 'additionalTerms',
    title: 'Additional Terms',
    description: 'Any additional conditions or terms of the sale.',
    tips: [
      'Include any special arrangements',
      'Keep language clear and specific',
      'Consult your lawyer for complex terms',
    ],
  },
  {
    section: 'Seller Information',
    field: 'sellerLegalName',
    title: 'Your Legal Name',
    description: 'Your full legal name as it appears on the property title.',
    tips: [
      'Must match the name on your deed exactly',
      'Include middle names if on title',
    ],
  },
  {
    section: 'Seller Information',
    field: 'sellerAddress',
    title: 'Your Current Address',
    description: 'Your current mailing address for correspondence.',
    tips: [
      'Can be different from the property address',
      'Where you want legal notices sent',
    ],
  },
  {
    section: 'Lawyer Information',
    field: 'lawyerName',
    title: 'Lawyer Name',
    description: 'The name of your real estate lawyer.',
    tips: [
      'Contact a real estate lawyer if you don\'t have one',
      'They will handle the closing process',
    ],
  },
  {
    section: 'Lawyer Information',
    field: 'lawyerFirm',
    title: 'Law Firm',
    description: 'The name of your lawyer\'s law firm.',
  },
  {
    section: 'Lawyer Information',
    field: 'lawyerAddress',
    title: 'Lawyer Address',
    description: 'Your lawyer\'s office address.',
  },
  {
    section: 'Lawyer Information',
    field: 'lawyerPhone',
    title: 'Lawyer Phone',
    description: 'Your lawyer\'s phone number.',
  },
  {
    section: 'Lawyer Information',
    field: 'lawyerEmail',
    title: 'Lawyer Email',
    description: 'Your lawyer\'s email address.',
    tips: [
      'Used for sending documents and notices',
    ],
  },
];

// OREA version detection fingerprints
export const OREA_VERSION_FINGERPRINTS = {
  'APS-2024': {
    footerText: 'Form 100 - 2024',
    pageCount: 5,
    // Add more specific text patterns found in the 2024 version
    patterns: [
      'AGREEMENT OF PURCHASE AND SALE',
      'OREA',
      '2024',
    ],
  },
  'APS-2023': {
    footerText: 'Form 100 - 2023',
    pageCount: 5,
    patterns: [
      'AGREEMENT OF PURCHASE AND SALE',
      'OREA',
      '2023',
    ],
  },
};

// Helper to group guidance by section for UI rendering
export function getGuidanceBySections(): Record<string, GuidanceNote[]> {
  const sections: Record<string, GuidanceNote[]> = {};
  
  for (const note of APS_2024_GUIDANCE) {
    if (!sections[note.section]) {
      sections[note.section] = [];
    }
    sections[note.section].push(note);
  }
  
  return sections;
}

// Helper to get guidance for a specific field
export function getFieldGuidance(fieldName: string): GuidanceNote | undefined {
  return APS_2024_GUIDANCE.find(note => note.field === fieldName);
}

