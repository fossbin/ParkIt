import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Alert, 
  Text, 
  FlatList, 
  StyleSheet, 
  RefreshControl, 
  ActivityIndicator, 
  Image, 
  Dimensions, 
  ScrollView,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Button } from 'react-native-rapi-ui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ParkingSpace, ParkingSpaceStatus } from '../../types/types';

type ManageUserSuggestionsNav = NativeStackNavigationProp<RootStackParamList, 'ManageUserSuggestions'>;

export default function ManageUserSuggestions() {
  const [suggestions, setSuggestions] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const navigation = useNavigation<ManageUserSuggestionsNav>();

  const fetchSuggestedSpaces = async () => {
    try {
      setError(null);
      const { data, error: supabaseError } = await supabase
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
          rejection_reason,
          parking_space_locations (
            latitude,
            longitude
          )
        `)
        .eq('type', 'Non-accountable')
        .eq('status','Approved')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      const transformedData: ParkingSpace[] = (data || []).map(space => ({
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
        latitude: space.parking_space_locations?.[0]?.latitude || 0,
        longitude: space.parking_space_locations?.[0]?.longitude || 0,
        created_at: space.created_at || new Date().toISOString(),
        rejection_reason: space.rejection_reason,
        user_id: space.user_id,
        added_by: space.added_by || 'User',
        bookings: []
      }));

      setSuggestions(transformedData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggested spaces';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    spaceId: string,
    status: ParkingSpaceStatus,
    rejectionReason?: string
  ) => {
    try {
      const updateData = {
        status,
        verified: status === 'Approved',
        ...(status === 'Rejected' && rejectionReason ? { rejection_reason: rejectionReason } : {})
      };

      const { error } = await supabase
        .from('parking_spaces')
        .update(updateData)
        .eq('id', spaceId);

      if (error) throw error;

      Alert.alert('Success', `Status updated to ${status}`);
      fetchSuggestedSpaces();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleRevert = (spaceId: string) => {
    Alert.alert(
      'Revert to Review',
      'Are you sure you want to revert this space back to review status?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Revert',
          onPress: () => handleUpdateStatus(spaceId, 'Pending')
        }
      ]
    );
  };

  const handleDeleteSuggestion = async (spaceId: string) => {
    Alert.alert(
      'Delete Suggestion',
      'Are you sure you want to delete this suggestion? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('parking_spaces')
                .delete()
                .eq('id', spaceId);

              if (error) throw error;

              Alert.alert('Success', 'Suggestion deleted successfully');
              fetchSuggestedSpaces();
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete suggestion';
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  const handleReject = (spaceId: string) => {
    Alert.prompt(
      'Reject Space',
      'Please provide a reason for rejection:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reject',
          onPress: async (reason?: string) => {
            if (!reason) {
              Alert.alert('Error', 'Please provide a rejection reason');
              return;
            }
            await handleUpdateStatus(spaceId, 'Rejected', reason);
          },
        },
      ],
      'plain-text'
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSuggestedSpaces();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel('suggested_spaces_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parking_spaces',
          filter: `type=eq.Non-accountable`,
        },
        () => {
          fetchSuggestedSpaces();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSuggestedSpaces();
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

  const renderSuggestionCard = ({ item }: { item: ParkingSpace }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.statusContainer}>
          <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
            {item.status}
          </Text>
        </View>
      </View>

      {item.photos && item.photos.length > 0 && renderPhotos(item.photos)}

      <View style={styles.infoGrid}>
        <View style={styles.infoColumn}>
          <InfoRow label="Price" value={`₹${item.price}/hr`} />
          <InfoRow label="Capacity" value={`${item.capacity}`} />
        </View>
        <View style={styles.infoColumn}>
          <InfoRow 
            label="Created" 
            value={new Date(item.created_at).toLocaleDateString()} 
          />
          <InfoRow label="Type" value={item.type} />
        </View>
      </View>

      <Text style={styles.vehiclesAllowed} numberOfLines={2}>
        Vehicles: {item.vehicle_types_allowed.join(', ')}
      </Text>

      {item.rejection_reason && (
        <View style={styles.rejectionContainer}>
          <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
          <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        {item.status === 'Pending' && (
          <>
            <Button
              text="Approve"
              onPress={() => handleUpdateStatus(item.id, 'Approved')}
              status="success"
              disabled={loading}
            />
            <Button
              text="Reject"
              onPress={() => handleReject(item.id)}
              status="danger"
              disabled={loading}
            />
          </>
        )}
        {item.status === 'Approved' && (
          <Button
            text="Revert to Review"
            onPress={() => handleRevert(item.id)}
            status="warning"
            disabled={loading}
          />
        )}
        <Button
          text="Delete"
          onPress={() => handleDeleteSuggestion(item.id)}
          status="danger"
          disabled={loading}
        />
      </View>
    </View>
  );

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button text="Retry" onPress={fetchSuggestedSpaces} status="primary" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PhotoModal />
      <FlatList
        data={suggestions}
        renderItem={renderSuggestionCard}
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
    case 'Pending':
      return styles.statusPending;
    default:
      return styles.statusPending;
  }
};

const styles = StyleSheet.create({
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  statusContainer: {
    flexShrink: 0,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '500',
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
  rejectionContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  rejectionLabel: {
    color: '#991b1b',
    fontWeight: '600',
    marginBottom: 4,
  },
  rejectionText: {
    color: '#991b1b',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
  },
});