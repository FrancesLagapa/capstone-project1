import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useOffline } from '../context/offlineContext';

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <View
      className={`mx-4 mt-2 mb-1 rounded-xl px-4 py-3 flex-row items-center ${
        isOnline ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'
      }`}
    >
      <Icon
        name={isOnline ? 'cloud-upload' : 'cloud-off'}
        size={20}
        color={isOnline ? '#D97706' : '#DC2626'}
      />
      <View className="flex-1 ml-3">
        <Text className={`text-sm font-semibold ${isOnline ? 'text-amber-800' : 'text-red-800'}`}>
          {isOnline ? 'Back online' : 'Offline mode'}
        </Text>
        <Text className={`text-xs mt-0.5 ${isOnline ? 'text-amber-700' : 'text-red-700'}`}>
          {isOnline
            ? pendingCount > 0
              ? `${pendingCount} item(s) waiting to sync`
              : 'Syncing saved data...'
            : 'Actions are saved locally and will sync when connected'}
        </Text>
      </View>
      {isOnline && pendingCount > 0 && (
        <TouchableOpacity
          onPress={() => syncNow()}
          disabled={isSyncing}
          className="bg-amber-500 px-3 py-1.5 rounded-lg"
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white text-xs font-bold">Sync</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
