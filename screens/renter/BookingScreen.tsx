import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, Platform } from 'react-native';
import { Card, Text, Button, Portal, Modal } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/types';

interface ParkingSpace {
  id: string;
  user_id: string;
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
  created_at: string;
  added_by: 'Lender' | 'Admin' | 'User-Suggestion';
  rejection_reason?: string;
}

interface Vehicle {
  id: string;
  renter_id: string;
  license_plate: string;
  manufacturer: string;
  model: string;
  vehicle_type: string,
  ownership_documents?: string[];
}

interface UserAccount {
  id: string;
  user_id: string;
  account_type: 'renter' | 'lender';
  balance: number;
}

type BookingScreenProps = NativeStackScreenProps<RootStackParamList, 'BookingScreen'>;

const BookingScreen: React.FC<BookingScreenProps> = ({ route }) => {
  const { parkingSpaceId } = route.params;
  const navigation = useNavigation();
  const [parkingSpace, setParkingSpace] = useState<ParkingSpace | null>(null);
  const [renterAccount, setRenterAccount] = useState<UserAccount | null>(null);
  const [lenderAccount, setLenderAccount] = useState<UserAccount | null>(null);
  const [userVehicles, setUserVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 3600000));
  const [dateTimePickerConfig, setDateTimePickerConfig] = useState<{
    show: boolean;
    mode: 'date' | 'time';
    isStart: boolean;
  }>({
    show: false,
    mode: 'date',
    isStart: true,
  });
  
  const [loading, setLoading] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  useEffect(() => {
    const initializeBookingScreen = async () => {
      try {
        // Fetch parking space first
        const parkingSpaceData = await fetchParkingSpace();
        
        // Then fetch user accounts with the parking space data
        await fetchUserAccounts(parkingSpaceData);
        
        // Fetch user vehicles - pass the parking space data to ensure it's available
        await fetchUserVehicles(parkingSpaceData);
      } catch (error) {
        console.error('Initialization error:', error);
        Alert.alert('Error', 'Failed to initialize booking screen');
        navigation.goBack();
      }
    };

    initializeBookingScreen();
  }, [parkingSpaceId]);

  const fetchUserVehicles = async (parkingSpaceData?: ParkingSpace) => {
    try {
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Authentication error in fetchUserVehicles:', userError);
        throw new Error('You must be logged in to fetch vehicles');
      }
      // Log user and authentication details
      // Use passed parking space data or existing state
      const spaceToUse = parkingSpaceData || parkingSpace;
      // Ensure parking space is loaded before filtering vehicles
      if (!spaceToUse) {
        console.warn('No parking space loaded. Attempting to fetch parking space again.');
        // Retry fetching parking space if not available
        const retryParkingSpace = await fetchParkingSpace();
        if (!retryParkingSpace) {
          throw new Error('Could not retrieve parking space details');
        }
      }
      // Ensure we have the latest parking space data
      const latestParkingSpace = parkingSpaceData || await fetchParkingSpace();

      // Fetch vehicles
      const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('renter_id', user.id)
        .in('vehicle_type', latestParkingSpace.vehicle_types_allowed);

      if (error) {
        console.error('Database query error:', error);
        throw error;
      }

      // Further client-side filtering to ensure exact matching
      const compatibleVehicles = vehicles?.filter(vehicle => {
        const isCompatible = latestParkingSpace.vehicle_types_allowed.some(allowedType => 
          vehicle.vehicle_type === allowedType
        );

        return isCompatible;
      }) || [];

      setUserVehicles(compatibleVehicles);

      // Additional logging for edge cases
      if (compatibleVehicles.length === 0) {
        console.warn('No compatible vehicles found', {
          totalVehicles: vehicles?.length || 0,
          renterUserId: user.id,
          parkingSpaceId: latestParkingSpace.id
        });
      }

    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to fetch vehicles');
    }
  };

  const fetchParkingSpace = async (): Promise<ParkingSpace> => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('You must be logged in to view parking spaces');

      const { data, error } = await supabase
        .from('parking_spaces')
        .select('*')
        .eq('id', parkingSpaceId)
        .eq('status', 'Approved')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Parking space not found or you cannot book this space');
      
      setParkingSpace(data);
      return data;
    } catch (error) {
      console.error('Parking space fetch error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to fetch parking space details');
      navigation.goBack();
      throw error;
    }
  };

  const fetchUserAccounts = async (parkingSpaceData?: ParkingSpace) => {
    try {
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Authentication error:', userError);
        throw new Error('You must be logged in to book a parking space');
      }
  
      // Fetch renter's account
      const { data: renterData, error: renterError } = await supabase
        .from('user_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (renterError) {
        console.error('Renter account fetch error:', renterError);
        throw new Error('Renter account not found');
      }
      
      setRenterAccount(renterData);

      const spaceToUse = parkingSpaceData || parkingSpace;

      if (!spaceToUse) {
        return;
      }

      // Fetch lender's account 
      const { data: lenderData, error: lenderError } = await supabase
        .from('user_accounts')
        .select('*')
        .eq('user_id', spaceToUse.user_id)
        .single();

      if (lenderError) {
        console.error('Lender account fetch error:', lenderError);
        throw new Error('Lender account not found');
      }
      
      setLenderAccount(lenderData);

    } catch (error) {
      console.error('fetchUserAccounts error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to fetch account details');
      throw error;
    }
  };

  const calculatePrice = (): { basePrice: number, surcharge: number, totalPrice: number } => {
    if (!parkingSpace) return { basePrice: 0, surcharge: 0, totalPrice: 0 };
    
    const hours = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
    const basePrice = Number((parkingSpace.price * hours).toFixed(2));
    
    // Current time and booking start time
    const currentTime = new Date();
    const timeDifference = startDate.getTime() - currentTime.getTime();
    const hoursDifference = timeDifference / (1000 * 60 * 60);
  
    // Calculate surcharge if booking is between 30 minutes and 4 hours from now
    const surcharge = (hoursDifference >= 0.5 && hoursDifference <= 4) 
      ? Number((basePrice * 0.20).toFixed(2)) 
      : 0;
    
    return {
      basePrice,
      surcharge,
      totalPrice: basePrice + surcharge
    };
  };

  const validateBooking = (): boolean => {
    if (!renterAccount) {
      Alert.alert('Error', 'Account information is missing');
      return false;
    }
    if(!lenderAccount) {
      Alert.alert('Error', 'Lender account information is missing');
      return false;
    } 
  
    if (!selectedVehicle) {
      Alert.alert('Vehicle Required', 'Please select a vehicle for your booking');
      return false;
    }
  
    const { totalPrice } = calculatePrice();
  
    if (renterAccount.balance < totalPrice) {
      Alert.alert(
        'Insufficient Balance',
        `Your current balance (₹${renterAccount.balance.toFixed(2)}) is insufficient for this booking (₹${totalPrice.toFixed(2)}). Please add funds to your account.`
      );
      return false;
    }
  
    const currentTime = new Date();
    const minBookingTime = new Date(currentTime.getTime() + (30 * 60 * 1000)); // 30 minutes from now
    const maxBookingTime = new Date(currentTime.getTime() + (4 * 60 * 60 * 1000)); // 4 hours from now
  
    if (startDate > maxBookingTime) {
      Alert.alert('Invalid Time', 'Booking cannot be more than 4 hours ahead');
      return false;
    }
  
    if (endDate <= startDate) {
      Alert.alert('Invalid Time', 'End time must be after start time');
      return false;
    }
  
    return true;
  };

  const handleCreateBooking = async () => {

    if (!parkingSpace || !validateBooking()) {
      console.warn('🚫 Booking validation failed');
      return;
    }
  
    try {
      setLoading(true);
      const refreshedParkingSpace = await fetchParkingSpace();
      await fetchUserAccounts(refreshedParkingSpace);
  
      if (!validateBooking()) {
        console.warn('🚫 Booking validation failed after refresh');
        return;
      }
  
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('🛑 Authentication Error:', userError);
        throw new Error('You must be logged in to book a parking space');
      }
  
      const totalPriceDetails = calculatePrice();
      
      // Explicitly convert to ISO 8601 timestampz format in UTC
      const bookingStart = startDate.toISOString();
      const bookingEnd = endDate.toISOString();
  
      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          renter_id: user.id,
          parking_space_id: parkingSpace.id,
          booking_start: bookingStart,  // Now explicitly in timestampz format
          booking_end: bookingEnd,      // Now explicitly in timestampz format
          price: totalPriceDetails.totalPrice,
          status: 'Confirmed',
          vehicle_id: selectedVehicle?.id
        }])
        .select()
        .single();
        
      if (bookingError) {
        console.error('🚨 Booking Creation Error:', bookingError);
        if (bookingError.message.includes('No available slots')) {
          throw new Error('No parking spaces available for the selected time slot');
        }
        throw new Error('Failed to create booking');
      }
  
      if (!booking) {
        console.error('🚨 No booking data returned');
        throw new Error('Failed to create booking');
      }
  
      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          booking_id: booking.id,
          payment_amount: totalPriceDetails.totalPrice,
          status: 'Completed',
          from_account_id: renterAccount?.id ?? '',
          to_account_id: lenderAccount?.id ?? '',
          transaction_type: 'Booking',
          parking_space_id: parkingSpace.id
        }]);
  
      if (transactionError) {
        console.error('🚨 Transaction Creation Error:', transactionError);
        throw new Error('Failed to record transaction');
      }

      // Validate account information
      if (!renterAccount || !lenderAccount) {
        console.error('🚨 Missing Account Information', {
          renterAccount: !!renterAccount,
          lenderAccount: !!lenderAccount
        });
        throw new Error('Account information is missing');
      }
  
      const { error: accountUpdateError } = await supabase
        .from('user_accounts')
        .upsert([
          {
            ...renterAccount,
            balance: renterAccount.balance - totalPriceDetails.totalPrice
          },
          {
            ...lenderAccount,
            balance: lenderAccount.balance + totalPriceDetails.totalPrice
          }
        ]);
  
      if (accountUpdateError) {
        console.error('🚨 Account Balance Update Error:', accountUpdateError);
        throw new Error('Failed to update account balances');
      }
  
      // Update local state
      setRenterAccount(prev => prev ? { ...prev, balance: prev.balance - totalPriceDetails.totalPrice } : null);
  
      Alert.alert(
        'Booking Confirmed', 
        `Your booking for ${parkingSpace.title} is successful.`, 
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
  
    } catch (error) {
      console.error('🚨 Booking Process Error:', error);
      Alert.alert('Booking Failed', error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Render vehicle selection modal
  const VehicleSelectionModal = () => (
    <Portal>
      <Modal
        visible={showVehicleModal}
        onDismiss={() => setShowVehicleModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Card>
          <Card.Content>
            <Text style={styles.modalTitle}>Select Your Vehicle</Text>
            
            {userVehicles.length === 0 ? (
              <View>
                <Text>
                  {parkingSpace 
                    ? `No vehicles matching the parking space type (${parkingSpace.vehicle_types_allowed.join(', ')}) are registered.`
                    : 'No vehicles found.'}
                </Text>
                <Button 
                  mode="contained" 
                  onPress={() => {
                    setShowVehicleModal(false);
                    navigation.navigate('AddVehicle' as never);
                  }}
                  style={styles.addVehicleButton}
                >
                  Add Compatible Vehicle
                </Button>
              </View>
            ) : (
              <ScrollView>
                {userVehicles.map(vehicle => (
                  <Button
                    key={vehicle.id}
                    mode={selectedVehicle?.id === vehicle.id ? 'contained' : 'outlined'}
                    onPress={() => {
                      setSelectedVehicle(vehicle);
                      setShowVehicleModal(false);
                    }}
                    style={styles.vehicleButton}
                  >
                    {vehicle.manufacturer} {vehicle.model} - {vehicle.license_plate} ({vehicle.vehicle_type})
                  </Button>
                ))}
              </ScrollView>
            )}
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );

  const handleDateTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const { type, nativeEvent } = event;
    
    // Handle cancel press or invalid selection
    if (type === 'dismissed' || !selectedDate) {
      setDateTimePickerConfig(prev => ({ ...prev, show: false }));
      return;
    }

    const { isStart, mode } = dateTimePickerConfig;
    const currentValue = isStart ? startDate : endDate;
    
    // Create new date combining existing date/time with selected value
    let newDateTime = new Date(currentValue);
    if (mode === 'date') {
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
    } else {
      newDateTime.setHours(selectedDate.getHours());
      newDateTime.setMinutes(selectedDate.getMinutes());
    }

    // Update the appropriate state
    if (isStart) {
      setStartDate(newDateTime);
      // If end date is before new start date, adjust it
      if (endDate <= newDateTime) {
        const newEndDate = new Date(newDateTime);
        newEndDate.setHours(newDateTime.getHours() + 1);
        setEndDate(newEndDate);
      }
    } else {
      setEndDate(newDateTime);
    }

    // If on iOS, close picker after each selection
    // On Android, close only after time selection
    if (Platform.OS === 'ios' || mode === 'time') {
      setDateTimePickerConfig(prev => ({ ...prev, show: false }));
    } else {
      // On Android, switch to time picker after date selection
      setDateTimePickerConfig(prev => ({ ...prev, mode: 'time' }));
    }
  };

  const showDateTimePicker = (isStart: boolean, initialMode: 'date' | 'time') => {
    setDateTimePickerConfig({
      show: true,
      mode: initialMode,
      isStart,
    });
  };

  // Main render method
  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Book Parking Space</Text>
          <Text style={styles.subtitle}>{parkingSpace?.title}</Text>
          
          <View style={styles.infoContainer}>
            <Text>Type: {parkingSpace?.type}</Text>
            <Text>Vehicle Types: {parkingSpace?.vehicle_types_allowed.join(', ')}</Text>
            <Text>Available Spots: {parkingSpace ? parkingSpace.capacity - parkingSpace.occupancy : 0}</Text>
            <Text>Rating: {parkingSpace?.review_score.toFixed(1)}/5</Text>
          </View>

          <View style={styles.noticeContainer}>
            <Text style={styles.noticeText}>
              Bookings must be between 30 minutes and 4 hours from now. 
              Bookings more than 30 minutes in advance will incur a 20% surcharge on the base price.
            </Text>
          </View>

          {/* Vehicle Selection */}
          <View style={styles.vehicleSelectionContainer}>
            <Text style={styles.label}>Select Vehicle</Text>
            <Button 
              mode="outlined" 
              onPress={() => setShowVehicleModal(true)}
            >
              {selectedVehicle 
                ? `${selectedVehicle.manufacturer} ${selectedVehicle.model} (${selectedVehicle.license_plate})`
                : 'Select Vehicle'}
            </Button>
          </View>

          {/* Date and Time Selection */}
          <View style={styles.dateContainer}>
            <View style={styles.dateTimeSelector}>
              <Text style={styles.label}>Start Date & Time</Text>
              <View style={styles.dateTimeButtons}>
                <Button
                  mode="outlined"
                  onPress={() => showDateTimePicker(true, 'date')}
                  style={styles.dateButton}
                >
                  {startDate.toLocaleDateString()}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => showDateTimePicker(true, 'time')}
                  style={[styles.dateButton, { marginLeft: 8 }]}
                >
                  {startDate.toLocaleTimeString()}
                </Button>
              </View>
            </View>

            <View style={styles.dateTimeSelector}>
              <Text style={styles.label}>End Date & Time</Text>
              <View style={styles.dateTimeButtons}>
                <Button
                  mode="outlined"
                  onPress={() => showDateTimePicker(false, 'date')}
                  style={styles.dateButton}
                >
                  {endDate.toLocaleDateString()}
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => showDateTimePicker(false, 'time')}
                  style={[styles.dateButton, { marginLeft: 8 }]}
                >
                  {endDate.toLocaleTimeString()}
                </Button>
              </View>
            </View>

            {dateTimePickerConfig.show && (
              <DateTimePicker
                value={dateTimePickerConfig.isStart ? startDate : endDate}
                mode={dateTimePickerConfig.mode}
                is24Hour={true}
                onChange={handleDateTimeChange}
                minimumDate={dateTimePickerConfig.isStart ? new Date() : startDate}
              />
            )}
          </View>

          {/* Price Display */}
          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Base Price:</Text>
              <Text style={styles.priceValue}>₹{calculatePrice().basePrice}</Text>
            </View>
            <View style={[styles.priceRow]}>
              <Text style={styles.totalPriceLabel}>Total Price:</Text>
              <Text style={styles.totalPrice}>₹{calculatePrice().totalPrice}</Text>
            </View>
          </View>

          {/* Current Balance Display */}
          {renterAccount && (
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Your Current Balance:</Text>
              <Text style={styles.balance}>₹{renterAccount.balance.toFixed(2)}</Text>
            </View>
          )}

          {/* Booking Button */}
          <Button
            mode="contained"
            onPress={handleCreateBooking}
            loading={loading}
            disabled={loading || !selectedVehicle}
            style={styles.bookButton}
          >
            Confirm Booking
          </Button>
        </Card.Content>
      </Card>

      {/* Vehicle Selection Modal */}
      <VehicleSelectionModal />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  infoContainer: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  dateContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  // dateButton: {
  //   marginBottom: 16,
  // },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  priceLabel: {
    fontSize: 18,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  bookButton: {
    paddingVertical: 8,
  },
  modalContainer: {
    margin: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  paymentMethodsContainer: {
    marginBottom: 24,
  },
  paymentMethodButton: {
    marginBottom: 8,
  },
  paymentSummary: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 8,
  },
  payButton: {
    paddingVertical: 8,
  },
  dateTimeSelector: {
    marginBottom: 16,
  },
  dateTimeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButton: {
    flex: 1,
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#666',
  },
  balance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  vehicleSelectionContainer: {
    marginBottom: 16,
  },
  vehicleButton: {
    marginBottom: 8,
  },
  addVehicleButton: {
    marginTop: 16,
  },
  noticeContainer: {
    backgroundColor: '#fff3e0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  noticeText: {
    color: '#e65100',
    fontSize: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  totalPriceRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 16,
  },
  totalPriceLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
});

export default BookingScreen;