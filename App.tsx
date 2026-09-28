import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/constants/theme';
import { useAuth } from './src/hooks/useAuth';
import { useSubscription } from './src/hooks/useSubscription';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { ProScreen } from './src/screens/ProScreen';

type Screen = 'home' | 'paywall' | 'pro';

function App() {
  const auth = useAuth();
  const subscription = useSubscription(auth.session);
  const [screen, setScreen] = useState<Screen>('home');

  // Leave the paywall once the server confirms (or restores) the subscription.
  useEffect(() => {
    if (subscription.plan === 'pro') {
      setScreen(current => (current === 'paywall' ? 'home' : current));
    }
  }, [subscription.plan]);

  // Start from Home after signing in or out.
  const userId = auth.session?.user.id;
  useEffect(() => {
    setScreen('home');
  }, [userId]);

  const renderScreen = () => {
    if (auth.restoring) {
      return <ActivityIndicator style={styles.loading} color={colors.accent} />;
    }
    if (!auth.session) {
      return <LoginScreen auth={auth} />;
    }
    if (screen === 'paywall') {
      return (
        <PaywallScreen
          subscription={subscription}
          onBack={() => setScreen('home')}
        />
      );
    }
    if (screen === 'pro') {
      return (
        <ProScreen
          token={auth.session.token}
          onBack={() => setScreen('home')}
        />
      );
    }
    return (
      <HomeScreen
        plan={subscription.plan}
        email={auth.session.user.email}
        message={subscription.message}
        onUpgrade={() => setScreen('paywall')}
        onViewPro={() => setScreen('pro')}
        onSignOut={auth.signOut}
      />
    );
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>{renderScreen()}</SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1 },
});

export default App;
