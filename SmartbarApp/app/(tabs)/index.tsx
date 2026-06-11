import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, Modal, TextInput, Image
} from "react-native";
import { ShoppingCart, Plus, Minus, X, Bell, User, MessageCircle, Phone } from "lucide-react-native";
import * as SecureStore from 'expo-secure-store';
import { io } from "socket.io-client";

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

interface CartItem extends ProductItem {
  quantity: number;
}

interface ActiveOrder {
  id: number;
  status: string;
  waiter_name?: string;
  waiter_phone?: string;
}

const decodeBase64 = (input: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }
  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ) {
    const idx = chars.indexOf(buffer);
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  return output;
};

const saveActiveOrder = async (order: ActiveOrder | null) => {
  try {
    if (order) {
      await SecureStore.setItemAsync('activeOrder', JSON.stringify(order));
    } else {
      await SecureStore.deleteItemAsync('activeOrder');
    }
  } catch (e) {
    console.error("Failed to save activeOrder:", e);
  }
};

const loadActiveOrder = async (): Promise<ActiveOrder | null> => {
  try {
    const stored = await SecureStore.getItemAsync('activeOrder');
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

export default function ClientDashboard() {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("overview");
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isNotiOpen, setIsNotiOpen] = useState<boolean>(false);
  const [tableNumber, setTableNumber] = useState<string>("");
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);

  // Restore activeOrder from SecureStore on mount (survives logout/login)
  useEffect(() => {
    const restoreOrder = async () => {
      const saved = await loadActiveOrder();
      if (saved) {
        setActiveOrder(saved);
        console.log("🔁 Restored active order:", JSON.stringify(saved));
      }
    };
    restoreOrder();
  }, []);

  // Save activeOrder to SecureStore whenever it changes
  useEffect(() => {
    saveActiveOrder(activeOrder);
  }, [activeOrder]);

  // REST polling fallback in case socket missed the event
  useEffect(() => {
    if (!activeOrder?.id) return;
    if (activeOrder.waiter_name && activeOrder.waiter_name !== 'Finding Waiter...') return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/orders/client/status/${activeOrder.id}`, {
          headers: { "ngrok-skip-browser-warning": "true" }
        });
        const data = await res.json();
        if (data.success && data.order) {
          const { status, waiter_name, waiter_phone } = data.order;
          if (waiter_name && waiter_name !== activeOrder.waiter_name) {
            setActiveOrder(prev => prev ? {
              ...prev,
              status,
              waiter_name,
              waiter_phone: waiter_phone || ""
            } : prev);
          }
        }
      } catch (e) {
        // silent fail
      }
    };

    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [activeOrder?.id, activeOrder?.waiter_name]);

  // Socket connection for real-time notifications
  useEffect(() => {
    let socket: any;

    const setupLiveConnection = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (!token) return;

        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const decodedPayload = decodeBase64(base64);
        const userData = JSON.parse(decodedPayload);
        if (!userData || !userData.userId) return;

        socket = io(BASE_URL);

        socket.on("connect", () => {
          console.log("🔌 Socket connected for client:", userData.userId);
          socket.emit('register_session', { userId: userData.userId, role: 'client' });
        });

        socket.on('order_claimed_by_waiter', (data: {
          id: number;
          status: string;
          waiter_name: string;
          waiter_phone: string;
        }) => {
          console.log("🔔 order_claimed_by_waiter:", JSON.stringify(data));
          setActiveOrder(prev => {
            if (prev && prev.id === data.id) {
              return {
                ...prev,
                status: data.status,
                waiter_name: data.waiter_name,
                waiter_phone: data.waiter_phone || ""
              };
            }
            return prev;
          });
          Alert.alert(
            "Waiter Assigned! 🙋",
            `${data.waiter_name} will be serving you.\nPhone: ${data.waiter_phone || "N/A"}\n\nOpen notifications for details.`
          );
        });

        socket.on('status_changed', (data: { id: number; status: string }) => {
          setActiveOrder(prev => {
            if (prev && prev.id === data.id) {
              return { ...prev, status: data.status };
            }
            return prev;
          });
          if (data.status === 'preparing') {
            Alert.alert("Order Update 👨‍🍳", "Your order is being prepared!");
          } else if (data.status === 'ready') {
            Alert.alert("Order Ready! 🍻", "Your waiter is bringing it to your table now.");
          } else if (data.status === 'completed') {
            setActiveOrder(null);
          }
        });

      } catch (err) {
        console.error("Socket setup error:", err);
      }
    };

    setupLiveConnection();
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  useEffect(() => {
    async function fetchInventory() {
      setLoading(true);
      try {
        const response = await fetch(`${BASE_URL}/api/products`, {
          headers: { "ngrok-skip-browser-warning": "true" }
        });
        const data = await response.json();
        if (data?.products) setAllProducts(data.products);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInventory();
  }, []);

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

  const addToCart = (item: ProductItem) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((cartItem) => cartItem.id === item.id);
      if (existingIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += 1;
        return newCart;
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((cartItem) => cartItem.id === itemId);
      if (existingIndex > -1) {
        const newCart = [...prevCart];
        if (newCart[existingIndex].quantity > 1) {
          newCart[existingIndex].quantity -= 1;
          return newCart;
        } else {
          return newCart.filter((item) => item.id !== itemId);
        }
      }
      return prevCart;
    });
  };

  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.price as string) * item.quantity, 0).toFixed(2);

  const handleCheckout = async () => {
    if (!tableNumber) return Alert.alert("Required", "Please enter table number.");
    if (cart.length === 0) return Alert.alert("Empty Cart", "Please add items to your cart first.");

    setSubmittingOrder(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        return Alert.alert("Authentication Required", "Please log in again.");
      }

      const totalAmount = cart.reduce((sum, item) => sum + parseFloat(item.price as string) * item.quantity, 0);

      const formattedItems = cart.map((item) => {
        const isKitchen = ["Bites", "Pork", "Brochettes", "Sides", "Starters", "kitchen"].includes(item.category);
        return {
          product_id: item.id,
          name: item.name,
          quantity: item.quantity,
          type: isKitchen ? "kitchen" : "drink",
          price: parseFloat(item.price as string)
        };
      });

      const response = await fetch(`${BASE_URL}/api/orders/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          table_number: tableNumber,
          items: formattedItems,
          total_price: totalAmount
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server returned status ${response.status}: ${errText}`);
      }

      const data = await response.json();

      if (data.success || data.orderId) {
        const newOrder: ActiveOrder = {
          id: data.orderId,
          status: 'pending',
          waiter_name: 'Finding Waiter...',
          waiter_phone: ""
        };
        setActiveOrder(newOrder);
        setCart([]);
        setIsCartOpen(false);
        Alert.alert("Order Placed! 🎉", "Finding an available waiter...\n\nCheck notifications for updates.");
      } else {
        Alert.alert("Order Failed", data.message || "The server rejected the order.");
      }

    } catch (error: any) {
      console.error("Checkout error:", error);
      Alert.alert("Order Error", error.message || "Failed to reach the Smartbar server.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#D48135';
      case 'preparing': return '#3B82F6';
      case 'ready': return '#22C55E';
      case 'completed': return '#71717A';
      default: return '#D48135';
    }
  };

  if (loading) {
    return (
      <View style={styles.darkLoaderContainer}>
        <ActivityIndicator size="large" color="#D48135" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRightRow}>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setIsNotiOpen(true)}>
            <Bell color="#FFF" size={22} />
            {activeOrder && <View style={styles.notiDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setIsCartOpen(true)}>
            <ShoppingCart color="#FFF" size={22} />
            {totalItemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.navBarContainer}>
          <ScrollView horizontal contentContainerStyle={styles.navScroll} showsHorizontalScrollIndicator={false}>
            {(["overview", "drinks", "food", "rooms"] as CategoryType[]).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.navTab, activeCategory === cat && styles.navTabActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.navTabText, activeCategory === cat && styles.navTabTextActive]}>
                  {cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.gridWrapper}>
          {filterProducts(allProducts).map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <Image
                source={{ uri: item.image && item.image.length > 5 ? item.image : "https://via.placeholder.com/150" }}
                style={styles.itemImage}
              />
              <View style={styles.cardDetails}>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.itemPrice}>{item.price} RWF</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item)}>
                    <Plus size={16} color="#D48135" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.floatingMessage}
        onPress={() => Alert.alert("Messages", "Messaging feature coming soon!")}
      >
        <MessageCircle color="#000" size={24} />
      </TouchableOpacity>

      {/* CART MODAL */}
      <Modal visible={isCartOpen} animationType="slide" transparent>
        <View style={styles.modalBlurOverlay}>
          <View style={styles.cartModalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Your Cart</Text>
              <TouchableOpacity onPress={() => setIsCartOpen(false)}>
                <X color="#FFF" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {cart.length > 0 ? (
                cart.map((item) => (
                  <View key={item.id} style={styles.cartItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>{item.price} RWF</Text>
                    </View>
                    <View style={styles.cartActionGroup}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                        <Minus size={14} color="#FFF" />
                      </TouchableOpacity>
                      <Text style={styles.cartItemQty}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}>
                        <Plus size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Your cart is currently empty</Text>
              )}
            </ScrollView>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{cartTotal} RWF</Text>
            </View>
            <TextInput
              style={styles.tableInput}
              placeholder="Enter Table Number"
              placeholderTextColor="#52525B"
              value={tableNumber}
              onChangeText={setTableNumber}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.btnSubmitOrder}
              onPress={handleCheckout}
              disabled={submittingOrder}
            >
              <Text style={styles.btnSubmitText}>
                {submittingOrder ? "PLACING..." : "CONFIRM ORDER"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NOTIFICATION PANEL */}
      <Modal visible={isNotiOpen} animationType="slide" transparent>
        <View style={styles.modalBlurOverlay}>
          <View style={styles.cartModalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Order Updates</Text>
              <TouchableOpacity onPress={() => setIsNotiOpen(false)}>
                <X color="#FFF" size={24} />
              </TouchableOpacity>
            </View>

            {activeOrder ? (
              <View style={styles.notiContent}>

                {/* Order ID + Status */}
                <View style={styles.orderInfoRow}>
                  <Text style={styles.orderIdText}>Order #{activeOrder.id}</Text>
                  <View style={[
                    styles.statusPill,
                    {
                      backgroundColor: `${getStatusColor(activeOrder.status)}20`,
                      borderColor: getStatusColor(activeOrder.status)
                    }
                  ]}>
                    <Text style={[styles.statusText, { color: getStatusColor(activeOrder.status) }]}>
                      {activeOrder.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Waiter Card */}
                {activeOrder.waiter_name && activeOrder.waiter_name !== 'Finding Waiter...' ? (
                  <View style={styles.waiterCard}>
                    <View style={styles.waiterAvatarCircle}>
                      <User color="#D48135" size={26} />
                    </View>
                    <View style={styles.waiterInfo}>
                      <Text style={styles.waiterLabel}>YOUR WAITER</Text>
                      <Text style={styles.waiterName}>{activeOrder.waiter_name}</Text>
                      {activeOrder.waiter_phone ? (
                        <View style={styles.phoneRow}>
                          <Phone size={13} color="#71717A" />
                          <Text style={styles.waiterPhone}>{activeOrder.waiter_phone}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View style={styles.searchingCard}>
                    <ActivityIndicator size="small" color="#D48135" />
                    <Text style={styles.searchingText}>Finding an available waiter...</Text>
                  </View>
                )}

                {/* Status Timeline */}
                <View style={styles.timelineContainer}>
                  {['pending', 'preparing', 'ready'].map((step, index) => {
                    const statusOrder = ['pending', 'preparing', 'ready', 'completed'];
                    const currentIndex = statusOrder.indexOf(activeOrder.status);
                    const stepIndex = statusOrder.indexOf(step);
                    const isComplete = currentIndex > stepIndex;
                    const isActive = currentIndex === stepIndex;
                    return (
                      <View key={step} style={styles.timelineStep}>
                        <View style={[
                          styles.timelineDot,
                          isComplete && styles.timelineDotComplete,
                          isActive && styles.timelineDotActive
                        ]} />
                        {index < 2 && (
                          <View style={[
                            styles.timelineLine,
                            isComplete && styles.timelineLineComplete
                          ]} />
                        )}
                        <Text style={[
                          styles.timelineLabel,
                          (isActive || isComplete) && styles.timelineLabelActive
                        ]}>
                          {step.charAt(0).toUpperCase() + step.slice(1)}
                        </Text>
                      </View>
                    );
                  })}
                </View>

              </View>
            ) : (
              <View style={styles.emptyNotiContainer}>
                <Bell color="#27272A" size={36} />
                <Text style={styles.emptyText}>No active orders</Text>
                <Text style={styles.emptySubText}>Your order updates will appear here</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070708" },
  headerRightRow: { paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 16 },
  iconBtn: { position: "relative", padding: 4 },
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
  floatingMessage: { position: 'absolute', bottom: 20, right: 20, backgroundColor: "#D48135", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  cartBadge: { position: "absolute", top: -2, right: -2, backgroundColor: "#EF4444", borderRadius: 10, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  cartBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "bold" },
  notiDot: { position: "absolute", top: 0, right: 0, width: 10, height: 10, backgroundColor: "#D48135", borderRadius: 5 },
  modalBlurOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  cartModalSheet: { backgroundColor: "#121214", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, minHeight: 400 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  cartItemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1A1A1E" },
  cartItemName: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  cartItemPrice: { color: "#D48135", fontSize: 13, marginTop: 2 },
  cartActionGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBtn: { backgroundColor: "#1A1A1E", width: 28, height: 28, borderRadius: 6, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#27272A" },
  cartItemQty: { color: "#FFF", fontSize: 15, fontWeight: "700", minWidth: 16, textAlign: "center" },
  tableInput: { backgroundColor: "#070708", height: 46, borderRadius: 10, borderWidth: 1, borderColor: "#1A1A1E", color: "#FFF", paddingHorizontal: 16, marginVertical: 15 },
  btnSubmitOrder: { backgroundColor: "#D48135", height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnSubmitText: { color: "#000", fontWeight: "900" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 10, borderTopWidth: 1, borderTopColor: "#1A1A1E", paddingTop: 10 },
  totalLabel: { color: "#A1A1AA", fontSize: 16, fontWeight: "600" },
  totalAmount: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  emptyText: { color: "#71717A", textAlign: "center", marginTop: 12, fontSize: 14 },
  notiContent: { gap: 16 },
  orderInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderIdText: { color: "#A1A1AA", fontSize: 13, fontWeight: "600" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  waiterCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#1A1A1E", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#27272A" },
  waiterAvatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(212,129,53,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212,129,53,0.3)" },
  waiterInfo: { flex: 1, gap: 3 },
  waiterLabel: { color: "#D48135", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  waiterName: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  waiterPhone: { color: "#71717A", fontSize: 13 },
  searchingCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1A1A1E", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#27272A" },
  searchingText: { color: "#71717A", fontSize: 14 },
  timelineContainer: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginTop: 8 },
  timelineStep: { alignItems: "center", flex: 1, position: "relative" },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#27272A", borderWidth: 2, borderColor: "#3F3F46", zIndex: 1 },
  timelineDotActive: { backgroundColor: "#D48135", borderColor: "#D48135" },
  timelineDotComplete: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  timelineLine: { position: "absolute", top: 5, left: "50%", width: "100%", height: 2, backgroundColor: "#27272A" },
  timelineLineComplete: { backgroundColor: "#22C55E" },
  timelineLabel: { color: "#52525B", fontSize: 10, fontWeight: "600", marginTop: 6, textAlign: "center" },
  timelineLabelActive: { color: "#FFF" },
  emptyNotiContainer: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptySubText: { color: "#3F3F46", fontSize: 12 },
});