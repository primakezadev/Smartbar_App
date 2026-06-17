import React from 'react';
import { Slot, useRouter } from 'expo-router';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    console.log('LOGOUT BUTTON PRESSED');
    try {
      await SecureStore.deleteItemAsync('userToken').catch(() => {});
      await SecureStore.deleteItemAsync('userRole').catch(() => {});
      await SecureStore.deleteItemAsync('userSession').catch(() => {});

      console.log(' Storage cleared');

      if ((global as any).forceRootLogoutSync) {
        console.log('Calling forceRootLogoutSync...');
        (global as any).forceRootLogoutSync();
      } else {
        console.warn(' forceRootLogoutSync not registered, using fallback');
        router.replace('/Auth');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}></Text>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="logout" size={22} color="#FFB300" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Slot />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1014',
  },
  content: {
    flex: 1,
    backgroundColor: '#0F1014',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0F1014',
    zIndex: 999,    
    elevation: 999,     
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoutBtn: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 179, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,  
    elevation: 1000,
  },
});