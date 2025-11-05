import { useMutation, useQueryClient } from "@tanstack/react-query";
import { prepareOfferForSigning } from "../services/api";
import type {
  PrepareOfferForSigningResponse,
  ApsIntake,
} from "@smart-brokerage/shared";

interface PrepareOfferForSigningParams {
  offerId: string;
  intake: ApsIntake;
  seller: {
    email: string;
    name: string;
  };
}

/**
 * Prepare an offer for seller signing with guided intake
 * Replaces usePrepareAgreement()
 */
export function usePrepareOfferForSigning() {
  const queryClient = useQueryClient();

  return useMutation<
    PrepareOfferForSigningResponse,
    Error,
    PrepareOfferForSigningParams
  >({
    mutationFn: ({ offerId, intake, seller }) =>
      prepareOfferForSigning(offerId, intake, seller),
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ["offer", variables.offerId] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });
}

/**
 * @deprecated Use usePrepareOfferForSigning() instead
 * Legacy hook kept for backwards compatibility
 */
export function usePrepareAgreement() {
  throw new Error(
    "usePrepareAgreement() is deprecated. Use usePrepareOfferForSigning() instead"
  );
}

/**
 * @deprecated Agreements are now consolidated into Offers. Use useOffer() from offers hook instead
 */
export function useAgreement() {
  throw new Error("useAgreement() is deprecated. Use useOffer() instead");
}
