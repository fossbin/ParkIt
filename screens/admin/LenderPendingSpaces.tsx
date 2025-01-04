import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  ActivityIndicator,
  Modal,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  SafeAreaView
} from 'react-native';
import { Text, Button, TextInput } from 'react-native-rapi-ui';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';

const windowWidth = Dimensions.get('window').width;

interface ParkingSpace {
  id: string;
  title: string;
  type: string;
  price: number;
  capacity: number;
  vehicle_types_allowed: string[];
  photos: Record<string, string>;
  occupancy: number;
  created_at: string;
  verified: boolean;
  status: string;
  user_id: string;
  review_score: number;
  parking_space_locations: {
    latitude: number;
    longitude: number;
  };
  parking_space_documents: Array<{
    id: string;
    document_url: string;
    document_type: string;
    uploaded_at: string;
  }>;
}

export default function LenderPendingSpaces() {
  const [pendingVerifiedSpaces, setPendingVerifiedSpaces] = useState<ParkingSpace[]>([]);
  const [pendingUnverifiedSpaces, setPendingUnverifiedSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionModal, setRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchPendingSpaces();
    }, [])
  );

  const fetchPendingSpaces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parking_spaces')
        .select(`
          *,
          parking_space_locations (
            latitude,
            longitude
          ),
          parking_space_documents (
            id,
            document_url,
            document_type,
            uploaded_at
          )
        `)
        .eq('type', 'Lender-provided')
        .in('status', ['Pending'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Separate verified and unverified pending spaces
      const verifiedPending = data?.filter(space => space.verified) || [];
      const unverifiedPending = data?.filter(space => !space.verified) || [];

      setPendingVerifiedSpaces(verifiedPending);
      setPendingUnverifiedSpaces(unverifiedPending);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch pending spaces');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (spaceId: string) => {
    try {
      const { error } = await supabase
        .from('parking_spaces')
        .update({ 
          status: 'Pending',
          verified: true,
        })
        .eq('id', spaceId);

      if (error) throw error;
      
      Alert.alert('Success', 'Space verified successfully');
      fetchPendingSpaces();
    } catch (error) {
      Alert.alert('Error', 'Failed to verify space');
      console.error('Error:', error);
    }
  };

  const handleUnverify = async (spaceId: string) => {
    try {
      const { error } = await supabase
        .from('parking_spaces')
        .update({ 
          status: 'Pending',
          verified: false,
        })
        .eq('id', spaceId);

      if (error) throw error;
      
      Alert.alert('Success', 'Space unverified successfully');
      fetchPendingSpaces();
    } catch (error) {
      Alert.alert('Error', 'Failed to unverify space');
      console.error('Error:', error);
    }
  };

  const handleApprove = async (spaceId: string) => {
    try {
      const { error } = await supabase
        .from('parking_spaces')
        .update({ 
          status: 'Approved',
          verified: true,
        })
        .eq('id', spaceId);

      if (error) throw error;
      
      Alert.alert('Success', 'Space approved successfully');
      fetchPendingSpaces();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve space');
      console.error('Error:', error);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }

    try {
      const { error } = await supabase
        .from('parking_spaces')
        .update({
          status: 'Rejected',
          rejection_reason: rejectionReason,
          verified: false
        })
        .eq('id', selectedSpaceId);

      if (error) throw error;

      Alert.alert('Success', 'Space rejected successfully');
      setRejectionModal(false);
      setRejectionReason('');
      setSelectedSpaceId(null);
      fetchPendingSpaces();
    } catch (error) {
      Alert.alert('Error', 'Failed to reject space');
      console.error('Error:', error);
    }
  };

  const PendingSpaceCard = ({ 
    space, 
    isVerified 
  }: { 
    space: ParkingSpace, 
    isVerified: boolean 
  }) => {
    const photoUrls = space.photos ? Object.values(space.photos) : [];
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{space.title}</Text>
          <Text style={StyleSheet.flatten([styles.badge, 
            isVerified ? styles.verifiedBadge : styles.unverifiedBadge
          ])}>
            {isVerified ? 'Verified Pending' : 'Unverified Pending'}
          </Text>
        </View>

        {photoUrls.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView 
              horizontal 
              style={styles.mediaCarousel}
              showsHorizontalScrollIndicator={false}
            >
              {photoUrls.map((photo: string, index: number) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedImage(photo)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: photo }}
                    style={styles.mediaItem}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {space.parking_space_documents && space.parking_space_documents.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Documents</Text>
            <ScrollView 
              horizontal 
              style={styles.mediaCarousel}
              showsHorizontalScrollIndicator={false}
            >
              {space.parking_space_documents.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  onPress={() => setSelectedDocument(doc.document_url)}
                  style={styles.documentItem}
                >
                  <Text style={styles.documentType}>{doc.document_type}</Text>
                  <Text style={styles.documentDate}>
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.cardContent}>
          <View style={styles.infoGrid}>
            <View style={styles.infoColumn}>
              <InfoRow label="Price" value={`₹${space.price}/hr`} />
              <InfoRow label="Capacity" value={`${space.capacity}`} />
            </View>
            <View style={styles.infoColumn}>
              <InfoRow 
                label="Created" 
                value={new Date(space.created_at).toLocaleDateString()} 
              />
              <InfoRow label="Type" value={space.type} />
            </View>
          </View>

          <Text style={styles.vehiclesAllowed} numberOfLines={2}>
            Vehicles: {space.vehicle_types_allowed.join(', ')}
          </Text>
          
          {space.parking_space_locations && (
            <TouchableOpacity 
              style={styles.locationPreview}
              onPress={() => {
                setSelectedLocation(space.parking_space_locations);
                setLocationModalVisible(true);
              }}
            >
              <Text style={styles.locationText}>
                Location: {space.parking_space_locations.latitude.toFixed(6)}, 
                {space.parking_space_locations.longitude.toFixed(6)}
              </Text>
            </TouchableOpacity>
          )}
          <Text>Review Score: {space.review_score}</Text>
        </View>

        <View style={styles.cardActions}>
          {isVerified ? (
            <>
              <Button
                text="Unverify"
                onPress={() => handleUnverify(space.id)}
                style={StyleSheet.flatten([styles.actionButton, styles.unverifyButton])}
              />
              <Button
                text="Approve"
                onPress={() => handleApprove(space.id)}
                style={StyleSheet.flatten([styles.actionButton, styles.approveButton])}
              />
            </>
          ) : (
            <>
              <Button
                text="Reject"
                onPress={() => {
                  setSelectedSpaceId(space.id);
                  setRejectionModal(true);
                }}
                style={StyleSheet.flatten([styles.actionButton, styles.rejectButton])}
              />
              <Button
                text="Verify"
                onPress={() => handleVerify(space.id)}
                style={StyleSheet.flatten([styles.actionButton, styles.verifyButton])}
              />
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Pending Lender Spaces</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : (pendingUnverifiedSpaces.length === 0 && pendingVerifiedSpaces.length === 0) ? (
        <Text style={styles.noSpaces}>No pending spaces found</Text>
      ) : (
        <ScrollView style={styles.scrollView}>
          {pendingUnverifiedSpaces.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Unverified Pending Spaces</Text>
              {pendingUnverifiedSpaces.map((space) => (
                <PendingSpaceCard 
                  key={space.id} 
                  space={space} 
                  isVerified={false} 
                />
              ))}
            </>
          )}

          {pendingVerifiedSpaces.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Verified Pending Spaces</Text>
              {pendingVerifiedSpaces.map((space) => (
                <PendingSpaceCard 
                  key={space.id} 
                  space={space} 
                  isVerified={true} 
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={rejectionModal}
        onRequestClose={() => {
          setRejectionModal(false);
          setRejectionReason('');
          setSelectedSpaceId(null);
        }}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Space</Text>
            <TextInput
              placeholder="Enter rejection reason"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              style={styles.rejectionInput}
            />
            <View style={styles.modalButtons}>
              <Button
                text="Cancel"
                onPress={() => {
                  setRejectionModal(false);
                  setRejectionReason('');
                  setSelectedSpaceId(null);
                }}
                style={styles.cancelButton}
              />
              <Button
                text="Confirm Rejection"
                onPress={handleReject}
                style={styles.rejectButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedImage}
        transparent={true}
        onRequestClose={() => setSelectedImage(null)}
        animationType="fade"
      >
        <TouchableOpacity 
          style={styles.imageViewerModal}
          activeOpacity={1}
          onPress={() => setSelectedImage(null)}
        >
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={locationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {selectedLocation && (
            <MapView
              style={styles.fullMap}
              region={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
            >
              <Marker coordinate={selectedLocation} />
            </MapView>
          )}
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setLocationModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={!!selectedDocument}
        transparent={true}
        onRequestClose={() => setSelectedDocument(null)}
        animationType="fade"
      >
        <View style={styles.documentViewerModal}>
          <View style={styles.documentViewerContent}>
            <Text style={styles.documentViewerTitle}>Document Preview</Text>
            <Button
              text="Open Document"
              onPress={() => {
                if (selectedDocument) {
                  Linking.openURL(selectedDocument);
                }
              }}
              style={styles.openDocumentButton}
            />
            <Button
              text="Close"
              onPress={() => setSelectedDocument(null)}
              style={styles.closeButton}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}:</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    padding: 16,
    color: '#1f2937',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noSpaces: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
    marginTop: 24,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '500',
  },
  pendingBadge: {
    backgroundColor: '#fff3cd',
    color: '#856404',
  },
  approvedBadge: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  rejectedBadge: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  mediaCarousel: {
    flexGrow: 0,
    marginBottom: 16,
  },
  mediaItem: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
  },
  documentItem: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#E5E7EB',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentType: {
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  documentDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  cardContent: {
    marginBottom: 16,
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
  locationPreview: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  locationText: {
    color: '#1F2937',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 6,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  rejectionInput: {
    marginBottom: 16,
    height: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  imageViewerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: windowWidth,
    height: windowWidth,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  fullMap: {
    flex: 1,
    width: '100%',
    height: '90%',
  },
  closeButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  closeButtonText: {
    color: '#1F2937',
    fontWeight: 'bold',
  },
  documentViewerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  documentViewerContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    width: '90%',
    maxWidth: 400,
  },
  documentViewerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  openDocumentButton: {
    backgroundColor: '#3B82F6',
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    color: '#1f2937',
  },
  verifiedBadge: {
    backgroundColor: '#10B981', // Green for verified
    color: 'white',
  },
  unverifiedBadge: {
    backgroundColor: '#F59E0B', 
    color: 'white',
  },
  verifyButton: {
    backgroundColor: '#10B981', 
  },
  unverifyButton: {
    backgroundColor: '#6B7280', 
  },
});

