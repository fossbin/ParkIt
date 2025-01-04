import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { ThemeProvider } from 'react-native-rapi-ui';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import Auth from './screens/auth/Auth';
import RoleSelection from './screens/auth/RoleSelection';
import TabNavigatorRenter from './navigation/navigators/TabNavigatorRenter';
import TabNavigatorLender from './navigation/navigators/TabNavigatorLender';
import TabNavigatorAdmin from './navigation/navigators/TabNavigatorAdmin';
import { RootStackParamList } from './types/types';
import CreateSpot from './screens/lender/CreateSpot';
import CreatePublicSpace from './screens/admin/CreatePublicSpace';
import Account from './screens/common/Account';
import AccountDetails from './screens/common/AccountDetails';
import SupportTicket from './screens/common/SupportTicket';
import HelpAndSupport from './screens/common/HelpAndSupport';
import SignOut from './screens/common/SignOut';
import AddVehicleScreen from './screens/renter/AddVehicle';
// import VehicleDetailsScreen from './screens/renter/VehicleDetails';
import BookingScreen from './screens/renter/BookingScreen';
import PreviousBookingsScreen from './screens/renter/PreviousBookings';
import UpcomingBookingsScreen from './screens/renter/UpcomingBookings';
import DocumentUploadScreen from './screens/renter/DocumentUpload';
import RenterHomeScreen from './screens/renter/RenterHomeScreen';
import ParkingSpotDetails from './screens/lender/ParkingSpotDetails';
import PendingSpots from './screens/lender/PendingSpots';
import SuggestParkingSpace from './screens/renter/SuggestParkingSpace';
import ManageLenderSpaces from './screens/admin/ManageLenderSpaces';
import ManagePublicSpaces from './screens/admin/ManagePublicSpaces';
import LenderPendingSpaces from './screens/admin/LenderPendingSpaces';
import UserSuggestedSpaces from './screens/admin/UserSuggestedSpaces';
import ManageUserSuggestions from './screens/admin/ManageUserSuggestions';
import MapScreen from './screens/map/MapScreen';
import VerificationStatus from './screens/lender/VerificationStatus';
import WalletScreen from './screens/common/WalletScreen';
import EditVehicleScreen from './screens/renter/EditVehicleScreen';
import EditPublicSpace from './screens/admin/EditPublicSpace';
import EditLenderSpace from './screens/lender/EditLenderSpace';
import SuggestedSpaces from './screens/common/SuggestedSpaces';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Define theme type
type AppTheme = {
  light: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    card: string;
    text: string;
    border: string;
  };
  dark: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    card: string;
    text: string;
    border: string;
  };
};

// Custom theme configuration
const theme: AppTheme = {
  light: {
    primary: '#2F7C6E',
    secondary: '#2F7C6E',
    accent: '#2F7C6E',
    background: '#FFFFFF',
    card: '#F1F1F1',
    text: '#000000',
    border: '#E5E5E5',
  },
  dark: {
    primary: '#2F7C6E',
    secondary: '#2F7C6E',
    accent: '#2F7C6E',
    background: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    border: '#2C2C2C',
  },
};

// Configure React Native Paper themes
const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: theme.light.primary,
    secondary: theme.light.secondary,
    background: theme.light.background,
  },
};

const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: theme.dark.primary,
    secondary: theme.dark.secondary,
    background: theme.dark.background,
  },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();

  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error.message);
        }
        
        if (mounted) {
          setSession(session);
          setLoading(false);
        }
      } catch (error) {
        console.error('Unexpected error during session initialization:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const LoadingScreen = () => (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: theme.light.background,/*colorScheme === 'dark' ? theme.dark.background : theme.light.background*/
    }}>
      <ActivityIndicator 
        size="large" 
        color={theme.light.primary}/*{colorScheme === 'dark' ? theme.dark.primary : theme.light.primary} */
      />
    </View>
  );

  if (loading) {
    return (
      <PaperProvider theme={paperLightTheme}/*{colorScheme === 'dark' ? paperDarkTheme : paperLightTheme}*/>
        <ThemeProvider>
          <LoadingScreen />
        </ThemeProvider>
      </PaperProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperLightTheme}/*{colorScheme === 'dark' ? paperDarkTheme : paperLightTheme}*/>
        <ThemeProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName={session ? 'RoleSelection' : 'Auth'}
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: {
                  backgroundColor: colorScheme === 'dark' ? theme.dark.background : theme.light.background
                }
              }}
            >
              <Stack.Screen name="Auth" component={Auth} />
              <Stack.Screen name="RoleSelection" component={RoleSelection} />
              <Stack.Screen name="TabNavigatorRenter" component={TabNavigatorRenter} />
              <Stack.Screen name="TabNavigatorLender" component={TabNavigatorLender} />
              <Stack.Screen name="TabNavigatorAdmin" component={TabNavigatorAdmin} />
              <Stack.Screen name="CreateSpot" component={CreateSpot} />
              <Stack.Screen name="EditLenderSpace" component={EditLenderSpace} />
              <Stack.Screen name="VerificationStatus" component={VerificationStatus} />
              <Stack.Screen name="CreatePublicSpace" component={CreatePublicSpace} options={{ title: 'Create Public Space' }}/>
              <Stack.Screen name="EditPublicSpace" component={EditPublicSpace} />
              <Stack.Screen name="ManagePublicSpaces" component={ManagePublicSpaces}/>
              <Stack.Screen name="ManageLenderSpaces" component={ManageLenderSpaces}/>
              <Stack.Screen name="LenderPendingSpaces" component={LenderPendingSpaces}/>
              <Stack.Screen name="ManageUserSuggestions" component={ManageUserSuggestions}/>
              <Stack.Screen name="UserSuggestedSpaces" component={UserSuggestedSpaces}/>
              <Stack.Screen name="Account" component={Account}/>
              <Stack.Screen name="AccountDetails" component={AccountDetails}/>
              <Stack.Screen name="SuggestedSpaces" component={SuggestedSpaces}/>
              <Stack.Screen name="WalletScreen" component={WalletScreen}/>
              <Stack.Screen name="SupportTicket" component={SupportTicket}/>
              <Stack.Screen name="HelpAndSupport" component={HelpAndSupport}/>
              <Stack.Screen name="SignOut" component={SignOut}/>
              <Stack.Screen name="AddVehicle" component={AddVehicleScreen}/>
              <Stack.Screen name="EditVehicle" component={EditVehicleScreen}/> 
              <Stack.Screen name="BookingScreen" component={BookingScreen}/>
              <Stack.Screen name="MapScreen" component={MapScreen}/>
              <Stack.Screen name="PreviousBookings" component={PreviousBookingsScreen}/>
              <Stack.Screen name="UpcomingBookings" component={UpcomingBookingsScreen}/>
              <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen}/>
              <Stack.Screen name="RenterHomeScreen" component={RenterHomeScreen}/>
              <Stack.Screen name="ParkingSpotDetails" component={ParkingSpotDetails}/>
              <Stack.Screen name="PendingSpots" component={PendingSpots}/>
              <Stack.Screen name="SuggestParkingSpace" component={SuggestParkingSpace}/>


            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}