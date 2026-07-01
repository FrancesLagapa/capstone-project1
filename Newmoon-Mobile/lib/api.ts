import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { deleteToken, getToken } from './authStorage';
import { refreshAuthToken } from './authRefresh';
import { hasNetworkConnection } from './network';

const api = axios.create({
  baseURL: 'http://192.168.254.106:8000/api',
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retried) {
      const isLoginRequest = originalRequest.url?.includes('/login');
      if (!isLoginRequest) {
        originalRequest._retried = true;
        const newToken = await refreshAuthToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      }

      const connected = await hasNetworkConnection();
      if (connected) {
        await deleteToken();
      } else {
        console.log('[API] 401 while offline - keeping local session');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
