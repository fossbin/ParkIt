import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, Dimensions, ScrollView, Image, Platform, SafeAreaView, Linking, Modal, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE, Marker, Region } from 'react-native-maps';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Card, Text, Button, Avatar, Divider, Portal, Dialog, TextInput } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../types/types';

  interface User {
    id: string;
    name: string | null;
    bookings: any[]; // Add this line to include the bookings property
  }

  interface ParkingSpace {
    longitude: any;
    latitude: any;
    id: string;
    user_id: string | null;
    title: string;
    type: 'Public' | 'Lender-provided' | 'Non-accountable';
    price: number;
    capacity: number;
    vehicle_types_allowed: string[];
    photos: string[];
    occupancy: number;
    verified: boolean;
    review_score: number;
    created_at: string;
    added_by: 'Lender' | 'Admin' | 'User-Suggestion';
    status: 'Pending' | 'Approved' | 'Rejected';
    lender?: User | null;
  }

  interface ParkingSpaceLocation {
    parking_space_id: string;
    latitude: number;
    longitude: number;
    parkingSpace: ParkingSpace;
  }

  interface MarkerStyle {
    icon: string;
    color: string;
  }

  interface DatabaseResponse {
    parking_space_id: string;
    latitude: string | number;
    longitude: string | number;
    parkingSpace: {
      id: string;
      user_id: string | null;
      title: string;
      type: 'Public' | 'Lender-provided' | 'Non-accountable';
      price: number;
      capacity: number;
      vehicle_types_allowed: string[];
      photos: any; 
      occupancy: number;
      verified: boolean;
      review_score: number;
      created_at: string;
      added_by: 'Lender' | 'Admin' | 'User-Suggestion';
      status: 'Pending' | 'Approved' | 'Rejected';
      lender: {
        id: string;
        name: string | null;
      } | null;
    };
  }

  interface SuggestionLocation {
    latitude: number;
    longitude: number;
  }

  interface ProfilePicture {
    data: string;
    contentType: string;
  }

  interface Review {
    id: string;
    user_id: string;
    parking_space_id: string;
    rating: number;
    review_text: string;
    created_at: string;
    status: 'Active' | 'Reported' | 'Verified' | 'Rejected';
    user: {
      id?: string;
      name: string | null;
      email: string;
      profile_picture: ProfilePicture | null;
    };
  }

  const { height: screenHeight } = Dimensions.get('window');
  const FLOATING_TAB_BAR_HEIGHT = 80; 

  const MapScreen: React.FC = () => {
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const [locations, setLocations] = useState<ParkingSpaceLocation[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<ParkingSpaceLocation | null>(null);
    const [suggestionLocation, setSuggestionLocation] = useState<SuggestionLocation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [region, setRegion] = useState<Region>({
      latitude: 20.5937,
      longitude: 78.9629,
      latitudeDelta: 20,
      longitudeDelta: 20,
    });
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedLocationReviews, setSelectedLocationReviews] = useState<Review[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showUnsafeDisclaimer, setShowUnsafeDisclaimer] = useState(false);
    const [neverShowDisclaimer, setNeverShowDisclaimer] = useState(false);
    

    const fetchParkingLocations = async () => {
      setIsLoading(true);
      setError(null);
    
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const userId = user?.id;
        const { data, error } = await supabase
          .from('parking_space_locations')
          .select(`
            parking_space_id,
            latitude,
            longitude,
            parkingSpace:parking_spaces (
              id,
              user_id,
              title,
              type,
              price,
              capacity,
              vehicle_types_allowed,
              photos,
              occupancy,
              verified,
              review_score,
              created_at,
              added_by,
              status,
              lender:users (
                id,
                name,
                profile_picture
              )
            )
          `)
           .eq('parkingSpace.status', 'Approved')
           .or(`user_id.neq.${userId},user_id.is.null`, { foreignTable: 'parkingSpace' })
    
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
    
        if (data) {
          const validItems = (data as unknown as DatabaseResponse[])
            .filter(item => {
              if (!item.parkingSpace) {
                return false;
              }
              return true;
            });
          
          const transformedData: ParkingSpaceLocation[] = validItems
            .map(item => ({
              parking_space_id: item.parking_space_id,
              latitude: typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude,
              longitude: typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude,
              parkingSpace: {
                ...item.parkingSpace,
                latitude: typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude,
                longitude: typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude,
                photos: Array.isArray(item.parkingSpace.photos) 
                  ? item.parkingSpace.photos 
                  : typeof item.parkingSpace.photos === 'object' && item.parkingSpace.photos !== null
                    ? Object.values(item.parkingSpace.photos)
                    : [],
                vehicle_types_allowed: Array.isArray(item.parkingSpace.vehicle_types_allowed)
                  ? item.parkingSpace.vehicle_types_allowed
                  : typeof item.parkingSpace.vehicle_types_allowed === 'string'
                    ? [item.parkingSpace.vehicle_types_allowed]
                    : [],
                lender: item.parkingSpace.lender ? { ...item.parkingSpace.lender, bookings: [] } : null
              }
            }));
    
          setLocations(transformedData);
        }
      } catch (err) {
        console.error('Error fetching parking locations:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while fetching parking locations');
      } finally {
        setIsLoading(false);
      }
    };

    const getMarkerStyle = (type: ParkingSpace['type']): MarkerStyle => {
      const styles: Record<ParkingSpace['type'], MarkerStyle> = {
        'Public': { icon: 'parking', color: '#0067b5' },
        'Lender-provided': { icon: 'shield-alt', color: '#4CAF50' },
        'Non-accountable': { icon: 'map-pin', color: '#ff6f36' }
      };
      return styles[type] || styles['Public'];
    };

    const getParkingTypeInfo = (type: ParkingSpace['type']) => {
      const types = {
        'Public': {
          label: 'Public Parking',
          color: '#2196F3',
          bgColor: '#E3F2FD',
          icon: 'parking',
          description: 'Municipal/Government operated parking space'
        },
        'Lender-provided': {
          label: 'Private Parking',
          color: '#4CAF50',
          bgColor: '#E8F5E9',
          icon: 'user-shield',
          description: 'Secure, privately managed parking space'
        },
        'Non-accountable': {
          label: 'Unsecure Parking',
          color: '#FF5252',
          bgColor: '#FFEBEE',
          icon: 'exclamation',
          description: 'Unofficial parking space - Park at your own risk'
        }
      };
      return types[type] || types['Public'];
    };

    useEffect(() => {
      const loadDisclaimerPreference = async () => {
        try {
          const value = await AsyncStorage.getItem('neverShowUnsafeDisclaimer');
          setNeverShowDisclaimer(value === 'true');
        } catch (error) {
          console.error('Error loading disclaimer preference:', error);
        }
      };
  
      loadDisclaimerPreference();
    }, []);
  
    const handleDontShowAgain = async () => {
      try {
        await AsyncStorage.setItem('neverShowUnsafeDisclaimer', 'true');
        setNeverShowDisclaimer(true);
        setShowUnsafeDisclaimer(false);
      } catch (error) {
        console.error('Error saving disclaimer preference:', error);
      }
    };
  
    const handleMarkerPress = async (location: ParkingSpaceLocation) => {
      setSelectedLocation(location);
      setSuggestionLocation(null);
  
      if (location.parkingSpace.type === 'Non-accountable' && !neverShowDisclaimer) {
        setShowUnsafeDisclaimer(true);
      } else {
        fetchReviews(location.parkingSpace.id);
      }
    };
  
    const UnsafeDisclaimerModal: React.FC = () => (
      <Portal>
        <Dialog visible={showUnsafeDisclaimer} dismissable={false}>
          <Dialog.Title style={styles.disclaimerTitle}>
            <FontAwesome5 name="user-slash" size={24} color="#FF5252" />
            {" Safety Notice"}
          </Dialog.Title>
          <Dialog.Content>
            <View style={styles.disclaimerContent}>
              <Text style={styles.disclaimerText}>
                This parking space is user-suggested. Please be aware that:
              </Text>
              <View style={styles.disclaimerPoints}>
                <Text style={styles.bulletPoint}>• We cannot guarantee the safety or legitimacy of this parking space</Text>
                <Text style={styles.bulletPoint}>• The space might not be officially designated for parking</Text>
                <Text style={styles.bulletPoint}>• There may be risks to your vehicle's security</Text>
                <Text style={styles.bulletPoint}>• No liability is accepted for any loss or damage</Text>
              </View>
              <Text style={styles.disclaimerEmphasis}>
                Proceed with caution and park at your own risk.
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <View style={styles.disclaimerActions}>
              <Button 
                mode="text" 
                onPress={handleDontShowAgain}
                style={styles.disclaimerButton}
              >
                Don't Show Again
              </Button>
              <Button 
                mode="contained" 
                onPress={() => {
                  setShowUnsafeDisclaimer(false);
                  if (selectedLocation) {
                    fetchReviews(selectedLocation.parkingSpace.id);
                  }
                }}
                style={[styles.disclaimerButton, styles.proceedButton]}
              >
                I Understand
              </Button>
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );

    const openDirections = (latitude: number, longitude: number) => {
      const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
      const latLng = `${latitude},${longitude}`;
      const label = 'Parking Space';
      const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`
      });

      if (url) {
        Linking.openURL(url).catch((err) => 
          Alert.alert('Error', 'Could not open maps application')
        );
      }
    };

    const ImageViewerModal: React.FC = () => {
      if (!selectedImage) return null;

      return (
        <Modal
          animationType="fade"
          transparent={true}
          visible={!!selectedImage}
          onRequestClose={() => setSelectedImage(null)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setSelectedImage(null)}
            >
              <FontAwesome5 name="times" size={24} color="white" />
            </TouchableOpacity>
            
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullSizeImage}
                resizeMode="contain"
              />
            </View>
            
            <View style={styles.modalBackground} />
          </View>
        </Modal>
      );
    };

    const fetchReviews = async (parkingSpaceId: string) => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:users (
            id,
            name,
            email
          )
        `)
        .eq('parking_space_id', parkingSpaceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        return;
      }
      setSelectedLocationReviews(data as Review[]);
    };

    const handleLongPress = (event: any) => {
      const coordinate = event.nativeEvent.coordinate;
      setSelectedLocation(null);
      setSuggestionLocation({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude
      });
    };

    useEffect(() => {
      const fetchLocation = async () => {
        try {
          // Request permission to access location
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Location permission is needed to access your location.');
            return;
          }
        
          Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000, // Update every 5 seconds
              distanceInterval: 10, // Update if the device moves by 10 meters
            },
            (location) => {
              setCurrentLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              });
            }
          );

          // Get the current location
          let location = await Location.getCurrentPositionAsync({});
          setRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        } catch (error) {
          console.error('Error getting location:', error);
        }
      };
      fetchLocation();
      fetchParkingLocations();
    }, []);

    const handleBookNowPress = () => {
      if (!selectedLocation?.parkingSpace) return;

      const parkingSpace: ParkingSpace = {
        id: selectedLocation.parkingSpace.id,
                user_id: selectedLocation.parkingSpace.user_id,

        title: selectedLocation.parkingSpace.title,
        type: selectedLocation.parkingSpace.type,
        price: selectedLocation.parkingSpace.price,
        capacity: selectedLocation.parkingSpace.capacity,
        vehicle_types_allowed: selectedLocation.parkingSpace.vehicle_types_allowed,
        photos: selectedLocation.parkingSpace.photos,
        occupancy: selectedLocation.parkingSpace.occupancy,
        verified: selectedLocation.parkingSpace.verified,
        review_score: selectedLocation.parkingSpace.review_score,
        status: selectedLocation.parkingSpace.status,
        latitude: selectedLocation.parkingSpace.latitude,
        longitude: selectedLocation.parkingSpace.longitude,
        created_at: selectedLocation.parkingSpace.created_at,
        added_by: selectedLocation.parkingSpace.added_by
      };

      navigation.navigate('BookingScreen', {
        parkingSpaceId: selectedLocation.parkingSpace.id,
        parkingSpace: { ...parkingSpace, bookings: [] }
      });
    };

    const LocationDetailsCard: React.FC = () => {
      if (!selectedLocation?.parkingSpace) return null;
      const [space, setSpace] = useState<ParkingSpace>(selectedLocation.parkingSpace);
      const [reviews, setReviews] = useState<Review[]>([]);
      const [showReviewForm, setShowReviewForm] = useState(false);
      const [newReview, setNewReview] = useState({ rating: 0, text: '' });
      const [userHasReviewed, setUserHasReviewed] = useState(false);
      const [isEditing, setIsEditing] = useState(false);
      const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
      const typeInfo = getParkingTypeInfo(space.type);
      const [currentUserId, setCurrentUserId] = useState<string | null>(null);

      useEffect(() => {
        const fetchCurrentUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          setCurrentUserId(user?.id || null);
        };
        fetchCurrentUser();
      }, []);

      const renderCapacity = () => {
        switch (space.type) {
          case 'Public':
            return `${space.capacity} spots`;
          case 'Non-accountable':
            return 'Est. ' + space.capacity + ' spots';
          case 'Lender-provided':
            return `${space.occupancy}/${space.capacity}`;
          default:
            return 'N/A';
        }
      };

      useEffect(() => {
        if (selectedLocation?.parkingSpace?.id) {
          fetchUpdatedParkingSpace();
          fetchReviews();
        }
      }, [selectedLocation]);
    
      const fetchReviews = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');
      
          const { data, error } = await supabase
            .from('reviews')
            .select(`
              *,
              user:users (
                id,
                name,
                email,
                profile_picture
              )
            `)
            .eq('parking_space_id', space.id)
            .eq('status', 'Active')
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          
          if (data) {
            const formattedReviews: Review[] = data.map(review => ({
              ...review,
              user: {
                id: review.user?.id,
                name: review.user?.name || 'Anonymous',
                email: review.user?.email || '',
                profile_picture: review.user?.profile_picture
              }
            }));
            
            setReviews(formattedReviews);
            const userReview = formattedReviews.find(review => review.user_id === user.id);
            setUserHasReviewed(!!userReview);
          }
        } catch (error) {
          console.error('Error fetching reviews:', error);
        }
      };
      
      const handleEditReview = (review: Review) => {
        setNewReview({
          rating: review.rating,
          text: review.review_text
        });
        setEditingReviewId(review.id);
        setIsEditing(true);
        setShowReviewForm(true);
      };
  
      const handleUpdateReview = async () => {
        if (newReview.rating === 0 || newReview.text.trim() === '') {
          Alert.alert('Error', 'Please provide both a rating and review text.');
          return;
        }
  
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');
  
          const { error } = await supabase
            .from('reviews')
            .update({
              rating: newReview.rating,
              review_text: newReview.text,
            })
            .eq('id', editingReviewId)
            .eq('user_id', user.id);
  
          if (error) throw error;
  
          Alert.alert('Success', 'Your review has been updated.');
          setShowReviewForm(false);
          setNewReview({ rating: 0, text: '' });
          setIsEditing(false);
          setEditingReviewId(null);
          fetchReviews();
          fetchUpdatedParkingSpace();
        } catch (error) {
          console.error('Error updating review:', error);
          Alert.alert('Error', 'Failed to update review. Please try again.');
        }
      };  
      
      const handleSubmitReview = async () => {
        if (isEditing) {
          await handleUpdateReview();
          return;
        }
        
        if (newReview.rating === 0 || newReview.text.trim() === '') {
          Alert.alert('Error', 'Please provide both a rating and review text.');
          return;
        }
    
        if (userHasReviewed) {
          Alert.alert('Error', 'You have already submitted a review for this parking space.');
          return;
        }
      
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');
      
          const { data, error } = await supabase
            .from('reviews')
            .insert({
              user_id: user.id,
              parking_space_id: space.id,
              rating: newReview.rating,
              review_text: newReview.text,
              status: 'Active'
            });
      
          if (error) throw error;
      
          Alert.alert('Success', 'Your review has been submitted.');
          setShowReviewForm(false);
          setNewReview({ rating: 0, text: '' });
          setUserHasReviewed(true);
          fetchReviews();
          fetchUpdatedParkingSpace();
        } catch (error) {
          console.error('Error submitting review:', error);
          Alert.alert('Error', 'Failed to submit review. Please try again.');
        }
      };
      
      
            

      const fetchUpdatedParkingSpace = async () => {
        try {
          const { data, error } = await supabase
            .from('parking_spaces')
            .select('*')
            .eq('id', space.id)
            .single();
  
          if (error) throw error;
  
          if (data) {
            setSpace(prevSpace => ({ ...prevSpace, ...data }));
          }
        } catch (error) {
          console.error('Error fetching updated parking space:', error);
        }
      };

      return (
        <Card style={styles.detailsCard}>
          <ScrollView style={styles.scrollView}>
            <Card.Content>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{space.title}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedLocation(null)}>
                  <FontAwesome5 name="times" size={20} color="black" />
                </TouchableOpacity>
              </View>

              <View style={[styles.parkingTypeBadge, { backgroundColor: typeInfo.bgColor }]}>
                <FontAwesome5 name={typeInfo.icon} size={16} color={typeInfo.color} />
                <Text style={[styles.parkingTypeLabel, { color: typeInfo.color }]}>
                  {typeInfo.label}
                </Text>
              </View>
              
              <Text style={[styles.parkingTypeDescription, { color: typeInfo.color }]}>
                {typeInfo.description}
              </Text>

              <TouchableOpacity 
                style={styles.directionsButton}
                onPress={() => openDirections(selectedLocation.latitude, selectedLocation.longitude)}
              >
                <FontAwesome5 name="directions" size={16} color="white" />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>

              {/* Updated Photos Carousel with TouchableOpacity */}
              <ScrollView 
                horizontal 
                style={styles.photoCarousel}
                showsHorizontalScrollIndicator={false}
              >
                {space.photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedImage(photo)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: photo }}
                      style={styles.parkingPhoto}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.infoRow}>
                <FontAwesome5 
                  name={getMarkerStyle(space.type).icon}
                  size={16} 
                  color={getMarkerStyle(space.type).color}
                />
                <Text style={styles.typeText}>
                  {space.type === 'Public' ? 'Public Space' : space.lender?.name ? `By ${space.lender.name}` : 'User-Suggested'}
                </Text>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Capacity</Text>
                  <Text style={styles.statValue}>{renderCapacity()}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Price</Text>
                  <Text style={styles.statValue}>
                    {space.price ? `₹${space.price}/hr` : 'Free'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Rating</Text>
                  <Text style={styles.statValue}>{space.review_score.toFixed(1)} ⭐</Text>
                </View>
              </View>

              <View style={styles.vehicleTypes}>
                {space.vehicle_types_allowed.map((type, index) => (
                  <Text key={index} style={styles.vehicleType}>{type}</Text>
                ))}
              </View>

              {/* Reviews Section */}
              <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>Reviews</Text>
              <Divider style={styles.divider} />
              
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewUserInfo}>
                      {review.user.profile_picture ? (
                        <Avatar.Image size={40} source={{ uri: review.user.profile_picture.data}} />
                      ) : (
                        <Avatar.Text size={40} label={review.user.name ? review.user.name.substring(0, 2).toUpperCase() : 'AN'} />
                      )}
                      <View style={styles.reviewUserDetails}>
                        <Text style={styles.reviewUserName}>{review.user.name || 'Anonymous'}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(review.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.ratingContainer}>
                      <Text style={styles.rating}>{review.rating}</Text>
                      <FontAwesome5 name="star" size={16} color="#FFC107" />
                    </View>
                  </View>
                  <Text style={styles.reviewText}>{review.review_text}</Text>
                  
                  {/* Edit button only shows if the review belongs to the current user */}
                  {currentUserId === review.user_id && (
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditReview(review)}
                    >
                      <FontAwesome5 name="edit" size={16} color="#666" />
                      <Text style={styles.editButtonText}>Edit Review</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Add Review Button */}
              {(space.type === 'Public' || space.type === 'Non-accountable') && !userHasReviewed && (
                <Button 
                  mode="contained" 
                  onPress={() => {
                    setIsEditing(false);
                    setEditingReviewId(null);
                    setNewReview({ rating: 0, text: '' });
                    setShowReviewForm(true);
                  }}
                  style={styles.addReviewButton}
                >
                  Add Review
                </Button>
              )}
            </View>

            {/* Review Form Modal */}
            <Portal>
              <Dialog visible={showReviewForm} onDismiss={() => {
                setShowReviewForm(false);
                setIsEditing(false);
                setEditingReviewId(null);
                setNewReview({ rating: 0, text: '' });
              }}>
                <Dialog.Title>{isEditing ? 'Edit Review' : 'Write a Review'}</Dialog.Title>
                <Dialog.Content>
                  <Text>Rating:</Text>
                  <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setNewReview({ ...newReview, rating: star })}
                      >
                        <FontAwesome5 
                          name={star <= newReview.rating ? "star" : "star"} 
                          size={30} 
                          color={star <= newReview.rating ? "#FFC107" : "#BDC3C7"} 
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    label="Review"
                    value={newReview.text}
                    onChangeText={(text) => setNewReview({ ...newReview, text })}
                    multiline
                    numberOfLines={4}
                    style={styles.reviewInput}
                  />
                </Dialog.Content>
                <Dialog.Actions>
                  <Button onPress={() => {
                    setShowReviewForm(false);
                    setIsEditing(false);
                    setEditingReviewId(null);
                    setNewReview({ rating: 0, text: '' });
                  }}>Cancel</Button>
                  <Button onPress={handleSubmitReview}>
                    {isEditing ? 'Update' : 'Submit'}
                  </Button>
                </Dialog.Actions>
              </Dialog>
            </Portal>

               {/* Only show booking button for Lender-provided spaces */}
            {space.type === 'Lender-provided' && (
              <Button 
                mode="contained"
                onPress={handleBookNowPress}
                style={[
                  styles.bookButton,
                  space.occupancy <= space.capacity
                    ? styles.bookButtonEnabled 
                    : styles.bookButtonDisabled
                ]}
                contentStyle={styles.bookButtonContent}
                disabled={space.capacity <= space.occupancy}
              >
                <FontAwesome5 
                  name={space.capacity <= space.occupancy ? "ban" : "calendar-check"} 
                  size={18} 
                  color="white" 
                />
                <Text style={styles.bookButtonText}>
                  {space.capacity <= space.occupancy 
                    ? 'Space Full' 
                    : 'Book Now'
                  }
                </Text>
              </Button>
            )}
            </Card.Content>
          </ScrollView>
        </Card>
      );
    };

    const SuggestionCard: React.FC = () => {
      if (!suggestionLocation) return null;

      return (
        <Card style={styles.detailsCard}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Suggest New Parking Space</Text>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setSuggestionLocation(null)}
              >
                <FontAwesome5 name="times" size={20} color="black" />
              </TouchableOpacity>
            </View>

            <Text style={styles.suggestionText}>
              Would you like to suggest this location as a potential parking space?
            </Text>

            <View style={styles.buttonContainer}>
              <Button 
                mode="contained"
                onPress={() => {
                  navigation.navigate('SuggestParkingSpace', { location: suggestionLocation });
                  setSuggestionLocation(null);
                }}
                style={styles.suggestButton}
              >
                Suggest This Location
              </Button>
              
              <Button 
                mode="outlined"
                onPress={() => setSuggestionLocation(null)}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </View>
          </Card.Content>
        </Card>
      );
    };

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text>Error: {error}</Text>
          <Button onPress={fetchParkingLocations}>Retry</Button>
        </View>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            region={region}
            onLongPress={handleLongPress}
          >
          {locations.map(location => {
            const markerStyle = getMarkerStyle(location.parkingSpace.type);
            return (
              <Marker
                key={location.parking_space_id}
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                onPress={() => handleMarkerPress(location)}
              >
                <FontAwesome5 name={markerStyle.icon} size={23} color={markerStyle.color} />
              </Marker>
            );
          })}

          {currentLocation && (
            <Marker
              coordinate={currentLocation}
              title="My Location"
              description="You are here"
            >
              <FontAwesome5 name="street-view" size={30} color="#baa400" />
            </Marker>
          )}

          {suggestionLocation && (
            <Marker
              coordinate={suggestionLocation}
              pinColor="#4CAF50"
            />
          )}
        </MapView>

          <UnsafeDisclaimerModal />
          {selectedLocation && <LocationDetailsCard />}
          {suggestionLocation && <SuggestionCard />}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <Text>Loading parking spaces...</Text>
            </View>
          )}
          <ImageViewerModal />
        </View>
      </SafeAreaView>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    map: {
      width: '100%',
      height: '100%',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 16,
      left: 16,
      backgroundColor: 'white',
      padding: 8,
      borderRadius: 8,
      elevation: 3,
    },
    detailsCard: {
      position: 'absolute',
      bottom: FLOATING_TAB_BAR_HEIGHT + 10,
      left: 10,
      right: 10,
      backgroundColor: 'white',
      borderRadius: 20,
      maxHeight: screenHeight * 0.6,
      elevation: 8,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      marginBottom: Platform.OS === 'ios' ? 20 : 10,
    },
    scrollView: {
      maxHeight: screenHeight * 0.6,
      borderRadius: 20,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingTop: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      flex: 1,
      color: '#1a1a1a',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: 16,
      backgroundColor: '#f8f9fa',
      padding: 16,
      borderRadius: 12,
      marginHorizontal: -16,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
      borderRightWidth: 1,
      borderRightColor: '#e0e0e0',
      paddingHorizontal: 8,
    },
    statLabel: {
      fontSize: 13,
      color: '#666',
      marginBottom: 6,
      fontWeight: '500',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#1a1a1a',
    },
    bookButton: {
      marginTop: 16,
      marginBottom: 24,
      paddingVertical: 8,
      borderRadius: 12,
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    bookButtonEnabled: {
      backgroundColor: '#4CAF50',
    },
    bookButtonDisabled: {
      backgroundColor: '#e0e0e0',
    },
    bookButtonContent: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bookButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: 'white',
      marginLeft: 8,
    },
    vehicleTypes: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 20,
      marginTop: 8,
    },
    vehicleType: {
      backgroundColor: '#E3F2FD',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      marginRight: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#BBDEFB',
    },
    reviewsSection: {
      marginTop: 24,
      marginBottom: 16,
      backgroundColor: '#f8f9fa',
      padding: 16,
      borderRadius: 12,
      marginHorizontal: -16,
    },
    reviewsTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 16,
      color: '#1a1a1a',
    },
    reviewItem: {
      marginBottom: 20,
      backgroundColor: 'white',
      padding: 16,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    imageContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    fullSizeImage: {
      width: '100%',
      height: '100%',
    },
    closeModalButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30,
      right: 20,
      zIndex: 2,
      padding: 10,
    },
    photoCarousel: {
      height: 200,
      marginBottom: 16,
    },
    parkingPhoto: {
      width: 300,
      height: 200,
      borderRadius: 8,
      marginRight: 8,
    },
    divider: {
      marginBottom: 16,
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    reviewUserInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reviewUserDetails: {
      marginLeft: 12,
    },
    reviewUserName: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    reviewDate: {
      fontSize: 12,
      color: '#666',
    },
    // ratingContainer: {
    //   flexDirection: 'row',
    //   alignItems: 'center',
    // },
    rating: {
      fontSize: 16,
      fontWeight: 'bold',
      marginRight: 4,
    },
    reviewText: {
      fontSize: 14,
      color: '#333',
      lineHeight: 20,
    },
    reviewDivider: {
      marginVertical: 16,
    },
    closeButton: {
      padding: 8,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    typeText: {
      marginLeft: 8,
      fontSize: 16,
    },
    suggestionText: {
      fontSize: 16,
      color: '#666',
      marginVertical: 16,
      textAlign: 'center',
    },
    buttonContainer: {
      marginTop: 16,
      gap: 8,
    },
    suggestButton: {
      marginBottom: 8,
      backgroundColor: '#4CAF50',
    },
    cancelButton: {
      borderColor: '#666',
    },
    directionsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4285F4', // Google Maps blue color
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
      justifyContent: 'center',
    },
    directionsButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    parkingTypeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      marginBottom: 8,
    },
    parkingTypeLabel: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: 'bold',
    },
    parkingTypeDescription: {
      fontSize: 14,
      marginBottom: 16,
      fontStyle: 'italic',
    },
    disclaimerTitle: {
      color: '#FF5252',
      fontSize: 20,
      textAlign: 'center',
      marginBottom: 10,
    },
    disclaimerContent: {
      padding: 10,
    },
    disclaimerText: {
      fontSize: 16,
      marginBottom: 15,
      color: '#333',
    },
    disclaimerPoints: {
      marginBottom: 15,
    },
    bulletPoint: {
      fontSize: 14,
      marginBottom: 8,
      color: '#555',
    },
    disclaimerEmphasis: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FF5252',
      textAlign: 'center',
      marginTop: 10,
    },
    disclaimerActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    disclaimerButton: {
      minWidth: 120,
    },
    proceedButton: {
      backgroundColor: '#FF5252',
    },
    addReviewButton: {
      marginTop: 16,
    },
    ratingContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: 10,
    },
    reviewInput: {
      marginTop: 10,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      padding: 8,
      marginTop: 8,
    },
    editButtonText: {
      marginLeft: 8,
      color: '#666',
      fontSize: 14,
    },
  });

  export default MapScreen;
