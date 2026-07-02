import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../lib/api';
import { useAuth } from '../../../context/authContext';
import {
  CustomerBranch,
  getSelectedBranch,
  saveSelectedBranch,
} from '../../../lib/customerBranchStorage';
import Icon from 'react-native-vector-icons/MaterialIcons';

type ProductStock = {
  branch_id: number | string;
  quantity: number;
};

type MenuProduct = {
  id: number;
  name: string;
  price: number | string;
  description?: string | null;
  product_stocks?: ProductStock[];
  stocks?: ProductStock[];
};

function formatPrice(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₱0.00';
  return `₱${amount.toFixed(2)}`;
}

async function fetchAllBranches(): Promise<CustomerBranch[]> {
  const branches: CustomerBranch[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await api.get('/branches', { params: { page } });
    const payload = response.data;
    const pageData = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    branches.push(...pageData);
    lastPage = payload?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage);

  return branches;
}

async function fetchAllProducts(): Promise<MenuProduct[]> {
  const products: MenuProduct[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await api.get('/products', { params: { page } });
    const payload = response.data;
    const pageData = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    products.push(...pageData);
    lastPage = payload?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage);

  return products;
}

function getBranchStock(product: MenuProduct, branchId: number): ProductStock | undefined {
  const stocks = product.product_stocks ?? product.stocks ?? [];
  return stocks.find((stock) => String(stock.branch_id) === String(branchId));
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [branches, setBranches] = useState<CustomerBranch[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<CustomerBranch | null>(null);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const displayName = user?.firstname?.trim() || user?.username || 'Customer';
  const userInitial = displayName.charAt(0).toUpperCase();

  const branchProducts = useMemo(() => {
    if (!selectedBranch) return [];
    return products.filter((product) => {
      const stock = getBranchStock(product, selectedBranch.id);
      return stock && Number(stock.quantity) > 0;
    });
  }, [products, selectedBranch]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return branchProducts;
    const query = searchQuery.toLowerCase().trim();
    return branchProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
    );
  }, [branchProducts, searchQuery]);

  const loadData = useCallback(async () => {
    const [branchList, productList, savedBranch] = await Promise.all([
      fetchAllBranches(),
      fetchAllProducts(),
      getSelectedBranch(),
    ]);

    setBranches(branchList);
    setProducts(productList);

    const savedStillValid = savedBranch && branchList.some((branch) => branch.id === savedBranch.id);
    const nextBranch = savedStillValid ? savedBranch : branchList[0] ?? null;
    setSelectedBranch(nextBranch);
    if (nextBranch) {
      await saveSelectedBranch(nextBranch);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch {
        Alert.alert('Error', 'Unable to load branches. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch {
      Alert.alert('Error', 'Unable to refresh. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectBranch = async (branch: CustomerBranch) => {
    setSelectedBranch(branch);
    await saveSelectedBranch(branch);
    setBranchModalVisible(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
            router.replace('/Login');
          } catch {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const renderBranchItem = ({ item }: { item: CustomerBranch }) => {
    const isSelected = selectedBranch?.id === item.id;
    return (
      <TouchableOpacity
        className={`flex-row items-center px-5 py-4 ${
          isSelected ? 'bg-blue-900/20' : ''
        }`}
        onPress={() => handleSelectBranch(item)}
      >
        <View className="flex-1 pr-3">
          <Text className="text-base font-semibold text-white">{item.name}</Text>
          {item.address && (
            <Text className="text-sm text-gray-400 mt-1">{item.address}</Text>
          )}
          {item.phone && (
            <Text className="text-xs text-gray-500 mt-0.5">{item.phone}</Text>
          )}
        </View>
        {isSelected ? (
          <Icon name="check-circle" size={24} color="#10B981" />
        ) : (
          <Icon name="chevron-right" size={20} color="#6B7280" />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-black">
        <View className="w-20 h-20 rounded-full bg-gray-900 items-center justify-center mb-4 border border-gray-800">
          <ActivityIndicator size="large" color="#10B981" />
        </View>
        <Text className="text-gray-400 text-base font-medium">Loading your menu...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <ScrollView
        className="flex-1 bg-black"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#10B981']}
            tintColor="#10B981"
          />
        }
      >
        {/* Header Section */}
        <View className="pt-12 pb-10 px-6 rounded-b-3xl" style={{ backgroundColor: '#10B981' }}>
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="text-white/90 text-xs font-semibold tracking-wide uppercase mb-1">
                Welcome Back
              </Text>
              <Text className="text-white text-3xl font-bold">
                {displayName}
              </Text>
              <Text className="text-white/80 text-sm mt-1">
                Find your favorite dishes here
              </Text>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity 
                className="bg-white/20 p-3 rounded-full"
                onPress={() => router.push('/Customer/Profile')}
              >
                <Icon name="person" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-white/20 p-3 rounded-full"
                onPress={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Icon name="logout" size={24} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Branch Selector Card */}
          <TouchableOpacity
            className="bg-gray-900 rounded-2xl p-4 shadow-lg border border-gray-800 flex-row items-center"
            onPress={() => setBranchModalVisible(true)}
            activeOpacity={0.9}
          >
            <View className="w-12 h-12 rounded-full bg-green-900/30 items-center justify-center mr-4 border border-green-800">
              <Icon name="store" size={24} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-400 text-xs font-semibold tracking-wider uppercase">
                Ordering from
              </Text>
              <Text className="text-white text-base font-bold mt-0.5">
                {selectedBranch?.name ?? 'Select a branch'}
              </Text>
              {selectedBranch?.address && (
                <View className="flex-row items-center mt-0.5">
                  <Icon name="location-on" size={14} color="#9CA3AF" />
                  <Text className="text-xs text-gray-400 ml-1" numberOfLines={1}>
                    {selectedBranch.address}
                  </Text>
                </View>
              )}
            </View>
            <View className="w-8 h-8 rounded-full bg-gray-800 items-center justify-center">
              <Icon name="keyboard-arrow-down" size={18} color="#6B7280" />
            </View>
          </TouchableOpacity>
        </View>

        {!selectedBranch ? (
          <View className="items-center px-8 py-16">
            <View className="w-24 h-24 rounded-full bg-gray-900 items-center justify-center mb-4 border border-gray-800">
              <Icon name="store" size={48} color="#4B5563" />
            </View>
            <Text className="text-xl font-bold text-white">
              No Branch Selected
            </Text>
            <Text className="text-base text-gray-400 text-center mt-2">
              Please select a branch to view available menu items
            </Text>
            <TouchableOpacity
              className="mt-6 bg-green-500 px-6 py-3 rounded-full"
              onPress={() => setBranchModalVisible(true)}
            >
              <Text className="text-white font-semibold">Select Branch</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Search Bar */}
            <View className="mx-6 mt-6 bg-gray-900 rounded-xl px-4 py-2 flex-row items-center border border-gray-800">
              <Icon name="search" size={20} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-base text-white py-2"
                placeholder="Search menu items..."
                placeholderTextColor="#6B7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            {/* Menu Section */}
            <View className="mt-6 px-6">
              <View className="flex-row justify-between items-center mb-4">
                <View>
                  <Text className="text-xl font-bold text-white">
                    Menu
                  </Text>
                  <Text className="text-sm text-gray-400">
                    {selectedBranch.name}
                  </Text>
                </View>
                <View className="bg-green-900/30 border border-green-800 px-3 py-1.5 rounded-xl">
                  <Text className="text-green-400 text-sm font-medium">
                    {filteredProducts.length} items
                  </Text>
                </View>
              </View>

              {filteredProducts.length === 0 ? (
                <View className="bg-gray-900 rounded-2xl p-8 items-center border border-gray-800">
                  <View className="w-16 h-16 rounded-full bg-gray-800 items-center justify-center mb-3">
                    <Icon name="restaurant" size={32} color="#4B5563" />
                  </View>
                  <Text className="text-gray-300 text-base font-medium text-center">
                    {searchQuery.trim() ? 'No items match your search' : 'No items available'}
                  </Text>
                  {searchQuery.trim() && (
                    <Text className="text-gray-400 text-sm text-center mt-1">
                      Try adjusting your search terms
                    </Text>
                  )}
                </View>
              ) : (
                filteredProducts.map((item) => {
                  const stock = getBranchStock(item, selectedBranch.id);
                  const quantity = stock ? Number(stock.quantity) : 0;
                  const isLowStock = quantity > 0 && quantity <= 5;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      className="bg-gray-900 rounded-2xl p-4 mb-3 border border-gray-800"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row">
                        <View className="flex-1 pr-3">
                          <Text className="text-base font-semibold text-white">
                            {item.name}
                          </Text>
                          {item.description && (
                            <Text className="text-sm text-gray-400 mt-1" numberOfLines={2}>
                              {item.description}
                            </Text>
                          )}
                          <View className="flex-row items-center mt-2">
                            {quantity > 0 ? (
                              <>
                                <View className="flex-row items-center">
                                  <Icon name="check-circle" size={14} color={isLowStock ? "#F97316" : "#10B981"} />
                                  <Text className={`text-xs font-medium ml-1 ${
                                    isLowStock ? 'text-orange-400' : 'text-green-400'
                                  }`}>
                                    {isLowStock ? `${quantity} left` : 'In stock'}
                                  </Text>
                                </View>
                              </>
                            ) : (
                              <View className="flex-row items-center">
                                <Icon name="cancel" size={14} color="#EF4444" />
                                <Text className="text-xs text-red-400 font-medium ml-1">
                                  Out of stock
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View className="items-end">
                          <Text className="text-lg font-bold text-green-400">
                            {formatPrice(item.price)}
                          </Text>
                          <TouchableOpacity
                            className={`w-10 h-10 rounded-full items-center justify-center mt-2 ${
                              quantity > 0 ? 'bg-green-500' : 'bg-gray-700'
                            }`}
                            disabled={quantity <= 0}
                          >
                            <Icon name="add" size={24} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Other Branches */}
            <View className="mt-8 px-6">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-base font-bold text-white">
                  Other Branches
                </Text>
                <TouchableOpacity onPress={() => setBranchModalVisible(true)}>
                  <Text className="text-green-400 text-sm font-medium">View All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-row"
              >
                {branches.slice(0, 5).map((branch) => {
                  const isSelected = selectedBranch.id === branch.id;
                  return (
                    <TouchableOpacity
                      key={branch.id}
                      className={`px-4 py-2.5 rounded-full mr-2.5 border ${
                        isSelected
                          ? 'bg-green-500 border-green-500'
                          : 'bg-gray-900 border-gray-800'
                      }`}
                      onPress={() => handleSelectBranch(branch)}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          isSelected ? 'text-white' : 'text-gray-300'
                        }`}
                      >
                        {branch.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View className="h-8" />
          </>
        )}
      </ScrollView>

      {/* Branch Selection Modal */}
      <Modal
        visible={branchModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-gray-900 rounded-t-3xl max-h-[80%] border-t border-gray-800">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center px-5 pt-5 pb-3 border-b border-gray-800">
              <View>
                <Text className="text-xl font-bold text-white">
                  Select Branch
                </Text>
                <Text className="text-sm text-gray-400">
                  Choose where to order from
                </Text>
              </View>
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-gray-800 items-center justify-center"
                onPress={() => setBranchModalVisible(false)}
              >
                <Icon name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {branches.length === 0 ? (
              <View className="p-8 items-center">
                <Icon name="store" size={48} color="#4B5563" />
                <Text className="text-gray-400 text-base mt-3">
                  No active branches found
                </Text>
              </View>
            ) : (
              <FlatList
                data={branches}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderBranchItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}