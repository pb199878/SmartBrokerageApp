// Jest configuration for @smart-brokerage/mobile
const path = require('path');

module.exports = {
  preset: 'jest-expo',
  
  // Set root directory to monorepo root
  rootDir: path.resolve(__dirname, '../..'),
  
  // Tell Jest where to find tests
  roots: ['<rootDir>/packages/mobile/src'],
  
  // Explicit transformer
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      { configFile: path.resolve(__dirname, 'babel.config.js') }
    ],
  },
  
  // Transform these packages from node_modules
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@smart-brokerage/.*|@tanstack/.*)',
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Module name mapper for mocked modules
  moduleNameMapper: {
    '^@expo/vector-icons$': '<rootDir>/packages/mobile/__mocks__/@expo/vector-icons.js',
    '^expo-linear-gradient$': '<rootDir>/packages/mobile/__mocks__/expo-linear-gradient.js',
    '^react-native-paper$': '<rootDir>/packages/mobile/__mocks__/react-native-paper.js',
  },
  
  // Test match pattern
  testMatch: ['<rootDir>/packages/mobile/**/*.test.{ts,tsx}'],
};
