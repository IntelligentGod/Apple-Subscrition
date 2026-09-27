import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../constants/theme';
import type { SubscriptionController } from '../hooks/useSubscription';

interface Props {
  subscription: SubscriptionController;
  onBack: () => void;
}

const FEATURES = ['Unlimited access', 'Premium features', 'Pro subscription'];

export function PaywallScreen({ subscription, onBack }: Props) {
  const {
    product,
    productState,
    purchasing,
    restoring,
    message,
    loadProduct,
    subscribe,
    restore,
  } = subscription;

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const busy = purchasing || restoring;

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Eazee AI Pro</Text>
      <Text style={styles.title}>Unlock Pro</Text>

      <View style={styles.features}>
        {FEATURES.map(feature => (
          <Text key={feature} style={styles.feature}>
            <Text style={styles.check}>✓ </Text>
            {feature}
          </Text>
        ))}
      </View>

      <View style={styles.productCard}>
        {productState === 'loaded' && product ? (
          <>
            <Text style={styles.productName}>{product.title}</Text>
            <Text style={styles.price}>
              {product.displayPrice}
              {product.periodLabel ? (
                <Text style={styles.period}> / {product.periodLabel}</Text>
              ) : null}
            </Text>
          </>
        ) : productState === 'error' ? (
          <>
            <Text style={styles.error}>
              Subscription product could not be loaded.
            </Text>
            <PrimaryButton title="Retry" variant="plain" onPress={loadProduct} />
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading subscription...</Text>
          </View>
        )}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <PrimaryButton
        title="Subscribe"
        onPress={subscribe}
        loading={purchasing}
        disabled={!product || busy}
      />
      <PrimaryButton
        title="Restore Purchases"
        variant="plain"
        onPress={restore}
        loading={restoring}
        disabled={busy}
      />
      <PrimaryButton
        title="Back"
        variant="plain"
        onPress={onBack}
        disabled={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  brand: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  features: { marginVertical: 20, gap: 10, alignSelf: 'center' },
  feature: { fontSize: 17, color: colors.text },
  check: { color: colors.success, fontWeight: '700' },
  productCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 20,
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  productName: { fontSize: 17, fontWeight: '600', color: colors.text },
  price: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 4 },
  period: { fontSize: 17, fontWeight: '500', color: colors.secondaryText },
  loading: { alignItems: 'center', gap: 8 },
  loadingText: { color: colors.secondaryText },
  error: { color: colors.danger, textAlign: 'center', fontWeight: '500' },
  message: { color: colors.danger, textAlign: 'center', marginBottom: 8 },
});
