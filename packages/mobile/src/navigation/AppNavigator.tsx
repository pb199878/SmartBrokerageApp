import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ListingsScreen from "../screens/ListingsScreen";
import ListingDetailScreen from "../screens/ListingDetailScreen";
import ThreadsScreen from "../screens/ThreadsScreen";
import ChatScreen from "../screens/ChatScreen";
import SendersScreen from "@/screens/SendersScreen";
import DocumentViewerScreen from "../screens/DocumentViewerScreen";
import OfferActionScreen from "../screens/OfferActionScreen";
import OfferDetailScreen from "../screens/OfferDetailScreen";
import DropboxSignWebViewScreen from "../screens/DropboxSignWebViewScreen";
import ApsGuidedFormScreen from "../screens/ApsGuidedFormScreen";
import ApsReviewScreen from "../screens/ApsReviewScreen";
import CounterOfferFormScreen from "../screens/CounterOfferFormScreen";
import OfferAcceptedScreen from "../screens/OfferAcceptedScreen";
import CounterOfferSentScreen from "../screens/CounterOfferSentScreen";

export type RootStackParamList = {
  Listings: undefined;
  ListingDetail: {
    listingId: string;
    address: string;
    initialTab?: "messages" | "offers";
  };
  Threads: {
    listingId: string;
    senderId: string;
    senderName: string;
    address: string;
  };
  Chat: { threadId: string; senderName: string };
  Senders: { listingId: string; address: string };
  DocumentViewer: { attachmentId: string; filename?: string };
  OfferAction: { offerId: string; action: "accept" | "decline" | "counter" };
  OfferDetail: {
    offerId: string;
    listingId?: string;
  };
  DropboxSign: { 
    signUrl: string; 
    offerId: string; 
    threadId?: string; 
    senderName?: string;
    signingType: 'accept' | 'counter'; // Determines post-signing navigation
  };
  OfferAccepted: {
    offerId: string;
    threadId?: string; // Optional - will be fetched from offer if not provided
    senderName?: string;
  };
  CounterOfferSent: {
    offerId: string;
    threadId?: string;
    senderName?: string;
  };
  ApsGuidedForm: {
    offerId: string;
    listingId: string;
    sellerEmail: string;
    sellerName?: string;
  };
  ApsReview: {
    offerId: string;
    listingId: string;
    sellerEmail: string;
    sellerName?: string;
    buyerDetails?: any; // Optional: buyer's offer details from parsed APS
  };
  CounterOfferForm: {
    offerId: string;
    listingId: string;
    sellerEmail: string;
    sellerName: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Listings">
        <Stack.Screen
          name="Listings"
          component={ListingsScreen}
          options={{ title: "My Listings" }}
        />
        <Stack.Screen
          name="ListingDetail"
          component={ListingDetailScreen}
          options={({ route }) => ({
            title: route.params.address,
            headerBackTitle: "Listings",
          })}
        />
        <Stack.Screen
          name="Senders"
          component={SendersScreen}
          options={({ route }) => ({
            title: route.params.address,
            headerBackTitle: "Listings",
          })}
        />
        <Stack.Screen
          name="Threads"
          component={ThreadsScreen}
          options={({ route }) => ({
            title: route.params.address,
            headerBackTitle: "Back",
          })}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({ route }) => ({
            title: route.params.senderName,
            headerBackTitle: "Back",
          })}
        />
        <Stack.Screen
          name="DocumentViewer"
          component={DocumentViewerScreen}
          options={{
            title: "Document",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="OfferAction"
          component={OfferActionScreen}
          options={{
            title: "Offer Action",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="OfferDetail"
          component={OfferDetailScreen}
          options={{
            title: "Offer Details",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="DropboxSign"
          component={DropboxSignWebViewScreen}
          options={{
            title: "Sign Document",
            headerBackVisible: false,
            presentation: "modal",
            gestureEnabled: false, // Prevent accidental dismissal during signing
          }}
        />
        <Stack.Screen
          name="ApsGuidedForm"
          component={ApsGuidedFormScreen}
          options={{
            title: "Complete APS Details",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="ApsReview"
          component={ApsReviewScreen}
          options={{
            title: "Review APS",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="CounterOfferForm"
          component={CounterOfferFormScreen}
          options={{
            title: "Create Counter-Offer",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="OfferAccepted"
          component={OfferAcceptedScreen}
          options={{
            title: "Offer Accepted",
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="CounterOfferSent"
          component={CounterOfferSentScreen}
          options={{
            title: "Counter-Offer Sent",
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
