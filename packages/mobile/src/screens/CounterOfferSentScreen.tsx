import React from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import { Text, Button, Surface } from "react-native-paper";
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
import { Ionicons } from "@expo/vector-icons";

type CounterOfferSentRouteProp = RouteProp<RootStackParamList, "CounterOfferSent">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get("window");

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateValue: any): string {
  if (!dateValue) return "N/A";
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CounterOfferSentScreen() {
  const route = useRoute<CounterOfferSentRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const {
    offerId,
    threadId: passedThreadId,
    senderName: passedSenderName,
  } = route.params;

  // Fetch offer details
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

  const handleGoToThread = () => {
    if (!effectiveThreadId) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Listings" }],
        })
      );
      return;
    }

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
        <Text style={styles.loadingText}>Loading counter-offer details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerGradient}>
        <View style={styles.successIconContainer}>
          <View style={styles.successIconOuter}>
            <View style={styles.successIconInner}>
              <Ionicons name="paper-plane" size={44} color="#3B82F6" />
            </View>
          </View>
        </View>
        <Text style={styles.headerTitle}>Counter-Offer Sent!</Text>
        <Text style={styles.headerSubtitle}>
          Your counter-offer has been signed and sent to the buyer's agent.
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Counter-Offer Summary Card */}
        <Surface style={styles.summaryCard} elevation={2}>
          <Text style={styles.sectionTitle}>Counter-Offer Summary</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="cash-outline" size={28} color="#3B82F6" />
              <Text style={styles.summaryLabel}>Counter Price</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(offer?.price)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-outline" size={28} color="#3B82F6" />
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

        {/* Recipient Info */}
        <Surface style={styles.recipientCard} elevation={1}>
          <View style={styles.recipientHeader}>
            <Ionicons name="person-circle-outline" size={24} color="#6B7280" />
            <Text style={styles.recipientTitle}>Sent To</Text>
          </View>
          <Text style={styles.recipientName}>{effectiveSenderName}</Text>
          <Text style={styles.recipientSubtext}>Buyer's Agent</Text>
        </Surface>

        {/* What's Next Section */}
        <Surface style={styles.nextStepsCard} elevation={1}>
          <Text style={styles.nextStepsTitle}>What Happens Next?</Text>
          
          <View style={styles.nextStep}>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Agent Review</Text>
              <Text style={styles.stepDescription}>
                The buyer's agent will receive and review your counter-offer.
              </Text>
            </View>
          </View>
          
          <View style={styles.nextStep}>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Buyer Decision</Text>
              <Text style={styles.stepDescription}>
                The buyer will accept, decline, or send another counter-offer.
              </Text>
            </View>
          </View>
          
          <View style={styles.nextStep}>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Notification</Text>
              <Text style={styles.stepDescription}>
                You'll be notified of their response via email and in the app.
              </Text>
            </View>
          </View>
        </Surface>

        {/* Info Banner */}
        <Surface style={styles.infoBanner} elevation={1}>
          <Ionicons name="time-outline" size={24} color="#F59E0B" />
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>Awaiting Response</Text>
            <Text style={styles.infoBannerText}>
              The negotiation is in progress. You'll be notified when the buyer responds to your counter-offer.
            </Text>
          </View>
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
    backgroundColor: "#3B82F6",
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
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
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
    color: "#3B82F6",
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
  recipientCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  recipientHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  recipientTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  recipientName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  recipientSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
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
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    shadowColor: "#3B82F6",
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
  infoBanner: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 20,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#B45309",
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 14,
    color: "#92400E",
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
    backgroundColor: "#3B82F6",
    shadowColor: "#3B82F6",
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

