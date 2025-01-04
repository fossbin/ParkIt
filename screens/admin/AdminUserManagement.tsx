import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button } from 'react-native-rapi-ui';

interface User {
  id: string;
  email: string;
  created_at: string;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, created_at');

      if (!data) throw new Error('No data returned');

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    Alert.alert(
      'Confirm User Deletion',
      'Are you sure you want to delete this user? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

              if (error) throw error;

              setUsers(users.filter(user => user.id !== userId));
              Alert.alert('Success', 'User deleted successfully');
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', 'Failed to delete user');
            }
          }
        }
      ]
    );
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewEmail(user.email);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ email: newEmail })
        .eq('id', editingUser.id);

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === editingUser.id ? { ...user, email: newEmail } : user
      ));
      setEditingUser(null);
      Alert.alert('Success', 'User email updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Error', 'Failed to update user email');
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <View style={styles.userItem}>
      <View style={styles.userDetails}>
        <Text style={styles.userEmail}>{item.email}</Text>
        <Text style={styles.userCreated}>
          Created: {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <Button
          text="Edit"
          onPress={() => handleEditUser(item)}
          style={styles.editButton}
          textStyle={styles.buttonText}
        />
        <Button
          text="Delete"
          onPress={() => handleDeleteUser(item.id)}
          style={styles.deleteButton}
          textStyle={styles.buttonText}
        />
      </View>
    </View>
  );

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>User Management</Text>
      
      {loading ? (
        <Text>Loading users...</Text>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.emptyList}>No users found</Text>
          }
          scrollEnabled={false}
        />
      )}

      <Button
        text="Refresh Users"
        onPress={fetchUsers}
        style={styles.refreshButton}
      />

      <Modal
        visible={!!editingUser}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit User Email</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="New email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditingUser(null)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleUpdateUser}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 100, // Add extra padding at the bottom to ensure all content is reachable
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1e293b',
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  userDetails: {
    flex: 1,
    marginRight: 10,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userCreated: {
    fontSize: 12,
    color: '#64748b',
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 5,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
  },
  emptyList: {
    textAlign: 'center',
    marginTop: 50,
    color: '#64748b',
  },
  refreshButton: {
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    width: '45%',
  },
  cancelButton: {
    backgroundColor: '#64748b',
  },
  saveButton: {
    backgroundColor: '#22c55e',
  },
  modalButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});