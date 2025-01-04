import React, { useState, useCallback } from 'react';
import { 
  View, 
  Alert, 
  Text, 
  FlatList, 
  Switch, 
  StyleSheet, 
  RefreshControl, 
  ActivityIndicator, 
  Modal, 
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Button } from 'react-native-rapi-ui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ParkingSpace, ParkingSpaceStatus } from '../../types/types';
import MapView, { Marker } from 'react-native-maps';

type ManageLenderSpacesNav = NativeStackNavigationProp<RootStackParamList, 'ManageLenderSpaces'>;

export default function ManageLenderSpaces() {
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const navigation = useNavigation<ManageLenderSpacesNav>();

  const fetchLenderSpaces = async () => {
    try {
      setError(null);
      const { data: spacesData, error: spacesError } = await supabase
        .from('parking_spaces')
        .select(`
          id,
          user_id,
          title,
          type,
          price,
          capacity,
          vehicle_types_allowed,
          photos,
          occupancy,
          verified,
          review_score,
          created_at,
          added_by,
          status,
          rejection_reason
        `)
        .eq('type', 'Lender-provided')
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });

      if (spacesError) throw spacesError;

      // Fetch locations separately to ensure we get all coordinates
      const { data: locationsData, error: locationsError } = await supabase
        .from('parking_space_locations')
        .select('*')
        .in('parking_space_id', (spacesData || []).map(space => space.id));

      if (locationsError) throw locationsError;

      // Create a map of locations for easy lookup
      const locationMap = new Map(
        (locationsData || []).map(location => [
          location.parking_space_id,
          {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude)
          }
        ])
      );

      const transformedData: ParkingSpace[] = (spacesData || []).map(space => {
        const location = locationMap.get(space.id);
        return {
          id: space.id,
          title: space.title,
          type: 'Lender-provided',
          price: space.price || 0,
          capacity: space.capacity || 0,
          vehicle_types_allowed: space.vehicle_types_allowed || [],
          photos: Array.isArray(space.photos) ? space.photos : [],
          occupancy: space.occupancy || 0,
          verified: space.verified || false,
          review_score: space.review_score || 0,
          status: (space.status as ParkingSpaceStatus) || 'Pending',
          // Use location data or fallback to default coordinates
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0,
          location_id: space.id, // Using space.id as location_id since they're 1:1
          created_at: space.created_at || new Date().toISOString(),
          rejection_reason: space.rejection_reason,
          user_id: space.user_id,
          added_by: space.added_by || 'Lender',
          bookings: []
        };
      });

      setSpaces(transformedData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch lender spaces';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySpace = async (id: string, verified: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('parking_spaces')
        .update({ verified })
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Success', `Space ${verified ? 'verified' : 'unverified'} successfully`);
      fetchLenderSpaces();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update verification status';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    Alert.alert(
      'Delete Space',
      'Are you sure you want to delete this parking space? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteAssociatedDocuments(spaceId);
              
              const { error } = await supabase
                .from('parking_spaces')
                .delete()
                .eq('id', spaceId);

              if (error) throw error;

              Alert.alert('Success', 'Parking space deleted successfully');
              fetchLenderSpaces();
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete parking space';
              Alert.alert('Error', errorMessage);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const deleteAssociatedDocuments = async (spaceId: string) => {
    try {
      const { data: documents, error: fetchError } = await supabase
        .from('parking_space_documents')
        .select('document_url')
        .eq('parking_space_id', spaceId);

      if (fetchError) throw fetchError;

      if (documents && documents.length > 0) {
        const fileNames = documents.map(doc => {
          const url = doc.document_url;
          const pathMatch = url.match(/\/spot_ownership\/(.+)$/);
          return pathMatch ? pathMatch[1] : null;
        }).filter(Boolean);

        if (fileNames.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('spot_ownership')
            .remove(fileNames);

          if (storageError) throw storageError;
        }

        const { error: dbError } = await supabase
          .from('parking_space_documents')
          .delete()
          .eq('parking_space_id', spaceId);

        if (dbError) throw dbError;
      }
    } catch (error) {
      console.error('Error deleting documents:', error);
      throw error;
    }
  };

  const handleRevert = (spaceId: string) => {
    Alert.alert(
      'Revert to Review',
      'Are you sure you want to revert this space back to review status?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          onPress: () => handleUpdateStatus(spaceId, 'Pending')
        }
      ]
    );
  };

  const handleUpdateStatus = async (
    spaceId: string,
    status: ParkingSpaceStatus,
    rejectionReason?: string
  ) => {
    try {
      const updateData = { 
        status,
        ...(status === 'Rejected' && rejectionReason ? { rejection_reason: rejectionReason } : {})
      };

      const { error } = await supabase
        .from('parking_spaces')
        .update(updateData)
        .eq('id', spaceId);

      if (error) throw error;

      Alert.alert('Success', `Status updated to ${status}`);
      fetchLenderSpaces();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status';
      Alert.alert('Error', errorMessage);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLenderSpaces();
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLenderSpaces();
    }, [])
  );

  const PhotoModal = () => (
    <Modal
      visible={!!selectedImage}
      transparent={true}
      onRequestClose={() => setSelectedImage(null)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setSelectedImage(null)}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
        {selectedImage && (
          <Image
            source={{ uri: selectedImage }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  const renderPhotos = (photos: string[]) => {
    const screenWidth = Dimensions.get('window').width;
    const photoWidth = (screenWidth - 64) / 3;

    return (
      <View style={styles.photosSection}>
        <Text style={styles.sectionTitle}>Photos</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoContainer}
        >
          {photos.map((photoUri, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setSelectedImage(photoUri)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: photoUri }}
                style={[styles.photo, { width: photoWidth, height: photoWidth }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSpaceCard = ({ item }: { item: ParkingSpace }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
          {item.status}
        </Text>
      </View>

      {item.photos && item.photos.length > 0 && renderPhotos(item.photos)}

      <View style={styles.infoGrid}>
        <View style={styles.infoColumn}>
          <InfoRow label="Price" value={`₹${item.price}/hr`} />
          <InfoRow label="Capacity" value={`${item.capacity}`} />
          <InfoRow label="Occupancy" value={`${item.occupancy}/${item.capacity}`} />
        </View>
        <View style={styles.infoColumn}>
          <InfoRow label="Review Score" value={item.review_score.toFixed(1)} />
          <InfoRow label="Added By" value={item.added_by || 'Unknown'} />
          <InfoRow 
            label="Created" 
            value={new Date(item.created_at).toLocaleDateString()} 
          />
        </View>
      </View>

      <Text style={styles.vehiclesAllowed}>
        Vehicles: {item.vehicle_types_allowed.join(', ')}
      </Text>

      <View style={styles.verificationRow}>
        <Text style={styles.verificationLabel}>Verified:</Text>
        <Switch
          value={item.verified}
          onValueChange={(value) => handleVerifySpace(item.id, value)}
          disabled={loading}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={item.verified ? '#2196F3' : '#f4f3f4'}
        />
      </View>

      <TouchableOpacity
        style={styles.mapPreview}
        onPress={() => {
          setSelectedSpace(item);
          setMapVisible(true);
        }}
      >
        <MapView
          style={styles.mapPreviewInner}
          initialRegion={{
            latitude: item.latitude,
            longitude: item.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker coordinate={{ latitude: item.latitude, longitude: item.longitude }} />
        </MapView>
      </TouchableOpacity>

      <View style={styles.actionButtons}>
        <Button
          text="Revert to Review"
          onPress={() => handleRevert(item.id)}
          status="warning"
          disabled={loading}
        />
        <Button
          text="Delete"
          onPress={() => handleDeleteSpace(item.id)}
          status="danger"
          disabled={loading}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <PhotoModal />
      <View style={styles.header}>
        <Button
          text="View Pending Spaces"
          onPress={() => navigation.navigate('LenderPendingSpaces')}
          status="primary"
          style={styles.pendingButton}
        />
      </View>

      <FlatList
        data={spaces}
        renderItem={renderSpaceCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            <Text style={styles.emptyText}>No approved lender spaces found</Text>
          )
        }
      />

      <Modal visible={mapVisible} animationType="slide">
        <View style={styles.modalContainer}>
          {selectedSpace && (
            <MapView
              style={styles.fullMap}
              initialRegion={{
                latitude: selectedSpace.latitude,
                longitude: selectedSpace.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Marker 
                coordinate={{
                  latitude: selectedSpace.latitude,
                  longitude: selectedSpace.longitude,
                }}
              />
            </MapView>
          )}
          <TouchableOpacity 
            style={styles.closeMapButton} 
            onPress={() => {
              setMapVisible(false);
              setSelectedSpace(null);
            }}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const getStatusStyle = (status: ParkingSpaceStatus) => {
  switch (status) {
    case 'Approved':
      return styles.statusApproved;
    case 'Rejected':
      return styles.statusRejected;
    default:
      return styles.statusPending;}
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  pendingButton: {
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '500',
  },
  statusApproved: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  statusRejected: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  statusPending: {
    backgroundColor: '#fff3cd',
    color: '#856404',
  },
  photosSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  photoContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  photo: {
    borderRadius: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - (Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0),
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoColumn: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  infoLabel: {
    color: '#666',
    marginRight: 8,
    fontSize: 14,
    flexShrink: 0,
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  vehiclesAllowed: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
  },
  verificationLabel: {
    marginRight: 8,
    fontSize: 14,
    color: '#666',
  },
  mapPreview: {
    height: 150,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapPreviewInner: {
    flex: 1,
  },
  fullMap: {
    width: '100%',
    height: '100%',
  },
  closeMapButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
  }
});
