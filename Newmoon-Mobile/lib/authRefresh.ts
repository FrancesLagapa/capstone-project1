import axios from 'axios';
import { saveToken } from './authStorage';
import { getOfflineCredentials } from './userStorage';
import { cacheStaffContextAfterLogin } from './staffContext';

const API_BASE = 'http://192.168.254.106:8000/api';

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAuthToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const creds = await getOfflineCredentials();
      if (!creds) {
        console.log('[AUTH REFRESH] No stored credentials');
        return null;
      }

      console.log('[AUTH REFRESH] Refreshing token for', creds.username);
      const response = await axios.post(
        `${API_BASE}/login`,
        { username: creds.username, password: creds.password },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      const { token, user } = response.data ?? {};
      if (!token) {
        console.log('[AUTH REFRESH] Login response missing token');
        return null;
      }

      await saveToken(token);
      if (user) {
        await cacheStaffContextAfterLogin(user);
      }
      console.log('[AUTH REFRESH] Token refreshed successfully');
      return token;
    } catch (error: any) {
      console.log('[AUTH REFRESH] Failed:', error?.response?.data?.message || error?.message);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
