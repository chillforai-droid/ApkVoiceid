import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('जानकारी भरें', 'कृपया ईमेल और पासवर्ड दोनों डालें');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('लॉगिन नहीं हो पाया', error.message);
    // Success: AuthContext session listener handles navigation automatically
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.title}>VoiceID</Text>
          <Text style={styles.subtitle}>वापसी पर स्वागत है</Text>

          <TextInput
            style={styles.input}
            placeholder="ईमेल"
            placeholderTextColor="#8E8E93"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="पासवर्ड"
            placeholderTextColor="#8E8E93"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>लॉगिन करें</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.linkText}>पासवर्ड भूल गए?</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>नए हैं? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.footerLink}>अकाउंट बनाएं</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { fontSize: 34, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center', marginTop: 6, marginBottom: 36 },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 14,
  },
  button: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow: { alignItems: 'center', marginTop: 18 },
  linkText: { color: '#38BDF8', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: '#94A3B8', fontSize: 14 },
  footerLink: { color: '#22C55E', fontSize: 14, fontWeight: '700' },
});
