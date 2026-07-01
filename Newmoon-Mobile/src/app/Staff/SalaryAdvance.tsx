import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { submitOrQueue } from '../../../lib/offlineApi';
import { useOffline } from '../../../context/offlineContext';

type CashAdvance = {
  id: number;
  amount: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  user: {
    id: number;
    firstname: string;
    lastname: string;
  };
};

type Statistics = {
  total_requested: number;
  pending: number;
  approved: number;
  rejected: number;
  total_amount_approved: number;
};

const formatCurrency = (amount: number) => {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-800';
    case 'approved':
      return 'bg-green-900/30 text-green-400 border-green-800';
    case 'rejected':
      return 'bg-red-900/30 text-red-400 border-red-800';
    default:
      return 'bg-gray-800 text-gray-400 border-gray-700';
  }
};

const CashAdvanceScreen = () => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { refreshPendingCount } = useOffline();

  // Fetch cash advances
  const { 
    data: advancesData, 
    isLoading: advancesLoading, 
    error: advancesError,
    refetch: refetchAdvances,
  } = useQuery({
    queryKey: ['cashAdvances'],
    queryFn: () => api.get('/cash-advances'),
  });

  // Fetch statistics
  const { 
    data: statistics, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['cashAdvanceStatistics'],
    queryFn: () => api.get('/cash-advances/statistics'),
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: { amount: number; reason: string | null }) => {
      const result = await submitOrQueue({
        method: 'POST',
        url: '/cash-advances',
        data,
        type: 'cash-advance',
        label: `Cash advance ₱${data.amount}`,
      });
      return result;
    },
    onSuccess: async (result) => {
      const message = result.queued
        ? 'Saved offline. Will sync when you are back online.'
        : 'Your cash advance request has been submitted';
      Alert.alert(result.queued ? 'Saved Offline' : 'Success', message);
      setShowRequestModal(false);
      setRequestAmount('');
      setRequestReason('');
      if (result.queued) {
        await refreshPendingCount();
      } else {
        queryClient.invalidateQueries({ queryKey: ['cashAdvances'] });
        queryClient.invalidateQueries({ queryKey: ['cashAdvanceStatistics'] });
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to submit request';
      Alert.alert('Error', message);
    },
  });

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchAdvances(),
        refetchStats(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchAdvances, refetchStats]);

  const advances = advancesData?.data?.data || [];
  const loading = advancesLoading || statsLoading;

  const handleSubmitRequest = async () => {
    const amount = parseFloat(requestAmount);
    
    if (!requestAmount || isNaN(amount) || amount < 100) {
      Alert.alert('Validation Error', 'Please enter a valid amount (minimum ₱100)');
      return;
    }

    if (amount > 10000) {
      Alert.alert('Validation Error', 'Maximum advance amount is ₱10,000');
      return;
    }

    submitMutation.mutate({
      amount: amount,
      reason: requestReason.trim() || null,
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="mt-4 text-gray-400 font-medium">Loading Cash Advances...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#10B981']}
            tintColor="#10B981"
            title="Pull to refresh..."
            titleColor="#6B7280"
          />
        }
      >
        {/* Header - Green POS style */}
        <View className="pt-12 pb-8 px-6 rounded-b-3xl" style={{ backgroundColor: '#10B981' }}>
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-green-100 text-xs font-semibold tracking-wide uppercase mb-1">
                Cash Management
              </Text>
              <Text className="text-white text-3xl font-bold">Cash Advance</Text>
              <Text className="text-green-100 text-sm mt-1">Request and track your advances</Text>
            </View>
            <TouchableOpacity 
              className="bg-white/20 p-3 rounded-full"
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Icon name="refresh" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Statistics Cards - dark with green accents */}
          {statistics?.data && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white/10 rounded-xl p-4 border border-white/20">
                <Text className="text-green-100 text-xs font-semibold uppercase mb-1">Total Approved</Text>
                <Text className="text-white text-xl font-bold">
                  {formatCurrency(statistics.data.total_amount_approved)}
                </Text>
              </View>
              <View className="flex-1 bg-white/10 rounded-xl p-4 border border-white/20">
                <Text className="text-green-100 text-xs font-semibold uppercase mb-1">Pending</Text>
                <Text className="text-white text-xl font-bold">{statistics.data.pending}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Request Button - NOW GREEN */}
        <View className="px-6 mt-6">
          <TouchableOpacity
            className="bg-green-600 rounded-xl p-4 flex-row items-center justify-center shadow-md"
            onPress={() => setShowRequestModal(true)}
          >
            <Icon name="add-circle" size={24} color="white" />
            <Text className="text-white font-bold text-lg ml-2">Request Cash Advance</Text>
          </TouchableOpacity>
        </View>

        {/* Advances List */}
        <View className="px-6 mt-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-xl font-bold">Your Requests</Text>
            <Text className="text-gray-400 text-sm">{advances.length} request(s)</Text>
          </View>

          {advances.length === 0 ? (
            <View className="bg-gray-900 rounded-xl p-8 items-center border border-gray-800">
              <View className="bg-gray-800 p-4 rounded-full mb-4">
                <Icon name="receipt-long" size={40} color="#9CA3AF" />
              </View>
              <Text className="text-gray-400 font-medium text-lg">No Requests Yet</Text>
              <Text className="text-gray-500 text-sm mt-1 text-center">
                Tap the button above to request a cash advance
              </Text>
            </View>
          ) : (
            advances.map((advance: CashAdvance) => (
              <View key={advance.id} className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-800">
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="text-white font-bold text-lg mb-1">
                      {formatCurrency(advance.amount)}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      Requested: {formatDate(advance.requested_at)}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-lg border ${getStatusColor(advance.status)}`}>
                    <Text className="text-xs font-bold uppercase">{advance.status}</Text>
                  </View>
                </View>

                {advance.reason && (
                  <View className="bg-gray-800 rounded-lg p-3 mb-3">
                    <Text className="text-gray-400 text-xs">{advance.reason}</Text>
                  </View>
                )}

                {advance.admin_notes && (
                  <View className="bg-green-900/30 rounded-lg p-3 mb-3 border border-green-800">
                    <Text className="text-green-400 text-xs font-semibold mb-1">Admin Note:</Text>
                    <Text className="text-green-300 text-xs">{advance.admin_notes}</Text>
                  </View>
                )}

                <View className="flex-row justify-between items-center pt-3 border-t border-gray-800">
                  {advance.status === 'approved' && advance.approved_at && (
                    <Text className="text-green-400 text-xs font-medium">
                      Approved: {formatDate(advance.approved_at)}
                    </Text>
                  )}
                  {advance.status === 'rejected' && advance.rejected_at && (
                    <Text className="text-red-400 text-xs font-medium">
                      Rejected: {formatDate(advance.rejected_at)}
                    </Text>
                  )}
                  {advance.status === 'pending' && (
                    <Text className="text-yellow-400 text-xs font-medium">
                      Awaiting approval
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Info Section - Now Green-themed */}
        <View className="px-6 mt-4 mb-6">
          <View className="bg-green-900/30 rounded-xl p-4 border border-green-800">
            <View className="flex-row items-center mb-2">
              <Icon name="info" size={20} color="#10B981" />
              <Text className="text-green-400 font-bold text-base ml-2">Information</Text>
            </View>
            <Text className="text-green-300 text-sm leading-5">
              • Minimum advance amount: ₱100{'\n'}
              • Maximum advance amount: ₱10,000{'\n'}
              • Advances are deducted from your monthly salary{'\n'}
              • Approval is subject to admin discretion
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Request Modal - dark theme */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <TouchableOpacity
            activeOpacity={1}
            className="flex-1"
            onPress={() => setShowRequestModal(false)}
          />
          <View className="bg-gray-900 rounded-t-3xl p-6 border-t border-gray-800">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white font-bold text-xl">Request Cash Advance</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Icon name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-gray-300 text-sm font-semibold mb-2">Amount (₱)</Text>
              <TextInput
                className="border border-gray-700 rounded-xl p-4 text-white text-lg bg-gray-800"
                placeholder="Enter amount"
                placeholderTextColor="#6B7280"
                keyboardType="decimal-pad"
                value={requestAmount}
                onChangeText={setRequestAmount}
                editable={!submitMutation.isPending}
              />
              <Text className="text-gray-500 text-xs mt-1">Min: ₱100 | Max: ₱10,000</Text>
            </View>

            <View className="mb-6">
              <Text className="text-gray-300 text-sm font-semibold mb-2">Reason (Optional)</Text>
              <TextInput
                className="border border-gray-700 rounded-xl p-4 text-white bg-gray-800"
                placeholder="Why do you need this advance?"
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={requestReason}
                onChangeText={setRequestReason}
                editable={!submitMutation.isPending}
                maxLength={500}
              />
              <Text className="text-gray-500 text-xs mt-1">Max 500 characters</Text>
            </View>

            <TouchableOpacity
              className={`bg-green-600 rounded-xl p-4 items-center ${submitMutation.isPending ? 'opacity-70' : ''}`}
              onPress={handleSubmitRequest}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Submit Request</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-3 rounded-xl p-4 items-center"
              onPress={() => setShowRequestModal(false)}
              disabled={submitMutation.isPending}
            >
              <Text className="text-gray-400 font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default CashAdvanceScreen;