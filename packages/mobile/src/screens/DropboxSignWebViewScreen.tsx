import React, { useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';

type DropboxSignRouteProp = RouteProp<RootStackParamList, 'DropboxSign'>;

export default function DropboxSignWebViewScreen() {
  const route = useRoute<DropboxSignRouteProp>();
  const navigation = useNavigation();
  const { signUrl, offerId } = route.params;
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);

    // Check if signing is complete
    // Dropbox Sign redirects to a success page or sends a postMessage
    const url = navState.url;
    
    if (url.includes('hellosign.com/sign/success') || url.includes('signature_complete')) {
      handleSigningComplete();
    }
  };

  const handleMessage = (event: any) => {
    // Listen for postMessage from Dropbox Sign WebView
    const data = event.nativeEvent.data;
    
    try {
      const message = JSON.parse(data);
      
      if (message.event === 'signature_complete' || message.type === 'complete') {
        handleSigningComplete();
      } else if (message.event === 'cancel' || message.type === 'cancel') {
        handleCancel();
      }
    } catch (error) {
      // Not a JSON message, ignore
    }
  };

  const handleSigningComplete = () => {
    Alert.alert(
      'Signature Complete! ✅',
      'Your signature has been submitted. The signed document will be sent to the buyer agent shortly.',
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to chat and refresh
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Signing?',
      'Are you sure you want to cancel? You can sign this document later.',
      [
        {
          text: 'Continue Signing',
          style: 'cancel',
        },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleError = (error: any) => {
    console.error('WebView error:', error);
    Alert.alert(
      'Error Loading Document',
      'There was an error loading the signature page. Please try again.',
      [
        {
          text: 'Retry',
          onPress: () => webViewRef.current?.reload(),
        },
        {
          text: 'Cancel',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading signing page...</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: signUrl }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onError={handleError}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="always"
      />

      {!loading && canGoBack && (
        <View style={styles.footer}>
          <Button
            mode="text"
            onPress={handleCancel}
            icon="close"
          >
            Cancel Signing
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  webview: {
    flex: 1,
  },
  footer: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});

