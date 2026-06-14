import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassWater, CheckCircle, RefreshCw, Clock, User, CheckCircle2 } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = "https://smartbar-app.onrender.com";
const { width } = Dimensions.get('window');

interface OrderItem {
  name: string;
  quantity: number;
}

interface ActiveOrder {
  order_id: number;
  table_number: string | number;
  status: string;
  created_at: string;
  waiter_name: string | null;
  items: OrderItem[];
}

export default function CounterDashboard() {
  const [drinkOrders, setDrinkOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchDrinksData = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      console.log("=== COUNTER FETCH === Token:", token ? "EXISTS" : "❌ MISSING");

      const response = await fetch(`${BASE_URL}/api/orders/dashboard/bar`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      });

      console.log("Counter response status:", response.status);
      const data = await response.json();
      console.log("Counter data:", JSON.stringify(data));

      setDrinkOrders(data.success ? (data.tickets || []) : []);
    } catch (error) {
      console.error("Counter fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrinksData();
    const interval = setInterval(fetchDrinksData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkReady = async (orderId: number) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const session = await SecureStore.getItemAsync('userSession');
      const profile = session ? JSON.parse(session) : null;

      const response = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ server_id: profile?.id || 1, status: 'ready' })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setDrinkOrders(prev => prev.filter(o => o.order_id !== orderId));
        Alert.alert("Done", `Order #${orderId} marked ready.`);
      } else {
        Alert.alert("Error", data.message || "Could not update status.");
      }
    } catch {
      Alert.alert("Error", "Could not update drink status.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.ambientGlow} />
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>REALTIME MIXOLOGY MANAGEMENT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <GlassWater color="#D48135" size={24} strokeWidth={2.5} />
            <Text style={styles.brandTitle}>Bar Counter</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setLoading(true); fetchDrinksData(); }} activeOpacity={0.7}>
          <RefreshCw color="#D48135" size={16} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#D48135" />
          <Text style={styles.loadingText}>Streaming active drink arrays...</Text>
        </View>
      ) : (
        <FlatList
          data={drinkOrders}
          keyExtractor={(item) => `drink-${item.order_id}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchDrinksData(); }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCenter}>
              <CheckCircle2 size={48} color="#1A1A1E" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>Bar queue clear. No pending drinks.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.tablePill}>
                    <Text style={styles.tableText}>T-{item.table_number}</Text>
                  </View>
                  <View style={[styles.statusBadge, styles.badgePreparing]}>
                    <Text style={[styles.statusText, { color: '#D48135' }]}>
                      {item.status?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.timeWrapper}>
                  <Clock size={12} color="#71717A" />
                  <Text style={styles.timeText}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </Text>
                </View>
              </View>

              <View style={styles.waiterRow}>
                <User size={13} color={item.waiter_name ? "#94A3B8" : "#EF4444"} />
                <Text style={[styles.waiterText, !item.waiter_name && { color: '#EF4444' }]}>
                  Server: <Text style={styles.waiterHighlight}>{item.waiter_name || 'UNCLAIMED'}</Text>
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.itemsContainer}>
                {item.items?.map((drink, idx) => (
                  <View key={idx} style={styles.itemRowWrapper}>
                    <View style={styles.quantityContainer}>
                      <Text style={styles.quantityText}>{drink.quantity}x</Text>
                    </View>
                    <Text style={styles.itemNameText}>{drink.name}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.btnReady} onPress={() => handleMarkReady(item.order_id)} activeOpacity={0.8}>
                <CheckCircle color="#050505" size={16} strokeWidth={2.5} />
                <Text style={styles.btnText}>MARK DISPATCH READY</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070708" },
  ambientGlow: { position: "absolute", top: -100, left: -50, width: width + 100, height: 320, backgroundColor: "rgba(212, 129, 53, 0.03)", borderRadius: 200 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: "#1A1A1E" },
  welcomeText: { color: "#71717A", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  brandTitle: { color: "#FFF", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  refreshBtn: { height: 40, width: 40, backgroundColor: "#121214", borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1A1A1E" },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#71717A", fontSize: 13, marginTop: 12 },
  orderCard: { backgroundColor: "#121214", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#1A1A1E" },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tablePill: { backgroundColor: "#FFF", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tableText: { color: "#050505", fontSize: 14, fontWeight: "900" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgePending: { backgroundColor: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.2)" },
  badgePreparing: { backgroundColor: "rgba(212, 129, 53, 0.08)", borderColor: "rgba(212, 129, 53, 0.2)" },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  timeWrapper: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { color: "#71717A", fontSize: 12, fontWeight: "600" },
  waiterRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  waiterText: { color: "#71717A", fontSize: 12 },
  waiterHighlight: { color: "#E4E4E7", fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#1A1A1E", marginVertical: 14 },
  itemsContainer: { gap: 10, marginBottom: 18 },
  itemRowWrapper: { flexDirection: "row", alignItems: "center", gap: 12 },
  quantityContainer: { backgroundColor: "rgba(212, 129, 53, 0.1)", minWidth: 28, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212, 129, 53, 0.15)" },
  quantityText: { color: "#D48135", fontSize: 12, fontWeight: "900" },
  itemNameText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  btnReady: { backgroundColor: "#D48135", height: 44, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { color: "#050505", fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  emptyCenter: { paddingVertical: 100, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#27272A", textAlign: "center", fontSize: 14, fontWeight: "700" }
});