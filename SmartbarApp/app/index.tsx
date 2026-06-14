import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import SplashScreenComponent from '../src/screens/SplashScreen';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const session = await SecureStore.getItemAsync('userSession');
        if (session) {
          const user = JSON.parse(session);
          const role = user.role?.toLowerCase();
          if (role === 'waiter')       router.replace('/(tabs)/Waiter');
          else if (role === 'kitchen') router.replace('/(tabs)/Kitchen');
          else if (role === 'manager') router.replace('/(tabs)/Manager');
          else if (role === 'counter') router.replace('/(tabs)/Counter');
          else                         router.replace('/(tabs)');
        } else {
          router.replace('/Auth');
        }
      } catch {
        router.replace('/Auth');
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return <SplashScreenComponent />;
}