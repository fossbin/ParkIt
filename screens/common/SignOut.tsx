import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Button, Surface, Text, RadioButton } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';

type Role = 'Renter' | 'Lender';

const SignOut = () => {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const navigation = useNavigation<any>();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        // Set the opposite role as the selected role by default
        const currentRole = session?.user?.user_metadata?.current_role as Role;
        setSelectedRole(currentRole === 'Renter' ? 'Lender' : 'Renter');
      } catch (error) {
        if (error instanceof Error) {
          Alert.alert('Error', error.message);
        }
      }
    };

    fetchSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', `Failed to sign out: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSwitch = async () => {
    if (!selectedRole) return;

    setLoading(true);
    try {
      const { data: { user }, error } = await supabase.auth.updateUser({
        data: { current_role: selectedRole }
      });

      if (error) throw error;

      // Update the session with the new user data
      if (session) {
        const updatedSession = {
          ...session,
          user: {
            ...session.user,
            user_metadata: {
              ...session.user.user_metadata,
              current_role: selectedRole
            }
          }
        };
        setSession(updatedSession);
      }

      if (selectedRole === 'Renter') {
        navigation.navigate('TabNavigatorRenter');
      } else {
        navigation.navigate('TabNavigatorLender');
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', `Failed to switch role: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentRole = session?.user?.user_metadata?.current_role as Role;

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={2}>
        <Text variant="titleLarge" style={styles.title}>Account Options</Text>
        
        <Surface style={styles.roleOption}>
          <Text style={styles.currentRoleText}>Current Role: {currentRole}</Text>
        </Surface>

        <Surface style={styles.roleOption}>
          <RadioButton.Item 
            label={`Switch to ${currentRole === 'Renter' ? 'Lender' : 'Renter'}`}
            value={currentRole === 'Renter' ? 'Lender' : 'Renter'}
            position="leading"
            labelStyle={styles.roleLabel}
            status={selectedRole === (currentRole === 'Renter' ? 'Lender' : 'Renter') ? 'checked' : 'unchecked'}
            onPress={() => setSelectedRole(currentRole === 'Renter' ? 'Lender' : 'Renter')}
          />
        </Surface>

        <Button
          mode="contained"
          onPress={handleRoleSwitch}
          style={styles.switchButton}
          contentStyle={styles.buttonContent}
          loading={loading}
          disabled={loading}
          uppercase={false}
        >
          Switch Role
        </Button>
        
        <Button
          mode="outlined"
          onPress={handleSignOut}
          style={styles.signOutButton}
          contentStyle={styles.buttonContent}
          loading={loading}
          disabled={loading}
          uppercase={false}
        >
          Sign Out
        </Button>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  card: {
    width: '90%',
    padding: 16,
    borderRadius: 12,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  roleOption: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 1,
  },
  currentRoleText: {
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  roleLabel: {
    fontSize: 16,
  },
  switchButton: {
    marginTop: 24,
    marginBottom: 12,
    borderRadius: 8,
  },
  signOutButton: {
    borderRadius: 8,
  },
  buttonContent: {
    height: 44,
  },
});

export default SignOut;