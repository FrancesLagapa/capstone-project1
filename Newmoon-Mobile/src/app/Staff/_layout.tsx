import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import OfflineBanner from '../../../components/OfflineBanner';

export default function StaffTabsLayout() {
    return (
        <View className="flex-1 bg-black">
        <OfflineBanner />
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#2563EB',
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#E5E7EB',
                    height: 65,
                    paddingBottom: 10,
                    paddingTop: 10,
                    boxShadow: '0px -2px 3px rgba(0, 0, 0, 0.05)',
                    elevation: 5,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginBottom: 4,
                },
                headerShown: false,
                tabBarHideOnKeyboard: true,
            }}
        >
            <Tabs.Screen
                name="Dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons 
                            name={focused ? 'home' : 'home-outline'} 
                            size={24} 
                            color={color} 
                        />
                    ),
                }}
            />
            
            <Tabs.Screen
                name="Attendance"
                options={{
                    title: 'Attendance',
                    tabBarLabel: 'Attendance',
                    tabBarIcon: ({ color, size, focused }) => (
                        <FontAwesome5 
                            name={focused ? 'calendar-check' : 'calendar-alt'} 
                            size={22} 
                            color={color} 
                        />
                    ),
                }}
            />
            
            <Tabs.Screen
                name="PointOfSales"
                options={{
                    title: 'Point of Sales',
                    tabBarLabel: 'POS',
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name={focused ? 'point-of-sale' : 'shopping-cart'} 
                            size={24} 
                            color={color} 
                        />
                    ),
                }}
            />
            
            <Tabs.Screen
                name="SalaryAdvance"
                options={{
                    title: 'Cash Advance',
                    tabBarLabel: 'Cash Advance',
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name={focused ? 'account-balance-wallet' : 'account-balance-wallet'} 
                            size={24} 
                            color={color} 
                        />
                    ),
                }}
            />
            
            <Tabs.Screen
                name="StockRequest"
                options={{
                    title: 'Stock Request',
                    tabBarLabel: 'Stock Request',
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name={focused ? 'inventory' : 'inventory-2'} 
                            size={24} 
                            color={color} 
                        />
                    ),
                }}
            />
            
            <Tabs.Screen
                name="PullOut"
                options={{
                    title: 'Pull Out',
                    tabBarLabel: 'Pull Out',
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name={focused ? 'delete-outline' : 'delete'} 
                            size={24} 
                            color={color} 
                        />  
                    ),
                }}
            />

            <Tabs.Screen
                name="Profile"
                options={{
                    title: 'Profile',
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons 
                            name={focused ? 'person-circle' : 'person-circle-outline'} 
                            size={24} 
                            color={color} 
                        />
                    ),
                }}
            />
        </Tabs>
        </View>
    );
}