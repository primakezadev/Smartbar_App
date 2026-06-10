import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const session = await SecureStore.getItemAsync('userSession');
        if (session) {
          const user = JSON.parse(session);
          const role = user.role?.toLowerCase();
          if (role === 'waiter') setTarget('/(tabs)/Waiter');
          else if (role === 'kitchen') setTarget('/(tabs)/Kitchen');
          else if (role === 'manager') setTarget('/(tabs)/Manager');
          else if (role === 'counter') setTarget('/(tabs)/Counter');
          else setTarget('/(tabs)');
        } else {
          setTarget('/Auth');
        }
      } catch {
        setTarget('/Auth');
      }
    };
    check();
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#D48135" />
      </View>
    );
  }

  return <Redirect href={target as any} />;
}