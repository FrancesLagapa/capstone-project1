import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveToken, getToken, deleteToken } from '../lib/authStorage';
import {
  saveUser,
  getUser,
  deleteUser,
  saveOfflineCredentials,
  deleteOfflineCredentials,
  validateOfflineLogin,
} from '../lib/userStorage';
import { hasNetworkConnection, isNetworkError, subscribeToNetwork } from '../lib/network';
import api from '../lib/api';
import { cacheStaffContextAfterLogin } from '../lib/staffContext';
import { refreshAuthToken } from '../lib/authRefresh';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isOfflineSession: boolean;
  isReauthenticating: boolean;
  login: (username: string, password: string) => Promise<{
    success: boolean;
    token?: string;
    user?: any;
    error?: string;
    offline?: boolean;
  }>;
  signOut: () => Promise<void>;
  user: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loginOffline(username: string, password: string) {
  const canLoginOffline = await validateOfflineLogin(username, password);
  if (!canLoginOffline) {
    return {
      success: false as const,
      error: 'No internet connection. Log in online once on this device first.',
    };
  }

  const storedUser = await getUser();
  const token = await getToken();
  if (!storedUser?.id || !token) {
    return {
      success: false as const,
      error: 'No saved session on this device. Connect to the internet and log in once.',
    };
  }

  return {
    success: true as const,
    user: storedUser,
    offline: true,
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNetwork(async (online) => {
      if (online && isAuthenticated && isOfflineSession && !isReauthenticating) {
        setIsReauthenticating(true);
        try {
          const token = await refreshAuthToken();
          if (token) {
            const storedUser = await getUser();
            if (storedUser) {
              setUser(storedUser);
            }
            setIsOfflineSession(false);
            console.log('[AUTH] Session restored after coming back online');
          }
        } catch (error) {
          console.error('[AUTH] Re-authentication failed:', error);
        } finally {
          setIsReauthenticating(false);
        }
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, isOfflineSession, isReauthenticating]);

  const checkAuth = async () => {
    try {
      const token = await getToken();
      const storedUser = await getUser();
      if (token && storedUser) {
        setUser(storedUser);
        setIsAuthenticated(true);
        const connected = await hasNetworkConnection();
        setIsOfflineSession(!connected);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const connected = await hasNetworkConnection();

    if (connected) {
      try {
        const response = await api.post('/login', { username, password });
        const { token, user: loggedInUser } = response.data;
        await saveToken(token);
        const cachedUser = await cacheStaffContextAfterLogin(loggedInUser);
        await saveOfflineCredentials(
          username,
          password,
          cachedUser?.firstname,
          cachedUser?.lastname
        );
        setUser(cachedUser);
        setIsAuthenticated(true);
        setIsOfflineSession(false);
        return { success: true, token, user: cachedUser };
      } catch (error: any) {
        if (isNetworkError(error)) {
          const offlineResult = await loginOffline(username, password);
          if (offlineResult.success) {
            setUser(offlineResult.user);
            setIsAuthenticated(true);
            setIsOfflineSession(true);
            return { success: true, user: offlineResult.user, offline: true };
          }
          return { success: false, error: offlineResult.error };
        }

        const errorMessage =
          error?.response?.data?.message || error?.message || 'Login failed';
        return { success: false, error: errorMessage };
      }
    }

    const offlineResult = await loginOffline(username, password);
    if (offlineResult.success) {
      setUser(offlineResult.user);
      setIsAuthenticated(true);
      setIsOfflineSession(true);
      return { success: true, user: offlineResult.user, offline: true };
    }

    return { success: false, error: offlineResult.error };
  };

  const signOut = async () => {
    try {
      const connected = await hasNetworkConnection();
      if (connected) {
        try {
          await api.post('logout');
        } catch {
          // ignore logout API errors
        }
      }
      await deleteToken();
      await deleteUser();
      await deleteOfflineCredentials();
      setUser(null);
      setIsAuthenticated(false);
      setIsOfflineSession(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isOfflineSession,
        isReauthenticating,
        login,
        signOut,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
