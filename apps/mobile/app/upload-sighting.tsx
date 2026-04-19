import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSighting } from '../services/api';

export default function UploadSightingScreen() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const qc = useQueryClient();
  const [image, setImage] = useState<{ uri: string; type: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gettingLoc, setGettingLoc] = useState(false);

  const mutation = useMutation({
    mutationFn: createSighting,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['sightings', caseId] });
      const conf = data?.confidence;
      const msg = conf != null
        ? `AI confidence: ${Math.round(conf * 100)}%\n${conf >= 0.75 ? '✅ Authorities notified!' : 'Below notification threshold.'}`
        : 'Sighting recorded. AI matching in progress.';
      Alert.alert('Sighting Uploaded', msg, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message ?? 'Upload failed'),
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setImage({ uri: a.uri, type: a.mimeType ?? 'image/jpeg' });
    }
  };

  const captureImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Camera permission required');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setImage({ uri: a.uri, type: a.mimeType ?? 'image/jpeg' });
    }
  };

  const getLocation = async () => {
    setGettingLoc(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setGettingLoc(false); return; }
    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    setGettingLoc(false);
  };

  const submit = () => {
    if (!image) return Alert.alert('Add a photo of the sighting');
    if (!coords) return Alert.alert('Set your current location');
    const formData = new FormData();
    formData.append('caseId', caseId);
    formData.append('lat', String(coords.lat));
    formData.append('lng', String(coords.lng));
    formData.append('notes', notes);
    formData.append('image', { uri: image.uri, type: image.type, name: 'sighting.jpg' } as any);
    mutation.mutate(formData);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Upload Sighting</Text>
      <Text style={styles.subtitle}>
        Help us find the child. Upload a clear photo — our AI will match it immediately.
      </Text>

      {/* Photo */}
      <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
        {image
          ? <Image source={{ uri: image.uri }} style={styles.photo} />
          : <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>🔍</Text>
              <Text style={styles.placeholderText}>Tap to upload sighting photo</Text>
            </View>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.cameraBtn} onPress={captureImage}>
        <Text style={styles.cameraBtnText}>📸 Take Photo</Text>
      </TouchableOpacity>

      {/* Location */}
      <TouchableOpacity
        style={[styles.locBtn, coords && styles.locBtnActive]}
        onPress={getLocation}
        disabled={gettingLoc}
      >
        {gettingLoc
          ? <ActivityIndicator color="#FF6B6B" />
          : <Text style={[styles.locBtnText, coords && { color: '#6BCB77' }]}>
              📍 {coords ? 'Location Captured ✓' : 'Capture My Location'}
            </Text>
        }
      </TouchableOpacity>

      {/* Notes */}
      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={styles.notes}
        placeholder="Describe what you saw, clothing, direction…"
        placeholderTextColor="#666"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
      />

      {/* AI info callout */}
      <View style={styles.aiInfo}>
        <Text style={styles.aiInfoText}>
          🤖 Our AI will compare your photo against the case and return a match score instantly.
          If ≥ 75%, authorities are automatically notified.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, mutation.isPending && { opacity: 0.6 }]}
        onPress={submit}
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.submitText}>Submit Sighting →</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23' },
  content: { padding: 20, paddingBottom: 60 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#FF6B6B', fontSize: 15 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#AAA', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  photoBox: {
    width: '100%', height: 220, borderRadius: 16,
    backgroundColor: '#1A1A35', overflow: 'hidden', marginBottom: 8,
  },
  photo: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  placeholderIcon: { fontSize: 40 },
  placeholderText: { color: '#888', fontSize: 14 },
  cameraBtn: { alignItems: 'center', marginBottom: 20 },
  cameraBtnText: { color: '#FF6B6B', fontWeight: '600' },
  locBtn: {
    borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 20,
  },
  locBtnActive: { borderColor: '#6BCB77' },
  locBtnText: { color: '#FF6B6B', fontWeight: '600' },
  label: { color: '#AAA', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  notes: {
    backgroundColor: '#1A1A35', borderRadius: 12, padding: 14,
    color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: '#2A2A4A',
    height: 100, textAlignVertical: 'top',
  },
  aiInfo: {
    backgroundColor: '#1A1A35', borderRadius: 12, padding: 14,
    marginTop: 20, borderLeftWidth: 3, borderLeftColor: '#FF6B6B',
  },
  aiInfoText: { color: '#AAA', fontSize: 13, lineHeight: 20 },
  submitBtn: {
    backgroundColor: '#FF6B6B', borderRadius: 16,
    padding: 18, alignItems: 'center', marginTop: 24,
  },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
