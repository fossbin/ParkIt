import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  Image, 
  Dimensions, 
  TouchableOpacity, 
  Modal, 
  SafeAreaView,
  Linking,
  Platform,
  StatusBar,
  Alert
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, ParkingSpaceStatus } from '../../types/types';
import { Button } from 'react-native-rapi-ui';
import MapView, { Marker } from 'react-native-maps';

type ParkingSpotDetailsRouteProp = RouteProp<RootStackParamList, 'ParkingSpotDetails'>;

type ParkingSpaceDocument = {
  id: string;
  document_url: string;
  document_type: 'ownership' | 'lease' | 'other';
  uploaded_at: string;
};

type ParkingSpace = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  price: number;
  capacity: number;
  vehicle_types_allowed: string[];
  photos: string[];
  occupancy: number;
  verified: boolean;
  review_score: number;
  created_at: string;
  added_by: string;
  status: ParkingSpaceStatus;
  latitude: number;
  longitude: number;
  rejection_reason?: string;
};

export default function ParkingSpotDetails() {
  const [loading, setLoading] = useState(true);
  const [parkingSpace, setParkingSpace] = useState<ParkingSpace | null>(null);
  const [documents, setDocuments] = useState<ParkingSpaceDocument[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const route = useRoute<ParkingSpotDetailsRouteProp>();

  const fetchParkingSpaceDetails = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch parking space details with location
      const { data: spaceData, error: spaceError } = await supabase
        .from('parking_spaces')
        .select(`
          *,
          parking_space_locations(latitude, longitude)
        `)
        .eq('id', route.params.parkingSpaceId)
        .single();

      if (spaceError) throw spaceError;

      // Fetch associated documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('parking_space_documents')
        .select('*')
        .eq('parking_space_id', route.params.parkingSpaceId);

      if (documentsError) throw documentsError;

      // Transform space data to include location
      const transformedSpaceData = {
        ...spaceData,
        latitude: spaceData.parking_space_locations?.latitude || 0,
        longitude: spaceData.parking_space_locations?.longitude || 0,
      };

      setParkingSpace(transformedSpaceData);
      setDocuments(documentsData || []);
    } catch (error) {
      console.error('Error fetching details:', error);
      Alert.alert('Error', 'Failed to fetch parking space details');
    } finally {
      setLoading(false);
    }
  }, [route.params.parkingSpaceId]);

  useEffect(() => {
    fetchParkingSpaceDetails();
  }, [fetchParkingSpaceDetails]);

  const renderPhotos = () => {
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
          {(parkingSpace?.photos || []).map((photoUri, index) => (
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

  const renderDocuments = () => {
    return (
      <View style={styles.documentsSection}>
        <Text style={styles.sectionTitle}>Documents</Text>
        {documents.length === 0 ? (
          <Text style={styles.noDocumentsText}>No documents uploaded</Text>
        ) : (
          documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.documentItem}
              onPress={() => {
                if (doc.document_url) {
                  Linking.openURL(doc.document_url);
                } else {
                  Alert.alert('Error', 'Document URL is not available');
                }
              }}
            >
              <View>
                <Text style={styles.documentType}>{doc.document_type.toUpperCase()}</Text>
                <Text style={styles.documentDate}>
                  Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.documentLink}>Open</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

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

  const renderMapPreview = () => {
    if (!parkingSpace || parkingSpace.latitude === 0 || parkingSpace.longitude === 0) return null;

    return (
      <TouchableOpacity 
        style={styles.mapPreview}
        onPress={() => setMapVisible(true)}
      >
        <MapView
          style={styles.mapPreviewInner}
          initialRegion={{
            latitude: parkingSpace.latitude,
            longitude: parkingSpace.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker 
            coordinate={{ 
              latitude: parkingSpace.latitude, 
              longitude: parkingSpace.longitude 
            }} 
          />
        </MapView>
      </TouchableOpacity>
    );
  };

  const FullMapModal = () => (
    <Modal visible={mapVisible} animationType="slide">
      <View style={styles.modalContainer}>
        {parkingSpace && (
          <MapView
            style={styles.fullMap}
            initialRegion={{
              latitude: parkingSpace.latitude,
              longitude: parkingSpace.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker 
              coordinate={{
                latitude: parkingSpace.latitude,
                longitude: parkingSpace.longitude,
              }}
              title={parkingSpace.title}
            />
          </MapView>
        )}
        <TouchableOpacity 
          style={styles.closeMapButton} 
          onPress={() => setMapVisible(false)}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  if (loading || !parkingSpace) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2F7C6E" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <PhotoModal />
      <FullMapModal />

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{parkingSpace.title}</Text>
          <Text style={[
            styles.statusBadge, 
            getStatusStyle(parkingSpace.status)
          ]}>
            {parkingSpace.status}
          </Text>
        </View>

        {renderPhotos()}

        <View style={styles.infoGrid}>
          <View style={styles.infoColumn}>
            <InfoRow label="Price" value={`₹${parkingSpace.price}/hr`} />
            <InfoRow label="Capacity" value={`${parkingSpace.capacity}`} />
            <InfoRow label="Occupancy" value={`${parkingSpace.occupancy}/${parkingSpace.capacity}`} />
          </View>
          <View style={styles.infoColumn}>
            <InfoRow label="Review Score" value={parkingSpace.review_score.toFixed(1)} />
            <InfoRow 
              label="Created" 
              value={new Date(parkingSpace.created_at).toLocaleDateString()} 
            />
          </View>
        </View>

        <Text style={styles.vehiclesAllowed}>
          Vehicles: {parkingSpace.vehicle_types_allowed.join(', ')}
        </Text>

        <View style={styles.verificationRow}>
          <Text style={styles.verificationLabel}>Verified:</Text>
          <Text style={styles.verificationValue}>
            {parkingSpace.verified ? 'Yes' : 'No'}
          </Text>
        </View>

        {parkingSpace.rejection_reason && (
          <View style={styles.rejectionReasonContainer}>
            <Text style={styles.rejectionReasonTitle}>Rejection Reason:</Text>
            <Text style={styles.rejectionReasonText}>
              {parkingSpace.rejection_reason}
            </Text>
          </View>
        )}

        {renderMapPreview()}
        {renderDocuments()}
      </View>
    </ScrollView>
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
      return styles.statusPending;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
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
  verificationValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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
  documentsSection: {
    marginTop: 16,
  },
  documentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  documentType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  documentDate: {
    fontSize: 12,
    color: '#666',
  },
  documentViewerModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  documentViewerContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  documentViewerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  openDocumentButton: {
    marginBottom: 10,
    width: '100%',
  },
  closeDocumentButton: {
    width: '100%',
  },
  documentLink: {
    color: '#2196F3',
    fontWeight: '600',
  },
  noDocumentsText: {
    color: '#666',
    textAlign: 'center',
    padding: 12,
  },
  rejectionReasonContainer: {
    backgroundColor: '#f8d7da',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  rejectionReasonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#721c24',
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 13,
    color: '#721c24',
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
});
