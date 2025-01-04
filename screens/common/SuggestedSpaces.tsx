import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Alert, 
  Text, 
  FlatList, 
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
import { Session } from '@supabase/supabase-js';

type SuggestedSpacesNav = NativeStackNavigationProp<RootStackParamList, 'SuggestedSpaces'>;

export default function SuggestedSpaces() {
  const [session, setSession] = useState<Session | null>(null);
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    fetchSession();
  }, []);
  
  const fetchSuggestedSpaces = async () => {
    // Ensure we have a session before fetching
    if (!session?.user) {
      setLoading(false);
      return;
    }

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
        .eq('type', 'Non-Accountable')
        .eq('user_id', session.user.id)
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
          type: 'Non-accountable',
          price: space.price || 0,
          capacity: space.capacity || 0,
          vehicle_types_allowed: space.vehicle_types_allowed || [],
          photos: Array.isArray(space.photos) ? space.photos : [],
          occupancy: space.occupancy || 0,
          verified: space.verified || false,
          review_score: space.review_score || 0,
          status: (space.status as ParkingSpaceStatus) || 'Pending',
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0,
          location_id: space.id,
          created_at: space.created_at || new Date().toISOString(),
          rejection_reason: space.rejection_reason,
          user_id: space.user_id,
          added_by: space.added_by || 'User-Suggestion',
          bookings: []
        };
      });

      setSpaces(transformedData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggested spaces';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSuggestedSpaces();
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      if (session?.user) {
        fetchSuggestedSpaces();
      }
    }, [session])
  );

  const renderSpaceCard = ({ item }: { item: ParkingSpace }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
          {item.status}
        </Text>
      </View>

      {/* Photos Section */}
      {item.photos && item.photos.length > 0 && (
        <View style={styles.photosSection}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoContainer}
          >
            {item.photos.map((photoUri, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedImage(photoUri)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Space Details */}
      <View style={styles.infoGrid}>
        <View style={styles.infoColumn}>
          <InfoRow label="Capacity" value={`${item.capacity}`} />
          <InfoRow 
            label="Suggested On" 
            value={new Date(item.created_at).toLocaleDateString()} 
          />
          <InfoRow label="Vehicles" value={item.vehicle_types_allowed.join(', ')} />
        </View>
        <View style={styles.infoColumn}>
          
          
        </View>
      </View>

      {/* Map Preview */}
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
    
    </View>
  );

  // Photo Modal for Full Screen Image
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

  return (
    <View style={styles.container}>
      <PhotoModal />

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
            <Text style={styles.emptyText}>No suggested spaces found</Text>
          )
        }
      />

      {/* Full Screen Map Modal */}
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

// Helper Components and Functions
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
      return styles.statusPending;
  }
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
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
  },
});
