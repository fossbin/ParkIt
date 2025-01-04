import React from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { Button } from 'react-native-rapi-ui';
import { supabase } from '../../lib/supabase';
import { ParkingSpace, Booking } from '../../types/types';

interface ParkingSpaceBookingsProps {
  parkingSpace: ParkingSpace;
  onStatusUpdate: () => void;
}

export default function ParkingSpaceBookings({ parkingSpace, onStatusUpdate }: ParkingSpaceBookingsProps) {
  const handleUpdateStatus = async (bookingId: string, status: 'Completed' | 'Cancelled') => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId);

      if (error) throw error;

      Alert.alert('Success', `Booking marked as ${status}`);
      onStatusUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update booking status';
      Alert.alert('Error', errorMessage);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Completed':
        return styles.statusCompleted;
      case 'Cancelled':
        return styles.statusCancelled;
      default:
        return styles.statusConfirmed;
    }
  };

  const renderBookingItem = ({ item }: { item: Booking | undefined }) => {
    if (!item) return null;

    return (
      <View style={styles.bookingCard}>
        <View style={styles.headerRow}>
          <Text style={styles.renterName}>{item.renter.name || 'N/A'}</Text>
          <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
            {item.status}
          </Text>
        </View>

        <View style={styles.infoGrid}>
          <InfoRow label="Email" value={item.renter.email || 'N/A'} />
          <InfoRow label="Phone" value={item.renter.phone_number || 'N/A'} />
          <InfoRow label="Price" value={item.price ? `₹${item.price}` : 'N/A'} />
          <InfoRow label="Start" value={formatDateTime(item.booking_start)} />
          <InfoRow label="End" value={formatDateTime(item.booking_end)} />
          <InfoRow 
            label="Vehicle" 
            value={`${item.vehicle.manufacturer || 'N/A'} ${item.vehicle.model || 'N/A'}`} 
          />
        </View>

        {item.status === 'Confirmed' && (
          <View style={styles.actionButtons}>
            <Button
              text="Mark Completed"
              onPress={() => handleUpdateStatus(item.id, 'Completed')}
              status="success"
              size="sm"
            />
            <Button
              text="Cancel Booking"
              onPress={() => handleUpdateStatus(item.id, 'Cancelled')}
              status="danger"
              size="sm"
            />
          </View>
        )}

        <Text style={styles.bookingDate}>
          Booked on: {formatDateTime(item.created_at || '')}
        </Text>
      </View>
    );
  };

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.parkingSpaceHeader}>
        <Text style={styles.parkingSpaceTitle}>{parkingSpace.title}</Text>
        <Text style={styles.parkingSpaceType}>{parkingSpace.type || 'N/A'}</Text>
      </View>
      <Text style={styles.vehiclesAllowed}>
        Allowed Vehicles: {parkingSpace.vehicle_types_allowed.join(', ')}
      </Text>
      <Text style={styles.parkingSpaceInfo}>
        Capacity: {parkingSpace.capacity} | Occupancy: {parkingSpace.occupancy || 0}
      </Text>
      <Text style={styles.parkingSpaceInfo}>
        Price: {parkingSpace.price ? `₹${parkingSpace.price}` : 'N/A'} | 
        Review Score: {parkingSpace.review_score ? parkingSpace.review_score.toFixed(1) : 'N/A'}
      </Text>
      <FlatList
        data={parkingSpace.bookings || []}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item?.id || ''}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No bookings for this parking space</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  parkingSpaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  parkingSpaceTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  parkingSpaceType: {
    fontSize: 14,
    color: '#666',
  },
  vehiclesAllowed: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  bookingCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  renterName: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '500',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusCancelled: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  statusConfirmed: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  infoGrid: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    color: '#666',
    marginRight: 8,
    fontSize: 14,
    width: 60,
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  bookingDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 16,
  },
  parkingSpaceInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});

