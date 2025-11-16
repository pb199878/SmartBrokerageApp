import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DropboxSignService } from "../../common/dropbox-sign/dropbox-sign.service";
import { SupabaseService } from "../../common/supabase/supabase.service";
import { MailgunService } from "../../common/mailgun/mailgun.service";
import { PdfService } from "./pdf.service";
import { OfferStatus, MessageSubCategory } from "@prisma/client";
import {
  DeclineOfferDto,
  CounterOfferDto,
  ApsIntake,
  ApsParseResult,
} from "@smart-brokerage/shared";

@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private dropboxSignService: DropboxSignService,
    private supabaseService: SupabaseService,
    private mailgunService: MailgunService,
    private pdfService: PdfService
  ) {}

  /**
   * Create offer from classified message with attachments
   * Automatically called when message is classified as NEW_OFFER or UPDATED_OFFER
   */
  async createOfferFromMessage(messageId: string): Promise<any> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        thread: {
          include: {
            listing: true,
            sender: true,
          },
        },
        attachments: {
          include: {
            documentAnalysis: true,
          },
        },
      },
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // Check if offer already exists for this message (prevents duplicates from webhook retries)
    const existingOffer = await this.prisma.offer.findFirst({
      where: { messageId },
    });

    if (existingOffer) {
      console.log(`Offer already exists for message ${messageId}`);
      return existingOffer;
    }

    // Check if buyer already has an active offer on THIS LISTING
    // Business rule: One active offer per buyer per listing
    // (Buyer can have offers on multiple listings, but not multiple offers on same listing)
    const existingActiveOfferOnListing = await this.prisma.offer.findFirst({
      where: {
        thread: {
          listingId: message.thread.listingId, // Same listing
          senderId: message.thread.senderId, // Same buyer
        },
        status: {
          in: [
            OfferStatus.PENDING_REVIEW,
            OfferStatus.AWAITING_SELLER_SIGNATURE,
            OfferStatus.AWAITING_BUYER_SIGNATURE,
          ],
        },
      },
      include: {
        thread: true,
      },
    });

    if (existingActiveOfferOnListing) {
      console.log(
        `⚠️  Buyer already has active offer on this listing. Handling...`
      );

      // Handle based on message sub-category
      if (
        message.subCategory === "UPDATED_OFFER" ||
        message.subCategory === "AMENDMENT"
      ) {
        // This is an update/amendment to existing offer - update it instead of creating new
        console.log(
          `Treating as update to existing offer ${existingActiveOfferOnListing.id}`
        );
        return await this.updateExistingOffer(
          existingActiveOfferOnListing.id,
          messageId
        );
      } else {
        // New independent offer - auto-expire the old one
        console.log(
          `Auto-expiring old offer ${existingActiveOfferOnListing.id} - buyer submitted new offer`
        );

        await this.prisma.offer.update({
          where: { id: existingActiveOfferOnListing.id },
          data: {
            status: OfferStatus.EXPIRED,
            declineReason:
              "Buyer submitted a new offer, previous offer automatically expired",
          },
        });

        // Clear activeOfferId from old thread
        await this.prisma.thread.update({
          where: { id: existingActiveOfferOnListing.threadId },
          data: { activeOfferId: null },
        });

        console.log(`✅ Old offer expired, proceeding with new offer`);
      }
    }

    // Extract offer details from document analysis
    // Find the primary offer document (highest relevance score)
    const offerAttachment = message.attachments
      .filter((att) => att.documentAnalysis?.oreaFormDetected)
      .sort(
        (a, b) =>
          (b.documentAnalysis?.relevanceScore || 0) -
          (a.documentAnalysis?.relevanceScore || 0)
      )[0];

    // Check validation status - auto-reject if failed
    const validationStatus =
      offerAttachment?.documentAnalysis?.validationStatus;
    const hasRequiredSignatures =
      offerAttachment?.documentAnalysis?.hasRequiredSignatures;

    // Reject if validation failed OR if required signatures are missing
    const shouldReject =
      validationStatus === "failed" || hasRequiredSignatures === false;

    if (shouldReject) {
      const validationErrors = Array.isArray(
        offerAttachment.documentAnalysis.validationErrors
      )
        ? offerAttachment.documentAnalysis.validationErrors
        : [];

      // Add signature error if missing
      if (hasRequiredSignatures === false) {
        validationErrors.push("Missing required buyer signatures/initials");
      }

      console.log(`❌ Offer validation failed. Auto-rejecting...`);
      console.log(`   - Validation status: ${validationStatus}`);
      console.log(`   - Has required signatures: ${hasRequiredSignatures}`);

      await this.autoRejectInvalidOffer(
        message,
        offerAttachment,
        validationErrors
      );
      throw new Error(
        "Offer automatically rejected due to validation failures"
      );
    }

    // Extract offer data using new helper method (supports both comprehensive and legacy formats)
    const extractedData = this.extractOfferDataFromAttachment(offerAttachment);
    let price = extractedData.price;
    let deposit = extractedData.deposit;
    let closingDate = extractedData.closingDate;
    let expiryDate = extractedData.expiryDate;
    let conditions = extractedData.conditions;
    let scheduleAConditions = extractedData.scheduleAConditions;
    let originalDocumentS3Key = extractedData.s3Key;

    // Set default expiry date if none was extracted (24 hours from now)
    // This handles empty OREA forms or forms without clear expiry dates
    if (!expiryDate) {
      expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 24);
      console.log(
        `⏰ No expiry date found in document, defaulting to 24 hours: ${expiryDate.toISOString()}`
      );
    }

    // Mark any previous pending offers on this thread as expired
    // This handles the case where a buyer submits a new offer before the seller reviews the first one
    const expiredCount = await this.prisma.offer.updateMany({
      where: {
        threadId: message.threadId,
        status: OfferStatus.PENDING_REVIEW,
      },
      data: {
        status: OfferStatus.EXPIRED,
        updatedAt: new Date(),
      },
    });

    if (expiredCount.count > 0) {
      console.log(
        `📝 Marked ${expiredCount.count} previous pending offer(s) on thread ${message.threadId} as expired`
      );
    }

    // Create offer record
    const offer = await this.prisma.offer.create({
      data: {
        threadId: message.threadId,
        messageId: message.id,
        status: OfferStatus.PENDING_REVIEW,
        price,
        deposit,
        closingDate,
        expiryDate,
        conditions,
        originalDocumentS3Key,
      },
    });

    // Update message with offer ID
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        offerId: offer.id,
      },
    });

    // Update thread with active offer
    await this.prisma.thread.update({
      where: { id: message.threadId },
      data: { activeOfferId: offer.id },
    });

    // Create OfferCondition records if Schedule A conditions were extracted
    if (scheduleAConditions && scheduleAConditions.length > 0) {
      await this.createOfferConditions(offer.id, scheduleAConditions);
    }

    console.log(`✅ Created offer ${offer.id} from message ${messageId}`);
    console.log(`   - Status: ${offer.status}`);
    console.log(`   - Price: ${offer.price}`);
    console.log(`   - Expiry: ${offer.expiryDate}`);
    console.log(`   - Message updated with offerId: ${offer.id}`);

    return offer;
  }

  /**
   * Update existing offer with new message (for UPDATED_OFFER or AMENDMENT)
   */
  private async updateExistingOffer(
    offerId: string,
    newMessageId: string
  ): Promise<any> {
    const newMessage = await this.prisma.message.findUnique({
      where: { id: newMessageId },
      include: {
        attachments: {
          include: {
            documentAnalysis: true,
          },
        },
      },
    });

    if (!newMessage) {
      throw new Error(`Message ${newMessageId} not found`);
    }

    // Extract updated offer details from new message's document analysis
    let updateData: any = {};

    const offerAttachment = newMessage.attachments
      .filter((att) => att.documentAnalysis?.oreaFormDetected)
      .sort(
        (a, b) =>
          (b.documentAnalysis?.relevanceScore || 0) -
          (a.documentAnalysis?.relevanceScore || 0)
      )[0];

    // Extract offer data using new helper method (supports both comprehensive and legacy formats)
    const extractedData = this.extractOfferDataFromAttachment(offerAttachment);

    if (extractedData.price !== undefined)
      updateData.price = extractedData.price;
    if (extractedData.deposit !== undefined)
      updateData.deposit = extractedData.deposit;
    if (extractedData.closingDate)
      updateData.closingDate = extractedData.closingDate;
    if (extractedData.expiryDate)
      updateData.expiryDate = extractedData.expiryDate;
    if (extractedData.conditions)
      updateData.conditions = extractedData.conditions;
    if (extractedData.s3Key)
      updateData.originalDocumentS3Key = extractedData.s3Key;

    // Update offer with new details
    const updatedOffer = await this.prisma.offer.update({
      where: { id: offerId },
      data: updateData,
    });

    // Link new message to this offer
    await this.prisma.message.update({
      where: { id: newMessageId },
      data: { offerId },
    });

    console.log(`✅ Updated offer ${offerId} with new message ${newMessageId}`);

    return updatedOffer;
  }

  /**
   * Get offer by ID with all related data
   */
  async getOffer(offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        thread: {
          include: {
            listing: true,
            sender: true,
          },
        },
        messages: {
          include: {
            attachments: {
              include: {
                documentAnalysis: true,
              },
            },
          },
        },
        offerConditions: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!offer) {
      throw new Error(`Offer ${offerId} not found`);
    }

    return offer;
  }

  /**
   * Get all offers for a thread
   */
  async getOffersByThread(threadId: string) {
    return this.prisma.offer.findMany({
      where: { threadId },
      include: {
        messages: {
          include: {
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Prepare offer for signing with guided intake workflow
   * - Loads buyer's original PDF
   * - Detects OREA version
   * - Flattens buyer's fields (preserves their data)
   * - Prefills seller's intake data
   * - Creates Dropbox Sign embedded signature request
   */
  /**
   * Merge comprehensive extracted data from formFieldsExtracted with seller's intake
   * This creates a complete ApsIntake with all buyer data + seller's input
   */
  private mergeExtractedDataWithIntake(
    offer: any,
    sellerIntake: ApsIntake
  ): ApsIntake {
    // Extract comprehensive data using the same method as mobile
    const extractedData = this.extractOfferDataFromAttachment(
      offer.messages
        ?.flatMap((msg: any) => msg.attachments || [])
        ?.find(
          (att: any) =>
            att.documentAnalysis?.formFieldsExtracted ||
            att.documentAnalysis?.extractedData
        )
    );

    // Merge: Start with extracted data, overlay seller's input
    const merged: ApsIntake = {
      // Property info (from extracted data, seller doesn't modify)
      propertyAddress: extractedData.s3Key
        ? sellerIntake.propertyAddress
        : undefined,
      legalDescription: sellerIntake.legalDescription,

      // Financial (from buyer's offer, read-only)
      purchasePrice: extractedData.price,
      depositAmount: extractedData.deposit,
      depositDueDate: extractedData.depositDue,

      // Dates (from buyer's offer, read-only)
      completionDate: extractedData.closingDate?.toISOString(),
      possessionDate: sellerIntake.possessionDate,

      // Seller information (seller's input takes precedence)
      sellerLegalName: sellerIntake.sellerLegalName,
      sellerAddress: sellerIntake.sellerAddress,
      sellerPhone: sellerIntake.sellerPhone,
      sellerEmail: sellerIntake.sellerEmail,

      // Lawyer information (seller's input takes precedence)
      lawyerName: sellerIntake.lawyerName,
      lawyerFirm: sellerIntake.lawyerFirm,
      lawyerAddress: sellerIntake.lawyerAddress,
      lawyerPhone: sellerIntake.lawyerPhone,
      lawyerEmail: sellerIntake.lawyerEmail,

      // Inclusions (from buyer) + Exclusions (seller adds/modifies)
      inclusions: extractedData.conditions || sellerIntake.inclusions,
      exclusions: sellerIntake.exclusions, // Seller's input
      fixtures: sellerIntake.fixtures,
      chattels: sellerIntake.chattels,

      // Rental items (seller fills this, may be pre-populated from extraction)
      rentalItems: sellerIntake.rentalItems,

      // Additional terms
      additionalTerms: sellerIntake.additionalTerms,

      // Seller notes
      sellerNotes: sellerIntake.sellerNotes,
    };

    console.log("📋 Merged comprehensive data with seller intake:", {
      extractedPrice: extractedData.price,
      extractedInclusions: extractedData.conditions?.substring(0, 50),
      sellerExclusions: sellerIntake.exclusions?.substring(0, 50),
      sellerRentalItems: sellerIntake.rentalItems?.substring(0, 50),
    });

    return merged;
  }

  async prepareOfferForSigning(
    offerId: string,
    intake: ApsIntake,
    seller: { email: string; name: string }
  ): Promise<{ signUrl: string; expiresAt: number }> {
    console.log(`📝 Preparing offer ${offerId} for signing with guided intake`);

    const offer = await this.getOffer(offerId);

    // Merge comprehensive extracted data with seller's intake
    const completeIntake = this.mergeExtractedDataWithIntake(offer, intake);

    // Validate offer can be accepted
    if (offer.status !== OfferStatus.PENDING_REVIEW) {
      throw new Error(
        `Offer cannot be prepared for signing. Current status: ${offer.status}`
      );
    }

    // Check if offer has expired
    if (offer.expiryDate && new Date(offer.expiryDate) < new Date()) {
      await this.prisma.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.EXPIRED },
      });
      throw new Error("Offer has expired");
    }

    // Get the original offer document from Supabase
    if (!offer.originalDocumentS3Key) {
      throw new Error("No offer document found");
    }

    try {
      // 1. Download buyer's original PDF
      const buyerPdfUrl = await this.supabaseService.getSignedUrl(
        "attachments",
        offer.originalDocumentS3Key,
        3600
      );
      const buyerPdf = await this.pdfService.downloadPdfFromUrl(buyerPdfUrl);

      // 2. Detect OREA version
      const oreaVersion = await this.pdfService.detectOreaVersion(buyerPdf);
      if (!oreaVersion) {
        throw new BadRequestException(
          "Could not detect OREA version. Please ensure this is a valid OREA APS form."
        );
      }
      console.log(`   Detected OREA version: ${oreaVersion}`);

      // 3. Flatten buyer's PDF (preserve their filled fields as read-only)
      const flattenedPdf = await this.pdfService.flattenPdf(buyerPdf);

      // 4. Prefill complete intake data (buyer + seller) onto the flattened PDF
      const preparedPdf = await this.pdfService.prefillSellerData(
        flattenedPdf,
        completeIntake,
        oreaVersion
      );

      // 5. Upload prepared PDF to Supabase
      const preparedS3Key = `offers/${offer.thread.listingId}/${
        offer.threadId
      }/${offer.id}/prepared_${Date.now()}.pdf`;
      await this.supabaseService.uploadFile(
        "attachments",
        preparedS3Key,
        preparedPdf,
        "application/pdf"
      );
      console.log(`   Uploaded prepared PDF to: ${preparedS3Key}`);

      // 6. Create Dropbox Sign embedded signature request with the prepared PDF
      const signatureRequest =
        await this.dropboxSignService.createEmbeddedSignatureRequest({
          title: `Sign Agreement of Purchase and Sale - ${offer.thread.listing.address}`,
          subject: `Agreement of Purchase and Sale for ${offer.thread.listing.address}`,
          message:
            "Please review and sign this Agreement of Purchase and Sale.",
          signers: [
            {
              emailAddress: seller.email,
              name: seller.name || "Seller",
              order: 0,
            },
          ],
          file: preparedPdf, // Send the prepared PDF buffer
          filename: `APS_${offer.thread.listing.address}_${Date.now()}.pdf`,
          metadata: {
            offerId: offer.id,
            threadId: offer.threadId,
            action: "accept",
          },
        });

      console.log(
        `   Created Dropbox Sign request: ${signatureRequest.signatureRequestId}`
      );

      // 7. Update offer with all the new data (store complete merged intake)
      await this.prisma.offer.update({
        where: { id: offerId },
        data: {
          status: OfferStatus.AWAITING_SELLER_SIGNATURE,
          hellosignSignatureRequestId: signatureRequest.signatureRequestId,
          hellosignSignatureId: signatureRequest.signatureId,
          signUrl: signatureRequest.signUrl,
          preparedDocumentS3Key: preparedS3Key,
          oreaVersion,
          intakeData: completeIntake as any,
          sellerEmail: seller.email,
          sellerName: seller.name,
        },
      });

      console.log(`✅ Offer ${offerId} prepared for signing`);
      console.log(`   Sign URL: ${signatureRequest.signUrl}`);
      console.log(
        `   Expires: ${new Date(
          signatureRequest.expiresAt * 1000
        ).toISOString()}`
      );

      return {
        signUrl: signatureRequest.signUrl,
        expiresAt: signatureRequest.expiresAt,
      };
    } catch (error) {
      console.error(`❌ Error preparing offer for signing:`, error.message);

      // Update offer with error status
      await this.prisma.offer.update({
        where: { id: offerId },
        data: {
          errorMessage: `Failed to prepare offer: ${error.message}`,
        },
      });

      throw error;
    }
  }

  /**
   * @deprecated Use prepareOfferForSigning() instead
   * Legacy quick accept method - kept for backwards compatibility
   */
  async acceptOffer(
    offerId: string
  ): Promise<{ signUrl: string; expiresAt: number }> {
    throw new Error(
      "Quick accept is no longer supported. Use prepareOfferForSigning() with guided intake instead."
    );
  }

  /**
   * Get signing URL for an offer that's awaiting seller signature
   */
  async getSignUrl(
    offerId: string
  ): Promise<{ signUrl: string; expiresAt: number }> {
    const offer = await this.getOffer(offerId);

    // Validate offer is in correct state
    if (offer.status !== OfferStatus.AWAITING_SELLER_SIGNATURE) {
      throw new Error(`Cannot get sign URL. Current status: ${offer.status}`);
    }

    if (!offer.hellosignSignatureRequestId) {
      throw new Error("No signature request found for this offer");
    }

    // Get the signature request from Dropbox Sign to retrieve the signature_id
    const signatureRequest = await this.dropboxSignService.getSignatureRequest(
      offer.hellosignSignatureRequestId
    );

    // Find the seller's signature (first signer)
    const signatures = signatureRequest.signatures;
    if (!signatures || signatures.length === 0) {
      throw new Error("No signatures found in signature request");
    }

    const signatureId = signatures[0].signature_id;

    // Get fresh embedded signing URL
    const signUrlResponse = await this.dropboxSignService.getEmbeddedSignUrl(
      signatureId
    );

    return {
      signUrl: signUrlResponse.signUrl,
      expiresAt: signUrlResponse.expiresAt,
    };
  }

  /**
   * Reset offer back to PENDING_REVIEW (in case of errors during signature creation)
   */
  async resetOffer(offerId: string): Promise<any> {
    const offer = await this.getOffer(offerId);

    // Only allow resetting from AWAITING_SELLER_SIGNATURE
    if (offer.status !== OfferStatus.AWAITING_SELLER_SIGNATURE) {
      throw new Error(`Cannot reset offer. Current status: ${offer.status}`);
    }

    const updatedOffer = await this.prisma.offer.update({
      where: { id: offerId },
      data: {
        status: OfferStatus.PENDING_REVIEW,
        hellosignSignatureRequestId: null, // Clear the failed signature request ID
      },
    });

    console.log(`♻️  Reset offer ${offerId} back to PENDING_REVIEW`);

    return updatedOffer;
  }

  /**
   * Decline offer
   */
  async declineOffer(dto: DeclineOfferDto): Promise<any> {
    const offer = await this.getOffer(dto.offerId);

    // Validate offer can be declined (allow from PENDING_REVIEW or AWAITING_SELLER_SIGNATURE)
    if (
      offer.status !== OfferStatus.PENDING_REVIEW &&
      offer.status !== OfferStatus.AWAITING_SELLER_SIGNATURE
    ) {
      throw new Error(
        `Offer cannot be declined. Current status: ${offer.status}`
      );
    }

    // Update offer status
    const updatedOffer = await this.prisma.offer.update({
      where: { id: dto.offerId },
      data: {
        status: OfferStatus.DECLINED,
        declineReason: dto.reason,
      },
    });

    // Send email notification to buyer agent
    const domain = process.env.MAILGUN_DOMAIN || "";
    await this.mailgunService.sendEmail(
      `${offer.thread.listing.emailAlias}@${domain}`,
      offer.thread.sender.email,
      `Re: ${offer.thread.subject}`,
      `Thank you for your offer on ${
        offer.thread.listing.address
      }. Unfortunately, we are declining at this time.${
        dto.reason ? `\n\nReason: ${dto.reason}` : ""
      }`
    );

    console.log(`✅ Declined offer ${dto.offerId}`);

    return updatedOffer;
  }

  /**
   * Create counter-offer
   */
  async counterOffer(
    dto: CounterOfferDto
  ): Promise<{ signUrl: string; expiresAt: number }> {
    const offer = await this.getOffer(dto.offerId);

    // Validate offer can be countered (allow from PENDING_REVIEW or AWAITING_SELLER_SIGNATURE)
    if (
      offer.status !== OfferStatus.PENDING_REVIEW &&
      offer.status !== OfferStatus.AWAITING_SELLER_SIGNATURE
    ) {
      throw new Error(
        `Offer cannot be countered. Current status: ${offer.status}`
      );
    }

    // TODO: Generate counter-offer PDF document from template
    // For now, we'll use a placeholder approach
    const counterOfferText = this.generateCounterOfferText(offer, dto);

    // Create counter-offer as a new message + offer record
    // In real implementation, you'd generate a Form 221 PDF here
    console.log("⚠️  Counter-offer PDF generation not yet implemented");
    console.log("Counter-offer details:", dto);

    // Update original offer status
    await this.prisma.offer.update({
      where: { id: dto.offerId },
      data: {
        status: OfferStatus.COUNTERED,
      },
    });

    // For now, return a stub response
    // TODO: Create actual Dropbox Sign signature request with generated PDF
    return {
      signUrl: "https://placeholder.com/sign",
      expiresAt: Date.now() + 3600000,
    };
  }

  /**
   * Handle Dropbox Sign webhook events
   */
  async handleWebhook(payload: any): Promise<void> {
    // Log full payload for debugging
    console.log(
      "📝 Dropbox Sign webhook payload:",
      JSON.stringify(payload, null, 2)
    );

    // Dropbox Sign sends event data directly in payload, not nested under 'event'
    const event = payload.event || payload;

    if (!event) {
      console.error("❌ No event data in webhook payload");
      return;
    }

    const eventType = event.event_type || payload.event_type;
    const eventTime = event.event_time || payload.event_time;
    const eventHash = event.event_hash || payload.event_hash;
    const signatureRequest =
      event.signature_request || payload.signature_request;

    if (!signatureRequest) {
      console.error("❌ No signature_request in webhook payload");
      console.log("Available keys:", Object.keys(payload));
      return;
    }

    console.log(`📝 Dropbox Sign webhook: ${eventType}`);

    // Verify webhook signature (in production)
    if (
      process.env.NODE_ENV === "production" &&
      eventTime &&
      eventType &&
      eventHash
    ) {
      const isValid = this.dropboxSignService.verifyWebhookSignature(
        eventTime,
        eventType,
        eventHash
      );

      if (!isValid) {
        console.error("❌ Invalid Dropbox Sign webhook signature");
        return;
      }
    }

    const signatureRequestId = signatureRequest.signature_request_id;

    // Find offer with this signature request ID
    const offer = await this.prisma.offer.findFirst({
      where: { hellosignSignatureRequestId: signatureRequestId },
      include: {
        thread: {
          include: {
            listing: true,
            sender: true,
          },
        },
      },
    });

    if (!offer) {
      console.warn(
        `No offer found for signature request ${signatureRequestId}`
      );
      return;
    }

    // Handle different webhook events
    switch (eventType) {
      case "signature_request_viewed":
        await this.handleSignatureViewed(offer);
        break;

      case "signature_request_signed":
        await this.handleSignatureCompleted(offer, signatureRequest);
        break;

      case "signature_request_all_signed":
        await this.handleAllSignaturesCompleted(offer, signatureRequest);
        break;

      case "signature_request_declined":
        await this.handleSignatureDeclined(offer);
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }
  }

  /**
   * Handle signature_request_viewed event
   */
  private async handleSignatureViewed(offer: any): Promise<void> {
    console.log(`👁️  Signature request viewed for offer ${offer.id}`);

    await this.prisma.offer.update({
      where: { id: offer.id },
      data: {
        signatureViewedAt: new Date(),
      },
    });
  }

  /**
   * Handle single signature completed
   */
  private async handleSignatureCompleted(
    offer: any,
    signatureRequest: any
  ): Promise<void> {
    console.log(`✅ Signature completed for offer ${offer.id}`);

    // Update seller signed timestamp
    await this.prisma.offer.update({
      where: { id: offer.id },
      data: {
        sellerSignedAt: new Date(),
      },
    });
  }

  /**
   * Handle all signatures completed
   */
  private async handleAllSignaturesCompleted(
    offer: any,
    signatureRequest: any
  ): Promise<void> {
    console.log(`✅ All signatures completed for offer ${offer.id}`);

    // Download signed document
    const signedDoc = await this.dropboxSignService.downloadSignedDocument(
      signatureRequest.signature_request_id
    );

    // Upload to Supabase
    const s3Key = `signed-offers/${offer.thread.listingId}/${offer.threadId}/${offer.id}/signed.pdf`;
    await this.supabaseService.uploadFile(
      "attachments",
      s3Key,
      signedDoc,
      "application/pdf"
    );

    // Check if offer has pending conditions
    const pendingConditions = await this.prisma.offerCondition.findMany({
      where: {
        offerId: offer.id,
        status: "PENDING",
      },
    });

    const hasPendingConditions = pendingConditions.length > 0;
    const newStatus = hasPendingConditions
      ? OfferStatus.CONDITIONALLY_ACCEPTED
      : OfferStatus.ACCEPTED;

    // Update offer status
    await this.prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: newStatus,
        signedDocumentS3Key: s3Key,
        conditionallyAcceptedAt: hasPendingConditions ? new Date() : undefined,
        acceptedAt: hasPendingConditions ? undefined : new Date(),
      },
    });

    if (hasPendingConditions) {
      console.log(
        `📋 Offer ${offer.id} marked as CONDITIONALLY_ACCEPTED (${pendingConditions.length} pending condition(s))`
      );
    } else {
      console.log(`✅ Offer ${offer.id} marked as ACCEPTED (no conditions)`);
    }

    // Send signed document to buyer agent via email
    const domain = process.env.MAILGUN_DOMAIN || "";
    await this.mailgunService.sendEmail(
      `${offer.thread.listing.emailAlias}@${domain}`,
      offer.thread.sender.email,
      `Re: ${offer.thread.subject} - Offer Accepted`,
      `We are pleased to accept your offer for ${offer.thread.listing.address}. The signed document is attached.`,
      undefined, // no HTML
      offer.thread.emailThreadId,
      undefined, // no references for now
      undefined // no custom message ID
      // TODO: Attach signed PDF to email
    );

    console.log(
      `✅ Offer ${offer.id} accepted and signed document sent to buyer agent`
    );
  }

  /**
   * Handle signature declined
   */
  private async handleSignatureDeclined(offer: any): Promise<void> {
    console.log(`❌ Signature declined for offer ${offer.id}`);

    // Revert offer status back to pending review
    await this.prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: OfferStatus.PENDING_REVIEW,
        hellosignSignatureRequestId: null,
      },
    });
  }

  /**
   * Generate counter-offer text
   */
  private generateCounterOfferText(offer: any, dto: CounterOfferDto): string {
    const changes: string[] = [];

    if (dto.price !== undefined && dto.price !== offer.price) {
      changes.push(
        `Purchase Price: $${offer.price?.toLocaleString()} → $${dto.price.toLocaleString()}`
      );
    }

    if (dto.deposit !== undefined && dto.deposit !== offer.deposit) {
      changes.push(
        `Deposit: $${offer.deposit?.toLocaleString()} → $${dto.deposit.toLocaleString()}`
      );
    }

    if (dto.closingDate) {
      changes.push(`Closing Date: ${dto.closingDate}`);
    }

    if (dto.conditions) {
      changes.push(`Conditions: ${dto.conditions}`);
    }

    return `Counter-Offer for ${offer.thread.listing.address}\n\n${changes.join(
      "\n"
    )}`;
  }

  /**
   * Check and expire old offers
   * Should be called periodically (e.g., daily cron job)
   */
  async expireOldOffers(): Promise<number> {
    const result = await this.prisma.offer.updateMany({
      where: {
        expiryDate: {
          lt: new Date(),
        },
        status: {
          in: [
            OfferStatus.PENDING_REVIEW,
            OfferStatus.AWAITING_SELLER_SIGNATURE,
          ],
        },
      },
      data: {
        status: OfferStatus.EXPIRED,
      },
    });

    console.log(`Expired ${result.count} offer(s)`);
    return result.count;
  }

  /**
   * Auto-reject an offer due to validation failures
   * Sends rejection email to buyer agent and updates message subCategory
   */
  private async autoRejectInvalidOffer(
    message: any,
    attachment: any,
    validationErrors: any[]
  ): Promise<void> {
    console.log(`📧 Sending rejection email for invalid offer...`);

    // Get thread and listing info for email
    const thread = message.thread;
    const listing = thread?.listing;
    const sender = thread?.sender;

    if (!listing || !sender) {
      console.error(
        "❌ Cannot send rejection email: missing listing or sender info"
      );
      return;
    }

    // Format validation errors for email
    const errorList = validationErrors
      .map((err) => `❌ ${err.field}: ${err.message}`)
      .join("\n");

    // Create email body
    const emailSubject = `Offer Submission Issue - ${listing.address}`;
    const emailBody = `Dear Agent,

Your offer submission for ${listing.address} could not be accepted due to the following validation issues:

${errorList}

Please ensure:
✓ All buyer signatures are present
✓ Purchase price is filled in
✓ All required fields are completed

Reply to this email with the corrected OREA Form 100.

Best regards,
Smart Brokerage Platform`;

    // Send rejection email
    try {
      const domain = process.env.MAILGUN_DOMAIN || "";
      await this.mailgunService.sendEmail(
        `${listing.emailAlias}@${domain}`,
        sender.email,
        emailSubject,
        emailBody,
        undefined, // no HTML
        thread.emailThreadId, // In-Reply-To
        undefined, // no references for now
        undefined // no custom message ID
      );

      console.log(`✅ Rejection email sent to ${sender.email}`);
    } catch (error: any) {
      console.error(`❌ Failed to send rejection email:`, error.message);
    }

    // Update message subCategory to mark as invalid
    try {
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          subCategory: MessageSubCategory.GENERAL, // Mark as general/invalid
          // Could add a note in the message or create a custom subCategory
        },
      });

      console.log(`✅ Message ${message.id} marked as invalid offer`);
    } catch (error: any) {
      console.error(`❌ Failed to update message:`, error.message);
    }
  }

  /**
   * Clean date/time string by removing ordinal suffixes (st, nd, rd, th), AM/PM, and extra spaces
   */
  private cleanDateTimeString(value: string | undefined): string | undefined {
    if (!value) return undefined;

    return value
      .replace(/(\d+)(st|nd|rd|th)/gi, "$1") // Remove ordinal suffixes
      .replace(/\s*(AM|PM|am|pm|a\.m\.|p\.m\.)\s*/gi, " ") // Remove AM/PM
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  }

  /**
   * Parse date from ApsParseResult date parts (day, month, year)
   * Handles cleaning of ordinal suffixes and extra text
   */
  private parseDateFromApsResult(
    dateParts:
      | {
          day?: string;
          month?: string;
          year?: string;
          time?: string;
        }
      | undefined
  ): Date | undefined {
    if (!dateParts?.day || !dateParts?.month || !dateParts?.year) {
      return undefined;
    }

    try {
      // Clean the date parts
      const cleanDay = this.cleanDateTimeString(dateParts.day);
      const cleanMonth = this.cleanDateTimeString(dateParts.month);
      const cleanYear = this.cleanDateTimeString(dateParts.year);
      const cleanTime = dateParts.time
        ? this.cleanDateTimeString(dateParts.time)
        : undefined;

      if (!cleanDay || !cleanMonth || !cleanYear) {
        return undefined;
      }

      // Convert month name to number
      const monthNames = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];

      const monthLower = cleanMonth.toLowerCase();
      const monthIndex = monthNames.findIndex((m) =>
        monthLower.startsWith(m.substring(0, 3))
      );

      if (monthIndex === -1) {
        console.log(`⚠️ Invalid month name: "${cleanMonth}"`);
        return undefined;
      }

      // Parse day and year
      const dayNum = parseInt(cleanDay, 10);
      const yearNum = parseInt(cleanYear, 10);

      if (isNaN(dayNum) || isNaN(yearNum)) {
        console.log(
          `⚠️ Invalid day or year: day="${cleanDay}", year="${cleanYear}"`
        );
        return undefined;
      }

      // Create date (month is 0-indexed in JS Date)
      const date = new Date(yearNum, monthIndex, dayNum);

      // Parse time if provided (e.g., "12:00", "5:00 PM")
      if (cleanTime) {
        const timeMatch = cleanTime.match(/(\d{1,2}):?(\d{2})?/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

          // Check for PM in original time string (before cleaning removed it)
          if (dateParts.time?.toLowerCase().includes("pm") && hours < 12) {
            hours += 12;
          } else if (
            dateParts.time?.toLowerCase().includes("am") &&
            hours === 12
          ) {
            hours = 0;
          }

          date.setHours(hours, minutes, 0, 0);
        }
      } else {
        // Default to noon if no time specified
        date.setHours(12, 0, 0, 0);
      }

      // Validate the date
      if (isNaN(date.getTime())) {
        console.log(
          `⚠️ Invalid date created from: ${JSON.stringify(dateParts)}`
        );
        return undefined;
      }

      return date;
    } catch (error: any) {
      console.error(
        `❌ Error parsing date from APS result:`,
        error.message,
        dateParts
      );
      return undefined;
    }
  }

  /**
   * Extract offer data from comprehensive formFieldsExtracted (ApsParseResult)
   * Falls back to legacy extractedData if formFieldsExtracted not available
   */
  private extractOfferDataFromAttachment(attachment: any): {
    price?: number;
    deposit?: number;
    depositDue?: string;
    closingDate?: Date;
    expiryDate?: Date;
    conditions?: string;
    scheduleAConditions?: any[];
    s3Key?: string;
  } {
    const result: any = {};

    // Try formFieldsExtracted first (comprehensive Gemini/AcroForm data)
    if (attachment?.documentAnalysis?.formFieldsExtracted) {
      const apsData = attachment.documentAnalysis
        .formFieldsExtracted as ApsParseResult;

      console.log(
        `📄 Using comprehensive APS data (strategy: ${apsData.strategyUsed})`
      );

      // Extract price and deposit
      if (apsData.price_and_deposit?.purchase_price?.numeric) {
        result.price = apsData.price_and_deposit.purchase_price.numeric;
      }

      if (apsData.price_and_deposit?.deposit?.numeric) {
        result.deposit = apsData.price_and_deposit.deposit.numeric;
      }

      if (apsData.price_and_deposit?.deposit?.timing) {
        result.depositDue = apsData.price_and_deposit.deposit.timing;
      }

      // Parse closing date from completion field
      if (apsData.completion) {
        result.closingDate = this.parseDateFromApsResult(apsData.completion);
        if (result.closingDate) {
          console.log(
            `📅 Parsed closing date: ${result.closingDate.toISOString()}`
          );
        }
      }

      // Parse expiry date from irrevocability field
      if (apsData.irrevocability) {
        result.expiryDate = this.parseDateFromApsResult(apsData.irrevocability);
        if (result.expiryDate) {
          console.log(
            `⏰ Parsed expiry date: ${result.expiryDate.toISOString()}`
          );
        }
      }

      // Extract Schedule A conditions
      if (
        apsData.scheduleAConditions &&
        apsData.scheduleAConditions.length > 0
      ) {
        result.scheduleAConditions = apsData.scheduleAConditions;
        console.log(
          `📋 Found ${apsData.scheduleAConditions.length} Schedule A condition(s)`
        );
      }

      result.s3Key = attachment.s3Key;
    } else if (attachment?.documentAnalysis?.extractedData) {
      // Fallback to legacy extractedData format
      const data = attachment.documentAnalysis.extractedData as any;

      console.log(`📄 Using legacy extracted data format`);

      result.price = data.price;
      result.deposit = data.deposit;
      result.depositDue = data.depositDue;

      if (data.closingDate) {
        const parsedClosingDate = new Date(data.closingDate);
        if (!isNaN(parsedClosingDate.getTime())) {
          result.closingDate = parsedClosingDate;
        } else {
          console.log(
            `⚠️ Invalid closingDate extracted: "${data.closingDate}"`
          );
        }
      }

      if (data.expiryDate) {
        const parsedExpiryDate = new Date(data.expiryDate);
        if (!isNaN(parsedExpiryDate.getTime())) {
          result.expiryDate = parsedExpiryDate;
        } else {
          console.log(`⚠️ Invalid expiryDate extracted: "${data.expiryDate}"`);
        }
      }

      if (data.conditions && Array.isArray(data.conditions)) {
        result.conditions = data.conditions.join(", ");
      }

      result.s3Key = attachment.s3Key;
    }

    return result;
  }

  /**
   * Create OfferCondition records from parsed Schedule A conditions
   */
  private async createOfferConditions(
    offerId: string,
    scheduleAConditions: any[]
  ): Promise<void> {
    if (!scheduleAConditions || scheduleAConditions.length === 0) {
      return;
    }

    console.log(
      `📋 Creating ${scheduleAConditions.length} offer condition(s)...`
    );

    for (const condition of scheduleAConditions) {
      // Clean the raw description (removes "1.", "Condition #1:", etc.)
      const cleanedDescription = this.cleanConditionText(condition.description);

      // Generate matching key from cleaned description
      const matchingKey = this.normalizeConditionText(condition.description);

      // Parse due date if present
      let dueDate: Date | undefined;
      if (condition.dueDate) {
        try {
          dueDate = new Date(condition.dueDate);
          if (isNaN(dueDate.getTime())) {
            console.warn(
              `Invalid due date for condition: ${cleanedDescription}`
            );
            dueDate = undefined;
          }
        } catch (error) {
          console.warn(`Failed to parse due date: ${condition.dueDate}`, error);
          dueDate = undefined;
        }
      }

      await this.prisma.offerCondition.create({
        data: {
          offerId,
          description: cleanedDescription, // Store cleaned version for UI display
          dueDate,
          matchingKey,
          status: "PENDING",
        },
      });

      console.log(
        `  ✓ Created condition: ${cleanedDescription.substring(0, 50)}...`
      );
    }
  }

  /**
   * Clean raw condition text extracted from PDFs
   * Removes formatting differences between Schedule A and OREA 124
   */
  private cleanConditionText(rawText: string): string {
    let cleaned = rawText.trim();

    // Remove common OREA 124 headers (case-insensitive)
    // "Condition #1:" → ""
    // "Condition 1:" → ""
    cleaned = cleaned.replace(/^condition\s*#?\d+\s*:?\s*/i, "");

    // Remove leading numbers with various formats
    // "1. " → ""
    // "1) " → ""
    // "1 " → ""
    cleaned = cleaned.replace(/^\d+[\.\)]\s*/, "");
    cleaned = cleaned.replace(/^\d+\s+/, "");

    return cleaned.trim();
  }

  /**
   * Normalize text for condition matching
   * Used to create a stable key for matching conditions across documents
   *
   * This is applied AFTER cleanConditionText() to create the matching key
   */
  private normalizeConditionText(text: string): string {
    // First clean the raw text
    const cleaned = this.cleanConditionText(text);

    // Then normalize for matching
    const normalized = cleaned
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove ALL punctuation
      .replace(/\s+/g, " ") // Normalize all whitespace to single spaces
      .trim();

    return normalized;
  }

  /**
   * Fulfill conditions from OREA 124 form
   * Matches fulfilled conditions to existing OfferCondition records and updates their status
   */
  async fulfillConditionsFromOrea124(
    offerId: string,
    orea124Result: any
  ): Promise<void> {
    if (!orea124Result.success || !orea124Result.fulfilledConditions) {
      console.log(`⚠️  OREA 124 parsing failed or no conditions found`);
      return;
    }

    console.log(
      `📋 Processing ${orea124Result.fulfilledConditions.length} fulfilled condition(s) for offer ${offerId}...`
    );

    // Get all pending conditions for this offer
    const pendingConditions = await this.prisma.offerCondition.findMany({
      where: {
        offerId,
        status: "PENDING",
      },
    });

    if (pendingConditions.length === 0) {
      console.log(`⚠️  No pending conditions found for offer ${offerId}`);
      return;
    }

    console.log(`   Found ${pendingConditions.length} pending condition(s)`);

    // Parse completion date from OREA 124 if available
    let completedAt = new Date();
    if (orea124Result.documentDate) {
      try {
        const parsedDate = new Date(orea124Result.documentDate);
        if (!isNaN(parsedDate.getTime())) {
          completedAt = parsedDate;
        }
      } catch (error) {
        console.warn(
          `Failed to parse document date: ${orea124Result.documentDate}`
        );
      }
    }

    // Match each fulfilled condition to a pending condition
    let matchedCount = 0;
    for (const fulfilledCondition of orea124Result.fulfilledConditions) {
      const fulfilledKey = this.normalizeConditionText(
        fulfilledCondition.description
      );

      // Find best matching pending condition
      const matchingCondition = pendingConditions.find((pending) => {
        return pending.matchingKey === fulfilledKey;
      });

      if (matchingCondition) {
        // Update condition status to COMPLETED
        await this.prisma.offerCondition.update({
          where: { id: matchingCondition.id },
          data: {
            status: "COMPLETED",
            completedAt,
          },
        });

        console.log(
          `  ✓ Marked condition as COMPLETED: ${matchingCondition.description.substring(
            0,
            50
          )}...`
        );
        matchedCount++;
      } else {
        // Log unmatched conditions for debugging
        console.log(
          `  ⚠️  No matching condition found for: ${fulfilledCondition.description.substring(
            0,
            50
          )}...`
        );
      }
    }

    console.log(
      `✅ Matched and completed ${matchedCount}/${orea124Result.fulfilledConditions.length} condition(s)`
    );

    // Check if all conditions are now fulfilled
    await this.checkAndUpdateOfferStatus(offerId);
  }

  /**
   * Get all conditions for an offer
   */
  async getOfferConditions(offerId: string): Promise<any[]> {
    const conditions = await this.prisma.offerCondition.findMany({
      where: { offerId },
      orderBy: { createdAt: "asc" },
    });

    return conditions;
  }

  /**
   * Check if all conditions are fulfilled and update offer status accordingly
   */
  private async checkAndUpdateOfferStatus(offerId: string): Promise<void> {
    // Get all conditions for this offer
    const allConditions = await this.prisma.offerCondition.findMany({
      where: { offerId },
    });

    if (allConditions.length === 0) {
      // No conditions means offer should be ACCEPTED if it was conditionally accepted
      return;
    }

    // Check if all conditions are completed or waived
    const pendingConditions = allConditions.filter(
      (c) => c.status === "PENDING"
    );
    const expiredConditions = allConditions.filter(
      (c) => c.status === "EXPIRED"
    );

    if (pendingConditions.length === 0 && expiredConditions.length === 0) {
      // All conditions fulfilled! Update offer status to ACCEPTED
      const offer = await this.prisma.offer.findUnique({
        where: { id: offerId },
      });

      if (offer && offer.status === OfferStatus.CONDITIONALLY_ACCEPTED) {
        await this.prisma.offer.update({
          where: { id: offerId },
          data: {
            status: OfferStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
        });

        console.log(
          `🎉 All conditions fulfilled! Offer ${offerId} marked as ACCEPTED`
        );
      }
    } else {
      console.log(
        `📋 Offer ${offerId} still has ${pendingConditions.length} pending condition(s)`
      );
    }
  }
}
