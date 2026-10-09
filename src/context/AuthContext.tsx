import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/config/constants';
import { loginApi, logoutApi, UserProfile, LoginCredentials, decodeJwt } from '@/api/auth';

interface AuthContextData {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (profileUpdates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const storedProfile = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);

        if (isCancelled) return;

        if (storedToken) {
          // Validate expiry
          const decoded = decodeJwt(storedToken);
          if (decoded?.exp && decoded.exp * 1000 < Date.now()) {
            // Token expired
            await logoutApi();
            if (!isCancelled) {
              setUser(null);
              setToken(null);
            }
          } else {
            setToken(storedToken);
            if (storedProfile) {
              setUser(JSON.parse(storedProfile));
            } else if (decoded?.sub) {
              setUser({
                login: decoded.sub,
                nome: decoded.sub,
                role: decoded.role || 'ROLE_MOTORISTA',
              });
            }
          }
        }
      } catch {
        // Storage error
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const { token: receivedToken, profile } = await loginApi(credentials);
      setToken(receivedToken);
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutApi();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (profileUpdates: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...profileUpdates };
      void AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        isLoading,
        user,
        token,
        login,
        logout,
        updateUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
