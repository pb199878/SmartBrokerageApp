import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Card, HelperText, Divider } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp, NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { usePrepareAgreement } from '../hooks/agreements';
import { getGuidanceBySections, ApsIntake } from '@smart-brokerage/shared';

type ApsGuidedFormRouteProp = RouteProp<RootStackParamList, 'ApsGuidedForm'>;
type NavigationProps = NavigationProp<RootStackParamList>;

export default function ApsGuidedFormScreen() {
  const route = useRoute<ApsGuidedFormRouteProp>();
  const navigation = useNavigation<NavigationProps>();
  const { listingId, attachmentId, sellerEmail, sellerName } = route.params;

  const prepareMutation = usePrepareAgreement();
  const guidanceSections = getGuidanceBySections();

  // Form state - Only seller-specific fields
  const [formData, setFormData] = useState<ApsIntake>({
    sellerLegalName: sellerName || '',
    sellerAddress: '',
    sellerPhone: '',
    sellerEmail: sellerEmail || '',
    lawyerName: '',
    lawyerFirm: '',
    lawyerAddress: '',
    lawyerPhone: '',
    lawyerEmail: '',
    exclusions: '',
    rentalItems: '',
    sellerNotes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof ApsIntake, value: any) => {
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // All fields are optional since they're prefilled from listing
    // Seller just needs to review and can add exclusions/notes
    // No validation needed for now

    setErrors(newErrors);
    return true; // Always valid
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    try {
      const result = await prepareMutation.mutateAsync({
        source: {
          type: 'attachment',
          attachmentId,
        },
        listingId,
        seller: {
          email: sellerEmail,
          name: sellerName,
        },
        intake: formData,
      });

      // Navigate to signing screen
      navigation.navigate('ApsSigning', {
        agreementId: result.agreementId,
        signUrl: result.signUrl,
        listingId,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to prepare agreement');
    }
  };

  const renderSection = (sectionTitle: string) => {
    const fields = guidanceSections[sectionTitle];
    if (!fields) return null;

    return (
      <Card key={sectionTitle} style={styles.sectionCard}>
        <Card.Title title={sectionTitle} titleVariant="titleMedium" />
        <Card.Content>
          {fields.map((guidance) => {
            const field = guidance.field as keyof ApsIntake;
            const value = formData[field];

            return (
              <View key={guidance.field} style={styles.fieldContainer}>
                <Text variant="labelLarge">{guidance.title}</Text>
                <Text variant="bodySmall" style={styles.description}>
                  {guidance.description}
                </Text>
                
                <TextInput
                  mode="outlined"
                  value={String(value || '')}
                  onChangeText={(text) => updateField(field, text)}
                  placeholder={guidance.example}
                  multiline={
                    field === 'inclusions' ||
                    field === 'exclusions' ||
                    field === 'fixtures' ||
                    field === 'chattels' ||
                    field === 'rentalItems'
                  }
                  numberOfLines={
                    field === 'inclusions' ||
                    field === 'exclusions' ||
                    field === 'fixtures' ||
                    field === 'chattels' ||
                    field === 'rentalItems'
                      ? 4
                      : 1
                  }
                  error={!!errors[field]}
                  style={styles.input}
                />
                
                {errors[field] && (
                  <HelperText type="error" visible={!!errors[field]}>
                    {errors[field]}
                  </HelperText>
                )}

                {guidance.tips && guidance.tips.length > 0 && (
                  <View style={styles.tipsContainer}>
                    <Text variant="bodySmall" style={styles.tipsTitle}>
                      💡 Tips:
                    </Text>
                    {guidance.tips.map((tip, idx) => (
                      <Text key={idx} variant="bodySmall" style={styles.tip}>
                        • {tip}
                      </Text>
                    ))}
                  </View>
                )}

                <Divider style={styles.fieldDivider} />
              </View>
            );
          })}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text variant="titleLarge">Review Your Information</Text>
            <Text variant="bodyMedium" style={styles.headerSubtext}>
              Your contact and lawyer details are prefilled from your listing. Review them and add any items you're excluding or rental items, then proceed to sign.
            </Text>
          </Card.Content>
        </Card>

        {Object.keys(guidanceSections).map((sectionTitle) =>
          renderSection(sectionTitle)
        )}

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={prepareMutation.isPending}
            disabled={prepareMutation.isPending}
            style={styles.submitButton}
          >
            Continue to Sign
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
  },
  headerSubtext: {
    marginTop: 8,
    color: '#666',
  },
  sectionCard: {
    margin: 16,
    marginTop: 8,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  description: {
    marginTop: 4,
    marginBottom: 8,
    color: '#666',
  },
  input: {
    marginTop: 4,
  },
  tipsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  tipsTitle: {
    fontWeight: '600',
    marginBottom: 4,
    color: '#1976d2',
  },
  tip: {
    marginTop: 2,
    color: '#1565c0',
  },
  fieldDivider: {
    marginTop: 12,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  submitButton: {
    paddingVertical: 8,
  },
});

