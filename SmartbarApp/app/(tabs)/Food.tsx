import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Share2, Heart, Star, Clock, Plus, Minus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const FoodScreen = () => {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* 1. Hero Image Header (Using Local Image) */}
        <View style={styles.heroContainer}>
          <Image 
            source={require('../../assets/images/food back.jpg')} 
            style={styles.heroImage}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(5,5,5,1)']}
            style={styles.gradientOverlay}
          />
          
          <SafeAreaView style={styles.topActions}>
            <TouchableOpacity style={styles.circleBtn}>
              <ArrowLeft size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.rightActions}>
              <TouchableOpacity style={styles.circleBtn}>
                <Share2 size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleBtn}>
                <Heart size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* 2. Restaurant Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.restaurantName}>Windmills Craft (Whitefield)</Text>
            <View style={styles.ratingBadge}>
              <Star size={12} color="#000" fill="#000" />
              <Text style={styles.ratingText}>4.4</Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Clock size={16} color="#4CAF50" />
              <Text style={styles.statText}>10:00 - 22:30</Text>
            </View>
            <View style={[styles.statItem, { marginLeft: 20 }]}>
              <Clock size={16} color="#4CAF50" />
              <Text style={styles.statText}>35 - 40 Min</Text>
            </View>
          </View>
        </View>

        {/* 3. Menu Sections */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Most Popular</Text>
          
          <MenuItem 
            name="Chicken" 
            price="20,000frws" 
            // Example of using a local image for a menu item
            image={require('../../assets/images/chicken.jpg')} 
          />
          
          <MenuItem 
            name="Fish" 
            price="18,000frws" 
            // Example of using a web URL
            image={require('../../assets/images/fish.jpg')} 
          />

          <Text style={styles.sectionTitle}>Starters</Text>
          <MenuItem 
            name="Chips" 
            price="3,000frws"
           image={require('../../assets/images/chips.jpg')} 
          />
        </View>
      </ScrollView>

      {/* Floating Button */}
      <TouchableOpacity style={styles.floatButton}>
        <Text style={styles.floatButtonText}>Add to group</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Reusable Menu Item Component ---
type MenuItemProps = {
  name: string;
  price: string;
  image: any;
};

const MenuItem = ({ name, price, image }: MenuItemProps) => (
  <View style={styles.itemContainer}>
    {/* Correct way to handle both require and uri */}
    <Image source={typeof image === 'string' ? { uri: image } : image} style={styles.itemImage} />
    <View style={styles.itemDetails}>
      <View style={styles.vegIndicator} />
      <Text style={styles.itemName}>{name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.currentPrice}>{price}</Text>
      </View>
    </View>
    <View style={styles.quantityContainer}>
      <TouchableOpacity style={styles.qtyBtn}><Minus size={14} color="#D48135" /></TouchableOpacity>
      <Text style={styles.qtyText}>0</Text>
      <TouchableOpacity style={styles.qtyBtn}><Plus size={14} color="#D48135" /></TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  heroContainer: { height: 280, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  gradientOverlay: { ...StyleSheet.absoluteFillObject },
  topActions: { 
    position: 'absolute', 
    width: '100%', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20,
    top: 10 
  },
  rightActions: { flexDirection: 'row', gap: 10 },
  circleBtn: { 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    padding: 8, 
    borderRadius: 50 
  },
  infoCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginTop: -40,
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restaurantName: { fontSize: 18, fontWeight: '700', color: '#333' },
  ratingBadge: { 
    backgroundColor: '#FFD700', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  ratingText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  statsRow: { flexDirection: 'row', marginTop: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center' },
  statText: { fontSize: 13, color: '#666', marginLeft: 6 },
  menuSection: { paddingHorizontal: 20, marginTop: 24, paddingBottom: 100 },
  sectionTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 16, marginTop: 10 },
  itemContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#111', 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 16,
    alignItems: 'center' 
  },
  itemImage: { width: 80, height: 80, borderRadius: 12 },
  itemDetails: { flex: 1, marginLeft: 16 },
  vegIndicator: { width: 10, height: 10, backgroundColor: '#4CAF50', borderRadius: 2, marginBottom: 4 },
  itemName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  oldPrice: { color: '#888', textDecorationLine: 'line-through', fontSize: 12, marginRight: 8 },
  currentPrice: { color: '#FFF', fontWeight: '700' },
  quantityContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#333', 
    borderRadius: 8,
    padding: 4 
  },
  qtyBtn: { padding: 4 },
  qtyText: { color: '#D48135', marginHorizontal: 10, fontWeight: 'bold' },
  floatButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#E91E63',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 5
  },
  floatButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default FoodScreen;