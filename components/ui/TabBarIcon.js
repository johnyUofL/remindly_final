import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function TabBarIcon({ name, color, size = 24 }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}