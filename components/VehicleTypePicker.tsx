import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';

const VEHICLE_TYPES = ['Bike', 'Car', 'SUV'];

interface VehicleTypePickerProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  error?: boolean;
}

const VehicleTypePicker: React.FC<VehicleTypePickerProps> = ({
  selectedValue,
  onValueChange,
  error
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelectType = (type: string) => {
    onValueChange(type);
    setModalVisible(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.pickerContainer,
          error && styles.pickerError,
          { justifyContent: 'center' }
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.pickerText}>
          {selectedValue || 'Select Vehicle Type'}
        </Text>
      </TouchableOpacity>

      <Modal
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Vehicle Type</Text>
            <FlatList
              data={VEHICLE_TYPES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleSelectType(item)}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  pickerContainer: {
    height: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  pickerError: {
    borderColor: '#E53E3E',
    borderWidth: 2,
  },
  pickerText: {
    fontSize: 16,
    color: '#2D3748',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F7FAFC',
    borderRadius: 10,
  },
  cancelButtonText: {
    color: '#4A5568',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default VehicleTypePicker;