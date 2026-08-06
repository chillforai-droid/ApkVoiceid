import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { VoiceCallProvider } from './src/context/VoiceCallContext';
import CallOverlay from './src/components/CallOverlay';
import { NotificationProvider } from './src/context/NotificationContext';
import { PresenceProvider } from './src/context/PresenceContext';
import { ThemeProvider } from './src/context/ThemeContext';

export default function App() {
  return (
    <SafeAreaProvider><ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <PresenceProvider>
          <VoiceCallProvider>
          <StatusBar style="light" />
          <RootNavigator />
          <CallOverlay />
        </VoiceCallProvider>
          </PresenceProvider>
          </NotificationProvider>
      </AuthProvider>
    </ThemeProvider></SafeAreaProvider>
  );
}
