import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, Card } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offersApi } from '../services/api';
import { OfferStatus } from '@smart-brokerage/shared';

type OfferActionRouteProp = RouteProp<RootStackParamList, 'OfferAction'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Helper function to safely parse dates
function safeParseDate(dateValue: any, fallback: string = 'N/A'): string {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString();
}

export default function OfferActionScreen() {
  const route = useRoute<OfferActionRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { offerId, action } = route.params;

  const [declineReason, setDeclineReason] = useState('');

  const { data: offer, isLoading } = useQuery({
    queryKey: ['offer', offerId],
    queryFn: () => offersApi.get(offerId),
  });

  const acceptMutation = useMutation({
    mutationFn: () => offersApi.accept(offerId),
    onSuccess: (data) => {
      // Navigate to Dropbox Sign WebView for signing
      navigation.navigate('DropboxSign', {
        signUrl: data.signUrl,
        offerId: offerId,
      });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to accept offer');
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => offersApi.decline({
      offerId,
      reason: declineReason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['offer', offerId] });
      
      Alert.alert(
        'Offer Declined',
        'The buyer agent has been notified.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to decline offer');
    },
  });

  const handleCounterOffer = () => {
    // Navigate to counter-offer form
    navigation.navigate('CounterOfferForm', {
      offerId,
      listingId: offer.thread?.listingId || 'unknown',
      sellerEmail: 'seller@example.com', // TODO: Get from auth context
      sellerName: 'Seller', // TODO: Get from auth context
    });
  };

  if (isLoading || !offer) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading offer details...</Text>
      </View>
    );
  }

  const formatCurrency = (amount?: number | null): string => {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString()}`;
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            {action === 'accept' && 'Accept Offer'}
            {action === 'decline' && 'Decline Offer'}
            {action === 'counter' && 'Counter Offer'}
          </Text>

          {/* Original offer details */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Original Offer Details
            </Text>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">Purchase Price:</Text>
              <Text variant="titleMedium">{formatCurrency(offer.price)}</Text>
            </View>
            {offer.deposit !== null && (
              <View style={styles.detailRow}>
                <Text variant="bodyMedium">Deposit:</Text>
                <Text variant="bodyMedium">{formatCurrency(offer.deposit)}</Text>
              </View>
            )}
            {offer.closingDate && (
              <View style={styles.detailRow}>
                <Text variant="bodyMedium">Closing Date:</Text>
                <Text variant="bodyMedium">
                  {safeParseDate(offer.closingDate)}
                </Text>
              </View>
            )}
            {offer.conditions && (
              <View style={styles.detailRow}>
                <Text variant="bodyMedium">Conditions:</Text>
                <Text variant="bodyMedium">{offer.conditions}</Text>
              </View>
            )}
          </View>

          {/* Accept action */}
          {action === 'accept' && (
            <View style={styles.section}>
              <Text variant="bodyMedium" style={styles.infoText}>
                By accepting this offer, you agree to the terms outlined above. You will be
                asked to sign the agreement electronically.
              </Text>
              <Button
                mode="contained"
                onPress={() => acceptMutation.mutate()}
                loading={acceptMutation.isPending}
                disabled={acceptMutation.isPending}
                style={styles.acceptButton}
                buttonColor="#4CAF50"
              >
                Continue to Sign
              </Button>
            </View>
          )}

          {/* Decline action */}
          {action === 'decline' && (
            <View style={styles.section}>
              <Text variant="labelLarge" style={styles.label}>
                Reason for Declining (Optional)
              </Text>
              <TextInput
                mode="outlined"
                value={declineReason}
                onChangeText={setDeclineReason}
                placeholder="e.g., Price too low, timing doesn't work..."
                multiline
                numberOfLines={4}
                style={styles.textArea}
              />
              <Button
                mode="contained"
                onPress={() => declineMutation.mutate()}
                loading={declineMutation.isPending}
                disabled={declineMutation.isPending}
                style={styles.declineButton}
                buttonColor="#F44336"
              >
                Confirm Decline
              </Button>
            </View>
          )}

          {/* Counter action */}
          {action === 'counter' && (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Create Counter-Offer
              </Text>
              <Text variant="bodySmall" style={styles.helperText}>
                You'll be guided through modifying the offer terms and signing your counter-offer.
              </Text>

              <Button
                mode="contained"
                onPress={handleCounterOffer}
                style={styles.counterButton}
                buttonColor="#FF9800"
              >
                Continue to Counter-Offer Form
              </Button>
            </View>
          )}

          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoText: {
    marginBottom: 16,
    color: '#666',
    lineHeight: 20,
  },
  label: {
    marginBottom: 8,
    color: '#333',
  },
  helperText: {
    marginBottom: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  textArea: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  warningText: {
    marginTop: 8,
    marginBottom: 16,
    color: '#FF9800',
    fontStyle: 'italic',
  },
  acceptButton: {
    marginTop: 8,
  },
  declineButton: {
    marginTop: 8,
  },
  counterButton: {
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 16,
  },
});

