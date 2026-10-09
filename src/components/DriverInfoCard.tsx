import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/config/constants';
import { theme } from '@/styles/theme';
import { UserProfile } from '@/api/auth';
import { ViagemResponse } from '@/api/tracking';

interface DriverInfoCardProps {
  user: UserProfile | null;
  activeTrip: ViagemResponse | null;
  isTripActive: boolean;
}

export const DriverInfoCard: React.FC<DriverInfoCardProps> = ({
  user,
  activeTrip,
  isTripActive,
}) => {
  // Helper to detect if a value is CPF or purely numeric identifier
  const isCpfOrNumeric = (val?: string): boolean => {
    if (!val) return false;
    const clean = val.replace(/\D/g, '');
    return clean.length === 11 || /^\d+$/.test(val.trim());
  };

  // Determine friendly driver display name, ensuring CPF is never displayed
  const resolveDriverName = (): string => {
    if (activeTrip?.motoristaNome && activeTrip.motoristaNome.trim().length > 0) {
      return activeTrip.motoristaNome.trim();
    }
    if (user?.nome && !isCpfOrNumeric(user.nome) && user.nome !== user?.login) {
      return user.nome.trim();
    }
    return 'Motorista';
  };

  const driverName = resolveDriverName();
  const hasTrip = !!activeTrip;

  const linhaDisplay =
    activeTrip?.linhaCodigo && activeTrip?.linhaDescricao
      ? `${activeTrip.linhaCodigo} - ${activeTrip.linhaDescricao}`
      : activeTrip?.linhaCodigo
      ? `Linha ${activeTrip.linhaCodigo}`
      : 'Nenhuma rota vinculada';

  const veiculoDisplay =
    activeTrip?.veiculoCodigo || activeTrip?.veiculoPlaca
      ? `Ônibus ${activeTrip.veiculoCodigo ? `#${activeTrip.veiculoCodigo}` : ''} (${activeTrip.veiculoPlaca || ''})`
      : 'Nenhum veículo vinculado';

  const statusLabel = isTripActive
    ? 'EM VIAGEM'
    : hasTrip
    ? 'VINCULADO'
    : 'SEM VÍNCULO';

  return (
    <View style={styles.card}>
      {/* Driver Header */}
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>
            {driverName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.driverTextContainer}>
          <Text style={styles.driverGreeting}>MOTORISTA</Text>
          <Text style={styles.driverName} numberOfLines={1}>
            {driverName}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            isTripActive
              ? styles.statusPillActive
              : hasTrip
              ? styles.statusPillLinked
              : styles.statusPillInactive,
          ]}>
          <View
            style={[
              styles.statusDot,
              isTripActive
                ? styles.statusDotActive
                : hasTrip
                ? styles.statusDotLinked
                : styles.statusDotInactive,
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              isTripActive
                ? styles.statusPillTextActive
                : hasTrip
                ? styles.statusPillTextLinked
                : styles.statusPillTextInactive,
            ]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Assignment Details */}
      <View style={styles.detailsRow}>
        {/* Linha / Route */}
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>LINHA</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {linhaDisplay}
          </Text>
        </View>

        {/* Veículo / Bus */}
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>VEÍCULO</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {veiculoDisplay}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarInitial: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.primaryDark,
  },
  driverTextContainer: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  driverGreeting: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  driverName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.textPrimary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    gap: 6,
  },
  statusPillActive: {
    backgroundColor: '#DCFCE7',
  },
  statusPillLinked: {
    backgroundColor: '#E0F2FE',
  },
  statusPillInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: COLORS.actionGreen,
  },
  statusDotLinked: {
    backgroundColor: COLORS.primary,
  },
  statusDotInactive: {
    backgroundColor: COLORS.disabledGray,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5,
  },
  statusPillTextActive: {
    color: COLORS.actionGreenDark,
  },
  statusPillTextLinked: {
    color: COLORS.primaryDark,
  },
  statusPillTextInactive: {
    color: COLORS.activeGray,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: theme.spacing.md,
  },
  detailsRow: {
    gap: theme.spacing.sm,
  },
  detailItem: {
    backgroundColor: COLORS.background,
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: COLORS.textPrimary,
  },
});
