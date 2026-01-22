import { OffersService } from "./offers.service";

/**
 * Unit tests for validateOfferData method
 * Tests the OREA offer data validation logic
 */
describe("OffersService.validateOfferData", () => {
  let service: OffersService;

  beforeEach(() => {
    // Create a minimal instance for testing the validation method
    // Since validateOfferData is pure, we don't need full dependencies
    service = new OffersService(
      {} as any, // prisma
      {} as any, // apsParserService
      {} as any, // documentsService
      {} as any, // emailService
      {} as any, // pdfService
      {} as any, // configService
    );
  });

  describe("Required Fields Validation", () => {
    it("returns error when price is missing", () => {
      const result = service.validateOfferData(
        { price: null, buyerName: "John Doe", propertyAddress: "123 Main St" },
        "123 Main St",
      );

      expect(result.status).toBe("failed");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "price",
          severity: "error",
          category: "required",
        }),
      );
    });

    it("returns error when buyer name is missing", () => {
      const result = service.validateOfferData(
        { price: 500000, buyerName: "", propertyAddress: "123 Main St" },
        "123 Main St",
      );

      expect(result.status).toBe("failed");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "buyerName",
          severity: "error",
          category: "required",
        }),
      );
    });

    it("returns error when property address is missing", () => {
      const result = service.validateOfferData(
        { price: 500000, buyerName: "John Doe", propertyAddress: null },
        "123 Main St",
      );

      expect(result.status).toBe("failed");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "propertyAddress",
          severity: "error",
          category: "required",
        }),
      );
    });

    it("returns warning when deposit is missing", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: null,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
        },
        "123 Main St",
      );

      expect(result.status).toBe("warnings");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "deposit",
          severity: "warning",
          category: "required",
        }),
      );
    });
  });

  describe("Address Matching", () => {
    it("returns error when property address does not match listing", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: 50000,
          buyerName: "John Doe",
          propertyAddress: "999 Wrong Street",
        },
        "123 Main St, Toronto",
      );

      expect(result.status).toBe("failed");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "propertyAddress",
          severity: "error",
          category: "address",
        }),
      );
    });

    it("passes when address matches (case insensitive)", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: 50000,
          buyerName: "John Doe",
          propertyAddress: "123 MAIN ST, Toronto",
        },
        "123 Main St, Toronto",
      );

      expect(result.status).toBe("passed");
      expect(
        result.issues.filter((i) => i.category === "address"),
      ).toHaveLength(0);
    });
  });

  describe("Financial Consistency", () => {
    it("returns error when deposit >= price", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: 600000,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
        },
        "123 Main St",
      );

      expect(result.status).toBe("failed");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "deposit",
          severity: "error",
          category: "financial",
        }),
      );
    });

    it("returns warning when price is very low (possible parsing error)", () => {
      const result = service.validateOfferData(
        {
          price: 5000,
          deposit: 500,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
        },
        "123 Main St",
      );

      expect(result.status).toBe("warnings");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "price",
          severity: "warning",
          category: "financial",
          message: expect.stringContaining("seems unusually low"),
        }),
      );
    });

    it("returns warning when deposit is < 1% of price", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: 1000,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
        },
        "123 Main St",
      );

      expect(result.status).toBe("warnings");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "deposit",
          severity: "warning",
          category: "financial",
          message: expect.stringContaining("less than 1%"),
        }),
      );
    });
  });

  describe("Document Confidence", () => {
    it("returns warning when document confidence is low", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: 50000,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
          docConfidence: 0.3,
        },
        "123 Main St",
      );

      expect(result.status).toBe("warnings");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "document",
          severity: "warning",
          category: "confidence",
        }),
      );
    });

    it("passes when document confidence is high", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: 50000,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
          docConfidence: 0.9,
        },
        "123 Main St",
      );

      expect(result.status).toBe("passed");
      expect(
        result.issues.filter((i) => i.category === "confidence"),
      ).toHaveLength(0);
    });
  });

  describe("Clean Offer Validation", () => {
    it("returns warning when new offer contains seller signatures", () => {
      const result = service.validateOfferData(
        {
          price: 900000,
          deposit: 50000,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
          docConfidence: 0.9,
          hasSellerSignatures: true,
          isNewOffer: true,
        },
        "123 Main St",
      );

      expect(result.status).toBe("warnings");
      expect(result.issues).toContainEqual({
        field: "signatures",
        severity: "warning",
        message:
          "New offer contains seller signatures/initials - should be clean",
        category: "confidence",
      });
    });

    it("passes when new offer has no seller signatures", () => {
      const result = service.validateOfferData(
        {
          price: 900000,
          deposit: 50000,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
          docConfidence: 0.9,
          hasSellerSignatures: false,
          isNewOffer: true,
        },
        "123 Main St",
      );

      expect(result.status).toBe("passed");
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("Overall Status", () => {
    it("returns passed when all validations pass", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: 50000,
          buyerName: "John Doe",
          propertyAddress: "123 Main St, Toronto",
          docConfidence: 0.9,
        },
        "123 Main St, Toronto",
      );

      expect(result.status).toBe("passed");
      expect(result.issues).toHaveLength(0);
    });

    it("returns failed when any error exists", () => {
      const result = service.validateOfferData(
        {
          price: null,
          deposit: 50000,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
        },
        "123 Main St",
      );

      expect(result.status).toBe("failed");
    });

    it("returns warnings when only warnings exist", () => {
      const result = service.validateOfferData(
        {
          price: 500000,
          deposit: null,
          buyerName: "John Doe",
          propertyAddress: "123 Main St",
        },
        "123 Main St",
      );

      expect(result.status).toBe("warnings");
      expect(result.issues.every((i) => i.severity === "warning")).toBe(true);
    });
  });
});
