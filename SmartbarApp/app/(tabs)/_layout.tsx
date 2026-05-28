import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import * as SecureStore from 'expo-secure-store';

// Importing your screens
import AuthScreen from "../Auth";
import ClientDashboard from "./index";
import WaiterDashboard from "./Waiter"; 
import CounterDashboard from "./Counter";
import KitchenDashboard from "./Kitchen";
import ManagerDashboard from "./Manager";

interface UserProfile {
  id: number;
  name: string;
  role: string;
}

export default function AppLayout() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. Restore session on startup
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedUser = await SecureStore.getItemAsync('userSession');
        if (savedUser) {
          setCurrentUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      } finally {
        setIsInitializing(false);
      }
    };
    restoreSession();
  }, []);

  // 2. Handle Login Success
  const handleLoginSuccess = async (user: UserProfile) => {
    await SecureStore.setItemAsync('userSession', JSON.stringify(user));
    setCurrentUser(user);
  };

  // 3. Handle Logout
  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('userSession');
      setCurrentUser(null);
      console.log("Logout successful");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isInitializing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#D48135" />
      </View>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const normalizedRole = (currentUser.role || "").toString().trim().toLowerCase();

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionText}>
          👋 <Text style={{ color: "#D48135", fontWeight: "bold" }}>{currentUser.name}</Text> ({normalizedRole.toUpperCase()})
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {normalizedRole === "client" && <ClientDashboard />}
        {normalizedRole === "waiter" && <WaiterDashboard waiterProfile={currentUser} />}
        {normalizedRole === "counter" && <CounterDashboard />}
        {normalizedRole === "kitchen" && <KitchenDashboard />}
        {normalizedRole === "manager" && <ManagerDashboard />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#000" 
  },
  sessionHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    backgroundColor: "#111", 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderColor: "#222",
    marginTop: 40 
  },
  sessionText: { 
    color: "#aaa", 
    fontSize: 13 
  },
  logoutBtn: { 
    backgroundColor: "#222", 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 6 
  },
  logoutText: { 
    color: "#ef5350", 
    fontSize: 11, 
    fontWeight: "bold" 
  }
});