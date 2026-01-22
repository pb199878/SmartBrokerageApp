---
description: Add a new screen to the mobile app
---

# Add New Mobile Screen

## Steps

1. **Create Screen**: Add new file in `packages/mobile/src/screens/`

   - Use PascalCase naming (e.g., `ListingsScreen.tsx`)
   - Use functional components with hooks
   - Use React Native Paper for UI components

2. **Add Navigation**: Update `packages/mobile/src/navigation/AppNavigator.tsx`

   - Add screen to navigator
   - Define route params if needed

3. **API Integration**:

   - Add API calls to `packages/mobile/src/services/api.ts`
   - Use React Query for data fetching

4. **Styling**:
   - Use React Native Paper theme
   - Handle loading, error, and success states

## Screen Template

```typescript
import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function MyScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["myData"],
    queryFn: () => api.getMyData(),
  });

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error loading data</Text>;

  return (
    <View>
      <Text>{data?.title}</Text>
    </View>
  );
}
```
