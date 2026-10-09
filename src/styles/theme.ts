import { StyleSheet } from 'react-native';
import { COLORS } from '@/config/constants';

export const theme = {
  colors: COLORS,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  typography: {
    fontFamily: 'System',
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      title: 28,
      display: 36,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
  shadows: {
    soft: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    card: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    button: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};

export const commonStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
