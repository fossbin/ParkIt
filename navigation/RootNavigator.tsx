import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Auth from '../screens/auth/Auth'; // Login/Registration
import RoleSelection from '../screens/auth/RoleSelection'; // Role selection screen
import TabNavigatorRenter from './navigators/TabNavigatorRenter'; // Renter tab navigator
import TabNavigatorLender from './navigators/TabNavigatorLender'; // Lender tab navigator
import TabNavigatorAdmin from './navigators/TabNavigatorAdmin'; // Admin tab navigator

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Auth">
      {/* Authentication Flow */}
      <Stack.Screen 
        name="Auth" 
        component={Auth} 
        options={{ headerShown: false }} // Hide header for login/register
      />

      {/* Role Selection Screen */}
      <Stack.Screen 
        name="RoleSelection" 
        component={RoleSelection} 
        options={{ title: 'Select Role' }} // Customize title
      />

      {/* Tab Navigators for each role */}
      <Stack.Screen 
        name="TabNavigatorRenter" 
        component={TabNavigatorRenter} 
        options={{ headerShown: false }} // Hide header in tab navigators
      />
      <Stack.Screen 
        name="TabNavigatorLender" 
        component={TabNavigatorLender} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="TabNavigatorAdmin" 
        component={TabNavigatorAdmin} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;
