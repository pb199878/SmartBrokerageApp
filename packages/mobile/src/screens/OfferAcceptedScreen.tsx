import React from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import { Text, Button, Card, Chip, Surface } from "react-native-paper";
import {
  useRoute,
  useNavigation,
  CommonActions,
} from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { offersApi } from "../services/api";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { OfferConditionStatus } from "@smart-brokerage/shared";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type OfferAcceptedRouteProp = RouteProp<RootStackParamList, "OfferAccepted">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get("window");

// Helper function to safely parse dates
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
  const diff = Math.ceil(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff;
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

export default function OfferAcceptedScreen() {
  const route = useRoute<OfferAcceptedRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const {
    offerId,
    threadId: passedThreadId,
    senderName: passedSenderName,
  } = route.params;

  // Fetch offer with conditions
  const { data: offer, isLoading } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: () => offersApi.get(offerId),
  });

  // Use passed values or fallback to offer data
  const offerWithThread = offer as typeof offer & {
    thread?: { sender?: { name?: string; email: string } };
  };
  const effectiveThreadId = passedThreadId || offer?.threadId;
  const effectiveSenderName =
    passedSenderName ||
    offerWithThread?.thread?.sender?.name ||
    offerWithThread?.thread?.sender?.email ||
    "Agent";

  const pendingConditions =
    offer?.offerConditions?.filter(
      (c: any) => c.status === OfferConditionStatus.PENDING
    ) || [];

  const handleGoToThread = () => {
    if (!effectiveThreadId) {
      // If we still don't have threadId, just go to listings
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Listings" }],
        })
      );
      return;
    }

    // Reset navigation stack and go to the chat screen
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: "Listings" },
          {
            name: "Chat",
            params: {
              threadId: effectiveThreadId,
              senderName: effectiveSenderName,
            },
          },
        ],
      })
    );
  };

  const handleGoToListings = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Listings" }],
      })
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading offer details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerGradient}>
        <View style={styles.successIconContainer}>
          <View style={styles.successIconOuter}>
            <View style={styles.successIconInner}>
              <Ionicons name="checkmark" size={48} color="#10B981" />
            </View>
          </View>
        </View>
        <Text style={styles.headerTitle}>Offer Accepted!</Text>
        <Text style={styles.headerSubtitle}>
          Congratulations! Your signature has been submitted successfully.
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Offer Summary Card */}
        <Surface style={styles.summaryCard} elevation={2}>
          <Text style={styles.sectionTitle}>Offer Summary</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="cash-outline" size={28} color="#059669" />
              <Text style={styles.summaryLabel}>Purchase Price</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(offer?.price)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-outline" size={28} color="#059669" />
              <Text style={styles.summaryLabel}>Closing Date</Text>
              <Text style={styles.summaryValue}>
                {formatDate(offer?.closingDate)}
              </Text>
            </View>
          </View>

          {offer?.deposit && (
            <View style={styles.depositRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color="#6B7280"
              />
              <Text style={styles.depositText}>
                Deposit: {formatCurrency(offer.deposit)}
              </Text>
            </View>
          )}
        </Surface>

        {/* Conditions Section */}
        {pendingConditions.length > 0 && (
          <Surface style={styles.conditionsSectionCard} elevation={2}>
            <View style={styles.conditionsHeader}>
              <Ionicons name="list-circle-outline" size={24} color="#F59E0B" />
              <Text style={styles.conditionsTitle}>Pending Conditions</Text>
              <Chip
                style={styles.conditionCountChip}
                textStyle={styles.conditionCountText}
              >
                {pendingConditions.length}
              </Chip>
            </View>
            <Text style={styles.conditionsSubtitle}>
              These conditions must be fulfilled before the deal closes
            </Text>

            {pendingConditions.map((condition: any, index: number) => {
              const daysUntil = getDaysUntil(condition.dueDate);
              const isUrgent = daysUntil !== null && daysUntil <= 3;
              const isOverdue = daysUntil !== null && daysUntil < 0;

              return (
                <View
                  key={condition.id}
                  style={[
                    styles.conditionCard,
                    // Remove colored borders, use shadow and subtle bg instead
                    styles.conditionCardBase,
                  ]}
                >
                  <View style={styles.conditionContent}>
                    <View style={styles.conditionHeader}>
                      <View style={styles.conditionHeaderLeft}>
                        <View style={styles.conditionNumberContainer}>
                          <Text style={styles.conditionNumber}>
                            {index + 1}
                          </Text>
                        </View>
                        <Chip
                          style={[
                            styles.statusChip,
                            {
                              backgroundColor:
                                getConditionStatusColor(condition.status) +
                                "15", // More transparent
                            },
                          ]}
                          textStyle={[
                            styles.statusChipText,
                            {
                              color: getConditionStatusColor(condition.status),
                            },
                          ]}
                        >
                          {getConditionStatusLabel(condition.status)}
                        </Chip>
                      </View>
                    </View>

                    <Text style={styles.conditionDescription}>
                      {condition.description}
                    </Text>

                    {condition.dueDate && (
                      <View style={styles.dueDateWrapper}>
                        <View
                          style={[
                            styles.dueDatePill,
                            isOverdue
                              ? styles.dueDatePillOverdue
                              : isUrgent
                              ? styles.dueDatePillUrgent
                              : styles.dueDatePillNormal,
                          ]}
                        >
                          <Ionicons
                            name="time-outline"
                            size={16}
                            color={
                              isOverdue
                                ? "#B91C1C"
                                : isUrgent
                                ? "#B45309"
                                : "#4B5563"
                            }
                          />
                          <Text
                            style={[
                              styles.dueDateText,
                              isOverdue
                                ? styles.dueDateTextOverdue
                                : isUrgent
                                ? styles.dueDateTextUrgent
                                : styles.dueDateTextNormal,
                            ]}
                          >
                            {isOverdue
                              ? `Overdue by ${Math.abs(daysUntil!)} day${
                                  Math.abs(daysUntil!) === 1 ? "" : "s"
                                }`
                              : daysUntil === 0
                              ? "Due Today"
                              : daysUntil === 1
                              ? "Due Tomorrow"
                              : `Due in ${daysUntil} days`}
                          </Text>
                        </View>
                        <Text style={styles.dueDateDate}>
                          {formatDate(condition.dueDate)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </Surface>
        )}

        {/* No Conditions Message */}
        {pendingConditions.length === 0 && (
          <Surface style={styles.noConditionsCard} elevation={1}>
            <Ionicons name="checkmark-done-circle" size={48} color="#10B981" />
            <Text style={styles.noConditionsTitle}>No Pending Conditions</Text>
            <Text style={styles.noConditionsText}>
              This offer has no outstanding conditions. The deal will proceed
              directly to closing.
            </Text>
          </Surface>
        )}

        {/* What's Next Section */}
        <Surface style={styles.nextStepsCard} elevation={1}>
          <Text style={styles.nextStepsTitle}>What Happens Next?</Text>
          <View style={styles.nextStep}>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Document Delivery</Text>
              <Text style={styles.stepDescription}>
                The signed agreement will be sent to the buyer's agent shortly.
              </Text>
            </View>
          </View>
          <View style={styles.nextStep}>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Buyer Counter-Signature</Text>
              <Text style={styles.stepDescription}>
                The buyer will review and counter-sign the agreement.
              </Text>
            </View>
          </View>
          {pendingConditions.length > 0 && (
            <View style={styles.nextStep}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepNumber}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Fulfill Conditions</Text>
                <Text style={styles.stepDescription}>
                  Work with the buyer to complete all pending conditions by
                  their due dates.
                </Text>
              </View>
            </View>
          )}
        </Surface>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Bottom Actions */}
      <Surface style={styles.bottomActions} elevation={4}>
        <Button
          mode="contained"
          onPress={handleGoToThread}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          icon="message-text"
        >
          Back to Messages
        </Button>
        <Button
          mode="outlined"
          onPress={handleGoToListings}
          style={styles.secondaryButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.secondaryButtonLabel}
        >
          View All Listings
        </Button>
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
    color: "#6B7280",
    fontSize: 16,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "#059669",
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successIconOuter: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 60,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  successIconInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 44,
    width: 88,
    height: 88,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
    textShadowColor: "rgba(0, 0, 0, 0.15)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.95)",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    marginTop: -24,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  summaryDivider: {
    width: 1,
    height: 80,
    backgroundColor: "#E5E7EB",
    marginTop: 8,
    display: "none",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "500",
    textAlign: "center",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#059669",
    textAlign: "center",
  },
  depositRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
    marginHorizontal: -24,
    marginBottom: -24,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  depositText: {
    fontSize: 15,
    color: "#374151",
    marginLeft: 8,
    fontWeight: "600",
  },
  conditionsSectionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  conditionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  conditionsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    letterSpacing: -0.3,
  },
  conditionCountChip: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    height: 28,
  },
  conditionCountText: {
    color: "#D97706",
    fontWeight: "700",
    fontSize: 13,
  },
  conditionsSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    marginLeft: 34,
    lineHeight: 20,
  },
  conditionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  conditionCardBase: {
    // Base style for condition cards
  },
  conditionContent: {
    padding: 16,
  },
  conditionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  conditionDescription: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 4,
  },
  conditionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  conditionNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  conditionNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },
  statusChip: {
    height: 24,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
    marginVertical: -2, // Tweak vertical alignment inside chip
  },
  dueDateWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  dueDatePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
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
    fontSize: 13,
    fontWeight: "600",
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
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  noConditionsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  noConditionsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#10B981",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  noConditionsText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  nextStepsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  nextStepsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  nextStep: {
    flexDirection: "row",
    marginBottom: 20,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#059669",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  stepDescription: {
    fontSize: 14,
    color: "#6B7280",
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
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  primaryButton: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    borderRadius: 14,
    borderColor: "#D1D5DB",
    borderWidth: 1.5,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "600",
  },
});
