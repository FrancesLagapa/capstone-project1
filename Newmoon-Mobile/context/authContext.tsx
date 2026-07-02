import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveToken, getToken, deleteToken } from '../lib/authStorage';
import {
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
import { normalizeUserType, type MobileUserType } from '../lib/userType';

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
    userType?: MobileUserType;
  }>;
  register: (formData: Record<string, string>) => Promise<{
    success: boolean;
    token?: string;
    user?: any;
    error?: string;
    errors?: Record<string, string>;
    userType?: MobileUserType;
  }>;
  signOut: () => Promise<void>;
  user: any;
  userType: MobileUserType | null;
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

  // Get stored user type from secure storage
  let storedUserType =
    normalizeUserType(String(storedUser?.userType || storedUser?.role || '')) || 'staff';

  return {
    success: true as const,
    user: storedUser,
    offline: true,
    userType: storedUserType,
  };
}

async function persistAuthSession(
  token: string,
  loggedInUser: any,
  resolvedUserType: MobileUserType,
  username?: string,
  password?: string
) {
  await saveToken(token);

  const userWithType = {
    ...loggedInUser,
    role: loggedInUser?.role,
    userType: resolvedUserType,
  };

  const cachedUser = await cacheStaffContextAfterLogin(userWithType);

  if (username && password) {
    await saveOfflineCredentials(
      username,
      password,
      cachedUser?.firstname,
      cachedUser?.lastname,
      resolvedUserType
    );
  }

  return cachedUser;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userType, setUserType] = useState<MobileUserType | null>(null);

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
              setUserType(
                normalizeUserType(String(storedUser?.userType || storedUser?.role || '')) || 'staff'
              );
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
        setUserType(
          normalizeUserType(String(storedUser?.userType || storedUser?.role || '')) || 'staff'
        );
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
        const { token, user: loggedInUser, user_type: responseUserType, role: responseRole } = response.data;

        const resolvedUserType =
          normalizeUserType(responseUserType) ||
          normalizeUserType(loggedInUser?.user_type) ||
          normalizeUserType(loggedInUser?.role) ||
          normalizeUserType(responseRole);

        if (!resolvedUserType) {
          return {
            success: false,
            error: 'This account is not authorized for mobile access.',
          };
        }

        const cachedUser = await persistAuthSession(
          token,
          { ...loggedInUser, role: loggedInUser?.role || responseRole },
          resolvedUserType,
          username,
          password
        );

        setUser(cachedUser);
        setUserType(resolvedUserType);
        setIsAuthenticated(true);
        setIsOfflineSession(false);

        return {
          success: true,
          token,
          user: cachedUser,
          userType: resolvedUserType,
        };
      } catch (error: any) {
        if (isNetworkError(error)) {
          const offlineResult = await loginOffline(username, password);
          if (offlineResult.success) {
            const offlineType = normalizeUserType(offlineResult.userType) || 'staff';
            setUser(offlineResult.user);
            setUserType(offlineType);
            setIsAuthenticated(true);
            setIsOfflineSession(true);
            return {
              success: true,
              user: offlineResult.user,
              offline: true,
              userType: offlineType,
            };
          }
          return { success: false, error: offlineResult.error };
        }

        if (error?.response?.status === 403) {
          return {
            success: false,
            error: error?.response?.data?.message || 'You do not have permission to access this account type.',
          };
        }

        const errorMessage =
          error?.response?.data?.message || error?.message || 'Login failed';
        return { success: false, error: errorMessage };
      }
    }

    const offlineResult = await loginOffline(username, password);
    if (offlineResult.success) {
      const offlineType = normalizeUserType(offlineResult.userType) || 'staff';
      setUser(offlineResult.user);
      setUserType(offlineType);
      setIsAuthenticated(true);
      setIsOfflineSession(true);
      return {
        success: true,
        user: offlineResult.user,
        offline: true,
        userType: offlineType,
      };
    }

    return { success: false, error: offlineResult.error };
  };

  const register = async (formData: Record<string, string>) => {
    try {
      const response = await api.post('/register', formData);
      const { token, user: registeredUser } = response.data;

      if (!token || !registeredUser) {
        return {
          success: false,
          error: response.data?.message || 'Registration failed.',
        };
      }

      const resolvedUserType = normalizeUserType(registeredUser?.role) || 'customer';
      const cachedUser = await persistAuthSession(
        token,
        registeredUser,
        resolvedUserType,
        formData.username,
        formData.password
      );

      setUser(cachedUser);
      setUserType(resolvedUserType);
      setIsAuthenticated(true);
      setIsOfflineSession(false);

      return {
        success: true,
        token,
        user: cachedUser,
        userType: resolvedUserType,
      };
    } catch (error: any) {
      if (error?.response?.status === 422 && error?.response?.data?.errors) {
        const serverErrors: Record<string, string> = {};
        Object.entries(error.response.data.errors).forEach(([key, value]) => {
          serverErrors[key] = Array.isArray(value) ? String(value[0]) : String(value);
        });
        return {
          success: false,
          error: Object.values(serverErrors)[0] || 'Please check your inputs.',
          errors: serverErrors,
        };
      }

      return {
        success: false,
        error: error?.response?.data?.message || error?.message || 'Registration failed.',
      };
    }
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
      setUserType(null);
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
        register,
        signOut,
        user,
        userType,
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
