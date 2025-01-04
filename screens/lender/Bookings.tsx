import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import ParkingSpaceBookings from './ParkingSpaceBookings';
import { ParkingSpace } from '../../types/types';

interface Vehicle {
  id: string;
  license_plate: string | null;
  manufacturer: string;
  model: string;
  vehicle_type: string | null;
}

interface Booking {
  id: string;
  renter_id: string | null;
  parking_space_id: string | null;
  booking_start: string;
  booking_end: string;
  price: number | null;
  status: 'Confirmed' | 'Completed' | 'Cancelled';
  created_at: string | null;
  vehicle_id: string | null;
  vehicle: Vehicle;
  renter: User;
}

interface User {
  id: string;
  email: string | null;
  name: string | null;
  phone_number: string | null;
  created_at: string | null;
}

export default function LenderBookings() {
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchParkingSpacesWithBookings = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: parkingSpacesData, error: parkingSpacesError } = await supabase
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
          created_at,
          added_by,
          status,
          rejection_reason,
          review_score,
          bookings (
            id,
            renter_id,
            parking_space_id,
            booking_start,
            booking_end,
            price,
            status,
            created_at,
            vehicle_id,
            vehicle:vehicles (
              id,
              license_plate,
              manufacturer,
              model,
              vehicle_type
            ),
            renter:users!bookings_renter_id_fkey (
              id,
              email,
              name,
              phone_number,
              created_at
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('verified', true)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });

      if (parkingSpacesError) throw parkingSpacesError;

      // Calculate current occupancy and validate review score
      const processedParkingSpaces = (parkingSpacesData as unknown as ParkingSpace[]).map(space => ({
        ...space,
        occupancy: space.bookings ? space.bookings.filter(booking => 
          booking.status === 'Confirmed' || booking.status === 'Completed'
        ).length : 0,
        review_score: space.review_score !== null ? 
          Math.min(Math.max(space.review_score, 0), 5) : 0
      }));

      setParkingSpaces(processedParkingSpaces);
    } catch (error) {
      console.error('Fetch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch parking spaces and bookings';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchParkingSpacesWithBookings();
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchParkingSpacesWithBookings();
    }, [])
  );

  // Set up real-time subscription
  React.useEffect(() => {
    const bookingsSubscription = supabase
      .channel('bookings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          fetchParkingSpacesWithBookings();
        }
      )
      .subscribe();

    const parkingSpacesSubscription = supabase
      .channel('parking_spaces_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parking_spaces',
        },
        () => {
          fetchParkingSpacesWithBookings();
        }
      )
      .subscribe();

    return () => {
      bookingsSubscription.unsubscribe();
      parkingSpacesSubscription.unsubscribe();
    };
  }, []);

  const renderParkingSpaceItem = ({ item }: { item: ParkingSpace }) => (
    <ParkingSpaceBookings parkingSpace={item} onStatusUpdate={fetchParkingSpacesWithBookings} />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={parkingSpaces}
        renderItem={renderParkingSpaceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            <Text style={styles.emptyText}>No parking spaces or bookings found</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 32,
  },
});