import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agreementsApi } from '../services/api';
import type {
  PrepareAgreementRequest,
  PrepareAgreementResponse,
  AgreementDetail,
} from '@smart-brokerage/shared';

/**
 * Prepare an APS for seller signing
 */
export function usePrepareAgreement() {
  const queryClient = useQueryClient();

  return useMutation<PrepareAgreementResponse, Error, PrepareAgreementRequest>({
    mutationFn: agreementsApi.prepare,
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ['agreement', data.agreementId] });
      queryClient.invalidateQueries({ queryKey: ['listings', variables.listingId] });
    },
  });
}

/**
 * Get agreement details
 */
export function useAgreement(agreementId: string | undefined) {
  return useQuery<AgreementDetail, Error>({
    queryKey: ['agreement', agreementId],
    queryFn: () => agreementsApi.get(agreementId!),
    enabled: !!agreementId,
    refetchInterval: (data) => {
      // Poll while signing is in progress
      if (
        data?.status === 'READY_TO_SIGN' ||
        data?.status === 'SIGNING_IN_PROGRESS'
      ) {
        return 5000; // Poll every 5 seconds
      }
      return false; // Don't poll
    },
  });
}

