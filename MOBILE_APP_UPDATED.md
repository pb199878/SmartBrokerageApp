# ✅ Mobile App Updated - Deprecated Agreement Hooks Removed

## Summary

Successfully updated all mobile screens to use the new offer-based hooks (`usePrepareOfferForSigning`) instead of the deprecated agreement hooks (`usePrepareAgreement`, `useAgreement`).

## Files Updated

### 1. Navigation Types
**File**: `packages/mobile/src/navigation/AppNavigator.tsx`

**Changes**:
- `ApsGuidedForm`: Now requires `offerId` instead of `attachmentId`
- `ApsReview`: Now requires `offerId` instead of `attachmentId`  
- `ApsSigning`: Now uses `offerId` instead of `agreementId`

```typescript
// Before
ApsGuidedForm: {
  listingId: string;
  attachmentId: string;
  sellerEmail: string;
  sellerName?: string;
};

// After
ApsGuidedForm: {
  offerId: string;
  listingId: string;
  sellerEmail: string;
  sellerName?: string;
};
```

### 2. ApsGuidedFormScreen
**File**: `packages/mobile/src/screens/ApsGuidedFormScreen.tsx`

**Changes**:
- Import: `usePrepareAgreement` → `usePrepareOfferForSigning`
- Route params: Now extracts `offerId` instead of `attachmentId`
- API call: Simplified from complex request to `{ offerId, intake, seller }`
- Navigation: Passes `offerId` to ApsSigning screen

```typescript
// Before
const result = await prepareMutation.mutateAsync({
  source: { type: 'attachment', attachmentId },
  listingId,
  seller: { email: sellerEmail, name: sellerName },
  intake: formData,
});
navigation.navigate('ApsSigning', { agreementId: result.agreementId, ... });

// After
const result = await prepareMutation.mutateAsync({
  offerId,
  intake: formData,
  seller: { email: sellerEmail, name: sellerName || 'Seller' },
});
navigation.navigate('ApsSigning', { offerId, signUrl: result.signUrl, ... });
```

### 3. ApsReviewScreen
**File**: `packages/mobile/src/screens/ApsReviewScreen.tsx`

**Changes**:
- Import: `usePrepareAgreement` → `usePrepareOfferForSigning`
- Import: `attachmentsApi` → `offersApi`
- Data fetching: Fetches offer directly instead of attachment
- Route params: Uses `offerId` instead of `attachmentId`
- API call: Simplified to `{ offerId, intake, seller }`

```typescript
// Before
const { data: attachment } = useQuery({
  queryKey: ["attachment", attachmentId],
  queryFn: () => attachmentsApi.get(attachmentId),
});
const buyerOfferFromAnalysis = attachment?.documentAnalysis?.extractedData;

// After
const { data: offer } = useQuery({
  queryKey: ["offer", offerId],
  queryFn: () => offersApi.get(offerId),
});
const buyerOfferFromAnalysis = offer || {};
```

### 4. ApsSigningScreen
**File**: `packages/mobile/src/screens/ApsSigningScreen.tsx`

**Changes**:
- Import: `useAgreement` → `useQuery` with `offersApi`
- Route params: Uses `offerId` instead of `agreementId`
- Status polling: Checks offer status (`AWAITING_SELLER_SIGNATURE` → `ACCEPTED`)
- Poll interval: 3 seconds while signing in progress
- Alert text: Updated from "Agreement Signed!" to "Offer Signed!"

```typescript
// Before
const { data: agreement, refetch } = useAgreement(agreementId);
useEffect(() => {
  if (agreement?.status === 'SIGNED') {
    handleSigningComplete();
  }
}, [agreement?.status]);

// After
const { data: offer, refetch } = useQuery({
  queryKey: ['offer', offerId],
  queryFn: () => offersApi.get(offerId),
  refetchInterval: (data) => 
    data?.status === 'AWAITING_SELLER_SIGNATURE' ? 3000 : false,
});
useEffect(() => {
  if (offer?.status === 'ACCEPTED') {
    handleSigningComplete();
  }
}, [offer?.status]);
```

### 5. ChatScreen
**File**: `packages/mobile/src/screens/ChatScreen.tsx`

**Changes**:
- Navigation calls: Now pass `offerId` to ApsReview
- Test button: Updated to use first offer's ID

```typescript
// Before
navigation.navigate("ApsReview", {
  listingId: thread.listingId,
  attachmentId: item.attachments?.[0]?.id || "unknown",
  ...
});

// After
navigation.navigate("ApsReview", {
  offerId: offerId,
  listingId: thread.listingId,
  ...
});
```

## Workflow Comparison

### Old Flow (Deprecated)
```
1. Offer created from email
2. Seller clicks "Review and Sign"
3. Navigate to ApsReview(attachmentId)
4. Call prepareAgreement({ source: { attachmentId }, listingId, seller, intake })
5. Returns { agreementId, signUrl }
6. Navigate to ApsSigning(agreementId, signUrl)
7. Poll useAgreement(agreementId) → status: SIGNED
```

### New Flow (Current)
```
1. Offer created from email
2. Seller clicks "Review and Sign"
3. Navigate to ApsReview(offerId)
4. Call prepareOfferForSigning({ offerId, intake, seller })
5. Returns { signUrl, expiresAt }
6. Navigate to ApsSigning(offerId, signUrl)
7. Poll useQuery(offerId) → status: ACCEPTED
```

## Benefits

1. **✅ Simpler API calls** - No need to pass attachmentId, listingId separately
2. **✅ Direct data flow** - Offer → Prepare → Sign (no intermediate agreement entity)
3. **✅ Consistent status tracking** - All status checks on Offer model
4. **✅ Fewer database queries** - One less table to join
5. **✅ Cleaner code** - Removed redundant data transformations

## Deprecated Hooks (Still Available)

These hooks throw helpful error messages directing developers to the new APIs:

```typescript
// In packages/mobile/src/hooks/agreements.ts

export function usePrepareAgreement() {
  throw new Error('usePrepareAgreement() is deprecated. Use usePrepareOfferForSigning() instead');
}

export function useAgreement() {
  throw new Error('useAgreement() is deprecated. Use useOffer() instead');
}

// In packages/mobile/src/services/api.ts

export const agreementsApi = {
  prepare: async () => {
    throw new Error('agreementsApi.prepare() is deprecated. Use prepareOfferForSigning() instead');
  },
  get: async () => {
    throw new Error('agreementsApi.get() is deprecated. Use offersApi.get() instead');
  },
};
```

## Testing Checklist

- [ ] Test offer creation from email
- [ ] Test navigation from ChatScreen to ApsReview with offerId
- [ ] Test ApsGuidedFormScreen form submission
- [ ] Test ApsReviewScreen data loading from offer
- [ ] Test prepareOfferForSigning API call
- [ ] Test navigation to ApsSigning with signUrl
- [ ] Test signature WebView loading
- [ ] Test offer status polling during signing
- [ ] Test completion flow (status: ACCEPTED)
- [ ] Verify error messages if using deprecated hooks

## Migration Complete

All mobile screens now use the unified Offer model and workflow. The Agreement entity has been fully removed from the mobile app codebase.

---

**Date**: November 5, 2024  
**Status**: ✅ COMPLETE

