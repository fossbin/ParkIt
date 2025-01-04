import React, { useState } from 'react';
import { View, StyleSheet, Text, FlatList } from 'react-native';
import { Button } from 'react-native-rapi-ui';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';

export default function DocumentUploadScreen() {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [loading, setLoading] = useState(false);

  const uploadDocument = async () => {
    try {
      // Pick document
      const doc = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf'
      });

      if (doc.canceled) {
        return;
      }

      setUploading(true);
      
      // Get file contents
      const base64File = await FileSystem.readAsStringAsync(doc.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from('vehicle_ownership')
        .upload(`test_${Date.now()}.pdf`, decode(base64File), {
          contentType: 'application/pdf'
        });

      if (error) {
        console.error('Upload error:', error.message);
        alert('Upload failed');
        return;
      }

      console.log('Upload success:', data);
      alert('Upload successful!');
      // Refresh file list after upload
      listFiles();

    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred');
    } finally {
      setUploading(false);
    }
  };

  const listFiles = async () => {
    try {
      setLoading(true);
      
      // List all files in the bucket
      const { data: fileList, error } = await supabase.storage
        .from('vehicle_ownership')
        .list();

      if (error) {
        throw error;
      }

      if (fileList) {
        // Get signed URLs for each file
        const filesWithUrls = await Promise.all(
          fileList.map(async (file) => {
            const { data: signedUrl } = await supabase.storage
              .from('vehicle_ownership')
              .createSignedUrl(file.name, 3600); // URL valid for 1 hour

            return {
              name: file.name,
              url: signedUrl?.signedUrl || ''
            };
          })
        );
        setFiles(filesWithUrls);
      }

    } catch (error) {
      console.error('Error listing files:', error);
      alert('Error loading files');
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening file:', error);
      alert('Error opening file');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button
          text={uploading ? "Uploading..." : "Upload PDF"}
          onPress={uploadDocument}
          disabled={uploading}
          style={styles.button}
        />
        <Button
          text={loading ? "Loading..." : "View Files"}
          onPress={listFiles}
          disabled={loading}
          style={styles.button}
        />
      </View>

      {files.length > 0 && (
        <View style={styles.fileList}>
          <Text style={styles.fileListTitle}>Uploaded Files:</Text>
          <FlatList
            data={files}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <View style={styles.fileItem}>
                <Text numberOfLines={1} style={styles.fileName}>{item.name}</Text>
                <Button
                  text="Open"
                  onPress={() => openFile(item.url)}
                  style={styles.openButton}
                />
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

// Helper function to decode base64
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flex: 0.48,
  },
  fileList: {
    flex: 1,
  },
  fileListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
    borderRadius: 8,
  },
  fileName: {
    flex: 1,
    marginRight: 10,
  },
  openButton: {
    width: 80,
  }
});