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
  const { listingId, senderId } = route.params;

  const { data: threads, isLoading } = useQuery({
    queryKey: ['threads', listingId],
    queryFn: () => listingsApi.getThreadsBySender(listingId, senderId),
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

  // Get sender info from first thread (all threads have same sender)
  const senderInfo = threads[0];

  const renderContactHeader = () => (
    <Card style={styles.contactCard}>
      <Card.Content>
        <View style={styles.contactHeader}>
          <View style={styles.avatarContainer}>
            <Avatar.Text
              size={56}
              label={senderInfo.senderName.substring(0, 2).toUpperCase()}
              style={{ backgroundColor: '#2196F3' }}
            />
            {senderInfo.isVerified && (
              <Text style={styles.verifiedBadge}>✓</Text>
            )}
          </View>
          <View style={styles.contactInfo}>
            <Text variant="titleLarge" style={styles.contactName}>
              {senderInfo.senderName}
            </Text>
            <Text variant="bodyMedium" style={styles.contactEmail}>
              {senderInfo.senderEmail}
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderContactHeader}
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
                  <Text style={styles.categoryIcon}>
                    {getCategoryIcon(item.category)}
                  </Text>
                  
                  <View style={styles.threadContent}>
                    <View style={styles.threadTitleRow}>
                      <Text 
                        variant="titleMedium" 
                        style={styles.subjectTitle}
                        numberOfLines={1}
                      >
                        {item.subject}
                      </Text>
                      {item.unreadCount > 0 && (
                        <Badge style={styles.unreadBadge}>{item.unreadCount}</Badge>
                      )}
                    </View>

                    <Text variant="bodySmall" style={styles.time}>
                      Last message {formatTime(item.lastMessageAt)}
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
  contactCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 16,
  },
  contactName: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  contactEmail: {
    color: '#666',
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    width: 18,
    height: 18,
    textAlign: 'center',
    lineHeight: 18,
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
  subjectTitle: {
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  time: {
    color: '#999',
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 4,
  },
  unreadBadge: {
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
});

