import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';

const PRO_FEATURES = ['Unlimited access', 'Premium features', 'Priority support'];

export function ProScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>PRO ACTIVE ✓</Text>
      <Text style={styles.title}>Welcome to Pro</Text>
      <View style={styles.list}>
        {PRO_FEATURES.map(feature => (
          <Text key={feature} style={styles.item}>
            <Text style={styles.check}>✓ </Text>
            {feature}
          </Text>
        ))}
      </View>
      <PrimaryButton title="Back" variant="plain" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  badge: {
    alignSelf: 'center',
    color: '#FFFFFF',
    backgroundColor: colors.success,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: 16,
  },
  list: { marginVertical: 32, gap: 12, alignSelf: 'center' },
  item: { fontSize: 17, color: colors.text },
  check: { color: colors.success, fontWeight: '700' },
});
