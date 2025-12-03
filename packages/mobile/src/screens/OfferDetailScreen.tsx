import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Text, Button, Chip, Surface, ActivityIndicator, Divider } from "react-native-paper";
import {
  useRoute,
  useNavigation,
  CommonActions,
} from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { offersApi, attachmentsApi } from "../services/api";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { OfferStatus, OfferConditionStatus, ApsParseResult } from "@smart-brokerage/shared";
import { Ionicons } from "@expo/vector-icons";

type OfferDetailRouteProp = RouteProp<RootStackParamList, "OfferDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Helper functions
function safeParseDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(dateValue: any): string {
  const date = safeParseDate(dateValue);
  if (!date) return "N/A";
  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getDaysUntil(dateValue: any): number | null {
  const date = safeParseDate(dateValue);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusConfig(status: OfferStatus): { 
  color: string; 
  bgColor: string; 
  label: string; 
  icon: string;
  headerBg: string;
} {
  switch (status) {
    case OfferStatus.PENDING_REVIEW:
      return { color: "#D97706", bgColor: "#FEF3C7", label: "Pending Review", icon: "time-outline", headerBg: "#F59E0B" };
    case OfferStatus.AWAITING_SELLER_SIGNATURE:
      return { color: "#2563EB", bgColor: "#DBEAFE", label: "Awaiting Your Signature", icon: "create-outline", headerBg: "#3B82F6" };
    case OfferStatus.AWAITING_BUYER_SIGNATURE:
      return { color: "#7C3AED", bgColor: "#EDE9FE", label: "Awaiting Buyer Signature", icon: "hourglass-outline", headerBg: "#8B5CF6" };
    case OfferStatus.CONDITIONALLY_ACCEPTED:
      return { color: "#059669", bgColor: "#D1FAE5", label: "Conditionally Accepted", icon: "checkmark-circle-outline", headerBg: "#10B981" };
    case OfferStatus.ACCEPTED:
      return { color: "#059669", bgColor: "#D1FAE5", label: "Accepted", icon: "checkmark-done-circle-outline", headerBg: "#059669" };
    case OfferStatus.DECLINED:
      return { color: "#DC2626", bgColor: "#FEE2E2", label: "Declined", icon: "close-circle-outline", headerBg: "#EF4444" };
    case OfferStatus.COUNTERED:
      return { color: "#EA580C", bgColor: "#FFEDD5", label: "Countered", icon: "swap-horizontal-outline", headerBg: "#F97316" };
    case OfferStatus.EXPIRED:
      return { color: "#6B7280", bgColor: "#F3F4F6", label: "Expired", icon: "timer-outline", headerBg: "#6B7280" };
    case OfferStatus.SUPERSEDED:
      return { color: "#6B7280", bgColor: "#F3F4F6", label: "Superseded", icon: "layers-outline", headerBg: "#6B7280" };
    default:
      return { color: "#6B7280", bgColor: "#F3F4F6", label: status, icon: "help-circle-outline", headerBg: "#6B7280" };
  }
}

function getConditionStatusColor(status: string): string {
  switch (status) {
    case OfferConditionStatus.COMPLETED:
      return "#10B981";
    case OfferConditionStatus.PENDING:
      return "#F59E0B";
    case OfferConditionStatus.EXPIRED:
      return "#EF4444";
    case OfferConditionStatus.WAIVED:
      return "#6B7280";
    default:
      return "#6B7280";
  }
}

function getConditionStatusLabel(status: string): string {
  switch (status) {
    case OfferConditionStatus.COMPLETED:
      return "Completed";
    case OfferConditionStatus.PENDING:
      return "Pending";
    case OfferConditionStatus.EXPIRED:
      return "Expired";
    case OfferConditionStatus.WAIVED:
      return "Waived";
    default:
      return status;
  }
}

// Helper function to extract buyer details from offer's document analysis
// Prioritizes comprehensive formFieldsExtracted data, falls back to legacy extractedData
function extractBuyerDetailsFromOffer(offer: any) {
  // Look for document analysis in the offer's messages
  const attachment = offer?.messages
    ?.flatMap((msg: any) => msg.attachments || [])
    ?.find(
      (att: any) =>
        att.documentAnalysis?.formFieldsExtracted ||
        att.documentAnalysis?.extractedData
    );

  const documentAnalysis = attachment?.documentAnalysis;

  if (!documentAnalysis) {
    return {
      buyerName: undefined,
      buyerLawyer: undefined,
      buyerLawyerEmail: undefined,
      buyerLawyerAddress: undefined,
      inclusions: undefined,
      exclusions: undefined,
      depositDue: undefined,
      possessionDate: undefined,
      rentalItems: undefined,
    };
  }

  // Try comprehensive formFieldsExtracted first (ApsParseResult from Gemini/AcroForm)
  if (documentAnalysis.formFieldsExtracted) {
    const apsData = documentAnalysis.formFieldsExtracted as ApsParseResult;

    return {
      buyerName: apsData.buyer_full_name,
      buyerLawyer: apsData.acknowledgment?.buyer?.lawyer?.name,
      buyerLawyerEmail: apsData.acknowledgment?.buyer?.lawyer?.email,
      buyerLawyerAddress: apsData.acknowledgment?.buyer?.lawyer?.address,
      inclusions: apsData.inclusions_exclusions?.chattels_included?.join(", "),
      exclusions: apsData.inclusions_exclusions?.fixtures_excluded?.join(", "),
      depositDue: apsData.price_and_deposit?.deposit?.timing,
      possessionDate: undefined, // Not in current ApsParseResult schema
      rentalItems: apsData.inclusions_exclusions?.rental_items?.join(", "),
    };
  }

  // Fallback to legacy extractedData
  if (documentAnalysis.extractedData) {
    const data = documentAnalysis.extractedData;

    return {
      buyerName: data.buyerName,
      buyerLawyer: data.buyerLawyer,
      buyerLawyerEmail: data.buyerLawyerEmail,
      buyerLawyerAddress: data.buyerLawyerAddress,
      inclusions: data.inclusions,
      exclusions: data.exclusions,
      depositDue: data.depositDue,
      possessionDate: data.possessionDate,
      rentalItems: undefined, // Not in legacy format
    };
  }

  return {
    buyerName: undefined,
    buyerLawyer: undefined,
    buyerLawyerEmail: undefined,
    buyerLawyerAddress: undefined,
    inclusions: undefined,
    exclusions: undefined,
    depositDue: undefined,
    possessionDate: undefined,
    rentalItems: undefined,
  };
}

export default function OfferDetailScreen() {
  const route = useRoute<OfferDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { offerId, listingId } = route.params;

  // Fetch offer with conditions - poll every 10 seconds
  const { data: offer, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: () => offersApi.get(offerId),
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Continue to sign mutation
  const continueToSignMutation = useMutation({
    mutationFn: async (offerId: string) => {
      return offersApi.getSignUrl(offerId);
    },
    onSuccess: (data, offerId) => {
      navigation.navigate("DropboxSign", {
        signUrl: data.signUrl,
        offerId,
        threadId: offer?.threadId,
        senderName: (offer as any)?.thread?.sender?.name,
        signingType: 'accept',
      });
    },
  });

  const offerWithThread = offer as typeof offer & {
    thread?: { 
      sender?: { name?: string; email: string; brokerage?: string };
      listingId?: string;
      listing?: { address?: string };
    };
  };

  const statusConfig = offer ? getStatusConfig(offer.status as OfferStatus) : null;
  
  const allConditions = offer?.offerConditions || [];
  const pendingConditions = allConditions.filter((c: any) => c.status === OfferConditionStatus.PENDING);
  const completedConditions = allConditions.filter((c: any) => c.status === OfferConditionStatus.COMPLETED);

  // Navigation handlers
  const handleGoToThread = () => {
    if (!offer?.threadId) return;
    const senderName = offerWithThread?.thread?.sender?.name || 
                       offerWithThread?.thread?.sender?.email || 
                       "Agent";
    navigation.navigate("Chat", {
      threadId: offer.threadId,
      senderName,
    });
  };

  const handleViewDocument = async (attachmentId: string, filename?: string) => {
    navigation.navigate("DocumentViewer", { attachmentId, filename });
  };

  const handleAcceptOffer = () => {
    if (!offer) return;
    const effectiveListingId = listingId || offerWithThread?.thread?.listingId;
    if (!effectiveListingId) {
      console.error("No listingId available for APS review");
      return;
    }

    // Extract buyer details from document analysis (same logic as ChatScreen)
    const extractedDetails = extractBuyerDetailsFromOffer(offer);

              // TODO: Get seller email/name from user context or listing
              // For now, use a valid placeholder email - ApsReviewScreen will validate it's not empty
              // In production, this should come from authenticated user context
              navigation.navigate("ApsReview", {
                offerId: offer.id,
                listingId: effectiveListingId,
                sellerEmail: "seller@example.com", // TODO: Get from user context/auth - required for signing
                sellerName: "Seller Name", // TODO: Get from user context/auth - required for signing
                buyerDetails: {
        purchasePrice: offer.price || 0,
        deposit: offer.deposit || 0,
        depositDue: extractedDetails.depositDue || "Within 24 hours of acceptance",
        closingDate: safeParseDate(offer.closingDate),
        possessionDate: safeParseDate(extractedDetails.possessionDate || offer.closingDate),
        conditions: offer.conditions || "None",
        inclusions: extractedDetails.inclusions || "Not specified",
        buyerName: extractedDetails.buyerName || "Not specified",
        buyerLawyer: extractedDetails.buyerLawyer || "Not specified",
      },
    });
  };

  const handleDeclineOffer = () => {
    if (!offer) return;
    navigation.navigate("OfferAction", { offerId: offer.id, action: "decline" });
  };

  const handleCounterOffer = () => {
    if (!offer) return;
    navigation.navigate("OfferAction", { offerId: offer.id, action: "counter" });
  };

  const handleContinueToSign = () => {
    if (!offer) return;
    continueToSignMutation.mutate(offer.id);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading offer details...</Text>
      </View>
    );
  }

  if (!offer || !statusConfig) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Offer not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  const isPending = offer.status === OfferStatus.PENDING_REVIEW;
  const isAwaitingSignature = offer.status === OfferStatus.AWAITING_SELLER_SIGNATURE;
  const isConditionallyAccepted = offer.status === OfferStatus.CONDITIONALLY_ACCEPTED;
  const isAccepted = offer.status === OfferStatus.ACCEPTED;
  const isDeclined = offer.status === OfferStatus.DECLINED;
  const canTakeAction = isPending || isAwaitingSignature;

  return (
    <View style={styles.container}>
      {/* Status Header */}
      <View style={[styles.statusHeader, { backgroundColor: statusConfig.headerBg }]}>
        <View style={styles.statusIconContainer}>
          <Ionicons name={statusConfig.icon as any} size={32} color="#fff" />
        </View>
        <Text style={styles.statusTitle}>{statusConfig.label}</Text>
        {offer.updatedAt && (
          <Text style={styles.statusSubtitle}>
            Last updated: {formatDate(offer.updatedAt)}
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Buyer Agent Info */}
        <Surface style={styles.card} elevation={2}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color="#6B7280" />
            <Text style={styles.cardTitle}>Buyer's Agent</Text>
          </View>
          <View style={styles.agentInfo}>
            <Text style={styles.agentName}>
              {offerWithThread?.thread?.sender?.name || "Unknown Agent"}
            </Text>
            <Text style={styles.agentEmail}>
              {offerWithThread?.thread?.sender?.email}
            </Text>
            {offerWithThread?.thread?.sender?.brokerage && (
              <Text style={styles.agentBrokerage}>
                {offerWithThread.thread.sender.brokerage}
              </Text>
            )}
          </View>
        </Surface>

        {/* Offer Summary */}
        <Surface style={styles.card} elevation={2}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={20} color="#6B7280" />
            <Text style={styles.cardTitle}>Offer Details</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Purchase Price</Text>
              <Text style={styles.summaryValueLarge}>{formatCurrency(offer.price)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Closing Date</Text>
              <Text style={styles.summaryValue}>{formatDate(offer.closingDate)}</Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Deposit</Text>
              <Text style={styles.detailValue}>{formatCurrency(offer.deposit)}</Text>
            </View>
            {offer.expiryDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expiry Date</Text>
                <Text style={[
                  styles.detailValue,
                  getDaysUntil(offer.expiryDate)! < 0 && styles.expiredText
                ]}>
                  {formatDate(offer.expiryDate)}
                </Text>
              </View>
            )}
            {offer.createdAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Received</Text>
                <Text style={styles.detailValue}>{formatDate(offer.createdAt)}</Text>
              </View>
            )}
          </View>
        </Surface>

        {/* Conditions Section */}
        {allConditions.length > 0 && (
          <Surface style={styles.card} elevation={2}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.cardTitle}>Conditions</Text>
              <Chip
                style={[
                  styles.conditionCountChip,
                  { backgroundColor: pendingConditions.length > 0 ? "#FEF3C7" : "#D1FAE5" }
                ]}
                textStyle={[
                  styles.conditionCountText,
                  { color: pendingConditions.length > 0 ? "#D97706" : "#059669" }
                ]}
              >
                {completedConditions.length}/{allConditions.length} Complete
              </Chip>
            </View>

            {allConditions.map((condition: any, index: number) => {
              const daysUntil = getDaysUntil(condition.dueDate);
              const isUrgent = daysUntil !== null && daysUntil <= 3 && daysUntil >= 0;
              const isOverdue = daysUntil !== null && daysUntil < 0;
              const isComplete = condition.status === OfferConditionStatus.COMPLETED;

              return (
                <View
                  key={condition.id}
                  style={[
                    styles.conditionCard,
                    isComplete && styles.conditionCardComplete
                  ]}
                >
                  <View style={styles.conditionHeader}>
                    <View style={styles.conditionHeaderLeft}>
                      <View style={[
                        styles.conditionNumberContainer,
                        isComplete && styles.conditionNumberComplete
                      ]}>
                        {isComplete ? (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        ) : (
                          <Text style={styles.conditionNumber}>{index + 1}</Text>
                        )}
                      </View>
                      <Chip
                        style={[
                          styles.statusChip,
                          { backgroundColor: getConditionStatusColor(condition.status) + "20" }
                        ]}
                        textStyle={[
                          styles.statusChipText,
                          { color: getConditionStatusColor(condition.status) }
                        ]}
                      >
                        {getConditionStatusLabel(condition.status)}
                      </Chip>
                    </View>
                  </View>

                  <Text style={[
                    styles.conditionDescription,
                    isComplete && styles.conditionDescriptionComplete
                  ]}>
                    {condition.description}
                  </Text>

                  {condition.dueDate && !isComplete && (
                    <View style={styles.dueDateWrapper}>
                      <View style={[
                        styles.dueDatePill,
                        isOverdue ? styles.dueDatePillOverdue :
                        isUrgent ? styles.dueDatePillUrgent :
                        styles.dueDatePillNormal
                      ]}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={isOverdue ? "#B91C1C" : isUrgent ? "#B45309" : "#4B5563"}
                        />
                        <Text style={[
                          styles.dueDateText,
                          isOverdue ? styles.dueDateTextOverdue :
                          isUrgent ? styles.dueDateTextUrgent :
                          styles.dueDateTextNormal
                        ]}>
                          {isOverdue
                            ? `Overdue by ${Math.abs(daysUntil!)} day${Math.abs(daysUntil!) === 1 ? "" : "s"}`
                            : daysUntil === 0
                            ? "Due Today"
                            : daysUntil === 1
                            ? "Due Tomorrow"
                            : `Due in ${daysUntil} days`}
                        </Text>
                      </View>
                      <Text style={styles.dueDateDate}>{formatDate(condition.dueDate)}</Text>
                    </View>
                  )}

                  {condition.completedAt && isComplete && (
                    <View style={styles.completedAtRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#059669" />
                      <Text style={styles.completedAtText}>
                        Completed on {formatDate(condition.completedAt)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </Surface>
        )}

        {/* Documents Section */}
        <Surface style={styles.card} elevation={2}>
          <View style={styles.cardHeader}>
            <Ionicons name="folder-outline" size={20} color="#6B7280" />
            <Text style={styles.cardTitle}>Documents</Text>
          </View>

          {offer.originalDocumentS3Key && (
            <TouchableOpacity
              style={styles.documentRow}
              onPress={() => {
                // Find attachment ID from offer messages
                const attachment = (offer as any).messages?.[0]?.attachments?.[0];
                if (attachment) {
                  handleViewDocument(attachment.id, "Original Offer");
                }
              }}
            >
              <View style={styles.documentInfo}>
                <Ionicons name="document-outline" size={24} color="#3B82F6" />
                <View>
                  <Text style={styles.documentName}>Original Offer</Text>
                  <Text style={styles.documentMeta}>APS Form</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {offer.signedDocumentS3Key && (
            <TouchableOpacity style={styles.documentRow}>
              <View style={styles.documentInfo}>
                <Ionicons name="document-attach-outline" size={24} color="#059669" />
                <View>
                  <Text style={styles.documentName}>Signed Agreement</Text>
                  <Text style={styles.documentMeta}>Executed copy</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {offer.counterOfferDocumentS3Key && (
            <TouchableOpacity style={styles.documentRow}>
              <View style={styles.documentInfo}>
                <Ionicons name="swap-horizontal-outline" size={24} color="#F97316" />
                <View>
                  <Text style={styles.documentName}>Counter-Offer</Text>
                  <Text style={styles.documentMeta}>Your counter-offer</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {!offer.originalDocumentS3Key && !offer.signedDocumentS3Key && !offer.counterOfferDocumentS3Key && (
            <View style={styles.noDocuments}>
              <Ionicons name="document-outline" size={32} color="#D1D5DB" />
              <Text style={styles.noDocumentsText}>No documents available</Text>
            </View>
          )}
        </Surface>

        {/* Decline Reason (if declined) */}
        {isDeclined && offer.declineReason && (
          <Surface style={[styles.card, styles.declinedCard]} elevation={2}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle-outline" size={20} color="#DC2626" />
              <Text style={[styles.cardTitle, { color: "#DC2626" }]}>Decline Reason</Text>
            </View>
            <Text style={styles.declineReasonText}>{offer.declineReason}</Text>
          </Surface>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Bottom Actions */}
      <Surface style={styles.bottomActions} elevation={4}>
        {canTakeAction && (
          <>
            {isPending && (
              <>
                <Button
                  mode="contained"
                  onPress={handleAcceptOffer}
                  style={styles.primaryButton}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  icon="check"
                  buttonColor="#059669"
                >
                  Review & Accept
                </Button>
                <View style={styles.secondaryButtonsRow}>
                  <Button
                    mode="outlined"
                    onPress={handleCounterOffer}
                    style={styles.halfButton}
                    contentStyle={styles.smallButtonContent}
                  >
                    Counter
                  </Button>
                  <Button
                    mode="text"
                    onPress={handleDeclineOffer}
                    style={styles.halfButton}
                    contentStyle={styles.smallButtonContent}
                    textColor="#DC2626"
                  >
                    Decline
                  </Button>
                </View>
              </>
            )}

            {isAwaitingSignature && (
              <>
                <Button
                  mode="contained"
                  onPress={handleContinueToSign}
                  style={styles.primaryButton}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  icon="draw"
                  buttonColor="#3B82F6"
                  loading={continueToSignMutation.isPending}
                >
                  Continue to Sign
                </Button>
                <View style={styles.secondaryButtonsRow}>
                  <Button
                    mode="outlined"
                    onPress={handleCounterOffer}
                    style={styles.halfButton}
                    contentStyle={styles.smallButtonContent}
                  >
                    Counter Instead
                  </Button>
                  <Button
                    mode="text"
                    onPress={handleDeclineOffer}
                    style={styles.halfButton}
                    contentStyle={styles.smallButtonContent}
                    textColor="#DC2626"
                  >
                    Cancel
                  </Button>
                </View>
              </>
            )}
          </>
        )}

        {(isConditionallyAccepted || isAccepted) && (
          <Button
            mode="contained"
            onPress={handleGoToThread}
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            icon="message-text"
            buttonColor="#059669"
          >
            Go to Messages
          </Button>
        )}

        {!canTakeAction && !isConditionallyAccepted && !isAccepted && (
          <Button
            mode="outlined"
            onPress={handleGoToThread}
            style={styles.secondaryButton}
            contentStyle={styles.buttonContent}
          >
            View Messages
          </Button>
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    color: "#374151",
    fontWeight: "600",
  },
  statusHeader: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  statusIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  content: {
    flex: 1,
    marginTop: -16,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 140,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  agentInfo: {
    gap: 4,
  },
  agentName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  agentEmail: {
    fontSize: 14,
    color: "#6B7280",
  },
  agentBrokerage: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  summaryValueLarge: {
    fontSize: 24,
    fontWeight: "800",
    color: "#059669",
  },
  divider: {
    marginVertical: 16,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  expiredText: {
    color: "#DC2626",
  },
  conditionCountChip: {
    height: 24,
    borderRadius: 12,
  },
  conditionCountText: {
    fontSize: 11,
    fontWeight: "600",
  },
  conditionCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  conditionCardComplete: {
    backgroundColor: "#F0FDF4",
    borderColor: "#D1FAE5",
  },
  conditionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  conditionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  conditionNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  conditionNumberComplete: {
    backgroundColor: "#059669",
  },
  conditionNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  statusChip: {
    height: 22,
    borderRadius: 11,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "600",
  },
  conditionDescription: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  conditionDescriptionComplete: {
    color: "#6B7280",
  },
  dueDateWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  dueDatePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dueDatePillNormal: {
    backgroundColor: "#F3F4F6",
  },
  dueDatePillUrgent: {
    backgroundColor: "#FFF7ED",
  },
  dueDatePillOverdue: {
    backgroundColor: "#FEF2F2",
  },
  dueDateText: {
    fontSize: 12,
    fontWeight: "500",
  },
  dueDateTextNormal: {
    color: "#4B5563",
  },
  dueDateTextUrgent: {
    color: "#B45309",
  },
  dueDateTextOverdue: {
    color: "#B91C1C",
  },
  dueDateDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  completedAtRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#D1FAE5",
  },
  completedAtText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  documentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  documentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  documentMeta: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  noDocuments: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  noDocumentsText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  declinedCard: {
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  declineReasonText: {
    fontSize: 14,
    color: "#7F1D1D",
    fontStyle: "italic",
    lineHeight: 20,
  },
  spacer: {
    height: 20,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  primaryButton: {
    marginBottom: 8,
    borderRadius: 12,
  },
  secondaryButton: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  halfButton: {
    flex: 1,
  },
  smallButtonContent: {
    paddingVertical: 2,
  },
});

