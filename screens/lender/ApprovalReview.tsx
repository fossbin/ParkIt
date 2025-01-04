import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button } from 'react-native-rapi-ui';

interface ParkingSpace {
  id: string;
  title: string;
  type: 'Public' | 'Lender-provided' | 'Non-accountable';
  status: 'Pending' | 'Approved' | 'Rejected';
  rejection_reason: string | null;
  created_at: string;
  price: number;
  capacity: number;
  vehicle_types_allowed: string[];
}

export default function ApprovalReview() {
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchApprovalStatus = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('parking_spaces')
        .select(`
          id,
          title,
          type,
          status,
          rejection_reason,
          created_at,
          price,
          capacity,
          vehicle_types_allowed
        `)
        .eq('user_id', user.id)
        .eq('type', 'Lender-provided')
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) throw supabaseError;

      setSpaces(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch approval status';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchApprovalStatus();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchApprovalStatus();

    const subscription = supabase
      .channel('parking_spaces_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parking_spaces',
        },
        () => {
          fetchApprovalStatus();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [statusFilter]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Approved':
        return styles.statusApproved;
      case 'Rejected':
        return styles.statusRejected;
      default:
        return styles.statusPending;
    }
  };

  const FilterButton = ({ status }: { status: string }) => (
    <Button
      text={status}
      onPress={() => setStatusFilter(statusFilter === status ? null : status)}
      status={statusFilter === status ? "primary" : "info"}
      style={styles.filterButton}
    />
  );

  const renderSpaceItem = ({ item }: { item: ParkingSpace }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
          {item.status}
        </Text>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Price:</Text>
          <Text style={styles.infoValue}>${item.price}/hr</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Capacity:</Text>
          <Text style={styles.infoValue}>{item.capacity} spaces</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vehicle Types:</Text>
          <Text style={styles.infoValue}>{item.vehicle_types_allowed.join(', ')}</Text>
        </View>

        <Text style={styles.dateText}>
          Submitted: {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      {item.status === 'Rejected' && item.rejection_reason && (
        <View style={styles.rejectionContainer}>
          <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
          <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
        </View>
      )}

      {item.status === 'Pending' && (
        <View style={styles.pendingNote}>
          <Text style={styles.pendingText}>
            Your space is under review. We'll notify you once the review is complete.
          </Text>
        </View>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.filterContainer}>
      <Text style={styles.filterLabel}>Filter by status:</Text>
      <View style={styles.filterButtons}>
        <FilterButton status="Pending" />
        <FilterButton status="Approved" />
        <FilterButton status="Rejected" />
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button
          text="Retry"
          onPress={fetchApprovalStatus}
          status="primary"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={spaces}
        renderItem={renderSpaceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No parking spaces found matching the selected filter.
          </Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
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
  infoContainer: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  rejectionContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  rejectionLabel: {
    color: '#991b1b',
    fontWeight: '600',
    marginBottom: 4,
  },
  rejectionText: {
    color: '#991b1b',
  },
  pendingNote: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  pendingText: {
    color: '#92400e',
    fontSize: 14,
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