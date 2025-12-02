import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Chip, Surface } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { OfferStatus } from "@smart-brokerage/shared";
import type { ListingOffer } from "../services/api";

interface OfferSummaryCardProps {
  offer: ListingOffer;
  onPress: (offerId: string) => void;
}

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
    month: "short",
    day: "numeric",
    year: "numeric",
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

function formatTimeAgo(dateValue: any): string {
  const date = safeParseDate(dateValue);
  if (!date) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateValue);
}

function getStatusConfig(status: OfferStatus): { color: string; bgColor: string; label: string; icon: string } {
  switch (status) {
    case OfferStatus.PENDING_REVIEW:
      return { color: "#D97706", bgColor: "#FEF3C7", label: "Pending Review", icon: "time-outline" };
    case OfferStatus.AWAITING_SELLER_SIGNATURE:
      return { color: "#2563EB", bgColor: "#DBEAFE", label: "Awaiting Signature", icon: "create-outline" };
    case OfferStatus.AWAITING_BUYER_SIGNATURE:
      return { color: "#7C3AED", bgColor: "#EDE9FE", label: "Awaiting Buyer", icon: "hourglass-outline" };
    case OfferStatus.CONDITIONALLY_ACCEPTED:
      return { color: "#059669", bgColor: "#D1FAE5", label: "Conditionally Accepted", icon: "checkmark-circle-outline" };
    case OfferStatus.ACCEPTED:
      return { color: "#059669", bgColor: "#D1FAE5", label: "Accepted", icon: "checkmark-done-circle-outline" };
    case OfferStatus.DECLINED:
      return { color: "#DC2626", bgColor: "#FEE2E2", label: "Declined", icon: "close-circle-outline" };
    case OfferStatus.COUNTERED:
      return { color: "#EA580C", bgColor: "#FFEDD5", label: "Countered", icon: "swap-horizontal-outline" };
    case OfferStatus.EXPIRED:
      return { color: "#6B7280", bgColor: "#F3F4F6", label: "Expired", icon: "timer-outline" };
    case OfferStatus.SUPERSEDED:
      return { color: "#6B7280", bgColor: "#F3F4F6", label: "Superseded", icon: "layers-outline" };
    default:
      return { color: "#6B7280", bgColor: "#F3F4F6", label: status, icon: "help-circle-outline" };
  }
}

export default function OfferSummaryCard({ offer, onPress }: OfferSummaryCardProps) {
  const statusConfig = getStatusConfig(offer.status as OfferStatus);
  const { conditionSummary } = offer;
  
  const hasConditions = conditionSummary.total > 0;
  const allConditionsComplete = hasConditions && conditionSummary.pending === 0;

  return (
    <TouchableOpacity onPress={() => onPress(offer.id)} activeOpacity={0.7}>
      <Surface style={styles.card} elevation={2}>
        {/* Header with status */}
        <View style={styles.header}>
          <View style={styles.senderInfo}>
            <Text style={styles.senderName} numberOfLines={1}>
              {offer.senderName || offer.senderEmail}
            </Text>
            {offer.senderBrokerage && (
              <Text style={styles.brokerage} numberOfLines={1}>
                {offer.senderBrokerage}
              </Text>
            )}
          </View>
          <Chip
            style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
            textStyle={[styles.statusText, { color: statusConfig.color }]}
            icon={() => (
              <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
            )}
          >
            {statusConfig.label}
          </Chip>
        </View>

        {/* Price and key details */}
        <View style={styles.mainDetails}>
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Offer Price</Text>
            <Text style={styles.priceValue}>{formatCurrency(offer.price)}</Text>
          </View>
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color="#6B7280" />
              <View>
                <Text style={styles.detailLabel}>Closing</Text>
                <Text style={styles.detailValue}>{formatDate(offer.closingDate)}</Text>
              </View>
            </View>
            
            {offer.deposit && (
              <View style={styles.detailItem}>
                <Ionicons name="wallet-outline" size={16} color="#6B7280" />
                <View>
                  <Text style={styles.detailLabel}>Deposit</Text>
                  <Text style={styles.detailValue}>{formatCurrency(offer.deposit)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Conditions summary */}
        {hasConditions && (
          <View style={styles.conditionsRow}>
            <View style={styles.conditionsSummary}>
              <Ionicons 
                name={allConditionsComplete ? "checkmark-done-circle" : "list-circle-outline"} 
                size={18} 
                color={allConditionsComplete ? "#059669" : "#F59E0B"} 
              />
              <Text style={[
                styles.conditionsText,
                allConditionsComplete && styles.conditionsComplete
              ]}>
                {allConditionsComplete 
                  ? "All conditions fulfilled"
                  : `${conditionSummary.pending} pending / ${conditionSummary.total} conditions`
                }
              </Text>
            </View>
            {conditionSummary.completed > 0 && !allConditionsComplete && (
              <Text style={styles.completedCount}>
                {conditionSummary.completed} done
              </Text>
            )}
          </View>
        )}

        {/* Footer with timestamp */}
        <View style={styles.footer}>
          <Text style={styles.timestamp}>
            Updated {formatTimeAgo(offer.updatedAt)}
          </Text>
          <View style={styles.viewDetails}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#6B7280" />
          </View>
        </View>

        {/* Counter-offer indicator */}
        {offer.isCounterOffer && (
          <View style={styles.counterOfferBadge}>
            <Ionicons name="swap-horizontal" size={12} color="#EA580C" />
            <Text style={styles.counterOfferText}>Counter-offer</Text>
          </View>
        )}
      </Surface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  senderInfo: {
    flex: 1,
    marginRight: 12,
  },
  senderName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  brokerage: {
    fontSize: 13,
    color: "#6B7280",
  },
  statusChip: {
    height: 28,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  mainDetails: {
    marginBottom: 12,
  },
  priceSection: {
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  detailsGrid: {
    flexDirection: "row",
    gap: 24,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  conditionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFAFA",
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  conditionsSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  conditionsText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  conditionsComplete: {
    color: "#059669",
  },
  completedCount: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  timestamp: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  viewDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  counterOfferBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFEDD5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  counterOfferText: {
    fontSize: 10,
    color: "#EA580C",
    fontWeight: "600",
  },
});

