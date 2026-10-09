import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '@/config/constants';
import { theme } from '@/styles/theme';

interface BigCircleButtonProps {
  isActive: boolean;
  isLoading: boolean;
  onPress: () => void;
  disabled?: boolean;
  isUnassigned?: boolean;
  unassignedMessage?: string;
}

export const BigCircleButton: React.FC<BigCircleButtonProps> = ({
  isActive,
  isLoading,
  onPress,
  disabled = false,
  isUnassigned = false,
  unassignedMessage,
}) => {
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [opacityAnim] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isActive) {
      animation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.22,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.6);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isActive, pulseAnim, opacityAnim]);

  if (isUnassigned && !isActive) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.circleButton, styles.unassignedButton]}
          onPress={onPress}
          disabled={isLoading}
          activeOpacity={0.85}>
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.activeGray} />
          ) : (
            <View style={styles.unassignedContainer}>
              <Text style={styles.unassignedIcon}>⚠️</Text>
              <Text style={styles.unassignedText}>
                {unassignedMessage ||
                  'Você não está vinculado a nenhum veiculo nesse momento, consulte com o Fiscal responsável'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  const buttonBackgroundColor = isActive ? COLORS.activeGray : COLORS.actionGreen;

  return (
    <View style={styles.container}>
      {/* Animated Pulse Ring during active transmission */}
      {isActive && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
              backgroundColor: COLORS.activeGrayGlow,
            },
          ]}
        />
      )}

      {/* Main Big Circular Button */}
      <TouchableOpacity
        style={[
          styles.circleButton,
          { backgroundColor: buttonBackgroundColor },
          isActive ? styles.activeShadow : styles.inactiveShadow,
          disabled && styles.disabledButton,
        ]}
        onPress={onPress}
        disabled={disabled || isLoading}
        activeOpacity={0.85}>
        {isLoading ? (
          <View style={styles.contentContainer}>
            <ActivityIndicator size="large" color={COLORS.textWhite} />
            <Text style={styles.loadingText}>AGUARDE...</Text>
          </View>
        ) : isActive ? (
          <View style={styles.contentContainer}>
            <View style={styles.beaconDot} />
            <Text style={styles.mainLabel}>EM VIAGEM</Text>
            <Text style={styles.subLabel}>TRANSMITINDO</Text>
            <View style={styles.stopActionPill}>
              <Text style={styles.stopActionText}>Toque para encerrar</Text>
            </View>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            <View style={styles.playTriangle} />
            <Text style={styles.mainLabel}>INICIAR</Text>
            <Text style={styles.subLabel}>Toque para começar</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const BUTTON_SIZE = 210;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.lg,
    width: BUTTON_SIZE + 40,
    height: BUTTON_SIZE + 40,
  },
  pulseRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 24,
    height: BUTTON_SIZE + 24,
    borderRadius: (BUTTON_SIZE + 24) / 2,
    borderWidth: 2,
    borderColor: COLORS.activeGray,
  },
  circleButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  inactiveShadow: {
    shadowColor: COLORS.actionGreenDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  activeShadow: {
    shadowColor: COLORS.activeGrayDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  unassignedButton: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 3,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  unassignedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  unassignedIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  unassignedText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
  },
  beaconDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#38BDF8',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  playTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    transform: [{ rotate: '90deg' }],
    marginBottom: 8,
    marginLeft: 4,
  },
  mainLabel: {
    color: COLORS.textWhite,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  subLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  stopActionPill: {
    marginTop: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  stopActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
  },
  loadingText: {
    color: COLORS.textWhite,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    marginTop: theme.spacing.sm,
    letterSpacing: 1,
  },
});
