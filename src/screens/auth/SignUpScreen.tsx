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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function SignUpScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('जानकारी भरें', 'कृपया सभी फ़ील्ड भरें');
      return;
    }
    if (password.length < 6) {
      Alert.alert('कमज़ोर पासवर्ड', 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('साइनअप नहीं हो पाया', error.message);
      return;
    }
    Alert.alert('अकाउंट बन गया', 'कृपया अपना ईमेल वेरीफाई करें, फिर लॉगिन करें', [
      { text: 'ठीक है', onPress: () => navigation.navigate('Login') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>अकाउंट बनाएं</Text>
          <Text style={styles.subtitle}>VoiceID पर आपका स्वागत है</Text>

          <TextInput
            style={styles.input}
            placeholder="पूरा नाम"
            placeholderTextColor="#8E8E93"
            value={fullName}
            onChangeText={setFullName}
          />
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

          <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>साइन अप करें</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>पहले से अकाउंट है? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>लॉगिन करें</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center', marginTop: 6, marginBottom: 32 },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 14,
  },
  button: { backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: '#94A3B8', fontSize: 14 },
  footerLink: { color: '#22C55E', fontSize: 14, fontWeight: '700' },
});
