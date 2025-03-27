import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Define your brand colors
const brandColors = {
  primary: '#0a7ea4',
  secondary: '#ADA996',
  error: '#F44336',
  background: '#FFFFFF',
  surface: '#F7F7F7',
};

// Create custom light theme
export const CustomLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: brandColors.primary,
    secondary: brandColors.secondary,
    error: brandColors.error,
    background: brandColors.background,
    surface: brandColors.surface,
  },
};

// Create custom dark theme
export const CustomDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#1D3D47', // Darker version of primary for dark theme
    secondary: '#8A8A8A', // Darker version of secondary for dark theme
    background: '#151718',
    surface: '#1E1E1E',
  },
};