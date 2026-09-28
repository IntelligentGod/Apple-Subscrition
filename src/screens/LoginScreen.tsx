import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import type { AuthController } from '../hooks/useAuth';

interface Props {
  auth: AuthController;
}

export function LoginScreen({ auth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isLogin = mode === 'login';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Eazee AI</Text>
      <Text style={styles.subtitle}>
        {isLogin ? 'Sign in to your account' : 'Create your account'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min. 8 characters)"
        secureTextEntry
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />

      {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}

      <PrimaryButton
        title={isLogin ? 'Sign In' : 'Create Account'}
        onPress={() => auth.submit(mode, email, password)}
        loading={auth.submitting}
        disabled={!email || !password}
      />
      <PrimaryButton
        title={
          isLogin ? 'New here? Create an account' : 'Have an account? Sign in'
        }
        variant="plain"
        onPress={() => setMode(isLogin ? 'register' : 'login')}
        disabled={auth.submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: colors.secondaryText,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    fontSize: 17,
    color: colors.text,
  },
  error: { color: colors.danger, textAlign: 'center' },
});
