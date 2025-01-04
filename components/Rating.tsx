import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton } from 'react-native-paper';

interface RatingProps {
  value: number;
  maximumValue?: number;
  size?: number;
  readonly?: boolean;
  onValueChange?: (value: number) => void;
}

export const Rating: React.FC<RatingProps> = ({
  value,
  maximumValue = 5,
  size = 24,
  readonly = false,
  onValueChange,
}) => {
  return (
    <View style={styles.container}>
      {[...Array(maximumValue)].map((_, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => !readonly && onValueChange?.(index + 1)}
          disabled={readonly}
        >
          <IconButton
            icon={index < value ? 'star' : 'star-outline'}
            size={size}
            iconColor={index < value ? '#FFD700' : '#CCCCCC'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});