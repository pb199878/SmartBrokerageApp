import { Test, TestingModule } from "@nestjs/testing";
import { OffersService } from "./offers.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { DropboxSignService } from "../../common/dropbox-sign/dropbox-sign.service";
import { SupabaseService } from "../../common/supabase/supabase.service";
import { MailgunService } from "../../common/mailgun/mailgun.service";
import { PdfService } from "./pdf.service";
import { ConfigService } from "@nestjs/config";

describe("OffersService - Date Validation", () => {
  let service: OffersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: PrismaService, useValue: {} },
        { provide: DropboxSignService, useValue: {} },
        { provide: SupabaseService, useValue: {} },
        { provide: MailgunService, useValue: {} },
        { provide: PdfService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
  });

  describe("validateOfferDates", () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    it("should pass with valid future dates", () => {
      const result = service.validateOfferDates(in60Days, nextWeek, []);

      expect(result.status).toBe("passed");
      expect(result.issues).toHaveLength(0);
    });

    it("should fail if closing date is missing", () => {
      const result = service.validateOfferDates(null, nextWeek, []);

      expect(result.status).toBe("failed");
      expect(
        result.issues.some(
          (i) => i.field === "closingDate" && i.severity === "error",
        ),
      ).toBe(true);
    });

    it("should fail if closing date is in the past", () => {
      const result = service.validateOfferDates(yesterday, nextWeek, []);

      expect(result.status).toBe("failed");
      expect(
        result.issues.some(
          (i) =>
            i.field === "closingDate" &&
            i.severity === "error" &&
            i.message.includes("future"),
        ),
      ).toBe(true);
    });

    it("should fail if expiry date is in the past", () => {
      const result = service.validateOfferDates(in60Days, yesterday, []);

      expect(result.status).toBe("failed");
      expect(
        result.issues.some(
          (i) =>
            i.field === "expiryDate" &&
            i.severity === "error" &&
            i.message.includes("expired"),
        ),
      ).toBe(true);
    });

    it("should fail if expiry date is after closing date", () => {
      const result = service.validateOfferDates(nextWeek, in60Days, []);

      expect(result.status).toBe("failed");
      expect(
        result.issues.some(
          (i) =>
            i.field === "expiryDate" &&
            i.severity === "error" &&
            i.message.includes("after closing"),
        ),
      ).toBe(true);
    });

    it("should warn if closing date is less than 30 days away", () => {
      const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
      const result = service.validateOfferDates(in20Days, tomorrow, []);

      expect(result.status).toBe("warnings");
      expect(
        result.issues.some(
          (i) =>
            i.field === "closingDate" &&
            i.severity === "warning" &&
            i.message.includes("30 days"),
        ),
      ).toBe(true);
    });

    it("should warn if expiry gives less than 24 hours to respond", () => {
      const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const result = service.validateOfferDates(in60Days, in12Hours, []);

      expect(result.status).toBe("warnings");
      expect(
        result.issues.some(
          (i) =>
            i.field === "expiryDate" &&
            i.severity === "warning" &&
            i.message.includes("24 hours"),
        ),
      ).toBe(true);
    });

    it("should warn if expiry date is missing", () => {
      const result = service.validateOfferDates(in60Days, null, []);

      expect(result.status).toBe("warnings");
      expect(
        result.issues.some(
          (i) =>
            i.field === "expiryDate" &&
            i.severity === "warning" &&
            i.message.includes("missing"),
        ),
      ).toBe(true);
    });

    it("should warn if condition deadline is missing", () => {
      const conditions = [{ description: "Financing condition" }];
      const result = service.validateOfferDates(in60Days, nextWeek, conditions);

      expect(result.status).toBe("warnings");
      expect(
        result.issues.some(
          (i) =>
            i.field.startsWith("condition") &&
            i.severity === "warning" &&
            i.message.includes("no deadline"),
        ),
      ).toBe(true);
    });

    it("should fail if condition deadline is in the past", () => {
      const conditions = [{ dueDate: yesterday, description: "Inspection" }];
      const result = service.validateOfferDates(in60Days, nextWeek, conditions);

      expect(result.status).toBe("failed");
      expect(
        result.issues.some(
          (i) =>
            i.field.startsWith("condition") &&
            i.severity === "error" &&
            i.message.includes("past"),
        ),
      ).toBe(true);
    });

    it("should fail if condition deadline is after closing date", () => {
      const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const conditions = [{ dueDate: in90Days, description: "Financing" }];
      const result = service.validateOfferDates(in60Days, nextWeek, conditions);

      expect(result.status).toBe("failed");
      expect(
        result.issues.some(
          (i) =>
            i.field.startsWith("condition") &&
            i.severity === "error" &&
            i.message.includes("after closing"),
        ),
      ).toBe(true);
    });

    it("should warn if condition deadline is less than 3 days away", () => {
      const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const conditions = [
        { dueDate: in2Days, description: "Quick inspection" },
      ];
      const result = service.validateOfferDates(in60Days, nextWeek, conditions);

      expect(result.status).toBe("warnings");
      expect(
        result.issues.some(
          (i) =>
            i.field.startsWith("condition") &&
            i.severity === "warning" &&
            i.message.includes("3 days"),
        ),
      ).toBe(true);
    });
  });
});
