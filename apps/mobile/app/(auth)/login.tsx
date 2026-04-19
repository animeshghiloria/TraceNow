import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
// Mock Firebase imports to prevent initialization
const getAuth = () => ({});
const signInWithPhoneNumber = () => Promise.reject(new Error('Firebase disabled'));
const PhoneAuthProvider = { credential: () => ({}) };
const signInWithCredential = () => Promise.reject(new Error('Firebase disabled'));
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!phone.trim()) return Alert.alert('Enter your phone number');
    setLoading(true);
    try {
      const auth = getAuth();
      const confirmation = await signInWithPhoneNumber(auth, phone.startsWith('+') ? phone : `+91${phone}`);
      setVerificationId((confirmation as any).verificationId);
      setStep('otp');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return Alert.alert('Enter the OTP');
    setLoading(true);
    try {
      const auth = getAuth();
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(auth, credential);
      const idToken = await result.user.getIdToken();
      await login(idToken);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Invalid OTP', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Logo / branding */}
      <View style={styles.hero}>
        <Text style={styles.logo}>📍</Text>
        <Text style={styles.appName}>TraceNow</Text>
        <Text style={styles.tagline}>Every second counts.</Text>
      </View>

      <View style={styles.card}>
        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 98765 43210"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <TouchableOpacity
              style={styles.btn}
              onPress={sendOtp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send OTP</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter OTP sent to {phone}</Text>
            <TextInput
              style={styles.input}
              placeholder="------"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />
            <TouchableOpacity
              style={styles.btn}
              onPress={verifyOtp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify & Enter</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')}>
              <Text style={styles.back}>← Change number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    padding: 24,
  },
  hero: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 64 },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FF6B6B',
    letterSpacing: 2,
    marginTop: 8,
  },
  tagline: { color: '#888', fontSize: 15, marginTop: 4 },
  card: {
    backgroundColor: '#1A1A35',
    borderRadius: 20,
    padding: 28,
    gap: 16,
  },
  label: { color: '#CCC', fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
    backgroundColor: '#0F0F23',
  },
  btn: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  back: { color: '#888', textAlign: 'center', marginTop: 8 },
});
