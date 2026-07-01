import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { subscribeToNetwork } from '../lib/network';
import { getQueueCount } from '../lib/offlineQueue';
import { syncOfflineQueue, SyncResult } from '../lib/offlineApi';

type OfflineContextType = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  refreshPendingCount: () => Promise<void>;
  syncNow: () => Promise<SyncResult>;
};

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await getQueueCount();
    setPendingCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      setLastSyncResult(result);
      await refreshPendingCount();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
    const unsubscribe = subscribeToNetwork(async (online) => {
      setIsOnline(online);
      if (online) {
        await syncNow();
      }
    });
    return unsubscribe;
  }, [refreshPendingCount, syncNow]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        lastSyncResult,
        refreshPendingCount,
        syncNow,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
}
