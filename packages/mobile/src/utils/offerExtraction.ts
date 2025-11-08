/**
 * Utility functions for extracting comprehensive offer data
 * from document analysis (formFieldsExtracted or legacy extractedData)
 */

import type { ApsParseResult, ApsIntake } from '@smart-brokerage/shared';

/**
 * Extract comprehensive offer data from an offer object
 * Prioritizes formFieldsExtracted (comprehensive Gemini/AcroForm data)
 * Falls back to legacy extractedData format
 */
export function extractComprehensiveOfferData(offer: any): {
  // Buyer information
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;
  
  // Buyer lawyer information
  buyerLawyer?: string;
  buyerLawyerEmail?: string;
  buyerLawyerAddress?: string;
  buyerLawyerPhone?: string;
  
  // Property information
  propertyAddress?: string;
  propertyLegalDescription?: string;
  
  // Financial details
  purchasePrice?: number;
  depositAmount?: number;
  depositTiming?: string;
  
  // Dates
  closingDate?: Date;
  expiryDate?: Date;
  
  // Inclusions/Exclusions
  inclusions?: string;
  exclusions?: string;
  rentalItems?: string;
  
  // HST
  hst?: string;
  
  // Additional details
  additionalTerms?: string;
} {
  // Look for document analysis in the offer's messages
  const attachment = offer?.messages
    ?.flatMap((msg: any) => msg.attachments || [])
    ?.find((att: any) => 
      att.documentAnalysis?.formFieldsExtracted || 
      att.documentAnalysis?.extractedData
    );

  const documentAnalysis = attachment?.documentAnalysis;

  if (!documentAnalysis) {
    return {};
  }

  // Try comprehensive formFieldsExtracted first (ApsParseResult from Gemini/AcroForm)
  if (documentAnalysis.formFieldsExtracted) {
    const apsData = documentAnalysis.formFieldsExtracted as ApsParseResult;
    
    return {
      buyerName: apsData.buyer_full_name,
      buyerEmail: apsData.notices?.buyer_email,
      buyerPhone: undefined, // Not in current schema
      buyerAddress: undefined, // Not in current schema
      
      buyerLawyer: apsData.acknowledgment?.buyer?.lawyer?.name,
      buyerLawyerEmail: apsData.acknowledgment?.buyer?.lawyer?.email,
      buyerLawyerAddress: apsData.acknowledgment?.buyer?.lawyer?.address,
      buyerLawyerPhone: undefined, // Not in current schema
      
      propertyAddress: apsData.property?.property_address,
      propertyLegalDescription: apsData.property?.property_legal_description,
      
      purchasePrice: apsData.price_and_deposit?.purchase_price?.numeric,
      depositAmount: apsData.price_and_deposit?.deposit?.numeric,
      depositTiming: apsData.price_and_deposit?.deposit?.timing,
      
      closingDate: parseDateFromApsResult(apsData.completion),
      expiryDate: parseDateFromApsResult(apsData.irrevocability),
      
      inclusions: apsData.inclusions_exclusions?.chattels_included?.join(', '),
      exclusions: apsData.inclusions_exclusions?.fixtures_excluded?.join(', '),
      rentalItems: apsData.inclusions_exclusions?.rental_items?.join(', '),
      
      hst: apsData.hst,
      
      additionalTerms: undefined, // Not in current schema
    };
  }

  // Fallback to legacy extractedData
  if (documentAnalysis.extractedData) {
    const data = documentAnalysis.extractedData;
    
    return {
      buyerName: data.buyerName,
      buyerEmail: data.buyerEmail,
      buyerPhone: data.buyerPhone,
      buyerAddress: data.buyerAddress,
      
      buyerLawyer: data.buyerLawyer,
      buyerLawyerEmail: data.buyerLawyerEmail,
      buyerLawyerAddress: data.buyerLawyerAddress,
      buyerLawyerPhone: data.buyerLawyerPhone,
      
      propertyAddress: data.propertyAddress,
      propertyLegalDescription: undefined, // Not in legacy format
      
      purchasePrice: data.purchasePrice || data.price,
      depositAmount: data.deposit,
      depositTiming: data.depositDue,
      
      closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      
      inclusions: data.inclusions,
      exclusions: data.exclusions,
      rentalItems: undefined, // Not in legacy format
      
      hst: undefined, // Not in legacy format
      
      additionalTerms: undefined,
    };
  }

  return {};
}

/**
 * Parse date from ApsParseResult date parts (day, month, year, time)
 * Helper function matching the backend logic
 */
function parseDateFromApsResult(dateParts: {
  day?: string;
  month?: string;
  year?: string;
  time?: string;
} | undefined): Date | undefined {
  if (!dateParts?.day || !dateParts?.month || !dateParts?.year) {
    return undefined;
  }

  try {
    // Clean the date parts
    const cleanDay = cleanDateTimeString(dateParts.day);
    const cleanMonth = cleanDateTimeString(dateParts.month);
    const cleanYear = cleanDateTimeString(dateParts.year);

    if (!cleanDay || !cleanMonth || !cleanYear) {
      return undefined;
    }

    // Convert month name to number
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    const monthLower = cleanMonth.toLowerCase();
    const monthIndex = monthNames.findIndex(m => monthLower.startsWith(m.substring(0, 3)));
    
    if (monthIndex === -1) {
      return undefined;
    }

    const dayNum = parseInt(cleanDay, 10);
    const yearNum = parseInt(cleanYear, 10);

    if (isNaN(dayNum) || isNaN(yearNum)) {
      return undefined;
    }

    const date = new Date(yearNum, monthIndex, dayNum);

    // Parse time if provided
    if (dateParts.time) {
      const cleanTime = cleanDateTimeString(dateParts.time);
      if (cleanTime) {
        const timeMatch = cleanTime.match(/(\d{1,2}):?(\d{2})?/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          
          if (dateParts.time?.toLowerCase().includes('pm') && hours < 12) {
            hours += 12;
          } else if (dateParts.time?.toLowerCase().includes('am') && hours === 12) {
            hours = 0;
          }
          
          date.setHours(hours, minutes, 0, 0);
        }
      }
    } else {
      date.setHours(12, 0, 0, 0);
    }

    return isNaN(date.getTime()) ? undefined : date;
  } catch (error) {
    return undefined;
  }
}

/**
 * Clean date/time string by removing ordinal suffixes and extra spaces
 */
function cleanDateTimeString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  
  return value
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
    .replace(/\s*(AM|PM|am|pm|a\.m\.|p\.m\.)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert comprehensive offer data to ApsIntake format for the guided form
 * Pre-fills buyer data from extracted offer, leaving seller fields empty for input
 */
export function convertOfferDataToApsIntake(
  offerData: ReturnType<typeof extractComprehensiveOfferData>,
  sellerDefaults?: Partial<ApsIntake>
): ApsIntake {
  return {
    // Property (from buyer's offer)
    propertyAddress: offerData.propertyAddress,
    legalDescription: offerData.propertyLegalDescription,
    
    // Financial (from buyer's offer)
    purchasePrice: offerData.purchasePrice,
    depositAmount: offerData.depositAmount,
    depositDueDate: offerData.depositTiming,
    
    // Dates (from buyer's offer)
    completionDate: offerData.closingDate?.toISOString(),
    possessionDate: undefined,
    
    // Seller information (prefilled from defaults, editable)
    sellerLegalName: sellerDefaults?.sellerLegalName || '',
    sellerAddress: sellerDefaults?.sellerAddress || '',
    sellerPhone: sellerDefaults?.sellerPhone || '',
    sellerEmail: sellerDefaults?.sellerEmail || '',
    
    // Lawyer information (prefilled from defaults, editable)
    lawyerName: sellerDefaults?.lawyerName || '',
    lawyerFirm: sellerDefaults?.lawyerFirm || '',
    lawyerAddress: sellerDefaults?.lawyerAddress || '',
    lawyerPhone: sellerDefaults?.lawyerPhone || '',
    lawyerEmail: sellerDefaults?.lawyerEmail || '',
    
    // Inclusions/Exclusions (from buyer's offer + seller can add exclusions)
    inclusions: offerData.inclusions,
    exclusions: offerData.exclusions || '', // Seller fills this
    fixtures: undefined,
    chattels: offerData.inclusions,
    
    // Rental items (seller fills this)
    rentalItems: offerData.rentalItems || '',
    
    // Additional terms
    additionalTerms: offerData.additionalTerms,
    
    // Optional notes from seller
    sellerNotes: '',
  };
}

