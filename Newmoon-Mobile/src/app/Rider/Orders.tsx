// app/rider/Orders.tsx
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function OrdersScreen() {
    // Sample orders data
    const orders = [
        {
            id: '1',
            orderNumber: '#NL-2026-001',
            customer: 'Maria Santos',
            address: '123 Mabini St., Makati City',
            items: 'Lechon Belly, Pork BBQ',
            total: '₱4,250',
            status: 'Pending',
            time: '10:30 AM'
        },
        {
            id: '2',
            orderNumber: '#NL-2026-002',
            customer: 'John Reyes',
            address: '456 Dela Rosa St., Mandaluyong',
            items: 'Crispy Pata, Lechon Kawali',
            total: '₱2,020',
            status: 'Preparing',
            time: '11:15 AM'
        },
        {
            id: '3',
            orderNumber: '#NL-2026-003',
            customer: 'Ana Garcia',
            address: '789 C5 Road, Quezon City',
            items: 'Lechon Manok, Pancit',
            total: '₱2,030',
            status: 'Ready',
            time: '09:00 AM'
        },
        {
            id: '4',
            orderNumber: '#NL-2026-004',
            customer: 'Mike Tan',
            address: '101 BGC, Taguig City',
            items: 'Sizzling Sisig, Buko Juice',
            total: '₱920',
            status: 'Delivered',
            time: '12:30 PM'
        }
    ];

    const getStatusColor = (status: string) => {
        const colors: any = {
            'Pending': '#F59E0B',
            'Preparing': '#3B82F6',
            'Ready': '#8B5CF6',
            'Delivered': '#10B981',
            'Cancelled': '#EF4444'
        };
        return colors[status] || '#9CA3AF';
    };

    const getStatusIcon = (status: string) => {
        const icons: any = {
            'Pending': 'pending',
            'Preparing': 'schedule',
            'Ready': 'check-circle',
            'Delivered': 'check-circle',
            'Cancelled': 'cancel'
        };
        return icons[status] || 'help';
    };

    return (
        <SafeAreaView className="flex-1 bg-black">
            {/* Header */}
            <View className="bg-gray-900 px-4 py-4 border-b border-gray-800">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
                        <Icon name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-white">Orders</Text>
                    <View className="ml-auto bg-green-900/30 border border-green-800 px-3 py-1 rounded-xl">
                        <Text className="text-green-400 text-xs font-medium">{orders.length} Orders</Text>
                    </View>
                </View>
            </View>

            {/* Orders List */}
            <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
                {orders.map((order) => (
                    <TouchableOpacity 
                        key={order.id} 
                        className="bg-gray-900 rounded-2xl p-4 mb-3 border border-gray-800"
                        activeOpacity={0.7}
                    >
                        {/* Order Header */}
                        <View className="flex-row justify-between items-center mb-3">
                            <View className="flex-row items-center">
                                <View className="bg-green-900/30 p-2 rounded-xl mr-2">
                                    <Icon name="receipt" size={16} color="#10B981" />
                                </View>
                                <Text className="text-sm font-bold text-white">{order.orderNumber}</Text>
                            </View>
                            <View 
                                className="px-3 py-1 rounded-full flex-row items-center"
                                style={{ backgroundColor: getStatusColor(order.status) + '20' }}
                            >
                                <Icon 
                                    name={getStatusIcon(order.status)} 
                                    size={12} 
                                    color={getStatusColor(order.status)} 
                                    style={{ marginRight: 4 }}
                                />
                                <Text 
                                    className="text-xs font-medium"
                                    style={{ color: getStatusColor(order.status) }}
                                >
                                    {order.status}
                                </Text>
                            </View>
                        </View>

                        {/* Customer Info */}
                        <View className="mb-2">
                            <View className="flex-row items-center mb-1">
                                <Icon name="person" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
                                <Text className="text-base font-semibold text-white">{order.customer}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Icon name="location-on" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
                                <Text className="text-xs text-gray-400">{order.address}</Text>
                            </View>
                        </View>

                        {/* Items */}
                        <View className="bg-gray-800/50 rounded-xl p-3 mb-3">
                            <View className="flex-row items-center">
                                <Icon name="restaurant" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
                                <Text className="text-xs text-gray-300">{order.items}</Text>
                            </View>
                        </View>

                        {/* Footer */}
                        <View className="flex-row justify-between items-center pt-3 border-t border-gray-800">
                            <View className="flex-row items-center">
                                <Icon name="access-time" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                                <Text className="text-xs text-gray-500">{order.time}</Text>
                            </View>
                            <View className="flex-row items-center bg-green-900/20 px-3 py-1 rounded-full border border-green-800/30">
                                <Icon name="attach-money" size={16} color="#10B981" style={{ marginRight: 4 }} />
                                <Text className="text-sm font-bold text-green-400">{order.total}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                {/* Empty State - Uncomment if needed */}
                {/* {orders.length === 0 && (
                    <View className="bg-gray-900 rounded-2xl p-8 border border-gray-800 items-center mt-10">
                        <View className="bg-gray-800 p-4 rounded-full mb-3">
                            <Icon name="inbox" size={40} color="#4B5563" />
                        </View>
                        <Text className="text-white text-lg font-bold mb-1">No Orders</Text>
                        <Text className="text-gray-400 text-sm text-center">You don't have any orders yet</Text>
                    </View>
                )} */}

                {/* Footer Spacer */}
                <View className="h-4" />
            </ScrollView>
        </SafeAreaView>
    );
}