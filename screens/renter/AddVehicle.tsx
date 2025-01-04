import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import { supabase } from '../../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Session } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';
import VehicleTypePicker from '../../components/VehicleTypePicker'; 

const MAX_DOCUMENTS = 3;
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024; // 5MB
const STORAGE_BUCKET = 'vehicle_ownership';

interface DocumentState {
  name: string;
  uri: string;
}

interface FormErrors {
  manufacturer?: string;
  model?: string;
  licensePlate?: string;
  vehicleType?: string;
  documents?: string;
}

const AddVehicleScreen: React.FC = () => {
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [documents, setDocuments] = useState<DocumentState[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const navigation = useNavigation();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error('Error fetching session:', error);
      }
    };
    fetchSession();
  }, []);

  const validateLicensePlate = (plate: string): boolean => {
    const licensePlateRegex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;
    return licensePlateRegex.test(plate);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!manufacturer.trim()) {
      errors.manufacturer = 'Manufacturer is required';
    }

    if (!model.trim()) {
      errors.model = 'Model is required';
    }

    if (!vehicleType) {
      errors.vehicleType = 'Vehicle type is required';
    }

    if (!licensePlate.trim()) {
      errors.licensePlate = 'License plate is required';
    } else if (!validateLicensePlate(licensePlate)) {
      errors.licensePlate = 'Invalid license plate format';
    }

    if (documents.length === 0) {
      errors.documents = 'At least one ownership document is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const uploadDocument = async (document: DocumentState): Promise<string> => {
    try {
      // Read file as base64
      const base64File = await FileSystem.readAsStringAsync(document.uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Convert base64 to Uint8Array
      const binaryString = atob(base64File);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (bytes.length > MAX_DOCUMENT_SIZE) {
        throw new Error('Document size must be less than 5MB');
      }

      const fileName = `${session?.user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, bytes, {
          contentType: 'application/pdf',
          cacheControl: '3600'
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  };

  const handleDocumentPick = async () => {
    if (documents.length >= MAX_DOCUMENTS) {
      Alert.alert('Maximum Documents', `You can only upload up to ${MAX_DOCUMENTS} documents`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true
      });

      if (result.canceled) {
        return;
      }

      const newDocuments = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || 'document.pdf',
      }));

      const totalDocuments = [...documents, ...newDocuments].slice(0, MAX_DOCUMENTS);
      setDocuments(totalDocuments);
      setFormErrors(prev => ({ ...prev, documents: undefined }));
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick documents');
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
    if (documents.length <= 1) {
      setFormErrors(prev => ({ ...prev, documents: 'At least one document is required' }));
    }
  };

  const handleAddVehicle = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please check all required fields');
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to add a vehicle');
      return;
    }

    setIsLoading(true);

    try {
      const documentUrls = await Promise.all(documents.map(uploadDocument));

      const { error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          renter_id: session.user.id,
          manufacturer: manufacturer,
          model: model,
          license_plate: licensePlate.toUpperCase(),
          vehicle_type: vehicleType,
          ownership_documents: documentUrls,
        })
        .select()
        .single();

      if (vehicleError) {
        // Cleanup uploaded files if vehicle insertion fails
        await Promise.all(
          documentUrls.map(url => {
            const path = url.split('/').slice(-1)[0];
            return supabase.storage.from(STORAGE_BUCKET).remove([path]);
          })
        );
        throw vehicleError;
      }

      Alert.alert(
        'Success',
        'Vehicle added successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setManufacturer('');
    setModel('');
    setLicensePlate('');
    setVehicleType('');
    setDocuments([]);
    setFormErrors({});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Add New Vehicle</Text>
          <Text style={styles.subtitle}>Please provide your vehicle details and documents</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formSection}>
            <Text style={styles.label}>Manufacturer <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[
                styles.input,
                !!formErrors.manufacturer && styles.inputError
              ]}
              placeholder="Enter vehicle manufacturer"
              value={manufacturer}
              onChangeText={text => {
                setManufacturer(text);
                setFormErrors(prev => ({ ...prev, manufacturer: undefined }));
              }}
              maxLength={100}
              placeholderTextColor="#A0AEC0"
            />
            {formErrors.manufacturer && (
              <Text style={styles.errorText}>{formErrors.manufacturer}</Text>
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Model <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[
                styles.input,
                !!formErrors.model && styles.inputError
              ]}
              placeholder="Enter vehicle model"
              value={model}
              onChangeText={text => {
                setModel(text);
                setFormErrors(prev => ({ ...prev, model: undefined }));
              }}
              maxLength={100}
              placeholderTextColor="#A0AEC0"
            />
            {formErrors.model && (
              <Text style={styles.errorText}>{formErrors.model}</Text>
            )}
          </View>

          {/* New Vehicle Type Section */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Vehicle Type <Text style={styles.required}>*</Text></Text>
            <VehicleTypePicker
              selectedValue={vehicleType}
              onValueChange={(value: React.SetStateAction<string>) => {
                setVehicleType(value);
                setFormErrors(prev => ({ ...prev, vehicleType: undefined }));
              }}
              error={!!formErrors.vehicleType}
            />
            {formErrors.vehicleType && (
              <Text style={styles.errorText}>{formErrors.vehicleType}</Text>
            )}
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.label}>License Plate <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[
                styles.input,
                !!formErrors.licensePlate && styles.inputError
              ]}
              placeholder="Enter license plate"
              value={licensePlate}
              onChangeText={text => {
                setLicensePlate(text.toUpperCase());
                setFormErrors(prev => ({ ...prev, licensePlate: undefined }));
              }}
              autoCapitalize="characters"
              maxLength={10}
              placeholderTextColor="#A0AEC0"
            />
            {formErrors.licensePlate && (
              <Text style={styles.errorText}>{formErrors.licensePlate}</Text>
            )}
          </View>

          <View style={styles.formSection}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>
                Ownership Documents <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.documentsCount}>
                {documents.length}/{MAX_DOCUMENTS}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[
                styles.uploadButton,
                documents.length > 0 && styles.uploadButtonSuccess,
                documents.length >= MAX_DOCUMENTS && styles.uploadButtonDisabled
              ]}
              onPress={handleDocumentPick}
              disabled={documents.length >= MAX_DOCUMENTS}
            >
              <Text
                style={[
                  styles.uploadButtonText,
                  documents.length > 0 && styles.uploadButtonTextSuccess
                ]}
              >
                {documents.length >= MAX_DOCUMENTS ? 'Maximum documents reached' : 'Upload PDF Documents'}
              </Text>
            </TouchableOpacity>

            <View style={styles.documentsContainer}>
              {documents.map((doc, index) => (
                <View key={index} style={styles.documentItem}>
                  <View style={styles.documentIcon}>
                    <Text style={styles.documentIconText}>PDF</Text>
                  </View>
                  <Text style={styles.documentName} numberOfLines={1}>
                    {doc.name}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeDocumentButton}
                    onPress={() => removeDocument(index)}
                  >
                    <Text style={styles.removeDocumentText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            {formErrors.documents && (
              <Text style={styles.errorText}>{formErrors.documents}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.addButton, isLoading && styles.addButtonDisabled]}
            onPress={handleAddVehicle}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.addButtonText}>Add Vehicle</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A365D',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4A5568',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formSection: {
    marginBottom: 24,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  required: {
    color: '#E53E3E',
  },
  documentsCount: {
    fontSize: 14,
    color: '#718096',
  },
  vehicleTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  vehicleTypeButton: {
    padding: 10,
    margin: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F7FAFC',
  },
  vehicleTypeButtonSelected: {
    borderColor: '#4299E1',
    backgroundColor: '#EBF8FF',
  },
  vehicleTypeText: {
    fontSize: 14,
    color: '#4A5568',
  },
  vehicleTypeTextSelected: {
    color: '#2B6CB0',
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#2D3748',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#E53E3E',
    borderWidth: 2,
  },
  uploadButton: {
    padding: 16,
    backgroundColor: '#4299E1',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadButtonSuccess: {
    backgroundColor: '#48BB78',
  },
  uploadButtonDisabled: {
    backgroundColor: '#A0AEC0',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  uploadButtonTextSuccess: {
    color: '#FFFFFF',
  },
  documentsContainer: {
    marginTop: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  documentIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#4299E1',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentIconText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    color: '#2D3748',
  },
  removeDocumentButton: {
    width: 24,
    height: 24,
    backgroundColor: '#FC8181',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  removeDocumentText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  addButton: {
    padding: 16,
    backgroundColor: '#4299E1',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#A0AEC0',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 14,
    marginTop: 4,
  },
});

export default AddVehicleScreen;