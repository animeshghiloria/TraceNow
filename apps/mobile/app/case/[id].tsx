import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCaseById, getSightings } from '../../services/api';
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

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => getCaseById(id),
  });

  const { data: sightings = [], isLoading: sightingsLoading } = useQuery({
    queryKey: ['sightings', id],
    queryFn: () => getSightings(id),
    refetchInterval: 15_000,
  });

  // Live WebSocket updates - disabled for mock mode
  // useEffect(() => {
  //   subscribeToCase(id);
  //   const socket = getSocket();
  //   socket.on('new_sighting', () => qc.invalidateQueries({ queryKey: ['sightings', id] }));
  //   socket.on('case_updated', () => qc.invalidateQueries({ queryKey: ['case', id] }));
  //   return () => { socket.off('new_sighting'); socket.off('case_updated'); };
  // }, [id]);

  if (caseLoading) {
    return <View style={styles.center}><ActivityIndicator color="#FF6B6B" size="large" /></View>;
  }

  if (!caseData) {
    return <View style={styles.center}><Text style={styles.errorText}>Case not found</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {/* Hero image */}
      {caseData.imageUrl && (
        <Image source={{ uri: caseData.imageUrl }} style={styles.heroImg} />
      )}

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[caseData.status] + '22' }]}>
        <Text style={[styles.statusText, { color: STATUS_COLORS[caseData.status] }]}>
          {STATUS_LABELS[caseData.status]}
        </Text>
      </View>

      {/* Info */}
      <Text style={styles.childName}>{caseData.childName}</Text>
      <Text style={styles.childAge}>Age: {caseData.childAge}</Text>
      {caseData.description && <Text style={styles.description}>{caseData.description}</Text>}

      <View style={styles.infoRow}>
        <InfoItem icon="📍" label="Last Seen" value={caseData.lastSeenAddr ?? 'Unknown location'} />
        <InfoItem
          icon="🕐"
          label="When"
          value={formatDistanceToNow(new Date(caseData.lastSeenAt), { addSuffix: true })}
        />
      </View>

      {/* Upload sighting */}
      <TouchableOpacity
        style={styles.sightingBtn}
        onPress={() => router.push({ pathname: '/upload-sighting', params: { caseId: id } })}
      >
        <Text style={styles.sightingBtnText}>📸 Upload a Sighting</Text>
      </TouchableOpacity>

      {/* Sightings list */}
      <Text style={styles.sectionTitle}>
        Sightings ({sightings.length})
      </Text>
      {sightingsLoading ? (
        <ActivityIndicator color="#FF6B6B" style={{ marginTop: 16 }} />
      ) : (
        sightings.map((s: any) => (
          <View key={s.id} style={styles.sightingCard}>
            {s.imageUrl && (
              <Image source={{ uri: s.imageUrl }} style={styles.sightingImg} />
            )}
            <View style={styles.sightingInfo}>
              <Text style={styles.sightingAddrText}>{s.address ?? 'Location unknown'}</Text>
              {s.confidence != null && (
                <Text style={[
                  styles.confidence,
                  { color: s.confidence >= 0.75 ? '#6BCB77' : '#FFD93D' }
                ]}>
                  AI Match: {Math.round(s.confidence * 100)}%
                </Text>
              )}
              <Text style={styles.sightingTime}>
                {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23' },
  content: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F23' },
  errorText: { color: '#888' },
  backBtn: { marginBottom: 16 },
  backText: { color: '#FF6B6B', fontSize: 15 },
  heroImg: { width: '100%', height: 240, borderRadius: 16, marginBottom: 16 },
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginBottom: 12,
  },
  statusText: { fontWeight: '700', fontSize: 14 },
  childName: { color: '#FFF', fontSize: 26, fontWeight: '800' },
  childAge: { color: '#AAA', fontSize: 15, marginTop: 4 },
  description: { color: '#CCC', fontSize: 14, marginTop: 10, lineHeight: 20 },
  infoRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  infoItem: {
    flex: 1, backgroundColor: '#1A1A35', borderRadius: 14,
    padding: 14, gap: 4,
  },
  infoIcon: { fontSize: 20 },
  infoLabel: { color: '#888', fontSize: 11 },
  infoValue: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  sightingBtn: {
    backgroundColor: '#FF6B6B', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  sightingBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginTop: 28, marginBottom: 12 },
  sightingCard: {
    backgroundColor: '#1A1A35', borderRadius: 14,
    flexDirection: 'row', overflow: 'hidden', marginBottom: 12,
  },
  sightingImg: { width: 80, height: 80 },
  sightingInfo: { flex: 1, padding: 12, gap: 4 },
  sightingAddrText: { color: '#CCC', fontSize: 13 },
  confidence: { fontSize: 13, fontWeight: '700' },
  sightingTime: { color: '#666', fontSize: 12 },
});
