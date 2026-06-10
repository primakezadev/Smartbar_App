import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Utensils, Plus } from "lucide-react-native";

const BASE_URL = "https://stylishly-manly-clamshell.ngrok-free.dev";

interface ProductItem {
  id: number;
  name: string;
  category: string;
  price: string | number;
  image?: string;
}

interface FoodViewProps {
  onAddToCart: (item: ProductItem) => void;
}

export default function FoodView({ onAddToCart }: FoodViewProps) {
  const [food, setFood] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchFood() {
      try {
        const response = await fetch(`${BASE_URL}/api/products`);
        const data = await response.json();
        if (response.ok) {
          const foodOnly = data.filter((item: ProductItem) => item.category.toLowerCase().trim() === "bites");
          setFood(foodOnly);
        }
      } catch (error) {
        console.error("Error fetching food stream:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFood();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#D48135" />
        <Text style={styles.statusText}>Fetching kitchen inventory...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={food}
      keyExtractor={(item) => item.id.toString()}
      numColumns={2}
      contentContainerStyle={styles.gridContainer}
      renderItem={({ item }) => (
        <View style={styles.foodCard}>
          <Image source={{ uri: item.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836" }} style={styles.cardImage} />
          <View style={styles.cardContent}>
            <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.foodDesc} numberOfLines={1}>{item.category}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.foodPrice}>{Number(item.price).toLocaleString()} RWF</Text>
              
              {/* ⚡ TRIGGER ACTION ON CLICK */}
              <TouchableOpacity style={styles.addBtn} onPress={() => onAddToCart(item)}>
                <Plus size={16} color="#D48135" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  gridContainer: { padding: 14, gap: 4 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#070708", padding: 40 },
  statusText: { color: "#71717A", fontSize: 14, textAlign: "center" },
  foodCard: { flex: 1, backgroundColor: "#121214", margin: 6, borderRadius: 16, borderWidth: 1, borderColor: "#1A1A1E", overflow: "hidden" },
  cardImage: { width: "100%", height: 120, backgroundColor: "#1A1A1E" },
  cardContent: { padding: 12 },
  foodName: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  foodDesc: { color: "#71717A", fontSize: 12, marginTop: 2, marginBottom: 10 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  foodPrice: { color: "#D48135", fontSize: 14, fontWeight: "700" },
  addBtn: { backgroundColor: "rgba(212, 129, 53, 0.1)", height: 32, width: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212, 129, 53, 0.2)" }
});