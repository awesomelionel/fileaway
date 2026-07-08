const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const repoRoot = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);
config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];
module.exports = config;
