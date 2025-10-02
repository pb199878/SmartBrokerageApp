import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ListingsScreen from '../screens/ListingsScreen';
import ThreadsScreen from '../screens/ThreadsScreen';
import ChatScreen from '../screens/ChatScreen';

export type RootStackParamList = {
  Listings: undefined;
  Threads: { listingId: string; address: string };
  Chat: { threadId: string; senderName: string };
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

