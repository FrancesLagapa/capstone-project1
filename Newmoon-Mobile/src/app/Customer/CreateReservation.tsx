import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../../lib/api';

interface MenuProduct {
  id: number;
  name: string;
  price: number | string;
  description?: string | null;
  image?: string | null;
  product_stocks?: { branch_id: number | string; quantity: number }[];
  stocks?: { branch_id: number | string; quantity: number }[];
}

interface Branch {
  id: number;
  name: string;
  address?: string;
}

interface SelectedItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
}

function getNext15Days(): { date: Date; label: string; full: string }[] {
  const days: { date: Date; label: string; full: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 15; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const full = d.toISOString().split('T')[0];
    days.push({ date: d, label, full });
  }
  return days;
}

export default function CreateReservationScreen() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [pickupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'branch' | 'items' | 'review'>('branch');

  const dateOptions = useMemo(() => getNext15Days(), []);

  useEffect(() => {
    (async () => {
      try {
        const [branchesRes, productsRes] = await Promise.all([
          api.get('/branches'),
          api.get('/products'),
        ]);
        const branchData = Array.isArray(branchesRes.data?.data) ? branchesRes.data.data : [];
        const productData = Array.isArray(productsRes.data?.data) ? productsRes.data.data : [];
        setBranches(branchData);
        setProducts(productData);
        if (branchData.length > 0) setSelectedBranch(branchData[0]);
      } catch {
        Alert.alert('Error', 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const branchProducts = useMemo(() => {
    if (!selectedBranch) return [];
    return products.filter((p) => {
      const stocks = p.product_stocks ?? p.stocks ?? [];
      const stock = stocks.find((s) => String(s.branch_id) === String(selectedBranch.id));
      return stock && Number(stock.quantity) > 0;
    });
  }, [products, selectedBranch]);

  const subtotal = useMemo(() =>
    selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [selectedItems]
  );

  const addItem = (product: MenuProduct) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: 1,
      }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((i) =>
          i.product_id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const submitReservation = async () => {
    if (!selectedBranch) {
      Alert.alert('Error', 'Please select a branch');
      return;
    }
    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/customer/reservations', {
        branch_id: selectedBranch.id,
        pickup_date: pickupDate,
        items: selectedItems.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        notes: notes.trim() || undefined,
      });
      Alert.alert('Success', 'Reservation created successfully!', [
        { text: 'OK', onPress: () => router.push('/Customer/Reservations') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </SafeAreaView>
    );
  }

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
            New Reservation
          </Text>
        </View>
      </View>

      {/* Steps indicator */}
      <View className="flex-row px-4 py-3 bg-white border-b border-gray-100">
        {['branch', 'items', 'review'].map((s, i) => (
          <TouchableOpacity
            key={s}
            className={`flex-row items-center ${i > 0 ? 'ml-2' : ''}`}
            onPress={() => setStep(s as typeof step)}
            activeOpacity={0.7}
          >
            <View className={`w-7 h-7 rounded-full items-center justify-center ${step === s ? 'bg-yellow-400' : 'bg-gray-200'}`}>
              <Text className={`text-xs font-bold ${step === s ? 'text-yellow-900' : 'text-gray-500'}`}>{i + 1}</Text>
            </View>
            <Text className={`text-xs ml-1 ${step === s ? 'text-yellow-600 font-semibold' : 'text-gray-400'}`}>
              {s === 'branch' ? 'Branch' : s === 'items' ? 'Items' : 'Review'}
            </Text>
            {i < 2 && <View className={`w-6 h-0.5 ${step === s ? 'bg-yellow-400' : 'bg-gray-200'} ml-2`} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1 px-4 pt-4 bg-gray-50" showsVerticalScrollIndicator={false}>
        {step === 'branch' && (
          <>
            <Text className="text-gray-900 text-lg font-bold mb-4">Select Branch</Text>
            {branches.map((branch) => (
              <TouchableOpacity
                key={branch.id}
                className={`bg-white rounded-2xl p-4 mb-3 border ${selectedBranch?.id === branch.id ? 'border-yellow-400' : 'border-gray-100'}`}
                onPress={() => { setSelectedBranch(branch); setStep('items'); }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-yellow-50 items-center justify-center mr-3 border border-yellow-200">
                    <Ionicons name="storefront" size={20} color="#F59E0B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold">{branch.name}</Text>
                    {branch.address && <Text className="text-gray-500 text-xs mt-0.5">{branch.address}</Text>}
                  </View>
                  {selectedBranch?.id === branch.id && (
                    <Ionicons name="checkmark-circle" size={22} color="#F59E0B" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {step === 'items' && (
          <>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-900 text-lg font-bold">Select Items</Text>
              <Text className="text-gray-500 text-sm">{selectedBranch?.name}</Text>
            </View>

            {/* Pickup Date */}
            <Text className="text-gray-700 text-sm font-semibold mb-2">Pickup Date</Text>
            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm flex-row items-center">
              <Ionicons name="calendar" size={18} color="#F59E0B" />
              <Text className="text-gray-900 font-semibold ml-2">Today</Text>
            </View>

            <View className="flex-row items-center bg-orange-50 rounded-xl px-3 py-2 mb-4 border border-orange-200">
              <Ionicons name="warning" size={16} color="#EA580C" />
              <Text className="text-xs text-orange-700 ml-1.5 flex-1">
                Reservation not picked up will be automatically cancelled at 8PM.
              </Text>
            </View>

            {branchProducts.length === 0 ? (
              <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
                <Ionicons name="fast-food-outline" size={40} color="#9CA3AF" />
                <Text className="text-gray-500 mt-3">No items available at this branch</Text>
              </View>
            ) : (
              branchProducts.map((product) => {
                const inCart = selectedItems.find((i) => i.product_id === product.id);
                const imageUrl = product.image
                  ? `${(api.defaults?.baseURL ?? '').replace('/api', '')}/storage/${product.image}`
                  : null;
                return (
                  <View key={product.id} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
                    <View className="flex-row items-center">
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          className="w-16 h-16 rounded-xl mr-3"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-16 h-16 rounded-xl bg-gray-100 items-center justify-center mr-3">
                          <Ionicons name="image-outline" size={24} color="#D1D5DB" />
                        </View>
                      )}
                      <View className="flex-1 pr-3">
                        <Text className="text-gray-900 font-semibold">{product.name}</Text>
                        {product.description && (
                          <Text className="text-gray-500 text-xs mt-1" numberOfLines={1}>{product.description}</Text>
                        )}
                        <Text className="text-yellow-600 font-bold mt-1">₱{Number(product.price).toFixed(2)}</Text>
                      </View>
                      {inCart ? (
                        <View className="flex-row items-center bg-gray-100 rounded-xl">
                          <TouchableOpacity 
                            className="px-3 py-2" 
                            onPress={() => updateQty(product.id, -1)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="remove" size={18} color="#6B7280" />
                          </TouchableOpacity>
                          <Text className="text-gray-900 font-bold px-2 min-w-[24px] text-center">{inCart.quantity}</Text>
                          <TouchableOpacity 
                            className="px-3 py-2" 
                            onPress={() => updateQty(product.id, 1)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="add" size={18} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          className="bg-yellow-400 px-4 py-2 rounded-xl"
                          onPress={() => addItem(product)}
                          activeOpacity={0.7}
                        >
                          <Text className="text-yellow-900 font-semibold text-sm">Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            {selectedItems.length > 0 && (
              <TouchableOpacity
                className="bg-yellow-400 py-3 rounded-2xl items-center mt-2 mb-8"
                onPress={() => setStep('review')}
                activeOpacity={0.7}
              >
                <Text className="text-yellow-900 font-bold">Review Reservation ({selectedItems.length} items)</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {step === 'review' && (
          <>
            <Text className="text-gray-900 text-lg font-bold mb-4">Review Reservation</Text>

            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-500 text-xs uppercase font-semibold mb-1">Branch</Text>
              <Text className="text-gray-900 font-semibold">{selectedBranch?.name}</Text>
            </View>

            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-500 text-xs uppercase font-semibold mb-1">Pickup Date</Text>
              <Text className="text-gray-900 font-semibold">Today</Text>
            </View>

            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-500 text-xs uppercase font-semibold mb-2">Items</Text>
              {selectedItems.map((item) => (
                <View key={item.product_id} className="flex-row justify-between items-center py-1.5">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-gray-500 mr-2 w-6 text-center">{item.quantity}x</Text>
                    <Text className="text-gray-900 flex-1">{item.name}</Text>
                  </View>
                  <Text className="text-yellow-600 font-medium">₱{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <View className="border-t border-gray-100 mt-2 pt-2 flex-row justify-between">
                <Text className="text-gray-900 font-bold">Subtotal</Text>
                <Text className="text-yellow-600 font-bold">₱{subtotal.toFixed(2)}</Text>
              </View>
            </View>

            <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-500 text-xs uppercase font-semibold mb-2">Notes (optional)</Text>
              <TextInput
                className="bg-gray-50 text-gray-900 rounded-xl px-4 py-3 text-sm border border-gray-200"
                placeholder="Add special instructions..."
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              className="bg-yellow-400 py-4 rounded-2xl items-center mb-8"
              onPress={submitReservation}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator color="#78350F" />
              ) : (
                <Text className="text-yellow-900 font-bold text-lg">Submit Reservation</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}