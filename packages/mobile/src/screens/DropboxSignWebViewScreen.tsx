import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { WebView } from "react-native-webview";
import {
  useRoute,
  useNavigation,
  CommonActions,
} from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useQuery } from "@tanstack/react-query";
import { offersApi } from "../services/api";

type DropboxSignRouteProp = RouteProp<RootStackParamList, "DropboxSign">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LOADING_TIMEOUT = 30000; // 30 seconds

export default function DropboxSignWebViewScreen() {
  const route = useRoute<DropboxSignRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const {
    signUrl,
    offerId,
    threadId: passedThreadId,
    senderName: passedSenderName,
    signingType,
  } = route.params;
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [signingCompleted, setSigningCompleted] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Fetch offer to get threadId and sender info if not passed
  const { data: offer } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: () => offersApi.get(offerId),
    enabled: !!offerId,
  });

  // Use passed values or fallback to offer data
  const threadId = passedThreadId || offer?.threadId;
  const offerWithThread = offer as typeof offer & {
    thread?: { sender?: { name?: string; email: string } };
  };
  const senderName =
    passedSenderName ||
    offerWithThread?.thread?.sender?.name ||
    offerWithThread?.thread?.sender?.email;

  console.log("🔐 DropboxSign WebView initialized");
  console.log("Sign URL:", signUrl);
  console.log("Offer ID:", offerId);
  console.log("Thread ID (passed):", passedThreadId);
  console.log("Thread ID (from offer):", offer?.threadId);
  console.log("Effective Thread ID:", threadId);
  console.log("Sender Name:", senderName);
  console.log("Signing Type:", signingType);

  // Set timeout for loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.error("⏱️  WebView loading timeout - taking too long");
        setLoadingTimeout(true);
        Alert.alert(
          "Loading Taking Too Long",
          "The signing page is taking longer than expected to load. This might be due to:\n\n• Slow internet connection\n• Expired signing URL\n• Server issues\n\nWould you like to try again?",
          [
            {
              text: "Retry",
              onPress: () => {
                setLoadingTimeout(false);
                webViewRef.current?.reload();
              },
            },
            {
              text: "Go Back",
              style: "cancel",
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    }, LOADING_TIMEOUT);

    return () => clearTimeout(timer);
  }, [loading, navigation]);

  const handleNavigationStateChange = (navState: any) => {
    console.log("Navigation state changed:", {
      url: navState.url,
      loading: navState.loading,
      canGoBack: navState.canGoBack,
    });

    setCanGoBack(navState.canGoBack);

    // Check if signing is complete
    // Dropbox Sign redirects to a success page or sends a postMessage
    const url = navState.url.toLowerCase();

    // Check for various completion URL patterns
    const isCompleteUrl =
      url.includes("hellosign.com/sign/success") ||
      url.includes("dropboxsign.com/sign/success") ||
      url.includes("signature_complete") ||
      url.includes("sign_complete") ||
      url.includes("signed=true") ||
      url.includes("status=signed") ||
      url.includes("/complete") ||
      url.includes("/success");

    if (isCompleteUrl) {
      console.log("✅ Signature complete detected from URL:", navState.url);
      handleSigningComplete();
    }
  };

  const handleMessage = (event: any) => {
    // Listen for postMessage from Dropbox Sign WebView
    const data = event.nativeEvent.data;
    console.log("📨 Message from WebView:", data);

    try {
      const message = JSON.parse(data);
      console.log("Parsed message:", message);

      // Handle various completion events from Dropbox Sign
      const isComplete =
        message.event === "signature_complete" ||
        message.event === "signature_request_signed" ||
        message.event === "signature_request_all_signed" ||
        message.type === "complete" ||
        message.type === "signed";

      const isCancel =
        message.event === "cancel" ||
        message.event === "close" ||
        message.type === "cancel" ||
        message.type === "close";

      if (isComplete) {
        console.log(
          "✅ Signature complete event received:",
          message.event || message.type
        );
        handleSigningComplete();
      } else if (isCancel) {
        console.log(
          "❌ Cancel/close event received:",
          message.event || message.type
        );
        handleCancel();
      } else {
        console.log("Unhandled message type:", message);
      }
    } catch (error) {
      // Not a JSON message, might be plain text
      console.log("Non-JSON message:", data);

      // Check if the plain text indicates completion
      if (
        typeof data === "string" &&
        (data.toLowerCase().includes("complete") ||
          data.toLowerCase().includes("signed") ||
          data.toLowerCase().includes("success"))
      ) {
        console.log("✅ Signature complete detected from text message");
        handleSigningComplete();
      }
    }
  };

  const handleSigningComplete = () => {
    // Prevent multiple calls
    if (signingCompleted) {
      console.log("⚠️ handleSigningComplete already called, ignoring");
      return;
    }
    setSigningCompleted(true);

    console.log("🎉 handleSigningComplete called");
    console.log("Thread ID available:", threadId);
    console.log("Offer data:", offer ? "loaded" : "not loaded");
    console.log("Signing type:", signingType);

    // Get the effective threadId - prefer passed value, then offer data
    const effectiveThreadId = threadId || offer?.threadId;

    // Navigate based on signing type
    const destinationScreen =
      signingType === "counter" ? "CounterOfferSent" : "OfferAccepted";
    console.log(
      `✅ Navigating to ${destinationScreen} with threadId:`,
      effectiveThreadId
    );

    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: "Listings" },
          {
            name: destinationScreen,
            params: {
              offerId,
              threadId: effectiveThreadId,
              senderName: senderName || "Agent",
            },
          },
        ],
      })
    );
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Signing?",
      "Are you sure you want to cancel? You can sign this document later.",
      [
        {
          text: "Continue Signing",
          style: "cancel",
        },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleError = (error: any) => {
    console.error("❌ WebView error:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    Alert.alert(
      "Error Loading Document",
      "There was an error loading the signature page. Please try again.",
      [
        {
          text: "Retry",
          onPress: () => webViewRef.current?.reload(),
        },
        {
          text: "Cancel",
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleLoadProgress = (event: any) => {
    console.log("Load progress:", event.nativeEvent.progress);
  };

  const handleHttpError = (event: any) => {
    console.error("❌ HTTP error:", event.nativeEvent);
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
        onLoadStart={() => {
          console.log("WebView load started");
          setLoading(true);
        }}
        onLoadEnd={() => {
          console.log("WebView load ended");
          setLoading(false);
        }}
        onLoadProgress={handleLoadProgress}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onError={handleError}
        onHttpError={handleHttpError}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="always"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
      />

      {!loading && canGoBack && (
        <View style={styles.footer}>
          <Button mode="text" onPress={handleCancel} icon="close">
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
    backgroundColor: "#fff",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    color: "#666",
  },
  webview: {
    flex: 1,
  },
  footer: {
    padding: 8,
    backgroundColor: "#f5f5f5",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
});
