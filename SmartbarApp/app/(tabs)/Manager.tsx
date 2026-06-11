import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, Dimensions, ScrollView, SafeAreaView, Alert, Image } from "react-native";
import { Trash2, ImagePlus, ChevronLeft, ChevronRight } from "lucide-react-native";
import { LineChart } from "react-native-gifted-charts";
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = "https://smartbar-app.onrender.com";
const { width } = Dimensions.get("window");

type ManagerTab = "overview" | "inventory" | "sales" | "reconciliation";
const AVAILABLE_CATEGORIES = ["Beer", "Cider", "Soda", "Water", "Juice", "Brochettes", "Pork", "Sides", "Starters", "Cocktail"];

interface SoldItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  order_id: number;
  table_number: string | number;
}

interface InventoryRow {
  product_id: number;
  name: string;
  category: 'food' | 'drink';
  unit_price: number;
  opening_stock: number;
  purchase_stock: number;
  sales: number;
  closing_stock: number;
  total_price: number;
}

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

export default function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState<ManagerTab>("overview");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Sales tab state (sold-out items, split by category)
  const [foodItems, setFoodItems] = useState<SoldItem[]>([]);
  const [drinkItems, setDrinkItems] = useState<SoldItem[]>([]);
  const [foodTotal, setFoodTotal] = useState(0);
  const [drinksTotal, setDrinksTotal] = useState(0);
  const [salesLoading, setSalesLoading] = useState(true);

  // Reconciliation tab state (daily inventory report)
  const [reportDate, setReportDate] = useState<string>(formatDate(new Date()));
  const [foodInv, setFoodInv] = useState<InventoryRow[]>([]);
  const [drinksInv, setDrinksInv] = useState<InventoryRow[]>([]);
  const [foodInvTotal, setFoodInvTotal] = useState(0);
  const [drinksInvTotal, setDrinksInvTotal] = useState(0);
  const [invLoading, setInvLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, revRes] = await Promise.all([
        fetch(`${BASE_URL}/api/products`),
        fetch(`${BASE_URL}/api/reports/daily`),
      ]);

      const contentType = prodRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned HTML instead of JSON. Check your backend server logs.");
      }

      const prodData = await prodRes.json();
      const revData = await revRes.json();

      if (prodData.products) setProducts(prodData.products);
      else if (Array.isArray(prodData)) setProducts(prodData);

      if (revData.data) {
        setRevenueData(revData.data.map((item: any) => parseFloat(item.revenue) || 0));
      }
    } catch (error) {
      console.error("Sync Error:", error);
      Alert.alert("Sync Error", error instanceof Error ? error.message : "Could not communicate with server.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSoldItems = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BASE_URL}/api/orders/dashboard/sold-items`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      });
      const data = await response.json();
      if (data.success) {
        setFoodItems(data.food || []);
        setDrinkItems(data.drinks || []);
        setFoodTotal(data.foodTotal || 0);
        setDrinksTotal(data.drinksTotal || 0);
      }
    } catch (error) {
      console.error("Sold items fetch failed:", error);
    } finally {
      setSalesLoading(false);
    }
  };

  const fetchDailyInventory = async (date: string) => {
    setInvLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BASE_URL}/api/reports/daily-inventory?date=${date}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      });
      const data = await response.json();
      if (data.success) {
        setFoodInv(data.food || []);
        setDrinksInv(data.drinks || []);
        setFoodInvTotal(data.foodTotal || 0);
        setDrinksInvTotal(data.drinksTotal || 0);
      } else {
        Alert.alert("Error", data.error || "Could not load daily report.");
      }
    } catch (error) {
      console.error("Daily inventory fetch failed:", error);
      Alert.alert("Error", "Could not load daily report.");
    } finally {
      setInvLoading(false);
    }
  };

  const handleUpdateInventoryField = async (
    item: InventoryRow,
    field: 'opening_stock' | 'purchase_stock' | 'unit_price',
    rawValue: string
  ) => {
    const value = parseFloat(rawValue);
    if (isNaN(value)) return;

    const payload: any = {
      item_name: item.name,
      category: item.category,
      record_date: reportDate,
    };
    payload[field] = value;

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BASE_URL}/api/reports/daily-inventory/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        fetchDailyInventory(reportDate);
      } else {
        Alert.alert("Error", data.error || "Could not update value.");
      }
    } catch (error) {
      console.error("Update inventory error:", error);
      Alert.alert("Error", "Could not update value.");
    }
  };

  const changeReportDate = (deltaDays: number) => {
    const d = new Date(reportDate);
    d.setDate(d.getDate() + deltaDays);
    setReportDate(formatDate(d));
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    fetchSoldItems();
    const interval = setInterval(fetchSoldItems, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === "reconciliation") {
      fetchDailyInventory(reportDate);
    }
  }, [activeTab, reportDate]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleCreateProduct = async () => {
    if (!name || !price || !category) {
      return Alert.alert("Validation Error", "Please fill all required fields.");
    }
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("price", price);
      formData.append("category", category);

      if (imageUri) {
        const filename = imageUri.split("/").pop() || "image.jpg";
        const ext = filename.split(".").pop() || "jpg";
        formData.append("imageFile", {
          uri: imageUri,
          name: filename,
          type: `image/${ext}`,
        } as any);
      }

      const response = await fetch(`${BASE_URL}/api/products`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert("Success", "Product added successfully.");
        setName(""); setPrice(""); setCategory(""); setImageUri(null);
        fetchData();
      } else {
        Alert.alert("Error", data.message || "Could not add product.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not add product.");
    }
  };

  const renderInventoryTable = (title: string, rows: InventoryRow[], total: number) => (
    <View style={styles.tableContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          <View style={styles.invHeaderRow}>
            <Text style={[styles.invHeaderCell, styles.colNo]}>No</Text>
            <Text style={[styles.invHeaderCell, styles.colProduct]}>Product</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Unit Price</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Opening</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Purchase</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Sales</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Closing</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Total</Text>
          </View>

          {rows.length === 0 ? (
            <Text style={styles.emptySalesText}>
              {invLoading ? "Loading..." : "No products found."}
            </Text>
          ) : (
            rows.map((item, index) => (
              <View key={`${title}-${item.product_id}`} style={styles.invRow}>
                <Text style={[styles.cell, styles.colNo]}>{index + 1}</Text>
                <Text style={[styles.cell, styles.colProduct]} numberOfLines={1}>{item.name}</Text>

                <TextInput
                  style={[styles.editInput, styles.colNum]}
                  keyboardType="numeric"
                  defaultValue={item.unit_price.toString()}
                  onBlur={(e) => handleUpdateInventoryField(item, 'unit_price', (e.nativeEvent as any).text)}
                />
                <TextInput
                  style={[styles.editInput, styles.colNum]}
                  keyboardType="numeric"
                  defaultValue={item.opening_stock.toString()}
                  onBlur={(e) => handleUpdateInventoryField(item, 'opening_stock', (e.nativeEvent as any).text)}
                />
                <TextInput
                  style={[styles.editInput, styles.colNum]}
                  keyboardType="numeric"
                  defaultValue={item.purchase_stock.toString()}
                  onBlur={(e) => handleUpdateInventoryField(item, 'purchase_stock', (e.nativeEvent as any).text)}
                />

                <Text style={[styles.cell, styles.colNum, { textAlign: 'center' }]}>{item.sales}</Text>
                <Text style={[styles.cell, styles.colNum, { textAlign: 'center', fontWeight: '700' }]}>{item.closing_stock}</Text>
                <Text style={[styles.cell, styles.colNum, { textAlign: 'right', color: '#D48135', fontWeight: '700' }]}>
                  {item.total_price.toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total {title} Sales</Text>
        <Text style={styles.totalValue}>RWF {total.toLocaleString()}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Manager Portal</Text>

      <View style={styles.navBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
          {(["overview", "inventory", "sales", "reconciliation"] as ManagerTab[]).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.navTab, activeTab === tab && styles.navTabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.navTabText, activeTab === tab && styles.navTabTextActive]}>{tab.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {activeTab === "overview" && (
          <View>
            <View style={styles.kpiContainer}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Daily Revenue</Text>
                <Text style={styles.kpiValue}>RWF {revenueData.reduce((a, b) => a + b, 0).toLocaleString()}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Products</Text>
                <Text style={styles.kpiValue}>{products.length}</Text>
              </View>
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Weekly Revenue Trend</Text>
              <LineChart
                data={revenueData.map((value, index) => ({ value, label: ["M","T","W","T","F","S","S"][index] }))}
                width={width - 64}
                height={200}
                color="#D48135"
                thickness={2}
                hideDataPoints={false}
                curved
                noOfSections={4}
                xAxisLabelTextStyle={{ color: "#888", fontSize: 11 }}
                yAxisTextStyle={{ color: "#888", fontSize: 11 }}
                backgroundColor="#121214"
              />
            </View>
          </View>
        )}

        {activeTab === "inventory" && (
          <View>
            <View style={styles.formCard}>
              <TextInput style={styles.input} placeholder="Product Name" placeholderTextColor="#666" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Price (RWF)" placeholderTextColor="#666" keyboardType="numeric" value={price} onChangeText={setPrice} />
              <TouchableOpacity style={styles.dropdownSelector} onPress={() => setDropdownVisible(true)}>
                <Text style={{ color: category ? "#FFF" : "#666" }}>{category || "Select Category"}</Text>
              </TouchableOpacity>

              {/* Image Picker */}
              <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
                <ImagePlus size={18} color={imageUri ? "#D48135" : "#666"} />
                <Text style={{ color: imageUri ? "#D48135" : "#666", marginLeft: 8 }}>
                  {imageUri ? "Image Selected ✓" : "Pick Product Image (Optional)"}
                </Text>
              </TouchableOpacity>

              {/* Image Preview */}
              {imageUri && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateProduct}>
                <Text style={styles.submitBtnText}>SAVE TO STOCK</Text>
              </TouchableOpacity>
            </View>

            {products.map((item) => (
              <View key={item.id} style={styles.productStockRow}>
                {item.image && item.image.length > 5 && (
                  <Image
                    source={{ uri: item.image.startsWith("http") ? item.image : `${BASE_URL}${item.image}` }}
                    style={styles.productThumb}
                  />
                )}
                <Text style={styles.productName}>{item.name}</Text>
                <TouchableOpacity><Trash2 size={18} color="#ef5350" /></TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === "sales" && (
          <View>
            {/* FOOD TABLE */}
            <View style={styles.tableContainer}>
              <Text style={styles.sectionTitle}>Food (Sold Out)</Text>
              <View style={styles.salesHeaderRow}>
                <Text style={[styles.salesHeaderCell, { flex: 2 }]}>Item</Text>
                <Text style={[styles.salesHeaderCell, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.salesHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Price</Text>
                <Text style={[styles.salesHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Total</Text>
              </View>
              {foodItems.length === 0 ? (
                <Text style={styles.emptySalesText}>
                  {salesLoading ? "Loading..." : "No food items sold yet."}
                </Text>
              ) : (
                foodItems.map((item, index) => (
                  <View key={`food-${index}`} style={styles.salesRow}>
                    <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>{item.quantity}</Text>
                    <Text style={[styles.cell, { flex: 1.5, textAlign: 'right' }]}>{item.price.toLocaleString()}</Text>
                    <Text style={[styles.cell, { flex: 1.5, textAlign: 'right', color: '#D48135', fontWeight: '700' }]}>
                      {item.total.toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Food Sales</Text>
                <Text style={styles.totalValue}>RWF {foodTotal.toLocaleString()}</Text>
              </View>
            </View>

            {/* DRINKS TABLE */}
            <View style={[styles.tableContainer, { marginTop: 16 }]}>
              <Text style={styles.sectionTitle}>Drinks (Sold Out)</Text>
              <View style={styles.salesHeaderRow}>
                <Text style={[styles.salesHeaderCell, { flex: 2 }]}>Item</Text>
                <Text style={[styles.salesHeaderCell, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.salesHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Price</Text>
                <Text style={[styles.salesHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Total</Text>
              </View>
              {drinkItems.length === 0 ? (
                <Text style={styles.emptySalesText}>
                  {salesLoading ? "Loading..." : "No drinks sold yet."}
                </Text>
              ) : (
                drinkItems.map((item, index) => (
                  <View key={`drink-${index}`} style={styles.salesRow}>
                    <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.cell, { flex: 1, textAlign: 'center' }]}>{item.quantity}</Text>
                    <Text style={[styles.cell, { flex: 1.5, textAlign: 'right' }]}>{item.price.toLocaleString()}</Text>
                    <Text style={[styles.cell, { flex: 1.5, textAlign: 'right', color: '#D48135', fontWeight: '700' }]}>
                      {item.total.toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Drinks Sales</Text>
                <Text style={styles.totalValue}>RWF {drinksTotal.toLocaleString()}</Text>
              </View>
            </View>

            {/* GRAND TOTAL */}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>RWF {(foodTotal + drinksTotal).toLocaleString()}</Text>
            </View>
          </View>
        )}

        {activeTab === "reconciliation" && (
          <View>
            {/* DATE NAVIGATOR */}
            <View style={styles.dateNavRow}>
              <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeReportDate(-1)}>
                <ChevronLeft size={18} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.dateText}>{reportDate}</Text>
              <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeReportDate(1)}>
                <ChevronRight size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            {renderInventoryTable("Food", foodInv, foodInvTotal)}
            <View style={{ height: 16 }} />
            {renderInventoryTable("Drinks", drinksInv, drinksInvTotal)}

            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>RWF {(foodInvTotal + drinksInvTotal).toLocaleString()}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={dropdownVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalContent}>
            {AVAILABLE_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} style={styles.categoryItem} onPress={() => { setCategory(cat); setDropdownVisible(false); }}>
                <Text style={styles.categoryText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070708" },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#FFF", margin: 16 },
  navBarContainer: { paddingHorizontal: 16, marginBottom: 16 },
  navScroll: { gap: 8 },
  navTab: { backgroundColor: "#121214", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1E" },
  navTabActive: { backgroundColor: "#FFF" },
  navTabText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  navTabTextActive: { color: "#050505", fontWeight: "700" },
  kpiContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: "#121214", padding: 16, borderRadius: 16 },
  kpiLabel: { color: "#71717A", fontSize: 12 },
  kpiValue: { color: "#FFF", fontSize: 18, fontWeight: '800' },
  chartCard: { backgroundColor: "#121214", padding: 16, borderRadius: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#D48135", marginBottom: 12 },
  formCard: { backgroundColor: "#121214", padding: 16, borderRadius: 16, gap: 10, marginBottom: 20 },
  input: { backgroundColor: "#1A1A1E", color: "#FFF", borderRadius: 10, padding: 12 },
  dropdownSelector: { backgroundColor: "#1A1A1E", padding: 12, borderRadius: 10 },
  imagePicker: { backgroundColor: "#1A1A1E", padding: 12, borderRadius: 10, flexDirection: "row", alignItems: "center" },
  imagePreviewContainer: { alignItems: "center", gap: 8 },
  imagePreview: { width: "100%", height: 150, borderRadius: 10, backgroundColor: "#1A1A1E" },
  removeImageBtn: { backgroundColor: "#ef5350", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  removeImageText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  submitBtn: { backgroundColor: "#D48135", padding: 14, borderRadius: 10, alignItems: "center" },
  submitBtnText: { fontWeight: "900", color: "#000" },
  productStockRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#121214", padding: 14, borderRadius: 12, marginBottom: 8, gap: 10 },
  productThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#1A1A1E" },
  productName: { color: "#FFF", fontWeight: "700", flex: 1 },
  tableContainer: { backgroundColor: "#121214", padding: 16, borderRadius: 16 },
  cell: { color: "#FFF", fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.8)" },
  modalContent: { backgroundColor: "#1A1A1E", margin: 20, borderRadius: 12, padding: 10 },
  categoryItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#333", alignItems: "center" },
  categoryText: { color: "#FFF", fontSize: 16 },

  // Sales tab styles
  salesHeaderRow: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#1A1A1E", marginBottom: 4 },
  salesHeaderCell: { color: "#71717A", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  salesRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#1A1A1E" },
  emptySalesText: { color: "#27272A", fontSize: 13, fontWeight: "600", textAlign: "center", paddingVertical: 20 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#1A1A1E" },
  totalLabel: { color: "#94A3B8", fontSize: 13, fontWeight: "700" },
  totalValue: { color: "#D48135", fontSize: 16, fontWeight: "900" },
  grandTotalRow: { backgroundColor: "#121214", borderRadius: 16, padding: 16, marginTop: 16, borderTopWidth: 0 },
  grandTotalLabel: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  grandTotalValue: { color: "#FFF", fontSize: 20, fontWeight: "900" },

  // Reconciliation tab styles
  dateNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 },
  dateNavBtn: { backgroundColor: "#121214", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#1A1A1E" },
  dateText: { color: "#FFF", fontSize: 16, fontWeight: "800", minWidth: 110, textAlign: "center" },
  invHeaderRow: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#1A1A1E", marginBottom: 4 },
  invHeaderCell: { color: "#71717A", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textAlign: "center" },
  invRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#1A1A1E" },
  colNo: { width: 36, textAlign: "center" },
  colProduct: { width: 130 },
  colNum: { width: 80, textAlign: "center" },
  editInput: { backgroundColor: "#1A1A1E", color: "#FFF", borderRadius: 6, padding: 6, marginHorizontal: 2, textAlign: "center", fontSize: 12 },
});