import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Button } from 'react-native-rapi-ui';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList, ParkingSpace } from '../../types/types';

type AdminDashboardNav = NativeStackNavigationProp<RootStackParamList, 'AdminDashboard'>;

interface DashboardStats {
  public: {
    total: number;
    verified: number;
    unverified: number;
  };
  lenderProvided: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  userSuggested: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  nonAccountable: {
    total: number;
  };
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    public: { total: 0, verified: 0, unverified: 0 },
    lenderProvided: { pending: 0, approved: 0, rejected: 0, total: 0 },
    userSuggested: { pending: 0, approved: 0, rejected: 0, total: 0 },
    nonAccountable: { total: 0 }
  });
  const navigation = useNavigation<AdminDashboardNav>();  

  useFocusEffect(
    React.useCallback(() => {
      fetchStats();
      return () => {
        // Optional cleanup if needed
      };
    }, [])
  );

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchPublicSpaces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parking_spaces')
        .select('type,verified')
        .eq('type', 'Public')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        // Update relevant stats after fetching public spaces
        const newStats = { ...stats };
        newStats.public = {
          total: data.length,
          verified: data.filter(space => space.verified).length,
          unverified: data.filter(space => !space.verified).length
        };
        setStats(newStats);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch public spaces');
      console.error('Error fetching public spaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parking_spaces')
        .select('type,verified,added_by,status') as { data: ParkingSpace[] | null; error: any };

      if (error) throw error;
      
      if (data) {
        const newStats: DashboardStats = {
          public: {
            total: data.filter(space => space.type === 'Public').length,
            verified: data.filter(space => space.type === 'Public' && space.verified).length,
            unverified: data.filter(space => space.type === 'Public' && !space.verified).length
          },
          lenderProvided: {
            total: data.filter(space => space.type === 'Lender-provided').length,
            pending: data.filter(space => 
              space.type === 'Lender-provided' && 
              space.added_by === 'Lender' && 
              space.status === 'Pending'
            ).length,
            approved: data.filter(space => 
              space.type === 'Lender-provided' && 
              space.added_by === 'Lender' && 
              space.status === 'Approved'
            ).length,
            rejected: data.filter(space => 
              space.type === 'Lender-provided' && 
              space.added_by === 'Lender' && 
              space.status === 'Rejected'
            ).length
          },
          userSuggested: {
            total: data.filter(space => space.added_by === 'User-Suggestion').length,
            pending: data.filter(space => 
              space.added_by === 'User-Suggestion' && 
              space.status === 'Pending'
            ).length,
            approved: data.filter(space => 
              space.added_by === 'User-Suggestion' && 
              space.status === 'Approved'
            ).length,
            rejected: data.filter(space => 
              space.added_by === 'User-Suggestion' && 
              space.status === 'Rejected'
            ).length
          },
          nonAccountable: {
            total: data.filter(space => space.type === 'Non-accountable').length
          }
        };
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      Alert.alert('Error', 'Failed to fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Public Spaces Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Public Spaces Management</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.public.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.public.verified}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.public.unverified}</Text>
            <Text style={styles.statLabel}>Unverified</Text>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            text="Create Public Space"
            onPress={() => navigation.navigate('CreatePublicSpace', { onCreate: fetchPublicSpaces })}
            style={styles.createButton}
          />
          <Button
            text="Manage Public Spaces"
            onPress={() => navigation.navigate('ManagePublicSpaces')}
            style={styles.button}
          />
        </View>
      </View>

      {/* Lender Spaces Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lender Spaces Management</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.lenderProvided.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.lenderProvided.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.lenderProvided.rejected}</Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            text="Review Pending Spaces"
            onPress={() => navigation.navigate('LenderPendingSpaces')}
            style={styles.button}
          />
          <Button
            text="Manage All Spaces"
            onPress={() => navigation.navigate('ManageLenderSpaces')}
            style={styles.button}
          />
        </View>
      </View>

      {/* User-Suggested Spaces Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User-Suggested Spaces</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.userSuggested.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.userSuggested.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.userSuggested.rejected}</Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            text="Review Suggestions"
            onPress={() => navigation.navigate('UserSuggestedSpaces')}
            style={styles.button}
          />
          <Button
            text="Manage All Suggestions"
            onPress={() => navigation.navigate('ManageUserSuggestions')}
            style={styles.button}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1e293b',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#f0f9ff',
    padding: 15,
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
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    flex: 1,
    minWidth: '48%',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    minWidth: '48%',
  },
});

function setSpaces(arg0: any[]) {
  throw new Error('Function not implemented.');
}
