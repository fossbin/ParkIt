import React from 'react';
import { AnimatedTabBarNavigator } from 'react-native-animated-nav-tab-bar';
import SupportTickets from '../../screens/admin/SupportTickets';
import { Ionicons } from '@expo/vector-icons';
import AdminAccount from '../../screens/admin/AdminAccount';
import AdminHomeScreen from '../../screens/admin/AdminHomeScreen';
import AdminUserManagement from '../../screens/admin/AdminUserManagement'; // Import the new component
import AdminReports from '../../screens/admin/AdminReports';

const Tab = AnimatedTabBarNavigator();

const TabNavigatorAdmin = () => (
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
        name="ManageParking"
        component={AdminHomeScreen}
        options={{
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons
            name={focused ? 'business' : 'business-outline'}
            size={size}
            color={color}
            />
        ),
        }}
    />
    <Tab.Screen
      name="SupportTickets"
      component={SupportTickets}
      options={{
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
          <Ionicons
            name={focused ? 'chatbox' : 'chatbox-outline'}
            size={size}
            color={color}
          />
        ),
      }}
    />
    <Tab.Screen
      name="UserManagement"
      component={AdminUserManagement}
      options={{
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
          <Ionicons
            name={focused ? 'people' : 'people-outline'}
            size={size}
            color={color}
          />
        ),
      }}
    />
    <Tab.Screen
      name="Reports"
      component={AdminReports}
      options={{
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
          <Ionicons
            name={focused ? 'bar-chart' : 'bar-chart-outline'}
            size={size}
            color={color}
          />
        ),
      }}
    />
    <Tab.Screen
      name="Account"
      component={AdminAccount}
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

export default TabNavigatorAdmin;