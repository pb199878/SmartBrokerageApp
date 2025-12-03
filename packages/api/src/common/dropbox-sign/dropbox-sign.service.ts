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
  private templateFieldsCache = new Map<string, string[]>();

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
        // Validate signer email is provided
        if (!signer.emailAddress || signer.emailAddress.trim() === "") {
          throw new Error(
            `Signer ${index} email address is required but was empty or undefined`
          );
        }

        // Validate signer name is provided
        if (!signer.name || signer.name.trim() === "") {
          throw new Error(
            `Signer ${index} name is required but was empty or undefined`
          );
        }

        this.logger.log(
          `Adding signer ${index}: ${signer.emailAddress} (${signer.name})`
        );

        formData.append(
          `signers[${index}][email_address]`,
          signer.emailAddress.trim()
        );
        formData.append(`signers[${index}][name]`, signer.name.trim());
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
      // NOTE: Only add signature fields if the PDF doesn't already have form fields
      // When we flatten the PDF, form fields are removed, so we can safely add signature fields
      if (options.file && !options.fileUrl) {
        this.logger.log(
          `Adding ${APS_2024_SIGNATURE_FIELDS.length} signature fields to form data`
        );
        this.addSignatureFields(formData);
      } else {
        this.logger.log(
          `Skipping signature fields (using fileUrl or no file provided)`
        );
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
          `Dropbox Sign API error: ${JSON.stringify(
            error.response.data,
            null,
            2
          )}`
        );
        this.logger.error(
          `Dropbox Sign API error status: ${error.response.status}`
        );
        this.logger.error(
          `Dropbox Sign API error headers: ${JSON.stringify(
            error.response.headers
          )}`
        );
      }
      if (error.response?.config) {
        this.logger.error(`Request URL: ${error.response.config.url}`);
        this.logger.error(`Request method: ${error.response.config.method}`);
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
   * Map our field types to Dropbox Sign's expected field types
   */
  private mapToDropboxSignFieldType(type: string): string {
    const typeMap: Record<string, string> = {
      signature: "signature",
      date: "date_signed",
      initial: "initials",
      initials: "initials",
      text: "text",
      checkbox: "checkbox",
    };

    return typeMap[type] || type;
  }

  /**
   * Add signature fields from the APS-2024 map to FormData
   */
  private addSignatureFields(formData: FormData): void {
    APS_2024_SIGNATURE_FIELDS.forEach((field, index) => {
      const apiId = `field_${field.type}_${index}`;

      // Map our field types to Dropbox Sign's expected types
      const dropboxSignType = this.mapToDropboxSignFieldType(field.type);

      formData.append(`form_fields_per_document[0][${index}][api_id]`, apiId);
      formData.append(
        `form_fields_per_document[0][${index}][name]`,
        field.label
      );
      formData.append(
        `form_fields_per_document[0][${index}][type]`,
        dropboxSignType
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
      // Dropbox Sign uses 1-based page numbering, our fields use 0-based
      formData.append(
        `form_fields_per_document[0][${index}][page]`,
        (field.page + 1).toString()
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

    // In stub mode, return a data URL with instructions instead of a fake domain
    // This prevents WebView errors when Dropbox Sign credentials aren't configured
    const stubHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 40px 20px;
              text-align: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              margin: 0;
            }
            .container {
              background: white;
              color: #333;
              padding: 30px;
              border-radius: 12px;
              max-width: 500px;
              margin: 0 auto;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            h1 { margin-top: 0; color: #667eea; }
            code {
              background: #f4f4f4;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 14px;
            }
            .success { color: #10b981; font-size: 48px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓</div>
            <h1>Stub Mode Active</h1>
            <p>This is a simulated signing page.</p>
            <p>To use real Dropbox Sign, add these to your <code>.env</code> file:</p>
            <p style="text-align: left; background: #f9f9f9; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <code>DROPBOX_SIGN_API_KEY=...</code><br>
              <code>DROPBOX_SIGN_CLIENT_ID=...</code>
            </p>
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              Request ID: ${stubId}
            </p>
          </div>
        </body>
      </html>
    `;

    const dataUrl = `data:text/html;base64,${Buffer.from(stubHtml).toString(
      "base64"
    )}`;

    return {
      signatureRequestId: `stub_request_${stubId}`,
      signatureId: `stub_signature_${stubId}`,
      signUrl: dataUrl,
      expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };
  }

  /**
   * Get merge fields for a template (with caching)
   * @param templateId - Dropbox Sign template ID
   * @returns Array of merge field names
   */
  async getTemplateMergeFields(templateId: string): Promise<string[]> {
    // Check cache first
    if (this.templateFieldsCache.has(templateId)) {
      return this.templateFieldsCache.get(templateId)!;
    }

    if (this.isStubbed) {
      // Return mock fields for testing
      const mockFields = [
        "agreement_date.day",
        "agreement_date.month",
        "agreement_date.year",
        "buyer_full_name",
        "seller_full_name",
        "property.property_address",
        "price_and_deposit.purchase_price.numeric",
        "price_and_deposit.deposit.numeric",
        "completion.day",
        "completion.month",
        "completion.year",
      ];
      this.templateFieldsCache.set(templateId, mockFields);
      return mockFields;
    }

    try {
      const response = await this.apiClient.get(`/template/${templateId}`);
      const template = response.data.template;
      const customFields = template.custom_fields || [];
      const fieldNames = customFields.map((field: any) => field.name);

      this.logger.log(
        `Retrieved ${fieldNames.length} merge fields for template ${templateId}`
      );

      // Cache the results
      this.templateFieldsCache.set(templateId, fieldNames);
      return fieldNames;
    } catch (error) {
      this.logger.error(
        `Error fetching template merge fields: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Create embedded signature request from template with custom fields
   * @param templateId - Dropbox Sign template ID
   * @param signerEmail - Email of the signer
   * @param signerName - Name of the signer
   * @param customFields - Key-value pairs for merge fields
   * @param metadata - Optional metadata
   * @returns Signature URL and request details
   */
  async createEmbeddedSignatureRequestFromTemplate(
    templateId: string,
    signerEmail: string,
    signerName: string,
    customFields: Record<string, string>,
    metadata?: Record<string, any>
  ): Promise<EmbeddedSignatureResponse> {
    if (this.isStubbed) {
      this.logger.log(
        `[STUB] Creating embedded signature request from template ${templateId}`
      );
      this.logger.log(`[STUB] Signer: ${signerName} <${signerEmail}>`);
      this.logger.log(`[STUB] Custom fields:`, customFields);

      const stubId = Date.now();
      return {
        signatureRequestId: `stub_template_request_${stubId}`,
        signatureId: `stub_template_signature_${stubId}`,
        signUrl: `https://app.hellosign.com/sign/stub_${stubId}`,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
    }

    try {
      // 1. Get valid merge fields for this template
      const validFields = await this.getTemplateMergeFields(templateId);

      // 2. Filter custom fields to only include valid ones
      const filteredFields: Record<string, string> = {};
      const excludedFields: string[] = [];

      for (const [key, value] of Object.entries(customFields)) {
        if (validFields.includes(key)) {
          filteredFields[key] = value;
        } else {
          excludedFields.push(key);
        }
      }

      if (excludedFields.length > 0) {
        this.logger.warn(
          `Excluded ${
            excludedFields.length
          } fields not in template: ${excludedFields.join(", ")}`
        );
      }

      this.logger.log(
        `Using ${
          Object.keys(filteredFields).length
        } custom fields for template ${templateId}`
      );

      // 3. Create FormData for the request
      const formData = new FormData();

      formData.append(
        "test_mode",
        process.env.NODE_ENV !== "production" ? "1" : "0"
      );
      formData.append("client_id", this.clientId);
      formData.append("template_ids[]", templateId);

      // Add signer with the "Seller Counter-Offer" role
      const roleName = "Seller Counter-Offer";
      this.logger.log(`Using role "${roleName}" for signer ${signerEmail}`);

      formData.append("signers[0][email_address]", signerEmail);
      formData.append("signers[0][name]", signerName);
      formData.append("signers[0][role]", roleName);

      // Add custom fields
      for (const [key, value] of Object.entries(filteredFields)) {
        formData.append(`custom_fields[${key}]`, value);
      }

      // Add metadata
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, String(value));
        });
      }

      // 4. Create the signature request
      const response = await this.apiClient.post(
        "/signature_request/create_embedded_with_template",
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

      this.logger.log(
        `Created template signature request: ${signatureRequestId}`
      );

      // 5. Get embedded signing URL
      const signUrlResponse = await this.getEmbeddedSignUrl(signatureId);

      return {
        signatureRequestId,
        signatureId,
        signUrl: signUrlResponse.signUrl,
        expiresAt: signUrlResponse.expiresAt,
      };
    } catch (error) {
      this.logger.error(
        `Error creating template signature request: ${error.message}`
      );
      if (error.response) {
        this.logger.error(`Response data:`, error.response.data);
      }
      throw error;
    }
  }
}
