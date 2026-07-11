import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../../lib/api';

interface Reservation {
  id: number;
  reservation_number: string;
  pickup_date: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  created_at: string;
  branch: { id: number; name: string; address?: string };
  items: { product_id: number; name: string; quantity: number; price: number }[] | null;
}

const STATUS_FLOW: Record<string, { label: string; icon: string; color: string; step: number }> = {
  pending: { label: 'Pending', icon: 'hourglass-outline', color: '#F59E0B', step: 0 },
  confirmed: { label: 'Confirmed', icon: 'checkmark-circle-outline', color: '#3B82F6', step: 1 },
  ready: { label: 'Ready for Pickup', icon: 'checkmark-circle', color: '#10B981', step: 2 },
  picked_up: { label: 'Picked Up', icon: 'bag-check-outline', color: '#059669', step: 3 },
  cancelled: { label: 'Cancelled', icon: 'close-circle', color: '#EF4444', step: -1 },
};

export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (id) {
      loadReservation();
      const interval = setInterval(loadReservation, 15000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const loadReservation = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const response = await api.get(`/customer/reservations/${id}`);
      setReservation(response.data);
    } catch (err) {
      if (!isRefresh) {
        Alert.alert('Error', 'Failed to load reservation');
        router.back();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  const cancelReservation = () => {
    Alert.alert('Cancel Reservation', 'Are you sure you want to cancel this reservation?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.post(`/customer/reservations/${id}/cancel`);
            await loadReservation();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to cancel');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </SafeAreaView>
    );
  }

  if (!reservation) return null;

  const statusInfo = STATUS_FLOW[reservation.status] || STATUS_FLOW.pending;
  const canCancel = ['pending', 'confirmed'].includes(reservation.status);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
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

          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">Reservation Details</Text>
            <Text className="text-xs text-gray-500">{reservation.reservation_number}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4 bg-gray-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadReservation(true)} tintColor="#F59E0B" colors={['#F59E0B']} />
        }
      >
        {/* Status Hero */}
        <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100 shadow-sm items-center">
          <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: statusInfo.color + '15' }}>
            <Ionicons name={statusInfo.icon as any} size={32} color={statusInfo.color} />
          </View>
          <Text className="text-gray-900 text-lg font-bold">{statusInfo.label}</Text>
          <Text className="text-gray-500 text-xs mt-1">
            Pickup: {new Date(reservation.pickup_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        {/* Status Steps */}
        <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-4">Reservation Progress</Text>
          {Object.entries(STATUS_FLOW).filter(([key]) => key !== 'cancelled').map(([key, info], idx, arr) => {
            const currentStep = statusInfo.step;
            const itemStep = info.step;
            const isActive = reservation.status === key;
            const isCompleted = currentStep > itemStep && currentStep >= 0;
            const isCurrent = isActive;
            const isLast = idx === arr.length - 1;

            return (
              <View key={key} className="flex-row" style={{ minHeight: isLast ? 36 : 56 }}>
                {/* Left: circle + connecting line */}
                <View className="items-center mr-3" style={{ width: 28 }}>
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      width: isCurrent ? 28 : 22,
                      height: isCurrent ? 28 : 22,
                      backgroundColor: isCompleted || isCurrent ? info.color : '#E5E7EB',
                      borderWidth: isCurrent ? 3 : 0,
                      borderColor: info.color + '55',
                    }}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={12} color="white" />
                    ) : (
                      <Ionicons name={info.icon as any} size={isCurrent ? 14 : 10} color={isCurrent ? 'white' : '#9CA3AF'} />
                    )}
                  </View>
                  {!isLast && (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        backgroundColor: isCompleted ? info.color : '#E5E7EB',
                        marginTop: 4,
                        marginBottom: 4,
                      }}
                    />
                  )}
                </View>

                {/* Right: title + subtitle */}
                <View className="flex-1 pb-1" style={{ paddingTop: isCurrent ? 2 : 0 }}>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: isCompleted || isCurrent ? '#1F2937' : '#9CA3AF' }}
                  >
                    {info.label}
                  </Text>
                  {isCurrent && (
                    <Text className="text-xs mt-0.5" style={{ color: info.color }}>
                      {isLast ? 'Completed' : 'Current Step'}
                    </Text>
                  )}
                  {!isCompleted && !isCurrent && (
                    <Text className="text-xs mt-0.5 text-gray-400">Pending</Text>
                  )}
                  {isCompleted && !isCurrent && (
                    <Text className="text-xs mt-0.5 text-gray-500">Done</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Branch & Pickup Date */}
        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-2">Branch</Text>
          <Text className="text-sm text-gray-700">{reservation.branch.name}</Text>
          <Text className="text-gray-900 font-bold text-sm mt-3 mb-1">Pickup Date</Text>
          <Text className="text-sm text-gray-700">
            {new Date(reservation.pickup_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
          {reservation.notes && (
            <>
              <Text className="text-gray-900 font-bold text-sm mt-3 mb-1">Notes</Text>
              <Text className="text-sm text-gray-700">{reservation.notes}</Text>
            </>
          )}
        </View>

        {/* Items */}
        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-3">Items</Text>
          {reservation.items?.map((item, idx) => (
            <View key={idx} className="flex-row justify-between items-center mb-2">
              <View className="flex-1">
                <Text className="text-sm text-gray-900" numberOfLines={1}>{item.name}</Text>
                <Text className="text-xs text-gray-500">x{item.quantity} @ ₱{Number(item.price).toFixed(2)}</Text>
              </View>
              <Text className="text-sm text-gray-900 font-medium">₱{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View className="border-t border-gray-100 pt-3 mt-2">
            <View className="flex-row justify-between pt-2 border-t border-gray-100 mt-1">
              <Text className="text-base font-bold text-gray-900">Total</Text>
              <Text className="text-base font-bold text-yellow-600">₱{Number(reservation.total).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {canCancel && (
          <TouchableOpacity
            className="bg-red-50 border border-red-200 rounded-xl py-3 items-center mb-4"
            onPress={cancelReservation}
            disabled={cancelling}
            activeOpacity={0.7}
          >
            {cancelling ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text className="text-red-500 font-semibold ml-2">Cancel Reservation</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}