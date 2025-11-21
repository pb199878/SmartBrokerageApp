import { Injectable } from "@nestjs/common";
// import { Queue } from 'bullmq';
// import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from "../../common/prisma/prisma.service";
import { MailgunService } from "../../common/mailgun/mailgun.service";
import { SupabaseService } from "../../common/supabase/supabase.service";
import { AttachmentsService } from "../attachments/attachments.service";
import { DocumentsService } from "../documents/documents.service";
import { ClassificationService } from "../classification/classification.service";
import { OffersService } from "../offers/offers.service";
import { MessageCategory } from "@prisma/client";

@Injectable()
export class EmailService {
  constructor(
    // @InjectQueue('email-processing') private emailQueue: Queue, // TODO: Uncomment when BullMQ is set up
    private prisma: PrismaService,
    private mailgunService: MailgunService,
    private supabaseService: SupabaseService,
    private attachmentsService: AttachmentsService,
    private documentsService: DocumentsService,
    private classificationService: ClassificationService,
    private offersService: OffersService
  ) {}

  /**
   * Process inbound email from Mailgun webhook
   * This will be the main entry point for incoming emails
   */
  async processInboundEmail(payload: any) {
    console.log("📧 Processing inbound email...");
    console.log(payload);

    // 1. Verify webhook signature (only in production)
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      const { timestamp, token, signature } = payload;
      const isValid = this.mailgunService.verifyWebhookSignature(
        timestamp,
        token,
        signature
      );

      if (!isValid) {
        console.error("❌ Invalid webhook signature");
        return { error: "Invalid signature" };
      }
      console.log("✅ Webhook signature verified");
    } else {
      console.log(
        "⚠️  Skipping webhook signature verification (not in production)"
      );
    }

    // 2. Parse email
    const email = this.mailgunService.parseIncomingEmail(payload);
    console.log(`From: ${email.from}`);
    console.log(`To: ${email.to}`);
    console.log(`Subject: ${email.subject}`);

    // TODO: When BullMQ is set up, enqueue job instead of processing directly
    // await this.emailQueue.add('process-email', { email, payload });

    // For now, process directly (stubbed)
    await this.processEmailDirectly(email);

    return { success: true, message: "Email received" };
  }

  /**
   * Process email directly (used when queue is not available)
   * TODO: Move to EmailProcessor when BullMQ is set up
   */
  private async processEmailDirectly(email: any) {
    // 1. Extract listing alias from email address
    // Example: l-abc123@inbox.yourapp.ca -> l-abc123
    const listingAlias = email.to.split("@")[0]; // e.g., "l-abc123"
    console.log(`📧 Listing alias: ${listingAlias}`);

    // 2. Look up the actual listing by emailAlias
    const listing = await this.prisma.listing.findUnique({
      where: { emailAlias: listingAlias },
    });

    if (!listing) {
      console.error(`❌ No listing found for alias: ${listingAlias}`);
      throw new Error(`Invalid listing alias: ${listingAlias}`);
    }

    console.log(`✅ Found listing: ${listing.id} (${listing.address})`);

    // 3. Find or create sender
    const sender = await this.prisma.sender.upsert({
      where: { email: email.from },
      update: {},
      create: {
        email: email.from,
        name: this.extractNameFromEmail(email.from),
        domain: this.extractDomain(email.from),
      },
    });

    const emailThreadId = this.extractEmailThreadId(email);
    const allMessageIds: string[] = [];

    if (email.references) {
      allMessageIds.push(...this.parseReferences(email.references));
    }
    if (email.inReplyTo) {
      allMessageIds.push(email.inReplyTo);
    }

    console.log("🔍 Looking for thread with Message-IDs:", allMessageIds);

    let existingMessage = null;

    // If this email has threading headers, search for existing thread
    // by finding any message that matches any of these Message-IDs
    if (allMessageIds.length > 0) {
      existingMessage = await this.prisma.message.findFirst({
        where: {
          messageId: {
            in: allMessageIds,
          },
          thread: {
            listingId: listing.id, // Use actual listing UUID
            senderId: sender.id,
          },
        },
        include: {
          thread: {
            include: {
              listing: true,
              sender: true,
            },
          },
        },
      });
    }

    let thread = null;
    // If no thread found (new conversation or couldn't match reply)
    if (!existingMessage) {
      // Create a new thread
      thread = await this.prisma.thread.create({
        data: {
          listingId: listing.id, // Use actual listing UUID
          senderId: sender.id,
          subject: email.subject,
          emailThreadId: emailThreadId || undefined,
          category: this.classifyMessage(email.subject, email.bodyText),
          lastMessageAt: new Date(),
        },
      });
      console.log(`✨ Created new thread: ${thread.id} (${email.subject})`);
    } else {
      // 4. Check for duplicate message before storing (by Message-ID)
      // If the same Message-ID already exists, this is a webhook retry
      if (email.messageId) {
        const existingMessageWithSameId = await this.prisma.message.findFirst({
          where: {
            messageId: email.messageId,
            threadId: existingMessage.threadId,
          },
        });

        if (existingMessageWithSameId) {
          console.log(
            `⚠️ Duplicate Message-ID detected (${email.messageId}) - skipping message creation`
          );
          return; // Skip creating the message
        }
      }

      // Note: We DON'T check for duplicate content anymore because buyers may send
      // multiple offers with same/similar content, which are legitimate new offers
      // Update existing thread
      thread = await this.prisma.thread.update({
        where: { id: existingMessage.threadId },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
        },
      });
      console.log(`📝 Updated existing thread: ${existingMessage.threadId}`);
    }

    // 5. Store message
    // Inbound messages are already delivered to us, so status is SENT
    const message = await this.prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: sender.id,
        senderEmail: email.from,
        senderName: sender.name,
        direction: "INBOUND",
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        messageId: email.messageId,
        status: "SENT", // Inbound messages are already delivered
      },
    });

    // 6. Handle attachments
    const hasUrlBasedAttachments =
      email.attachments && email.attachments.length > 0;
    const hasUploadedFiles =
      email._uploadedFiles && email._uploadedFiles.length > 0;

    if (hasUrlBasedAttachments || hasUploadedFiles) {
      console.log(`📎 Processing attachments...`);

      // Handle URL-based attachments (from Mailgun's attachments field)
      if (hasUrlBasedAttachments) {
        console.log(
          `📥 Found ${email.attachments.length} URL-based attachment(s)`
        );

        // Filter out irrelevant attachments BEFORE downloading (saves storage space)
        const relevantAttachments =
          this.attachmentsService.filterRelevantAttachments(email.attachments);

        if (relevantAttachments.length === 0) {
          console.log("⏭️  No relevant URL-based attachments to download");
        } else {
          console.log(
            `📥 Downloading ${relevantAttachments.length} relevant attachment(s)...`
          );

          // Prioritize attachments by importance
          const prioritizedAttachments =
            this.attachmentsService.prioritizeAttachments(relevantAttachments);

          for (const attachment of prioritizedAttachments) {
            try {
              await this.attachmentsService.downloadAndStoreAttachment(
                attachment.url, // Mailgun provides direct download URL
                message.id,
                listing.id,
                thread.id,
                attachment.filename || attachment.name,
                attachment["content-type"] ||
                  attachment.contentType ||
                  "application/octet-stream",
                attachment.size || 0
              );
            } catch (error) {
              console.error(
                `Failed to download attachment ${attachment.filename}:`,
                error
              );
              // Continue processing other attachments even if one fails
            }
          }
        }
      }

      // Handle uploaded files (from multer when Mailgun sends multipart)
      if (hasUploadedFiles) {
        console.log(
          `📤 Found ${email._uploadedFiles.length} uploaded file(s) from multer`
        );

        for (const file of email._uploadedFiles) {
          try {
            console.log(
              `Processing uploaded file: ${file.originalname} (${file.size} bytes)`
            );

            // Upload the file buffer directly to Supabase
            await this.attachmentsService.uploadBufferAndStore(
              file.buffer, // File buffer from multer
              message.id,
              listing.id,
              thread.id,
              file.originalname,
              file.mimetype,
              file.size
            );
          } catch (error) {
            console.error(`Failed to upload file ${file.originalname}:`, error);
            // Continue processing other files even if one fails
          }
        }
      }
    } else if (email.attachmentCount && email.attachmentCount > 0) {
      console.warn(
        `⚠️  Email reported ${email.attachmentCount} attachment(s) but none were found`
      );
      console.warn("Possible reasons:");
      console.warn(
        "  - Mailgun stored attachments but did not include in webhook"
      );
      console.warn("  - Multer did not intercept the files");
      console.warn("  - Attachment type not supported or filtered out");
    }

    // 7. Analyze attachments (PDF text extraction, OREA form detection)
    const attachments = await this.prisma.attachment.findMany({
      where: { messageId: message.id },
    });

    const documentAnalyses: any[] = [];
    if (attachments.length > 0) {
      console.log(`🔍 Analyzing ${attachments.length} attachment(s)...`);

      for (const attachment of attachments) {
        // Only analyze PDFs
        if (attachment.contentType.includes("pdf")) {
          try {
            const analysis = await this.documentsService.analyzeAttachment(
              attachment.id
            );
            if (analysis) {
              documentAnalyses.push(analysis);
            }
          } catch (error) {
            console.error(
              `Failed to analyze attachment ${attachment.id}:`,
              error
            );
            // Continue with other attachments even if one fails
          }
        }
      }
    }

    // 7.5. Check for OREA 124 (Notice of Fulfillment) and process conditions
    for (const analysis of documentAnalyses) {
      if (analysis.formType?.includes("Form 124")) {
        console.log(
          "📋 Detected OREA 124 form - processing condition fulfillment..."
        );

        // Find the active offer from this sender for this listing
        const activeOffer = await this.prisma.offer.findFirst({
          where: {
            thread: {
              senderId: sender.id,
              listingId: listing.id,
            },
            status: {
              in: [
                "CONDITIONALLY_ACCEPTED",
                "AWAITING_SELLER_SIGNATURE",
                "ACCEPTED",
              ],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (activeOffer && analysis.formFieldsExtracted) {
          try {
            await this.offersService.fulfillConditionsFromOrea124(
              activeOffer.id,
              analysis.formFieldsExtracted
            );
          } catch (error) {
            console.error("Failed to process OREA 124 fulfillment:", error);
            // Continue even if fulfillment processing fails
          }
        } else {
          console.warn("⚠️  No active offer found for OREA 124 form");
        }
      }
    }

    // 8. Classify message (hybrid: heuristics + AI if needed)
    // Now enhanced with document analysis results for better accuracy
    console.log("🤖 Classifying message...");
    try {
      const classificationResult =
        await this.classificationService.classifyMessage(
          message.id,
          email.subject,
          email.bodyText,
          attachments,
          documentAnalyses // Pass PDF analysis results for higher confidence
        );

      // Update message with classification
      await this.classificationService.updateMessageClassification(
        message.id,
        classificationResult
      );

      // Update thread category if it's an offer
      if (
        classificationResult.subCategory === "NEW_OFFER" ||
        classificationResult.subCategory === "UPDATED_OFFER"
      ) {
        await this.prisma.thread.update({
          where: { id: thread.id },
          data: { category: "OFFER" },
        });
        console.log("📋 Updated thread category to OFFER");

        // Create offer record from this message
        try {
          await this.offersService.createOfferFromMessage(message.id);
        } catch (error) {
          console.error("Failed to create offer from message:", error);
          // Continue even if offer creation fails
        }
      }
    } catch (error) {
      console.error("Failed to classify message:", error);
      // Continue processing even if classification fails
    }

    // 9. Upload raw email to Supabase Storage (OPTIONAL - for audit/compliance)
    // Use message ID to keep history of all emails, not just latest per thread
    // NOTE: This stores raw .eml files for legal/debugging purposes
    // You can disable this for MVP if you only need Postgres storage
    // TODO: Implement when Supabase is set up
    // await this.supabaseService.uploadFile(
    //   'emails',
    //   `${listingAlias}/${thread.id}/${message.id}.eml`,
    //   Buffer.from(email.bodyText),
    //   'message/rfc822',
    // );

    // 10. Send push notification
    // TODO: Implement when Expo Push is set up

    console.log("✅ Email processed successfully");
  }

  /**
   * Classify message based on content
   */
  private classifyMessage(subject: string, body: string): MessageCategory {
    const combined = `${subject} ${body}`.toLowerCase();

    if (combined.includes("offer") || combined.includes("aps")) {
      return "OFFER";
    }
    if (
      combined.includes("showing") ||
      combined.includes("view") ||
      combined.includes("visit")
    ) {
      return "SHOWING";
    }
    return "GENERAL";
  }

  private extractNameFromEmail(email: string): string {
    // Extract name from "John Smith <john@example.com>" format
    const match = email.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].trim() : email.split("@")[0];
  }

  private extractDomain(email: string): string {
    return email.split("@")[1] || "";
  }

  private extractEmailThreadId(email: any): string | null {
    if (email.references) {
      const rootMessageId = this.parseReferences(email.references)[0];
      if (rootMessageId) {
        return rootMessageId;
      }
    }

    if (email.inReplyTo) {
      return email.inReplyTo;
    }

    // If no threading headers, use Message-ID to start a new thread
    if (email.messageId) {
      return email.messageId;
    }

    return null;
  }

  private parseReferences(references: string): string[] {
    if (!references) return [];

    // Match all <...> patterns
    const matches = references.match(/<[^>]+>/g);
    return matches || [];
  }
}
