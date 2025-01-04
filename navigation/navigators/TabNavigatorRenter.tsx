import React from 'react';
import { AnimatedTabBarNavigator } from 'react-native-animated-nav-tab-bar';
import MapScreen from '../../screens/map/MapScreen';
import Account from '../../screens/common/Account';
import { Ionicons } from '@expo/vector-icons';
import RenterHomeScreen from '../../screens/renter/RenterHomeScreen';

const Tab = AnimatedTabBarNavigator();

const TabNavigatorRenter = () => (
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
    <Tab.Screen
        name="Home"
        component={RenterHomeScreen}
        options={{
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons
            name={focused ? 'home' : 'home-outline'}
            size={size}
            color={color}
            />
        ),
        }}
    />
    <Tab.Screen
      name="Map"
      component={MapScreen}
      options={{
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
          <Ionicons
            name={focused ? 'map' : 'map-outline'}
            size={size}
            color={color}
          />
        ),
      }}
    />
    <Tab.Screen
      name="Account"
      component={Account}
      options={{
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

export default TabNavigatorRenter;
