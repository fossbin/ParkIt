import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, SafeAreaView, Alert, TouchableOpacity } from 'react-native';
import { Text, Avatar, Button, Surface, useTheme, MD3Theme, Divider } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

const AdminAccount = () => {
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    async function fetchSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        getAdminProfile();
      }
    }

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function getAdminProfile() {
    try {
      setLoading(true);
      if (!session?.user) {
        console.warn('No user on the session!');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('profile_picture')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      if (data) setAvatarUrl(data.profile_picture);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  }


  async function handleImageUpload() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets[0].uri) {
        setAvatarUrl(result.assets[0].uri);
        // Handle avatar upload logic here if needed
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      navigation.navigate('Auth');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Surface style={styles.header} elevation={2}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Avatar.Image
                  size={80}
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Feather name="user" size={40} color={theme.colors.onPrimaryContainer} />
                </View>
              )}
              <Button
                mode="contained"
                onPress={handleImageUpload}
                style={styles.uploadButton}
                icon="camera"
              >
                Change Photo
              </Button>
            </View>
            <Text style={styles.emailText}>{session?.user?.email}</Text>
            <Text style={styles.roleText}>Administrator</Text>
          </View>
        </Surface>

        <Button
          mode="contained"
          onPress={handleSignOut}
          style={styles.signOutButton}
        >
          Sign Out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

// MenuItem component for menu options
const MenuItem = ({ icon, title, onPress }: {
  icon: "x" | "user" | "type" | "key" | "map" | "filter" | "search" | "repeat" | "anchor" | "bold" | "link" | "code" | "menu" | "video" | "circle" | "image" | "radio" | "minus" | "plus" | "shield" | "settings" | "bell";
  title: string;
  onPress: () => void;
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  
  return (
    <>
      <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <Feather name={icon} size={24} color={theme.colors.onSurface} />
        <Text style={styles.menuItemText}>{title}</Text>
        <Feather name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
      <Divider />
    </>
  );
};

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  profileSection: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: theme.colors.primaryContainer,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadButton: {
    borderRadius: 20,
  },
  emailText: {
    fontSize: 16,
    color: theme.colors.onPrimaryContainer,
    marginTop: 8,
  },
  roleText: {
    fontSize: 14,
    color: theme.colors.onPrimaryContainer,
    opacity: 0.7,
    marginTop: 4,
  },
  menuSection: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
  },
  menuItemText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  signOutButton: {
    margin: 16,
    marginTop: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
  },
});

export default AdminAccount;