import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import {
  Text,
  Card,
  Avatar,
  Badge,
  ActivityIndicator,
  Surface,
} from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { listingsApi } from "../services/api";
import type { RootStackParamList } from "../navigation/AppNavigator";
import ListingOffersScreen from "./ListingOffersScreen";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "ListingDetail">;
type ListingDetailRouteProp = RouteProp<RootStackParamList, "ListingDetail">;

type TabKey = "messages" | "offers";

// ============================================================
// MESSAGES TAB (Senders List)
// ============================================================

interface MessagesTabProps {
  listingId: string;
  address: string;
}

function MessagesTab({ listingId, address }: MessagesTabProps) {
  const navigation = useNavigation<NavigationProp>();

  const { data: senders, isLoading } = useQuery({
    queryKey: ["senders", listingId],
    queryFn: () => listingsApi.getSenders(listingId),
  });

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!senders || senders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Surface style={styles.emptyCard} elevation={1}>
          <Ionicons name="mail-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Messages Yet</Text>
          <Text style={styles.emptySubtitle}>
            Messages from buyer agents will appear here when they contact you about this listing.
          </Text>
        </Surface>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <FlatList
        data={senders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("Threads", {
                listingId: listingId,
                senderId: item.id,
                senderName: item.name,
                address: address,
              })
            }
          >
            <Card style={styles.senderCard}>
              <Card.Content>
                <View style={styles.senderHeader}>
                  <View style={styles.avatarContainer}>
                    <Avatar.Text
                      size={52}
                      label={item.name.substring(0, 2).toUpperCase()}
                      style={styles.avatar}
                    />
                    {item.isVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </View>

                  <View style={styles.senderContent}>
                    <View style={styles.senderTitleRow}>
                      <Text style={styles.senderName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.unreadCount > 0 && (
                        <Badge style={styles.unreadBadge}>{item.unreadCount}</Badge>
                      )}
                    </View>

                    {item.brokerage && (
                      <Text style={styles.brokerage} numberOfLines={1}>
                        {item.brokerage}
                      </Text>
                    )}

                    <Text style={styles.email} numberOfLines={1}>
                      {item.email}
                    </Text>

                    <View style={styles.metaRow}>
                      <Text style={styles.threadCount}>
                        {item.threadCount} {item.threadCount === 1 ? "thread" : "threads"}
                      </Text>
                      <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
                    </View>

                    <Text style={styles.lastSubject} numberOfLines={1}>
                      {item.lastSubject}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ============================================================
// TAB BAR COMPONENT
// ============================================================

interface TabBarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  pendingOffersCount: number;
}

function TabBar({ activeTab, onTabChange, pendingOffersCount }: TabBarProps) {
  return (
    <View style={styles.tabBar}>
      <Pressable
        style={[styles.tab, activeTab === "messages" && styles.tabActive]}
        onPress={() => onTabChange("messages")}
      >
        <Ionicons
          name="mail-outline"
          size={18}
          color={activeTab === "messages" ? "#059669" : "#6B7280"}
        />
        <Text
          style={[
            styles.tabLabel,
            activeTab === "messages" && styles.tabLabelActive,
          ]}
        >
          Messages
        </Text>
      </Pressable>

      <Pressable
        style={[styles.tab, activeTab === "offers" && styles.tabActive]}
        onPress={() => onTabChange("offers")}
      >
        <Ionicons
          name="document-text-outline"
          size={18}
          color={activeTab === "offers" ? "#059669" : "#6B7280"}
        />
        <Text
          style={[
            styles.tabLabel,
            activeTab === "offers" && styles.tabLabelActive,
          ]}
        >
          Offers
        </Text>
        {pendingOffersCount > 0 && (
          <Badge
            size={18}
            style={[
              styles.tabBadge,
              activeTab === "offers" && styles.tabBadgeActive,
            ]}
          >
            {pendingOffersCount}
          </Badge>
        )}
      </Pressable>
    </View>
  );
}

// ============================================================
// MAIN SCREEN WITH TABS
// ============================================================

export default function ListingDetailScreen() {
  const route = useRoute<ListingDetailRouteProp>();
  const { listingId, address, initialTab } = route.params;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || "messages");

  // Fetch offer count for badge
  const { data: offers } = useQuery({
    queryKey: ["listing-offers-count", listingId],
    queryFn: () => listingsApi.getOffers(listingId),
    refetchInterval: 30000,
  });

  const pendingOffersCount =
    offers?.filter((o) =>
      ["PENDING_REVIEW", "AWAITING_SELLER_SIGNATURE", "CONDITIONALLY_ACCEPTED"].includes(
        o.status
      )
    ).length || 0;

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  return (
    <View style={styles.container}>
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        pendingOffersCount={pendingOffersCount}
      />

      {activeTab === "messages" ? (
        <MessagesTab listingId={listingId} address={address} />
      ) : (
        <ListingOffersScreen listingId={listingId} address={address} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#059669",
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabLabelActive: {
    color: "#059669",
  },
  tabBadge: {
    backgroundColor: "#F59E0B",
  },
  tabBadgeActive: {
    backgroundColor: "#059669",
  },
  tabContent: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  listContent: {
    padding: 16,
  },
  senderCard: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  senderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    backgroundColor: "#3B82F6",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#10B981",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  senderContent: {
    flex: 1,
    marginLeft: 14,
  },
  senderTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  senderName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  brokerage: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  threadCount: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
  },
  time: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  lastSubject: {
    fontSize: 14,
    color: "#374151",
    fontStyle: "italic",
  },
  unreadBadge: {
    backgroundColor: "#EF4444",
    marginLeft: 8,
  },
});
