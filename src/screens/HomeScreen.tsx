import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PlanCard } from '../components/PlanCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import type { Plan } from '../types/subscription';

interface Props {
  plan: Plan;
  onUpgrade: () => void;
  onViewPro: () => void;
}

export function HomeScreen({ plan, onUpgrade, onViewPro }: Props) {
  const isPro = plan === 'pro';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Eazee AI</Text>
      <PlanCard plan={plan} />
      <View style={styles.actions}>
        {isPro ? (
          <PrimaryButton title="View Pro Features" onPress={onViewPro} />
        ) : (
          <PrimaryButton title="Upgrade to Pro" onPress={onUpgrade} />
        )}
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
    marginBottom: 32,
  },
  actions: { marginTop: 32 },
});
