import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button } from 'react-native-rapi-ui';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { ParkingSpace, RootStackParamList } from '../../types/types';

type SpaceDetailsRouteProp = RouteProp<RootStackParamList, 'SpaceDetails'>;

export default function SpaceDetails() {
  const [space, setSpace] = useState<ParkingSpace | null>(null);
  const route = useRoute<SpaceDetailsRouteProp>();
  const navigation = useNavigation();

  useEffect(() => {
    fetchSpaceDetails();
  }, []);

  const fetchSpaceDetails = async () => {
    const { data, error } = await supabase
      .from('parking_spaces')
      .select('*')
      .eq('id', route.params.spaceId)
      .single();

    if (error) {
      console.error('Error fetching space details:', error);
    } else {
      setSpace(data);
    }
  };

  const handleStatusUpdate = async (newStatus: 'Approved' | 'Rejected') => {
    const { error } = await supabase
      .from('parking_spaces')
      .update({ status: newStatus })
      .eq('id', route.params.spaceId);

    if (error) {
      Alert.alert('Error', 'Failed to update status');
    } else {
      Alert.alert('Success', `Space ${newStatus.toLowerCase()}`);
      navigation.goBack();
    }
  };

  if (!space) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{space.title}</Text>
      <View style={styles.detailsContainer}>
        <Text style={styles.detailText}>Type: {space.type}</Text>
        <Text style={styles.detailText}>Price: ${space.price}/hour</Text>
        <Text style={styles.detailText}>Capacity: {space.occupancy}/{space.capacity}</Text>
        <Text style={styles.detailText}>Location: {space.latitude}, {space.longitude}</Text>
      </View>
      
      {space.status === 'Pending' && (
        <View style={styles.buttonContainer}>
          <Button
            text="Approve"
            onPress={() => handleStatusUpdate('Approved')}
            style={styles.approveButton}
          />
          <Button
            text="Reject"
            onPress={() => handleStatusUpdate('Rejected')}
            style={styles.rejectButton}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
  spaceCard: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  listContainer: {
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  detailsContainer: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 10,
  },
  detailText: {
    fontSize: 16,
    marginBottom: 10,
  },
  approveButton: {
    flex: 1,
    marginRight: 5,
    backgroundColor: '#22c55e',
  },
  rejectButton: {
    flex: 1,
    marginLeft: 5,
    backgroundColor: '#ef4444',
  },
});