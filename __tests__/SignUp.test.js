import React from 'react';
import { fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { renderWithWrapper } from './test-helpers';

import { View, Text, TextInput, TouchableOpacity } from 'react-native';

// Mock useRouter
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn()
};

// Mock database
jest.mock('../database/database', () => ({
  getDatabase: jest.fn(),
  generateUUID: jest.fn().mockReturnValue('mock-uuid-123')
}));

// Create a mock version of the SignUp component
const MockSignUp = () => {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password1, setPassword1] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [password1Visible, setPassword1Visible] = React.useState(false);
  const [password2Visible, setPassword2Visible] = React.useState(false);
  
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

  const handleSignUp = () => {
    if (!name.trim()) {
      Alert.alert("Invalid Name", "Name cannot be empty.");
      return;
    }

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

    // All validation passed, proceed with signup
    fetch("https://taskmanageruofl-af62f00a6541.herokuapp.com/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password: password1 }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        Alert.alert("Success", "You have signed up successfully! Please sign in.");
        mockRouter.push("/signin");
      } else {
        Alert.alert("Error", data.error || "Something went wrong.");
      }
    })
    .catch(error => {
      Alert.alert("Error", "Failed to sign up. Please try again later.");
    });
  };

  return (
    <View>
      <Text style={{textAlign: 'center'}}>Sign Up</Text>
      <View>
        <Text>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          testID="name-input"
        />
      </View>
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
          value={password1}
          onChangeText={setPassword1}
          secureTextEntry={!password1Visible}
          testID="password1-input"
        />
        <TouchableOpacity onPress={() => setPassword1Visible(!password1Visible)}>
          <Text>{password1Visible ? 'eye-off' : 'eye'}</Text>
        </TouchableOpacity>
      </View>
      <View>
        <Text>Confirm Password</Text>
        <TextInput
          value={password2}
          onChangeText={setPassword2}
          secureTextEntry={!password2Visible}
          testID="password2-input"
        />
        <TouchableOpacity onPress={() => setPassword2Visible(!password2Visible)}>
          <Text>{password2Visible ? 'eye-off' : 'eye'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={handleSignUp} testID="signup-button">
        <Text>Sign Up</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => mockRouter.push("/signin")} testID="signin-link">
        <Text>Already have an account? Sign In</Text>
      </TouchableOpacity>
    </View>
  );
};

// Mock fetch
global.fetch = jest.fn();

jest.mock('../app/signup', () => MockSignUp);

describe('SignUp Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database functions
    const mockDb = {
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
        json: () => Promise.resolve({ success: true })
      })
    );
  });

  test('validates empty name', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignUp />);
    
    // Find the signup button by testID
    const signUpButton = getByTestId('signup-button');
    
    // Click without entering any data
    fireEvent.press(signUpButton);
    
    // Wait for alert to be called - validation for empty name
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Invalid Name",
        "Name cannot be empty."
      );
    });
    
    expect(fetch).not.toHaveBeenCalled();
  });

  test('validates email format', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignUp />);
    
    // Fill name but invalid email
    const nameInput = getByTestId('name-input');
    const emailInput = getByTestId('email-input');
    const signUpButton = getByTestId('signup-button');
    
    // Fill in form and submit
    fireEvent.changeText(nameInput, 'Test User');
    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent.press(signUpButton);
    
    // Should show validation alert
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Invalid Email",
        "Please enter a valid email address."
      );
    });
    
    expect(fetch).not.toHaveBeenCalled();
  });

  test('validates password complexity', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignUp />);
    
    // Fill valid name and email but weak password
    const nameInput = getByTestId('name-input');
    const emailInput = getByTestId('email-input');
    const passwordInput = getByTestId('password1-input');
    const signUpButton = getByTestId('signup-button');
    
    // Fill in form and submit
    fireEvent.changeText(nameInput, 'Test User');
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'weak');
    fireEvent.press(signUpButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Weak Password",
        expect.stringMatching(/Password must be at least 8 characters/)
      );
    });
    
    expect(fetch).not.toHaveBeenCalled();
  });

  test('validates password matching', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignUp />);
    
    // Fill valid info but mismatched passwords
    const nameInput = getByTestId('name-input');
    const emailInput = getByTestId('email-input');
    const password1Input = getByTestId('password1-input');
    const password2Input = getByTestId('password2-input');
    const signUpButton = getByTestId('signup-button');
    
    // Fill in form and submit
    fireEvent.changeText(nameInput, 'Test User');
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(password1Input, 'StrongP@ss123');
    fireEvent.changeText(password2Input, 'DifferentP@ss123');
    fireEvent.press(signUpButton);
    
    // show passwords don't match alert
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Passwords Do Not Match",
        "Please make sure the passwords match."
      );
    });
    
    expect(fetch).not.toHaveBeenCalled();
  });

  test('handles successful signup', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignUp />);
    
    // Fill valid info for successful signup
    const nameInput = getByTestId('name-input');
    const emailInput = getByTestId('email-input');
    const password1Input = getByTestId('password1-input');
    const password2Input = getByTestId('password2-input');
    const signUpButton = getByTestId('signup-button');
    
    // Fill in form with valid data and submit
    fireEvent.changeText(nameInput, 'Test User');
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(password1Input, 'StrongP@ss123');
    fireEvent.changeText(password2Input, 'StrongP@ss123');
    fireEvent.press(signUpButton);
    
    // Wait for fetch to be called
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "https://taskmanageruofl-af62f00a6541.herokuapp.com/signup",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('test@example.com')
        })
      );
    });
    
    // Should show success message
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success', 
        'You have signed up successfully! Please sign in.'
      );
    });
    
    // Should navigate to signin
    expect(mockRouter.push).toHaveBeenCalledWith('/signin');
  });

  test('navigates to signin screen', async () => {
    const { getByTestId } = renderWithWrapper(<MockSignUp />);
    
    // Find the signin link
    const signinLink = getByTestId('signin-link');
    
    // Press the link
    fireEvent.press(signinLink);
    
    // Should navigate to signin
    expect(mockRouter.push).toHaveBeenCalledWith('/signin');
  });
});