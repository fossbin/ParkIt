import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function useBookingNotifications() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // Request permissions for notifications
    async function registerForPushNotificationsAsync() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.error('Permission not granted for push notifications!');
        return;
      }
    }

    // Set up Supabase real-time listener for booking notifications
    async function setupBookingNotifications() {
      try {
        // Get current authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('No authenticated user', userError);
          return;
        }

        // Set up real-time channel for booking notifications
        const channel = supabase
  .channel('booking_notifications')
  .on('postgres_changes', 
    {
      event: '*', 
      schema: 'public', 
      table: 'bookings'
    }, 
    (payload) => {
      const notificationData = payload.new as { bookings: { renter_id: string; parking_space_id: any; id: any; }[] };
      
      // notificationData.bookings is now an array
      notificationData.bookings.forEach(async (booking) => {
        // Check if the notification is for the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === booking.renter_id) {
          // Fetch parking space details
          const { data: parkingSpaceData } = await supabase
            .from('parking_spaces')
            .select('title')
            .eq('id', booking.parking_space_id)
            .single();

          if (parkingSpaceData) {
            // Trigger notification
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Parking Session Started 🚗",
                body: `Your booking at ${parkingSpaceData.title} has begun!`,
                data: { 
                  bookingId: booking.id,
                  parkingSpaceTitle: parkingSpaceData.title 
                },
              },
              trigger: null,
            });
          } else {
            console.error('Parking space data is null');
          }
        }
      });
    }
  )
  .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error('Error setting up booking notifications', error);
      }
    }

    // Set up listeners and request permissions
    registerForPushNotificationsAsync();
    setupBookingNotifications();

    // Add notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { bookingId, parkingSpaceTitle } = response.notification.request.content.data;
      console.log(`User tapped notification for booking ${bookingId} at ${parkingSpaceTitle}`);
      // Optional: Navigate to booking details screen
    });

    // Cleanup listeners
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return null; 
}