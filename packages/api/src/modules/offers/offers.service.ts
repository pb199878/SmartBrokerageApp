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
    let price: number | undefined;
    let deposit: number | undefined;
    let closingDate: Date | undefined;
    let expiryDate: Date | undefined;
    let conditions: string | undefined;
    let originalDocumentS3Key: string | undefined;

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
    if (validationStatus === "failed") {
      const validationErrors = Array.isArray(
        offerAttachment.documentAnalysis.validationErrors
      )
        ? offerAttachment.documentAnalysis.validationErrors
        : [];
      console.log(`❌ Offer validation failed. Auto-rejecting...`);
      await this.autoRejectInvalidOffer(
        message,
        offerAttachment,
        validationErrors
      );
      throw new Error(
        "Offer automatically rejected due to validation failures"
      );
    }

    if (offerAttachment?.documentAnalysis?.extractedData) {
      const data = offerAttachment.documentAnalysis.extractedData as any;
      price = data.price;
      deposit = data.deposit;
      if (data.closingDate) {
        closingDate = new Date(data.closingDate);
      }
      if (data.expiryDate) {
        expiryDate = new Date(data.expiryDate);
      }
      if (data.conditions && Array.isArray(data.conditions)) {
        conditions = data.conditions.join(", ");
      }
      originalDocumentS3Key = offerAttachment.s3Key;
    }

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

    if (offerAttachment?.documentAnalysis?.extractedData) {
      const data = offerAttachment.documentAnalysis.extractedData as any;

      if (data.price !== undefined) updateData.price = data.price;
      if (data.deposit !== undefined) updateData.deposit = data.deposit;
      if (data.closingDate) updateData.closingDate = new Date(data.closingDate);
      if (data.conditions && Array.isArray(data.conditions)) {
        updateData.conditions = data.conditions.join(", ");
      }

      // Update the document reference
      updateData.originalDocumentS3Key = offerAttachment.s3Key;
    }

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
  async prepareOfferForSigning(
    offerId: string,
    intake: ApsIntake,
    seller: { email: string; name: string }
  ): Promise<{ signUrl: string; expiresAt: number }> {
    console.log(`📝 Preparing offer ${offerId} for signing with guided intake`);

    const offer = await this.getOffer(offerId);

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

      // 4. Prefill seller's intake data onto the flattened PDF
      const preparedPdf = await this.pdfService.prefillSellerData(
        flattenedPdf,
        intake,
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

      // 7. Update offer with all the new data
      await this.prisma.offer.update({
        where: { id: offerId },
        data: {
          status: OfferStatus.AWAITING_SELLER_SIGNATURE,
          hellosignSignatureRequestId: signatureRequest.signatureRequestId,
          hellosignSignatureId: signatureRequest.signatureId,
          signUrl: signatureRequest.signUrl,
          preparedDocumentS3Key: preparedS3Key,
          oreaVersion,
          intakeData: intake as any,
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

    // Update offer status
    await this.prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: OfferStatus.ACCEPTED,
        signedDocumentS3Key: s3Key,
      },
    });

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
}
