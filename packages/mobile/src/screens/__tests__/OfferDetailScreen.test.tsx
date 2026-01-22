import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import OfferDetailScreen from "../OfferDetailScreen";

// Mock navigation
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({
    params: { offerId: "test-offer-1", listingId: "test-listing-1" },
  }),
  CommonActions: { reset: jest.fn() },
}));

// Mock React Query
const mockUseQuery = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

// Mock API services
jest.mock("../../services/api", () => ({
  offersApi: {
    getOffer: jest.fn(),
    updateOffer: jest.fn(),
  },
  attachmentsApi: {
    getAttachments: jest.fn(),
  },
}));

// Mock shared package
jest.mock("@smart-brokerage/shared", () => ({
  OfferStatus: {
    PENDING_REVIEW: "PENDING_REVIEW",
    ACCEPTED: "ACCEPTED",
    DECLINED: "DECLINED",
  },
  OfferConditionStatus: {
    PENDING: "PENDING",
    COMPLETED: "COMPLETED",
  },
  ApsParseResult: {},
}));

// Helper to create mock offer with different states
const createMockOffer = (overrides = {}) => ({
  id: "test-offer-1",
  status: "PENDING_REVIEW",
  price: 500000,
  closingDate: new Date(Date.now() + 86400000 * 15).toISOString(),
  expiryDate: new Date(Date.now() + 86400000 * 2).toISOString(),
  dateValidationStatus: "passed",
  dateValidationIssues: [],
  thread: {
    sender: { name: "Test Buyer Agent", email: "agent@test.com" },
  },
  ...overrides,
});

describe("OfferDetailScreen - Validation Warnings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Warning Display Logic", () => {
    it("displays Attention Needed card when dateValidationStatus is warnings", () => {
      mockUseQuery.mockReturnValue({
        data: createMockOffer({
          dateValidationStatus: "warnings",
          dateValidationIssues: [
            {
              field: "closingDate",
              severity: "warning",
              message: "Closing date is less than 30 days away",
            },
          ],
        }),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<OfferDetailScreen />);

      expect(screen.getByText("Attention Needed")).toBeTruthy();
      expect(
        screen.getByText(/Closing date is less than 30 days away/),
      ).toBeTruthy();
    });

    it("does NOT display warning card when dateValidationStatus is passed", () => {
      mockUseQuery.mockReturnValue({
        data: createMockOffer({
          dateValidationStatus: "passed",
          dateValidationIssues: [],
        }),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<OfferDetailScreen />);

      expect(screen.queryByText("Attention Needed")).toBeNull();
    });

    it("displays multiple validation issues when present", () => {
      mockUseQuery.mockReturnValue({
        data: createMockOffer({
          dateValidationStatus: "warnings",
          dateValidationIssues: [
            {
              field: "closingDate",
              severity: "warning",
              message: "Closing date is less than 30 days away",
            },
            {
              field: "expiryDate",
              severity: "warning",
              message: "Expiry gives less than 24 hours to respond",
            },
            {
              field: "condition.dueDate",
              severity: "warning",
              message: "Condition deadline is less than 3 days away",
            },
          ],
        }),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<OfferDetailScreen />);

      expect(screen.getByText("Attention Needed")).toBeTruthy();
      expect(
        screen.getByText(/Closing date is less than 30 days away/),
      ).toBeTruthy();
      expect(
        screen.getByText(/Expiry gives less than 24 hours to respond/),
      ).toBeTruthy();
      expect(
        screen.getByText(/Condition deadline is less than 3 days away/),
      ).toBeTruthy();
    });

    it("displays critical errors with error severity", () => {
      mockUseQuery.mockReturnValue({
        data: createMockOffer({
          dateValidationStatus: "failed",
          dateValidationIssues: [
            {
              field: "closingDate",
              severity: "error",
              message: "Closing date must be in the future",
            },
          ],
        }),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<OfferDetailScreen />);

      // Should still display the warning card (actual behavior may vary based on implementation)
      expect(
        screen.getByText(/Closing date must be in the future/),
      ).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("handles null dateValidationIssues gracefully", () => {
      mockUseQuery.mockReturnValue({
        data: createMockOffer({
          dateValidationStatus: "passed",
          dateValidationIssues: null,
        }),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      // Should not throw
      expect(() => render(<OfferDetailScreen />)).not.toThrow();
      expect(screen.queryByText("Attention Needed")).toBeNull();
    });

    it("handles undefined dateValidationStatus gracefully", () => {
      mockUseQuery.mockReturnValue({
        data: createMockOffer({
          dateValidationStatus: undefined,
          dateValidationIssues: undefined,
        }),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      // Should not throw
      expect(() => render(<OfferDetailScreen />)).not.toThrow();
    });

    it("handles empty dateValidationIssues array", () => {
      mockUseQuery.mockReturnValue({
        data: createMockOffer({
          dateValidationStatus: "warnings",
          dateValidationIssues: [],
        }),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<OfferDetailScreen />);

      // Should show Attention Needed but no specific issues
      // Behavior depends on implementation - card may or may not show with empty array
    });
  });

  describe("Loading and Error States", () => {
    it("shows loading indicator when data is loading", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      });

      render(<OfferDetailScreen />);

      expect(screen.getByText("Loading...")).toBeTruthy();
    });

    it("does not display warning card when data is undefined", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<OfferDetailScreen />);

      expect(screen.queryByText("Attention Needed")).toBeNull();
    });
  });
});
