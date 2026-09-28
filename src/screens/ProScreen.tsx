import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import { api } from '../services/api';

interface Props {
  token: string;
  onBack: () => void;
}

/** Pro content comes from the server (GET /pro/content), which only answers Pro users. */
export function ProScreen({ token, onBack }: Props) {
  const [content, setContent] = useState<{
    message: string;
    features: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .proContent(token)
      .then(setContent)
      .catch(e => setError(e.message));
  }, [token]);

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>PRO ACTIVE ✓</Text>
      <Text style={styles.title}>Welcome to Pro</Text>
      {content ? (
        <>
          <Text style={styles.subtitle}>{content.message}</Text>
          <View style={styles.list}>
            {content.features.map(feature => (
              <Text key={feature} style={styles.item}>
                <Text style={styles.check}>✓ </Text>
                {feature}
              </Text>
            ))}
          </View>
        </>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ActivityIndicator style={styles.list} color={colors.accent} />
      )}
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
  subtitle: {
    fontSize: 15,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 8,
  },
  list: { marginVertical: 32, gap: 12, alignSelf: 'center' },
  item: { fontSize: 17, color: colors.text },
  check: { color: colors.success, fontWeight: '700' },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginVertical: 32,
  },
});
