import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as NativeSplashScreen from 'expo-splash-screen';

NativeSplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [user, setUser] = useState<{ id: number; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  const checkSession = async () => {
    try {
      const session = await SecureStore.getItemAsync('userSession');
      if (session) {
        setUser(JSON.parse(session));
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();

    // Called by Auth.tsx after successful login
    (global as any).forceRootLoginSync = (userData: any) => {
      setUser(userData);
    };

    // Called by tabs _layout.tsx on logout
    (global as any).forceRootLogoutSync = () => {
      setUser(null);
    };

    return () => {
      delete (global as any).forceRootLoginSync;
      delete (global as any).forceRootLogoutSync;
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const isIndex = !segments[0];
    const isInTabs = segments[0] === '(tabs)';
    const isAtAuth = segments[0] === 'Auth';

    // ✅ Let index.tsx handle its own splash + redirect — don't interfere
    if (isIndex) {
      NativeSplashScreen.hideAsync().catch(() => {});
      return;
    }

    console.log('🔁 ROUTE GUARD FIRED:', {
      user: user ? user.role : 'null',
      segments,
      isInTabs,
      isAtAuth,
    });

    if (!user) {
      if (isInTabs) {
        console.log('🚪 Redirecting to Auth...');
        router.replace('/Auth');
      }
    } else {
      if (isAtAuth) {
        const role = user.role?.toLowerCase();
        console.log('🏠 Redirecting to dashboard for role:', role);
        if (role === 'waiter')       router.replace('/(tabs)/Waiter');
        else if (role === 'kitchen') router.replace('/(tabs)/Kitchen');
        else if (role === 'manager') router.replace('/(tabs)/Manager');
        else if (role === 'counter') router.replace('/(tabs)/Counter');
        else                         router.replace('/(tabs)');
      }
    }

    NativeSplashScreen.hideAsync().catch(() => {});
  }, [user, loading, segments]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="Auth" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
    </Stack>
  );
}