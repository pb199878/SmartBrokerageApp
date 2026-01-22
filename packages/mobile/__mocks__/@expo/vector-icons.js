// Mock for @expo/vector-icons
const React = require('react');
const { Text } = require('react-native');

module.exports = {
  Ionicons: ({ name }) => React.createElement(Text, null, `Icon:${name}`),
  MaterialIcons: ({ name }) => React.createElement(Text, null, `Icon:${name}`),
  FontAwesome: ({ name }) => React.createElement(Text, null, `Icon:${name}`),
};
