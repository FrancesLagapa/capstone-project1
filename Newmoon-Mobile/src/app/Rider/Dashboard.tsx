// app/rider/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../../context/authContext';
const RiderDashboard = () => {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await signOut();
            router.replace('/Login');
          },
        },
      ]
    );
  };

  const navigateTo = (screen: string) => {
    router.push(`/rider/${screen}` as any);
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="mt-4 text-white font-medium">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View className="pt-12 pb-10 px-6 rounded-b-3xl" style={{ backgroundColor: '#10B981' }}>
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="text-white/90 text-xs font-semibold tracking-wide uppercase mb-1">
                Welcome Back
              </Text>
              <Text className="text-white text-3xl font-bold">
                {user?.firstname && user?.lastname
                  ? `${user.firstname} ${user.lastname}`
                  : 'Rider'}
              </Text>
              <Text className="text-white/80 text-sm mt-1">
                New Moon Lechon Rider Portal
              </Text>
            </View>
            <TouchableOpacity className="bg-white/20 p-3 rounded-full">
              <Icon name="notifications-none" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Main Status Card */}
          <View className="bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-800">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-4">
                <Text className="text-gray-400 text-xs font-semibold tracking-wider uppercase mb-2">
                  Delivery Status
                </Text>
                <Text className="text-white text-5xl font-bold mb-2">Active</Text>
                <Text className="text-gray-500 text-xs">Ready for deliveries</Text>
              </View>
              <View className="bg-green-900/30 border border-green-800 px-3 py-2 rounded-xl">
                <View className="flex-row items-center">
                  <Icon name="directions-bike" size={18} color="#10B981" />
                  <Text className="text-green-400 font-bold text-xs ml-1">Rider</Text>
                </View>
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
              onPress={() => navigateTo('Orders')}
            >
              <View className="bg-green-900/30 p-3 rounded-full mb-2">
                <Icon name="list-alt" size={24} color="#10B981" />
              </View>
              <Text className="text-white font-bold text-sm">Orders</Text>
              <Text className="text-gray-400 text-xs mt-1">View Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => navigateTo('History')}
            >
              <View className="bg-blue-900/30 p-3 rounded-full mb-2">
                <Icon name="history" size={24} color="#3B82F6" />
              </View>
              <Text className="text-white font-bold text-sm">History</Text>
              <Text className="text-gray-400 text-xs mt-1">Past Deliveries</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => navigateTo('Map')}
            >
              <View className="bg-purple-900/30 p-3 rounded-full mb-2">
                <Icon name="map" size={24} color="#8B5CF6" />
              </View>
              <Text className="text-white font-bold text-sm">Map</Text>
              <Text className="text-gray-400 text-xs mt-1">Navigation</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between gap-3 mt-3">
            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => navigateTo('Earnings')}
            >
              <View className="bg-orange-900/30 p-3 rounded-full mb-2">
                <Icon name="account-balance-wallet" size={24} color="#F97316" />
              </View>
              <Text className="text-white font-bold text-sm">Earnings</Text>
              <Text className="text-gray-400 text-xs mt-1">View Income</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-1 bg-gray-900 rounded-2xl p-4 shadow-md border border-gray-800 items-center"
              onPress={() => navigateTo('Profile')}
            >
              <View className="bg-gray-800 p-3 rounded-full mb-2">
                <Icon name="person" size={24} color="#6B7280" />
              </View>
              <Text className="text-white font-bold text-sm">Profile</Text>
              <Text className="text-gray-400 text-xs mt-1">Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-red-900/30 rounded-2xl p-4 shadow-md border border-red-800 items-center"
              onPress={handleLogout}
              disabled={loading}
            >
              <View className="bg-red-900/50 p-3 rounded-full mb-2">
                <Icon name="logout" size={24} color="#EF4444" />
              </View>
              <Text className="text-white font-bold text-sm">Logout</Text>
              <Text className="text-gray-400 text-xs mt-1">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Section */}
        <View className="px-6 mt-6">
          <Text className="text-white text-xl font-bold mb-4">Today's Stats</Text>
          <View className="bg-gray-900 rounded-2xl p-5 shadow-lg border border-gray-800">
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-white/90 text-xs font-semibold tracking-wider uppercase mb-1">
                  Deliveries
                </Text>
                <Text className="text-white text-3xl font-bold">0</Text>
                <Text className="text-white/70 text-xs mt-1">Completed today</Text>
              </View>
              <View className="bg-white/20 p-4 rounded-2xl">
                <Icon name="local-shipping" size={24} color="white" />
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="bg-gray-900 py-4 px-6 border-t border-gray-800 mt-6 mb-4">
          <View className="flex-row justify-center items-center mb-2">
            <Icon name="store" size={14} color="#9CA3AF" />
            <Text className="text-center text-gray-400 text-xs font-medium ml-2">
              New Moon Lechon House - Rider Portal
            </Text>
          </View>
          <Text className="text-center text-gray-500 text-xs">
            Last updated: {new Date().toLocaleString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RiderDashboard;