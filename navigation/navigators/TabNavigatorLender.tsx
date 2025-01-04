import React from 'react';
import { AnimatedTabBarNavigator } from 'react-native-animated-nav-tab-bar';
import LenderBookings from '../../screens/lender/Bookings';
import Account from '../../screens/common/Account';
import { Ionicons } from '@expo/vector-icons';
import LenderHomeScreen from '../../screens/lender/LenderHomeScreen';

const Tab = AnimatedTabBarNavigator();

const TabNavigatorLender = () => (
  <Tab.Navigator
    tabBarOptions={{
      activeTintColor: "#2F7C6E",
      inactiveTintColor: "#222222",
      labelStyle: {
        fontSize: 12,
      },
    }}
    appearance={{
      floating: true,
    }}
  >
    {/* Screen to list currently hosted parking spots */}
    <Tab.Screen
      name="ListParking"
      component={LenderHomeScreen}
      options={{
        tabBarLabel: "My Listings",
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
          <Ionicons
            name={focused ? 'car' : 'car-outline'}
            size={size}
            color={color}
          />
        ),
      }}
    />
    
    {/* Map view for locating parking spaces */}
    <Tab.Screen
      name="Bookings"
      component={LenderBookings}
      options={{
        tabBarLabel: "Bookings",
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
          <Ionicons
            name={focused ? 'albums' : 'albums-outline'}
            size={size}
            color={color}
          />
        ),
      }}
    />

    {/* Account screen for lender profile and settings */}
    <Tab.Screen
      name="Account"
      component={Account}
      options={{
        tabBarLabel: "Account",
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
          <Ionicons
            name={focused ? 'person' : 'person-outline'}
            size={size}
            color={color}
          />
        ),
      }}
    />
  </Tab.Navigator>
);

export default TabNavigatorLender;
