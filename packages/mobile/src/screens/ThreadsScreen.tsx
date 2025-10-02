import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Avatar, Badge, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { listingsApi } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Threads'>;
type ThreadsRouteProp = RouteProp<RootStackParamList, 'Threads'>;

export default function ThreadsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ThreadsRouteProp>();
  const { listingId } = route.params;

  const { data: threads, isLoading } = useQuery({
    queryKey: ['threads', listingId],
    queryFn: () => listingsApi.getThreads(listingId),
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'OFFER':
        return '📄';
      case 'SHOWING':
        return '📅';
      default:
        return '✉️';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'OFFER':
        return '#4CAF50';
      case 'SHOWING':
        return '#2196F3';
      default:
        return '#999';
    }
  };

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

  if (!threads || threads.length === 0) {
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
        data={threads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Chat', {
                threadId: item.id,
                senderName: item.senderName,
              })
            }
          >
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.threadHeader}>
                  <View style={styles.avatarContainer}>
                    <Avatar.Text
                      size={48}
                      label={item.senderName.substring(0, 2).toUpperCase()}
                      style={{ backgroundColor: '#2196F3' }}
                    />
                    {item.isVerified && (
                      <Text style={styles.verifiedBadge}>✓</Text>
                    )}
                  </View>

                  <View style={styles.threadContent}>
                    <View style={styles.threadTitleRow}>
                      <Text variant="titleMedium" style={styles.senderName}>
                        {item.senderName}
                      </Text>
                      <Text variant="bodySmall" style={styles.time}>
                        {formatTime(item.lastMessageAt)}
                      </Text>
                    </View>

                    <View style={styles.subjectRow}>
                      <Text style={styles.categoryIcon}>{getCategoryIcon(item.category)}</Text>
                      <Text
                        variant="bodyMedium"
                        style={styles.subject}
                        numberOfLines={1}
                      >
                        {item.subject}
                      </Text>
                    </View>

                    <Text variant="bodySmall" style={styles.email}>
                      {item.senderEmail}
                    </Text>
                  </View>

                  {item.unreadCount > 0 && (
                    <Badge style={styles.unreadBadge}>{item.unreadCount}</Badge>
                  )}
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
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#4CAF50',
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    borderRadius: 8,
    width: 16,
    height: 16,
    textAlign: 'center',
    lineHeight: 16,
  },
  threadContent: {
    flex: 1,
    marginLeft: 12,
  },
  threadTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontWeight: 'bold',
    flex: 1,
  },
  time: {
    color: '#999',
    marginLeft: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  subject: {
    flex: 1,
    color: '#333',
  },
  email: {
    color: '#999',
  },
  unreadBadge: {
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
});

