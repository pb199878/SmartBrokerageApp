import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Avatar, Badge, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { listingsApi } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Senders'>;
type SendersRouteProp = RouteProp<RootStackParamList, 'Senders'>;

export default function SendersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SendersRouteProp>();
  const { listingId } = route.params;

  const { data: senders, isLoading } = useQuery({
    queryKey: ['senders', listingId],
    queryFn: () => listingsApi.getSenders(listingId),
  });

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!senders || senders.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📧</Text>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>
          Messages from buyer agents will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={senders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Threads', {
                listingId: listingId as string,
                senderId: item.id,
                senderName: item.name,
                address: route.params.address,
              })
            }
          >
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.senderHeader}>
                  <View style={styles.avatarContainer}>
                    <Avatar.Text
                      size={56}
                      label={item.name.substring(0, 2).toUpperCase()}
                      style={{ backgroundColor: '#2196F3' }}
                    />
                    {item.isVerified && (
                      <Text style={styles.verifiedBadge}>✓</Text>
                    )}
                  </View>

                  <View style={styles.senderContent}>
                    <View style={styles.senderTitleRow}>
                      <Text variant="titleLarge" style={styles.senderName}>
                        {item.name}
                      </Text>
                      {item.unreadCount > 0 && (
                        <Badge style={styles.unreadBadge}>{item.unreadCount}</Badge>
                      )}
                    </View>

                    {item.brokerage && (
                      <Text variant="bodyMedium" style={styles.brokerage}>
                        {item.brokerage}
                      </Text>
                    )}

                    <Text variant="bodySmall" style={styles.email}>
                      {item.email}
                    </Text>

                    <View style={styles.metaRow}>
                      <Text variant="bodySmall" style={styles.threadCount}>
                        {item.threadCount} {item.threadCount === 1 ? 'thread' : 'threads'}
                      </Text>
                      <Text variant="bodySmall" style={styles.time}>
                        {formatTime(item.lastMessageAt)}
                      </Text>
                    </View>

                    <Text 
                      variant="bodyMedium" 
                      style={styles.lastSubject}
                      numberOfLines={1}
                    >
                      Last: {item.lastSubject}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    borderRadius: 10,
    width: 20,
    height: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  senderContent: {
    flex: 1,
    marginLeft: 16,
  },
  senderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontWeight: 'bold',
    flex: 1,
  },
  brokerage: {
    color: '#666',
    marginBottom: 2,
  },
  email: {
    color: '#999',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  threadCount: {
    color: '#2196F3',
    fontWeight: '600',
  },
  time: {
    color: '#999',
  },
  lastSubject: {
    color: '#333',
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    marginLeft: 8,
  },
});