import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Card, Text, Button, Chip } from "react-native-paper";
import { Offer, OfferStatus } from "@smart-brokerage/shared";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

interface OfferCardProps {
  offer: Offer;
  onAccept?: (offerId: string) => void;
  onDecline?: (offerId: string) => void;
  onCounter?: (offerId: string) => void;
  onViewDocument?: (offerId: string) => void;
  onContinueToSign?: (offerId: string) => void;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function OfferCard({
  offer,
  onAccept,
  onDecline,
  onCounter,
  onViewDocument,
  onContinueToSign,
}: OfferCardProps) {
  const navigation = useNavigation<NavigationProp>();

  const getStatusColor = (status: OfferStatus): string => {
    switch (status) {
      case OfferStatus.PENDING_REVIEW:
        return "#FFC107"; // Amber
      case OfferStatus.AWAITING_SELLER_SIGNATURE:
        return "#2196F3"; // Blue
      case OfferStatus.AWAITING_BUYER_SIGNATURE:
        return "#9C27B0"; // Purple
      case OfferStatus.ACCEPTED:
        return "#4CAF50"; // Green
      case OfferStatus.DECLINED:
        return "#F44336"; // Red
      case OfferStatus.COUNTERED:
        return "#FF9800"; // Orange
      case OfferStatus.EXPIRED:
        return "#9E9E9E"; // Gray
      default:
        return "#757575";
    }
  };

  const getStatusLabel = (status: OfferStatus): string => {
    switch (status) {
      case OfferStatus.PENDING_REVIEW:
        return "Pending Review";
      case OfferStatus.AWAITING_SELLER_SIGNATURE:
        return "Awaiting Your Signature";
      case OfferStatus.AWAITING_BUYER_SIGNATURE:
        return "Awaiting Buyer Signature";
      case OfferStatus.ACCEPTED:
        return "Accepted";
      case OfferStatus.DECLINED:
        return "Declined";
      case OfferStatus.COUNTERED:
        return "Counter-Offered";
      case OfferStatus.EXPIRED:
        return "Expired";
      default:
        return status;
    }
  };

  const formatCurrency = (amount?: number | null): string => {
    if (!amount) return "N/A";
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (date?: Date | null): string => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isExpired = offer.expiryDate && new Date(offer.expiryDate) < new Date();
  const isPending = offer.status === OfferStatus.PENDING_REVIEW;
  const isAwaitingSignature =
    offer.status === OfferStatus.AWAITING_SELLER_SIGNATURE;
  const isAccepted = offer.status === OfferStatus.ACCEPTED;
  const isDeclined = offer.status === OfferStatus.DECLINED;

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        {/* Header with status */}
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            💼 Offer Received
          </Text>
          <Chip
            mode="flat"
            style={[
              styles.statusChip,
              { backgroundColor: getStatusColor(offer.status) },
            ]}
            textStyle={styles.statusText}
          >
            {getStatusLabel(offer.status)}
          </Chip>
        </View>

        {/* Offer details */}
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={styles.label}>
              Purchase Price:
            </Text>
            <Text variant="titleMedium" style={styles.value}>
              {formatCurrency(offer.price)}
            </Text>
          </View>

          {offer.deposit !== null && offer.deposit !== undefined && (
            <View style={styles.detailRow}>
              <Text variant="labelMedium" style={styles.label}>
                Deposit:
              </Text>
              <Text variant="bodyMedium" style={styles.value}>
                {formatCurrency(offer.deposit)}
              </Text>
            </View>
          )}

          {offer.closingDate && (
            <View style={styles.detailRow}>
              <Text variant="labelMedium" style={styles.label}>
                Closing Date:
              </Text>
              <Text variant="bodyMedium" style={styles.value}>
                {formatDate(offer.closingDate)}
              </Text>
            </View>
          )}

          {offer.conditions && (
            <View style={styles.detailRow}>
              <Text variant="labelMedium" style={styles.label}>
                Conditions:
              </Text>
              <Text variant="bodyMedium" style={styles.value}>
                {offer.conditions}
              </Text>
            </View>
          )}

          {offer.expiryDate && (
            <View style={styles.detailRow}>
              <Text variant="labelMedium" style={styles.label}>
                Expires:
              </Text>
              <Text
                variant="bodyMedium"
                style={[styles.value, isExpired && styles.expiredText]}
              >
                {formatDate(offer.expiryDate)}
                {isExpired && " (Expired)"}
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        {!isExpired && !isAccepted && !isDeclined && (
          <View style={styles.actions}>
            {onViewDocument && (
              <Button
                mode="outlined"
                onPress={() => onViewDocument(offer.id)}
                style={styles.actionButton}
              >
                View Documents
              </Button>
            )}

            {isPending && (
              <>
                <Button
                  mode="contained"
                  onPress={() => onAccept?.(offer.id)}
                  style={[styles.actionButton, styles.acceptButton]}
                  buttonColor="#4CAF50"
                >
                  Accept & Sign
                </Button>

                <View style={styles.secondaryActions}>
                  <Button
                    mode="outlined"
                    onPress={() => onCounter?.(offer.id)}
                    style={styles.secondaryButton}
                  >
                    Counter
                  </Button>
                  <Button
                    mode="text"
                    onPress={() => onDecline?.(offer.id)}
                    style={styles.secondaryButton}
                    textColor="#F44336"
                  >
                    Decline
                  </Button>
                </View>
              </>
            )}

            {isAwaitingSignature && onContinueToSign && (
              <>
                <Button
                  mode="contained"
                  onPress={() => onContinueToSign(offer.id)}
                  style={[styles.actionButton, styles.acceptButton]}
                  buttonColor="#2196F3"
                  icon="draw"
                >
                  Continue to Sign
                </Button>

                <View style={styles.secondaryActions}>
                  <Button
                    mode="outlined"
                    onPress={() => onCounter?.(offer.id)}
                    style={styles.secondaryButton}
                  >
                    Counter Instead
                  </Button>
                  <Button
                    mode="text"
                    onPress={() => onDecline?.(offer.id)}
                    style={styles.secondaryButton}
                    textColor="#F44336"
                  >
                    Cancel
                  </Button>
                </View>
              </>
            )}
          </View>
        )}

        {/* Accepted message */}
        {isAccepted && (
          <View style={styles.acceptedBanner}>
            <Text variant="bodyMedium" style={styles.acceptedText}>
              ✅ You accepted this offer on {formatDate(offer.sellerSignedAt)}
            </Text>
          </View>
        )}

        {/* Declined message */}
        {isDeclined && offer.declineReason && (
          <View style={styles.declinedBanner}>
            <Text variant="bodySmall" style={styles.declinedText}>
              Declined: {offer.declineReason}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 12,
    marginHorizontal: 8,
    backgroundColor: "#FFF9E6", // Light yellow to stand out
    borderLeftWidth: 4,
    borderLeftColor: "#FFC107",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontWeight: "bold",
    color: "#333",
  },
  statusChip: {
    height: 28,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  details: {
    marginBottom: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  label: {
    color: "#666",
    flex: 1,
  },
  value: {
    color: "#333",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  expiredText: {
    color: "#F44336",
  },
  actions: {
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    marginVertical: 4,
  },
  acceptButton: {
    elevation: 2,
  },
  secondaryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
  },
  acceptedBanner: {
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  acceptedText: {
    color: "#2E7D32",
    textAlign: "center",
  },
  declinedBanner: {
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  declinedText: {
    color: "#C62828",
    fontStyle: "italic",
  },
});
