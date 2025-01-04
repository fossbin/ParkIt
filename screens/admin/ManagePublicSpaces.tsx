import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert, Text, FlatList, Switch, StyleSheet, RefreshControl, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Button } from 'react-native-rapi-ui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, ParkingSpace, ParkingSpaceStatus, PartialParkingSpace } from '../../types/types';
import MapView, { Marker, Region } from 'react-native-maps';

type ManagePublicSpacesNav = NativeStackNavigationProp<RootStackParamList, 'ManagePublicSpaces'>;

export default function ManagePublicSpaces() {
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const navigation = useNavigation<ManagePublicSpacesNav>();
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  const fetchPublicSpaces = async () => {
    try {
      setError(null);
      // Fetch spaces data
      const { data: spacesData, error: spacesError } = await supabase
        .from('parking_spaces')
        .select(`
          id,
          user_id,
          title,
          type,
          price,
          capacity,
          occupancy,
          vehicle_types_allowed,
          photos,
          verified,
          review_score,
          created_at,
          status,
          rejection_reason
        `)
        .eq('type', 'Public')
        .order('created_at', { ascending: false });

      if (spacesError) throw spacesError;

      // Fetch locations separately
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
          type: 'Public',
          price: space.price || 0,
          capacity: space.capacity || 1,
          occupancy: space.occupancy || 0,
          vehicle_types_allowed: space.vehicle_types_allowed || [],
          photos: Array.isArray(space.photos) ? space.photos : [],
          verified: space.verified || false,
          review_score: space.review_score || 0,
          status: (space.status as ParkingSpaceStatus) || 'Pending',
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0,
          created_at: space.created_at || new Date().toISOString(),
          rejection_reason: space.rejection_reason,
          user_id: space.user_id,
          bookings: []
        };
      });

      setSpaces(transformedData);

      // Set initial map region based on first space
      if (transformedData.length > 0 && transformedData[0].latitude && transformedData[0].longitude) {
        setMapRegion({
          latitude: transformedData[0].latitude,
          longitude: transformedData[0].longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch public spaces';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPublicSpaces();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel('public_spaces_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parking_spaces',
          filter: `type=eq.Public`,
        },
        () => {
          fetchPublicSpaces();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPublicSpaces();
    }, [])
  );

  const handleVerifySpace = async (id: string, verified: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('parking_spaces')
        .update({ verified })
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Success', `Space ${verified ? 'Activated' : 'Deactivated'} successfully`);
      fetchPublicSpaces();
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
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // No need to delete location separately due to CASCADE constraint
              const { error } = await supabase
                .from('parking_spaces')
                .delete()
                .eq('id', spaceId);

              if (error) throw error;

              Alert.alert('Success', 'Parking space deleted successfully');
              fetchPublicSpaces();
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

  const handleReject = useCallback((spaceId: string) => {
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
  }, []);

  const handleUpdateStatus = async (
    spaceId: string,
    status: ParkingSpaceStatus,
    rejectionReason?: string
  ) => {
    try {
      const updateData: PartialParkingSpace = { 
        status,
        ...(status === 'Rejected' && rejectionReason ? { rejection_reason: rejectionReason } : {})
      };

      const { error } = await supabase
        .from('parking_spaces')
        .update(updateData)
        .eq('id', spaceId);

      if (error) throw error;

      Alert.alert('Success', `Status updated to ${status}`);
      fetchPublicSpaces();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleUpdateLocation = async (spaceId: string, latitude: number, longitude: number) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('parking_space_locations')
        .upsert({
          parking_space_id: spaceId,
          latitude,
          longitude
        });

      if (error) throw error;

      Alert.alert('Success', 'Location updated successfully');
      setMapVisible(false);
      await fetchPublicSpaces(); // Refetch to update the spaces with new location
      
      // Update the selected space with new coordinates
      setSelectedSpace(prev => prev ? {...prev, latitude, longitude} : null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update location';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const renderSpaceCard = ({ item }: { item: ParkingSpace }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
          {item.status}
        </Text>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoColumn}>
          <InfoRow label="Price" value={`₹${item.price}/hr`} />
          <InfoRow label="Capacity" value={`${item.capacity}`} />
          <InfoRow label="Review Score" value={item.review_score.toFixed(1)} />
        </View>
      </View>

      <Text style={styles.vehiclesAllowed}>
        Vehicles: {item.vehicle_types_allowed.join(', ')}
      </Text>

      {item.rejection_reason && (
        <View style={styles.rejectionContainer}>
          <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
          <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
        </View>
      )}

      <View style={styles.verificationRow}>
        <Text style={styles.verificationLabel}>Status:</Text>
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
          text="Edit"
          onPress={() => navigation.navigate('EditPublicSpace', {
            spaceId: item.id,
            onUpdate: fetchPublicSpaces,
          })}
          status="primary"
          disabled={loading}
        />
        
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
      <View style={styles.header}>
        <Button
          text="Create New Space"
          onPress={() => navigation.navigate('CreatePublicSpace', {
            onCreate: fetchPublicSpaces,
          })}
          status="success"
          style={styles.createButton}
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
            <Text style={styles.emptyText}>No parking spaces found</Text>
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
              onPress={(event) => {
                if (selectedSpace) {
                  handleUpdateLocation(
                    selectedSpace.id,
                    event.nativeEvent.coordinate.latitude,
                    event.nativeEvent.coordinate.longitude
                  );
                }
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
            style={styles.closeButton} 
            onPress={() => {
              setMapVisible(false);
              setSelectedSpace(null);
            }}
          >
            <Text style={styles.closeButtonText}>Close</Text>
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
    createButton: {
      marginBottom: 0,
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
      alignItems: 'center',
      marginBottom: 12,
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
      backgroundColor: '#dcfce7',
      color: '#166534',
    },
    statusRejected: {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
    },
    statusPending: {
      backgroundColor: '#fef3c7',
      color: '#92400e',
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
      marginBottom: 4,
    },
    infoLabel: {
      color: '#666',
      marginRight: 8,
      fontSize: 14,
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
    verificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: '#e5e5e5',
    },
    verificationLabel: {
      fontSize: 14,
      color: '#666',
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
    // Map related styles
    mapPreview: {
      height: 150,
      marginVertical: 12,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#e5e5e5',
    },
    mapPreviewInner: {
      flex: 1,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'white',
    },
    fullMap: {
      flex: 1,
    },
    closeButton: {
      position: 'absolute',
      top: 40,
      right: 20,
      backgroundColor: 'white',
      padding: 12,
      borderRadius: 25,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
    }
  });