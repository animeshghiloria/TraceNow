import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { getNearbyCases } from '../../services/api';
import { subscribeToArea } from '../../services/socket';

const { width } = Dimensions.get('window');

const STATUS_COLORS: Record<string, string> = {
  open: '#FF6B6B',
  investigating: '#FFD93D',
  found_safe: '#6BCB77',
  closed: '#888',
};

export default function HomeScreen() {
  const [location, setLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<MapView>(null);
  const locationSetRef = useRef(false);

  // Get location on mount
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const getLocation = async () => {
      try {
        console.log('Requesting location permissions...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('Location permission status:', status);

        if (status === 'granted') {
          console.log('Getting current position...');
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
            timeout: 10000, // 10 second timeout
          });
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          console.log('Location obtained:', lat, lng);
          setLocation({ lat, lng });
          locationSetRef.current = true;
          // Register for area-level WS broadcasts
          subscribeToArea(lat, lng);
        } else {
          console.log('Location permission denied, using fallback');
          setLocation({ lat: 28.6139, lng: 77.2090 }); // Delhi coordinates
          locationSetRef.current = true;
        }
      } catch (error) {
        console.log('Location error, using fallback:', error);
        setLocation({ lat: 28.6139, lng: 77.2090 }); // Delhi coordinates
        locationSetRef.current = true;
      }
    };

    // Start location request
    getLocation();

    // Fallback timeout - if location hasn't been set after 5 seconds, use fallback
    timeoutId = setTimeout(() => {
      if (!locationSetRef.current) {
        console.log('Location timeout, using fallback');
        setLocation({ lat: 28.6139, lng: 77.2090 }); // Delhi coordinates
        locationSetRef.current = true;
      }
    }, 5000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Fetch nearby cases
  const { data: cases = [], isLoading, refetch } = useQuery({
    queryKey: ['nearbyCases', location?.lat, location?.lng],
    queryFn: () => getNearbyCases(location!.lat, location!.lng, 20),
    enabled: !!location,
    refetchInterval: 30_000,
  });

  // Live WebSocket updates - disabled for mock mode
  // useEffect(() => {
  //   const socket = getSocket();
  //   socket.on('new_case', () => refetch());
  //   socket.on('case_updated', () => refetch());
  //   return () => { socket.off('new_case'); socket.off('case_updated'); };
  // }, []);

  if (!location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6B6B" size="large" />
        <Text style={styles.loadingText}>Getting your location…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation
      >
        {cases.map((c: any) => {
          const [lng, lat] = c.last_seen_loc
            ? c.last_seen_loc.replace('POINT(', '').replace(')', '').split(' ').map(Number)
            : [location.lng, location.lat];

          return (
            <React.Fragment key={c.id}>
              <Marker
                coordinate={{ latitude: lat, longitude: lng }}
                title={c.child_name}
                description={`Age ${c.child_age} • ${c.status}`}
                pinColor={STATUS_COLORS[c.status]}
                onPress={() => router.push(`/case/${c.id}`)}
              />
              <Circle
                center={{ latitude: lat, longitude: lng }}
                radius={(c.alertRadius || 2) * 1000}
                fillColor="rgba(255,107,107,0.08)"
                strokeColor="rgba(255,107,107,0.3)"
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Alert banner */}
      {cases.length > 0 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            🚨 {cases.length} missing {cases.length === 1 ? 'child' : 'children'} near you
          </Text>
        </View>
      )}

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Nearby Cases</Text>
        {isLoading ? (
          <ActivityIndicator color="#FF6B6B" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={cases}
            keyExtractor={(item: any) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item }: { item: any }) => (
              <TouchableOpacity
                style={styles.caseCard}
                onPress={() => router.push(`/case/${item.id}`)}
              >
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
                <Text style={styles.caseName}>{item.child_name}</Text>
                <Text style={styles.caseAge}>Age {item.child_age}</Text>
                <Text style={styles.caseDist}>
                  {item.distance_km ? `${Number(item.distance_km).toFixed(1)} km` : '—'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No open cases near you</Text>
            }
          />
        )}
      </View>

      {/* Report FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/report-case')}
      >
        <Text style={styles.fabText}>＋ Report</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F23' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 15 },
  map: { width, height: '60%' },
  banner: {
    backgroundColor: '#FF6B6B',
    padding: 10,
    alignItems: 'center',
  },
  bannerText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  sheet: {
    flex: 1,
    backgroundColor: '#1A1A35',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#333',
    alignSelf: 'center', borderRadius: 2, marginBottom: 16,
  },
  sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  caseCard: {
    backgroundColor: '#0F0F23',
    borderRadius: 14,
    padding: 16,
    marginRight: 12,
    width: 150,
    gap: 4,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  caseName: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  caseAge: { color: '#AAA', fontSize: 13 },
  caseDist: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
  empty: { color: '#666', fontSize: 14, marginTop: 16 },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 32,
    elevation: 8,
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
