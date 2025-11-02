import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { PdfService } from './pdf.service';
import { DropboxSignService } from '../../common/dropbox-sign/dropbox-sign.service';
import {
  PrepareAgreementRequest,
  PrepareAgreementResponse,
  AgreementDetail,
  AgreementStatus,
  SignatureRequestStatus,
} from '@smart-brokerage/shared';

@Injectable()
export class AgreementsService {
  private readonly logger = new Logger(AgreementsService.name);

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    private pdfService: PdfService,
    private dropboxSign: DropboxSignService,
  ) {}

  /**
   * Prepare an APS for signing
   * - Load buyer's APS PDF
   * - Detect OREA version
   * - Flatten and prefill with seller data
   * - Create Dropbox Sign embedded signature request
   */
  async prepareAgreement(
    request: PrepareAgreementRequest,
  ): Promise<PrepareAgreementResponse> {
    this.logger.log(`Preparing agreement for listing ${request.listingId}`);

    try {
      // 1. Resolve the buyer's APS PDF
      const buyerApsPdf = await this.resolveBuyerApsPdf(request.source);

      // 2. Detect OREA version
      const oreaVersion = await this.pdfService.detectOreaVersion(buyerApsPdf);
      if (!oreaVersion) {
        throw new BadRequestException(
          'Could not detect OREA version. Please ensure this is a valid OREA APS form.',
        );
      }

      this.logger.log(`Detected OREA version: ${oreaVersion}`);

      // 3. Flatten the PDF (preserve buyer's filled fields)
      const flattenedPdf = await this.pdfService.flattenPdf(buyerApsPdf);

      // 4. Prefill with seller's intake data
      const prefilledPdf = await this.pdfService.prefillSellerData(
        flattenedPdf,
        request.intake,
        oreaVersion,
      );

      // 5. Upload prepared PDF to Supabase (using attachments bucket)
      const preparedFileKey = `agreements/${request.listingId}/prepared_${Date.now()}.pdf`;
      await this.supabase.uploadFile(
        'attachments',
        preparedFileKey,
        prefilledPdf,
        'application/pdf',
      );

      this.logger.log(`Uploaded prepared PDF to: ${preparedFileKey}`);

      // 6. Create Agreement record in database
      const agreement = await this.prisma.agreement.create({
        data: {
          listingId: request.listingId,
          buyerApsAttachmentId: request.source.attachmentId,
          buyerApsFileKey: request.source.fileKey,
          oreaVersion,
          preparedFileKey,
          sellerEmail: request.seller.email,
          sellerName: request.seller.name,
          intakeData: request.intake as any,
          status: 'PREPARING',
        },
      });

      this.logger.log(`Created agreement record: ${agreement.id}`);

      // 7. Create Dropbox Sign embedded signature request
      const dropboxResponse = await this.dropboxSign.createEmbeddedSignatureRequest({
        title: `Agreement of Purchase and Sale - Listing ${request.listingId}`,
        subject: 'Please sign this Agreement of Purchase and Sale',
        message: 'Please review and sign the APS document to accept the buyer\'s offer.',
        signers: [
          {
            emailAddress: request.seller.email,
            name: request.seller.name || 'Seller',
            order: 0,
          },
        ],
        file: prefilledPdf,
        filename: `APS_${request.listingId}_${Date.now()}.pdf`,
        metadata: {
          agreementId: agreement.id,
          listingId: request.listingId,
        },
      });

      this.logger.log(`Created Dropbox Sign request: ${dropboxResponse.signatureRequestId}`);

      // 8. Create SignatureRequest record
      await this.prisma.signatureRequest.create({
        data: {
          agreementId: agreement.id,
          provider: 'DROPBOX_SIGN',
          providerRequestId: dropboxResponse.signatureRequestId,
          providerSignatureId: dropboxResponse.signatureId,
          signerEmail: request.seller.email,
          signerName: request.seller.name,
          signUrl: dropboxResponse.signUrl,
          status: 'CREATED',
        },
      });

      // 9. Update agreement status
      await this.prisma.agreement.update({
        where: { id: agreement.id },
        data: {
          status: 'READY_TO_SIGN',
          preparedAt: new Date(),
        },
      });

      return {
        agreementId: agreement.id,
        signUrl: dropboxResponse.signUrl,
      };
    } catch (error) {
      this.logger.error(`Error preparing agreement: ${error.message}`);
      
      // Log the error in the database if we have an agreement record
      // For now, just re-throw
      throw error;
    }
  }

  /**
   * Get agreement details by ID
   */
  async getAgreement(agreementId: string): Promise<AgreementDetail> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        signatureRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement ${agreementId} not found`);
    }

    const signatureRequest = agreement.signatureRequests[0];

    // Generate signed URL for final document if signed
    let finalDocumentUrl: string | undefined;
    if (
      agreement.status === 'SIGNED' &&
      signatureRequest?.finalDocumentFileKey
    ) {
      finalDocumentUrl = await this.supabase.getSignedUrl(
        'attachments',
        signatureRequest.finalDocumentFileKey,
        3600,
      );
    }

    return {
      id: agreement.id,
      listingId: agreement.listingId,
      status: agreement.status as AgreementStatus,
      oreaVersion: agreement.oreaVersion || undefined,
      sellerEmail: agreement.sellerEmail,
      sellerName: agreement.sellerName || undefined,
      createdAt: agreement.createdAt.toISOString(),
      updatedAt: agreement.updatedAt.toISOString(),
      preparedAt: agreement.preparedAt?.toISOString(),
      signedAt: agreement.signedAt?.toISOString(),
      errorMessage: agreement.errorMessage || undefined,
      signatureRequest: signatureRequest
        ? {
            id: signatureRequest.id,
            status: signatureRequest.status as unknown as SignatureRequestStatus,
            signUrl: signatureRequest.signUrl || undefined,
            viewedAt: signatureRequest.viewedAt?.toISOString(),
            signedAt: signatureRequest.signedAt?.toISOString(),
          }
        : undefined,
      finalDocumentUrl,
    };
  }

  /**
   * Handle Dropbox Sign webhook events
   */
  async handleDropboxSignWebhook(event: any): Promise<void> {
    const eventType = event.event?.event_type;
    const signatureRequestId = event.signature_request?.signature_request_id;

    if (!signatureRequestId) {
      this.logger.warn('Webhook missing signature_request_id');
      return;
    }

    this.logger.log(`Dropbox Sign webhook: ${eventType} for ${signatureRequestId}`);

    // Find the signature request in our database
    const signatureRequest = await this.prisma.signatureRequest.findFirst({
      where: { providerRequestId: signatureRequestId },
      include: { agreement: true },
    });

    if (!signatureRequest) {
      this.logger.warn(`Signature request ${signatureRequestId} not found in database`);
      return;
    }

    switch (eventType) {
      case 'signature_request_viewed':
        await this.handleSignatureViewed(signatureRequest.id);
        break;

      case 'signature_request_signed':
        await this.handleSignatureSigned(
          signatureRequest.id,
          signatureRequest.agreementId,
        );
        break;

      case 'signature_request_declined':
        await this.handleSignatureDeclined(signatureRequest.id);
        break;

      case 'signature_request_all_signed':
        await this.handleAllSigned(
          signatureRequest.id,
          signatureRequest.agreementId,
          signatureRequestId,
        );
        break;

      default:
        this.logger.log(`Unhandled webhook event type: ${eventType}`);
    }
  }

  /**
   * Handle signature_request_viewed event
   */
  private async handleSignatureViewed(signatureRequestId: string): Promise<void> {
    await this.prisma.signatureRequest.update({
      where: { id: signatureRequestId },
      data: {
        status: 'VIEWED',
        viewedAt: new Date(),
      },
    });

    await this.prisma.agreement.update({
      where: { id: (await this.prisma.signatureRequest.findUnique({ where: { id: signatureRequestId } }))?.agreementId },
      data: { status: 'SIGNING_IN_PROGRESS' },
    });

    this.logger.log(`Signature request ${signatureRequestId} viewed`);
  }

  /**
   * Handle signature_request_signed event (single signer signed)
   */
  private async handleSignatureSigned(
    signatureRequestId: string,
    agreementId: string,
  ): Promise<void> {
    await this.prisma.signatureRequest.update({
      where: { id: signatureRequestId },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
      },
    });

    this.logger.log(`Signature request ${signatureRequestId} signed`);
  }

  /**
   * Handle signature_request_all_signed event
   */
  private async handleAllSigned(
    signatureRequestId: string,
    agreementId: string,
    providerRequestId: string,
  ): Promise<void> {
    try {
      // Download the final signed document from Dropbox Sign
      const signedPdf = await this.dropboxSign.downloadSignedDocument(
        providerRequestId,
      );

      // Upload to Supabase
      const agreement = await this.prisma.agreement.findUnique({
        where: { id: agreementId },
      });

      if (!agreement) {
        throw new Error(`Agreement ${agreementId} not found`);
      }

      const finalFileKey = `agreements/${agreement.listingId}/signed_${Date.now()}.pdf`;
      await this.supabase.uploadFile(
        'attachments',
        finalFileKey,
        signedPdf,
        'application/pdf',
      );

      this.logger.log(`Uploaded final signed document to: ${finalFileKey}`);

      // Update signature request
      await this.prisma.signatureRequest.update({
        where: { id: signatureRequestId },
        data: {
          status: 'SIGNED',
          signedAt: new Date(),
          finalDocumentFileKey: finalFileKey,
        },
      });

      // Update agreement
      await this.prisma.agreement.update({
        where: { id: agreementId },
        data: {
          status: 'SIGNED',
          signedAt: new Date(),
        },
      });

      this.logger.log(`Agreement ${agreementId} fully signed`);
    } catch (error) {
      this.logger.error(`Error handling all_signed event: ${error.message}`);
      
      await this.prisma.agreement.update({
        where: { id: agreementId },
        data: {
          status: 'FAILED',
          errorMessage: `Failed to download signed document: ${error.message}`,
        },
      });
    }
  }

  /**
   * Handle signature_request_declined event
   */
  private async handleSignatureDeclined(signatureRequestId: string): Promise<void> {
    const signatureRequest = await this.prisma.signatureRequest.findUnique({
      where: { id: signatureRequestId },
    });

    if (!signatureRequest) return;

    await this.prisma.signatureRequest.update({
      where: { id: signatureRequestId },
      data: { status: 'DECLINED' },
    });

    await this.prisma.agreement.update({
      where: { id: signatureRequest.agreementId },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Signature request declined by signer',
      },
    });

    this.logger.log(`Signature request ${signatureRequestId} declined`);
  }

  /**
   * Resolve the buyer's APS PDF from attachment or file key
   */
  private async resolveBuyerApsPdf(source: PrepareAgreementRequest['source']): Promise<Buffer> {
    if (source.type === 'attachment' && source.attachmentId) {
      // Load from attachment
      const attachment = await this.prisma.attachment.findUnique({
        where: { id: source.attachmentId },
      });

      if (!attachment) {
        throw new NotFoundException(`Attachment ${source.attachmentId} not found`);
      }

      // Get signed URL and download
      const signedUrl = await this.supabase.getSignedUrl(
        'attachments',
        attachment.s3Key,
        300, // 5 minutes
      );

      return await this.pdfService.downloadPdfFromUrl(signedUrl);
    } else if (source.type === 'fileKey' && source.fileKey) {
      // Load directly from file key
      const signedUrl = await this.supabase.getSignedUrl(
        'attachments',
        source.fileKey,
        300,
      );

      return await this.pdfService.downloadPdfFromUrl(signedUrl);
    } else {
      throw new BadRequestException('Invalid source: must provide attachmentId or fileKey');
    }
  }
}

