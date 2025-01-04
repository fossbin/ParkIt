import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Card, Text, Button, Surface, useTheme, ActivityIndicator } from 'react-native-paper';
import { format } from 'date-fns'

type BookingStatus = 'Confirmed' | 'Completed' | 'Cancelled';
type ParkingSpaceType = 'Public' | 'Lender-provided' | 'Non-accountable';
type ParkingSpaceStatus = 'Pending' | 'Approved' | 'Rejected';

interface ParkingSpace {
  id: string;
  user_id: string | null;
  title: string;
  type: ParkingSpaceType;
  price: number;
  capacity: number | null;
  vehicle_types_allowed: string[];
  photos: any | null;
  occupancy: number;
  verified: boolean;
  review_score: number;
  created_at: string;
  added_by: 'Lender' | 'Admin' | 'User-Suggestion';
  status: ParkingSpaceStatus;
}

interface Booking {
  id: string;
  renter_id: string;
  parking_space_id: string;
  booking_start: string;
  booking_end: string;
  is_advance: boolean;
  price: number;
  status: BookingStatus;
  created_at: string;
  parking_space: ParkingSpace;
}

const BookingStatusBadge = ({ status }: { status: BookingStatus }) => {
  const theme = useTheme();
  
  const getStatusStyle = (status: BookingStatus) => {
    const baseStyle = {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
    };
    
    const styles = {
      Completed: { backgroundColor: theme.colors.primary, opacity: 0.9 },
      Cancelled: { backgroundColor: theme.colors.error, opacity: 0.9 },
      Confirmed: { backgroundColor: theme.colors.secondary, opacity: 0.9 },
    };
    
    return { ...baseStyle, ...styles[status] };
  };

  return (
    <Surface style={getStatusStyle(status)}>
      <Text style={{ color: 'white', fontWeight: '600' }}>{status}</Text>
    </Surface>
  );
};

const BookingDetails = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text variant="bodyMedium" style={styles.label}>{label}</Text>
    <Text variant="bodyMedium" style={styles.value}>{value}</Text>
  </View>
);

const SpaceTypeIndicator = ({ type }: { type: ParkingSpaceType }) => {
  const theme = useTheme();
  
  const getTypeStyle = () => ({
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.secondaryContainer,
    marginBottom: 8,
  });

  return (
    <Surface style={getTypeStyle()}>
      <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>
        {type}
      </Text>
    </Surface>
  );
};

const EmptyState = () => (
  <View style={styles.emptyState}>
    <Text variant="headlineSmall">No Upcoming Bookings</Text>
    <Text variant="bodyMedium" style={styles.emptyStateSubtext}>
      Your future bookings will appear here
    </Text>
  </View>
);

const useBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          parking_space:parking_spaces(
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
            status
          )
        `)
        .eq('renter_id', user.id)
        .gte('booking_start', new Date().toISOString())
        .order('booking_start', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      // Get the current booking details first
      const { data: bookingToCancel, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          *,
          renter:user_accounts!bookings_renter_id_fkey(id, balance),
          transaction:transactions(id, payment_amount)
        `)
        .eq('id', bookingId)
        .single();
  
      if (fetchError) throw fetchError;
  
      // Check if booking can be cancelled
      const bookingStartTime = new Date(bookingToCancel.booking_start);
      const now = new Date();
      const minutesDifference = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60);
  
      // Calculate potential refund amount (50% of booking price)
      const potentialRefundAmount = bookingToCancel.price * 0.5;  
  
      if (minutesDifference > 0) {
        // Find the original booking transaction
        const originalTransaction = bookingToCancel.transaction[0];
        if (!originalTransaction) {
          throw new Error('No original transaction found for this booking');
        }
  
        // Prepare refund transaction
        const { data: refundTransaction, error: refundError } = await supabase
          .from('transactions')
          .insert({
            booking_id: bookingId,
            payment_amount: potentialRefundAmount,
            transaction_type: 'Refund',
            status: 'Pending',
            from_account_id: originalTransaction.to_account_id, // typically the parking space owner's account
            to_account_id: bookingToCancel.renter_id, // refund back to the renter
            parking_space_id: bookingToCancel.parking_space_id
          })
          .select()
          .single();
  
        if (refundError) throw refundError;
  
        // Update booking status
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ 
            status: 'Cancelled', 
          })
          .eq('id', bookingId);
  
        if (updateError) throw updateError;
  
        await fetchBookings();
  
        // Different alert based on time remaining
        if (minutesDifference > 30) {
          // More than 30 minutes away
          Alert.alert(
            'Booking Cancellation',
            `Your booking will be cancelled. A refund of ₹${potentialRefundAmount.toFixed(2)} (50% of booking amount) will be processed.`,
            [{ text: 'OK' }]
          );
        } else {
          // Less than 30 minutes away
          Alert.alert(
            'Booking Cancellation',
            'Your booking will be cancelled. Due to the proximity to the booking start time, only a partial refund of 50% will be processed.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // Booking has already started or passed
        Alert.alert(
          'Cannot Cancel Booking',
          'Bookings cannot be cancelled once they have started or passed.'
        );
      }
  
    } catch (error) {
      console.error('Cancellation error:', error);
      Alert.alert(
        'Error', 
        'Failed to cancel booking. Please try again later.'
      );
    }
  };

  return { bookings, loading, error, fetchBookings, cancelBooking };
};

export default function UpcomingBookingsScreen() {
  const theme = useTheme();
  const { bookings, loading, error, fetchBookings, cancelBooking } = useBookings();

  useEffect(() => {
    fetchBookings();
  }, []);

  const formatDuration = (start: string, end: string) => {
    const hours = Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)
    );
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  const renderBookingCard = ({ item }: { item: Booking }) => (
    <Card style={styles.bookingCard}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <SpaceTypeIndicator type={item.parking_space.type} />
            <Text variant="titleLarge" style={styles.spaceName}>
              {item.parking_space.title}
            </Text>
            {item.parking_space.verified && (
              <Text variant="labelSmall" style={styles.verifiedBadge}>
                ✓ Verified Space
              </Text>
            )}
            {item.parking_space.review_score > 0 && (
              <Text variant="bodySmall" style={styles.rating}>
                ★ {item.parking_space.review_score.toFixed(1)}
              </Text>
            )}
          </View>
          <BookingStatusBadge status={item.status} />
        </View>

        <Surface style={styles.detailsContainer}>
          <BookingDetails 
            label="Duration" 
            value={formatDuration(item.booking_start, item.booking_end)} 
          />
          <BookingDetails 
            label="Start" 
            value={format(new Date(item.booking_start), 'MMM d, yyyy h:mm a')} 
          />
          <BookingDetails 
            label="End" 
            value={format(new Date(item.booking_end), 'MMM d, yyyy h:mm a')} 
          />
          <BookingDetails 
            label="Vehicle Types" 
            value={item.parking_space.vehicle_types_allowed.join(', ')} 
          />
          <BookingDetails 
            label="Type" 
            value={item.is_advance ? 'Advance Booking' : 'Instant Booking'} 
          />
          <BookingDetails 
            label="Amount" 
            value={`₹${item.price.toFixed(2)}`} 
          />
          {item.parking_space.occupancy < (item.parking_space.capacity || 0) && (
            <Text variant="labelSmall" style={styles.availabilityIndicator}>
              {item.parking_space.capacity !== null ? item.parking_space.capacity - item.parking_space.occupancy : 'N/A'} spots available
            </Text>
          )}
        </Surface>

        {item.status === 'Confirmed' && (
          <Button
            mode="contained"
            onPress={() => {
              Alert.alert(
                'Cancel Booking',
                'Are you sure you want to cancel this booking?',
                [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes', onPress: () => cancelBooking(item.id) }
                ]
              );
            }}
            style={styles.cancelButton}
            buttonColor={theme.colors.error}
          >
            Cancel Booking
          </Button>
        )}
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="headlineSmall" style={styles.errorText}>
          Error: {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        onRefresh={fetchBookings}
        refreshing={loading}
        ListEmptyComponent={EmptyState}
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
    flexGrow: 1,
  },
  bookingCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  spaceName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  verifiedBadge: {
    color: '#4CAF50',
    marginBottom: 4,
  },
  rating: {
    color: '#FFA000',
    marginBottom: 4,
  },
  detailsContainer: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateSubtext: {
    color: '#666',
    marginTop: 8,
  },
  availabilityIndicator: {
    color: '#4CAF50',
    marginTop: 8,
  },
});