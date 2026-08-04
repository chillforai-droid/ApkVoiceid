import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('ईमेल डालें', 'कृपया अपना ईमेल दर्ज करें');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      Alert.alert('गड़बड़ी', error.message);
      return;
    }
    Alert.alert('ईमेल भेज दिया', 'पासवर्ड रीसेट लिंक के लिए अपना ईमेल चेक करें', [
      { text: 'ठीक है', onPress: () => navigation.navigate('Login') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>पासवर्ड रीसेट करें</Text>
        <Text style={styles.subtitle}>अपना ईमेल डालें, हम आपको लिंक भेजेंगे</Text>
        <TextInput
          style={styles.input}
          placeholder="ईमेल"
          placeholderTextColor="#8E8E93"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>लिंक भेजें</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>वापस लॉगिन पर जाएं</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 6, marginBottom: 28 },
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
  linkRow: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#38BDF8', fontSize: 14 },
});
