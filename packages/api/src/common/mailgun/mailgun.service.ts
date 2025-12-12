import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import Mailgun from "mailgun.js";
import FormData from "form-data";

@Injectable()
export class MailgunService {
  private apiKey: string;
  private domain: string;
  private webhookSigningKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>("MAILGUN_API_KEY") || "";
    this.domain = this.configService.get<string>("MAILGUN_DOMAIN") || "";
    this.webhookSigningKey =
      this.configService.get<string>("MAILGUN_WEBHOOK_SIGNING_KEY") || "";

    if (!this.apiKey || !this.domain || !this.webhookSigningKey) {
      console.warn(
        "⚠️  Mailgun credentials not configured. Check your .env file."
      );
      console.warn(
        "   Copy env.example to .env and add your Mailgun credentials."
      );
    } else {
      console.log("📦 Mailgun Service initialized");
    }
  }

  /**
   * Verify webhook signature from Mailgun
   * Ensures the request is actually from Mailgun
   */
  verifyWebhookSignature(
    timestamp: string,
    token: string,
    signature: string
  ): boolean {
    const encodedToken = crypto
      .createHmac("sha256", this.webhookSigningKey)
      .update(timestamp.concat(token))
      .digest("hex");

    return encodedToken === signature;
  }

  /**
   * Send email via Mailgun
   * @param from - From address (e.g., l-abc123@inbox.yourapp.ca)
   * @param to - Recipient email
   * @param subject - Email subject
   * @param text - Plain text body
   * @param html - HTML body (optional)
   * @param inReplyTo - In-Reply-To header for threading (optional)
   * @param references - References header for threading (optional)
   * @param messageId - Message-ID header (optional)
   * @param attachments - Array of attachments with filename and data (Buffer) (optional)
   */
  async sendEmail(
    from: string,
    to: string,
    subject: string,
    text: string,
    html?: string,
    inReplyTo?: string,
    references?: string,
    messageId?: string,
    attachments?: Array<{ filename: string; data: Buffer }>
  ): Promise<void> {
    // TODO: Implement when Mailgun is set up
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({ username: "api", key: this.apiKey });

    const messageData: any = {
      from,
      to,
      subject,
      text,
      html,
    };

    // Add threading headers if this is a reply
    if (inReplyTo) {
      messageData["h:In-Reply-To"] = inReplyTo;
    }
    if (references) {
      messageData["h:References"] = references;
    }
    if (messageId) {
      messageData["h:Message-Id"] = messageId;
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      messageData.attachment = attachments.map((att) => ({
        filename: att.filename,
        data: att.data,
      }));
      console.log(
        `📎 MailgunService: Adding ${attachments.length} attachment(s) to email`
      );
      for (const att of attachments) {
        console.log(`   - ${att.filename}: ${att.data?.length || 0} bytes`);
      }
    } else {
      console.log(`📎 MailgunService: No attachments provided`);
    }

    await mg.messages.create(this.domain, messageData);

    // console.log(`[STUB] Sending email from ${from} to ${to}`);
    // console.log(`Subject: ${subject}`);
    // console.log(`Body: ${text.substring(0, 100)}...`);
  }

  /**
   * Parse incoming email from Mailgun webhook
   * Extracts important fields
   */
  parseIncomingEmail(payload: any) {
    const eventData = payload;

    // Use 'stripped-text' which removes quoted replies automatically
    // Falls back to 'body-plain' if stripped-text is not available
    // Default to empty string if no body is present (e.g., attachment-only emails)
    const bodyText =
      eventData["stripped-text"] || eventData["body-plain"] || "";
    const bodyHtml = eventData["stripped-html"] || eventData["body-html"] || "";

    // Parse attachments if Mailgun sends them as a JSON field (rare)
    // Note: With store+notify, files come via multipart and are handled by multer
    // They'll be in eventData._uploadedFiles (added by controller)
    let attachments = [];

    if (eventData.attachments) {
      try {
        // Some Mailgun configurations send attachments as a JSON string with URLs
        attachments =
          typeof eventData.attachments === "string"
            ? JSON.parse(eventData.attachments)
            : eventData.attachments;
        console.log(
          `📎 Parsed ${attachments.length} attachment(s) from attachments field`
        );
      } catch (error) {
        console.error("Failed to parse attachments field:", error);
      }
    }

    // Handle timestamp - might be string or number
    let timestamp = new Date();
    if (eventData.timestamp) {
      timestamp = new Date(
        typeof eventData.timestamp === "string"
          ? parseInt(eventData.timestamp) * 1000
          : eventData.timestamp * 1000
      );
    } else if (eventData.Date) {
      timestamp = new Date(eventData.Date);
    }

    return {
      from: eventData.sender,
      to: eventData.recipient,
      subject: eventData.subject || "(No Subject)",
      bodyText: bodyText,
      bodyHtml: bodyHtml,
      messageId: eventData["Message-Id"],
      inReplyTo: eventData["In-Reply-To"] || null,
      references: eventData["References"] || null,
      timestamp: timestamp,
      attachments: attachments,
      attachmentCount: eventData["attachment-count"]
        ? parseInt(eventData["attachment-count"])
        : 0,
      _uploadedFiles: eventData._uploadedFiles || [], // Pass through multer files from controller
    };
  }
}
