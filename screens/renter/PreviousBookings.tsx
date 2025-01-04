import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Card, Title, Paragraph, Chip, Surface, Button, Snackbar, Text, Portal, Modal, TextInput } from 'react-native-paper';
import { format } from 'date-fns';
import { Rating } from '../../components/Rating'; // Import the custom Rating component


type BookingStatus = 'Confirmed' | 'Completed' | 'Cancelled';

interface Review {
  id: string;
  user_id: string;
  parking_space_id: string;
  rating: number;
  review_text: string;
  created_at: string;
  status: 'Active' | 'Inactive';
}

interface Booking {
  id: string;
  renter_id: string;
  parking_space_id: string;
  booking_start: string;
  booking_end: string;
  price: number;
  status: BookingStatus;
  created_at: string;
}

interface ParkingSpace {
  id: string;
  title: string;
  type: 'Public' | 'Lender-provided' | 'Non-accountable';
  price: number;
  capacity: number;
  vehicle_types_allowed: string[];
  photos: any;
  occupancy: number;
  verified: boolean;
  review_score: number;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export default function PreviousBookingsScreen() {
  const [bookings, setBookings] = useState<(Booking & { parking_space: ParkingSpace; review?: Review })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // Review state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<(Booking & { parking_space: ParkingSpace; review?: Review }) | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchPreviousBookings = useCallback(async () => {
    try {
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const now = new Date().toISOString();
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          parking_space:parking_spaces(
            id,
            title,
            type,
            price,
            capacity,
            vehicle_types_allowed,
            photos,
            occupancy,
            verified,
            review_score,
            status
          )
        `)
        .eq('renter_id', user.id)
        .lt('booking_end', now)
        .order('booking_end', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Fetch reviews for these bookings
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', user.id)
        .in('parking_space_id', bookingsData.map(b => b.parking_space.id))
        .eq('status', 'Active');

      if (reviewsError) throw reviewsError;

      // Map reviews to bookings
      const bookingsWithReviews = bookingsData.map(booking => ({
        ...booking,
        review: reviewsData.find(review => review.parking_space_id === booking.parking_space.id)
      }));
      
      // Filter out bookings with rejected or pending parking spaces
      const filteredBookings = bookingsWithReviews.filter(
        booking => booking.parking_space?.status === 'Approved'
      );
      
      setBookings(filteredBookings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching bookings';
      setError(errorMessage);
      setSnackbarMessage(errorMessage);
      setSnackbarVisible(true);
    }
  }, []);

  useEffect(() => {
    fetchPreviousBookings().finally(() => setLoading(false));
  }, [fetchPreviousBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPreviousBookings();
    setRefreshing(false);
  }, [fetchPreviousBookings]);

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'Completed': return '#4CAF50';
      case 'Cancelled': return '#F44336';
      case 'Confirmed': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const hours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  const handleReviewPress = (booking: Booking & { parking_space: ParkingSpace; review?: Review }) => {
    setSelectedBooking(booking);
    if (booking.review) {
      setRating(booking.review.rating);
      setReviewText(booking.review.review_text);
    } else {
      setRating(5);
      setReviewText('');
    }
    setReviewModalVisible(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedBooking || submittingReview) return;

    try {
      setSubmittingReview(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (selectedBooking.review) {
        // Update existing review
        const { error } = await supabase
          .from('reviews')
          .update({
            rating,
            review_text: reviewText,
          })
          .eq('id', selectedBooking.review.id);

        if (error) throw error;
      } else {
        // Create new review
        const { error } = await supabase
          .from('reviews')
          .insert({
            user_id: user.id,
            parking_space_id: selectedBooking.parking_space.id,
            rating,
            review_text: reviewText,
          });

        if (error) throw error;
      }

      setSnackbarMessage('Review submitted successfully');
      setSnackbarVisible(true);
      setReviewModalVisible(false);
      await fetchPreviousBookings();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit review';
      setSnackbarMessage(errorMessage);
      setSnackbarVisible(true);
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderReviewModal = () => (
    <Portal>
      <Modal
        visible={reviewModalVisible}
        onDismiss={() => setReviewModalVisible(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Title style={styles.modalTitle}>
          {selectedBooking?.review ? 'Update Review' : 'Add Review'}
        </Title>
        <View style={styles.ratingContainer}>
          <Rating
            value={rating}
            onValueChange={setRating}
            maximumValue={5}
            size={30}
          />
        </View>
        <TextInput
          mode="outlined"
          label="Review"
          value={reviewText}
          onChangeText={setReviewText}
          multiline
          numberOfLines={4}
          style={styles.reviewInput}
        />
        <View style={styles.modalButtons}>
          <Button
            mode="outlined"
            onPress={() => setReviewModalVisible(false)}
            style={styles.modalButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmitReview}
            loading={submittingReview}
            disabled={submittingReview}
            style={styles.modalButton}
          >
            Submit
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  const renderBookingItem = ({ item }: { item: Booking & { parking_space: ParkingSpace; review?: Review } }) => (
    <Card style={styles.bookingCard}>
      <Card.Content>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Title>{item.parking_space.title}</Title>
          </View>
          <Chip
            mode="flat"
            textStyle={{ color: 'white' }}
            style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
          >
            {item.status}
          </Chip>
        </View>
        
        <View style={styles.spaceDetails}>
          <Chip style={styles.typeChip}>
            {item.parking_space.type}
          </Chip>
          {item.parking_space.review_score > 0 && (
            <Chip style={styles.ratingChip}>
              ★ {item.parking_space.review_score.toFixed(1)}
            </Chip>
          )}
        </View>
        
        <Surface style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Duration:</Paragraph>
            <Paragraph>{formatDuration(item.booking_start, item.booking_end)}</Paragraph>
          </View>
          
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Start:</Paragraph>
            <Paragraph>{format(new Date(item.booking_start), 'MMM d, yyyy h:mm a')}</Paragraph>
          </View>
          
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>End:</Paragraph>
            <Paragraph>{format(new Date(item.booking_end), 'MMM d, yyyy h:mm a')}</Paragraph>
          </View>
          
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Vehicle Types:</Paragraph>
            <Paragraph>{item.parking_space.vehicle_types_allowed.join(', ')}</Paragraph>
          </View>
          
          <View style={styles.detailRow}>
            <Paragraph style={styles.label}>Amount Paid:</Paragraph>
            <Paragraph style={styles.price}>${item.price.toFixed(2)}</Paragraph>
          </View>
        </Surface>

        {item.status === 'Completed' && (
          <Button
            mode="contained"
            onPress={() => handleReviewPress(item)}
            style={styles.reviewButton}
          >
            {item.review ? 'Update Review' : 'Add Review'}
          </Button>
        )}

        {item.review && (
          <Surface style={styles.reviewContainer}>
            <View style={styles.reviewHeader}>
              <Title style={styles.reviewTitle}>Your Review</Title>
              <Rating value={item.review.rating} size={20} readonly />
            </View>
            <Paragraph>{item.review.review_text}</Paragraph>
          </Surface>
        )}
      </Card.Content>
    </Card>
  );

  const renderEmptyComponent = () => (
    <View style={styles.centerContainer}>
      {error ? (
        <>
          <Title style={styles.errorText}>Error loading bookings</Title>
          <Text style={styles.errorDescription}>{error}</Text>
          <Button mode="contained" onPress={onRefresh} style={styles.retryButton}>
            Retry
          </Button>
        </>
      ) : (
        <>
          <Title style={styles.emptyTitle}>No Previous Bookings</Title>
          <Text style={styles.emptyDescription}>
            You haven't made any bookings yet or all your bookings are still upcoming.
          </Text>
          <Button 
            mode="contained" 
            onPress={() => {/* Navigate to booking screen */}} 
            style={styles.bookNowButton}
          >
            Book Now
          </Button>
        </>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading your previous bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyComponent}
      />
      {renderReviewModal()}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginRight: 8,
  },
  spaceDetails: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    backgroundColor: '#E3F2FD',
  },
  ratingChip: {
    backgroundColor: '#FFD700',
  },
  detailsContainer: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#666',
    fontWeight: 'bold',
  },
  price: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  statusChip: {
    borderRadius: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  retryButton: {
    marginTop: 16,
  },
  errorText: {
    color: '#F44336',
    marginBottom: 8,
  },
  errorDescription: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#666',
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptyDescription: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#666',
  },
  bookNowButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
  modalButton: {
    minWidth: 100,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  reviewInput: {
    marginTop: 16,
  },
  parkingSpaceTitle: {
    marginTop: 8,
    color: '#666',
  },
  reviewButton: {
    marginTop: 16,
  },
  reviewContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewTitle: {
    fontSize: 16,
  },
  starRating: {
    flexDirection: 'row',
  },
  star: {
    color: '#FFD700',
    fontSize: 16,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
});