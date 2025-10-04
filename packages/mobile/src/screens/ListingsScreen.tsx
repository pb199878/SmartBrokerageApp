import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Badge, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { listingsApi } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ListingsScreen() {
  const navigation = useNavigation<NavigationProp>();

  const { data: listings, isLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: listingsApi.getAll,
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => 
              navigation.navigate('Senders', { 
                listingId: item.id, 
                address: item.address 
              })
            }
          >
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleMedium" style={styles.address}>
                    {item.address}
                  </Text>
                  <Badge style={styles.badge}>{item.status}</Badge>
                </View>
                <Text variant="bodyMedium" style={styles.city}>
                  {item.city}, {item.province} {item.postalCode}
                </Text>
                <Text variant="titleLarge" style={styles.price}>
                  ${item.price.toLocaleString()}
                </Text>
                <Text variant="bodySmall" style={styles.email}>
                  Email: {item.emailAlias}@inbox.yourapp.ca
                </Text>
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
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  address: {
    flex: 1,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#4CAF50',
  },
  city: {
    color: '#666',
    marginBottom: 8,
  },
  price: {
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  email: {
    color: '#999',
  },
});

