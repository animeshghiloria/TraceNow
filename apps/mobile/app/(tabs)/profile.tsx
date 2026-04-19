import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserStats, updateProfile } from '../../services/api';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? '');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['userStats'],
    queryFn: getUserStats,
    enabled: !!user,
  });

  const nameMutation = useMutation({
    mutationFn: (name: string) => updateProfile(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      setEditingName(false);
      Alert.alert('✅ Name updated');
    },
    onError: () => Alert.alert('Error', 'Failed to update name.'),
  });

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  const isAuthority = user?.role === 'authority' || user?.role === 'admin';

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarRing}>
        <Text style={styles.avatar}>👤</Text>
      </View>

      {/* Name with edit */}
      <TouchableOpacity onPress={() => { setNameInput(user?.name ?? ''); setEditingName(true); }}>
        <Text style={styles.name}>{user?.name ?? 'TraceNow User'}</Text>
        <Text style={styles.editHint}>✏️ Tap to edit name</Text>
      </TouchableOpacity>
      <Text style={styles.phone}>{user?.phone}</Text>

      {/* Role badges */}
      <View style={styles.badgeRow}>
        {isAuthority && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🛡 Verified Authority</Text>
          </View>
        )}
        {user?.role === 'admin' && (
          <View style={[styles.badge, styles.adminBadge]}>
            <Text style={[styles.badgeText, { color: '#FF6B6B' }]}>⚡ Admin</Text>
          </View>
        )}
      </View>

      {/* Stats cards */}
      <View style={styles.cards}>
        {statsLoading ? (
          <ActivityIndicator color="#FF6B6B" style={{ marginTop: 8 }} />
        ) : (
          <>
            <StatCard
              label="Cases Reported"
              value={String(stats?.casesReported ?? 0)}
              icon="📋"
            />
            <StatCard
              label="Sightings Uploaded"
              value={String(stats?.sightingsUploaded ?? 0)}
              icon="📸"
            />
          </>
        )}
      </View>

      {/* Authority Dashboard button */}
      {isAuthority && (
        <TouchableOpacity
          style={styles.dashboardBtn}
          onPress={() => router.push('/authority/dashboard')}
        >
          <Text style={styles.dashboardBtnText}>🛡 Authority Dashboard →</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Edit Name Modal */}
      <Modal visible={editingName} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Your Name</Text>
            <TextInput
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your full name"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditingName(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={() => nameMutation.mutate(nameInput.trim())}
                disabled={nameMutation.isPending}
              >
                {nameMutation.isPending
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.modalSaveText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0F0F23',
    alignItems: 'center', paddingTop: 80, padding: 24,
  },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#1A1A35', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
    borderWidth: 2, borderColor: '#FF6B6B',
  },
  avatar: { fontSize: 48 },
  name: { color: '#FFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  editHint: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 2 },
  phone: { color: '#888', fontSize: 15, marginTop: 6 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: {
    backgroundColor: '#FFD93D22', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  adminBadge: { backgroundColor: '#FF6B6B22' },
  badgeText: { color: '#FFD93D', fontWeight: '700', fontSize: 13 },
  cards: { flexDirection: 'row', gap: 16, marginTop: 32 },
  statCard: {
    flex: 1, backgroundColor: '#1A1A35', borderRadius: 16,
    padding: 20, alignItems: 'center', gap: 6,
  },
  statIcon: { fontSize: 24 },
  statValue: { color: '#FF6B6B', fontSize: 28, fontWeight: '800' },
  statLabel: { color: '#AAA', fontSize: 11, textAlign: 'center' },
  dashboardBtn: {
    marginTop: 24, backgroundColor: '#1A1A35',
    borderWidth: 1, borderColor: '#FFD93D', borderRadius: 14,
    padding: 14, paddingHorizontal: 28, width: '100%', alignItems: 'center',
  },
  dashboardBtnText: { color: '#FFD93D', fontWeight: '700', fontSize: 15 },
  logoutBtn: {
    marginTop: 16, backgroundColor: '#1A1A35',
    borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 14,
    padding: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center',
  },
  logoutText: { color: '#FF6B6B', fontWeight: '700', fontSize: 15 },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#1A1A35', borderRadius: 20, padding: 24, gap: 16,
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  modalInput: {
    backgroundColor: '#0F0F23', borderRadius: 12,
    padding: 14, color: '#FFF', fontSize: 16,
    borderWidth: 1, borderColor: '#333',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalSave: {
    flex: 1, padding: 14, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#FF6B6B',
  },
  modalSaveText: { color: '#FFF', fontWeight: '700' },
});
