import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import api from '../../../../lib/api';

interface Reservation {
  id: number;
  reservation_number: string;
  pickup_date: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  branch: { id: number; name: string };
  items: { product_id: number; name: string; quantity: number; price: number }[] | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  ready: '#10B981',
  picked_up: '#059669',
  cancelled: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  ready: 'Ready for Pickup',
  picked_up: 'Picked Up',
  cancelled: 'Cancelled',
};

// Helper function to get status style with opacity
const getStatusStyle = (color: string) => {
  return {
    backgroundColor: color + '20',
    borderColor: color,
    borderWidth: 0.5,
  };
};

export default function ReservationsScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('active');

  const loadReservations = useCallback(async () => {
    try {
      const response = await api.get('/customer/reservations');
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setReservations(data);
    } catch (err) {
      console.log('Failed to load reservations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadReservations();
  }, [loadReservations]));

  const onRefresh = () => {
    setRefreshing(true);
    loadReservations();
  };

  const filteredReservations = reservations.filter((r) => {
    if (filter === 'active') return !['picked_up', 'cancelled'].includes(r.status);
    if (filter === 'History') return ['picked_up', 'cancelled'].includes(r.status);
    return true;
  });

  // Helper function to render status badge
  const renderStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status] || '#9CA3AF';
    const label = STATUS_LABELS[status] || status;
    return (
      <View 
        className="px-3 py-0.5 rounded-full"
        style={getStatusStyle(color)}
      >
        <Text className="text-xs font-semibold" style={{ color: color }}>
          {label}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header - Fixed layout */}
      <View className="bg-white px-4 py-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="p-2 mr-2"
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          
          <Text className="text-xl font-bold text-gray-900 flex-1" numberOfLines={1}>
            Reservations
          </Text>
          
          <TouchableOpacity
            className="bg-yellow-400 px-4 py-2.5 rounded-full flex-row items-center"
            onPress={() => router.push('/Customer/CreateReservation')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add" size={18} color="#78350F" />
            <Text className="text-yellow-900 font-semibold text-sm ml-1">New</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <View className="flex-row gap-2 mt-3">
          {[
            { key: 'active', label: 'Active' },
            { key: 'History', label: 'History' },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              className={`px-4 py-2 rounded-full ${filter === f.key ? 'bg-yellow-400' : 'bg-gray-100'}`}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text className={`text-xs font-medium ${filter === f.key ? 'text-yellow-900' : 'text-gray-600'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center bg-gray-50">
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : filteredReservations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6 bg-gray-50">
          <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
          <Text className="text-gray-900 text-lg font-bold mt-4">
            {filter === 'active' ? 'No active reservations' : 'No history reservations'}
          </Text>
          <Text className="text-gray-500 text-sm text-center mt-1">
            {filter === 'active' ? 'Create a reservation to get started' : 'Your completed reservations will appear here'}
          </Text>
          {filter === 'active' && (
            <TouchableOpacity
              className="mt-6 bg-yellow-400 px-8 py-3 rounded-full"
              onPress={() => router.push('/Customer/CreateReservation')}
              activeOpacity={0.7}
            >
              <Text className="text-yellow-900 font-semibold">Create Reservation</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4 bg-gray-50"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
        >
          {filteredReservations.map((res) => (
            <TouchableOpacity
              key={res.id}
              className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
              activeOpacity={0.7}
              onPress={() => router.push(`/Customer/ReservationDetail?id=${res.id}`)}
            >
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-bold text-gray-900 flex-1 mr-2">{res.reservation_number}</Text>
                {renderStatusBadge(res.status)}
              </View>
              <Text className="text-xs text-gray-500">{res.branch.name}</Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="calendar" size={12} color="#9CA3AF" />
                <Text className="text-xs text-gray-500 ml-1">
                  Pickup: {new Date(res.pickup_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-100">
                <Text className="text-xs text-gray-500">
                  {res.items ? `${res.items.length} item${res.items.length > 1 ? 's' : ''}` : ''}
                </Text>
                <Text className="text-sm font-bold text-yellow-600">₱{Number(res.total).toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View className="h-4" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}