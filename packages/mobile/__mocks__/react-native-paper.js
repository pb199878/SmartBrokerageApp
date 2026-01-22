// Mock for react-native-paper
const React = require('react');
const { Text, View, TouchableOpacity } = require('react-native');

module.exports = {
  Text: ({ children }) => React.createElement(Text, null, children),
  Button: ({ children, onPress }) => 
    React.createElement(TouchableOpacity, { onPress }, 
      React.createElement(Text, null, children)),
  Chip: ({ children }) => React.createElement(Text, null, children),
  Surface: ({ children }) => React.createElement(View, null, children),
  ActivityIndicator: () => React.createElement(Text, null, 'Loading...'),
  Divider: () => React.createElement(View, null),
};
