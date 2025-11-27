import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ListingsScreen from "../screens/ListingsScreen";
import ThreadsScreen from "../screens/ThreadsScreen";
import ChatScreen from "../screens/ChatScreen";
import SendersScreen from "@/screens/SendersScreen";
import DocumentViewerScreen from "../screens/DocumentViewerScreen";
import OfferActionScreen from "../screens/OfferActionScreen";
import DropboxSignWebViewScreen from "../screens/DropboxSignWebViewScreen";
import ApsGuidedFormScreen from "../screens/ApsGuidedFormScreen";
import ApsReviewScreen from "../screens/ApsReviewScreen";
import ApsSigningScreen from "../screens/ApsSigningScreen";
import CounterOfferFormScreen from "../screens/CounterOfferFormScreen";

export type RootStackParamList = {
  Listings: undefined;
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
  DropboxSign: { signUrl: string; offerId: string };
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
  ApsSigning: {
    offerId: string;
    signUrl: string;
    listingId: string;
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
          name="DropboxSign"
          component={DropboxSignWebViewScreen}
          options={{
            title: "Sign Document",
            headerBackVisible: false,
            presentation: "modal",
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
          name="ApsSigning"
          component={ApsSigningScreen}
          options={{
            title: "Sign APS",
            headerBackTitle: "Cancel",
            presentation: "modal",
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
