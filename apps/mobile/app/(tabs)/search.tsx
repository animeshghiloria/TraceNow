import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { searchCases } from '../../services/api';
import { router } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  open: '#FF6B6B',
  investigating: '#FFD93D',
  found_safe: '#6BCB77',
  closed: '#888',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  found_safe: 'Found Safe',
  closed: 'Closed',
};

const FILTERS = ['all', 'open', 'investigating', 'found_safe', 'closed'] as const;
type Filter = typeof FILTERS[number];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');

  const { data: cases = [], isLoading, refetch } = useQuery({
    queryKey: ['cases', activeFilter, query],
    queryFn: () =>
      searchCases(
        query.trim(),
        activeFilter === 'all' ? undefined : activeFilter
      ),
    staleTime: 15_000,
  });

  const filtered = cases;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.pageTitle}>🔍 Search Cases</Text>

      {/* Search input */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔎</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by child name…"
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Status filters */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              activeFilter === f && styles.filterChipActive,
              activeFilter === f && f !== 'all' && { borderColor: STATUS_COLORS[f] },
            ]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[
              styles.filterChipText,
              activeFilter === f && styles.filterChipTextActive,
              activeFilter === f && f !== 'all' && { color: STATUS_COLORS[f] },
            ]}>
              {f === 'all' ? 'All' : STATUS_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      {isLoading ? (
        <ActivityIndicator color="#FF6B6B" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          onRefresh={refetch}
          refreshing={isLoading}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>
                {query.trim() ? `No results for "${query}"` : 'No cases found'}
              </Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => {
            const name = item.childName ?? item.child_name ?? '—';
            const age = item.childAge ?? item.child_age ?? '—';
            const addr = item.lastSeenAddr ?? item.last_seen_addr ?? 'Unknown location';
            const status = item.status ?? 'open';
            const time = item.lastSeenAt ?? item.last_seen_at ?? item.createdAt;

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/case/${item.id}`)}
                activeOpacity={0.8}
              >
                {/* Status accent bar */}
                <View style={[styles.statusBar, { backgroundColor: STATUS_COLORS[status] }]} />

                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{name}</Text>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[status] + '22' }]}>
                      <Text style={[styles.statusPillText, { color: STATUS_COLORS[status] }]}>
                        {STATUS_LABELS[status]}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardAge}>Age {age}</Text>
                  <Text style={styles.cardAddr} numberOfLines={1}>📍 {addr}</Text>

                  {time && (
                    <Text style={styles.cardTime}>
                      🕐 {formatDistanceToNow(new Date(time), { addSuffix: true })}
                    </Text>
                  )}
                </View>

                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23', paddingTop: 60 },
  pageTitle: {
    color: '#FFF', fontSize: 24, fontWeight: '800',
    paddingHorizontal: 20, marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A35', borderRadius: 14,
    marginHorizontal: 16, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#2A2A4A', marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1, color: '#FFF', fontSize: 15,
    paddingVertical: 13,
  },
  filtersRow: {
    flexDirection: 'row', paddingHorizontal: 12,
    marginBottom: 8, gap: 8, flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#2A2A4A',
    backgroundColor: '#1A1A35',
  },
  filterChipActive: { borderColor: '#FF6B6B', backgroundColor: '#FF6B6B11' },
  filterChipText: { color: '#888', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#FF6B6B' },
  card: {
    backgroundColor: '#1A1A35', borderRadius: 16,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 12,
    alignItems: 'center',
  },
  statusBar: { width: 5, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 14, gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1 },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginLeft: 8,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  cardAge: { color: '#AAA', fontSize: 13 },
  cardAddr: { color: '#888', fontSize: 12 },
  cardTime: { color: '#FF6B6B', fontSize: 12, fontWeight: '600', marginTop: 2 },
  arrow: { color: '#444', fontSize: 22, paddingRight: 16 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyIcon: { fontSize: 52 },
  emptyText: { color: '#666', fontSize: 15, textAlign: 'center' },
});
