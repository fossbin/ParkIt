import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

type ParkingSpace = {
  id: string;
  title: string;
  type: string;
  price: number;
  occupancy: number;
  capacity: number;
  verified: boolean;
};

export default function PendingSpots() {
  const [loading, setLoading] = useState(false);
  const [pendingSpaces, setPendingSpaces] = useState<ParkingSpace[]>([]);

  useEffect(() => {
    const fetchPendingParkingSpaces = async () => {
      setLoading(true);

      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('parking_spaces')
        .select('*')
        .eq('user_id', user?.user?.id)
        .eq('verified', false);

      if (error) {
        console.error(error.message);
      } else {
        setPendingSpaces(data || []);
      }

      setLoading(false);
    };

    fetchPendingParkingSpaces();
  }, []);

  const renderItem = ({ item }: { item: ParkingSpace }) => (
    <View style={styles.parkingCard}>
      <Text style={styles.title}>{item.title}</Text>
      <Text>Type: {item.type}</Text>
      <Text>Price: ₹{item.price.toFixed(2)}</Text>
      <Text>
        Occupancy: {item.occupancy}/{item.capacity}
      </Text>
      <Text>Verified: {item.verified ? 'Yes' : 'No'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#2F7C6E" />
      ) : pendingSpaces.length === 0 ? (
        <Text>No pending parking spaces found.</Text>
      ) : (
        <FlatList
          data={pendingSpaces}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  parkingCard: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
});