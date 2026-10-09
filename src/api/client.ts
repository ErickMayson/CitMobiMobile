import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from '@/config/constants';

let currentBaseUrl = DEFAULT_API_BASE_URL;

export const setApiBaseUrl = async (url: string) => {
  currentBaseUrl = url.trim().replace(/\/+$/, '');
  await AsyncStorage.setItem(STORAGE_KEYS.API_BASE_URL, currentBaseUrl);
  apiClient.defaults.baseURL = currentBaseUrl;
};

export const getApiBaseUrl = (): string => currentBaseUrl;

// eslint-disable-next-line import/no-named-as-default-member
export const apiClient = axios.create({
  baseURL: currentBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Initialize base URL from AsyncStorage if previously stored
AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL).then((saved) => {
  if (saved) {
    currentBaseUrl = saved;
    apiClient.defaults.baseURL = saved;
  }
}).catch(() => {});

// Request interceptor: Attach JWT Bearer token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore storage errors in request interceptor
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 and token refresh
let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Avoid infinite loop on auth endpoints
    if (
      !originalRequest ||
      originalRequest.url?.includes('/v1/auth/login') ||
      originalRequest.url?.includes('/v1/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post<{ token: string; refreshToken?: string }>(
          `${currentBaseUrl}/v1/auth/refresh`,
          { refreshToken }
        );

        const { token: newToken, refreshToken: newRefreshToken } = response.data;
        if (newToken) {
          await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, newToken);
          if (newRefreshToken) {
            await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
          }
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          processQueue(null);
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr);
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.AUTH_TOKEN,
          STORAGE_KEYS.REFRESH_TOKEN,
          STORAGE_KEYS.USER_PROFILE,
        ]);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
