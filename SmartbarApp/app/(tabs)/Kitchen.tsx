import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChefHat, CheckCircle, RefreshCw, Clock, User, CheckCircle2 } from 'lucide-react-native';

// Change this line:
const BASE_URL = "https://smartbar-app.onrender.com";
const { width } = Dimensions.get('window');

interface OrderItem {
  item_id: number;
  name: string;
  quantity: number;
}

interface ActiveOrder {
  order_id: number;
  table_number: string | number;
  status: "pending" | "preparing" | "ready" | "delivered"; 
  created_at: string;
  waiter_name: string | null; 
  items: OrderItem[];
}

export default function KitchenDashboard() {
  const [kitchenOrders, setKitchenOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchKitchenData = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/orders/dashboard/kitchen`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      const rawTickets = data.success ? (data.tickets || []) : [];
      setKitchenOrders(rawTickets);
    } catch (error) {
      console.error("Kitchen fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKitchenData();
    const interval = setInterval(fetchKitchenData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkReady = async (orderId: number) => {
    try {
      const response = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: 1, status: 'ready' }) 
      });

      if (response.ok) {
        setKitchenOrders(prev => prev.filter(o => o.order_id !== orderId));
      } else {
        Alert.alert("Status Notice", "Could not complete status update loop.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not update order status.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.ambientGlow} />

      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>REALTIME HOT KITCHEN DISPATCH</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <ChefHat color="#D48135" size={24} strokeWidth={2.5} />
            <Text style={styles.brandTitle}>Main Kitchen</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.refreshBtn} 
          onPress={() => { setLoading(true); fetchKitchenData(); }}
          activeOpacity={0.7}
        >
          <RefreshCw color="#D48135" size={16} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* SYSTEM QUEUE */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#D48135" />
          <Text style={styles.loadingText}>Streaming active kitchen arrays...</Text>
        </View>
      ) : (
        <FlatList
          data={kitchenOrders}
          keyExtractor={(item) => `kitchen-${item.order_id}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchKitchenData(); }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCenter}>
              <CheckCircle2 size={48} color="#1A1A1E" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>Kitchen queue clear. No pending food orders.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              {/* TOP STRIP BAR */}
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.tablePill}>
                    <Text style={styles.tableText}>T-{item.table_number}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    item.status === 'pending' ? styles.badgePending : styles.badgePreparing
                  ]}>
                    <Text style={[
                      styles.statusText,
                      item.status === 'pending' ? { color: '#EF4444' } : { color: '#D48135' }
                    ]}>
                      {item.status ? item.status.toUpperCase() : 'PREPARING'}
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

              {/* WAITER IDENTIFIER COMPONENT */}
              <View style={styles.waiterRow}>
                <User size={13} color={item.waiter_name ? "#94A3B8" : "#EF4444"} />
                <Text style={[styles.waiterText, !item.waiter_name && { color: '#EF4444', fontWeight: '700' }]}>
                  Server assigned: <Text style={styles.waiterHighlight}>{item.waiter_name || 'UNCLAIMED TICKET'}</Text>
                </Text>
              </View>

              <View style={styles.divider} />

              {/* FOOD ITEMS LISTING MATRIX */}
              <View style={styles.itemsContainer}>
                {item.items && Array.isArray(item.items) && item.items[0]?.name !== null ? (
                  item.items.map((food, idx) => (
                    <View key={idx} style={styles.itemRowWrapper}>
                      <View style={styles.quantityContainer}>
                        <Text style={styles.quantityText}>{food?.quantity || 1}x</Text>
                      </View>
                      <Text style={styles.itemNameText}>{food?.name || 'Unknown Item'}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#71717A', fontSize: 13, fontStyle: 'italic' }}>
                    No specific items detailed for this ticket.
                  </Text>
                )}
              </View>

              {/* CONTROL DISPATCH BUTTON */}
              <TouchableOpacity 
                style={styles.btnReady} 
                onPress={() => handleMarkReady(item.order_id)}
                activeOpacity={0.8}
              >
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
  
  orderCard: { backgroundColor: "#121214", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#1A1A1E", overflow: "hidden" },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tablePill: { backgroundColor: "#FFF", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tableText: { color: "#050505", fontSize: 14, fontWeight: "900", letterSpacing: -0.2 },
  
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgePending: { backgroundColor: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.2)" },
  badgePreparing: { backgroundColor: "rgba(212, 129, 53, 0.08)", borderColor: "rgba(212, 129, 53, 0.2)" },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  
  timeWrapper: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { color: "#71717A", fontSize: 12, fontWeight: "600" },
  
  waiterRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  waiterText: { color: "#71717A", fontSize: 12, fontWeight: "500" },
  waiterHighlight: { color: "#E4E4E7", fontWeight: "700" },
  
  divider: { height: 1, backgroundColor: "#1A1A1E", marginVertical: 14 },
  itemsContainer: { gap: 10, marginBottom: 18 },
  itemRowWrapper: { flexDirection: "row", alignItems: "center", gap: 12 },
  quantityContainer: { backgroundColor: "rgba(212, 129, 53, 0.1)", minWidth: 28, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212, 129, 53, 0.15)" },
  quantityText: { color: "#D48135", fontSize: 12, fontWeight: "900" },
  itemNameText: { color: "#FFF", fontSize: 15, fontWeight: "600", letterSpacing: -0.1 },
  
  btnReady: { backgroundColor: "#D48135", height: 44, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { color: "#050505", fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  
  emptyCenter: { paddingVertical: 100, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#27272A", textAlign: "center", fontSize: 14, fontWeight: "700" }
});