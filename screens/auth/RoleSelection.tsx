import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, ScrollView } from 'react-native';
import { Button, Surface, Text, RadioButton } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/types';

type RoleSelectionNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoleSelection'>;

type Role = {
  id: number;
  role_name: string;
};

const RoleSelection = () => {
  const navigation = useNavigation<RoleSelectionNavigationProp>();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserRoles();
  }, []);

  async function fetchUser() {
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError) {
      Alert.alert("Error", userError.message);
      return null;
    }
    return user.user;
  }

  async function fetchUserRoles() {
    const user = await fetchUser();
    if (!user) return;

    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id);

    if (error || !userRoles) {
      Alert.alert("Error", error?.message || 'Roles not found.');
      return;
    }

    const roleIds = userRoles.map(userRole => userRole.role_id);
    fetchRoleNames(roleIds);
  }

  async function fetchRoleNames(roleIds: number[]) {
    const { data: rolesData, error } = await supabase
      .from('roles')
      .select('id, role_name')
      .in('id', roleIds);

    if (error || !rolesData) {
      Alert.alert("Error", error?.message || 'Roles not found.');
      return;
    }

    const rolesList: Role[] = rolesData.map(role => ({
      id: role.id,
      role_name: role.role_name,
    }));
    setRoles(rolesList);
  }

  async function setUserSessionRole(role: string) {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { current_role: role }
      });

      if (error) throw error;
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', `Failed to update session: ${error.message}`);
        return false;
      }
    }
    return true;
  }

  async function handleRoleSelection() {
    if (!selectedRole) {
      Alert.alert("Error", "Please select a role.");
      return;
    }

    setLoading(true);

    const hasRole = roles.some(role => role.role_name === selectedRole);
    if (hasRole) {
      const roleUpdated = await setUserSessionRole(selectedRole);
      
      if (roleUpdated) {
        if (selectedRole === 'Renter') {
          navigation.navigate('TabNavigatorRenter');
        } else if (selectedRole === 'Lender') {
          navigation.navigate('TabNavigatorLender');
        }
      }
    } else {
      Alert.alert("Error", "You don't have access to this role.");
      navigation.navigate('Auth');
    }

    setLoading(false);
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', `Failed to sign out: ${error.message}`);
      }
    }
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
          Select Your Role
        </Text>
        
        <RadioButton.Group onValueChange={value => setSelectedRole(value)} value={selectedRole || ''}>
          <Surface style={styles.roleOption}>
            <RadioButton.Item 
              label="Renter"
              value="Renter"
              position="leading"
              labelStyle={styles.roleLabel}
            />
          </Surface>

          <Surface style={styles.roleOption}>
            <RadioButton.Item 
              label="Lender"
              value="Lender"
              position="leading"
              labelStyle={styles.roleLabel}
            />
          </Surface>
        </RadioButton.Group>

        <Button
          mode="contained"
          onPress={handleRoleSelection}
          style={styles.confirmButton}
          loading={loading}
          disabled={loading}
        >
          Confirm Role
        </Button>

        <Button
          mode="outlined"
          onPress={handleSignOut}
          style={styles.signOutButton}
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
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  roleOption: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 1,
  },
  roleLabel: {
    fontSize: 16,
  },
  confirmButton: {
    marginTop: 24,
    marginBottom: 12,
    borderRadius: 8,
    padding: 4,
  },
  signOutButton: {
    borderRadius: 8,
    padding: 4,
  },
});

export default RoleSelection;