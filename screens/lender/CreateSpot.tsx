import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Modal, Image, ScrollView, ActivityIndicator, } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import DocumentPicker from 'react-native-document-picker';
import * as Location from 'expo-location';
import { Session } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';

// Constants
const VEHICLE_TYPE_OPTIONS = ['Car', 'Bike', 'SUV'] as const;
const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_LOCATION = {
  latitude: 37.78825,
  longitude: -122.4324,
};

// Types
type VehicleType = typeof VEHICLE_TYPE_OPTIONS[number];

interface LocationState {
  latitude: number;
  longitude: number;
}

interface PhotoState {
  uri: string;
  base64: string;
}

interface DocumentState {
  uri: string;
  name: string;
  type: string;
}

interface FormErrors {
  title?: string;
  price?: string;
  capacity?: string;
  vehicleTypes?: string;
  photos?: string;
  location?: string;
  document?: string;
}

interface LocationPickerProps {
  location: LocationState | null;
  setLocation: (location: LocationState) => void;
  isLocationLoading?: boolean;
  locationError?: string;
  formErrors?: { location?: string };
}
// Add this type for document types
type DocumentType = 'ownership' | 'lease' | 'other';

const CreateSpot: React.FC = () => {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [vehicleTypesAllowed, setVehicleTypesAllowed] = useState<VehicleType[]>([]);
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [ownershipDocument, setOwnershipDocument] = useState<DocumentState | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [tempLocation, setTempLocation] = useState<LocationState | null>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkFormValidity = () => {
      const isValidTitle = title.trim().length > 0;
      const isValidPrice = !isNaN(Number(price)) && Number(price) > 0;
      const isValidCapacity = !isNaN(Number(capacity)) && Number(capacity) > 0 && Number.isInteger(Number(capacity));
      const isValidVehicleTypes = vehicleTypesAllowed.length > 0;
      const isValidPhotos = photos.length > 0;
      const isValidLocation = location !== null;
      const isValidDocument = ownershipDocument !== null;

      const formIsValid = 
        isValidTitle &&
        isValidPrice &&
        isValidCapacity &&
        isValidVehicleTypes &&
        isValidPhotos &&
        isValidLocation &&
        isValidDocument;

      setIsValid(formIsValid);
    };

    checkFormValidity();
  }, [title, price, capacity, vehicleTypesAllowed, photos, location, ownershipDocument]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;
    
    if (!title.trim()) {
      errors.title = 'Title is required';
      isValid = false;
    }
    
    const priceNum = Number(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'Please enter a valid price';
      isValid = false;
    }
    
    const capacityNum = Number(capacity);
    if (!capacity || isNaN(capacityNum) || capacityNum <= 0 || !Number.isInteger(capacityNum)) {
      errors.capacity = 'Please enter a valid capacity (whole number)';
      isValid = false;
    }
    
    if (vehicleTypesAllowed.length === 0) {
      errors.vehicleTypes = 'Please select at least one vehicle type';
      isValid = false;
    }
    
    if (photos.length === 0) {
      errors.photos = 'Please upload at least one photo';
      isValid = false;
    }
    
    if (!location) {
      errors.location = 'Please select a location';
      isValid = false;
    }
    
    if (!ownershipDocument) {
      errors.document = 'Please upload ownership document';
      isValid = false;
    }
    
    setFormErrors(errors);
    
    if (!isValid) {
      Alert.alert(
        "Validation Error",
        "Please fill in all required fields correctly",
        [{ text: "OK" }]
      );
    }
    return isValid;
  };


  useEffect(() => {
    const initializeLocation = async () => {
      setIsLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permission to access location was denied');
          setLocation(DEFAULT_LOCATION);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        setLocationError('');
      } catch (error) {
        setLocationError('Error getting location');
        setLocation(DEFAULT_LOCATION);
      } finally {
        setIsLocationLoading(false);
      }
    };

    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    initializeLocation();
    fetchSession();
  }, []);

  const handleVehicleTypeToggle = (type: VehicleType) => {
    setVehicleTypesAllowed(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
    setFormErrors(prev => ({ ...prev, vehicleTypes: undefined }));
  };

  const validatePhoto = (photo: ImagePicker.ImagePickerAsset): boolean => {
    if (!photo.base64) {
      Alert.alert("Error", "Failed to process photo");
      return false;
    }
    
    if (photo.base64.length > MAX_PHOTO_SIZE) {
      Alert.alert("Error", "Photo size must be less than 5MB");
      return false;
    }
    return true;
  };

  const handleImagePick = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Maximum Photos", `You can only upload up to ${MAX_PHOTOS} photos`);
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please grant access to your photo library");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        base64: true,
        quality: 0.7,
        selectionLimit: MAX_PHOTOS - photos.length,
      });

      if (!pickerResult.canceled && pickerResult.assets) {
        const validPhotos = pickerResult.assets
          .filter(photo => validatePhoto(photo))
          .map(photo => ({
            uri: photo.uri,
            base64: photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : ''
          }))
          .filter(photo => photo.base64);

        if (validPhotos.length + photos.length > MAX_PHOTOS) {
          Alert.alert("Too Many Photos", `You can only upload up to ${MAX_PHOTOS} photos in total`);
          return;
        }

        setPhotos(prevPhotos => [...prevPhotos, ...validPhotos]);
        setFormErrors(prev => ({ ...prev, photos: undefined }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory',
      });
  
      const file = result[0];
      
      // Validate file type
      if (file.type !== 'application/pdf') {
        Alert.alert('Error', 'Please upload a PDF document');
        return;
      }
      
      // Check file size (e.g., 5MB limit)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size && file.size > MAX_FILE_SIZE) {
        Alert.alert('Error', 'File size must be less than 5MB');
        return;
      }
  
      if (file) {
        setOwnershipDocument({
          uri: file.fileCopyUri || file.uri,
          name: file.name || "document.pdf",
          type: file.type || 'application/pdf'
        });
        setFormErrors(prev => ({ ...prev, document: undefined }));
      }
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        console.error('Document picker error:', error);
        Alert.alert('Error', 'Failed to pick document');
      }
    }
  };
  
  const uploadDocument = async (parkingSpaceId: string): Promise<string | null> => {
    if (!ownershipDocument) return null;
  
    try {
      setIsLoading(true);
      
      // Create a FormData object to handle the file
      const response = await fetch(ownershipDocument.uri);
      const blob = await response.blob();
      
      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result?.toString().split(',')[1];
          if (base64) {
            resolve(base64);
          } else {
            reject(new Error('Failed to convert file to base64'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
  
      // Decode base64 for upload
      const decodedFile = decode(base64Data);
      
      // Generate unique filename
      const fileName = `${parkingSpaceId}/${Date.now()}_${ownershipDocument.name}`;
      
      // Upload file to Supabase storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('spot_ownership')
        .upload(fileName, decodedFile, {
          contentType: 'application/pdf',
          cacheControl: '3600'
        });
  
      if (storageError) {
        throw new Error(`Storage error: ${storageError.message}`);
      }
  
      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('spot_ownership')
        .getPublicUrl(storageData.path);
  
      return publicUrl;
  
    } catch (error) {
      console.error('Document upload error:', error);
      throw error;
    }
  };

const deleteDocument = async (parkingSpaceId: string, fileName: string) => {
  try {
    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('spot_ownership')
      .remove([`${parkingSpaceId}/${fileName}`]);

    if (storageError) {
      throw new Error(`Failed to delete file: ${storageError.message}`);
    }

    // Delete database record
    const { error: dbError } = await supabase
      .from('parking_space_documents')
      .delete()
      .match({ parking_space_id: parkingSpaceId });

    if (dbError) {
      throw new Error(`Failed to delete document record: ${dbError.message}`);
    }

  } catch (error) {
    console.error('Document deletion error:', error);
    throw error;
  }
};
  
  // Helper function to decode base64 (add this near the end of the file)
  function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  const removePhoto = (index: number) => {
    setPhotos(prevPhotos => prevPhotos.filter((_, i) => i !== index));
    if (photos.length <= 1) {
      setFormErrors(prev => ({ ...prev, photos: 'Please upload at least one photo' }));
    }
  };

  const handleCreateSpot = async () => {
    if (!isValid) {
      validateForm();
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create the parking space first
      const { data: parkingSpace, error: parkingSpaceError } = await supabase
        .from('parking_spaces')
        .insert({
          user_id: session?.user?.id || '',
          title: title.trim(),
          type: 'Lender-provided',
          price: parseFloat(price),
          capacity: parseInt(capacity),
          vehicle_types_allowed: vehicleTypesAllowed,
          photos: photos.map(photo => photo.base64),
          verified: false,
          review_score: 0,
          added_by: 'Lender',
          status: 'Pending'
        })
        .select()
        .single();

      if (parkingSpaceError || !parkingSpace) {
        throw new Error(parkingSpaceError?.message || "Failed to create parking space");
      }

      // Step 2: Insert location into parking_space_locations table
      const { error: locationError } = await supabase
        .from('parking_space_locations')
        .insert({
          parking_space_id: parkingSpace.id,
          latitude: Number(location?.latitude.toFixed(6) ?? 0),
          longitude: Number(location?.longitude.toFixed(6) ?? 0),
        });

      if (locationError) {
        // Rollback: Delete the parking space if location insertion fails
        await supabase
          .from('parking_spaces')
          .delete()
          .eq('id', parkingSpace.id);
        throw new Error(`Failed to save location: ${locationError.message}`);
      }

      // Step 3: Upload document and create document record in one step
      try {
        const documentUrl = await uploadDocument(parkingSpace.id);
        if (documentUrl) {
          const { error: documentError } = await supabase
            .from('parking_space_documents')
            .insert({
              parking_space_id: parkingSpace.id,
              document_url: documentUrl,
              document_type: 'ownership' as DocumentType,
            });

          if (documentError) {
            // Clean up storage if document record insertion fails
            await deleteDocument(parkingSpace.id, ownershipDocument?.name || '');
            throw documentError;
          }
        }
      } catch (documentError) {
        // Rollback: Delete both parking space and location if document upload fails
        await supabase
          .from('parking_spaces')
          .delete()
          .eq('id', parkingSpace.id);
        throw new Error('Failed to upload document');
      }

      Alert.alert(
        "Success", 
        "Parking spot created successfully. Your documents will be verified shortly.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (newLocation: LocationState) => {
    setTempLocation({
      latitude: Number(newLocation.latitude.toFixed(6)),
      longitude: Number(newLocation.longitude.toFixed(6))
    });
  };

  const confirmLocation = () => {
    if (tempLocation) {
      setLocation(tempLocation);
      setMapVisible(false);
      setFormErrors(prev => ({ ...prev, location: undefined }));
    } else {
      Alert.alert("Error", "Please select a location on the map");
    }
  };

  const resetForm = () => {
    setTitle('');
    setPrice('');
    setCapacity('');
    setVehicleTypesAllowed([]);
    setPhotos([]);
    setOwnershipDocument(null);
    setFormErrors({});
  };


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Create New Parking Spot</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
            style={[
              styles.input,
              formErrors.title ? styles.inputError : null // Use ternary operator instead
            ]}
            placeholder="Enter spot title"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setFormErrors(prev => ({ ...prev, title: undefined }));
            }}
            maxLength={100}
          />
          {formErrors.title && <Text style={styles.errorText}>{formErrors.title}
        </Text>}

        <Text style={styles.label}>Price (per hour) *</Text>
        <TextInput
          style={[
            styles.input,
            formErrors.price ? styles.inputError : null
          ]}
          placeholder="Enter price"
          value={price}
          keyboardType="decimal-pad"
          onChangeText={(text) => {
            setPrice(text);
            setFormErrors(prev => ({ ...prev, price: undefined }));
          }}
        />
        {formErrors.price && <Text style={styles.errorText}>{formErrors.price}</Text>}

        <Text style={styles.label}>Capacity *</Text>
        <TextInput
          style={[
            styles.input,
            formErrors.capacity ? styles.inputError : null
          ]}
          placeholder="Enter capacity"
          value={capacity}
          keyboardType="number-pad"
          onChangeText={(text) => {
            setCapacity(text);
            setFormErrors(prev => ({ ...prev, capacity: undefined }));
          }}
        />
        {formErrors.capacity && <Text style={styles.errorText}>{formErrors.capacity}</Text>}

        <Text style={styles.label}>Vehicle Types Allowed *</Text>
        <View style={styles.vehicleTypesContainer}>
          {VEHICLE_TYPE_OPTIONS.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.vehicleTypeButton,
                vehicleTypesAllowed.includes(type) && styles.vehicleTypeButtonSelected
              ]}
              onPress={() => handleVehicleTypeToggle(type)}
            >
              <Text style={[
                styles.vehicleTypeText,
                vehicleTypesAllowed.includes(type) && styles.vehicleTypeTextSelected
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {formErrors.vehicleTypes && (
          <Text style={styles.errorText}>{formErrors.vehicleTypes}</Text>
        )}

        <Text style={styles.label}>Photos * ({photos.length}/{MAX_PHOTOS})</Text>
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={handleImagePick}
          disabled={photos.length >= MAX_PHOTOS}
        >
          <Text style={styles.uploadButtonText}>
            {photos.length >= MAX_PHOTOS ? 'Maximum photos reached' : 'Upload Photos'}
          </Text>
        </TouchableOpacity>

        <View style={styles.imagePreviewContainer}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri: photo.uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => removePhoto(index)}
              >
                <Text style={styles.removePhotoText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        {formErrors.photos && <Text style={styles.errorText}>{formErrors.photos}</Text>}

        <Text style={styles.label}>Ownership Document * (PDF only)</Text>
        <TouchableOpacity 
          style={[styles.uploadButton, ownershipDocument && styles.uploadButtonSuccess]}
          onPress={handleDocumentPick}
        >
          <Text style={[styles.uploadButtonText, ownershipDocument && styles.uploadButtonTextSuccess]}>
            {ownershipDocument ? 'Document Selected: ' + ownershipDocument.name : 'Upload Ownership Document'}
          </Text>
        </TouchableOpacity>
        {formErrors.document && <Text style={styles.errorText}>{formErrors.document}</Text>}

        <Text style={styles.label}>Location *</Text>
          <TouchableOpacity 
            style={styles.mapPreview} 
            onPress={() => setMapVisible(true)}
          >
            {isLocationLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Getting location...</Text>
              </View>
            ) : location ? (
              <MapView
                style={StyleSheet.absoluteFillObject}
                region={{  
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker coordinate={location} />
              </MapView>
            ) : null}
            <Text style={[styles.mapText, locationError ? styles.errorText : null]}>
              {locationError || "Tap to select location"}
            </Text>
          </TouchableOpacity>
          {formErrors.location && <Text style={styles.errorText}>{formErrors.location}</Text>}

          <Modal visible={mapVisible} animationType="slide">
            <View style={styles.modalContainer}>
              <MapView
                style={styles.fullMap}
                initialRegion={{
                  ...(location || DEFAULT_LOCATION),
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onPress={(event) => {
                  handleLocationSelect(event.nativeEvent.coordinate);
                }}
              >
                {tempLocation && <Marker coordinate={tempLocation} />}
              </MapView>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={confirmLocation}
              >
                <Text style={styles.closeButtonText}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </Modal>
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleCreateSpot}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                Create Spot
              </Text>
            )}
          </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1f2937',
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  vehicleTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  vehicleTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#fff',
  },
  vehicleTypeButtonSelected: {
    backgroundColor: '#3b82f6',
  },
  vehicleTypeText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  vehicleTypeTextSelected: {
    color: '#fff',
  },
  mapPreview: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#f3f4f6',
  },
  mapText: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 8,
  },
  uploadButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    alignItems: 'center',
  },
  uploadButtonSuccess: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  uploadButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  uploadButtonTextSuccess: {
    color: '#10b981',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    padding: 16,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchInput: {
    height: 48,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#f3f4f6',
  },
  searchListView: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
  },
  fullMap: {
    flex: 1,
    marginTop: 80,
  },
  closeButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 8,
    color: '#374151',
    fontSize: 14,
  }
});

export default CreateSpot;