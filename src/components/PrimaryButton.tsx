import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'filled' | 'plain';
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'filled',
}: Props) {
  const filled = variant === 'filled';
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        filled && styles.filled,
        (pressed || inactive) && styles.dimmed,
      ]}>
      {loading ? (
        <ActivityIndicator color={filled ? '#FFFFFF' : colors.accent} />
      ) : (
        <Text style={[styles.label, filled ? styles.filledLabel : styles.plainLabel]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  filled: { backgroundColor: colors.accent },
  dimmed: { opacity: 0.6 },
  label: { fontSize: 17, fontWeight: '600' },
  filledLabel: { color: '#FFFFFF' },
  plainLabel: { color: colors.accent },
});
