import "../../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "../../context/authContext";
import { OfflineProvider } from "../../context/offlineContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
            <OfflineProvider>
                    <Stack
                        screenOptions={{
                            headerShown: false, // Hides header for ALL screens
                        }}
                    >
                        <Stack.Screen
                            name='Login'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Staff'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Registration'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Customer'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Rider'
                            options={{ headerShown: false }}
                        />
                    </Stack>
            </OfflineProvider>
            </AuthProvider>
        </QueryClientProvider>
    )
}