import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, Dimensions, ScrollView, SafeAreaView } from "react-native";
import { Trash2 } from "lucide-react-native";
import { LineChart } from "react-native-chart-kit";

// Change this line:
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
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { "ngrok-skip-browser-warning": "true" };
      const [prodRes, revRes, drinksRes, kitchenRes] = await Promise.all([
        fetch(`${BASE_URL}/api/products`, { headers }),
        fetch(`${BASE_URL}/api/reports/daily`, { headers }),
        fetch(`${BASE_URL}/api/drinks-inventory`, { headers }), 
        fetch(`${BASE_URL}/api/kitchen-inventory`, { headers })
      ]);

      const prodData = await prodRes.json();
      const revData = await revRes.json();
      const drinksData = await drinksRes.json();
      const kitchenData = await kitchenRes.json();

      // DEBUGGING: See what the API is actually returning
      console.log("Products API:", prodData);
      console.log("Drinks API:", drinksData);
      
      // Update logic based on these logs
      if (prodData.products) setProducts(prodData.products);
      else if (Array.isArray(prodData)) setProducts(prodData); // Case if API returns array directly

      if (revData.data) setRevenueData(revData.data.map((item: any) => parseFloat(item.revenue)));
      
      // Merge logic
      const dData = drinksData.data || drinksData || [];
      const kData = kitchenData.data || kitchenData || [];
      
      const merged = [
        ...dData.map((i: any) => ({ ...i, source: 'drinks_inventory' })),
        ...kData.map((i: any) => ({ ...i, source: 'kitchen_inventory' }))
      ];
      setInventoryData(merged);
    } catch (error) { 
      console.error("Sync Error:", error); 
    } finally { 
      setLoading(false); 
    }
};

  useEffect(() => { fetchData(); }, []);

  const handleCreateProduct = async () => {
    if (!name || !price || !category) return alert("Fill all fields");
    const response = await fetch(`${BASE_URL}/api/products`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price: parseFloat(price), category }) 
    });
    if ((await response.json()).success) {
      alert("Product Added");
      setName(""); setPrice(""); setCategory("");
      fetchData();
    }
  };

  const handleSaveStock = async (source: string, productName: string, value: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/reports/update-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: source, name: productName, closing_stock: parseFloat(value) || 0 }),
      });
      if ((await response.json()).success) fetchData();
    } catch (error) { console.error("Update Error:", error); }
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
              <View style={styles.kpiCard}><Text style={styles.kpiLabel}>Daily Revenue</Text><Text style={styles.kpiValue}>RWF {revenueData.reduce((a, b) => a + b, 0).toLocaleString()}</Text></View>
              <View style={styles.kpiCard}><Text style={styles.kpiLabel}>Total Products</Text><Text style={styles.kpiValue}>{products.length}</Text></View>
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Weekly Revenue Trend</Text>
              <LineChart data={{ labels: ["M", "T", "W", "T", "F", "S", "S"], datasets: [{ data: revenueData.length > 0 ? revenueData : [0,0,0,0,0,0,0] }] }} width={width - 64} height={200} chartConfig={{ backgroundColor: "#121214", backgroundGradientFrom: "#121214", backgroundGradientTo: "#121214", decimalPlaces: 0, color: (opacity = 1) => `rgba(212, 129, 53, ${opacity})` }} bezier style={styles.chart} />
            </View>
          </View>
        )}

        {activeTab === "inventory" && (
          <View>
            <View style={styles.formCard}>
              <TextInput style={styles.input} placeholder="Product Name" placeholderTextColor="#666" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Price (RWF)" placeholderTextColor="#666" keyboardType="numeric" value={price} onChangeText={setPrice} />
              <TouchableOpacity style={styles.dropdownSelector} onPress={() => setDropdownVisible(true)}><Text style={{ color: category ? "#FFF" : "#666" }}>{category || "Select Category"}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateProduct}><Text style={styles.submitBtnText}>SAVE TO STOCK</Text></TouchableOpacity>
            </View>
            {products.map((item) => <View key={item.id} style={styles.productStockRow}><Text style={styles.productName}>{item.name}</Text><TouchableOpacity><Trash2 size={18} color="#ef5350" /></TouchableOpacity></View>)}
          </View>
        )}

        {activeTab === "reconciliation" && (
          <View style={styles.tableContainer}>
            <Text style={styles.sectionTitle}>Daily Reconciliation Report</Text>
            {inventoryData.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.cell}>{item.name}</Text>
                <TextInput style={styles.editInput} keyboardType="numeric" placeholder={item.closing_stock?.toString() || "0"} onBlur={(e) => handleSaveStock(item.source, item.name, (e.nativeEvent as any).text)} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={dropdownVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setDropdownVisible(false)}><View style={styles.modalContent}>{AVAILABLE_CATEGORIES.map((cat) => <TouchableOpacity key={cat} style={styles.categoryItem} onPress={() => { setCategory(cat); setDropdownVisible(false); }}><Text style={styles.categoryText}>{cat}</Text></TouchableOpacity>)}</View></TouchableOpacity>
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
  chart: { marginVertical: 8, borderRadius: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#D48135", marginBottom: 12 },
  formCard: { backgroundColor: "#121214", padding: 16, borderRadius: 16, gap: 10, marginBottom: 20 },
  input: { backgroundColor: "#1A1A1E", color: "#FFF", borderRadius: 10, padding: 12 },
  dropdownSelector: { backgroundColor: "#1A1A1E", padding: 12, borderRadius: 10 },
  submitBtn: { backgroundColor: "#D48135", padding: 14, borderRadius: 10, alignItems: "center" },
  submitBtnText: { fontWeight: "900", color: "#000" },
  productStockRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#121214", padding: 14, borderRadius: 12, marginBottom: 8 },
  productName: { color: "#FFF", fontWeight: "700" },
  tableContainer: { backgroundColor: "#121214", padding: 16, borderRadius: 16 },
  tableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#222" },
  cell: { color: "#FFF", fontSize: 13 },
  editInput: { backgroundColor: "#1A1A1E", color: "#FFF", borderRadius: 6, padding: 5, width: 60, textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.8)" },
  modalContent: { backgroundColor: "#1A1A1E", margin: 20, borderRadius: 12, padding: 10 },
  categoryItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#333", alignItems: "center" },
  categoryText: { color: "#FFF", fontSize: 16 }
});