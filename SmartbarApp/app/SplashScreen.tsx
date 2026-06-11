import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useRootNavigationState } from 'expo-router';

const { width } = Dimensions.get('window');

const SplashScreenComponent: React.FC = () => {
  const navigationState = useRootNavigationState();

  const opacity = useSharedValue<number>(0);
  const contentScale = useSharedValue<number>(0.7);

  useEffect(() => {
    // Wait until the Root Layout navigation state is fully ready
    if (!navigationState?.key) return;

    // Fade and Scale IN only — navigation is handled by index.tsx
    opacity.value = withTiming(1, { duration: 1000 });
    contentScale.value = withTiming(1, { duration: 1000 });
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
    justifyContent: 'center',
  } as ViewStyle,
  bgImage: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    opacity: 0.05,
    borderRadius: 150,
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

export default SplashScreenComponent;