import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { APS_2024_SIGNATURE_FIELDS } from "@smart-brokerage/shared";
import FormData from "form-data";
import * as crypto from "crypto";
import { URL } from "url";

interface SignerInfo {
  email: string;
  name?: string;
  order?: number; // Order of signing (0 = first, 1 = second, etc.)
}

interface SignatureRequestOptions {
  title: string;
  subject: string;
  message: string;
  signers: Array<{
    emailAddress: string;
    name: string;
    order?: number;
  }>;
  fileUrl?: string; // URL to PDF file
  file?: Buffer; // Or direct file buffer
  filename?: string; // Filename for buffer uploads
  metadata?: Record<string, any>;
}

interface EmbeddedSignatureResponse {
  signatureRequestId: string;
  signatureId: string;
  signUrl: string;
  expiresAt: number;
}

@Injectable()
export class DropboxSignService {
  private readonly logger = new Logger(DropboxSignService.name);
  private readonly apiClient: AxiosInstance;
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly isStubbed: boolean;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>("DROPBOX_SIGN_API_KEY") || "";
    this.clientId =
      this.configService.get<string>("DROPBOX_SIGN_CLIENT_ID") || "";
    this.isStubbed = !this.apiKey || !this.clientId;

    if (this.isStubbed) {
      this.logger.warn(
        "⚠️  Dropbox Sign API credentials not configured. Running in STUB mode."
      );
    } else {
      this.logger.log("✅ Dropbox Sign service initialized");
    }

    this.apiClient = axios.create({
      baseURL: "https://api.hellosign.com/v3",
      auth: {
        username: this.apiKey,
        password: "",
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Create an embedded signature request for a PDF
   * Returns signing URL to display in WebView
   */
  async createEmbeddedSignatureRequest(
    options: SignatureRequestOptions
  ): Promise<EmbeddedSignatureResponse> {
    if (this.isStubbed) {
      return this.stubCreateEmbeddedSignatureRequest(options);
    }

    try {
      // Create FormData for multipart/form-data request
      const formData = new FormData();

      // Add test mode flag
      formData.append(
        "test_mode",
        process.env.NODE_ENV !== "production" ? "1" : "0"
      );

      // Add required fields
      formData.append("client_id", this.clientId);
      formData.append("title", options.title);
      formData.append("subject", options.subject);
      formData.append("message", options.message);

      // Add signers
      options.signers.forEach((signer, index) => {
        formData.append(
          `signers[${index}][email_address]`,
          signer.emailAddress
        );
        formData.append(`signers[${index}][name]`, signer.name);
        if (signer.order !== undefined) {
          formData.append(`signers[${index}][order]`, signer.order.toString());
        }
      });

      // Add file (either URL or buffer)
      if (options.fileUrl) {
        formData.append("file_url[0]", options.fileUrl);
      } else if (options.file) {
        formData.append("file[0]", options.file, {
          filename: options.filename || "document.pdf",
          contentType: "application/pdf",
        });
      } else {
        throw new Error("Either fileUrl or file buffer must be provided");
      }

      // Add metadata
      if (options.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
          // Don't double-stringify - Dropbox Sign expects plain string values
          formData.append(`metadata[${key}]`, String(value));
        });
      }

      // Add signature fields from APS-2024 map (if using file buffer with predefined fields)
      if (options.file && !options.fileUrl) {
        this.addSignatureFields(formData);
      }

      // Create the signature request
      const response = await this.apiClient.post(
        "/signature_request/create_embedded",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      const signatureRequestId =
        response.data.signature_request.signature_request_id;
      const signatureId =
        response.data.signature_request.signatures[0].signature_id;

      this.logger.log(`Created signature request: ${signatureRequestId}`);

      // Get the embedded sign URL
      const signUrlResponse = await this.getEmbeddedSignUrl(signatureId);

      return {
        signatureRequestId,
        signatureId,
        signUrl: signUrlResponse.signUrl,
        expiresAt: signUrlResponse.expiresAt,
      };
    } catch (error) {
      this.logger.error(
        `Error creating embedded signature request: ${error.message}`
      );
      if (error.response?.data) {
        this.logger.error(
          `Dropbox Sign API error: ${JSON.stringify(error.response.data)}`
        );
      }
      throw error;
    }
  }

  /**
   * Get embedded sign URL for a signature
   * @param signatureId - The signature_id for the specific signer (NOT signature_request_id)
   */
  async getEmbeddedSignUrl(
    signatureId: string
  ): Promise<{ signUrl: string; expiresAt: number }> {
    if (this.isStubbed) {
      return {
        signUrl: `https://stubbed-sign-url.com/${signatureId}`,
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
    }

    try {
      const response = await this.apiClient.get(
        `/embedded/sign_url/${signatureId}`
      );

      // Add client_id to the URL for embedded signing
      const url = new URL(response.data.embedded.sign_url);
      url.searchParams.set("client_id", this.clientId);

      if (process.env.NODE_ENV !== "production") {
        url.searchParams.set("skip_domain_verification", "1");
      }

      const finalUrl = url.toString();
      this.logger.log(
        `Generated embedded sign URL for signature ${signatureId}`
      );
      this.logger.log(
        `Expires at: ${new Date(
          response.data.embedded.expires_at * 1000
        ).toISOString()}`
      );

      return {
        signUrl: finalUrl,
        expiresAt: response.data.embedded.expires_at,
      };
    } catch (error) {
      this.logger.error(`Error getting embedded sign URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get signature request details
   */
  async getSignatureRequest(signatureRequestId: string): Promise<any> {
    if (this.isStubbed) {
      return {
        signature_request_id: signatureRequestId,
        status: "signed",
        is_complete: true,
      };
    }

    try {
      const response = await this.apiClient.get(
        `/signature_request/${signatureRequestId}`
      );

      return response.data.signature_request;
    } catch (error) {
      this.logger.error(`Error getting signature request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download the final signed document
   */
  async downloadSignedDocument(signatureRequestId: string): Promise<Buffer> {
    if (this.isStubbed) {
      return Buffer.from("stubbed-signed-document");
    }

    try {
      const response = await this.apiClient.get(
        `/signature_request/files/${signatureRequestId}`,
        {
          responseType: "arraybuffer",
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Error downloading signed document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel a signature request
   */
  async cancelSignatureRequest(signatureRequestId: string): Promise<void> {
    if (this.isStubbed) {
      this.logger.log(`[STUB] Cancel signature request: ${signatureRequestId}`);
      return;
    }

    try {
      await this.apiClient.post(
        `/signature_request/cancel/${signatureRequestId}`
      );
      this.logger.log(`Cancelled signature request: ${signatureRequestId}`);
    } catch (error) {
      this.logger.error(`Error cancelling signature request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create signature request with email delivery (for counter-offers)
   * Seller signs embedded, then Dropbox Sign emails to buyer agent
   */
  async createSignatureRequestWithEmail(
    options: SignatureRequestOptions
  ): Promise<string> {
    if (this.isStubbed) {
      this.logger.log(
        `[STUB] Create email signature request for ${options.signers
          .map((s) => s.emailAddress)
          .join(", ")}`
      );
      return `stub_email_request_${Date.now()}`;
    }

    try {
      const formData = new FormData();
      formData.append(
        "test_mode",
        process.env.NODE_ENV !== "production" ? "1" : "0"
      );
      formData.append("title", options.title);
      formData.append("subject", options.subject);
      formData.append("message", options.message);

      // Add signers
      options.signers.forEach((signer, index) => {
        formData.append(
          `signers[${index}][email_address]`,
          signer.emailAddress
        );
        formData.append(`signers[${index}][name]`, signer.name);
        if (signer.order !== undefined) {
          formData.append(`signers[${index}][order]`, signer.order.toString());
        }
      });

      // Add file
      if (options.fileUrl) {
        formData.append("file_url[0]", options.fileUrl);
      } else if (options.file) {
        formData.append("file[0]", options.file, {
          filename: options.filename || "document.pdf",
          contentType: "application/pdf",
        });
      } else {
        throw new Error("Either fileUrl or file buffer must be provided");
      }

      // Add metadata
      if (options.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, JSON.stringify(value));
        });
      }

      const response = await this.apiClient.post(
        "/signature_request/send",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      const signatureRequestId =
        response.data.signature_request.signature_request_id;
      this.logger.log(`Created email signature request: ${signatureRequestId}`);

      return signatureRequestId;
    } catch (error) {
      this.logger.error(
        `Error creating email signature request: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Verify webhook signature from Dropbox Sign
   */
  verifyWebhookSignature(
    eventTime: string,
    eventType: string,
    eventHash: string
  ): boolean {
    if (!this.apiKey) {
      this.logger.warn(
        "⚠️  Cannot verify webhook signature - API key not configured"
      );
      return false;
    }

    const expectedHash = crypto
      .createHmac("sha256", this.apiKey)
      .update(eventTime + eventType)
      .digest("hex");

    return expectedHash === eventHash;
  }

  /**
   * Add signature fields from the APS-2024 map to FormData
   */
  private addSignatureFields(formData: FormData): void {
    APS_2024_SIGNATURE_FIELDS.forEach((field, index) => {
      const apiId = `field_${field.type}_${index}`;

      formData.append(`form_fields_per_document[0][${index}][api_id]`, apiId);
      formData.append(
        `form_fields_per_document[0][${index}][name]`,
        field.label
      );
      formData.append(
        `form_fields_per_document[0][${index}][type]`,
        field.type
      );
      formData.append(
        `form_fields_per_document[0][${index}][x]`,
        field.x.toString()
      );
      formData.append(
        `form_fields_per_document[0][${index}][y]`,
        field.y.toString()
      );
      formData.append(
        `form_fields_per_document[0][${index}][width]`,
        field.width.toString()
      );
      formData.append(
        `form_fields_per_document[0][${index}][height]`,
        field.height.toString()
      );
      formData.append(
        `form_fields_per_document[0][${index}][required]`,
        field.required.toString()
      );
      formData.append(`form_fields_per_document[0][${index}][signer]`, "0"); // First signer
      formData.append(
        `form_fields_per_document[0][${index}][page]`,
        field.page.toString()
      );
    });
  }

  /**
   * Stub implementation for development
   */
  private stubCreateEmbeddedSignatureRequest(
    options: SignatureRequestOptions
  ): EmbeddedSignatureResponse {
    const stubId = `stub_${Date.now()}`;
    this.logger.log(
      `[STUB] Created embedded signature request for ${options.signers
        .map((s) => s.emailAddress)
        .join(", ")}`
    );
    return {
      signatureRequestId: `stub_request_${stubId}`,
      signatureId: `stub_signature_${stubId}`,
      signUrl: `https://stubbed-sign-url.com/${stubId}`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };
  }
}
