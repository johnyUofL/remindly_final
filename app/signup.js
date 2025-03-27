import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
  Image,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  TextInput,
  Button,
  Surface,
  Headline,
  HelperText,
  Provider,
} from "react-native-paper";
import { getDatabase, generateUUID } from '../database/database';
import { colors } from '../styles/colors';

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [password1Visible, setPassword1Visible] = useState(false);
  const [password2Visible, setPassword2Visible] = useState(false);
  const [loading, setLoading] = useState(false);

  const screenHeight = Dimensions.get("window").height;
  const router = useRouter();

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validatePassword = (password) => {
    const requirements = [
      { test: password.length >= 8, message: "Password must be at least 8 characters long." },
      { test: /[A-Z]/.test(password), message: "Password must include at least one uppercase letter." },
      { test: /[a-z]/.test(password), message: "Password must include at least one lowercase letter." },
      { test: /\d/.test(password), message: "Password must include at least one number." },
      { test: /[@$!%*?&#]/.test(password), message: "Password must include at least one special character." },
    ];

    for (const requirement of requirements) {
      if (!requirement.test) {
        return { valid: false, message: requirement.message };
      }
    }
    return { valid: true };
  };

  const handleSignUp = async () => {
    if (!isValidEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    const passwordValidation = validatePassword(password1);
    if (!passwordValidation.valid) {
      Alert.alert("Weak Password", passwordValidation.message);
      return;
    }

    if (password1 !== password2) {
      Alert.alert("Passwords Do Not Match", "Please make sure the passwords match.");
      return;
    }

    if (!name.trim()) {
      Alert.alert("Invalid Name", "Name cannot be empty.");
      return;
    }

    const userData = { name, email, password: password1 };
    setLoading(true);

    try {
      const db = await getDatabase();
      const existingUser = await db.getFirstAsync(
        'SELECT id, email FROM users WHERE email = ?',
        [email]
      );
      
      if (existingUser) {
        setLoading(false);
        Alert.alert("Email Already Exists", "This email is already registered. Please sign in instead.");
        return;
      }

      const response = await fetch(
        "https://taskmanageruofl-af62f00a6541.herokuapp.com/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        }
      );

      const data = await response.json();

      if (response.ok) {
        try {
          const timestamp = Date.now();
          const userId = generateUUID();

          await db.runAsync(
            'INSERT INTO users (id, email, name, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, 0)',
            [userId, email, name, timestamp, timestamp]
          );

          Alert.alert("Success", "You have signed up successfully! Please sign in.");
          router.push("/signin");
        } catch (error) {
          console.error("Database Error:", error);
          Alert.alert("Error", "Failed to save user data locally.");
        }
      } else {
        Alert.alert("Error", data.error || "Something went wrong.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to sign up. Please try again later.");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const goToSignIn = () => {
    router.push("/signin");
  };

  return (
    <Provider>
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={colors.gradient} style={styles.gradient}>
          <Image
            source={require("../assets/images/app-logo.png")}
            style={[styles.logo, { marginTop: screenHeight * 0.05 }]}
          />
          <Surface style={styles.formContainer} elevation={4}>
            <Headline style={styles.title}>Sign Up</Headline>
            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              autoCapitalize="words"
              left={<TextInput.Icon icon="account" color={colors.gray} />}
              outlineColor={colors.lightGray}
              activeOutlineColor={colors.primary}
            />
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              left={<TextInput.Icon icon="email" color={colors.gray} />}
              outlineColor={colors.lightGray}
              activeOutlineColor={colors.primary}
            />
            <HelperText type="info" visible={email.length > 0 && !isValidEmail(email)}>
              Please enter a valid email address
            </HelperText>
            <TextInput
              label="Password"
              value={password1}
              onChangeText={setPassword1}
              mode="outlined"
              style={styles.input}
              secureTextEntry={!password1Visible}
              autoCapitalize="none"
              left={<TextInput.Icon icon="lock" color={colors.gray} />}
              outlineColor={colors.lightGray}
              activeOutlineColor={colors.primary}
              right={
                <TextInput.Icon 
                  icon={password1Visible ? "eye-off" : "eye"} 
                  onPress={() => setPassword1Visible(!password1Visible)}
                  color={colors.gray}
                />
              }
            />
            <TextInput
              label="Confirm Password"
              value={password2}
              onChangeText={setPassword2}
              mode="outlined"
              style={styles.input}
              secureTextEntry={!password2Visible}
              autoCapitalize="none"
              left={<TextInput.Icon icon="lock-check" color={colors.gray} />}
              outlineColor={colors.lightGray}
              activeOutlineColor={colors.primary}
              right={
                <TextInput.Icon 
                  icon={password2Visible ? "eye-off" : "eye"} 
                  onPress={() => setPassword2Visible(!password2Visible)}
                  color={colors.gray}
                />
              }
            />
            <HelperText 
              type="error" 
              visible={password2.length > 0 && password1 !== password2}
              style={{color: colors.danger}}
            >
              Passwords don't match
            </HelperText>
            <Button 
              mode="contained" 
              onPress={handleSignUp} 
              style={styles.button}
              buttonColor={colors.primary}
              loading={loading}
              disabled={loading}
            >
              Sign Up
            </Button>
            <View style={styles.signInContainer}>
              <Text style={{color: colors.dark}}>Already have an account?</Text>
              <Button 
                mode="text" 
                onPress={goToSignIn}
                textColor={colors.secondary}
              >
                Sign In
              </Button>
            </View>
          </Surface>
        </LinearGradient>
      </SafeAreaView>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  logo: { width: 150, height: 150, resizeMode: "contain", marginBottom: 20 },
  formContainer: { width: "100%", padding: 20, borderRadius: 10, backgroundColor: colors.white },
  title: { textAlign: "center", marginBottom: 20, color: colors.primary, fontWeight: "bold" },
  input: { marginBottom: 10, backgroundColor: "transparent" },
  button: { marginTop: 20, paddingVertical: 8 },
  signInContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 15 },
});