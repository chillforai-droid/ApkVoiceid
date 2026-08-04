import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { VoiceCallProvider } from './src/context/VoiceCallContext';
import CallOverlay from './src/components/CallOverlay';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <VoiceCallProvider>
          <StatusBar style="light" />
          <RootNavigator />
          <CallOverlay />
        </VoiceCallProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
