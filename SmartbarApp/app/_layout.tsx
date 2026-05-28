import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { Stack } from "expo-router";
import React from "react";
import { useColorScheme, StatusBar } from "react-native";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* 1. Add the index (Splash) here */}
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        
        {/* 2. Your main tab navigation */}
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        
        {/* 3. The modal */}
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}