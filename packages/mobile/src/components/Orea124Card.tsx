import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Card, Text, Button, Divider, IconButton } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import type { Attachment, Orea124ParseResult } from "@smart-brokerage/shared";

interface Orea124CardProps {
  attachment: Attachment;
  onViewDocument?: (attachmentId: string) => void;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MAX_PREVIEW_LENGTH = 60; // Characters to show in collapsed state

export default function Orea124Card({
  attachment,
  onViewDocument,
}: Orea124CardProps) {
  const navigation = useNavigation<NavigationProp>();
  const [expandedConditions, setExpandedConditions] = useState<Set<number>>(
    new Set()
  );

  // Extract OREA-124 data from documentAnalysis
  const documentAnalysis = attachment.documentAnalysis;
  const isOrea124 =
    documentAnalysis?.formType?.includes("Form 124") ?? false;
  const orea124Data: Orea124ParseResult | null =
    documentAnalysis?.formFieldsExtracted as Orea124ParseResult | null;

  // If not an OREA-124 form, don't render
  if (!isOrea124 || !orea124Data) {
    return null;
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const handleViewDocument = () => {
    if (onViewDocument) {
      onViewDocument(attachment.id);
    } else {
      navigation.navigate("DocumentViewer", {
        attachmentId: attachment.id,
        filename: attachment.filename,
      });
    }
  };

  const toggleCondition = (index: number) => {
    const newExpanded = new Set(expandedConditions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedConditions(newExpanded);
  };

  const isConditionExpanded = (index: number) => {
    return expandedConditions.has(index);
  };

  const shouldTruncate = (text: string) => {
    return text.length > MAX_PREVIEW_LENGTH;
  };

  const getPreviewText = (text: string) => {
    if (text.length <= MAX_PREVIEW_LENGTH) {
      return text;
    }
    return text.substring(0, MAX_PREVIEW_LENGTH) + "...";
  };

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text variant="titleMedium" style={styles.title}>
              📋 Notice of Fulfillment (OREA-124)
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              {attachment.filename}
            </Text>
          </View>
        </View>

        {/* Document Date */}
        {orea124Data.documentDate && (
          <View style={styles.dateContainer}>
            <Text variant="labelMedium" style={styles.dateLabel}>
              Document Date:
            </Text>
            <Text variant="bodyMedium" style={styles.dateValue}>
              {formatDate(orea124Data.documentDate)}
            </Text>
          </View>
        )}

        {/* Fulfilled Conditions */}
        {orea124Data.fulfilledConditions &&
        orea124Data.fulfilledConditions.length > 0 ? (
          <View style={styles.conditionsContainer}>
            <Text variant="titleSmall" style={styles.conditionsTitle}>
              Fulfilled Conditions ({orea124Data.fulfilledConditions.length})
            </Text>
            <Divider style={styles.divider} />
            {orea124Data.fulfilledConditions.map((condition, index) => {
              const isExpanded = isConditionExpanded(index);
              const needsTruncation = shouldTruncate(condition.description);
              const displayText = isExpanded
                ? condition.description
                : getPreviewText(condition.description);

              const ConditionContent = (
                <View style={styles.conditionHeader}>
                  <View style={styles.conditionNumber}>
                    <Text
                      variant="labelLarge"
                      style={styles.conditionNumberText}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.conditionContent}>
                    <View style={styles.conditionTextContainer}>
                      <Text
                        variant="bodyMedium"
                        style={styles.conditionDescription}
                      >
                        {displayText}
                      </Text>
                      {needsTruncation && (
                        <IconButton
                          icon={isExpanded ? "chevron-up" : "chevron-down"}
                          size={20}
                          iconColor="#4CAF50"
                          style={styles.expandIcon}
                        />
                      )}
                    </View>
                    {condition.note && (
                      <Text variant="bodySmall" style={styles.conditionNote}>
                        Note: {condition.note}
                      </Text>
                    )}
                  </View>
                </View>
              );

              return (
                <View key={index} style={styles.conditionItem}>
                  {needsTruncation ? (
                    <TouchableOpacity
                      onPress={() => toggleCondition(index)}
                      activeOpacity={0.7}
                    >
                      {ConditionContent}
                    </TouchableOpacity>
                  ) : (
                    ConditionContent
                  )}
                  {index < orea124Data.fulfilledConditions.length - 1 && (
                    <Divider style={styles.conditionDivider} />
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.noConditionsContainer}>
            <Text variant="bodyMedium" style={styles.noConditionsText}>
              No conditions found in this document.
            </Text>
          </View>
        )}

        {/* Errors (if any) */}
        {orea124Data.errors && orea124Data.errors.length > 0 && (
          <View style={styles.errorsContainer}>
            <Text variant="labelMedium" style={styles.errorsTitle}>
              ⚠️ Parsing Errors:
            </Text>
            {orea124Data.errors.map((error, index) => (
              <Text key={index} variant="bodySmall" style={styles.errorText}>
                • {error}
              </Text>
            ))}
          </View>
        )}

        {/* Action Button */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleViewDocument}
            style={styles.viewButton}
            icon="file-document"
          >
            View Document
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 12,
    marginHorizontal: 8,
    backgroundColor: "#E8F5E9", // Light green to distinguish from offers
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  header: {
    marginBottom: 12,
  },
  headerContent: {
    gap: 4,
  },
  title: {
    fontWeight: "bold",
    color: "#2E7D32",
  },
  subtitle: {
    color: "#666",
    marginTop: 2,
  },
  dateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F1F8F4",
    borderRadius: 8,
    marginBottom: 16,
  },
  dateLabel: {
    color: "#666",
  },
  dateValue: {
    color: "#2E7D32",
    fontWeight: "600",
  },
  conditionsContainer: {
    marginBottom: 16,
  },
  conditionsTitle: {
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 8,
  },
  divider: {
    marginBottom: 12,
  },
  conditionItem: {
    marginBottom: 12,
  },
  conditionHeader: {
    flexDirection: "row",
    gap: 12,
  },
  conditionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  conditionNumberText: {
    color: "#fff",
    fontWeight: "bold",
  },
  conditionContent: {
    flex: 1,
    gap: 4,
  },
  conditionTextContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  conditionDescription: {
    color: "#333",
    lineHeight: 20,
    flex: 1,
  },
  expandIcon: {
    margin: 0,
    padding: 0,
    width: 24,
    height: 24,
  },
  conditionNote: {
    color: "#666",
    fontStyle: "italic",
    marginTop: 4,
  },
  conditionDivider: {
    marginTop: 12,
    marginLeft: 44, // Align with condition content
  },
  noConditionsContainer: {
    padding: 16,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    marginBottom: 16,
  },
  noConditionsText: {
    color: "#E65100",
    textAlign: "center",
  },
  errorsContainer: {
    padding: 12,
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    marginBottom: 16,
  },
  errorsTitle: {
    color: "#C62828",
    marginBottom: 8,
    fontWeight: "bold",
  },
  errorText: {
    color: "#C62828",
    marginBottom: 4,
  },
  actions: {
    marginTop: 8,
  },
  viewButton: {
    backgroundColor: "#4CAF50",
  },
});

