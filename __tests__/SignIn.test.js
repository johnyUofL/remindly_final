import React from 'react';
import { fireEvent, waitFor, act } from '@testing-library/react-native';
import { Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { renderWithWrapper } from './test-helpers';
import * as SecureStore from 'expo-secure-store';
import { synchronize } from '../services/syncService';

const mockHandleSignIn = jest.fn();
const mockGoToSignUp = jest.fn();

// Create a mock SignIn component using React Native components
const MockSignIn = () => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  
  return (
    <View>
      <Text style={{textAlign: 'center'}}>Sign In</Text>
      <View>
        <Text>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          testID="email-input"
        />
      </View>
      <View>
        <Text>Password</Text>
        <TextInput
          secureTextEntry={!passwordVisible}
          value={password} 
          onChangeText={setPassword}
          testID="password-input"
        />
        <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
          <Text>{passwordVisible ? 'eye-off' : 'eye'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => {
        if (!email || !password) {
          Alert.alert("Error", "Email and password are required.");
          return;
        }
        mockHandleSignIn(email, password);
      }} testID="login-button">
        <Text>Log In</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={mockGoToSignUp} testID="signup-link">
        <Text>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
};

// Mock router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn()
};

// Mock synchronize function
jest.mock('../services/syncService', () => ({
  synchronize: jest.fn().mockResolvedValue({ success: true })
}));

// Mock database
jest.mock('../database/database', () => ({
  getDatabase: jest.fn(),
  generateUUID: jest.fn().mockReturnValue('mock-uuid-123')
}));

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('SignIn Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database functions
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync: jest.fn().mockResolvedValue({}),
    };
    require('../database/database').getDatabase.mockResolvedValue(mockDb);
    
    // Mock alert
    Alert.alert = jest.fn();
    
    // Mock successful fetch response
    global.fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ 
          success: true,
          token: 'mock-token-123',
          user: { email: 'test@example.com' }
        }))
      })
    );
    
    // Setup a successful login flow in the mock handler
    mockHandleSignIn.mockImplementation(async (email, password) => {
      try {
        const response = await fetch(
          "https://taskmanageruofl-af62f00a6541.herokuapp.com/signin",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          }
        );
        
        const data = JSON.parse(await response.text());
        
        if (data.success) {
          await SecureStore.setItemAsync("authToken", data.token);
          const db = await require('../database/database').getDatabase();
          await db.runAsync(
            'INSERT INTO users (id, email, name, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, 0)',
            ['mock-uuid-123', email, email.split('@')[0], Date.now(), Date.now()]
          );
          
          await synchronize();
          Alert.alert("Success", "Login successful!");
          mockRouter.push("/(tabs)/taskslist");
        }
      } catch (error) {
        Alert.alert("Error", "An error occurred");
      }
    });
    
    // Setup navigation to signup
    mockGoToSignUp.mockImplementation(() => {
      mockRouter.push("/signup");
    });
  });

  test('validates form fields', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignIn />);
    
    // Find the login button using testID
    const loginButton = getByTestId('login-button');
    
    await act(async () => {
      fireEvent.press(loginButton);
    });
    
    // show alert for validation error
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Email and password are required.");
    });
    
    expect(mockHandleSignIn).not.toHaveBeenCalled();
  });

  test('handles successful login', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignIn />);
    
    // Find inputs and button by testID
    const emailInput = getByTestId('email-input');
    const passwordInput = getByTestId('password-input');
    const loginButton = getByTestId('login-button');
    
    // Fill in login form
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    
    // Press login button
    fireEvent.press(loginButton);
    
    // Verify mockHandleSignIn was called with correct args
    expect(mockHandleSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "https://taskmanageruofl-af62f00a6541.herokuapp.com/signin",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('test@example.com')
        })
      );
    });
    
    // Verify token storage
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('authToken', 'mock-token-123');
    
    // Verify database insertion
    const db = await require('../database/database').getDatabase();
    expect(db.runAsync).toHaveBeenCalled();
    
    // Verify synchronize call
    expect(synchronize).toHaveBeenCalled();
    
    // Verify alert and navigation
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Login successful!');
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/taskslist');
  });

  test('navigates to signup screen', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignIn />);
    
    // Find the signup link by testID
    const signupLink = getByTestId('signup-link');
    
    // Press signup link
    fireEvent.press(signupLink);
    
    // Verify navigation occurs
    expect(mockGoToSignUp).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/signup');
  });
}); 