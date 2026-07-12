import React, { useEffect, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    Modal,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../../lib/api';
import { useAuth } from '../../../../context/authContext';
import { hasNetworkConnection, isAuthError, isNetworkError } from '../../../../lib/network';
import { getCachedProducts } from '../../../../lib/dataCache';
import { getUser as getStoredUserFromStorage } from '../../../../lib/userStorage';
import { resolveStaffBranch } from '../../../../lib/staffContext';
import { COLORS, GRADIENT, CARD } from '../../../lib/staffTheme';

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

const idsEqual = (a: any, b: any) => String(a ?? '') === String(b ?? '');

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
  if (!connected) return null;
  try {
    const response = await api.get('me');
    if (response.data) return response.data;
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
      const branchStock = (item.product_stocks || []).find((s: any) => idsEqual(s.branch_id, branchId));
      const quantity = Number(branchStock?.quantity ?? 0) || 0;
      const minStock = Number(branchStock?.minimum_stock ?? 0) || 0;
      const lowStockThreshold = Math.max(minStock, 15);
      const status: StockStatus = quantity <= 0 ? 'Out of Stock' : quantity <= lowStockThreshold ? 'Low Stock' : 'In Stock';
      return { id: String(item.id), name: item.name, category: item.category || 'Product', type: 'Regular', quantity, price: Number(item.price || 0), minStock, status, branchStock, product_stocks: item.product_stocks };
    })
    .filter((row: StockItem) => { if (!branchId) return true; return row.branchStock != null; });
};

const DashboardScreen = () => {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try { await api.post('logout'); } catch {}
          await signOut();
          router.replace('/Login');
        },
      },
    ]);
  };

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
  const [quotaProductsSold, setQuotaProductsSold] = useState(0);
  const [monthlyProductsSold, setMonthlyProductsSold] = useState(0);
  const [quotaIncentive, setQuotaIncentive] = useState(0);
  const [productTarget, setProductTarget] = useState(40);
  const [monthlyTarget, setMonthlyTarget] = useState(0);

  const loadDashboardData = async () => {
    try {
      const connected = await hasNetworkConnection();
      if (!connected) {
        console.log('[DASHBOARD] No connection - using cached data only');
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
      const { branchId: resolvedBranchId } = await resolveStaffBranch();
      const branchId = resolvedBranchId;
      console.log('[DASHBOARD] Resolved branchId:', branchId);
      const branchParams = branchId ? { branch_id: branchId } : {};
      const [productsRes, summaryRes] = await Promise.all([
        api.get('products'),
        api.get('sales', { params: { ...branchParams, date: today } }),
      ]);
      const monthlySalesRes = await api.get('sales', {
        params: { ...branchParams, start_date: monthStart, end_date: nextMonthStart },
      });
      console.log('[DASHBOARD] Sales API responses:', { summaryRes: summaryRes?.data, monthlySalesRes: monthlySalesRes?.data });
      const productsData = Array.isArray(productsRes?.data) ? productsRes.data : (productsRes?.data?.data || []);
      const mappedStock: StockItem[] = productsData
        .map((item: any) => {
          const branchStock = (item.product_stocks || []).find((s: any) => idsEqual(s.branch_id, branchId));
          const quantity = Number(branchStock?.quantity ?? 0) || 0;
          const minStock = Number(branchStock?.minimum_stock ?? 0) || 0;
          const lowStockThreshold = Math.max(minStock, 15);
          const status: StockStatus = quantity <= 0 ? 'Out of Stock' : quantity <= lowStockThreshold ? 'Low Stock' : 'In Stock';
          return { id: String(item.id), name: item.name, category: item.category || 'Product', type: 'Regular', quantity, price: Number(item.price || 0), minStock, status, branchStock, product_stocks: item.product_stocks };
        })
        .filter((row: StockItem) => { if (!branchId) return true; return row.branchStock != null; });
      console.log('[DASHBOARD] Stock list filtered by branch', { branchId, totalProducts: productsData.length, shownForBranch: mappedStock.length });
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
      const storedUser = await getStoredUserFromStorage();
      const now = new Date();

      // Fetch incentives (independent - don't block target fetch)
      try {
        const incentivesRes = await api.get('sales/product-incentives', {
          params: { month: now.getMonth() + 1, year: now.getFullYear() },
        });
        const incentivesData = incentivesRes?.data || {};
        const userIncentive = Object.values(incentivesData).find(
          (entry: any) => entry?.user_id === storedUser?.id
        ) as any;
        setQuotaProductsSold(userIncentive?.daily_products_sold ?? 0);
        setMonthlyProductsSold(userIncentive?.total_products_sold ?? 0);
        setQuotaIncentive(userIncentive?.incentive_amount ?? 0);
      } catch (incentiveErr) {
        if (isAuthError(incentiveErr)) throw incentiveErr;
        console.error('[DASHBOARD] Error fetching incentives:', incentiveErr);
        setQuotaProductsSold(0);
        setQuotaIncentive(0);
      }

      // Fetch product target for the branch (independent)
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      try {
        console.log('[DASHBOARD] Fetching sales targets for month:', currentMonth, 'branch:', branchId);
        const targetRes = await api.get('sales-targets', { params: { month: currentMonth } });
        const allTargets = targetRes?.data?.data || [];
        console.log('[DASHBOARD] All targets for month:', JSON.stringify(allTargets));

        let matchedTarget = null;
        if (branchId) {
          matchedTarget = allTargets.find((t: any) => String(t.branch_id) === String(branchId));
        }
        if (!matchedTarget && allTargets.length > 0) {
          matchedTarget = allTargets[0];
        }

        if (matchedTarget) {
          const monthly = Number(matchedTarget.target_products) || 0;
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const daily = monthly > 0 ? Math.ceil(monthly / daysInMonth) : 0;
          console.log('[DASHBOARD] Matched target:', { branch_id: matchedTarget.branch_id, monthly, daily });
          setMonthlyTarget(monthly);
          setProductTarget(daily);
        } else {
          console.log('[DASHBOARD] No target found for this branch/month');
          setMonthlyTarget(0);
        }
      } catch (targetErr) {
        if (isAuthError(targetErr)) throw targetErr;
        console.error('[DASHBOARD] Error fetching target:', targetErr);
      }
    } catch (error: any) {
      if (isAuthError(error)) {
        console.log('[DASHBOARD] Token expired - logging out');
        try { await api.post('logout'); } catch {}
        await signOut();
        router.replace('/Login');
        return;
      }
      if (isNetworkError(error)) {
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadUserData = async () => {
    const userData = await getStoredUser();
    setUser(userData);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getTotalStock = () => stockData.reduce((sum, item) => sum + Number(item.quantity), 0);

  const formatStockQty = (qty: number): { whole: string; hasHalf: boolean } => {
    const n = Math.round(Number(qty) * 2) / 2;
    const whole = Math.floor(n);
    const hasHalf = Math.abs(n - whole - 0.5) < 0.001;
    return { whole: String(whole), hasHalf };
  };

  const getLowStockCount = () => stockData.filter(item => item.status === 'Low Stock').length;
  const getTotalValue = () => stockData.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={[CARD, { width: width * 0.28, minHeight: 140, padding: 16 }]}>
      <View style={{ backgroundColor: color, borderRadius: 12, width: 40, height: 40, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color="white" />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginBottom: 4 }} numberOfLines={1}>{value}</Text>
      <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY, fontWeight: '500', lineHeight: 16 }} numberOfLines={2}>{title}</Text>
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
      <View style={[CARD, { padding: 16, marginBottom: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.TEXT_PRIMARY }}>{invoice}</Text>
            <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 2 }}>{formatDateTime(sale?.created_at || sale?.sale_date)}</Text>
            <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 2 }}>Customer: {customer}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.PRIMARY_RED }}>₱{total.toLocaleString()}</Text>
            {hasSenior && <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.STATUS_APPROVED_TEXT }}>Senior: -₱{discountAmount.toLocaleString()}</Text>}
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cash</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.TEXT_PRIMARY }}>₱{cash.toLocaleString()}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>Change</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.TEXT_PRIMARY }}>₱{change.toLocaleString()}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.TEXT_PRIMARY }}>{String(sale?.payment_method || 'cash').toUpperCase()}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE }}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        <Text style={{ marginTop: 16, color: COLORS.TEXT_PRIMARY, fontWeight: '600' }}>Loading Dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.PRIMARY_RED]} tintColor={COLORS.PRIMARY_RED} />
        }
      >
        {/* Header Section */}
        <LinearGradient colors={GRADIENT.HEADER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: 48, paddingBottom: 40, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          {/* Decorative circles */}
          <View style={{ position: 'absolute', top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ position: 'absolute', top: 20, right: 60, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)' }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Welcome Back</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800' }}>
                {user?.firstname && user?.lastname ? `${user.firstname} ${user.lastname}` : 'Staff Member'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>New Moon Lechon House</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 50 }}>
                <Icon name="notifications-none" size={22} color="white" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 50 }}>
                <Icon name="logout" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Sales Card */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => { setSalesTodayPage(1); setSalesTodayModalVisible(true); }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Total Sales Today</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 40, fontWeight: '800', marginBottom: 4 }}>₱{todaySales.toLocaleString()}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Tap to view checkouts</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="receipt-long" size={16} color="white" />
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, marginLeft: 4 }}>{todaySalesList.length}</Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' }}>This Month</Text>
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18 }}>₱{grossSales.toLocaleString()}</Text>
                </View>
                <View style={{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' }}>Sales Target</Text>
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18 }}>{monthlyTarget > 0 ? `${monthlyTarget} pcs` : 'Not set'}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </LinearGradient>

        {/* Quota Card */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View style={[CARD, { padding: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5 }}>Product Quota</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.TEXT_PRIMARY }}>₱100 per 40 products</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flex: 1, height: 10, backgroundColor: COLORS.ACCENT_LIGHT, borderRadius: 5, overflow: 'hidden' }}>
                <View style={{
                  height: '100%', borderRadius: 5,
                  width: `${Math.min((quotaProductsSold / 40) * 100, 100)}%`,
                  backgroundColor: quotaProductsSold >= 40 ? COLORS.STATUS_APPROVED_TEXT : COLORS.STATUS_PENDING_TEXT,
                }} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginLeft: 12 }}>{quotaProductsSold}/40</Text>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY, marginBottom: 12 }}>
              {quotaProductsSold >= 40 ? 'Target reached today!' : `${40 - quotaProductsSold} products remaining today`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: quotaIncentive > 0 ? COLORS.ACCENT_LIGHT : COLORS.CARD_BG, borderRadius: 10, padding: 10, marginTop: 4 }}>
              <Icon name="emoji-events" size={18} color={quotaIncentive > 0 ? COLORS.STATUS_APPROVED_TEXT : COLORS.TEXT_MUTED} />
              <View style={{ marginLeft: 8 }}>
                <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY }}>Today's Incentive</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: quotaIncentive > 0 ? COLORS.TEXT_PRIMARY : COLORS.TEXT_MUTED }}>
                  {quotaIncentive > 0 ? `₱${quotaIncentive.toLocaleString()}` : '₱0'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginBottom: 16 }}>Inventory Overview</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <StatCard title="Total Products" value={stockData.length} icon="restaurant-menu" color={COLORS.PRIMARY_RED} />
            <StatCard
              title={(() => { const { whole, hasHalf } = formatStockQty(getTotalStock()); return hasHalf ? `${whole} ½ stock\navailable` : 'Total Stock'; })()}
              value={(() => { const { whole, hasHalf } = formatStockQty(getTotalStock()); return hasHalf ? `${whole}.5` : whole; })()}
              icon="kitchen"
              color={COLORS.PRIMARY_NAVY}
            />
            <StatCard title="Low Stock Items" value={getLowStockCount()} icon="warning" color={COLORS.STATUS_PENDING_TEXT} />
          </View>
        </View>

        {/* Inventory Value Card */}
        <View style={{ paddingHorizontal: 24, marginTop: 16, marginBottom: 8 }}>
          <LinearGradient colors={[COLORS.PRIMARY_NAVY, '#0D1B5E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Total Inventory Value</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800' }}>₱{getTotalValue().toLocaleString()}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>Across all products</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 16 }}>
                <Icon name="account-balance-wallet" size={24} color="white" />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Stock Details List */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.TEXT_PRIMARY }}>Current Stock Levels</Text>
            <Text style={{ fontSize: 13, color: COLORS.TEXT_SECONDARY }}>{stockData.length} items</Text>
          </View>
          {stockData.map((item) => (
            <View key={item.id} style={[CARD, { padding: 16, marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginBottom: 4 }} numberOfLines={2}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY }} numberOfLines={1}>{item.category} • {item.type}</Text>
                </View>
                <View style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: item.status === 'Low Stock' ? COLORS.STATUS_PENDING_BG : COLORS.STATUS_APPROVED_BG,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: item.status === 'Low Stock' ? COLORS.STATUS_PENDING_TEXT : COLORS.STATUS_APPROVED_TEXT }} numberOfLines={1}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Quantity</Text>
                  {(() => {
                    const { whole, hasHalf } = formatStockQty(item.quantity);
                    return (
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.TEXT_PRIMARY }}>{hasHalf ? `${whole}.5` : whole}</Text>
                        {hasHalf && (
                          <View style={{ backgroundColor: COLORS.STATUS_PENDING_BG, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#FDE68A' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.STATUS_PENDING_TEXT }}>{whole} ½ stock available</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Price</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.PRIMARY_RED }} numberOfLines={1}>₱{item.price}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Min. Stock</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.TEXT_PRIMARY }} numberOfLines={1}>{item.minStock}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Low Stock Alert Section */}
        {stockData.filter(item => item.status === 'Low Stock' || item.status === 'Out of Stock').length > 0 && (
          <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginBottom: 12 }}>Stock Alerts</Text>
            {stockData.filter(item => item.status === 'Low Stock' || item.status === 'Out of Stock').map((item) => {
              const isOut = item.status === 'Out of Stock';
              return (
                <View key={item.id} style={{
                  borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1,
                  backgroundColor: isOut ? COLORS.STATUS_REJECTED_BG : COLORS.STATUS_PENDING_BG,
                  borderColor: isOut ? '#FECACA' : '#FDE68A',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Icon name={isOut ? 'error-outline' : 'warning'} size={18} color={isOut ? COLORS.STATUS_REJECTED_TEXT : COLORS.STATUS_PENDING_TEXT} />
                    <Text style={{ fontWeight: '700', fontSize: 13, marginLeft: 8, color: isOut ? COLORS.STATUS_REJECTED_TEXT : COLORS.STATUS_PENDING_TEXT }}>
                      {isOut ? 'Out of Stock' : 'Low Stock Warning'}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '600', fontSize: 14, color: COLORS.TEXT_PRIMARY, marginBottom: 2 }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY }}>
                    {isOut ? 'No stock remaining. Please restock immediately.' : `Only ${item.quantity} left (minimum: ${item.minStock}). Consider restocking soon.`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Footer */}
        <View style={{ backgroundColor: COLORS.CARD_BG, paddingVertical: 16, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER, marginTop: 24, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
            <Icon name="store" size={14} color={COLORS.TEXT_MUTED} />
            <Text style={{ textAlign: 'center', color: COLORS.TEXT_SECONDARY, fontSize: 12, fontWeight: '500', marginLeft: 8 }}>
              New Moon Lechon House - Staff Portal
            </Text>
          </View>
          <Text style={{ textAlign: 'center', color: COLORS.TEXT_MUTED, fontSize: 12 }}>
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => setSalesTodayModalVisible(false)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}></View>
          </Pressable>
          <View style={{ backgroundColor: COLORS.CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '92%' }}>
            <LinearGradient colors={GRADIENT.PRIMARY} style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Sales Today</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{todaySalesList.length} checkout(s)</Text>
              </View>
              <TouchableOpacity onPress={() => setSalesTodayModalVisible(false)}>
                <Icon name="close" size={26} color="white" />
              </TouchableOpacity>
            </LinearGradient>

            {(() => {
              const totalItems = todaySalesList.length;
              const totalPages = Math.max(1, Math.ceil(totalItems / SALES_TODAY_PAGE_SIZE));
              const page = Math.min(Math.max(1, salesTodayPage), totalPages);
              const start = (page - 1) * SALES_TODAY_PAGE_SIZE;
              const pagedSales = todaySalesList.slice(start, start + SALES_TODAY_PAGE_SIZE);
              return (
                <>
                  <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                    {todaySalesList.length === 0 ? (
                      <View style={{ paddingVertical: 64, alignItems: 'center' }}>
                        <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, padding: 16, borderRadius: 50, marginBottom: 16 }}>
                          <Icon name="receipt" size={34} color={COLORS.TEXT_MUTED} />
                        </View>
                        <Text style={{ color: COLORS.TEXT_SECONDARY, fontWeight: '600' }}>No sales yet for today</Text>
                        <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Checkouts will appear here after POS orders</Text>
                      </View>
                    ) : (
                      <>
                        <View style={[CARD, { padding: 16, marginBottom: 16 }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</Text>
                              <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.TEXT_PRIMARY }}>₱{todaySales.toLocaleString()}</Text>
                            </View>
                            <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.TEXT_PRIMARY }}>Date: {formatLocalDate()}</Text>
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

                  {totalItems > SALES_TODAY_PAGE_SIZE && (
                    <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <TouchableOpacity
                        onPress={() => setSalesTodayPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.DIVIDER, opacity: page <= 1 ? 0.5 : 1 }}
                        activeOpacity={0.85}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon name="chevron-left" size={20} color={COLORS.TEXT_PRIMARY} />
                          <Text style={{ fontWeight: '700', marginLeft: 4, color: COLORS.TEXT_PRIMARY }}>Prev</Text>
                        </View>
                      </TouchableOpacity>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontWeight: '600' }}>Page {page} / {totalPages}</Text>
                      <TouchableOpacity
                        onPress={() => setSalesTodayPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.DIVIDER, opacity: page >= totalPages ? 0.5 : 1 }}
                        activeOpacity={0.85}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontWeight: '700', marginRight: 4, color: COLORS.TEXT_PRIMARY }}>Next</Text>
                          <Icon name="chevron-right" size={20} color={COLORS.TEXT_PRIMARY} />
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
