import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

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

    // ✅ Called by Auth.tsx after successful login
    (global as any).forceRootLoginSync = (userData: any) => {
      setUser(userData);
    };

    // ✅ Called by tabs _layout.tsx on logout
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

    const isInTabs = segments[0] === '(tabs)';
    const isAtAuth = segments[0] === 'Auth' || !segments[0];

    // 👇 ADD THIS
    console.log('🔁 ROUTE GUARD FIRED:', { 
      user: user ? user.role : 'null', 
      segments, 
      isInTabs, 
      isAtAuth 
    });

    if (!user) {
      if (isInTabs || isAtAuth) {
        console.log('🚪 Redirecting to Auth...');  // 👈 ADD THIS
        router.replace('/Auth');
      }
    } else {
      if (isAtAuth) {
        const role = user.role?.toLowerCase();
        console.log('🏠 Redirecting to dashboard for role:', role);  // 👈 ADD THIS
        if (role === 'waiter') router.replace('/(tabs)/Waiter');
        else if (role === 'kitchen') router.replace('/(tabs)/Kitchen');
        else if (role === 'manager') router.replace('/(tabs)/Manager');
        else if (role === 'counter') router.replace('/(tabs)/Counter');
        else router.replace('/(tabs)');
      }
    }

    SplashScreen.hideAsync().catch(() => {});
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