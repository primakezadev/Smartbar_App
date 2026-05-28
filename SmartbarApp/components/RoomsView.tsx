import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { Bed, Calendar } from "lucide-react-native";

const BASE_URL = "https://stylishly-manly-clamshell.ngrok-free.dev";
const { width } = Dimensions.get("window");

interface ProductItem {
  id: number;
  name: string;
  category: string;
  price: string | number;
  image?: string;
}

export default function RoomsView() {
  const [rooms, setRooms] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const response = await fetch(`${BASE_URL}/api/products`);
        const data = await response.json();
        if (response.ok) {
          const roomsOnly = data.filter((item: ProductItem) => {
            const cat = item.category.toLowerCase().trim();
            return cat === "rooms" || cat === "room";
          });
          setRooms(roomsOnly);
        }
      } catch (error) {
        console.error("Error fetching rooms stream:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#D48135" />
        <Text style={styles.statusText}>Loading VIP spaces...</Text>
      </View>
    );
  }

  if (rooms.length === 0) {
    return (
      <View style={styles.centered}>
        <Bed size={40} color="#71717A" style={{ marginBottom: 12 }} />
        <Text style={styles.statusText}>No luxury spaces or rooms currently active.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rooms}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.listContainer}
      renderItem={({ item }) => (
        <View style={styles.roomCard}>
          <Image 
            source={{ uri: item.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945" }} 
            style={styles.cardImage} 
          />
          <View style={styles.cardContent}>
            <View>
              <Text style={styles.roomName}>{item.name}</Text>
              {/* ⚡ Clean fallback string since column does not exist in DB */}
              <Text style={styles.roomDesc} numberOfLines={2}>
                Private luxury space with premium sound system and personal service.
              </Text>
            </View>
            
            <View style={styles.cardFooter}>
              <Text style={styles.roomPrice}>{Number(item.price).toLocaleString()} RWF <Text style={styles.perNight}>/ slot</Text></Text>
              <TouchableOpacity style={styles.bookBtn}>
                <Calendar size={14} color="#050505" style={{ marginRight: 6 }} />
                <Text style={styles.bookBtnText}>Book Space</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: 16, gap: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#070708", padding: 40 },
  statusText: { color: "#71717A", fontSize: 14, textAlign: "center" },
  roomCard: { width: width - 32, backgroundColor: "#121214", borderRadius: 20, borderWidth: 1, borderColor: "#1A1A1E", overflow: "hidden", marginBottom: 4 },
  cardImage: { width: "100%", height: 160, backgroundColor: "#1A1E2E" },
  cardContent: { padding: 16, gap: 14 },
  roomName: { color: "#FFF", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  roomDesc: { color: "#A1A1AA", fontSize: 13, lineHeight: 18, opacity: 0.7 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  roomPrice: { color: "#D48135", fontSize: 16, fontWeight: "800" },
  perNight: { color: "#71717A", fontSize: 12, fontWeight: "500" },
  bookBtn: { backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  bookBtnText: { color: "#050505", fontSize: 12, fontWeight: "700" }
});