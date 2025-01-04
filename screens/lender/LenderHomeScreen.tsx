import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView, ScrollView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button } from 'react-native-rapi-ui';
import { useNavigation, useIsFocused } from '@react-navigation/native';

type ParkingSpaceType = 'Public' | 'Lender-provided' | 'Non-accountable';
type ParkingSpaceStatus = 'Pending' | 'Approved' | 'Rejected';

type ParkingSpace = {
  id: string;
  title: string;
  price: number;
  type: ParkingSpaceType;
  verified: boolean;
  status: ParkingSpaceStatus;
  rejection_reason: string | null;
  vehicle_types_allowed: string[];
  review_score: number;
  capacity: number;
  occupancy: number;
  photos: any;
  created_at: string;
  added_by: 'Lender' | 'Admin' | 'User-Suggestion';
};

type SpaceSection = 'approved' | 'pending' | 'rejected';

type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  phone_number: string | null;
};

export default function LenderHomeScreen() {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [parkingSpaces, setParkingSpaces] = useState<{
    approved: ParkingSpace[];
    pending: ParkingSpace[];
    rejected: ParkingSpace[];
  }>({
    approved: [],
    pending: [],
    rejected: []
  });
  const [activeSection, setActiveSection] = useState<SpaceSection>('approved');
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const checkUserProfile = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('users')
        .select('name, phone_number')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setUserProfile({
        id: user.id,
        email: user.email ?? '',
        name: data.name,
        phone_number: data.phone_number
      });
      setProfileChecked(true);
    } catch (err) {
      console.error('Error checking user profile:', err);
      setProfileChecked(true);
    }
  }, []);

  const fetchParkingSpaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('parking_spaces')
        .select(`
          *,
          parking_space_locations!inner (
            latitude,
            longitude
          )
        `)
        .eq('user_id', user.id)
        .eq('type','Lender-provided');
      if (error) throw error;

      // Transform the data to include location information
      const transformedData = data?.map(space => ({
        ...space,
        latitude: space.parking_space_locations.latitude,
        longitude: space.parking_space_locations.longitude
      }));

      const sorted = {
        approved: transformedData?.filter(space => space.status === 'Approved' && space.verified) || [],
        pending: transformedData?.filter(space => space.status === 'Pending' || (!space.verified && space.status!='Rejected'))|| [],
        rejected: transformedData?.filter(space => space.status === 'Rejected') || []
      };

      setParkingSpaces(sorted);
    } catch (error: any) {
      setError('An error occurred while fetching parking spaces. Please try again.');
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      checkUserProfile();
    }
  }, [isFocused, checkUserProfile]);

  useEffect(() => {
    if (profileChecked && isProfileComplete()) {
      fetchParkingSpaces();
    }
  }, [profileChecked, userProfile, fetchParkingSpaces]);

  const isProfileComplete = () => {
    return userProfile?.name && userProfile?.phone_number;
  };

  const renderProfileCompletion = () => {
    if (profileChecked && !isProfileComplete()) {
      return (
        <TouchableOpacity 
          style={styles.notificationBanner}
          onPress={() => navigation.navigate('Account', { screen: 'AccountPreferences' })}
        >
          <Text style={styles.notificationText}>
            Please complete your profile to continue using lender features
          </Text>
          <Text style={styles.notificationSubtext}>
            Tap here to update your profile
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderRejectedSpaceDetails = (item: ParkingSpace) => (
    <View style={styles.rejectedSpaceDetails}>
      <View style={styles.rejectionContainer}>
        <Text style={styles.rejectionLabel}>Reason for Rejection:</Text>
        <Text style={styles.rejectionReason}>
          {item.rejection_reason || 'No specific reason provided'}
        </Text>
      </View>
      <Text style={styles.rejectedSpaceMessage}>
        This parking space could not be approved. Review the rejection reason and make necessary modifications before resubmitting.
      </Text>
    </View>
  );

  const renderParkingCard = (item: ParkingSpace) => {
    const isRejected = item.status === 'Rejected';
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.parkingCard}
        onPress={() => !isRejected && navigation.navigate('ParkingSpotDetails', { parkingSpaceId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.price}>₹{item.price?.toFixed(2) || '0.00'}/hour</Text>
            <Text style={styles.type}>{item.type || 'Not specified'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.occupancy}>
              Spaces: {item.occupancy}/{item.capacity}
            </Text>
            <Text style={styles.reviewScore}>★ {item.review_score?.toFixed(1) || '0.0'}</Text>
          </View>

          <View style={styles.tags}>
            {item.vehicle_types_allowed?.map((type, index) => (
              <Text key={index} style={styles.tag}>{type}</Text>
            ))}
          </View>

          {item.added_by && (
            <Text style={styles.addedBy}>Added by: {item.added_by}</Text>
          )}

          {isRejected && renderRejectedSpaceDetails(item)}

          {!isRejected && (
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('EditLenderSpace', { parkingSpace: item })}
              >
                <Text style={styles.editButtonText}>Edit Space</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMainContent = () => {
    // If profile is not complete, show a message
    if (profileChecked && !isProfileComplete()) {
      return (
        <View style={styles.incompleteProfileContent}>
          <Text style={styles.incompleteProfileText}>
            Please complete your profile information to access lender features
          </Text>
          <Button
            text="Complete Profile"
            onPress={() => navigation.navigate('Account', { screen: 'AccountPreferences' })}
            style={styles.completeProfileButton}
          />
        </View>
      );
    }

    // Regular content when profile is complete
    return (
      <ScrollView style={styles.mainContent}>
        {renderProfileCompletion()}
        
        <View style={styles.topButtons}>
          <View style={styles.buttonRow}>
            <Button
              text="Add New Space"
              status="primary"
              onPress={() => navigation.navigate('CreateSpot')}
              style={StyleSheet.flatten([styles.actionButton, styles.createButton])}
            />
            <Button
              text="Check Status"
              status="info"
              onPress={() => navigation.navigate('VerificationStatus')}
              style={StyleSheet.flatten([styles.actionButton])}
            />
          </View>
        </View>

        <View style={styles.sectionButtons}>
          {(['approved', 'pending', 'rejected'] as SpaceSection[]).map(section => (
            <TouchableOpacity
              key={section}
              style={[
                styles.sectionTab, 
                activeSection === section && styles.activeTab
              ]}
              onPress={() => setActiveSection(section)}
            >
              <Text style={[
                styles.sectionTabText, 
                activeSection === section && styles.activeTabText
              ]}>
                {section.charAt(0).toUpperCase() + section.slice(1)} ({parkingSpaces[section].length})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2F7C6E" style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : parkingSpaces[activeSection].length === 0 ? (
          <Text style={styles.noSpacesText}>
            No {activeSection} parking spaces found.
          </Text>
        ) : (
          <View style={styles.listContainer}>
            {parkingSpaces[activeSection].map(renderParkingCard)}
          </View>
        )}
      </ScrollView>
    );
  };

  const getStatusColor = (status: ParkingSpaceStatus) => {
    switch (status) {
      case 'Approved': return '#4CAF50';
      case 'Pending': return '#FFC107';
      case 'Rejected': return '#F44336';
      default: return '#757575';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Parking Spaces</Text>
      </View>
      {renderMainContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mainContent: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, 
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  editButton: {
    backgroundColor: '#2F7C6E',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#2F7C6E',
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  topButtons: {
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  createButton: {
    marginBottom: 0,
  },
  sectionButtons: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  sectionTab: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#2F7C6E',
  },
  sectionTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  parkingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2F7C6E',
  },
  type: {
    fontSize: 14,
    color: '#666',
  },
  occupancy: {
    fontSize: 14,
    color: '#666',
  },
  reviewScore: {
    fontSize: 14,
    color: '#FFA000',
    fontWeight: '600',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    fontSize: 12,
    backgroundColor: '#E3F2FD',
    color: '#1976D2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  rejectionContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D32F2F',
    marginBottom: 4,
  },
  rejectionReason: {
    fontSize: 12,
    color: '#D32F2F',
  },
  flatListContainer: {
    padding: 16,
  },
  bottomButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  bottomButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  loader: {
    marginTop: 32,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: 32,
    padding: 16,
  },
  noSpacesText: {
    textAlign: 'center',
    marginTop: 32,
    color: '#666',
    padding: 16,
  },
  addedBy: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  notificationBanner: {
    backgroundColor: '#FF9800',
    padding: 16,
    width: '100%',
  },
  notificationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  notificationSubtext: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  incompleteProfileContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  incompleteProfileText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  manageButton: {
    backgroundColor: '#4A90E2',
    padding: 8,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  manageButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  completeProfileButton: {
    marginTop: 20,
    backgroundColor: '#2F7C6E',
  },
  rejectedSpaceDetails: {
    marginTop: 12,
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
    padding: 12,
  },
  rejectedSpaceMessage: {
    fontSize: 12,
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});