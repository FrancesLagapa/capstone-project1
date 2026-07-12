import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import api from '../../../../lib/api';
import { COLORS, GRADIENT, CARD } from '../../../lib/staffTheme';

type ReservationStatus = 'pending' | 'confirmed' | 'ready' | 'picked_up' | 'completed' | 'cancelled';

interface ReservationItem {
  product_id: number;
  name: string;
  quantity: number;
  price: number;
}

interface Reservation {
  id: number;
  reservation_number: string;
  user_id: number;
  branch_id: number;
  pickup_date: string;
  status: ReservationStatus;
  notes: string | null;
  items: ReservationItem[];
  subtotal: number;
  total: number;
  branch?: { id: number; name: string; address?: string };
  user?: { id: number; firstname: string; lastname: string; phone?: string; email?: string };
  created_at: string;
}

const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',    color: COLORS.STATUS_PENDING_TEXT,  bg: COLORS.STATUS_PENDING_BG },
  confirmed: { label: 'Confirmed',  color: COLORS.STATUS_INFO_TEXT,     bg: COLORS.STATUS_INFO_BG },
  ready:     { label: 'Ready',      color: COLORS.STATUS_APPROVED_TEXT, bg: COLORS.STATUS_APPROVED_BG },
  picked_up: { label: 'Picked Up',  color: '#0891B2',                  bg: '#CFFAFE' },
  completed: { label: 'Completed',  color: '#7C3AED',                  bg: '#EDE9FE' },
  cancelled: { label: 'Cancelled',  color: COLORS.STATUS_REJECTED_TEXT, bg: COLORS.STATUS_REJECTED_BG },
};

export default function StaffReservationsScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'ready' | 'all' | 'history'>('ready');
  const [markingId, setMarkingId] = useState<number | null>(null);

  const fetchReservations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await api.get('/staff/reservations?per_page=50');
      const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setReservations(data);
    } catch {
      if (!isRefresh) setReservations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchReservations(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkPickedUp = (reservation: Reservation) => {
    Alert.alert(
      'Mark as Picked Up',
      `Confirm that reservation ${reservation.reservation_number} has been picked up by ${reservation.user?.firstname ?? 'customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setMarkingId(reservation.id);
              await api.post(`/staff/reservations/${reservation.id}/picked-up`);
              setReservations((prev) =>
                prev.map((r) => (r.id === reservation.id ? { ...r, status: 'picked_up' as const } : r))
              );
              Alert.alert('Success', 'Reservation marked as picked up');
            } catch (err: any) {
              const msg = err?.response?.data?.message || 'Failed to update status';
              Alert.alert('Error', msg);
            } finally {
              setMarkingId(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkComplete = (reservation: Reservation) => {
    Alert.alert(
      'Complete Reservation',
      `Mark reservation ${reservation.reservation_number} as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              setMarkingId(reservation.id);
              await api.post(`/staff/reservations/${reservation.id}/complete`);
              setReservations((prev) =>
                prev.map((r) => (r.id === reservation.id ? { ...r, status: 'completed' as const } : r))
              );
              Alert.alert('Success', 'Reservation completed');
            } catch (err: any) {
              const msg = err?.response?.data?.message || 'Failed to update status';
              Alert.alert('Error', msg);
            } finally {
              setMarkingId(null);
            }
          },
        },
      ]
    );
  };

  const readyReservations = reservations.filter((r) => r.status === 'ready');
  const allActive = reservations.filter((r) => !['cancelled', 'completed'].includes(r.status));
  const history = reservations.filter((r) => ['picked_up', 'completed', 'cancelled'].includes(r.status));

  const displayList = selectedTab === 'ready' ? readyReservations : selectedTab === 'all' ? allActive : history;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => `₱${Number(amount).toFixed(2)}`;

  const renderReservationCard = (reservation: Reservation) => {
    const status = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;
    const items = Array.isArray(reservation.items) ? reservation.items : [];
    const isReady = reservation.status === 'ready';
    const isPickedUp = reservation.status === 'picked_up';
    const isMarking = markingId === reservation.id;

    return (
      <View key={reservation.id} style={CARD} className="mb-3 mx-4">
        <View className="p-4">
          {/* Header */}
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1">
              <Text className="text-base font-bold" style={{ color: COLORS.TEXT_PRIMARY }}>
                {reservation.reservation_number}
              </Text>
              <Text className="text-xs mt-0.5" style={{ color: COLORS.TEXT_SECONDARY }}>
                {formatDate(reservation.created_at)}
              </Text>
            </View>
            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: status.bg }}>
              <Text className="text-xs font-semibold" style={{ color: status.color }}>
                {status.label}
              </Text>
            </View>
          </View>

          {/* Customer */}
          {reservation.user && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="person-outline" size={14} color={COLORS.TEXT_SECONDARY} />
              <Text className="text-sm ml-1.5" style={{ color: COLORS.TEXT_PRIMARY }}>
                {reservation.user.firstname} {reservation.user.lastname}
              </Text>
            </View>
          )}

          {/* Pickup Date */}
          <View className="flex-row items-center mb-2">
            <Ionicons name="calendar-outline" size={14} color={COLORS.TEXT_SECONDARY} />
            <Text className="text-sm ml-1.5" style={{ color: COLORS.TEXT_SECONDARY }}>
              Pickup: {formatDate(reservation.pickup_date)}
            </Text>
          </View>

          {/* Items */}
          {items.length > 0 && (
            <View className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.INPUT_BG }}>
              {items.map((item, idx) => (
                <View key={idx} className="flex-row justify-between items-center mb-1">
                  <Text className="text-xs flex-1" style={{ color: COLORS.TEXT_PRIMARY }} numberOfLines={1}>
                    {item.name} x{item.quantity}
                  </Text>
                  <Text className="text-xs font-medium" style={{ color: COLORS.TEXT_SECONDARY }}>
                    {formatCurrency(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
              <View className="border-t mt-1 pt-1" style={{ borderColor: COLORS.DIVIDER }}>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-bold" style={{ color: COLORS.TEXT_PRIMARY }}>Total</Text>
                  <Text className="text-xs font-bold" style={{ color: COLORS.PRIMARY_RED }}>
                    {formatCurrency(reservation.total)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Notes */}
          {reservation.notes ? (
            <View className="flex-row items-start mb-3">
              <Ionicons name="chatbubble-outline" size={14} color={COLORS.TEXT_MUTED} />
              <Text className="text-xs ml-1.5 flex-1" style={{ color: COLORS.TEXT_MUTED }} numberOfLines={2}>
                {reservation.notes}
              </Text>
            </View>
          ) : null}

          {/* Expiring Warning */}
          {isReady && (() => {
            const now = new Date();
            const hour = now.getHours();
            if (hour >= 17) {
              const minsLeft = hour >= 20 ? 0 : (20 - hour) * 60 - now.getMinutes();
              return (
                <View className="flex-row items-center bg-orange-50 rounded-xl px-3 py-2 mb-3 border border-orange-200">
                  <MaterialIcons name="timer" size={16} color="#EA580C" />
                  <Text className="text-xs font-medium ml-1.5" style={{ color: '#EA580C' }}>
                    {minsLeft > 0 ? `Auto-cancels in ${minsLeft} min (8PM)` : 'Will be cancelled at 8PM'}
                  </Text>
                </View>
              );
            }
            return null;
          })()}

          {/* Pick Up Button */}
          {isReady && (
            <TouchableOpacity
              className="rounded-xl py-3 items-center"
              style={{ backgroundColor: COLORS.PRIMARY_RED, opacity: isMarking ? 0.6 : 1 }}
              onPress={() => handleMarkPickedUp(reservation)}
              disabled={isMarking}
            >
              {isMarking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View className="flex-row items-center">
                  <MaterialIcons name="check-circle-outline" size={18} color="white" />
                  <Text className="text-white font-bold text-sm ml-1.5">Mark as Picked Up</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Complete Button */}
          {isPickedUp && (
            <TouchableOpacity
              className="rounded-xl py-3 items-center"
              style={{ backgroundColor: '#7C3AED', opacity: isMarking ? 0.6 : 1 }}
              onPress={() => handleMarkComplete(reservation)}
              disabled={isMarking}
            >
              {isMarking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View className="flex-row items-center">
                  <MaterialIcons name="task-alt" size={18} color="white" />
                  <Text className="text-white font-bold text-sm ml-1.5">Complete</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.BG_PAGE }}>
        <LinearGradient colors={GRADIENT.HEADER} className="px-4 pt-4 pb-5">
          <Text className="text-xl font-bold text-white">Reservations</Text>
        </LinearGradient>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.BG_PAGE }}>
      <LinearGradient colors={GRADIENT.HEADER} className="px-4 pt-4 pb-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-bold text-white">Reservations</Text>
            {readyReservations.length > 0 && (
              <Text className="text-xs text-white/80 mt-0.5">
                {readyReservations.length} ready for pickup
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View className="flex-row mx-4 mt-3 mb-3 rounded-xl overflow-hidden" style={{ backgroundColor: COLORS.INPUT_BG }}>
        {(['ready', 'all', 'history'] as const).map((tab) => {
          const labels = { ready: 'Ready', all: 'Active', history: 'History' };
          const counts = { ready: readyReservations.length, all: allActive.length, history: history.length };
          const isActive = selectedTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              className="flex-1 py-2.5 items-center"
              style={{ backgroundColor: isActive ? COLORS.PRIMARY_RED : 'transparent' }}
              onPress={() => setSelectedTab(tab)}
            >
              <Text className="text-xs font-semibold" style={{ color: isActive ? 'white' : COLORS.TEXT_SECONDARY }}>
                {labels[tab]} ({counts[tab]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchReservations(true)} tintColor={COLORS.PRIMARY_RED} />}
      >
        {displayList.length === 0 ? (
          <View className="items-center mt-20 px-6">
            <MaterialIcons
              name={selectedTab === 'ready' ? 'event-available' : 'event-busy'}
              size={64}
              color={COLORS.INPUT_BORDER}
            />
            <Text className="text-base font-semibold mt-4" style={{ color: COLORS.TEXT_SECONDARY }}>
              {selectedTab === 'ready' ? 'No Ready Reservations' : selectedTab === 'all' ? 'No Active Reservations' : 'No History'}
            </Text>
            <Text className="text-sm mt-1 text-center" style={{ color: COLORS.TEXT_MUTED }}>
              {selectedTab === 'ready'
                ? 'Reservations ready for pickup will appear here'
                : selectedTab === 'all'
                ? 'Active reservations for your branch will appear here'
                : 'Completed reservations will appear here'}
            </Text>
          </View>
        ) : (
          displayList.map(renderReservationCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
