// app/rider/History.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    SafeAreaView,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';

interface DeliveryHistory {
    id: string;
    orderNumber: string;
    customerName: string;
    customerAddress: string;
    items: string;
    totalAmount: number;
    deliveryFee: number;
    status: 'delivered' | 'cancelled' | 'failed';
    date: string;
    time: string;
    rating?: number;
    feedback?: string;
    earnings: number;
    distance: string;
    duration: string;
}

export default function HistoryScreen() {
    const [history, setHistory] = useState<DeliveryHistory[]>([]);
    const [filteredHistory, setFilteredHistory] = useState<DeliveryHistory[]>([]);
    const [selectedFilter, setSelectedFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

    // Sample history data
    const sampleHistory: DeliveryHistory[] = [
        {
            id: '1',
            orderNumber: '#NL-2026-001',
            customerName: 'Maria Santos',
            customerAddress: '123 Mabini St., Makati City',
            items: 'Lechon Belly (Whole), Pork BBQ (20 pcs)',
            totalAmount: 4250,
            deliveryFee: 150,
            status: 'delivered',
            date: '2026-07-02',
            time: '10:30 AM',
            rating: 5,
            feedback: 'Fast delivery! Very satisfied.',
            earnings: 150,
            distance: '3.2 km',
            duration: '25 mins'
        },
        {
            id: '2',
            orderNumber: '#NL-2026-002',
            customerName: 'John Reyes',
            customerAddress: '456 Dela Rosa St., Mandaluyong',
            items: 'Crispy Pata, Lechon Kawali, Rice',
            totalAmount: 2020,
            deliveryFee: 120,
            status: 'delivered',
            date: '2026-07-02',
            time: '11:15 AM',
            rating: 4,
            feedback: 'Good service.',
            earnings: 120,
            distance: '5.1 km',
            duration: '35 mins'
        },
        {
            id: '3',
            orderNumber: '#NL-2026-003',
            customerName: 'Ana Garcia',
            customerAddress: '789 C5 Road, Quezon City',
            items: 'Lechon Manok (2), Pancit Canton',
            totalAmount: 2030,
            deliveryFee: 180,
            status: 'delivered',
            date: '2026-07-01',
            time: '09:00 AM',
            rating: 5,
            feedback: 'Excellent!',
            earnings: 180,
            distance: '7.8 km',
            duration: '45 mins'
        },
        {
            id: '4',
            orderNumber: '#NL-2026-004',
            customerName: 'Mike Tan',
            customerAddress: '101 BGC, Taguig City',
            items: 'Sizzling Sisig, Buko Juice (3)',
            totalAmount: 920,
            deliveryFee: 100,
            status: 'delivered',
            date: '2026-07-01',
            time: '12:30 PM',
            rating: 3,
            feedback: 'A bit late but okay.',
            earnings: 100,
            distance: '2.5 km',
            duration: '15 mins'
        },
        {
            id: '5',
            orderNumber: '#NL-2026-005',
            customerName: 'Lisa Cruz',
            customerAddress: '202 Greenbelt, Makati City',
            items: 'Lechon Belly (Half)',
            totalAmount: 1930,
            deliveryFee: 130,
            status: 'cancelled',
            date: '2026-06-30',
            time: '05:30 PM',
            rating: 0,
            earnings: 0,
            distance: '4.0 km',
            duration: '0 mins'
        },
        {
            id: '6',
            orderNumber: '#NL-2026-006',
            customerName: 'Robert Mendoza',
            customerAddress: '303 Eastwood, Quezon City',
            items: 'Crispy Pata (2), Rice (10 cups)',
            totalAmount: 2000,
            deliveryFee: 160,
            status: 'delivered',
            date: '2026-06-30',
            time: '06:45 PM',
            rating: 4,
            feedback: 'Good service, friendly rider.',
            earnings: 160,
            distance: '6.3 km',
            duration: '40 mins'
        },
        {
            id: '7',
            orderNumber: '#NL-2026-007',
            customerName: 'Catherine Lim',
            customerAddress: '404 BGC, Taguig City',
            items: 'Lechon Belly (Whole), Rice (5 cups)',
            totalAmount: 3800,
            deliveryFee: 140,
            status: 'failed',
            date: '2026-06-29',
            time: '02:00 PM',
            rating: 0,
            feedback: 'Customer not available',
            earnings: 0,
            distance: '3.5 km',
            duration: '20 mins'
        }
    ];

    useEffect(() => {
        setHistory(sampleHistory);
        setFilteredHistory(sampleHistory);
    }, []);

    useEffect(() => {
        filterHistory();
    }, [selectedFilter, searchQuery, selectedPeriod, history]);

    const filterHistory = () => {
        let filtered = history;

        // Filter by status
        if (selectedFilter !== 'all') {
            filtered = filtered.filter(item => item.status === selectedFilter);
        }

        // Filter by period
        if (selectedPeriod !== 'all') {
            const today = new Date();
            const filterDate = new Date(today);
            
            if (selectedPeriod === 'today') {
                filterDate.setDate(today.getDate());
            } else if (selectedPeriod === 'week') {
                filterDate.setDate(today.getDate() - 7);
            } else if (selectedPeriod === 'month') {
                filterDate.setMonth(today.getMonth() - 1);
            }
            
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= filterDate;
            });
        }

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item =>
                item.orderNumber.toLowerCase().includes(query) ||
                item.customerName.toLowerCase().includes(query)
            );
        }

        // Sort by date (newest first)
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setFilteredHistory(filtered);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setRefreshing(false);
    };

    const getStatusColor = (status: string) => {
        const colors = {
            delivered: '#10B981',
            cancelled: '#EF4444',
            failed: '#F59E0B',
        };
        return colors[status as keyof typeof colors] || '#9CA3AF';
    };

    const getStatusIcon = (status: string) => {
        const icons = {
            delivered: 'checkmark-circle',
            cancelled: 'close-circle',
            failed: 'alert-circle',
        };
        return icons[status as keyof typeof icons] || 'ellipse';
    };

    const getStatusLabel = (status: string) => {
        const labels = {
            delivered: 'Delivered',
            cancelled: 'Cancelled',
            failed: 'Failed',
        };
        return labels[status as keyof typeof labels] || status;
    };

    const renderStars = (rating: number) => {
        if (rating === 0) return <Text className="text-gray-500 text-xs">No rating</Text>;
        
        return (
            <View className="flex-row items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                        key={star}
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={14}
                        color={star <= rating ? '#F59E0B' : '#D1D5DB'}
                    />
                ))}
            </View>
        );
    };

    const formatCurrency = (amount: number) => {
        return `₱${amount.toLocaleString()}`;
    };

    const formatDate = (date: string) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getTotalEarnings = () => {
        return history
            .filter(item => item.status === 'delivered')
            .reduce((sum, item) => sum + item.earnings, 0);
    };

    const getDeliveryCount = () => {
        return history.filter(item => item.status === 'delivered').length;
    };

    const getAverageRating = () => {
        const delivered = history.filter(item => item.status === 'delivered' && item.rating && item.rating > 0);
        if (delivered.length === 0) return 0;
        const total = delivered.reduce((sum, item) => sum + (item.rating || 0), 0);
        return (total / delivered.length).toFixed(1);
    };

    const renderHistoryCard = (item: DeliveryHistory) => (
        <TouchableOpacity
            key={item.id}
            className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-800"
            onPress={() => {
                // Navigate to order details
                // router.push(`/rider/OrderDetails?id=${item.id}`);
            }}
        >
            {/* Header - Order Number and Status */}
            <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-bold text-white">{item.orderNumber}</Text>
                <View 
                    className="px-3 py-1 rounded-full flex-row items-center"
                    style={{ backgroundColor: getStatusColor(item.status) + '20' }}
                >
                    <Ionicons 
                        name={getStatusIcon(item.status) as any} 
                        size={12} 
                        color={getStatusColor(item.status)} 
                    />
                    <Text 
                        className="text-xs font-medium ml-1"
                        style={{ color: getStatusColor(item.status) }}
                    >
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>

            {/* Customer Info */}
            <Text className="text-base font-semibold text-white">{item.customerName}</Text>
            <View className="flex-row items-center mt-1">
                <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                <Text className="text-xs text-gray-400 ml-1 flex-1" numberOfLines={1}>
                    {item.customerAddress}
                </Text>
            </View>

            {/* Order Details */}
            <Text className="text-xs text-gray-500 mt-2" numberOfLines={1}>
                {item.items}
            </Text>

            {/* Rating */}
            <View className="mt-2">
                {renderStars(item.rating || 0)}
                {item.feedback && (
                    <Text className="text-xs text-gray-400 italic mt-1" numberOfLines={1}>
                        "{item.feedback}"
                    </Text>
                )}
            </View>

            {/* Footer - Date, Time, Earnings */}
            <View className="flex-row justify-between items-center mt-3 pt-2 border-t border-gray-800">
                <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                    <Text className="text-xs text-gray-400 ml-1">
                        {formatDate(item.date)}
                    </Text>
                    <View className="w-0.5 h-3 bg-gray-700 mx-2" />
                    <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                    <Text className="text-xs text-gray-400 ml-1">{item.time}</Text>
                </View>
                <View className="flex-row items-center">
                    <Text className="text-xs text-gray-400 mr-2">
                        {item.distance}
                    </Text>
                    {item.status === 'delivered' && (
                        <View className="bg-green-900/30 px-2 py-1 rounded-full">
                            <Text className="text-xs font-bold text-green-400">
                                +{formatCurrency(item.earnings)}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    // Filter options
    const filters = [
        { id: 'all', label: 'All' },
        { id: 'delivered', label: 'Delivered' },
        { id: 'cancelled', label: 'Cancelled' },
        { id: 'failed', label: 'Failed' },
    ];

    const periodFilters = [
        { id: 'all', label: 'All Time' },
        { id: 'today', label: 'Today' },
        { id: 'week', label: 'This Week' },
        { id: 'month', label: 'This Month' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-black">
            {/* Header */}
            <View className="bg-gray-900 px-4 py-4 border-b border-gray-800">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => router.back()} className="mr-3">
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-xl font-bold text-white">History</Text>
                            <Text className="text-xs text-gray-400">
                                {filteredHistory.length} delivery{filteredHistory.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity className="bg-gray-800 p-2 rounded-full">
                        <Ionicons name="refresh" size={20} color="#10B981" />
                    </TouchableOpacity>
                </View>

                {/* Stats Summary */}
                <View className="flex-row justify-between mt-4">
                    <View className="bg-gray-800 rounded-xl px-4 py-2 flex-1 mr-2">
                        <Text className="text-gray-400 text-xs">Total Deliveries</Text>
                        <Text className="text-white text-lg font-bold">{getDeliveryCount()}</Text>
                    </View>
                    <View className="bg-gray-800 rounded-xl px-4 py-2 flex-1 mx-1">
                        <Text className="text-gray-400 text-xs">Total Earnings</Text>
                        <Text className="text-green-400 text-lg font-bold">{formatCurrency(getTotalEarnings())}</Text>
                    </View>
                    <View className="bg-gray-800 rounded-xl px-4 py-2 flex-1 ml-2">
                        <Text className="text-gray-400 text-xs">Avg. Rating</Text>
                        <Text className="text-yellow-400 text-lg font-bold">{getAverageRating()}</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View className="flex-row items-center bg-gray-800 rounded-xl px-3 py-2 mt-3">
                    <Ionicons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-2 text-sm text-white"
                        placeholder="Search by order # or customer..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#9CA3AF"
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* Period Filters */}
            <View className="bg-gray-900 px-4 py-2 border-b border-gray-800">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row space-x-2">
                        {periodFilters.map((filter) => (
                            <TouchableOpacity
                                key={filter.id}
                                className={`px-4 py-2 rounded-full ${
                                    selectedPeriod === filter.id 
                                        ? 'bg-green-500' 
                                        : 'bg-gray-800'
                                }`}
                                onPress={() => setSelectedPeriod(filter.id)}
                            >
                                <Text className={`text-sm font-medium ${
                                    selectedPeriod === filter.id 
                                        ? 'text-white' 
                                        : 'text-gray-400'
                                }`}>
                                    {filter.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* Status Filters */}
            <View className="bg-gray-900 px-4 py-2 border-b border-gray-800">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row space-x-2">
                        {filters.map((filter) => (
                            <TouchableOpacity
                                key={filter.id}
                                className={`px-4 py-2 rounded-full ${
                                    selectedFilter === filter.id 
                                        ? 'bg-green-500' 
                                        : 'bg-gray-800'
                                }`}
                                onPress={() => setSelectedFilter(filter.id)}
                            >
                                <Text className={`text-sm font-medium ${
                                    selectedFilter === filter.id 
                                        ? 'text-white' 
                                        : 'text-gray-400'
                                }`}>
                                    {filter.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* History List */}
            <ScrollView 
                className="flex-1 px-4 pt-4"
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh}
                        tintColor="#10B981"
                        colors={['#10B981']}
                    />
                }
            >
                {filteredHistory.length === 0 ? (
                    <View className="items-center justify-center py-12">
                        <Ionicons name="time-outline" size={64} color="#374151" />
                        <Text className="text-lg font-semibold text-gray-400 mt-4">
                            No History Found
                        </Text>
                        <Text className="text-sm text-gray-500 text-center mt-1">
                            {searchQuery 
                                ? 'Try adjusting your search' 
                                : 'No deliveries in this period'}
                        </Text>
                    </View>
                ) : (
                    filteredHistory.map(renderHistoryCard)
                )}
                <View className="h-4" />
            </ScrollView>
        </SafeAreaView>
    );
}