import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Modal, Image, ScrollView, ActivityIndicator } from 'react-native';
import MapView, { LatLng, Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Session } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/types';

// Constants
const VEHICLE_TYPE_OPTIONS = ['Car', 'Bike', 'SUV'] as const;
const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_LOCATION = {
  latitude: 37.78825,
  longitude: -122.4324,
};

// Types remain the same
type VehicleType = typeof VEHICLE_TYPE_OPTIONS[number];

interface LocationState {
  latitude: number;
  longitude: number;
}

interface PhotoState {
  uri: string;
  base64: string;
}

interface FormErrors {
  title?: string;
  capacity?: string;
  vehicleTypes?: string;
  photos?: string;
  location?: string;
  price?: string;
}

interface CreatePublicSpaceProps extends NativeStackScreenProps<RootStackParamList, 'CreatePublicSpace'> {
  onCreate?: () => void;
}

const validateTitle = (title: string): string | null => {
  if (!title.trim()) {
    return 'Title is required';
  }
  if (title.trim().length < 3) {
    return 'Title must be at least 3 characters long';
  }
  if (title.trim().length > 100) {
    return 'Title cannot exceed 100 characters';
  }
  return null;
};

const validateCapacity = (capacity: string): string | null => {
  const capacityNum = Number(capacity);
  if (!capacity || isNaN(capacityNum)) {
    return 'Capacity is required';
  }
  if (capacityNum <= 0) {
    return 'Capacity must be a positive number';
  }
  if (!Number.isInteger(capacityNum)) {
    return 'Capacity must be a whole number';
  }
  if (capacityNum > 100) {
    return 'Capacity cannot exceed 100';
  }
  return null;
};

const validatePrice = (price: string): string | null => {
  if (price && (isNaN(Number(price)) || Number(price) < 0)) {
    return 'Price must be a non-negative number';
  }
  if (price && Number(price) > 1000) {
    return 'Price seems unreasonably high';
  }
  return null;
};

const validateVehicleTypes = (types: VehicleType[]): string | null => {
  if (types.length === 0) {
    return 'Please select at least one vehicle type';
  }
  return null;
};

const validatePhotos = (photos: PhotoState[]): string | null => {
  if (photos.length === 0) {
    return 'Please upload at least one photo';
  }
  if (photos.length > MAX_PHOTOS) {
    return `Cannot upload more than ${MAX_PHOTOS} photos`;
  }
  return null;
};

const validateLocation = (location: LocationState | null): string | null => {
  if (!location) {
    return 'Location is required';
  }
  return null;
};


export default function CreatePublicSpace({ route }: CreatePublicSpaceProps) {
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState('');
  const [vehicleTypesAllowed, setVehicleTypesAllowed] = useState<VehicleType[]>([]);
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const navigation = useNavigation();

  const handleLocationSelect = (coordinate: LatLng) => {
    setLocation(coordinate);
    setFormErrors(prev => ({ ...prev, location: undefined }));
  };

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
    
    if (!location) {
      errors.location = 'Please select a location';
    }

    if (price && (isNaN(Number(price)) || Number(price) < 0)) {
      errors.price = 'Please enter a valid price (must be a positive number)';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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

  const removePhoto = (index: number) => {
    setPhotos(prevPhotos => prevPhotos.filter((_, i) => i !== index));
    if (photos.length <= 1) {
      setFormErrors(prev => ({ ...prev, photos: 'Please upload at least one photo' }));
    }
  };

  const handleCreateSpace = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const { data: parkingSpace, error: parkingSpaceError } = await supabase
        .from('parking_spaces')
        .insert({
          user_id: session?.user?.id,
          title: title.trim(),
          type: 'Public',
          price: price ? Number(price) : null,
          capacity: parseInt(capacity),
          vehicle_types_allowed: vehicleTypesAllowed,
          photos: photos.map(photo => photo.base64),
          verified: true,
          status: 'Approved'
        })
        .select()
        .single();

      if (parkingSpaceError || !parkingSpace) {
        throw new Error(parkingSpaceError?.message || "Failed to create parking space");
      }

      // Insert location
      const { error: locationError } = await supabase
        .from('parking_space_locations')
        .insert({
          parking_space_id: parkingSpace.id,
          latitude: Number(location?.latitude.toFixed(6) || 0),
          longitude: Number(location?.longitude.toFixed(6) || 0),
        });

      if (locationError) {
        await supabase
          .from('parking_spaces')
          .delete()
          .eq('id', parkingSpace.id);
        throw new Error(`Failed to save location: ${locationError.message}`);
      }

      Alert.alert(
        "Success", 
        "Public parking space created successfully.",
        [{
          text: "OK",
          onPress: () => {
            route.params?.onCreate?.();
            navigation.goBack();
          }
        }]
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = () => {
    setTitle('');
    setCapacity('');
    setPrice('');
    setVehicleTypesAllowed([]);
    setPhotos([]);
    setFormErrors({});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Create New Public Parking Space</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.form}>
            {/* Title input remains the same */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={[styles.input, formErrors.title ? styles.inputError : null]}
                placeholder="Enter space title"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  setFormErrors(prev => ({ ...prev, title: undefined }));
                }}
                maxLength={100}
              />
              {formErrors.title && <Text style={styles.errorText}>{formErrors.title}</Text>}
            </View>

            {/* Price input - New addition */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Price (Optional)</Text>
              <TextInput
                style={[styles.input, formErrors.price ? styles.inputError : null]}
                placeholder="Enter price per hour"
                value={price}
                keyboardType="decimal-pad"
                onChangeText={(text) => {
                  setPrice(text);
                  setFormErrors(prev => ({ ...prev, price: undefined }));
                }}
              />
              {formErrors.price && <Text style={styles.errorText}>{formErrors.price}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Capacity *</Text>
              <TextInput
                style={[styles.input, formErrors.capacity ? styles.inputError : null]}
                placeholder="Enter capacity"
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

            <View style={styles.formGroup}>
              <Text style={styles.label}>Location *</Text>
              <TouchableOpacity 
                style={styles.mapPreview} 
                onPress={() => setMapVisible(true)}
              >
                {isLocationLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007BFF" />
                    <Text style={styles.loadingText}>Getting location...</Text>
                  </View>
                ) : location ? (
                  <MapView
                    style={StyleSheet.absoluteFillObject}
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
                ) : null}
                <Text style={[styles.mapText, locationError ? styles.errorText : null]}>
                  {locationError || "Tap to select location"}
                </Text>
              </TouchableOpacity>
              {formErrors.location && <Text style={styles.errorText}>{formErrors.location}</Text>}
            </View>
          </View>
        </View>
         <View style={styles.cardActions}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isLoading || !title || !capacity || vehicleTypesAllowed.length === 0 || photos.length === 0 || !location) &&
              styles.submitButtonDisabled
            ]}
            onPress={handleCreateSpace}
            disabled={isLoading || !title || !capacity || vehicleTypesAllowed.length === 0 || photos.length === 0 || !location}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Create Space</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={mapVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <MapView
            style={styles.fullMapNoSearch}
            region={{
              ...(location || DEFAULT_LOCATION),
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            onPress={(event) => {
              handleLocationSelect(event.nativeEvent.coordinate);
            }}
          >
            {location && <Marker coordinate={location} />}
          </MapView>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setMapVisible(false)}
          >
            <Text style={styles.closeButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  contentContainer: {
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
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
  form: {
    gap: 16,
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
  mapPreview: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
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
   fullMapNoSearch: {
    flex: 1,
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
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
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
