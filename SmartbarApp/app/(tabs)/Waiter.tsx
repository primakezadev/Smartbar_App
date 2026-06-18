import React, { useEffect, useState } from "react";
import {
  StyleSheet, Text, View, FlatList,
  ActivityIndicator, TouchableOpacity, Alert
} from "react-native";
import { Bell, MapPin, CheckCircle, MessageSquare } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";

const BASE_URL = "https://smartbar-app.onrender.com";

interface OrderItem {
  item_id: number;
  name: string;
  quantity: number;
  type: "drink" | "kitchen";
  status?: string;
  special_instructions?: string;
}

interface WaiterTicket {
  order_id: number;
  table_number: string;
  master_status: string;
  total_price: string;
  created_at: string;
  items: OrderItem[];
}

export default function WaiterDashboard() {
  const [tickets, setTickets] = useState<WaiterTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiterProfile, setWaiterProfile] = useState<{ id: number; name: string; role: string } | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await SecureStore.getItemAsync("userSession");
        if (session) setWaiterProfile(JSON.parse(session));
      } catch (e) {
        console.error("Failed to load waiter session:", e);
      }
    };
    loadSession();
  }, []);

  const fetchWaiterTickets = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync("userToken");
      const response = await fetch(`${BASE_URL}/api/orders/dashboard/waiter`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
        }
      });
      const data = await response.json();
      if (data?.success && Array.isArray(data.tickets)) setTickets(data.tickets);
      else setTickets([]);
    } catch (error) {
      console.error("Error pulling waiter orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimTicket = async (orderId: number) => {
    try {
      const storedToken = await SecureStore.getItemAsync("userToken");
      const session = await SecureStore.getItemAsync("userSession");
      const profile = session ? JSON.parse(session) : null;

      const response = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
        },
        body: JSON.stringify({ server_id: profile?.id || 1, status: "preparing" })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert("Ticket Secured", `You have claimed Order #${orderId}`);
        fetchWaiterTickets();
      } else {
        Alert.alert("Error", data.message || "Failed to claim ticket.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not claim ticket.");
    }
  };

  useEffect(() => {
    fetchWaiterTickets();
    const interval = setInterval(fetchWaiterTickets, 4000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#D48135" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Service Queue</Text>
      {waiterProfile && <Text style={styles.subHeader}>Logged in as: {waiterProfile.name}</Text>}

      {tickets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Bell size={40} color="#27272A" />
          <Text style={styles.emptyText}>All tables are currently served</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.order_id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MapPin size={16} color="#D48135" />
                  <Text style={styles.tableTitle}>Table {item.table_number}</Text>
                </View>
                <Text style={styles.orderIdLabel}># {item.order_id}</Text>
              </View>

              <View style={styles.itemBox}>
                {(item.items || []).map((prod, index) => {
                  const currentStatus = prod.status || "pending";
                  const hasNote = prod.special_instructions && prod.special_instructions.trim().length > 0;
                  return (
                    <View key={index}>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemQty}>{prod.quantity}x</Text>
                        <Text style={styles.itemName}>{prod.name}</Text>
                        <View style={[
                          styles.statusBadge,
                          currentStatus === "ready" ? styles.badgeReady : styles.badgePending
                        ]}>
                          <Text style={styles.badgeText}>{currentStatus.toUpperCase()}</Text>
                        </View>
                      </View>
                      {/* ✅ Show special instructions if present */}
                      {hasNote && (
                        <View style={styles.noteRow}>
                          <MessageSquare size={11} color="#D48135" />
                          <Text style={styles.noteText}>{prod.special_instructions}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.priceText}>{Number(item.total_price).toLocaleString()} RWF</Text>
                <TouchableOpacity style={styles.claimBtn} onPress={() => handleClaimTicket(item.order_id)} activeOpacity={0.8}>
                  <CheckCircle size={14} color="#050505" style={{ marginRight: 4 }} />
                  <Text style={styles.claimBtnText}>CLAIM TABLE</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070708", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#070708" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, marginTop: 80 },
  header: { fontSize: 24, fontWeight: "900", color: "#FFFFFF", marginBottom: 4, marginTop: 40, letterSpacing: -0.5 },
  subHeader: { fontSize: 13, color: "#71717A", marginBottom: 16 },
  emptyText: { color: "#52525B", textAlign: "center", fontSize: 14 },
  ticketCard: { backgroundColor: "#121214", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#1A1A1E" },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#1A1A1E", paddingBottom: 10, marginBottom: 12 },
  tableTitle: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  orderIdLabel: { color: "#71717A", fontSize: 12, fontWeight: "700" },
  itemBox: { gap: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemQty: { fontSize: 14, fontWeight: "800", color: "#D48135", minWidth: 24 },
  itemName: { fontSize: 14, color: "#E4E4E7", flex: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgePending: { backgroundColor: "rgba(212, 129, 53, 0.1)", borderWidth: 1, borderColor: "rgba(212, 129, 53, 0.2)" },
  badgeReady: { backgroundColor: "rgba(34, 197, 94, 0.1)", borderWidth: 1, borderColor: "rgba(34, 197, 94, 0.2)" },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#FFF", letterSpacing: 0.3 },
  // ✅ Note styles
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 4, marginLeft: 24, backgroundColor: "rgba(212,129,53,0.06)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, borderLeftWidth: 2, borderLeftColor: "#D48135" },
  noteText: { color: "#D48135", fontSize: 11, fontStyle: "italic", flex: 1 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, borderTopWidth: 1, borderColor: "#1A1A1E", paddingTop: 12 },
  priceText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  claimBtn: { backgroundColor: "#D48135", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  claimBtnText: { color: "#050505", fontSize: 12, fontWeight: "800" },
});