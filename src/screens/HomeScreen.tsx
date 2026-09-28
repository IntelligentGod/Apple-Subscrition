import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PlanCard } from '../components/PlanCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import type { Plan } from '../types/subscription';

interface Props {
  plan: Plan;
  email: string;
  message: string | null;
  onUpgrade: () => void;
  onViewPro: () => void;
  onSignOut: () => void;
}

export function HomeScreen({
  plan,
  email,
  message,
  onUpgrade,
  onViewPro,
  onSignOut,
}: Props) {
  const isPro = plan === 'pro';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Eazee AI</Text>
      <Text style={styles.email}>{email}</Text>
      <PlanCard plan={plan} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.actions}>
        {isPro ? (
          <PrimaryButton title="View Pro Features" onPress={onViewPro} />
        ) : (
          <PrimaryButton title="Upgrade to Pro" onPress={onUpgrade} />
        )}
        <PrimaryButton title="Sign Out" variant="plain" onPress={onSignOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  email: {
    fontSize: 15,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  message: { color: colors.danger, textAlign: 'center', marginTop: 16 },
  actions: { marginTop: 32, gap: 8 },
});
