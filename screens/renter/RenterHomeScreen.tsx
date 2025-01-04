import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text, SafeAreaView, Platform } from 'react-native';
import { Button } from 'react-native-rapi-ui';
import { Banner, Card, Title as CardTitle } from 'react-native-paper';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

interface Vehicle {
  id: string;
  renter_id: string;
  manufacturer: string;
  model: string;
  vehicle_type?: string; 
  license_plate: string;
  ownership_documents: string[];
}

interface OngoingBooking {
  id: string;
  parking_space_name: string;
  booking_start: string;
  booking_end: string;
}

interface UserProfile {
  name: string | null;
  phone_number: string | null;
}

export default function RenterHomeScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [ongoingBookings, setOngoingBookings] = useState<OngoingBooking[]>([]);

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      const { data, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('renter_id', user.id)
        .order('created_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;
      setVehicles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching vehicles');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOngoingBookings = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) throw new Error('No user found');

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_start,
          booking_end,
          price,
          status,
          parking_spaces!inner (
            title
          )
        `)
        .eq('renter_id', user.id)
        .eq('status', 'Confirmed')
        .lt('booking_start', now)
        .gt('booking_end', now)
        .order('booking_start', { ascending: false });

      if (error) throw error;
      
      const formattedBookings: OngoingBooking[] = (data as any[]).map(booking => ({
        id: booking.id,
        parking_space_name: booking.parking_spaces.title,
        booking_start: booking.booking_start,
        booking_end: booking.booking_end,
        price: booking.price,
        status: booking.status,
      }));

      setOngoingBookings(formattedBookings);
    } catch (err) {
      console.error('Error fetching ongoing bookings:', err);
    }
  }, []);

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

      setUserProfile(data);
      setProfileChecked(true);
    } catch (err) {
      console.error('Error checking user profile:', err);
      setProfileChecked(true);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      checkUserProfile();
    }
  }, [isFocused, checkUserProfile]);

  useEffect(() => {
    if (profileChecked && isProfileComplete()) {
      fetchVehicles();
      fetchOngoingBookings();
    }
  }, [profileChecked, userProfile, fetchVehicles, fetchOngoingBookings]);

  const isProfileComplete = () => {
    return userProfile?.name && userProfile?.phone_number;
  };

  const handleDelete = async (vehicleId: string) => {
    Alert.alert(
      'Delete Vehicle',
      'Are you sure you want to delete this vehicle?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('vehicles')
                .delete()
                .eq('id', vehicleId);

              if (error) throw error;

              await fetchVehicles();
              Alert.alert('Success', 'Vehicle deleted successfully');
            } catch (error) {
              console.error('Error deleting vehicle:', error);
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
  };

  const renderVehicleCard = ({ item }: { item: Vehicle }) => {
    const isExpanded = expandedId === item.id;

    return (
      <Card 
        style={styles.vehicleCard}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
      >
        <Card.Content>
          <CardTitle>{item.manufacturer} {item.model}</CardTitle>
          <Text style={styles.licensePlate}>License Plate: {item.license_plate}</Text>
          {isExpanded && (
            <View style={styles.expandedContent}>
              <Text style={styles.documentsTitle}>
                Documents: {item.ownership_documents.length}/3
              </Text>
              {item.ownership_documents.map((doc, index) => (
                <Text key={`${item.id}-${index}`} style={styles.documentItem}>
                  {doc.split('/').pop()}
                </Text>
              ))}
              <View style={styles.buttonRow}>
                <Button
                  text="Edit"
                  onPress={() => navigation.navigate('EditVehicle', { vehicleId: item.id })}
                  style={StyleSheet.flatten([styles.actionButton, styles.editButton])}
                />
                <Button
                  text="Delete"
                  onPress={() => handleDelete(item.id)}
                  style={StyleSheet.flatten([styles.actionButton, styles.deleteButton])}
                />
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderOngoingBookings = () => {
    if (ongoingBookings.length === 0) {
      return <Text style={styles.sectionContent}>You have no ongoing parking sessions.</Text>;
    }

    return ongoingBookings.map((booking) => (
      <Card key={booking.id} style={styles.bookingCard}>
        <Card.Content>
          <Text style={styles.bookingText}>Parking Space: {booking.parking_space_name}</Text>
          <Text style={styles.bookingText}>
            Start: {new Date(booking.booking_start).toLocaleString()}
          </Text>
          <Text style={styles.bookingText}>
            End: {new Date(booking.booking_end).toLocaleString()}
          </Text>
        </Card.Content>
      </Card>
    ));
  };

  if (!profileChecked) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.statusText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isProfileComplete()) {
    return (
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.container}>
          <Text style={styles.headerTitle}>Welcome to ParkIt!</Text>
          <Text style={styles.statusText}>
            To get started, please complete your profile details in Account Details.
          </Text>
          <Button
            text="Go to Account Preferences"
            onPress={() => navigation.navigate('Account', { screen: 'AccountPreferences' })}
            style={styles.completeProfileButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.container}>
          <Text style={styles.headerTitle}>Renter Home</Text>
  
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Currently Ongoing Parking</Text>
            {renderOngoingBookings()}
          </View>
  
          <View style={styles.buttonRow}>
            <Button
              text="Previous Bookings"
              onPress={() => navigation.navigate('PreviousBookings')}
              style={styles.halfButton}
            />
            <Button
              text="Upcoming Bookings"
              onPress={() => navigation.navigate('UpcomingBookings')}
              style={styles.halfButton}
            />
          </View>
  
          <Button
            text="Book A Parking Space"
            onPress={() => navigation.navigate('MapScreen')}
            style={styles.bookButton}
          />
  
          <Text style={styles.sectionTitle}>Your Vehicles</Text>
          
          {loading ? (
            <Text style={styles.statusText}>Loading vehicles...</Text>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : vehicles.length === 0 ? (
            <Text style={styles.statusText}>No vehicles registered yet.</Text>
          ) : (
            vehicles.map(vehicle => (
              <Card key={vehicle.id} style={styles.vehicleCard}>
                {renderVehicleCard({ item: vehicle })}
              </Card>
            ))
          )}
  
          <View style={styles.addButtonContainer}>
            <Button
              text="Add New Vehicle"
              onPress={() => navigation.navigate('AddVehicle')}
              style={styles.addButton}
            />
          </View>
          </View>
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingVertical: 16,
    // Add bottom padding to account for navigation bar
    paddingBottom: Platform.OS === 'ios' ? 90 : 70,
  },
  bottomSpacing: {
    height: Platform.OS === 'ios' ? 20 : 0, // Additional spacing for iOS
  },
  container: {
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#555',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfButton: {
    flex: 0.48,
  },
  bookButton: {
    marginBottom: 16,
    backgroundColor: '#2196F3',
  },
  addButtonContainer: {
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  addButton: {
    backgroundColor: '#4CAF50',
  },
  vehicleCard: {
    marginBottom: 12,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  documentsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  documentItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  actionButton: {
    flex: 0.48,
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  licensePlate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginVertical: 16,
  },
  bookingCard: {
    marginBottom: 8,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
}),
  },
  bookingText: {
    fontSize: 14,
    marginBottom: 4,
  },
  completeProfileButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
  },
});

