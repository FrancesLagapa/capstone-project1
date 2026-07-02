import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as SecureStore from 'expo-secure-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { submitOrQueue } from '../../../lib/offlineApi';
import { cacheProducts, getCachedProducts } from '../../../lib/dataCache';
import { hasNetworkConnection } from '../../../lib/network';
import { resolveStaffBranch, loadStaffUser } from '../../../lib/staffContext';
import { useOffline } from '../../../context/offlineContext';
import { useAuth } from '../../../context/authContext';

const { height: screenHeight } = Dimensions.get('window');

/** Portions sold in halves (½ bird, whole, 1½, …). */
const QTY_STEP = 0.5;

function snapQtyToHalfStep(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 2) / 2;
}

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

function formatQtyForDisplay(n: number): string {
  const s = snapQtyToHalfStep(Number(n));
  const r = Math.round(s * 100) / 100;
  return Number.isInteger(r) ? String(Math.round(r)) : String(r);
}

type StockStatus = 'Low Stock' | 'In Stock' | 'Out of Stock';

type StockBranch = {
  id: string;
  name?: string;
};

type StockProductStock = {
  id: string;
  branch_id: string | number;
  quantity: number;
  minimum_stock: number;
  branch?: StockBranch;
};

type StockDelivery = {
  id: string;
  branch_id: string | number;
  quantity: number;
  restocked_at?: string | null;
  received_at?: string | null;
  received_by?: string | number | null;
  branch?: StockBranch;
};

type StockItem = {
  id: string;
  name: string;
  sku?: string;
  category: string;
  type: string;
  quantity: number;
  price: number;
  minStock: number;
  status: StockStatus;
  product_stocks?: StockProductStock[];
  ongoing_stocks?: StockDelivery[];
  icon: string;
  description?: string;
  popular?: boolean;
  branchStock?: StockProductStock;
  pendingQty?: number;
  lastDeliveryAt?: string | null;
};

// ===== Robust extractor with logging =====
function extractProductsArray(responseData: any): any[] {
  console.log('[EXTRACT] Response data type:', typeof responseData);
  console.log('[EXTRACT] Response data keys:', responseData ? Object.keys(responseData) : 'null/undefined');

  if (Array.isArray(responseData)) {
    console.log('[EXTRACT] Response is direct array, length:', responseData.length);
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    // Laravel paginated: { data: [...], ... }
    if (Array.isArray(responseData.data)) {
      console.log('[EXTRACT] Using responseData.data, length:', responseData.data.length);
      return responseData.data;
    }
    // Some APIs wrap products in a 'products' key
    if (Array.isArray(responseData.products)) {
      console.log('[EXTRACT] Using responseData.products, length:', responseData.products.length);
      return responseData.products;
    }
    // Maybe the whole object is the product list? (unlikely)
    console.warn('[EXTRACT] Could not find an array in response, returning []');
    return [];
  }

  console.warn('[EXTRACT] Response data is not an object, returning []');
  return [];
}

export default function POSScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { refreshPendingCount } = useOffline();
  const { isReauthenticating, isOfflineSession } = useAuth();
  const [cart, setCart] = useState<(StockItem & { quantity: number })[]>([]);
  const [cash, setCash] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [seniorDiscount, setSeniorDiscount] = useState(false);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ongoingStocksModalVisible, setOngoingStocksModalVisible] = useState(false);
  const [ongoingStocks, setOngoingStocks] = useState<StockItem[]>([]);
  const [collapsedReceived, setCollapsedReceived] = useState(false);
  const [collapsedNotReceived, setCollapsedNotReceived] = useState(false);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [halfPortions, setHalfPortions] = useState<Record<string, boolean>>({});

  // Only "All" category now
  const categories = ['All'];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const categoryScrollRef = useRef<ScrollView>(null);

  const COLLAPSE_KEY_RECEIVED = 'pos_ongoing_stocks_collapsed_received';
  const COLLAPSE_KEY_NOT_RECEIVED = 'pos_ongoing_stocks_collapsed_not_received';
  const idsEqual = (a: any, b: any) => String(a ?? '') === String(b ?? '');

  // --- Branch resolution ---
  const getBranchIdFromUser = (user: any): string | null => {
    if (!user) return null;
    if (user.branch_id) return String(user.branch_id);
    if (user.branchId) return String(user.branchId);
    if (user.branch?.id) return String(user.branch.id);
    if (user.branch?.branch_id) return String(user.branch.branch_id);

    const assignments = Array.isArray(user.branch_assignments) ? user.branch_assignments :
      Array.isArray(user.branchAssignments) ? user.branchAssignments : [];
    const activeAssignment = assignments.find((a: any) => a?.is_active) || assignments[0];
    if (activeAssignment) {
      return String(activeAssignment?.branch_id ||
        activeAssignment?.branch?.id ||
        activeAssignment?.branch?.branch_id ||
        activeAssignment?.id);
    }
    if (user.staff?.branch_id) return String(user.staff.branch_id);
    if (user.staff?.branch?.id) return String(user.staff.branch.id);
    return null;
  };

  const resolveBranchId = async (): Promise<string | null> => {
    if (branchId) return branchId;
    try {
      const { branchId: bid } = await resolveStaffBranch();
      if (bid) {
        setBranchId(bid);
        return bid;
      }
      return null;
    } catch (error) {
      console.error('[BRANCH] resolveBranchId error:', error);
      return null;
    }
  };

  // --- React Query for Products ---
  const productsQuery = useQuery<StockItem[]>({
    queryKey: ['products', branchId],
    queryFn: async () => {
      try {
        const connected = await hasNetworkConnection();
        let responseData: any;

        if (connected) {
          try {
            const response = await api.get('/products');
            responseData = response.data;
            await cacheProducts(responseData);
          } catch (error) {
            responseData = await getCachedProducts();
            if (!responseData) {
              console.warn('[productsQuery] No cached products available, returning empty array');
              return [];
            }
          }
        } else {
          responseData = await getCachedProducts();
          if (!responseData) {
            console.warn('[productsQuery] No cached products while offline, returning empty array');
            return [];
          }
        }

        const rawProducts = extractProductsArray(responseData);
        if (!Array.isArray(rawProducts)) {
          console.warn('[productsQuery] rawProducts is not an array, resetting to []');
          return [];
        }
        const branch = await resolveBranchId();
        const productsWithDetails: StockItem[] = rawProducts.map((item: any) => {
          const branchStock = (item.product_stocks || []).find((s: any) =>
            idsEqual(s.branch_id, branch)
          );
          const quantity = branchStock?.quantity || 0;
          const minimumStock = branchStock?.minimum_stock ?? 0;
          const status: StockStatus = quantity <= 0 ? 'Out of Stock' : 'In Stock';
          return {
            id: String(item.id),
            name: item.name,
            category: item.category || 'Product',
            type: 'Regular',
            quantity,
            price: Number(item.price || 0),
            minStock: minimumStock,
            status,
            icon: item.category === 'Liempo' ? 'lunch_dining' : 'fastfood',
            description: `Stock: ${quantity}`,
            popular: quantity > 20,
            branchStock: branchStock,
            ongoing_stocks: item.ongoing_stocks || [],
          };
        });
        const pendingExists = rawProducts.some((item: any) =>
          (item.ongoing_stocks || []).some(
            (d: any) => idsEqual(d.branch_id, branch) && !d.received_at && Number(d.quantity || 0) > 0
          )
        );
        queryClient.setQueryData(['pendingStock'], pendingExists);
        return productsWithDetails.filter((p: StockItem) => p.quantity > 0);
      } catch (error) {
        console.error('[productsQuery] Error:', error);
        return [];
      }
    },
    enabled: true,
    staleTime: 30000,
  });

  // --- Load ongoing stocks (manual) ---
  const loadOngoingStocks = async () => {
    try {
      const response = await api.get('/products');
      const raw = extractProductsArray(response.data);
      if (!Array.isArray(raw)) {
        console.warn('[loadOngoingStocks] raw is not an array');
        Alert.alert('Error', 'Could not load stocks');
        return;
      }
      const branch = await resolveBranchId();
      const productsWithDetails = raw.map((item: any) => {
        const branchStock = (item.product_stocks || []).find((s: any) =>
          idsEqual(s.branch_id, branch)
        );
        const quantity = branchStock?.quantity || 0;
        const minimumStock = branchStock?.minimum_stock ?? 0;
        const deliveriesForBranch = (item.ongoing_stocks || []).filter((d: any) =>
          idsEqual(d.branch_id, branch)
        );
        const pendingQty = deliveriesForBranch
          .filter((d: any) => !d.received_at)
          .reduce((sum: number, d: any) => sum + Number(d.quantity || 0), 0);
        const lastDeliveryAt =
          deliveriesForBranch
            .map((d: any) => d.restocked_at)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null;
        return {
          id: String(item.id),
          name: item.name,
          category: item.category || 'Product',
          type: 'Regular',
          quantity,
          price: Number(item.price || 0),
          minStock: minimumStock,
          status: quantity <= 0 ? 'Out of Stock' : quantity < minimumStock ? 'Low Stock' : 'In Stock' as StockStatus,
          icon: item.category === 'Liempo' ? 'lunch_dining' : 'fastfood',
          description: `Stock: ${quantity}`,
          popular: quantity > 20,
          branchStock,
          ongoing_stocks: deliveriesForBranch,
          pendingQty,
          lastDeliveryAt,
        } as StockItem;
      });
      const onlyBranchOngoing = productsWithDetails.filter((p: any) => (p.ongoing_stocks || []).length > 0);
      setOngoingStocks(onlyBranchOngoing);
      setOngoingStocksModalVisible(true);
    } catch (error) {
      console.error('Error loading ongoing stocks:', error);
      Alert.alert('Error', 'Failed to load stocks');
    }
  };

  // --- Mark as received / not received ---
  const markAsReceived = async (item: StockItem) => {
    try {
      const branch = await resolveBranchId();
      if (!branch) { Alert.alert('Error', 'No branch assigned'); return; }
      await api.post(`/products/${item.id}/toggle-received`, { branch_id: branch });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await loadOngoingStocks();
      Alert.alert('Success', 'Stock marked as received');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update');
    }
  };

  const markAsNotReceived = async (item: StockItem) => {
    try {
      const branch = await resolveBranchId();
      if (!branch) { Alert.alert('Error', 'No branch assigned'); return; }
      await api.post(`/products/${item.id}/toggle-received`, { branch_id: branch });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await loadOngoingStocks();
      Alert.alert('Success', 'Stock marked as not received');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update');
    }
  };

  // --- Collapse preferences ---
  useEffect(() => {
    const loadCollapsePrefs = async () => {
      try {
        const [r, nr] = await Promise.all([
          Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(COLLAPSE_KEY_RECEIVED)) : SecureStore.getItemAsync(COLLAPSE_KEY_RECEIVED),
          Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(COLLAPSE_KEY_NOT_RECEIVED)) : SecureStore.getItemAsync(COLLAPSE_KEY_NOT_RECEIVED),
        ]);
        if (r != null) setCollapsedReceived(r === '1');
        if (nr != null) setCollapsedNotReceived(nr === '1');
      } catch (e) { console.error(e); }
    };
    loadCollapsePrefs();
  }, []);

  const toggleCollapsedReceived = async () => {
    setCollapsedReceived((prev) => {
      const next = !prev;
      if (Platform.OS === 'web') localStorage.setItem(COLLAPSE_KEY_RECEIVED, next ? '1' : '0');
      else SecureStore.setItemAsync(COLLAPSE_KEY_RECEIVED, next ? '1' : '0').catch(e => console.error(e));
      return next;
    });
  };

  const toggleCollapsedNotReceived = async () => {
    setCollapsedNotReceived((prev) => {
      const next = !prev;
      if (Platform.OS === 'web') localStorage.setItem(COLLAPSE_KEY_NOT_RECEIVED, next ? '1' : '0');
      else SecureStore.setItemAsync(COLLAPSE_KEY_NOT_RECEIVED, next ? '1' : '0').catch(e => console.error(e));
      return next;
    });
  };

  // --- Branch resolution on mount ---
  useEffect(() => {
    resolveBranchId().then(() => {
      // Query will run automatically
    });
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  // Reload data when re-authentication completes (network restored after offline login)
  useEffect(() => {
    if (!isReauthenticating && !isOfflineSession) {
      console.log('[POS] Re-authentication complete, reloading data');
      resolveBranchId();
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  }, [isReauthenticating, isOfflineSession]);

  // --- Cart operations ---
  const zoomIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 1.05,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const zoomOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const animateButton = (callback?: () => void) => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start(callback);
  };

  const addOrIncrementCart = (product: StockItem, addQty: number) => {
    const delta = snapQtyToHalfStep(addQty);
    if (delta <= 0) return;

    if (product.quantity <= 0) {
      Alert.alert('Out of Stock', `${product.name} is currently out of stock.`);
      return;
    }

    animateButton();
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      const currentQty = existingItem ? existingItem.quantity : 0;
      const nextQty = snapQtyToHalfStep(currentQty + delta);

      if (nextQty <= 0) return prevCart;

      if (nextQty - Number(product.quantity) > 1e-6) {
        Alert.alert(
          'Insufficient Stock',
          `Only ${formatQtyForDisplay(product.quantity)} ${product.name} available in stock.`
        );
        return prevCart;
      }

      setQtyInputs((prev) => ({
        ...prev,
        [product.id]: formatQtyForDisplay(nextQty),
      }));

      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [...prevCart, { ...product, quantity: nextQty }];
    });

    console.log('[POS CART] addOrIncrementCart', product.id, product.name, 'delta', delta);
    setOrderModalVisible(true);
  };

  const addToCart = (product: StockItem) => addOrIncrementCart(product, 1);

  const updateQuantity = (id: string, delta: number) => {
    setCart(prevCart => {
      const item = prevCart.find(item => item.id === id);
      if (!item) return prevCart;

      const product = productsQuery.data?.find(p => p.id === id);
      if (!product) return prevCart;

      const newQuantity = snapQtyToHalfStep(item.quantity + delta);

      setQtyInputs((prev) => ({
        ...prev,
        [id]: formatQtyForDisplay(Math.max(newQuantity, 0)),
      }));

      if (newQuantity > Number(product.quantity) + 1e-6) {
        Alert.alert(
          'Insufficient Stock',
          `Only ${formatQtyForDisplay(product.quantity)} ${product.name} available in stock.`
        );
        return prevCart;
      }

      if (newQuantity <= 0) {
        return prevCart.filter(item => item.id !== id);
      }

      return prevCart.map(item =>
        item.id === id
          ? { ...item, quantity: newQuantity }
          : item
      );
    });
  };

  const setItemQuantity = (id: string, rawValue: string) => {
    let clean = rawValue.replace(/[^\d.]/g, '');
    const firstDot = clean.indexOf('.');
    if (firstDot !== -1) {
      clean =
        clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
    }

    setQtyInputs((prev) => ({ ...prev, [id]: clean }));

    if (clean === '' || clean === '.') return;

    const parsed = parseFloat(clean);
    if (Number.isNaN(parsed)) return;

    const nextQty = snapQtyToHalfStep(parsed);

    setCart(prevCart => {
      const item = prevCart.find(i => i.id === id);
      if (!item) return prevCart;

      const product = productsQuery.data?.find(p => p.id === id);
      const maxQty = Number(product?.quantity ?? item.quantity ?? 0);

      if (nextQty <= 0) {
        return prevCart.filter(i => i.id !== id);
      }

      if (nextQty - maxQty > 1e-6) {
        Alert.alert(
          'Insufficient Stock',
          `Only ${formatQtyForDisplay(maxQty)} ${item.name} available in stock.`
        );
        setQtyInputs((prev) => ({ ...prev, [id]: formatQtyForDisplay(maxQty) }));
        return prevCart.map(i => (i.id === id ? { ...i, quantity: maxQty } : i));
      }

      setQtyInputs((prev) => ({ ...prev, [id]: formatQtyForDisplay(nextQty) }));

      return prevCart.map(i => (i.id === id ? { ...i, quantity: nextQty } : i));
    });
  };

  const commitQtyInput = (id: string) => {
    setQtyInputs((prev) => {
      const raw = prev[id];
      if (raw === '') {
        const current = cart.find((c) => c.id === id);
        return { ...prev, [id]: current ? formatQtyForDisplay(current.quantity) : '1' };
      }
      return prev;
    });
  };

  const toggleHalfPortion = (id: string) => {
    setHalfPortions((prev) => {
      const isNowHalf = !prev[id];
      const targetQty = isNowHalf ? 0.5 : 1;
      console.log('[POS HALF] Toggle half portion for', id, '→', isNowHalf, 'qty', targetQty);

      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.id !== id) return item;
          setQtyInputs((q) => ({ ...q, [id]: formatQtyForDisplay(targetQty) }));
          return { ...item, quantity: targetQty };
        })
      );

      return { ...prev, [id]: isNowHalf };
    });
  };

  const removeFromCart = (id: string, name: string) => {
    Alert.alert(
      'Remove Item',
      `Remove ${name} from cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setCart((prevCart) => prevCart.filter((item) => item.id !== id));
            setHalfPortions((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          },
        }
      ]
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to cart before checking out');
      return;
    }
    if (!cash || Number(cash) < total) {
      Alert.alert('Insufficient Cash', `Please enter at least ₱${total}`);
      return;
    }

    const orderItems = cart.map(item =>
      `${item.name} ×${formatQtyForDisplay(item.quantity)} = ₱${roundMoney(
        item.price * item.quantity
      )}`
    ).join('\n');

    console.log('[POS CHECKOUT] Cart items:', cart);
    console.log('[POS CHECKOUT] Order items string:', orderItems);
    console.log('[POS CHECKOUT] Subtotal:', subtotal);
    console.log('[POS CHECKOUT] Senior discount:', seniorDiscount, 'Discount amount:', discountAmount);
    console.log('[POS CHECKOUT] Total:', total);
    console.log('[POS CHECKOUT] Cash:', cash);
    console.log('[POS CHECKOUT] Change:', change);
    console.log('[POS CHECKOUT] Customer name:', customerName);

    try {
      let user = await loadStaffUser();

      console.log('[POS CHECKOUT] Initial user data:', user);

      if (!user?.id) {
        const connected = await hasNetworkConnection();
        if (connected) {
          try {
            const meResponse = await api.get('/me');
            user = meResponse.data;
            console.log('[POS CHECKOUT] Fetched user from /me:', user);
          } catch (error) {
            console.error('Unable to refresh authenticated user:', error);
          }
        }
      }

      const { user: resolvedUser, branchId: resolvedBranch } = await resolveStaffBranch(user);
      user = resolvedUser ?? user;
      let branch = resolvedBranch;

      console.log('[POS CHECKOUT] Branch ID:', branch);
      console.log('[POS CHECKOUT] Final user ID:', user?.id);

      if (!user?.id || !branch) {
        console.log('[POS CHECKOUT] Missing context - User ID:', user?.id, 'Branch ID:', branch);
        Alert.alert(
          'Missing User Context',
          'Unable to determine staff or branch. Log in online once so your branch is saved on this device.'
        );
        return;
      }

      const salePayload = {
        branch_id: branch,
        user_id: user.id,
        customer_name: customerName || null,
        senior_discount: seniorDiscount,
        cash_collected: Number(cash),
        payment_method: 'cash',
        items: cart.map((item) => ({
          product_id: Number(item.id),
          quantity: snapQtyToHalfStep(item.quantity),
        })),
      };

      const result = await submitOrQueue({
        method: 'POST',
        url: '/sales',
        data: salePayload,
        type: 'sale',
        label: `Sale ₱${total}`,
      });

      const orderSummary = orderItems || 'No items details available';
      const syncNote = result.queued
        ? '\n\n(Saved offline — will sync when online)'
        : '';
      const alertMessage = `${orderSummary}\n\n━━━━━━━━━━━━━━━━\nTotal: ₱${total}\nCash: ₱${cash}\nChange: ₱${change}${syncNote}`;

      console.log('[POS CHECKOUT] Alert message:', alertMessage);

      Alert.alert(
        result.queued ? 'Order Saved Offline' : 'Order Complete!',
        alertMessage,
        [{ text: 'New Order' }]
      );
      if (result.queued) {
        await refreshPendingCount();
      }
      setCart([]);
      setCash('');
      setCustomerName('');
      setSeniorDiscount(false);
      setHalfPortions({});
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (error: any) {
      Alert.alert('Checkout Failed', error?.response?.data?.message || 'Failed to save sale to backend.');
    }
  };

  const handleCancelOrder = () => {
    if (cart.length === 0) return;
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes', style: 'destructive', onPress: () => {
            setCart([]);
            setCash('');
            setCustomerName('');
            setSeniorDiscount(false);
            setHalfPortions({});
          }
        }
      ]
    );
  };

  const quickAddAmounts = [50, 100, 200, 500, 1000];

  const renderCartItem = ({ item }: { item: typeof cart[0] }) => {
    const isHalf = !!halfPortions[item.id];
    const lineTotal = roundMoney(item.price * item.quantity);

    return (
      <View className="border-b border-gray-100 py-2">
        <View className="flex-row items-center">
          <View className="bg-blue-100 p-2 rounded-full mr-2">
            <Icon name={item.icon} size={14} color="#2563EB" />
          </View>

          <View className="flex-1 mr-2">
            <Text className="font-semibold text-sm text-white" numberOfLines={1}>{item.name}</Text>
            <Text className="text-gray-400 text-[11px]" numberOfLines={1}>
              ₱{item.price} × {formatQtyForDisplay(item.quantity)} ={' '}
              <Text className="text-gray-300 font-bold">₱{lineTotal}</Text>
            </Text>
          </View>

          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => updateQuantity(item.id, -QTY_STEP)}
              className="bg-orange-100 w-7 h-7 rounded-full items-center justify-center"
            >
              <Icon name="remove" size={14} color="#F97316" />
            </TouchableOpacity>
            <View className="bg-gray-800 px-1 py-0.5 rounded-md mx-1 min-w-[40px] items-center">
              <TextInput
                className="font-bold text-sm text-white text-center w-10 py-0"
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                value={qtyInputs[item.id] ?? formatQtyForDisplay(item.quantity)}
                onChangeText={(v) => {
                  setHalfPortions((prev) => ({ ...prev, [item.id]: false }));
                  setItemQuantity(item.id, v);
                }}
                onBlur={() => commitQtyInput(item.id)}
              />
            </View>
            <TouchableOpacity
              onPress={() => updateQuantity(item.id, QTY_STEP)}
              className="bg-green-100 w-7 h-7 rounded-full items-center justify-center"
            >
              <Icon name="add" size={14} color="#10B981" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => removeFromCart(item.id, item.name)}
            className="bg-red-900/30 p-1.5 rounded-lg ml-2"
          >
            <Icon name="delete" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => toggleHalfPortion(item.id)}
          activeOpacity={0.75}
          className={`self-start mt-1.5 ml-9 flex-row items-center px-2 py-1 rounded-lg border ${isHalf ? 'bg-amber-100 border-amber-300' : 'bg-gray-100 border-gray-300'
            }`}
        >
          <View
            className={`w-3.5 h-3.5 rounded-sm items-center justify-center mr-1.5 border ${isHalf ? 'bg-amber-500 border-amber-500' : 'bg-gray-300 border-gray-400'
              }`}
          >
            {isHalf && <Icon name="check" size={10} color="white" />}
          </View>
          <Text className={`font-bold text-[11px] ${isHalf ? 'text-amber-700' : 'text-gray-600'}`}>
            ½ Portion
          </Text>
          {isHalf && (
            <View className="ml-1.5 bg-amber-200 px-1.5 py-0.5 rounded-full">
              <Text className="text-amber-800 text-[9px] font-bold">½ price</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // --- Computed values ---
  const products = productsQuery.data || [];
  const filtered = selectedCategory === 'All' ? products : products.filter(p => p.category === selectedCategory);
  const hasPending = queryClient.getQueryData(['pendingStock']) || false;
  const subtotal = cart.reduce((sum, item) => sum + roundMoney(item.price * item.quantity), 0);
  const discountAmount = seniorDiscount ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const total = Math.max(subtotal - discountAmount, 0);
  const change = cash ? Math.max(Number(cash) - total, 0) : 0;

  // --- Loading / error states ---
  if (productsQuery.isLoading || !branchId) {
    return (
      <View className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="text-lg text-gray-400 mt-4">Loading POS System...</Text>
        {isOfflineSession && (
          <Text className="text-sm text-gray-500 mt-2">Offline mode - using cached data</Text>
        )}
      </View>
    );
  }
  if (productsQuery.isError) {
    return (
      <View className="flex-1 justify-center items-center bg-black px-6">
        <Text className="text-lg text-green-400">Failed to load products</Text>
        {isOfflineSession && (
          <Text className="text-sm text-gray-500 mt-2 text-center">
            No cached products available. Please connect to internet and load products first.
          </Text>
        )}
        <TouchableOpacity onPress={() => productsQuery.refetch()} className="mt-4 bg-green-600 px-4 py-2 rounded-lg">
          <Text className="text-white font-bold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- JSX ---
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1">
        <ScrollView
          className="flex-1 bg-black"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await productsQuery.refetch();
                setRefreshing(false);
              }}
              colors={['#10B981']}
              tintColor="#10B981"
            />
          }
        >
          <StatusBar style="dark" />

          <Animated.View className="flex-1" style={{ opacity: fadeAnim }}>
            {/* HEADER */}
            <View className="pt-12 pb-10 px-6 rounded-b-3xl shadow-lg" style={{ backgroundColor: '#10B981' }}>
              <View className="flex-row items-center justify-center mb-2">
                <Icon name="restaurant" size={32} color="white" />
                <Text className="text-3xl font-bold text-white ml-2">
                  New Moon Lechon
                </Text>
              </View>
              <Text className="text-center text-green-200 text-sm font-medium">
                Point of Sales System
              </Text>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              className="flex-1"
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
              <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1, minHeight: screenHeight, paddingBottom: Math.max(120, insets.bottom + 100) }}
                keyboardShouldPersistTaps="handled"
              >
                <View className="p-5">
                  {/* Ongoing Stocks Button */}
                  <TouchableOpacity
                    onPress={loadOngoingStocks}
                    className="bg-blue-600 py-3 px-4 rounded-xl mb-4 shadow-md"
                  >
                    <View className="flex-row items-center justify-center relative">
                      <Icon name="inventory" size={20} color="white" />
                      <Text className="text-white font-bold text-base ml-2">Ongoing Stocks</Text>
                      {hasPending && (
                        <View
                          style={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: '#EF4444',
                            borderWidth: 2,
                            borderColor: 'rgba(255,255,255,0.9)',
                          }}
                        />
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Category Filter - Only "All" category */}
                  <View className="mb-6">
                    <ScrollView
                      ref={categoryScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="flex-row"
                      contentContainerStyle={{ paddingRight: 16 }}
                    >
                      {categories.map((category) => (
                        <TouchableOpacity
                          key={category}
                          onPress={() => setSelectedCategory(category)}
                          className={`px-5 py-3 rounded-xl mr-3 shadow-sm border ${selectedCategory === category ? 'bg-green-600 border-green-700' : 'bg-gray-900 border-gray-800'
                            }`}
                        >
                          <Text className={`font-semibold text-sm ${selectedCategory === category ? 'text-white' : 'text-gray-300'
                            }`}>
                            All Items
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Menu Grid */}
                  <View className="bg-gray-900 rounded-2xl p-5 mb-4 shadow-sm border border-gray-800">
                    <View className="flex-row items-center justify-between mb-5">
                      <View className="flex-row items-center">
                        <Icon name="restaurant-menu" size={24} color="#10B981" />
                        <Text className="font-bold text-xl ml-2 text-white">Menu</Text>
                      </View>
                      <Text className="text-gray-400 text-sm">{filtered.length} items</Text>
                    </View>
                    <FlatList
                      data={filtered}
                      keyExtractor={(item) => item.id}
                      numColumns={2}
                      scrollEnabled={false}
                      columnWrapperStyle={{ justifyContent: 'space-between', gap: 12 }}
                      contentContainerStyle={{ paddingBottom: 8 }}
                      renderItem={({ item }) => (
                        <View className="w-[48%] mb-4">
                          <TouchableOpacity
                            onPress={() => addToCart(item)}
                            className={`p-4 rounded-2xl items-center shadow-sm border ${item.quantity <= 0 ? 'bg-gray-800 opacity-50 border-gray-700' : 'bg-gray-900 border-gray-800'
                              }`}
                            activeOpacity={item.quantity <= 0 ? 1 : 0.7}
                            disabled={item.quantity <= 0}
                          >
                            {item.popular && item.quantity > 0 && (
                              <View className="absolute top-2 right-2 bg-orange-500 px-2 py-1 rounded-full flex-row items-center">
                                <Icon name="local-fire-department" size={10} color="white" />
                                <Text className="text-white text-[10px] font-bold ml-1">BESTSELLER</Text>
                              </View>
                            )}
                            {item.quantity <= 0 && (
                              <View className="absolute top-2 right-2 bg-red-500 px-2 py-1 rounded-full">
                                <Text className="text-white text-[10px] font-bold">OUT OF STOCK</Text>
                              </View>
                            )}
                            <View className="bg-green-900/30 p-4 rounded-full mb-3">
                              <Icon name={item.icon} size={28} color="#10B981" />
                            </View>
                            <Text className="font-bold text-center text-base text-white mb-1" numberOfLines={2}>{item.name}</Text>
                            <Text className="text-gray-400 text-xs text-center mb-3" numberOfLines={1}>{item.description}</Text>
                            <View className="bg-green-900/30 px-3 py-1 rounded-full">
                              <Text className="text-green-400 font-bold text-lg">₱{item.price}</Text>
                            </View>
                            {item.quantity <= 10 && item.quantity > 0 && (
                              <View className="flex-row items-center mt-2">
                                <Icon name="warning" size={12} color="#F59E0B" />
                                <Text className="text-orange-500 text-xs ml-1">
                                  Only {formatQtyForDisplay(item.quantity)} left!
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          {item.quantity > 0 && (
                            <TouchableOpacity
                              onPress={() => addOrIncrementCart(item, QTY_STEP)}
                              className="mt-2 bg-amber-50 border border-amber-200 py-2 rounded-xl items-center"
                              activeOpacity={0.7}
                            >
                              <Text className="text-amber-900 font-bold text-sm">+ ½</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    />
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </ScrollView>

        {/* Floating Cart Button */}
        {cart.length > 0 && (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom + 16, 16) }}>
            <TouchableOpacity
              onPress={() => setOrderModalVisible(true)}
              className="bg-red-600 py-4 rounded-2xl shadow-lg"
              activeOpacity={0.85}
            >
              <View className="flex-row items-center justify-between px-5">
                <View className="flex-row items-center">
                  <View className="bg-white/20 p-2 rounded-xl mr-3">
                    <Icon name="shopping-cart" size={18} color="white" />
                  </View>
                  <View>
                    <Text className="text-white font-bold text-base">View Order</Text>
                    <Text className="text-white/80 text-xs">{cart.length} item(s)</Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-white font-bold text-lg mr-2">₱{total}</Text>
                  <Icon name="chevron-right" size={24} color="white" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Order Summary Modal */}
        <Modal
          visible={orderModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setOrderModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 bg-black/50 justify-end">
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View className="bg-white rounded-t-3xl h-[96%]">
                  {/* Header – stays green */}
                  <View className="px-4 py-3 rounded-t-3xl flex-row justify-between items-center" style={{ backgroundColor: '#10B981' }}>
                    <View className="flex-row items-center">
                      <Icon name="receipt-long" size={22} color="white" />
                      <Text className="text-white font-bold text-lg ml-2">Order Summary</Text>
                    </View>
                    <TouchableOpacity onPress={() => setOrderModalVisible(false)}>
                      <Icon name="close" size={26} color="white" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-1">
                    {cart.length > 0 && (
                      <View className="px-4 pt-3 pb-2 flex-row justify-between items-center">
                        <View className="bg-red-100 px-3 py-1 rounded-full">
                          <Text className="text-red-600 text-xs font-semibold">
                            {cart.length} {cart.length === 1 ? 'item' : 'items'}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={handleCancelOrder} className="bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                          <View className="flex-row items-center">
                            <Icon name="delete-sweep" size={16} color="#DC2626" />
                            <Text className="text-red-600 font-bold text-xs ml-1">Clear</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}

                    <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
                      {cart.length === 0 ? (
                        <View className="py-14 items-center">
                          <View className="bg-gray-100 p-4 rounded-full mb-4">
                            <Icon name="shopping-cart" size={40} color="#9CA3AF" />
                          </View>
                          <Text className="text-gray-500 text-center font-medium">Your cart is empty</Text>
                          <Text className="text-gray-400 text-xs text-center mt-1">Tap on items to add</Text>
                        </View>
                      ) : (
                        <>
                          <View className="flex-row items-center mb-2 gap-2">
                            <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-xl">
                              <View className="px-2">
                                <Icon name="person" size={16} color="#6B7280" />
                              </View>
                              <TextInput
                                className="flex-1 py-2 pr-2 text-sm text-gray-800"
                                placeholder="Customer name"
                                placeholderTextColor="#9CA3AF"
                                value={customerName}
                                onChangeText={setCustomerName}
                              />
                            </View>
                            <TouchableOpacity
                              onPress={() => setSeniorDiscount((p) => !p)}
                              activeOpacity={0.85}
                              className={`flex-row items-center px-2.5 py-2 rounded-xl border ${seniorDiscount ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                              <View
                                className={`w-4 h-4 rounded-sm items-center justify-center mr-1.5 border ${seniorDiscount ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'
                                  }`}
                              >
                                {seniorDiscount && <Icon name="check" size={11} color="white" />}
                              </View>
                              <Text className={`text-[11px] font-bold ${seniorDiscount ? 'text-green-700' : 'text-gray-600'}`}>
                                Senior 20%
                              </Text>
                              {seniorDiscount && (
                                <Text className="text-green-700 text-[11px] font-bold ml-1">-₱{discountAmount}</Text>
                              )}
                            </TouchableOpacity>
                          </View>

                          <View className="bg-white rounded-2xl px-3 pt-1 pb-2 mb-3 border border-gray-200">
                            {cart.map((item) => (
                              <View key={item.id}>
                                {renderCartItem({ item })}
                              </View>
                            ))}
                          </View>
                          <View style={{ height: 8 }} />
                        </>
                      )}
                    </ScrollView>

                    {cart.length > 0 && (
                      <View className="px-3 pt-2 border-t border-gray-200" style={{ paddingBottom: Math.max(10, insets.bottom + 8) }}>
                        <View className="bg-green-500 px-3 py-2 rounded-xl mb-2 flex-row justify-between items-center">
                          <View>
                            <Text className="text-white/90 text-[10px] font-semibold uppercase tracking-wider">Total</Text>
                            <Text className="text-white font-bold text-xl">₱{total}</Text>
                          </View>
                          {seniorDiscount ? (
                            <Text className="text-white/90 text-[11px]">-₱{discountAmount} of ₱{subtotal}</Text>
                          ) : null}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" nestedScrollEnabled={true}>
                          <View className="flex-row">
                            {quickAddAmounts.map((amount) => (
                              <TouchableOpacity
                                key={amount}
                                onPress={() => setCash(amount.toString())}
                                className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg mr-2"
                              >
                                <Text className="text-red-600 font-bold text-xs">₱{amount}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>

                        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                          <View className="flex-row items-center bg-white border-2 border-gray-300 rounded-xl">
                            <View className="bg-red-600 px-2.5 py-2 rounded-l-xl">
                              <Icon name="attach-money" size={16} color="white" />
                            </View>
                            <TextInput
                              className="flex-1 px-3 py-2 text-sm text-gray-800"
                              placeholder="Cash amount"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="numeric"
                              value={cash.toString()}
                              onChangeText={(value) => setCash(value)}
                              onFocus={zoomIn}
                              onBlur={zoomOut}
                            />
                            {cash && Number(cash) >= total && (
                              <View className="bg-green-500 px-3 py-2 rounded-r-xl">
                                <Text className="text-white font-bold text-xs">Change ₱{change}</Text>
                              </View>
                            )}
                          </View>
                        </Animated.View>

                        {cash && Number(cash) < total && Number(cash) > 0 && (
                          <View className="bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg mt-2 flex-row items-center justify-center">
                            <Icon name="error-outline" size={14} color="#DC2626" />
                            <Text className="text-red-600 text-xs ml-1.5 font-medium">
                              Need ₱{total - Number(cash)} more
                            </Text>
                          </View>
                        )}

                        <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
                          <TouchableOpacity
                            onPress={handleCheckout}
                            className="bg-green-500 py-3 mt-2 rounded-xl items-center shadow-lg flex-row justify-center"
                            activeOpacity={0.85}
                          >
                            <Icon name="check-circle" size={18} color="white" />
                            <Text className="text-white font-bold text-sm ml-2">Complete Order</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      </View>
                    )}
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Ongoing Stocks Modal */}
        <Modal
          visible={ongoingStocksModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setOngoingStocksModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setOngoingStocksModalVisible(false)}>
            <View className="flex-1 bg-black/50 justify-end">
              <TouchableWithoutFeedback>
                <View className="bg-white rounded-t-3xl h-[90%]">
                  {/* Header */}
                  <View className="px-4 py-3 rounded-t-3xl flex-row justify-between items-center" style={{ backgroundColor: '#10B981' }}>
                    <View className="flex-row items-center">
                      <Icon name="inventory" size={22} color="white" />
                      <Text className="text-white font-bold text-lg ml-2">Ongoing Stocks</Text>
                    </View>
                    <TouchableOpacity onPress={() => setOngoingStocksModalVisible(false)}>
                      <Icon name="close" size={26} color="white" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
                    {ongoingStocks.length === 0 ? (
                      <View className="py-14 items-center">
                        <View className="bg-gray-100 p-4 rounded-full mb-4">
                          <Icon name="inventory" size={40} color="#9CA3AF" />
                        </View>
                        <Text className="text-gray-500 text-center font-medium">No ongoing stocks</Text>
                        <Text className="text-gray-400 text-xs text-center mt-1">All deliveries have been received</Text>
                      </View>
                    ) : (
                      <>
                        {/* Received Section */}
                        {ongoingStocks.some(item => 
                          (item.ongoing_stocks || []).some(d => d.received_at)
                        ) && (
                          <View className="mb-4">
                            <TouchableOpacity
                              onPress={toggleCollapsedReceived}
                              className="flex-row justify-between items-center bg-green-50 px-3 py-2 rounded-xl mb-2"
                            >
                              <View className="flex-row items-center">
                                <Icon name="check-circle" size={18} color="#10B981" />
                                <Text className="text-green-700 font-bold text-sm ml-2">Received</Text>
                                <Text className="text-green-600 text-xs ml-2 bg-green-100 px-2 py-0.5 rounded-full">
                                  {ongoingStocks.filter(item => 
                                    (item.ongoing_stocks || []).some(d => d.received_at)
                                  ).length}
                                </Text>
                              </View>
                              <Icon 
                                name={collapsedReceived ? "chevron-right" : "expand-more"} 
                                size={20} 
                                color="#10B981" 
                              />
                            </TouchableOpacity>
                            
                            {!collapsedReceived && (
                              <View className="ml-2">
                                {ongoingStocks
                                  .filter(item => 
                                    (item.ongoing_stocks || []).some(d => d.received_at)
                                  )
                                  .map((item) => {
                                    const receivedStocks = (item.ongoing_stocks || []).filter(d => d.received_at);
                                    return (
                                      <View key={item.id} className="bg-gray-50 rounded-xl p-3 mb-2 border border-green-100">
                                        <View className="flex-row justify-between items-start">
                                          <View className="flex-1">
                                            <Text className="text-gray-800 font-bold text-sm">{item.name}</Text>
                                            <Text className="text-gray-500 text-xs">{item.category}</Text>
                                          </View>
                                          <View className="bg-green-100 px-2 py-0.5 rounded-full">
                                            <Text className="text-green-700 text-xs font-bold">Received</Text>
                                          </View>
                                        </View>
                                        <View className="flex-row justify-between items-center mt-2">
                                          <View className="flex-row gap-6">
                                            <View>
                                              <Text className="text-gray-500 text-[10px]">Quantity</Text>
                                              <Text className="text-gray-800 font-bold text-sm">
                                                {receivedStocks.reduce((sum, d) => sum + Number(d.quantity || 0), 0)}
                                              </Text>
                                            </View>
                                            <View>
                                              <Text className="text-gray-500 text-[10px]">Current Stock</Text>
                                              <Text className="text-gray-800 font-bold text-sm">{item.quantity}</Text>
                                            </View>
                                          </View>
                                          {item.lastDeliveryAt && (
                                            <Text className="text-gray-400 text-[10px]">
                                              {new Date(item.lastDeliveryAt).toLocaleDateString()}
                                            </Text>
                                          )}
                                        </View>
                                      </View>
                                    );
                                  })}
                              </View>
                            )}
                          </View>
                        )}

                        {/* Not Received Section */}
                        {ongoingStocks.some(item => 
                          (item.ongoing_stocks || []).some(d => !d.received_at)
                        ) && (
                          <View className="mb-4">
                            <TouchableOpacity
                              onPress={toggleCollapsedNotReceived}
                              className="flex-row justify-between items-center bg-orange-50 px-3 py-2 rounded-xl mb-2"
                            >
                              <View className="flex-row items-center">
                                <Icon name="pending" size={18} color="#F97316" />
                                <Text className="text-orange-700 font-bold text-sm ml-2">Not Received</Text>
                                <Text className="text-orange-600 text-xs ml-2 bg-orange-100 px-2 py-0.5 rounded-full">
                                  {ongoingStocks.filter(item => 
                                    (item.ongoing_stocks || []).some(d => !d.received_at)
                                  ).length}
                                </Text>
                              </View>
                              <Icon 
                                name={collapsedNotReceived ? "chevron-right" : "expand-more"} 
                                size={20} 
                                color="#F97316" 
                              />
                            </TouchableOpacity>
                            
                            {!collapsedNotReceived && (
                              <View className="ml-2">
                                {ongoingStocks
                                  .filter(item => 
                                    (item.ongoing_stocks || []).some(d => !d.received_at)
                                  )
                                  .map((item) => {
                                    const pendingStocks = (item.ongoing_stocks || []).filter(d => !d.received_at);
                                    return (
                                      <View key={item.id} className="bg-gray-50 rounded-xl p-3 mb-2 border border-orange-100">
                                        <View className="flex-row justify-between items-start">
                                          <View className="flex-1">
                                            <Text className="text-gray-800 font-bold text-sm">{item.name}</Text>
                                            <Text className="text-gray-500 text-xs">{item.category}</Text>
                                          </View>
                                          <View className="bg-orange-100 px-2 py-0.5 rounded-full">
                                            <Text className="text-orange-700 text-xs font-bold">Pending</Text>
                                          </View>
                                        </View>
                                        <View className="flex-row justify-between items-center mt-2">
                                          <View className="flex-row gap-6">
                                            <View>
                                              <Text className="text-gray-500 text-[10px]">Pending Qty</Text>
                                              <Text className="text-orange-600 font-bold text-sm">
                                                {pendingStocks.reduce((sum, d) => sum + Number(d.quantity || 0), 0)}
                                              </Text>
                                            </View>
                                            <View>
                                              <Text className="text-gray-500 text-[10px]">Current Stock</Text>
                                              <Text className="text-gray-800 font-bold text-sm">{item.quantity}</Text>
                                            </View>
                                          </View>
                                          <TouchableOpacity
                                            onPress={() => markAsReceived(item)}
                                            className="bg-green-500 px-3 py-1.5 rounded-lg"
                                          >
                                            <View className="flex-row items-center">
                                              <Icon name="check" size={14} color="white" />
                                              <Text className="text-white font-bold text-xs ml-1">Receive</Text>
                                            </View>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    );
                                  })}
                              </View>
                            )}
                          </View>
                        )}
                      </>
                    )}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}