import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { Bell, ShoppingBag, MapPin, CheckCircle } from "lucide-react-native";

// Change this line:
const BASE_URL = "https://smartbar-app.onrender.com";

interface OrderItem {
  item_id: number;
  name: string;
  quantity: number;
  type: "drink" | "kitchen";
  status?: string; // ⚡ Made optional to prevent null database values from crashing properties
}

interface WaiterTicket {
  order_id: number;
  table_number: string;
  master_status: string;
  total_price: string;
  created_at: string;
  items: OrderItem[]; // ⚡ FIX: Remapped to 'items' to match backend SQL json_agg array payload naming
}

interface WaiterDashboardProps {
  waiterProfile: {
    id: number;
    name: string;
    role: string;
  };
}

export default function WaiterDashboard({ waiterProfile }: WaiterDashboardProps) {
  const [tickets, setTickets] = useState<WaiterTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWaiterTickets = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/orders/dashboard/waiter`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        }
      });
      const data = await response.json();
      
      console.log("--- WAITER STREAM LOG ---");
      console.log("Raw Payload:", JSON.stringify(data));

      if (data && data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      } else if (data && Array.isArray(data)) {
        setTickets(data);
      } else if (data && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      } else {
        setTickets([]);
      }
    } catch (error) {
      console.error("Error pulling waiter orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimTicket = async (orderId: number) => {
    try {
      const response = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
        method: "PUT", 
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ 
          server_id: waiterProfile?.id || 1, // Safe fallback handling
          status: 'preparing' // ⚡ Forces order visibility onto Kitchen/Bar streams
        })
      });
      
      const data = await response.json();
      if (data.success) {
        Alert.alert("Ticket Secured", `You have successfully claimed Order #${orderId}`);
        fetchWaiterTickets();
      } else {
        Alert.alert("Error", data.message || "Failed to claim ticket.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not assign ticket profile arrays.");
    }
  };

  useEffect(() => {
    fetchWaiterTickets();
    const interval = setInterval(fetchWaiterTickets, 4000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D48135" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Service Queue</Text>
      {tickets.length === 0 ? (
        <Text style={styles.emptyText}>All tables are currently served</Text>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.order_id.toString()}
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
                {/* ⚡ FIX: Use item.items with optional chaining (?.) and fallback empty array to guarantee safety */}
                {(item.items || []).map((prod, index) => {
                  const currentStatus = prod.status || "pending"; // Fallback safeguard
                  return (
                    <View key={index} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{prod.quantity}x</Text>
                      <Text style={styles.itemName}>{prod.name}</Text>
                      <View style={[styles.statusBadge, currentStatus === "ready" ? styles.badgeReady : styles.badgePending]}>
                        <Text style={styles.badgeText}>{currentStatus.toUpperCase()}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.priceText}>{Number(item.total_price).toLocaleString()} RWF</Text>
                <TouchableOpacity style={styles.claimBtn} onPress={() => handleClaimTicket(item.order_id)}>
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
  header: { fontSize: 24, fontWeight: "900", color: "#FFFFFF", marginBottom: 16, marginTop: 40, letterSpacing: -0.5 },
  emptyText: { color: "#52525B", textAlign: "center", marginTop: 40, fontSize: 14 },
  ticketCard: { backgroundColor: "#121214", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#1A1A1E" },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#1A1A1E", paddingBottom: 10, marginBottom: 12 },
  tableTitle: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  orderIdLabel: { color: "#71717A", fontSize: 12, fontWeight: "700" },
  itemBox: { gap: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemQty: { fontSize: 14, fontWeight: "800", color: "#D48135", minWidth: 24 },
  itemName: { fontSize: 14, color: "#E4E4E7", flex: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgePending: { backgroundColor: "rgba(212, 129, 53, 0.1)", borderWidth: 1, borderColor: "rgba(212, 129, 53, 0.2)" },
  badgeReady: { backgroundColor: "rgba(34, 197, 94, 0.1)", borderWidth: 1, borderColor: "rgba(34, 197, 94, 0.2)" },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#FFF", letterSpacing: 0.3 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, borderTopWidth: 1, borderColor: "#1A1A1E", paddingTop: 12 },
  priceText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  claimBtn: { backgroundColor: "#D48135", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  claimBtnText: { color: "#050505", fontSize: 12, fontWeight: "800" }
});