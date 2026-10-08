/**
 * Specs cover framework-free code (domain, SQLite repositories, sync, timers), so they run in plain
 * Node with babel-preset-expo for TS + the `@/` alias. Add `jest-expo` if component tests are needed.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: { "^.+\\.[jt]sx?$": "babel-jest" },
  // @noble/hashes ships ESM only: transform it (and nothing else) from node_modules.
  transformIgnorePatterns: ["/node_modules/(?!.*@noble)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/app/$1",
    "^pos-printer$": "<rootDir>/test/helpers/pos-printer-mock.js",
    "^react-native$": "<rootDir>/test/helpers/react-native-mock.js",
    "^expo$": "<rootDir>/test/helpers/expo-mock.js",
    "^expo-modules-core$": "<rootDir>/test/helpers/expo-mock.js",
    "^expo/virtual/env$": "<rootDir>/test/helpers/expo-env.js",
  },
  testMatch: ["<rootDir>/test/**/*.spec.ts", "<rootDir>/app/**/*.spec.ts"],
};
