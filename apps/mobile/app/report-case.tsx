import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, Alert, ActivityIndicator, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCase } from '../services/api';

export default function ReportCaseScreen() {
  const qc = useQueryClient();
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [description, setDescription] = useState('');
  const [lastSeenAt, setLastSeenAt] = useState(new Date());
  const [lastSeenAddr, setLastSeenAddr] = useState('');
  const [alertRadius, setAlertRadius] = useState('5');
  const [image, setImage] = useState<{ uri: string; type: string; name: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const mutation = useMutation({
    mutationFn: createCase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nearbyCases'] });
      Alert.alert('✅ Case Reported', 'Nearby users are being alerted now.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message ?? 'Failed to create case.');
    },
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: 'child.jpg' });
    }
  };

  const captureImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Camera permission required');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: 'child.jpg' });
    }
  };

  const getMyLocation = async () => {
    setGettingLocation(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location permission required');
      setGettingLocation(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    const [geo] = await Location.reverseGeocodeAsync(loc.coords);
    if (geo) setLastSeenAddr(`${geo.street ?? ''}, ${geo.city ?? ''}`);
    setGettingLocation(false);
  };

  const submit = () => {
    if (!childName.trim()) return Alert.alert('Enter child name');
    if (!childAge.trim()) return Alert.alert('Enter child age');
    if (!coords) return Alert.alert('Set last seen location');

    const formData = new FormData();
    formData.append('childName', childName);
    formData.append('childAge', childAge);
    formData.append('description', description);
    formData.append('lastSeenAt', lastSeenAt.toISOString());
    formData.append('lat', String(coords.lat));
    formData.append('lng', String(coords.lng));
    formData.append('lastSeenAddr', lastSeenAddr);
    formData.append('alertRadiusKm', alertRadius);
    if (image) {
      formData.append('image', { uri: image.uri, type: image.type, name: image.name } as any);
    }

    mutation.mutate(formData);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Report Missing Child</Text>
      </View>

      {/* Photo upload */}
      <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoIcon}>📷</Text>
            <Text style={styles.photoText}>Tap to add photo</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cameraBtn} onPress={captureImage}>
        <Text style={styles.cameraBtnText}>📸 Use Camera</Text>
      </TouchableOpacity>

      <Field label="Child's Full Name" value={childName} onChangeText={setChildName} placeholder="e.g. Aryan Sharma" />
      <Field label="Age" value={childAge} onChangeText={setChildAge} placeholder="e.g. 8" keyboardType="number-pad" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Physical appearance, clothing…" multiline />

      {/* Date picker */}
      <Text style={styles.fieldLabel}>Last Seen At</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.inputText}>{lastSeenAt.toLocaleString()}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={lastSeenAt}
          mode="datetime"
          onChange={(_, d) => { setShowDatePicker(false); if (d) setLastSeenAt(d); }}
        />
      )}

      {/* Location */}
      <Text style={styles.fieldLabel}>Last Seen Location</Text>
      <TouchableOpacity style={styles.locationBtn} onPress={getMyLocation} disabled={gettingLocation}>
        {gettingLocation
          ? <ActivityIndicator color="#FF6B6B" />
          : <Text style={styles.locationBtnText}>📍 {coords ? 'Location Set ✓' : 'Use My Current Location'}</Text>
        }
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        placeholder="Or type address…"
        placeholderTextColor="#666"
        value={lastSeenAddr}
        onChangeText={setLastSeenAddr}
      />

      <Field label="Alert Radius (km)" value={alertRadius} onChangeText={setAlertRadius} keyboardType="number-pad" />

      <TouchableOpacity
        style={[styles.submitBtn, mutation.isPending && { opacity: 0.6 }]}
        onPress={submit}
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.submitText}>🚨 Report & Alert Nearby Users</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, ...props }: any) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, props.multiline && { height: 80, textAlignVertical: 'top' }]}
        placeholderTextColor="#666"
        {...props}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType}
        multiline={props.multiline}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23' },
  content: { padding: 20, paddingBottom: 60 },
  header: { marginBottom: 24 },
  back: { color: '#FF6B6B', fontSize: 15, marginBottom: 8 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  photoBox: {
    width: '100%', height: 200, borderRadius: 16,
    overflow: 'hidden', backgroundColor: '#1A1A35',
    marginBottom: 8,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  photoIcon: { fontSize: 40 },
  photoText: { color: '#888', fontSize: 15 },
  cameraBtn: { alignItems: 'center', marginBottom: 20 },
  cameraBtnText: { color: '#FF6B6B', fontWeight: '600' },
  fieldLabel: { color: '#AAA', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#1A1A35',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  inputText: { color: '#FFF', fontSize: 15 },
  locationBtn: {
    backgroundColor: '#1A1A35',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    marginBottom: 8,
  },
  locationBtnText: { color: '#FF6B6B', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
