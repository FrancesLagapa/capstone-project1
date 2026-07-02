import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center items-center bg-blue-600 px-6">
      <Text className="text-white text-3xl font-bold mb-4 text-center">
        New Moon Lechon House
      </Text>
      <Text className="text-white/80 text-center mb-8">
        Welcome to the Mobile App
      </Text>
      <TouchableOpacity
        className="bg-white p-4 rounded-xl items-center w-full"
        onPress={() => router.push('/Login')}
      >
        <Text className="text-blue-600 font-bold text-lg">Go to Login</Text>
      </TouchableOpacity>
    </View>
  );
}
