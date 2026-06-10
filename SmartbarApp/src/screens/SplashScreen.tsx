import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  runOnJS 
} from 'react-native-reanimated';
import { useRouter, useRootNavigationState } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

const SplashScreen: React.FC = () => {
  const router = useRouter();
  const navigationState = useRootNavigationState(); 
  
  const opacity = useSharedValue<number>(0);
  const contentScale = useSharedValue<number>(0.7);

  useEffect(() => {
    // 1. Wait until the Root Layout navigation state is fully ready
    if (!navigationState?.key) return;

    // Phase 1: Fade and Scale IN
    opacity.value = withTiming(1, { duration: 1000 });
    contentScale.value = withTiming(1, { duration: 1000 });

    // Phase 2: Check session dynamically, wait 3 seconds, then navigate intelligently
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 800 }, async (finished) => {
        if (finished) {
          try {
            const session = await SecureStore.getItemAsync('userSession');
            
            if (session) {
              // 🚀 Valid session found! Take them to their automated layout dashboards
              const parsedUser = JSON.parse(session);
              const userRole = parsedUser.role?.toLowerCase();
              
              if (userRole === 'waiter') {
                runOnJS(router.replace)('/(tabs)/Waiter');
              } else if (userRole === 'kitchen') {
                runOnJS(router.replace)('/(tabs)/Kitchen');
              } else if (userRole === 'manager') {
                runOnJS(router.replace)('/(tabs)/Manager');
              } else if (userRole === 'counter') {
                runOnJS(router.replace)('/(tabs)/Counter');
              } else {
                runOnJS(router.replace)('/(tabs)');
              }
            } else {
              // 🔒 No session registry! Safely drop them off at the Auth Login Screen gate
              runOnJS(router.replace)('/Auth');
            }
          } catch (e) {
            // Fallback to Auth on storage reading failures
            runOnJS(router.replace)('/Auth');
          }
        }
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigationState?.key]); 

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1c1c1c', '#0f0f0f', '#050505']}
        style={StyleSheet.absoluteFill}
      />

      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800' }} 
        style={[styles.bgImage, styles.topLeft]} 
      />
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=800' }} 
        style={[styles.bgImage, styles.bottomRight]} 
      />

      <Animated.View style={[styles.content, animatedContentStyle]}>
        <Text style={styles.emojiIcon}>🍹</Text>
        <Text style={styles.title}>Smartbar</Text>
        <View style={styles.separator} />
        <Text style={styles.subtitle}>PREMIUM DRINKS EXPERIENCE</Text>
      </Animated.View>
      
      <View style={styles.loaderWrapper}>
        <View style={styles.loaderBarBackground}>
           <Animated.View style={[styles.loaderBarActive, { opacity: opacity.value }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000', 
    alignItems: 'center', 
    justifyContent: 'center' 
  } as ViewStyle,
  bgImage: { 
    position: 'absolute', 
    width: width * 0.7, 
    height: width * 0.7, 
    opacity: 0.05, // Retained your subtle texture styling setting
    borderRadius: 150 
  } as ImageStyle,
  topLeft: { top: -50, left: -50 } as ImageStyle,
  bottomRight: { bottom: -50, right: -50 } as ImageStyle,
  content: { alignItems: 'center', zIndex: 10 } as ViewStyle,
  emojiIcon: { fontSize: 70, marginBottom: 10 } as TextStyle,
  title: { fontSize: 44, fontWeight: '800', color: '#FFF', letterSpacing: 2 } as TextStyle,
  separator: { height: 2, width: 70, backgroundColor: '#D48135', marginVertical: 15 } as ViewStyle,
  subtitle: { fontSize: 10, color: '#888', letterSpacing: 5, fontWeight: '600' } as TextStyle,
  loaderWrapper: { position: 'absolute', bottom: 100, width: '100%', alignItems: 'center' } as ViewStyle,
  loaderBarBackground: { width: 100, height: 2, backgroundColor: '#222' } as ViewStyle,
  loaderBarActive: { width: '100%', height: '100%', backgroundColor: '#D48135' } as ViewStyle,
});

export default SplashScreen;