import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import FormData from 'form-data';

interface EmbeddedSignatureRequest {
  signatureRequestId: string;
  signUrl: string;
  expiresAt: number;
}

interface SignatureRequestOptions {
  title: string;
  subject: string;
  message: string;
  signers: Array<{
    emailAddress: string;
    name: string;
    order?: number; // Order of signing (0 = first, 1 = second, etc.)
  }>;
  fileUrl?: string; // URL to PDF file
  file?: Buffer; // Or direct file buffer
  metadata?: Record<string, any>;
}

@Injectable()
export class HelloSignService {
  private apiKey: string;
  private clientId: string;
  private baseUrl = 'https://api.hellosign.com/v3';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('HELLOSIGN_API_KEY') || '';
    this.clientId = this.configService.get<string>('HELLOSIGN_CLIENT_ID') || '';

    if (!this.apiKey || !this.clientId) {
      console.warn('⚠️  Dropbox Sign credentials not configured. Check your .env file.');
      console.warn('   Add HELLOSIGN_API_KEY and HELLOSIGN_CLIENT_ID to use signing features.');
    } else {
      console.log('📝 Dropbox Sign (HelloSign) Service initialized');
    }
  }

  /**
   * Create embedded signature request for seller to sign in-app
   * Returns signing URL to display in WebView
   */
  async createEmbeddedSignatureRequest(
    options: SignatureRequestOptions,
  ): Promise<EmbeddedSignatureRequest> {
    if (!this.apiKey) {
      throw new Error('Dropbox Sign API key not configured');
    }

    try {
      const formData = new FormData();
      formData.append('test_mode', process.env.NODE_ENV !== 'production' ? '1' : '0');
      formData.append('client_id', this.clientId);
      formData.append('title', options.title);
      formData.append('subject', options.subject);
      formData.append('message', options.message);

      // Add signers
      options.signers.forEach((signer, index) => {
        formData.append(`signers[${index}][email_address]`, signer.emailAddress);
        formData.append(`signers[${index}][name]`, signer.name);
        if (signer.order !== undefined) {
          formData.append(`signers[${index}][order]`, signer.order.toString());
        }
      });

      // Add file (either URL or buffer)
      if (options.fileUrl) {
        formData.append('file_url[0]', options.fileUrl);
      } else if (options.file) {
        formData.append('file[0]', options.file, 'document.pdf');
      } else {
        throw new Error('Either fileUrl or file buffer must be provided');
      }

      // Add metadata
      if (options.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, JSON.stringify(value));
        });
      }

      const response = await axios.post(
        `${this.baseUrl}/signature_request/create_embedded`,
        formData,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
          },
        },
      );

      const signatureRequestId = response.data.signature_request.signature_request_id;

      // Get embedded signing URL for the first signer
      const signUrlResponse = await this.getEmbeddedSignUrl(signatureRequestId);

      return {
        signatureRequestId,
        signUrl: signUrlResponse.signUrl,
        expiresAt: signUrlResponse.expiresAt,
      };
    } catch (error) {
      console.error('Failed to create embedded signature request:', error);
      throw error;
    }
  }

  /**
   * Get embedded signing URL for a signature request
   */
  async getEmbeddedSignUrl(signatureRequestId: string): Promise<{ signUrl: string; expiresAt: number }> {
    if (!this.apiKey) {
      throw new Error('Dropbox Sign API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/embedded/sign_url/${signatureRequestId}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
          },
        },
      );

      return {
        signUrl: response.data.embedded.sign_url,
        expiresAt: response.data.embedded.expires_at,
      };
    } catch (error) {
      console.error('Failed to get embedded sign URL:', error);
      throw error;
    }
  }

  /**
   * Create signature request with email delivery (for counter-offers)
   * Seller signs embedded, then Dropbox Sign emails to buyer agent
   */
  async createSignatureRequestWithEmail(
    options: SignatureRequestOptions,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Dropbox Sign API key not configured');
    }

    try {
      const formData = new FormData();
      formData.append('test_mode', process.env.NODE_ENV !== 'production' ? '1' : '0');
      formData.append('title', options.title);
      formData.append('subject', options.subject);
      formData.append('message', options.message);

      // Add signers
      options.signers.forEach((signer, index) => {
        formData.append(`signers[${index}][email_address]`, signer.emailAddress);
        formData.append(`signers[${index}][name]`, signer.name);
        if (signer.order !== undefined) {
          formData.append(`signers[${index}][order]`, signer.order.toString());
        }
      });

      // Add file
      if (options.fileUrl) {
        formData.append('file_url[0]', options.fileUrl);
      } else if (options.file) {
        formData.append('file[0]', options.file, 'document.pdf');
      }

      // Add metadata
      if (options.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, JSON.stringify(value));
        });
      }

      const response = await axios.post(
        `${this.baseUrl}/signature_request/send`,
        formData,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
          },
        },
      );

      return response.data.signature_request.signature_request_id;
    } catch (error) {
      console.error('Failed to create signature request:', error);
      throw error;
    }
  }

  /**
   * Download signed document from Dropbox Sign
   */
  async downloadSignedDocument(signatureRequestId: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('Dropbox Sign API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/signature_request/files/${signatureRequestId}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
          },
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Failed to download signed document:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature from Dropbox Sign
   */
  verifyWebhookSignature(eventTime: string, eventType: string, eventHash: string): boolean {
    const apiKey = this.apiKey;
    if (!apiKey) {
      console.warn('⚠️  Cannot verify webhook signature - API key not configured');
      return false;
    }

    const expectedHash = crypto
      .createHmac('sha256', apiKey)
      .update(eventTime + eventType)
      .digest('hex');

    return expectedHash === eventHash;
  }

  /**
   * Get signature request status
   */
  async getSignatureRequest(signatureRequestId: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Dropbox Sign API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/signature_request/${signatureRequestId}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
          },
        },
      );

      return response.data.signature_request;
    } catch (error) {
      console.error('Failed to get signature request:', error);
      throw error;
    }
  }
}

