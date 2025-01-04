import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, Alert, StyleSheet, RefreshControl, SafeAreaView } from 'react-native';
import { TextInput, Button, Surface, Text, ActivityIndicator, Menu, Divider, Chip, Portal, Modal } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface Ticket {
  id: string;
  user_id: string | null;
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  created_at: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  admin_response: string | null;
  responded_at: string | null;
  role_name?: string | null;
  user?: {
    id?: string;
    email?: string;
    name?: string;
  };
  role?: {
    id?: number;
    role_name?: string;
  };
}

const statusColors = {
  'Open': '#FF9800',
  'In Progress': '#2196F3',
  'Resolved': '#4CAF50'
};

const priorityColors = {
  Low: '#8BC34A',
  Medium: '#FFC107',
  High: '#FF9800',
  Urgent: '#F44336',
};

const SupportTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Ticket['status'] | null>(null);
  const [filterPriority, setFilterPriority] = useState<Ticket['priority'] | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          user:users (id, email, name),
          role:roles (id, role_name)
        `)
        .order('created_at', { ascending: false });
  
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }
      if (filterPriority) {
        query = query.eq('priority', filterPriority);
      }
  
      const { data, error } = await query;
  
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      // Transform data to ensure type safety and extract role name and user name
      const transformedTickets = data.map((ticket, index) => {        
        const transformedTicket = {
          ...ticket,
          user: ticket.user 
            ? {
                id: ticket.user.id,
                email: ticket.user.email,
                name: ticket.user.name
              } 
            : undefined,
          role_name: ticket.role ? ticket.role.role_name : null,
          role: ticket.role 
            ? {
                id: ticket.role.id,
                role_name: ticket.role.role_name
              } 
            : undefined
        };

        return transformedTicket;
      });
  
      setTickets(transformedTickets);
    } catch (error) {
      console.error('Fetch tickets error:', error);
      if (error instanceof Error) {
        Alert.alert('Error', 'Failed to fetch tickets: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority]);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    fetchSession();
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }, [fetchTickets]);

  const handleUpdateStatus = async (ticket: Ticket, newStatus: Ticket['status']) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticket.id);

      if (error) throw error;

      Alert.alert('Success', `Ticket status updated to ${newStatus}`);
      fetchTickets();
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedTicket || !responseText.trim()) {
      Alert.alert('Error', 'Please enter a response');
      return;
    }

    try {
      setResponding(true);
      const { error } = await supabase
        .from('support_tickets')
        .update({
          admin_response: responseText,
          responded_at: new Date().toISOString(),
          status: 'Resolved',
        })
        .eq('id', selectedTicket.id);

      if (error) throw error;

      Alert.alert('Success', 'Response submitted successfully');
      setSelectedTicket(null);
      setResponseText('');
      fetchTickets();
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    } finally {
      setResponding(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge">Loading support tickets...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <FilterSection 
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterPriority={filterPriority}
          setFilterPriority={setFilterPriority}
        />

        {tickets.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text variant="titleMedium" style={styles.emptyStateText}>
              No support tickets found
            </Text>
            <Text variant="bodyMedium" style={styles.emptyStateSubtext}>
              When tickets are submitted, they will appear here
            </Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <TicketCard 
              key={ticket.id}
              ticket={ticket}
              onUpdateStatus={handleUpdateStatus}
              onRespond={() => setSelectedTicket(ticket)}
            />
          ))
        )}

        <ResponseModal 
          visible={selectedTicket !== null}
          onDismiss={() => {
            setSelectedTicket(null);
            setResponseText('');
          }}
          selectedTicket={selectedTicket}
          responseText={responseText}
          setResponseText={setResponseText}
          onSubmit={handleSubmitResponse}
          responding={responding}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const FilterSection = ({ 
  filterStatus, 
  setFilterStatus, 
  filterPriority, 
  setFilterPriority 
}: {
  filterStatus: Ticket['status'] | null,
  setFilterStatus: React.Dispatch<React.SetStateAction<Ticket['status'] | null>>,
  filterPriority: Ticket['priority'] | null,
  setFilterPriority: React.Dispatch<React.SetStateAction<Ticket['priority'] | null>>
}) => (
  <Surface style={styles.filterContainer} elevation={2}>
    <Text variant="titleMedium" style={styles.filterTitle}>Filters</Text>
    <View style={styles.filterButtonsContainer}>
      <FilterMenu
        title="Status"
        value={filterStatus}
        options={['Open', 'In Progress', 'Resolved']}
        onSelect={(value) => setFilterStatus(value as Ticket['status'] | null)}
      />
      <FilterMenu
        title="Priority"
        value={filterPriority}
        options={['Low', 'Medium', 'High', 'Urgent']}
        onSelect={(value) => setFilterPriority(value as Ticket['priority'] | null)}
      />
    </View>
  </Surface>
);

const FilterMenu = ({ 
  title, 
  value, 
  options, 
  onSelect 
}: {
  title: string,
  value: string | null,
  options: string[],
  onSelect: (value: string | null) => void
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.filterButtonWrapper}>
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <Button 
            mode="outlined" 
            onPress={() => setVisible(true)}
            style={styles.filterButton}
            labelStyle={styles.filterButtonLabel}
          >
            {title}: {value || 'All'}
          </Button>
        }
      >
        <Menu.Item onPress={() => {
          onSelect(null);
          setVisible(false);
        }} title="All" />
        {options.map((option) => (
          <Menu.Item 
            key={option}
            onPress={() => {
              onSelect(option);
              setVisible(false);
            }} 
            title={option} 
          />
        ))}
      </Menu>
    </View>
  );
};

const TicketCard = ({ 
  ticket, 
  onUpdateStatus, 
  onRespond 
}: {
  ticket: Ticket,
  onUpdateStatus: (ticket: Ticket, newStatus: Ticket['status']) => void,
  onRespond: () => void
}) => (
  <Surface style={styles.ticketContainer} elevation={2}>
    <View style={styles.ticketHeader}>
      <Text variant="titleMedium" style={styles.ticketTitle}>{ticket.subject}</Text>
      <View style={styles.chipContainer}>
        <Chip 
          style={[styles.chip, { backgroundColor: priorityColors[ticket.priority] }]}
          textStyle={styles.chipTextWhite}
        >
          {ticket.priority}
        </Chip>
        <Chip 
          style={[styles.chip, { backgroundColor: statusColors[ticket.status] }]}
          textStyle={styles.chipTextWhite}
        >
          {ticket.status}
        </Chip>
      </View>
    </View>
    
    {/* Display detailed user information */}
    <View style={styles.userInfoContainer}>
      {ticket.user?.name && (
        <Text style={styles.userInfoText}>
          User: {ticket.user.name}
        </Text>
      )}
      </View>
      <View style={styles.userInfoContainer}>
      {ticket.role_name && (
        <Text style={styles.userInfoText}>
          Role: {ticket.role_name}
        </Text>
      )}
    </View>
    
    <Text style={styles.timestamp}>
      Created: {new Date(ticket.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </Text>
    <Text style={styles.description}>{ticket.description}</Text>
    
    {ticket.admin_response && (
      <View style={styles.responseContainer}>
        <Divider style={styles.divider} />
        <Text style={styles.responseLabel}>Admin Response:</Text>
        <Text style={styles.responseText}>{ticket.admin_response}</Text>
        {ticket.responded_at && (
          <Text style={styles.timestamp}>
            Responded: {new Date(ticket.responded_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    )}

    <View style={styles.actionButtons}>
      <Button 
        mode="outlined"
        onPress={onRespond}
        style={styles.actionButton}
        contentStyle={styles.buttonContent}
      >
        {ticket.admin_response ? 'Update Response' : 'Respond'}
      </Button>
      <StatusUpdateMenu ticket={ticket} onUpdateStatus={onUpdateStatus} />
    </View>
  </Surface>
);

const StatusUpdateMenu = ({ 
  ticket, 
  onUpdateStatus 
}: {
  ticket: Ticket,
  onUpdateStatus: (ticket: Ticket, newStatus: Ticket['status']) => void
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Button 
          mode="outlined"
          onPress={() => setVisible(true)}
          style={styles.actionButton}
          contentStyle={styles.buttonContent}
        >
          Update Status
        </Button>
      }
    >
      {['Open', 'In Progress', 'Resolved'].map((status) => (
        <Menu.Item
          key={status}
          onPress={() => {
            onUpdateStatus(ticket, status as Ticket['status']);
            setVisible(false);
          }}
          title={status}
          disabled={ticket.status === status}
        />
      ))}
    </Menu>
  );
};

const ResponseModal = ({ 
  visible, 
  onDismiss, 
  selectedTicket, 
  responseText, 
  setResponseText, 
  onSubmit, 
  responding 
}: {
  visible: boolean,
  onDismiss: () => void,
  selectedTicket: Ticket | null,
  responseText: string,
  setResponseText: React.Dispatch<React.SetStateAction<string>>,
  onSubmit: () => void,
  responding: boolean
}) => (
  <Portal>
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.modal}
    >
      <Surface style={styles.modalContent}>
        <Text variant="titleLarge" style={styles.modalTitle}>
          Respond to Ticket
        </Text>
        <Text variant="titleMedium" style={styles.modalSubtitle}>
          {selectedTicket?.subject}
        </Text>
        <TextInput
          label="Your Response"
          value={responseText}
          onChangeText={setResponseText}
          mode="outlined"
          multiline
          numberOfLines={6}
          style={styles.responseInput}
        />
        <View style={styles.modalActions}>
          <Button 
            mode="outlined" 
            onPress={onDismiss}
            style={styles.modalButton}
            contentStyle={styles.buttonContent}
          >
            Cancel
          </Button>
          <Button 
            mode="contained"
            onPress={onSubmit}
            loading={responding}
            disabled={responding || !responseText.trim()}
            style={styles.modalButton}
            contentStyle={styles.buttonContent}
          >
            Submit Response
          </Button>
        </View>
      </Surface>
    </Modal>
  </Portal>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    height: 40,
    paddingHorizontal: 8,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyStateText: {
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: '#999',
    textAlign: 'center',
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#444',
    marginVertical: 8,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  userInfoText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  responseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 16,
    color: '#444',
    lineHeight: 22,
    marginBottom: 4,
  },
  ticketContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  ticketHeader: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 30,
  },
  chipTextWhite: {
    color: '#fff',
  },
  responseContainer: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    minWidth: 120,
    height: 40,
  },
  modal: {
    margin: 20,
  },
  modalContent: {
    padding: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 8,
  },
  modalSubtitle: {
    marginBottom: 16,
    color: '#666',
  },
  responseInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    minWidth: 100,
    height: 40,
  },
  filterContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  filterTitle: {
    marginBottom: 12,
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  filterButtonWrapper: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterButton: {
    width: '100%',
  },
  filterButtonLabel: {
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  userInfoContainer: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default SupportTickets;

