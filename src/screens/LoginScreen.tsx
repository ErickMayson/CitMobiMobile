import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/config/constants';
import { theme } from '@/styles/theme';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = username.trim().length > 0 && password.trim().length > 0;

  const handleLogin = async () => {
    if (!canSubmit) {
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      await login({
        login: username.trim(),
        senha: password,
      });
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err?.message === 'Network Error'
          ? 'Não foi possível conectar ao servidor na porta 8080. Verifique sua conexão.'
          : 'Credenciais inválidas ou erro ao autenticar. Tente novamente.');
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Header Brand Banner */}
          <View style={styles.brandHeader}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🚌</Text>
            </View>
            <Text style={styles.brandTitle}>CitMobi</Text>
            <Text style={styles.brandSubtitle}>APLICATIVO DO MOTORISTA</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Acesse sua conta</Text>

            {/* Error Message Box */}
            {!!errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Username / Matricula Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>LOGIN</Text>
              <TextInput
                style={styles.input}
                placeholder=""
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SENHA</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder=""
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  accessibilityLabel={showPassword ? 'Ocultar senha' : 'Exibir senha'}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!canSubmit || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!canSubmit || loading}
              activeOpacity={0.8}>
              {loading ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.textWhite} />
                  <Text style={styles.submitButtonText}>Entrando...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  logoIcon: {
    fontSize: 32,
  },
  brandTitle: {
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.primaryDark,
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...theme.shadows.card,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm + 4,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: COLORS.dangerRedDark,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.typography.sizes.md,
    color: COLORS.textPrimary,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.button,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.disabledGray,
    opacity: 0.6,
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: COLORS.textWhite,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1,
  },
});
