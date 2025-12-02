import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Text, Chip, ActivityIndicator, Surface } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { listingsApi, ListingOffer } from "../services/api";
import type { RootStackParamList } from "../navigation/AppNavigator";
import OfferSummaryCard from "../components/OfferSummaryCard";
import { OfferStatus } from "@smart-brokerage/shared";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ListingOffersScreenProps {
  listingId: string;
  address: string;
}

type FilterOption = "all" | "pending" | "conditional" | "accepted" | "declined" | "countered";

const FILTER_OPTIONS: { key: FilterOption; label: string; statuses: string[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "pending", label: "Pending", statuses: [OfferStatus.PENDING_REVIEW, OfferStatus.AWAITING_SELLER_SIGNATURE, OfferStatus.AWAITING_BUYER_SIGNATURE] },
  { key: "conditional", label: "Conditional", statuses: [OfferStatus.CONDITIONALLY_ACCEPTED] },
  { key: "accepted", label: "Accepted", statuses: [OfferStatus.ACCEPTED] },
  { key: "declined", label: "Declined", statuses: [OfferStatus.DECLINED] },
  { key: "countered", label: "Countered", statuses: [OfferStatus.COUNTERED] },
];

export default function ListingOffersScreen({ listingId, address }: ListingOffersScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  // Get the status filter for the API call
  const statusFilter = FILTER_OPTIONS.find(f => f.key === activeFilter)?.statuses || undefined;

  // Fetch offers with polling
  const { data: offers, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["listing-offers", listingId, statusFilter],
    queryFn: () => listingsApi.getOffers(listingId, statusFilter ?? undefined),
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const handleOfferPress = useCallback((offerId: string) => {
    navigation.navigate("OfferDetail", { offerId, listingId });
  }, [navigation, listingId]);

  const renderOffer = useCallback(({ item }: { item: ListingOffer }) => (
    <OfferSummaryCard offer={item} onPress={handleOfferPress} />
  ), [handleOfferPress]);

  const renderFilterChip = useCallback(({ key, label }: { key: FilterOption; label: string }) => {
    const isActive = activeFilter === key;
    return (
      <Chip
        key={key}
        selected={isActive}
        onPress={() => setActiveFilter(key)}
        style={[
          styles.filterChip,
          isActive && styles.filterChipActive
        ]}
        textStyle={[
          styles.filterChipText,
          isActive && styles.filterChipTextActive
        ]}
        showSelectedCheck={false}
      >
        {label}
      </Chip>
    );
  }, [activeFilter]);

  // Count offers by status for badges
  const allOffersForCounts = useQuery({
    queryKey: ["listing-offers-counts", listingId],
    queryFn: () => listingsApi.getOffers(listingId),
    refetchInterval: 30000, // Update counts less frequently
  });

  const getFilterCount = (filter: FilterOption): number => {
    if (!allOffersForCounts.data) return 0;
    const filterConfig = FILTER_OPTIONS.find(f => f.key === filter);
    if (!filterConfig?.statuses) return allOffersForCounts.data.length;
    return allOffersForCounts.data.filter(o => filterConfig.statuses!.includes(o.status)).length;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Loading offers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <Chip
              selected={activeFilter === item.key}
              onPress={() => setActiveFilter(item.key)}
              style={[
                styles.filterChip,
                activeFilter === item.key && styles.filterChipActive
              ]}
              textStyle={[
                styles.filterChipText,
                activeFilter === item.key && styles.filterChipTextActive
              ]}
              showSelectedCheck={false}
            >
              {item.label}
              {getFilterCount(item.key) > 0 && (
                <Text style={[
                  styles.filterCount,
                  activeFilter === item.key && styles.filterCountActive
                ]}>
                  {" "}{getFilterCount(item.key)}
                </Text>
              )}
            </Chip>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Offers list */}
      {offers && offers.length > 0 ? (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.id}
          renderItem={renderOffer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Surface style={styles.emptyCard} elevation={1}>
            <Ionicons 
              name={activeFilter === "all" ? "document-text-outline" : "filter-outline"} 
              size={48} 
              color="#D1D5DB" 
            />
            <Text style={styles.emptyTitle}>
              {activeFilter === "all" ? "No Offers Yet" : "No Matching Offers"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === "all" 
                ? "When buyer agents send offers to this listing, they will appear here."
                : `No offers match the "${FILTER_OPTIONS.find(f => f.key === activeFilter)?.label}" filter.`
              }
            </Text>
            {activeFilter !== "all" && (
              <Chip
                onPress={() => setActiveFilter("all")}
                style={styles.clearFilterChip}
                icon="close"
              >
                Clear Filter
              </Chip>
            )}
          </Surface>
        </View>
      )}
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
  filterContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 12,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: "#059669",
  },
  filterChipText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  filterCount: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
  },
  filterCountActive: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    maxWidth: 320,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  clearFilterChip: {
    marginTop: 16,
    backgroundColor: "#F3F4F6",
  },
});

