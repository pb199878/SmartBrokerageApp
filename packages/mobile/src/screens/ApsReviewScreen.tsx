import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Text, Card, Button, Divider } from "react-native-paper";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp, NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { usePrepareOfferForSigning } from "../hooks/agreements";
import { getFieldGuidance } from "@smart-brokerage/shared";
import { useQuery } from "@tanstack/react-query";
import { listingsApi, offersApi } from "../services/api";

type ApsReviewRouteProp = RouteProp<RootStackParamList, "ApsReview">;
type NavigationProps = NavigationProp<RootStackParamList>;

export default function ApsReviewScreen() {
  const route = useRoute<ApsReviewRouteProp>();
  const navigation = useNavigation<NavigationProps>();
  const {
    offerId,
    listingId,
    sellerEmail,
    sellerName,
    // Buyer's offer details (would come from the actual offer/attachment)
    buyerDetails,
  } = route.params;

  const prepareMutation = usePrepareOfferForSigning();

  // Fetch listing data to get seller/lawyer info
  const { data: listing, isLoading: listingLoading } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => listingsApi.getById(listingId),
    enabled: !!listingId,
  });

  // Fetch offer to get buyer's offer details
  const { data: offer, isLoading: offerLoading } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: () => offersApi.get(offerId),
    enabled: !!offerId,
  });

  const isLoading = listingLoading || offerLoading;

  // Extract buyer's offer from the offer data (already extracted during offer creation)
  const buyerOfferFromAnalysis = offer || {};

  // Use real extracted data from APS parser, with fallback to provided buyerDetails or defaults
  const buyerOffer = {
    purchasePrice:
      buyerOfferFromAnalysis?.purchasePrice ||
      buyerOfferFromAnalysis?.price ||
      buyerDetails?.purchasePrice ||
      0,
    deposit: buyerOfferFromAnalysis?.deposit || buyerDetails?.deposit || 0,
    depositDue:
      buyerOfferFromAnalysis?.depositDue ||
      buyerDetails?.depositDue ||
      "Upon Acceptance",
    closingDate: buyerOfferFromAnalysis?.closingDate
      ? new Date(buyerOfferFromAnalysis.closingDate)
      : buyerDetails?.closingDate
      ? new Date(buyerDetails.closingDate)
      : new Date(),
    possessionDate: buyerOfferFromAnalysis?.possessionDate
      ? new Date(buyerOfferFromAnalysis.possessionDate)
      : buyerOfferFromAnalysis?.closingDate
      ? new Date(buyerOfferFromAnalysis.closingDate)
      : buyerDetails?.possessionDate
      ? new Date(buyerDetails.possessionDate)
      : new Date(),
    conditions: Array.isArray(buyerOfferFromAnalysis?.conditions)
      ? buyerOfferFromAnalysis.conditions.join(", ")
      : buyerOfferFromAnalysis?.conditions ||
        buyerDetails?.conditions ||
        "None",
    inclusions:
      buyerOfferFromAnalysis?.inclusions ||
      buyerDetails?.inclusions ||
      "Not specified",
    buyerName:
      buyerOfferFromAnalysis?.buyerName ||
      buyerDetails?.buyerName ||
      "Not specified",
    buyerLawyer:
      buyerOfferFromAnalysis?.buyerLawyer ||
      buyerDetails?.buyerLawyer ||
      "Not specified",
  };

  // For backward compatibility, also keep mockBuyerOffer reference
  const mockBuyerOffer = buyerOffer;

  // Use real listing data or fallback to mock data
  const sellerData = {
    sellerLegalName: sellerName || listing?.sellerName || "Test Seller",
    sellerAddress: listing?.sellerAddress || "456 Oak Ave, Toronto, ON M4K 1B2",
    sellerPhone: listing?.sellerPhone || "416-555-0100",
    sellerEmail: sellerEmail || listing?.sellerEmail || "",
    lawyerName: listing?.lawyerName || "Sarah Williams",
    lawyerFirm: listing?.lawyerFirm || "Williams & Associates",
    lawyerAddress:
      listing?.lawyerAddress ||
      "789 Bay Street, Suite 1200, Toronto, ON M5G 2N6",
    lawyerPhone: listing?.lawyerPhone || "416-555-0200",
    lawyerEmail: listing?.lawyerEmail || "swilliams@wlawfirm.com",
    exclusions: listing?.exclusions || "", // Seller can add these
    rentalItems:
      listing?.rentalItems ||
      "Hot water tank - $25/month (rental from AquaHeat Inc.)",
  };

  const handleProceedToSign = async () => {
    try {
      const result = await prepareMutation.mutateAsync({
        offerId,
        intake: sellerData,
        seller: {
          email: sellerEmail,
          name: sellerName || "Seller",
        },
      });

      // Navigate to signing screen
      navigation.navigate("ApsSigning", {
        offerId,
        signUrl: result.signUrl,
        listingId,
      });
    } catch (error: any) {
      console.error("Error preparing offer for signing:", error);

      // Show the actual error message to help with debugging
      const errorMessage =
        error?.message || error?.toString() || "Unknown error occurred";
      Alert.alert("Error Preparing Offer for Signing", errorMessage, [
        { text: "OK" },
      ]);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderReadOnlyField = (
    fieldName: string,
    value: string,
    isBuyerField: boolean = false
  ) => {
    const guidance = getFieldGuidance(fieldName);
    const title = guidance?.title || fieldName;
    const description = guidance?.description || "";
    const tips = guidance?.tips || [];

    return (
      <View style={styles.fieldContainer}>
        <Text variant="labelLarge">{title}</Text>
        <Text variant="bodySmall" style={styles.description}>
          {description}
        </Text>

        <View style={[styles.readOnlyField, isBuyerField && styles.buyerField]}>
          <Text variant="bodyMedium" style={styles.readOnlyText}>
            {value || "Not specified"}
          </Text>
        </View>

        {tips && tips.length > 0 && (
          <View style={styles.tipsContainer}>
            <Text variant="bodySmall" style={styles.tipsTitle}>
              💡 {isBuyerField ? "What this means:" : "Note:"}
            </Text>
            {tips.map((tip, idx) => (
              <Text key={idx} variant="bodySmall" style={styles.tip}>
                • {tip}
              </Text>
            ))}
          </View>
        )}

        <Divider style={styles.fieldDivider} />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading agreement details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text variant="titleLarge">
              Review Agreement of Purchase and Sale
            </Text>
            <Text variant="bodyMedium" style={styles.headerSubtext}>
              Review all details below. The buyer has filled out their offer
              terms, and your information is prefilled from your listing.
            </Text>
          </Card.Content>
        </Card>

        {/* Buyer's Offer Details */}
        <Card style={styles.sectionCard}>
          <Card.Title title="Buyer's Offer" titleVariant="titleMedium" />
          <Card.Content>
            {renderReadOnlyField(
              "purchasePrice",
              formatCurrency(mockBuyerOffer.purchasePrice),
              true
            )}
            {renderReadOnlyField(
              "depositAmount",
              formatCurrency(mockBuyerOffer.deposit),
              true
            )}
            {renderReadOnlyField("depositDue", mockBuyerOffer.depositDue, true)}
            {renderReadOnlyField(
              "closingDate",
              formatDate(mockBuyerOffer.closingDate),
              true
            )}
            {renderReadOnlyField(
              "possessionDate",
              formatDate(mockBuyerOffer.possessionDate),
              true
            )}
            {renderReadOnlyField("conditions", mockBuyerOffer.conditions, true)}
            {renderReadOnlyField("buyerName", mockBuyerOffer.buyerName, true)}
            {renderReadOnlyField(
              "buyerLawyer",
              mockBuyerOffer.buyerLawyer,
              true
            )}
          </Card.Content>
        </Card>

        {/* Inclusions */}
        <Card style={styles.sectionCard}>
          <Card.Title title="What's Included" titleVariant="titleMedium" />
          <Card.Content>
            {renderReadOnlyField("inclusions", mockBuyerOffer.inclusions, true)}
            {renderReadOnlyField(
              "exclusions",
              sellerData.exclusions || "None",
              false
            )}
            {renderReadOnlyField("rentalItems", sellerData.rentalItems, false)}
          </Card.Content>
        </Card>

        {/* Seller Information */}
        <Card style={styles.sectionCard}>
          <Card.Title title="Your Information" titleVariant="titleMedium" />
          <Card.Content>
            <Text variant="bodySmall" style={styles.prefilledNote}>
              ℹ️ Prefilled from your listing
            </Text>
            {renderReadOnlyField(
              "sellerLegalName",
              sellerData.sellerLegalName,
              false
            )}
            {renderReadOnlyField(
              "sellerAddress",
              sellerData.sellerAddress,
              false
            )}
            {renderReadOnlyField("sellerPhone", sellerData.sellerPhone, false)}
            {renderReadOnlyField(
              "sellerEmail",
              sellerData.sellerEmail || "",
              false
            )}
          </Card.Content>
        </Card>

        {/* Lawyer Information */}
        <Card style={styles.sectionCard}>
          <Card.Title title="Your Lawyer" titleVariant="titleMedium" />
          <Card.Content>
            <Text variant="bodySmall" style={styles.prefilledNote}>
              ℹ️ Prefilled from your listing
            </Text>
            {renderReadOnlyField("lawyerName", sellerData.lawyerName, false)}
            {renderReadOnlyField("lawyerFirm", sellerData.lawyerFirm, false)}
            {renderReadOnlyField(
              "lawyerAddress",
              sellerData.lawyerAddress,
              false
            )}
            {renderReadOnlyField("lawyerPhone", sellerData.lawyerPhone, false)}
            {renderReadOnlyField("lawyerEmail", sellerData.lawyerEmail, false)}
          </Card.Content>
        </Card>

        {/* Next Steps */}
        <Card style={styles.nextStepsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.nextStepsTitle}>
              📋 Next Steps
            </Text>
            <Text variant="bodyMedium" style={styles.nextStepsText}>
              1. Review all details above carefully
            </Text>
            <Text variant="bodyMedium" style={styles.nextStepsText}>
              2. Tap "Proceed to Sign" below
            </Text>
            <Text variant="bodyMedium" style={styles.nextStepsText}>
              3. Initial each page and sign the final page
            </Text>
            <Text variant="bodyMedium" style={styles.nextStepsText}>
              4. Your signed APS will be sent to the buyer
            </Text>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            Go Back
          </Button>
          <Button
            mode="contained"
            onPress={handleProceedToSign}
            loading={prepareMutation.isPending}
            disabled={prepareMutation.isPending}
            style={styles.signButton}
            icon="draw"
          >
            Proceed to Sign
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: "#e3f2fd",
  },
  headerSubtext: {
    marginTop: 8,
    color: "#666",
  },
  sectionCard: {
    margin: 16,
    marginTop: 8,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  description: {
    marginTop: 4,
    marginBottom: 8,
    color: "#666",
  },
  readOnlyField: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  buyerField: {
    backgroundColor: "#e8f5e9",
    borderColor: "#c8e6c9",
  },
  readOnlyText: {
    color: "#333",
  },
  tipsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
  },
  tipsTitle: {
    fontWeight: "600",
    marginBottom: 4,
    color: "#1976d2",
  },
  tip: {
    marginTop: 2,
    color: "#1565c0",
  },
  fieldDivider: {
    marginTop: 12,
  },
  prefilledNote: {
    marginBottom: 12,
    color: "#1976d2",
    fontStyle: "italic",
  },
  nextStepsCard: {
    margin: 16,
    marginTop: 8,
    backgroundColor: "#fff3e0",
  },
  nextStepsTitle: {
    marginBottom: 12,
    fontWeight: "600",
  },
  nextStepsText: {
    marginBottom: 6,
    color: "#666",
  },
  buttonContainer: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  signButton: {
    flex: 2,
    paddingVertical: 4,
  },
});
