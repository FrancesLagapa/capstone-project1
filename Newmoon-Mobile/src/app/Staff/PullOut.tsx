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
import { cacheProducts, getCachedProducts } from '../../../lib/dataCache';
import { hasNetworkConnection } from '../../../lib/network';

type PullOut = {
  id: number;
  product_id: number;
  branch_id: number;
  quantity: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  pulled_out_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  user: {
    id: number;
    firstname: string;
    lastname: string;
  };
  product: {
    id: number;
    name: string;
    sku: string;
  };
  branch: {
    id: number;
    name: string;
  };
};

type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
};

type Branch = {
  id: number;
  name: string;
};

type Statistics = {
  total_pulled_out: number;
  total_quantity: number;
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

const PullOutScreen = () => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestQuantity, setRequestQuantity] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { refreshPendingCount } = useOffline();

  // Fetch pull-outs
  const { 
    data: pullOutsData, 
    isLoading: pullOutsLoading, 
    error: pullOutsError,
    refetch: refetchPullOuts,
  } = useQuery({
    queryKey: ['pullOuts'],
    queryFn: () => api.get('/pull-outs'),
  });

  // Fetch products
  const { 
    data: productsData, 
    isLoading: productsLoading,
  } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const connected = await hasNetworkConnection();
      let responseData: any;

      if (connected) {
        try {
          const response = await api.get('/products');
          responseData = response.data;
          const productsArray = Array.isArray(responseData) ? responseData : (responseData?.data || []);
          await cacheProducts(productsArray);
        } catch (error) {
          responseData = await getCachedProducts<Product[]>();
          if (!responseData || responseData.length === 0) {
            console.warn('[PullOut] No cached products available, returning empty array');
            return { data: [] };
          }
        }
      } else {
        responseData = await getCachedProducts<Product[]>();
        if (!responseData || responseData.length === 0) {
          console.warn('[PullOut] No cached products while offline, returning empty array');
          return { data: [] };
        }
      }

      return { data: responseData };
    },
  });

  // Fetch statistics
  const { 
    data: statistics, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['pullOutStatistics'],
    queryFn: () => api.get('/pull-outs/statistics'),
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: { product_id: number; quantity: number; notes: string | null }) => {
      const result = await submitOrQueue({
        method: 'POST',
        url: '/pull-outs',
        data,
        type: 'pull-out',
        label: `Pull out x${data.quantity}`,
      });
      return result;
    },
    onSuccess: async (result) => {
      const message = result.queued
        ? 'Saved offline. Will sync when you are back online.'
        : 'Product has been pulled out from inventory';
      Alert.alert(result.queued ? 'Saved Offline' : 'Success', message);
      setShowRequestModal(false);
      setSelectedProduct(null);
      setRequestQuantity('');
      setRequestNotes('');
      if (result.queued) {
        await refreshPendingCount();
      } else {
        queryClient.invalidateQueries({ queryKey: ['pullOuts'] });
        queryClient.invalidateQueries({ queryKey: ['pullOutStatistics'] });
      }
    },
    onError: (error: any) => {
      console.error('Pull-out error:', error);
      console.error('Error response:', error?.response);
      console.error('Error data:', error?.response?.data);
      
      let message = 'Failed to pull out product';
      
      if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error?.response?.data?.error) {
        message = error.response.data.error;
      } else if (error?.message) {
        message = error.message;
      }
      
      // Add validation errors if present
      if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessages = Object.values(errors).flat();
        if (errorMessages.length > 0) {
          message = errorMessages.join(', ');
        }
      }
      
      Alert.alert('Error', message);
    },
  });

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchPullOuts(),
        refetchStats(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchPullOuts, refetchStats]);

  const pullOuts = Array.isArray(pullOutsData?.data?.data) ? pullOutsData.data.data : [];
  const products = Array.isArray(productsData?.data) ? productsData.data : (productsData?.data?.data || []);
  const loading = pullOutsLoading || statsLoading || productsLoading;

  const handleSubmitRequest = async () => {
    const quantity = parseFloat(requestQuantity);
    
    if (!selectedProduct) {
      Alert.alert('Validation Error', 'Please select a product');
      return;
    }

    if (!requestQuantity || isNaN(quantity) || quantity < 0.01) {
      Alert.alert('Validation Error', 'Please enter a valid quantity (minimum 0.01)');
      return;
    }

    if (quantity > 1000) {
      Alert.alert('Validation Error', 'Maximum pull-out quantity is 1,000');
      return;
    }

    submitMutation.mutate({
      product_id: selectedProduct.id,
      quantity: quantity,
      notes: requestNotes.trim() || null,
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="mt-4 text-gray-400 font-medium">Loading Pull-Outs...</Text>
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
            titleColor="#9CA3AF"
          />
        }
      >
        {/* Header - Green POS style */}
        <View className="pt-12 pb-8 px-6 rounded-b-3xl" style={{ backgroundColor: '#10B981' }}>
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-green-100 text-xs font-semibold tracking-wide uppercase mb-1">
                Inventory Management
              </Text>
              <Text className="text-white text-3xl font-bold">Pull-Outs</Text>
              <Text className="text-green-100 text-sm mt-1">Remove unsuitable products from inventory</Text>
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
                <Text className="text-green-100 text-xs font-semibold uppercase mb-1">Total Pulled Out</Text>
                <Text className="text-white text-xl font-bold">{statistics.data.total_quantity}</Text>
              </View>
              <View className="flex-1 bg-white/10 rounded-xl p-4 border border-white/20">
                <Text className="text-green-100 text-xs font-semibold uppercase mb-1">Total Records</Text>
                <Text className="text-white text-xl font-bold">{statistics.data.total_pulled_out}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Pull Out Button */}
        <View className="px-6 mt-6">
          <TouchableOpacity
            className="bg-green-600 rounded-xl p-4 flex-row items-center justify-center shadow-md"
            onPress={() => setShowRequestModal(true)}
          >
            <Icon name="delete-outline" size={24} color="white" />
            <Text className="text-white font-bold text-lg ml-2">Pull Out Product</Text>
          </TouchableOpacity>
        </View>

        {/* Pull-Outs List */}
        <View className="px-6 mt-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-xl font-bold">Pull-Out History</Text>
            <Text className="text-gray-400 text-sm">{pullOuts.length} record(s)</Text>
          </View>

          {pullOuts.length === 0 ? (
            <View className="bg-gray-900 rounded-xl p-8 items-center border border-gray-800">
              <View className="bg-gray-800 p-4 rounded-full mb-4">
                <Icon name="inventory-2" size={40} color="#6B7280" />
              </View>
              <Text className="text-gray-300 font-medium text-lg">No Pull-Outs Yet</Text>
              <Text className="text-gray-500 text-sm mt-1 text-center">
                Tap the button above to pull out a product
              </Text>
            </View>
          ) : (
            pullOuts.map((pullOut: PullOut) => (
              <View key={pullOut.id} className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-800">
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="text-white font-bold text-lg mb-1">
                      {pullOut.product?.name || 'Unknown Product'}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      Quantity: {pullOut.quantity}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      Branch: {pullOut.branch?.name || 'Unknown Branch'}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      Pulled Out: {formatDate(pullOut.pulled_out_at)}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-lg border ${getStatusColor(pullOut.status)}`}>
                    <Text className="text-xs font-bold uppercase">{pullOut.status}</Text>
                  </View>
                </View>

                {pullOut.notes && (
                  <View className="bg-gray-800 rounded-lg p-3 mb-3">
                    <Text className="text-gray-300 text-xs">{pullOut.notes}</Text>
                  </View>
                )}

                {pullOut.admin_notes && (
                  <View className="bg-green-900/30 rounded-lg p-3 mb-3 border border-green-800">
                    <Text className="text-green-400 text-xs font-semibold mb-1">Admin Note:</Text>
                    <Text className="text-green-300 text-xs">{pullOut.admin_notes}</Text>
                  </View>
                )}

                <View className="flex-row justify-between items-center pt-3 border-t border-gray-800">
                  {pullOut.status === 'approved' && pullOut.approved_at && (
                    <Text className="text-green-400 text-xs font-medium">
                      Approved: {formatDate(pullOut.approved_at)}
                    </Text>
                  )}
                  {pullOut.status === 'rejected' && pullOut.rejected_at && (
                    <Text className="text-red-400 text-xs font-medium">
                      Rejected: {formatDate(pullOut.rejected_at)}
                    </Text>
                  )}
                  {pullOut.status === 'pending' && (
                    <Text className="text-yellow-400 text-xs font-medium">
                      Awaiting approval
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Info Section */}
        <View className="px-6 mt-4 mb-6">
          <View className="bg-green-900/30 rounded-xl p-4 border border-green-800">
            <View className="flex-row items-center mb-2">
              <Icon name="info" size={20} color="#10B981" />
              <Text className="text-green-400 font-bold text-base ml-2">Information</Text>
            </View>
            <Text className="text-green-300 text-sm leading-5">
              • Pull-outs are for products no longer suitable for sale{'\n'}
              • Common reasons: expired, damaged, defective{'\n'}
              • Stock is reduced upon admin approval{'\n'}
              • All pull-outs are recorded for tracking purposes
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Request Modal - POS dark theme */}
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
              <Text className="text-white font-bold text-xl">Pull Out Product</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Icon name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Product Selection */}
            <View className="mb-4">
              <Text className="text-gray-300 text-sm font-semibold mb-2">Product</Text>
              <TouchableOpacity
                className="border border-gray-700 rounded-xl p-4 bg-gray-800 flex-row justify-between items-center"
                onPress={() => setShowProductPicker(true)}
              >
                <Text className={selectedProduct ? 'text-white' : 'text-gray-400'}>
                  {selectedProduct ? selectedProduct.name : 'Select a product'}
                </Text>
                <Icon name="chevron-right" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-gray-300 text-sm font-semibold mb-2">Quantity</Text>
              <TextInput
                className="border border-gray-700 rounded-xl p-4 text-white text-lg bg-gray-800"
                placeholder="Enter quantity"
                placeholderTextColor="#6B7280"
                keyboardType="decimal-pad"
                value={requestQuantity}
                onChangeText={setRequestQuantity}
                editable={!submitMutation.isPending}
              />
              <Text className="text-gray-500 text-xs mt-1">Min: 0.01 | Max: 1,000</Text>
            </View>

            <View className="mb-6">
              <Text className="text-gray-300 text-sm font-semibold mb-2">Notes (Optional)</Text>
              <TextInput
                className="border border-gray-700 rounded-xl p-4 text-white bg-gray-800"
                placeholder="Additional details about the pull-out..."
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={requestNotes}
                onChangeText={setRequestNotes}
                editable={!submitMutation.isPending}
                maxLength={1000}
              />
              <Text className="text-gray-500 text-xs mt-1">Max 1000 characters</Text>
            </View>

            <TouchableOpacity
              className={`bg-green-600 rounded-xl p-4 items-center ${submitMutation.isPending ? 'opacity-70' : ''}`}
              onPress={handleSubmitRequest}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Pull Out Product</Text>
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

      {/* Product Picker Modal - dark theme */}
      <Modal
        visible={showProductPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductPicker(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <TouchableOpacity
            activeOpacity={1}
            className="flex-1"
            onPress={() => setShowProductPicker(false)}
          />
          <View className="bg-gray-900 rounded-t-3xl p-6 max-h-[70%] border-t border-gray-800">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white font-bold text-xl">Select Product</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <Icon name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-[400px]">
              {products.map((product: Product) => (
                <TouchableOpacity
                  key={product.id}
                  className="border-b border-gray-800 p-4 flex-row justify-between items-center"
                  onPress={() => {
                    setSelectedProduct(product);
                    setShowProductPicker(false);
                  }}
                >
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">{product.name}</Text>
                    <Text className="text-gray-400 text-sm">SKU: {product.sku}</Text>
                    <Text className="text-gray-500 text-xs">{product.category}</Text>
                  </View>
                  {selectedProduct?.id === product.id && (
                    <Icon name="check-circle" size={24} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
              {products.length === 0 && (
                <View className="p-8 items-center">
                  <Text className="text-gray-400">No products available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PullOutScreen;