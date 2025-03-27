import React from 'react';
import { View, Text } from 'react-native';
import { render } from '@testing-library/react-native';

// Mock Provider for react-native-paper
export const MockProvider = ({ children }) => {
  return <View>{children}</View>;
};

// Helper function to render components with necessary wrappers
export const renderWithWrapper = (component) => {
  return render(
    <MockProvider>
      {component}
    </MockProvider>
  );
};

// fake test to avoid complilation error
describe('Test Helpers', () => {
  test('MockProvider renders children correctly', () => {
    const { getByText } = render(
      <MockProvider>
        <Text>Test Child</Text>
      </MockProvider>
    );
    
    expect(getByText('Test Child')).toBeTruthy();
  });
  
  test('renderWithWrapper renders components with the MockProvider', () => {
    const { getByText } = renderWithWrapper(<Text>Wrapped Component</Text>);
    
    expect(getByText('Wrapped Component')).toBeTruthy();
  });
});