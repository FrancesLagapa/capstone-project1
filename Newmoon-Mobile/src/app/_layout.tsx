import "../../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "../../context/authContext";
import { OfflineProvider } from "../../context/offlineContext";
import AuthRouter from "../../components/AuthRouter";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
            <OfflineProvider>
                <AuthRouter>
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
                            name='staff'
                            options={{ headerShown: false }}
                        />
                    </Stack>
                </AuthRouter>
            </OfflineProvider>
            </AuthProvider>
        </QueryClientProvider>
    )
}