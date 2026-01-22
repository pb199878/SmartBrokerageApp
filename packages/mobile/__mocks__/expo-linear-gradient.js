// Mock for expo-linear-gradient
const React = require('react');
const { View } = require('react-native');

module.exports = {
  LinearGradient: ({ children }) => React.createElement(View, null, children),
};
