
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";

interface OrderItem {
  item_id: number;
  name: string;
  quantity: number;
  status: string;
}

interface Ticket {
  order_id: number;
  created_at: string;
  items: OrderItem[];
}

export default function DrinksView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBarTickets = async () => {
    try {
      // Replace with your local machine backend IP or deployment URL
      const response = await fetch("http://192.168.1.X:3000/api/orders/dashboard/bar");
      const data = await response.json();
      if (data.success) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error("Error pulling bar orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarTickets();
    const interval = setInterval(fetchBarTickets, 5000); // Polls every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Bar Counter Orders</Text>
      {tickets.length === 0 ? (
        <Text style={styles.emptyText}>No pending drink tickets</Text>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.order_id.toString()}
          renderItem={({ item }) => (
            <View style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketTitle}>Ticket #{item.order_id}</Text>
                <Text style={styles.timeText}>
                  {new Date(item.created_at).toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"})}
                </Text>
              </View>
              
              {item.items.map((drink, index) => (
                <View key={index} style={styles.drinkRow}>
                  <Text style={styles.drinkQty}>{drink.quantity}x</Text>
                  <Text style={styles.drinkName}>{drink.name}</Text>
                </View>
              ))}

              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>Mark Poured</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" },
  header: { fontSize: 24, fontWeight: "bold", color: "#FFFFFF", marginBottom: 16 },
  emptyText: { color: "#888", textAlign: "center", marginTop: 40, fontSize: 16 },
  ticketCard: { backgroundColor: "#1E1E1E", borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#333" },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 6 },
  ticketTitle: { fontSize: 18, fontWeight: "bold", color: "#00E5FF" },
  timeText: { color: "#AAA", fontSize: 14 },
  drinkRow: { flexDirection: "row", alignItems: "center", marginVertical: 4 },
  drinkQty: { fontSize: 16, fontWeight: "bold", color: "#00E5FF", marginRight: 8 },
  drinkName: { fontSize: 16, color: "#FFF" },
  actionButton: { backgroundColor: "#007acc", borderRadius: 6, paddingVertical: 10, marginTop: 12, alignItems: "center" },
  actionButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 14 }
});

