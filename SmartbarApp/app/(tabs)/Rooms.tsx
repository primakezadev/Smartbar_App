import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  Dimensions,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, ShieldCheck, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Professional Tip: Include the local require directly in your data array
const ROOMS_DATA = [
  {
    id: '1',
    name: 'Single Room',
    capacity: '1-2',
    price: '100',
    rating: '4.9',
   
    image: require('../../assets/images/single.jpg'), 
    status: 'Available'
  },
  {
    id: '2',
    name: 'Twins Room',
    capacity: '2-4',
    price: '300',
    rating: '4.8',
    image: require('../../assets/images/twins.jpg'), 
    status: 'Limited'
  }
];

const RoomsScreen = () => {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Private Lounges</Text>
          <Text style={styles.headerSubtitle}>Exclusive spaces for your inner circle</Text>
        </View>

        <FlatList
          data={ROOMS_DATA}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.9} style={styles.roomCard}>
              
              {/* 1. Room Image Container */}
              <View style={styles.imageContainer}>
                {/* FIXED: Image is now correctly wrapped in a component */}
                <Image 
                  source={item.image} 
                  style={styles.roomImage} 
                />
                
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.imageOverlay}
                />
                
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
                
                <View style={styles.ratingBadge}>
                  <Star size={12} color="#000" fill="#000" />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              </View>

              {/* 2. Room Details */}
              <View style={styles.detailsContainer}>
                <View style={styles.titleRow}>
                  <Text style={styles.roomName}>{item.name}</Text>
                  <Text style={styles.roomPrice}>${item.price}<Text style={styles.perHour}>/Night</Text></Text>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Users size={16} color="#888" />
                    <Text style={styles.infoText}>{item.capacity} Guests</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.infoItem}>
                    <ShieldCheck size={16} color="#D48135" />
                    <Text style={styles.infoText}>VIP Service</Text>
                  </View>
                </View>

               

                {/* Call to Action */}
                <TouchableOpacity style={styles.bookButton}>
                  <Text style={styles.bookButtonText}>Book Now</Text>
                </TouchableOpacity>
              </View>

            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 24, paddingVertical: 20 },
  headerTitle: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  headerSubtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  roomCard: { 
    backgroundColor: '#111', 
    borderRadius: 24, 
    marginBottom: 24, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222'
  },
  imageContainer: { height: 200, position: 'relative' },
  roomImage: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject },
  statusBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#D48135',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: { color: '#000', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  ratingBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ratingText: { color: '#000', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  detailsContainer: { padding: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  roomPrice: { color: '#D48135', fontSize: 20, fontWeight: 'bold' },
  perHour: { color: '#888', fontSize: 12, fontWeight: 'normal' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  infoText: { color: '#888', fontSize: 14, marginLeft: 6 },
  divider: { width: 1, height: 14, backgroundColor: '#333', marginHorizontal: 15 },
  featuresRow: { flexDirection: 'row', marginTop: 16, flexWrap: 'wrap', gap: 8 },
  featureTag: { 
    backgroundColor: '#1a1a1a', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#333' 
  },
  featureText: { color: '#CCC', fontSize: 12 },
  bookButton: { 
    backgroundColor: '#FFF', 
    marginTop: 20, 
    paddingVertical: 14, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  bookButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});

export default RoomsScreen;