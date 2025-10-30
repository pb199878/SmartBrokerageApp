import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MessageSubCategory } from '@prisma/client';

interface ClassificationResult {
  subCategory: MessageSubCategory;
  confidence: number;
  reasoning: string;
  method: 'heuristics' | 'ai';
}

interface HeuristicResult {
  subCategory: MessageSubCategory;
  confidence: number;
  signals: string[];
}

@Injectable()
export class ClassificationService {
  private genAI: GoogleGenerativeAI | null = null;
  private aiEnabled: boolean = false;

  constructor(private prisma: PrismaService) {
    // Initialize Gemini AI if API key is available
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.aiEnabled = true;
      console.log('✅ Gemini AI initialized for classification');
    } else {
      console.log('⚠️  Gemini AI not configured (GOOGLE_GEMINI_API_KEY missing)');
    }
  }

  /**
   * Classify a message using hybrid approach (heuristics first, AI if uncertain)
   * Now enhanced with document analysis results for better accuracy
   */
  async classifyMessage(
    messageId: string,
    subject: string,
    bodyText: string,
    attachments: any[],
    documentAnalyses?: any[], // Document analysis results from PDF extraction
  ): Promise<ClassificationResult> {
    console.log(`🔍 Classifying message: ${messageId}`);

    // Step 1: Try heuristic classification (now with document analysis data)
    const heuristicResult = this.heuristicClassification(subject, bodyText, attachments, documentAnalyses);

    console.log(`📊 Heuristic result: ${heuristicResult.subCategory} (${heuristicResult.confidence}% confidence)`);

    // Step 2: If confidence is high enough, use heuristic result
    if (heuristicResult.confidence >= 80) {
      return {
        subCategory: heuristicResult.subCategory,
        confidence: heuristicResult.confidence,
        reasoning: `Heuristic classification based on: ${heuristicResult.signals.join(', ')}`,
        method: 'heuristics',
      };
    }

    // Step 3: If confidence is low and AI is enabled, use AI classification
    if (this.aiEnabled && heuristicResult.confidence < 80) {
      try {
        console.log('🤖 Using AI classification (low heuristic confidence)');
        const aiResult = await this.aiClassification(subject, bodyText, attachments, documentAnalyses);
        return {
          ...aiResult,
          method: 'ai',
        };
      } catch (error) {
        console.error('❌ AI classification failed, falling back to heuristics:', error);
        // Fall back to heuristic result if AI fails
        return {
          subCategory: heuristicResult.subCategory,
          confidence: heuristicResult.confidence,
          reasoning: `Heuristic classification (AI failed): ${heuristicResult.signals.join(', ')}`,
          method: 'heuristics',
        };
      }
    }

    // Step 4: Return heuristic result if AI is not available
    return {
      subCategory: heuristicResult.subCategory,
      confidence: heuristicResult.confidence,
      reasoning: `Heuristic classification: ${heuristicResult.signals.join(', ')}`,
      method: 'heuristics',
    };
  }

  /**
   * Heuristic classification based on keywords, patterns, and document analysis
   */
  private heuristicClassification(
    subject: string,
    bodyText: string,
    attachments: any[],
    documentAnalyses?: any[],
  ): HeuristicResult {
    const combined = `${subject} ${bodyText}`.toLowerCase();
    const signals: string[] = [];
    let confidence = 0;
    let subCategory: MessageSubCategory = MessageSubCategory.GENERAL;

    // Step 1: Check document analysis results (HIGHEST CONFIDENCE)
    if (documentAnalyses && documentAnalyses.length > 0) {
      for (const analysis of documentAnalyses) {
        // Check if OREA form was detected
        if (analysis.oreaFormDetected && analysis.formType) {
          const formType = analysis.formType.toLowerCase();
          
          // Form 100 - Agreement of Purchase and Sale = NEW_OFFER
          if (formType.includes('form 100') || formType.includes('agreement of purchase')) {
            signals.push(`OREA Form 100 detected (${analysis.confidence}% confidence)`);
            confidence += 50; // Very high confidence
            subCategory = MessageSubCategory.NEW_OFFER;
          }
          // Form 120 - Amendment
          else if (formType.includes('form 120') || formType.includes('amendment')) {
            signals.push(`OREA Form 120 detected (${analysis.confidence}% confidence)`);
            confidence += 50;
            subCategory = MessageSubCategory.AMENDMENT;
          }
          // Form 221 - Counter Offer
          else if (formType.includes('form 221') || formType.includes('counter offer')) {
            signals.push(`OREA Form 221 detected (${analysis.confidence}% confidence)`);
            confidence += 50;
            subCategory = MessageSubCategory.UPDATED_OFFER;
          }
          // Other OREA forms
          else {
            signals.push(`OREA form detected: ${analysis.formType}`);
            confidence += 40;
            subCategory = MessageSubCategory.NEW_OFFER; // Default to offer for other forms
          }
        }
        
        // Use extracted text content for additional keyword matching
        if (analysis.textContent) {
          const textContent = analysis.textContent.toLowerCase();
          
          // Check for key offer indicators in PDF text
          if (textContent.includes('purchase price') && textContent.includes('deposit')) {
            signals.push('purchase price + deposit found in PDF');
            confidence += 15;
          }
          
          // Check for amendment indicators
          if (textContent.includes('hereby amend') || textContent.includes('amendment to')) {
            signals.push('amendment language in PDF');
            if (subCategory === MessageSubCategory.GENERAL) {
              subCategory = MessageSubCategory.AMENDMENT;
              confidence += 20;
            }
          }
        }
      }
    }

    // Step 2: Check email subject and body for OFFER signals
    const offerKeywords = ['offer', 'aps', 'purchase', 'agreement of purchase', 'form 100'];
    const offerCount = offerKeywords.filter(keyword => combined.includes(keyword)).length;
    
    if (offerCount > 0) {
      signals.push(`${offerCount} offer keyword(s) in email`);
      confidence += offerCount * 15; // Slightly lower weight since PDF analysis is more reliable
    }

    // Step 3: Check for offer-related attachments (filename analysis)
    const hasOfferAttachment = attachments.some(att => {
      const filename = (att.filename || '').toLowerCase();
      return filename.includes('aps') || 
             filename.includes('offer') || 
             filename.includes('form') ||
             filename.includes('agreement');
    });

    if (hasOfferAttachment && confidence === 0) { // Only if we don't have PDF analysis
      signals.push('offer-related attachment filename');
      confidence += 25;
    }

    // Step 4: Check for AMENDMENT signals (only if not already detected via PDF)
    if (subCategory === MessageSubCategory.GENERAL) {
      const amendmentKeywords = ['amendment', 'form 120', 'amend', 'change to'];
      const amendmentCount = amendmentKeywords.filter(keyword => combined.includes(keyword)).length;
      
      if (amendmentCount > 0 && combined.includes('offer')) {
        signals.push(`${amendmentCount} amendment keyword(s) in email`);
        confidence += amendmentCount * 15;
        subCategory = MessageSubCategory.AMENDMENT;
      }
    }

    // Step 5: Check for UPDATED_OFFER signals (only if not already categorized by document analysis)
    // IMPORTANT: Don't override high-confidence document analysis with email text
    const hasHighConfidenceDocAnalysis = documentAnalyses && documentAnalyses.length > 0 && 
                                         documentAnalyses.some(d => d.oreaFormDetected);
    
    if ((subCategory === MessageSubCategory.GENERAL || subCategory === MessageSubCategory.NEW_OFFER) && 
        !hasHighConfidenceDocAnalysis) {
      // "new offer" removed - it's not an update indicator, it's for NEW offers
      const updateKeywords = ['updated offer', 'revised offer', 'counter offer', 'counter-offer'];
      const updateCount = updateKeywords.filter(keyword => combined.includes(keyword)).length;
      
      if (updateCount > 0) {
        signals.push(`${updateCount} update keyword(s) in email`);
        confidence += updateCount * 15;
        subCategory = MessageSubCategory.UPDATED_OFFER;
      }
    }

    // Step 6: Check for VIEWING_REQUEST signals (only if low/no confidence so far)
    if (confidence < 40) {
      const viewingKeywords = ['showing', 'view', 'visit', 'tour', 'see the property', 'appointment'];
      const viewingCount = viewingKeywords.filter(keyword => combined.includes(keyword)).length;
      
      if (viewingCount > 0) {
        signals.push(`${viewingCount} viewing keyword(s) in email`);
        const viewingConfidence = viewingCount * 15;
        
        // Only classify as viewing if it's the strongest signal
        if (viewingConfidence > confidence || confidence === 0) {
          confidence = viewingConfidence;
          subCategory = MessageSubCategory.VIEWING_REQUEST;
        }
      }
    }

    // Step 7: Final category determination (if still GENERAL)
    // If strong offer signals, classify as NEW_OFFER (unless amendment or update was detected)
    if (offerCount >= 2 && subCategory === MessageSubCategory.GENERAL) {
      subCategory = MessageSubCategory.NEW_OFFER;
    }

    // If we detected offer but also update/counter in email, it's an updated offer
    // BUT: Don't override high-confidence OREA form detection
    const updateKeywords = ['updated', 'revised', 'counter'];
    const hasUpdateKeyword = updateKeywords.some(kw => combined.includes(kw));
    const formBasedClassification = documentAnalyses && documentAnalyses.length > 0 && 
                                    documentAnalyses.some(d => d.oreaFormDetected);
    
    if (offerCount > 0 && hasUpdateKeyword && subCategory !== MessageSubCategory.AMENDMENT && !formBasedClassification) {
      subCategory = MessageSubCategory.UPDATED_OFFER;
    }

    // Cap confidence at 100
    confidence = Math.min(confidence, 100);

    // If no signals detected, default to GENERAL with low confidence
    if (signals.length === 0) {
      signals.push('no specific keywords detected');
      confidence = 10;
      subCategory = MessageSubCategory.GENERAL;
    }

    return {
      subCategory,
      confidence,
      signals,
    };
  }

  /**
   * AI-based classification using Google Gemini
   * Enhanced with document analysis results
   */
  private async aiClassification(
    subject: string,
    bodyText: string,
    attachments: any[],
    documentAnalyses?: any[],
  ): Promise<Pick<ClassificationResult, 'subCategory' | 'confidence' | 'reasoning'>> {
    if (!this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    // Use Gemini 2.5 Flash (fast and free)
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Build attachment context
    const attachmentContext = attachments.map(att => {
      return `- ${att.filename || 'unknown'} (${att.contentType || 'unknown type'}, ${att.size || 0} bytes)`;
    }).join('\n');

    // Build document analysis context
    let analysisContext = 'No PDF analysis available';
    if (documentAnalyses && documentAnalyses.length > 0) {
      analysisContext = documentAnalyses.map(analysis => {
        let text = `PDF Analysis:\n`;
        if (analysis.oreaFormDetected) {
          text += `  - OREA Form Detected: ${analysis.formType} (${analysis.confidence}% confidence)\n`;
        }
        if (analysis.extractedData) {
          text += `  - Extracted Data: ${JSON.stringify(analysis.extractedData)}\n`;
        }
        if (analysis.textContent) {
          // Include first 500 chars of PDF text
          text += `  - PDF Content Preview: ${analysis.textContent.substring(0, 500)}...\n`;
        }
        return text;
      }).join('\n\n');
    }

    // Create prompt with document analysis
    const prompt = `You are an AI assistant helping classify real estate emails. 

Analyze the following email and classify it into ONE of these categories:
- NEW_OFFER: A new offer on a property (includes signed APS forms)
- UPDATED_OFFER: A revised or counter offer
- VIEWING_REQUEST: Request to schedule a property viewing/showing
- AMENDMENT: Amendment to an existing agreement
- GENERAL: General inquiry or other communication

Email Details:
Subject: ${subject}

Body:
${bodyText}

Attachments:
${attachmentContext || 'None'}

Document Analysis Results:
${analysisContext}

IMPORTANT: If an OREA Form was detected in the PDF analysis, use that information heavily in your classification:
- Form 100 (Agreement of Purchase and Sale) = NEW_OFFER
- Form 120 (Amendment) = AMENDMENT
- Form 221 (Counter Offer) = UPDATED_OFFER

Respond ONLY with valid JSON in this exact format:
{
  "category": "<one of: NEW_OFFER, UPDATED_OFFER, VIEWING_REQUEST, AMENDMENT, GENERAL>",
  "confidence": <number 0-100>,
  "reasoning": "<brief explanation of why you chose this category>"
}`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Extract JSON from response (Gemini sometimes wraps it in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and convert category to enum
      const categoryMap: Record<string, MessageSubCategory> = {
        'NEW_OFFER': MessageSubCategory.NEW_OFFER,
        'UPDATED_OFFER': MessageSubCategory.UPDATED_OFFER,
        'VIEWING_REQUEST': MessageSubCategory.VIEWING_REQUEST,
        'AMENDMENT': MessageSubCategory.AMENDMENT,
        'GENERAL': MessageSubCategory.GENERAL,
      };

      const subCategory = categoryMap[parsed.category];
      if (!subCategory) {
        throw new Error(`Invalid category from AI: ${parsed.category}`);
      }

      return {
        subCategory,
        confidence: Math.min(Math.max(parsed.confidence, 0), 100),
        reasoning: parsed.reasoning || 'AI classification',
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      throw error;
    }
  }

  /**
   * Update message with classification results
   */
  async updateMessageClassification(
    messageId: string,
    result: ClassificationResult,
  ): Promise<void> {
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        subCategory: result.subCategory,
        classificationConfidence: result.confidence,
        classificationReasoning: `${result.method.toUpperCase()}: ${result.reasoning}`,
      },
    });

    console.log(`✅ Updated message ${messageId} classification: ${result.subCategory} (${result.confidence}%)`);
  }
}

