import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, ScrollView, SafeAreaView } from 'react-native';
import { TextInput, Button, Avatar, Text, Surface, useTheme, MD3Theme, ActivityIndicator, HelperText } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone_number: string | null;
  created_at: string | null;
  profile_picture: {
    data: string;
    contentType: string;
  } | null;
}

interface FormErrors {
  name?: string;
  phoneNumber?: string;
}

const AccountPreferences = () => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<UserProfile['profile_picture']>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const theme = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session) {
          getProfile(session);
        }
      } catch (error) {
        console.error('Session fetch error:', error);
        Alert.alert('Error', 'Failed to fetch session');
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        getProfile(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Track form changes
  useEffect(() => {
    if (!loading) {
      setIsDirty(true);
    }
  }, [name, phoneNumber]);

  async function getProfile(currentSession: Session) {
    try {
      setLoading(true);
      if (!currentSession?.user) throw new Error('No user on the session!');

      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          phone_number,
          created_at,
          profile_picture
        `)
        .eq('id', currentSession.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setName(data.name || '');
        setPhoneNumber(data.phone_number || '');
        setProfilePicture(data.profile_picture);
        setIsDirty(false);
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const validatePhoto = (photo: ImagePicker.ImagePickerAsset) => {
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (photo.fileSize && photo.fileSize > MAX_SIZE) {
      Alert.alert('Image Too Large', 'Please select an image under 5MB');
      return false;
    }
    return true;
  };

  async function handleImageUpload() {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant photo library permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        aspect: [1, 1],
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploading(true);
        const selectedImage = result.assets[0];

        if (!validatePhoto(selectedImage)) {
          setUploading(false);
          return;
        }

        if (!selectedImage.base64) {
          throw new Error('Failed to get base64 data from image');
        }

        const imageData = {
          data: `data:image/jpeg;base64,${selectedImage.base64}`,
          contentType: 'image/jpeg'
        };

        const { error: updateError } = await supabase
          .from('users')
          .update({ profile_picture: imageData })
          .eq('id', session?.user?.id);

        if (updateError) {
          throw updateError;
        }

        setProfilePicture(imageData);
        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(
        'Upload failed', 
        'There was a problem uploading your image. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  }

  function validateInputs(): boolean {
    const errors: FormErrors = {};
    let isValid = true;

    // Validate name
    if (!name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    } else if (name.length > 255) {
      errors.name = 'Name must be less than 255 characters';
      isValid = false;
    }

    // Validate phone number
    if (!phoneNumber.trim()) {
      errors.phoneNumber = 'Phone number is required';
      isValid = false;
    } else {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phoneNumber)) {
        errors.phoneNumber = 'Please enter a valid phone number';
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  }

  async function handleUpdateProfile({
    name,
    phoneNumber,
  }: {
    name: string;
    phoneNumber: string;
  }) {
    if (!isDirty) {
      Alert.alert('No Changes', 'No changes have been made to update');
      return;
    }

    if (!validateInputs()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    try {
      setLoading(true);
      if (!session?.user) throw new Error('No user on the session!');

      const updates: Partial<UserProfile> = {
        name: name.trim() || null,
        phone_number: phoneNumber.trim() || null,
      };

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', session.user.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
      setIsDirty(false);
      setFormErrors({});
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <Text variant="titleMedium" style={styles.sectionTitle}>
      {children}
    </Text>
  );

  if (!session) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text>Checking authentication status...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <Surface style={styles.profileCard} elevation={2}>
            <View style={styles.avatarContainer}>
              <Avatar.Image
                size={100}
                source={
                  profilePicture?.data
                    ? { uri: profilePicture.data }
                    : require('../../assets/default-avatar.png')
                }
                style={styles.avatar}
              />
              <Button
                mode="contained"
                onPress={handleImageUpload}
                style={styles.uploadButton}
                icon="camera"
                loading={uploading}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Change Photo'}
              </Button>
            </View>
            <Text variant="headlineSmall" style={styles.emailText}>
              {session?.user?.email}
            </Text>
          </Surface>

          <Surface style={styles.formCard} elevation={2}>
            <SectionTitle>Personal Information</SectionTitle>
            <View style={styles.inputContainer}>
              <TextInput
                label="Name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
                maxLength={255}
                error={!!formErrors.name}
              />
              {formErrors.name && (
                <HelperText type="error" visible={!!formErrors.name}>
                  {formErrors.name}
                </HelperText>
              )}
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                label="Phone Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
                maxLength={20}
                error={!!formErrors.phoneNumber}
              />
              {formErrors.phoneNumber && (
                <HelperText type="error" visible={!!formErrors.phoneNumber}>
                  {formErrors.phoneNumber}
                </HelperText>
              )}
            </View>

            <Button
              mode="contained"
              onPress={() => handleUpdateProfile({ name, phoneNumber })}
              loading={loading}
              disabled={loading || !isDirty}
              style={styles.updateButton}
            >
              {isDirty ? 'Update Profile' : 'No Changes'}
            </Button>
          </Surface>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  profileCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    marginBottom: 12,
  },
  uploadButton: {
    borderRadius: 20,
  },
  emailText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'white',
  },
  updateButton: {
    marginTop: 8,
    borderRadius: 8,
  },
});

export default AccountPreferences;