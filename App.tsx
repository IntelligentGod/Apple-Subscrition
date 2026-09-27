import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/constants/theme';
import { useSubscription } from './src/hooks/useSubscription';
import { HomeScreen } from './src/screens/HomeScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { ProScreen } from './src/screens/ProScreen';

type Screen = 'home' | 'paywall' | 'pro';

function App() {
  const subscription = useSubscription();
  const [screen, setScreen] = useState<Screen>('home');

  // Leave the paywall once StoreKit confirms (or restores) the subscription.
  useEffect(() => {
    if (subscription.plan === 'pro') {
      setScreen(current => (current === 'paywall' ? 'home' : current));
    }
  }, [subscription.plan]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        {screen === 'paywall' ? (
          <PaywallScreen
            subscription={subscription}
            onBack={() => setScreen('home')}
          />
        ) : screen === 'pro' ? (
          <ProScreen onBack={() => setScreen('home')} />
        ) : (
          <HomeScreen
            plan={subscription.plan}
            onUpgrade={() => setScreen('paywall')}
            onViewPro={() => setScreen('pro')}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default App;
