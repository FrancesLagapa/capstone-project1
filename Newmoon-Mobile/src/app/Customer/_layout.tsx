// app/customer/_layout.tsx (Enhanced Version)
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import OfflineBanner from '../../../components/OfflineBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity } from 'react-native';

export default function CustomerTabsLayout() {
    return (
        <View className="flex-1 bg-gray-50">
            <OfflineBanner />
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: '#007AFF',
                    tabBarInactiveTintColor: '#8E8E93',
                    tabBarStyle: {
                        backgroundColor: 'transparent',
                        borderTopWidth: 0,
                        height: 80,
                        paddingBottom: 10,
                        paddingTop: 10,
                        position: 'absolute',
                        bottom: 16,
                        left: 16,
                        right: 16,
                        elevation: 0,
                        shadowColor: 'transparent',
                    },
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: '600',
                        marginTop: 4,
                    },
                    headerShown: false,
                    tabBarHideOnKeyboard: true,
                }}
                tabBar={(props) => {
                    // Custom tab bar with gradient background
                    return (
                        <View style={styles.tabBarContainer}>
                            <LinearGradient
                                colors={['#FFFFFF', '#F8F9FA']}
                                style={styles.tabBarGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.tabBarInner}>
                                    {props.state.routes.map((route, index) => {
                                        const { options } = props.descriptors[route.key];
                                        const isFocused = props.state.index === index;
                                        
                                        const onPress = () => {
                                            const event = props.navigation.emit({
                                                type: 'tabPress',
                                                target: route.key,
                                                canPreventDefault: true,
                                            });
                                            
                                            if (!isFocused && !event.defaultPrevented) {
                                                props.navigation.navigate(route.name);
                                            }
                                        };
                                        
                                        return (
                                            <TouchableOpacity
                                                key={route.key}
                                                onPress={onPress}
                                                style={styles.tabItem}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[
                                                    styles.iconContainer,
                                                    isFocused && styles.activeIconContainer
                                                ]}>
                                                    {options.tabBarIcon?.({
                                                        color: isFocused ? '#007AFF' : '#8E8E93',
                                                        size: 24,
                                                        focused: isFocused,
                                                    })}
                                                </View>
                                                <Text style={[
                                                    styles.tabLabel,
                                                    isFocused && styles.activeTabLabel
                                                ]}>
                                                    {options.title || route.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </LinearGradient>
                        </View>
                    );
                }}
            >
                <Tabs.Screen
                    name="Home"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons 
                                name={focused ? 'home' : 'home-outline'} 
                                size={24} 
                                color={color} 
                            />
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="Activity"
                    options={{
                        title: 'Activity',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons 
                                name={focused ? 'time' : 'time-outline'} 
                                size={24} 
                                color={color} 
                            />
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="Orders"
                    options={{
                        title: 'Orders',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialIcons 
                                name="shopping-bag" 
                                size={24} 
                                color={color} 
                            />
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="Cart"
                    options={{
                        title: 'Cart',
                        tabBarIcon: ({ color, focused }) => (
                            <View>
                                <Feather 
                                    name="shopping-cart" 
                                    size={22} 
                                    color={color} 
                                />
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>3</Text>
                                </View>
                            </View>
                        ),
                    }}
                />
                
                <Tabs.Screen
                    name="Profile"
                    options={{
                        title: 'Profile',
                        tabBarIcon: ({ color, focused }) => (
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

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBarGradient: {
        width: '100%',
        height: 75,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    tabBarInner: {
        flexDirection: 'row',
        flex: 1,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    iconContainer: {
        padding: 6,
        borderRadius: 12,
    },
    activeIconContainer: {
        backgroundColor: 'rgba(0, 122, 255, 0.12)',
        borderRadius: 12,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        color: '#8E8E93',
        marginTop: 2,
    },
    activeTabLabel: {
        color: '#007AFF',
        fontWeight: '700',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

