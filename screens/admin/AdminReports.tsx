import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, SafeAreaView } from 'react-native';
import { Card, Title, Paragraph, Button, Portal, ActivityIndicator, IconButton, DataTable } from 'react-native-paper';
import { supabase } from '../../lib/supabase';

interface ParkingSpace {
    id: string;
    title: string;
    type: string;
    price: number | null;
    capacity: number;
    occupancy: number | null;
    review_score: number;
    status: string;
    totalRevenue?: number;
    activeBookings?: number;
    transactionCount?: number;
}

interface Review {
    id: string;
    user_id: string;
    rating: number;
    review_text: string;
    created_at: string;
    status: 'Active' | 'Inactive';
    users?: {
        name: string;
    };
}

interface Transaction {
    id: string;
    payment_amount: number;
    payment_date: string;
    status: string;
    transaction_type: string;
    bookings?: {
        booking_start: string;
        booking_end: string;
        status: string;
        users: {
            id: string;
            name: string;
            email: string;
        }[];
    }[];
}

interface Vehicle {
    id: string;
    renter_id?: string;
    license_plate?: string;
    created_at?: string;
    ownership_documents?: string[];
    manufacturer: string;
    model: string;
    vehicle_type?: string;
}

interface User {
    name: string;
    email: string;
    phone_number: string;
}

interface Booking {
    id: string;
    booking_start: string;
    booking_end: string;
    status: string;
    price: number;
    users: User;
    vehicles: Vehicle;
}

interface BookingFrequencyStats {
    mostFrequentDay: string;
    mostFrequentHour: string;
    averageBookingDuration: number;
    peakBookingPeriods: {
        period: string;
        count: number;
    }[];
    bookingTypeBreakdown: {
        type: string;
        count: number;
        percentage: number;
    }[];
}


const ParkingSpaceReports = () => {
    const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
    const [isDetailsView, setIsDetailsView] = useState(false);
    const [bookingFrequencyStats, setBookingFrequencyStats] = useState<BookingFrequencyStats | null>(null);

    useEffect(() => {
        fetchParkingSpacesData();
    }, []);

    const fetchParkingSpacesData = async () => {
        try {
            setLoading(true);
            const { data: spaces, error: spacesError } = await supabase
                .from('parking_spaces')
                .select(`
                    id,
                    title,
                    type,
                    price,
                    capacity,
                    occupancy,
                    review_score,
                    status
                `)
                .eq('status', 'Approved')
                .order('review_score', { ascending: false });

            if (spacesError) throw spacesError;

            const enhancedSpaces = await Promise.all(
                spaces.map(async (space) => {
                    if (space.type === 'Lender-provided' && space.price) {
                        const { data: transactions } = await supabase
                            .from('transactions')
                            .select('payment_amount')
                            .eq('parking_space_id', space.id)
                            .eq('status', 'Completed');

                        const { count: activeBookingsCount } = await supabase
                            .from('bookings')
                            .select('id', { count: 'exact' })
                            .eq('parking_space_id', space.id)
                            .eq('status', 'Confirmed');

                        const { count: transactionCount } = await supabase
                            .from('transactions')
                            .select('id', { count: 'exact' })
                            .eq('parking_space_id', space.id)
                            .eq('status', 'Completed');

                        return {
                            ...space,
                            totalRevenue: transactions?.reduce(
                                (sum, trans) => sum + (trans.payment_amount || 0),
                                0
                            ) || 0,
                            activeBookings: activeBookingsCount || 0,
                            transactionCount: transactionCount || 0,
                        };
                    }
                    return space;
                })
            );

            const sortedSpaces = enhancedSpaces.sort((a, b) => (b.review_score || 0) - (a.review_score || 0));
            setParkingSpaces(sortedSpaces);
        } catch (error) {
            console.error('Error fetching parking spaces data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReviews = async (spaceId: string) => {
        const { data, error } = await supabase
            .from('reviews')
            .select(`
                id,
                user_id,
                rating,
                review_text,
                created_at,
                status,
                users (
                    name
                )
            `)
            .eq('parking_space_id', spaceId);
    
        if (error) {
            console.error('Error fetching reviews:', error);
            return;
        }
    
        const formattedData = data.map((review: any) => ({
            ...review,
            users: review.users[0]
        }));
    
        setReviews(formattedData);
    };

    const updateReviewStatus = async (reviewId: string, status: 'Active' | 'Inactive') => {
        const { error } = await supabase
            .from('reviews')
            .update({ status })
            .eq('id', reviewId);

        if (error) {
            console.error('Error updating review status:', error);
            return;
        }

        if (selectedSpace) {
            fetchReviews(selectedSpace.id);
        }
    };

    const fetchSpaceDetails = async (spaceId: string) => {
        try {
            const { data: transData, error: transError } = await supabase
                .from('transactions')
                .select(`
                    id,
                    payment_amount,
                    payment_date,
                    status,
                    transaction_type,
                    bookings (
                        booking_start,
                        booking_end,
                        status,
                        users (
                            name,
                            email
                        )
                    )
                `)
                .eq('parking_space_id', spaceId)
                .order('payment_date', { ascending: false });

            if (transError) throw transError;

            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    id,
                    booking_start,
                    booking_end,
                    status,
                    price,
                    users (
                        name,
                        email,
                        phone_number
                    ),
                    vehicles (
                        license_plate,
                        manufacturer,
                        model
                    )
                `)
                .eq('parking_space_id', spaceId)
                .eq('status', 'Confirmed');

            if (bookingsError) throw bookingsError;

            setTransactions(transData as Transaction[]);
            setActiveBookings(bookingsData as unknown as Booking[]);
        } catch (error) {
            console.error('Error fetching space details:', error);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const renderVehicleInfo = (vehicle: Vehicle) => {
        if (!vehicle) return 'No vehicle information';
        return `${vehicle.manufacturer} ${vehicle.model} ${vehicle.license_plate ? `(${vehicle.license_plate})` : ''}`;
    };

    const renderSpaceStats = (space: ParkingSpace) => {
        const stats = [];

        stats.push(
            <View key="rating" style={styles.stat}>
                <Paragraph style={styles.statLabel}>Rating</Paragraph>
                <Paragraph style={styles.statValue}>
                    {space.review_score?.toFixed(1) || 'N/A'}⭐
                </Paragraph>
            </View>
        );

        if (space.type === 'Public' || space.type === 'Non-accountable') {
            stats.push(
                <View key="capacity" style={styles.stat}>
                    <Paragraph style={styles.statLabel}>Capacity</Paragraph>
                    <Paragraph style={styles.statValue}>{space.capacity}</Paragraph>
                </View>
            );
        }

        if (space.type === 'Lender-provided') {
            if (space.price) {
                stats.push(
                    <View key="revenue" style={styles.lenderstat}>
                        <Paragraph style={styles.statLabel}>Revenue</Paragraph>
                        <Paragraph style={styles.statValue}>
                        ₹{space.totalRevenue?.toFixed(2) || '0.00'}
                        </Paragraph>
                    </View>
                );
                stats.push(
                    <View key="bookings" style={styles.lenderstat}>
                        <Paragraph style={styles.statLabel}>Active Bookings</Paragraph>
                        <Paragraph style={styles.statValue}>{space.activeBookings || 0}</Paragraph>
                    </View>
                );
                stats.push(
                    <View key="transactions" style={styles.lenderstat}>
                        <Paragraph style={styles.statLabel}>Transactions</Paragraph>
                        <Paragraph style={styles.statValue}>{space.transactionCount || 0}</Paragraph>
                    </View>
                );
            } else {
                stats.push(
                    <View key="price" style={styles.lenderstat}>
                        <Paragraph style={styles.statLabel}>Price</Paragraph>
                        <Paragraph style={styles.statValue}>Free</Paragraph>
                    </View>
                );
            }
        }

        return (
            <View style={styles.statsContainer}>
                {stats}
            </View>
        );
    };

    const renderReviewsModal = () => (
        <Modal
            visible={reviewsModalVisible}
            onDismiss={() => setReviewsModalVisible(false)}
            style={styles.modalContainer}
        >
            <ScrollView>
                <View style={styles.modalHeader}>
                    <IconButton 
                        icon="arrow-left" 
                        size={24} 
                        onPress={() => setReviewsModalVisible(false)}
                    />
                    <Title style={styles.modalTitle}>Reviews for {selectedSpace?.title}</Title>
                </View>
                {reviews.length > 0 ? (
                    reviews.map((review) => (
                        <Card key={review.id} style={styles.reviewCard}>
                            <Card.Content>
                                <View style={styles.reviewHeader}>
                                    <View>
                                        <Text style={styles.reviewerName}>{review.users?.name || 'Anonymous'}</Text>
                                        <Text>Rating: {'⭐'.repeat(review.rating)}</Text>
                                    </View>
                                    <View style={styles.reviewStatus}>
                                        <Text style={[styles[review.status.toLowerCase()]]}>
                                            {review.status}
                                        </Text>
                                        <IconButton
                                            icon={review.status === 'Active' ? 'eye-off' : 'eye'}
                                            onPress={() => updateReviewStatus(
                                                review.id,
                                                review.status === 'Active' ? 'Inactive' : 'Active'
                                            )}
                                        />
                                    </View>
                                </View>
                                <Paragraph style={styles.reviewText}>{review.review_text}</Paragraph>
                                <Text style={styles.reviewDate}>
                                    {new Date(review.created_at).toLocaleDateString()}
                                </Text>
                            </Card.Content>
                        </Card>
                    ))
                ) : (
                    <Text style={styles.noReviewsText}>No reviews available for this parking space.</Text>
                )}
            </ScrollView>
        </Modal>
    );

    const renderBookingsTable = () => (
        <Card style={styles.modalCard}>
            <Card.Content>
                <Title>Active Bookings</Title>
                {activeBookings.length > 0 ? (
                    <DataTable>
                        <DataTable.Header>
                            <DataTable.Title>User</DataTable.Title>
                            <DataTable.Title>Vehicle</DataTable.Title>
                            <DataTable.Title>Duration</DataTable.Title>
                            <DataTable.Title numeric>Price</DataTable.Title>
                        </DataTable.Header>
                        {activeBookings.map((booking) => (
                            <DataTable.Row key={booking.id}>
                                <DataTable.Cell>
                                    <Text>{booking.users.name}</Text>
                                    <Text>{booking.users.phone_number}</Text>
                                </DataTable.Cell>
                                <DataTable.Cell>{renderVehicleInfo(booking.vehicles)}</DataTable.Cell>
                                <DataTable.Cell>
                                    <Text>{formatDate(booking.booking_start)}</Text>
                                    <Text>{formatDate(booking.booking_end)}</Text>
                                </DataTable.Cell>
                                <DataTable.Cell numeric>₹{booking.price.toFixed(2)}</DataTable.Cell>
                            </DataTable.Row>
                        ))}
                    </DataTable>
                ) : (
                    <Text>No active bookings for this parking space.</Text>
                )}
            </Card.Content>
        </Card>
    );

    const renderTransactionsTable = () => (
        <Card style={styles.modalCard}>
            <Card.Content>
                <Title style={styles.tableTitle}>Recent Transactions</Title>
                {transactions.length > 0 ? (
                    <ScrollView horizontal>
                        <DataTable style={styles.dataTable}>
                            <DataTable.Header>
                                <DataTable.Title style={styles.columnHeader}>Date</DataTable.Title>
                                <DataTable.Title style={styles.columnHeader}>Type</DataTable.Title>
                                <DataTable.Title style={styles.columnHeader}>Amount</DataTable.Title>
                                <DataTable.Title style={styles.columnHeader}>Status</DataTable.Title>
                                {/* <DataTable.Title style={styles.columnHeader}>Booked By</DataTable.Title> */}
                            </DataTable.Header>
                            {transactions.slice(0, 5).map((transaction) => (
                                <DataTable.Row key={transaction.id}>
                                    <DataTable.Cell style={styles.tableCell}>{formatDate(transaction.payment_date)}</DataTable.Cell>
                                    <DataTable.Cell style={styles.tableCell}>{transaction.transaction_type}</DataTable.Cell>
                                    <DataTable.Cell style={styles.tableCell}>₹{transaction.payment_amount.toFixed(2)}</DataTable.Cell>
                                    <DataTable.Cell style={styles.tableCell}>
                                        <Text style={[styles.statusText, styles[transaction.status.toLowerCase()]]}>
                                            {transaction.status}
                                        </Text>
                                    </DataTable.Cell>
                                    {/* <DataTable.Cell style={styles.tableCell}>
                                        {transaction.bookings && transaction.bookings.length > 0 
                                            ? transaction.bookings[0].users[0]?.name || 'N/A'
                                            : 'N/A'}
                                    </DataTable.Cell> */}
                                </DataTable.Row>
                            ))}
                        </DataTable>
                    </ScrollView>
                ) : (
                    <Text style={styles.noDataText}>No transactions for this parking space.</Text>
                )}
                {transactions.length > 5 && (
                    <Button mode="text" onPress={() => {/* Implement view all transactions */}} style={styles.viewAllButton}>
                        View All Transactions
                    </Button>
                )}
            </Card.Content>
        </Card>
    );

    const calculateBookingFrequencyStats = async (spaceId: string) => {
        console.log(`[BookingStats] Starting calculation for parking space ID: ${spaceId}`);
        
        try {
            // Query bookings data with proper vehicle join
            console.log(`[BookingStats] Querying bookings data for space ID: ${spaceId}`);
            const { data: bookingsData, error } = await supabase
                .from('bookings')
                .select(`
                    id,
                    booking_start,
                    booking_end,
                    vehicle_id,
                    vehicles:vehicle_id (
                        vehicle_type,
                        manufacturer,
                        model
                    )
                `)
                .eq('parking_space_id', spaceId)
                .eq('status', 'Completed');
    
            if (error) {
                console.error('[BookingStats] Supabase query error:', {
                    error,
                    spaceId,
                    errorCode: error.code,
                    message: error.message
                });
                throw error;
            }
    
            console.log(`[BookingStats] Retrieved ${bookingsData?.length ?? 0} bookings`);
    
            if (!bookingsData?.length) {
                console.log('[BookingStats] No bookings found for space ID:', spaceId);
                setBookingFrequencyStats(null);
                return;
            }
    
            // Most Frequent Day calculation
            console.log('[BookingStats] Calculating day frequency');
            const dayFrequency = bookingsData.reduce((acc: { [key: string]: number }, booking) => {
                const day = new Date(booking.booking_start).toLocaleDateString('en-US', { weekday: 'long' });
                acc[day] = (acc[day] || 0) + 1;
                return acc;
            }, {});
            
            const mostFrequentDay = Object.keys(dayFrequency).length > 0 
                ? Object.keys(dayFrequency).reduce((a, b) => 
                    dayFrequency[a] > dayFrequency[b] ? a : b
                )
                : 'N/A';
            console.log('[BookingStats] Most frequent day:', mostFrequentDay, 'Count:', dayFrequency[mostFrequentDay] || 0);
    
            // Most Frequent Hour calculation
            console.log('[BookingStats] Calculating hour frequency');
            const hourFrequency: { [key: number]: number } = bookingsData.reduce((acc: { [key: number]: number }, booking) => {
                const hour = new Date(booking.booking_start).getHours();
                acc[hour] = (acc[hour] || 0) + 1;
                return acc;
            }, {});
            
            const mostFrequentHour = Object.keys(hourFrequency).length > 0
                ? Object.keys(hourFrequency).reduce((a, b) => 
                    hourFrequency[Number(a)] > hourFrequency[Number(b)] ? a : b
                )
                : 'N/A';
            console.log('[BookingStats] Most frequent hour:', mostFrequentHour, 'Count:', hourFrequency[Number(mostFrequentHour)] || 0);
    
            // Average Booking Duration calculation
            console.log('[BookingStats] Calculating average booking duration');
            const averageBookingDuration = bookingsData.length > 0 
                ? bookingsData.reduce((sum, booking) => {
                    const duration = (new Date(booking.booking_end).getTime() - new Date(booking.booking_start).getTime()) / (1000 * 60 * 60);
                    return sum + duration;
                }, 0) / bookingsData.length
                : 0;
            console.log('[BookingStats] Average booking duration (hours):', averageBookingDuration);
    
            // Peak Booking Periods calculation
            console.log('[BookingStats] Calculating peak booking periods');
            const periodFrequency: { [key: string]: number } = bookingsData.reduce((acc: { [key: string]: number }, booking) => {
                const hour = new Date(booking.booking_start).getHours();
                let period: string;
                if (hour >= 5 && hour < 12) period = 'Morning';
                else if (hour >= 12 && hour < 17) period = 'Afternoon';
                else if (hour >= 17 && hour < 21) period = 'Evening';
                else period = 'Night';
        
                acc[period] = (acc[period] || 0) + 1;
                return acc;
            }, {});
    
            const peakBookingPeriods = Object.entries(periodFrequency)
                .map(([period, count]) => ({ period, count }))
                .sort((a, b) => b.count - a.count);
            console.log('[BookingStats] Peak booking periods:', peakBookingPeriods);
    
            // Vehicle Type Breakdown calculation with proper vehicle join
            console.log('[BookingStats] Calculating vehicle type breakdown');
            const vehicleTypeBreakdown: { [key: string]: number } = bookingsData.reduce((acc: { [key: string]: number }, booking) => {
                const vehicle = booking.vehicles;
                const type = vehicle?.[0]?.vehicle_type || 'Unknown';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});
    
            const bookingTypeBreakdown = Object.entries(vehicleTypeBreakdown)
                .map(([type, count]) => ({
                    type,
                    count,
                    percentage: (count / bookingsData.length) * 100
                }))
                .sort((a, b) => b.count - a.count);
            console.log('[BookingStats] Vehicle type breakdown:', bookingTypeBreakdown);
    
            // Set final stats
            const finalStats = {
                mostFrequentDay,
                mostFrequentHour: mostFrequentHour !== 'N/A' ? `${mostFrequentHour}:00` : 'N/A',
                averageBookingDuration: Math.round(averageBookingDuration * 10) / 10,
                peakBookingPeriods,
                bookingTypeBreakdown
            };
            console.log('[BookingStats] Setting final stats:', finalStats);
            
            setBookingFrequencyStats(finalStats);
            console.log('[BookingStats] Successfully completed stats calculation');
            
        } catch (error) {
            console.error('[BookingStats] Error calculating booking frequency stats:', {
                error,
                spaceId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            setBookingFrequencyStats(null);
        }
    };
    
    const renderBookingFrequencyStats = () => {
        if (!bookingFrequencyStats) return null;

        return (
            <Card style={styles.modalCard}>
                <Card.Content>
                    <Title>Booking Frequency Insights</Title>
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Text style={styles.statLabel}>Most Frequent Day</Text>
                            <Text style={styles.statValue}>{bookingFrequencyStats.mostFrequentDay}</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statLabel}>Peak Hour</Text>
                            <Text style={styles.statValue}>{bookingFrequencyStats.mostFrequentHour}</Text>
                        </View>
                    </View>
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Text style={styles.statLabel}>Avg. Booking Duration (hrs)</Text>
                            <Text style={styles.statValue}>
                                {bookingFrequencyStats.averageBookingDuration}
                            </Text>
                        </View>
                    </View>
                    
                    <Title style={styles.subTitle}>Peak Booking Periods</Title>
                    {bookingFrequencyStats.peakBookingPeriods.map((period) => (
                        <View key={period.period} style={styles.periodRow}>
                            <Text style={styles.periodText}>{period.period}</Text>
                            <Text style={styles.periodCount}>{period.count} Bookings</Text>
                        </View>
                    ))}

                    <Title style={styles.subTitle}>Vehicle Type Breakdown</Title>
                    {bookingFrequencyStats.bookingTypeBreakdown.map((type) => (
                        <View key={type.type} style={styles.periodRow}>
                            <Text style={styles.periodText}>{type.type}</Text>
                            <Text style={styles.periodCount}>
                                {type.count} ({type.percentage.toFixed(1)}%)
                            </Text>
                        </View>
                    ))}
                </Card.Content>
            </Card>
        );
    };

    const handleSpaceSelect = async (space: ParkingSpace) => {
        setSelectedSpace(space);
        await fetchSpaceDetails(space.id);
        await fetchReviews(space.id);
        await calculateBookingFrequencyStats(space.id);
        setIsDetailsView(true);
    };

    const handleBackToReports = () => {
        setIsDetailsView(false);
        setSelectedSpace(null);
        setReviews([]);
        setTransactions([]);
        setActiveBookings([]);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                </View>
            </SafeAreaView>
        );
    }

    // Render details view
    if (isDetailsView && selectedSpace) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                    <View style={styles.headerContainer}>
                        <IconButton 
                            icon="arrow-left" 
                            size={24} 
                            onPress={handleBackToReports} 
                            style={styles.backButton}
                        />
                        <Title style={styles.detailsTitle}>{selectedSpace.title} Details</Title>
                    </View>

                    {selectedSpace.type === 'Lender-provided' ? (
                        <>
                            {renderBookingFrequencyStats()}
                            {renderBookingsTable()}
                            {renderTransactionsTable()}
                            <Button 
                                mode="contained" 
                                onPress={() => setReviewsModalVisible(true)}
                                style={styles.viewReviewsButton}
                            >
                                View Reviews
                            </Button>
                        </>
                    ) : (
                        <Button 
                            mode="contained" 
                            onPress={() => setReviewsModalVisible(true)}
                            style={styles.viewReviewsButton}
                        >
                            View Reviews
                        </Button>
                    )}

                    {renderReviewsModal()}
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <Title style={styles.mainTitle}>Parking Space Reports</Title>

                {['Lender-provided', 'Public', 'Non-accountable'].map((type) => {
                    const spacesOfType = parkingSpaces.filter((space) => space.type === type);
                    if (spacesOfType.length === 0) return null;

                    return (
                        <View key={type}>
                            <Title style={styles.sectionTitle}>{type} Spaces</Title>
                            {spacesOfType.map((space) => (
                                <TouchableOpacity
                                    key={space.id}
                                    onPress={() => handleSpaceSelect(space)}
                                >
                                    <Card style={styles.card}>
                                        <Card.Content>
                                            <View style={styles.cardHeader}>
                                                <Title>{space.title}</Title>
                                            </View>
                                            {renderSpaceStats(space)}
                                        </Card.Content>
                                    </Card>
                                </TouchableOpacity>
                            ))}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles: { [key: string]: any } = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 90, 
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainTitle: {
        fontSize: 24,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        marginTop: 16,
        marginBottom: 8,
    },
    card: {
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        flexWrap: 'wrap',
    },
    stat: {
        alignItems: 'center',
        flex: 5,
        marginTop: 8,
        marginBottom: 8,
    },
    lenderstat: {
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 8,
        marginHorizontal: 5,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 10,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        padding: 10,
        borderRadius: 8,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 5,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    subTitle: {
        fontSize: 16,
        marginTop: 15,
        marginBottom: 10,
    },
    periodRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    periodText: {
        fontSize: 14,
    },
    periodCount: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    modalContainer: {
        backgroundColor: 'white',
        padding: 20,
        margin: 20,
        maxHeight: '80%',
        borderRadius: 8,
    },
    modalTitle: {
        marginBottom: 16,
    },
    reviewCard: {
        marginBottom: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    reviewerName: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    reviewText: {
        marginVertical: 8,
    },
    reviewDate: {
        color: '#666',
        fontSize: 12,
    },
    reviewStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    closeButton: {
        marginTop: 16,
    },
    modalCard: {
        marginBottom: 16,
    },
    noReviewsText: {
        textAlign: 'center',
        marginVertical: 16,
        fontSize: 16,
        color: '#666',
    },
    Completed: {
        color: 'green',
    },
    Pending: {
        color: 'orange',
    },
    Failed: {
        color: 'red',
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        marginRight: 8,
    },
    detailsTitle: {
        flex: 1,
        fontSize: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    viewReviewsButton: {
        marginTop: 16,
    },
    active: {
        color: 'green',
    },
    inactive: {
        color: 'gray',
    },
    dataTable: {
        minWidth: '100%',
    },
    columnHeader: {
        paddingHorizontal: 8,
    },
    tableCell: {
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    statusText: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    tableTitle: {
        marginBottom: 16,
    },
    noDataText: {
        textAlign: 'center',
        marginVertical: 16,
        color: '#666',
    },
    viewAllButton: {
        marginTop: 16,
    },
    completed: {
        backgroundColor: '#e6f7ed',
        color: '#00a86b',
    },
    pending: {
        backgroundColor: '#fff7e6',
        color: '#ffa500',
    },
    failed: {
        backgroundColor: '#ffe6e6',
        color: '#ff0000',
    },
});

export default ParkingSpaceReports;

