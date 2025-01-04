import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';

const RATING_OPTIONS = [1, 2, 3, 4, 5];
const MAX_REVIEW_LENGTH = 500;

interface FormErrors {
  rating?: string;
  review?: string;
}

interface CreateReviewProps {
  parkingSpaceId: string;
  onReviewSubmitted?: () => void;
  navigation?: any;
}

const StarIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
    <Text style={{ fontSize: 24, color: filled ? '#fbbf24' : '#d1d5db' }}>
      ★
    </Text>
  );

const CreateReview: React.FC<CreateReviewProps> = ({ 
  parkingSpaceId, 
  onReviewSubmitted,
  navigation 
}) => {
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    fetchSession();
  }, []);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!rating) {
      errors.rating = 'Please select a rating';
    }

    if (!reviewText.trim()) {
      errors.review = 'Please enter a review';
    } else if (reviewText.length > MAX_REVIEW_LENGTH) {
      errors.review = `Review must be ${MAX_REVIEW_LENGTH} characters or less`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRatingSelect = (selectedRating: number) => {
    setRating(selectedRating);
    setFormErrors(prev => ({ ...prev, rating: undefined }));
  };

  const handleReviewTextChange = (text: string) => {
    setReviewText(text);
    setCharCount(text.length);
    setFormErrors(prev => ({ ...prev, review: undefined }));
  };

  const handleSubmitReview = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please check all required fields');
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to submit a review');
      return;
    }

    setIsLoading(true);

    try {
      // Check if user has already reviewed this parking space
      const { data: existingReview, error: checkError } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('parking_space_id', parkingSpaceId)
        .eq('status', 'Active')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(checkError.message);
      }

      if (existingReview) {
        Alert.alert('Error', 'You have already reviewed this parking space');
        return;
      }

      // Submit new review
      const { error: submitError } = await supabase
        .from('reviews')
        .insert({
          user_id: session.user.id,
          parking_space_id: parkingSpaceId,
          rating,
          review_text: reviewText.trim(),
          status: 'Active'
        });

      if (submitError) throw submitError;

      Alert.alert(
        'Success',
        'Thank you for your review!',
        [
          {
            text: 'OK',
            onPress: () => {
              onReviewSubmitted?.();
              navigation?.goBack();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Write a Review</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Rating *</Text>
        <View style={styles.ratingContainer}>
        {RATING_OPTIONS.map((value) => (
            <TouchableOpacity
                key={value}
                style={[
                styles.ratingButton,
                rating === value && styles.ratingButtonSelected
                ]}
                onPress={() => handleRatingSelect(value)}
            >
                <StarIcon filled={rating != null && value <= rating} />
            </TouchableOpacity>
        ))}
        </View>
        {formErrors.rating && (
          <Text style={styles.errorText}>{formErrors.rating}</Text>
        )}

        <Text style={styles.label}>Review *</Text>
        <TextInput
          style={[
            styles.reviewInput,
            !!formErrors.review && styles.inputError
          ]}
          placeholder="Share your experience with this parking space..."
          value={reviewText}
          onChangeText={handleReviewTextChange}
          multiline
          maxLength={MAX_REVIEW_LENGTH}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>
          {charCount}/{MAX_REVIEW_LENGTH} characters
        </Text>
        {formErrors.review && (
          <Text style={styles.errorText}>{formErrors.review}</Text>
        )}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (isLoading || !rating || !reviewText.trim()) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmitReview}
          disabled={isLoading || !rating || !reviewText.trim()}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Review</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1f2937',
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ratingButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  ratingButtonSelected: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  reviewInput: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 150,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 4,
  },
});

export default CreateReview;