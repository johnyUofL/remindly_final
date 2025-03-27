import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from 'expo-router';

// colors from the styles folder
import { colors } from '../styles/colors';

export default function SplashScreen() {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create a zoom-in and zoom-out animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2, // Zoom in
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9, // Zoom out
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1, 
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim]);

  const handleStart = () => {
    router.push("/signin");
  };

  return (
    <LinearGradient
      colors={colors.gradient} 
      style={styles.container}
    >
      <Animated.Image
        source={require("../assets/images/splash-image.png")} 
        style={[
          styles.image,
          { transform: [{ scale: scaleAnim }] },  
        ]}
      />
      <Text style={styles.title}>
        Remember your Tasks with <Text style={styles.highlight}>Remindly</Text>
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleStart}
      >
        <Text style={styles.buttonText}>Let's Start</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 376,
    height: 340,
    marginBottom: 20,
  },
  title: {
    fontSize: 55, 
    fontFamily: "AbhayaLibre-ExtraBold", 
    color: colors.white, 
    textAlign: "center",
    width: "80%", 
  },
  highlight: {
    color: colors.primary, 
  },
  button: {
    backgroundColor: colors.accent,
    width: "90%",
    height: 67,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  buttonText: {
    color: colors.dark,
    fontSize: 16,
    fontWeight: "bold",
  },
});

export function Index() {
  // Redirect from the root to the tabs
  return <Redirect href="/(tabs)/taskslist" />;
}
