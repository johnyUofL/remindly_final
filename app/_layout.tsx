import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { CustomLightTheme, CustomDarkTheme } from '../constants/MaterialTheme';
import { useColorScheme } from '../hooks/useColorScheme';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// database initialization
import { initDatabase } from '../database/database';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize the database when the app starts
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        await initDatabase();
        console.log('Database initialized successfully');
        setIsLoading(false);
      } catch (error: unknown) {
        console.error('Failed to initialize database:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    };

    setupDatabase();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10 }}>Initializing database...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', fontSize: 16, marginBottom: 10 }}>Error initializing database:</Text>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <Stack screenOptions={{ headerShown: false }} />
    </PaperProvider>
  );
}
