import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, ScrollView, RefreshControl } from 'react-native';
import { TextInput, Button, Surface, Text, ActivityIndicator, List, Menu, Divider, Chip } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  admin_response?: string;
  responded_at?: string;
  role_id: number;
}

interface Role {
  id: number;
  role_name: string;
}

const priorityColors = {
  Low: '#8BC34A',
  Medium: '#FFC107',
  High: '#FF9800',
  Urgent: '#F44336',
};

const SupportTicket = () => {
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [userRoles, setUserRoles] = useState<Role[]>([]);

  useEffect(() => {
    const fetchSessionAndRoles = async () => {
      try {
        // Fetch session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);

        if (!session?.user) {
          throw new Error('No user session found');
        }

        // Fetch user roles
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('roles(id, role_name)')
          .eq('user_id', session.user.id);

        if (roleError) throw roleError;

        // Transform role data
        const fetchedRoles = roleData.map((item: any) => item.roles);
        setUserRoles(fetchedRoles);

        // Set default role (first role or Renter/Lender based on metadata)
        const defaultRole = fetchedRoles[0];
        setCurrentRole(defaultRole);

        // Fetch tickets for the current role
        await fetchUserTickets(session.user.id, defaultRole.id);
      } catch (error) {
        if (error instanceof Error) {
          Alert.alert('Error', error.message);
        }
      } finally {
        setInitialLoading(false);
      }
    };

    fetchSessionAndRoles();
  }, []);

  const fetchUserTickets = async (userId: string, roleId: number) => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', 'Failed to fetch tickets');
      }
    }
  };

  const handleCreateSupportTicket = async () => {
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      Alert.alert('Invalid Input', 'Subject and description are required for support tickets');
      return;
    }

    if (!currentRole) {
      Alert.alert('Error', 'No role selected');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: session?.user?.id,
          role_id: currentRole.id,
          subject: ticketSubject,
          description: ticketDescription,
          status: 'Open',
          priority: selectedPriority,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      Alert.alert('Success', 'Support ticket created successfully');
      setTicketSubject('');
      setTicketDescription('');
      setSelectedPriority('Medium');
      
      if (session?.user && currentRole) {
        await fetchUserTickets(session.user.id, currentRole.id);
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    if (session?.user && currentRole) {
      setRefreshing(true);
      await fetchUserTickets(session.user.id, currentRole.id);
      setRefreshing(false);
    }
  }, [session, currentRole]);


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text>Fetching Tickets</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.scrollView}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.container}>
        <Surface style={styles.card} elevation={2}>
          <Text variant="titleLarge" style={styles.title}>Create Support Ticket</Text>
          <TextInput
            label="Subject"
            value={ticketSubject}
            onChangeText={setTicketSubject}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description"
            value={ticketDescription}
            onChangeText={setTicketDescription}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={4}
          />
          <Menu
            visible={showPriorityMenu}
            onDismiss={() => setShowPriorityMenu(false)}
            anchor={
              <Button 
                mode="outlined" 
                onPress={() => setShowPriorityMenu(true)}
                style={styles.priorityButton}
              >
                Priority: {selectedPriority}
              </Button>
            }
          >
            {['Low', 'Medium', 'High', 'Urgent'].map((priority) => (
              <Menu.Item
                key={priority}
                onPress={() => {
                  setSelectedPriority(priority);
                  setShowPriorityMenu(false);
                }}
                title={priority}
              />
            ))}
          </Menu>
          <Button
            mode="contained"
            onPress={handleCreateSupportTicket}
            style={styles.button}
            loading={loading}
            disabled={loading}
          >
            Submit Ticket
          </Button>
        </Surface>

        <Surface style={[styles.card, styles.ticketList]} elevation={2}>
          <Text variant="titleLarge" style={styles.title}>Your Tickets</Text>
          {tickets.length === 0 ? (
            <Text style={styles.noTickets}>No tickets found</Text>
          ) : (
            tickets.map((ticket) => (
              <Surface key={ticket.id} style={styles.ticketItem} elevation={1}>
                <View style={styles.ticketHeader}>
                  <Text variant="titleMedium">{ticket.subject}</Text>
                  <Chip 
                    style={[styles.statusChip, { backgroundColor: priorityColors[ticket.priority as keyof typeof priorityColors] }]}
                    textStyle={styles.chipText}
                  >
                    {ticket.priority}
                  </Chip>
                </View>
                <Text style={styles.date}>Created: {formatDate(ticket.created_at)}</Text>
                <Text style={styles.description}>{ticket.description}</Text>
                <Chip style={styles.statusChip}>{ticket.status}</Chip>
                
                {ticket.admin_response && (
                  <View style={styles.responseSection}>
                    <Divider style={styles.divider} />
                    <Text style={styles.responseLabel}>Admin Response:</Text>
                    <Text style={styles.responseText}>{ticket.admin_response}</Text>
                    {ticket.responded_at && (
                      <Text style={styles.responseDate}>
                        Responded: {formatDate(ticket.responded_at)}
                      </Text>
                    )}
                  </View>
                )}
              </Surface>
            ))
          )}
        </Surface>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  ticketList: {
    marginTop: 16,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  priorityButton: {
    marginBottom: 12,
  },
  ticketItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  description: {
    marginVertical: 8,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  chipText: {
    color: '#fff',
  },
  noTickets: {
    textAlign: 'center',
    color: '#666',
    marginTop: 16,
  },
  responseSection: {
    marginTop: 12,
  },
  responseLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  responseText: {
    marginBottom: 4,
  },
  responseDate: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    marginVertical: 8,
  },
});

export default SupportTicket;