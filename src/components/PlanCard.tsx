import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';
import type { Plan } from '../types/subscription';

export function PlanCard({ plan }: { plan: Plan }) {
  const isPro = plan === 'pro';

  return (
    <View style={styles.card}>
      <Text style={styles.caption}>Current Plan</Text>
      <Text style={[styles.plan, isPro && styles.pro]}>
        {isPro ? 'PRO ✓' : 'FREE'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  caption: {
    fontSize: 15,
    color: colors.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  plan: { fontSize: 40, fontWeight: '800', color: colors.text, marginTop: 8 },
  pro: { color: colors.success },
});
