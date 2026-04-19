import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getCases } from '../../services/api';
import { router } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  open: '#FF6B6B',
  investigating: '#FFD93D',
  found_safe: '#6BCB77',
  closed: '#888',
};

export default function AlertsScreen() {
  const { data: cases = [], isLoading, refetch } = useQuery({
    queryKey: ['allCases'],
    queryFn: () => getCases({ status: 'open', limit: 50 }),
    refetchInterval: 20_000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚨 Active Alerts</Text>
      {isLoading ? (
        <ActivityIndicator color="#FF6B6B" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(item: any) => item.id}
          onRefresh={refetch}
          refreshing={isLoading}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/case/${item.id}`)}
            >
              <View style={[styles.statusBar, { backgroundColor: STATUS_COLORS[item.status] }]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{item.childName}</Text>
                <Text style={styles.cardAge}>Age {item.childAge}</Text>
                <Text style={styles.cardAddr}>{item.lastSeenAddr ?? 'Unknown location'}</Text>
                <Text style={styles.cardTime}>
                  {formatDistanceToNow(new Date(item.lastSeenAt), { addSuffix: true })}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>No active alerts near you</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23', paddingTop: 60 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800', paddingHorizontal: 20, marginBottom: 8 },
  card: {
    backgroundColor: '#1A1A35', borderRadius: 16,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 12,
    alignItems: 'center',
  },
  statusBar: { width: 5, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 16, gap: 3 },
  cardName: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  cardAge: { color: '#AAA', fontSize: 13 },
  cardAddr: { color: '#888', fontSize: 12 },
  cardTime: { color: '#FF6B6B', fontSize: 12, fontWeight: '600', marginTop: 4 },
  arrow: { color: '#444', fontSize: 22, paddingRight: 16 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyText: { color: '#666', fontSize: 16 },
});
