import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCases, updateCaseStatus } from '../../services/api';
import { router } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  open: '#FF6B6B',
  investigating: '#FFD93D',
  found_safe: '#6BCB77',
  closed: '#888',
};

const STATUS_LABELS: Record<string, string> = {
  open: '🔴 Open',
  investigating: '🟡 Investigating',
  found_safe: '🟢 Found Safe',
  closed: '⚫ Closed',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['investigating'],
  investigating: ['found_safe', 'closed'],
  found_safe: ['closed'],
  closed: [],
};

export default function AuthorityDashboard() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('open');

  const { data: cases = [], isLoading, refetch } = useQuery({
    queryKey: ['authorityCases', filter],
    queryFn: () => getCases({ status: filter === 'all' ? undefined : filter, limit: 100 }),
    refetchInterval: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateCaseStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authorityCases'] });
      qc.invalidateQueries({ queryKey: ['allCases'] });
      qc.invalidateQueries({ queryKey: ['nearbyCases'] });
    },
    onError: () => Alert.alert('Error', 'Failed to update case status.'),
  });

  const handleStatusChange = (id: string, currentStatus: string) => {
    const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!transitions.length) {
      Alert.alert('Case Closed', 'No further status transitions available.');
      return;
    }

    Alert.alert(
      'Update Case Status',
      'Choose the new status:',
      [
        ...transitions.map((s) => ({
          text: STATUS_LABELS[s],
          onPress: () => statusMutation.mutate({ id, status: s }),
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const FILTERS = ['all', 'open', 'investigating', 'found_safe', 'closed'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🛡 Authority Dashboard</Text>
        <Text style={styles.subtitle}>{cases.length} case{cases.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.chip,
              filter === f && styles.chipActive,
              filter === f && f !== 'all' && { borderColor: STATUS_COLORS[f] },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.chipText,
              filter === f && styles.chipTextActive,
              filter === f && f !== 'all' && { color: STATUS_COLORS[f] },
            ]}>
              {f === 'all' ? 'All' : STATUS_LABELS[f].replace(/^[🔴🟡🟢⚫] /, '')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cases list */}
      {isLoading ? (
        <ActivityIndicator color="#FF6B6B" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#FF6B6B" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>No cases with this status</Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => {
            const name = item.childName ?? item.child_name ?? '—';
            const age = item.childAge ?? item.child_age;
            const addr = item.lastSeenAddr ?? item.last_seen_addr ?? 'Unknown';
            const status = item.status ?? 'open';
            const time = item.lastSeenAt ?? item.last_seen_at ?? item.createdAt;
            const transitions = STATUS_TRANSITIONS[status] ?? [];

            return (
              <View style={styles.card}>
                {/* Accent bar */}
                <View style={[styles.accentBar, { backgroundColor: STATUS_COLORS[status] }]} />

                <View style={styles.cardContent}>
                  {/* Top row: name + status */}
                  <View style={styles.cardTop}>
                    <TouchableOpacity
                      style={styles.cardInfo}
                      onPress={() => router.push(`/case/${item.id}`)}
                    >
                      <Text style={styles.cardName}>{name}</Text>
                      <Text style={styles.cardMeta}>Age {age} · {addr}</Text>
                      {time && (
                        <Text style={styles.cardTime}>
                          {formatDistanceToNow(new Date(time), { addSuffix: true })}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Status badge */}
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] + '22' }]}>
                      <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[status] }]}>
                        {STATUS_LABELS[status]}
                      </Text>
                    </View>
                  </View>

                  {/* Action buttons */}
                  {transitions.length > 0 && (
                    <View style={styles.actions}>
                      {transitions.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.actionBtn, { borderColor: STATUS_COLORS[t] }]}
                          onPress={() => handleStatusChange(item.id, status)}
                          disabled={statusMutation.isPending}
                        >
                          <Text style={[styles.actionBtnText, { color: STATUS_COLORS[t] }]}>
                            → {STATUS_LABELS[t].replace(/^[🔴🟡🟢⚫] /, '')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {statusMutation.isPending && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#FF6B6B" size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { marginBottom: 12 },
  backText: { color: '#FF6B6B', fontSize: 15 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  filtersRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#2A2A4A', backgroundColor: '#1A1A35',
  },
  chipActive: { borderColor: '#FF6B6B', backgroundColor: '#FF6B6B11' },
  chipText: { color: '#888', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FF6B6B' },
  card: {
    backgroundColor: '#1A1A35', borderRadius: 16,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 12,
  },
  accentBar: { width: 5 },
  cardContent: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardInfo: { flex: 1 },
  cardName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cardMeta: { color: '#AAA', fontSize: 13, marginTop: 2 },
  cardTime: { color: '#666', fontSize: 12, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start',
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyIcon: { fontSize: 52 },
  emptyText: { color: '#666', fontSize: 15 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
});
