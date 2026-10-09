import { Platform } from 'react-native';

/**
 * Transmit interval in milliseconds (1 minute as per specification)
 */
export const DEFAULT_TRANSMIT_INTERVAL_MS = 60000;

/**
 * Default API host based on platform:
 * Android Emulator uses 10.0.2.2 to connect to host machine localhost
 */
const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export const DEFAULT_API_BASE_URL = `${DEFAULT_HOST}/citmobi`;

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@citmobi_auth_token',
  REFRESH_TOKEN: '@citmobi_refresh_token',
  USER_PROFILE: '@citmobi_user_profile',
  ACTIVE_TRIP: '@citmobi_active_trip',
  OFFLINE_COORDINATES_QUEUE: '@citmobi_offline_coords_queue',
  API_BASE_URL: '@citmobi_api_base_url',
} as const;

export const LOCATION_TASK_NAME = 'CITMOBI_BACKGROUND_LOCATION_TASK';

export const COLORS = {
  // Brand
  primary: '#00B4D8',
  primaryDark: '#0096C7',
  primaryLight: '#E0F2FE',
  brandGradient: ['#00B4D8', '#0096C7'] as const,

  // Action / State
  actionGreen: '#22C55E',
  actionGreenDark: '#16A34A',
  actionGreenGlow: 'rgba(34, 197, 94, 0.35)',

  activeGray: '#64748B',
  activeGrayDark: '#475569',
  activeGrayGlow: 'rgba(100, 116, 139, 0.3)',
  disabledGray: '#94A3B8',

  dangerRed: '#EF4444',
  dangerRedDark: '#DC2626',
  warningAmber: '#F59E0B',
  infoBlue: '#3B82F6',

  // Layout & Neutrals
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  cardBorder: '#E2E8F0',
  inputBackground: '#F1F5F9',
  inputBorder: '#CBD5E1',

  // Typography
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textWhite: '#FFFFFF',
} as const;
