import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    SafeAreaView,
    Modal,
    Pressable,
} from 'react-native';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../lib/api';
import { useAuth } from '../../../context/authContext';
import { hasNetworkConnection, isAuthError, isNetworkError } from '../../../lib/network';
import { getCachedProducts } from '../../../lib/dataCache';
import { getUser as getStoredUserFromStorage } from '../../../lib/userStorage';
import { resolveStaffBranch } from '../../../lib/staffContext';

const { width } = Dimensions.get('window');

type StockStatus = 'Low Stock' | 'In Stock' | 'Out of Stock';

type StockItem = {
  id: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  price: number;
  minStock: number;
  status: StockStatus;
  product_stocks?: { id: string; branch_id: string | number; quantity: number; minimum_stock: number; received: boolean; branch?: { id: string; name?: string } }[];
  icon?: string;
  description?: string;
  popular?: boolean;
  received?: boolean;
  branchStock?: { id: string; branch_id: string | number; quantity: number; minimum_stock: number; received: boolean };
};

const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value: any) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const getBranchIdFromUser = (user: any) => {
  if (!user) return null;

  // Some login flows store `{ user: {...}, token, role }`
  const u = user?.user ? user.user : user;

  if (!u) return null;
  if (u.branch_id) return u.branch_id;
  if (u.branchId) return u.branchId;
  if (u.branch?.id) return u.branch.id;

  // Accept both snake_case and camelCase arrays
  const assignments = Array.isArray(u.branch_assignments)
    ? u.branch_assignments
    : Array.isArray(u.branchAssignments)
      ? u.branchAssignments
      : [];

  const activeAssignment = assignments.find((a: any) => a?.is_active) || assignments[0];
  return (
    activeAssignment?.branch_id ||
    activeAssignment?.branch?.id ||
    activeAssignment?.branch?.branch_id ||
    activeAssignment?.id ||
    null
  );
};

const idsEqual = (a: any, b: any) => String(a ?? '') === String(b ?? '');

const resolveBranchId = async () => {
  const userRaw = Platform.OS === 'web'
    ? localStorage.getItem('user')
    : await SecureStore.getItemAsync('user');
  let user = userRaw ? JSON.parse(userRaw) : null;
  // Normalize stored payloads like `{ user: {...} }`
  if (user?.user) user = user.user;

  let branchId = getBranchIdFromUser(user);
  if (branchId) {
    console.log('[DASHBOARD] Branch ID from storage user:', branchId);
    return branchId;
  }

  const connected = await hasNetworkConnection();
  if (!connected) {
    console.log('[DASHBOARD] Offline - cannot fetch branch ID from API');
    return null;
  }

  try {
    const response = await api.get('me');
    if (response.data) {
      user = response.data;
      if (Platform.OS === 'web') {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        await SecureStore.setItemAsync('user', JSON.stringify(user));
      }
    }
    branchId = getBranchIdFromUser(user);
    if (branchId) {
      console.log('[DASHBOARD] Branch ID from /me:', branchId);
      return branchId;
    }
  } catch (error: any) {
    console.error('[DASHBOARD] Unable to fetch /me:', error);
    // Check if this is a network error or 401 while offline
    const isNetworkErr = error.code === 'ERR_NETWORK' || 
                         error.code === 'ECONNABORTED' ||
                         error.message?.includes('Network Error') ||
                         error.message?.includes('timeout');
    const is401 = error.response?.status === 401;
    const isOffline = !await hasNetworkConnection();
    
    if (isNetworkErr || (is401 && isOffline)) {
      console.log('[DASHBOARD] Network error or offline - skipping /me call');
    }
  }

  if (user?.id) {
    try {
      console.log('[DASHBOARD] Fallback: fetching staff by user ID', user.id);
      const staffResponse = await api.get(`staff/${user.id}`);
      const staffData = staffResponse.data;
      branchId = getBranchIdFromUser(staffData);
      if (branchId) {
        if (Platform.OS === 'web') {
          localStorage.setItem(
            'user',
            JSON.stringify({ ...user, branch_id: branchId, branchAssignments: staffData?.branchAssignments })
          );
        } else {
          await SecureStore.setItemAsync(
            'user',
            JSON.stringify({ ...user, branch_id: branchId, branchAssignments: staffData?.branchAssignments })
          );
        }
        console.log('[DASHBOARD] Branch ID from staff endpoint:', branchId);
        return branchId;
      }
    } catch (error: any) {
      console.error('[DASHBOARD] Unable to fetch staff assignment:', error);
      // Check if this is a network error or 401 while offline
      const isNetworkErr = error.code === 'ERR_NETWORK' || 
                           error.code === 'ECONNABORTED' ||
                           error.message?.includes('Network Error') ||
                           error.message?.includes('timeout');
      const is401 = error.response?.status === 401;
      const isOffline = !await hasNetworkConnection();
      
      if (isNetworkErr || (is401 && isOffline)) {
        console.log('[DASHBOARD] Network error or offline - skipping staff endpoint call');
      }
    }
  }

  console.log('[DASHBOARD] No branch ID resolved');
  return null;
};

const getSaleDate = (sale: any) => {
  const rawDate = sale?.sale_date || sale?.created_at || '';
  if (typeof rawDate !== 'string') return '';
  const match = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const sumSalesTotal = (sales: any[] = []) => {
  if (!Array.isArray(sales)) {
    console.warn('[DASHBOARD] sumSalesTotal received non-array:', sales);
    return 0;
  }
  return sales.reduce((sum, sale) => sum + Number(sale?.total || 0), 0);
};

const getStoredUser = async () => {
  const stored = await getStoredUserFromStorage();
  if (stored) return stored;

  const connected = await hasNetworkConnection();
  if (!connected) {
    return null;
  }

  try {
    const response = await api.get('me');
    if (response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    if (isAuthError(error) || isNetworkError(error)) {
      console.log('[DASHBOARD] Could not refresh user from API');
    } else {
      console.error('Unable to load dashboard user:', error);
    }
    return null;
  }
};

const loadCachedStockForBranch = async (branchId: string | number | null): Promise<StockItem[]> => {
  const cached = await getCachedProducts<any>();
  if (!cached) return [];

  const productsData = Array.isArray(cached) ? cached : cached?.data ?? [];
  return productsData
    .map((item: any) => {
      const branchStock = (item.product_stocks || []).find((s: any) =>
        idsEqual(s.branch_id, branchId)
      );
      const quantity = Number(branchStock?.quantity ?? 0) || 0;
      const minStock = Number(branchStock?.minimum_stock ?? 0) || 0;
      const status: StockStatus =
        quantity <= 0 ? 'Out of Stock' : quantity <= minStock ? 'Low Stock' : 'In Stock';

      return {
        id: String(item.id),
        name: item.name,
        category: item.category || 'Product',
        type: 'Regular',
        quantity,
        price: Number(item.price || 0),
        minStock,
        status,
        branchStock,
        product_stocks: item.product_stocks,
      };
    })
    .filter((row: StockItem) => {
      if (!branchId) return true;
      return row.branchStock != null;
    });
};

const DashboardScreen = () => {
  const router = useRouter();
  const { isReauthenticating, isOfflineSession } = useAuth();
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grossSales, setGrossSales] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [todaySalesList, setTodaySalesList] = useState<any[]>([]);
  const [salesTodayModalVisible, setSalesTodayModalVisible] = useState(false);
  const [salesTodayPage, setSalesTodayPage] = useState(1);
  const SALES_TODAY_PAGE_SIZE = 4;
  const [user, setUser] = useState<any>(null);

  const loadDashboardData = async () => {
    try {
      const connected = await hasNetworkConnection();

      if (!connected || isOfflineSession) {
        console.log('[DASHBOARD] Offline session - using cached data only');
        const { branchId } = await resolveStaffBranch();
        const cachedStock = await loadCachedStockForBranch(branchId);
        setStockData(cachedStock);
        setGrossSales(0);
        setTodaySales(0);
        setTodaySalesList([]);
        setSalesTodayPage(1);
        return;
      }

      const today = formatLocalDate();
      const monthStart = formatLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const monthEnd = formatLocalDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
      const nextMonthStart = formatLocalDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
      const branchId = await resolveBranchId();
      const branchParams = branchId ? { branch_id: branchId } : {};

      const [productsRes, summaryRes] = await Promise.all([
        api.get('products'),
        api.get('sales', { params: { ...branchParams, date: today } }),
      ]);
      const monthlySalesRes = await api.get('sales', {
        params: { ...branchParams, start_date: monthStart, end_date: nextMonthStart },
      });

      console.log('[DASHBOARD] Sales API responses:', {
        summaryRes: summaryRes?.data,
        monthlySalesRes: monthlySalesRes?.data
      });

      const productsData = Array.isArray(productsRes?.data) ? productsRes.data : (productsRes?.data?.data || []);
      const mappedStock: StockItem[] = productsData
        .map((item: any) => {
          const branchStock = (item.product_stocks || []).find((s: any) =>
            idsEqual(s.branch_id, branchId)
          );

          const quantity = Number(branchStock?.quantity ?? 0) || 0;
          const minStock = Number(branchStock?.minimum_stock ?? 0) || 0;
          const status: StockStatus =
            quantity <= 0 ? 'Out of Stock' : quantity <= minStock ? 'Low Stock' : 'In Stock';

          return {
            id: String(item.id),
            name: item.name,
            category: item.category || 'Product',
            type: 'Regular',
            quantity,
            price: Number(item.price || 0),
            minStock,
            status,
            branchStock,
            product_stocks: item.product_stocks,
          };
        })
        // Only list products that have a stock row for this branch. Otherwise every
        // catalog item appears with quantity 0 (looks like "other branch" inventory).
        .filter((row: StockItem) => {
          if (!branchId) return true;
          return row.branchStock != null;
        });

      console.log('[DASHBOARD] Stock list filtered by branch', {
        branchId,
        totalProducts: productsData.length,
        shownForBranch: mappedStock.length,
      });

      setStockData(mappedStock);

      const summaryData = Array.isArray(summaryRes?.data) ? summaryRes.data : (summaryRes?.data?.data || []);
      const todaySalesTotal = sumSalesTotal(summaryData);
      setTodaySalesList(summaryData);
      setSalesTodayPage(1);
      
      const monthlyData = Array.isArray(monthlySalesRes?.data) ? monthlySalesRes.data : (monthlySalesRes?.data?.data || []);
      const monthSalesTotal = sumSalesTotal(
        monthlyData.filter((sale: any) => {
          const saleDate = getSaleDate(sale);
          return saleDate >= monthStart && saleDate <= monthEnd;
        })
      );

      setGrossSales(monthSalesTotal);
      setTodaySales(todaySalesTotal);
    } catch (error: any) {
      if (isAuthError(error) || isNetworkError(error)) {
        console.log('[DASHBOARD] API unavailable - falling back to cached data');
        const { branchId } = await resolveStaffBranch();
        const cachedStock = await loadCachedStockForBranch(branchId);
        setStockData(cachedStock);
      } else {
        console.error('Error loading dashboard data:', error);
        setStockData([]);
      }
      setGrossSales(0);
      setTodaySales(0);
      setTodaySalesList([]);
      setSalesTodayPage(1);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadDashboardData();
    loadUserData();
  }, [isOfflineSession]);

  // Reload data when re-authentication completes (network restored after offline login)
  useEffect(() => {
    if (!isReauthenticating && !isOfflineSession) {
      console.log('[DASHBOARD] Re-authentication complete, reloading data');
      loadDashboardData();
      loadUserData();
    }
  }, [isReauthenticating, isOfflineSession]);

  const loadUserData = async () => {
    const userData = await getStoredUser();
    setUser(userData);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getTotalStock = () => {
    return stockData.reduce((sum, item) => sum + Number(item.quantity), 0);
  };

  /** Returns e.g. "7.5" → "7 ½"  or  "8" → "8" */
  const formatStockQty = (qty: number): { whole: string; hasHalf: boolean } => {
    const n = Math.round(Number(qty) * 2) / 2;
    const whole = Math.floor(n);
    const hasHalf = Math.abs(n - whole - 0.5) < 0.001;
    return { whole: String(whole), hasHalf };
  };

  const getLowStockCount = () => {
    return stockData.filter(item => item.status === 'Low Stock').length;
  };

  const getTotalValue = () => {
    return stockData.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <View className="bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800" style={{ width: width * 0.28, minHeight: 140 }}>
      <View className={`${color} p-3 rounded-xl w-10 h-10 mb-3 items-center justify-center shadow-sm`}>
        <Icon name={icon} size={18} color="white" />
      </View>
      <Text className="text-xl font-bold text-white mb-1" numberOfLines={1}>{value}</Text>
      <Text className="text-gray-400 text-xs font-medium leading-tight" numberOfLines={2}>{title}</Text>
    </View>
  );

  const SaleRow = ({ sale }: { sale: any }) => {
    const cash = Number(sale?.cash_collected || 0);
    const change = Number(sale?.change_given ?? sale?.changeGiven ?? 0);
    const total = Number(sale?.total || 0);
    const invoice = sale?.invoice_number || `INV-${sale?.id || '-'}`;
    const hasSenior = Boolean(sale?.senior_discount);
    const discountAmount = Number(sale?.discount_amount || 0);
    const customer = sale?.customer_name || '-';

    return (
      <View className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-800">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <Text className="text-white font-bold text-base">{invoice}</Text>
            <Text className="text-gray-400 text-xs mt-0.5">{formatDateTime(sale?.created_at || sale?.sale_date)}</Text>
            <Text className="text-gray-400 text-xs mt-0.5">Customer: {customer}</Text>
          </View>
          <View className="items-end">
            <Text className="text-green-400 font-extrabold text-lg">₱{total.toLocaleString()}</Text>
            {hasSenior && (
              <Text className="text-emerald-400 text-xs font-bold">Senior: -₱{discountAmount.toLocaleString()}</Text>
            )}
          </View>
        </View>

        <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-800">
          <View className="flex-1 items-center">
            <Text className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Cash</Text>
            <Text className="text-white font-bold">₱{cash.toLocaleString()}</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Change</Text>
            <Text className="text-white font-bold">₱{change.toLocaleString()}</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Payment</Text>
            <Text className="text-white font-bold">{String(sale?.payment_method || 'cash').toUpperCase()}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="mt-4 text-white font-medium">Loading Dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} tintColor="#10B981" />
        }
      >
        {/* Header Section */}
        <View className="pt-12 pb-10 px-6 rounded-b-3xl" style={{ backgroundColor: '#10B981' }}>
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="text-white/90 text-xs font-semibold tracking-wide uppercase mb-1">Welcome Back</Text>
              <Text className="text-white text-3xl font-bold">
                {user?.firstname && user?.lastname 
                  ? `${user.firstname} ${user.lastname}` 
                  : 'Staff Member'}
              </Text>
              <Text className="text-white/80 text-sm mt-1">New Moon Lechon House</Text>
            </View>
            <TouchableOpacity className="bg-white/20 p-3 rounded-full">
              <Icon name="notifications-none" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Main Sales Card */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => { setSalesTodayPage(1); setSalesTodayModalVisible(true); }}>
            <View className="bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-800">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-4">
                  <Text className="text-gray-400 text-xs font-semibold tracking-wider uppercase mb-2">Total Sales Today</Text>
                  <Text className="text-white text-5xl font-bold mb-2">₱{todaySales.toLocaleString()}</Text>
                  <Text className="text-gray-500 text-xs">Tap to view checkouts</Text>
                </View>
                <View className="bg-green-900/30 border border-green-800 px-3 py-2 rounded-xl">
                  <View className="flex-row items-center">
                    <Icon name="receipt-long" size={18} color="#10B981" />
                    <Text className="text-green-400 font-bold text-xs ml-1">{todaySalesList.length}</Text>
                  </View>
                </View>
              </View>
              
              <View className="flex-row justify-between items-center pt-4 border-t border-gray-800 mt-4">
                <View>
                  <Text className="text-gray-400 text-xs font-medium">This Month</Text>
                  <Text className="text-white font-bold text-lg">₱{grossSales.toLocaleString()}</Text>
                </View>
                <View>
                  <Text className="text-gray-400 text-xs font-medium">Target</Text>
                  <Text className="text-white font-bold text-lg">₱150,000</Text>
                </View>
                <View className="bg-green-900/30 px-4 py-2 rounded-full border border-green-800">
                  <View className="flex-row items-center">
                    <Icon name="arrow-upward" size={14} color="#10B981" />
                    <Text className="text-green-400 text-sm font-bold ml-1">12%</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View className="px-6 mt-6">
          <Text className="text-white text-xl font-bold mb-4">Inventory Overview</Text>
          <View className="flex-row justify-between gap-2">
            <StatCard 
              title="Total Products" 
              value={stockData.length} 
              icon="restaurant-menu" 
              color="bg-green-600"
            />
            <StatCard
              title={(() => {
                const { whole, hasHalf } = formatStockQty(getTotalStock());
                return hasHalf ? `${whole} ½ stock\navailable` : 'Total Stock';
              })()}
              value={(() => {
                const { whole, hasHalf } = formatStockQty(getTotalStock());
                return hasHalf ? `${whole}.5` : whole;
              })()}
              icon="kitchen"
              color="bg-green-500"
            />
            <StatCard 
              title="Low Stock Items" 
              value={getLowStockCount()} 
              icon="warning" 
              color="bg-yellow-500"
            />
          </View>
        </View>

        {/* Inventory Value Card */}
        <View className="px-6 mt-4 mb-2">
          <View className="bg-gradient-to-r from-purple-900 to-purple-800 rounded-2xl p-5 shadow-lg border border-purple-800">
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-white/90 text-xs font-semibold tracking-wider uppercase mb-1">Total Inventory Value</Text>
                <Text className="text-white text-3xl font-bold">₱{getTotalValue().toLocaleString()}</Text>
                <Text className="text-white/70 text-xs mt-1">Across all products</Text>
              </View>
              <View className="bg-white/20 p-4 rounded-2xl">
                <Icon name="account-balance-wallet" size={24} color="white" />
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions Section */}
        <View className="px-6 mt-6">
          <Text className="text-white text-xl font-bold mb-4">Quick Actions</Text>
          <View className="flex-row justify-between gap-3">
            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => router.push('/Staff/PointOfSales')}
            >
              <View className="bg-green-900/30 p-3 rounded-full mb-2">
                <Icon name="point-of-sale" size={24} color="#10B981" />
              </View>
              <Text className="text-white font-bold text-sm">POS</Text>
              <Text className="text-gray-400 text-xs mt-1">Sell Items</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => router.push('/Staff/Attendance')}
            >
              <View className="bg-green-900/30 p-3 rounded-full mb-2">
                <Icon name="calendar-check" size={24} color="#10B981" />
              </View>
              <Text className="text-white font-bold text-sm">Attendance</Text>
              <Text className="text-gray-400 text-xs mt-1">Time In/Out</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => router.push('/Staff/StockRequest')}
            >
              <View className="bg-purple-900/30 p-3 rounded-full mb-2">
                <Icon name="inventory" size={24} color="#8B5CF6" />
              </View>
              <Text className="text-white font-bold text-sm">Stock</Text>
              <Text className="text-gray-400 text-xs mt-1">Request</Text>
            </TouchableOpacity>
          </View>
          
          <View className="flex-row justify-between gap-3 mt-3">
            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => router.push('/Staff/SalaryAdvance')}
            >
              <View className="bg-orange-900/30 p-3 rounded-full mb-2">
                <Icon name="account-balance-wallet" size={24} color="#F97316" />
              </View>
              <Text className="text-white font-bold text-sm">Cash</Text>
              <Text className="text-gray-400 text-xs mt-1">Advance</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => router.push('/Staff/PullOut')}
            >
              <View className="bg-red-900/30 p-3 rounded-full mb-2">
                <Icon name="delete-outline" size={24} color="#EF4444" />
              </View>
              <Text className="text-white font-bold text-sm">Pull Out</Text>
              <Text className="text-gray-400 text-xs mt-1">Remove Stock</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => router.push('/Staff/Profile')}
            >
              <View className="bg-gray-800 p-3 rounded-full mb-2">
                <Icon name="person" size={24} color="#6B7280" />
              </View>
              <Text className="text-white font-bold text-sm">Profile</Text>
              <Text className="text-gray-400 text-xs mt-1">Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stock Details List */}
        <View className="px-6 mt-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-xl font-bold">Current Stock Levels</Text>
            <Text className="text-gray-400 text-sm">{stockData.length} items</Text>
          </View>
          {stockData.map((item) => (
            <View key={item.id} className="bg-gray-900 rounded-2xl p-4 mb-3 shadow-md border border-gray-800">
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-white font-bold text-lg mb-1" numberOfLines={2}>{item.name}</Text>
                  <Text className="text-gray-400 text-xs" numberOfLines={1}>{item.category} • {item.type}</Text>
                </View>
                <View className={`px-3 py-1 rounded-lg shrink-0 ${
                  item.status === 'Low Stock' ? 'bg-yellow-900/30 border border-yellow-800' : 'bg-green-900/30 border border-green-800'
                }`}>
                  <Text className={`text-xs font-bold ${
                    item.status === 'Low Stock' ? 'text-yellow-400' : 'text-green-400'
                  }`} numberOfLines={1}>
                    {item.status}
                  </Text>
                </View>
              </View>
              
              <View className="flex-row justify-between items-center pt-3 border-t border-gray-800">
                <View className="flex-1 items-center">
                  <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Quantity</Text>
                  {(() => {
                    const { whole, hasHalf } = formatStockQty(item.quantity);
                    return (
                      <View className="items-center">
                        <Text className="text-2xl font-bold text-white">
                          {hasHalf ? `${whole}.5` : whole}
                        </Text>
                        {hasHalf && (
                          <View className="bg-amber-900/30 px-2 py-0.5 rounded-full mt-1 border border-amber-800">
                            <Text className="text-amber-400 text-[10px] font-bold">{whole} ½ stock available</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Price</Text>
                  <Text className="text-lg font-bold text-green-400" numberOfLines={1}>₱{item.price}</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Min. Stock</Text>
                  <Text className="text-lg font-bold text-gray-300" numberOfLines={1}>{item.minStock}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Low Stock Alert Section */}
        {getLowStockCount() > 0 && (
          <View className="px-6 mt-4">
            <View className="bg-yellow-900/30 rounded-xl p-4 border border-yellow-800">
              <View className="flex-row items-center mb-2">
                <Icon name="warning" size={20} color="#F59E0B" />
                <Text className="text-yellow-400 font-bold text-base ml-2">Low Stock Alert!</Text>
              </View>
              <Text className="text-yellow-300 text-sm">
                {getLowStockCount()} item(s) are running low. Please restock soon.
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View className="bg-gray-900 py-4 px-6 border-t border-gray-800 mt-6 mb-4">
          <View className="flex-row justify-center items-center mb-2">
            <Icon name="store" size={14} color="#9CA3AF" />
            <Text className="text-center text-gray-400 text-xs font-medium ml-2">
              New Moon Lechon House - Staff Portal
            </Text>
          </View>
          <Text className="text-center text-gray-500 text-xs">
            Last updated: {new Date().toLocaleString()}
          </Text>
        </View>
      </ScrollView>

      {/* Sales Today Modal */}
      <Modal
        visible={salesTodayModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSalesTodayModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          {/* Backdrop (tap to close) */}
          <Pressable onPress={() => setSalesTodayModalVisible(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}></View>
          </Pressable>

          {/* Sheet */}
          <View className="bg-gray-900 rounded-t-3xl h-[92%]">
                <View className="px-5 py-4 rounded-t-3xl flex-row justify-between items-center" style={{ backgroundColor: '#10B981' }}>
                  <View>
                    <Text className="text-white font-bold text-lg">Sales Today</Text>
                    <Text className="text-white/80 text-xs">{todaySalesList.length} checkout(s)</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSalesTodayModalVisible(false)}>
                    <Icon name="close" size={26} color="white" />
                  </TouchableOpacity>
                </View>

                {(() => {
                  const totalItems = todaySalesList.length;
                  const totalPages = Math.max(1, Math.ceil(totalItems / SALES_TODAY_PAGE_SIZE));
                  const page = Math.min(Math.max(1, salesTodayPage), totalPages);
                  const start = (page - 1) * SALES_TODAY_PAGE_SIZE;
                  const pagedSales = todaySalesList.slice(start, start + SALES_TODAY_PAGE_SIZE);

                  return (
                    <>
                      <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
                  {todaySalesList.length === 0 ? (
                    <View className="py-16 items-center">
                      <View className="bg-gray-800 p-4 rounded-full mb-4">
                        <Icon name="receipt" size={34} color="#9CA3AF" />
                      </View>
                      <Text className="text-gray-400 font-medium">No sales yet for today</Text>
                      <Text className="text-gray-500 text-xs mt-1">Checkouts will appear here after POS orders</Text>
                    </View>
                  ) : (
                    <>
                      <View className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-4">
                        <View className="flex-row justify-between items-center">
                          <View>
                            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total</Text>
                            <Text className="text-white font-extrabold text-2xl">₱{todaySales.toLocaleString()}</Text>
                          </View>
                          <View className="bg-gray-900 border border-gray-700 rounded-2xl px-3 py-2">
                            <Text className="text-gray-300 font-bold text-xs">Date: {formatLocalDate()}</Text>
                          </View>
                        </View>
                      </View>

                      {pagedSales.map((sale) => (
                        <SaleRow key={sale?.id || sale?.invoice_number} sale={sale} />
                      ))}
                    </>
                  )}

                  <View style={{ height: 24 }}></View>
                      </ScrollView>

                      {/* Pagination (4 per page) */}
                      {totalItems > SALES_TODAY_PAGE_SIZE && (
                        <View className="px-5 py-4 border-t border-gray-800 flex-row items-center justify-between">
                          <TouchableOpacity
                            onPress={() => setSalesTodayPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className={`px-4 py-3 rounded-2xl border ${page <= 1 ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-700'}`}
                            activeOpacity={0.85}
                          >
                            <View className="flex-row items-center">
                              <Icon name="chevron-left" size={20} color={page <= 1 ? '#9CA3AF' : '#9CA3AF'} />
                              <Text className={`font-bold ml-1 ${page <= 1 ? 'text-gray-500' : 'text-white'}`}>Prev</Text>
                            </View>
                          </TouchableOpacity>

                          <Text className="text-gray-400 font-semibold">
                            Page {page} / {totalPages}
                          </Text>

                          <TouchableOpacity
                            onPress={() => setSalesTodayPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className={`px-4 py-3 rounded-2xl border ${page >= totalPages ? 'bg-gray-800 border-gray-700' : 'bg-gray-900 border-gray-700'}`}
                            activeOpacity={0.85}
                          >
                            <View className="flex-row items-center">
                              <Text className={`font-bold mr-1 ${page >= totalPages ? 'text-gray-500' : 'text-white'}`}>Next</Text>
                              <Icon name="chevron-right" size={20} color={page >= totalPages ? '#9CA3AF' : '#9CA3AF'} />
                            </View>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default DashboardScreen;
