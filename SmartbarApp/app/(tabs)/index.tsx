import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, Modal, TextInput, Image,
  Animated
} from "react-native";
import { ShoppingCart, Plus, Minus, X, Bell, User, MessageCircle, Phone, ChevronDown, ChevronUp } from "lucide-react-native";
import * as SecureStore from 'expo-secure-store';
import { io } from "socket.io-client";

const BASE_URL = "https://smartbar-app.onrender.com";
const { width, height } = Dimensions.get("window");

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
  specialInstructions?: string;
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
  if (str.length % 4 === 1) throw new Error("'atob' failed");
  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ) {
    const idx = chars.indexOf(buffer);
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return output;
};

const saveActiveOrder = async (order: ActiveOrder | null, userId: string) => {
  try {
    if (order) await SecureStore.setItemAsync(`activeOrder_${userId}`, JSON.stringify(order));
    else await SecureStore.deleteItemAsync(`activeOrder_${userId}`);
  } catch (e) { console.error("Failed to save activeOrder:", e); }
};

const loadActiveOrder = async (userId: string): Promise<ActiveOrder | null> => {
  try {
    const stored = await SecureStore.getItemAsync(`activeOrder_${userId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (e) { return null; }
};

function shuffleArray(arr: ProductItem[]): ProductItem[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Carousel ──────────────────────────────────────────────────────────────────
const CARD_WIDTH = 140;
const CARD_MARGIN = 12;
const CARD_STEP = CARD_WIDTH + CARD_MARGIN;

function ProductCarousel({ products, onAddToCart }: {
  products: ProductItem[];
  onAddToCart: (item: ProductItem) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const currentOffset = useRef(0);
  const items = products.slice(0, 10);

  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(() => {
      const maxOffset = (items.length - 1) * CARD_STEP;
      const nextOffset = currentOffset.current + CARD_STEP > maxOffset ? 0 : currentOffset.current + CARD_STEP;
      scrollRef.current?.scrollTo({ x: nextOffset, animated: true });
      currentOffset.current = nextOffset;
    }, 2200);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <View style={carouselStyles.wrapper}>
      <Text style={styles.headerTitle}>Client Dashboard</Text>
      <Text style={carouselStyles.heading}>Featured</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={carouselStyles.scrollContent}
        onScroll={(e) => { currentOffset.current = e.nativeEvent.contentOffset.x; }}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={carouselStyles.card}
            activeOpacity={0.85}
            onPress={() => { onAddToCart(item); Alert.alert("Added! 🛒", `${item.name} added to cart.`); }}
          >
            <Image
              source={{ uri: item.image && item.image.length > 5 ? item.image : "https://via.placeholder.com/150" }}
              style={carouselStyles.image}
            />
            <View style={carouselStyles.cardBody}>
              <Text style={carouselStyles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={carouselStyles.price}>{item.price} RWF</Text>
              <View style={carouselStyles.addRow}>
                <Plus size={12} color="#000" />
                <Text style={carouselStyles.addText}>Add</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const carouselStyles = StyleSheet.create({
  wrapper: { marginBottom: 8, paddingTop: 8 },
  heading: { color: "#FFF", fontSize: 15, fontWeight: "800", paddingHorizontal: 16, marginBottom: 10, letterSpacing: 0.3 },
  scrollContent: { paddingHorizontal: 16, gap: CARD_MARGIN },
  card: { width: CARD_WIDTH, backgroundColor: "#121214", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1E", overflow: "hidden" },
  image: { width: "100%", height: 90, backgroundColor: "#1A1A1E" },
  cardBody: { padding: 8, gap: 3 },
  name: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  price: { color: "#D48135", fontSize: 11, fontWeight: "800" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#D48135", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4, alignSelf: "flex-start" },
  addText: { color: "#000", fontSize: 11, fontWeight: "800" },
});

// ── Cart Item Row with expandable notes ───────────────────────────────────────
function CartItemRow({
  item,
  onAdd,
  onRemove,
  onUpdateNotes,
}: {
  item: CartItem;
  onAdd: () => void;
  onRemove: () => void;
  onUpdateNotes: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localNote, setLocalNote] = useState(item.specialInstructions || "");

  // Example quick-note chips per category
  const getQuickChips = (): string[] => {
    const cat = item.category.toLowerCase();
    if (["juice", "cocktail", "mocktail", "cocktails", "mocktails"].includes(cat)) {
      return ["Fresh", "No sugar", "With sugar", "Less ice", "No ice", "Extra cold"];
    }
    if (["beer", "cider"].includes(cat)) {
      return ["Very cold", "Room temp", "No glass"];
    }
    if (["soda", "water"].includes(cat)) {
      return ["No ice", "Extra cold", "With lemon"];
    }
    if (["brochettes", "pork", "bites", "sides", "starters", "kitchen"].includes(cat)) {
      return ["Well done", "Medium", "Extra spicy", "No spice", "Extra sauce", "No sauce"];
    }
    return ["No ice", "Extra hot", "Less spicy", "No spicy"];
  };

  const toggleChip = (chip: string) => {
    let updated = localNote;
    if (updated.includes(chip)) {
      updated = updated.replace(chip, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
    } else {
      updated = updated ? `${updated}, ${chip}` : chip;
    }
    setLocalNote(updated);
    onUpdateNotes(updated);
  };

  const chips = getQuickChips();

  return (
    <View style={cartItemStyles.wrapper}>
      {/* Main row */}
      <View style={cartItemStyles.mainRow}>
        <View style={{ flex: 1 }}>
          <Text style={cartItemStyles.name}>{item.name}</Text>
          <Text style={cartItemStyles.price}>{item.price} RWF</Text>
          {/* Show saved note preview when collapsed */}
          {!expanded && localNote.length > 0 && (
            <Text style={cartItemStyles.notePreview} numberOfLines={1}>📝 {localNote}</Text>
          )}
        </View>
        <View style={cartItemStyles.rightGroup}>
          <View style={cartItemStyles.qtyRow}>
            <TouchableOpacity style={cartItemStyles.qtyBtn} onPress={onRemove}>
              <Minus size={14} color="#FFF" />
            </TouchableOpacity>
            <Text style={cartItemStyles.qty}>{item.quantity}</Text>
            <TouchableOpacity style={cartItemStyles.qtyBtn} onPress={onAdd}>
              <Plus size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
          {/* Expand/collapse notes toggle */}
          <TouchableOpacity style={cartItemStyles.noteToggle} onPress={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp size={13} color="#D48135" /> : <ChevronDown size={13} color="#D48135" />}
            <Text style={cartItemStyles.noteToggleText}>{expanded ? "Done" : "Customize"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable notes section */}
      {expanded && (
        <View style={cartItemStyles.notesSection}>
          <Text style={cartItemStyles.notesLabel}>Special Instructions</Text>

          {/* Quick-tap chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cartItemStyles.chipsScroll}>
            <View style={cartItemStyles.chipsRow}>
              {chips.map(chip => {
                const active = localNote.includes(chip);
                return (
                  <TouchableOpacity
                    key={chip}
                    style={[cartItemStyles.chip, active && cartItemStyles.chipActive]}
                    onPress={() => toggleChip(chip)}
                  >
                    <Text style={[cartItemStyles.chipText, active && cartItemStyles.chipTextActive]}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Free-text input */}
          <TextInput
            style={cartItemStyles.notesInput}
            placeholder="Or type your own note e.g. extra lemon, no ice..."
            placeholderTextColor="#52525B"
            value={localNote}
            onChangeText={(t) => { setLocalNote(t); onUpdateNotes(t); }}
            multiline
            numberOfLines={2}
            returnKeyType="done"
          />
        </View>
      )}
    </View>
  );
}

const cartItemStyles = StyleSheet.create({
  wrapper: { borderBottomWidth: 1, borderBottomColor: "#1A1A1E", paddingVertical: 12 },
  mainRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  price: { color: "#D48135", fontSize: 13, marginTop: 2 },
  notePreview: { color: "#71717A", fontSize: 11, marginTop: 4 },
  rightGroup: { alignItems: "flex-end", gap: 8 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { backgroundColor: "#1A1A1E", width: 28, height: 28, borderRadius: 6, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#27272A" },
  qty: { color: "#FFF", fontSize: 15, fontWeight: "700", minWidth: 16, textAlign: "center" },
  noteToggle: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "#D48135" },
  noteToggleText: { color: "#D48135", fontSize: 11, fontWeight: "700" },
  notesSection: { marginTop: 10, gap: 10 },
  notesLabel: { color: "#94A3B8", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  chipsScroll: { marginBottom: 2 },
  chipsRow: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#27272A", backgroundColor: "#1A1A1E" },
  chipActive: { backgroundColor: "rgba(212,129,53,0.15)", borderColor: "#D48135" },
  chipText: { color: "#71717A", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#D48135", fontWeight: "700" },
  notesInput: { backgroundColor: "#070708", borderWidth: 1, borderColor: "#27272A", borderRadius: 10, color: "#FFF", paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 60, textAlignVertical: "top" },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("overview");
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [carouselProducts, setCarouselProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isNotiOpen, setIsNotiOpen] = useState<boolean>(false);
  const [tableNumber, setTableNumber] = useState<string>("");
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
const [isMessageOpen, setIsMessageOpen] = useState(false);
const [messageText, setMessageText] = useState("");
const [messageModalVisible, setMessageModalVisible] = useState(false);


  useEffect(() => {
    const restoreOrder = async () => {
      try {
        const session = await SecureStore.getItemAsync('userSession');
        if (session) {
          const user = JSON.parse(session);
          const userId = String(user.id);
          setCurrentUserId(userId);
          const saved = await loadActiveOrder(userId);
          if (saved) setActiveOrder(saved);
        }
      } catch (e) { console.error("Failed to restore order:", e); }
    };
    restoreOrder();
  }, []);

  useEffect(() => {
    if (currentUserId) saveActiveOrder(activeOrder, currentUserId);
  }, [activeOrder, currentUserId]);

  useEffect(() => {
    if (!activeOrder?.id) return;
    if (activeOrder.waiter_name && activeOrder.waiter_name !== 'Finding Waiter...') return;
    const pollStatus = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/orders/client/status/${activeOrder.id}`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const data = await res.json();
        if (data.success && data.order) {
          const { status, waiter_name, waiter_phone } = data.order;
          if (waiter_name && waiter_name !== activeOrder.waiter_name)
            setActiveOrder(prev => prev ? { ...prev, status, waiter_name, waiter_phone: waiter_phone || "" } : prev);
        }
      } catch (e) {}
    };
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [activeOrder?.id, activeOrder?.waiter_name]);

  useEffect(() => {
    let socket: any;
    const setupLiveConnection = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (!token) return;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const userData = JSON.parse(decodeBase64(base64));
        if (!userData?.userId) return;
        socket = io(BASE_URL);
        socket.on("connect", () => { socket.emit('register_session', { userId: userData.userId, role: 'client' }); });
        socket.on('order_claimed_by_waiter', (data: any) => {
          setActiveOrder(prev => prev && prev.id === data.id ? { ...prev, status: data.status, waiter_name: data.waiter_name, waiter_phone: data.waiter_phone || "" } : prev);
          Alert.alert("Waiter Assigned! 🙋", `${data.waiter_name} will be serving you.\nPhone: ${data.waiter_phone || "N/A"}`);
        });
        socket.on('status_changed', (data: any) => {
          setActiveOrder(prev => prev && prev.id === data.id ? { ...prev, status: data.status } : prev);
          if (data.status === 'preparing') Alert.alert("Order Update 👨‍🍳", "Your order is being prepared!");
          else if (data.status === 'ready') Alert.alert("Order Ready! 🍻", "Your waiter is bringing it now.");
          else if (data.status === 'completed') setActiveOrder(null);
        });
      } catch (err) { console.error("Socket setup error:", err); }
    };
    setupLiveConnection();
    return () => { if (socket) socket.disconnect(); };
  }, []);

  useEffect(() => {
    async function fetchInventory() {
      setLoading(true);
      try {
        const response = await fetch(`${BASE_URL}/api/products`, { headers: { "ngrok-skip-browser-warning": "true" } });
        const data = await response.json();
        if (data?.products) {
          setAllProducts(data.products);
          setCarouselProducts(shuffleArray(data.products).slice(0, 10));
        }
      } catch (error) { console.error("Error:", error); }
      finally { setLoading(false); }
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
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === item.id);
      if (idx > -1) { const n = [...prev]; n[idx].quantity += 1; return n; }
      return [...prev, { ...item, quantity: 1, specialInstructions: "" }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === itemId);
      if (idx > -1) {
        const n = [...prev];
        if (n[idx].quantity > 1) { n[idx].quantity -= 1; return n; }
        return n.filter(i => i.id !== itemId);
      }
      return prev;
    });
  };

  // Update special instructions for a specific cart item
  const updateCartItemNotes = (itemId: number, notes: string) => {
    setCart(prev => prev.map(item => item.id === itemId ? { ...item, specialInstructions: notes } : item));
  };

  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.price as string) * item.quantity, 0).toFixed(2);

  const handleCheckout = async () => {
    if (!tableNumber) return Alert.alert("Required", "Please enter table number.");
    if (cart.length === 0) return Alert.alert("Empty Cart", "Please add items to your cart first.");
    setSubmittingOrder(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return Alert.alert("Authentication Required", "Please log in again.");
      const totalAmount = cart.reduce((sum, item) => sum + parseFloat(item.price as string) * item.quantity, 0);
      const formattedItems = cart.map((item) => {
        const isKitchen = ["Bites", "Pork", "Brochettes", "Sides", "Starters", "kitchen"].includes(item.category);
        return {
          product_id: item.id,
          name: item.name,
          quantity: item.quantity,
          type: isKitchen ? "kitchen" : "drink",
          price: parseFloat(item.price as string),
          // Special instructions sent to backend so waiter/kitchen can see them
          special_instructions: item.specialInstructions || "",
        };
      });
      const response = await fetch(`${BASE_URL}/api/orders/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ table_number: tableNumber, items: formattedItems, total_price: totalAmount }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server returned status ${response.status}: ${errText}`);
      }
      const data = await response.json();
      if (data.success || data.orderId) {
        setActiveOrder({ id: data.orderId, status: 'pending', waiter_name: 'Finding Waiter...', waiter_phone: "" });
        setCart([]);
        setIsCartOpen(false);
        Alert.alert("Order Placed! 🎉", "Finding an available waiter...\n\nCheck notifications for updates.");
      } else {
        Alert.alert("Order Failed", data.message || "The server rejected the order.");
      }
    } catch (error: any) {
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

 const sendMessageToManager = async () => {
  try {
    const token = await SecureStore.getItemAsync("userToken");
    
    // Debug: Check if token exists
    if (!token) {
      console.log("No token found!");
      return;
    }

    const response = await fetch(`${BASE_URL}/api/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ message: messageText }),
    });

    // Capture the raw response text in case it's not JSON
    const responseText = await response.text();
    console.log("Response Status:", response.status);
    console.log("Response Body:", responseText);

    if (response.ok) {
      // Parse only if successful
      const data = JSON.parse(responseText);
      if (data.success) {
        Alert.alert("Sent", "Message sent to manager.");
        setMessageText("");
        setIsMessageOpen(false);
      }
    } else {
      Alert.alert("Error", `Server responded with ${response.status}`);
    }
  } catch (error) {
    console.error("Fetch error:", error);
    Alert.alert("Error", "Check console for network details.");
  }
};

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
              <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{totalItemCount}</Text></View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.darkLoaderContainer}><ActivityIndicator size="large" color="#D48135" /></View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false}>
            <ProductCarousel products={carouselProducts} onAddToCart={addToCart} />
            <View style={styles.divider} />
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
  onPress={() => setMessageModalVisible(true)}
>
  <MessageCircle color="#000" size={24} />
</TouchableOpacity>
          {/* ── CART MODAL ── */}
          <Modal visible={isCartOpen} animationType="slide" transparent>
            <View style={styles.modalBlurOverlay}>
              <View style={styles.cartModalSheet}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Your Cart</Text>
                  <TouchableOpacity onPress={() => setIsCartOpen(false)}>
                    <X color="#FFF" size={24} />
                  </TouchableOpacity>
                </View>

                <ScrollView keyboardShouldPersistTaps="handled">
                  {cart.length > 0 ? (
                    <>
                      {/* Helper hint */}
                      <View style={styles.customizeHint}>
                        <Text style={styles.customizeHintText}>
                          💬 Tap <Text style={{ color: "#D48135", fontWeight: "700" }}>Customize</Text> on any item to add special instructions
                        </Text>
                      </View>

                      {cart.map((item) => (
                        <CartItemRow
                          key={item.id}
                          item={item}
                          onAdd={() => addToCart(item)}
                          onRemove={() => removeFromCart(item.id)}
                          onUpdateNotes={(text) => updateCartItemNotes(item.id, text)}
                        />
                      ))}
                    </>
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
                <TouchableOpacity style={styles.btnSubmitOrder} onPress={handleCheckout} disabled={submittingOrder}>
                  <Text style={styles.btnSubmitText}>{submittingOrder ? "PLACING..." : "CONFIRM ORDER"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

<Modal
  visible={messageModalVisible}
  animationType="slide"
  transparent
>
  <View style={styles.modalBlurOverlay}>
    <View style={styles.cartModalSheet}>

      <View style={styles.modalHeaderRow}>
        <Text style={styles.modalTitle}>Message Manager</Text>

        <TouchableOpacity onPress={() => setMessageModalVisible(false)}>
          <X color="#FFF" size={24} />
        </TouchableOpacity>
      </View>

      {/* INPUT */}
      <TextInput
        placeholder="Type your message..."
        placeholderTextColor="#666"
        style={styles.tableInput}
        value={messageText}
        onChangeText={setMessageText}
        multiline
      />

      {/* SEND BUTTON */}
      <TouchableOpacity
        style={{
          backgroundColor: "#D48135",
          height: 50,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 10
        }}
        onPress={sendMessageToManager}
      >
        <Text style={{ color: "#000", fontWeight: "900" }}>
          SEND MESSAGE
        </Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>

          {/* ── NOTIFICATION PANEL ── */}
          <Modal visible={isNotiOpen} animationType="slide" transparent>
            <View style={styles.modalBlurOverlay}>
              <View style={styles.cartModalSheet}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Order Updates</Text>
                  <TouchableOpacity onPress={() => setIsNotiOpen(false)}><X color="#FFF" size={24} /></TouchableOpacity>
                </View>
                {activeOrder ? (
                  <View style={styles.notiContent}>
                    <View style={styles.orderInfoRow}>
                      <Text style={styles.orderIdText}>Order #{activeOrder.id}</Text>
                      <View style={[styles.statusPill, { backgroundColor: `${getStatusColor(activeOrder.status)}20`, borderColor: getStatusColor(activeOrder.status) }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(activeOrder.status) }]}>{activeOrder.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    {activeOrder.waiter_name && activeOrder.waiter_name !== 'Finding Waiter...' ? (
                      <View style={styles.waiterCard}>
                        <View style={styles.waiterAvatarCircle}><User color="#D48135" size={26} /></View>
                        <View style={styles.waiterInfo}>
                          <Text style={styles.waiterLabel}>YOUR WAITER</Text>
                          <Text style={styles.waiterName}>{activeOrder.waiter_name}</Text>
                          {activeOrder.waiter_phone ? (
                            <View style={styles.phoneRow}><Phone size={13} color="#71717A" /><Text style={styles.waiterPhone}>{activeOrder.waiter_phone}</Text></View>
                          ) : null}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.searchingCard}>
                        <ActivityIndicator size="small" color="#D48135" />
                        <Text style={styles.searchingText}>Finding an available waiter...</Text>
                      </View>
                    )}
                    <View style={styles.timelineContainer}>
                      {['pending', 'preparing', 'ready'].map((step, index) => {
                        const statusOrder = ['pending', 'preparing', 'ready', 'completed'];
                        const currentIndex = statusOrder.indexOf(activeOrder.status);
                        const stepIndex = statusOrder.indexOf(step);
                        const isComplete = currentIndex > stepIndex;
                        const isActive = currentIndex === stepIndex;
                        return (
                          <View key={step} style={styles.timelineStep}>
                            <View style={[styles.timelineDot, isComplete && styles.timelineDotComplete, isActive && styles.timelineDotActive]} />
                            {index < 2 && <View style={[styles.timelineLine, isComplete && styles.timelineLineComplete]} />}
                            <Text style={[styles.timelineLabel, (isActive || isComplete) && styles.timelineLabelActive]}>
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070708" },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#FFF", margin: 16 },
  headerRightRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 16 },
  iconBtn: { position: "relative", padding: 4 },
  darkLoaderContainer: { flex: 1, backgroundColor: "#070708", justifyContent: "center", alignItems: "center" },
  divider: { height: 1, backgroundColor: "#1A1A1E", marginHorizontal: 16, marginBottom: 4 },
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
  cartModalSheet: { backgroundColor: "#121214", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, minHeight: 400, maxHeight: height * 0.9 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  customizeHint: { backgroundColor: "#1A1A1E", borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#27272A" },
  customizeHintText: { color: "#71717A", fontSize: 12, lineHeight: 18 },
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