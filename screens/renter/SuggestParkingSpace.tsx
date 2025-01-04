import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../types/types';
import { Session } from '@supabase/supabase-js';

const VEHICLE_TYPE_OPTIONS = ['Car', 'Bike', 'SUV'] as const;
const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

type VehicleType = typeof VEHICLE_TYPE_OPTIONS[number];

interface PhotoState {
  uri: string;
  base64: string;
}

interface FormErrors {
  title?: string;
  capacity?: string;
  vehicleTypes?: string;
  photos?: string;
}

type SuggestParkingSpaceRouteProp = RouteProp<RootStackParamList, 'SuggestParkingSpace'>;

const SuggestParkingSpace: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<SuggestParkingSpaceRouteProp>();
  const { location } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState('');
  const [vehicleTypesAllowed, setVehicleTypesAllowed] = useState<VehicleType[]>([]);
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    fetchSession();
  }, []);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    if (!title.trim()) {
      errors.title = 'Title is required';
    }
    
    const capacityNum = Number(capacity);
    if (!capacity || isNaN(capacityNum) || capacityNum <= 0 || !Number.isInteger(capacityNum)) {
      errors.capacity = 'Please enter a valid capacity (whole number)';
    }
    
    if (vehicleTypesAllowed.length === 0) {
      errors.vehicleTypes = 'Please select at least one vehicle type';
    }
    
    if (photos.length === 0) {
      errors.photos = 'Please upload at least one photo';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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

  const removePhoto = (index: number) => {
    setPhotos(prevPhotos => prevPhotos.filter((_, i) => i !== index));
    if (photos.length <= 1) {
      setFormErrors(prev => ({ ...prev, photos: 'Please upload at least one photo' }));
    }
  };

  const handleVehicleTypeToggle = (type: VehicleType) => {
    setVehicleTypesAllowed(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
    setFormErrors(prev => ({ ...prev, vehicleTypes: undefined }));
  };

  const handleSubmit = async () => {
    // Check if user is authenticated
    if (!session?.user) {
      Alert.alert("Authentication Error", "Please log in to suggest a parking space");
      return;
    }

    if (!validateForm()) {
      Alert.alert("Validation Error", "Please check all required fields");
      return;
    }

    setIsLoading(true);

    try {
      // Create the parking space suggestion
      const { data: parkingSpace, error: parkingSpaceError } = await supabase
        .from('parking_spaces')
        .insert({
          user_id: session.user.id, // Directly use the user ID from the session
          title: title.trim(),
          type: 'Non-accountable',
          capacity: parseInt(capacity),
          vehicle_types_allowed: vehicleTypesAllowed,
          photos: photos.map(photo => photo.base64),
          verified: false,
          review_score: 0,
          added_by: 'User-Suggestion',
          status: 'Pending'
        })
        .select()
        .single();

      if (parkingSpaceError || !parkingSpace) {
        throw new Error(parkingSpaceError?.message || "Failed to create parking space suggestion");
      }

      // Insert location
      const { error: locationError } = await supabase
        .from('parking_space_locations')
        .insert({
          parking_space_id: parkingSpace.id,
          latitude: location.latitude,
          longitude: location.longitude,
        });

      if (locationError) {
        await supabase
          .from('parking_spaces')
          .delete()
          .eq('id', parkingSpace.id);
        throw new Error(locationError.message);
      }

      Alert.alert(
        "Success", 
        "Thank you for your suggestion! It will be reviewed by our team.",
        [{
          text: "OK",
          onPress: () => navigation.goBack()
        }]
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Suggest a Parking Space</Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.mapPreview}>
            <MapView
              style={styles.map}
              initialRegion={{
                ...location,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={location} />
            </MapView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={[styles.input, formErrors.title ? styles.inputError : null]}
              placeholder="Enter a descriptive title"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                setFormErrors(prev => ({ ...prev, title: undefined }));
              }}
              maxLength={100}
            />
            {formErrors.title && <Text style={styles.errorText}>{formErrors.title}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Estimated Capacity *</Text>
            <TextInput
              style={[styles.input, formErrors.capacity ? styles.inputError : null]}
              placeholder="Enter estimated capacity"
              value={capacity}
              keyboardType="number-pad"
              onChangeText={(text) => {
                setCapacity(text);
                setFormErrors(prev => ({ ...prev, capacity: undefined }));
              }}
            />
            {formErrors.capacity && <Text style={styles.errorText}>{formErrors.capacity}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Vehicle Types *</Text>
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
          </View>

          <View style={styles.formGroup}>
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
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isLoading || !title || !capacity || vehicleTypesAllowed.length === 0 || photos.length === 0) &&
              styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={isLoading || !title || !capacity || vehicleTypesAllowed.length === 0 || photos.length === 0}
          >
            <Text style={styles.submitButtonText}>
              {isLoading ? 'Submitting...' : 'Submit Suggestion'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f3f4f6',
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: 12,
      margin: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardHeader: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    cardContent: {
      padding: 16,
    },
    cardActions: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1f2937',
    },
    mapPreview: {
      height: 200,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    formGroup: {
      marginBottom: 16,
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
    errorText: {
      color: '#ef4444',
      fontSize: 14,
      marginTop: 4,
    },
    vehicleTypesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
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
    uploadButton: {
      backgroundColor: '#fff',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#3b82f6',
      alignItems: 'center',
    },
    uploadButtonText: {
      color: '#3b82f6',
      fontWeight: '600',
    },
    imagePreviewContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    imageWrapper: {
      position: 'relative',
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
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#ef4444',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    removePhotoText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
      lineHeight: 20,
    },
    submitButton: {
      backgroundColor: '#3b82f6',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      backgroundColor: '#93c5fd',
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    }
  });

export default SuggestParkingSpace;