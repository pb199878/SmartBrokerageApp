import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import { ActivityIndicator, Text, Button, Appbar } from 'react-native-paper';
import Pdf from 'react-native-pdf';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { attachmentsApi } from '../services/api';

type DocumentViewerRouteProp = RouteProp<RootStackParamList, 'DocumentViewer'>;

export default function DocumentViewerScreen() {
  const route = useRoute<DocumentViewerRouteProp>();
  const navigation = useNavigation();
  const { attachmentId, filename } = route.params;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    loadPdf();
  }, [attachmentId]);

  const loadPdf = async () => {
    try {
      setLoading(true);
      const url = await attachmentsApi.getDownloadUrl(attachmentId);
      setPdfUrl(url);
    } catch (error) {
      console.error('Failed to load PDF:', error);
      Alert.alert(
        'Error',
        'Failed to load document. Please try again.',
        [
          {
            text: 'Retry',
            onPress: loadPdf,
          },
          {
            text: 'Cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading || !pdfUrl) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading document...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={filename || 'Document'} />
      </Appbar.Header>

      <View style={styles.pdfContainer}>
        <Pdf
          source={{ uri: pdfUrl }}
          style={styles.pdf}
          onLoadComplete={(numberOfPages) => {
            console.log(`PDF loaded: ${numberOfPages} pages`);
            setTotalPages(numberOfPages);
          }}
          onPageChanged={(page, numberOfPages) => {
            setPage(page);
          }}
          onError={(error) => {
            console.error('PDF error:', error);
            Alert.alert('Error', 'Failed to display PDF');
          }}
          trustAllCerts={false}
          enablePaging={true}
          horizontal={false}
        />
      </View>

      {totalPages > 0 && (
        <View style={styles.footer}>
          <Text variant="bodyMedium">
            Page {page} of {totalPages}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  pdfContainer: {
    flex: 1,
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  footer: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
});

