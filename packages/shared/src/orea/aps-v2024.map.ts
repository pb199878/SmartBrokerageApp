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
  type: "signature" | "initial" | "date";
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
// NOTE: Page numbers are 0-BASED (page 0 = first page)
// NOTE: Dropbox Sign Y is measured from TOP of box, PDF Y is from BOTTOM of box
//       Dropbox Sign uses TOP-LEFT origin, Y increases going DOWN
//       Standard PDF uses BOTTOM-LEFT origin, Y increases going UP
//       Conversion: Dropbox Y = Page Height - PDF Y - Box Height
//       For letter-size (11"): Dropbox Y = 792 - PDF_Y_bottom - height
export const APS_2024_SIGNATURE_FIELDS: SignatureField[] = [
  {
    type: "initial",
    page: 0, // Page 1 (0-based)
    x: 511,
    y: 696, // 792 - 66 - 30 = 696 (converted: page height - bottom Y - box height)
    width: 64,
    height: 30,
    required: true,
    label: "Initial Page 1",
  },
  {
    type: "initial",
    page: 1, // Page 2 (0-based)
    x: 511,
    y: 696, // 792 - 66 - 30 = 696
    width: 64,
    height: 30,
    required: true,
    label: "Initial Page 2",
  },
  {
    type: "initial",
    page: 2, // Page 3 (0-based)
    x: 511,
    y: 696, // 792 - 66 - 30 = 696
    width: 64,
    height: 30,
    required: true,
    label: "Initial Page 3",
  },
  {
    type: "initial",
    page: 3, // Page 4 (0-based)
    x: 511,
    y: 696, // 792 - 66 - 30 = 696
    width: 64,
    height: 30,
    required: true,
    label: "Initial Page 4",
  },
  {
    type: "initial",
    page: 5, // Page 5 (0-based)
    x: 511,
    y: 696, // 792 - 66 - 30 = 696
    width: 64,
    height: 30,
    required: true,
    label: "Initial Page 6",
  },
  // SIGNATURE BOXES - "SIGNED, SEALED AND DELIVERED" section (Page 5, 0-based index 4)
  {
    type: "signature",
    page: 4,
    x: 258,
    y: 172,
    width: 172,
    height: 15,
    required: true,
    label: "Seller Signature",
  },
  {
    type: "signature",
    page: 4,
    x: 258,
    y: 202,
    width: 172,
    height: 15,
    required: false,
    label: "Seller Signature",
  },
  {
    type: "signature",
    page: 4, // Page 5 (0-based)
    x: 330,
    y: 318, // 792 - 454 - 20 = 318 (converted: page height - bottom Y - box height)
    width: 237,
    height: 20,
    required: true,
    label: "Seller Signature",
  },
  // Acknowlodgement section
  {
    type: "signature",
    page: 4, // Page 5 (0-based)
    x: 43,
    y: 484, // 792 - 454 - 20 = 318 (converted: page height - bottom Y - box height)
    width: 179,
    height: 15,
    required: true,
    label: "Buyer Acknowledgement Signature",
  },
];

// Guidance notes for the mobile intake form
// Most fields are PREFILLED from listing. Seller just reviews and adds optional details.
export const APS_2024_GUIDANCE: GuidanceNote[] = [
  // Buyer's Offer Fields (for review screen)
  {
    section: "Buyer's Offer",
    field: "purchasePrice",
    title: "Purchase Price",
    description:
      "The total amount the buyer is offering to pay for your property.",
    tips: [
      "This is the full price before any adjustments",
      "Does not include closing costs or land transfer tax",
    ],
  },
  {
    section: "Buyer's Offer",
    field: "depositAmount",
    title: "Deposit",
    description: "Amount the buyer will pay as a deposit upon acceptance.",
    tips: [
      "Typically 5% of the purchase price",
      "Held in trust by the buyer's brokerage",
      "Applied to purchase price at closing",
    ],
  },
  {
    section: "Buyer's Offer",
    field: "depositDue",
    title: "Deposit Due",
    description: "When the buyer must pay the deposit.",
    tips: ["Usually within 24-48 hours of acceptance"],
  },
  {
    section: "Buyer's Offer",
    field: "closingDate",
    title: "Closing Date",
    description: "The date when ownership legally transfers to the buyer.",
    tips: [
      'Also called "completion date"',
      "Make sure you have enough time to move",
      "Consider timing with your next home purchase",
    ],
  },
  {
    section: "Buyer's Offer",
    field: "possessionDate",
    title: "Possession Date",
    description:
      "When the buyer can physically take possession of the property.",
    tips: [
      "Usually the same as closing date",
      "You must be completely moved out by this date",
    ],
  },
  {
    section: "Buyer's Offer",
    field: "conditions",
    title: "Conditions",
    description: "Requirements that must be met for the sale to proceed.",
    tips: [
      "Common: financing approval, home inspection, condo docs review",
      "Sale only firm when all conditions are satisfied or waived",
      "Pay attention to condition deadlines",
    ],
  },
  {
    section: "Buyer's Offer",
    field: "buyerName",
    title: "Buyer",
    description: "The person(s) purchasing your property.",
  },
  {
    section: "Buyer's Offer",
    field: "buyerLawyer",
    title: "Buyer's Lawyer",
    description: "The lawyer representing the buyer in this transaction.",
  },
  {
    section: "What's Included",
    field: "inclusions",
    title: "Inclusions",
    description: "Items the buyer expects to be included with the property.",
    tips: [
      "Review carefully - make sure you're okay leaving these items",
      "Fixtures (attached items) usually included unless excluded",
    ],
  },
  {
    section: "Your Information (Review)",
    field: "sellerLegalName",
    title: "Your Legal Name",
    description: "Confirm this matches your property title exactly.",
    tips: [
      "Prefilled from your listing",
      "Edit if it doesn't match your title exactly",
    ],
  },
  {
    section: "Your Information (Review)",
    field: "sellerAddress",
    title: "Your Current Address",
    description: "Where you want correspondence and legal notices sent.",
    tips: [
      "Prefilled from your listing",
      "Update if you want notices sent elsewhere",
    ],
  },
  {
    section: "Your Information (Review)",
    field: "sellerPhone",
    title: "Your Phone Number",
    description: "Contact number for any questions during the sale.",
    tips: ["Prefilled from your listing"],
  },
  {
    section: "Your Information (Review)",
    field: "sellerEmail",
    title: "Your Email",
    description: "Email for documents and updates.",
    tips: ["Prefilled from your account"],
  },
  {
    section: "Lawyer Information (Review)",
    field: "lawyerName",
    title: "Lawyer Name",
    description: "Your real estate lawyer handling the closing.",
    tips: ["Prefilled from your listing", "Update if you've changed lawyers"],
  },
  {
    section: "Lawyer Information (Review)",
    field: "lawyerFirm",
    title: "Law Firm",
    description: "The name of your lawyer's law firm.",
    tips: ["Prefilled from your listing"],
  },
  {
    section: "Lawyer Information (Review)",
    field: "lawyerAddress",
    title: "Lawyer Address",
    description: "Your lawyer's office address.",
    tips: ["Prefilled from your listing"],
  },
  {
    section: "Lawyer Information (Review)",
    field: "lawyerPhone",
    title: "Lawyer Phone",
    description: "Your lawyer's phone number.",
    tips: ["Prefilled from your listing"],
  },
  {
    section: "Lawyer Information (Review)",
    field: "lawyerEmail",
    title: "Lawyer Email",
    description: "Your lawyer's email for documents.",
    tips: ["Prefilled from your listing"],
  },
  {
    section: "Property Details",
    field: "exclusions",
    title: "Items You're Taking (Exclusions)",
    description:
      "List any items you want to keep and remove before the buyer moves in.",
    example: "Custom dining room chandelier, grandfather clock, garden shed",
    tips: [
      "These items must be removed by possession date",
      "Be specific to avoid disputes",
      "Leave blank if you're not taking anything",
    ],
  },
  {
    section: "Property Details",
    field: "rentalItems",
    title: "Rental Items",
    description:
      "Any items on the property that are rented or leased (buyer will assume these).",
    example: "Hot water tank - $25/month rental from XYZ Company",
    tips: [
      "Include monthly cost and provider name",
      "Buyer will take over these rental agreements",
      "Leave blank if no rental items",
    ],
  },
  {
    section: "Additional Information",
    field: "sellerNotes",
    title: "Additional Notes (Optional)",
    description:
      "Any other information you want to include about the property or sale.",
    tips: [
      "Recent upgrades or repairs",
      "Special instructions for possession",
      "Anything else the buyer should know",
    ],
  },
];

// OREA version detection fingerprints
export const OREA_VERSION_FINGERPRINTS = {
  "APS-2024": {
    footerText: "Form 100 - 2024",
    pageCount: 5,
    // Add more specific text patterns found in the 2024 version
    patterns: ["AGREEMENT OF PURCHASE AND SALE", "OREA", "2024"],
  },
  "APS-2023": {
    footerText: "Form 100 - 2023",
    pageCount: 5,
    patterns: ["AGREEMENT OF PURCHASE AND SALE", "OREA", "2023"],
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
  return APS_2024_GUIDANCE.find((note) => note.field === fieldName);
}
