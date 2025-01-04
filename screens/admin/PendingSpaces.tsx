import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Alert, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../types/types';

type UserSuggestedSpacesNav = NativeStackNavigationProp<RootStackParamList, 'UserSuggestedSpaces'>;

interface ParkingSpace {
  id: string;
  user_id: string;
  title: string;
  type: string;
  price: number;
  capacity: number;
  vehicle_types_allowed: string[];
  photos: string[];
  status: 'Pending' | 'Approved' | 'Rejected';
  user: {
    name: string;
    email: string;
  };
}

export default function UserSuggestedSpaces() {
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<UserSuggestedSpacesNav>();

  const fetchUserSuggestedSpaces = async () => {
    try {
      const { data, error } = await supabase
        .from('parking_spaces')
        .select(`
          id,
          user_id,
          title,
          type,
          price,
          capacity,
          vehicle_types_allowed,
          photos,
          status,
          users (
            name,
            email
          )
        `)
        .eq('added_by', 'User-Suggestion')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSpaces(data as ParkingSpace[]);
    } catch (error) {
      console.error('Error fetching user-suggested spaces:', error);
      Alert.alert('Error', 'Failed to fetch user-suggested spaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserSuggestedSpaces();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserSuggestedSpaces();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserSuggestedSpaces().then(() => setRefreshing(false));
  }, []);

  const handleVerify = async (spaceId: string) => {
    try {
      const { error } = await supabase
        .from('parking_spaces')
        .update({ status: 'Approved', verified: true })
        .eq('id', spaceId);

      if (error) throw error;

      Alert.alert('Success', 'Space verified successfully');
      fetchUserSuggestedSpaces();
    } catch (error) {
      console.error('Error verifying space:', error);
      Alert.alert('Error', 'Failed to verify space');
    }
  };

  const renderSpaceCard = ({ item }: { item: ParkingSpace }) => (
    <View style={styles.spaceCard}>
      {item.photos && item.photos.length > 0 && (
        <Image
          source={{ uri: item.photos[0] }}
          style={styles.spaceImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.spaceInfo}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSubtitle}>Type: {item.type}</Text>
        <Text style={styles.cardSubtitle}>Price: ₹{item.price}/hour</Text>
        <Text style={styles.cardSubtitle}>Capacity: {item.capacity}</Text>
        <Text style={styles.cardSubtitle}>Suggested by: {item.user.name}</Text>
        <Text style={styles.cardSubtitle}>Status: {item.status}</Text>
      </View>
      {item.status === 'Pending' && (
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={() => handleVerify(item.id)}
        >
          <Text style={styles.verifyButtonText}>Verify</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={spaces}
        renderItem={renderSpaceCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContainer: {
    padding: 20,
  },
  spaceCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  spaceImage: {
    width: '100%',
    height: 200,
  },
  spaceInfo: {
    padding: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 3,
  },
  verifyButton: {
    backgroundColor: '#3b82f6',
    padding: 10,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

