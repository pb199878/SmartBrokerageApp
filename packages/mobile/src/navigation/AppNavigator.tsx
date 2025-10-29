import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ListingsScreen from '../screens/ListingsScreen';
import ThreadsScreen from '../screens/ThreadsScreen';
import ChatScreen from '../screens/ChatScreen';
import SendersScreen from '@/screens/SendersScreen';
import DocumentViewerScreen from '../screens/DocumentViewerScreen';
import OfferActionScreen from '../screens/OfferActionScreen';
import DropboxSignWebViewScreen from '../screens/DropboxSignWebViewScreen';

export type RootStackParamList = {
  Listings: undefined;
  Threads: { listingId: string; senderId: string; senderName: string; address: string };
  Chat: { threadId: string; senderName: string };
  Senders: { listingId: string; address: string };
  DocumentViewer: { attachmentId: string; filename?: string };
  OfferAction: { offerId: string; action: 'accept' | 'decline' | 'counter' };
  DropboxSign: { signUrl: string; offerId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Listings">
        <Stack.Screen 
          name="Listings" 
          component={ListingsScreen}
          options={{ title: 'My Listings' }}
        />
        <Stack.Screen 
          name="Senders" 
          component={SendersScreen}
          options={({ route }) => ({ 
            title: route.params.address,
            headerBackTitle: 'Listings',
          })}
        />
        <Stack.Screen 
          name="Threads" 
          component={ThreadsScreen}
          options={({ route }) => ({ 
            title: route.params.address,
            headerBackTitle: 'Back',
          })}
        />
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen}
          options={({ route }) => ({ 
            title: route.params.senderName,
            headerBackTitle: 'Back',
          })}
        />
        <Stack.Screen 
          name="DocumentViewer" 
          component={DocumentViewerScreen}
          options={{
            title: 'Document',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen 
          name="OfferAction" 
          component={OfferActionScreen}
          options={{
            title: 'Offer Action',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen 
          name="DropboxSign" 
          component={DropboxSignWebViewScreen}
          options={{
            title: 'Sign Document',
            headerBackTitle: 'Cancel',
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

