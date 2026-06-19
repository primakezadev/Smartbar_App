import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Modal, Dimensions, ScrollView, SafeAreaView, Alert, Image
} from "react-native";
import { Trash2, ImagePlus, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react-native";
import { LineChart } from "react-native-gifted-charts";
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = "https://smartbar-app.onrender.com";
const { width } = Dimensions.get("window");

type ManagerTab = "overview" | "inventory" | "reconciliation";

const AVAILABLE_CATEGORIES = [
  "Beer", "Cider", "Soda", "Water", "Juice",
  "Brochettes", "Pork", "Sides", "Starters", "Cocktail"
];

// Map display category → DB category type
const DRINK_CATEGORIES = ["Beer", "Cider", "Soda", "Water", "Juice", "Cocktail"];

interface InventoryRow {
  product_id?: number;
  name: string;
  category: 'food' | 'drink';
  unit_price: number;
  opening_stock: number;
  purchase_stock: number;
  sales: number;
  closing_stock: number;
  total_price: number;
}

interface EditState {
  unit_price: string;
  opening_stock: string;
  purchase_stock: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image?: string;
}

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

export default function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState<ManagerTab>("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState([0, 0, 0, 0, 0, 0, 0]);

  // Add product form
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Edit product modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editDropdownVisible, setEditDropdownVisible] = useState(false);

  // Reconciliation
  const [reportDate, setReportDate] = useState<string>(formatDate(new Date()));
  const [foodInv, setFoodInv] = useState<InventoryRow[]>([]);
  const [drinksInv, setDrinksInv] = useState<InventoryRow[]>([]);
  const [foodInvTotal, setFoodInvTotal] = useState(0);
  const [drinksInvTotal, setDrinksInvTotal] = useState(0);
  const [invLoading, setInvLoading] = useState(false);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // ─── Fetch products + revenue ─────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, revRes] = await Promise.all([
        fetch(`${BASE_URL}/api/products`),
        fetch(`${BASE_URL}/api/reports/daily`),
      ]);
      const ct = prodRes.headers.get("content-type");
      if (!ct?.includes("application/json")) throw new Error("Server returned HTML.");
      const prodData = await prodRes.json();
      const revData  = await revRes.json();
      if (prodData.products)        setProducts(prodData.products);
      else if (Array.isArray(prodData)) setProducts(prodData);
      if (revData.data) setRevenueData(revData.data.map((i: any) => parseFloat(i.revenue) || 0));
    } catch (error) {
      Alert.alert("Sync Error", error instanceof Error ? error.message : "Could not reach server.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Reconciliation data ──────────────────────────────────────────────────
  const fetchDailyInventory = useCallback(async (date: string) => {
    setInvLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res  = await fetch(`${BASE_URL}/api/reports/daily-inventory?date=${date}`, { headers });
      const data = await res.json();

      if (data.success) {
        setFoodInv(data.food   || []);
        setDrinksInv(data.drinks || []);
        setFoodInvTotal(data.foodTotal   || 0);
        setDrinksInvTotal(data.drinksTotal || 0);

        const next: Record<string, EditState> = {};
        [...(data.food || []), ...(data.drinks || [])].forEach((row: InventoryRow) => {
          if (row.name) {
            next[row.name] = {
              unit_price:     String(row.unit_price     ?? 0),
              opening_stock:  String(row.opening_stock  ?? 0),
              purchase_stock: String(row.purchase_stock ?? 0),
            };
          }
        });
        setEditStates(next);
      } else {
        Alert.alert("Error", data.error || "Could not load reports.");
      }
    } catch {
      Alert.alert("Error", "Could not load report data.");
    } finally {
      setInvLoading(false);
    }
  }, []);

  // ─── Save inventory cell ──────────────────────────────────────────────────
  const saveInventoryField = async (
    item: InventoryRow,
    field: 'opening_stock' | 'purchase_stock' | 'unit_price',
    rawValue: string
  ) => {
    const value = parseFloat(rawValue);
    if (isNaN(value) || value < 0) return;
    try {
      const headers = await getAuthHeaders();
      const res  = await fetch(`${BASE_URL}/api/reports/daily-inventory/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_name:   item.name,
          category:    item.category,
          record_date: reportDate,
          [field]:     value,
        }),
      });
      const data = await res.json();
      if (data.success) fetchDailyInventory(reportDate);
      else Alert.alert("Save Error", data.error || "Could not save.");
    } catch {
      Alert.alert("Save Error", "Network error.");
    }
  };

  const getEdit = (n: string): EditState =>
    editStates[n] || { unit_price: "0", opening_stock: "0", purchase_stock: "0" };

  const setEditField = (n: string, field: keyof EditState, value: string) => {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setEditStates(prev => ({ ...prev, [n]: { ...getEdit(n), [field]: value } }));
  };

  const changeReportDate = (delta: number) => {
    const d = new Date(reportDate);
    d.setDate(d.getDate() + delta);
    setReportDate(formatDate(d));
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (activeTab === "reconciliation") fetchDailyInventory(reportDate);
  }, [activeTab, reportDate, fetchDailyInventory]);

  // ─── Image picker ────────────────────────────────────────────────────────
  const pickImage = async (setUri: (uri: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission Required", "Allow media access.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8,
    });
    if (!result.canceled) setUri(result.assets[0].uri);
  };

  // ─── Add product ─────────────────────────────────────────────────────────
  const handleCreateProduct = async () => {
    if (!name || !price || !category)
      return Alert.alert("Validation Error", "All fields required.");
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("price", price);
      // Map category → food/drink for the DB
      formData.append("category", category);
      formData.append("type", DRINK_CATEGORIES.includes(category) ? "drink" : "food");
      if (imageUri) {
        const filename = imageUri.split("/").pop() || "image.jpg";
        formData.append("imageFile", { uri: imageUri, name: filename, type: `image/${filename.split(".").pop() || "jpg"}` } as any);
      }
      const res  = await fetch(`${BASE_URL}/api/products`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", "Product added.");
        setName(""); setPrice(""); setCategory(""); setImageUri(null);
        fetchData();
      } else {
        Alert.alert("Error", data.message || "Failed to add product.");
      }
    } catch {
      Alert.alert("Error", "Could not add product.");
    }
  };

  // ─── Delete product ───────────────────────────────────────────────────────
  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      "Delete Product",
      `Remove "${product.name}" from stock?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const res  = await fetch(`${BASE_URL}/api/products/${product.id}`, {
                method: "DELETE", headers,
              });
              const data = await res.json();
              if (data.success) {
                fetchData();
              } else {
                Alert.alert("Error", data.message || "Could not delete product.");
              }
            } catch {
              Alert.alert("Error", "Network error while deleting.");
            }
          },
        },
      ]
    );
  };

  // ─── Open edit modal ──────────────────────────────────────────────────────
  const openEditModal = (product: Product) => {
    setEditProduct(product);
    setEditName(product.name);
    setEditPrice(String(product.price));
    setEditCategory(product.category);
    setEditImageUri(
      product.image
        ? product.image.startsWith("http")
          ? product.image
          : `${BASE_URL}${product.image}`
        : null
    );
    setEditModalVisible(true);
  };

  // ─── Save edit ────────────────────────────────────────────────────────────
  const handleUpdateProduct = async () => {
    if (!editProduct) return;
    if (!editName || !editPrice || !editCategory)
      return Alert.alert("Validation Error", "All fields required.");
    try {
      const formData = new FormData();
      formData.append("name", editName);
      formData.append("price", editPrice);
      formData.append("category", editCategory);
      formData.append("type", DRINK_CATEGORIES.includes(editCategory) ? "drink" : "food");
      // Only attach a NEW local image (not the existing URL)
      if (editImageUri && !editImageUri.startsWith("http")) {
        const filename = editImageUri.split("/").pop() || "image.jpg";
        formData.append("imageFile", { uri: editImageUri, name: filename, type: `image/${filename.split(".").pop() || "jpg"}` } as any);
      }
      const headers = await getAuthHeaders();
      // Remove Content-Type so fetch sets it with the correct boundary for FormData
      const { 'Content-Type': _, ...headersWithoutCT } = headers as any;
      const res  = await fetch(`${BASE_URL}/api/products/${editProduct.id}`, {
        method: "PUT",
        headers: headersWithoutCT,
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", "Product updated.");
        setEditModalVisible(false);
        fetchData();
      } else {
        Alert.alert("Error", data.message || "Could not update product.");
      }
    } catch {
      Alert.alert("Error", "Network error while updating.");
    }
  };

  // ─── Inventory table ──────────────────────────────────────────────────────
  const renderInventoryTable = (title: string, rows: InventoryRow[], total: number) => (
    <View style={styles.tableContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.invHeaderRow}>
            <Text style={[styles.invHeaderCell, styles.colNo]}>No</Text>
            <Text style={[styles.invHeaderCell, styles.colProduct]}>Product</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Unit{"\n"}Price</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Opening{"\n"}Stock</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Purchase</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Sales</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Closing{"\n"}Stock</Text>
            <Text style={[styles.invHeaderCell, styles.colNum]}>Total</Text>
          </View>

          {rows.length === 0 ? (
            <Text style={styles.emptyText}>
              {invLoading ? "Loading..." : "No items configured."}
            </Text>
          ) : (
            rows.map((item, index) => {
              const edit        = getEdit(item.name);
              const liveOpening  = parseFloat(edit.opening_stock)  || 0;
              const livePurchase = parseFloat(edit.purchase_stock) || 0;
              const liveClosing  = Math.max(0, liveOpening + livePurchase - item.sales);

              return (
                <View key={`${title}-${item.name}-${index}`} style={styles.invRow}>
                  <Text style={[styles.cell, styles.colNo]}>{index + 1}</Text>
                  <Text style={[styles.cell, styles.colProduct]} numberOfLines={1}>{item.name}</Text>

                  <TextInput
                    style={[styles.editInput, styles.colNum]}
                    keyboardType="numeric"
                    value={edit.unit_price}
                    onChangeText={v => setEditField(item.name, 'unit_price', v)}
                    onBlur={() => saveInventoryField(item, 'unit_price', edit.unit_price)}
                    returnKeyType="done"
                  />
                  <TextInput
                    style={[styles.editInput, styles.colNum]}
                    keyboardType="numeric"
                    value={edit.opening_stock}
                    onChangeText={v => setEditField(item.name, 'opening_stock', v)}
                    onBlur={() => saveInventoryField(item, 'opening_stock', edit.opening_stock)}
                    returnKeyType="done"
                  />
                  <TextInput
                    style={[styles.editInput, styles.colNum, styles.purchaseInput]}
                    keyboardType="numeric"
                    value={edit.purchase_stock}
                    onChangeText={v => setEditField(item.name, 'purchase_stock', v)}
                    onBlur={() => saveInventoryField(item, 'purchase_stock', edit.purchase_stock)}
                    returnKeyType="done"
                    placeholder="0"
                    placeholderTextColor="#555"
                  />
                  <Text style={[styles.cell, styles.colNum, { textAlign: 'center' }]}>{item.sales}</Text>
                  <Text style={[styles.cell, styles.colNum, { textAlign: 'center', fontWeight: '700', color: '#4ADE80' }]}>
                    {liveClosing}
                  </Text>
                  <Text style={[styles.cell, styles.colNum, { textAlign: 'right', color: '#D48135', fontWeight: '700' }]}>
                    {parseFloat(item.total_price as any || 0).toLocaleString()}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total {title} Volume Value</Text>
        <Text style={styles.totalValue}>RWF {parseFloat(total as any || 0).toLocaleString()}</Text>
      </View>
    </View>
  );

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Smartbar Portal</Text>

      <View style={styles.navBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
          {(["overview", "inventory", "reconciliation"] as ManagerTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.navTab, activeTab === tab && styles.navTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.navTabText, activeTab === tab && styles.navTabTextActive]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* ── OVERVIEW ── */}
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
                data={revenueData.map((value, i) => ({ value, label: ["M","T","W","T","F","S","S"][i] }))}
                width={width - 64} height={200} color="#D48135" thickness={2}
                hideDataPoints={false} curved noOfSections={4}
                xAxisLabelTextStyle={{ color: "#888", fontSize: 11 }}
                yAxisTextStyle={{ color: "#888", fontSize: 11 }}
                backgroundColor="#121214"
              />
            </View>
          </View>
        )}

        {/* ── INVENTORY ── */}
        {activeTab === "inventory" && (
          <View>
            {/* Add product form */}
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Add New Product</Text>
              <TextInput
                style={styles.input}
                placeholder="Product Name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={styles.input}
                placeholder="Price (RWF)"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
              <TouchableOpacity style={styles.dropdownSelector} onPress={() => setDropdownVisible(true)}>
                <Text style={{ color: category ? "#FFF" : "#666" }}>{category || "Select Category"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(setImageUri)}>
                <ImagePlus size={18} color={imageUri ? "#D48135" : "#666"} />
                <Text style={{ color: imageUri ? "#D48135" : "#666", marginLeft: 8 }}>
                  {imageUri ? "Image Selected ✓" : "Pick Product Image (Optional)"}
                </Text>
              </TouchableOpacity>
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

            {/* Product list */}
            <Text style={styles.sectionTitle}>Current Products ({products.length})</Text>
            {products.map((item, index) => (
              <View key={item.id || `prod-${index}`} style={styles.productStockRow}>
                {item.image && item.image.length > 5 && (
                  <Image
                    source={{ uri: item.image.startsWith("http") ? item.image : `${BASE_URL}${item.image}` }}
                    style={styles.productThumb}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productMeta}>{item.category} · RWF {Number(item.price).toLocaleString()}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
                  <Pencil size={16} color="#D48135" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteProduct(item)}>
                  <Trash2 size={16} color="#ef5350" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── RECONCILIATION ── */}
        {activeTab === "reconciliation" && (
          <View>
            <View style={styles.dateNavRow}>
              <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeReportDate(-1)}>
                <ChevronLeft size={18} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.dateText}>{reportDate}</Text>
              <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeReportDate(1)}>
                <ChevronRight size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D48135' }]} />
                <Text style={styles.legendText}>Purchase (editable, saved to DB)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4ADE80' }]} />
                <Text style={styles.legendText}>Closing → next day opening</Text>
              </View>
            </View>

            {renderInventoryTable("Food Items", foodInv, foodInvTotal)}
            <View style={{ height: 16 }} />
            {renderInventoryTable("Drinks Stock", drinksInv, drinksInvTotal)}

            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Gross Total Value</Text>
              <Text style={styles.grandTotalValue}>
                RWF {(foodInvTotal + drinksInvTotal).toLocaleString()}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Add-product category dropdown ── */}
      <Modal visible={dropdownVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalContent}>
            {AVAILABLE_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryItem}
                onPress={() => { setCategory(cat); setDropdownVisible(false); }}
              >
                <Text style={styles.categoryText}>{cat}</Text>
                {DRINK_CATEGORIES.includes(cat)
                  ? <Text style={styles.categoryBadge}>drink</Text>
                  : <Text style={[styles.categoryBadge, { color: '#4ADE80' }]}>food</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit product modal ── */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Product</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Product Name"
                placeholderTextColor="#666"
                value={editName}
                onChangeText={setEditName}
              />
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Price (RWF)"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={editPrice}
                onChangeText={setEditPrice}
              />
              <TouchableOpacity
                style={[styles.dropdownSelector, { marginTop: 10 }]}
                onPress={() => setEditDropdownVisible(true)}
              >
                <Text style={{ color: editCategory ? "#FFF" : "#666" }}>
                  {editCategory || "Select Category"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.imagePicker, { marginTop: 10 }]}
                onPress={() => pickImage(setEditImageUri)}
              >
                <ImagePlus size={18} color={editImageUri ? "#D48135" : "#666"} />
                <Text style={{ color: editImageUri ? "#D48135" : "#666", marginLeft: 8 }}>
                  {editImageUri ? "Image Selected ✓" : "Change Product Image (Optional)"}
                </Text>
              </TouchableOpacity>

              {editImageUri && (
                <View style={[styles.imagePreviewContainer, { marginTop: 10 }]}>
                  <Image source={{ uri: editImageUri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setEditImageUri(null)}>
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={[styles.submitBtn, { marginTop: 16 }]} onPress={handleUpdateProduct}>
                <Text style={styles.submitBtnText}>SAVE CHANGES</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        {/* Edit-modal category dropdown */}
        <Modal visible={editDropdownVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setEditDropdownVisible(false)}>
            <View style={styles.modalContent}>
              {AVAILABLE_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={styles.categoryItem}
                  onPress={() => { setEditCategory(cat); setEditDropdownVisible(false); }}
                >
                  <Text style={styles.categoryText}>{cat}</Text>
                  {DRINK_CATEGORIES.includes(cat)
                    ? <Text style={styles.categoryBadge}>drink</Text>
                    : <Text style={[styles.categoryBadge, { color: '#4ADE80' }]}>food</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: "#070708" },
  headerTitle:         { fontSize: 24, fontWeight: "900", color: "#FFF", margin: 16 },
  navBarContainer:     { paddingHorizontal: 16, marginBottom: 16 },
  navScroll:           { gap: 8 },
  navTab:              { backgroundColor: "#121214", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1E" },
  navTabActive:        { backgroundColor: "#FFF" },
  navTabText:          { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  navTabTextActive:    { color: "#050505", fontWeight: "700" },
  kpiContainer:        { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard:             { flex: 1, backgroundColor: "#121214", padding: 16, borderRadius: 16 },
  kpiLabel:            { color: "#71717A", fontSize: 12 },
  kpiValue:            { color: "#FFF", fontSize: 18, fontWeight: '800' },
  chartCard:           { backgroundColor: "#121214", padding: 16, borderRadius: 16 },
  sectionTitle:        { fontSize: 15, fontWeight: "800", color: "#D48135", marginBottom: 12 },
  formTitle:           { fontSize: 16, fontWeight: "800", color: "#FFF", marginBottom: 4 },
  formCard:            { backgroundColor: "#121214", padding: 16, borderRadius: 16, gap: 10, marginBottom: 20 },
  input:               { backgroundColor: "#1A1A1E", color: "#FFF", borderRadius: 10, padding: 12 },
  dropdownSelector:    { backgroundColor: "#1A1A1E", padding: 12, borderRadius: 10 },
  imagePicker:         { backgroundColor: "#1A1A1E", padding: 12, borderRadius: 10, flexDirection: "row", alignItems: "center" },
  imagePreviewContainer: { alignItems: "center", gap: 8 },
  imagePreview:        { width: "100%", height: 150, borderRadius: 10, backgroundColor: "#1A1A1E" },
  removeImageBtn:      { backgroundColor: "#ef5350", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  removeImageText:     { color: "#FFF", fontWeight: "700", fontSize: 12 },
  submitBtn:           { backgroundColor: "#D48135", padding: 14, borderRadius: 10, alignItems: "center" },
  submitBtnText:       { fontWeight: "900", color: "#000" },
  productStockRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "#121214", padding: 14, borderRadius: 12, marginBottom: 8, gap: 10 },
  productThumb:        { width: 44, height: 44, borderRadius: 8, backgroundColor: "#1A1A1E" },
  productName:         { color: "#FFF", fontWeight: "700", fontSize: 14 },
  productMeta:         { color: "#71717A", fontSize: 12, marginTop: 2 },
  editBtn:             { backgroundColor: "#1A1A1E", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#D48135" },
  deleteBtn:           { backgroundColor: "#1A1A1E", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#ef5350" },
  tableContainer:      { backgroundColor: "#121214", padding: 16, borderRadius: 16 },
  cell:                { color: "#FFF", fontSize: 13 },
  emptyText:           { color: "#27272A", fontSize: 13, fontWeight: "600", textAlign: "center", paddingVertical: 20 },
  totalRow:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#1A1A1E" },
  totalLabel:          { color: "#94A3B8", fontSize: 13, fontWeight: "700" },
  totalValue:          { color: "#D48135", fontSize: 16, fontWeight: "900" },
  grandTotalRow:       { backgroundColor: "#121214", borderRadius: 16, padding: 16, marginTop: 16, borderTopWidth: 0 },
  grandTotalLabel:     { color: "#FFF", fontSize: 15, fontWeight: "800" },
  grandTotalValue:     { color: "#FFF", fontSize: 20, fontWeight: "900" },
  dateNavRow:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 },
  dateNavBtn:          { backgroundColor: "#121214", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#1A1A1E" },
  dateText:            { color: "#FFF", fontSize: 16, fontWeight: "800", minWidth: 110, textAlign: "center" },
  legendRow:           { flexDirection: "row", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  legendItem:          { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:           { width: 8, height: 8, borderRadius: 4 },
  legendText:          { color: "#71717A", fontSize: 11 },
  invHeaderRow:        { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#1A1A1E", marginBottom: 4 },
  invHeaderCell:       { color: "#71717A", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textAlign: "center" },
  invRow:              { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#1A1A1E" },
  colNo:               { width: 36, textAlign: "center" },
  colProduct:          { width: 130 },
  colNum:              { width: 80, textAlign: "center" },
  editInput:           { backgroundColor: "#1A1A1E", color: "#FFF", borderRadius: 6, padding: 6, marginHorizontal: 2, textAlign: "center", fontSize: 12, width: 80 },
  purchaseInput:       { borderWidth: 1, borderColor: "#D48135" },
  modalOverlay:        { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.8)" },
  modalContent:        { backgroundColor: "#1A1A1E", margin: 20, borderRadius: 12, padding: 10 },
  categoryItem:        { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#333", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  categoryText:        { color: "#FFF", fontSize: 16 },
  categoryBadge:       { color: "#D48135", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  // Edit modal
  editModalOverlay:    { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.75)" },
  editModalContent:    { backgroundColor: "#121214", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" },
  editModalHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  editModalTitle:      { color: "#FFF", fontSize: 18, fontWeight: "800" },
});