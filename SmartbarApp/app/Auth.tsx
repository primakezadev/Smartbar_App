import React, { useState } from "react";
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, Lock, User, Phone, Wine, ArrowRight, ShieldAlert } from "lucide-react-native";

const BASE_URL = "https://smartbar-app.onrender.com";

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const showAlert = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  const handleSubmit = async () => {
    console.log("=================================");
    console.log("👉 BUTTON PRESSED! handleSubmit triggered.");
    console.log("Current Mode:", isLogin ? "LOGIN" : "REGISTER");
    console.log("Email entered:", email);

    if (!email || !password || (!isLogin && !name)) {
      console.log("❌ Validation failed: Missing fields");
      showAlert("Validation Error", "Please fill out all required fields.");
      return;
    }

    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    console.log("Target full URL:", `${BASE_URL}${endpoint}`);

    let assignedRole = "client";
    const code = verificationCode ? verificationCode.trim().toUpperCase() : "";
    if (code === "WAIT2026") assignedRole = "waiter";
    else if (code === "MAN2026") assignedRole = "manager";
    else if (code === "COUNT2026") assignedRole = "counter";
    else if (code === "KICH2026") assignedRole = "kitchen";

    const payload = isLogin
      ? { email: email.trim(), password: password }
      : { name: name.trim(), email: email.trim(), password: password, role: assignedRole };

    console.log("📦 Body Payload Ready:", JSON.stringify(payload));

    try {
      console.log("📡 Sending fetch network request now...");
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 Response received status code:", response.status);
      const data = await response.json();
      console.log("📄 Raw parsed server response data:", JSON.stringify(data));

      if (response.ok && data.success) {
        console.log("✅ Auth response OK and successful!");

        // ✅ FIX: Clear any previous user's activeOrder before saving new session
        // This prevents second client from seeing first client's order
        const previousSession = await SecureStore.getItemAsync('userSession');
        if (previousSession) {
          const prevUser = JSON.parse(previousSession);
          if (prevUser?.id) {
            await SecureStore.deleteItemAsync(`activeOrder_${prevUser.id}`);
            console.log(`🧹 Cleared activeOrder for previous user ID: ${prevUser.id}`);
          }
        }

        if (data.token) {
          console.log("💾 Saving token to SecureStore...");
          await SecureStore.setItemAsync('userToken', String(data.token));
        }

        if (data.user) {
          console.log("💾 Saving user session profile details...");
          await SecureStore.setItemAsync('userSession', JSON.stringify(data.user));
        }

        // Notify root layout that user is now logged in
        if ((global as any).forceRootLoginSync) {
          (global as any).forceRootLoginSync(data.user);
        }

        // Give SecureStore 100ms to finish writing
        await new Promise(r => setTimeout(r, 100));

        const role = data.user?.role?.toLowerCase() || "client";
        console.log("🔀 Role from server:", role);

        const routeMap: Record<string, string> = {
          waiter:  '/(tabs)/Waiter',
          kitchen: '/(tabs)/Kitchen',
          manager: '/(tabs)/Manager',
          counter: '/(tabs)/Counter',
          client:  '/(tabs)',
        };

        const targetRoute = routeMap[role] || '/(tabs)';
        console.log("🚦 Redirecting to:", targetRoute);

        router.replace(targetRoute as any);

      } else {
        console.log("⚠️ Server rejected authentication request:", data.message);
        showAlert("Authentication Failed", data.message || data.error || "An error occurred.");
      }
    } catch (err: unknown) {
      console.error("💥 CATCH BLOCK ERROR CAPTURED:", err);
      const message = err instanceof Error ? err.message : "Could not reach the authentication server.";
      showAlert("Network Error", message);
    } finally {
      console.log("🏁 Request execution cycle complete. Turning off loading indicator.");
      setLoading(false);
      Keyboard.dismiss();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

        <View style={styles.brandPanel}>
          <Text style={styles.brandTitle}>Unlock Your{"\n"}Potential.</Text>
          <Text style={styles.brandSubtitle}>
            Welcome to the Smartbar ecosystem. Your central hub for ordering, managing, and tracking hospitality workflows in real-time.
          </Text>
        </View>

        <View style={styles.formPanel}>
          <View style={styles.formHeader}>
            <View style={styles.logoBadge}>
              <Wine size={28} color="#D48135" />
            </View>
            <Text style={styles.formTitle}>{isLogin ? "Welcome Back!" : "Create an Account"}</Text>
            <Text style={styles.formSubtitle}>
              {isLogin ? "Sign in to access your custom dashboard." : "Customers sign up instantly. Staff members require an authority code."}
            </Text>
          </View>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <User size={18} color="#666" style={styles.inputIcon} />
                <TextInput placeholder="John Doe" placeholderTextColor="#444" style={styles.input} value={name} onChangeText={setName} />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color="#666" style={styles.inputIcon} />
              <TextInput placeholder="you@example.com" placeholderTextColor="#444" autoCapitalize="none" keyboardType="email-address" style={styles.input} value={email} onChangeText={setEmail} />
            </View>
          </View>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Phone size={18} color="#666" style={styles.inputIcon} />
                <TextInput placeholder="+250 788 000 000" placeholderTextColor="#444" keyboardType="phone-pad" style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#666" style={styles.inputIcon} />
              <TextInput placeholder="••••" placeholderTextColor="#444" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
            </View>
          </View>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Staff Verification Code (Leave empty if Client)</Text>
              <View style={[styles.inputWrapper, verificationCode.trim() !== "" && styles.inputWrapperSecure]}>
                <ShieldAlert size={18} color={verificationCode.trim() !== "" ? "#D48135" : "#666"} style={styles.inputIcon} />
                <TextInput
                  placeholder="e.g. WAIT2026 (Staff Only)"
                  placeholderTextColor="#444"
                  autoCapitalize="characters"
                  style={styles.input}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.btnSubmit} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#050505" />
            ) : (
              <View style={styles.btnContentRow}>
                <Text style={styles.btnText}>{isLogin ? "ACCESS DASHBOARD" : "REGISTER PROFILE"}</Text>
                <ArrowRight size={16} color="#050505" strokeWidth={2.5} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090B" },
  scrollContainer: { flexGrow: 1, justifyContent: "space-between" },
  brandPanel: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 24 },
  brandTitle: { color: "#FFF", fontSize: 36, fontWeight: "800", lineHeight: 42, letterSpacing: -0.5 },
  brandSubtitle: { color: "#71717A", fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 320 },
  formPanel: { backgroundColor: "#11131F", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 28, paddingVertical: 36, borderTopWidth: 1, borderColor: "#1E2235" },
  formHeader: { alignItems: "center", marginBottom: 28 },
  logoBadge: { height: 56, width: 56, backgroundColor: "rgba(212, 129, 53, 0.1)", borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(212, 129, 53, 0.2)" },
  formTitle: { color: "#FFF", fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  formSubtitle: { color: "#94A3B8", fontSize: 14, textAlign: "center", marginTop: 6, opacity: 0.8 },
  inputGroup: { marginBottom: 18 },
  fieldLabel: { color: "#94A3B8", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.04)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.08)", paddingHorizontal: 16, height: 50 },
  inputWrapperSecure: { borderColor: "rgba(212, 129, 53, 0.4)", backgroundColor: "rgba(212, 129, 53, 0.02)" },
  inputIcon: { marginRight: 12 },
  input: { color: "#FFF", flex: 1, fontSize: 15 },
  btnSubmit: { backgroundColor: "#D48135", height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 14 },
  btnContentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { color: "#050505", fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  toggleContainer: { marginTop: 24, paddingBottom: 12 },
  toggleText: { color: "#D48135", textAlign: "center", fontSize: 14, fontWeight: "500" }
});