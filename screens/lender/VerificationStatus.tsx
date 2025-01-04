import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button } from 'react-native-rapi-ui';

interface ParkingSpace {
  id: string;
  title: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  verified: boolean;
  rejection_reason: string | null;
  created_at: string;
}

export default function VerificationStatus() {
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVerificationStatus = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: supabaseError } = await supabase
        .from('parking_spaces')
        .select(`
          id,
          title,
          status,
          verified,
          rejection_reason,
          created_at
        `)
        .eq('user_id', user.id)
        .eq('type', 'Lender-provided')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      setSpaces(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch verification status';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVerificationStatus();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchVerificationStatus();

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
          fetchVerificationStatus();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  const renderSpaceItem = ({ item }: { item: ParkingSpace }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
          {item.status}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Verification Status:</Text>
        <Text style={[styles.infoValue, item.verified ? styles.verified : styles.unverified]}>
          {item.verified ? 'Verified' : 'Unverified'}
        </Text>
      </View>

      <Text style={styles.dateText}>
        Submitted: {new Date(item.created_at).toLocaleDateString()}
      </Text>

      {item.rejection_reason && (
        <View style={styles.rejectionContainer}>
          <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
          <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
        </View>
      )}
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
          onPress={fetchVerificationStatus}
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
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No parking spaces found. Add a space to see its verification status.
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  verified: {
    color: '#166534',
  },
  unverified: {
    color: '#92400e',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  rejectionContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  rejectionLabel: {
    color: '#991b1b',
    fontWeight: '600',
    marginBottom: 4,
  },
  rejectionText: {
    color: '#991b1b',
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