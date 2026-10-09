import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/config/constants';
import { theme } from '@/styles/theme';

interface ClockHeaderProps {
  showDate?: boolean;
}

export const ClockHeader = memo(({ showDate = true }: ClockHeaderProps) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      try {
        setCurrentTime(
          now.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
        );
      } catch {
        const pad = (n: number) => String(n).padStart(2, '0');
        setCurrentTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      }

      if (showDate) {
        try {
          const formattedDate = now.toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'short',
            day: '2-digit',
            month: 'short',
          });
          setCurrentDate(formattedDate.toUpperCase());
        } catch {
          const formattedDate = now.toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
          });
          setCurrentDate(formattedDate.toUpperCase());
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [showDate]);

  return (
    <View style={styles.container}>
      {showDate && !!currentDate && (
        <Text style={styles.dateText}>{currentDate}</Text>
      )}
      <View style={styles.clockPill}>
        <View style={styles.dot} />
        <Text style={styles.timeText}>{currentTime || '--:--:--'}</Text>
      </View>
    </View>
  );
});

ClockHeader.displayName = 'ClockHeader';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  clockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 180, 216, 0.08)',
    borderColor: 'rgba(0, 180, 216, 0.25)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  timeText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
});
