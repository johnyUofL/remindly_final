import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { 
  TextInput, 
  Button, 
  Surface, 
  IconButton,
  useTheme,
  Text as PaperText
} from "react-native-paper";
import { getDatabase, generateUUID } from '../database/database';
import * as SecureStore from "expo-secure-store";
import { synchronize, isOnline, storeAuthToken } from "../services/syncService";
import { colors } from '../styles/colors';

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const router = useRouter();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  const screenHeight = Dimensions.get("window").height;

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const token = await SecureStore.getItemAsync("authToken");
        const db = await getDatabase();
        const users = await db.getAllAsync('SELECT email FROM users WHERE is_deleted = 0 LIMIT 1');
        if (token && users.length > 0) {
          console.log("User already authenticated, redirecting...");
          router.replace("/(tabs)/taskslist");
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Email and password are required.");
      return;
    }

    setIsLoading(true);

    try {
      // Check if we're online 
      const connected = await isOnline();
      if (!connected) {
        setIsLoading(false);
        Alert.alert("No Internet Connection", "Please connect to the internet to sign in.");
        return;
      }

      const response = await fetch(
        "https://taskmanageruofl-af62f00a6541.herokuapp.com/signin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      console.log(`Signin response status: ${response.status}`);
      const responseText = await response.text();
      console.log(`Signin response body: ${responseText}`);

      if (!response.ok) {
        setIsLoading(false);
        if (response.status === 400) {
          Alert.alert("Error", "Invalid email or password.");
        } else {
          Alert.alert("Error", `An unexpected error occurred: ${response.status} - ${responseText}`);
        }
        return;
      }

      const data = JSON.parse(responseText);
      console.log(`Parsed signin data:`, data);

      if (data.success) {
        try {
          const db = await getDatabase();
          const timestamp = Date.now();
          const token = String(data.token);
          console.log(`Storing token: ${token}`);
        
          await storeAuthToken(token);

          const existingUser = await db.getFirstAsync(
            'SELECT id, email, is_deleted FROM users WHERE email = ?', 
            [email]
          );
          
          if (!existingUser) {
            const userId = generateUUID();
            await db.runAsync(
              'INSERT INTO users (id, email, name, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, 0)',
              [userId, email, email.split('@')[0], timestamp, timestamp]
            );
          } else if (existingUser.is_deleted === 1) {
            await db.runAsync(
              'UPDATE users SET is_deleted = 0, updated_at = ? WHERE email = ?',
              [timestamp, email]
            );
          }

          try {
            await synchronize();
            console.log("Synchronization completed");
          } catch (syncError) {
            console.error("Sync failed, proceeding anyway:", syncError.message);
            if (syncError.message?.includes("503")) {
              Alert.alert(
                "Server Temporarily Unavailable", 
                "Login successful, but the server is currently unavailable for syncing. Your app will work offline and sync when the server is available again."
              );
            } else {
              Alert.alert("Warning", "Login successful, but failed to sync data. You can continue offline.");
            }
          }

          setIsLoading(false);
          Alert.alert("Success", "Login successful!");
          router.push("/(tabs)/taskslist");
        } catch (error) {
          setIsLoading(false);
          console.error("Database Error:", error.message);
          Alert.alert("Error", "Failed to save user data.");
        }
      } else {
        setIsLoading(false);
        Alert.alert("Invalid credentials", "The email or password is incorrect.");
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Unexpected error during sign-in:", error);
      Alert.alert("Error", "An error occurred while making the request.");
    }
  };

  if (isLoading) {
    return <ActivityIndicator size="large" color={colors.primary} style={{flex: 1}} />;
  }

  return (
    <LinearGradient
      colors={colors.gradient}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <Image
          source={require("../assets/images/app-logo.png")}
          style={[styles.logo, { marginTop: screenHeight * 0.1 }]}
        />
        <PaperText variant="headlineLarge" style={styles.title}>Sign In</PaperText>
        <Surface style={styles.formContainer} elevation={2}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            autoComplete="email"
            textContentType="emailAddress"
            outlineColor={colors.lightGray}
            activeOutlineColor={colors.primary}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
            autoComplete="password"
            textContentType="password"
            outlineColor={colors.lightGray}
            activeOutlineColor={colors.primary}
            right={
              <TextInput.Icon
                icon={passwordVisible ? "eye-off" : "eye"}
                onPress={() => setPasswordVisible(!passwordVisible)}
                color={colors.gray}
              />
            }
          />
          <Button 
            mode="contained" 
            onPress={handleSignIn}
            style={styles.button}
            buttonColor={colors.primary}
          >
            Log In
          </Button>
          <Button
            mode="text"
            onPress={() => router.push("/signup")}
            style={styles.signupButton}
            textColor={colors.secondary}
          >
            Don't have an account? Sign Up
          </Button>
        </Surface>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  keyboardAvoidingView: { flex: 1, width: '100%', justifyContent: "center", alignItems: "center" },
  logo: { width: 200, height: 200, marginBottom: 20 },
  title: { color: colors.white, textAlign: "center", marginBottom: 30, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  formContainer: { width: "100%", padding: 20, borderRadius: 8, backgroundColor: colors.white },
  input: { marginBottom: 16, backgroundColor: "transparent" },
  button: { marginTop: 16, paddingVertical: 8 },
  signupButton: { marginTop: 16 }
});