import { apiClient } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/config/constants';

export interface LoginCredentials {
  login: string;
  senha: string;
}

export interface LoginResponseData {
  token: string;
  refreshToken?: string;
}

export interface UserProfile {
  id?: string;
  login: string;
  nome: string;
  email?: string;
  role: string;
  operadorCnpj?: string;
}

export interface DecodedJWTPayload {
  sub?: string;
  role?: string;
  operador?: string;
  flagRegulador?: string;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Decode JWT token payload safely in React Native
 */
export function decodeJwt(token: string): DecodedJWTPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

  try {
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as DecodedJWTPayload;
  } catch {
    try {
      // Fallback for simple base64 ascii
      return JSON.parse(atob(base64)) as DecodedJWTPayload;
    } catch {
      return null;
    }
  }
}

/**
 * Call POST /v1/auth/login and return token response
 */
export async function loginApi(credentials: LoginCredentials): Promise<{
  token: string;
  refreshToken?: string;
  profile: UserProfile;
}> {
  const response = await apiClient.post<LoginResponseData>('/v1/auth/login', credentials);
  const { token, refreshToken } = response.data;

  const decoded = decodeJwt(token);
  const login = decoded?.sub || credentials.login;
  const role = decoded?.role || 'ROLE_MOTORISTA';
  const operadorCnpj = decoded?.operador;

  // Initial driver profile from JWT
  let profile: UserProfile = {
    login,
    nome: login,
    role,
    operadorCnpj,
  };

  // Persist auth tokens first
  await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  if (refreshToken) {
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  // Fetch detailed user data from /v1/api/usuarios
  try {
    const userRes = await apiClient.get<any>('/v1/api/usuarios', {
      params: { login },
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = userRes.data?.data || userRes.data;
    const foundUser = Array.isArray(data) ? data[0] : data;
    if (foundUser) {
      profile = {
        id: foundUser.id,
        login: foundUser.login || login,
        nome: foundUser.nome || foundUser.login || login,
        email: foundUser.email,
        role: foundUser.role || role,
        operadorCnpj: foundUser.operador?.cnpj || operadorCnpj,
      };
    }
  } catch {
    // Keep base profile if endpoint is unavailable
  }

  // Persist profile
  await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));

  return { token, refreshToken, profile };
}

/**
 * Logout and clear stored session
 */
export async function logoutApi(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER_PROFILE,
    STORAGE_KEYS.ACTIVE_TRIP,
  ]);
}
