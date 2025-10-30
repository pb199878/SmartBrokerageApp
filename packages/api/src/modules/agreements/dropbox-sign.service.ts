import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { APS_2024_SIGNATURE_FIELDS } from '@smart-brokerage/shared';
import FormData from 'form-data';

interface SignerInfo {
  email: string;
  name?: string;
}

interface DropboxSignField {
  api_id: string;
  name: string;
  type: 'signature' | 'date' | 'initials';
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  signer: number; // 0-indexed signer position
  page: number;
}

interface EmbeddedSignatureResponse {
  signature_request_id: string;
  signature_id: string;
  sign_url?: string;
}

@Injectable()
export class DropboxSignService {
  private readonly logger = new Logger(DropboxSignService.name);
  private readonly apiClient: AxiosInstance;
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly isStubbed: boolean;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DROPBOX_SIGN_API_KEY') || '';
    this.clientId = this.configService.get<string>('DROPBOX_SIGN_CLIENT_ID') || '';
    this.isStubbed = !this.apiKey || !this.clientId;

    if (this.isStubbed) {
      this.logger.warn(
        '⚠️  Dropbox Sign API credentials not configured. Running in STUB mode.',
      );
    } else {
      this.logger.log('✅ Dropbox Sign service initialized');
    }

    this.apiClient = axios.create({
      baseURL: 'https://api.hellosign.com/v3',
      auth: {
        username: this.apiKey,
        password: '',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create an embedded signature request for a PDF
   * @param pdfBuffer - PDF file buffer
   * @param filename - Name of the PDF file
   * @param signer - Signer information
   * @param subject - Subject line for the request
   * @param message - Message to the signer
   * @returns Signature request details including sign URL
   */
  async createEmbeddedSignatureRequest(
    pdfBuffer: Buffer,
    filename: string,
    signer: SignerInfo,
    subject: string = 'Please sign this Agreement of Purchase and Sale',
    message: string = 'Please review and sign the APS document.',
  ): Promise<EmbeddedSignatureResponse> {
    if (this.isStubbed) {
      return this.stubCreateEmbeddedSignatureRequest(signer);
    }

    try {
      // Create FormData for multipart/form-data request
      const formData = new FormData();
      
      // Add the PDF file
      formData.append('file[0]', pdfBuffer, {
        filename,
        contentType: 'application/pdf',
      });

      // Add required fields
      formData.append('client_id', this.clientId);
      formData.append('subject', subject);
      formData.append('message', message);
      formData.append('signers[0][email_address]', signer.email);
      if (signer.name) {
        formData.append('signers[0][name]', signer.name);
      }

      // Add signature fields from APS-2024 map
      this.addSignatureFields(formData);

      // Create the signature request
      const response = await this.apiClient.post(
        '/signature_request/create_embedded',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      const signatureRequestId = response.data.signature_request.signature_request_id;
      const signatureId = response.data.signature_request.signatures[0].signature_id;

      this.logger.log(`Created signature request: ${signatureRequestId}`);

      // Get the embedded sign URL
      const signUrl = await this.getEmbeddedSignUrl(signatureId);

      return {
        signature_request_id: signatureRequestId,
        signature_id: signatureId,
        sign_url: signUrl,
      };
    } catch (error) {
      this.logger.error(
        `Error creating embedded signature request: ${error.message}`,
      );
      if (error.response?.data) {
        this.logger.error(`Dropbox Sign API error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get embedded sign URL for a signature
   */
  async getEmbeddedSignUrl(signatureId: string): Promise<string> {
    if (this.isStubbed) {
      return `https://stubbed-sign-url.com/${signatureId}`;
    }

    try {
      const response = await this.apiClient.get(
        `/embedded/sign_url/${signatureId}`,
      );

      return response.data.embedded.sign_url;
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
        status: 'signed',
        is_complete: true,
      };
    }

    try {
      const response = await this.apiClient.get(
        `/signature_request/${signatureRequestId}`,
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
      return Buffer.from('stubbed-signed-document');
    }

    try {
      const response = await this.apiClient.get(
        `/signature_request/files/${signatureRequestId}`,
        {
          responseType: 'arraybuffer',
        },
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
        `/signature_request/cancel/${signatureRequestId}`,
      );
      this.logger.log(`Cancelled signature request: ${signatureRequestId}`);
    } catch (error) {
      this.logger.error(`Error cancelling signature request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify webhook signature (security)
   */
  verifyWebhookSignature(
    eventData: any,
    apiKey: string,
    timestamp: string,
  ): boolean {
    // TODO: Implement webhook signature verification
    // See: https://developers.hellosign.com/api/reference/webhook-callbacks/
    this.logger.warn('Webhook signature verification not yet implemented');
    return true;
  }

  /**
   * Add signature fields from the APS-2024 map to FormData
   */
  private addSignatureFields(formData: FormData): void {
    APS_2024_SIGNATURE_FIELDS.forEach((field, index) => {
      const apiId = `field_${field.type}_${index}`;
      
      formData.append(`form_fields_per_document[0][${index}][api_id]`, apiId);
      formData.append(`form_fields_per_document[0][${index}][name]`, field.label);
      formData.append(`form_fields_per_document[0][${index}][type]`, field.type);
      formData.append(`form_fields_per_document[0][${index}][x]`, field.x.toString());
      formData.append(`form_fields_per_document[0][${index}][y]`, field.y.toString());
      formData.append(`form_fields_per_document[0][${index}][width]`, field.width.toString());
      formData.append(`form_fields_per_document[0][${index}][height]`, field.height.toString());
      formData.append(`form_fields_per_document[0][${index}][required]`, field.required.toString());
      formData.append(`form_fields_per_document[0][${index}][signer]`, '0'); // First signer
      formData.append(`form_fields_per_document[0][${index}][page]`, field.page.toString());
    });
  }

  /**
   * Stub implementation for development
   */
  private stubCreateEmbeddedSignatureRequest(
    signer: SignerInfo,
  ): EmbeddedSignatureResponse {
    const stubId = `stub_${Date.now()}`;
    this.logger.log(`[STUB] Created embedded signature request for ${signer.email}`);
    return {
      signature_request_id: `stub_request_${stubId}`,
      signature_id: `stub_signature_${stubId}`,
      sign_url: `https://stubbed-sign-url.com/${stubId}`,
    };
  }
}

