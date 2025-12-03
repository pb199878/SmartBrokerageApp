import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import {
  Text,
  TextInput,
  Button,
  Card,
  HelperText,
  ActivityIndicator,
  Banner,
} from "react-native-paper";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp, NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { offersApi } from "../services/api";
import type { CounterOfferDto } from "@smart-brokerage/shared";

type CounterOfferFormRouteProp = RouteProp<
  RootStackParamList,
  "CounterOfferForm"
>;
type NavigationProps = NavigationProp<RootStackParamList>;

interface CounterOfferForm {
  purchasePrice: string;
  deposit: string;
  completionDate: string;
  conditions: string;
}

export default function CounterOfferFormScreen() {
  const route = useRoute<CounterOfferFormRouteProp>();
  const navigation = useNavigation<NavigationProps>();
  const queryClient = useQueryClient();
  const { offerId, listingId, sellerEmail, sellerName } = route.params;

  // Fetch original offer
  const { data: offer, isLoading: isLoadingOffer } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: () => offersApi.get(offerId),
  });

  // Form state
  const [formData, setFormData] = useState<CounterOfferForm>({
    purchasePrice: "",
    deposit: "",
    completionDate: "",
    conditions: "",
  });

  const [originalData, setOriginalData] = useState<CounterOfferForm>({
    purchasePrice: "",
    deposit: "",
    completionDate: "",
    conditions: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill form when offer data is loaded
  useEffect(() => {
    if (offer) {
      const priceStr = offer.price?.toString() || "";
      const depositStr = offer.deposit?.toString() || "";
      const dateStr = offer.closingDate
        ? new Date(offer.closingDate).toISOString().split("T")[0]
        : "";

      // Format conditions: prefer Schedule A conditions (offerConditions) if available
      let conditionsStr = offer.conditions || "";
      if (offer.offerConditions && offer.offerConditions.length > 0) {
        // Format Schedule A conditions as a numbered list
        conditionsStr = offer.offerConditions
          .map((condition, index) => {
            const num = index + 1;
            const desc = condition.description || "";
            const dueDate = condition.dueDate
              ? ` (Due: ${new Date(condition.dueDate).toLocaleDateString()})`
              : "";
            return `${num}. ${desc}${dueDate}`;
          })
          .join("\n\n");
      }

      const data = {
        purchasePrice: priceStr,
        deposit: depositStr,
        completionDate: dateStr,
        conditions: conditionsStr,
      };

      setFormData(data);
      setOriginalData(data);
    }
  }, [offer]);

  // Counter-offer mutation
  const counterMutation = useMutation({
    mutationFn: (dto: CounterOfferDto) => offersApi.counter(dto),
    onSuccess: (data) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["offer", offerId] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });

      // Navigate to signing screen
      navigation.navigate("DropboxSign", {
        offerId,
        signUrl: data.signUrl,
        threadId: offer?.threadId,
        senderName: offer?.thread?.sender?.name || offer?.thread?.sender?.email,
        signingType: "counter",
      });
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create counter-offer"
      );
    },
  });

  const updateField = (field: keyof CounterOfferForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const formatCurrency = (value: string): string => {
    // Remove non-digit characters
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";

    // Format with commas
    const number = parseInt(digits, 10);
    return number.toLocaleString();
  };

  const handlePriceChange = (value: string) => {
    const formatted = formatCurrency(value);
    updateField("purchasePrice", formatted);
  };

  const handleDepositChange = (value: string) => {
    const formatted = formatCurrency(value);
    updateField("deposit", formatted);
  };

  const parseCurrency = (value: string): number | undefined => {
    if (!value) return undefined;
    const digits = value.replace(/\D/g, "");
    return digits ? parseInt(digits, 10) : undefined;
  };

  const hasChanges = (): boolean => {
    return (
      formData.purchasePrice !== originalData.purchasePrice ||
      formData.deposit !== originalData.deposit ||
      formData.completionDate !== originalData.completionDate ||
      formData.conditions !== originalData.conditions
    );
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Check if at least one field has changed
    if (!hasChanges()) {
      Alert.alert(
        "No Changes",
        "Please modify at least one field to create a counter-offer."
      );
      return false;
    }

    // Validate numeric fields
    const price = parseCurrency(formData.purchasePrice);
    const deposit = parseCurrency(formData.deposit);

    if (price !== undefined && price <= 0) {
      newErrors.purchasePrice = "Purchase price must be greater than 0";
    }

    if (deposit !== undefined && deposit < 0) {
      newErrors.deposit = "Deposit cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const editedFields: CounterOfferDto["editedFields"] = {};

      // Only include changed fields
      const price = parseCurrency(formData.purchasePrice);
      const originalPrice = parseCurrency(originalData.purchasePrice);
      if (price !== undefined && price !== originalPrice) {
        editedFields.purchasePrice = price;
      }

      const deposit = parseCurrency(formData.deposit);
      const originalDeposit = parseCurrency(originalData.deposit);
      if (deposit !== undefined && deposit !== originalDeposit) {
        editedFields.deposit = deposit;
      }

      if (
        formData.completionDate &&
        formData.completionDate !== originalData.completionDate
      ) {
        editedFields.completionDate = formData.completionDate;
      }

      if (formData.conditions !== originalData.conditions) {
        editedFields.conditions = formData.conditions;
      }

      await counterMutation.mutateAsync({
        offerId,
        editedFields,
        seller: {
          email: sellerEmail,
          name: sellerName || "Seller",
        },
      });
    } catch (error) {
      // Error handling is done in mutation onError
    }
  };

  // Show loading state while fetching offer data
  if (isLoadingOffer) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Loading offer details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Banner visible={true} icon="alert-circle" style={styles.banner}>
          You are creating a counter-offer. Modify the fields below and proceed
          to sign.
        </Banner>

        <Card style={styles.headerCard}>
          <Card.Content>
            <Text variant="titleLarge">Create Counter-Offer</Text>
            <Text variant="bodyMedium" style={styles.headerSubtext}>
              Modify the terms below. Only changed fields will be included in
              the counter-offer.
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Title title="Financial Terms" titleVariant="titleMedium" />
          <Card.Content>
            {/* Purchase Price */}
            <View style={styles.fieldContainer}>
              <Text variant="labelLarge">Purchase Price</Text>
              {originalData.purchasePrice && (
                <Text variant="bodySmall" style={styles.originalValue}>
                  Original: ${formatCurrency(originalData.purchasePrice)}
                </Text>
              )}
              <TextInput
                mode="outlined"
                value={formData.purchasePrice}
                onChangeText={handlePriceChange}
                placeholder="750,000"
                keyboardType="numeric"
                error={!!errors.purchasePrice}
                style={styles.input}
                left={<TextInput.Affix text="$" />}
              />
              {errors.purchasePrice && (
                <HelperText type="error" visible={true}>
                  {errors.purchasePrice}
                </HelperText>
              )}
            </View>

            {/* Deposit */}
            <View style={styles.fieldContainer}>
              <Text variant="labelLarge">Deposit</Text>
              {originalData.deposit && (
                <Text variant="bodySmall" style={styles.originalValue}>
                  Original: ${formatCurrency(originalData.deposit)}
                </Text>
              )}
              <TextInput
                mode="outlined"
                value={formData.deposit}
                onChangeText={handleDepositChange}
                placeholder="50,000"
                keyboardType="numeric"
                error={!!errors.deposit}
                style={styles.input}
                left={<TextInput.Affix text="$" />}
              />
              {errors.deposit && (
                <HelperText type="error" visible={true}>
                  {errors.deposit}
                </HelperText>
              )}
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Title title="Dates & Conditions" titleVariant="titleMedium" />
          <Card.Content>
            {/* Completion Date */}
            <View style={styles.fieldContainer}>
              <Text variant="labelLarge">Completion Date</Text>
              {originalData.completionDate && (
                <Text variant="bodySmall" style={styles.originalValue}>
                  Original:{" "}
                  {new Date(originalData.completionDate).toLocaleDateString()}
                </Text>
              )}
              <TextInput
                mode="outlined"
                value={formData.completionDate}
                onChangeText={(text) => updateField("completionDate", text)}
                placeholder="YYYY-MM-DD"
                error={!!errors.completionDate}
                style={styles.input}
              />
              {errors.completionDate && (
                <HelperText type="error" visible={true}>
                  {errors.completionDate}
                </HelperText>
              )}
              <HelperText type="info" visible={true}>
                Format: YYYY-MM-DD (e.g., 2024-03-30)
              </HelperText>
            </View>

            {/* Conditions */}
            <View style={styles.fieldContainer}>
              <Text variant="labelLarge">Conditions</Text>
              {originalData.conditions && (
                <Text
                  variant="bodySmall"
                  style={styles.originalValue}
                  numberOfLines={3}
                >
                  Original: {originalData.conditions}
                </Text>
              )}
              <TextInput
                mode="outlined"
                value={formData.conditions}
                onChangeText={(text) => updateField("conditions", text)}
                placeholder="Enter any conditions..."
                multiline
                numberOfLines={6}
                error={!!errors.conditions}
                style={styles.input}
              />
              {errors.conditions && (
                <HelperText type="error" visible={true}>
                  {errors.conditions}
                </HelperText>
              )}
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Title title="Seller Information" titleVariant="titleMedium" />
          <Card.Content>
            <View style={styles.fieldContainer}>
              <Text variant="labelLarge">Name</Text>
              <Text variant="bodyMedium" style={styles.readOnlyText}>
                {sellerName}
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text variant="labelLarge">Email</Text>
              <Text variant="bodyMedium" style={styles.readOnlyText}>
                {sellerEmail}
              </Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={counterMutation.isPending}
            disabled={counterMutation.isPending || !hasChanges()}
            style={styles.submitButton}
          >
            Continue to Sign Counter-Offer
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  banner: {
    marginBottom: 8,
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
  },
  headerSubtext: {
    marginTop: 8,
    color: "#666",
  },
  sectionCard: {
    margin: 16,
    marginTop: 8,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  originalValue: {
    marginTop: 4,
    marginBottom: 4,
    color: "#666",
    fontStyle: "italic",
  },
  input: {
    marginTop: 4,
  },
  readOnlyText: {
    marginTop: 4,
    padding: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  submitButton: {
    paddingVertical: 8,
  },
});
