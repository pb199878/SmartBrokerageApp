import React, { useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Badge, ActivityIndicator, FAB } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { listingsApi, threadsApi, offersApi } from '../services/api';
import { OfferStatus, OfferConditionStatus } from '@smart-brokerage/shared';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ListingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [isFindingAcceptedOffer, setIsFindingAcceptedOffer] = useState(false);

  const { data: listings, isLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: listingsApi.getAll,
  });

  const handleFindAcceptedOffer = async () => {
    if (!listings || listings.length === 0) return;
    
    setIsFindingAcceptedOffer(true);
    try {
      let offerWithConditions: any = null;
      let fallbackOffer: any = null;
      
      // Search through listings to find an accepted offer
      for (const listing of listings) {
        try {
          // Get senders for this listing
          const senders = await listingsApi.getSenders(listing.id);
          
          // Check each sender's threads
          for (const sender of senders) {
            try {
              const threads = await listingsApi.getThreadsBySender(listing.id, sender.id);
              
              // Check each thread for offers
              for (const thread of threads) {
                try {
                  const offers = await threadsApi.getOffers(thread.id);
                  const acceptedOffers = offers.filter(o => o.status === OfferStatus.ACCEPTED);
                  
                  // Check each accepted offer for conditions
                  for (const acceptedOffer of acceptedOffers) {
                    try {
                      // Fetch full offer details to check for conditions
                      const fullOffer = await offersApi.get(acceptedOffer.id);
                      
                      // Check if this offer has pending conditions
                      const pendingConditions = fullOffer.offerConditions?.filter(
                        (c: any) => c.status === OfferConditionStatus.PENDING
                      ) || [];
                      
                      if (pendingConditions.length > 0 && !offerWithConditions) {
                        // Found an offer with conditions! Save it
                        offerWithConditions = {
                          offer: fullOffer,
                          threadId: thread.id,
                          senderName: sender.name || sender.email,
                        };
                        // Continue searching in case there's a better one, but we'll use this if we don't find another
                      } else if (!fallbackOffer) {
                        // Save as fallback (any accepted offer without conditions)
                        fallbackOffer = {
                          offer: fullOffer,
                          threadId: thread.id,
                          senderName: sender.name || sender.email,
                        };
                      }
                    } catch (error) {
                      console.error(`Error fetching full offer details for ${acceptedOffer.id}:`, error);
                    }
                  }
                } catch (error) {
                  console.error(`Error fetching offers for thread ${thread.id}:`, error);
                }
              }
            } catch (error) {
              console.error(`Error fetching threads for sender ${sender.id}:`, error);
            }
          }
        } catch (error) {
          console.error(`Error fetching senders for listing ${listing.id}:`, error);
        }
      }
      
      // Prefer offer with conditions, otherwise use fallback
      const selectedOffer = offerWithConditions || fallbackOffer;
      
      if (selectedOffer) {
        navigation.navigate('OfferAccepted', {
          offerId: selectedOffer.offer.id,
          threadId: selectedOffer.threadId,
          senderName: selectedOffer.senderName,
        });
      } else {
        alert('No accepted offers found');
      }
    } catch (error) {
      console.error('Error finding accepted offer:', error);
      alert('Error finding accepted offer');
    } finally {
      setIsFindingAcceptedOffer(false);
    }
  };

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
      <FAB
        icon="check-circle"
        style={styles.fab}
        onPress={handleFindAcceptedOffer}
        disabled={isFindingAcceptedOffer || !listings || listings.length === 0}
        label={isFindingAcceptedOffer ? "Finding..." : "Accepted Offer"}
        loading={isFindingAcceptedOffer}
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#059669',
  },
});

