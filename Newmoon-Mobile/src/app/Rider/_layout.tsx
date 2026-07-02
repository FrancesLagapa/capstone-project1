// app/rider/_layout.tsx
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import OfflineBanner from '../../../components/OfflineBanner';

export default function RiderTabsLayout() {
    return (
        <View className="flex-1 bg-black">
            <OfflineBanner />
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: '#10B981',
                    tabBarInactiveTintColor: '#9CA3AF',
                    tabBarStyle: {
                        backgroundColor: '#1F2937',
                        borderTopWidth: 0,
                        height: 75,
                        paddingBottom: 8,
                        paddingTop: 8,
                        shadowColor: '#000',
                        shadowOffset: {
                            width: 0,
                            height: -3,
                        },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                        borderRadius: 20,
                        marginHorizontal: 16,
                        marginBottom: 12,
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                    },
                    tabBarLabelStyle: {
                        fontSize: 10,
                        fontWeight: '500',
                        marginTop: 2,
                        marginBottom: 2,
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
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ 
                                    padding: 4, 
                                    borderRadius: 25,
                                    backgroundColor: focused ? 'rgba(16, 185, 129, 0.2)' : 'transparent'
                                }}>
                                    <Ionicons 
                                        name={focused ? 'home' : 'home-outline'} 
                                        size={24} 
                                        color={color} 
                                    />
                                </View>
                            </View>
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="Orders"
                    options={{
                        title: 'Orders',
                        tabBarLabel: 'Orders',
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ 
                                    padding: 4, 
                                    borderRadius: 25,
                                    backgroundColor: focused ? 'rgba(16, 185, 129, 0.2)' : 'transparent'
                                }}>
                                    <MaterialIcons 
                                        name={focused ? 'list-alt' : 'list-alt'} 
                                        size={24} 
                                        color={color} 
                                    />
                                </View>
                            </View>
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="Map"
                    options={{
                        title: 'Map',
                        tabBarLabel: 'Map',
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ 
                                    padding: 4, 
                                    borderRadius: 25,
                                    backgroundColor: focused ? 'rgba(16, 185, 129, 0.2)' : 'transparent'
                                }}>
                                    <FontAwesome5 
                                        name={focused ? 'map' : 'map'} 
                                        size={22} 
                                        color={color} 
                                    />
                                </View>
                            </View>
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="History"
                    options={{
                        title: 'History',
                        tabBarLabel: 'History',
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ 
                                    padding: 4, 
                                    borderRadius: 25,
                                    backgroundColor: focused ? 'rgba(16, 185, 129, 0.2)' : 'transparent'
                                }}>
                                    <Ionicons 
                                        name={focused ? 'time' : 'time-outline'} 
                                        size={24} 
                                        color={color} 
                                    />
                                </View>
                            </View>
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="Earnings"
                    options={{
                        title: 'Earnings',
                        tabBarLabel: 'Earnings',
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ 
                                    padding: 4, 
                                    borderRadius: 25,
                                    backgroundColor: focused ? 'rgba(16, 185, 129, 0.2)' : 'transparent'
                                }}>
                                    <MaterialIcons 
                                        name={focused ? 'account-balance-wallet' : 'account-balance-wallet'} 
                                        size={24} 
                                        color={color} 
                                    />
                                </View>
                            </View>
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="Profile"
                    options={{
                        title: 'Profile',
                        tabBarLabel: 'Profile',
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ 
                                    padding: 4, 
                                    borderRadius: 25,
                                    backgroundColor: focused ? 'rgba(16, 185, 129, 0.2)' : 'transparent'
                                }}>
                                    <Ionicons 
                                        name={focused ? 'person-circle' : 'person-circle-outline'} 
                                        size={24} 
                                        color={color} 
                                    />
                                </View>
                            </View>
                        ),
                    }}
                />
            </Tabs>
        </View>
    );
}