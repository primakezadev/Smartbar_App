import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Alert, Modal, TextInput, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShoppingCart, Plus, X, Bell, User } from "lucide-react-native";

// Change this line:
const BASE_URL = "https://smartbar-app.onrender.com";
const { width } = Dimensions.get("window");

type CategoryType = "overview" | "drinks" | "food" | "rooms";

interface ProductItem {
  id: number;
  name: string;
  category: string;
  price: string | number;
  image?: string;
  current_stock: number;
}

export default function ClientDashboard() {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("overview");
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<ProductItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isNotiOpen, setIsNotiOpen] = useState<boolean>(false);
  const [tableNumber, setTableNumber] = useState<string>("");
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);

  useEffect(() => {
    async function fetchInventory() {
      setLoading(true);
      try {
        const response = await fetch(`${BASE_URL}/api/products`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const data = await response.json();
        if (data?.products) setAllProducts(data.products);
      } catch (error) { console.error("Error:", error); }
      finally { setLoading(false); }
    }
    fetchInventory();
  }, []);

  useEffect(() => {
    if (!activeOrder?.id || activeOrder.status === "completed") return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/orders/client/status/${activeOrder.id}`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const data = await response.json();
        if (data.success && data.order) setActiveOrder(data.order);
      } catch (err) { console.error("Monitoring error:", err); }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeOrder?.id, activeOrder?.status]);

  const filterProducts = (products: ProductItem[]) => {
    if (activeCategory === "overview") return products;
    return products.filter((p) => {
      const cat = p.category;
      if (activeCategory === "drinks") return ["Beer", "Soda", "Juice", "Cocktails", "Mocktails", "Wine", "Cider", "Water", "Cocktail"].includes(cat);
      if (activeCategory === "food") return ["Bites", "Pork", "Brochettes", "Sides", "Starters", "kitchen"].includes(cat);
      if (activeCategory === "rooms") return cat === "Rooms";
      return false;
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.price as string), 0).toFixed(2);

  const handleCheckout = async () => {
    if (!tableNumber) return Alert.alert("Required", "Please enter table number.");
    setSubmittingOrder(true);
    try {
      const response = await fetch(`${BASE_URL}/api/orders/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number: tableNumber, items: cart })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert("Success", "Order placed!");
        setActiveOrder(data.order);
        setCart([]); setIsCartOpen(false);
      }
    } finally { setSubmittingOrder(false); }
  };

  if (loading) return <View style={styles.darkLoaderContainer}><ActivityIndicator size="large" color="#D48135" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.brandTitle}>Smartbar Portal</Text>
        <TouchableOpacity onPress={() => setIsNotiOpen(true)}>
          <Bell color="#FFF" size={24} />
          {activeOrder && <View style={styles.notiDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.navBarContainer}>
          <ScrollView horizontal contentContainerStyle={styles.navScroll} showsHorizontalScrollIndicator={false}>
            {(["overview", "drinks", "food", "rooms"] as CategoryType[]).map((cat) => (
              <TouchableOpacity key={cat} style={[styles.navTab, activeCategory === cat && styles.navTabActive]} onPress={() => setActiveCategory(cat)}>
                <Text style={[styles.navTabText, activeCategory === cat && styles.navTabTextActive]}>{cat.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.gridWrapper}>
          {filterProducts(allProducts).map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <Image source={{ uri: item.image && item.image.length > 5 ? item.image : "https://via.placeholder.com/150" }} style={styles.itemImage} />
              <View style={styles.cardDetails}>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.itemPrice}>{item.price} RWF</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={() => setCart([...cart, item])}><Plus size={16} color="#D48135" /></TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.floatingCart} onPress={() => setIsCartOpen(true)}>
        <ShoppingCart color="#000" size={24} />
        {cart.length > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.length}</Text></View>}
      </TouchableOpacity>

      <Modal visible={isCartOpen} animationType="slide" transparent>
        <View style={styles.modalBlurOverlay}>
          <View style={styles.cartModalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Your Cart</Text>
              <TouchableOpacity onPress={() => setIsCartOpen(false)}><X color="#FFF" size={24} /></TouchableOpacity>
            </View>
            <ScrollView>{cart.map((item, index) => <View key={index} style={styles.cartItemRow}><Text style={styles.cartItemName}>{item.name}</Text><Text style={styles.cartItemPrice}>{item.price} RWF</Text></View>)}</ScrollView>
            <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>{cartTotal} RWF</Text>
            </View>
            <TextInput style={styles.tableInput} placeholder="Enter Table Number" placeholderTextColor="#52525B" value={tableNumber} onChangeText={setTableNumber} />
            <TouchableOpacity style={styles.btnSubmitOrder} onPress={handleCheckout}><Text style={styles.btnSubmitText}>{submittingOrder ? "PLACING..." : "CONFIRM ORDER"}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isNotiOpen} animationType="slide" transparent>
        <View style={styles.modalBlurOverlay}>
          <View style={styles.cartModalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Order Updates</Text>
              <TouchableOpacity onPress={() => setIsNotiOpen(false)}><X color="#FFF" size={24} /></TouchableOpacity>
            </View>
            {activeOrder ? (
              <View>
                <View style={styles.statusPill}><Text style={styles.statusText}>{activeOrder.status.toUpperCase()}</Text></View>
                {activeOrder.waiter_name && (
                  <View style={styles.staffProfileCard}>
                    <User color="#D48135" size={24} />
                    <View>
                      <Text style={styles.staffName}>{activeOrder.waiter_name}</Text>
                      <Text style={styles.staffPhone}>{activeOrder.waiter_phone}</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : <Text style={styles.emptyText}>No active orders found.</Text>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070708" },
  header: { padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandTitle: { color: "#FFF", fontSize: 28, fontWeight: "900" },
  darkLoaderContainer: { flex: 1, backgroundColor: "#070708", justifyContent: "center", alignItems: "center" },
  navBarContainer: { paddingVertical: 12 },
  navScroll: { paddingHorizontal: 16, gap: 8 },
  navTab: { backgroundColor: "#121214", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1E" },
  navTabActive: { backgroundColor: "#FFF" },
  navTabText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  navTabTextActive: { color: "#050505", fontWeight: "700" },
  gridWrapper: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, justifyContent: "space-between" },
  itemCard: { width: (width - 32) / 2 - 6, backgroundColor: "#121214", borderRadius: 16, borderWidth: 1, borderColor: "#1A1A1E", marginBottom: 12, overflow: "hidden" },
  itemImage: { width: "100%", height: 120, backgroundColor: "#1A1A1E" },
  cardDetails: { padding: 12, gap: 10 },
  itemName: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  itemPrice: { color: "#D48135", fontSize: 14, fontWeight: "800" },
  addBtn: { backgroundColor: "rgba(212, 129, 53, 0.1)", height: 28, width: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  floatingCart: { position: 'absolute', bottom: 20, right: 20, backgroundColor: "#D48135", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  cartBadge: { position: "absolute", top: -4, right: -4, backgroundColor: "#EF4444", borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center" },
  cartBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
  modalBlurOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  cartModalSheet: { backgroundColor: "#121214", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, minHeight: 400 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  cartItemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  cartItemName: { color: "#FFF" },
  cartItemPrice: { color: "#D48135" },
  tableInput: { backgroundColor: "#070708", height: 46, borderRadius: 10, borderWidth: 1, borderColor: "#1A1A1E", color: "#FFF", paddingHorizontal: 16, marginVertical: 15 },
  btnSubmitOrder: { backgroundColor: "#D48135", height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnSubmitText: { color: "#000", fontWeight: "900" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 10, borderTopWidth: 1, borderTopColor: "#1A1A1E", paddingTop: 10 },
  totalLabel: { color: "#A1A1AA", fontSize: 16, fontWeight: "600" },
  totalAmount: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  notiDot: { position: "absolute", top: 0, right: 0, width: 10, height: 10, backgroundColor: "#D48135", borderRadius: 5 },
  statusPill: { backgroundColor: "#1A1A1E", padding: 10, borderRadius: 8, alignItems: "center", marginVertical: 10 },
  statusText: { color: "#FFF", fontWeight: "700" },
  staffProfileCard: { flexDirection: "row", alignItems: "center", gap: 15, padding: 15, backgroundColor: "#1A1A1E", borderRadius: 12 },
  staffName: { color: "#FFF", fontWeight: "700" },
  staffPhone: { color: "#71717A" },
  emptyText: { color: "#71717A", textAlign: "center", marginTop: 20 }
});