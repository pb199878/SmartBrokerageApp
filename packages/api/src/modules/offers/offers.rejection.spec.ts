import { Test, TestingModule } from "@nestjs/testing";
import { OffersService } from "./offers.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { MessageSubCategory } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { DropboxSignService } from "../../common/dropbox-sign/dropbox-sign.service";
import { SupabaseService } from "../../common/supabase/supabase.service";
import { MailgunService } from "../../common/mailgun/mailgun.service";
import { PdfService } from "./pdf.service";

// Mock dependencies
const mockPrismaService = {
  message: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  offer: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn(),
};

const mockDeps = {
  dropboxSignService: {},
  supabaseService: {},
  mailgunService: {
    sendEmail: jest.fn(),
  },
  pdfService: {},
};

describe("OffersService Rejection Logic", () => {
  let service: OffersService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DropboxSignService, useValue: mockDeps.dropboxSignService },
        { provide: SupabaseService, useValue: mockDeps.supabaseService },
        { provide: MailgunService, useValue: mockDeps.mailgunService },
        { provide: PdfService, useValue: mockDeps.pdfService },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should auto-reject offer when critical validation errors exist", async () => {
    // 1. Setup Mock Data
    const messageId = "valid-message-id";
    const mockMessage = {
      id: messageId,
      threadId: "thread-123",
      thread: {
        listingId: "listing-123",
        senderId: "sender-123",
        listing: {
          // Simplified listing object
          address: "123 Main St",
          emailAlias: "listing-123",
        },
        sender: {
          email: "buyer@agent.com",
        },
      },
      attachments: [
        {
          id: "att-1",
          s3Key: "test.pdf",
          documentAnalysis: {
            oreaFormDetected: true,
            confidence: 0.9,
            formFieldsExtracted: {
              // Missing price - should trigger REQUIRED error
              property: { property_address: "123 Main St" },
              buyer_full_name: "John Buyer",
              // Missing price_and_deposit object
            },
          },
        },
      ],
    };

    // Mock Prisma responses
    mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
    mockPrismaService.offer.findFirst.mockResolvedValue(null); // No existing offer
    mockPrismaService.offer.findMany.mockResolvedValue([]); // No active offers to supersede

    // Mock internal extraction method to return invalid data
    // We spy on the prototype or the instance methods that are used internally
    jest
      .spyOn(service as any, "extractOfferDataFromAttachment")
      .mockReturnValue({
        price: null, // TRIGGER ERROR
        deposit: 5000,
        buyerName: "John Buyer",
        propertyAddress: "123 Main St",
      });

    jest.spyOn(service as any, "validateOfferDates").mockReturnValue({
      status: "passed",
      issues: [],
    });

    // Mock validateOfferData to return failed status based on our forced invalid data
    // Or let the real method run if we trust it (which we do, based on previous tests)
    // Here we let the real validateOfferData run, which will see price=null and fail.

    // Spy on autoRejectInvalidOffer to verify it's called
    const autoRejectSpy = jest
      .spyOn(service as any, "autoRejectInvalidOffer")
      .mockImplementation(async () => {});

    // 2. Execute Method
    await expect(service.createOfferFromMessage(messageId)).rejects.toThrow(
      /Offer automatically rejected due to validation failures/,
    );

    // 3. Verify Interactions
    expect(autoRejectSpy).toHaveBeenCalled();
    expect(mockPrismaService.offer.create).not.toHaveBeenCalled();

    // Verify arguments passed to autoReject
    const callArgs = autoRejectSpy.mock.calls[0];
    const validationErrors = callArgs[2] as any[];
    expect(validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "price",
          message: expect.stringContaining("missing"),
        }),
      ]),
    );
  });

  it("should auto-reject offer when address mismatch occurs", async () => {
    // 1. Setup Mock Data
    const messageId = "mismatch-message-id";
    const mockMessage = {
      id: messageId,
      thread: {
        listingId: "listing-123",
        senderId: "sender-123",
        listing: { address: "123 Main St" },
        sender: { email: "buyer@agent.com" },
      },
      attachments: [
        {
          documentAnalysis: {
            oreaFormDetected: true,
            confidence: 0.9,
            formFieldsExtracted: {}, // simplified
          },
        },
      ],
    };

    mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
    mockPrismaService.offer.findFirst.mockResolvedValue(null);
    mockPrismaService.offer.findMany.mockResolvedValue([]);

    // Mock extraction to return address mismatch
    jest
      .spyOn(service as any, "extractOfferDataFromAttachment")
      .mockReturnValue({
        price: 500000,
        deposit: 25000,
        buyerName: "John Buyer",
        propertyAddress: "999 Wrong Way", // Mismatch!
      });

    jest
      .spyOn(service as any, "validateOfferDates")
      .mockReturnValue({ status: "passed", issues: [] });
    const autoRejectSpy = jest
      .spyOn(service as any, "autoRejectInvalidOffer")
      .mockImplementation(async () => {});

    // 2. Execute & Verify
    await expect(service.createOfferFromMessage(messageId)).rejects.toThrow(
      /Offer automatically rejected/,
    );

    expect(autoRejectSpy).toHaveBeenCalled();
    const callArgs = autoRejectSpy.mock.calls[0];
    expect(callArgs[2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "propertyAddress",
          message: expect.stringContaining("does not match"),
        }),
      ]),
    );
  });
});
