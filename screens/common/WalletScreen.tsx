import React, { useState, useEffect } from 'react'
import { StyleSheet, View, Alert, ScrollView, RefreshControl } from 'react-native'
import { Button, Surface, Text, TextInput, List, useTheme, MD3Theme } from 'react-native-paper'
import { supabase } from '../../lib/supabase'
import { Session } from '@supabase/supabase-js'

type Transaction = {
  id: string
  transaction_type: 'Deposit' | 'Withdrawal' | 'Booking' | 'Refund'
  payment_amount: number
  payment_date: string
  status: 'Pending' | 'Completed' | 'Failed' | 'Reversed'
  booking_id?: string
  parking_space_id?: string
  parking_space?: {
    title: string
  } | null
  from_account_id?: string
  to_account_id?: string
}

export default function WalletComponent() {
  const theme = useTheme()
  const styles = createStyles(theme)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [amount, setAmount] = useState('')
  const [balance, setBalance] = useState<number>(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accountId, setAccountId] = useState<string | null>(null)

  useEffect(() => {
    fetchSession()
  }, [])

  useEffect(() => {
    if (session?.user) {
      fetchUserAccount()
    }
  }, [session])

  const fetchSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
    } catch (error) {
      console.error('Error fetching session:', error)
      Alert.alert('Error', 'Failed to fetch session')
    }
  }

  useEffect(() => {
    fetchSession()
  
    const interval = setInterval(() => {
      if (session?.user) {
        fetchUserAccount()
        fetchTransactions()
      }
    }, 60000)
  
    return () => {
      clearInterval(interval)
    }
  }, [session])

  
  const fetchUserAccount = async () => {
    try {
      const userId = session?.user?.id
      if (!userId) {
        return
      }

      const { data, error } = await supabase
        .from('user_accounts')
        .select('id, balance')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching user account:', error)
        throw error
      }
      
      setAccountId(data.id)
      setBalance(data.balance)
    } catch (error) {
      if (error instanceof Error) {
        console.error('Account fetch error:', error.message)
        Alert.alert('Error', error.message)
      }
    }
  }

  const fetchTransactions = async () => {
    try {
      const userId = session?.user?.id
      if (!userId || !accountId) {
        return
      }

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          transaction_type,
          payment_amount,
          payment_date,
          status,
          booking_id,
          parking_space_id,
          from_account_id,
          to_account_id,
          parking_space:parking_spaces!parking_space_id (
            title
          )
        `)
        .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
        .order('payment_date', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching transactions:', error)
        throw error
      }
      
      if (data) {
        const formattedTransactions: Transaction[] = data.map(transaction => ({
          ...transaction,
          parking_space: transaction.parking_space ? transaction.parking_space[0] : null
        }))
        
        setTransactions(formattedTransactions)
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Transactions fetch error:', error.message)
        Alert.alert('Error', error.message)
      }
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchUserAccount(), fetchTransactions()])
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleAddMoney = async () => {
    if (!amount || isNaN(Number(amount))) {
      console.warn('Invalid amount entered')
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }
  
    setLoading(true)
    try {
      if (!accountId) {
        console.error('Account not found')
        throw new Error('Account not found')
      }
  
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          to_account_id: accountId,
          payment_amount: Number(amount),
          transaction_type: 'Deposit',
          status: 'Completed'
        })
  
      if (transactionError) {
        console.error('Transaction insert error:', transactionError)
        throw transactionError
      }
  
      await Promise.all([fetchUserAccount(), fetchTransactions()])
      setAmount('')
      Alert.alert('Success', 'Money added successfully')
    } catch (error) {
      if (error instanceof Error) {
        console.error('Add money error:', error.message)
        Alert.alert('Error', error.message)
      }
    } finally {
      setLoading(false)
    }
  }
  
  const handleWithdraw = async () => {
    if (!amount || isNaN(Number(amount))) {
      console.warn('Invalid amount entered')
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }
  
    setLoading(true)
    try {
      if (!accountId) {
        console.error('Account not found')
        throw new Error('Account not found')
      }
  
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          from_account_id: accountId,
          payment_amount: Number(amount),
          transaction_type: 'Withdrawal',
          status: 'Completed'
        })
  
      if (transactionError) {
        console.error('Transaction insert error:', transactionError)
        throw transactionError
      }
  
      await Promise.all([fetchUserAccount(), fetchTransactions()])
      setAmount('')
      Alert.alert('Success', 'Withdrawal initiated successfully')
    } catch (error) {
      if (error instanceof Error) {
        console.error('Withdraw error:', error.message)
        Alert.alert('Error', error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const renderTransactionItem = (transaction: Transaction) => {
    const isIncoming = transaction.to_account_id === accountId
    

    let title = `₹${transaction.payment_amount.toFixed(2)}`
    let description = new Date(transaction.payment_date).toLocaleDateString()
    let icon = 'cash-transfer'

    // Determine transaction type and icon
    switch (transaction.transaction_type) {
      case 'Deposit':
        title = isIncoming ? `Added ₹${transaction.payment_amount.toFixed(2)}` : title
        icon = 'cash-plus'
        break
      case 'Withdrawal':
        title = !isIncoming ? `Withdrawn ₹${transaction.payment_amount.toFixed(2)}` : title
        icon = 'cash-minus'
        break
      case 'Booking':
        title = !isIncoming ? `Paid ₹${transaction.payment_amount.toFixed(2)}` : `Earned ₹${transaction.payment_amount.toFixed(2)}`
        icon = isIncoming ? 'cash-plus' : 'cash-minus'
        description = `Booking for ${transaction.parking_space?.title || 'Parking Space'}`
        break
      case 'Refund':
        title = isIncoming ? `Refunded ₹${transaction.payment_amount.toFixed(2)}` : title
        icon = 'cash-plus'
        break
    }

    return (
      <List.Item
        key={transaction.id}
        title={title}
        description={description}
        left={props => <List.Icon {...props} icon={icon} />}
        right={props => (
          <Text {...props} style={[
            styles.statusText,
            { 
              color: 
                transaction.status === 'Completed' ? theme.colors.primary : 
                transaction.status === 'Failed' ? theme.colors.error : 
                theme.colors.secondary 
            }
          ]}>
            {transaction.status}
          </Text>
        )}
      />
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Surface style={styles.card} elevation={2}>
        <Text variant="titleLarge" style={styles.title}>Wallet</Text>
        <Text style={styles.balanceText}>
          Current Balance: ₹{balance.toFixed(2)}
        </Text>

        <TextInput
          label="Amount"
          value={amount}
          onChangeText={(text) => {
            setAmount(text)
          }}
          keyboardType="numeric"
          style={styles.input}
        />

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleAddMoney}
            style={styles.actionButton}
            loading={loading}
            disabled={loading}
          >
            Add Money
          </Button>
          <Button
            mode="contained"
            onPress={handleWithdraw}
            style={styles.actionButton}
            loading={loading}
            disabled={loading}
          >
            Withdraw
          </Button>
        </View>
      </Surface>

      <Surface style={[styles.card, styles.transactionsCard]} elevation={2}>
        <Text variant="titleMedium" style={styles.transactionsTitle}>
          Recent Transactions
        </Text>
        {transactions.map(renderTransactionItem)}
      </Surface>
    </ScrollView>
  )
}

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  balanceText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: theme.colors.primary,
  },
  input: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    borderRadius: 8,
  },
  transactionsCard: {
    marginTop: 0,
  },
  transactionsTitle: {
    marginBottom: 12,
  },
  statusText: {
    alignSelf: 'center',
  }
})