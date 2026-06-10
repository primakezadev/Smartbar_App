import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, Dimensions, ScrollView, SafeAreaView, Alert, Image } from "react-native";
import { Trash2, ImagePlus } from "lucide-react-native";
import { LineChart } from "react-native-gifted-charts";
import * as ImagePicker from 'expo-image-picker';

const BASE_URL = "https://smartbar-app.onrender.com";
const { width } = Dimensions.get("window");

type ManagerTab = "overview" | "inventory" | "reconciliation";
const AVAILABLE_CATEGORIES = ["Beer", "Cider", "Soda", "Water", "Juice", "Brochettes", "Pork", "Sides", "Starters", "Cocktail"];

export default function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState<ManagerTab>("overview");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, revRes, inventoryReportRes] = await Promise.all([
        fetch(`${BASE_URL}/api/products`),
        fetch(`${BASE_URL}/api/reports/daily`),
        fetch(`${BASE_URL}/api/reports/inventory-report`)
      ]);

      const contentType = prodRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned HTML instead of JSON. Check your backend server logs.");
      }

      const prodData = await prodRes.json();
      const revData = await revRes.json();
      const invReportData = await inventoryReportRes.json();

      if (invReportData.success && Array.isArray(invReportData.data)) {
        setInventoryData(invReportData.data);
      } else {
        setInventoryData([]);
      }

      if (prodData.products) setProducts(prodData.products);
      else if (Array.isArray(prodData)) setProducts(prodData);

      if (revData.data) {
        setRevenueData(revData.data.map((item: any) => parseFloat(item.revenue) || 0));
      }

      let finalInventory: any[] = [];
      if (Array.isArray(invReportData)) {
        finalInventory = invReportData;
      } else if (invReportData.data && Array.isArray(invReportData.data)) {
        finalInventory = invReportData.data;
      } else {
        const dData = invReportData.drinks || [];
        const kData = invReportData.kitchen || [];
        finalInventory = [
          ...dData.map((i: any) => ({ ...i, source: 'drinks_inventory' })),
          ...kData.map((i: any) => ({ ...i, source: 'kitchen_inventory' }))
        ];
      }
      setInventoryData(finalInventory);

    } catch (error) {
      console.error("Sync Error:", error);
      Alert.alert("Sync Error", error instanceof Error ? error.message : "Could not communicate with server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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

  const handleSaveStock = async (source: string, productName: string, value: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/reports/update-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: source, name: productName, closing_stock: parseFloat(value) || 0 }),
      });
      const data = await response.json();
      if (data.success) console.log("Stock saved successfully");
    } catch (error) {
      console.error("Update Error:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Manager Portal</Text>

      <View style={styles.navBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
          {(["overview", "inventory", "reconciliation"] as ManagerTab[]).map((tab) => (
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

        {activeTab === "reconciliation" && (
          <View style={styles.tableContainer}>
            <Text style={styles.sectionTitle}>Daily Reconciliation Report</Text>
            {inventoryData.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.cell}>{item.name}</Text>
                <TextInput
                  style={styles.editInput}
                  keyboardType="numeric"
                  placeholder={item.closing_stock?.toString() || "0"}
                  onBlur={(e) => handleSaveStock(item.source, item.name, (e.nativeEvent as any).text)}
                />
              </View>
            ))}
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
  tableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#222" },
  cell: { color: "#FFF", fontSize: 13 },
  editInput: { backgroundColor: "#1A1A1E", color: "#FFF", borderRadius: 6, padding: 5, width: 60, textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.8)" },
  modalContent: { backgroundColor: "#1A1A1E", margin: 20, borderRadius: 12, padding: 10 },
  categoryItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#333", alignItems: "center" },
  categoryText: { color: "#FFF", fontSize: 16 }
});