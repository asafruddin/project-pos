// Expo configures Metro for pnpm monorepos automatically (SDK 52+).
// Only additions needed here: allow `.sql` imports for drizzle migrations.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("sql");

module.exports = config;
