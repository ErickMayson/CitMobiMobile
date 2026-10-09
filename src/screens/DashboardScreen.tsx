import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { ClockHeader } from '@/components/ClockHeader';
import { DriverInfoCard } from '@/components/DriverInfoCard';
import { BigCircleButton } from '@/components/BigCircleButton';
import { COLORS } from '@/config/constants';
import { theme } from '@/styles/theme';
import {
  locationService,
  TrackingStatus,
} from '@/services/locationService';
import {
  getVinculoAtualMotoristaApi,
  getViagensAtivasApi,
  iniciarViagemApi,
  ViagemResponse,
} from '@/api/tracking';

export const DashboardScreen: React.FC = () => {
  const { user, logout, updateUser } = useAuth();

  // Tracking state from locationService
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>(
    locationService.getStatus()
  );
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Stop Trip Confirmation Modal
  const [showStopModal, setShowStopModal] = useState<boolean>(false);

  // Assigned trip state fetched from server
  const [assignedTrip, setAssignedTrip] = useState<ViagemResponse | null>(null);

  // Subscribe to locationService updates
  useEffect(() => {
    const unsubscribe = locationService.subscribe((status) => {
      setTrackingStatus(status);
      if (status.activeTrip) {
        setAssignedTrip(status.activeTrip);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch driver active trip assignment from backend
  const fetchDriverAssignment = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Check official driver assignment endpoint (/v1/api/viagens/motorista/atual)
      const vinculo = await getVinculoAtualMotoristaApi();
      if (vinculo) {
        const mappedTrip: ViagemResponse = {
          id: vinculo.viagemId || 0,
          motoristaId: vinculo.motoristaId,
          motoristaNome: vinculo.motoristaNome,
          veiculoId: vinculo.veiculoId || 0,
          veiculoCodigo: vinculo.veiculoCodigo || undefined,
          veiculoPlaca: vinculo.veiculoPlaca || undefined,
          linhaId: vinculo.linhaId || 0,
          linhaCodigo: vinculo.linhaCodigo || undefined,
          linhaDescricao: vinculo.linhaDescricao || undefined,
          rotaId: vinculo.rotaId || 0,
          sentido: vinculo.sentido || undefined,
          status: vinculo.hasViagemAtiva ? 'EM_ANDAMENTO' : 'CANCELADA',
        };

        setAssignedTrip(mappedTrip);

        if (vinculo.motoristaNome && user.nome !== vinculo.motoristaNome) {
          void updateUser({
            nome: vinculo.motoristaNome,
            id: vinculo.motoristaId || user.id,
          });
        }
        return;
      }

      // 2. Fallback: check if there's any active trip in /v1/api/viagens/ativas
      const ativas = await getViagensAtivasApi();
      const myTrip = ativas.find(
        (v: ViagemResponse) =>
          (user.id && v.motoristaId === user.id) ||
          (user.nome && v.motoristaNome?.toLowerCase() === user.nome.toLowerCase()) ||
          (user.login && v.motoristaNome?.toLowerCase() === user.login.toLowerCase())
      );

      if (myTrip) {
        setAssignedTrip(myTrip);
        if (myTrip.motoristaNome && user.nome !== myTrip.motoristaNome) {
          void updateUser({
            nome: myTrip.motoristaNome,
            id: myTrip.motoristaId || user.id,
          });
        }
      } else if (!locationService.getStatus().isTracking) {
        setAssignedTrip(null);
      }
    } catch {
      // Keep existing state on network error
    }
  }, [user, updateUser]);

  // Initial load
  useEffect(() => {
    let isCancelled = false;

    const loadInitialData = async () => {
      if (isCancelled) return;
      await fetchDriverAssignment();
    };

    void loadInitialData();

    return () => {
      isCancelled = true;
    };
  }, [fetchDriverAssignment]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDriverAssignment();
    setRefreshing(false);
  };

  const currentTrip = trackingStatus.activeTrip || assignedTrip;
  const isUnassigned = !currentTrip && !trackingStatus.isTracking;

  // Handle Central Button Press
  const handleCentralButtonPress = () => {
    if (isUnassigned) {
      // Driver has no assigned route -> recheck assignment and alert
      setActionLoading(true);
      fetchDriverAssignment().then(() => {
        setActionLoading(false);
        Alert.alert(
          'Sem Vínculo',
          'Você não está vinculado a nenhum veículo nesse momento, consulte com o Fiscal responsável.',
          [{ text: 'OK' }]
        );
      });
      return;
    }

    if (trackingStatus.isTracking) {
      // Active trip -> Open Stop Confirmation Modal
      setShowStopModal(true);
    } else if (currentTrip) {
      // Inactive trip with assignment -> Start Trip
      handleStartTrip(currentTrip);
    }
  };

  const handleStartTrip = async (tripToStart: ViagemResponse) => {
    setActionLoading(true);
    try {
      // 1. Verify location permissions
      const { foreground } = await locationService.requestPermissions();
      if (!foreground) {
        Alert.alert(
          'Permissão Necessária',
          'Para iniciar a viagem, o aplicativo precisa de permissão de acesso à sua localização GPS.',
          [{ text: 'OK' }]
        );
        setActionLoading(false);
        return;
      }

      // 2. If trip has no ID yet (assigned from escala), call POST /v1/api/viagens/iniciar
      let trip = tripToStart;
      if (!trip.id || trip.id === 0) {
        const started = await iniciarViagemApi({
          motoristaId: trip.motoristaId,
          veiculoId: trip.veiculoId,
          linhaId: trip.linhaId,
          rotaId: trip.rotaId,
        });
        trip = started;
        setAssignedTrip(started);
      }

      // 3. Start GPS tracking engine with the active trip
      await locationService.startTrip(trip);
    } catch (err: any) {
      Alert.alert('Erro ao Iniciar Viagem', err?.message || 'Falha ao iniciar viagem no servidor.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmStopTrip = async () => {
    setShowStopModal(false);
    setActionLoading(true);

    try {
      const tripId = trackingStatus.activeTrip?.id || assignedTrip?.id || 0;
      await locationService.stopTrip(tripId);
      setAssignedTrip(null);
      Alert.alert('Viagem Encerrada', 'A viagem foi concluída com sucesso.');
      await fetchDriverAssignment();
    } catch (err: any) {
      Alert.alert('Erro ao Finalizar', err?.message || 'Falha ao encerrar a viagem.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    if (trackingStatus.isTracking) {
      Alert.alert(
        'Viagem em Andamento',
        'Por favor, finalize a viagem antes de sair da sua conta.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert('Sair da Conta', 'Deseja realmente encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandTitleRow}>
          <Text style={styles.brandLogo}>🚌</Text>
          <Text style={styles.brandName}>CitMobi</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>MOTORISTA</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        {/* Real-time Clock Header */}
        <ClockHeader showDate={true} />

        {/* Driver and Assignment Info Card */}
        <DriverInfoCard
          user={user}
          activeTrip={currentTrip}
          isTripActive={trackingStatus.isTracking}
        />

        {/* Central Action Button ("O Círculo Central") */}
        <View style={styles.buttonCenterArea}>
          <BigCircleButton
            isActive={trackingStatus.isTracking}
            isLoading={actionLoading}
            isUnassigned={isUnassigned}
            unassignedMessage="Você não está vinculado a nenhum veiculo nesse momento, consulte com o Fiscal responsável"
            onPress={handleCentralButtonPress}
          />

          {/* Quick Refresh link if unassigned */}
          {isUnassigned && (
            <TouchableOpacity
              style={styles.refreshLink}
              onPress={onRefresh}
              activeOpacity={0.7}>
              <Text style={styles.refreshLinkText}>🔄 Atualizar vínculo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Transmission & GPS Status Badge */}
        {trackingStatus.isTracking && (
          <View style={styles.telemetryBadge}>
            <View style={styles.telemetryHeader}>
              <View style={styles.pulseGreenDot} />
              <Text style={styles.telemetryTitle}>TRANSMISSÃO EM TEMPO REAL</Text>
            </View>

            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>ÚLTIMO ENVIO</Text>
                <Text style={styles.telemetryValue}>
                  {trackingStatus.lastTransmissionTime || 'Iniciando...'}
                </Text>
              </View>

              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>PRECISÃO GPS</Text>
                <Text style={styles.telemetryValue}>
                  {trackingStatus.gpsAccuracy !== null
                    ? `±${trackingStatus.gpsAccuracy} m`
                    : 'Buscando sinal'}
                </Text>
              </View>

              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>VELOCIDADE</Text>
                <Text style={styles.telemetryValue}>
                  {trackingStatus.speed !== null ? `${trackingStatus.speed} km/h` : '0 km/h'}
                </Text>
              </View>

              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryLabel}>ENVIADOS</Text>
                <Text style={styles.telemetryValue}>
                  {trackingStatus.totalTransmissions} pings
                </Text>
              </View>
            </View>

            {trackingStatus.queuedCount > 0 && (
              <View style={styles.offlineNotice}>
                <Text style={styles.offlineNoticeText}>
                  ⚠️ {trackingStatus.queuedCount} coordenada(s) aguardando conexão
                </Text>
              </View>
            )}

            {!!trackingStatus.lastError && (
              <Text style={styles.errorBannerText}>{trackingStatus.lastError}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Stop Trip Confirmation Modal */}
      <Modal
        visible={showStopModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStopModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.stopDialogCard}>
            <View style={styles.stopIconCircle}>
              <Text style={styles.stopEmoji}>🛑</Text>
            </View>

            <Text style={styles.stopDialogTitle}>Terminar a Viagem?</Text>
            <Text style={styles.stopDialogMessage}>
              Você tem certeza que deseja terminar a viagem? A transmissão de coordenadas
              GPS será finalizada.
            </Text>

            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                style={styles.dialogCancelButton}
                onPress={() => setShowStopModal(false)}
                activeOpacity={0.7}>
                <Text style={styles.dialogCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogConfirmButton}
                onPress={handleConfirmStopTrip}
                activeOpacity={0.7}>
                <Text style={styles.dialogConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 4,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    fontSize: 22,
  },
  brandName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.primaryDark,
  },
  roleTag: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.primaryDark,
    letterSpacing: 1,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.dangerRedDark,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  buttonCenterArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  refreshLink: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.full,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  refreshLinkText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: COLORS.primaryDark,
  },
  telemetryBadge: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  pulseGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.actionGreen,
  },
  telemetryTitle: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  telemetryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.background,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  telemetryValue: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.textPrimary,
  },
  offlineNotice: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.xs + 4,
    backgroundColor: '#FEF3C7',
    borderRadius: theme.borderRadius.sm,
  },
  offlineNoticeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: theme.typography.weights.semibold,
  },
  errorBannerText: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.dangerRed,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  stopDialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.cardBackground,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.button,
  },
  stopIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  stopEmoji: {
    fontSize: 28,
  },
  stopDialogTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  stopDialogMessage: {
    fontSize: theme.typography.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  dialogActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dialogCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  dialogCancelText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: COLORS.textSecondary,
  },
  dialogConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    backgroundColor: COLORS.dangerRed,
  },
  dialogConfirmText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.textWhite,
  },
});
