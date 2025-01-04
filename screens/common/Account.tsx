import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { useTheme, MD3Theme, Avatar } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../types/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type AccountNavigation = NativeStackNavigationProp<RootStackParamList, 'Account'>;

// Updated ProfilePicture interface to match the base64 structure
interface ProfilePicture {
  data: string;
  contentType: string;
}

type UserProfile = {
  name: string | null;
  phone_number: string | null;
  email: string;
  current_role: string | null;
  profile_picture: ProfilePicture | null;
};

const Account = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation<AccountNavigation>();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('No authenticated user found');
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('name, phone_number, profile_picture, email')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        setUserProfile({
          name: profileData?.name || null,
          phone_number: profileData?.phone_number || null,
          email: user.email || '',
          current_role: user.user_metadata?.current_role || null,
          profile_picture: profileData?.profile_picture || null,
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();

    const profileSubscription = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${supabase.auth.getUser().then(({ data }) => data.user?.id)}`,
        },
        async (payload: { 
          new: { 
            name?: string; 
            profile_picture?: ProfilePicture; 
            phone_number?: string;
          } 
        }) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && payload.new) {
            setUserProfile(prevProfile => ({
              ...prevProfile!,
              name: payload.new.name || prevProfile?.name || null,
              profile_picture: payload.new.profile_picture || prevProfile?.profile_picture || null,
              phone_number: payload.new.phone_number || prevProfile?.phone_number || null,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      profileSubscription.unsubscribe();
    };
  }, []);

  const renderAvatar = () => {
    if (isLoading) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Feather name="loader" size={24} color={theme.colors.onPrimary} />
        </View>
      );
    }

    // Check for profile picture with base64 data
    if (userProfile?.profile_picture?.data) {
      return (
        <Avatar.Image
          size={48}
          source={{ uri: userProfile.profile_picture.data }}
          style={styles.avatar}
        />
      );
    }

    return (
      <View style={styles.avatarPlaceholder}>
        <Feather name="user" size={24} color={theme.colors.onPrimary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {renderAvatar()}
          <View>
            <Text style={styles.userName}>
              {isLoading ? 'Loading...' : (userProfile?.name || 'No name set')}
            </Text>
            <Text style={styles.userEmail}>
              {isLoading ? 'Loading...' : (userProfile?.email || 'No email available')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('AccountDetails')}
        >
          <Feather name="user" size={24} color={theme.colors.onSurface} />
          <Text style={styles.menuItemText}>Account Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('WalletScreen')}
        >
          <Feather name="credit-card" size={24} color={theme.colors.onSurface} />
          <Text style={styles.menuItemText}>Wallet</Text>
        </TouchableOpacity>
        {userProfile?.current_role === 'Renter' && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SuggestedSpaces')}
          >
            <Feather name="home" size={24} color={theme.colors.onSurface} />
            <Text style={styles.menuItemText}>Suggested Spaces</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('SupportTicket')}
        >
          <Feather name="headphones" size={24} color={theme.colors.onSurface} />
          <Text style={styles.menuItemText}>Support Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('HelpAndSupport')}
        >
          <Feather name="help-circle" size={24} color={theme.colors.onSurface} />
          <Text style={styles.menuItemText}>Help and Support</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('SignOut')}
        >
          <Feather name="log-out" size={24} color={theme.colors.onSurface} />
          <Text style={styles.menuItemText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    header: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      marginRight: 16,
      backgroundColor: theme.colors.primaryContainer,
    },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primaryContainer,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    userName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.onPrimary,
    },
    userEmail: {
      fontSize: 14,
      color: theme.colors.onPrimaryContainer,
    },
    content: {
      flex: 1,
      paddingVertical: 16,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    menuItemText: {
      fontSize: 16,
      color: theme.colors.onSurface,
      marginLeft: 16,
    },
  });

export default Account;