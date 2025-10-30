import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Button, Text, Card } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAgreement } from '../hooks/agreements';

type ApsSigningRouteProp = RouteProp<RootStackParamList, 'ApsSigning'>;

const LOADING_TIMEOUT = 30000; // 30 seconds

export default function ApsSigningScreen() {
  const route = useRoute<ApsSigningRouteProp>();
  const navigation = useNavigation();
  const { agreementId, signUrl, listingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Poll agreement status
  const { data: agreement, refetch } = useAgreement(agreementId);

  console.log('📝 APS Signing Screen initialized');
  console.log('Agreement ID:', agreementId);
  console.log('Sign URL:', signUrl);

  // Check if signing is complete
  useEffect(() => {
    if (agreement?.status === 'SIGNED') {
      console.log('✅ Agreement signed successfully');
      handleSigningComplete();
    }
  }, [agreement?.status]);

  // Set timeout for loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.error('⏱️  WebView loading timeout - taking too long');
        setLoadingTimeout(true);
        Alert.alert(
          'Loading Taking Too Long',
          'The signing page is taking longer than expected to load. Would you like to try again?',
          [
            {
              text: 'Retry',
              onPress: () => {
                setLoadingTimeout(false);
                webViewRef.current?.reload();
              },
            },
            {
              text: 'Go Back',
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    }, LOADING_TIMEOUT);

    return () => clearTimeout(timer);
  }, [loading, navigation]);

  const handleNavigationStateChange = (navState: any) => {
    console.log('Navigation state changed:', {
      url: navState.url,
      loading: navState.loading,
      canGoBack: navState.canGoBack,
    });

    setCanGoBack(navState.canGoBack);

    // Check if signing is complete via URL redirect
    const url = navState.url;

    if (
      url.includes('smartbrokerage://sign/complete') ||
      url.includes('hellosign.com/sign/success') ||
      url.includes('signature_complete')
    ) {
      console.log('✅ Signature complete detected from URL');
      // Poll for confirmation
      refetch();
    }
  };

  const handleMessage = (event: any) => {
    // Listen for postMessage from Dropbox Sign WebView
    const data = event.nativeEvent.data;
    console.log('📨 Message from WebView:', data);

    try {
      const message = JSON.parse(data);
      console.log('Parsed message:', message);

      if (
        message.event === 'signature_complete' ||
        message.type === 'complete'
      ) {
        console.log('✅ Signature complete event received');
        refetch();
      } else if (message.event === 'cancel' || message.type === 'cancel') {
        console.log('❌ Cancel event received');
        handleCancel();
      }
    } catch (error) {
      // Not a JSON message
      console.log('Non-JSON message received:', data);
    }
  };

  const handleSigningComplete = () => {
    Alert.alert(
      'Agreement Signed! ✅',
      'Your Agreement of Purchase and Sale has been signed successfully.',
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to listing or threads
            navigation.navigate('Listings');
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Signing?',
      'Are you sure you want to cancel signing this agreement?',
      [
        {
          text: 'No, Continue',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleError = (error: any) => {
    console.error('❌ WebView error:', error);
    Alert.alert(
      'Error Loading Signing Page',
      'There was an error loading the signing page. Please try again or contact support.',
      [
        {
          text: 'Retry',
          onPress: () => webViewRef.current?.reload(),
        },
        {
          text: 'Go Back',
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Guidance Panel */}
      <Card style={styles.guidanceCard}>
        <Card.Content>
          <Text variant="titleMedium">📋 Review and Sign</Text>
          <Text variant="bodySmall" style={styles.guidanceText}>
            • Review all information carefully
          </Text>
          <Text variant="bodySmall" style={styles.guidanceText}>
            • Initial each page at the bottom right
          </Text>
          <Text variant="bodySmall" style={styles.guidanceText}>
            • Sign on the final page
          </Text>
          <Text variant="bodySmall" style={styles.guidanceStatus}>
            Status: {agreement?.status || 'Loading...'}
          </Text>
        </Card.Content>
      </Card>

      {/* WebView */}
      <View style={styles.webViewContainer}>
        {loading && !loadingTimeout && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading signing page...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: signUrl }}
          onLoadStart={() => {
            console.log('WebView load started');
            setLoading(true);
          }}
          onLoadEnd={() => {
            console.log('WebView load ended');
            setLoading(false);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            handleError(nativeEvent);
          }}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          style={styles.webView}
        />
      </View>

      {/* Back button */}
      {canGoBack && (
        <View style={styles.backButtonContainer}>
          <Button
            mode="outlined"
            onPress={() => webViewRef.current?.goBack()}
            icon="arrow-left"
          >
            Back
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  guidanceCard: {
    margin: 12,
  },
  guidanceText: {
    marginTop: 4,
    color: '#666',
  },
  guidanceStatus: {
    marginTop: 8,
    fontWeight: '600',
    color: '#1976d2',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  backButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
});

