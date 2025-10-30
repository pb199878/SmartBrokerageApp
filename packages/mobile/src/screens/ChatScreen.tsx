import React, { useState, useRef, useEffect } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, ActivityIndicator, Chip } from "react-native-paper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { threadsApi, messagesApi, offersApi } from "../services/api";
import type { RootStackParamList } from "../navigation/AppNavigator";
import type { Message } from "@smart-brokerage/shared";
import {
  MessageDirection,
  MessageStatus,
  MessageSubCategory,
} from "@smart-brokerage/shared";
import OfferCard from "../components/OfferCard";

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChatScreen() {
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { threadId } = route.params;
  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => threadsApi.getMessages(threadId),
    refetchInterval: 3000, // Poll every 3 seconds for new messages
    refetchIntervalInBackground: false, // Only poll when app is active
  });

  const { data: offers } = useQuery({
    queryKey: ["offers", threadId],
    queryFn: () => threadsApi.getOffers(threadId),
    refetchInterval: 5000, // Poll for offer updates
    refetchIntervalInBackground: false,
  });

  const sendMutation = useMutation({
    mutationFn: messagesApi.send,
    onMutate: async (newMessage) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["messages", threadId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<Message[]>([
        "messages",
        threadId,
      ]);

      // Optimistically update to show message immediately
      if (previousMessages) {
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          threadId,
          senderId: null,
          senderEmail: "seller@temp.com",
          senderName: "Seller",
          direction: MessageDirection.OUTBOUND,
          subject: "Re: Message",
          bodyText: newMessage.text,
          bodyHtml: null,
          status: MessageStatus.PENDING,
          rawEmailS3Key: null,
          createdAt: new Date(),
        };
        queryClient.setQueryData<Message[]>(
          ["messages", threadId],
          [...previousMessages, optimisticMessage]
        );
      }

      return { previousMessages };
    },
    onSuccess: () => {
      // Refetch to get the real message from server
      queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
      setMessageText("");
    },
    onError: (err, newMessage, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["messages", threadId],
          context.previousMessages
        );
      }
    },
  });

  const continueToSignMutation = useMutation({
    mutationFn: offersApi.getSignUrl,
    onSuccess: (data, offerId) => {
      // Navigate to Dropbox Sign WebView for signing
      navigation.navigate("DropboxSign", {
        signUrl: data.signUrl,
        offerId: offerId,
      });
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          "Failed to get signing URL. Please try again."
      );
    },
  });

  const resendMutation = useMutation({
    mutationFn: messagesApi.resend,
    onMutate: async (messageId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["messages", threadId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<Message[]>([
        "messages",
        threadId,
      ]);

      // Optimistically update status to PENDING
      if (previousMessages) {
        const updatedMessages = previousMessages.map((msg) =>
          msg.id === messageId ? { ...msg, status: MessageStatus.PENDING } : msg
        );
        queryClient.setQueryData<Message[]>(
          ["messages", threadId],
          updatedMessages
        );
      }

      return { previousMessages };
    },
    onSuccess: () => {
      // Refetch to get the updated message from server
      queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
    },
    onError: (err, messageId, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["messages", threadId],
          context.previousMessages
        );
      }
    },
  });

  useEffect(() => {
    // Mark thread as read when opened
    threadsApi.markAsRead(threadId);
  }, [threadId]);

  // Scroll to bottom when messages are first loaded
  useEffect(() => {
    if (messages && messages.length > 0) {
      // Use setTimeout to ensure the FlatList has rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages?.length && messages[0]?.id]); // Only trigger on initial load

  const handleSend = () => {
    if (!messageText.trim()) return;

    sendMutation.mutate({
      threadId,
      text: messageText.trim(),
    });
  };

  const getStatusIcon = (status: MessageStatus) => {
    switch (status) {
      case MessageStatus.SENT:
      case MessageStatus.DELIVERED:
        return "✓"; // Checkmark for sent/delivered
      case MessageStatus.PENDING:
        return "○"; // Circle for pending
      case MessageStatus.FAILED:
        return "⚠"; // Warning for failed
      default:
        return "";
    }
  };

  const getStatusColor = (status: MessageStatus) => {
    switch (status) {
      case MessageStatus.SENT:
      case MessageStatus.DELIVERED:
        return "#4CAF50"; // Green
      case MessageStatus.PENDING:
        return "#FFC107"; // Amber
      case MessageStatus.FAILED:
        return "#F44336"; // Red
      default:
        return "#999";
    }
  };

  const handleResend = (messageId: string) => {
    resendMutation.mutate(messageId);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOutbound = item.direction === MessageDirection.OUTBOUND;
    const isFailed = item.status === MessageStatus.FAILED;
    const isRetrying =
      resendMutation.isPending && resendMutation.variables === item.id;
    const hasAttachments = item.attachments && item.attachments.length > 0;
    const hasOffer =
      item.offerId &&
      item.subCategory &&
      (item.subCategory === MessageSubCategory.NEW_OFFER ||
        item.subCategory === MessageSubCategory.UPDATED_OFFER);

    return (
      <View style={{ marginBottom: 8 }}>
        {/* Show OfferCard if message contains an offer */}
        {hasOffer && offers && (
          <OfferCard
            offer={offers.find((o) => o.id === item.offerId)!}
            onAccept={(offerId) =>
              navigation.navigate("OfferAction", { offerId, action: "accept" })
            }
            onDecline={(offerId) =>
              navigation.navigate("OfferAction", { offerId, action: "decline" })
            }
            onCounter={(offerId) =>
              navigation.navigate("OfferAction", { offerId, action: "counter" })
            }
            onContinueToSign={(offerId) =>
              continueToSignMutation.mutate(offerId)
            }
            onViewDocument={(offerId) => {
              const offer = offers.find((o) => o.id === offerId);
              if (offer?.originalDocumentS3Key && item.attachments?.[0]) {
                navigation.navigate("DocumentViewer", {
                  attachmentId: item.attachments[0].id,
                  filename: item.attachments[0].filename,
                });
              }
            }}
          />
        )}

        {/* Regular message bubble */}
        <View
          style={[
            styles.messageBubble,
            isOutbound ? styles.outboundBubble : styles.inboundBubble,
            isFailed && styles.failedBubble,
          ]}
        >
          {!isOutbound && (
            <Text variant="labelSmall" style={styles.senderName}>
              {item.senderName}
            </Text>
          )}

          {/* Classification badge (for debugging/admin) */}
          {item.subCategory &&
            item.subCategory !== MessageSubCategory.GENERAL && (
              <View style={styles.classificationBadge}>
                <Chip mode="flat" compact textStyle={{ fontSize: 10 }}>
                  {item.subCategory} (
                  {Math.round(item.classificationConfidence || 0)}%)
                </Chip>
              </View>
            )}

          <Text style={[styles.messageText, isOutbound && styles.outboundText]}>
            {item.bodyText}
          </Text>

          {/* Attachments */}
          {hasAttachments && !hasOffer && (
            <View style={styles.attachments}>
              {item.attachments!.map((att) => (
                <TouchableOpacity
                  key={att.id}
                  style={styles.attachmentChip}
                  onPress={() =>
                    navigation.navigate("DocumentViewer", {
                      attachmentId: att.id,
                      filename: att.filename,
                    })
                  }
                >
                  <Text style={styles.attachmentIcon}>📎</Text>
                  <Text style={styles.attachmentText} numberOfLines={1}>
                    {att.filename}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.messageFooter}>
            <Text
              variant="labelSmall"
              style={[styles.messageTime, isOutbound && styles.outboundText]}
            >
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {isOutbound && !isRetrying && (
              <Text
                style={[
                  styles.statusIcon,
                  { color: getStatusColor(item.status) },
                ]}
              >
                {getStatusIcon(item.status)}
              </Text>
            )}
            {isRetrying && (
              <View style={styles.retryingIndicator}>
                <ActivityIndicator size="small" color="#FFC107" />
                <Text style={styles.retryingText}>Sending...</Text>
              </View>
            )}
            {isFailed && !isRetrying && (
              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => handleResend(item.id)}
                disabled={resendMutation.isPending}
              >
                <Text style={styles.resendButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        renderItem={renderMessage}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          multiline
          maxLength={5000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !messageText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!messageText.trim() || sendMutation.isPending}
        >
          <Text
            style={[
              styles.sendIcon,
              !messageText.trim() && styles.sendIconDisabled,
            ]}
          >
            ➤
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messagesList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  inboundBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  outboundBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2196F3",
    borderBottomRightRadius: 4,
  },
  failedBubble: {
    backgroundColor: "#FFCDD2", // Light red for failed messages
  },
  senderName: {
    fontWeight: "bold",
    marginBottom: 4,
    color: "#666",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#000",
  },
  outboundText: {
    color: "#fff",
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    color: "#999",
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: "bold",
  },
  resendButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#F44336",
    borderRadius: 12,
  },
  resendButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  retryingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 4,
  },
  retryingText: {
    color: "#FFC107",
    fontSize: 11,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.3,
    backgroundColor: "#ccc",
  },
  sendIcon: {
    fontSize: 20,
    color: "#fff",
  },
  sendIconDisabled: {
    color: "#999",
  },
  classificationBadge: {
    marginBottom: 8,
  },
  attachments: {
    marginTop: 8,
    gap: 6,
  },
  attachmentChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  attachmentIcon: {
    fontSize: 16,
  },
  attachmentText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
});
